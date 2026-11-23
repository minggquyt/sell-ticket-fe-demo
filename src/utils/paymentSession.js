import {
  buildNormalizedReservation,
  getSessionEffectiveExpiryMs,
  hasLegacyFields,
  isExpiredSession,
  isPositiveInt,
  isSessionSame,
  isSessionValidForUser,
  toIsoOrNull,
} from './reservationSchema.js';

export {
  buildNormalizedReservation,
  computeServerOffsetMs,
  formatCountdown,
  formatSeatSummary,
  getReservationSeatsKey,
  getSessionEffectiveExpiryMs,
  getSessionWaitingExpiryMs,
  hasSeatReservationMismatch,
  isSessionSame,
  normalizeReservationSeats,
} from './reservationSchema.js';

export const RESERVATION_STORAGE_PREFIX = 'event_reservation_';
export const RESERVATION_CHANGED_EVENT = 'sellticket:reservation-changed';
export const CHECKOUT_INFLIGHT_PREFIX = 'sellticket_checkout_inflight_';
const DEFAULT_CHECKOUT_INFLIGHT_TTL_MS = 15 * 1000;
const inFlightCheckoutMap = new Map();

const hasStorage = () => typeof localStorage !== 'undefined';
const getCheckoutInFlightKey = (eventId) => `${CHECKOUT_INFLIGHT_PREFIX}${eventId}`;
export const getReservationStorageKey = (eventId) => `${RESERVATION_STORAGE_PREFIX}${eventId}`;
export const isReservationStorageEvent = (e) =>
  !e || e.type !== 'storage' || e.key === null || e.key.startsWith(RESERVATION_STORAGE_PREFIX);

const emitReservationChanged = () => {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(RESERVATION_CHANGED_EVENT));
};

const getKeysByPrefix = (prefix) => {
  if (!hasStorage()) return [];
  const keys = [];
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) keys.push(k);
    }
  } catch {
    return [];
  }
  return keys;
};

const readAllReservationEntries = () =>
  getKeysByPrefix(RESERVATION_STORAGE_PREFIX).map((key) => {
    const eventId = key.slice(RESERVATION_STORAGE_PREFIX.length);
    try {
      const data = JSON.parse(localStorage.getItem(key) || 'null');
      return { key, eventId, data, corrupt: !data || typeof data !== 'object' };
    } catch {
      return { key, eventId, data: null, corrupt: true };
    }
  });

const writeStorageEntry = (eventId, payload) => {
  try {
    localStorage.setItem(getReservationStorageKey(eventId), JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
};

const removeEventIds = (eventIds, { silent = false } = {}) => {
  const removed = [];
  new Set(eventIds).forEach((evId) => {
    if (clearReservation(evId, { silent: true })) removed.push(evId);
  });
  if (removed.length > 0 && !silent) emitReservationChanged();
  return removed;
};

const removeReservationsWhere = (predicate, { silent = false } = {}) =>
  removeEventIds(readAllReservationEntries().filter(predicate).map((e) => e.eventId), { silent });

export function markCheckoutInFlight(eventId, ttlMs = DEFAULT_CHECKOUT_INFLIGHT_TTL_MS) {
  if (!eventId) return;
  const expiresAt = Date.now() + Math.max(1000, Number(ttlMs) || DEFAULT_CHECKOUT_INFLIGHT_TTL_MS);
  const key = getCheckoutInFlightKey(eventId);
  inFlightCheckoutMap.set(key, expiresAt);
  try {
    if (hasStorage()) localStorage.setItem(key, String(expiresAt));
  } catch {
    /* Bỏ qua nếu trình duyệt chặn localStorage */
  }
}

export function clearCheckoutInFlight(eventId) {
  if (!eventId) return;
  const key = getCheckoutInFlightKey(eventId);
  inFlightCheckoutMap.delete(key);
  try {
    if (hasStorage()) localStorage.removeItem(key);
  } catch {
    /* Bỏ qua */
  }
}

export function clearAllCheckoutInFlight() {
  inFlightCheckoutMap.clear();
  try {
    if (hasStorage()) getKeysByPrefix(CHECKOUT_INFLIGHT_PREFIX).forEach((k) => localStorage.removeItem(k));
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
    const raw = hasStorage() ? localStorage.getItem(key) : null;
    if (raw !== null) {
      if (Number.isFinite(Number(raw)) && Number(raw) > nowMs) return true;
      localStorage.removeItem(key);
    }
  } catch {
    /* Bỏ qua */
  }
  return false;
}

export function readReservation(eventId) {
  if (!eventId || !hasStorage()) return null;
  try {
    const raw = localStorage.getItem(getReservationStorageKey(eventId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveReservation(eventId, payload, { silent = false } = {}) {
  if (!eventId || !hasStorage()) return null;
  const existing = readReservation(eventId);
  const nextPayload =
    payload?.userId && payload?.step
      ? buildNormalizedReservation(payload.userId, { ...payload, eventId: payload.eventId || eventId }, existing)
      : payload;
  if (!nextPayload) return null;
  if (existing && !hasLegacyFields(existing) && isSessionSame(existing, nextPayload)) return existing;
  if (writeStorageEntry(eventId, nextPayload) && !silent) emitReservationChanged();
  return nextPayload;
}

export function clearReservation(eventId, { silent = false } = {}) {
  if (!eventId || !hasStorage()) return false;
  try {
    const key = getReservationStorageKey(eventId);
    if (localStorage.getItem(key) === null) return false;
    localStorage.removeItem(key);
    if (!silent) emitReservationChanged();
    return true;
  } catch {
    return false;
  }
}

export function clearReservationByOrderCode(orderCode, eventId = null, { silent = false } = {}) {
  if (!hasStorage()) return false;
  const code = Number(orderCode);
  const hasCode = isPositiveInt(code);
  return (
    removeReservationsWhere(
      ({ eventId: evId, data, corrupt }) =>
        (hasCode && Number(data?.orderCode) === code) ||
        Boolean(
          eventId &&
            String(evId) === String(eventId) &&
            (corrupt || (data.step === 'RESERVED' && isExpiredSession(data) && !isCheckoutInFlight(evId))),
        ),
      { silent },
    ).length > 0
  );
}

export function getActiveSessions(userId) {
  if (!userId || !hasStorage()) return [];
  const nowMs = Date.now();
  const list = readAllReservationEntries()
    .filter(({ data, corrupt }) => !corrupt && isSessionValidForUser(data, userId) && !isExpiredSession(data, nowMs))
    .map(({ eventId, data }) => ({
      ...data,
      eventId: data.eventId || eventId,
      orderCode: data.orderCode ? Number(data.orderCode) : null,
    }));
  list.sort((a, b) =>
    a.step !== b.step
      ? a.step === 'PAYMENT_PROCESSING'
        ? -1
        : 1
      : getSessionEffectiveExpiryMs(b) - getSessionEffectiveExpiryMs(a),
  );
  return list;
}

export function getActivePendingPayments(userId) {
  return getActiveSessions(userId).filter((s) => s.step === 'PAYMENT_PROCESSING' && Boolean(s.orderCode));
}

export function clearOtherUserReservations(userId, keepEventId = null, { silent = true } = {}) {
  if (!userId || !hasStorage()) return false;
  return (
    removeReservationsWhere(
      ({ eventId, data, corrupt }) =>
        !corrupt && !(keepEventId && String(eventId) === String(keepEventId)) && String(data.userId) === String(userId),
      { silent },
    ).length > 0
  );
}

export function clearAllReservations({
  userId = null,
  keepEventId = null,
  preserveInFlight = false,
  silent = false,
} = {}) {
  if (!hasStorage()) return [];
  const removed = removeReservationsWhere(
    ({ eventId, data, corrupt }) =>
      !(keepEventId && String(eventId) === String(keepEventId)) &&
      !(preserveInFlight && isCheckoutInFlight(eventId)) &&
      (userId === null || corrupt || !data.userId || String(data.userId) === String(userId)),
    { silent: true },
  );
  if (userId === null && !preserveInFlight && !keepEventId) clearAllCheckoutInFlight();
  if (removed.length > 0 && !silent) emitReservationChanged();
  return removed;
}

export function pruneStaleReservations(activeUserId = null, { preserveInFlight = true, silent = true } = {}) {
  if (!hasStorage()) return [];
  const nowMs = Date.now();
  if (!preserveInFlight) {
    clearAllCheckoutInFlight();
  } else {
    getKeysByPrefix(CHECKOUT_INFLIGHT_PREFIX).forEach((key) => {
      try {
        const exp = Number(localStorage.getItem(key));
        if (!Number.isFinite(exp) || exp <= nowMs) {
          localStorage.removeItem(key);
          inFlightCheckoutMap.delete(key);
        }
      } catch {
        /* Bỏ qua */
      }
    });
  }
  return removeReservationsWhere(
    ({ eventId, data, corrupt }) =>
      corrupt ||
      !isSessionValidForUser(data, activeUserId) ||
      (isExpiredSession(data, nowMs) && !(preserveInFlight && data.step === 'RESERVED' && isCheckoutInFlight(eventId))),
    { silent },
  );
}

export function syncServerReservationToStorage(userId, serverSession, { silent = false } = {}) {
  const pruned = pruneStaleReservations(userId || null, { preserveInFlight: true, silent: true });
  const existing = userId && serverSession?.eventId ? readReservation(serverSession.eventId) : null;
  const nextPayload = userId && serverSession?.eventId ? buildNormalizedReservation(userId, serverSession, existing) : null;
  if (!nextPayload) {
    if (pruned.length > 0 && !silent) emitReservationChanged();
    return null;
  }
  const removedOthers = clearOtherUserReservations(userId, serverSession.eventId, { silent: true });
  const changed = !existing || hasLegacyFields(existing) || !isSessionSame(existing, nextPayload);
  if (changed && hasStorage()) writeStorageEntry(serverSession.eventId, nextPayload);
  if ((changed || removedOthers || pruned.length > 0) && !silent) emitReservationChanged();
  return changed ? nextPayload : existing;
}

export function syncOrderPaymentToStorage(userId, orderData, { silent = false } = {}) {
  const orderCode = Number(orderData?.orderCode);
  if (!userId || !isPositiveInt(orderCode)) return null;
  const status = orderData.status || orderData.orderStatus;
  if (status && status !== 'PAYMENT_PROCESSING') {
    clearReservationByOrderCode(orderCode, orderData.eventId || null, { silent });
    return null;
  }
  const eventId =
    orderData.eventId ||
    readAllReservationEntries().find((e) => !e.corrupt && Number(e.data.orderCode) === orderCode)?.eventId ||
    null;
  if (!eventId) return null;

  const normalized = buildNormalizedReservation(
    userId,
    { ...orderData, step: 'PAYMENT_PROCESSING', eventId, orderCode },
    readReservation(eventId),
  );
  if (!normalized) return null;
  if (isExpiredSession(normalized)) {
    clearReservationByOrderCode(orderCode, eventId, { silent });
    return null;
  }
  return syncServerReservationToStorage(userId, normalized, { silent });
}

export function updateReservationPhaseIfNeeded(eventId, nextPhase, { silent = false } = {}) {
  if (!eventId || (nextPhase !== 'WAITING' && nextPhase !== 'CONFIRMING')) return readReservation(eventId);
  const existing = readReservation(eventId);
  if (!existing || existing.step !== 'PAYMENT_PROCESSING' || existing.phase === nextPhase) return existing;
  return saveReservation(eventId, { ...existing, phase: nextPhase }, { silent });
}

export function reconcileReservationsWithOrders(userId, orders = [], { silent = false } = {}) {
  if (!userId) return { terminated: [], updated: false };
  const pruned = pruneStaleReservations(userId, { preserveInFlight: true, silent: true });
  const terminated = [];
  let updated = false;

  if (Array.isArray(orders) && hasStorage()) {
    for (const { eventId: evId, data: parsed, corrupt } of readAllReservationEntries()) {
      if (corrupt || String(parsed.userId || '') !== String(userId) || parsed.step !== 'PAYMENT_PROCESSING' || !parsed.orderCode) {
        continue;
      }
      const matched = orders.find((o) => Number(o?.orderCode) === Number(parsed.orderCode));
      if (!matched) continue;
      const st = matched.status || matched.orderStatus;
      if (st && st !== 'PAYMENT_PROCESSING') {
        if (clearReservation(evId, { silent: true })) {
          terminated.push({ eventId: evId, orderCode: Number(parsed.orderCode), status: st });
        }
        continue;
      }
      if (st === 'PAYMENT_PROCESSING') {
        const matchedExpires = toIsoOrNull(matched.expiresAt || matched.paymentTimeout);
        const matchedConfirm = toIsoOrNull(matched.confirmUntil);
        const expiryChanged = Boolean(
          (matchedExpires && matchedExpires !== parsed.expiresAt) ||
            (matchedConfirm && matchedConfirm !== parsed.confirmUntil),
        );
        const keepConfirming = parsed.phase === 'CONFIRMING' && !expiryChanged;
        const phaseChanged = Boolean(
          matched.phase && matched.phase !== parsed.phase && !(keepConfirming && matched.phase === 'WAITING'),
        );
        if (expiryChanged || phaseChanged) {
          const synced = syncOrderPaymentToStorage(
            userId,
            { ...matched, eventId: matched.eventId || evId, phase: keepConfirming ? 'CONFIRMING' : matched.phase },
            { silent: true },
          );
          if (!synced) terminated.push({ eventId: evId, orderCode: Number(parsed.orderCode), status: 'EXPIRED' });
          updated = true;
        }
      }
    }
  }

  const anyChanged = pruned.length > 0 || terminated.length > 0 || updated;
  if (anyChanged && !silent) emitReservationChanged();
  return { terminated, updated: anyChanged };
}
