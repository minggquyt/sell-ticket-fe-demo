const DEFAULT_CONFIRM_WINDOW_MS = 30 * 1000;

export const toIsoOrNull = (val) => {
  if (!val) return null;
  const ms = val instanceof Date ? val.getTime() : typeof val === 'number' ? val : Date.parse(String(val));
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
};

export const toNumOrNull = (val) => (val != null && Number.isFinite(Number(val)) ? Number(val) : null);
export const isPositiveInt = (val) => Number.isInteger(Number(val)) && Number(val) > 0;
export const getOffsetMs = (session) =>
  Number.isFinite(Number(session?.serverOffsetMs)) ? Number(session.serverOffsetMs) : 0;
export const hasLegacyFields = (session) =>
  Boolean(session && ('checkoutUrl' in session || 'guestEmail' in session || 'guestName' in session));

const normalizeSeat = (seat) => {
  if (!seat || typeof seat !== 'object') return null;
  const rawId = seat.id ?? seat.seatId ?? seat.seat_id ?? null;
  const id = rawId !== null && rawId !== '' ? rawId : null;
  const seatNumber = String(seat.seat_number || seat.seatNumber || seat.code || '').trim();
  if (!id && !seatNumber) return null;
  return {
    id,
    seat_number: seatNumber,
    zone_name: String(seat.zone_name || seat.zoneName || seat.tier || 'STANDARD').trim() || 'STANDARD',
    price: Number(seat.price) || 0,
  };
};

export function computeServerOffsetMs(serverTime, fallbackOffsetMs = 0) {
  const fallback = Number.isFinite(Number(fallbackOffsetMs)) ? Number(fallbackOffsetMs) : 0;
  const srvMs = serverTime ? Date.parse(serverTime) : NaN;
  return Number.isFinite(srvMs) ? srvMs - Date.now() : fallback;
}

export function getSessionWaitingExpiryMs(session) {
  if (!session) return NaN;
  const raw =
    session.step === 'RESERVED'
      ? session.reservedUntil
      : session.step === 'PAYMENT_PROCESSING'
        ? session.expiresAt || session.reservedUntil
        : null;
  return raw ? Date.parse(raw) : NaN;
}

export function getSessionEffectiveExpiryMs(session) {
  if (!session) return NaN;
  if (session.step === 'PAYMENT_PROCESSING') {
    const confirmMs = session.confirmUntil ? new Date(session.confirmUntil).getTime() : NaN;
    if (Number.isFinite(confirmMs)) return confirmMs;
    const baseRaw = session.expiresAt || session.reservedUntil;
    const baseMs = baseRaw ? new Date(baseRaw).getTime() : NaN;
    return Number.isFinite(baseMs) ? baseMs + DEFAULT_CONFIRM_WINDOW_MS : NaN;
  }
  return session.step === 'RESERVED' && session.reservedUntil
    ? new Date(session.reservedUntil).getTime()
    : NaN;
}

export function isExpiredSession(session, nowMs = Date.now()) {
  const expiryMs = getSessionEffectiveExpiryMs(session);
  return !Number.isFinite(expiryMs) || expiryMs <= nowMs + getOffsetMs(session);
}

export function normalizeReservationSeats(seats = []) {
  return Array.isArray(seats) ? seats.map(normalizeSeat).filter(Boolean) : [];
}

export function getReservationSeatsKey(seats = []) {
  return normalizeReservationSeats(seats)
    .map((s) => String(s.id || s.seat_number))
    .filter(Boolean)
    .sort()
    .join(',');
}

export function isSessionValidForUser(data, userId = null) {
  if (!data || typeof data !== 'object' || !data.userId) return false;
  if (userId !== null && String(data.userId) !== String(userId)) return false;
  if (data.step === 'PAYMENT_PROCESSING') return isPositiveInt(data.orderCode);
  if (data.step === 'RESERVED') return normalizeReservationSeats(data.seats).length > 0;
  return false;
}

export function buildNormalizedReservation(userId, rawSession, existing = null) {
  const step = rawSession?.step;
  if (!userId || !rawSession?.eventId || (step !== 'RESERVED' && step !== 'PAYMENT_PROCESSING')) {
    return null;
  }
  const sameOwnerEvent = Boolean(
    existing?.userId &&
      String(existing.userId) === String(userId) &&
      String(existing.eventId || '') === String(rawSession.eventId),
  );
  const fallbackOffset = sameOwnerEvent ? getOffsetMs(existing) : 0;
  const nextOffset = rawSession.serverTime
    ? computeServerOffsetMs(rawSession.serverTime, fallbackOffset)
    : toNumOrNull(rawSession.serverOffsetMs) ?? fallbackOffset;
  const base = {
    userId,
    step,
    eventId: rawSession.eventId,
    eventTitle: rawSession.eventTitle || (sameOwnerEvent ? existing.eventTitle || '' : ''),
    eventType: rawSession.eventType || (sameOwnerEvent ? existing.eventType || null : null),
    serverOffsetMs: nextOffset,
    updatedAt: new Date().toISOString(),
  };
  const rawSeats = normalizeReservationSeats(rawSession.seats || rawSession.items);
  const pickAmount = (canFallback) =>
    toNumOrNull(rawSession.totalAmount) ?? (canFallback ? toNumOrNull(existing.totalAmount) : null);

  if (step === 'RESERVED') {
    const reservedUntil = toIsoOrNull(rawSession.reservedUntil);
    const sameReserved = sameOwnerEvent && existing.step === 'RESERVED';
    const seats = rawSeats.length > 0 ? rawSeats : sameReserved ? normalizeReservationSeats(existing.seats) : [];
    if (!reservedUntil || seats.length === 0) return null;
    return {
      ...base,
      orderCode: null,
      totalAmount: pickAmount(sameReserved),
      reservedUntil,
      expiresAt: null,
      confirmUntil: null,
      phase: null,
      seats,
    };
  }

  const orderCode = Number(rawSession.orderCode);
  if (!isPositiveInt(orderCode)) return null;
  const sameOrder =
    sameOwnerEvent && existing.step === 'PAYMENT_PROCESSING' && Number(existing.orderCode) === orderCode;
  const expiresAt =
    toIsoOrNull(rawSession.expiresAt || rawSession.paymentTimeout || rawSession.reservedUntil) ||
    (sameOrder ? toIsoOrNull(existing.expiresAt || existing.reservedUntil) : null);
  if (!expiresAt) return null;

  const expiresMs = Date.parse(expiresAt);
  const confirmUntil =
    toIsoOrNull(rawSession.confirmUntil) ||
    (sameOrder ? toIsoOrNull(existing.confirmUntil) : null) ||
    new Date(expiresMs + DEFAULT_CONFIRM_WINDOW_MS).toISOString();
  const phase =
    rawSession.phase === 'WAITING' || rawSession.phase === 'CONFIRMING'
      ? rawSession.phase
      : Date.now() + nextOffset >= expiresMs
        ? 'CONFIRMING'
        : 'WAITING';
  const canInheritSeats = sameOrder || (sameOwnerEvent && existing.step === 'RESERVED');
  return {
    ...base,
    orderCode,
    totalAmount: pickAmount(sameOrder),
    reservedUntil: expiresAt,
    expiresAt,
    confirmUntil,
    phase,
    seats: rawSeats.length > 0 ? rawSeats : canInheritSeats ? normalizeReservationSeats(existing.seats) : [],
  };
}

export function isSessionSame(a, b) {
  if (!a || !b) return false;
  return (
    String(a.userId || '') === String(b.userId || '') &&
    a.step === b.step &&
    String(a.eventId || '') === String(b.eventId || '') &&
    Number(a.orderCode || 0) === Number(b.orderCode || 0) &&
    String(a.reservedUntil || '') === String(b.reservedUntil || '') &&
    String(a.expiresAt || '') === String(b.expiresAt || '') &&
    String(a.confirmUntil || '') === String(b.confirmUntil || '') &&
    String(a.phase || '') === String(b.phase || '') &&
    String(a.eventTitle || '') === String(b.eventTitle || '') &&
    String(a.eventType || '') === String(b.eventType || '') &&
    toNumOrNull(a.totalAmount) === toNumOrNull(b.totalAmount) &&
    getReservationSeatsKey(a.seats) === getReservationSeatsKey(b.seats) &&
    Math.abs(getOffsetMs(a) - getOffsetMs(b)) < 2000
  );
}

export function formatCountdown(totalSeconds) {
  const safe = Math.max(0, Number(totalSeconds) || 0);
  return `${Math.floor(safe / 60).toString().padStart(2, '0')}:${(safe % 60).toString().padStart(2, '0')}`;
}

export function formatSeatSummary(seats = []) {
  if (!Array.isArray(seats) || seats.length === 0) return '';
  const codes = seats.map((s) => s.seat_number || s.seatNumber || s.code).filter(Boolean);
  return codes.length <= 4 ? codes.join(', ') : `${codes.slice(0, 3).join(', ')} (+${codes.length - 3})`;
}

export function hasSeatReservationMismatch(seats, userId, saved) {
  const myHeld = seats.filter(
    (s) =>
      String(s.reserved_by || '') === String(userId) &&
      (s.status === 'RESERVED' || s.status === 'PAYMENT_PROCESSING'),
  );
  const owned = Boolean(saved && String(saved.userId || '') === String(userId));
  if (!owned) return myHeld.length > 0;
  if (myHeld.length === 0) return true;
  if (saved.step === 'RESERVED') {
    return (
      myHeld.some((s) => s.status === 'PAYMENT_PROCESSING') ||
      getReservationSeatsKey(myHeld) !== getReservationSeatsKey(saved.seats)
    );
  }
  return !myHeld.some(
    (s) => s.status === 'PAYMENT_PROCESSING' && Number(s.current_order_code) === Number(saved.orderCode),
  );
}
