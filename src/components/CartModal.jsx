import React from 'react';
import { ShoppingCart, X, Ticket, Calendar, MapPin, CheckCircle2 } from 'lucide-react';

export default function CartModal({ isOpen, onClose, cart = [] }) {
  if (!isOpen) return null;

  const formatVND = (val) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
  const totalCartAmount = cart.reduce((acc, item) => acc + (item.totalPrice || 0), 0);

  return (
    <div 
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100dvh',
        backgroundColor: 'rgba(5, 7, 12, 0.78)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 999999,
        padding: 'clamp(12px, 3vw, 20px)'
      }}
    >
      {/* Hộp Modal Giỏ hàng */}
      <div 
        onClick={(e) => e.stopPropagation()}
        className="glass-panel animate-fade-in"
        style={{
          maxWidth: '580px',
          width: '100%',
          maxHeight: '90dvh',
          borderRadius: 'var(--radius-xl)',
          backgroundColor: 'rgba(16, 22, 35, 0.95)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.8), 0 0 35px rgba(6, 182, 212, 0.2)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* Header Modal */}
        <div style={{
          padding: 'clamp(16px, 3vw, 22px) clamp(16px, 3.5vw, 26px)',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'rgba(255, 255, 255, 0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              backgroundColor: 'rgba(6, 182, 212, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-cyan)'
            }}>
              <ShoppingCart size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: '19px', fontWeight: 800, color: '#fff', margin: 0 }}>
                Giỏ hàng của bạn
              </h3>
              <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '2px' }}>
                {cart.length > 0 ? `Đang có ${cart.length} đơn vé điện tử đã thanh toán` : 'Chưa có vé nào'}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              backgroundColor: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'var(--transition)'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
              e.currentTarget.style.color = '#f87171';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.06)';
              e.currentTarget.style.color = 'var(--text-muted)';
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Nội dung danh sách vé */}
        <div style={{
          padding: 'clamp(16px, 3vw, 24px) clamp(16px, 3.5vw, 26px)',
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px'
        }}>
          {cart.length === 0 ? (
            <div style={{
              padding: '48px 20px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <div style={{
                width: '68px',
                height: '68px',
                borderRadius: '50%',
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-dim)',
                marginBottom: '16px'
              }}>
                <Ticket size={32} />
              </div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#fff', marginBottom: '6px' }}>
                Giỏ hàng trống
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '300px', lineHeight: 1.5 }}>
                Bạn chưa có đơn vé nào. Hãy chọn sự kiện yêu thích và hoàn tất thanh toán để vé được lưu vào đây!
              </p>
            </div>
          ) : (
            cart.map((item, index) => (
              <div
                key={index}
                style={{
                  padding: '16px 18px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '15px', fontWeight: 800, color: '#fff', marginBottom: '4px', lineHeight: 1.3 }}>
                      {item.eventTitle}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '12px', color: 'var(--text-muted)' }}>
                      <span>📅 {item.eventDate}</span>
                      <span>📍 {item.eventVenue}</span>
                    </div>
                  </div>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '3px 9px',
                    borderRadius: 'var(--radius-full)',
                    fontSize: '11px',
                    fontWeight: 700,
                    backgroundColor: 'rgba(16, 185, 129, 0.15)',
                    color: 'var(--accent-emerald)',
                    whiteSpace: 'nowrap'
                  }}>
                    <CheckCircle2 size={12} /> Đã thanh toán
                  </span>
                </div>

                <div style={{
                  backgroundColor: 'rgba(0, 0, 0, 0.35)',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-sm)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '13px',
                  border: '1px solid rgba(255, 255, 255, 0.05)'
                }}>
                  <div>
                    <span style={{ color: 'var(--text-dim)', fontSize: '12px' }}>Mã vé điện tử: </span>
                    <strong style={{ color: 'var(--primary-light)', fontFamily: 'monospace', letterSpacing: '0.5px' }}>
                      {item.ticketCode}
                    </strong>
                  </div>
                  <div style={{ color: 'var(--accent-pink)', fontWeight: 700 }}>
                    {item.ticketType}
                  </div>
                </div>

                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingTop: '6px',
                  borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                  fontSize: '12px'
                }}>
                  <span style={{ color: 'var(--text-dim)' }}>
                    Thanh toán qua {item.paymentMethod?.toUpperCase() || 'VNPAY'} • {item.purchaseDate}
                  </span>
                  <span style={{ fontSize: '15px', fontWeight: 800, color: 'var(--accent-pink)' }}>
                    {formatVND(item.totalPrice)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer Modal */}
        <div style={{
          padding: 'clamp(14px, 2.5vw, 18px) clamp(16px, 3.5vw, 26px)',
          borderTop: '1px solid var(--border-color)',
          backgroundColor: 'rgba(10, 13, 20, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px'
        }}>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>Tổng chi phí vé:</div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--accent-pink)' }}>
              {formatVND(totalCartAmount)}
            </div>
          </div>

          <button
            onClick={onClose}
            className="glow-btn-primary"
            style={{
              padding: '10px 24px',
              fontSize: '14px',
              fontWeight: 700,
              borderRadius: 'var(--radius-md)'
            }}
          >
            Đóng giỏ hàng
          </button>
        </div>
      </div>
    </div>
  );
}
