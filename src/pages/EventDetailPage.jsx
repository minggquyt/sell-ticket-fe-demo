import { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Clock,
  ShieldCheck,
  Info,
  Armchair,
  Layers,
  Plus,
  Minus,
  CheckCircle2,
  AlertTriangle,
  CreditCard,
  Ticket,
  ShoppingCart,
  ChevronUp,
  ChevronDown
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  formatEventDate,
  formatEventTime,
  isSeatedEvent,
  getEventVenue,
  getSingleSeatTier,
  isUpcomingEvent
} from '../data/events';
import {
  fetchSeatsByEvent,
  holdSeats,
  holdZones,
  startCheckout,
  releaseSeats
} from '../services/eventService';

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
  onAddToCart,
  onOpenCart
}) {
  const isSeated = isSeatedEvent(event);
  const singleSeatTier = getSingleSeatTier(event);
  const eventVenue = getEventVenue(event);
  const eventDate = formatEventDate(event);
  const eventTime = formatEventTime(event) || event?.time || '';

  // Xác định sự kiện sắp diễn ra / chưa mở bán vé
  const isUpcoming = propIsUpcoming !== undefined
    ? Boolean(propIsUpcoming)
    : propIsUpComing !== undefined
      ? Boolean(propIsUpComing)
      : isUpcomingEvent(event);

  const [activeTab, setActiveTab] = useState('booking');
  // 'booking' | 'payment' | 'success'
  const [bookingStep, setBookingStep] = useState('booking');
  // State mở drawer chi tiết trên mobile bottom bar
  const [isMobileSummaryOpen, setIsMobileSummaryOpen] = useState(false);

  // SEATED-BASED STATE
  const [occupiedSeats, setOccupiedSeats] = useState(
    () => initialOccupiedSeats ? new Set(initialOccupiedSeats) : new Set(['A-3', 'A-4', 'B-5', 'C-1', 'C-2', 'D-7', 'E-4', 'F-5'])
  );
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [reservedZoneSeats, setReservedZoneSeats] = useState([]);
  const [backendZones, setBackendZones] = useState({});
  const [zoneRemaining, setZoneRemaining] = useState({});
  const [zoneQuantities, setZoneQuantities] = useState({});

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

  const [backendSeats, setBackendSeats] = useState([]);

  // Đồng bộ trực tiếp danh sách ghế từ Backend
  useEffect(() => {
    if (!event?.id) return;

    fetchSeatsByEvent(event.id)
      .then(seats => {
        if (!seats || seats.length === 0) return;
        // 1. Phân loại logic cho SEATED-BASED
        if (event.is_seated || event.event_type === "SEAT_BASED") {
          setBackendSeats(seats);
          const sold = seats
            .filter(s => s.status === 'SOLD' || s.status === 'RESERVED' || s.status === 'PAYMENT_PROCESSING')
            .map(s => {
              const num = s.seat_number;
              return /^[A-G]\d+$/.test(num) ? `${num.charAt(0)}-${num.slice(1)}` : num;
            });
          if (sold.length > 0) {
            setOccupiedSeats(prev => new Set([...prev, ...sold]));
          }
        }

        // 2. Phân loại logic cho ZONE-BASED
        else {
          const zoneMap = {};
          const remainingMap = {};

          // Thuật toán gom nhóm theo zone_based
          seats.forEach(seat => {
            const zoneName = seat.zone_name || 'STANDARD'; // Lấy tên khu vực chuẩn từ BE
            const price = Number(seat.price) || 0;
            const isAvailable = seat.status === 'AVAILABLE';

            if (!zoneMap[zoneName]) {
              zoneMap[zoneName] = {
                name: zoneName,
                price: price,
                total: 0,
                remaining: 0,
                color: getZoneColor(zoneName) // Hàm phụ trợ gán màu sắc giao diện
              };
            }

            zoneMap[zoneName].total += 1;
            if (isAvailable) {
              zoneMap[zoneName].remaining += 1;
            }
          });

          // Đổ dữ liệu vào state để render UI
          setBackendZones(zoneMap);

          // Tạo map remaining để map nhanh với state đếm số lượng chọn mua
          Object.keys(zoneMap).forEach(zName => {
            remainingMap[zName] = zoneMap[zName].remaining;
          });
          setZoneRemaining(remainingMap);
        }
      })
      .catch(err => console.warn('Seats/Zones fetch error:', err));
  }, [event?.id]);

  // Hàm hỗ trợ gán màu sắc đẹp mắt cho từng zone dựa theo tên
  const getZoneColor = (name) => {
    const upper = name.toUpperCase();
    if (upper.includes('VIP')) return '#ec4899'; // Hồng
    if (upper.includes('REGULAR') || upper.includes('STD')) return '#3b82f6'; // Xanh dương
    return '#10b981'; // Xanh lá mặc định
  };

  // Kiểm tra nếu được redirect về từ PayOS thành công
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('status') === 'success') {
      confetti({ particleCount: 150, spread: 90, origin: { y: 0.6 } });
      setBookingStep('success');
      if (onPaymentSuccess && event?.id) {
        onPaymentSuccess(event.id, event.event_type || event.type, selectedSeats, zoneQuantities);
      }
      if (onAddToCart && event?.id) {
        onAddToCart({
          id: 'ticket_' + Date.now(),
          eventId: event.id,
          eventTitle: event.title,
          eventDate,
          eventTime,
          venue: eventVenue,
          type: isSeated ? 'seated' : 'zone',
          seats: selectedSeats,
          zoneQuantities,
          createdAt: new Date().toISOString()
        });
      }
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [event?.id, event?.title, event?.event_type, event?.type, eventDate, eventTime, eventVenue, isSeated, onAddToCart, onPaymentSuccess, selectedSeats, zoneQuantities]);

  // Format schema ghế từ BE 
  const [groupedSeats, setGroupedSeats] = useState({});

  useEffect(() => {
    if (!backendSeats || backendSeats.length === 0) return;

    // Thuật toán nhóm các ghế theo hàng (Ví dụ: "A1" -> Hàng "A", Ghế số "1")
    const formattedRows = backendSeats.reduce((acc, seat) => {
      // Tách phần chữ cái (hàng) và phần số (cột/số ghế) từ seat_number (VD: "A12" -> hàng "A", số "12")
      const match = seat.seat_number.match(/^([A-Za-z]+)(\d+)?$/);
      if (!match) return acc;

      const rowName = match[1].toUpperCase(); // Lấy chữ cái làm tên hàng (VD: 'A', 'B')
      const colNumber = parseInt(match[2], 10); // Lấy phần số

      if (!acc[rowName]) {
        acc[rowName] = [];
      }

      // Đẩy toàn bộ object ghế vào mảng của hàng tương ứng để tận dụng luôn thông tin id, status từ BE
      acc[rowName].push({
        ...seat,
        colNumber
      });

      return acc;
    }, {});

    // Sắp xếp các số ghế trong từng hàng tăng dần (1, 2, 3, ...)
    Object.keys(formattedRows).forEach(row => {
      formattedRows[row].sort((a, b) => a.colNumber - b.colNumber);
    });

    // Lưu vào state để render giao diện
    setGroupedSeats(formattedRows);
  }, [backendSeats]);

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

  useEffect(() => {
    if (!reservedUntilTime) return;

    const interval = setInterval(() => {
      const now = new Date().getTime();
      const expiryTime = new Date(reservedUntilTime).getTime();
      const distance = Math.max(0, Math.floor((expiryTime - now) / 1000));

      setCountdownSeconds(distance);

      if (distance <= 0) {
        clearInterval(interval);
        // Hết thời gian giữ ghế: reset lại trạng thái để người dùng chọn lại
        setIsReserved(false);
        setReservedUntilTime(null);
        setReservedSeatIds([]);
        alert('⏰ Thời gian giữ ghế đã hết. Vui lòng thực hiện lại!');
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

  // Format currency
  const formatVND = (val) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);

  // --- LOGIC SEATED-BASED ---
  const handleToggleSeat = (seat, tier = singleSeatTier) => {
    const seatId = seat.id;
    const seatCode = seat.seat_number;
    if (occupiedSeats.has(seatCode)) return;
    const isAlreadySelected = selectedSeats.some(s => s.code === seatCode);
    if (isAlreadySelected) {
      setSelectedSeats(prev => prev.filter(s => s.code !== seatCode));
    } else {
      if (selectedSeats.length >= 5) {
        alert('⚠️ Bạn chỉ được chọn tối đa 5 ghế cho mỗi đơn hàng theo quy định!');
        return;
      }
      const match = backendSeats.find(bs => bs.seat_number === seatCode || bs.seat_number === seatCode.replace('-', ''));

      setSelectedSeats(prev => [...prev, {
        id: match?.id,
        code: seatCode,
        tier: tier.name || singleSeatTier.name,
        price: seat.price,
        color: tier.color || singleSeatTier.color
      }]);
    }
  };

  // --- HÀM XỬ LÝ HỦY GIỮ GHẾ (Đã tích hợp gọi API Backend) ---
  const handleCancelReservation = async () => {
    try {
      const token = localStorage.getItem('token') || user?.token;

      // Lấy danh sách seatIds đang được giữ tùy theo loại sự kiện
      let seatIdsToRelease = [];
      if (isSeated) {
        seatIdsToRelease = selectedSeats.map(s => s.id).filter(Boolean);
      } else {
        seatIdsToRelease = reservedZoneSeats.map(s => s.id).filter(Boolean);
      }

      // Nếu có ID ghế, gọi API yêu cầu Backend nhả khóa ghế trong Database
      if (seatIdsToRelease.length > 0 && user?.id) {
        await releaseSeats(user.id, seatIdsToRelease, token);
      }

      // 1. Xóa dữ liệu giữ chỗ trong localStorage
      const storageKey = `event_reservation_${event.id}`;
      localStorage.removeItem(storageKey);

      // 2. Reset lại toàn bộ state liên quan đến việc giữ ghế ở Frontend
      setIsReserved(false);
      setReservedUntilTime(null);

      if (isSeated) {
        setSelectedSeats([]);
      } else {
        setReservedZoneSeats([]);
        setZoneQuantities({});
      }

      console.log("🚫 Đã hủy phiên giữ ghế thành công trên cả Database và Frontend.");
    } catch (err) {
      console.error("Lỗi khi hủy giữ ghế:", err);
      alert('⚠️ ' + (err.message || 'Không thể hủy giữ ghế. Vui lòng thử lại!'));
    }
  };

  const totalSeatedPrice = selectedSeats.reduce((acc, curr) => {
    return acc + parseFloat(curr.price)
  }, 0);


  // --- LOGIC ZONE-BASED ---
  const totalZoneCount = Object.values(zoneQuantities).reduce((acc, val) => acc + (val || 0), 0);

  const handleUpdateZoneQty = (zoneName, delta) => {
    const current = zoneQuantities[zoneName] || 0;
    const available = zoneRemaining[zoneName] ?? (event.zones?.find(z => z.id === zoneName)?.remaining || 0);

    if (delta > 0) {
      if (totalZoneCount >= 5) {
        alert('⚠️ Bạn chỉ được đặt tối đa 5 vé trong sự kiện Zone-based này!');
        return;
      }
      if (current >= available) {
        alert('⚠️ Khu vực này hiện chỉ còn lại ' + available + ' vé khả dụng!');
        return;
      }
    }
    const nextVal = Math.max(0, current + delta);
    setZoneQuantities(prev => {
      const currentQty = prev[zoneName] || 0;
      const newQty = Math.max(0, currentQty + delta);
      return { ...prev, [zoneName]: newQty };
    });
  };


  const totalZonePrice = Object.entries(zoneQuantities).reduce((acc, [zoneName, qty]) => {
    // Lấy thông tin zone tương ứng từ state backendZones đã được fetch từ BE
    const zoneInfo = backendZones[zoneName];
    const price = zoneInfo ? Number(zoneInfo.price) : 0;

    return acc + (qty * price);
  }, 0);

  // Biến global lưu tổng số tiền vé mà user đang giữ
  let totalPrice = isSeated ? totalSeatedPrice : totalZonePrice;
  const hasSelections = isSeated ? selectedSeats.length > 0 : totalZoneCount > 0;

  // --- KHÔI PHỤC PHIÊN GIỮ GHẾ KHI REFRESH (SEATED-BASED) ---
  useEffect(() => {
    if (!event?.id || !user?.id) return;

    const storageKey = `event_reservation_${event.id}`;
    const savedReservation = localStorage.getItem(storageKey);

    if (!savedReservation) return;

    try {
      const parsedData = JSON.parse(savedReservation);
      const now = new Date();
      const expiryTime = new Date(parsedData.reservedUntil);

      // Kiểm tra xem phiên giữ ghế còn hạn và có đúng là của user hiện tại không
      if (expiryTime > now && parsedData.userId === user.id) {
        // KHÔI PHỤC CHO EVENT SEAT_BASED
        if (isSeated) {
          // 1. Cập nhật trạng thái giữ ghế & thời gian đếm ngược
          setIsReserved(true);
          setReservedUntilTime(parsedData.reservedUntil);

          // 2. Khôi phục lại mảng selectedSeats chuẩn theo cấu trúc của handleToggleSeat
          if (parsedData.seats && Array.isArray(parsedData.seats)) {
            const restoredSeats = parsedData.seats.map(seat => {
              const seatCode = seat.seat_number;
              // Tìm tier hoặc fallback về singleSeatTier
              const tierName = seat.zone_name || singleSeatTier.name || 'Standard';

              return {
                id: seat.id,
                code: seatCode,
                tier: tierName,
                price: seat.price,
                color: singleSeatTier.color || '#3b82f6'
              };
            });

            // cập nhập lại biến global totalPrice: 
            totalPrice = restoredSeats.reduce((acc, curr) => {
              return acc + parseFloat(curr.price)
            }, 0);

            setSelectedSeats(restoredSeats);
          }
        }
        else {
          // KHÔI PHỤC GHẾ CHO EVENT ZONE_BASED
          // 1. Cập nhật trạng thái giữ ghế & thời gian đếm ngược
          setIsReserved(true);
          setReservedUntilTime(parsedData.reservedUntil);

          // 2. Khôi phục danh sách ghế trả về từ DB để phục vụ bước thanh toán (handlePayment)
          if (parsedData.seats && Array.isArray(parsedData.seats)) {
            setReservedZoneSeats(parsedData.seats);

            // 3. Khôi phục lại số lượng vé đã chọn theo từng zone (zoneQuantities) dựa trên các ghế đã lưu
            const restoredQuantities = {};
            parsedData.seats.forEach(seat => {
              const zoneName = seat.zone_name;
              if (zoneName) {
                restoredQuantities[zoneName] = (restoredQuantities[zoneName] || 0) + 1;
              }
            });

            // cập nhập lại biến global totalPrice: 
            totalPrice = parsedData.seats.reduce((acc, seat) => {
              return acc + parseFloat(seat.price || 0);
            }, 0);

            setZoneQuantities(restoredQuantities);
          }
        }
      } else {
        // Nếu đã quá hạn hoặc khác user -> Xóa rác trong localStorage
        localStorage.removeItem(storageKey);
      }
    } catch (err) {
      console.error("Lỗi khi đọc dữ liệu giữ ghế từ localStorage:", err);
      localStorage.removeItem(storageKey);
    }
  }, [event?.id, user?.id, isSeated]);

  // --- XỬ LÝ GIỮ GHẾ ---
  const handleReserveSeats = async () => {
    if (!user) {
      if (onRequireLogin) onRequireLogin();
      else alert('Vui lòng đăng nhập để tiếp tục!');
      return;
    }
    if (!hasSelections) {
      alert('Vui lòng chọn vé trước khi tiến hành giữ chỗ!');
      return;
    }

    try {
      const token = localStorage.getItem('token') || user?.token;
      let seatIdsToCheckout = [];

      if (isSeated) {
        // seated - based
        seatIdsToCheckout = selectedSeats.map(s => s.id).filter(Boolean);
        if (seatIdsToCheckout.length === 0) {
          seatIdsToCheckout = selectedSeats.map(s => {
            const found = backendSeats.find(bs => bs.seat_number === s.code || bs.seat_number === s.code.replace('-', ''));
            return found?.id;
          }).filter(Boolean);
        }
        if (seatIdsToCheckout.length === 0) {
          throw new Error('Không tìm thấy thông tin ghế trên hệ thống backend.');
        }

        const holdRes = await holdSeats(seatIdsToCheckout, token);
        if (holdRes && holdRes.success === false) {
          throw new Error(holdRes.message || 'Không thể giữ các ghế đã chọn');
        }

        // Lưu thông tin các ghế đang giữ vào localStorage: 
        const expiry = holdRes?.data?.reserved_until || holdRes?.reserved_until;
        const heldSeatsData = holdRes?.data?.seats || [];

        if (expiry) {
          setReservedSeatIds(holdRes?.data?.seatIds || seatIdsToCheckout);
          setReservedUntilTime(expiry);
          setIsReserved(true);

          // 🔑 LƯU VÀO LOCALSTORAGE ĐỂ CHỐNG MẤT KHI REFRESH TRANG
          const storageKey = `event_reservation_${event.id}`;
          localStorage.setItem(storageKey, JSON.stringify({
            userId: user?.id,
            reservedUntil: expiry,
            seats: heldSeatsData
          }));
        }
        else {
          throw new Error('Không nhận được thời gian giữ chỗ từ hệ thống.');
        }

      } else {

        // Zone-based
        const selections = Object.entries(zoneQuantities)
          .filter(([, qty]) => qty > 0)
          .map(([zoneId, qty]) => {
            const zoneObj = event.zones?.find(z => z.id === zoneId);
            return { zone_name: zoneObj?.id.toUpperCase() || zoneId, quantity: qty };
          });


        const holdRes = await holdZones(event.id, selections, token);
        if (holdRes && holdRes.success === false) {
          throw new Error(holdRes.message || 'Không thể giữ chỗ theo khu vực đã chọn');
        }

        // LẤY THÔNG TIN GHẾ SERVER TRẢ VỀ LƯU VÀO STATE
        const returnedSeats = holdRes?.data?.seats || [];
        const returnedSeatIds = holdRes?.data?.seatIds || [];
        const expiry = holdRes?.data?.reserved_until || holdRes?.reserved_until;

        if (returnedSeatIds.length === 0) {
          throw new Error('Không nhận được thời gian giữ chỗ hoặc danh sách ghế từ hệ thống.');
        }

        if (returnedSeatIds.length > 0) {
          setReservedZoneSeats(returnedSeats); // Lưu object ghế vào state để lát thanh toán
          setReservedUntilTime(expiry);
          setIsReserved(true);
        }

        if (expiry) {
          setReservedSeatIds(holdRes?.data?.seatIds || []);
          setReservedUntilTime(expiry);
          setIsReserved(true);

          const storageKey = `event_reservation_${event.id}`;
          localStorage.setItem(storageKey, JSON.stringify({
            userId: user?.id,
            reservedUntil: expiry,
            seats: returnedSeats
          }));
        } else {
          throw new Error('Không nhận được thời gian giữ chỗ từ hệ thống.');
        }
      }
    } catch (err) {
      console.error('Lỗi giữ ghế:', err);
      alert('⚠️ ' + (err.response?.data?.message || err.message || 'Có lỗi xảy ra khi giữ ghế!'));
    }
  };

  // --- XỬ LÝ THANH TOÁN QUA PAYOS ---
  const handlePayment = async () => {
    try {
      setIsProcessingPayment(true);
      const token = localStorage.getItem('token') || user?.token;
      let seatIdsToCheckout = [];
      if (isSeated) {
        // --- LUỒNG SEATED-BASED ---
        seatIdsToCheckout = selectedSeats.map(s => s.id).filter(Boolean);
        
        if (seatIdsToCheckout.length === 0) {
          seatIdsToCheckout = selectedSeats.map(s => {
            const found = backendSeats.find(bs => bs.seat_number === s.code || bs.seat_number === s.code.replace('-', ''));
            return found?.id;
          }).filter(Boolean);
        }
      } else {
        // --- LUỒNG ZONE-BASED ---
        seatIdsToCheckout = reservedZoneSeats.map(s => s.id).filter(Boolean);
      }

      if (seatIdsToCheckout.length === 0) {
        throw new Error('Không tìm thấy danh sách ghế cần thanh toán. Vui lòng thực hiện lại.');
      }

      const returnUrl = `${window.location.origin}/events/${event.id}?status=success`;
      const cancelUrl = `${window.location.origin}/events/${event.id}?status=cancelled`;


      // Gọi API PayOS (startCheckout)
      const checkoutRes = await startCheckout(seatIdsToCheckout, returnUrl, cancelUrl, token);

      if (checkoutRes && checkoutRes.success === false) {
        throw new Error(checkoutRes.message || 'Không thể tạo đơn hàng thanh toán qua PayOS');
      }

      const checkoutUrl = checkoutRes?.data?.checkoutUrl || checkoutRes?.checkoutUrl;

      if (checkoutUrl) {
        window.location.href = checkoutUrl; // Chuyển hướng sang trang PayOS
      } else {
        throw new Error(checkoutRes?.message || 'Không nhận được đường dẫn thanh toán từ PayOS');
      }
    } catch (err) {
      console.error('Lỗi thanh toán:', err);
      alert('⚠️ ' + (err.response?.data?.message || err.message || 'Có lỗi xảy ra khi tạo giao dịch thanh toán!'));
      setIsProcessingPayment(false);
    }
  };

  if (!event) {
    return (
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '60px 24px', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-muted)', marginBottom: '16px' }}>Không tìm thấy thông tin sự kiện.</p>
        <button
          onClick={onBack}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            color: '#fff',
            fontSize: '14px',
            border: '1px solid var(--border-color)',
            cursor: 'pointer'
          }}
        >
          <ArrowLeft size={16} /> Quay lại danh sách sự kiện
        </button>
      </div>
    );
  }

  return (
    <div
      className="event-detail-page-container"
      style={{
        maxWidth: '1280px',
        margin: '0 auto',
        padding: 'clamp(12px, 3vw, 24px)',
        paddingBottom: (hasSelections && activeTab === 'booking' && bookingStep === 'booking' && !isUpcoming)
          ? 'clamp(90px, 15vw, 120px)'
          : '32px'
      }}
    >
      {/* Top back button */}
      <button
        onClick={onBack}
        className="event-back-btn"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 14px',
          borderRadius: 'var(--radius-md)',
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          color: 'var(--text-muted)',
          fontSize: '13px',
          fontWeight: 600,
          marginBottom: '16px',
          border: '1px solid var(--border-color)',
          cursor: 'pointer',
          transition: 'var(--transition)'
        }}
      >
        <ArrowLeft size={15} />
        <span>Quay lại danh sách sự kiện</span>
      </button>

      {/* EVENT BANNER HEADER */}
      <div
        className="event-banner-card"
        style={{
          position: 'relative',
          borderRadius: 'var(--radius-xl)',
          overflow: 'hidden',
          minHeight: 'clamp(210px, 30vw, 290px)',
          display: 'flex',
          alignItems: 'flex-end',
          padding: 'clamp(16px, 4vw, 32px)',
          marginBottom: 'clamp(18px, 3.5vw, 28px)',
          border: '1px solid var(--border-color)',
          backgroundImage: `url(${event.banner})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          boxShadow: 'var(--shadow-subtle)'
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to top, #0a0d14 0%, rgba(10, 13, 20, 0.85) 60%, rgba(10, 13, 20, 0.4) 100%)'
          }}
        />

        <div style={{ position: 'relative', zIndex: 2, width: '100%' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
            <span
              className={isSeated ? 'badge-type-seated' : 'badge-type-zone'}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                borderRadius: 'var(--radius-full)',
                fontSize: '11px',
                fontWeight: 700
              }}
            >
              {isSeated ? <Armchair size={13} /> : <Layers size={13} />}
              {isSeated ? 'Seated-based (max 5 ghế)' : 'Zone-based (max 5 vé)'}
            </span>
            {isUpcoming && (
              <span
                className="badge-status-upcoming"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-full)',
                  fontSize: '11px',
                  fontWeight: 700
                }}
              >
                <Clock size={13} />
                Sắp diễn ra - Chưa mở bán
              </span>
            )}
          </div>

          <h1
            style={{
              fontSize: 'clamp(20px, 4vw, 32px)',
              fontWeight: 800,
              color: '#fff',
              marginBottom: '12px',
              lineHeight: 1.25,
              textShadow: '0 2px 10px rgba(0,0,0,0.7)',
              wordBreak: 'break-word'
            }}
          >
            {event.title}
          </h1>

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 'clamp(8px, 2vw, 16px)',
              fontSize: 'clamp(12px, 2vw, 13.5px)',
              color: 'var(--text-muted)'
            }}
          >
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: 'rgba(0,0,0,0.38)', padding: '5px 10px', borderRadius: 'var(--radius-sm)', backdropFilter: 'blur(6px)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <Calendar size={15} color="var(--primary-light)" />
              <span>{eventDate || event.date}</span>
            </div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: 'rgba(0,0,0,0.38)', padding: '5px 10px', borderRadius: 'var(--radius-sm)', backdropFilter: 'blur(6px)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <Clock size={15} color="var(--primary-light)" />
              <span>{eventTime}</span>
            </div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: 'rgba(0,0,0,0.38)', padding: '5px 10px', borderRadius: 'var(--radius-sm)', backdropFilter: 'blur(6px)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <MapPin size={15} color="var(--accent-pink)" />
              <span style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{eventVenue || event.venue}</span>
            </div>
          </div>
        </div>
      </div>

      {/* TABS SELECTOR */}
      <div
        className="tabs-selector-bar"
        style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '20px',
          borderBottom: '1px solid var(--border-color)',
          paddingBottom: '10px',
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none'
        }}
      >
        <button
          onClick={() => setActiveTab('booking')}
          style={{
            padding: '9px clamp(12px, 2.5vw, 18px)',
            borderRadius: 'var(--radius-md)',
            fontWeight: 700,
            fontSize: 'clamp(13px, 2vw, 14px)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: activeTab === 'booking' ? 'var(--primary)' : 'transparent',
            color: activeTab === 'booking' ? '#fff' : 'var(--text-muted)',
            whiteSpace: 'nowrap',
            cursor: 'pointer'
          }}
        >
          <Ticket size={16} />
          {isSeated ? 'Sơ đồ chọn ghế' : 'Chọn khu vực & Đặt vé'}
        </button>
        <button
          onClick={() => setActiveTab('info')}
          style={{
            padding: '9px clamp(12px, 2.5vw, 18px)',
            borderRadius: 'var(--radius-md)',
            fontWeight: 700,
            fontSize: 'clamp(13px, 2vw, 14px)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: activeTab === 'info' ? 'var(--primary)' : 'transparent',
            color: activeTab === 'info' ? '#fff' : 'var(--text-muted)',
            whiteSpace: 'nowrap',
            cursor: 'pointer'
          }}
        >
          <Info size={16} />
          Giới thiệu & Quy định
        </button>
      </div>

      {/* TAB: GIỚI THIỆU */}
      {activeTab === 'info' && (
        <div
          className="glass-panel animate-fade-in"
          style={{
            padding: 'clamp(18px, 4vw, 32px)',
            borderRadius: 'var(--radius-lg)',
            display: 'grid',
            gridTemplateColumns: '1fr',
            gap: '24px'
          }}
        >
          <div>
            <h3 style={{ fontSize: 'clamp(18px, 3.5vw, 22px)', fontWeight: 800, marginBottom: '14px', color: '#fff' }}>
              Mô tả chi tiết sự kiện
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '14.5px', lineHeight: 1.7, whiteSpace: 'pre-line', marginBottom: '24px' }}>
              {event.description}
            </p>

            <h4 style={{ fontSize: '15.5px', fontWeight: 700, marginBottom: '12px', color: 'var(--primary-light)' }}>
              Điểm nhấn nổi bật:
            </h4>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '28px' }}>
              {event.highlights?.map((h, i) => (
                <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-main)', fontSize: '14px' }}>
                  <CheckCircle2 size={16} color="var(--accent-emerald)" style={{ flexShrink: 0 }} />
                  <span>{h}</span>
                </li>
              ))}
            </ul>

            <h4 style={{ fontSize: '15.5px', fontWeight: 700, marginBottom: '12px', color: 'var(--accent-amber)' }}>
              Quy định tham gia sự kiện:
            </h4>
            <div
              style={{
                backgroundColor: 'rgba(245, 158, 11, 0.08)',
                border: '1px solid rgba(245, 158, 11, 0.25)',
                padding: 'clamp(12px, 3vw, 18px)',
                borderRadius: 'var(--radius-md)'
              }}
            >
              {event.rules?.map((r, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '8px', fontSize: '13px', color: 'var(--text-muted)' }}>
                  <AlertTriangle size={15} color="var(--accent-amber)" style={{ marginTop: '2px', flexShrink: 0 }} />
                  <span>{r}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB: BOOKING - Bước 1: Chọn vé */}
      {activeTab === 'booking' && bookingStep === 'booking' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }} className="booking-layout-grid">

          {/* CỘT TRÁI */}
          <div className="glass-panel" style={{ borderRadius: 'var(--radius-lg)', padding: 'clamp(16px, 3.5vw, 28px)' }}>
            {/* Header thông báo */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: isUpcoming ? 'rgba(245, 158, 11, 0.1)' : 'rgba(99, 102, 241, 0.1)',
                border: isUpcoming ? '1px solid rgba(245, 158, 11, 0.25)' : '1px solid rgba(99, 102, 241, 0.25)',
                marginBottom: '24px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <ShieldCheck size={20} color={isUpcoming ? "var(--accent-amber)" : "var(--primary-light)"} style={{ flexShrink: 0 }} />
                <span style={{ fontSize: '13.5px', fontWeight: 600, lineHeight: 1.4 }}>
                  {isUpcoming
                    ? 'Sự kiện sắp diễn ra - Hệ thống chưa mở bán vé chính thức.'
                    : (isSeated
                      ? `Chế độ Seated-based: Sự kiện áp dụng đồng giá 1 loại ghế duy nhất (${formatVND(singleSeatTier.price)}). Tối đa 5 ghế.`
                      : 'Chế độ Zone-based: Đặt vé theo khu vực đứng/vé mở (Tối đa 5 vé).')}
                </span>
              </div>
            </div>

            {/* SEATED-BASED: Sơ đồ ghế (1 loại ghế duy nhất) */}
            {isSeated && (
              <div>
                <div style={{ textAlign: 'center', marginBottom: '28px' }}>
                  <div
                    style={{
                      margin: '0 auto 8px',
                      width: 'clamp(200px, 70%, 420px)',
                      height: '14px',
                      borderRadius: '8px 8px 50% 50%',
                      background: 'linear-gradient(90deg, #ec4899 0%, #6366f1 50%, #ec4899 100%)',
                      boxShadow: '0 0 25px rgba(236, 72, 153, 0.5)'
                    }}
                  />
                  <span style={{ fontSize: '11px', letterSpacing: '3px', textTransform: 'uppercase', color: 'var(--text-dim)', fontWeight: 700 }}>
                    SÂN KHẤU CHÍNH (STAGE)
                  </span>
                </div>

                {/* Chú thích màu ghế */}
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'center',
                    gap: '12px',
                    marginBottom: '20px',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                    <div style={{ width: '13px', height: '13px', borderRadius: '4px', backgroundColor: singleSeatTier.color }} />
                    <span style={{ fontWeight: 600 }}>{singleSeatTier.name}</span>
                    <span style={{ color: 'var(--text-muted)' }}>({formatVND(singleSeatTier.price)})</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                    <div style={{ width: '13px', height: '13px', borderRadius: '4px', backgroundColor: '#334155' }} />
                    <span style={{ color: 'var(--text-dim)' }}>Đã bán</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                    <div style={{ width: '13px', height: '13px', borderRadius: '4px', border: '2px solid #fff', backgroundColor: 'var(--accent-pink)' }} />
                    <span style={{ color: '#fff', fontWeight: 700 }}>Đang chọn</span>
                  </div>
                </div>

                <div style={{ overflowX: 'auto', paddingBottom: '16px' }}>
                  <div style={{ minWidth: '500px', display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center' }}>
                    {
                      // Duyệt qua các tên hàng được sinh ra tự động từ dữ liệu BE (VD: ['A', 'B', 'C'])
                      Object.keys(groupedSeats).sort().map(row => {
                        const rowSeats = groupedSeats[row]; // Mảng các ghế trong hàng này
                        return (
                          <div key={row} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            {/* Ký hiệu hàng bên trái */}
                            <span style={{ width: '24px', fontWeight: 700, color: 'var(--text-dim)', textAlign: 'center', fontSize: '13px' }}>{row}</span>

                            <div style={{ display: 'flex', gap: '8px' }}>
                              {
                                rowSeats.map(seat => {
                                  // Lấy trực tiếp id và seat_number từ object ghế của BE trả về
                                  const seatId = seat.id;
                                  const seatCode = seat.seat_number; // VD: "A1", "A10"

                                  // Kiểm tra trạng thái dựa trên dữ liệu thật từ BE
                                  const isOccupied = isUpcoming || seat.status === 'SOLD' || occupiedSeats.has(seatId);
                                  const isSelected = !isUpcoming && selectedSeats.some(s => s.id === seatId);

                                  let bg = singleSeatTier.color;
                                  let cursor = 'pointer';
                                  let opacity = 1;

                                  if (isOccupied) {
                                    bg = '#334155';
                                    cursor = 'not-allowed';
                                    opacity = 0.5;
                                  } else if (isSelected) {
                                    bg = 'var(--accent-pink)';
                                  }

                                  return (
                                    <button
                                      key={seatId}
                                      // Truyền trực tiếp seatId hoặc object seat lên hàm xử lý ở FE để map với BE
                                      onClick={() => handleToggleSeat(seat, singleSeatTier)}
                                      disabled={isOccupied}
                                      title={isUpcoming ? `Ghế ${seatCode} (Sự kiện chưa mở bán)` : (isOccupied ? `Ghế ${seatCode} đã có người mua` : `Ghế ${seatCode}\n${singleSeatTier.name} (${formatVND(seat.price)})`)}
                                      style={{
                                        width: '36px', height: '36px', borderRadius: '8px',
                                        backgroundColor: bg, color: '#fff', fontSize: '11px', fontWeight: 700,
                                        cursor, opacity,
                                        border: isSelected ? '2px solid #ffffff' : '1px solid rgba(255,255,255,0.15)',
                                        transform: isSelected ? 'scale(1.1)' : 'scale(1)',
                                        boxShadow: isSelected ? '0 0 12px var(--accent-pink)' : 'none',
                                        transition: 'all 0.15s ease'
                                      }}
                                    >
                                      {/* Hiển thị số thứ tự ghế bên trong nút (VD: 1, 2, 10, 11) */}
                                      {seatCode}
                                    </button>
                                  );
                                })
                              }
                            </div>

                            {/* Ký hiệu hàng bên phải (tùy chọn) */}
                            <span style={{ width: '24px', fontWeight: 700, color: 'var(--text-dim)', textAlign: 'center', fontSize: '13px' }}>{row}</span>
                          </div>
                        );
                      })
                    }
                  </div>
                </div>

                <div style={{ textAlign: 'center', marginTop: '14px', fontSize: '12px', color: 'var(--text-dim)' }}>
                  * Nhấp vào ghế trống để chọn hoặc bỏ chọn. Đồng giá <strong>{formatVND(singleSeatTier.price)}</strong> / ghế. Tối đa 5 ghế.
                </div>

              </div>
            )}

            {/* ZONE-BASED */}
            {!isSeated && (
              <div style={{ opacity: isUpcoming ? 0.4 : 1, pointerEvents: isUpcoming ? 'none' : 'auto' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px', color: '#fff' }}>
                  Danh sách khu vực & Hạng vé
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {
                    Object.keys(backendZones).map(zoneName => {
                      const zone = backendZones[zoneName];
                      const qty = zoneQuantities[zoneName] || 0;
                      const remainingCount = zoneRemaining[zoneName] ?? zone.remaining;
                      const isSoldOut = remainingCount === 0;

                      return (
                        <div
                          key={zoneName}
                          style={{
                            padding: '20px',
                            borderRadius: 'var(--radius-md)',
                            backgroundColor: 'var(--bg-secondary)',
                            border: qty > 0 ? '1px solid var(--accent-pink)' : '1px solid var(--border-color)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: '16px',
                            transition: 'var(--transition)'
                          }}
                        >
                          <div style={{ flex: 1, minWidth: '240px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                              <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: zone.color }} />
                              <h4 style={{ fontSize: '16px', fontWeight: 700, color: '#fff' }}>{zone.name}</h4>
                            </div>
                            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                              Khu vực vé đứng tự do - Sức chứa: {zone.total} vé
                            </p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '12px' }}>
                              <span style={{ color: isSoldOut ? '#f87171' : 'var(--accent-emerald)', fontWeight: 600 }}>
                                {`Còn lại: ${remainingCount} vé`}
                              </span>
                              <span style={{ color: 'var(--text-dim)' }}>•</span>
                              <span style={{ color: 'var(--text-dim)' }}>Tự động phân bổ ghế</span>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: '17px', fontWeight: 800, color: 'var(--accent-pink)' }}>{formatVND(zone.price)}</div>
                              <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>/ 1 vé</div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: 'rgba(0,0,0,0.4)', padding: '6px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                              <button
                                onClick={() => handleUpdateZoneQty(zoneName, -1)}
                                disabled={qty <= 0}
                                style={{ width: '30px', height: '30px', borderRadius: '6px', backgroundColor: qty > 0 ? 'var(--bg-tertiary)' : 'transparent', color: qty > 0 ? '#fff' : 'var(--text-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: qty > 0 ? 'pointer' : 'not-allowed' }}
                              >
                                <Minus size={15} />
                              </button>

                              <span style={{ minWidth: '24px', textAlign: 'center', fontWeight: 800, fontSize: '16px', color: '#fff' }}>{qty}</span>

                              <button
                                onClick={() => handleUpdateZoneQty(zoneName, 1)}
                                disabled={totalZoneCount >= 5 || qty >= remainingCount || isSoldOut}
                                style={{
                                  width: '30px', height: '30px', borderRadius: '6px',
                                  backgroundColor: (totalZoneCount < 5 && qty < remainingCount && !isSoldOut) ? 'var(--accent-pink)' : 'transparent',
                                  color: (totalZoneCount < 5 && qty < remainingCount && !isSoldOut) ? '#fff' : 'var(--text-dim)',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  cursor: (totalZoneCount < 5 && qty < remainingCount && !isSoldOut) ? 'pointer' : 'not-allowed'
                                }}
                              >
                                <Plus size={15} />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  }
                </div>
                <div style={{ marginTop: '16px', fontSize: '13px', color: 'var(--text-dim)', textAlign: 'right' }}>
                  Tổng số vé đang chọn: <strong style={{ color: 'var(--accent-pink)' }}>{totalZoneCount}</strong> / 5 vé tối đa
                </div>
              </div>
            )}
          </div>

          {/* CỘT PHẢI: TỔNG QUAN ĐẶT VÉ (STICKY DESKTOP, EMBEDDED MOBILE) */}
          <div className="glass-panel booking-summary-panel" style={{ borderRadius: 'var(--radius-lg)', padding: 'clamp(16px, 3.5vw, 24px)', height: 'fit-content' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '16px', color: '#fff', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              Thông tin đặt vé
            </h3>

            {isSeated ? (
              <div style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Ghế đã chọn ({selectedSeats.length}/5):</span>
                  <span style={{ fontSize: '11px', color: 'var(--primary-light)', backgroundColor: 'rgba(99, 102, 241, 0.15)', padding: '2px 6px', borderRadius: '4px' }}>
                    {singleSeatTier.name}
                  </span>
                </div>
                {selectedSeats.length === 0 ? (
                  <div style={{ padding: '16px', textAlign: 'center', borderRadius: '8px', backgroundColor: 'rgba(255,255,255,0.02)', color: 'var(--text-dim)', fontSize: '13px' }}>
                    Chưa có ghế nào được chọn.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto' }}>
                    {selectedSeats.map(seat => {
                      return (
                        <div key={seat.code} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: '6px', backgroundColor: 'var(--bg-secondary)', fontSize: '13px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontWeight: 800, color: 'var(--accent-pink)' }}>{seat.code}</span>
                            <span style={{ color: 'var(--text-muted)' }}>({seat.tier})</span>
                          </div>
                          <span style={{ fontWeight: 700 }}>{formatVND(seat.price)}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>Vé khu vực ({totalZoneCount}/5):</div>
                {totalZoneCount === 0 ? (
                  <div style={{ padding: '16px', textAlign: 'center', borderRadius: '8px', backgroundColor: 'rgba(255,255,255,0.02)', color: 'var(--text-dim)', fontSize: '13px' }}>
                    Nhấn dấu (+) để thêm vé theo khu vực.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {event.zones?.filter(z => (zoneQuantities[z.id] || 0) > 0).map(z => (
                      <div key={z.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: '6px', backgroundColor: 'var(--bg-secondary)', fontSize: '13px' }}>
                        <div>
                          <span style={{ fontWeight: 700 }}>{z.name}</span>
                          <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>x {zoneQuantities[z.id]} vé</div>
                        </div>
                        <span style={{ fontWeight: 700 }}>{formatVND(z.price * zoneQuantities[z.id])}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div style={{ paddingTop: '16px', borderTop: '1px solid var(--border-color)', marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px', color: 'var(--text-muted)' }}>
                <span>Phí tiện ích / VAT:</span>
                <span>0 đ (Miễn phí)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '15px', fontWeight: 700, color: '#fff' }}>Tổng thanh toán:</span>
                <span style={{ fontSize: 'clamp(18px, 3.5vw, 22px)', fontWeight: 800, color: 'var(--accent-pink)' }}>{formatVND(totalPrice)}</span>
              </div>
            </div>

            {!user && (
              <div style={{ padding: '10px', borderRadius: 'var(--radius-sm)', backgroundColor: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.25)', color: '#fcd34d', fontSize: '12px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={15} style={{ flexShrink: 0 }} />
                <span>Bạn cần đăng nhập để hoàn tất giữ chỗ và nhận vé qua email.</span>
              </div>
            )}
            <div>
              {/* Nút chính (Giữ chỗ hoặc Thanh toán) */}
              <button
                onClick={isReserved ? handlePayment : handleReserveSeats}
                disabled={!hasSelections || isProcessingPayment || isUpcoming}
                className="glow-btn-pink"
                style={{
                  width: '100%', padding: '14px', fontSize: '15px', fontWeight: 700,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px',
                  opacity: (!hasSelections || isProcessingPayment || isUpcoming) ? 0.6 : 1,
                  cursor: (!hasSelections || isProcessingPayment || isUpcoming) ? 'not-allowed' : 'pointer'
                }}
              >
                {isProcessingPayment ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', width: '18px', height: '18px' }} />
                    Đang kết nối PayOS...
                  </div>
                ) : isUpcoming ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlertTriangle size={18} />
                    Sự kiện chưa mở bán
                  </div>
                ) : isReserved ? (
                  // TRẠNG THÁI 2: ĐÃ GIỮ GHẾ -> HIỂN THỊ NÚT THANH TOÁN VÀ ĐỒNG HỒ ĐẾM NGƯỢC
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <CreditCard size={18} />
                      {user ? `Thanh toán qua PayOS • ${formatVND(totalPrice)}` : 'Đăng nhập & Thanh toán'}
                    </div>
                    <span style={{ fontSize: '12px', color: '#ffeb3b', fontWeight: 500 }}>
                      ⏱️ Giữ ghế thành công! Hết hạn sau: {formatCountdown(countdownSeconds)}
                    </span>
                  </div>
                ) : (
                  // TRẠNG THÁI 1: CHƯA GIỮ GHẾ -> HIỂN THỊ NÚT GIỮ GHẾ
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <CreditCard size={18} />
                    {user ? 'Giữ chỗ ngay' : 'Đăng nhập & Giữ chỗ'}
                  </div>
                )}
              </button>

              {/* NÚT HỦY GIỮ GHẾ (Chỉ hiện khi isReserved = true) */}
              {isReserved && (
                <button
                  onClick={handleCancelReservation}
                  disabled={isProcessingPayment}
                  style={{
                    width: '100%',
                    marginTop: '10px',
                    padding: '10px',
                    fontSize: '13px',
                    fontWeight: 600,
                    backgroundColor: 'transparent',
                    color: '#f87171', // Màu đỏ cảnh báo
                    border: '1px solid #f87171',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(248, 113, 113, 0.1)'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  ❌ Hủy giữ ghế / Chọn lại
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ======== BƯỚC 3: THÀNH CÔNG ======== */}
      {bookingStep === 'success' && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: 'clamp(10px, 3vw, 24px) 0' }}>
          <div
            className="glass-panel animate-fade-in"
            style={{
              maxWidth: '560px',
              width: '100%',
              borderRadius: 'var(--radius-xl)',
              padding: 'clamp(20px, 5vw, 40px)',
              textAlign: 'center',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              boxShadow: '0 0 40px rgba(16, 185, 129, 0.15)'
            }}
          >
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: 'rgba(16, 185, 129, 0.2)',
                color: 'var(--accent-emerald)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px'
              }}
            >
              <CheckCircle2 size={36} />
            </div>

            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '4px 14px', borderRadius: 'var(--radius-full)', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: 'var(--accent-emerald)', fontSize: '12px', fontWeight: 700, marginBottom: '14px' }}>
              <ShieldCheck size={14} /> Thanh toán thành công
            </div>

            <h3 style={{ fontSize: 'clamp(20px, 4.5vw, 26px)', fontWeight: 800, marginBottom: '10px', color: '#fff' }}>
              Đặt vé thành công! 🎉
            </h3>

            <p style={{ color: 'var(--text-muted)', fontSize: '13.5px', marginBottom: '24px', lineHeight: 1.6 }}>
              Mã vé điện tử (E-Ticket) đã được gửi đến <strong style={{ color: '#fff' }}>{user?.email}</strong>.
              Vé cũng đã được lưu vào <strong style={{ color: 'var(--accent-cyan)' }}>Giỏ hàng</strong> của bạn.
            </p>

            {/* Chi tiết vé */}
            <div
              style={{
                backgroundColor: 'var(--bg-secondary)',
                padding: 'clamp(14px, 3vw, 20px)',
                borderRadius: 'var(--radius-md)',
                textAlign: 'left',
                fontSize: '13px',
                marginBottom: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                border: '1px solid var(--border-color)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                <span style={{ color: 'var(--text-dim)', flexShrink: 0 }}>Sự kiện:</span>
                <span style={{ fontWeight: 700, color: '#fff', textAlign: 'right' }}>{event.title}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                <span style={{ color: 'var(--text-dim)', flexShrink: 0 }}>Thời gian:</span>
                <span style={{ color: '#fff', textAlign: 'right' }}>{eventDate} • {eventTime}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                <span style={{ color: 'var(--text-dim)', flexShrink: 0 }}>Địa điểm:</span>
                <span style={{ color: '#fff', textAlign: 'right' }}>{eventVenue}</span>
              </div>
              {isSeated ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                  <span style={{ color: 'var(--text-dim)', flexShrink: 0 }}>Ghế ({singleSeatTier.name}):</span>
                  <span style={{ color: 'var(--accent-pink)', fontWeight: 700, textAlign: 'right' }}>{selectedSeats.map(s => s.code).join(', ')}</span>
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                  <span style={{ color: 'var(--text-dim)', flexShrink: 0 }}>Số lượng:</span>
                  <span style={{ color: 'var(--accent-pink)', fontWeight: 700 }}>{totalZoneCount} vé</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid var(--border-color)', marginTop: '4px' }}>
                <span style={{ color: 'var(--text-dim)' }}>Tổng thanh toán:</span>
                <span style={{ color: 'var(--accent-pink)', fontWeight: 800, fontSize: '16px' }}>{formatVND(totalPrice)}</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <button
                onClick={() => { onBack && onBack(); }}
                style={{
                  flex: 1, minWidth: '140px', padding: '12px', borderRadius: 'var(--radius-md)',
                  backgroundColor: 'rgba(255, 255, 255, 0.06)', color: '#fff',
                  fontSize: '13.5px', fontWeight: 600, border: '1px solid var(--border-color)'
                }}
              >
                Về trang sự kiện
              </button>
              <button
                onClick={() => {
                  if (onOpenCart) onOpenCart();
                  else if (onBack) onBack();
                }}
                className="glow-btn-primary"
                style={{ flex: 1, minWidth: '140px', padding: '12px', borderRadius: 'var(--radius-md)', fontSize: '13.5px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                <ShoppingCart size={16} />
                Xem Giỏ hàng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Scoped CSS for EventDetailPage responsiveness */}
      <style>{`
        /* Desktop layout */
        @media (min-width: 992px) {
          .booking-layout-grid {
            grid-template-columns: 1fr 340px !important;
          }
          .booking-summary-panel {
            position: sticky !important;
            top: 90px !important;
          }
          .mobile-scroll-hint {
            display: none !important;
          }
          .mobile-floating-checkout-bar {
            display: none !important;
          }
        }

        /* Tablet & Mobile layout */
        @media (max-width: 991px) {
          .booking-summary-panel {
            position: static !important;
            margin-top: 8px !important;
          }
        }

        /* Seating chart sizing */
        .row-label {
          width: 22px;
          font-size: 13px;
        }
        .seat-btn {
          width: 36px;
          height: 36px;
          border-radius: 8px;
          font-size: 11px;
        }
        .seat-btn:active {
          transform: scale(0.92) !important;
        }

        /* Small screens: scale seat buttons so all 56 seats fit on mobile without forced scroll */
        @media (max-width: 520px) {
          .row-label {
            width: 16px !important;
            font-size: 11px !important;
          }
          .seat-row-btns {
            gap: 4px !important;
          }
          .seating-row {
            gap: 4px !important;
          }
          .seat-btn {
            width: 31px !important;
            height: 31px !important;
            border-radius: 6px !important;
            font-size: 10px !important;
          }
        }

        @media (max-width: 360px) {
          .row-label {
            width: 14px !important;
            font-size: 10px !important;
          }
          .seat-row-btns {
            gap: 3px !important;
          }
          .seat-btn {
            width: 26px !important;
            height: 26px !important;
            font-size: 9px !important;
            border-radius: 4px !important;
          }
        }

        /* Zone item responsiveness */
        .zone-item-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 16px;
          padding: 18px 20px;
          border-radius: var(--radius-md);
          background-color: var(--bg-secondary);
          transition: var(--transition);
        }
        .zone-item-info {
          flex: 1;
          min-width: 220px;
        }
        .zone-item-action {
          display: flex;
          align-items: center;
          gap: 20px;
        }

        @media (max-width: 560px) {
          .zone-item-card {
            padding: 14px 16px;
            gap: 12px;
          }
          .zone-item-info {
            width: 100% !important;
            min-width: 100% !important;
          }
          .zone-item-action {
            width: 100% !important;
            justify-content: space-between !important;
            padding-top: 10px;
            border-top: 1px solid rgba(255, 255, 255, 0.08);
          }
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
