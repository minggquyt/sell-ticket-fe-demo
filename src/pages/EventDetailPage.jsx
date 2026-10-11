import React, { useState, useEffect } from 'react';
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
  Timer,
  CreditCard,
  Ticket,
  Lock,
  ShoppingCart,
  ChevronRight,
  X
} from 'lucide-react';
import confetti from 'canvas-confetti';

export default function EventDetailPage({ 
  event, 
  user, 
  occupiedSeats: initialOccupiedSeats, 
  zoneRemaining: initialZoneRemaining, 
  onPaymentSuccess, 
  onBack, 
  onRequireLogin, 
  onAddToCart, 
  onOpenCart 
}) {
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

  // Countdown thanh toán / giữ chỗ khi user bấm đặt vé (5 phút = 300s)
  const [paymentTimeLeft, setPaymentTimeLeft] = useState(300);
  const [paymentTimerActive, setPaymentTimerActive] = useState(false);

  // Trạng thái thanh toán
  const [paymentMethod, setPaymentMethod] = useState('vnpay'); // 'vnpay' | 'momo' | 'bank'
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // Format currency
  const formatVND = (val) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
  const formatTimer = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Timer thanh toán khi ở bước payment
  useEffect(() => {
    if (!paymentTimerActive) return;
    const interval = setInterval(() => {
      setPaymentTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          alert('Hết thời gian thanh toán! Vé đã được trả về hệ thống. Vui lòng chọn lại.');
          setBookingStep('booking');
          setPaymentTimerActive(false);
          setPaymentTimeLeft(300);
          return 300;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [paymentTimerActive]);

  // Sự kiện chưa mở bán - khoá
  const isUpcoming = event.status === 'upcoming';

  // --- LOGIC SEATED-BASED ---
  const handleToggleSeat = (seatCode, tier) => {
    if (occupiedSeats.has(seatCode) || isUpcoming) return;
    const isAlreadySelected = selectedSeats.some(s => s.code === seatCode);
    if (isAlreadySelected) {
      setSelectedSeats(prev => prev.filter(s => s.code !== seatCode));
    } else {
      if (selectedSeats.length >= 5) {
        alert('⚠️ Bạn chỉ được chọn tối đa 5 ghế cho mỗi đơn hàng theo quy định!');
        return;
      }
      setSelectedSeats(prev => [...prev, { code: seatCode, tier: tier.name, price: tier.price, color: tier.color }]);
    }
  };

  const totalSeatedPrice = selectedSeats.reduce((acc, curr) => acc + curr.price, 0);

  // --- LOGIC ZONE-BASED ---
  const totalZoneCount = Object.values(zoneQuantities).reduce((acc, val) => acc + (val || 0), 0);

  const handleUpdateZoneQty = (zoneId, delta) => {
    if (isUpcoming) return;
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

  const totalPrice = event.type === 'seated' ? totalSeatedPrice : totalZonePrice;
  const hasSelections = event.type === 'seated' ? selectedSeats.length > 0 : totalZoneCount > 0;

  // Bước 1 -> Bước 2: Giữ chỗ -> Thanh toán
  const handleProceedToPayment = () => {
    if (!user) {
      onRequireLogin();
      return;
    }
    if (!hasSelections) {
      alert('Vui lòng chọn vé trước khi tiến hành đặt chỗ!');
      return;
    }
    setBookingStep('payment');
    setPaymentTimerActive(true);
    setPaymentTimeLeft(300);
  };

  // Bước 2 -> Bước 3: Xử lý thanh toán -> Thành công
  const handleConfirmPayment = () => {
    setIsProcessingPayment(true);
    setTimeout(() => {
      setIsProcessingPayment(false);
      setPaymentTimerActive(false);

      // Tạo mã vé ngẫu nhiên
      const ticketCode = 'TK-' + Math.random().toString(36).toUpperCase().slice(2, 9);

      // Build thông tin vé để thêm vào giỏ hàng
      const ticketInfo = {
        ticketCode,
        eventId: event.id,
        eventTitle: event.title,
        eventDate: event.date,
        eventTime: event.time,
        eventVenue: event.venue,
        eventImage: event.image,
        ticketType: event.type === 'seated'
          ? `Ghế: ${selectedSeats.map(s => s.code).join(', ')}`
          : `Khu vực: ${event.zones?.filter(z => (zoneQuantities[z.id] || 0) > 0).map(z => `${z.name} x${zoneQuantities[z.id]}`).join(', ')}`,
        quantity: event.type === 'seated' ? selectedSeats.length : totalZoneCount,
        totalPrice,
        paymentMethod,
        purchaseDate: new Date().toLocaleString('vi-VN'),
        status: 'paid'
      };

      // Thêm vào giỏ hàng của App
      if (onAddToCart) onAddToCart(ticketInfo);

      // Cập nhật trạng thái ghế / khu vực sau thanh toán
      if (event.type === 'seated') {
        // Tô xám các ghế vừa đặt thành công
        setOccupiedSeats(prev => {
          const next = new Set(prev);
          selectedSeats.forEach(s => next.add(s.code));
          return next;
        });
      } else {
        // Trừ số lượng vé tồn kho của từng zone
        setZoneRemaining(prev => {
          const next = { ...prev };
          Object.entries(zoneQuantities).forEach(([zoneId, qty]) => {
            if (qty > 0) next[zoneId] = Math.max(0, (next[zoneId] || 0) - qty);
          });
          return next;
        });
      }

      // Thông báo cho App.jsx lưu lại trạng thái bền vững
      if (onPaymentSuccess) {
        onPaymentSuccess(event.id, event.type, selectedSeats, zoneQuantities);
      }

      // Confetti!
      confetti({ particleCount: 140, spread: 90, origin: { y: 0.6 } });

      setBookingStep('success');
    }, 2200);
  };

  const handleBackFromPayment = () => {
    setBookingStep('booking');
    setPaymentTimerActive(false);
    setPaymentTimeLeft(300);
  };

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '24px' }}>
      
      {/* Top back button */}
      <button
        onClick={bookingStep === 'payment' ? handleBackFromPayment : onBack}
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
        {bookingStep === 'payment' ? 'Quay lại chọn vé' : 'Quay lại danh sách sự kiện'}
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
            <span className={event.status === 'ongoing' ? 'badge-status-ongoing' : 'badge-status-upcoming'} style={{
              padding: '4px 12px',
              borderRadius: 'var(--radius-full)',
              fontSize: '12px',
              fontWeight: 700,
              whiteSpace: 'nowrap'
            }}>
              {event.status === 'ongoing' ? '● Đang mở bán vé' : '🔒 Sắp mở bán'}
            </span>

            <span className={event.type === 'seated' ? 'badge-type-seated' : 'badge-type-zone'} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 12px',
              borderRadius: 'var(--radius-full)',
              fontSize: '12px',
              fontWeight: 700
            }}>
              {event.type === 'seated' ? <Armchair size={14} /> : <Layers size={14} />}
              {event.type === 'seated' ? 'Sự kiện Seated-based (Chọn ghế tối đa 5 ghế)' : 'Sự kiện Zone-based (Đặt vé tối đa 5 vé)'}
            </span>
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
              <span>{event.date}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={18} color="var(--primary-light)" />
              <span>{event.time}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MapPin size={18} color="var(--accent-pink)" />
              <span>{event.venue}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Thông báo chưa mở bán */}
      {isUpcoming && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          padding: '20px 24px',
          borderRadius: 'var(--radius-lg)',
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          marginBottom: '24px'
        }}>
          <Lock size={24} color="#fbbf24" style={{ flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: 700, color: '#fbbf24', marginBottom: '4px' }}>
              Sự kiện chưa chính thức mở bán vé
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
              Việc chọn ghế và đặt vé sẽ được kích hoạt khi sự kiện chuyển sang trạng thái <strong style={{ color: '#fff' }}>Đang mở bán</strong>. Hãy theo dõi TicketVerse để không bỏ lỡ!
            </div>
          </div>
        </div>
      )}

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
          {event.type === 'seated' ? 'Sơ đồ chọn ghế' : 'Chọn khu vực & Đặt vé'}
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
                {isUpcoming
                  ? <Lock size={20} color="#fbbf24" />
                  : <ShieldCheck size={20} color="var(--primary-light)" />
                }
                <span style={{ fontSize: '14px', fontWeight: 600 }}>
                  {isUpcoming
                    ? 'Tính năng chọn vé bị khoá — Sự kiện chưa mở bán chính thức.'
                    : event.type === 'seated'
                      ? 'Chế độ Seated-based: Bạn được tự do chọn vị trí ghế (Tối đa 5 ghế).'
                      : 'Chế độ Zone-based: Đặt vé theo khu vực đứng/vé mở (Tối đa 5 vé).'}
                </span>
              </div>
            </div>

            {/* SEATED-BASED: Sơ đồ ghế */}
            {event.type === 'seated' && (
              <div style={{ opacity: isUpcoming ? 0.4 : 1, pointerEvents: isUpcoming ? 'none' : 'auto' }}>
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
                  {event.seatTiers?.map(tier => (
                    <div key={tier.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                      <div style={{ width: '14px', height: '14px', borderRadius: '4px', backgroundColor: tier.color }} />
                      <span style={{ fontWeight: 600 }}>{tier.name}</span>
                      <span style={{ color: 'var(--text-muted)' }}>({formatVND(tier.price)})</span>
                    </div>
                  ))}
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
                    {['A', 'B', 'C', 'D', 'E', 'F', 'G'].map(row => {
                      const tier = event.seatTiers?.find(t => t.rows.includes(row)) || event.seatTiers?.[0];
                      return (
                        <div key={row} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ width: '24px', fontWeight: 700, color: 'var(--text-dim)', textAlign: 'center', fontSize: '13px' }}>{row}</span>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            {[1, 2, 3, 4, 5, 6, 7, 8].map(col => {
                              const seatCode = `${row}-${col}`;
                              // Khi sự kiện chưa mở bán: tô xám toàn bộ ghế
                              const isOccupied = isUpcoming || occupiedSeats.has(seatCode);
                              const isSelected = !isUpcoming && selectedSeats.some(s => s.code === seatCode);
                              let bg = tier.color;
                              let cursor = 'pointer';
                              let opacity = 1;
                              if (isOccupied) { bg = '#334155'; cursor = 'not-allowed'; opacity = 0.5; }
                              else if (isSelected) { bg = 'var(--accent-pink)'; }
                              return (
                                <button
                                  key={seatCode}
                                  onClick={() => handleToggleSeat(seatCode, tier)}
                                  disabled={isOccupied}
                                  title={isOccupied ? `Ghế ${seatCode} đã có người mua` : `Ghế ${seatCode} - ${tier.name} (${formatVND(tier.price)})`}
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
                                  {col}
                                </button>
                              );
                            })}
                          </div>
                          <span style={{ width: '24px', fontWeight: 700, color: 'var(--text-dim)', textAlign: 'center', fontSize: '13px' }}>{row}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '12px', color: 'var(--text-dim)' }}>
                  * Nhấp chuột vào ghế trống để chọn hoặc bỏ chọn. Tối đa 5 ghế cho mỗi khách hàng.
                </div>
              </div>
            )}

            {/* ZONE-BASED */}
            {event.type === 'zone' && (
              <div style={{ opacity: isUpcoming ? 0.4 : 1, pointerEvents: isUpcoming ? 'none' : 'auto' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px', color: '#fff' }}>
                  Danh sách khu vực & Hạng vé
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {event.zones?.map(zone => {
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
                              {isUpcoming ? 'Chưa mở bán' : `Còn lại: ${zoneRemaining[zone.id] ?? zone.remaining} vé`}
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

            {event.type === 'seated' ? (
              <div style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>Ghế đã chọn ({selectedSeats.length}/5):</div>
                {selectedSeats.length === 0 ? (
                  <div style={{ padding: '16px', textAlign: 'center', borderRadius: '8px', backgroundColor: 'rgba(255,255,255,0.02)', color: 'var(--text-dim)', fontSize: '13px' }}>
                    {isUpcoming ? '🔒 Sự kiện chưa mở bán.' : 'Chưa có ghế nào được chọn.'}
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
                    {isUpcoming ? '🔒 Sự kiện chưa mở bán.' : 'Nhấn dấu (+) để thêm vé theo khu vực.'}
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

            {isUpcoming ? (
              <button
                disabled
                style={{ width: '100%', padding: '14px', fontSize: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', borderRadius: 'var(--radius-md)', backgroundColor: 'rgba(255,255,255,0.05)', color: 'var(--text-dim)', cursor: 'not-allowed', border: '1px solid var(--border-color)' }}
              >
                <Lock size={18} />
                Chưa mở bán — Vé chưa khả dụng
              </button>
            ) : (
              <button
                onClick={handleProceedToPayment}
                disabled={!hasSelections}
                className="glow-btn-pink"
                style={{ width: '100%', padding: '14px', fontSize: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: !hasSelections ? 0.5 : 1, cursor: !hasSelections ? 'not-allowed' : 'pointer' }}
              >
                <CreditCard size={18} />
                {user ? 'Giữ chỗ & Thanh toán →' : 'Đăng nhập & Tiếp tục'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ======== BƯỚC 2: THANH TOÁN ======== */}
      {activeTab === 'booking' && bookingStep === 'payment' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '28px' }} className="booking-layout-grid">
          
          {/* CỘT TRÁI: Thông tin thanh toán */}
          <div className="glass-panel" style={{ borderRadius: 'var(--radius-lg)', padding: '32px' }}>
            {/* Header bước */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '28px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: 'var(--accent-emerald)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 800, color: '#fff' }}>✓</div>
                <span style={{ fontSize: '13px', color: 'var(--accent-emerald)', fontWeight: 600 }}>Chọn vé</span>
              </div>
              <ChevronRight size={16} color="var(--text-dim)" />
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #ec4899)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 800, color: '#fff' }}>2</div>
                <span style={{ fontSize: '13px', color: '#fff', fontWeight: 700 }}>Thanh toán</span>
              </div>
              <ChevronRight size={16} color="var(--text-dim)" />
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 800, color: 'var(--text-dim)' }}>3</div>
                <span style={{ fontSize: '13px', color: 'var(--text-dim)' }}>Nhận vé</span>
              </div>
            </div>

            <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#fff', marginBottom: '24px' }}>
              Chọn phương thức thanh toán
            </h2>

            {/* Phương thức thanh toán */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px' }}>
              {[
                { id: 'vnpay', label: 'VNPay', desc: 'Thanh toán qua cổng VNPAY (ATM/Internet Banking)', icon: '🏦', color: '#0066b2' },
                { id: 'momo', label: 'MoMo', desc: 'Ví điện tử MoMo — Nhanh chóng & tiện lợi', icon: '💜', color: '#ae2070' },
                { id: 'bank', label: 'Chuyển khoản ngân hàng', desc: 'Vietcombank / Techcombank / MB Bank', icon: '🏧', color: '#10b981' }
              ].map(method => (
                <div
                  key={method.id}
                  onClick={() => setPaymentMethod(method.id)}
                  style={{
                    padding: '16px 20px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: paymentMethod === method.id ? 'rgba(99, 102, 241, 0.12)' : 'var(--bg-secondary)',
                    border: paymentMethod === method.id ? '2px solid var(--primary)' : '2px solid var(--border-color)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    transition: 'var(--transition)'
                  }}
                >
                  <span style={{ fontSize: '28px' }}>{method.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, color: '#fff', marginBottom: '3px' }}>{method.label}</div>
                    <div style={{ fontSize: '13px', color: 'var(--text-dim)' }}>{method.desc}</div>
                  </div>
                  <div style={{
                    width: '20px', height: '20px', borderRadius: '50%',
                    border: `2px solid ${paymentMethod === method.id ? 'var(--primary)' : 'var(--border-color)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    {paymentMethod === method.id && <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'var(--primary)' }} />}
                  </div>
                </div>
              ))}
            </div>

            {/* Cam kết bảo mật */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 16px', borderRadius: 'var(--radius-md)', backgroundColor: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
              <ShieldCheck size={18} color="var(--accent-emerald)" />
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                Giao dịch được bảo mật theo tiêu chuẩn PCI DSS. Thông tin thanh toán không được lưu trữ.
              </span>
            </div>
          </div>

          {/* CỘT PHẢI: Tóm tắt đơn hàng + Bộ đếm thời gian */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Bộ đếm thời gian giữ chỗ & thanh toán */}
            <div style={{
              borderRadius: 'var(--radius-lg)',
              padding: '20px',
              backgroundColor: paymentTimeLeft < 60 ? 'rgba(239, 68, 68, 0.12)' : 'rgba(245, 158, 11, 0.1)',
              border: paymentTimeLeft < 60 ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(245, 158, 11, 0.3)',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: paymentTimeLeft < 60 ? '#f87171' : '#fbbf24', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                ⏳ Thời gian giữ chỗ & thanh toán vé
              </div>
              <div style={{ fontSize: '44px', fontWeight: 900, color: paymentTimeLeft < 60 ? '#f87171' : '#fff', letterSpacing: '4px', fontFamily: 'monospace' }}>
                {formatTimer(paymentTimeLeft)}
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-dim)', marginTop: '8px' }}>
                Vị trí ghế / vé của bạn đang được hệ thống <strong>khóa giữ chỗ</strong>. Vui lòng hoàn tất thanh toán trước khi hết giờ.
              </div>
            </div>

            {/* Tóm tắt đơn hàng */}
            <div className="glass-panel" style={{ borderRadius: 'var(--radius-lg)', padding: '24px' }}>
              <h3 style={{ fontSize: '17px', fontWeight: 800, marginBottom: '16px', color: '#fff', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                Tóm tắt đơn hàng
              </h3>

              {/* Thông tin sự kiện */}
              <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', padding: '12px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-secondary)' }}>
                <img src={event.image} alt={event.title} style={{ width: '56px', height: '56px', borderRadius: '8px', objectFit: 'cover', flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: 700, color: '#fff', fontSize: '14px', marginBottom: '4px' }}>{event.title}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>{event.date} • {event.venue}</div>
                </div>
              </div>

              {/* Danh sách vé */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                {event.type === 'seated'
                  ? selectedSeats.map(seat => (
                    <div key={seat.code} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                      <span>Ghế <strong style={{ color: 'var(--accent-pink)' }}>{seat.code}</strong> ({seat.tier})</span>
                      <span style={{ fontWeight: 700 }}>{formatVND(seat.price)}</span>
                    </div>
                  ))
                  : event.zones?.filter(z => (zoneQuantities[z.id] || 0) > 0).map(z => (
                    <div key={z.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                      <span>{z.name} × {zoneQuantities[z.id]}</span>
                      <span style={{ fontWeight: 700 }}>{formatVND(z.price * zoneQuantities[z.id])}</span>
                    </div>
                  ))
                }
              </div>

              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '16px', fontWeight: 700, color: '#fff' }}>Tổng cộng:</span>
                  <span style={{ fontSize: '22px', fontWeight: 900, color: 'var(--accent-pink)' }}>{formatVND(totalPrice)}</span>
                </div>
              </div>

              {/* Nút xác nhận thanh toán */}
              <button
                onClick={handleConfirmPayment}
                disabled={isProcessingPayment}
                className="glow-btn-primary"
                style={{
                  width: '100%', padding: '14px', fontSize: '15px', fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  marginTop: '20px', opacity: isProcessingPayment ? 0.7 : 1
                }}
              >
                {isProcessingPayment ? (
                  <>
                    <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', width: '18px', height: '18px' }} />
                    Đang xử lý thanh toán...
                  </>
                ) : (
                  <>
                    <CreditCard size={18} />
                    Xác nhận thanh toán {formatVND(totalPrice)}
                  </>
                )}
              </button>

              <div style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-dim)', marginTop: '12px' }}>
                Bằng cách xác nhận, bạn đồng ý với{' '}
                <span style={{ color: 'var(--primary-light)', cursor: 'pointer' }}>Điều khoản đặt vé</span> của TicketVerse.
              </div>
            </div>
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
                <span style={{ color: '#fff' }}>{event.date} - {event.time}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-dim)' }}>Địa điểm:</span>
                <span style={{ color: '#fff', textAlign: 'right', maxWidth: '240px' }}>{event.venue}</span>
              </div>
              {event.type === 'seated' ? (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-dim)' }}>Ghế đã giữ:</span>
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
