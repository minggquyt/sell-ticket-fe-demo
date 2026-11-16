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
 * Tổng hợp danh sách thông báo cho User từ 2 nguồn:
 * 1) Trạng thái đơn hàng & hoàn tiền thực tế từ Database (orders)
 * 2) Lịch sử các thông báo nổi (Toast) đã xuất hiện trong phiên/trình duyệt
 * Sắp xếp: Thông báo MỚI NHẤT luôn ở trên đầu (#1), không bị nhảy vị trí khi bấm đọc.
 */
export function buildNotifications(orders = [], toastHistory = [], readIds = []) {
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
        actionLabel: 'Vào Hồ sơ sửa lại ngay',
        actionRoute: 'profile',
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
        actionLabel: 'Cập nhật TK ngân hàng',
        actionRoute: 'profile',
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
        actionLabel: 'Xem đơn hoàn tiền',
        actionRoute: 'my-tickets',
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
        actionLabel: 'Xem chi tiết đơn',
        actionRoute: 'my-tickets',
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
        actionLabel: 'Xem vé E-Ticket',
        actionRoute: 'my-tickets',
        createdAt: resolveTime(id, order.createdAt, false),
      });
    }
  }

  if (timesChanged) {
    saveNotifTimes(timesMap);
  }

  for (const t of Array.isArray(toastHistory) ? toastHistory : []) {
    items.push({
      id: t.id,
      category: 'toast',
      level: t.type || 'info',
      urgent: false,
      isRead: readSet.has(t.id),
      title:
        t.type === 'error'
          ? 'Thông báo lỗi'
          : t.type === 'warning'
            ? 'Cảnh báo hệ thống'
            : t.type === 'success'
              ? 'Thao tác thành công'
              : 'Thông báo hệ thống',
      message: t.message,
      createdAt: t.createdAt,
    });
  }

  // Sắp xếp thuần theo thời gian: Thông báo MỚI NHẤT luôn ở trên đầu (#1)
  items.sort((a, b) => {
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return timeB - timeA;
  });

  return items;
}
