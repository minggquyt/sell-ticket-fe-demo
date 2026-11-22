// Hàm định dạng dùng chung cho toàn app (trước đây chép 4 bản ở 4 file)

const vndFormatter = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' });

// Định dạng số tiền sang VND, ví dụ: 500000 -> "500.000 ₫"
export const formatVND = (val) => vndFormatter.format(val);

// Bỏ dấu tiếng Việt (đ -> d), dùng cho tìm kiếm không dấu
export const stripAccents = (val) =>
  String(val ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');

// Tên chủ TK ngân hàng: CHỮ IN HOA KHÔNG DẤU (giữ khoảng trắng để gõ tiếp; BE trim lại)
export const toBankAccountName = (val) =>
  stripAccents(val).toUpperCase().replace(/[^A-Z ]/g, '').replace(/\s+/g, ' ').trimStart();

// Tab của trang /my-tickets — giá trị dùng trực tiếp trên URL ?tab=
export const TICKET_TABS = {
  PAID: 'paid', // SUCCESS
  REFUND_PENDING: 'refund-pending', // REFUND_PENDING
  REFUNDED: 'refunded', // REFUNDED
  ALL: 'all',
  CANCELLED: 'cancelled', // CANCELLED | EXPIRED | FAILED
};

// Trả về tab phù hợp với trạng thái thực tế của đơn (dùng khi deep-link)
export function getTicketTabByStatus(status) {
  switch (status) {
    case 'SUCCESS':
      return TICKET_TABS.PAID;
    case 'REFUND_PENDING':
      return TICKET_TABS.REFUND_PENDING;
    case 'REFUNDED':
      return TICKET_TABS.REFUNDED;
    case 'CANCELLED':
    case 'EXPIRED':
    case 'FAILED':
      return TICKET_TABS.CANCELLED;
    default:
      return TICKET_TABS.ALL;
  }
}

// Dựng URL deep-link tới một đơn trên trang vé
export function buildTicketLink(tab, orderCode, { openETicket = false } = {}) {
  const params = new URLSearchParams();
  const validTab = Object.values(TICKET_TABS).includes(tab) ? tab : TICKET_TABS.PAID;
  params.set('tab', validTab);
  const codeStr = orderCode !== undefined && orderCode !== null ? String(orderCode).trim() : '';
  if (codeStr) {
    params.set('order', codeStr);
    if (openETicket) {
      params.set('open', 'eticket');
    }
  }
  return `/my-tickets?${params.toString()}`;
}

const eventLink = (order) =>
  order?.eventId
    ? { path: `/events/${encodeURIComponent(String(order.eventId))}`, label: 'Xem sự kiện' }
    : null;

const NOTIF_TIMES_KEY = 'sellticket_notif_times';

const loadNotifTimes = () => {
  try {
    const raw = localStorage.getItem(NOTIF_TIMES_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const saveNotifTimes = (map) => {
  try {
    localStorage.setItem(NOTIF_TIMES_KEY, JSON.stringify(map));
  } catch {
    // ignore storage error
  }
};

/**
 * Tổng hợp danh sách thông báo nghiệp vụ cho User từ trạng thái đơn hàng & hoàn tiền thực tế (orders).
 * Sắp xếp: Thông báo MỚI NHẤT luôn ở trên đầu (#1), không bị nhảy vị trí khi bấm đọc.
 */
export function buildNotifications(orders = [], readIds = []) {
  const readSet = new Set(Array.isArray(readIds) ? readIds : []);
  const savedTimes = loadNotifTimes();
  const isFirstInit = savedTimes === null;
  const timesMap = savedTimes || {};
  let timesChanged = false;
  const nowIso = new Date().toISOString();

  const resolveTime = (id, fallbackTime, isNewEvent = false) => {
    if (timesMap[id]) return timesMap[id];
    // Nếu trạng thái mới phát sinh (VD: Admin vừa báo sai TK, hoặc vừa đổi trạng thái đơn)
    // thì gán thời điểm hiện tại để thông báo luôn nằm trên đầu (#1).
    const assigned = !isFirstInit || isNewEvent ? nowIso : fallbackTime || nowIso;
    timesMap[id] = assigned;
    timesChanged = true;
    return assigned;
  };

  const items = [];

  for (const order of Array.isArray(orders) ? orders : []) {
    const status = order.status || order.orderStatus;
    const code = order.orderCode || order.id;
    const amountStr = formatVND(Number(order.totalAmount) || 0);
    const evTitle = order.eventTitle || 'Sự kiện';

    if (status === 'REFUND_PENDING' && order.refundBankError) {
      const id = `ord-bank-err-${code}-${order.refundBankError}`;
      items.push({
        id,
        category: 'refund',
        level: 'error',
        urgent: true,
        isRead: readSet.has(id),
        title: `Đơn #${code}: Sai thông tin tài khoản ngân hàng`,
        message: `Admin báo thông tin TK nhận hoàn tiền chưa đúng: "${order.refundBankError}". Vui lòng sửa lại để nhận khoản hoàn ${amountStr}.`,
        orderCode: code,
        link: { path: '/profile#bank', label: 'Vào Hồ sơ sửa lại ngay' },
        secondaryLink: { path: buildTicketLink(TICKET_TABS.REFUND_PENDING, code), label: 'Xem đơn' },
        createdAt: resolveTime(id, order.createdAt, true),
      });
    } else if (status === 'REFUND_PENDING' && !order.refundBank) {
      const id = `ord-no-bank-${code}`;
      items.push({
        id,
        category: 'refund',
        level: 'warning',
        urgent: true,
        isRead: readSet.has(id),
        title: `Đơn #${code}: Chưa có tài khoản ngân hàng nhận hoàn tiền`,
        message: `Đơn (${evTitle}) đã hủy/quá hạn. Khoản tiền ${amountStr} đang chờ hoàn lại nhưng bạn chưa cập nhật TK ngân hàng.`,
        orderCode: code,
        link: { path: '/profile#bank', label: 'Cập nhật TK ngân hàng' },
        secondaryLink: { path: buildTicketLink(TICKET_TABS.REFUND_PENDING, code), label: 'Xem đơn' },
        createdAt: resolveTime(id, order.createdAt, false),
      });
    } else if (status === 'REFUND_PENDING' && order.refundBank) {
      const id = `ord-refund-wait-${code}-${order.refundBank.bankAccountNo}`;
      items.push({
        id,
        category: 'refund',
        level: 'info',
        urgent: false,
        isRead: readSet.has(id),
        title: `Đơn #${code}: Đang chờ Admin hoàn tiền (${amountStr})`,
        message: `Thông tin TK ${order.refundBank.bankShortName} - ${order.refundBank.bankAccountNo} đã ghi nhận. Đang chờ Admin chuyển khoản hoàn tiền.`,
        orderCode: code,
        link: {
          path: buildTicketLink(TICKET_TABS.REFUND_PENDING, code),
          label: 'Xem đơn chờ hoàn tiền',
        },
        secondaryLink: eventLink(order),
        createdAt: resolveTime(id, order.createdAt, false),
      });
    } else if (status === 'REFUNDED') {
      const id = `ord-refunded-${code}`;
      const snap = order.refundSnapshot;
      items.push({
        id,
        category: 'refund',
        level: 'success',
        urgent: false,
        isRead: readSet.has(id),
        title: `Đơn #${code}: Đã hoàn tiền thành công (${amountStr})`,
        message: snap
          ? `Admin đã chuyển khoản ${amountStr} về TK ${snap.bankShortName} - ${snap.bankAccountNo} (${snap.bankAccountName}).`
          : `Quản trị viên đã hoàn trả ${amountStr} của đơn hàng này về tài khoản ngân hàng của bạn.`,
        orderCode: code,
        link: { path: buildTicketLink(TICKET_TABS.REFUNDED, code), label: 'Xem đơn đã hoàn tiền' },
        secondaryLink: eventLink(order),
        createdAt: resolveTime(id, snap?.refundedAt || order.createdAt, Boolean(snap?.refundedAt)),
      });
    } else if (status === 'SUCCESS') {
      const id = `ord-paid-${code}`;
      items.push({
        id,
        category: 'order',
        level: 'success',
        urgent: false,
        isRead: readSet.has(id),
        title: `Đơn #${code}: Đặt vé thành công`,
        message: `Đã thanh toán thành công ${amountStr} cho sự kiện "${evTitle}".`,
        orderCode: code,
        link: {
          path: buildTicketLink(TICKET_TABS.PAID, code, { openETicket: true }),
          label: 'Xem vé E-Ticket',
        },
        secondaryLink: eventLink(order),
        createdAt: resolveTime(id, order.createdAt, false),
      });
    }
  }

  if (timesChanged) {
    saveNotifTimes(timesMap);
  }

  // Sắp xếp thuần theo thời gian: Thông báo MỚI NHẤT luôn ở trên đầu (#1)
  items.sort((a, b) => {
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return timeB - timeA;
  });

  return items;
}
