import { formatEventDate, formatEventTime } from '../data/events.js';
import { getRowLetter } from '../utils/seatLayout.js';

// Cấu hình URL Backend: ưu tiên localhost khi chạy môi trường local dev, fallback VITE_API_URL
export const API_BASE_URL = (
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:3000/api'
    : import.meta.env?.VITE_API_URL || 'http://localhost:3000/api'
).replace(/\/$/, '');

/**
 * Lõi gọi API duy nhất cho toàn Frontend (Anti-Corruption Layer):
 * - Chuẩn hóa header, parse JSON an toàn, kiểm tra envelope { success, statusCode, message, data }
 * - Ném Error(message) khi thất bại và trả về dữ liệu nghiệp vụ tinh khiết (data) khi thành công
 */
async function apiRequest(path, { method = 'GET', body, token, fallbackError } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  const payload = await res.json().catch(() => null);

  if (!res.ok || payload?.success === false) {
    throw new Error(payload?.message || fallbackError || `Lỗi máy chủ (HTTP ${res.status}).`);
  }

  return payload && Object.prototype.hasOwnProperty.call(payload, 'data') ? payload.data : payload;
}

async function apiListRequest(path, { token, logLabel } = {}) {
  try {
    const data = await apiRequest(path, { token });
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error(`❌ ${logLabel}:`, err);
    return [];
  }
}

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
    const data = await apiRequest('/events');
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
  const query = type ? `?type=${encodeURIComponent(type)}` : '';
  return apiListRequest(`/events/${eventId}/details${query}`, {
    logLabel: `Lỗi tải chi tiết ghế/zones sự kiện ${eventId}`,
  });
}

/**
 * Đăng nhập người dùng qua Backend (Route: POST /api/auth/login) -> trả về { token, user }
 */
export async function loginUser(email, password) {
  return apiRequest('/auth/login', {
    method: 'POST',
    body: { email, password },
    fallbackError: 'Đăng nhập thất bại.',
  });
}

/**
 * Đăng ký tài khoản qua Backend (Route: POST /api/auth/register)
 */
export async function registerUser(email, password, fullName) {
  return apiRequest('/auth/register', {
    method: 'POST',
    body: { email, password, fullName },
    fallbackError: 'Đăng ký thất bại.',
  });
}

/**
 * Admin: Tạo sự kiện mới (Route: POST /api/admin/events)
 */
export async function createEventOnBackend(eventData, token) {
  const data = await apiRequest('/admin/events', {
    method: 'POST',
    body: eventData,
    token,
    fallbackError: 'Không thể tạo sự kiện.',
  });
  return normalizeEvent(data);
}

/**
 * Admin: Cập nhật sự kiện (Route: PUT /api/admin/events/:eventId)
 */
export async function updateEventOnBackend(eventId, eventData, token) {
  const data = await apiRequest(`/admin/events/${eventId}`, {
    method: 'PUT',
    body: eventData,
    token,
    fallbackError: 'Không thể cập nhật sự kiện.',
  });
  return normalizeEvent(data);
}

/**
 * Admin: Xóa sự kiện (Route: DELETE /api/admin/events/:eventId)
 */
export async function deleteEventOnBackend(eventId, token) {
  await apiRequest(`/admin/events/${eventId}`, {
    method: 'DELETE',
    token,
    fallbackError: 'Không thể xóa sự kiện.',
  });
  return true;
}

/**
 * Giữ ghế theo Seat ID (Route: POST /api/seats/reserve)
 */
export async function holdSeats(seatIds, token) {
  return apiRequest('/seats/reserve', {
    method: 'POST',
    body: { seatIds },
    token,
    fallbackError: 'Không thể giữ các ghế đã chọn.',
  });
}

export async function holdZones(eventId, zones, token) {
  return apiRequest('/seats/reserve-zone', {
    method: 'POST',
    body: { eventId, zones },
    token,
    fallbackError: 'Không thể giữ chỗ theo khu vực đã chọn.',
  });
}

/**
 * Gọi API lên Backend để hủy giữ chỗ / nhả ghế
 */
export async function releaseSeats(userId, seatIds, token, orderCode = null) {
  return apiRequest('/seats/release', {
    method: 'POST',
    body: { userId, seatIds, orderCode },
    token: token || null,
    fallbackError: 'Không thể hủy giữ ghế trên hệ thống.',
  });
}

/**
 * Hủy trực tiếp đơn hàng theo orderCode (Route: POST /api/orders/:orderCode/cancel)
 */
export async function cancelOrder(orderCode, token) {
  return apiRequest(`/orders/${encodeURIComponent(orderCode)}/cancel`, {
    method: 'POST',
    token,
    fallbackError: 'Không thể hủy đơn hàng trên hệ thống.',
  });
}

/**
 * Bắt đầu thanh toán PayOS (Route: POST /api/seats/start-checkout)
 */
export async function startCheckout(checkoutPayload, token) {
  return apiRequest('/seats/start-checkout', {
    method: 'POST',
    body: checkoutPayload,
    token,
    fallbackError: 'Không thể tạo đơn hàng thanh toán qua PayOS.',
  });
}

/**
 * Kiểm tra và đồng bộ trạng thái đơn hàng từ Backend (Route: GET /api/orders/:orderCode/status)
 */
export async function fetchOrderStatus(orderCode, token) {
  return apiRequest(`/orders/${encodeURIComponent(orderCode)}/status`, {
    token,
    fallbackError: 'Không thể xác thực trạng thái đơn hàng.',
  });
}

/**
 * Lấy lịch sử đặt vé của người dùng hiện tại từ Database (Route: GET /api/orders/my-history)
 */
export async function fetchMyOrderHistory(token) {
  if (!token) return [];
  return apiListRequest('/orders/my-history', {
    token,
    logLabel: 'Lỗi tải lịch sử đặt vé từ Backend',
  });
}

/**
 * Admin: Lấy danh sách đơn hàng chờ hoàn tiền / đã hoàn tiền (Route: GET /api/admin/refunds)
 */
export async function fetchAdminRefunds(token) {
  return apiListRequest('/admin/refunds', {
    token,
    logLabel: 'Lỗi tải danh sách hoàn tiền từ Backend',
  });
}

/**
 * Admin: Xác nhận đã hoàn tiền thủ công (VietQR) + lưu snapshot đối soát
 * (Route: POST /api/admin/orders/:orderCode/confirm-refund)
 * payload: { bankBin, bankAccountNo, bankAccountName, note }
 */
export async function confirmOrderRefundOnBackend(orderCode, payload, token) {
  return apiRequest(`/admin/orders/${encodeURIComponent(orderCode)}/confirm-refund`, {
    method: 'POST',
    body: payload,
    token,
    fallbackError: 'Không thể xác nhận hoàn tiền cho đơn hàng này.',
  });
}

/**
 * Admin: Báo sai thông tin TK ngân hàng của khách (Route: POST /api/admin/orders/:orderCode/refund-bank-error)
 */
export async function markRefundBankErrorOnBackend(orderCode, reason, token) {
  return apiRequest(`/admin/orders/${encodeURIComponent(orderCode)}/refund-bank-error`, {
    method: 'POST',
    body: { reason },
    token,
    fallbackError: 'Không thể báo sai thông tin tài khoản.',
  });
}

/**
 * User: Hồ sơ ngân hàng nhận hoàn tiền (Route: GET/PUT /api/auth/me/bank)
 */
export async function fetchMyBank(token) {
  return apiRequest('/auth/me/bank', {
    token,
    fallbackError: 'Không thể tải thông tin ngân hàng.',
  });
}

export async function updateMyBank(bank, token) {
  return apiRequest('/auth/me/bank', {
    method: 'PUT',
    body: bank,
    token,
    fallbackError: 'Không thể lưu thông tin ngân hàng.',
  });
}

/**
 * Danh sách ngân hàng từ Public API miễn phí của VietQR (không cần API key)
 */
export async function fetchVietQrBanks() {
  const res = await fetch('https://api.vietqr.io/v2/banks');
  const data = await res.json();
  if (!res.ok || !Array.isArray(data.data)) {
    throw new Error('Không tải được danh sách ngân hàng từ VietQR.');
  }
  return data.data;
}

/**
 * Link ảnh VietQR (img.vietqr.io - miễn phí) đã gắn sẵn STK, số tiền, nội dung chuyển khoản
 */
export function buildVietQrUrl({ bankBin, bankAccountNo, bankAccountName }, amount, addInfo) {
  const params = new URLSearchParams({
    amount: String(Math.round(Number(amount) || 0)),
    addInfo,
    accountName: bankAccountName || '',
  });
  return `https://img.vietqr.io/image/${encodeURIComponent(bankBin)}-${encodeURIComponent(bankAccountNo)}-compact2.png?${params}`;
}

/**
 * Admin: Lấy danh sách toàn bộ vé từ order_items (Route: GET /api/admin/tickets)
 */
export async function fetchAdminTickets(token) {
  return apiListRequest('/admin/tickets', {
    token,
    logLabel: 'Lỗi tải danh sách vé quản trị từ Backend',
  });
}
