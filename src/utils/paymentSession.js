export const RESERVATION_STORAGE_PREFIX = 'event_reservation_';
export const RESERVATION_CHANGED_EVENT = 'sellticket:reservation-changed';
export const CHECKOUT_INFLIGHT_PREFIX = 'sellticket_checkout_inflight_';
const DEFAULT_CONFIRM_WINDOW_MS = 30 * 1000;
const DEFAULT_CHECKOUT_INFLIGHT_TTL_MS = 15 * 1000;
const inFlightCheckoutMap = new Map();

const getCheckoutInFlightKey = (eventId) => `${CHECKOUT_INFLIGHT_PREFIX}${eventId}`;

export function markCheckoutInFlight(eventId, ttlMs = DEFAULT_CHECKOUT_INFLIGHT_TTL_MS) {
  if (!eventId) return;
  const safeTtlMs = Math.max(1000, Number(ttlMs) || DEFAULT_CHECKOUT_INFLIGHT_TTL_MS);
  const expiresAt = Date.now() + safeTtlMs;
  const key = getCheckoutInFlightKey(eventId);
  inFlightCheckoutMap.set(key, expiresAt);
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, String(expiresAt));
    }
  } catch {
    /* Bỏ qua nếu trình duyệt chặn localStorage */
  }
}

export function clearCheckoutInFlight(eventId) {
  if (!eventId) return;
  const key = getCheckoutInFlightKey(eventId);
  inFlightCheckoutMap.delete(key);
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(key);
    }
  } catch {
    /* Bỏ qua */
  }
}

export function isCheckoutInFlight(eventId) {
  if (!eventId) return false;
  const key = getCheckoutInFlightKey(eventId);
  const nowMs = Date.now();
  const memExpiresAt = inFlightCheckoutMap.get(key);
  if (Number.isFinite(memExpiresAt)) {
    if (memExpiresAt > nowMs) return true;
    inFlightCheckoutMap.delete(key);
  }
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(key);
      if (raw !== null) {
        const storedExpiresAt = Number(raw);
        if (Number.isFinite(storedExpiresAt) && storedExpiresAt > nowMs) {
          return true;
        }
        localStorage.removeItem(key);
      }
    }
  } catch {
    /* Bỏ qua */
  }
  return false;
}

export function computeServerOffsetMs(serverTime, fallbackOffsetMs = 0) {
  const fallback = Number.isFinite(Number(fallbackOffsetMs)) ? Number(fallbackOffsetMs) : 0;
  if (!serverTime) return fallback;
  const srvMs = Date.parse(serverTime);
  return Number.isFinite(srvMs) ? srvMs - Date.now() : fallback;
}

export const getReservationStorageKey = (eventId) => `${RESERVATION_STORAGE_PREFIX}${eventId}`;

const emitReservationChanged = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(RESERVATION_CHANGED_EVENT));
  }
};

export function getSessionEffectiveExpiryMs(session) {
  if (!session) return NaN;
  if (session.step === 'PAYMENT_PROCESSING') {
    if (session.confirmUntil) {
      const confirmMs = new Date(session.confirmUntil).getTime();
      if (Number.isFinite(confirmMs)) return confirmMs;
    }
    const baseRaw = session.expiresAt || session.reservedUntil;
    const baseMs = baseRaw ? new Date(baseRaw).getTime() : NaN;
    return Number.isFinite(baseMs) ? baseMs + DEFAULT_CONFIRM_WINDOW_MS : NaN;
  }
  return session.reservedUntil ? new Date(session.reservedUntil).getTime() : NaN;
}

export function readReservation(eventId) {
  if (!eventId) return null;
  try {
    const raw = localStorage.getItem(getReservationStorageKey(eventId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveReservation(eventId, payload, { silent = false } = {}) {
  if (!eventId) return;
  try {
    localStorage.setItem(getReservationStorageKey(eventId), JSON.stringify(payload));
    if (!silent) emitReservationChanged();
  } catch {
    /* Bỏ qua nếu trình duyệt chặn localStorage */
  }
}

export function clearReservation(eventId, { silent = false } = {}) {
  if (!eventId) return;
  try {
    localStorage.removeItem(getReservationStorageKey(eventId));
    if (!silent) emitReservationChanged();
  } catch {
    /* Bỏ qua */
  }
}

export function formatCountdown(totalSeconds) {
  const safe = Math.max(0, Number(totalSeconds) || 0);
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

export function formatSeatSummary(seats = []) {
  if (!Array.isArray(seats) || seats.length === 0) return '';
  const codes = seats.map((s) => s.seat_number || s.seatNumber || s.code).filter(Boolean);
  if (codes.length <= 4) return codes.join(', ');
  return `${codes.slice(0, 3).join(', ')} (+${codes.length - 3})`;
}

const isSessionSame = (a, b) =>
  Boolean(a && b) &&
  a.step === b.step &&
  String(a.eventId || '') === String(b.eventId || '') &&
  Number(a.orderCode || 0) === Number(b.orderCode || 0) &&
  String(a.checkoutUrl || '') === String(b.checkoutUrl || '') &&
  String(a.reservedUntil || '') === String(b.reservedUntil || '') &&
  String(a.expiresAt || '') === String(b.expiresAt || '') &&
  String(a.confirmUntil || '') === String(b.confirmUntil || '') &&
  String(a.phase || '') === String(b.phase || '') &&
  Number(a.totalAmount ?? -1) === Number(b.totalAmount ?? -1) &&
  (Array.isArray(a.seats) ? a.seats.length : 0) === (Array.isArray(b.seats) ? b.seats.length : 0);

/**
 * Quét toàn bộ phiên giữ chỗ (`RESERVED`) hoặc thanh toán (`PAYMENT_PROCESSING`)
 * còn hạn của đúng tài khoản đang đăng nhập trong localStorage.
 */
export function getActiveSessions(userId) {
  if (!userId || typeof localStorage === 'undefined') return [];
  const nowMs = Date.now();
  const list = [];

  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(RESERVATION_STORAGE_PREFIX)) continue;

    const eventId = key.slice(RESERVATION_STORAGE_PREFIX.length);
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || 'null');
      if (!parsed || (parsed.step !== 'PAYMENT_PROCESSING' && parsed.step !== 'RESERVED')) continue;
      if (!parsed.userId || String(parsed.userId) !== String(userId)) continue;
      if (!parsed.reservedUntil && !parsed.confirmUntil && !parsed.expiresAt) continue;

      if (parsed.step === 'PAYMENT_PROCESSING' && !parsed.orderCode) continue;
      if (parsed.step === 'RESERVED' && (!Array.isArray(parsed.seats) || parsed.seats.length === 0)) {
        continue;
      }

      const offsetMs = Number.isFinite(Number(parsed.serverOffsetMs))
        ? Number(parsed.serverOffsetMs)
        : 0;
      const expiryMs = getSessionEffectiveExpiryMs(parsed);
      if (!Number.isFinite(expiryMs) || expiryMs <= nowMs + offsetMs) continue;

      list.push({
        ...parsed,
        eventId: parsed.eventId || eventId,
        orderCode: parsed.orderCode ? Number(parsed.orderCode) : null,
      });
    } catch {
      /* Bỏ qua record lỗi */
    }
  }

  list.sort((a, b) => {
    if (a.step !== b.step) return a.step === 'PAYMENT_PROCESSING' ? -1 : 1;
    return getSessionEffectiveExpiryMs(b) - getSessionEffectiveExpiryMs(a);
  });
  return list;
}

/**
 * Quét các phiên thanh toán PayOS đang chờ (`step === 'PAYMENT_PROCESSING'`) còn hạn (theo orderCode).
 */
export function getActivePendingPayments(userId) {
  return getActiveSessions(userId).filter(
    (s) => s.step === 'PAYMENT_PROCESSING' && Boolean(s.orderCode),
  );
}

/**
 * Xóa các phiên cũ trong localStorage thuộc về userId nhưng khác keepEventId (tránh treo banner giả).
 */
export function clearOtherUserReservations(userId, keepEventId = null, { silent = true } = {}) {
  if (!userId || typeof localStorage === 'undefined') return;
  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(RESERVATION_STORAGE_PREFIX)) continue;
    const eventId = key.slice(RESERVATION_STORAGE_PREFIX.length);
    if (keepEventId && String(eventId) === String(keepEventId)) continue;
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || 'null');
      if (parsed?.userId && String(parsed.userId) === String(userId)) {
        keysToRemove.push(eventId);
      }
    } catch {
      /* Bỏ qua record lỗi */
    }
  }
  keysToRemove.forEach((evId) => clearReservation(evId, { silent }));
}

/**
 * Đồng bộ phiên nhận từ Backend vào localStorage nếu có thay đổi.
 */
export function syncServerReservationToStorage(userId, serverSession, { silent = false } = {}) {
  if (!userId || !serverSession?.eventId) return null;
  const existing = readReservation(serverSession.eventId);
  const existingOffset = Number.isFinite(Number(existing?.serverOffsetMs))
    ? Number(existing.serverOffsetMs)
    : 0;
  const nextServerOffsetMs = serverSession.serverTime
    ? computeServerOffsetMs(serverSession.serverTime, existingOffset)
    : existingOffset;
  const nextPayload = {
    ...(existing || {}),
    userId,
    step: serverSession.step,
    eventId: serverSession.eventId,
    eventTitle: serverSession.eventTitle || existing?.eventTitle || '',
    eventType: serverSession.eventType || existing?.eventType || null,
    orderCode: serverSession.orderCode ? Number(serverSession.orderCode) : null,
    checkoutUrl: serverSession.checkoutUrl || existing?.checkoutUrl || null,
    totalAmount:
      serverSession.totalAmount != null ? Number(serverSession.totalAmount) : existing?.totalAmount ?? null,
    reservedUntil: serverSession.expiresAt || serverSession.reservedUntil,
    expiresAt: serverSession.expiresAt || existing?.expiresAt || serverSession.reservedUntil || null,
    confirmUntil: serverSession.confirmUntil || existing?.confirmUntil || null,
    phase: serverSession.phase || existing?.phase || null,
    serverOffsetMs: nextServerOffsetMs,
    seats:
      Array.isArray(serverSession.seats) && serverSession.seats.length > 0
        ? serverSession.seats
        : existing?.seats || [],
  };

  clearOtherUserReservations(userId, serverSession.eventId, { silent: true });
  if (!isSessionSame(existing, nextPayload)) {
    saveReservation(serverSession.eventId, nextPayload, { silent });
  }
  return nextPayload;
}
