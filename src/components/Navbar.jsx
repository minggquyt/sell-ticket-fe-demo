import React, { useState, useRef, useEffect } from 'react';
import { 
  Ticket, 
  Search, 
  Compass, 
  User, 
  LogOut, 
  Calendar, 
  MapPin, 
  Menu, 
  X, 
  Sparkles, 
  LayoutDashboard, 
  ShoppingCart, 
  ChevronDown, 
  ShieldCheck,
  UserCheck
} from 'lucide-react';

export default function Navbar({ currentRoute, onNavigate, user, onLogout, cart = [], onOpenCart }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Đóng dropdown khi click ra ngoài
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const isAdmin = user && user.role === 'admin';

  return (
    <header style={{
      position: 'sticky',
      top: 0,
      zIndex: 50,
      backgroundColor: 'rgba(10, 13, 20, 0.85)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      borderBottom: '1px solid var(--border-color)',
    }}>
      <div style={{
        maxWidth: '1280px',
        margin: '0 auto',
        padding: '0 24px',
        height: '72px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '20px'
      }}>
        {/* Logo */}
        <div 
          onClick={() => onNavigate('events')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            cursor: 'pointer',
            userSelect: 'none'
          }}
        >
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #6366f1 0%, #ec4899 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 15px rgba(99, 102, 241, 0.4)'
          }}>
            <Ticket size={22} color="#ffffff" />
          </div>
          <div>
            <span style={{
              fontSize: '20px',
              fontWeight: 800,
              letterSpacing: '-0.5px',
              background: 'linear-gradient(90deg, #fff 0%, #cbd5e1 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>
              Ticket<span style={{ color: '#ec4899', WebkitTextFillColor: '#ec4899' }}>Verse</span>
            </span>
            <div style={{ fontSize: '10px', color: 'var(--text-dim)', letterSpacing: '1px', textTransform: 'uppercase', fontWeight: 600 }}>
              Live Events & Concerts
            </div>
          </div>
        </div>

        {/* Navigation links - Khám phá sự kiện (Ẩn khi đang ở trang login) */}
        {currentRoute !== 'login' && (
          <nav style={{
            display: 'none',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
            padding: '6px 8px',
            borderRadius: 'var(--radius-full)',
            border: '1px solid var(--border-color)'
          }} className="desktop-nav">
            <button
              onClick={() => onNavigate('events')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 18px',
                borderRadius: 'var(--radius-full)',
                background: currentRoute === 'events' ? 'var(--bg-tertiary)' : 'transparent',
                color: currentRoute === 'events' ? '#fff' : 'var(--text-muted)',
                fontWeight: 600,
                fontSize: '14px',
                border: currentRoute === 'events' ? '1px solid var(--border-glow)' : '1px solid transparent'
              }}
            >
              <Compass size={16} />
              Khám phá Sự kiện
            </button>
          </nav>
        )}

        {/* User Profile / Login Action */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {user ? (
            <div style={{ position: 'relative' }} ref={dropdownRef}>
              {/* Avatar trigger button */}
              <button
                onClick={() => setDropdownOpen(prev => !prev)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '6px 14px 6px 8px',
                  borderRadius: 'var(--radius-full)',
                  background: dropdownOpen ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                  border: dropdownOpen ? '1px solid var(--border-glow)' : '1px solid var(--border-color)',
                  color: '#fff',
                  cursor: 'pointer',
                  transition: 'var(--transition)'
                }}
              >
                <div style={{ position: 'relative' }}>
                  <img 
                    src={user.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.name || 'user'}`} 
                    alt="avatar" 
                    style={{ 
                      width: '32px', 
                      height: '32px', 
                      borderRadius: '50%', 
                      objectFit: 'cover',
                      border: isAdmin ? '2px solid var(--accent-pink)' : '2px solid var(--primary-light)'
                    }} 
                  />
                  {isAdmin && (
                    <span 
                      title="Tài khoản Quản trị viên"
                      style={{
                        position: 'absolute',
                        bottom: -2,
                        right: -2,
                        width: '12px',
                        height: '12px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--accent-pink)',
                        border: '2px solid #0a0d14'
                      }} 
                    />
                  )}
                </div>
                
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#fff', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user.name}
                </span>

                {isAdmin && (
                  <span style={{
                    fontSize: '10px',
                    padding: '2px 7px',
                    borderRadius: '4px',
                    backgroundColor: 'rgba(236, 72, 153, 0.2)',
                    color: '#f472b6',
                    fontWeight: 700,
                    letterSpacing: '0.5px'
                  }}>
                    ADMIN
                  </span>
                )}

                {/* Badge số vé trong giỏ */}
                {cart.length > 0 && (
                  <span style={{
                    fontSize: '11px',
                    backgroundColor: 'var(--accent-cyan)',
                    color: '#0a0d14',
                    fontWeight: 800,
                    borderRadius: '10px',
                    padding: '1px 6px',
                    marginLeft: '2px'
                  }}>
                    {cart.length}
                  </span>
                )}

                <ChevronDown 
                  size={16} 
                  color="var(--text-muted)" 
                  style={{
                    transform: dropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s ease'
                  }}
                />
              </button>

              {/* Dropdown Menu */}
              {dropdownOpen && (
                <div 
                  className="animate-fade-in"
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 10px)',
                    right: 0,
                    width: '250px',
                    borderRadius: 'var(--radius-lg)',
                    padding: '8px',
                    backgroundColor: 'rgba(8, 11, 20, 0.97)',
                    backdropFilter: 'blur(24px)',
                    WebkitBackdropFilter: 'blur(24px)',
                    boxShadow: '0 16px 40px rgba(0, 0, 0, 0.8), 0 0 1px rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    zIndex: 100,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                  }}
                >
                  {/* User info mini header */}
                  <div style={{
                    padding: '10px 12px',
                    borderBottom: '1px solid var(--border-color)',
                    marginBottom: '4px'
                  }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>{user.name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {user.email || 'Thành viên TicketVerse'}
                    </div>
                  </div>

                  {/* Mục Trang Quản Trị - Chỉ xuất hiện khi là Admin */}
                  {isAdmin && (
                    <button
                      onClick={() => {
                        setDropdownOpen(false);
                        onNavigate('admin');
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '10px 12px',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: currentRoute === 'admin' ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
                        color: currentRoute === 'admin' ? 'var(--primary-light)' : '#fff',
                        fontSize: '13px',
                        fontWeight: 600,
                        textAlign: 'left',
                        transition: 'var(--transition)'
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(99, 102, 241, 0.15)';
                        e.currentTarget.style.color = 'var(--primary-light)';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.backgroundColor = currentRoute === 'admin' ? 'rgba(99, 102, 241, 0.2)' : 'transparent';
                        e.currentTarget.style.color = currentRoute === 'admin' ? 'var(--primary-light)' : '#fff';
                      }}
                    >
                      <LayoutDashboard size={17} color="var(--accent-pink)" />
                      <div style={{ flex: 1 }}>
                        <div>Trang quản trị</div>
                        <div style={{ fontSize: '10px', color: 'var(--text-dim)', fontWeight: 500 }}>Dành cho tài khoản admin</div>
                      </div>
                    </button>
                  )}

                  {/* Mục Giỏ Hàng */}
                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      if (onOpenCart) onOpenCart();
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'transparent',
                      color: '#fff',
                      fontSize: '13px',
                      fontWeight: 600,
                      textAlign: 'left',
                      transition: 'var(--transition)'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.06)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <ShoppingCart size={17} color="var(--accent-cyan)" />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span>Giỏ hàng</span>
                        {cart.length > 0 && (
                          <span style={{ fontSize: '11px', backgroundColor: 'var(--accent-cyan)', color: '#000', fontWeight: 800, padding: '1px 6px', borderRadius: '10px' }}>
                            {cart.length} vé
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text-dim)', fontWeight: 500 }}>Vé đã chọn & thanh toán</div>
                    </div>
                  </button>

                  <div style={{ height: '1px', backgroundColor: 'var(--border-color)', margin: '4px 0' }} />

                  {/* Nút Đăng xuất */}
                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      onLogout();
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'transparent',
                      color: '#f87171',
                      fontSize: '13px',
                      fontWeight: 600,
                      textAlign: 'left',
                      transition: 'var(--transition)'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.12)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <LogOut size={16} />
                    <span>Đăng xuất</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Ẩn nút đăng nhập ở góc khi người dùng đang ở chính trang login */
            currentRoute !== 'login' && (
              <button
                onClick={() => onNavigate('login')}
                className="glow-btn-primary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 20px',
                  fontSize: '14px'
                }}
              >
                <User size={16} />
                Đăng nhập / Tài khoản
              </button>
            )
          )}

          {/* Mobile menu trigger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            style={{
              display: 'none',
              padding: '8px',
              borderRadius: '8px',
              background: 'transparent',
              color: 'var(--text-muted)'
            }}
            className="mobile-toggle"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div style={{
          padding: '16px 24px 20px',
          borderTop: '1px solid var(--border-color)',
          backgroundColor: '#0d121d',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}>
          {currentRoute !== 'login' && (
            <button
              onClick={() => {
                onNavigate('events');
                setMobileMenuOpen(false);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '12px 16px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: currentRoute === 'events' ? 'var(--bg-tertiary)' : 'transparent',
                color: '#fff',
                fontSize: '14px',
                fontWeight: 600,
                textAlign: 'left'
              }}
            >
              <Compass size={18} />
              Khám phá Sự kiện
            </button>
          )}

          {isAdmin && (
            <button
              onClick={() => {
                onNavigate('admin');
                setMobileMenuOpen(false);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '12px 16px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: currentRoute === 'admin' ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
                color: 'var(--primary-light)',
                fontSize: '14px',
                fontWeight: 600,
                textAlign: 'left'
              }}
            >
              <LayoutDashboard size={18} color="var(--accent-pink)" />
              Trang quản trị (Admin)
            </button>
          )}

          {user && (
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                if (onOpenCart) onOpenCart();
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '12px 16px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'transparent',
                color: '#fff',
                fontSize: '14px',
                fontWeight: 600,
                textAlign: 'left'
              }}
            >
              <ShoppingCart size={18} color="var(--accent-cyan)" />
              Giỏ hàng ({cart.length})
            </button>
          )}
        </div>
      )}

      <style>{`
        @media (min-width: 768px) {
          .desktop-nav {
            display: flex !important;
          }
        }
        @media (max-width: 767px) {
          .mobile-toggle {
            display: block !important;
          }
        }
      `}</style>
    </header>
  );
}
