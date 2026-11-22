import { useCallback, useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import {
  cancelOrder,
  fetchOrderPayment,
  subscribeOrderEvents,
} from '../services/eventService';
import {
  RESERVATION_CHANGED_EVENT,
  RESERVATION_STORAGE_PREFIX,
  clearReservation,
} from '../utils/paymentSession.js';

const TERMINAL_STATUSES = new Set([
  'SUCCESS',
  'CANCELLED',
  'EXPIRED',
  'FAILED',
  'REFUND_PENDING',
  'REFUNDED',
]);

function clearReservationForOrder(orderCode, eventId) {
  if (eventId) {
    clearReservation(eventId);
  }
  if (typeof localStorage === 'undefined' || !orderCode) return;

  const targetCode = Number(orderCode);
  const matchingEventIds = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(RESERVATION_STORAGE_PREFIX)) continue;
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || 'null');
      if (parsed && Number(parsed.orderCode) === targetCode) {
        matchingEventIds.push(key.slice(RESERVATION_STORAGE_PREFIX.length));
      }
    } catch {
      // Bỏ qua record lỗi
    }
  }
  matchingEventIds.forEach((evId) => clearReservation(evId));
}

function normalizeInitialCheckoutData(initialCheckoutData, orderCode) {
  if (!initialCheckoutData) return null;
  if (Number(initialCheckoutData.orderCode) !== Number(orderCode)) return null;
  if (!initialCheckoutData.paymentInfo?.qrCode) return null;
  return {
    ...initialCheckoutData,
    orderCode: Number(initialCheckoutData.orderCode),
    status: initialCheckoutData.status || 'PAYMENT_PROCESSING',
    phase: initialCheckoutData.phase || 'WAITING',
  };
}

export function useOrderCheckout({
  orderCode,
  user,
  initialCheckoutData = null,
  onOrderUpdated,
}) {
  const token = user?.token || null;
  const initialOrder = normalizeInitialCheckoutData(initialCheckoutData, orderCode);

  const [order, setOrder] = useState(() => initialOrder);
  const [serverOffsetMs, setServerOffsetMs] = useState(() => {
    if (!initialOrder?.serverTime) return 0;
    const srvMs = new Date(initialOrder.serverTime).getTime();
    return Number.isFinite(srvMs) ? srvMs - Date.now() : 0;
  });
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [isLoading, setIsLoading] = useState(() => Boolean(token && !initialOrder));
  const [loadError, setLoadError] = useState(null);
  const [authExpired, setAuthExpired] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [sseConnected, setSseConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const callbacksRef = useRef({ onOrderUpdated });
  const inFlightPromiseRef = useRef(null);
  const hiddenAtRef = useRef(null);
  const terminalNotifiedRef = useRef(null);
  const confettiFiredRef = useRef(false);
  const milestonesRef = useRef({
    last10s: false,
    confirmingStart: false,
    confirmingMid: false,
    settle: false,
  });

  useEffect(() => {
    callbacksRef.current = { onOrderUpdated };
  });

  const applyServerOrder = useCallback(
    (nextOrder) => {
      if (!nextOrder) return null;

      if (nextOrder.serverTime) {
        const srvMs = new Date(nextOrder.serverTime).getTime();
        if (Number.isFinite(srvMs)) {
          setServerOffsetMs(srvMs - Date.now());
        }
      }

      setOrder((prev) => {
        const mergedItems = Array.isArray(nextOrder.items)
          ? nextOrder.items
          : prev?.items || [];
        return {
          ...(prev || {}),
          ...nextOrder,
          items: mergedItems,
        };
      });

      setIsLoading(false);
      setLoadError(null);
      setIsReconnecting(false);

      const st = nextOrder.status;
      if (st && TERMINAL_STATUSES.has(st)) {
        clearReservationForOrder(nextOrder.orderCode || orderCode, nextOrder.eventId);

        if (terminalNotifiedRef.current !== st) {
          terminalNotifiedRef.current = st;
          callbacksRef.current.onOrderUpdated?.(nextOrder);
        }

        if (st === 'SUCCESS' && !confettiFiredRef.current) {
          confettiFiredRef.current = true;
          try {
            confetti({ particleCount: 150, spread: 90, origin: { y: 0.6 } });
          } catch {
            // Bỏ qua lỗi animation trên môi trường headless
          }
        }
      }

      return nextOrder;
    },
    [orderCode],
  );

  const loadOrderPayment = useCallback(
    async ({ sync = false } = {}) => {
      if (!token || !orderCode) return null;
      if (inFlightPromiseRef.current && (inFlightPromiseRef.current.sync || !sync)) {
        return inFlightPromiseRef.current.promise;
      }

      const reqPromise = (async () => {
        try {
          const data = await fetchOrderPayment(orderCode, token, { sync });
          return applyServerOrder(data);
        } catch (err) {
          if (err?.status === 401 || err?.status === 403) {
            setAuthExpired(true);
            setIsLoading(false);
            setSseConnected(false);
            return null;
          }
          if (err?.status === 404 || err?.status === 400) {
            setNotFound(true);
            setLoadError(err.message || 'Không tìm thấy đơn hàng.');
            setIsLoading(false);
            return null;
          }

          setIsReconnecting(true);
          setOrder((prev) => {
            if (!prev) {
              setLoadError(err.message || 'Không thể tải thông tin đơn hàng.');
              setIsLoading(false);
            }
            return prev;
          });
          return null;
        } finally {
          if (inFlightPromiseRef.current?.promise === reqPromise) {
            inFlightPromiseRef.current = null;
          }
        }
      })();

      inFlightPromiseRef.current = { promise: reqPromise, sync };
      return reqPromise;
    },
    [orderCode, token, applyServerOrder],
  );

  const orderStatus = order?.status || null;
  const isTerminal = Boolean(orderStatus && TERMINAL_STATUSES.has(orderStatus));

  // Tính mốc thời gian theo đồng hồ server để tránh lệch giờ client
  const effectiveNowMs = nowMs + serverOffsetMs;
  const expiresAtRaw = order?.expiresAt || order?.paymentTimeout || null;
  const expiresAtMs = expiresAtRaw ? new Date(expiresAtRaw).getTime() : NaN;
  const confirmUntilRaw = order?.confirmUntil || null;
  const confirmUntilMs = confirmUntilRaw
    ? new Date(confirmUntilRaw).getTime()
    : Number.isFinite(expiresAtMs)
      ? expiresAtMs + 30 * 1000
      : NaN;

  const waitingSecondsLeft = Number.isFinite(expiresAtMs)
    ? Math.max(0, Math.ceil((expiresAtMs - effectiveNowMs) / 1000))
    : 0;
  const confirmingSecondsLeft = Number.isFinite(confirmUntilMs)
    ? Math.max(0, Math.ceil((confirmUntilMs - effectiveNowMs) / 1000))
    : 0;

  let uiState = 'LOADING';
  if (!token) {
    uiState = 'AUTH_REQUIRED';
  } else if (authExpired) {
    uiState = 'AUTH_EXPIRED';
  } else if (notFound) {
    uiState = 'NOT_FOUND';
  } else if (!order && isLoading) {
    uiState = 'LOADING';
  } else if (!order && loadError) {
    uiState = 'NOT_FOUND';
  } else if (orderStatus === 'SUCCESS') {
    uiState = 'SUCCESS';
  } else if (orderStatus === 'REFUND_PENDING' || orderStatus === 'REFUNDED') {
    uiState = 'REFUND_PENDING';
  } else if (orderStatus === 'CANCELLED') {
    uiState = 'CANCELLED';
  } else if (orderStatus === 'EXPIRED' || orderStatus === 'FAILED') {
    uiState = 'EXPIRED';
  } else if (Number.isFinite(expiresAtMs) && effectiveNowMs >= expiresAtMs) {
    uiState = 'CONFIRMING';
  } else {
    uiState = 'WAITING';
  }

  // 1. Nạp dữ liệu chuẩn từ DB ngay khi mở trang (hỗ trợ F5 hoặc mở từ banner)
  useEffect(() => {
    if (!token || !orderCode) return undefined;
    const timer = setTimeout(() => {
      loadOrderPayment({ sync: false });
    }, 0);
    return () => clearTimeout(timer);
  }, [token, orderCode, loadOrderPayment]);

  // 2. Đồng hồ 1s tính bằng hiệu thời gian thật + cập nhật ngay khi quay lại tab
  useEffect(() => {
    if (!token || !orderCode || authExpired || notFound || isTerminal) return undefined;

    const tickTimer = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    const handleVisibilityChange = () => {
      if (document.hidden) {
        hiddenAtRef.current = Date.now();
      } else {
        setNowMs(Date.now());
        const hiddenDuration = hiddenAtRef.current ? Date.now() - hiddenAtRef.current : 0;
        hiddenAtRef.current = null;
        if (hiddenDuration >= 3000) {
          loadOrderPayment({ sync: true });
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      clearInterval(tickTimer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [token, orderCode, authExpired, notFound, isTerminal, loadOrderPayment]);

  // 3. Kết nối SSE stream + tự reconnect theo exponential backoff (1s -> 2s -> 4s -> 8s)
  useEffect(() => {
    if (!token || !orderCode || authExpired || notFound || isTerminal) return undefined;

    let disposed = false;
    let activeController = null;
    let reconnectTimer = null;
    let attempt = 0;

    const connect = () => {
      if (disposed) return;
      activeController = new AbortController();

      subscribeOrderEvents(orderCode, token, {
        signal: activeController.signal,
        onOpen: () => {
          attempt = 0;
          setSseConnected(true);
          setIsReconnecting(false);
        },
        onInit: (payload) => {
          if (payload?.order) {
            applyServerOrder(payload.order);
          } else if (payload?.serverTime) {
            const srvMs = new Date(payload.serverTime).getTime();
            if (Number.isFinite(srvMs)) setServerOffsetMs(srvMs - Date.now());
          }
        },
        onStatusChanged: (payload) => {
          if (payload?.order) {
            applyServerOrder(payload.order);
          } else {
            loadOrderPayment({ sync: false });
          }
        },
        onAuthError: () => {
          setSseConnected(false);
          setAuthExpired(true);
          setIsLoading(false);
        },
        onNotFound: (err) => {
          setSseConnected(false);
          setNotFound(true);
          setLoadError(err?.message || 'Không tìm thấy đơn hàng.');
          setIsLoading(false);
        },
        onError: () => {
          if (disposed) return;
          setSseConnected(false);
          setIsReconnecting(true);
          const delayMs = Math.min(8000, 1000 * 2 ** attempt);
          attempt += 1;
          reconnectTimer = setTimeout(connect, delayMs);
        },
      });
    };

    connect();

    return () => {
      disposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (activeController) activeController.abort();
    };
  }, [token, orderCode, authExpired, notFound, isTerminal, applyServerOrder, loadOrderPayment]);

  // 4. Fallback DB-only polling thích ứng (3s khi mất SSE, 12s khi SSE đang mở)
  useEffect(() => {
    if (!token || !orderCode || authExpired || notFound || isTerminal) return undefined;
    const intervalMs = sseConnected ? 12000 : 3000;
    const pollTimer = setInterval(() => {
      loadOrderPayment({ sync: false });
    }, intervalMs);
    return () => clearInterval(pollTimer);
  }, [token, orderCode, authExpired, notFound, isTerminal, sseConnected, loadOrderPayment]);

  // 5. Tự động đối soát PayOS (?sync=1) ở các mốc quan trọng (BE tự throttle 10s)
  useEffect(() => {
    if (!token || !orderCode || authExpired || notFound || isTerminal || !order) return undefined;

    let milestoneKey = null;
    if (uiState === 'WAITING' && waitingSecondsLeft > 0 && waitingSecondsLeft <= 10) {
      if (!milestonesRef.current.last10s) {
        milestoneKey = 'last10s';
      }
    } else if (uiState === 'CONFIRMING') {
      if (!milestonesRef.current.confirmingStart) {
        milestoneKey = 'confirmingStart';
      } else if (confirmingSecondsLeft <= 15 && !milestonesRef.current.confirmingMid) {
        milestoneKey = 'confirmingMid';
      } else if (
        Number.isFinite(confirmUntilMs) &&
        effectiveNowMs >= confirmUntilMs + 2000 &&
        !milestonesRef.current.settle
      ) {
        milestoneKey = 'settle';
      }
    }

    if (!milestoneKey) return undefined;
    const timer = setTimeout(() => {
      milestonesRef.current[milestoneKey] = true;
      loadOrderPayment({ sync: true });
    }, 0);
    return () => clearTimeout(timer);
  }, [
    token,
    orderCode,
    authExpired,
    notFound,
    isTerminal,
    order,
    uiState,
    waitingSecondsLeft,
    confirmingSecondsLeft,
    confirmUntilMs,
    effectiveNowMs,
    loadOrderPayment,
  ]);

  // 6. Đồng bộ đa tab qua storage event & RESERVATION_CHANGED_EVENT
  useEffect(() => {
    if (!token || !orderCode || authExpired || notFound || isTerminal) return undefined;

    const handleStorageOrReservation = (e) => {
      if (e?.type === 'storage' && e.key && !e.key.startsWith(RESERVATION_STORAGE_PREFIX)) {
        return;
      }
      loadOrderPayment({ sync: false });
    };

    window.addEventListener('storage', handleStorageOrReservation);
    window.addEventListener(RESERVATION_CHANGED_EVENT, handleStorageOrReservation);
    return () => {
      window.removeEventListener('storage', handleStorageOrReservation);
      window.removeEventListener(RESERVATION_CHANGED_EVENT, handleStorageOrReservation);
    };
  }, [token, orderCode, authExpired, notFound, isTerminal, loadOrderPayment]);

  const cancelCurrentOrder = useCallback(async () => {
    if (!token || !orderCode || isCancelling || uiState !== 'WAITING') {
      return { ok: false, message: 'Không thể hủy đơn hàng ở trạng thái hiện tại.' };
    }

    setIsCancelling(true);
    try {
      await cancelOrder(orderCode, token);
      const latest = await loadOrderPayment({ sync: false });
      return { ok: true, order: latest };
    } catch (err) {
      // Nếu race condition (409 do vừa SUCCESS hoặc vừa vào CONFIRMING), đồng bộ lại ngay trạng thái thật
      const latest = await loadOrderPayment({ sync: false });
      return {
        ok: false,
        conflict: err?.status === 409,
        message: err?.message || 'Không thể hủy đơn hàng.',
        order: latest,
      };
    } finally {
      setIsCancelling(false);
    }
  }, [token, orderCode, isCancelling, uiState, loadOrderPayment]);

  return {
    order,
    uiState,
    isLoading,
    loadError,
    waitingSecondsLeft,
    confirmingSecondsLeft,
    sseConnected,
    isReconnecting,
    isCancelling,
    cancelCurrentOrder,
  };
}
