import { formatEventDate, formatEventTime } from '../data/events.js';
import { getRowLetter } from '../utils/seatLayout.js';
import {
  getFriendlyAuthExpiredMessage,
  isAuthError,
  notifyAuthExpired,
} from '../utils/authSession.js';

export const DEFAULT_LOCAL_API_URL = 'http://localhost:3000/api';
export const DEFAULT_PROD_API_URL = 'https://sell-ticket-be-bcn-bcc127d1b2cd.herokuapp.com/api';

/**
 * Chuẩn hóa URL backend:
 * - Cắt khoảng trắng và mọi dấu '/' ở cuối.
 * - Nếu chưa kết thúc bằng '/api', tự động gắn '/api' vào cuối.
 */
export function normalizeApiBaseUrl(rawUrl) {
  const trimmed = String(rawUrl || '').trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  return /\/api$/i.test(trimmed) ? trimmed : `${trimmed}/api`;
}

/**
 * Thứ tự ưu tiên:
 * 1. Biến môi trường `VITE_API_URL` (nếu có giá trị non-empty).
 * 2. Nếu chạy trên `localhost` / `127.0.0.1` -> DEFAULT_LOCAL_API_URL.
 * 3. Các môi trường deploy khác -> DEFAULT_PROD_API_URL.
 */
export function resolveApiBaseUrl(envUrl, hostname = '') {
  const fromEnv = normalizeApiBaseUrl(envUrl);
  if (fromEnv) return fromEnv;
  const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
  return isLocal ? DEFAULT_LOCAL_API_URL : DEFAULT_PROD_API_URL;
}

export const API_BASE_URL = resolveApiBaseUrl(
  import.meta.env?.VITE_API_URL,
  typeof window !== 'undefined' ? window.location.hostname : '',
);

/**
 * Lõi gọi API duy nhất cho toàn Frontend (Anti-Corruption Layer):
 * - Chuẩn hóa header, parse JSON an toàn, kiểm tra envelope { success, statusCode, message, data }
 * - Ném Error(message) khi thất bại và trả về dữ liệu nghiệp vụ tinh khiết (data) khi thành công
 */
async function apiRequest(
  path,
  { method = 'GET', body, token, fallbackError, authSource = 'action' } = {},
) {
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
    const authErr = Boolean(token) && isAuthError(res.status, payload);
    const message = authErr
      ? getFriendlyAuthExpiredMessage(payload)
      : payload?.message || fallbackError || `Lỗi máy chủ (HTTP ${res.status}).`;
    const err = new Error(message);
    err.status = res.status;
    err.payload = payload;
    err.code = payload?.data?.code || null;
    const retryAfter = Number.parseInt(res.headers.get('Retry-After') || '', 10);
    err.retryAfter = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : null;
    if (authErr) {
      err.isAuthError = true;
      notifyAuthExpired(message, { source: authSource });
    }
    throw err;
  }

  return payload && Object.prototype.hasOwnProperty.call(payload, 'data') ? payload.data : payload;
}

async function apiListRequest(path, { token, logLabel, authSource = 'action' } = {}) {
  try {
    const data = await apiRequest(path, { token, authSource });
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
export async function registerUser(email, password, fullName, phone) {
  return apiRequest('/auth/register', {
    method: 'POST',
    body: { email, password, fullName: fullName || undefined, phone },
    fallbackError: 'Không thể bắt đầu đăng ký.',
  });
}

/** Xác minh OTP và hoàn tất đăng ký. API không trả JWT. */
export async function verifyRegistrationOtp(registrationId, otp) {
  return apiRequest('/auth/register/verify', {
    method: 'POST',
    body: { registrationId, otp },
    fallbackError: 'Không thể xác minh mã OTP.',
  });
}

/** Gửi OTP đăng ký mới; OTP cũ sẽ không còn hiệu lực. */
export async function resendRegistrationOtp(registrationId) {
  return apiRequest('/auth/register/resend', {
    method: 'POST',
    body: { registrationId },
    fallbackError: 'Không thể gửi lại mã OTP.',
  });
}

/** Hủy phiên đăng ký đang chờ */
export async function cancelRegistration(registrationId) {
  return apiRequest('/auth/register/cancel', {
    method: 'POST',
    body: { registrationId },
    fallbackError: 'Không thể hủy phiên đăng ký.',
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
 * Lấy dữ liệu thanh toán QR của đơn hàng (Route: GET /api/orders/:orderCode/payment)
 * Mặc định chỉ đọc DB; truyền sync=true ở các mốc tự động để đối soát PayOS (BE throttle 10s).
 */
export async function fetchOrderPayment(
  orderCode,
  token,
  { sync = false, background = false } = {},
) {
  const query = sync ? '?sync=1' : '';
  return apiRequest(`/orders/${encodeURIComponent(orderCode)}/payment${query}`, {
    token,
    authSource: background ? 'background' : 'action',
    fallbackError: 'Không thể tải thông tin thanh toán đơn hàng.',
  });
}

/**
 * Kết nối SSE nhận trạng thái đơn hàng tức thời qua fetch + ReadableStream + Authorization Bearer.
 */
export async function subscribeOrderEvents(
  orderCode,
  token,
  { onInit, onStatusChanged, onOpen, onError, onAuthError, onNotFound, signal } = {},
) {
  if (!orderCode || !token) return;

  let res;
  try {
    res = await fetch(`${API_BASE_URL}/orders/${encodeURIComponent(orderCode)}/events`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'text/event-stream',
      },
      cache: 'no-store',
      signal,
    });
  } catch (err) {
    if (signal?.aborted || err?.name === 'AbortError') return;
    onError?.(err);
    return;
  }

  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    const authErr = isAuthError(res.status, payload);
    const message = authErr
      ? getFriendlyAuthExpiredMessage(payload)
      : payload?.message || `Lỗi kết nối SSE (HTTP ${res.status}).`;
    const err = new Error(message);
    err.status = res.status;
    err.payload = payload;

    if (authErr) {
      err.isAuthError = true;
      notifyAuthExpired(message, { source: 'sse' });
      onAuthError?.(err);
      return;
    }
    if (res.status === 403 || res.status === 404) {
      onNotFound?.(err);
      return;
    }
    onError?.(err);
    return;
  }

  if (!res.body || typeof res.body.getReader !== 'function') {
    onError?.(new Error('Trình duyệt không hỗ trợ đọc stream sự kiện.'));
    return;
  }

  onOpen?.();

  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let receivedTerminal = false;

  const dispatchBlock = (rawBlock) => {
    const lines = rawBlock.split('\n');
    let eventName = 'message';
    const dataLines = [];

    for (const rawLine of lines) {
      const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;
      if (!line || line.startsWith(':')) continue;
      if (line.startsWith('event:')) {
        eventName = line.slice(6).trim();
      } else if (line.startsWith('data:')) {
        dataLines.push(line.slice(5).replace(/^ /, ''));
      }
    }

    if (dataLines.length === 0) return;

    let parsed;
    try {
      parsed = JSON.parse(dataLines.join('\n'));
    } catch {
      return;
    }

    if (parsed?.status && parsed.status !== 'PAYMENT_PROCESSING') {
      receivedTerminal = true;
    }

    if (eventName === 'init') {
      onInit?.(parsed);
    } else if (eventName === 'order_status') {
      onStatusChanged?.(parsed);
    }
  };

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      // Giữ nguyên \r cuối chunk nếu bị cắt giữa \r\n
      const trailingCr = buffer.endsWith('\r');
      const processable = trailingCr ? buffer.slice(0, -1) : buffer;
      const normalized = processable.replace(/\r\n/g, '\n');

      let boundaryIdx;
      let cursor = 0;
      while ((boundaryIdx = normalized.indexOf('\n\n', cursor)) !== -1) {
        const block = normalized.slice(cursor, boundaryIdx);
        cursor = boundaryIdx + 2;
        if (block.trim()) dispatchBlock(block);
      }

      buffer = normalized.slice(cursor) + (trailingCr ? '\r' : '');
    }

    const tail = (buffer + decoder.decode()).replace(/\r\n/g, '\n');
    if (tail.trim()) {
      for (const block of tail.split('\n\n')) {
        if (block.trim()) dispatchBlock(block);
      }
    }

    if (!signal?.aborted && !receivedTerminal) {
      onError?.(new Error('Kết nối SSE bị ngắt trước khi hoàn tất đơn hàng.'));
    }
  } catch (err) {
    if (signal?.aborted || err?.name === 'AbortError') return;
    onError?.(err);
  } finally {
    try {
      await reader.cancel();
    } catch {
      // Bỏ qua lỗi đóng reader
    }
  }
}

let activeSessionInFlight = null;

/**
 * Lấy phiên giữ ghế (RESERVED) hoặc thanh toán (PAYMENT_PROCESSING) đang hoạt động
 * của user hiện tại trên Backend để đồng bộ xuyên thiết bị (Route: GET /api/seats/my-active-session)
 */
export async function fetchMyActiveSession(token) {
  if (!token) return null;
  if (activeSessionInFlight && activeSessionInFlight.token === token) {
    return activeSessionInFlight.promise;
  }
  const promise = apiRequest('/seats/my-active-session', {
    token,
    authSource: 'background',
    fallbackError: 'Không thể đồng bộ phiên giữ chỗ hiện tại.',
  }).finally(() => {
    if (activeSessionInFlight?.promise === promise) {
      activeSessionInFlight = null;
    }
  });
  activeSessionInFlight = { token, promise };
  return promise;
}

/**
 * Lấy lịch sử đặt vé của người dùng hiện tại từ Database (Route: GET /api/orders/my-history)
 */
export async function fetchMyOrderHistory(token) {
  if (!token) return [];
  return apiListRequest('/orders/my-history', {
    token,
    authSource: 'background',
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
export async function fetchMyProfile(token) {
  return apiRequest('/auth/me', {
    token,
    fallbackError: 'Không thể tải thông tin hồ sơ.',
  });
}

export async function updateMyProfile(phone, token) {
  return apiRequest('/auth/me', {
    method: 'PUT',
    body: { phone },
    token,
    fallbackError: 'Không thể cập nhật số điện thoại.',
  });
}

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
