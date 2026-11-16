import { API_BASE_URL, fetchOrderStatus } from './eventService.js';

// ---------------------------------------------------------------------------
// MUA VÉ KHÔNG CẦN ĐĂNG NHẬP (guest checkout) + NHẬN LẠI VÉ BẰNG EMAIL
// Luồng theo 3 sơ đồ user gửi ngày 10/11/2026:
//  - Khách mua vé chỉ cần điền form có email → thanh toán. Thanh toán lỗi thì
//    KHÔNG tạo user. Thanh toán thành công thì BE khớp email với userid có
//    sẵn, chưa có thì tạo user mới (email + password null), hoá đơn gắn userid.
//  - Sau này khách đăng ký bằng đúng email đó: email đã tồn tại + password
//    null → xác thực email (mã hoặc link) → đặt password, GIỮ NGUYÊN userid,
//    thấy lại vé đã mua.
// FE chỉ thu thập email, gửi kèm API và hiển thị kết quả BE trả về; việc
// khớp/tạo user và xác thực email là trách nhiệm của BE. Các endpoint
// check-email / request-password-setup / verify-and-set-password là endpoint
// BE mới cho luồng này — nếu BE chưa có (404), hàm throw lỗi rõ ràng để UI
// báo cho khách biết, thay vì đoán mò hay tự tạo user ở FE.
// ---------------------------------------------------------------------------

// Thông tin khách vãng lai lưu ở trình duyệt để tự điền lại lần sau.
export const GUEST_STORAGE_KEY = 'sellticket_guest';
// Đơn vừa thanh toán xong (để trang Lịch sử đặt vé tự tra cứu lại cho khách).
export const LAST_ORDER_STORAGE_KEY = 'sellticket_last_order';

export function normalizeGuestEmail(email) {
  return String(email || '')
    .trim()
    .toLowerCase();
}

export function isValidGuestEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalizeGuestEmail(email));
}

export function getSavedGuest() {
  try {
    const raw = localStorage.getItem(GUEST_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !isValidGuestEmail(parsed.email)) return null;
    return {
      email: normalizeGuestEmail(parsed.email),
      fullName: String(parsed.fullName || '').trim(),
      phone: String(parsed.phone || '').trim(),
    };
  } catch {
    return null;
  }
}

export function saveGuest(guest) {
  try {
    if (!guest || !isValidGuestEmail(guest.email)) return;
    localStorage.setItem(
      GUEST_STORAGE_KEY,
      JSON.stringify({
        email: normalizeGuestEmail(guest.email),
        fullName: String(guest.fullName || '').trim(),
        phone: String(guest.phone || '').trim(),
      }),
    );
  } catch {
    /* Bỏ qua: trình duyệt chặn localStorage */
  }
}

export function getLastGuestOrder() {
  try {
    const raw = localStorage.getItem(LAST_ORDER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.orderCode || !isValidGuestEmail(parsed.email)) return null;
    return { orderCode: String(parsed.orderCode).trim(), email: normalizeGuestEmail(parsed.email) };
  } catch {
    return null;
  }
}

export function saveLastGuestOrder(orderCode, email) {
  try {
    if (!orderCode || !isValidGuestEmail(email)) return;
    localStorage.setItem(
      LAST_ORDER_STORAGE_KEY,
      JSON.stringify({ orderCode: String(orderCode).trim(), email: normalizeGuestEmail(email) }),
    );
  } catch {
    /* Bỏ qua: trình duyệt chặn localStorage */
  }
}

export function clearLastGuestOrder() {
  try {
    localStorage.removeItem(LAST_ORDER_STORAGE_KEY);
  } catch {
    /* Bỏ qua */
  }
}

function throwIfMissingEndpoint(res, route) {
  if (res.status === 404) {
    throw new Error(
      `BE chưa hỗ trợ bước này (${route}). Vui lòng liên hệ quản trị để bật endpoint này.`,
    );
  }
}

/**
 * Kiểm tra email đã có tài khoản chưa, và tài khoản đó đã có password chưa.
 * Trả về { exists: boolean, hasPassword: boolean }.
 * (Route: POST /api/auth/check-email)
 */
export async function checkEmailStatus(email) {
  const res = await fetch(`${API_BASE_URL}/auth/check-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: normalizeGuestEmail(email) }),
  });
  const data = await res.json().catch(() => ({}));
  throwIfMissingEndpoint(res, 'POST /api/auth/check-email');
  if (!res.ok || data.success === false) {
    throw new Error(data.message || 'Không thể kiểm tra email. Vui lòng thử lại.');
  }
  const payload = data.data || data;
  return {
    exists: Boolean(payload.exists ?? payload.emailExists ?? payload.found),
    hasPassword: Boolean(payload.hasPassword ?? payload.has_password ?? payload.passwordSet),
  };
}

/**
 * Gửi mã xác thực về email của tài khoản mua vé trước đây (password null).
 * (Route: POST /api/auth/request-password-setup)
 */
export async function requestPasswordSetup(email) {
  const res = await fetch(`${API_BASE_URL}/auth/request-password-setup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: normalizeGuestEmail(email) }),
  });
  const data = await res.json().catch(() => ({}));
  throwIfMissingEndpoint(res, 'POST /api/auth/request-password-setup');
  if (!res.ok || data.success === false) {
    throw new Error(data.message || 'Không thể gửi mã xác thực. Vui lòng thử lại.');
  }
  return data;
}

/**
 * Xác thực mã + đặt password cho tài khoản mua vé trước đây (password null).
 * BE giữ nguyên userid cũ — FE chỉ gửi mã + password mới.
 * (Route: POST /api/auth/verify-and-set-password)
 */
export async function verifyAndSetPassword(email, code, password) {
  const res = await fetch(`${API_BASE_URL}/auth/verify-and-set-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: normalizeGuestEmail(email),
      code: String(code || '').trim(),
      verificationCode: String(code || '').trim(),
      password,
    }),
  });
  const data = await res.json().catch(() => ({}));
  throwIfMissingEndpoint(res, 'POST /api/auth/verify-and-set-password');
  if (!res.ok || data.success === false) {
    throw new Error(data.message || 'Mã xác thực không đúng hoặc đã hết hạn.');
  }
  return data;
}

/**
 * Tra cứu 1 đơn hàng của khách vãng lai bằng mã đơn + email.
 * Dùng lại GET /api/orders/:orderCode/status (không cần token); chỉ hiện vé
 * khi email trên đơn khớp email khách nhập (nếu BE trả về email trên đơn).
 */
export async function fetchGuestOrder(orderCode, email) {
  const data = await fetchOrderStatus(orderCode, null);
  const order = data?.data || data;
  if (!order || !order.orderCode) {
    throw new Error('Không tìm thấy đơn hàng với mã này.');
  }
  const orderEmail = normalizeGuestEmail(
    order.customerEmail || order.email || order.guestEmail || '',
  );
  const wantedEmail = normalizeGuestEmail(email);
  if (orderEmail && wantedEmail && orderEmail !== wantedEmail) {
    throw new Error('Email không khớp với email đã dùng khi mua vé của đơn này.');
  }
  return order;
}
