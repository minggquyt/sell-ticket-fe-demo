import { useState, useEffect, useRef } from 'react';
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
  fetchSeatsByEvent,
  holdSeats,
  holdZones,
  startCheckout,
  releaseSeats,
  fetchOrderPayment,
  fetchMyActiveSession,
} from '../services/eventService';
import { formatVND } from '../utils/format.js';
import {
  RESERVATION_CHANGED_EVENT,
  clearReservation,
  formatCountdown,
  getSessionEffectiveExpiryMs,
  readReservation,
  saveReservation,
  syncServerReservationToStorage,
} from '../utils/paymentSession.js';
import { deriveSeatLayout } from '../utils/seatLayout.js';
import { useToast } from '../components/toastContext.js';
import SeatSelector from '../components/SeatSelector.jsx';
import ZoneSelector from '../components/ZoneSelector.jsx';
import BookingSummary from '../components/BookingSummary.jsx';
import ETicketModal from '../components/ETicketModal.jsx';
import './EventDetailPage.css';

export default function EventDetailPage({
  event,
  user,
  userOrders = [],
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
  // Xem lại vé điện tử E-Ticket bằng Modal
  const [viewingETicketOrder, setViewingETicketOrder] = useState(null);
  // Phiên thanh toán đang dở còn hạn được khôi phục lại (cho phép bấm Tiếp tục thanh toán)
  const [pendingPayment, setPendingPayment] = useState(null);
  const verifyingPendingRef = useRef(null);
  const activeGuest = {
    email: user?.email || '',
    fullName: user?.name || '',
  };

  const getOrderStatus = (o) => o?.status || o?.orderStatus || '';

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

  // Danh sách các đơn vé đã thanh toán thành công (SUCCESS) của user tại đúng sự kiện này
  const myPurchasedOrdersForEvent = Array.isArray(userOrders)
    ? userOrders.filter(
      (o) =>
        getOrderStatus(o) === 'SUCCESS' &&
        ((o.eventId && String(o.eventId) === String(event?.id)) ||
          (o.eventTitle && o.eventTitle === event?.title)),
    )
    : [];

  // Danh sách các đơn chờ hoàn tiền / đã hoàn tiền của user tại sự kiện này
  const myRefundOrdersForEvent = Array.isArray(userOrders)
    ? userOrders.filter(
      (o) =>
        (getOrderStatus(o) === 'REFUND_PENDING' || getOrderStatus(o) === 'REFUNDED') &&
        ((o.eventId && String(o.eventId) === String(event?.id)) ||
          (o.eventTitle && o.eventTitle === event?.title)),
    )
    : [];

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
  // Số giây còn lại để đếm ngược hiển thị lên giao diện
  const [countdownSeconds, setCountdownSeconds] = useState(0);
  // Trạng thái xử lý thanh toán
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const reservedStateRef = useRef({
    isReserved: false,
    reservedUntilTime: null,
    pendingOrderCode: null,
  });
  useEffect(() => {
    reservedStateRef.current = {
      isReserved,
      reservedUntilTime,
      pendingOrderCode: pendingPayment?.orderCode || null,
    };
  }, [isReserved, reservedUntilTime, pendingPayment?.orderCode]);

  // Helper lấy token & userId an toàn ngay cả khi state user ở App chưa kịp mount
  const getAuthContext = () => {
    if (user?.token && user?.id) {
      return { token: user.token, userId: user.id };
    }
    try {
      const saved = JSON.parse(localStorage.getItem('sellticket_user') || 'null');
      return {
        token: user?.token || saved?.token || null,
        userId: user?.id || saved?.id || null,
      };
    } catch {
      return { token: user?.token || null, userId: user?.id || null };
    }
  };

  // Hàm hỗ trợ gán màu sắc đẹp mắt cho từng zone dựa theo tên
  const getZoneColor = (name) => {
    const upper = (name || '').toUpperCase();
    if (upper.includes('VIP')) return '#ec4899'; // Hồng
    if (upper.includes('REGULAR') || upper.includes('STD')) return '#3b82f6'; // Xanh dương
    return '#10b981'; // Xanh lá mặc định
  };

  // Hàm đồng bộ và tải lại danh sách ghế/khu vực từ Backend
  const reloadBackendSeats = () => {
    if (!event?.id) return;

    fetchSeatsByEvent(event.id)
      .then((seats) => {
        if (!seats || seats.length === 0) return;
        const now = new Date();
        // 1. Phân loại logic cho SEATED-BASED
        if (event.is_seated || event.event_type === 'SEAT_BASED') {
          setBackendSeats(seats);
          const occupied = seats
            .filter((s) => {
              if (s.status === 'SOLD') return true;
              if (s.status === 'RESERVED' || s.status === 'PAYMENT_PROCESSING') {
                const isExpired = s.reserved_until ? new Date(s.reserved_until) < now : false;
                if (isExpired) return false;
                // Nếu là ghế do chính tài khoản này đang giữ thì không hiển thị là đã bị chiếm
                const isMySeat = user?.id && String(s.reserved_by) === String(user.id);
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
            const isAvailable =
              seat.status === 'AVAILABLE' ||
              ((seat.status === 'RESERVED' || seat.status === 'PAYMENT_PROCESSING') &&
                seat.reserved_until &&
                new Date(seat.reserved_until) < now);

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
      })
      .catch((err) => console.warn('Seats/Zones fetch error:', err));
  };

  // Đồng bộ lại khi prop thay đổi (ví dụ đổi sự kiện)
  useEffect(() => {
    if (initialOccupiedSeats) {
      setOccupiedSeats(new Set(initialOccupiedSeats));
    }
  }, [initialOccupiedSeats]);

  useEffect(() => {
    if (initialZoneRemaining && Object.keys(initialZoneRemaining).length > 0) {
      setZoneRemaining({ ...initialZoneRemaining });
    }
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
  }, [event?.id, user?.id]);

  // Polling realtime ghế (duyệt 31/10/2026, 3 giây): tải lại trạng thái ghế
  // liên tục để thấy ghế người khác giữ/mua mà không cần F5. Tạm dừng khi
  // tab bị ẩn, quay lại tab thì tải ngay + chạy tiếp; dừng hẳn khi rời trang.
  // Chỉ đọc lại ghế (kể cả zone), không đụng ghế đang chọn / đếm ngược / thanh toán.
  useEffect(() => {
    if (!event?.id) return;
    let intervalId = null;
    const startPolling = () => {
      if (intervalId !== null) return;
      intervalId = setInterval(() => {
        reloadBackendSeats();
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
        reloadBackendSeats();
        startPolling();
      }
    };
    startPolling();
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [event?.id, user?.id]);

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

    clearReservation(event.id);
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

  // Cho phép người dùng bấm xem lại chi tiết E-Ticket của bất kỳ đơn nào đã mua ngay trên trang sự kiện
  const handleViewPurchasedOrder = (order) => {
    setViewingETicketOrder(order);
  };

  // --- HÀM XỬ LÝ HỦY GIỮ GHẾ (Giải phóng ghế trên Database & hủy link PayOS nếu có) ---
  const handleCancelReservation = async (silent = false) => {
    try {
      const { token, userId: authUserId } = getAuthContext();
      const parsed = readReservation(event?.id);
      const activeOrderCode = parsed?.orderCode || pendingPayment?.orderCode;

      if (!silent && activeOrderCode) {
        const expRaw = pendingPayment?.expiresAt || parsed?.expiresAt || parsed?.reservedUntil;
        const expMs = expRaw ? new Date(expRaw).getTime() : NaN;
        const confirmMs = getSessionEffectiveExpiryMs({
          ...(parsed || {}),
          step: 'PAYMENT_PROCESSING',
          expiresAt: expRaw,
          confirmUntil: pendingPayment?.confirmUntil || parsed?.confirmUntil,
        });
        if (Number.isFinite(expMs) && Date.now() >= expMs && Number.isFinite(confirmMs) && Date.now() < confirmMs) {
          toast.warning('Đơn hàng đang trong quá trình xác nhận giao dịch với ngân hàng, vui lòng chờ giây lát.');
          navigate(`/checkout/${activeOrderCode}`);
          return;
        }
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
      const orderCodeToCancel = parsed?.orderCode || pendingPayment?.orderCode;

      // Reset state trên giao diện trước
      clearReservation(event?.id);
      setIsProcessingPayment(false);
      setPendingPayment(null);
      setIsReserved(false);
      setReservedUntilTime(null);
      setReservedSeatIds([]);
      if (isSeated) {
        setSelectedSeats([]);
      } else {
        setReservedZoneSeats([]);
        setZoneQuantities({});
      }

      // Gọi API Backend nhả ghế (và hủy link PayOS nếu ghế đang ở PAYMENT_PROCESSING)
      await releaseSeats(
        userIdToRelease,
        seatIdsToRelease,
        token,
        orderCodeToCancel,
      ).catch((e) => console.warn('releaseSeats API warning:', e));

      // Tải lại dữ liệu ghế mới nhất từ backend
      reloadBackendSeats();
      if (onRefreshOrders && orderCodeToCancel) onRefreshOrders();

      if (!silent) {
        toast.info('Đã hủy giữ chỗ và mở lại ghế thành công.');
      }
    } catch (err) {
      console.error('Lỗi khi hủy giữ ghế:', err);
      if (!silent) {
        toast.error(err.message || 'Không thể hủy giữ ghế. Vui lòng thử lại!');
      }
    }
  };

  // Format schema ghế từ BE
  const [groupedSeats, setGroupedSeats] = useState({});

  useEffect(() => {
    if (!backendSeats || backendSeats.length === 0) return;

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

    setGroupedSeats(formattedRows);
  }, [backendSeats]);

  useEffect(() => {
    if (!reservedUntilTime) return;

    const interval = setInterval(() => {
      const now = new Date().getTime();
      const expiryTime = new Date(reservedUntilTime).getTime();
      const distance = Math.max(0, Math.floor((expiryTime - now) / 1000));

      setCountdownSeconds(distance);

      if (distance <= 0) {
        clearInterval(interval);
        const currentSaved = readReservation(event?.id);
        if (!currentSaved) return;
        if (pendingPayment?.orderCode) {
          const { token } = getAuthContext();
          const confirmDeadlineMs = getSessionEffectiveExpiryMs({
            ...currentSaved,
            step: 'PAYMENT_PROCESSING',
            expiresAt: pendingPayment.expiresAt || currentSaved.expiresAt || reservedUntilTime,
            confirmUntil: pendingPayment.confirmUntil || currentSaved.confirmUntil,
          });
          if (Number.isFinite(confirmDeadlineMs) && confirmDeadlineMs > Date.now()) {
            // Đang trong cửa sổ CONFIRMING (120..150s): tuyệt đối không hủy đơn, cập nhật đếm ngược đến confirmUntil
            setReservedUntilTime(new Date(confirmDeadlineMs).toISOString());
            return;
          }

          fetchOrderPayment(pendingPayment.orderCode, token, { sync: false })
            .then((orderData) => {
              if (orderData?.status === 'SUCCESS') {
                triggerOrderSuccessUI(orderData, true);
                return;
              }
              clearReservation(event?.id);
              setPendingPayment(null);
              setIsReserved(false);
              setReservedUntilTime(null);
              setReservedSeatIds([]);
              if (isSeated) setSelectedSeats([]);
              else {
                setReservedZoneSeats([]);
                setZoneQuantities({});
              }
              reloadBackendSeats();
              if (onRefreshOrders) onRefreshOrders();
              if (orderData?.status === 'REFUND_PENDING') {
                toast.warning(
                  `Đơn #${orderData.orderCode} thanh toán muộn. Đã chuyển sang Chờ hoàn tiền!`,
                );
              } else {
                toast.warning('Phiên thanh toán đã hết hạn. Các ghế đã được mở lại!');
              }
            })
            .catch(() => {
              clearReservation(event?.id);
              setPendingPayment(null);
              setIsReserved(false);
              setReservedUntilTime(null);
              reloadBackendSeats();
            });
        } else {
          // Hết thời gian giữ ghế: tự động giải phóng ghế trên Backend và khôi phục giao diện
          handleCancelReservation(true).then(() => {
            toast.warning('Thời gian giữ ghế đã hết. Các ghế đã được mở lại!');
          });
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [reservedUntilTime, pendingPayment?.orderCode]);

  // --- LOGIC SEATED-BASED ---
  const handleToggleSeat = (seat, tier = singleSeatTier) => {
    // Nếu đang trong trạng thái giữ ghế (đếm ngược), không cho phép thay đổi lựa chọn
    if (isReserved) return;

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
        toast.warning('Bạn chỉ được chọn tối đa 4 ghế cho mỗi đơn hàng theo quy định!');
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
  const totalZoneCount = Object.values(zoneQuantities).reduce((acc, val) => acc + (val || 0), 0);

  const handleUpdateZoneQty = (zoneName, delta) => {
    const current = zoneQuantities[zoneName] || 0;
    const available =
      zoneRemaining[zoneName] ?? (event.zones?.find((z) => z.id === zoneName)?.remaining || 0);

    if (delta > 0) {
      if (totalZoneCount >= MAX_TICKETS_PER_ORDER) {
        toast.warning('Bạn chỉ được đặt tối đa 5 vé trong sự kiện Zone-based này!');
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
    if (!event?.id) return;

    // Phiên giữ ghế này có phải của người đang dùng trình duyệt này không
    const ownsReservation = (parsedData) => {
      if (!parsedData) return false;
      if (parsedData.userId && user?.id) return String(parsedData.userId) === String(user.id);
      return !parsedData.userId && !parsedData.guestEmail;
    };

    const restoreSeatsUI = (rawSeats = []) => {
      if (!Array.isArray(rawSeats) || rawSeats.length === 0) return;
      const normalizedIds = rawSeats.map((s) => s.id || s.seatId || s.seat_id).filter(Boolean);
      setReservedSeatIds(normalizedIds);
      if (isSeated) {
        setSelectedSeats(
          rawSeats.map((seat) => ({
            id: seat.id || seat.seatId || seat.seat_id,
            code: seat.seat_number || seat.seatNumber,
            tier: seat.zone_name || seat.zoneName || singleSeatTier.name || 'Standard',
            price: Number(seat.price) || singleSeatTier.price,
            color: singleSeatTier.color || '#3b82f6',
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
      setPendingPayment(null);
      setIsReserved(false);
      setReservedUntilTime(null);
      setReservedSeatIds([]);
      if (isSeated) setSelectedSeats([]);
      else {
        setReservedZoneSeats([]);
        setZoneQuantities({});
      }
      reloadBackendSeats();
    };

    const applySessionToUI = (session) => {
      restoreSeatsUI(session.seats);
      setIsReserved(true);
      setReservedUntilTime(session.expiresAt || session.reservedUntil);
      if (session.step === 'PAYMENT_PROCESSING') {
        setPendingPayment({
          orderCode: Number(session.orderCode),
          totalAmount: session.totalAmount ?? null,
          reservedUntil: session.expiresAt || session.reservedUntil,
          expiresAt: session.expiresAt || session.reservedUntil,
          confirmUntil: session.confirmUntil || null,
          phase: session.phase || null,
        });
      } else {
        setPendingPayment(null);
      }
    };

    const checkAndRestoreReservation = () => {
      const parsedData = readReservation(event.id);
      if (!parsedData) {
        const { token } = getAuthContext();
        if (!token || !user?.id) return;
        if (verifyingPendingRef.current === 'SESSION_SYNC') return;
        verifyingPendingRef.current = 'SESSION_SYNC';

        fetchMyActiveSession(token)
          .then((serverSession) => {
            if (!serverSession || String(serverSession.eventId) !== String(event.id)) return;
            const saved = syncServerReservationToStorage(user.id, serverSession, { silent: true });
            if (saved) applySessionToUI(saved);
          })
          .catch(() => {})
          .finally(() => {
            if (verifyingPendingRef.current === 'SESSION_SYNC') {
              verifyingPendingRef.current = null;
            }
          });
        return;
      }

      const now = new Date();
      const expiryTime = new Date(parsedData.reservedUntil);

      // NẾU ĐANG Ở BƯỚC PAYMENT_PROCESSING: giữ lại đến hết confirmUntil
      if (parsedData.step === 'PAYMENT_PROCESSING' && ownsReservation(parsedData)) {
        const effectiveDeadlineMs = getSessionEffectiveExpiryMs(parsedData);
        if (!Number.isFinite(effectiveDeadlineMs) || effectiveDeadlineMs <= now.getTime()) {
          clearReservation(event.id);
          resetLocalReservationUI();
          return;
        }

        const { token } = getAuthContext();
        if (!parsedData.orderCode || !token) return;
        if (verifyingPendingRef.current === parsedData.orderCode) return;
        verifyingPendingRef.current = parsedData.orderCode;

        fetchOrderPayment(parsedData.orderCode, token, { sync: false })
          .then((orderData) => {
            const st = orderData?.status;
            if (st === 'SUCCESS') {
              triggerOrderSuccessUI(orderData, true);
              return;
            }
            if (st === 'REFUND_PENDING') {
              clearReservation(event.id);
              resetLocalReservationUI();
              if (onRefreshOrders) onRefreshOrders();
              toast.warning(
                `Đơn #${orderData.orderCode} thanh toán sau khi hết hạn/hủy. Đã chuyển sang Chờ hoàn tiền!`,
              );
              return;
            }
            if (st !== 'PAYMENT_PROCESSING') {
              clearReservation(event.id);
              resetLocalReservationUI();
              if (onRefreshOrders) onRefreshOrders();
              return;
            }

            const serverExpiresAt = orderData.expiresAt || parsedData.expiresAt || parsedData.reservedUntil;
            const serverConfirmUntil =
              orderData.confirmUntil ||
              parsedData.confirmUntil ||
              new Date(new Date(serverExpiresAt).getTime() + 30 * 1000).toISOString();

            if (new Date(serverConfirmUntil).getTime() <= Date.now()) {
              clearReservation(event.id);
              resetLocalReservationUI();
              if (onRefreshOrders) onRefreshOrders();
              return;
            }

            const rawSeats =
              Array.isArray(parsedData.seats) && parsedData.seats.length > 0
                ? parsedData.seats
                : orderData.items || [];
            if (
              serverExpiresAt !== parsedData.expiresAt ||
              serverConfirmUntil !== parsedData.confirmUntil ||
              orderData.phase !== parsedData.phase
            ) {
              saveReservation(
                event.id,
                {
                  ...parsedData,
                  totalAmount: orderData.totalAmount ?? parsedData.totalAmount ?? null,
                  reservedUntil: serverExpiresAt,
                  expiresAt: serverExpiresAt,
                  confirmUntil: serverConfirmUntil,
                  phase: orderData.phase || parsedData.phase || null,
                  seats: rawSeats,
                },
                { silent: true },
              );
            }
            applySessionToUI({
              step: 'PAYMENT_PROCESSING',
              orderCode: Number(parsedData.orderCode),
              totalAmount: orderData.totalAmount ?? parsedData.totalAmount ?? null,
              reservedUntil: serverExpiresAt,
              expiresAt: serverExpiresAt,
              confirmUntil: serverConfirmUntil,
              phase: orderData.phase || null,
              seats: rawSeats,
            });
          })
          .catch((err) => {
            if (err?.status === 404 || err?.message?.includes('Không tìm thấy')) {
              clearReservation(event.id);
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

      // Kiểm tra xem phiên giữ ghế 30s còn hạn và có đúng là của user hiện tại không
      if (expiryTime > now && ownsReservation(parsedData)) {
        applySessionToUI(parsedData);
      } else {
        // Nếu đã quá hạn hoặc khác user -> Xóa rác trong localStorage và giải phóng ghế trên Backend
        clearReservation(event.id);
        if (parsedData.seats && Array.isArray(parsedData.seats)) {
          const ids = parsedData.seats.map((s) => s.id).filter(Boolean);
          if (ids.length > 0) {
            const token = user?.token;
            releaseSeats(parsedData.userId || user?.id, ids, token, null, parsedData.guestEmail || null)
              .then(() => reloadBackendSeats())
              .catch(() => { });
          }
        }
      }
    };

    const initTimer = setTimeout(checkAndRestoreReservation, 0);

    // Đồng bộ nếu người dùng hủy/cập nhật từ Sticky Banner hoặc thiết bị khác
    const handleReservationChanged = () => {
      const current = readReservation(event.id);
      if (!current) {
        if (reservedStateRef.current.isReserved) resetLocalReservationUI();
        return;
      }
      const {
        isReserved: curReserved,
        reservedUntilTime: curUntil,
        pendingOrderCode: curOrderCode,
      } = reservedStateRef.current;
      if (
        curReserved &&
        String(curUntil || '') === String(current.reservedUntil || '') &&
        Number(curOrderCode || 0) === Number(current.orderCode || 0)
      ) {
        return;
      }
      checkAndRestoreReservation();
    };

    // Bắt thêm sự kiện pageshow (khi trình duyệt khôi phục trang từ BFCache lúc bấm nút Back <-)
    const handlePageShow = (e) => {
      if (e.persisted) {
        setIsProcessingPayment(false);
        checkAndRestoreReservation();
      }
    };
    window.addEventListener(RESERVATION_CHANGED_EVENT, handleReservationChanged);
    window.addEventListener('storage', handleReservationChanged);
    window.addEventListener('pageshow', handlePageShow);
    return () => {
      clearTimeout(initTimer);
      window.removeEventListener(RESERVATION_CHANGED_EVENT, handleReservationChanged);
      window.removeEventListener('storage', handleReservationChanged);
      window.removeEventListener('pageshow', handlePageShow);
    };
  }, [event?.id, user?.id, isSeated]);

  // --- XỬ LÝ GIỮ GHẾ ---
  const handleReserveSeats = async () => {
    if (!user) {
      toast.info('Vui lòng đăng nhập để giữ chỗ.');
      onRequireLogin?.();
      return;
    }
    if (!hasSelections) {
      toast.warning('Vui lòng chọn vé trước khi tiến hành giữ chỗ!');
      return;
    }

    try {
      const token = user?.token;
      let seatIdsToCheckout = [];

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
        if (seatIdsToCheckout.length === 0) {
          throw new Error('Không tìm thấy thông tin ghế trên hệ thống backend.');
        }

        const holdData = await holdSeats(seatIdsToCheckout, token);
        const expiry = holdData?.reserved_until;
        const heldSeatsData = holdData?.seats || [];

        if (expiry) {
          setReservedSeatIds(holdData?.seatIds || seatIdsToCheckout);
          setReservedUntilTime(expiry);
          setIsReserved(true);

          saveReservation(
            event.id,
            {
              userId: user?.id,
              guestEmail: activeGuest.email || null,
              guestName: activeGuest.fullName || null,
              step: 'RESERVED',
              eventId: event.id,
              eventTitle: event.title,
              totalAmount: heldSeatsData.reduce((s, r) => s + (Number(r.price) || 0), 0) || totalPrice,
              reservedUntil: expiry,
              seats: heldSeatsData,
            },
          );
        } else {
          throw new Error('Không nhận được thời gian giữ chỗ từ hệ thống.');
        }
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

        if (returnedSeatIds.length === 0) {
          throw new Error('Không nhận được thời gian giữ chỗ hoặc danh sách ghế từ hệ thống.');
        }

        setReservedZoneSeats(returnedSeats);
        setReservedSeatIds(returnedSeatIds);
        setReservedUntilTime(expiry);
        setIsReserved(true);

        if (expiry) {
          saveReservation(
            event.id,
            {
              userId: user?.id,
              guestEmail: activeGuest.email || null,
              guestName: activeGuest.fullName || null,
              step: 'RESERVED',
              eventId: event.id,
              eventTitle: event.title,
              totalAmount: returnedSeats.reduce((s, r) => s + (Number(r.price) || 0), 0) || totalPrice,
              reservedUntil: expiry,
              seats: returnedSeats,
            },
          );
        } else {
          throw new Error('Không nhận được thời gian giữ chỗ từ hệ thống.');
        }
      }
    } catch (err) {
      console.error('Lỗi giữ ghế:', err);
      toast.error(err.response?.data?.message || err.message || 'Có lỗi xảy ra khi giữ ghế!');
    }
  };

  // --- TIẾP TỤC PHIÊN THANH TOÁN QR ĐANG DỞ ---
  const handleResumePendingPayment = () => {
    if (!pendingPayment?.orderCode) return;
    navigate(`/checkout/${pendingPayment.orderCode}`);
  };

  // --- XỬ LÝ KHỞI TẠO THANH TOÁN QR NỘI BỘ ---
  const handlePayment = async () => {
    try {
      setIsProcessingPayment(true);

      const token = user?.token;

      let seatIdsToCheckout = [];
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

      saveReservation(
        event.id,
        {
          ...savedObj,
          userId: user?.id,
          guestEmail: activeGuest.email || savedObj.guestEmail || null,
          guestName: activeGuest.fullName || savedObj.guestName || null,
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

      navigate(`/checkout/${orderCode}`, {
        state: { checkoutData: checkoutState },
      });
    } catch (err) {
      console.error('Lỗi thanh toán:', err);
      toast.error(
        err.response?.data?.message || err.message || 'Có lỗi xảy ra khi tạo giao dịch thanh toán!',
      );
      setIsProcessingPayment(false);
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
              {isSeated ? 'Seated-based (max 5 ghế)' : 'Zone-based (max 5 vé)'}
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
                      ? `Chế độ Seated-based: Quy mô ${backendSeats.length || event?.totalSeats || 84} ghế (${Object.keys(groupedSeats).length || event?.rowsCount || 7} hàng) • Đồng giá ${formatVND(singleSeatTier.price)} / ghế (Tối đa 5 ghế).`
                      : `Chế độ Zone-based: Đặt vé theo khu vực đứng/vé mở • Tổng ${Object.values(backendZones).reduce((sum, z) => sum + (z.total || 0), 0) || event?.totalTickets || 0} vé phát hành (Tối đa 5 vé).`}
                </span>
              </div>
            </div>

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

      {/* Modal xem lại vé điện tử E-Ticket khi bấm từ banner */}
      <ETicketModal
        isOpen={Boolean(viewingETicketOrder)}
        onClose={() => setViewingETicketOrder(null)}
        order={viewingETicketOrder}
        event={event}
        user={user}
      />
    </div>
  );
}
