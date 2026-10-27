import { formatEventDate, formatEventTime } from '../data/events.js';
import { getRowLetter } from '../utils/seatLayout.js';

// Cấu hình URL Backend: ưu tiên localhost khi chạy môi trường local dev, fallback VITE_API_URL
export const API_BASE_URL = (
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:3000/api'
    : import.meta.env.VITE_API_URL || 'http://localhost:3000/api'
).replace(/\/$/, '');

/**
 * Chuẩn hóa sự kiện trả về từ Backend để tương thích giao diện FE
 */
export function normalizeEvent(raw) {
  if (!raw) return null;

  const isSeated = raw.event_type === 'SEAT_BASED' || raw.type === 'seated';

  const getRawPrice = () => {
    if (raw.min_price !== undefined && raw.min_price !== null && raw.min_price !== '') {
      const p = Number(raw.min_price);
      if (!isNaN(p) && p > 0) return p;
    }
    if (raw.minPrice !== undefined && raw.minPrice !== null && raw.minPrice !== '') {
      const p = Number(raw.minPrice);
      if (!isNaN(p) && p > 0) return p;
    }
    if (raw.seatPrice !== undefined && raw.seatPrice !== null && raw.seatPrice !== '') {
      const p = Number(raw.seatPrice);
      if (!isNaN(p) && p > 0) return p;
    }
    if (raw.price !== undefined && raw.price !== null && raw.price !== '') {
      const p = Number(raw.price);
      if (!isNaN(p) && p > 0) return p;
    }
    if (raw.seatConfig?.price !== undefined && raw.seatConfig?.price !== null) {
      const p = Number(raw.seatConfig.price);
      if (!isNaN(p) && p > 0) return p;
    }
    if (Array.isArray(raw.zones) && raw.zones.length > 0) {
      const valid = raw.zones.map((z) => Number(z.price)).filter((p) => !isNaN(p) && p > 0);
      if (valid.length > 0) return Math.min(...valid);
    }
    if (Array.isArray(raw.seatTiers) && raw.seatTiers.length > 0) {
      const valid = raw.seatTiers.map((t) => Number(t.price)).filter((p) => !isNaN(p) && p > 0);
      if (valid.length > 0) return Math.min(...valid);
    }
    // Nếu có giá trị nhưng bằng 0
    if (raw.min_price === 0 || raw.min_price === '0' || raw.minPrice === 0 || raw.price === 0) {
      return 0;
    }
    return 0;
  };
  const minPriceNum = getRawPrice();
  const maxPriceNum =
    raw.max_price !== undefined &&
    raw.max_price !== null &&
    raw.max_price !== '' &&
    Number(raw.max_price) > 0
      ? Number(raw.max_price)
      : raw.maxPrice !== undefined && raw.maxPrice !== null && Number(raw.maxPrice) > 0
        ? Number(raw.maxPrice)
        : minPriceNum;

  // Layout ghế (H1): KHÔNG còn khôi phục/đoán layout ở đây. Số hàng, số ghế
  // mỗi hàng chỉ lấy đúng những gì backend trả về (nếu có); giao diện suy
  // layout thật từ danh sách ghế bằng deriveSeatLayout (utils/seatLayout.js).
  const finalRowsCount = Number(raw.rowsCount || raw.seatConfig?.rowsCount || 0);
  const finalSeatsPerRow = Number(raw.seatsPerRow || raw.seatConfig?.seatsPerRow || 0);
  const finalTotalSeats = Number(raw.totalSeats || raw.seatConfig?.totalSeats || 0);

  const singleSeatTier = {
    id: 'standard',
    name: 'Ghế tiêu chuẩn',
    price: minPriceNum,
    color: '#6366f1',
    rows: Array.from({ length: finalRowsCount }, (_, i) => getRowLetter(i)),
  };

  const isUpcoming = Boolean(
    raw.status === 'upcoming' || raw.isUpcoming || raw.isUpComing || raw.is_upcoming,
  );

  return {
    ...raw,
    id: raw.id,
    status: raw.status || (isUpcoming ? 'upcoming' : 'ongoing'),
    isUpcoming,
    isUpComing: isUpcoming,
    title: raw.title || 'Sự kiện chưa đặt tên',
    description: raw.description || '',
    location: raw.location || raw.venue || 'Chưa xác định',
    venue: raw.location || raw.venue || 'Chưa xác định',
    start_time: raw.start_time || new Date().toISOString(),
    date: formatEventDate(raw) || 'Chưa công bố',
    time: formatEventTime(raw) || raw.time || '19:00',
    created_at: raw.created_at || new Date().toISOString(),
    event_type: raw.event_type || (raw.type === 'seated' ? 'SEAT_BASED' : 'ZONE_BASED'),
    type: isSeated ? 'seated' : 'zone',
    thumbnails: Array.isArray(raw.thumbnails) ? raw.thumbnails : raw.image ? [raw.image] : [],
    category: raw.category || 'Âm nhạc',
    min_price: String(minPriceNum),
    max_price: String(maxPriceNum),
    minPrice: minPriceNum,
    maxPrice: maxPriceNum,
    price: minPriceNum,
    rowsCount: finalRowsCount,
    seatsPerRow: finalSeatsPerRow,
    totalSeats: finalTotalSeats,
    seatConfig: {
      rowsCount: finalRowsCount,
      seatsPerRow: finalSeatsPerRow,
      totalSeats: finalTotalSeats,
      price: minPriceNum,
    },
    image:
      raw.image ||
      (Array.isArray(raw.thumbnails) && raw.thumbnails[0]) ||
      'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=80',
    banner:
      raw.banner ||
      raw.image ||
      'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1600&q=80',
    organizer: raw.organizer || 'Ban tổ chức sự kiện',
    highlights: Array.isArray(raw.highlights)
      ? raw.highlights.filter((h) => typeof h !== 'string' || !h.startsWith('LAYOUT:'))
      : [],
    rules: Array.isArray(raw.rules) ? raw.rules : [],
    seatTiers: isSeated ? [singleSeatTier] : [],
    zones:
      raw.zones ||
      (isSeated
        ? []
        : [
            {
              id: 'vip',
              name: 'Khu VIP (Sát sân khấu)',
              price: maxPriceNum || 1500000,
              color: '#ec4899',
              available: 50,
            },
            {
              id: 'regular',
              name: 'Khu Tiêu Chuẩn (GA)',
              price: minPriceNum || 650000,
              color: '#06b6d4',
              available: 200,
            },
          ]),
  };
}

/**
 * Lấy danh sách toàn bộ sự kiện từ Backend (Route: GET /api/events)
 */
export async function fetchEvents() {
  try {
    const res = await fetch(`${API_BASE_URL}/events`);
    if (!res.ok) {
      throw new Error(`HTTP error ${res.status}`);
    }
    const result = await res.json();
    const data = result.data || result;
    if (!Array.isArray(data)) return [];
    const events = data.map(normalizeEvent);

    // Tự động kiểm tra nếu có sự kiện có minPrice <= 0 thì đồng bộ từ chi tiết ghế
    const eventsWithValidPrices = await Promise.all(
      events.map(async (ev) => {
        if (ev && (!ev.minPrice || ev.minPrice <= 0)) {
          try {
            const seats = await fetchSeatsByEvent(ev.id);
            if (seats && seats.length > 0) {
              const prices = seats.map((s) => Number(s.price || 0)).filter((p) => p > 0);
              if (prices.length > 0) {
                const actualMin = Math.min(...prices);
                const actualMax = Math.max(...prices);
                return {
                  ...ev,
                  minPrice: actualMin,
                  maxPrice: actualMax,
                  min_price: String(actualMin),
                  max_price: String(actualMax),
                  price: actualMin,
                  seatTiers:
                    ev.seatTiers && ev.seatTiers.length > 0
                      ? ev.seatTiers.map((t) => ({ ...t, price: actualMin }))
                      : ev.seatTiers,
                };
              }
            }
          } catch {
            // Bỏ qua lỗi phụ
          }
        }
        return ev;
      }),
    );

    return eventsWithValidPrices;
  } catch (err) {
    console.error('❌ Lỗi kết nối Backend /api/events:', err);
    return [];
  }
}

/**
 * Lấy danh sách ghế / zone của sự kiện từ Backend (Route: GET /api/events/:eventId/details)
 */
export async function fetchSeatsByEvent(eventId, type) {
  try {
    const query = type ? `?type=${encodeURIComponent(type)}` : '';
    const res = await fetch(`${API_BASE_URL}/events/${eventId}/details${query}`);
    if (!res.ok) {
      throw new Error(`HTTP error ${res.status}`);
    }
    const result = await res.json();
    return result.data || [];
  } catch (err) {
    console.error(`❌ Lỗi tải chi tiết ghế/zones sự kiện ${eventId}:`, err);
    return [];
  }
}

/**
 * Đăng nhập người dùng qua Backend (Route: POST /api/auth/login)
 */
export async function loginUser(email, password) {
  const res = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.message || 'Đăng nhập thất bại.');
  }
  return data;
}

/**
 * Đăng ký tài khoản qua Backend (Route: POST /api/auth/register)
 */
export async function registerUser(email, password, fullName) {
  const res = await fetch(`${API_BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, fullName }),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.message || 'Đăng ký thất bại.');
  }
  return data;
}

/**
 * Admin: Tạo sự kiện mới (Route: POST /api/admin/events)
 */
export async function createEventOnBackend(eventData, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE_URL}/admin/events`, {
    method: 'POST',
    headers,
    body: JSON.stringify(eventData),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.message || 'Không thể tạo sự kiện.');
  }
  return normalizeEvent(data.data);
}

/**
 * Admin: Cập nhật sự kiện (Route: PUT /api/admin/events/:eventId)
 */
export async function updateEventOnBackend(eventId, eventData, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE_URL}/admin/events/${eventId}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(eventData),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.message || 'Không thể cập nhật sự kiện.');
  }
  return normalizeEvent(data.data);
}

/**
 * Admin: Xóa sự kiện (Route: DELETE /api/admin/events/:eventId)
 */
export async function deleteEventOnBackend(eventId, token) {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE_URL}/admin/events/${eventId}`, {
    method: 'DELETE',
    headers,
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.message || 'Không thể xóa sự kiện.');
  }
  return true;
}

/**
 * Giữ ghế theo Seat ID (Route: POST /api/seats/reserve)
 */
export async function holdSeats(seatIds, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE_URL}/seats/reserve`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ seatIds }),
  });
  return res.json();
}

export async function holdZones(eventId, zones, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE_URL}/seats/reserve-zone`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ eventId, zones }),
  });
  return res.json();
}

/**
 * Gọi API lên Backend để hủy giữ chỗ / nhả ghế
 * @param {string} userId - ID của người dùng
 * @param {Array<string>} seatIds - Danh sách ID các ghế cần nhả
 * @param {string} token - Bearer token xác thực
 */
export async function releaseSeats(userId, seatIds, token, orderCode = null) {
  try {
    const authToken = token || null;
    const headers = { 'Content-Type': 'application/json' };
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }
    const response = await fetch(`${API_BASE_URL}/seats/release`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ userId, seatIds, orderCode }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Không thể hủy giữ ghế trên hệ thống.');
    }
    return data;
  } catch (err) {
    console.error('API releaseSeats error:', err);
    throw err;
  }
}

/**
 * Hủy trực tiếp đơn hàng theo orderCode (Route: POST /api/orders/:orderCode/cancel)
 */
export async function cancelOrder(orderCode, token) {
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const response = await fetch(`${API_BASE_URL}/orders/${encodeURIComponent(orderCode)}/cancel`, {
      method: 'POST',
      headers,
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Không thể hủy đơn hàng trên hệ thống.');
    }
    return data;
  } catch (err) {
    console.error('API cancelOrder error:', err);
    throw err;
  }
}

/**
 * Bắt đầu thanh toán PayOS (Route: POST /api/seats/start-checkout)
 */
export async function startCheckout(seatIds, returnUrl, cancelUrl, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE_URL}/seats/start-checkout`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ seatIds, returnUrl, cancelUrl }),
  });
  return res.json();
}

/**
 * Kiểm tra và đồng bộ trạng thái đơn hàng từ Backend (Route: GET /api/orders/:orderCode/status)
 */
export async function fetchOrderStatus(orderCode, token) {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE_URL}/orders/${encodeURIComponent(orderCode)}/status`, {
    method: 'GET',
    headers,
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.message || 'Không thể xác thực trạng thái đơn hàng.');
  }
  return data;
}

/**
 * Lấy lịch sử đặt vé của người dùng hiện tại từ Database (Route: GET /api/orders/my-history)
 */
export async function fetchMyOrderHistory(token) {
  try {
    if (!token) return [];
    const res = await fetch(`${API_BASE_URL}/orders/my-history`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) {
      throw new Error(`HTTP error ${res.status}`);
    }
    const result = await res.json();
    return Array.isArray(result.data) ? result.data : [];
  } catch (err) {
    console.error('❌ Lỗi tải lịch sử đặt vé từ Backend:', err);
    return [];
  }
}

/**
 * Admin: Lấy danh sách đơn hàng chờ hoàn tiền / đã hoàn tiền (Route: GET /api/admin/refunds)
 */
export async function fetchAdminRefunds(token) {
  try {
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE_URL}/admin/refunds`, {
      method: 'GET',
      headers,
    });
    if (!res.ok) {
      throw new Error(`HTTP error ${res.status}`);
    }
    const result = await res.json();
    return Array.isArray(result.data) ? result.data : [];
  } catch (err) {
    console.error('❌ Lỗi tải danh sách hoàn tiền từ Backend:', err);
    return [];
  }
}

/**
 * Admin: Xác nhận đã hoàn tiền thủ công cho đơn hàng (Route: POST /api/admin/orders/:orderCode/confirm-refund)
 */
export async function confirmOrderRefundOnBackend(orderCode, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(
    `${API_BASE_URL}/admin/orders/${encodeURIComponent(orderCode)}/confirm-refund`,
    {
      method: 'POST',
      headers,
    },
  );
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.message || 'Không thể xác nhận hoàn tiền cho đơn hàng này.');
  }
  return data.data;
}

/**
 * Admin: Lấy danh sách toàn bộ vé từ order_items (Route: GET /api/admin/tickets)
 */
export async function fetchAdminTickets(token) {
  try {
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE_URL}/admin/tickets`, {
      headers,
    });
    if (!res.ok) {
      throw new Error(`HTTP error ${res.status}`);
    }
    const result = await res.json();
    return result.data || [];
  } catch (err) {
    console.error('❌ Lỗi tải danh sách vé quản trị từ Backend:', err);
    return [];
  }
}
