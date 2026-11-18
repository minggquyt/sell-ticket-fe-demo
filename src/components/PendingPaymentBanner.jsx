import { useCallback, useEffect, useRef, useState } from 'react';
import { CreditCard, Clock, Timer, ArrowRight, X } from 'lucide-react';
import {
  cancelOrder,
  fetchMyActiveSession,
  fetchOrderStatus,
  releaseSeats,
} from '../services/eventService';
import { formatVND } from '../utils/format.js';
import {
  RESERVATION_CHANGED_EVENT,
  clearReservation,
  formatCountdown,
  formatSeatSummary,
  getActiveSessions,
  readReservation,
  saveReservation,
  syncServerReservationToStorage,
} from '../utils/paymentSession.js';
import { useToast } from './toastContext.js';
import './PendingPaymentBanner.css';

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
          serverSyncRef.current.verifiedKey = `${serverSession.step}:${serverSession.orderCode || ''}:${serverSession.reservedUntil}`;
          serverSyncRef.current.verifiedAt = Date.now();
          const saved = syncServerReservationToStorage(userId, serverSession);
          setCandidate(saved);
          setActiveSession(saved);
          return;
        }

        const locals = getActiveSessions(userId);
        const localProcessing = locals.find((s) => s.step === 'PAYMENT_PROCESSING' && s.orderCode);
        locals
          .filter((s) => s.step === 'RESERVED')
          .forEach((s) => clearReservation(s.eventId));

        if (localProcessing) {
          const orderData = await fetchOrderStatus(localProcessing.orderCode, token).catch(() => null);
          clearReservation(localProcessing.eventId);
          const { toast: liveToast, onOrdersChanged: notifyOrders } = callbacksRef.current;
          notifyOrders?.();
          if (orderData?.status === 'SUCCESS') {
            liveToast.success(`Đơn #${orderData.orderCode} đã thanh toán thành công!`);
          } else if (orderData?.status === 'REFUND_PENDING') {
            liveToast.warning(`Đơn #${orderData.orderCode} đã chuyển sang Chờ hoàn tiền!`);
          }
        }
        setCandidate(null);
        setActiveSession(null);
      } catch {
        const fallback = getActiveSessions(userId)[0] || null;
        if (fallback) setActiveSession(fallback);
      }
    },
    [user?.id, user?.token],
  );

  // Kéo phiên từ Backend khi mở lại web / đổi tài khoản / quay lại tab
  useEffect(() => {
    if (!user?.id || !user?.token) return undefined;
    const initTimer = setTimeout(() => {
      pullServerActiveSession(true);
    }, 0);
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        pullServerActiveSession(false);
      }
    };
    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    return () => {
      clearTimeout(initTimer);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
    };
  }, [user?.id, user?.token, pullServerActiveSession]);

  // Lắng nghe thay đổi localStorage cùng tab & khác tab
  useEffect(() => {
    const syncCandidate = () => {
      const next = getActiveSessions(user?.id)[0] || null;
      setCandidate((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
      if (!next) setActiveSession(null);
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

  // Xác thực phiên local với Backend khi cần
  useEffect(() => {
    if (!candidate || !user?.token) return undefined;
    let cancelled = false;

    if (candidate.step === 'RESERVED') {
      const timer = setTimeout(() => {
        if (!cancelled) setActiveSession(candidate);
      }, 0);
      return () => {
        cancelled = true;
        clearTimeout(timer);
      };
    }

    const candidateKey = `${candidate.step}:${candidate.orderCode || ''}:${candidate.reservedUntil}`;
    const recentlyVerified =
      serverSyncRef.current.verifiedKey === candidateKey &&
      Date.now() - serverSyncRef.current.verifiedAt < 4000;
    if (recentlyVerified) {
      const timer = setTimeout(() => {
        if (!cancelled) setActiveSession(candidate);
      }, 0);
      return () => {
        cancelled = true;
        clearTimeout(timer);
      };
    }

    fetchOrderStatus(candidate.orderCode, user.token)
      .then((orderData) => {
        if (cancelled) return;
        const { toast: liveToast, onOrdersChanged: notifyOrders } = callbacksRef.current;
        const st = orderData?.status;
        if (st === 'SUCCESS') {
          clearReservation(candidate.eventId);
          notifyOrders?.();
          liveToast.success(`Đơn #${orderData.orderCode} đã thanh toán thành công! Vé đã lưu vào Lịch sử đặt vé.`);
          return;
        }
        if (st === 'REFUND_PENDING') {
          clearReservation(candidate.eventId);
          notifyOrders?.();
          liveToast.warning(`Đơn #${orderData.orderCode} thanh toán muộn. Đã chuyển sang Chờ hoàn tiền!`);
          return;
        }
        if (st !== 'PAYMENT_PROCESSING') {
          clearReservation(candidate.eventId);
          notifyOrders?.();
          return;
        }

        const serverExpiry = orderData.expiresAt || candidate.reservedUntil;
        if (new Date(serverExpiry).getTime() <= Date.now()) {
          clearReservation(candidate.eventId);
          notifyOrders?.();
          return;
        }

        const nextSession = {
          ...candidate,
          eventTitle: orderData.eventTitle || candidate.eventTitle,
          checkoutUrl: orderData.checkoutUrl || candidate.checkoutUrl || null,
          totalAmount: orderData.totalAmount ?? candidate.totalAmount,
          reservedUntil: serverExpiry,
        };
        if (nextSession.checkoutUrl && nextSession.checkoutUrl !== candidate.checkoutUrl) {
          saveReservation(candidate.eventId, nextSession, { silent: true });
        }
        setActiveSession(nextSession);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err?.message?.includes('Không tìm thấy')) {
          clearReservation(candidate.eventId);
          return;
        }
        setActiveSession(candidate);
      });

    return () => {
      cancelled = true;
    };
  }, [candidate, user?.token]);

  // Đồng bộ theo vòng lặp polling 10s của AppShell (phát hiện đơn mới từ thiết bị khác hoặc đơn đã hoàn tất)
  useEffect(() => {
    if (!user?.token || !Array.isArray(orders) || orders.length === 0) return undefined;

    if (activeSession?.step === 'PAYMENT_PROCESSING' && activeSession.orderCode) {
      const matched = orders.find((o) => String(o.orderCode) === String(activeSession.orderCode));
      if (matched) {
        const st = matched.status || matched.orderStatus;
        if (st && st !== 'PAYMENT_PROCESSING') {
          const timer = setTimeout(() => {
            clearReservation(activeSession.eventId);
            const { toast: liveToast } = callbacksRef.current;
            if (st === 'SUCCESS') {
              liveToast.success(`Đơn #${activeSession.orderCode} đã thanh toán thành công!`);
            } else if (st === 'REFUND_PENDING') {
              liveToast.warning(`Đơn #${activeSession.orderCode} đã chuyển sang Chờ hoàn tiền!`);
            }
          }, 0);
          return () => clearTimeout(timer);
        }
      }
      return undefined;
    }

    const serverProcessing = orders.find((o) => {
      const st = o.status || o.orderStatus;
      if (st !== 'PAYMENT_PROCESSING') return false;
      return !o.expiresAt || new Date(o.expiresAt).getTime() > Date.now();
    });
    if (serverProcessing) {
      const timer = setTimeout(() => {
        pullServerActiveSession(false);
      }, 0);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [orders, activeSession, user?.token, pullServerActiveSession]);

  // Đồng hồ đếm ngược 1s
  useEffect(() => {
    if (!activeSession?.reservedUntil) return undefined;
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [activeSession?.reservedUntil]);

  const secondsLeft = activeSession
    ? Math.max(0, Math.floor((new Date(activeSession.reservedUntil).getTime() - nowMs) / 1000))
    : 0;

  // Khi hết hạn phiên trên banner: xác thực lại lần cuối rồi hủy / nhả ghế
  useEffect(() => {
    if (!activeSession || secondsLeft > 0 || !user?.token) return undefined;
    const expiryKey = `${activeSession.step}:${activeSession.orderCode || activeSession.eventId}:${activeSession.reservedUntil}`;
    if (expiredKeyRef.current === expiryKey) return undefined;
    expiredKeyRef.current = expiryKey;
    let didRun = false;

    const timer = setTimeout(async () => {
      didRun = true;
      if (!readReservation(activeSession.eventId)) return;

      if (activeSession.step === 'RESERVED') {
        const seatIds = (activeSession.seats || []).map((s) => s.id).filter(Boolean);
        await releaseSeats(user.id, seatIds, user.token).catch(() => {});
        clearReservation(activeSession.eventId);
        callbacksRef.current.onOrdersChanged?.();
        callbacksRef.current.toast.warning(
          `Hết thời gian giữ ghế${activeSession.eventTitle ? ` (${activeSession.eventTitle})` : ''}. Các ghế đã được mở lại!`,
        );
        return;
      }

      let outcome = 'EXPIRED';
      try {
        const orderData = await fetchOrderStatus(activeSession.orderCode, user.token).catch(() => null);
        if (orderData?.status === 'SUCCESS') {
          outcome = 'SUCCESS';
        } else if (orderData?.status === 'REFUND_PENDING') {
          outcome = 'REFUND_PENDING';
        } else {
          await cancelOrder(activeSession.orderCode, user.token).catch(() => {});
        }
      } finally {
        clearReservation(activeSession.eventId);
        const { toast: liveToast, onOrdersChanged: notifyOrders } = callbacksRef.current;
        notifyOrders?.();
        if (outcome === 'SUCCESS') {
          liveToast.success(`Đơn #${activeSession.orderCode} đã thanh toán thành công!`);
        } else if (outcome === 'REFUND_PENDING') {
          liveToast.warning(`Đơn #${activeSession.orderCode} đã chuyển sang Chờ hoàn tiền!`);
        } else {
          liveToast.warning(`Phiên thanh toán đơn #${activeSession.orderCode} đã hết hạn. Ghế đã được mở lại!`);
        }
      }
    }, 0);

    return () => {
      clearTimeout(timer);
      if (!didRun && expiredKeyRef.current === expiryKey) {
        expiredKeyRef.current = null;
      }
    };
  }, [activeSession, secondsLeft, user?.id, user?.token]);

  if (!user || !activeSession) return null;
  if (
    activeSession.step === 'RESERVED' &&
    activeEventId &&
    String(activeEventId) === String(activeSession.eventId)
  ) {
    return null;
  }

  const isReservedHold = activeSession.step === 'RESERVED';
  const seatSummary = formatSeatSummary(activeSession.seats);
  const amountText =
    activeSession.totalAmount != null ? formatVND(Number(activeSession.totalAmount) || 0) : '';

  const handlePrimaryAction = async () => {
    if (isBusy) return;
    if (isReservedHold) {
      onNavigate?.('detail', activeSession.eventId);
      return;
    }

    setIsBusy(true);
    let redirecting = false;
    try {
      const orderData = await fetchOrderStatus(activeSession.orderCode, user.token);
      if (orderData?.status === 'SUCCESS') {
        clearReservation(activeSession.eventId);
        onOrdersChanged?.();
        toast.success(`Đơn #${orderData.orderCode} đã thanh toán thành công!`);
        onNavigate?.('my-tickets');
        return;
      }
      if (orderData?.status === 'REFUND_PENDING') {
        clearReservation(activeSession.eventId);
        onOrdersChanged?.();
        toast.warning(`Đơn #${orderData.orderCode} thanh toán muộn. Đã chuyển sang Chờ hoàn tiền!`);
        onNavigate?.('my-tickets');
        return;
      }
      if (orderData?.status !== 'PAYMENT_PROCESSING') {
        clearReservation(activeSession.eventId);
        onOrdersChanged?.();
        toast.warning(`Đơn #${activeSession.orderCode} đã hết hạn hoặc bị hủy.`);
        return;
      }
      const serverExpiry = orderData.expiresAt || activeSession.reservedUntil;
      if (new Date(serverExpiry).getTime() <= Date.now()) {
        await cancelOrder(activeSession.orderCode, user.token).catch(() => {});
        clearReservation(activeSession.eventId);
        onOrdersChanged?.();
        toast.warning(`Phiên thanh toán đơn #${activeSession.orderCode} đã hết hạn.`);
        return;
      }

      const targetUrl = orderData.checkoutUrl || activeSession.checkoutUrl;
      if (!targetUrl) {
        onNavigate?.('detail', activeSession.eventId);
        return;
      }
      redirecting = true;
      window.location.href = targetUrl;
    } catch (err) {
      toast.error(err.message || 'Không thể tiếp tục phiên thanh toán.');
    } finally {
      if (!redirecting) setIsBusy(false);
    }
  };

  const handleCancel = async () => {
    if (isBusy) return;
    setIsBusy(true);
    try {
      if (isReservedHold) {
        const seatIds = (activeSession.seats || []).map((s) => s.id).filter(Boolean);
        await releaseSeats(user.id, seatIds, user.token).catch(() => {});
        clearReservation(activeSession.eventId);
        onOrdersChanged?.();
        toast.info('Đã hủy giữ chỗ và mở lại ghế thành công.');
      } else {
        await cancelOrder(activeSession.orderCode, user.token).catch(() => {});
        clearReservation(activeSession.eventId);
        onOrdersChanged?.();
        toast.info(`Đã hủy đơn #${activeSession.orderCode} và mở lại ghế.`);
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
          <div className="ppb-icon">
            {isReservedHold ? <Clock size={18} /> : <CreditCard size={18} />}
          </div>
          <div className="ppb-text">
            <div className="ppb-title-row">
              <span>
                {isReservedHold
                  ? `Đang giữ ${activeSession.seats?.length || 0} vé —`
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
              {[seatSummary && `Vị trí: ${seatSummary}`, amountText && `Tổng: ${amountText}`]
                .filter(Boolean)
                .join(' • ')}
            </div>
          </div>
        </div>

        <div className="ppb-actions">
          <button
            type="button"
            onClick={handleCancel}
            disabled={isBusy}
            className="ppb-cancel-btn"
          >
            <X size={14} /> {isReservedHold ? 'Hủy giữ chỗ' : 'Hủy đơn'}
          </button>
          <button
            type="button"
            onClick={handlePrimaryAction}
            disabled={isBusy || secondsLeft <= 0}
            className="ppb-resume-btn"
          >
            <span>
              {isBusy
                ? 'Đang kiểm tra...'
                : isReservedHold
                  ? 'Đến bước thanh toán'
                  : 'Tiếp tục thanh toán'}
            </span>
            <ArrowRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
