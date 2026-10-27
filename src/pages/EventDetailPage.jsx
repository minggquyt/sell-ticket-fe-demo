import { useState, useEffect, useRef } from 'react';
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
  RotateCcw,
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
  fetchOrderStatus,
} from '../services/eventService';
import { formatVND } from '../utils/format.js';
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
  onAddToCart,
  onOpenCart,
  onRefreshOrders,
}) {
  const toast = useToast();
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
  // Theo dõi ngầm mã đơn hàng vừa mở PayOS (nếu khách bấm Hủy trên web nhưng ngay sau đó bấm chuyển tiền trên App ngân hàng đã quét sẵn)
  const [recentPendingOrderCode, setRecentPendingOrderCode] = useState(null);
  const handledUrlReturnRef = useRef(false);
  const hasProcessedBackRef = useRef(false);

  const getOrderStatus = (o) => o?.status || o?.orderStatus || '';

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
      totalAmount: verifiedTotal,
      seatNumbers,
      zoneSummary: zoneSummary || `${items.length} vé`,
      items,
      createdAt: orderData.createdAt,
    });

    localStorage.removeItem(`event_reservation_${event.id}`);
    setIsReserved(false);
    setReservedUntilTime(null);
    setReservedSeatIds([]);
    setIsProcessingPayment(false);
    setRecentPendingOrderCode(null);
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
      const storageKey = `event_reservation_${event?.id}`;
      const savedReservation = localStorage.getItem(storageKey);
      let parsed = null;
      if (savedReservation) {
        try {
          parsed = JSON.parse(savedReservation);
        } catch {
          /* Bỏ qua: dữ liệu giữ ghế lưu tạm không hợp lệ */
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

      // Reset state trên giao diện trước
      localStorage.removeItem(storageKey);
      setIsProcessingPayment(false);
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
      const orderCodeToCancel = parsed?.orderCode || recentPendingOrderCode;
      await releaseSeats(userIdToRelease, seatIdsToRelease, token, orderCodeToCancel).catch((e) =>
        console.warn('releaseSeats API warning:', e),
      );

      // Tải lại dữ liệu ghế mới nhất từ backend
      reloadBackendSeats();

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

  // --- KIỂM TRA KHI QUAY VỀ TỪ PAYOS (XÁC THỰC QUA BACKEND API HOẶC HỦY ĐƠN) ---
  useEffect(() => {
    if (!event?.id || handledUrlReturnRef.current) return;

    const params = new URLSearchParams(window.location.search);
    const status = params.get('status');
    const orderCode = params.get('orderCode');
    const isCancel =
      params.get('cancel') === 'true' ||
      status === 'CANCELLED' ||
      status === 'cancelled' ||
      status === 'cancel';

    if (!isCancel && !orderCode && !status) return;

    handledUrlReturnRef.current = true;
    const storageKey = `event_reservation_${event.id}`;
    if (isCancel) {
      localStorage.removeItem(storageKey);
      setIsReserved(false);
      setReservedUntilTime(null);
    }
    window.history.replaceState({}, '', window.location.pathname);

    // Nếu có orderCode (kể cả khi khách bấm Hủy hoặc Thành công): luôn hỏi Backend trước
    if (orderCode) {
      const { token } = getAuthContext();
      if (!token) {
        toast.error('Vui lòng đăng nhập để kiểm tra trạng thái đơn hàng.');
        return;
      }

      setIsProcessingPayment(true);
      fetchOrderStatus(orderCode, token)
        .then((res) => {
          const orderData = res?.data;
          if (orderData && orderData.status === 'SUCCESS') {
            triggerOrderSuccessUI(orderData, true);
          } else if (orderData && orderData.status === 'REFUND_PENDING') {
            // Đơn chuyển khoản muộn sau khi đã hủy/hết hạn và ghế đã có người khác chọn -> Chờ hoàn tiền!
            localStorage.removeItem(`event_reservation_${event.id}`);
            setIsReserved(false);
            setReservedUntilTime(null);
            setReservedSeatIds([]);
            setIsProcessingPayment(false);
            setRecentPendingOrderCode(null);
            reloadBackendSeats();
            if (onRefreshOrders) onRefreshOrders();
            toast.warning(
              `Đơn #${orderData.orderCode} được thanh toán sau khi đã hủy/hết hạn và ghế đã có người khác chọn. Khoản tiền đã chuyển sang trạng thái Chờ hoàn tiền (Refund)!`,
            );
          } else {
            // Đơn chưa thanh toán: tiến hành hủy giữ chỗ trên Backend & đóng link PayOS
            handleCancelReservation(true).then(() => {
              // Lưu lại mã đơn trong 90 giây để nếu khách trót quét QR trên điện thoại trước lúc bấm Hủy rồi mới bấm Chuyển tiền,
              // web sẽ tự động bắt được kết quả (Cấp vé nếu ghế trống hoặc Chờ hoàn tiền nếu ghế đã có người chọn)!
              setRecentPendingOrderCode(orderCode);
              if (isCancel) {
                toast.info(
                  'Bạn đã hủy giao dịch thanh toán. Các vị trí/vé đã chọn đã được mở lại để bạn có thể chọn tiếp.',
                );
              } else {
                toast.warning('Đơn hàng chưa được thanh toán hoặc đã bị hủy. Ghế đã được mở lại!');
              }
            });
          }
        })
        .catch((err) => {
          console.error('Lỗi xác thực đơn hàng:', err);
          setIsProcessingPayment(false);
          handleCancelReservation(true);
        });
      return;
    }

    // Trường hợp chỉ có cancel=true mà không có orderCode trên URL
    if (isCancel) {
      handleCancelReservation(true).then(() => {
        toast.info(
          'Bạn đã hủy giao dịch thanh toán. Các vị trí/vé đã chọn đã được mở lại để bạn có thể chọn tiếp.',
        );
      });
      return;
    }

    // Trường hợp 3: Khách tự gõ ?status=success lên URL mà không có orderCode hợp lệ -> Chặn!
    toast.error('Không tìm thấy mã đơn hàng hợp lệ để xác thực thanh toán!');
  }, [event?.id]);

  // --- THEO DÕI NGẦM ĐƠN VỪA HỦY/QUAY VỀ TRONG 90 GIÂY (BẮT TRƯỜNG HỢP QUÉT QR TRƯỚC RỒI BẤM HỦY XONG MỚI CHUYỂN TIỀN) ---
  useEffect(() => {
    if (!recentPendingOrderCode || bookingStep === 'success') return;
    const { token } = getAuthContext();
    if (!token) return;

    let attempts = 0;
    const maxAttempts = 18; // 18 * 5s = 90 giây
    const timer = setInterval(async () => {
      attempts += 1;
      if (attempts > maxAttempts) {
        clearInterval(timer);
        setRecentPendingOrderCode(null);
        return;
      }
      try {
        const res = await fetchOrderStatus(recentPendingOrderCode, token);
        const orderData = res?.data;
        if (orderData && orderData.status === 'SUCCESS') {
          clearInterval(timer);
          toast.success(
            `Hệ thống đã ghi nhận khoản thanh toán cho đơn #${orderData.orderCode} (ghế vẫn còn trống) và phát hành vé thành công!`,
          );
          triggerOrderSuccessUI(orderData, true);
        } else if (orderData && orderData.status === 'REFUND_PENDING') {
          clearInterval(timer);
          setRecentPendingOrderCode(null);
          reloadBackendSeats();
          if (onRefreshOrders) onRefreshOrders();
          toast.warning(
            `Hệ thống ghi nhận bạn vừa chuyển khoản cho đơn #${orderData.orderCode} sau khi đã hủy/hết hạn, nhưng ghế đã có người khác giữ/mua. Đơn đã được chuyển sang Chờ hoàn tiền (Refund)!`,
          );
        }
      } catch {
        /* Bỏ qua lỗi mạng tạm thời khi polling ngầm */
      }
    }, 5000);

    return () => clearInterval(timer);
  }, [recentPendingOrderCode, bookingStep]);

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
        // Hết thời gian giữ ghế: tự động giải phóng ghế trên Backend và khôi phục giao diện
        handleCancelReservation(true).then(() => {
          toast.warning('Thời gian giữ ghế đã hết. Các ghế đã được mở lại!');
        });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [reservedUntilTime]);

  // Hàm format giây thành dạng MM:SS để hiển thị cho đẹp
  const formatCountdown = (totalSeconds) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // --- LOGIC SEATED-BASED ---
  const handleToggleSeat = (seat, tier = singleSeatTier) => {
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
        toast.warning('Bạn chỉ được chọn tối đa 5 ghế cho mỗi đơn hàng theo quy định!');
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

  const totalZonePrice = Object.entries(zoneQuantities).reduce((acc, [zoneName, qty]) => {
    const zoneInfo = backendZones[zoneName];
    const price = zoneInfo ? Number(zoneInfo.price) : 0;

    return acc + qty * price;
  }, 0);

  // Biến lưu tổng số tiền vé mà user đang giữ
  const totalPrice = isSeated ? totalSeatedPrice : totalZonePrice;
  const hasSelections = isSeated ? selectedSeats.length > 0 : totalZoneCount > 0;

  // --- KHÔI PHỤC PHIÊN GIỮ GHẾ KHI REFRESH HOẶC TỰ HỦY KHI BẤM NÚT BACK (<-) TỪ PAYOS ---
  useEffect(() => {
    if (!event?.id || !user?.id) return;
    if (handledUrlReturnRef.current) return;

    // Nếu trên URL đang có tham số trả về từ PayOS thì nhường cho useEffect xử lý redirect ở trên
    const searchParams = new URLSearchParams(window.location.search);
    if (
      searchParams.get('orderCode') ||
      searchParams.get('cancel') ||
      searchParams.get('status')
    ) {
      return;
    }

    const storageKey = `event_reservation_${event.id}`;

    const checkAndRestoreReservation = () => {
      if (hasProcessedBackRef.current) return;
      const savedReservation = localStorage.getItem(storageKey);
      if (!savedReservation) return;

      try {
        const parsedData = JSON.parse(savedReservation);
        const now = new Date();
        const expiryTime = new Date(parsedData.reservedUntil);

        // NẾU ĐANG Ở BƯỚC PAYMENT_PROCESSING MÀ QUAY LẠI TRANG NÀY (BẤM NÚT BACK <- TRÌNH DUYỆT):
        // Kiểm tra xem đơn đã thanh toán trên PayOS chưa trước khi hủy
        if (parsedData.step === 'PAYMENT_PROCESSING' && parsedData.userId === user.id) {
          hasProcessedBackRef.current = true;
          localStorage.removeItem(storageKey);
          setIsReserved(false);
          setReservedUntilTime(null);
          const { token } = getAuthContext();
          if (parsedData.orderCode && token) {
            fetchOrderStatus(parsedData.orderCode, token)
              .then((res) => {
                const orderData = res?.data;
                if (orderData && orderData.status === 'SUCCESS') {
                  triggerOrderSuccessUI(orderData, true);
                } else if (orderData && orderData.status === 'REFUND_PENDING') {
                  localStorage.removeItem(storageKey);
                  setIsReserved(false);
                  setReservedUntilTime(null);
                  setReservedSeatIds([]);
                  reloadBackendSeats();
                  if (onRefreshOrders) onRefreshOrders();
                  toast.warning(
                    `Đơn #${orderData.orderCode} được thanh toán muộn khi ghế đã có người khác chọn và đã chuyển sang trạng thái Chờ hoàn tiền!`,
                  );
                } else {
                  setRecentPendingOrderCode(parsedData.orderCode);
                  handleCancelReservation(true).then(() => {
                    toast.info(
                      'Bạn đã quay lại từ trang thanh toán. Đơn hàng trước đó đã được hủy và ghế đã được mở lại!',
                    );
                  });
                }
              })
              .catch(() => {
                setRecentPendingOrderCode(parsedData.orderCode);
                handleCancelReservation(true);
              });
          } else {
            handleCancelReservation(true).then(() => {
              toast.info(
                'Bạn đã quay lại từ trang thanh toán. Đơn hàng trước đó đã được hủy và ghế đã được mở lại!',
              );
            });
          }
          return;
        }

        // Kiểm tra xem phiên giữ ghế 30s còn hạn và có đúng là của user hiện tại không
        if (expiryTime > now && parsedData.userId === user.id) {
          if (isSeated) {
            setIsReserved(true);
            setReservedUntilTime(parsedData.reservedUntil);

            if (parsedData.seats && Array.isArray(parsedData.seats)) {
              setReservedSeatIds(parsedData.seats.map((s) => s.id).filter(Boolean));
              const restoredSeats = parsedData.seats.map((seat) => {
                const seatCode = seat.seat_number;
                const tierName = seat.zone_name || singleSeatTier.name || 'Standard';

                return {
                  id: seat.id,
                  code: seatCode,
                  tier: tierName,
                  price: seat.price,
                  color: singleSeatTier.color || '#3b82f6',
                };
              });

              setSelectedSeats(restoredSeats);
            }
          } else {
            setIsReserved(true);
            setReservedUntilTime(parsedData.reservedUntil);

            if (parsedData.seats && Array.isArray(parsedData.seats)) {
              setReservedSeatIds(parsedData.seats.map((s) => s.id).filter(Boolean));
              setReservedZoneSeats(parsedData.seats);

              const restoredQuantities = {};
              parsedData.seats.forEach((seat) => {
                const zoneName = seat.zone_name;
                if (zoneName) {
                  restoredQuantities[zoneName] = (restoredQuantities[zoneName] || 0) + 1;
                }
              });

              setZoneQuantities(restoredQuantities);
            }
          }
        } else {
          // Nếu đã quá hạn hoặc khác user -> Xóa rác trong localStorage và giải phóng ghế trên Backend
          localStorage.removeItem(storageKey);
          if (parsedData.seats && Array.isArray(parsedData.seats)) {
            const ids = parsedData.seats.map((s) => s.id).filter(Boolean);
            if (ids.length > 0) {
              const token = user?.token;
              releaseSeats(parsedData.userId || user?.id, ids, token)
                .then(() => reloadBackendSeats())
                .catch(() => {});
            }
          }
        }
      } catch (err) {
        console.error('Lỗi khi đọc dữ liệu giữ ghế từ localStorage:', err);
        localStorage.removeItem(storageKey);
      }
    };

    checkAndRestoreReservation();

    // Bắt thêm sự kiện pageshow (khi trình duyệt khôi phục trang từ BFCache lúc bấm nút Back <-)
    const handlePageShow = (e) => {
      if (e.persisted) {
        setIsProcessingPayment(false);
        checkAndRestoreReservation();
      }
    };
    window.addEventListener('pageshow', handlePageShow);
    return () => window.removeEventListener('pageshow', handlePageShow);
  }, [event?.id, user?.id, isSeated]);

  // --- XỬ LÝ GIỮ GHẾ ---
  const handleReserveSeats = async () => {
    if (!user) {
      if (onRequireLogin) onRequireLogin();
      else toast.warning('Vui lòng đăng nhập để tiếp tục!');
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

        const holdRes = await holdSeats(seatIdsToCheckout, token);
        if (holdRes && holdRes.success === false) {
          throw new Error(holdRes.message || 'Không thể giữ các ghế đã chọn');
        }

        const expiry = holdRes?.data?.reserved_until || holdRes?.reserved_until;
        const heldSeatsData = holdRes?.data?.seats || [];

        if (expiry) {
          setReservedSeatIds(holdRes?.data?.seatIds || seatIdsToCheckout);
          setReservedUntilTime(expiry);
          setIsReserved(true);

          const storageKey = `event_reservation_${event.id}`;
          localStorage.setItem(
            storageKey,
            JSON.stringify({
              userId: user?.id,
              step: 'RESERVED',
              reservedUntil: expiry,
              seats: heldSeatsData,
            }),
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

        const holdRes = await holdZones(event.id, selections, token);
        if (holdRes && holdRes.success === false) {
          throw new Error(holdRes.message || 'Không thể giữ chỗ theo khu vực đã chọn');
        }

        const returnedSeats = holdRes?.data?.seats || [];
        const returnedSeatIds = holdRes?.data?.seatIds || [];
        const expiry = holdRes?.data?.reserved_until || holdRes?.reserved_until;

        if (returnedSeatIds.length === 0) {
          throw new Error('Không nhận được thời gian giữ chỗ hoặc danh sách ghế từ hệ thống.');
        }

        setReservedZoneSeats(returnedSeats);
        setReservedSeatIds(returnedSeatIds);
        setReservedUntilTime(expiry);
        setIsReserved(true);

        if (expiry) {
          const storageKey = `event_reservation_${event.id}`;
          localStorage.setItem(
            storageKey,
            JSON.stringify({
              userId: user?.id,
              step: 'RESERVED',
              reservedUntil: expiry,
              seats: returnedSeats,
            }),
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

  // --- XỬ LÝ THANH TOÁN QUA PAYOS ---
  const handlePayment = async () => {
    try {
      handledUrlReturnRef.current = false;
      hasProcessedBackRef.current = false;
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

      // PayOS sẽ tự gắn ?code=00&status=PAID&orderCode=... hoặc ?cancel=true&status=CANCELLED&orderCode=...
      const returnUrl = `${window.location.origin}/events/${event.id}`;
      const cancelUrl = `${window.location.origin}/events/${event.id}`;

      const checkoutRes = await startCheckout(seatIdsToCheckout, returnUrl, cancelUrl, token);

      if (checkoutRes && checkoutRes.success === false) {
        throw new Error(checkoutRes.message || 'Không thể tạo đơn hàng thanh toán qua PayOS');
      }

      const checkoutUrl = checkoutRes?.data?.checkoutUrl || checkoutRes?.checkoutUrl;
      const orderCode = checkoutRes?.data?.orderCode || checkoutRes?.orderCode;
      const paymentTimeout =
        checkoutRes?.data?.paymentTimeout || new Date(Date.now() + 120 * 1000).toISOString();

      if (checkoutUrl) {
        // Lưu cờ step = 'PAYMENT_PROCESSING' & orderCode vào localStorage trước khi chuyển hướng sang PayOS
        const storageKey = `event_reservation_${event.id}`;
        let savedObj = {};
        try {
          const existing = localStorage.getItem(storageKey);
          if (existing) savedObj = JSON.parse(existing);
        } catch {
          /* ignore */
        }

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

        localStorage.setItem(
          storageKey,
          JSON.stringify({
            ...savedObj,
            userId: user?.id,
            step: 'PAYMENT_PROCESSING',
            orderCode,
            reservedUntil: paymentTimeout,
            seats: seatsSnapshot,
          }),
        );

        window.location.href = checkoutUrl;
      } else {
        throw new Error(checkoutRes?.message || 'Không nhận được đường dẫn thanh toán từ PayOS');
      }
    } catch (err) {
      console.error('Lỗi thanh toán:', err);
      toast.error(
        err.response?.data?.message || err.message || 'Có lỗi xảy ra khi tạo giao dịch thanh toán!',
      );
      setIsProcessingPayment(false);
    }
  };

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
            handleReserveSeats={handleReserveSeats}
            handlePayment={handlePayment}
            handleCancelReservation={handleCancelReservation}
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
              <strong className="detail-strong-white">{user?.email}</strong> và được lưu trữ an toàn
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
