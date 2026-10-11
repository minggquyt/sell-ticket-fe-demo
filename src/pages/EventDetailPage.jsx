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
  Ticket
} from 'lucide-react';
import confetti from 'canvas-confetti';

export default function EventDetailPage({ event, user, onBack, onRequireLogin }) {
  // Common states
  const [activeTab, setActiveTab] = useState('booking'); // 'booking' | 'info'
  const [bookingSuccess, setBookingSuccess] = useState(false);

  // SEATED-BASED STATE
  // Sơ đồ ghế: hàng A..H, cột 1..8
  // Đã có một số ghế mock bị người khác mua sẵn:
  const [occupiedSeats] = useState(() => new Set(['A-3', 'A-4', 'B-5', 'C-1', 'C-2', 'D-7', 'E-4', 'F-5']));
  const [selectedSeats, setSelectedSeats] = useState([]); // tối đa 5 ghế
  
  // ZONE-BASED STATE
  // Key là zone.id, value là số lượng vé đặt (tổng tối đa 5 vé)
  const [zoneQuantities, setZoneQuantities] = useState({});

  // Countdown timer cho việc giữ chỗ (10 phút = 600s)
  const [timeLeft, setTimeLeft] = useState(600);
  const [timerActive, setTimerActive] = useState(false);

  // Format currency
  const formatVND = (val) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);

  // Kích hoạt timer khi bắt đầu chọn ghế hoặc chọn vé
  useEffect(() => {
    const hasSelections = selectedSeats.length > 0 || Object.values(zoneQuantities).some(q => q > 0);
    if (hasSelections && !timerActive) {
      setTimerActive(true);
    } else if (!hasSelections && timerActive) {
      setTimerActive(false);
      setTimeLeft(600);
    }
  }, [selectedSeats, zoneQuantities, timerActive]);

  useEffect(() => {
    if (!timerActive) return;
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          alert('Thời gian giữ vé đã hết! Hệ thống đã tự động hoàn trả vé cho người khác.');
          setSelectedSeats([]);
          setZoneQuantities({});
          setTimerActive(false);
          return 600;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [timerActive]);

  const formatTimer = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // --- LOGIC CHO SEATED-BASED (Tối đa 5 ghế) ---
  const handleToggleSeat = (seatCode, tier) => {
    if (occupiedSeats.has(seatCode)) return;

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

  // Tổng tiền Seated
  const totalSeatedPrice = selectedSeats.reduce((acc, curr) => acc + curr.price, 0);

  // --- LOGIC CHO ZONE-BASED (Tối đa 5 vé) ---
  const totalZoneCount = Object.values(zoneQuantities).reduce((acc, val) => acc + (val || 0), 0);

  const handleUpdateZoneQty = (zoneId, delta) => {
    const current = zoneQuantities[zoneId] || 0;
    if (delta > 0 && totalZoneCount >= 5) {
      alert('⚠️ Bạn chỉ được đặt tối đa 5 vé trong sự kiện Zone-based này!');
      return;
    }
    const nextVal = Math.max(0, current + delta);
    setZoneQuantities(prev => ({
      ...prev,
      [zoneId]: nextVal
    }));
  };

  // Tổng tiền Zone
  const totalZonePrice = (event.zones || []).reduce((acc, z) => {
    const qty = zoneQuantities[z.id] || 0;
    return acc + (qty * z.price);
  }, 0);

  // Thanh toán
  const handleProceedCheckout = () => {
    if (!user) {
      onRequireLogin();
      return;
    }

    if (event.type === 'seated' && selectedSeats.length === 0) {
      alert('Vui lòng chọn ít nhất 1 ghế trước khi thanh toán!');
      return;
    }

    if (event.type === 'zone' && totalZoneCount === 0) {
      alert('Vui lòng chọn số lượng vé muốn đặt trước khi thanh toán!');
      return;
    }

    // Trigger Confetti effect
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });

    setBookingSuccess(true);
  };

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
        <ArrowLeft size={16} /> Quay lại danh sách sự kiện
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
              fontWeight: 700
            }}>
              {event.status === 'ongoing' ? '● Đang mở bán vé' : 'Sắp diễn ra'}
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

      {/* TAB CONTENT: GIỚI THIỆU */}
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

      {/* TAB CONTENT: BOOKING INTERACTION */}
      {activeTab === 'booking' && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr',
          gap: '28px'
        }} className="booking-layout-grid">
          
          {/* CỘT TRÁI: KHÔNG GIAN CHỌN VÉ (SEATED HOẶC ZONE) */}
          <div className="glass-panel" style={{
            borderRadius: 'var(--radius-lg)',
            padding: '28px'
          }}>
            {/* THÔNG BÁO QUY ĐỊNH TỐI ĐA */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 18px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'rgba(99, 102, 241, 0.1)',
              border: '1px solid rgba(99, 102, 241, 0.25)',
              marginBottom: '24px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <ShieldCheck size={20} color="var(--primary-light)" />
                <span style={{ fontSize: '14px', fontWeight: 600 }}>
                  {event.type === 'seated' 
                    ? 'Chế độ Seated-based: Bạn được tự do chọn vị trí ghế (Tối đa 5 ghế).'
                    : 'Chế độ Zone-based: Đặt vé theo khu vực đứng/vé mở (Tối đa 5 vé).'}
                </span>
              </div>

              {timerActive && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: 'rgba(239, 68, 68, 0.2)',
                  color: '#f87171',
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-full)',
                  fontWeight: 700,
                  fontSize: '13px'
                }}>
                  <Timer size={15} />
                  Thời gian giữ: {formatTimer(timeLeft)}
                </div>
              )}
            </div>

            {/* TRƯỜNG HỢP 1: SEATED-BASED (CHỌN TỪNG GHẾ, MAX 5) */}
            {event.type === 'seated' && (
              <div>
                {/* Sân khấu Stage Visual */}
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

                {/* Chú giải loại ghế (Seat Tier Legend) */}
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  justifyContent: 'center',
                  gap: '16px',
                  marginBottom: '28px',
                  padding: '12px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--bg-secondary)'
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

                {/* Sơ đồ ghế Ma trận Rows & Columns */}
                <div style={{
                  overflowX: 'auto',
                  paddingBottom: '16px'
                }}>
                  <div style={{
                    minWidth: '500px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    alignItems: 'center'
                  }}>
                    {['A', 'B', 'C', 'D', 'E', 'F', 'G'].map(row => {
                      // Tìm tier thuộc hàng này
                      const tier = event.seatTiers?.find(t => t.rows.includes(row)) || event.seatTiers?.[0];
                      return (
                        <div key={row} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ width: '24px', fontWeight: 700, color: 'var(--text-dim)', textAlign: 'center', fontSize: '13px' }}>
                            {row}
                          </span>
                          
                          <div style={{ display: 'flex', gap: '8px' }}>
                            {[1, 2, 3, 4, 5, 6, 7, 8].map(col => {
                              const seatCode = `${row}-${col}`;
                              const isOccupied = occupiedSeats.has(seatCode);
                              const isSelected = selectedSeats.some(s => s.code === seatCode);

                              let bg = tier.color;
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
                                  key={seatCode}
                                  onClick={() => handleToggleSeat(seatCode, tier)}
                                  disabled={isOccupied}
                                  title={isOccupied ? `Ghế ${seatCode} đã có người mua` : `Ghế ${seatCode} - ${tier.name} (${formatVND(tier.price)})`}
                                  style={{
                                    width: '36px',
                                    height: '36px',
                                    borderRadius: '8px',
                                    backgroundColor: bg,
                                    color: '#fff',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    cursor: cursor,
                                    opacity: opacity,
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

                          <span style={{ width: '24px', fontWeight: 700, color: 'var(--text-dim)', textAlign: 'center', fontSize: '13px' }}>
                            {row}
                          </span>
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

            {/* TRƯỜNG HỢP 2: ZONE-BASED (CHỌN KHU VỰC, MAX 5 VÉ) */}
            {event.type === 'zone' && (
              <div>
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
                            <h4 style={{ fontSize: '16px', fontWeight: 700, color: '#fff' }}>
                              {zone.name}
                            </h4>
                          </div>
                          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                            {zone.description}
                          </p>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '12px' }}>
                            <span style={{ color: 'var(--accent-emerald)', fontWeight: 600 }}>
                              Còn lại: {zone.remaining} vé
                            </span>
                            <span style={{ color: 'var(--text-dim)' }}>•</span>
                            <span style={{ color: 'var(--text-dim)' }}>Khu vực đứng tự do</span>
                          </div>
                        </div>

                        {/* Price & Quantity Selector */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '17px', fontWeight: 800, color: 'var(--accent-pink)' }}>
                              {formatVND(zone.price)}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>/ 1 vé</div>
                          </div>

                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            backgroundColor: 'rgba(0,0,0,0.4)',
                            padding: '6px 10px',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--border-color)'
                          }}>
                            <button
                              onClick={() => handleUpdateZoneQty(zone.id, -1)}
                              disabled={qty <= 0}
                              style={{
                                width: '30px',
                                height: '30px',
                                borderRadius: '6px',
                                backgroundColor: qty > 0 ? 'var(--bg-tertiary)' : 'transparent',
                                color: qty > 0 ? '#fff' : 'var(--text-dim)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                            >
                              <Minus size={15} />
                            </button>

                            <span style={{ minWidth: '24px', textAlign: 'center', fontWeight: 800, fontSize: '16px', color: '#fff' }}>
                              {qty}
                            </span>

                            <button
                              onClick={() => handleUpdateZoneQty(zone.id, 1)}
                              disabled={totalZoneCount >= 5}
                              style={{
                                width: '30px',
                                height: '30px',
                                borderRadius: '6px',
                                backgroundColor: totalZoneCount < 5 ? 'var(--accent-pink)' : 'transparent',
                                color: totalZoneCount < 5 ? '#fff' : 'var(--text-dim)',
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

          {/* CỘT PHẢI: TỔNG QUAN ĐƠN HÀNG (CHECKOUT SIDEBAR) */}
          <div className="glass-panel" style={{
            borderRadius: 'var(--radius-lg)',
            padding: '24px',
            height: 'fit-content',
            position: 'sticky',
            top: '90px'
          }}>
            <h3 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '16px', color: '#fff', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              Thông tin đặt vé
            </h3>

            {/* Chi tiết từng ghế/vé */}
            {event.type === 'seated' ? (
              <div style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                  Ghế đã chọn ({selectedSeats.length}/5):
                </div>

                {selectedSeats.length === 0 ? (
                  <div style={{ padding: '16px', textAlign: 'center', borderRadius: '8px', backgroundColor: 'rgba(255,255,255,0.02)', color: 'var(--text-dim)', fontSize: '13px' }}>
                    Chưa có ghế nào được chọn. Hãy nhấp vào sơ đồ ghế bên trái.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto' }}>
                    {selectedSeats.map(seat => (
                      <div key={seat.code} style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        backgroundColor: 'var(--bg-secondary)',
                        fontSize: '13px'
                      }}>
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
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                  Vé khu vực ({totalZoneCount}/5):
                </div>

                {totalZoneCount === 0 ? (
                  <div style={{ padding: '16px', textAlign: 'center', borderRadius: '8px', backgroundColor: 'rgba(255,255,255,0.02)', color: 'var(--text-dim)', fontSize: '13px' }}>
                    Chưa có vé nào được chọn. Nhấn dấu (+) để thêm vé theo khu vực.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {event.zones?.filter(z => (zoneQuantities[z.id] || 0) > 0).map(z => (
                      <div key={z.id} style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        backgroundColor: 'var(--bg-secondary)',
                        fontSize: '13px'
                      }}>
                        <div>
                          <span style={{ fontWeight: 700 }}>{z.name}</span>
                          <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>x {zoneQuantities[z.id]} vé</div>
                        </div>
                        <span style={{ fontWeight: 700 }}>
                          {formatVND(z.price * zoneQuantities[z.id])}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tổng tiền */}
            <div style={{
              paddingTop: '16px',
              borderTop: '1px solid var(--border-color)',
              marginBottom: '24px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px', color: 'var(--text-muted)' }}>
                <span>Phí tiện ích / VAT:</span>
                <span>0 đ (Miễn phí)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '16px', fontWeight: 700, color: '#fff' }}>Tổng thanh toán:</span>
                <span style={{ fontSize: '20px', fontWeight: 800, color: 'var(--accent-pink)' }}>
                  {formatVND(event.type === 'seated' ? totalSeatedPrice : totalZonePrice)}
                </span>
              </div>
            </div>

            {/* Trạng thái người dùng */}
            {!user && (
              <div style={{
                padding: '10px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.25)',
                color: '#fcd34d',
                fontSize: '12px',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <AlertTriangle size={15} style={{ flexShrink: 0 }} />
                <span>Bạn cần đăng nhập để hoàn tất giữ chỗ và nhận vé qua email.</span>
              </div>
            )}

            {/* Nút thanh toán */}
            <button
              onClick={handleProceedCheckout}
              disabled={(event.type === 'seated' && selectedSeats.length === 0) || (event.type === 'zone' && totalZoneCount === 0)}
              className="glow-btn-pink"
              style={{
                width: '100%',
                padding: '14px',
                fontSize: '15px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                opacity: ((event.type === 'seated' && selectedSeats.length === 0) || (event.type === 'zone' && totalZoneCount === 0)) ? 0.5 : 1,
                cursor: ((event.type === 'seated' && selectedSeats.length === 0) || (event.type === 'zone' && totalZoneCount === 0)) ? 'not-allowed' : 'pointer'
              }}
            >
              <CreditCard size={18} />
              {user ? 'Xác nhận Đặt vé & Giữ chỗ' : 'Đăng nhập & Tiếp tục'}
            </button>
          </div>
        </div>
      )}

      {/* POPUP MODAL ĐẶT VÉ THÀNH CÔNG */}
      {bookingSuccess && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '20px'
        }}>
          <div className="glass-panel animate-fade-in" style={{
            maxWidth: '480px',
            width: '100%',
            borderRadius: 'var(--radius-xl)',
            padding: '36px',
            textAlign: 'center',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            boxShadow: '0 0 30px rgba(16, 185, 129, 0.2)'
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: 'rgba(16, 185, 129, 0.2)',
              color: 'var(--accent-emerald)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px'
            }}>
              <CheckCircle2 size={36} />
            </div>

            <h3 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '8px', color: '#fff' }}>
              Đặt vé & Giữ chỗ thành công!
            </h3>

            <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '20px' }}>
              Mã vé điện tử (E-Ticket) đã được gửi đến email <strong>{user?.email}</strong>.
            </p>

            <div style={{
              backgroundColor: 'var(--bg-secondary)',
              padding: '16px',
              borderRadius: 'var(--radius-md)',
              textAlign: 'left',
              fontSize: '13px',
              marginBottom: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}>
              <div><strong>Sự kiện:</strong> {event.title}</div>
              <div><strong>Thời gian:</strong> {event.date} - {event.time}</div>
              <div><strong>Địa điểm:</strong> {event.venue}</div>
              {event.type === 'seated' ? (
                <div><strong>Ghế đã giữ ({selectedSeats.length}):</strong> {selectedSeats.map(s => s.code).join(', ')}</div>
              ) : (
                <div><strong>Số lượng vé:</strong> {totalZoneCount} vé</div>
              )}
              <div style={{ color: 'var(--accent-pink)', fontWeight: 700, marginTop: '4px' }}>
                Tổng thanh toán: {formatVND(event.type === 'seated' ? totalSeatedPrice : totalZonePrice)}
              </div>
            </div>

            <button
              onClick={() => {
                setBookingSuccess(false);
                onBack();
              }}
              className="glow-btn-primary"
              style={{ width: '100%', padding: '12px', fontSize: '14px' }}
            >
              Về trang danh sách sự kiện
            </button>
          </div>
        </div>
      )}

      <style>{`
        @media (min-width: 992px) {
          .booking-layout-grid {
            grid-template-columns: 1fr 340px !important;
          }
        }
      `}</style>
    </div>
  );
}
