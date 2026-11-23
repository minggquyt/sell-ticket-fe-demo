import { useCallback, useEffect, useRef, useState } from 'react';
import { CreditCard, Clock, Timer, ArrowRight, X } from 'lucide-react';
import {
  cancelOrder,
  fetchMyActiveSession,
  fetchOrderPayment,
  releaseSeats,
} from '../services/eventService';
import { formatVND } from '../utils/format.js';
import {
  RESERVATION_CHANGED_EVENT,
  clearAllReservations,
  clearReservation,
  clearReservationByOrderCode,
  formatCountdown,
  formatSeatSummary,
  getActiveSessions,
  getSessionEffectiveExpiryMs,
  getSessionWaitingExpiryMs,
  isCheckoutInFlight,
  isReservationStorageEvent,
  isSessionSame,
  pruneStaleReservations,
  readReservation,
  reconcileReservationsWithOrders,
  syncOrderPaymentToStorage,
  syncServerReservationToStorage,
  updateReservationPhaseIfNeeded,
} from '../utils/paymentSession.js';
import { useToast } from './toastContext.js';
import './PendingPaymentBanner.css';

const buildVerifyKey = (s) =>
  s
    ? `${s.step}:${s.eventId || ''}:${s.orderCode || ''}:${s.phase || ''}:${s.confirmUntil || s.reservedUntil || ''}`
    : null;

const getOrderConfirmDeadlineMs = (order) =>
  order.confirmUntil
    ? new Date(order.confirmUntil).getTime()
    : order.expiresAt
      ? new Date(order.expiresAt).getTime() + 30 * 1000
      : 0;

const notifyOrderOutcomeToast = (toast, orderCode, status, expiredMessage = null) => {
  if (status === 'SUCCESS') toast.success(`Đơn #${orderCode} đã thanh toán thành công!`);
  else if (status === 'REFUND_PENDING') toast.warning(`Đơn #${orderCode} đã chuyển sang Chờ hoàn tiền!`);
  else if (expiredMessage) toast.warning(expiredMessage);
};

export default function PendingPaymentBanner({
  user,
  orders = [],
  activeEventId = null,
  onNavigate,
  onOrdersChanged,
}) {
  const toast = useToast();
  const [candidate, setCandidate] = useState(() => getActiveSessions(user?.id)[0] || null);
  const [activeSession, setActiveSession] = useState(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [isBusy, setIsBusy] = useState(false);
  const expiredKeyRef = useRef(null);
  const serverSyncRef = useRef({ lastAt: 0, verifiedKey: null, verifiedAt: 0 });
  const lastForcedOrderSyncRef = useRef(null);
  const callbacksRef = useRef({ toast, onOrdersChanged });

  useEffect(() => {
    callbacksRef.current = { toast, onOrdersChanged };
  });

  // Đồng bộ phiên giữ chỗ / thanh toán từ Backend (xuyên thiết bị & trình duyệt)
  const pullServerActiveSession = useCallback(
    async (force = false) => {
      const userId = user?.id;
      const token = user?.token;
      if (!userId || !token) return;
      const now = Date.now();
      if (!force && now - serverSyncRef.current.lastAt < 4000) return;
      serverSyncRef.current.lastAt = now;

      try {
        const serverSession = await fetchMyActiveSession(token);
        if (serverSession) {
          const saved = syncServerReservationToStorage(userId, serverSession, { silent: false });
          serverSyncRef.current.verifiedKey = buildVerifyKey(saved);
          serverSyncRef.current.verifiedAt = Date.now();
          setNowMs(Date.now());
          setCandidate(saved);
          setActiveSession(saved);
          return;
        }

        const locals = getActiveSessions(userId);
        const localProcessing = locals.find((s) => s.step === 'PAYMENT_PROCESSING' && s.orderCode);
        const inFlightLocal = locals.find((s) => s.step === 'RESERVED' && isCheckoutInFlight(s.eventId));
        clearAllReservations({ userId, preserveInFlight: true, silent: false });
        pruneStaleReservations(userId, { preserveInFlight: true, silent: true });

        if (localProcessing) {
          const orderData = await fetchOrderPayment(localProcessing.orderCode, token, {
            sync: false,
            background: true,
          }).catch(() => null);
          clearReservationByOrderCode(localProcessing.orderCode, localProcessing.eventId);
          const { toast: liveToast, onOrdersChanged: notifyOrders } = callbacksRef.current;
          notifyOrders?.();
          notifyOrderOutcomeToast(liveToast, orderData?.orderCode || localProcessing.orderCode, orderData?.status);
        }
        if (inFlightLocal && !localProcessing) {
          setNowMs(Date.now());
          setCandidate(inFlightLocal);
          setActiveSession(inFlightLocal);
          return;
        }
        setCandidate(null);
        setActiveSession(null);
      } catch {
        pruneStaleReservations(userId, { preserveInFlight: true, silent: true });
        const fallback = getActiveSessions(userId)[0] || null;
        if (fallback) setActiveSession(fallback);
      }
    },
    [user?.id, user?.token],
  );

  // Kéo phiên từ Backend khi mở lại web / đổi tài khoản / quay lại tab
  useEffect(() => {
    if (!user?.id || !user?.token) return undefined;
    const initTimer = setTimeout(() => pullServerActiveSession(true), 0);
    const onVisible = () => {
      if (document.visibilityState === 'visible') pullServerActiveSession(false);
    };
    window.addEventListener('focus', onVisible);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearTimeout(initTimer);
      window.removeEventListener('focus', onVisible);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [user?.id, user?.token, pullServerActiveSession]);

  // Lắng nghe thay đổi localStorage cùng tab & khác tab
  useEffect(() => {
    const syncCandidate = (e) => {
      if (!isReservationStorageEvent(e)) return;
      pruneStaleReservations(user?.id || null, { preserveInFlight: true, silent: true });
      const next = getActiveSessions(user?.id)[0] || null;
      setNowMs(Date.now());
      setCandidate((prev) => (isSessionSame(prev, next) ? prev : next));
      if (!next) {
        setActiveSession(null);
      } else {
        setActiveSession((prev) => (prev && !isSessionSame(prev, next) ? next : prev));
      }
    };

    const initTimer = setTimeout(syncCandidate, 0);
    window.addEventListener(RESERVATION_CHANGED_EVENT, syncCandidate);
    window.addEventListener('storage', syncCandidate);
    return () => {
      clearTimeout(initTimer);
      window.removeEventListener(RESERVATION_CHANGED_EVENT, syncCandidate);
      window.removeEventListener('storage', syncCandidate);
    };
  }, [user?.id]);

  // Xác thực phiên local với Backend khi cần (DB-only)
  useEffect(() => {
    if (!candidate || !user?.id || !user?.token) return undefined;
    let cancelled = false;
    const candidateKey = buildVerifyKey(candidate);
    const recentlyVerified =
      serverSyncRef.current.verifiedKey === candidateKey &&
      Date.now() - serverSyncRef.current.verifiedAt < 4000;

    if (candidate.step === 'RESERVED' || recentlyVerified) {
      const timer = setTimeout(() => {
        if (cancelled) return;
        setNowMs(Date.now());
        setActiveSession(candidate);
        if (candidate.step === 'RESERVED' && !recentlyVerified && !isCheckoutInFlight(candidate.eventId)) {
          serverSyncRef.current.verifiedKey = candidateKey;
          serverSyncRef.current.verifiedAt = Date.now();
          pullServerActiveSession(false);
        }
      }, 0);
      return () => {
        cancelled = true;
        clearTimeout(timer);
      };
    }

    fetchOrderPayment(candidate.orderCode, user.token, { sync: false, background: true })
      .then((orderData) => {
        if (cancelled) return;
        const { toast: liveToast, onOrdersChanged: notifyOrders } = callbacksRef.current;
        const st = orderData?.status;
        if (st !== 'PAYMENT_PROCESSING') {
          clearReservationByOrderCode(candidate.orderCode, candidate.eventId);
          notifyOrders?.();
          notifyOrderOutcomeToast(liveToast, orderData?.orderCode || candidate.orderCode, st);
          return;
        }
        const saved = syncOrderPaymentToStorage(user.id, orderData, { silent: false });
        if (!saved) {
          notifyOrders?.();
          setActiveSession(null);
          return;
        }
        serverSyncRef.current.verifiedKey = buildVerifyKey(saved);
        serverSyncRef.current.verifiedAt = Date.now();
        setNowMs(Date.now());
        setActiveSession(saved);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err?.status === 404 || err?.status === 403 || err?.message?.includes('Không tìm thấy')) {
          clearReservationByOrderCode(candidate.orderCode, candidate.eventId);
          return;
        }
        setActiveSession(candidate);
      });

    return () => {
      cancelled = true;
    };
  }, [candidate, user?.id, user?.token, pullServerActiveSession]);

  // Đồng bộ theo vòng lặp polling 10s của AppShell
  useEffect(() => {
    if (!user?.id || !user?.token || !Array.isArray(orders)) return undefined;
    const timer = setTimeout(() => {
      const { terminated } = reconcileReservationsWithOrders(user.id, orders, { silent: false });
      if (activeSession?.step === 'PAYMENT_PROCESSING' && activeSession.orderCode) {
        const ended = terminated.find((item) => Number(item.orderCode) === Number(activeSession.orderCode));
        if (ended) {
          notifyOrderOutcomeToast(callbacksRef.current.toast, activeSession.orderCode, ended.status);
          return;
        }
      }

      const userOffsetMs = Number.isFinite(Number(user?.serverOffsetMs)) ? Number(user.serverOffsetMs) : 0;
      const serverProcessing = orders.find((o) => {
        const st = o.status || o.orderStatus;
        return st === 'PAYMENT_PROCESSING' && (!o.expiresAt || getOrderConfirmDeadlineMs(o) > Date.now() + userOffsetMs);
      });

      if (serverProcessing) {
        const mismatch =
          !activeSession ||
          activeSession.step !== 'PAYMENT_PROCESSING' ||
          Number(activeSession.orderCode) !== Number(serverProcessing.orderCode) ||
          (serverProcessing.phase && activeSession.phase !== serverProcessing.phase);
        if (mismatch) {
          const syncKey = `${serverProcessing.orderCode}:${serverProcessing.phase || ''}`;
          if (lastForcedOrderSyncRef.current !== syncKey) {
            lastForcedOrderSyncRef.current = syncKey;
            pullServerActiveSession(true);
          }
        }
      } else {
        lastForcedOrderSyncRef.current = null;
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [orders, activeSession, user?.id, user?.token, user?.serverOffsetMs, pullServerActiveSession]);

  // Đồng hồ đếm ngược 1s
  useEffect(() => {
    if (!activeSession) return undefined;
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [activeSession]);

  const isReservedHold = activeSession?.step === 'RESERVED';
  const serverOffsetMs = Number.isFinite(Number(activeSession?.serverOffsetMs)) ? Number(activeSession.serverOffsetMs) : 0;
  const effectiveNowMs = nowMs + serverOffsetMs;
  const expiresAtMs = getSessionWaitingExpiryMs(activeSession);
  const confirmUntilMs = activeSession ? getSessionEffectiveExpiryMs(activeSession) : NaN;
  const isConfirming = Boolean(
    activeSession &&
      !isReservedHold &&
      Number.isFinite(expiresAtMs) &&
      effectiveNowMs >= expiresAtMs &&
      Number.isFinite(confirmUntilMs) &&
      effectiveNowMs < confirmUntilMs,
  );

  useEffect(() => {
    if (isConfirming && activeSession?.eventId && activeSession.phase !== 'CONFIRMING') {
      updateReservationPhaseIfNeeded(activeSession.eventId, 'CONFIRMING', { silent: false });
    }
  }, [isConfirming, activeSession?.eventId, activeSession?.phase]);

  const targetDeadlineMs = isConfirming ? confirmUntilMs : expiresAtMs;
  const secondsLeft = Number.isFinite(targetDeadlineMs)
    ? Math.max(0, Math.ceil((targetDeadlineMs - effectiveNowMs) / 1000))
    : 0;
  const isFinalDeadlinePassed = Boolean(
    activeSession &&
      (isReservedHold
        ? Number.isFinite(expiresAtMs) && effectiveNowMs >= expiresAtMs
        : Number.isFinite(confirmUntilMs) && effectiveNowMs >= confirmUntilMs),
  );
  const isReservedCheckoutInFlight = Boolean(
    isReservedHold && activeSession?.eventId && isCheckoutInFlight(activeSession.eventId),
  );

  useEffect(() => {
    if (!activeSession || !isFinalDeadlinePassed || !user?.token) return undefined;
    if (isReservedCheckoutInFlight) {
      expiredKeyRef.current = null;
      return undefined;
    }
    const expiryKey = `${activeSession.step}:${activeSession.orderCode || activeSession.eventId}:${activeSession.confirmUntil || activeSession.reservedUntil}`;
    if (expiredKeyRef.current === expiryKey) return undefined;
    expiredKeyRef.current = expiryKey;
    let didRun = false;

    const timer = setTimeout(async () => {
      didRun = true;
      const latest = readReservation(activeSession.eventId);
      if (!latest) return;

      if (activeSession.step === 'RESERVED') {
        if (isCheckoutInFlight(activeSession.eventId)) {
          expiredKeyRef.current = null;
          return;
        }
        if (latest.step !== 'RESERVED') return;
        const seatIds = (latest.seats || activeSession.seats || []).map((s) => s.id).filter(Boolean);
        await releaseSeats(user.id, seatIds, user.token).catch(() => {});
        const afterRelease = readReservation(activeSession.eventId);
        if (afterRelease && afterRelease.step !== 'RESERVED') return;
        clearReservation(activeSession.eventId);
        callbacksRef.current.onOrdersChanged?.();
        callbacksRef.current.toast.warning(
          `Hết thời gian giữ ghế${activeSession.eventTitle ? ` (${activeSession.eventTitle})` : ''}. Các ghế đã được mở lại!`,
        );
        return;
      }

      // Đã quá confirmUntil (150s): đối soát cuối (BE throttle) thay vì tự cancelOrder mù quáng
      const orderData = await fetchOrderPayment(activeSession.orderCode, user.token, {
        sync: true,
        background: true,
      }).catch(() => null);
      if (orderData?.status === 'PAYMENT_PROCESSING') {
        const saved = syncOrderPaymentToStorage(user.id, orderData, { silent: false });
        if (saved) {
          setNowMs(Date.now());
          setActiveSession(saved);
          expiredKeyRef.current = null;
          return;
        }
      }

      clearReservationByOrderCode(activeSession.orderCode, activeSession.eventId);
      const { toast: liveToast, onOrdersChanged: notifyOrders } = callbacksRef.current;
      notifyOrders?.();
      notifyOrderOutcomeToast(
        liveToast,
        activeSession.orderCode,
        orderData?.status,
        `Phiên thanh toán đơn #${activeSession.orderCode} đã hết hạn. Ghế đã được mở lại!`,
      );
    }, 0);

    return () => {
      clearTimeout(timer);
      if (!didRun && expiredKeyRef.current === expiryKey) expiredKeyRef.current = null;
    };
  }, [activeSession, isFinalDeadlinePassed, isReservedCheckoutInFlight, user?.id, user?.token]);

  if (!user || !activeSession) return null;
  if (activeSession.step === 'RESERVED' && activeEventId && String(activeEventId) === String(activeSession.eventId)) {
    return null;
  }

  const seatSummary = formatSeatSummary(activeSession.seats);
  const amountText = activeSession.totalAmount != null ? formatVND(Number(activeSession.totalAmount) || 0) : '';

  const handlePrimaryAction = () => {
    if (isBusy) return;
    if (isReservedHold) onNavigate?.('detail', activeSession.eventId);
    else if (activeSession.orderCode) onNavigate?.('checkout', activeSession.orderCode);
  };

  const handleCancel = async () => {
    if (isBusy || isConfirming || (isReservedHold && isCheckoutInFlight(activeSession.eventId))) return;
    setIsBusy(true);
    try {
      if (isReservedHold) {
        const seatIds = (activeSession.seats || []).map((s) => s.id).filter(Boolean);
        let authFailed = false;
        await releaseSeats(user.id, seatIds, user.token).catch((err) => {
          if (err?.isAuthError) authFailed = true;
        });
        if (authFailed) return;
        clearReservation(activeSession.eventId);
        onOrdersChanged?.();
        toast.info('Đã hủy giữ chỗ và mở lại ghế thành công.');
      } else {
        try {
          await cancelOrder(activeSession.orderCode, user.token);
          clearReservationByOrderCode(activeSession.orderCode, activeSession.eventId);
          onOrdersChanged?.();
          toast.info(`Đã hủy đơn #${activeSession.orderCode} và mở lại ghế.`);
        } catch (err) {
          if (err?.isAuthError) return;
          toast.warning(err?.message || 'Không thể hủy đơn hàng ở trạng thái hiện tại.');
          await pullServerActiveSession(true);
          onOrdersChanged?.();
        }
      }
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div
      className={`ppb-wrap${isReservedHold ? ' ppb-hold' : ''}`}
      role="region"
      aria-label={isReservedHold ? 'Phiên giữ chỗ đang hoạt động' : 'Phiên thanh toán chưa hoàn tất'}
    >
      <div className="ppb-inner">
        <div className="ppb-info">
          <div className="ppb-icon">{isReservedHold ? <Clock size={18} /> : <CreditCard size={18} />}</div>
          <div className="ppb-text">
            <div className="ppb-title-row">
              <span>
                {isReservedHold
                  ? `Đang giữ ${activeSession.seats?.length || 0} vé —`
                  : isConfirming
                    ? `Đơn #${activeSession.orderCode} đang xác nhận giao dịch...`
                    : `Đơn #${activeSession.orderCode} đang chờ thanh toán`}
              </span>
              {activeSession.eventTitle && (
                <button
                  type="button"
                  onClick={() => onNavigate?.('detail', activeSession.eventId)}
                  className="ppb-link-btn"
                >
                  {activeSession.eventTitle}
                </button>
              )}
              <span className="ppb-timer">
                <Timer size={12} /> {formatCountdown(secondsLeft)}
              </span>
            </div>
            <div className="ppb-sub">
              {[seatSummary && `Vị trí: ${seatSummary}`, amountText && `Tổng: ${amountText}`].filter(Boolean).join(' • ')}
            </div>
          </div>
        </div>

        <div className="ppb-actions">
          {!isConfirming && (
            <button type="button" onClick={handleCancel} disabled={isBusy} className="ppb-cancel-btn">
              <X size={14} /> {isReservedHold ? 'Hủy giữ chỗ' : 'Hủy đơn'}
            </button>
          )}
          <button
            type="button"
            onClick={handlePrimaryAction}
            disabled={isBusy || isFinalDeadlinePassed}
            className="ppb-resume-btn"
          >
            <span>
              {isBusy
                ? 'Đang kiểm tra...'
                : isReservedHold
                  ? 'Đến bước thanh toán'
                  : isConfirming
                    ? 'Xem trạng thái'
                    : 'Tiếp tục thanh toán'}
            </span>
            <ArrowRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
