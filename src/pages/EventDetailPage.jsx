import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Clock,
  ShieldCheck,
  Info,
  Armchair,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Ticket,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  formatEventDate,
  formatEventTime,
  isSeatedEvent,
  getEventVenue,
  getMinPrice,
  getSingleSeatTier,
  isUpcomingEvent,
  MAX_TICKETS_PER_ORDER,
} from '../data/events';
import {
  cancelOrder,
  fetchSeatsByEvent,
  holdSeats,
  holdZones,
  startCheckout,
  releaseSeats,
  fetchOrderPayment,
  fetchMyActiveSession,
  confirmPartialHoldSeats
} from '../services/eventService';
import { formatVND } from '../utils/format.js';
import PartialHoldModal from '../components/PartialHoldModal.jsx';
import {
  RESERVATION_CHANGED_EVENT,
  clearAllReservations,
  clearCheckoutInFlight,
  clearOtherUserReservations,
  clearReservation,
  clearReservationByOrderCode,
  computeServerOffsetMs,
  formatCountdown,
  getActiveSessions,
  getReservationSeatsKey,
  getSessionEffectiveExpiryMs,
  getSessionWaitingExpiryMs,
  hasSeatReservationMismatch,
  isCheckoutInFlight,
  isReservationStorageEvent,
  markCheckoutInFlight,
  pruneStaleReservations,
  readReservation,
  saveReservation,
  syncOrderPaymentToStorage,
  syncServerReservationToStorage,
  updateReservationPhaseIfNeeded,
} from '../utils/paymentSession.js';
import { deriveSeatLayout } from '../utils/seatLayout.js';
import { isJwtExpired, notifyAuthExpired, readStoredUser } from '../utils/authSession.js';
import { useToast } from '../components/toastContext.js';
import SeatSelector from '../components/SeatSelector.jsx';
import ZoneSelector from '../components/ZoneSelector.jsx';
import BookingSummary from '../components/BookingSummary.jsx';
import './EventDetailPage.css';

// Hàm hỗ trợ gán màu sắc đẹp mắt cho từng zone dựa theo tên
const getZoneColor = (name) => {
  const upper = (name || '').toUpperCase();
  if (upper.includes('VIP')) return '#ec4899'; // Hồng
  if (upper.includes('REGULAR') || upper.includes('STD')) return '#3b82f6'; // Xanh dương
  return '#10b981'; // Xanh lá mặc định
};

const resolveSessionUiState = (session, fallbackOffsetMs = 0) => {
  const offset = session?.serverTime
    ? computeServerOffsetMs(session.serverTime, 0)
    : Number.isFinite(Number(session?.serverOffsetMs))
      ? Number(session.serverOffsetMs)
      : fallbackOffsetMs;
  if (session.step !== 'PAYMENT_PROCESSING') {
    return { offset, reservedUntilTime: session.reservedUntil, pendingPayment: null };
  }
  const nowWithOffset = Date.now() + offset;
  const waitingMs = getSessionWaitingExpiryMs(session);
  const confirmMs = getSessionEffectiveExpiryMs(session);
  const isConfirming =
    session.phase === 'CONFIRMING' ||
    (Number.isFinite(waitingMs) &&
      nowWithOffset >= waitingMs &&
      Number.isFinite(confirmMs) &&
      nowWithOffset < confirmMs);
  const exp = session.expiresAt || session.reservedUntil;
  return {
    offset,
    reservedUntilTime: isConfirming && session.confirmUntil ? session.confirmUntil : exp,
    pendingPayment: {
      orderCode: Number(session.orderCode),
      totalAmount: session.totalAmount ?? null,
      reservedUntil: exp,
      expiresAt: exp,
      confirmUntil: session.confirmUntil || null,
      phase: isConfirming ? 'CONFIRMING' : 'WAITING',
    },
  };
};

export default function EventDetailPage({
  event,
  user,
  occupiedSeats: initialOccupiedSeats,
  zoneRemaining: initialZoneRemaining,
  isUpcoming: propIsUpcoming,
  isUpComing: propIsUpComing,
  onPaymentSuccess,
  onBack,
  onRequireLogin,
  onClaimAccount,
  onAddToCart,
  onOpenCart,
  onRefreshOrders,
}) {
  const toast = useToast();
  const navigate = useNavigate();
  const isSeated = isSeatedEvent(event);
  const baseSingleSeatTier = getSingleSeatTier(event);
  const eventVenue = getEventVenue(event);
  const eventDate = formatEventDate(event);
  const eventTime = formatEventTime(event) || event?.time || '';

  // Xác định sự kiện sắp diễn ra / chưa mở bán vé
  const isUpcoming =
    propIsUpcoming !== undefined
      ? Boolean(propIsUpcoming)
      : propIsUpComing !== undefined
        ? Boolean(propIsUpComing)
        : isUpcomingEvent(event);

  const [activeTab, setActiveTab] = useState('booking');
  // 'booking' | 'payment' | 'success'
  const [bookingStep, setBookingStep] = useState('booking');
  // Thông tin đơn hàng đã xác thực thanh toán thành công từ Backend
  const [paidOrderInfo, setPaidOrderInfo] = useState(null);
  // Phiên thanh toán đang dở còn hạn được khôi phục lại (cho phép bấm Tiếp tục thanh toán)
  const [pendingPayment, setPendingPayment] = useState(null);
  const verifyingPendingRef = useRef(null);
  const activeGuest = {
    email: user?.email || '',
    fullName: user?.name || '',
  };

  // 1. Khi người dùng click vào nút Thanh toán trên giao diện giữ ghế
  const handlePrePaymentClick = () => {
    if (!user) {
      toast.info('Vui lòng đăng nhập để tiếp tục thanh toán.');
      onRequireLogin?.();
      return;
    }
    if (pendingPayment?.orderCode) {
      handleResumePendingPayment();
      return;
    }
    handlePayment();
  };

  // SEATED-BASED & GENERAL BOOKING STATE
  const [occupiedSeats, setOccupiedSeats] = useState(() =>
    initialOccupiedSeats ? new Set(initialOccupiedSeats) : new Set(),
  );
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [reservedZoneSeats, setReservedZoneSeats] = useState([]);
  const [backendZones, setBackendZones] = useState({});
  const [zoneRemaining, setZoneRemaining] = useState({});
  const [zoneQuantities, setZoneQuantities] = useState({});
  const [backendSeats, setBackendSeats] = useState([]);

  // Trạng thái quản lý việc đã giữ ghế thành công hay chưa
  const [isReserved, setIsReserved] = useState(false);
  // Danh sách ID ghế đã giữ thành công từ Backend (dùng cho cả SEAT_BASED và ZONE_BASED khi thanh toán)
  const [reservedSeatIds, setReservedSeatIds] = useState([]);
  // Thời điểm hết hạn giữ ghế (lấy từ trường reserved_until của server trả về)
  const [reservedUntilTime, setReservedUntilTime] = useState(null);
  // Đồng hồ wall-clock & độ lệch giờ so với server
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [serverOffsetMs, setServerOffsetMs] = useState(0);
  // Trạng thái xử lý thanh toán
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const isProcessingPaymentRef = useRef(false);
  const expiryHandledRef = useRef(null);
  // Trạng thái đang gửi request giữ ghế (chống race / spam click)
  const [isReserving, setIsReserving] = useState(false);
  const isReservingRef = useRef(false);
  const reservationMutationSeqRef = useRef(0);
  const reconcileServerRef = useRef(null);
  // Phiên giữ chỗ / thanh toán đang hoạt động ở sự kiện khác (nếu có)
  const [otherEventSession, setOtherEventSession] = useState(null);
  const effectiveNowMs = nowMs + serverOffsetMs;
  const reservedExpiryMs = reservedUntilTime ? new Date(reservedUntilTime).getTime() : NaN;
  const countdownSeconds = Number.isFinite(reservedExpiryMs)
    ? Math.max(0, Math.ceil((reservedExpiryMs - effectiveNowMs) / 1000))
    : 0;
  const currentSeatKey = useMemo(
    () => getReservationSeatsKey(isSeated ? selectedSeats : reservedZoneSeats),
    [isSeated, selectedSeats, reservedZoneSeats],
  );

  const [partialHoldPrompt, setPartialHoldPrompt] = useState(null);
  const [isConfirmingPartial, setIsConfirmingPartial] = useState(false);

  const reservedStateRef = useRef({
    isReserved: false,
    step: null,
    reservedUntilTime: null,
    expiresAt: null,
    confirmUntil: null,
    phase: null,
    pendingOrderCode: null,
    seatKey: '',
    userId: null,
  });
  const latestRef = useRef({});
  useEffect(() => {
    reservedStateRef.current = {
      isReserved,
      step: pendingPayment?.orderCode ? 'PAYMENT_PROCESSING' : isReserved ? 'RESERVED' : null,
      reservedUntilTime,
      expiresAt: pendingPayment?.expiresAt || null,
      confirmUntil: pendingPayment?.confirmUntil || null,
      phase: pendingPayment?.phase || null,
      pendingOrderCode: pendingPayment?.orderCode || null,
      seatKey: currentSeatKey,
      userId: user?.id || null,
    };
  }, [
    isReserved,
    reservedUntilTime,
    pendingPayment?.orderCode,
    pendingPayment?.expiresAt,
    pendingPayment?.confirmUntil,
    pendingPayment?.phase,
    currentSeatKey,
    user?.id,
  ]);

  // Helper lấy token & userId an toàn ngay cả khi state user ở App chưa kịp mount
  const getAuthContext = () => {
    if (user?.token && user?.id) {
      return { token: user.token, userId: user.id };
    }
    const saved = readStoredUser();
    return {
      token: user?.token || saved?.token || null,
      userId: user?.id || saved?.id || null,
    };
  };

  const reloadBackendEventId = event?.id;
  const isBackendSeated = Boolean(event?.is_seated || event?.event_type === 'SEAT_BASED');
  const currentUserId = user?.id;

  // Hàm đồng bộ và tải lại danh sách ghế/khu vực từ Backend
  const reloadBackendSeats = useCallback(() => {
    if (!reloadBackendEventId) return;
    const reqSeq = reservationMutationSeqRef.current;

    fetchSeatsByEvent(reloadBackendEventId)
      .then((seats) => {
        if (!seats || seats.length === 0) return;
        // 1. Phân loại logic cho SEATED-BASED
        if (isBackendSeated) {
          setBackendSeats(seats);
          const occupied = seats
            .filter((s) => {
              if (s.status === 'SOLD') return true;
              if (s.status === 'RESERVED' || s.status === 'PAYMENT_PROCESSING') {
                // Nếu là ghế do chính tài khoản này đang giữ thì không hiển thị là đã bị chiếm
                const isMySeat = currentUserId && String(s.reserved_by) === String(currentUserId);
                if (isMySeat) return false;
                return true;
              }
              return false;
            })
            .map((s) => {
              const num = s.seat_number;
              return /^[A-G]\d+$/.test(num) ? `${num.charAt(0)}-${num.slice(1)}` : num;
            });
          setOccupiedSeats(new Set(occupied));
        }
        // 2. Phân loại logic cho ZONE-BASED
        else {
          const zoneMap = {};
          const remainingMap = {};

          seats.forEach((seat) => {
            const zoneName = seat.zone_name || 'STANDARD';
            const price = Number(seat.price) || 0;
            const isAvailable = seat.status === 'AVAILABLE';

            if (!zoneMap[zoneName]) {
              zoneMap[zoneName] = {
                name: zoneName,
                price: price,
                total: 0,
                remaining: 0,
                color: getZoneColor(zoneName),
              };
            }

            zoneMap[zoneName].total += 1;
            if (isAvailable) {
              zoneMap[zoneName].remaining += 1;
            }
          });

          setBackendZones(zoneMap);
          Object.keys(zoneMap).forEach((zName) => {
            remainingMap[zName] = zoneMap[zName].remaining;
          });
          setZoneRemaining(remainingMap);
        }

        // Đối chiếu live với localStorage nếu không có mutation giữ chỗ / thanh toán đang chạy
        if (
          currentUserId &&
          reqSeq === reservationMutationSeqRef.current &&
          !isReservingRef.current &&
          !isProcessingPaymentRef.current &&
          !isCheckoutInFlight(reloadBackendEventId)
        ) {
          const saved = readReservation(reloadBackendEventId);
          if (hasSeatReservationMismatch(seats, currentUserId, saved)) {
            const verifyOrderCode =
              saved &&
                String(saved.userId || '') === String(currentUserId) &&
                saved.step === 'PAYMENT_PROCESSING'
                ? saved.orderCode
                : null;
            reconcileServerRef.current?.({ verifyOrderCode });
          }
        }
      })
      .catch((err) => console.warn('Seats/Zones fetch error:', err));
  }, [reloadBackendEventId, isBackendSeated, currentUserId]);

  const resetReservationUI = useCallback(
    ({ reloadSeats = true, refreshOrders = false, clearInFlight = false, clearProcessing = true } = {}) => {
      if (clearInFlight && reloadBackendEventId) clearCheckoutInFlight(reloadBackendEventId);
      if (clearProcessing) {
        isProcessingPaymentRef.current = false;
        setIsProcessingPayment(false);
      }
      setPendingPayment(null);
      setIsReserved(false);
      setReservedUntilTime(null);
      setReservedSeatIds([]);
      if (isSeated) setSelectedSeats([]);
      else {
        setReservedZoneSeats([]);
        setZoneQuantities({});
      }
      if (reloadSeats) reloadBackendSeats();
      if (refreshOrders) latestRef.current.onRefreshOrders?.();
    },
    [isSeated, reloadBackendEventId, reloadBackendSeats],
  );

  // Đồng bộ lại khi prop thay đổi (ví dụ đổi sự kiện)
  useEffect(() => {
    if (!initialOccupiedSeats) return undefined;
    const timer = setTimeout(() => {
      setOccupiedSeats(new Set(initialOccupiedSeats));
    }, 0);
    return () => clearTimeout(timer);
  }, [initialOccupiedSeats]);

  useEffect(() => {
    if (!initialZoneRemaining || Object.keys(initialZoneRemaining).length === 0) return undefined;
    const timer = setTimeout(() => {
      setZoneRemaining({ ...initialZoneRemaining });
    }, 0);
    return () => clearTimeout(timer);
  }, [initialZoneRemaining]);

  // Đồng bộ giá vé ghế chính xác từ Backend hoặc cấu hình sự kiện
  const effectiveSeatPrice =
    backendSeats &&
      backendSeats.length > 0 &&
      backendSeats[0].price != null &&
      Number(backendSeats[0].price) > 0
      ? Number(backendSeats[0].price)
      : getMinPrice(event) || baseSingleSeatTier.price || 500000;

  const singleSeatTier = {
    ...baseSingleSeatTier,
    price: effectiveSeatPrice,
  };

  // Đồng bộ trực tiếp danh sách ghế từ Backend khi khởi tạo hoặc khi event/user đổi
  useEffect(() => {
    reloadBackendSeats();
  }, [reloadBackendSeats]);

  // Polling realtime ghế (duyệt 31/10/2026, 3 giây): tải lại trạng thái ghế
  // liên tục để thấy ghế người khác giữ/mua mà không cần F5. Tạm dừng khi
  // tab bị ẩn, quay lại tab thì tải ngay + chạy tiếp; dừng hẳn khi rời trang.
  // Chỉ đọc lại ghế (kể cả zone), không đụng ghế đang chọn / đếm ngược / thanh toán.
  useEffect(() => {
    if (!event?.id) return undefined;
    let intervalId = null;
    const startPolling = () => {
      if (intervalId !== null) return;
      intervalId = setInterval(() => {
        if (!isProcessingPaymentRef.current) {
          reloadBackendSeats();
        }
      }, 3000);
    };
    const stopPolling = () => {
      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };
    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopPolling();
      } else {
        if (!isProcessingPaymentRef.current) {
          reloadBackendSeats();
        }
        startPolling();
      }
    };
    startPolling();
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [event?.id, reloadBackendSeats]);

  // --- HÀM HIỂN THỊ MÀN HÌNH E-TICKET KHI ĐƠN HÀNG ĐƯỢC XÁC NHẬN SUCCESS ---
  const triggerOrderSuccessUI = (orderData, showConfetti = true) => {
    const items = Array.isArray(orderData.items) ? orderData.items : [];
    const seatNumbers = items.map((i) => i.seatNumber).filter(Boolean);
    const zoneCounts = {};
    items.forEach((i) => {
      const zName = i.zoneName || 'STANDARD';
      zoneCounts[zName] = (zoneCounts[zName] || 0) + 1;
    });
    const zoneSummary = Object.entries(zoneCounts)
      .map(([z, q]) => `${z} x${q}`)
      .join(', ');

    const verifiedTotal = Number(orderData.totalAmount) || 0;
    const ticketTypeLabel = isSeated
      ? `Ghế: ${seatNumbers.join(', ')}`
      : zoneSummary || `${items.length} vé`;

    setPaidOrderInfo({
      orderCode: orderData.orderCode,
      customerEmail:
        orderData.customerEmail || orderData.email || orderData.guestEmail || null,
      totalAmount: verifiedTotal,
      seatNumbers,
      zoneSummary: zoneSummary || `${items.length} vé`,
      items,
      createdAt: orderData.createdAt,
    });

    clearReservationByOrderCode(orderData.orderCode, event.id);
    clearCheckoutInFlight(event.id);
    isProcessingPaymentRef.current = false;
    setPendingPayment(null);
    setIsReserved(false);
    setReservedUntilTime(null);
    setReservedSeatIds([]);
    setIsProcessingPayment(false);
    setBookingStep('success');

    if (showConfetti) {
      confetti({ particleCount: 150, spread: 90, origin: { y: 0.6 } });
    }

    if (onPaymentSuccess && showConfetti) {
      const seatsForCallback = seatNumbers.map((code) => ({ code }));
      onPaymentSuccess(
        event.id,
        event.event_type || event.type,
        seatsForCallback,
        zoneCounts,
      );
    }

    if (onAddToCart && showConfetti) {
      onAddToCart({
        id: `ticket_${orderData.orderCode}`,
        orderCode: orderData.orderCode,
        ticketCode: `#${orderData.orderCode}`,
        ticketType: ticketTypeLabel,
      });
    }

    if (onRefreshOrders) {
      onRefreshOrders();
    }

    reloadBackendSeats();
  };

  useEffect(() => {
    const currentEventId = event?.id;
    return () => {
      isProcessingPaymentRef.current = false;
      if (currentEventId) {
        clearCheckoutInFlight(currentEventId);
      }
    };
  }, [event?.id]);

  // --- HÀM XỬ LÝ HỦY GIỮ GHẾ (Giải phóng ghế trên Database & hủy đơn/link PayOS nếu có) ---
  const handleCancelReservation = async (silent = false) => {
    reservationMutationSeqRef.current += 1;
    try {
      const { token, userId: authUserId } = getAuthContext();
      const parsed = readReservation(event?.id);
      const orderCodeToCancel = parsed?.orderCode || pendingPayment?.orderCode || null;
      const liveNowMs = Date.now() + serverOffsetMs;

      if (!silent && orderCodeToCancel) {
        const expRaw = pendingPayment?.expiresAt || parsed?.expiresAt || parsed?.reservedUntil;
        const expMs = expRaw ? new Date(expRaw).getTime() : NaN;
        const confirmMs = getSessionEffectiveExpiryMs({
          ...(parsed || {}),
          step: 'PAYMENT_PROCESSING',
          expiresAt: expRaw,
          confirmUntil: pendingPayment?.confirmUntil || parsed?.confirmUntil,
        });
        if (
          Number.isFinite(expMs) &&
          liveNowMs >= expMs &&
          Number.isFinite(confirmMs) &&
          liveNowMs < confirmMs
        ) {
          toast.warning(
            'Đơn hàng đang trong quá trình xác nhận giao dịch với ngân hàng, vui lòng chờ giây lát.',
          );
          navigate(`/checkout/${orderCodeToCancel}`);
          return;
        }
      }

      if (orderCodeToCancel) {
        try {
          await cancelOrder(orderCodeToCancel, token);
        } catch (cancelErr) {
          if (cancelErr?.status === 409) {
            if (!silent) {
              toast.warning(
                cancelErr.message || 'Không thể hủy đơn hàng ở trạng thái hiện tại.',
              );
            }
            const freshOrder = await fetchOrderPayment(orderCodeToCancel, token, {
              sync: false,
            }).catch(() => null);
            if (freshOrder?.status === 'SUCCESS') {
              triggerOrderSuccessUI(freshOrder, true);
              return;
            }
            if (freshOrder?.status === 'PAYMENT_PROCESSING') {
              const saved = syncOrderPaymentToStorage(
                authUserId || parsed?.userId,
                { ...freshOrder, eventId: freshOrder.eventId || event?.id },
                { silent: false },
              );
              if (!saved) {
                clearReservationByOrderCode(orderCodeToCancel, event?.id);
                resetReservationUI({ clearProcessing: false, refreshOrders: true });
                return;
              }
              const ui = resolveSessionUiState(saved, serverOffsetMs);
              setServerOffsetMs(ui.offset);
              setNowMs(Date.now());
              setReservedUntilTime(ui.reservedUntilTime);
              setPendingPayment(ui.pendingPayment);
              if (ui.pendingPayment?.phase === 'CONFIRMING') {
                navigate(`/checkout/${saved.orderCode}`);
              }
              return;
            }
            if (freshOrder) {
              clearReservationByOrderCode(orderCodeToCancel, event?.id);
              resetReservationUI({ clearInFlight: true, refreshOrders: true });
            }
            return;
          }
          throw cancelErr;
        }

        clearReservationByOrderCode(orderCodeToCancel, event?.id);
        resetReservationUI({ clearInFlight: true, refreshOrders: true });

        if (!silent) {
          toast.info(`Đã hủy đơn #${orderCodeToCancel} và mở lại ghế thành công.`);
        }
        return;
      }

      if (silent && (isProcessingPaymentRef.current || isCheckoutInFlight(event?.id))) {
        return;
      }
      if (parsed?.step === 'PAYMENT_PROCESSING') {
        return;
      }

      // Thu thập ID các ghế cần hủy giữ chỗ
      let seatIdsToRelease = [];
      if (reservedSeatIds && reservedSeatIds.length > 0) {
        seatIdsToRelease.push(...reservedSeatIds);
      }
      if (isSeated) {
        selectedSeats.forEach((s) => {
          if (s.id) seatIdsToRelease.push(s.id);
          else {
            const found = backendSeats.find(
              (bs) => bs.seat_number === s.code || bs.seat_number === s.code.replace('-', ''),
            );
            if (found?.id) seatIdsToRelease.push(found.id);
          }
        });
      } else {
        reservedZoneSeats.forEach((s) => {
          if (s.id) seatIdsToRelease.push(s.id);
        });
      }
      if (parsed?.seats && Array.isArray(parsed.seats)) {
        parsed.seats.forEach((s) => {
          if (s.id) seatIdsToRelease.push(s.id);
        });
      }

      seatIdsToRelease = [...new Set(seatIdsToRelease.filter(Boolean))];
      const userIdToRelease = authUserId || parsed?.userId;

      // Reset state trên giao diện trước
      clearReservation(event?.id);
      resetReservationUI({ reloadSeats: false });

      // Gọi API Backend nhả ghế (chỉ nhả ghế RESERVED)
      if (token) {
        await releaseSeats(userIdToRelease, seatIdsToRelease, token, null).catch((e) =>
          console.warn('releaseSeats API warning:', e),
        );
      }

      // Tải lại dữ liệu ghế mới nhất từ backend
      reloadBackendSeats();

      if (!silent) {
        toast.info('Đã hủy giữ chỗ và mở lại ghế thành công.');
      }
    } catch (err) {
      console.error('Lỗi khi hủy giữ ghế:', err);
      if (err?.isAuthError) return;
      if (!silent) {
        toast.error(err.message || 'Không thể hủy giữ ghế. Vui lòng thử lại!');
      }
    } finally {
      reservationMutationSeqRef.current += 1;
    }
  };

  // Format schema ghế từ BE
  const groupedSeats = useMemo(() => {
    if (!backendSeats || backendSeats.length === 0) return {};

    const layout = deriveSeatLayout(backendSeats);
    const formattedRows = {};
    layout.rows.forEach(({ letter, seats }) => {
      formattedRows[letter] = seats.map((seat) => ({
        ...seat,
        colNumber: seat.number,
        seatCol: seat.number,
        rowLetter: letter,
        displayCode: seat.seat_number || `${letter}${seat.number}`,
      }));
    });

    return formattedRows;
  }, [backendSeats]);

  useEffect(() => {
    latestRef.current = {
      getAuthContext,
      handleCancelReservation,
      onRefreshOrders,
      pendingPayment,
      reloadBackendSeats,
      resetReservationUI,
      singleSeatTier,
      toast,
      triggerOrderSuccessUI,
      userToken: user?.token,
    };
  });

  useEffect(() => {
    if (!reservedUntilTime) return undefined;
    const tickTimer = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    const handleVisibility = () => {
      if (!document.hidden) setNowMs(Date.now());
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      clearInterval(tickTimer);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [reservedUntilTime]);

  useEffect(() => {
    if (!isReserved || !Number.isFinite(reservedExpiryMs) || effectiveNowMs < reservedExpiryMs) {
      return undefined;
    }
    if (isProcessingPayment || isProcessingPaymentRef.current || isCheckoutInFlight(event?.id)) {
      return undefined;
    }

    const expiryKey = `${reservedUntilTime}:${pendingPayment?.orderCode || 'HOLD'}`;
    if (expiryHandledRef.current === expiryKey) return undefined;
    expiryHandledRef.current = expiryKey;
    let didRun = false;

    const timer = setTimeout(() => {
      didRun = true;
      if (isProcessingPaymentRef.current || isCheckoutInFlight(event?.id)) {
        expiryHandledRef.current = null;
        return;
      }

      const currentSaved = readReservation(event?.id);
      if (!currentSaved) return;

      const {
        getAuthContext: getLiveAuth,
        handleCancelReservation: cancelLiveReservation,
        pendingPayment: livePending,
        resetReservationUI: resetLiveUI,
        toast: liveToast,
        triggerOrderSuccessUI: showLiveSuccessUI,
      } = latestRef.current;

      const activeOrderCode = pendingPayment?.orderCode || livePending?.orderCode || null;
      if (activeOrderCode) {
        const { token, userId: authUserId } = getLiveAuth();
        const confirmDeadlineMs = getSessionEffectiveExpiryMs({
          ...currentSaved,
          step: 'PAYMENT_PROCESSING',
          expiresAt: livePending?.expiresAt || currentSaved.expiresAt || reservedUntilTime,
          confirmUntil: livePending?.confirmUntil || currentSaved.confirmUntil,
        });
        const liveEffectiveNowMs = Date.now() + serverOffsetMs;
        if (Number.isFinite(confirmDeadlineMs) && confirmDeadlineMs > liveEffectiveNowMs) {
          // Đang trong cửa sổ CONFIRMING (120..150s): tuyệt đối không hủy đơn, cập nhật phase + đếm ngược đến confirmUntil
          updateReservationPhaseIfNeeded(event?.id, 'CONFIRMING', { silent: false });
          setNowMs(Date.now());
          setPendingPayment((prev) => (prev ? { ...prev, phase: 'CONFIRMING' } : prev));
          setReservedUntilTime(new Date(confirmDeadlineMs).toISOString());
          return;
        }

        fetchOrderPayment(activeOrderCode, token, { sync: true, background: true })
          .then((orderData) => {
            if (orderData?.status === 'SUCCESS') {
              showLiveSuccessUI(orderData, true);
              return;
            }
            if (orderData?.status === 'PAYMENT_PROCESSING') {
              const saved = syncOrderPaymentToStorage(
                authUserId || currentSaved?.userId,
                { ...orderData, eventId: orderData.eventId || event?.id },
                { silent: false },
              );
              if (saved) {
                const ui = resolveSessionUiState(saved, serverOffsetMs);
                setServerOffsetMs(ui.offset);
                setNowMs(Date.now());
                setReservedUntilTime(ui.reservedUntilTime);
                setPendingPayment(ui.pendingPayment);
                expiryHandledRef.current = null;
                return;
              }
            }
            clearReservationByOrderCode(activeOrderCode, event?.id);
            resetLiveUI({ clearProcessing: false, refreshOrders: true });
            if (orderData?.status === 'REFUND_PENDING') {
              liveToast.warning(
                `Đơn #${orderData.orderCode} thanh toán muộn. Đã chuyển sang Chờ hoàn tiền!`,
              );
            } else {
              liveToast.warning('Phiên thanh toán đã hết hạn. Các ghế đã được mở lại!');
            }
          })
          .catch(() => {
            clearReservationByOrderCode(activeOrderCode, event?.id);
            resetLiveUI({ clearProcessing: false });
          });
      } else {
        if (currentSaved.step === 'PAYMENT_PROCESSING') return;
        // Hết thời gian giữ ghế: tự động giải phóng ghế trên Backend và khôi phục giao diện
        cancelLiveReservation(true).then(() => {
          liveToast.warning('Thời gian giữ ghế đã hết. Các ghế đã được mở lại!');
        });
      }
    }, 0);

    return () => {
      clearTimeout(timer);
      if (!didRun && expiryHandledRef.current === expiryKey) {
        expiryHandledRef.current = null;
      }
    };
  }, [
    isReserved,
    reservedUntilTime,
    reservedExpiryMs,
    effectiveNowMs,
    serverOffsetMs,
    isProcessingPayment,
    pendingPayment?.orderCode,
    event?.id,
    isSeated,
  ]);

  const totalZoneCount = Object.values(zoneQuantities).reduce((acc, val) => acc + (val || 0), 0);
  const heldCount = isSeated
    ? selectedSeats.length || reservedSeatIds.length
    : totalZoneCount || reservedSeatIds.length;
  const isSelectionLocked =
    isReserved || isReserving || isProcessingPayment || Boolean(otherEventSession);

  const otherSessionLabel = otherEventSession
    ? otherEventSession.step === 'PAYMENT_PROCESSING' && otherEventSession.orderCode
      ? `thanh toán đơn #${otherEventSession.orderCode}`
      : 'giữ ghế'
    : '';
  const otherEventTitle = otherEventSession?.eventTitle || 'sự kiện khác';

  const lockMessage =
    isReserved && pendingPayment
      ? `Đơn #${pendingPayment.orderCode} đang chờ thanh toán. Bấm Tiếp tục thanh toán hoặc bấm Hủy đơn / Chọn lại ghế để chọn ghế khác.`
      : isReserved
        ? `Bạn đang giữ ${heldCount} ${isSeated ? 'ghế' : 'vé'}. Bấm Thanh toán QR để hoàn tất, hoặc bấm Hủy giữ ghế / Chọn lại nếu muốn đổi ghế khác.`
        : otherEventSession
          ? `Bạn đang có phiên ${otherSessionLabel} tại sự kiện "${otherEventTitle}". Vui lòng hoàn tất hoặc hủy ở thanh thông báo phía trên để đặt vé sự kiện này.`
          : isReserving
            ? 'Đang giữ chỗ, vui lòng chờ giây lát...'
            : isProcessingPayment
              ? 'Đang tạo mã QR thanh toán, vui lòng chờ giây lát...'
              : '';

  // --- LOGIC SEATED-BASED ---
  const handleToggleSeat = (seat, tier = singleSeatTier) => {
    // Khóa chọn ghế khi đang giữ chỗ / chờ thanh toán / đang gửi request / có phiên sự kiện khác
    if (isSelectionLocked) {
      if (!isReserving && !isProcessingPayment && lockMessage) {
        toast.info(lockMessage);
      }
      return;
    }

    const seatId = seat.id;
    const seatCode = seat.displayCode || seat.seat_number;
    if (occupiedSeats.has(seat.seat_number) || (seatId && occupiedSeats.has(seatId))) return;
    const isAlreadySelected = selectedSeats.some(
      (s) => (seatId && s.id === seatId) || s.code === seatCode,
    );
    if (isAlreadySelected) {
      setSelectedSeats((prev) =>
        prev.filter((s) => (seatId ? s.id !== seatId : s.code !== seatCode)),
      );
    } else {
      if (selectedSeats.length >= MAX_TICKETS_PER_ORDER) {
        toast.warning(
          `Bạn chỉ được chọn tối đa ${MAX_TICKETS_PER_ORDER} ghế cho mỗi đơn hàng theo quy định!`,
        );
        return;
      }

      const seatP =
        seat.price != null && Number(seat.price) > 0
          ? Number(seat.price)
          : tier?.price || singleSeatTier.price;

      setSelectedSeats((prev) => [
        ...prev,
        {
          id: seatId,
          code: seatCode,
          tier: tier.name || singleSeatTier.name,
          price: seatP,
          color: tier.color || singleSeatTier.color,
        },
      ]);
    }
  };

  const totalSeatedPrice = selectedSeats.reduce((acc, curr) => {
    return acc + parseFloat(curr.price);
  }, 0);

  // --- LOGIC ZONE-BASED ---
  const handleUpdateZoneQty = (zoneName, delta) => {
    // Khóa chọn khu vực khi đang giữ chỗ / chờ thanh toán / đang gửi request / có phiên sự kiện khác
    if (isSelectionLocked) {
      if (!isReserving && !isProcessingPayment && lockMessage) {
        toast.info(lockMessage);
      }
      return;
    }

    const current = zoneQuantities[zoneName] || 0;
    const available =
      zoneRemaining[zoneName] ?? (event.zones?.find((z) => z.id === zoneName)?.remaining || 0);

    if (delta > 0) {
      if (totalZoneCount >= MAX_TICKETS_PER_ORDER) {
        toast.warning(
          `Bạn chỉ được đặt tối đa ${MAX_TICKETS_PER_ORDER} vé trong sự kiện Zone-based này!`,
        );
        return;
      }
      if (current >= available) {
        toast.warning('Khu vực này hiện chỉ còn lại ' + available + ' vé khả dụng!');
        return;
      }
    }
    setZoneQuantities((prev) => {
      const currentQty = prev[zoneName] || 0;
      const newQty = Math.max(0, currentQty + delta);
      return { ...prev, [zoneName]: newQty };
    });
  };

  const rawZonePrice = Object.entries(zoneQuantities).reduce((acc, [zoneName, qty]) => {
    const zoneInfo = backendZones[zoneName];
    const price = zoneInfo ? Number(zoneInfo.price) : 0;

    return acc + qty * price;
  }, 0);
  const totalZonePrice =
    rawZonePrice > 0
      ? rawZonePrice
      : reservedZoneSeats.reduce((sum, s) => sum + (Number(s.price) || 0), 0);

  // Biến lưu tổng số tiền vé mà user đang giữ
  const totalPrice = isSeated ? totalSeatedPrice : totalZonePrice;
  const hasSelections = isSeated ? selectedSeats.length > 0 : totalZoneCount > 0;

  // --- KHÔI PHỤC PHIÊN GIỮ GHẾ / PHIÊN THANH TOÁN ĐANG DỞ CÒN HẠN KHI REFRESH HOẶC VÀO LẠI ---
  useEffect(() => {
    if (!event?.id) return undefined;
    let cancelled = false;
    let isInternalSync = false;

    const runInternalSync = (fn) => {
      isInternalSync = true;
      try {
        return fn();
      } finally {
        isInternalSync = false;
      }
    };

    // Phiên giữ ghế này có phải của tài khoản đang đăng nhập hay không
    const ownsReservation = (parsedData) =>
      Boolean(parsedData?.userId && user?.id && String(parsedData.userId) === String(user.id));

    const restoreSeatsUI = (rawSeats = []) => {
      if (!Array.isArray(rawSeats) || rawSeats.length === 0) return;
      const liveTier = latestRef.current.singleSeatTier || {};
      const normalizedIds = rawSeats.map((s) => s.id || s.seatId || s.seat_id).filter(Boolean);
      setReservedSeatIds(normalizedIds);
      if (isSeated) {
        setSelectedSeats(
          rawSeats.map((seat) => ({
            id: seat.id || seat.seatId || seat.seat_id,
            code: seat.seat_number || seat.seatNumber,
            tier: seat.zone_name || seat.zoneName || liveTier.name || 'Standard',
            price: Number(seat.price) || liveTier.price,
            color: liveTier.color || '#3b82f6',
          })),
        );
      } else {
        setReservedZoneSeats(
          rawSeats.map((seat) => ({
            ...seat,
            id: seat.id || seat.seatId || seat.seat_id,
            seat_number: seat.seat_number || seat.seatNumber,
            zone_name: seat.zone_name || seat.zoneName,
            price: Number(seat.price) || 0,
          })),
        );
        const restoredQuantities = {};
        rawSeats.forEach((seat) => {
          const zoneName = seat.zone_name || seat.zoneName;
          if (zoneName) {
            restoredQuantities[zoneName] = (restoredQuantities[zoneName] || 0) + 1;
          }
        });
        setZoneQuantities(restoredQuantities);
      }
    };

    const resetLocalReservationUI = () => {
      latestRef.current.resetReservationUI({ clearProcessing: false });
    };

    const applySessionToUI = (session) => {
      setOtherEventSession(null);
      restoreSeatsUI(session.seats);
      const ui = resolveSessionUiState(session, 0);
      setServerOffsetMs(ui.offset);
      setNowMs(Date.now());
      setIsReserved(true);
      setReservedUntilTime(ui.reservedUntilTime);
      setPendingPayment(ui.pendingPayment);
    };

    const syncOtherEventSession = () => {
      const { userId: authUserId } = latestRef.current.getAuthContext();
      const activeUserId = user?.id || authUserId;
      if (!activeUserId) {
        setOtherEventSession(null);
        return null;
      }
      const found =
        getActiveSessions(activeUserId).find((s) => String(s.eventId) !== String(event.id)) || null;
      setOtherEventSession(found);
      return found;
    };

    const syncFromServerActiveSession = ({ verifyOrderCode = null } = {}) => {
      const { token, userId: authUserId } = latestRef.current.getAuthContext();
      const activeUserId = user?.id || authUserId;
      if (!token || !activeUserId) return;
      if (verifyingPendingRef.current === 'SESSION_SYNC') return;
      verifyingPendingRef.current = 'SESSION_SYNC';

      fetchMyActiveSession(token)
        .then(async (serverSession) => {
          if (cancelled) return;
          if (!serverSession) {
            if (isProcessingPaymentRef.current || isCheckoutInFlight(event.id)) {
              return;
            }
            if (verifyOrderCode) {
              const {
                onRefreshOrders: refreshLiveOrders,
                toast: liveToast,
                triggerOrderSuccessUI: showLiveSuccessUI,
              } = latestRef.current;
              const orderData = await fetchOrderPayment(verifyOrderCode, token, {
                sync: false,
                background: true,
              }).catch(() => null);
              if (cancelled) return;
              if (orderData?.status === 'SUCCESS') {
                showLiveSuccessUI(orderData, true);
                return;
              }
              if (orderData?.status === 'REFUND_PENDING') {
                liveToast.warning(
                  `Đơn #${orderData.orderCode} thanh toán sau khi hết hạn/hủy. Đã chuyển sang Chờ hoàn tiền!`,
                );
              }
              refreshLiveOrders?.();
            }

            runInternalSync(() =>
              clearAllReservations({
                userId: activeUserId,
                preserveInFlight: true,
                silent: false,
              }),
            );
            setOtherEventSession(null);
            if (reservedStateRef.current.isReserved) {
              resetLocalReservationUI();
            }
            return;
          }

          if (String(serverSession.eventId) !== String(event.id)) {
            const savedOther = runInternalSync(() =>
              syncServerReservationToStorage(activeUserId, serverSession, { silent: false }),
            );
            setOtherEventSession(savedOther || serverSession);
            if (reservedStateRef.current.isReserved) {
              resetLocalReservationUI();
            }
            return;
          }

          setOtherEventSession(null);
          const saved = runInternalSync(() =>
            syncServerReservationToStorage(activeUserId, serverSession, { silent: false }),
          );
          if (saved) applySessionToUI(saved);
        })
        .catch(() => { })
        .finally(() => {
          if (verifyingPendingRef.current === 'SESSION_SYNC') {
            verifyingPendingRef.current = null;
          }
        });
    };
    reconcileServerRef.current = syncFromServerActiveSession;

    const checkAndRestoreReservation = () => {
      const { token, userId: authUserId } = latestRef.current.getAuthContext();
      const activeUserId = user?.id || authUserId;
      runInternalSync(() =>
        pruneStaleReservations(activeUserId || null, { preserveInFlight: true, silent: true }),
      );
      syncOtherEventSession();
      const parsedData = readReservation(event.id);

      // Nhánh 1: Không có key trong localStorage hoặc không thuộc user hiện tại
      if (!parsedData || !ownsReservation(parsedData)) {
        if (parsedData) {
          runInternalSync(() => clearReservation(event.id));
        }
        if (!token && reservedStateRef.current.isReserved) {
          resetLocalReservationUI();
        }
        syncFromServerActiveSession();
        return;
      }

      const parsedOffsetMs = Number.isFinite(Number(parsedData.serverOffsetMs))
        ? Number(parsedData.serverOffsetMs)
        : 0;
      const effectiveCheckNowMs = Date.now() + parsedOffsetMs;

      // Nhánh 2: PAYMENT_PROCESSING — giữ lại đến hết confirmUntil & đối soát BE
      if (parsedData.step === 'PAYMENT_PROCESSING') {
        const effectiveDeadlineMs = getSessionEffectiveExpiryMs(parsedData);
        if (!Number.isFinite(effectiveDeadlineMs) || effectiveDeadlineMs <= effectiveCheckNowMs) {
          runInternalSync(() => clearReservationByOrderCode(parsedData.orderCode, event.id));
          if (reservedStateRef.current.isReserved) {
            resetLocalReservationUI();
          }
          latestRef.current.onRefreshOrders?.();
          syncFromServerActiveSession();
          return;
        }

        if (!parsedData.orderCode || !token) return;
        if (verifyingPendingRef.current === parsedData.orderCode) return;
        verifyingPendingRef.current = parsedData.orderCode;

        fetchOrderPayment(parsedData.orderCode, token, { sync: false, background: true })
          .then((orderData) => {
            if (cancelled) return;
            const {
              onRefreshOrders: refreshLiveOrders,
              toast: liveToast,
              triggerOrderSuccessUI: showLiveSuccessUI,
            } = latestRef.current;
            const st = orderData?.status;
            if (st === 'SUCCESS') {
              showLiveSuccessUI(orderData, true);
              return;
            }
            if (st === 'REFUND_PENDING') {
              runInternalSync(() => clearReservationByOrderCode(parsedData.orderCode, event.id));
              resetLocalReservationUI();
              refreshLiveOrders?.();
              liveToast.warning(
                `Đơn #${orderData.orderCode} thanh toán sau khi hết hạn/hủy. Đã chuyển sang Chờ hoàn tiền!`,
              );
              return;
            }
            if (st !== 'PAYMENT_PROCESSING') {
              runInternalSync(() => clearReservationByOrderCode(parsedData.orderCode, event.id));
              resetLocalReservationUI();
              refreshLiveOrders?.();
              syncFromServerActiveSession();
              return;
            }

            const saved = runInternalSync(() =>
              syncOrderPaymentToStorage(
                activeUserId,
                { ...orderData, eventId: orderData.eventId || event.id },
                { silent: false },
              ),
            );
            if (!saved) {
              resetLocalReservationUI();
              refreshLiveOrders?.();
              return;
            }
            applySessionToUI(saved);
          })
          .catch((err) => {
            if (cancelled) return;
            if (
              err?.status === 404 ||
              err?.status === 403 ||
              err?.message?.includes('Không tìm thấy')
            ) {
              runInternalSync(() => clearReservationByOrderCode(parsedData.orderCode, event.id));
              resetLocalReservationUI();
              return;
            }
            // Lỗi mạng tạm thời: vẫn giữ phiên còn hạn từ localStorage để user tiếp tục thanh toán
            applySessionToUI(parsedData);
          })
          .finally(() => {
            if (verifyingPendingRef.current === parsedData.orderCode) {
              verifyingPendingRef.current = null;
            }
          });
        return;
      }

      // Nhánh 3: RESERVED — hiển thị ngay nếu còn hạn, đồng thời đối chiếu BE ở nền
      const waitingExpiryMs = getSessionWaitingExpiryMs(parsedData);
      if (Number.isFinite(waitingExpiryMs) && waitingExpiryMs > effectiveCheckNowMs) {
        applySessionToUI(parsedData);
        if (
          !isReservingRef.current &&
          !isProcessingPaymentRef.current &&
          !isCheckoutInFlight(event.id)
        ) {
          syncFromServerActiveSession();
        }
      } else {
        if (isProcessingPaymentRef.current || isCheckoutInFlight(event.id)) {
          return;
        }
        // Đã quá hạn -> xóa rác local (không gọi releaseSeats với danh sách ghế cũ) rồi đồng bộ phiên thật từ BE
        runInternalSync(() => clearReservation(event.id));
        if (reservedStateRef.current.isReserved) {
          resetLocalReservationUI();
        }
        syncFromServerActiveSession();
      }
    };

    const initTimer = setTimeout(checkAndRestoreReservation, 0);

    // Đồng bộ nếu người dùng hủy/cập nhật từ Sticky Banner hoặc thiết bị khác
    const handleReservationChanged = (e) => {
      if (isInternalSync || !isReservationStorageEvent(e)) return;

      syncOtherEventSession();
      const current = readReservation(event.id);
      if (!current) {
        if (reservedStateRef.current.isReserved) resetLocalReservationUI();
        return;
      }
      const cur = reservedStateRef.current;
      const currentExpectedUntil =
        current.step === 'PAYMENT_PROCESSING' &&
          current.phase === 'CONFIRMING' &&
          current.confirmUntil
          ? current.confirmUntil
          : current.expiresAt || current.reservedUntil || null;
      const currentSeatKeyValue = getReservationSeatsKey(current.seats);

      if (
        cur.isReserved &&
        cur.step === current.step &&
        String(cur.userId || '') === String(current.userId || '') &&
        String(cur.reservedUntilTime || '') === String(currentExpectedUntil || '') &&
        String(cur.expiresAt || '') === String(current.expiresAt || '') &&
        String(cur.confirmUntil || '') === String(current.confirmUntil || '') &&
        String(cur.phase || '') === String(current.phase || '') &&
        Number(cur.pendingOrderCode || 0) === Number(current.orderCode || 0) &&
        cur.seatKey === currentSeatKeyValue
      ) {
        return;
      }
      checkAndRestoreReservation();
    };

    // Bắt thêm sự kiện pageshow (khi trình duyệt khôi phục trang từ BFCache lúc bấm nút Back <-)
    const handlePageShow = (e) => {
      if (e.persisted) {
        isProcessingPaymentRef.current = false;
        clearCheckoutInFlight(event.id);
        setIsProcessingPayment(false);
        checkAndRestoreReservation();
      }
    };
    window.addEventListener(RESERVATION_CHANGED_EVENT, handleReservationChanged);
    window.addEventListener('storage', handleReservationChanged);
    window.addEventListener('pageshow', handlePageShow);
    return () => {
      cancelled = true;
      reconcileServerRef.current = null;
      verifyingPendingRef.current = null;
      clearTimeout(initTimer);
      window.removeEventListener(RESERVATION_CHANGED_EVENT, handleReservationChanged);
      window.removeEventListener('storage', handleReservationChanged);
      window.removeEventListener('pageshow', handlePageShow);
    };
  }, [event?.id, user?.id, isSeated]);

  const applyHeldSeatedReservation = useCallback(
    ({ holdData, fallbackSeatIds = [], seq }) => {
      if (seq !== undefined && seq !== reservationMutationSeqRef.current) {
        return;
      }

      const expiry = holdData?.reserved_until || holdData?.reservedUntil;
      const heldSeatsData = holdData?.seats || holdData?.reservedSeats || [];
      if (!expiry) {
        throw new Error('Không nhận được thời gian giữ chỗ từ hệ thống.');
      }

      if (heldSeatsData.length > 0) {
        setSelectedSeats(
          heldSeatsData.map((seat) => ({
            id: seat.id || seat.seatId || seat.seat_id,
            code: seat.seat_number || seat.seatNumber,
            tier: seat.zone_name || seat.zoneName || singleSeatTier.name || 'Standard',
            price: Number(seat.price) || singleSeatTier.price,
            color: singleSeatTier.color || '#3b82f6',
          })),
        );
      }

      const finalSeatIds =
        holdData?.seatIds?.length > 0
          ? holdData.seatIds
          : heldSeatsData.length > 0
            ? heldSeatsData.map((s) => s.id || s.seatId || s.seat_id).filter(Boolean)
            : fallbackSeatIds;

      const nextOffset = computeServerOffsetMs(holdData?.serverTime, 0);
      setServerOffsetMs(nextOffset);
      setNowMs(Date.now());
      setOtherEventSession(null);
      setReservedSeatIds(finalSeatIds);
      setReservedUntilTime(expiry);
      setIsReserved(true);
      clearOtherUserReservations(user.id, event.id, { silent: true });
      saveReservation(event.id, {
        userId: user?.id,
        step: 'RESERVED',
        eventId: event.id,
        eventTitle: event.title,
        eventType: event.event_type || 'SEAT_BASED',
        totalAmount:
          heldSeatsData.reduce((s, r) => s + (Number(r.price) || 0), 0) || totalPrice,
        reservedUntil: expiry,
        serverOffsetMs: nextOffset,
        seats: heldSeatsData,
      });
    },
    [event, singleSeatTier, totalPrice, user?.id],
  );

    const handleCancelPartialHold = () => {
    if (isConfirmingPartial) return;
    // Tăng seq để vô hiệu hóa mọi phản hồi muộn thuộc phiên partial này
    reservationMutationSeqRef.current += 1;
    setSelectedSeats([]);
    setPartialHoldPrompt(null);
  };

  const handleConfirmPartialHold = async () => {
    if (!partialHoldPrompt || isConfirmingPartial) return;

    const seatIdsToConfirm = partialHoldPrompt.availableSeatIds;
    if (!Array.isArray(seatIdsToConfirm) || seatIdsToConfirm.length === 0) {
      setPartialHoldPrompt(null);
      return;
    }

    if (!user) {
      toast.info('Vui lòng đăng nhập để giữ chỗ.');
      setPartialHoldPrompt(null);
      onRequireLogin?.();
      return;
    }

    const token = user?.token;
    if (!token || isJwtExpired(token, { serverOffsetMs: user?.serverOffsetMs || 0 })) {
      setPartialHoldPrompt(null);
      notifyAuthExpired(undefined, { source: 'proactive' });
      return;
    }

    reservationMutationSeqRef.current += 1;
    const activeSeq = reservationMutationSeqRef.current;
    setIsConfirmingPartial(true);

    try {
      const confirmData = await confirmPartialHoldSeats(seatIdsToConfirm, token);
      if (activeSeq !== reservationMutationSeqRef.current) return;

      setPartialHoldPrompt(null);

      applyConfirmedPartialReservation({
        confirmData,
        fallbackSeatIds: seatIdsToConfirm,
      });
      toast.success('Đã giữ thành công các ghế còn trống!');
    } catch (err) {
      console.error('Lỗi xác nhận giữ ghế một phần:', err);
      if (activeSeq !== reservationMutationSeqRef.current) return;

      if (err?.isAuthError) {
        setPartialHoldPrompt(null);
        return;
      }

      const errCode = err?.code || err?.payload?.data?.code;
      const errMsg =
        err?.payload?.message ||
        err?.message ||
        'Không thể giữ các ghế còn lại.';

      if (
        errCode === 'PARTIAL_HOLD_EXPIRED' ||
        errCode === 'USER_HAS_ACTIVE_HOLD' ||
        /phiên giữ vé chưa hoàn tất/i.test(errMsg)
      ) {
        
        setSelectedSeats([]);
        setPartialHoldPrompt(null);
        reconcileServerRef.current?.();
      }

      toast.error(errMsg);
    } finally {
      setIsConfirmingPartial(false);
    }
  };

  // --- XỬ LÝ GIỮ GHẾ ---
  const handleReserveSeats = async () => {
    if (isReserving || isReserved || otherEventSession) return;
    if (!user) {
      toast.info('Vui lòng đăng nhập để giữ chỗ.');
      onRequireLogin?.();
      return;
    }
    if (!hasSelections) {
      toast.warning('Vui lòng chọn vé trước khi tiến hành giữ chỗ!');
      return;
    }

    const token = user?.token;
    if (!token || isJwtExpired(token, { serverOffsetMs: user?.serverOffsetMs || 0 })) {
      notifyAuthExpired(undefined, { source: 'proactive' });
      return;
    }

    isReservingRef.current = true;
    reservationMutationSeqRef.current += 1;
    const currentSeq = reservationMutationSeqRef.current;
    setIsReserving(true);
    try {
      const commitHeldReservation = ({ expiry, serverTime, seatIds, seats, eventType }) => {
        const nextOffset = computeServerOffsetMs(serverTime, 0);
        setServerOffsetMs(nextOffset);
        setNowMs(Date.now());
        setOtherEventSession(null);
        setReservedSeatIds(seatIds);
        setReservedUntilTime(expiry);
        setIsReserved(true);
        clearOtherUserReservations(user.id, event.id, { silent: true });
        saveReservation(event.id, {
          userId: user?.id,
          step: 'RESERVED',
          eventId: event.id,
          eventTitle: event.title,
          eventType,
          totalAmount: seats.reduce((s, r) => s + (Number(r.price) || 0), 0) || totalPrice,
          reservedUntil: expiry,
          serverOffsetMs: nextOffset,
          seats,
        });
      };

      if (isSeated) {
        let seatIdsToCheckout = selectedSeats.map((s) => s.id).filter(Boolean);
        if (seatIdsToCheckout.length === 0) {
          seatIdsToCheckout = selectedSeats
            .map((s) => {
              const found = backendSeats.find(
                (bs) => bs.seat_number === s.code || bs.seat_number === s.code.replace('-', ''),
              );
              return found?.id;
            })
            .filter(Boolean);
        }
        if (seatIdsToCheckout.length === 0) {
          throw new Error('Không tìm thấy thông tin ghế trên hệ thống backend.');
        }

        const holdData = await holdSeats(seatIdsToCheckout, token);
        const expiry = holdData?.reserved_until || holdData?.reservedUntil;
        const heldSeatsData = holdData?.seats || holdData?.reservedSeats || [];
        if (!expiry) throw new Error('Không nhận được thời gian giữ chỗ từ hệ thống.');

        if (heldSeatsData.length > 0) {
          setSelectedSeats(
            heldSeatsData.map((seat) => ({
              id: seat.id || seat.seatId || seat.seat_id,
              code: seat.seat_number || seat.seatNumber,
              tier: seat.zone_name || seat.zoneName || singleSeatTier.name || 'Standard',
              price: Number(seat.price) || singleSeatTier.price,
              color: singleSeatTier.color || '#3b82f6',
            })),
          );
        }
        commitHeldReservation({
          expiry,
          serverTime: holdData?.serverTime,
          seatIds: holdData?.seatIds?.length > 0 ? holdData.seatIds : seatIdsToCheckout,
          seats: heldSeatsData,
          eventType: event.event_type || 'SEAT_BASED',
        });
      } else {
        const selections = Object.entries(zoneQuantities)
          .filter(([, qty]) => qty > 0)
          .map(([zoneId, qty]) => {
            const zoneObj = event.zones?.find((z) => z.id === zoneId);
            return { zone_name: zoneObj?.id.toUpperCase() || zoneId, quantity: qty };
          });
        const holdData = await holdZones(event.id, selections, token);
        const returnedSeats = holdData?.seats || [];
        const returnedSeatIds = holdData?.seatIds || [];
        const expiry = holdData?.reserved_until;
        if (returnedSeatIds.length === 0 || !expiry) {
          throw new Error('Không nhận được thời gian giữ chỗ hoặc danh sách ghế từ hệ thống.');
        }
        setReservedZoneSeats(returnedSeats);
        commitHeldReservation({
          expiry,
          serverTime: holdData?.serverTime,
          seatIds: returnedSeatIds,
          seats: returnedSeats,
          eventType: event.event_type || 'ZONE_BASED',
        });
      }
    } catch (err) {
      const errCode = err?.code || err?.payload?.data?.code;
      const partialData = errCode === 'PARTIAL_AVAILABILITY' ? err?.payload?.data : null;

      if (
        partialData &&
        Array.isArray(partialData.availableSeatIds) &&
        partialData.availableSeatIds.length > 0
      ) {
        setPartialHoldPrompt({
          seq: currentSeq,
          unavailableSeats: partialData.unavailableSeats || [],
          availableSeats: partialData.availableSeats || [],
          availableSeatIds: partialData.availableSeatIds,
        });
        return;
      }

      console.error('Lỗi giữ ghế:', err);
      if (err?.isAuthError) return;
      const errMsg = err.response?.data?.message || err.message || 'Có lỗi xảy ra khi giữ ghế!';

      if (errCode === 'ALL_SEATS_TAKEN') {
        setSelectedSeats([]);
        setReservedZoneSeats?.([]);
        setReservedSeatIds?.([]);
        setReservedUntilTime?.(null);
        setIsReserved?.(false);
        clearReservation?.(event.id);
      }

      toast.error(errMsg);
      if (
        err?.payload?.data?.code === 'USER_HAS_ACTIVE_HOLD' ||
        /phiên giữ vé chưa hoàn tất/i.test(errMsg)
      ) {
        reconcileServerRef.current?.();
      }
    } finally {
      isReservingRef.current = false;
      reservationMutationSeqRef.current += 1;
      setIsReserving(false);
    }
  };

  // Áp dụng dữ liệu giữ ghế thành công (dùng cho confirmPartialHold)
  const applyConfirmedPartialReservation = useCallback(
    ({ confirmData, fallbackSeatIds = [] }) => {
      const expiry = confirmData?.reserved_until || confirmData?.reservedUntil;
      const heldSeatsData = confirmData?.seats || confirmData?.reservedSeats || [];
      if (!expiry) {
        throw new Error('Không nhận được thời gian giữ chỗ từ hệ thống.');
      }

      if (heldSeatsData.length > 0) {
        setSelectedSeats(
          heldSeatsData.map((seat) => ({
            id: seat.id || seat.seatId || seat.seat_id,
            code: seat.seat_number || seat.seatNumber,
            tier: seat.zone_name || seat.zoneName || singleSeatTier.name || 'Standard',
            price: Number(seat.price) || singleSeatTier.price,
            color: singleSeatTier.color || '#3b82f6',
          })),
        );
      }

      const finalSeatIds =
        confirmData?.seatIds?.length > 0
          ? confirmData.seatIds
          : heldSeatsData.length > 0
            ? heldSeatsData.map((s) => s.id || s.seatId || s.seat_id).filter(Boolean)
            : fallbackSeatIds;

      const nextOffset = computeServerOffsetMs(confirmData?.serverTime, 0);
      setServerOffsetMs(nextOffset);
      setNowMs(Date.now());
      setOtherEventSession(null);
      setReservedSeatIds(finalSeatIds);
      setReservedUntilTime(expiry);
      setIsReserved(true);
      clearOtherUserReservations(user.id, event.id, { silent: true });
      saveReservation(event.id, {
        userId: user?.id,
        step: 'RESERVED',
        eventId: event.id,
        eventTitle: event.title,
        eventType: event.event_type || 'SEAT_BASED',
        totalAmount:
          heldSeatsData.reduce((s, r) => s + (Number(r.price) || 0), 0) || totalPrice,
        reservedUntil: expiry,
        serverOffsetMs: nextOffset,
        seats: heldSeatsData,
      });
    },
    [event, singleSeatTier, totalPrice, user?.id],
  );

  // --- TIẾP TỤC PHIÊN THANH TOÁN QR ĐANG DỞ ---
  const handleResumePendingPayment = () => {
    if (!pendingPayment?.orderCode) return;
    navigate(`/checkout/${pendingPayment.orderCode}`);
  };

  // --- XỬ LÝ KHỞI TẠO THANH TOÁN QR NỘI BỘ ---
  const handlePayment = async () => {
    if (isProcessingPaymentRef.current) return;
    const token = user?.token;
    if (!token || isJwtExpired(token, { serverOffsetMs: user?.serverOffsetMs || 0 })) {
      notifyAuthExpired(undefined, { source: 'proactive' });
      return;
    }
    reservationMutationSeqRef.current += 1;
    isProcessingPaymentRef.current = true;
    setIsProcessingPayment(true);
    markCheckoutInFlight(event?.id);

    try {
      let seatIdsToCheckout =
        Array.isArray(reservedSeatIds) && reservedSeatIds.length > 0
          ? reservedSeatIds.filter(Boolean)
          : [];
      if (seatIdsToCheckout.length === 0) {
        if (isSeated) {
          seatIdsToCheckout = selectedSeats.map((s) => s.id).filter(Boolean);
          if (seatIdsToCheckout.length === 0) {
            seatIdsToCheckout = selectedSeats
              .map((s) => {
                const found = backendSeats.find(
                  (bs) => bs.seat_number === s.code || bs.seat_number === s.code.replace('-', ''),
                );
                return found?.id;
              })
              .filter(Boolean);
          }
        } else {
          seatIdsToCheckout = reservedZoneSeats.map((s) => s.id).filter(Boolean);
        }
      }

      if (seatIdsToCheckout.length === 0) {
        throw new Error('Không tìm thấy danh sách ghế cần thanh toán. Vui lòng thực hiện lại.');
      }

      const checkoutData = await startCheckout({ seatIds: seatIdsToCheckout }, token);
      const orderCode = checkoutData?.orderCode;
      const paymentInfo = checkoutData?.paymentInfo;
      const expiresAt =
        checkoutData?.expiresAt ||
        checkoutData?.paymentTimeout ||
        new Date(Date.now() + 120 * 1000).toISOString();
      const confirmUntil =
        checkoutData?.confirmUntil ||
        new Date(new Date(expiresAt).getTime() + 30 * 1000).toISOString();

      if (!orderCode || !paymentInfo?.qrCode) {
        throw new Error('Không nhận được thông tin mã QR thanh toán từ hệ thống.');
      }

      const savedObj = readReservation(event.id) || {};
      const seatsSnapshot =
        savedObj.seats && Array.isArray(savedObj.seats) && savedObj.seats.length > 0
          ? savedObj.seats
          : isSeated
            ? selectedSeats.map((s) => ({
              id: s.id,
              seat_number: s.code,
              price: s.price,
              zone_name: s.tier,
            }))
            : reservedZoneSeats;

      const nextOffset = computeServerOffsetMs(checkoutData?.serverTime, serverOffsetMs);

      saveReservation(
        event.id,
        {
          userId: user?.id,
          step: 'PAYMENT_PROCESSING',
          eventId: event.id,
          eventTitle: event.title,
          eventType: event.event_type || (isSeated ? 'SEAT_BASED' : 'ZONE_BASED'),
          orderCode,
          totalAmount: checkoutData?.totalAmount ?? totalPrice,
          reservedUntil: expiresAt,
          expiresAt,
          confirmUntil,
          phase: 'WAITING',
          serverOffsetMs: nextOffset,
          seats: seatsSnapshot,
        },
        { silent: true },
      );

      const checkoutState = {
        ...checkoutData,
        orderCode: Number(orderCode),
        status: 'PAYMENT_PROCESSING',
        phase: 'WAITING',
        expiresAt,
        confirmUntil,
        eventId: event.id,
        eventTitle: event.title,
        eventType: event.event_type || (isSeated ? 'SEAT_BASED' : 'ZONE_BASED'),
        eventStartTime: event.start_time || null,
        location: eventVenue,
        items: seatsSnapshot.map((s) => ({
          seatId: s.id || s.seatId || s.seat_id,
          seatNumber: s.seat_number || s.seatNumber || s.code,
          zoneName: s.zone_name || s.zoneName || s.tier || 'STANDARD',
          price: Number(s.price) || 0,
        })),
      };

      clearCheckoutInFlight(event?.id);
      navigate(`/checkout/${orderCode}`, {
        state: { checkoutData: checkoutState },
      });
    } catch (err) {
      console.error('Lỗi thanh toán:', err);
      clearCheckoutInFlight(event?.id);
      isProcessingPaymentRef.current = false;
      setIsProcessingPayment(false);
      if (err?.isAuthError) return;

      const errMsg =
        err.response?.data?.message ||
        err.message ||
        'Có lỗi xảy ra khi tạo giao dịch thanh toán!';
      toast.error(errMsg);

      const isHoldLostError =
        /hết hạn giữ chỗ|không thuộc quyền sở hữu|không còn hợp lệ|không tồn tại/i.test(errMsg);
      const isExpiredNow =
        Number.isFinite(reservedExpiryMs) && Date.now() + serverOffsetMs >= reservedExpiryMs;
      if (isExpiredNow || isHoldLostError) {
        clearReservation(event?.id);
        resetReservationUI({ clearProcessing: false });
        reconcileServerRef.current?.();
      }
    } finally {
      reservationMutationSeqRef.current += 1;
    }
  };

  // Email hiện trên màn hình thành công: tài khoản > khách đã lưu > email trên đơn
  // (trường hợp quay về từ PayOS mà trình duyệt này không còn lưu thông tin khách).
  const successEmail = user?.email || activeGuest.email || paidOrderInfo?.customerEmail || '';

  if (!event) {
    return (
      <div className="detail-notfound">
        <p className="detail-notfound-text">Không tìm thấy thông tin sự kiện.</p>
        <button onClick={onBack} className="detail-notfound-btn">
          <ArrowLeft size={16} /> Quay lại danh sách sự kiện
        </button>
      </div>
    );
  }

  return (
    <div
      className={`event-detail-page-container${hasSelections && activeTab === 'booking' && bookingStep === 'booking' && !isUpcoming ? ' with-bottom-bar' : ''}`}
    >
      {/* Top back button */}
      <button onClick={onBack} className="event-back-btn">
        <ArrowLeft size={15} />
        <span>Quay lại danh sách sự kiện</span>
      </button>

      {/* EVENT BANNER HEADER */}
      <div className="event-banner-card" style={{ '--banner-image': `url(${event.banner})` }}>
        <div className="detail-banner-overlay" />

        <div className="detail-banner-content">
          <div className="detail-badges-row">
            <span className={`detail-badge ${isSeated ? 'badge-type-seated' : 'badge-type-zone'}`}>
              {isSeated ? <Armchair size={13} /> : <Layers size={13} />}
              {isSeated
                ? `Seated-based (max ${MAX_TICKETS_PER_ORDER} ghế)`
                : `Zone-based (max ${MAX_TICKETS_PER_ORDER} vé)`}
            </span>
            {isUpcoming && (
              <span className="badge-status-upcoming detail-badge">
                <Clock size={13} />
                Sắp diễn ra - Chưa mở bán
              </span>
            )}
          </div>

          <h1 className="detail-title">{event.title}</h1>

          <div className="detail-meta-row">
            <div className="detail-meta-chip">
              <Calendar size={15} color="var(--primary-light)" />
              <span>{eventDate || event.date}</span>
            </div>
            <div className="detail-meta-chip">
              <Clock size={15} color="var(--primary-light)" />
              <span>{eventTime}</span>
            </div>
            <div className="detail-meta-chip">
              <MapPin size={15} color="var(--accent-pink)" />
              <span className="detail-venue-text">{eventVenue || event.venue}</span>
            </div>
          </div>
        </div>
      </div>

      {/* TABS SELECTOR */}
      <div className="tabs-selector-bar">
        <button
          onClick={() => setActiveTab('booking')}
          className={`detail-tab-btn${activeTab === 'booking' ? ' active' : ''}`}
        >
          <Ticket size={16} />
          {isSeated ? 'Sơ đồ chọn ghế' : 'Chọn khu vực & Đặt vé'}
        </button>
        <button
          onClick={() => setActiveTab('info')}
          className={`detail-tab-btn${activeTab === 'info' ? ' active' : ''}`}
        >
          <Info size={16} />
          Giới thiệu & Quy định
        </button>
      </div>

      {/* TAB: GIỚI THIỆU */}
      {activeTab === 'info' && (
        <div className="glass-panel animate-fade-in detail-info-panel">
          <div>
            <h3 className="detail-info-title">Mô tả chi tiết sự kiện</h3>
            <p className="detail-info-desc">{event.description}</p>

            <h4 className="detail-section-title-primary">Điểm nhấn nổi bật:</h4>
            <ul className="detail-highlights-list">
              {event.highlights?.map((h, i) => (
                <li key={i} className="detail-highlight-item">
                  <CheckCircle2
                    size={16}
                    color="var(--accent-emerald)"
                    className="detail-icon-fixed"
                  />
                  <span>{h}</span>
                </li>
              ))}
            </ul>

            <h4 className="detail-section-title-amber">Quy định tham gia sự kiện:</h4>
            <div className="detail-rules-box">
              {event.rules?.map((r, i) => (
                <div key={i} className="detail-rule-row">
                  <AlertTriangle
                    size={15}
                    color="var(--accent-amber)"
                    className="detail-rule-icon"
                  />
                  <span>{r}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Model xác nhận giữ các ghế còn lại */}
      <PartialHoldModal
        isOpen={Boolean(partialHoldPrompt)}
        onClose={handleCancelPartialHold}
        onConfirm={handleConfirmPartialHold}
        isSubmitting={isConfirmingPartial}
        unavailableSeats={partialHoldPrompt?.unavailableSeats || []}
        availableSeats={partialHoldPrompt?.availableSeats || []}
        seatPrice={singleSeatTier?.price || 0}
      />

      {/* TAB: BOOKING - Bước 1: Chọn vé */}
      {activeTab === 'booking' && bookingStep === 'booking' && (
        <div className="booking-layout-grid">
          {/* CỘT TRÁI */}
          <div className="glass-panel detail-left-panel">
            {/* Header thông báo */}
            <div className={`detail-notice${isUpcoming ? ' upcoming' : ''}`}>
              <div className="detail-notice-inner">
                <ShieldCheck
                  size={20}
                  color={isUpcoming ? 'var(--accent-amber)' : 'var(--primary-light)'}
                  className="detail-icon-fixed"
                />
                <span className="detail-notice-text">
                  {isUpcoming
                    ? 'Sự kiện sắp diễn ra - Hệ thống chưa mở bán vé chính thức.'
                    : isSeated
                      ? `Chế độ Seated-based: Quy mô ${backendSeats.length || event?.totalSeats || 84} ghế (${Object.keys(groupedSeats).length || event?.rowsCount || 7} hàng) • Đồng giá ${formatVND(singleSeatTier.price)} / ghế (Tối đa ${MAX_TICKETS_PER_ORDER} ghế).`
                      : `Chế độ Zone-based: Đặt vé theo khu vực đứng/vé mở • Tổng ${Object.values(backendZones).reduce((sum, z) => sum + (z.total || 0), 0) || event?.totalTickets || 0} vé phát hành (Tối đa ${MAX_TICKETS_PER_ORDER} vé).`}
                </span>
              </div>
            </div>

            {!isUpcoming && (isReserved || otherEventSession) && (
              <div className="detail-lock-notice" role="status">
                <div className="detail-lock-notice-inner">
                  {isReserved ? (
                    <Clock size={18} color="var(--accent-amber)" className="detail-icon-fixed" />
                  ) : (
                    <AlertTriangle
                      size={18}
                      color="var(--accent-amber)"
                      className="detail-icon-fixed"
                    />
                  )}
                  <span className="detail-lock-notice-text">
                    {isReserved && pendingPayment ? (
                      <>
                        Đơn <strong>#{pendingPayment.orderCode}</strong> đang chờ thanh toán. Bấm{' '}
                        <strong>Tiếp tục thanh toán</strong> hoặc bấm{' '}
                        <strong>Hủy đơn / Chọn lại ghế</strong> để chọn ghế khác.
                      </>
                    ) : isReserved ? (
                      <>
                        Bạn đang giữ{' '}
                        <strong>
                          {heldCount} {isSeated ? 'ghế' : 'vé'}
                        </strong>
                        . Bấm <strong>Thanh toán QR</strong> để hoàn tất, hoặc bấm{' '}
                        <strong>Hủy giữ ghế / Chọn lại</strong> nếu muốn đổi ghế khác.
                      </>
                    ) : (
                      <>
                        Bạn đang có phiên {otherSessionLabel} tại sự kiện{' '}
                        <strong>{otherEventTitle}</strong>. Vui lòng hoàn tất hoặc hủy ở thanh
                        thông báo phía trên để đặt vé sự kiện này.
                      </>
                    )}
                  </span>
                </div>
              </div>
            )}

            {/* SEATED-BASED: Sơ đồ ghế */}
            {isSeated && (
              <SeatSelector
                groupedSeats={groupedSeats}
                seats={backendSeats}
                tier={singleSeatTier}
                isUpcoming={isUpcoming}
                occupiedSeats={occupiedSeats}
                selectedSeats={selectedSeats}
                onToggleSeat={(seat) => handleToggleSeat(seat, singleSeatTier)}
                fallbackTotalSeats={event?.totalSeats}
                fallbackRowsCount={event?.rowsCount}
                isLocked={isSelectionLocked}
                lockMessage={lockMessage}
              />
            )}

            {/* ZONE-BASED */}
            {!isSeated && (
              <ZoneSelector
                backendZones={backendZones}
                zoneQuantities={zoneQuantities}
                zoneRemaining={zoneRemaining}
                totalZoneCount={totalZoneCount}
                isUpcoming={isUpcoming}
                handleUpdateZoneQty={handleUpdateZoneQty}
                isLocked={isSelectionLocked}
                lockMessage={lockMessage}
              />
            )}
          </div>

          {/* CỘT PHẢI: TỔNG QUAN ĐẶT VÉ */}
          <BookingSummary
            event={event}
            isSeated={isSeated}
            selectedSeats={selectedSeats}
            zoneQuantities={zoneQuantities}
            totalZoneCount={totalZoneCount}
            totalPrice={totalPrice}
            hasSelections={hasSelections}
            isReserved={isReserved}
            countdownSeconds={countdownSeconds}
            formatCountdown={formatCountdown}
            isProcessingPayment={isProcessingPayment}
            isUpcoming={isUpcoming}
            user={user}
            singleSeatTier={singleSeatTier}
            backendZones={backendZones}
            pendingPayment={pendingPayment}
            isReserving={isReserving}
            otherEventSession={otherEventSession}
            handleReserveSeats={handleReserveSeats}
            handlePayment={handlePayment}
            handleCancelReservation={handleCancelReservation}
            handlePrePaymentClick={handlePrePaymentClick}
          />
        </div>
      )}

      {/* ======== BƯỚC 3: THÀNH CÔNG (E-TICKET ĐÃ XÁC THỰC TỪ BACKEND) ======== */}
      {bookingStep === 'success' && (
        <div className="detail-success-wrap">
          <div className="glass-panel animate-fade-in detail-success-card">
            <div className="detail-success-icon">
              <CheckCircle2 size={36} />
            </div>

            <div className="detail-success-badge">
              <ShieldCheck size={14} /> Vé điện tử hợp lệ (E-Ticket)
            </div>

            <h3 className="detail-success-title">Thông tin Vé điện tử 🎉</h3>

            <p className="detail-success-text">
              Mã vé điện tử (E-Ticket) thuộc tài khoản{' '}
              <strong className="detail-strong-white">{successEmail}</strong> và được lưu trữ an toàn
              trong mục <strong className="detail-strong-cyan">Lịch sử đặt vé</strong>.
            </p>

            {/* Chi tiết vé */}
            <div className="detail-ticket-box">
              {paidOrderInfo?.orderCode && (
                <div className="detail-ticket-row">
                  <span className="detail-ticket-label">Mã đơn hàng:</span>
                  <span className="detail-ticket-value-accent">#{paidOrderInfo.orderCode}</span>
                </div>
              )}
              <div className="detail-ticket-row">
                <span className="detail-ticket-label">Sự kiện:</span>
                <span className="detail-ticket-value-title">{event.title}</span>
              </div>
              <div className="detail-ticket-row">
                <span className="detail-ticket-label">Thời gian:</span>
                <span className="detail-ticket-value">
                  {eventDate} • {eventTime}
                </span>
              </div>
              <div className="detail-ticket-row">
                <span className="detail-ticket-label">Địa điểm:</span>
                <span className="detail-ticket-value">{eventVenue}</span>
              </div>
              {isSeated ? (
                <div className="detail-ticket-row">
                  <span className="detail-ticket-label">Ghế ({singleSeatTier.name}):</span>
                  <span className="detail-ticket-value-accent">
                    {paidOrderInfo?.seatNumbers?.length > 0
                      ? paidOrderInfo.seatNumbers.join(', ')
                      : selectedSeats.map((s) => s.code).join(', ')}
                  </span>
                </div>
              ) : (
                <div className="detail-ticket-row">
                  <span className="detail-ticket-label">Khu vực / Số lượng:</span>
                  <span className="detail-ticket-value-accent-left">
                    {paidOrderInfo?.zoneSummary || `${totalZoneCount} vé`}
                  </span>
                </div>
              )}
              <div className="detail-ticket-total-row">
                <span className="detail-ticket-label-plain">Tổng thanh toán:</span>
                <span className="detail-ticket-total-value">
                  {formatVND(paidOrderInfo?.totalAmount ?? totalPrice)}
                </span>
              </div>
            </div>

            {!user && successEmail && (
              <div className="detail-claim-banner">
                <ShieldCheck size={18} className="detail-claim-icon" />
                <div className="detail-claim-body">
                  <div className="detail-claim-title">Muốn xem lại vé này sau này?</div>
                  <p className="detail-claim-text">
                    Đăng ký bằng đúng email {successEmail} để đặt mật khẩu cho tài khoản vừa tạo
                    — giữ nguyên vé đã mua, không cần mua lại.
                  </p>
                </div>
                <button
                  onClick={() =>
                    onClaimAccount
                      ? onClaimAccount(successEmail)
                      : toast.info('Vui lòng đăng ký bằng email vừa mua vé để nhận lại vé.')
                  }
                  className="glow-btn-primary detail-claim-btn"
                >
                  Đặt mật khẩu để xem lại vé
                </button>
              </div>
            )}

            <div className="detail-success-actions">
              <button
                onClick={() => {
                  setBookingStep('booking');
                }}
                className="detail-btn-secondary"
              >
                Quay lại sơ đồ đặt thêm vé
              </button>
              <button
                onClick={() => {
                  onBack && onBack();
                }}
                className="detail-btn-secondary"
              >
                Về danh sách sự kiện
              </button>
              <button
                onClick={() => {
                  if (onOpenCart) onOpenCart();
                  else if (onBack) onBack();
                }}
                className="glow-btn-primary detail-btn-cart"
              >
                <Ticket size={16} />
                Xem Lịch sử đặt vé
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
