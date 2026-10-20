import { formatEventDate, formatEventTime } from '../data/events.js';

// Cấu hình URL Backend: ưu tiên biến môi trường VITE_API_URL, fallback /api
export const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/$/, '');

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
    if (raw.seatConfig?.price !== undefined && raw.seatConfig?.price !== null) {
      const p = Number(raw.seatConfig.price);
      if (!isNaN(p) && p > 0) return p;
    }
    return 500000;
  };
  const minPriceNum = getRawPrice();
  const maxPriceNum = (raw.max_price !== undefined && raw.max_price !== null && raw.max_price !== '' && Number(raw.max_price) > 0)
    ? Number(raw.max_price)
    : ((raw.maxPrice !== undefined && raw.maxPrice !== null && Number(raw.maxPrice) > 0) ? Number(raw.maxPrice) : minPriceNum);

  const singleSeatTier = {
    id: 'standard',
    name: 'Ghế tiêu chuẩn',
    price: minPriceNum,
    color: '#6366f1',
    rows: ['A', 'B', 'C', 'D', 'E', 'F', 'G']
  };

  const isUpcoming = Boolean(
    raw.status === 'upcoming' ||
    raw.isUpcoming ||
    raw.isUpComing ||
    raw.is_upcoming
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
    thumbnails: Array.isArray(raw.thumbnails) ? raw.thumbnails : (raw.image ? [raw.image] : []),
    category: raw.category || 'Âm nhạc',
    min_price: String(raw.min_price || minPriceNum),
    max_price: String(raw.max_price || maxPriceNum),
    minPrice: minPriceNum,
    maxPrice: maxPriceNum,
    image: raw.image || (Array.isArray(raw.thumbnails) && raw.thumbnails[0]) || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=80',
    banner: raw.banner || raw.image || 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1600&q=80',
    organizer: raw.organizer || 'Ban tổ chức sự kiện',
    highlights: Array.isArray(raw.highlights) ? raw.highlights : [],
    rules: Array.isArray(raw.rules) ? raw.rules : [],
    seatTiers: isSeated ? [singleSeatTier] : [],
    zones: raw.zones || (isSeated ? [] : [
        { id: 'vip', name: 'Khu VIP (Sát sân khấu)', price: maxPriceNum || 1500000, color: '#ec4899', available: 50 },
        { id: 'regular', name: 'Khu Tiêu Chuẩn (GA)', price: minPriceNum || 650000, color: '#06b6d4', available: 200 }
      ]) // MISS FIELD IN RAW DATA
  };
}

export const normalizeSupabaseEvent = normalizeEvent;

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
    return data.map(normalizeEvent); // DÒNG NÀY ĐỂ LÀM GÌ ?
  } catch (err) {
    console.error('❌ Lỗi kết nối Backend /api/events:', err);
    return [];
  }
}

/**
 * Lấy thông tin 1 sự kiện theo ID từ Backend (Route: GET /api/events/:eventId)
 */
export async function fetchEventById(eventId) {
  try {
    const res = await fetch(`${API_BASE_URL}/events/${eventId}`);
    if (!res.ok) {
      throw new Error(`HTTP error ${res.status}`);
    }
    const result = await res.json();
    const data = result.data || result;
    return normalizeEvent(data);
  } catch (err) {
    console.error(`❌ Lỗi tải sự kiện ${eventId} từ Backend:`, err);
    return null;
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
    body: JSON.stringify({ email, password })
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
    body: JSON.stringify({ email, password, fullName })
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
    body: JSON.stringify(eventData)
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.message || 'Không thể tạo sự kiện.');
  }
  return normalizeEvent(data.data);
}

export const createEventOnSupabase = createEventOnBackend;

/**
 * Admin: Cập nhật sự kiện (Route: PUT /api/admin/events/:eventId)
 */
export async function updateEventOnBackend(eventId, eventData, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE_URL}/admin/events/${eventId}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(eventData)
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.message || 'Không thể cập nhật sự kiện.');
  }
  return normalizeEvent(data.data);
}

export const updateEventOnSupabase = updateEventOnBackend;

/**
 * Admin: Xóa sự kiện (Route: DELETE /api/admin/events/:eventId)
 */
export async function deleteEventOnBackend(eventId, token) {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE_URL}/admin/events/${eventId}`, {
    method: 'DELETE',
    headers
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.message || 'Không thể xóa sự kiện.');
  }
  return true;
}

export const deleteEventFromSupabase = deleteEventOnBackend;

/**
 * Giữ ghế theo Seat ID (Route: POST /api/seats/reserve)
 */
export async function holdSeats(seatIds, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE_URL}/seats/reserve`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ seatIds })
  });
  return res.json();
}

export async function holdZones(eventId, zones, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE_URL}/seats/reserve-zone`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ eventId, zones })
  });
  return res.json();
}

/**
 * Gọi API lên Backend để hủy giữ chỗ / nhả ghế
 * @param {string} userId - ID của người dùng
 * @param {Array<string>} seatIds - Danh sách ID các ghế cần nhả
 * @param {string} token - Bearer token xác thực
 */
export async function releaseSeats(userId, seatIds, token) {
  try {
    const response = await fetch(`${API_BASE_URL}/seats/release`, { 
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ userId, seatIds })
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
 * Bắt đầu thanh toán PayOS (Route: POST /api/seats/start-checkout)
 */
export async function startCheckout(seatIds, returnUrl, cancelUrl, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE_URL}/seats/start-checkout`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ seatIds, returnUrl, cancelUrl })
  });
  return res.json();
}

/**
 * Lấy lịch sử đơn hàng của User (Route: GET /api/orders/my-history)
 */
export async function fetchUserOrders(token) {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE_URL}/orders/my-history`, {
    headers
  });
  return res.json();
}

/**
 * Admin: Lấy danh sách toàn bộ vé từ order_items (Route: GET /api/admin/tickets)
 */
export async function fetchAdminTickets(token) {
  try {
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE_URL}/admin/tickets`, {
      headers
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
