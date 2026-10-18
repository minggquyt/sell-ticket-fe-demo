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
  ShoppingCart
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
import { fetchSeatsByEvent, holdSeats, holdZones, startCheckout } from '../services/eventService';

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

  // SEATED-BASED STATE
  const [occupiedSeats, setOccupiedSeats] = useState(
    () => initialOccupiedSeats ? new Set(initialOccupiedSeats) : new Set(['A-3', 'A-4', 'B-5', 'C-1', 'C-2', 'D-7', 'E-4', 'F-5'])
  );
  const [selectedSeats, setSelectedSeats] = useState([]);

  // ZONE-BASED STATE
  const [zoneQuantities, setZoneQuantities] = useState({});
  // Track remaining vé theo zone
  const [zoneRemaining, setZoneRemaining] = useState(() => {
    if (initialZoneRemaining && Object.keys(initialZoneRemaining).length > 0) {
      return { ...initialZoneRemaining };
    }
    return Object.fromEntries((event.zones || []).map(z => [z.id, z.remaining]));
  });

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
        if (seats && seats.length > 0) {
          setBackendSeats(seats);
          const sold = seats
            .filter(s => s.status === 'SOLD' || s.status === 'RESERVED' || s.status === 'PAYMENT_PROCESSING')
            .map(s => {
              const num = s.seat_number;
              if (/^[A-G]\d+$/.test(num)) {
                return `${num.charAt(0)}-${num.slice(1)}`;
              }
              return num;
            });
          if (sold.length > 0) {
            setOccupiedSeats(prev => new Set([...prev, ...sold]));
          }
        }
      }).catch(err => console.warn('Seats fetch error:', err));
  }, [event?.id]);

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

  const totalSeatedPrice = selectedSeats.reduce((acc, curr) => {
    return acc + parseFloat(curr.price)
  }, 0);


  // --- LOGIC ZONE-BASED ---
  const totalZoneCount = Object.values(zoneQuantities).reduce((acc, val) => acc + (val || 0), 0);

  const handleUpdateZoneQty = (zoneId, delta) => {
    const current = zoneQuantities[zoneId] || 0;
    const available = zoneRemaining[zoneId] ?? (event.zones?.find(z => z.id === zoneId)?.remaining || 0);

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
    setZoneQuantities(prev => ({ ...prev, [zoneId]: nextVal }));
  };

  const totalZonePrice = (event.zones || []).reduce((acc, z) => {
    const qty = zoneQuantities[z.id] || 0;
    return acc + (qty * z.price);
  }, 0);

  const totalPrice = isSeated ? totalSeatedPrice : totalZonePrice;
  const hasSelections = isSeated ? selectedSeats.length > 0 : totalZoneCount > 0;

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

        // Nhận response thành công từ server chứa reserved_until
        const expiry = holdRes?.data?.reserved_until || holdRes?.reserved_until;
        if (expiry) {
          setReservedUntilTime(expiry);
          setIsReserved(true); // Đánh dấu đã giữ ghế thành công
        } else {
          throw new Error('Không nhận được thời gian giữ chỗ từ hệ thống.');
        }

      } else {

        // Zone-based
        const selections = Object.entries(zoneQuantities)
          .filter(([, qty]) => qty > 0)
          .map(([zoneId, qty]) => {
            const zoneObj = event.zones?.find(z => z.id === zoneId);
            console.log(zoneObj)
            return { zone_name: zoneObj?.id.toUpperCase() || zoneId, quantity: qty };
          });

          console.log(selections)


        const holdRes = await holdZones(event.id, selections, token);
        console.log(holdRes)
        if (holdRes && holdRes.success === false) {
          
          throw new Error(holdRes.message || 'Không thể giữ chỗ theo khu vực đã chọn');
        }

        const expiry = holdRes?.data?.reserved_until || holdRes?.reserved_until;
        if (expiry) {
          setReservedUntilTime(expiry);
          setIsReserved(true);
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

      let seatIdsToCheckout = selectedSeats.map(s => s.id).filter(Boolean);

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
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '24px' }}>

      {/* Top back button */}
      <button
        onClick={onBack}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 16px',
          borderRadius: 'var(--radius-md)',
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          color: 'var(--text-muted)',
          fontSize: '14px',
          fontWeight: 600,
          marginBottom: '20px',
          border: '1px solid var(--border-color)'
        }}
      >
        <ArrowLeft size={16} />
        Quay lại danh sách sự kiện
      </button>

      {/* EVENT BANNER HEADER */}
      <div style={{
        position: 'relative',
        borderRadius: 'var(--radius-xl)',
        overflow: 'hidden',
        minHeight: '280px',
        display: 'flex',
        alignItems: 'flex-end',
        padding: '32px',
        marginBottom: '28px',
        border: '1px solid var(--border-color)',
        backgroundImage: `url(${event.banner})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      }}>
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to top, #0a0d14 0%, rgba(10, 13, 20, 0.8) 50%, rgba(10, 13, 20, 0.3) 100%)'
        }} />

        <div style={{ position: 'relative', zIndex: 2, width: '100%' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
            <span className={isSeated ? 'badge-type-seated' : 'badge-type-zone'} style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 12px',
              borderRadius: 'var(--radius-full)',
              fontSize: '12px',
              fontWeight: 700
            }}>
              {isSeated ? <Armchair size={14} /> : <Layers size={14} />}
              {isSeated ? 'Sự kiện Seated-based (chọn tối đa 5 ghế)' : 'Sự kiện Zone-based (Đặt vé tối đa 5 vé)'}
            </span>
            {isUpcoming && (
              <span className="badge-status-upcoming" style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 12px',
                borderRadius: 'var(--radius-full)',
                fontSize: '12px',
                fontWeight: 700
              }}>
                <Clock size={14} />
                Sắp diễn ra - Chưa mở bán
              </span>
            )}
          </div>

          <h1 style={{ fontSize: '32px', fontWeight: 800, color: '#fff', marginBottom: '12px', lineHeight: 1.25 }}>
            {event.title}
          </h1>

          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '24px',
            fontSize: '14px',
            color: 'var(--text-muted)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calendar size={18} color="var(--primary-light)" />
              <span>{eventDate || event.date}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={18} color="var(--primary-light)" />
              <span>{eventTime}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MapPin size={18} color="var(--accent-pink)" />
              <span>{eventVenue || event.venue}</span>
            </div>
          </div>
        </div>
      </div>



      {/* TABS SELECTOR */}
      <div style={{
        display: 'flex',
        gap: '12px',
        marginBottom: '24px',
        borderBottom: '1px solid var(--border-color)',
        paddingBottom: '12px'
      }}>
        <button
          onClick={() => setActiveTab('booking')}
          style={{
            padding: '10px 20px',
            borderRadius: 'var(--radius-md)',
            fontWeight: 700,
            fontSize: '15px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: activeTab === 'booking' ? 'var(--primary)' : 'transparent',
            color: activeTab === 'booking' ? '#fff' : 'var(--text-muted)'
          }}
        >
          <Ticket size={18} />
          {isSeated ? 'Sơ đồ chọn ghế' : 'Chọn khu vực & Đặt vé'}
        </button>
        <button
          onClick={() => setActiveTab('info')}
          style={{
            padding: '10px 20px',
            borderRadius: 'var(--radius-md)',
            fontWeight: 700,
            fontSize: '15px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: activeTab === 'info' ? 'var(--primary)' : 'transparent',
            color: activeTab === 'info' ? '#fff' : 'var(--text-muted)'
          }}
        >
          <Info size={18} />
          Giới thiệu & Quy định
        </button>
      </div>

      {/* TAB: GIỚI THIỆU */}
      {activeTab === 'info' && (
        <div className="glass-panel animate-fade-in" style={{
          padding: '32px',
          borderRadius: 'var(--radius-lg)',
          display: 'grid',
          gridTemplateColumns: '1fr',
          gap: '32px'
        }}>
          <div>
            <h3 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '14px', color: '#fff' }}>
              Mô tả chi tiết sự kiện
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '15px', lineHeight: 1.7, whiteSpace: 'pre-line', marginBottom: '24px' }}>
              {event.description}
            </p>

            <h4 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '12px', color: 'var(--primary-light)' }}>
              Điểm nhấn nổi bật:
            </h4>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '28px' }}>
              {event.highlights?.map((h, i) => (
                <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-main)', fontSize: '14px' }}>
                  <CheckCircle2 size={16} color="var(--accent-emerald)" />
                  {h}
                </li>
              ))}
            </ul>

            <h4 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '12px', color: 'var(--accent-amber)' }}>
              Quy định tham gia sự kiện:
            </h4>
            <div style={{
              backgroundColor: 'rgba(245, 158, 11, 0.08)',
              border: '1px solid rgba(245, 158, 11, 0.25)',
              padding: '16px',
              borderRadius: 'var(--radius-md)'
            }}>
              {event.rules?.map((r, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '6px', fontSize: '13px', color: 'var(--text-muted)' }}>
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
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '28px' }} className="booking-layout-grid">

          {/* CỘT TRÁI */}
          <div className="glass-panel" style={{ borderRadius: 'var(--radius-lg)', padding: '28px' }}>
            {/* Header thông báo */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 18px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: isUpcoming ? 'rgba(245, 158, 11, 0.1)' : 'rgba(99, 102, 241, 0.1)',
              border: isUpcoming ? '1px solid rgba(245, 158, 11, 0.25)' : '1px solid rgba(99, 102, 241, 0.25)',
              marginBottom: '24px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <ShieldCheck size={20} color={isUpcoming ? "var(--accent-amber)" : "var(--primary-light)"} />
                <span style={{ fontSize: '14px', fontWeight: 600 }}>
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
                <div style={{ textAlign: 'center', marginBottom: '36px' }}>
                  <div style={{
                    margin: '0 auto 8px',
                    width: '80%',
                    height: '16px',
                    borderRadius: '8px 8px 50% 50%',
                    background: 'linear-gradient(90deg, #ec4899 0%, #6366f1 50%, #ec4899 100%)',
                    boxShadow: '0 0 25px rgba(236, 72, 153, 0.5)'
                  }} />
                  <span style={{ fontSize: '12px', letterSpacing: '3px', textTransform: 'uppercase', color: 'var(--text-dim)', fontWeight: 700 }}>
                    SÂN KHẤU CHÍNH (STAGE)
                  </span>
                </div>

                <div style={{
                  display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '16px',
                  marginBottom: '28px', padding: '12px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-secondary)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                    <div style={{ width: '14px', height: '14px', borderRadius: '4px', backgroundColor: singleSeatTier.color }} />
                    <span style={{ fontWeight: 600 }}>{singleSeatTier.name}</span>
                    <span style={{ color: 'var(--text-muted)' }}>({formatVND(singleSeatTier.price)})</span>
                    <span style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      padding: '2px 7px',
                      borderRadius: '4px',
                      backgroundColor: 'rgba(99, 102, 241, 0.2)',
                      color: 'var(--primary-light)',
                      border: '1px solid rgba(99, 102, 241, 0.3)'
                    }}>1 loại ghế duy nhất</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                    <div style={{ width: '14px', height: '14px', borderRadius: '4px', backgroundColor: '#334155' }} />
                    <span style={{ color: 'var(--text-dim)' }}>Đã bán</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                    <div style={{ width: '14px', height: '14px', borderRadius: '4px', border: '2px solid #fff', backgroundColor: 'var(--accent-pink)' }} />
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

                <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '12px', color: 'var(--text-dim)' }}>
                  * Nhấp chuột vào ghế trống để chọn hoặc bỏ chọn. Sự kiện áp dụng đồng giá <strong>{formatVND(singleSeatTier.price)}</strong> cho toàn bộ 56 ghế. Tối đa 5 ghế cho mỗi khách hàng.
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
                  {event.zones?.map(zone => {
                    console.log(zone)
                    const qty = zoneQuantities[zone.id] || 0;
                    return (
                      <div
                        key={zone.id}
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
                            {zone.description}
                          </p>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '12px' }}>
                            <span style={{ color: (zoneRemaining[zone.id] || 0) === 0 ? '#f87171' : 'var(--accent-emerald)', fontWeight: 600 }}>
                              {`Còn lại: ${zoneRemaining[zone.id] ?? zone.remaining} vé`}
                            </span>
                            <span style={{ color: 'var(--text-dim)' }}>•</span>
                            <span style={{ color: 'var(--text-dim)' }}>Khu vực đứng tự do</span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '17px', fontWeight: 800, color: 'var(--accent-pink)' }}>{formatVND(zone.price)}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>/ 1 vé</div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: 'rgba(0,0,0,0.4)', padding: '6px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                            <button onClick={() => handleUpdateZoneQty(zone.id, -1)} disabled={qty <= 0}
                              style={{ width: '30px', height: '30px', borderRadius: '6px', backgroundColor: qty > 0 ? 'var(--bg-tertiary)' : 'transparent', color: qty > 0 ? '#fff' : 'var(--text-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Minus size={15} />
                            </button>
                            <span style={{ minWidth: '24px', textAlign: 'center', fontWeight: 800, fontSize: '16px', color: '#fff' }}>{qty}</span>
                            <button
                              onClick={() => handleUpdateZoneQty(zone.id, 1)}
                              disabled={totalZoneCount >= 5 || qty >= (zoneRemaining[zone.id] ?? zone.remaining) || (zoneRemaining[zone.id] ?? zone.remaining) <= 0}
                              style={{
                                width: '30px',
                                height: '30px',
                                borderRadius: '6px',
                                backgroundColor: (totalZoneCount < 5 && qty < (zoneRemaining[zone.id] ?? zone.remaining)) ? 'var(--accent-pink)' : 'transparent',
                                color: (totalZoneCount < 5 && qty < (zoneRemaining[zone.id] ?? zone.remaining)) ? '#fff' : 'var(--text-dim)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                            >
                              <Plus size={15} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ marginTop: '16px', fontSize: '13px', color: 'var(--text-dim)', textAlign: 'right' }}>
                  Tổng số vé đang chọn: <strong style={{ color: 'var(--accent-pink)' }}>{totalZoneCount}</strong> / 5 vé tối đa
                </div>
              </div>
            )}
          </div>

          {/* CỘT PHẢI: TỔNG QUAN ĐẶT VÉ */}
          <div className="glass-panel" style={{ borderRadius: 'var(--radius-lg)', padding: '24px', height: 'fit-content', position: 'sticky', top: '90px' }}>
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

            <div style={{ paddingTop: '16px', borderTop: '1px solid var(--border-color)', marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px', color: 'var(--text-muted)' }}>
                <span>Phí tiện ích / VAT:</span>
                <span>0 đ (Miễn phí)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '16px', fontWeight: 700, color: '#fff' }}>Tổng thanh toán:</span>
                <span style={{ fontSize: '20px', fontWeight: 800, color: 'var(--accent-pink)' }}>{formatVND(totalPrice)}</span>
              </div>
            </div>

            {!user && (
              <div style={{ padding: '10px', borderRadius: 'var(--radius-sm)', backgroundColor: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.25)', color: '#fcd34d', fontSize: '12px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={15} style={{ flexShrink: 0 }} />
                <span>Bạn cần đăng nhập để hoàn tất giữ chỗ và nhận vé qua email.</span>
              </div>
            )}
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
          </div>
        </div>
      )}

      {/* ======== BƯỚC 3: THÀNH CÔNG ======== */}
      {bookingStep === 'success' && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: '20px 0' }}>
          <div className="glass-panel animate-fade-in" style={{
            maxWidth: '560px',
            width: '100%',
            borderRadius: 'var(--radius-xl)',
            padding: '40px',
            textAlign: 'center',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            boxShadow: '0 0 40px rgba(16, 185, 129, 0.15)'
          }}>
            <div style={{
              width: '72px', height: '72px', borderRadius: '50%',
              backgroundColor: 'rgba(16, 185, 129, 0.2)', color: 'var(--accent-emerald)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px'
            }}>
              <CheckCircle2 size={40} />
            </div>

            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '4px 14px', borderRadius: 'var(--radius-full)', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: 'var(--accent-emerald)', fontSize: '12px', fontWeight: 700, marginBottom: '16px' }}>
              <ShieldCheck size={14} /> Thanh toán thành công
            </div>

            <h3 style={{ fontSize: '26px', fontWeight: 800, marginBottom: '10px', color: '#fff' }}>
              Đặt vé thành công! 🎉
            </h3>

            <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '28px', lineHeight: 1.6 }}>
              Mã vé điện tử (E-Ticket) đã được gửi đến <strong style={{ color: '#fff' }}>{user?.email}</strong>.
              Vé cũng đã được lưu vào <strong style={{ color: 'var(--accent-cyan)' }}>Giỏ hàng</strong> của bạn.
            </p>

            {/* Chi tiết vé */}
            <div style={{
              backgroundColor: 'var(--bg-secondary)', padding: '20px', borderRadius: 'var(--radius-md)',
              textAlign: 'left', fontSize: '13px', marginBottom: '28px',
              display: 'flex', flexDirection: 'column', gap: '8px',
              border: '1px solid var(--border-color)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-dim)' }}>Sự kiện:</span>
                <span style={{ fontWeight: 700, color: '#fff', textAlign: 'right', maxWidth: '240px' }}>{event.title}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-dim)' }}>Thời gian:</span>
                <span style={{ color: '#fff' }}>{eventDate} • {eventTime}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-dim)' }}>Địa điểm:</span>
                <span style={{ color: '#fff', textAlign: 'right', maxWidth: '240px' }}>{eventVenue}</span>
              </div>
              {isSeated ? (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-dim)' }}>Ghế đã giữ ({singleSeatTier.name}):</span>
                  <span style={{ color: 'var(--accent-pink)', fontWeight: 700 }}>{selectedSeats.map(s => s.code).join(', ')}</span>
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-dim)' }}>Số lượng:</span>
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
                  flex: 1, padding: '12px', borderRadius: 'var(--radius-md)',
                  backgroundColor: 'rgba(255, 255, 255, 0.06)', color: '#fff',
                  fontSize: '14px', fontWeight: 600, border: '1px solid var(--border-color)'
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
                style={{ flex: 1, padding: '12px', borderRadius: 'var(--radius-md)', fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                <ShoppingCart size={16} />
                Xem Giỏ hàng
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @media (min-width: 992px) {
          .booking-layout-grid {
            grid-template-columns: 1fr 340px !important;
          }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
