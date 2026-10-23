import { useState, useRef, useEffect } from 'react';
import {
  Ticket,
  Compass,
  User,
  LogOut,
  Menu,
  X,
  LayoutDashboard,
  ShoppingCart,
  ChevronDown,
} from 'lucide-react';
import './Navbar.css';

export default function Navbar({
  currentRoute,
  onNavigate,
  user,
  onLogout,
  cart = [],
  onOpenCart,
}) {
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
    <header className="navbar-header">
      <div className="navbar-inner">
        {/* Logo */}
        <div onClick={() => onNavigate('events')} className="navbar-logo">
          <div className="navbar-logo-icon">
            <Ticket size={20} color="#ffffff" />
          </div>
          <div>
            <span className="navbar-logo-text">
              Ticket<span className="navbar-logo-verse">Verse</span>
            </span>
            <div className="nav-logo-sub">Live Events & Concerts</div>
          </div>
        </div>

        {/* Navigation links - Khám phá sự kiện (Ẩn khi đang ở trang login) */}
        {currentRoute !== 'login' && (
          <nav className="desktop-nav">
            <button
              onClick={() => onNavigate('events')}
              className={`nav-explore-btn${currentRoute === 'events' ? ' active' : ''}`}
            >
              <Compass size={16} />
              Khám phá Sự kiện
            </button>
          </nav>
        )}

        {/* User Profile / Login Action & Cart */}
        <div className="navbar-actions">
          {/* Quick Cart Access Button (Accessible on both mobile and desktop) */}
          <button
            onClick={onOpenCart}
            title={`Giỏ hàng (${cart.length} vé)`}
            className={`nav-cart-btn${cart.length > 0 ? ' has-items' : ''}`}
          >
            <ShoppingCart size={19} />
            {cart.length > 0 && <span className="nav-cart-badge">{cart.length}</span>}
          </button>

          {user ? (
            <div className="nav-user-wrap" ref={dropdownRef}>
              {/* Avatar trigger button */}
              <button
                onClick={() => setDropdownOpen((prev) => !prev)}
                className={`nav-user-btn${dropdownOpen ? ' open' : ''}`}
              >
                <div className="nav-avatar-wrap">
                  <img
                    src={
                      user.avatar ||
                      `https://api.dicebear.com/7.x/bottts/svg?seed=${user.name || 'user'}`
                    }
                    alt="avatar"
                    className={`nav-avatar-img${isAdmin ? ' admin' : ''}`}
                  />
                  {isAdmin && <span title="Tài khoản Quản trị viên" className="nav-admin-dot" />}
                </div>

                <span className="nav-user-name">{user.name}</span>

                {isAdmin && <span className="nav-admin-badge">ADMIN</span>}

                <ChevronDown
                  size={15}
                  color="var(--text-muted)"
                  className={`nav-chevron${dropdownOpen ? ' open' : ''}`}
                />
              </button>

              {/* Dropdown Menu */}
              {dropdownOpen && (
                <div className="animate-fade-in nav-dropdown">
                  {/* User info mini header */}
                  <div className="nav-dropdown-head">
                    <div className="nav-dropdown-name">{user.name}</div>
                    <div className="nav-dropdown-email">
                      {user.email || 'Thành viên TicketVerse'}
                    </div>
                  </div>

                  {/* Mục Giỏ Hàng */}
                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      if (onOpenCart) onOpenCart();
                    }}
                    className="nav-dropdown-item"
                  >
                    <ShoppingCart size={17} color="var(--accent-cyan)" />
                    <div className="nav-dropdown-item-main">
                      <div className="nav-dropdown-cart-row">
                        <span>Giỏ hàng</span>
                        {cart.length > 0 && (
                          <span className="nav-cart-count-badge">{cart.length} vé</span>
                        )}
                      </div>
                      <div className="nav-dropdown-item-sub">Vé đã chọn & thanh toán</div>
                    </div>
                  </button>

                  <div className="nav-dropdown-divider" />

                  {/* Nút Đăng xuất */}
                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      onLogout();
                    }}
                    className="nav-dropdown-item danger"
                  >
                    <LogOut size={16} />
                    <span>Đăng xuất</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Nút đăng nhập */
            currentRoute !== 'login' && (
              <button
                onClick={() => onNavigate('login')}
                className="glow-btn-primary nav-login-btn"
              >
                <User size={15} />
                <span className="nav-login-text">Đăng nhập</span>
              </button>
            )
          )}

          {/* Mobile menu trigger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Menu"
            className="mobile-toggle"
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="animate-fade-in nav-mobile-drawer">
          {currentRoute !== 'login' && (
            <button
              onClick={() => {
                onNavigate('events');
                setMobileMenuOpen(false);
              }}
              className={`nav-mobile-item${currentRoute === 'events' ? ' active' : ''}`}
            >
              <Compass size={18} color="var(--primary-light)" />
              Khám phá Sự kiện
            </button>
          )}

          <button
            onClick={() => {
              setMobileMenuOpen(false);
              if (onOpenCart) onOpenCart();
            }}
            className="nav-mobile-item nav-mobile-item-between"
          >
            <div className="nav-mobile-cart-left">
              <ShoppingCart size={18} color="var(--accent-cyan)" />
              <span>Giỏ hàng</span>
            </div>
            {cart.length > 0 && (
              <span className="nav-cart-count-badge nav-cart-count-badge-lg">{cart.length} vé</span>
            )}
          </button>

          {user ? (
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                onLogout();
              }}
              className="nav-mobile-item nav-mobile-logout"
            >
              <LogOut size={18} />
              Đăng xuất ({user.name})
            </button>
          ) : (
            currentRoute !== 'login' && (
              <button
                onClick={() => {
                  onNavigate('login');
                  setMobileMenuOpen(false);
                }}
                className="glow-btn-primary nav-mobile-login"
              >
                <User size={16} />
                Đăng nhập / Tạo tài khoản
              </button>
            )
          )}
        </div>
      )}
    </header>
  );
}
