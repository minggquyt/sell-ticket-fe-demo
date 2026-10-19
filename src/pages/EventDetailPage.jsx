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
  // State mở drawer chi tiết trên mobile bottom bar
  const [isMobileSummaryOpen, setIsMobileSummaryOpen] = useState(false);

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
    fetchSeatsByEvent(event.id).then(seats => {
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

  // Trạng thái xử lý thanh toán
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // Format currency
  const formatVND = (val) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);

  // --- LOGIC SEATED-BASED ---
  const handleToggleSeat = (seatCode, tier = singleSeatTier) => {
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
        price: tier.price || singleSeatTier.price,
        color: tier.color || singleSeatTier.color
      }]);
    }
  };

  const totalSeatedPrice = selectedSeats.reduce((acc, curr) => acc + curr.price, 0);

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

  // Đặt và giữ chỗ + kết nối thanh toán PayOS
  const handleBookAndPay = async () => {
    if (!user) {
      if (onRequireLogin) onRequireLogin();
      else alert('Vui lòng đăng nhập để tiếp tục thanh toán!');
      return;
    }
    if (!hasSelections) {
      alert('Vui lòng chọn vé trước khi tiến hành đặt chỗ!');
      return;
    }

    try {
      setIsProcessingPayment(true);
      const token = localStorage.getItem('token') || user?.token;

      let seatIdsToCheckout = [];

      if (isSeated) {
        // Lấy danh sách seat id
        seatIdsToCheckout = selectedSeats.map(s => s.id).filter(Boolean);
        if (seatIdsToCheckout.length === 0) {
          // Nếu chưa có id trực tiếp từ backendSeats, fallback tìm theo seat_number
          seatIdsToCheckout = selectedSeats.map(s => {
            const found = backendSeats.find(bs => bs.seat_number === s.code || bs.seat_number === s.code.replace('-', ''));
            return found?.id;
          }).filter(Boolean);
        }

        if (seatIdsToCheckout.length === 0) {
          throw new Error('Không tìm thấy thông tin ghế trên hệ thống backend. Vui lòng tải lại trang.');
        }

        // Gọi API giữ chỗ
        const holdRes = await holdSeats(seatIdsToCheckout, token);
        if (holdRes && holdRes.success === false) {
          throw new Error(holdRes.message || 'Không thể giữ các ghế đã chọn');
        }
        if (holdRes?.data?.seatIds && holdRes.data.seatIds.length > 0) {
          seatIdsToCheckout = holdRes.data.seatIds;
        }
      } else {
        // Zone-based: gọi API giữ chỗ theo zones
        const selections = Object.entries(zoneQuantities)
          .filter(([, qty]) => qty > 0)
          .map(([zoneId, qty]) => {
            const zoneObj = event.zones?.find(z => z.id === zoneId);
            return { zoneName: zoneObj?.name || zoneId, quantity: qty };
          });

        const holdRes = await holdZones(event.id, selections, token);
        if (holdRes && holdRes.success === false) {
          throw new Error(holdRes.message || 'Không thể giữ chỗ theo khu vực đã chọn');
        }
        const returnedIds = holdRes?.data?.seatIds || holdRes?.data?.seats?.map(s => s.id) || holdRes?.seatIds || holdRes?.seats?.map(s => s.id);
        if (returnedIds && returnedIds.length > 0) {
          seatIdsToCheckout = returnedIds;
        } else {
          throw new Error('Không nhận được danh sách vé giữ chỗ từ hệ thống.');
        }
      }

      // Tạo link thanh toán PayOS
      const returnUrl = `${window.location.origin}/events/${event.id}?status=success`;
      const cancelUrl = `${window.location.origin}/events/${event.id}?status=cancelled`;

      const checkoutRes = await startCheckout(seatIdsToCheckout, returnUrl, cancelUrl, token);

      if (checkoutRes && checkoutRes.success === false) {
        throw new Error(checkoutRes.message || 'Không thể tạo đơn hàng thanh toán qua PayOS');
      }

      const checkoutUrl = checkoutRes?.data?.checkoutUrl || checkoutRes?.checkoutUrl;

      if (checkoutUrl) {
        window.location.href = checkoutUrl;
      } else {
        throw new Error(checkoutRes?.message || 'Không nhận được đường dẫn thanh toán từ PayOS');
      }
    } catch (err) {
      console.error('Lỗi đặt vé và thanh toán:', err);
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
                        ? `Chế độ Seated-based: Đồng giá 1 loại ghế (${formatVND(singleSeatTier.price)}). Tối đa 5 ghế.`
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

                {/* Mobile scroll hint */}
                <div
                  className="mobile-scroll-hint"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    padding: '5px 12px',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: 'rgba(6, 182, 212, 0.1)',
                    border: '1px solid rgba(6, 182, 212, 0.25)',
                    color: 'var(--accent-cyan)',
                    fontSize: '11px',
                    fontWeight: 600,
                    width: 'fit-content',
                    margin: '0 auto 12px'
                  }}
                >
                  <span>↔ Vuốt ngang nếu cần xem toàn bộ 56 ghế</span>
                </div>

                {/* Bảng ghế linh hoạt - co giãn theo màn hình */}
                <div className="seating-scroll-container" style={{ overflowX: 'auto', paddingBottom: '12px', WebkitOverflowScrolling: 'touch' }}>
                  <div className="seating-chart-grid" style={{ minWidth: 'min-content', display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center', margin: '0 auto' }}>
                    {['A', 'B', 'C', 'D', 'E', 'F', 'G'].map(row => {
                      return (
                        <div key={row} className="seating-row" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span className="row-label" style={{ fontWeight: 700, color: 'var(--text-dim)', textAlign: 'center' }}>{row}</span>
                          <div className="seat-row-btns" style={{ display: 'flex', gap: '6px' }}>
                            {[1, 2, 3, 4, 5, 6, 7, 8].map(col => {
                              const seatCode = `${row}-${col}`;
                              const isOccupied = isUpcoming || occupiedSeats.has(seatCode);
                              const isSelected = !isUpcoming && selectedSeats.some(s => s.code === seatCode);
                              let bg = singleSeatTier.color;
                              let cursor = 'pointer';
                              let opacity = 1;
                              if (isOccupied) { bg = '#334155'; cursor = 'not-allowed'; opacity = 0.5; }
                              else if (isSelected) { bg = 'var(--accent-pink)'; }
                              return (
                                <button
                                  key={seatCode}
                                  onClick={() => handleToggleSeat(seatCode, singleSeatTier)}
                                  disabled={isOccupied}
                                  className={`seat-btn ${isSelected ? 'selected' : ''}`}
                                  title={isUpcoming ? `Ghế ${seatCode} (Sự kiện chưa mở bán)` : (isOccupied ? `Ghế ${seatCode} đã có người mua` : `Ghế ${seatCode} - ${singleSeatTier.name} (${formatVND(singleSeatTier.price)})`)}
                                  style={{
                                    backgroundColor: bg,
                                    color: '#fff',
                                    fontWeight: 700,
                                    cursor,
                                    opacity,
                                    border: isSelected ? '2px solid #ffffff' : '1px solid rgba(255,255,255,0.15)',
                                    transform: isSelected ? 'scale(1.08)' : 'scale(1)',
                                    boxShadow: isSelected ? '0 0 14px var(--accent-pink)' : 'none',
                                    transition: 'all 0.15s ease'
                                  }}
                                >
                                  {col}
                                </button>
                              );
                            })}
                          </div>
                          <span className="row-label" style={{ fontWeight: 700, color: 'var(--text-dim)', textAlign: 'center' }}>{row}</span>
                        </div>
                      );
                    })}
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {event.zones?.map(zone => {
                    const qty = zoneQuantities[zone.id] || 0;
                    return (
                      <div
                        key={zone.id}
                        className="zone-item-card"
                        style={{
                          border: qty > 0 ? '1px solid var(--accent-pink)' : '1px solid var(--border-color)',
                          boxShadow: qty > 0 ? '0 0 15px rgba(236, 72, 153, 0.2)' : 'none'
                        }}
                      >
                        <div className="zone-item-info">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                            <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: zone.color, flexShrink: 0 }} />
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

                        <div className="zone-item-action">
                          <div style={{ textAlign: 'left' }} className="zone-price-label">
                            <div style={{ fontSize: '17px', fontWeight: 800, color: 'var(--accent-pink)' }}>{formatVND(zone.price)}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>/ 1 vé</div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: 'rgba(0,0,0,0.4)', padding: '6px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                            <button
                              onClick={() => handleUpdateZoneQty(zone.id, -1)}
                              disabled={qty <= 0}
                              style={{ width: '32px', height: '32px', borderRadius: '6px', backgroundColor: qty > 0 ? 'var(--bg-tertiary)' : 'transparent', color: qty > 0 ? '#fff' : 'var(--text-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                              <Minus size={15} />
                            </button>
                            <span style={{ minWidth: '24px', textAlign: 'center', fontWeight: 800, fontSize: '16px', color: '#fff' }}>{qty}</span>
                            <button
                              onClick={() => handleUpdateZoneQty(zone.id, 1)}
                              disabled={totalZoneCount >= 5 || qty >= (zoneRemaining[zone.id] ?? zone.remaining) || (zoneRemaining[zone.id] ?? zone.remaining) <= 0}
                              style={{
                                width: '32px',
                                height: '32px',
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
                    {selectedSeats.map(seat => (
                      <div key={seat.code} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: '6px', backgroundColor: 'var(--bg-secondary)', fontSize: '13px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 800, color: 'var(--accent-pink)' }}>{seat.code}</span>
                          <span style={{ color: 'var(--text-muted)' }}>({seat.tier})</span>
                        </div>
                        <span style={{ fontWeight: 700 }}>{formatVND(seat.price)}</span>
                      </div>
                    ))}
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

            <button
              onClick={handleBookAndPay}
              disabled={!hasSelections || isProcessingPayment || isUpcoming}
              className="glow-btn-pink desktop-checkout-btn"
              style={{
                width: '100%', padding: '14px', fontSize: '15px', fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                opacity: (!hasSelections || isProcessingPayment || isUpcoming) ? 0.6 : 1,
                cursor: (!hasSelections || isProcessingPayment || isUpcoming) ? 'not-allowed' : 'pointer'
              }}
            >
              {isProcessingPayment ? (
                <>
                  <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', width: '18px', height: '18px' }} />
                  Đang kết nối PayOS...
                </>
              ) : isUpcoming ? (
                <>
                  <AlertTriangle size={18} />
                  Sự kiện chưa mở bán
                </>
              ) : (
                <>
                  <CreditCard size={18} />
                  {user ? `Đặt và giữ chỗ (PayOS) • ${formatVND(totalPrice)}` : 'Đăng nhập & Tiếp tục'}
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* MOBILE FLOATING STICKY CHECKOUT BAR (< 992px) */}
      {hasSelections && activeTab === 'booking' && bookingStep === 'booking' && !isUpcoming && (
        <div
          className="mobile-floating-checkout-bar glass-panel"
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 99,
            padding: '12px clamp(14px, 4vw, 24px)',
            paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
            borderTop: '1px solid rgba(236, 72, 153, 0.4)',
            boxShadow: '0 -8px 25px rgba(0, 0, 0, 0.8)',
            background: 'rgba(16, 22, 35, 0.95)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)'
          }}
        >
          {/* Drawer chi tiết ghế rút gọn khi bấm mở rộng */}
          {isMobileSummaryOpen && (
            <div
              style={{
                marginBottom: '10px',
                paddingBottom: '10px',
                borderBottom: '1px solid rgba(255,255,255,0.1)',
                maxHeight: '130px',
                overflowY: 'auto'
              }}
            >
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                {isSeated ? 'Danh sách ghế đã chọn:' : 'Khu vực đã chọn:'}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {isSeated ? (
                  selectedSeats.map(s => (
                    <span
                      key={s.code}
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: '4px',
                        backgroundColor: 'rgba(236, 72, 153, 0.2)',
                        border: '1px solid var(--accent-pink)',
                        color: '#fff'
                      }}
                    >
                      {s.code} • {formatVND(s.price)}
                    </span>
                  ))
                ) : (
                  event.zones?.filter(z => (zoneQuantities[z.id] || 0) > 0).map(z => (
                    <span
                      key={z.id}
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: '4px',
                        backgroundColor: 'rgba(99, 102, 241, 0.2)',
                        border: '1px solid var(--primary-light)',
                        color: '#fff'
                      }}
                    >
                      {z.name} x {zoneQuantities[z.id]} ({formatVND(z.price * zoneQuantities[z.id])})
                    </span>
                  ))
                )}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
            <div
              onClick={() => setIsMobileSummaryOpen(!isMobileSummaryOpen)}
              style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11.5px', color: 'var(--text-muted)' }}>
                <span>{isSeated ? `${selectedSeats.length} ghế` : `${totalZoneCount} vé`}</span>
                {isMobileSummaryOpen ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
              </div>
              <div style={{ fontSize: 'clamp(16px, 4.2vw, 20px)', fontWeight: 800, color: 'var(--accent-pink)', lineHeight: 1.2 }}>
                {formatVND(totalPrice)}
              </div>
            </div>

            <button
              onClick={handleBookAndPay}
              disabled={isProcessingPayment}
              className="glow-btn-pink"
              style={{
                flex: 1,
                maxWidth: '220px',
                padding: '12px 14px',
                fontSize: '13.5px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                borderRadius: 'var(--radius-md)'
              }}
            >
              {isProcessingPayment ? (
                <>
                  <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', width: '16px', height: '16px' }} />
                  <span>Đang kết nối...</span>
                </>
              ) : (
                <>
                  <CreditCard size={16} />
                  <span>{user ? 'Thanh toán PayOS' : 'Đăng nhập & Đặt'}</span>
                </>
              )}
            </button>
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
