const pool = require('../config/db');
const payos = require('../config/payos');
const logger = require('../utils/logger');
const supabase = require('../config/supabase');

// Customer Function
async function getUserOrderHistory(userId) {
  const query = `
    SELECT 
      o.id AS order_id,
      o.total_amount,
      o.status AS order_status,
      o.created_at,
      e.title AS event_title,
      e.event_type,
      e.location,
      COALESCE(
        json_agg(
          json_build_object(
            'seat_number', s.seat_number,
            'zone_name', s.zone_name,
            'price', oi.price
          )
        ) FILTER (WHERE s.id IS NOT NULL), '[]'
      ) AS items
    FROM orders o
    JOIN order_items oi ON o.id = oi.order_id
    JOIN seats s ON oi.seat_id = s.id
    JOIN events e ON s.event_id = e.id
    WHERE o.user_id = $1
    GROUP BY o.id, e.id
    ORDER BY o.created_at DESC;
  `;
  const res = await pool.query(query, [userId]);
  return res.rows;
}

// function check user còn phiên giữ ghế nào hay không
async function checkActiveHold(client, userId) {
  const result = await client.query(
    `
    SELECT 1 FROM seats 
    WHERE reserved_by = $1 
      AND status IN ('RESERVED', 'PAYMENT_PROCESSING') 
      AND reserved_until > NOW()
    LIMIT 1;
    `,
    [userId]
  );
  return result.rows.length > 0;
}

async function requestSeatHold(userId, requestedSeatIds) {
  if (process.env.DATABASE_URL) {
    try {
      const client = await pool.connect();
      try {
        const hasActiveHold = await checkActiveHold(client, userId);
        if (hasActiveHold) {
          logger.hold('CONFLICT', `User ${userId} bị chặn vì đang có phiên giữ vé chưa hoàn tất`);
          return {
            success: false,
            code: 'USER_HAS_ACTIVE_HOLD',
            message: 'Bạn đang có một phiên giữ vé chưa hoàn tất.',
          };
        }

        await client.query('BEGIN');
        const lockedSeatsResult = await client.query(
          `SELECT id, seat_number, price, zone_name FROM seats WHERE id = ANY($1::uuid[]) AND status = 'AVAILABLE' ORDER BY id ASC FOR UPDATE SKIP LOCKED;`,
          [requestedSeatIds]
        );
        const availableSeats = lockedSeatsResult.rows;
        const availableIds = availableSeats.map((s) => s.id);

        if (availableSeats.length === 0) {
          await client.query('ROLLBACK');
          return {
            success: false,
            code: 'ALL_SEATS_TAKEN',
            message: 'Tất cả các ghế bạn chọn đều đã bị người khác giữ.',
          };
        }

        if (availableSeats.length === requestedSeatIds.length) {
          const holdDurationSeconds = 300;
          const reservedUntil = new Date(Date.now() + holdDurationSeconds * 1000);
          const updateResult = await client.query(
            `UPDATE seats SET status = 'RESERVED', reserved_by = $1, reserved_until = $2 WHERE id = ANY($3::uuid[]) RETURNING id, seat_number, status, reserved_until;`,
            [userId, reservedUntil, availableIds]
          );
          await client.query('COMMIT');
          return {
            success: true,
            code: 'FULLY_RESERVED',
            reservedSeats: updateResult.rows,
            reservedUntil,
          };
        }

        await client.query('ROLLBACK');
      } finally {
        client.release();
      }
    } catch (err) {
      logger.error('PG_SEAT_HOLD_REQUEST', err.message);
    }
  }

  // Fallback sang Supabase Client
  const { data: dbSeats, error: fetchErr } = await supabase
    .from('seats')
    .select('id, seat_number, price, zone_name, status, reserved_by, reserved_until')
    .in('id', requestedSeatIds);

  if (fetchErr) {
    logger.error('SUPABASE_SEAT_HOLD_FETCH', fetchErr.message);
    throw fetchErr;
  }

  const now = new Date();
  const availableSeats = (dbSeats || []).filter(s => {
    if (s.status === 'AVAILABLE') return true;
    if ((s.status === 'RESERVED' || s.status === 'PAYMENT_PROCESSING') && s.reserved_until && new Date(s.reserved_until) < now) return true;
    if (s.reserved_by === userId) return true;
    return false;
  });

  if (availableSeats.length === 0) {
    return {
      success: false,
      code: 'ALL_SEATS_TAKEN',
      message: 'Tất cả các ghế bạn chọn đều đã bị người khác giữ.',
    };
  }

  const holdDurationSeconds = 300; // 5 phút giữ chỗ
  const reservedUntil = new Date(Date.now() + holdDurationSeconds * 1000);
  const availableIds = availableSeats.map(s => s.id);

  await supabase.from('seats').update({
    status: 'RESERVED',
    reserved_by: userId,
    reserved_until: reservedUntil.toISOString()
  }).in('id', availableIds);

  return {
    success: true,
    code: 'FULLY_RESERVED',
    reservedSeats: availableSeats,
    reservedUntil,
  };
}

async function confirmPartialHold(userId, confirmSeatIds) {
  const client = await pool.connect();

  try {
    // 1. Kiểm tra Active Hold
    const hasActiveHold = await checkActiveHold(client, userId);
    if (hasActiveHold) {
      logger.hold('CONFLICT', `User ${userId} bị chặn confirm vì đang có phiên giữ vé chưa hoàn tất`);
      return {
        success: false,
        code: 'USER_HAS_ACTIVE_HOLD',
        message: 'Bạn đang có một phiên giữ vé chưa hoàn tất.',
      };
    }

    await client.query('BEGIN');

    const holdDurationSeconds = 30;
    const reservedUntil = new Date(Date.now() + holdDurationSeconds * 1000);

    // 2. Thử UPDATE chính thức các ghế này NẾU chúng vẫn còn status = 'AVAILABLE'
    const updateResult = await client.query(
      `
      UPDATE seats
      SET status = 'RESERVED', reserved_by = $1, reserved_until = $2
      WHERE id = ANY($3::uuid[])
        AND status = 'AVAILABLE'
      RETURNING id, seat_number, status, reserved_until;
      `,
      [userId, reservedUntil, confirmSeatIds]
    );

    // 3. Kiểm tra xem có ghế nào bị User khác "cướp" mất trong thời gian User hiện tại suy nghĩ không
    if (updateResult.rows.length !== confirmSeatIds.length) {
      // Nếu không đủ số lượng -> Rollback hủy toàn bộ lượt chọn này
      await client.query('ROLLBACK');
      logger.hold('CONFLICT', `User ${userId} xác nhận partial thất bại (ghế đã bị người khác chọn trong lúc chờ)`);
      return {
        success: false,
        code: 'PARTIAL_HOLD_EXPIRED',
        message: 'Rất tiếc! Trong lúc bạn suy nghĩ, các ghế còn lại cũng đã được người khác giữ mất.',
      };
    }

    await client.query('COMMIT');
    logger.hold('SUCCESS', `User ${userId} đã xác nhận partial giữ ${updateResult.rows.length} ghế thành công`);

    return {
      success: true,
      code: 'PARTIAL_RESERVED_SUCCESS',
      reservedSeats: updateResult.rows,
      reservedUntil,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('CONFIRM_PARTIAL_HOLD', err.message, err);
    throw err;
  } finally {
    client.release();
  }
}

// Lấy danh sách sự kiện
async function getAllEvents() {
  if (process.env.DATABASE_URL) {
    try {
      const res = await pool.query('SELECT * FROM events ORDER BY created_at DESC;');
      return res.rows;
    } catch (err) {
      logger.error('PG_GET_ALL_EVENTS', err.message);
    }
  }

  // Fallback sang Supabase Client
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    logger.error('SUPABASE_GET_EVENTS', error.message);
    throw error;
  }
  return data;
}

// Lấy 1 sự kiện theo ID
async function getEventById(eventId) {
  if (process.env.DATABASE_URL) {
    try {
      const res = await pool.query('SELECT * FROM events WHERE id = $1 LIMIT 1;', [eventId]);
      if (res.rows.length > 0) return res.rows[0];
    } catch (err) {
      logger.error('PG_GET_EVENT_BY_ID', err.message);
    }
  }

  // Fallback sang Supabase Client
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('id', eventId)
    .single();

  if (error) {
    logger.error('SUPABASE_GET_EVENT_BY_ID', error.message);
    throw error;
  }
  return data;
}

// Lấy chi tiết ghế / zones
async function getSeatsByEvent(eventId) {
  if (process.env.DATABASE_URL) {
    try {
      await pool.query(`
        UPDATE seats 
        SET status = 'AVAILABLE', reserved_by = NULL, reserved_until = NULL, current_order_id = NULL
        WHERE status IN ('RESERVED', 'PAYMENT_PROCESSING') AND reserved_until < NOW();
      `);
      const res = await pool.query('SELECT * FROM seats WHERE event_id = $1 ORDER BY seat_number ASC;', [eventId]);
      return res.rows;
    } catch (err) {
      logger.error('PG_GET_SEATS', err.message);
    }
  }

  // Fallback sang Supabase Client
  const { data, error } = await supabase
    .from('seats')
    .select('*')
    .eq('event_id', eventId)
    .order('seat_number', { ascending: true });

  if (error) {
    logger.error('SUPABASE_GET_SEATS', error.message);
    throw error;
  }
  return data;
}

async function getZonesByEvent(eventId) {
  if (process.env.DATABASE_URL) {
    try {
      await pool.query(`
        UPDATE seats 
        SET status = 'AVAILABLE', reserved_by = NULL, reserved_until = NULL, current_order_id = NULL
        WHERE status IN ('RESERVED', 'PAYMENT_PROCESSING') AND reserved_until < NOW();
      `);
      const res = await pool.query(`
        SELECT 
          zone_name,
          price,
          COUNT(id) FILTER (WHERE status = 'AVAILABLE') AS available_count,
          COUNT(id) AS total_count
        FROM seats 
        WHERE event_id = $1 
        GROUP BY zone_name, price 
        ORDER BY price DESC;
      `, [eventId]);
      return res.rows;
    } catch (err) {
      logger.error('PG_GET_ZONES', err.message);
    }
  }

  // Fallback sang Supabase Client
  const { data: seats, error } = await supabase
    .from('seats')
    .select('*')
    .eq('event_id', eventId);

  if (error) {
    logger.error('SUPABASE_GET_ZONES', error.message);
    throw error;
  }

  const zoneMap = {};
  for (const s of (seats || [])) {
    const key = s.zone_name;
    if (!zoneMap[key]) {
      zoneMap[key] = {
        zone_name: s.zone_name,
        price: s.price,
        available_count: 0,
        total_count: 0
      };
    }
    zoneMap[key].total_count += 1;
    if (s.status === 'AVAILABLE') {
      zoneMap[key].available_count += 1;
    }
  }
  return Object.values(zoneMap);
}

// Khai báo Map lưu vết các ghế đang tạm giữ trong RAM Node.js: seatId -> expiredAt (timestamp)
const localReservedSeats = new Map();

// Định kỳ dọn dẹp các ghế đã hết hạn trong RAM (mỗi 10 giây chạy 1 lần để tránh rò rỉ bộ nhớ)
setInterval(() => {
  const currentTime = Date.now();
  for (const [seatId, expiredAt] of localReservedSeats.entries()) {
    if (expiredAt <= currentTime) {
      localReservedSeats.delete(seatId);
    }
  }
}, 10 * 1000);

// Giữ ghế Seat-based tối ưu hiệu năng cao

// Giữ ghế Zone-based
async function reserveSeatsByMultipleZones(userId, eventId, zoneRequests) {
  // zoneRequests: [ { zoneName: 'VIP', quantity: 2 }, { zoneName: 'REGULAR', quantity: 3 } ]
  if (!zoneRequests || !Array.isArray(zoneRequests) || zoneRequests.length === 0) {
    throw new Error('Danh sách khu vực chọn không hợp lệ.');
  }

  // Lọc bỏ các request có quantity <= 0
  const validRequests = zoneRequests
    .map(r => ({ zoneName: r.zoneName, quantity: Number(r.quantity) }))
    .filter(r => r.quantity > 0);

  if (validRequests.length === 0) {
    throw new Error('Bạn chưa chọn số lượng vé hợp lệ nào.');
  }

  const totalRequested = validRequests.reduce((sum, r) => sum + r.quantity, 0);
  const now = new Date();
  const until = new Date(Date.now() + 30 * 1000); // 30s giữ ghế

  const query = `
  WITH user_active_hold AS (
    -- 1. Chặn ngay nếu user đang có phiên giữ vé còn hiệu lực
    SELECT 1 FROM seats 
    WHERE reserved_by = $1 
      AND status IN ('RESERVED', 'PAYMENT_PROCESSING') 
      AND reserved_until > $2
    LIMIT 1
  ),
  zone_demands AS (
    -- 2. Parse JSON và lọc luôn nếu user đang active hold
    SELECT "zoneName" AS zone_name, quantity::int AS required_qty 
    FROM jsonb_to_recordset($3::jsonb) AS x("zoneName" text, quantity int)
    WHERE NOT EXISTS (SELECT 1 FROM user_active_hold)
  ),
  locked_seats AS (
    -- 3. Quét B-Tree Index cực nhanh với SKIP LOCKED
    SELECT s.id, s.seat_number, s.zone_name, s.price
    FROM zone_demands zd
    CROSS JOIN LATERAL (
      SELECT id, seat_number, zone_name, price
      FROM seats
      WHERE event_id = $4
        AND zone_name = zd.zone_name
        AND status = 'AVAILABLE'
      ORDER BY seat_number ASC
      LIMIT zd.required_qty
      FOR UPDATE SKIP LOCKED
    ) s
  ),
  checked_availability AS (
    -- 4. Kiểm tra xem từng zone có đủ 100% số vé yêu cầu hay không
    SELECT zd.zone_name, zd.required_qty, COUNT(ls.id) AS locked_qty
    FROM zone_demands zd
    LEFT JOIN locked_seats ls ON zd.zone_name = ls.zone_name
    GROUP BY zd.zone_name, zd.required_qty
  )
  -- 5. Chỉ UPDATE nếu không có zone nào bị thiếu vé
  UPDATE seats
  SET status = 'RESERVED', reserved_by = $1, reserved_until = $5
  WHERE id IN (SELECT id FROM locked_seats)
    AND NOT EXISTS (
      SELECT 1 FROM checked_availability WHERE locked_qty < required_qty
    )
  RETURNING id, seat_number, zone_name, price, status, reserved_until;
`;

  if (process.env.DATABASE_URL) {
    try {
      const result = await pool.query(query, [
        userId,
        now,
        JSON.stringify(validRequests),
        eventId,
        until
      ]);

      if (result.rows.length === totalRequested) {
        logger.hold('SUCCESS', `User ${userId} giữ thành công ${result.rows.length} vé khu vực đến ${until.toLocaleTimeString()}`);
        return {
          seats: result.rows,
          seatIds: result.rows.map(s => s.id),
          reserved_until: until,
          totalTickets: result.rows.length
        };
      }
    } catch (err) {
      logger.error('PG_RESERVE_ZONE_ERROR', err.message);
    }
  }

  // Fallback sang Supabase
  const { data: eventSeats, error: evSeatsErr } = await supabase
    .from('seats')
    .select('*')
    .eq('event_id', eventId)
    .eq('status', 'AVAILABLE');

  if (evSeatsErr) throw evSeatsErr;

  const reserved = [];
  for (const req of validRequests) {
    const matching = (eventSeats || []).filter(s => {
      const sZone = (s.zone_name || '').toUpperCase();
      const rZone = (req.zoneName || '').toUpperCase();
      const isMatch = sZone === rZone || sZone.includes(rZone) || rZone.includes(sZone);
      return isMatch && !reserved.some(r => r.id === s.id);
    });
    if (matching.length < req.quantity) {
      throw new Error(`Khu vực ${req.zoneName} không đủ ${req.quantity} vé khả dụng.`);
    }
    reserved.push(...matching.slice(0, req.quantity));
  }

  const resIds = reserved.map(s => s.id);
  await supabase.from('seats').update({
    status: 'RESERVED',
    reserved_by: userId,
    reserved_until: until.toISOString()
  }).in('id', resIds);

  return {
    seats: reserved,
    seatIds: resIds,
    reserved_until: until,
    totalTickets: reserved.length
  };
}

// Hủy giữ ghế
async function releaseReservedSeats(userId, seatIds) {
  if (process.env.DATABASE_URL) {
    try {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await client.query(`
          UPDATE seats 
          SET status = 'AVAILABLE', reserved_by = NULL, reserved_until = NULL, current_order_id = NULL
          WHERE id = ANY($1::uuid[]) 
            AND reserved_by = $2 
            AND status IN ('RESERVED', 'PAYMENT_PROCESSING')
          RETURNING id, seat_number, current_order_id;
        `, [seatIds, userId]);

        const orderIds = [...new Set(result.rows.map(r => r.current_order_id).filter(Boolean))];
        if (orderIds.length > 0) {
          await client.query(`UPDATE orders SET status = 'CANCELLED' WHERE id = ANY($1::uuid[]);`, [orderIds]);
        }
        await client.query('COMMIT');
        return result.rows;
      } finally {
        client.release();
      }
    } catch (err) {
      logger.error('PG_SEAT_RELEASE', err.message);
    }
  }

  // Fallback sang Supabase Client
  const { data } = await supabase.from('seats').update({
    status: 'AVAILABLE',
    reserved_by: null,
    reserved_until: null,
    current_order_id: null
  }).in('id', seatIds).eq('reserved_by', userId).select();

  return data || [];
}

// Khởi tạo thanh toán
async function startCheckoutSeats(userId, seatIds, returnUrl, cancelUrl) {
  if (process.env.DATABASE_URL) {
    try {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const seatRes = await client.query(
          `SELECT * FROM seats WHERE id = ANY($1::uuid[]) ORDER BY id ASC FOR UPDATE;`,
          [seatIds]
        );

        let total = 0;
        for (const seat of seatRes.rows) {
          total += Number(seat.price);
        }

        const paymentTimeout = new Date(Date.now() + 5 * 60 * 1000);
        const orderCode = Number(String(Date.now()).slice(-6) + Math.floor(Math.random() * 90 + 10));
        const orderRes = await client.query(`
          INSERT INTO orders (user_id, total_amount, status, expires_at, order_code) 
          VALUES ($1, $2, 'PAYMENT_PROCESSING', $3, $4) 
          RETURNING *;
        `, [userId, total, paymentTimeout, orderCode]);
        const order = orderRes.rows[0];

        for (const s of seatRes.rows) {
          await client.query(
            `INSERT INTO order_items (order_id, seat_id, price) VALUES ($1, $2, $3);`,
            [order.id, s.id, s.price]
          );
        }

        await client.query(`
          UPDATE seats 
          SET status = 'PAYMENT_PROCESSING', reserved_until = $1, current_order_id = $2 
          WHERE id = ANY($3::uuid[]);
        `, [paymentTimeout, order.id, seatIds]);

        await client.query('COMMIT');

        const payosOrder = {
          orderCode: orderCode,
          amount: Number(total),
          description: `VE SU KIEN ${orderCode}`.slice(0, 25),
          returnUrl: returnUrl || `http://localhost:3000/events?orderId=${order.id}&status=success`,
          cancelUrl: cancelUrl || `http://localhost:3000/events?orderId=${order.id}&status=cancel`,
        };

        let checkoutUrl = null;
        try {
          const paymentLink = await (payos.paymentRequests?.create ? payos.paymentRequests.create(payosOrder) : payos.createPaymentLink(payosOrder));
          checkoutUrl = paymentLink.checkoutUrl;
        } catch (payErr) {
          checkoutUrl = `https://pay.payos.vn/web/${orderCode}`;
        }

        return {
          orderId: order.id,
          orderCode: orderCode,
          checkoutUrl: checkoutUrl,
          totalAmount: total,
          paymentTimeout: paymentTimeout
        };
      } catch (err) {
        await client.query('ROLLBACK');
        logger.error('PG_START_CHECKOUT_TRANSACTION', err.message);
      } finally {
        client.release();
      }
    } catch (pgErr) {
      logger.error('PG_START_CHECKOUT', pgErr.message);
    }
  }

  // Fallback sang Supabase Client
  const { data: seats, error: sErr } = await supabase
    .from('seats')
    .select('id, seat_number, price, status, reserved_by, reserved_until')
    .in('id', seatIds);

  if (sErr || !seats || seats.length === 0) {
    throw new Error('Không tìm thấy thông tin ghế để thanh toán.');
  }

  const total = seats.reduce((sum, s) => sum + Number(s.price || 0), 0);
  const paymentTimeout = new Date(Date.now() + 5 * 60 * 1000);
  const orderCode = Number(String(Date.now()).slice(-6) + Math.floor(Math.random() * 90 + 10));

  const { data: order, error: oErr } = await supabase.from('orders').insert([{
    user_id: userId,
    total_amount: total,
    status: 'PAYMENT_PROCESSING',
    expires_at: paymentTimeout.toISOString(),
    order_code: orderCode
  }]).select().single();

  if (oErr) {
    logger.error('SUPABASE_ORDER_INSERT', oErr.message);
    throw oErr;
  }

  const orderItems = seats.map(s => ({
    order_id: order.id,
    seat_id: s.id,
    price: s.price
  }));

  const { error: itemsErr } = await supabase.from('order_items').insert(orderItems);
  if (itemsErr) logger.error('SUPABASE_ORDER_ITEMS_INSERT', itemsErr.message);

  await supabase.from('seats').update({
    status: 'PAYMENT_PROCESSING',
    reserved_until: paymentTimeout.toISOString(),
    current_order_id: order.id
  }).in('id', seatIds);

  const payosOrder = {
    orderCode: orderCode,
    amount: Number(total),
    description: `VE SU KIEN ${orderCode}`.slice(0, 25),
    returnUrl: returnUrl || `http://localhost:3000/events?orderId=${order.id}&status=success`,
    cancelUrl: cancelUrl || `http://localhost:3000/events?orderId=${order.id}&status=cancel`
  };

  let checkoutUrl = null;
  try {
    const paymentLink = await (payos.paymentRequests?.create ? payos.paymentRequests.create(payosOrder) : payos.createPaymentLink(payosOrder));
    checkoutUrl = paymentLink.checkoutUrl;
  } catch (payErr) {
    checkoutUrl = `https://pay.payos.vn/web/${orderCode}`;
  }

  logger.payment('START', `User ${userId} tạo đơn #${orderCode} | ${seats.length} ghế -> Checkout URL: ${checkoutUrl}`);

  return {
    orderId: order.id,
    orderCode: orderCode,
    checkoutUrl: checkoutUrl,
    totalAmount: total,
    paymentTimeout: paymentTimeout
  };
}

// Webhook xử lý thanh toán
async function handlePaymentWebhook(orderIdentifier, isSuccess) {
  if (process.env.DATABASE_URL) {
    try {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const orderRes = await client.query(
          `SELECT * FROM orders WHERE (id::text = $1 OR order_code::text = $1) FOR UPDATE;`,
          [String(orderIdentifier)]
        );
        if (orderRes.rows.length > 0) {
          const order = orderRes.rows[0];
          const orderId = order.id;

          if (isSuccess) {
            await client.query(`UPDATE orders SET status = 'SUCCESS' WHERE id = $1;`, [orderId]);
            await client.query(`UPDATE seats SET status = 'SOLD', reserved_by = NULL, reserved_until = NULL, current_order_id = NULL WHERE current_order_id = $1;`, [orderId]);
          } else {
            await client.query(`UPDATE orders SET status = 'FAILED' WHERE id = $1;`, [orderId]);
            await client.query(`UPDATE seats SET status = 'AVAILABLE', reserved_by = NULL, reserved_until = NULL, current_order_id = NULL WHERE current_order_id = $1;`, [orderId]);
          }

          await client.query('COMMIT');
          return { status: isSuccess ? 'SUCCESS' : 'FAILED', orderId, orderCode: order.order_code };
        }
        await client.query('ROLLBACK');
      } finally {
        client.release();
      }
    } catch (err) {
      logger.error('PG_HANDLE_PAYMENT_WEBHOOK', err.message);
    }
  }

  // Fallback sang Supabase
  const isNumeric = !isNaN(Number(orderIdentifier));
  let orderQuery = supabase.from('orders').select('*');
  if (isNumeric) {
    orderQuery = orderQuery.eq('order_code', Number(orderIdentifier));
  } else {
    orderQuery = orderQuery.eq('id', String(orderIdentifier));
  }
  const { data: order } = await orderQuery.maybeSingle();
  if (!order) {
    return { success: true, message: 'Đơn hàng không tồn tại trong CSDL.' };
  }

  const newStatus = isSuccess ? 'SUCCESS' : 'FAILED';
  await supabase.from('orders').update({ status: newStatus }).eq('id', order.id);

  const seatStatus = isSuccess ? 'SOLD' : 'AVAILABLE';
  await supabase.from('seats').update({
    status: seatStatus,
    reserved_by: null,
    reserved_until: null,
    current_order_id: null
  }).eq('current_order_id', order.id);

  return { status: newStatus, orderId: order.id, orderCode: order.order_code };
}

// Admin Function 
async function createEventWithConfig(eventData) {
  const {
    title,
    description,
    location,
    venue,
    start_time,
    event_type,
    seatConfig,
    zoneConfigs,
    category,
    time,
    min_price,
    max_price,
    minPrice,
    maxPrice,
    image,
    banner,
    organizer,
    thumbnails,
    highlights,
    rules
  } = eventData;

  const loc = location || venue || 'Chưa xác định';
  const calculatedMinPrice = Number(min_price || minPrice || (seatConfig?.price) || 200000);
  const calculatedMaxPrice = Number(max_price || maxPrice || calculatedMinPrice);

  if (process.env.DATABASE_URL) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const eventRes = await client.query(`
        INSERT INTO events (title, description, location, start_time, event_type, category, time, min_price, max_price, image, banner, organizer, thumbnails, highlights, rules)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING *;
      `, [
        title,
        description || '',
        loc,
        start_time || new Date(),
        event_type || 'SEAT_BASED',
        category || 'Âm nhạc',
        time || '19:30 - 22:30',
        calculatedMinPrice,
        calculatedMaxPrice,
        image || '',
        banner || image || '',
        organizer || 'Ban tổ chức',
        thumbnails || (image ? [image] : []),
        highlights || [],
        rules || []
      ]);
      const event = eventRes.rows[0];

      if (event_type === 'SEAT_BASED') {
        const total = Number(seatConfig?.totalSeats) || 12;
        const price = Number(seatConfig?.price) || calculatedMinPrice;
        const prefix = seatConfig?.prefix || 'A';

        for (let i = 1; i <= total; i++) {
          await client.query(`
            INSERT INTO seats (event_id, seat_number, zone_name, price, status)
            VALUES ($1, $2, 'STANDARD', $3, 'AVAILABLE');
          `, [event.id, `${prefix}${i}`, price]);
        }
      } else {
        for (const z of (zoneConfigs || [])) {
          const count = Number(z.count) || 10;
          const price = Number(z.price) || 200000;
          const zoneName = (z.zoneName || 'STANDARD').toUpperCase();

          for (let i = 1; i <= count; i++) {
            await client.query(`
              INSERT INTO seats (event_id, seat_number, zone_name, price, status)
              VALUES ($1, $2, $3, $4, 'AVAILABLE');
            `, [event.id, `${zoneName}-${String(i).padStart(2, '0')}`, zoneName, price]);
          }
        }
      }

      await client.query('COMMIT');
      return event;
    } catch (err) {
      await client.query('ROLLBACK');
      logger.error('PG_CREATE_EVENT_CONFIG', err.message);
    } finally {
      client.release();
    }
  }

  // Fallback sang Supabase Client
  const eventPayload = {
    title,
    description: description || '',
    location: loc,
    start_time: start_time || new Date().toISOString(),
    event_type: event_type || 'SEAT_BASED',
    category: category || 'Âm nhạc',
    time: time || '19:30 - 22:30',
    min_price: calculatedMinPrice,
    max_price: calculatedMaxPrice,
    image: image || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=80',
    banner: banner || image || 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1600&q=80',
    organizer: organizer || 'Ban tổ chức',
    thumbnails: thumbnails || (image ? [image] : []),
    highlights: highlights || [],
    rules: rules || []
  };

  const { data: newEvent, error: evError } = await supabase
    .from('events')
    .insert([eventPayload])
    .select()
    .single();

  if (evError) {
    logger.error('SUPABASE_CREATE_EVENT', evError.message);
    throw evError;
  }

  const seatsToInsert = [];
  if (event_type === 'SEAT_BASED') {
    const total = Number(seatConfig?.totalSeats) || 12;
    const price = Number(seatConfig?.price) || calculatedMinPrice;
    const prefix = seatConfig?.prefix || 'A';
    for (let i = 1; i <= total; i++) {
      seatsToInsert.push({
        event_id: newEvent.id,
        seat_number: `${prefix}${i}`,
        zone_name: 'STANDARD',
        price,
        status: 'AVAILABLE'
      });
    }
  } else {
    for (const z of (zoneConfigs || [])) {
      const count = Number(z.count) || 10;
      const price = Number(z.price) || 200000;
      const zoneName = (z.zoneName || 'STANDARD').toUpperCase();
      for (let i = 1; i <= count; i++) {
        seatsToInsert.push({
          event_id: newEvent.id,
          seat_number: `${zoneName}-${String(i).padStart(2, '0')}`,
          zone_name: zoneName,
          price,
          status: 'AVAILABLE'
        });
      }
    }
  }

  if (seatsToInsert.length > 0) {
    const { error: seatsErr } = await supabase.from('seats').insert(seatsToInsert);
    if (seatsErr) logger.error('SUPABASE_INSERT_SEATS', seatsErr.message);
  }

  return newEvent;
}

async function deleteEvent(eventId) {
  if (process.env.DATABASE_URL) {
    try {
      await pool.query('DELETE FROM events WHERE id = $1;', [eventId]);
      return true;
    } catch (err) {
      logger.error('PG_DELETE_EVENT', err.message);
    }
  }

  // Fallback sang Supabase Client
  await supabase.from('seats').delete().eq('event_id', eventId);
  const { error } = await supabase.from('events').delete().eq('id', eventId);
  if (error) {
    logger.error('SUPABASE_DELETE_EVENT', error.message);
    throw error;
  }
  return true;
}

// Lấy danh sách toàn bộ vé (Order Items) dành cho Quản trị viên
async function getAllTicketsForAdmin() {
  if (process.env.DATABASE_URL) {
    try {
      const query = `
        SELECT 
          oi.id AS id,
          oi.price AS price,
          o.id AS order_id,
          o.order_code AS order_code,
          o.status AS order_status,
          o.created_at AS created_at,
          u.id AS user_id,
          u.full_name AS customer_name,
          u.email AS customer_email,
          s.id AS seat_id,
          s.seat_number AS seat_number,
          s.zone_name AS zone_name,
          s.status AS seat_status,
          e.id AS event_id,
          e.title AS event_title,
          e.event_type AS event_type,
          e.start_time AS event_date,
          e.location AS event_venue
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        LEFT JOIN users u ON o.user_id = u.id
        JOIN seats s ON oi.seat_id = s.id
        JOIN events e ON s.event_id = e.id
        ORDER BY o.created_at DESC;
      `;
      const res = await pool.query(query);
      return res.rows.map(row => {
        const ticketCode = `TK-${(row.order_code ? row.order_code.toString() : row.id.slice(0, 8)).toUpperCase()}-${row.seat_number || 'GEN'}`;
        const purchaseDate = row.created_at
          ? new Date(row.created_at).toLocaleString('vi-VN')
          : 'Mới đây';
        const typeDesc = row.event_type === 'SEAT_BASED'
          ? `Ghế tiêu chuẩn (Ghế ${row.seat_number})`
          : `Khu vực ${row.zone_name || 'Standard'} (Vé ${row.seat_number})`;

        let status = 'paid';
        if (row.order_status === 'CANCELLED' || row.order_status === 'FAILED') {
          status = 'cancelled';
        } else if (row.seat_status === 'SOLD' || row.order_status === 'SUCCESS' || row.order_status === 'PAID') {
          status = 'paid';
        }

        return {
          id: row.id,
          ticketCode,
          orderId: row.order_id,
          orderCode: row.order_code,
          eventId: row.event_id,
          eventTitle: row.event_title,
          customerName: row.customer_name || 'Khách hàng',
          customerEmail: row.customer_email || '',
          customerPhone: '090 *** ****',
          ticketType: typeDesc,
          seatNumber: row.seat_number,
          zoneName: row.zone_name,
          purchaseDate,
          price: Number(row.price || 0),
          status,
          orderStatus: row.order_status
        };
      });
    } catch (err) {
      logger.error('PG_GET_ALL_TICKETS', err.message);
    }
  }

  // Fallback sang Supabase Client (bảng order_items joined orders, seats, events)
  const { data: items, error: itemsErr } = await supabase
    .from('order_items')
    .select('*, orders(*), seats(*, events(*))');

  if (itemsErr) {
    logger.error('SUPABASE_GET_TICKETS', itemsErr.message);
    throw itemsErr;
  }

  // Lấy danh sách users để map tên và email người mua
  const { data: users } = await supabase.from('users').select('id, full_name, email');
  const userMap = {};
  (users || []).forEach(u => { userMap[u.id] = u; });

  return (items || []).map(item => {
    const o = item.orders || {};
    const s = item.seats || {};
    const e = s.events || {};
    const u = userMap[o.user_id] || {};

    const ticketCode = `TK-${(o.order_code ? o.order_code.toString() : item.id.slice(0, 8)).toUpperCase()}-${s.seat_number || 'GEN'}`;
    const purchaseDate = o.created_at
      ? new Date(o.created_at).toLocaleString('vi-VN')
      : 'Mới đây';

    const typeDesc = e.event_type === 'SEAT_BASED'
      ? `Ghế tiêu chuẩn (Ghế ${s.seat_number})`
      : `Khu vực ${s.zone_name || 'Standard'} (Vé ${s.seat_number})`;

    let status = 'paid';
    if (o.status === 'CANCELLED' || o.status === 'FAILED') {
      status = 'cancelled';
    } else if (s.status === 'SOLD' || o.status === 'SUCCESS' || o.status === 'PAID') {
      status = 'paid';
    }

    return {
      id: item.id,
      ticketCode,
      orderId: o.id,
      orderCode: o.order_code,
      eventId: e.id || s.event_id,
      eventTitle: e.title || 'Sự kiện hệ thống',
      customerName: u.full_name || 'Khách hàng',
      customerEmail: u.email || '',
      customerPhone: '090 *** ****',
      ticketType: typeDesc,
      seatNumber: s.seat_number,
      zoneName: s.zone_name,
      purchaseDate,
      price: Number(item.price || s.price || 0),
      status,
      orderStatus: o.status
    };
  });
}

module.exports = {
  createEventWithConfig,
  deleteEvent,
  getUserOrderHistory,
  getAllEvents,
  getEventById,
  getSeatsByEvent,
  getZonesByEvent,
  reserveSeatsByMultipleZones,
  startCheckoutSeats,
  handlePaymentWebhook,
  releaseReservedSeats,
  confirmPartialHold,
  requestSeatHold,
  getAllTicketsForAdmin
};
