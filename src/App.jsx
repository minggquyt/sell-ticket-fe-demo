import React, { useState } from 'react';
import Navbar from './components/Navbar';
import CartModal from './components/CartModal';
import LoginPage from './pages/LoginPage';
import EventsPage from './pages/EventsPage';
import EventDetailPage from './pages/EventDetailPage';
import AdminPage from './pages/AdminPage';
import { MOCK_EVENTS } from './data/events';
import { Heart, Globe, Shield, HelpCircle } from 'lucide-react';

export default function App() {
  const [currentRoute, setCurrentRoute] = useState('events'); // 'login' | 'events' | 'detail' | 'admin'
  const [eventsList, setEventsList] = useState(MOCK_EVENTS);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [user, setUser] = useState(null);
  const [cart, setCart] = useState([]); // Giỏ hàng: mảng các vé đã thanh toán thành công
  const [isCartOpen, setIsCartOpen] = useState(false); // Quản lý mở modal giỏ hàng

  // Điều hướng
  const navigateTo = (route, eventId = null) => {
    setCurrentRoute(route);
    if (eventId) {
      setSelectedEventId(eventId);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLoginSuccess = (userData) => {
    setUser(userData);
    if (selectedEventId) {
      setCurrentRoute('detail');
    } else {
      setCurrentRoute('events');
    }
  };

  const handleLogout = () => {
    setUser(null);
    setCart([]);
  };

  // Thêm vé vào giỏ hàng sau khi thanh toán thành công
  const handleAddToCart = (ticketInfo) => {
    setCart(prev => [...prev, ticketInfo]);
  };

  // Quản lý ghế đã bán theo từng sự kiện (persistent trong phiên làm việc)
  const [occupiedSeatsByEvent, setOccupiedSeatsByEvent] = useState({
    'ev-1': new Set(['A-3', 'A-4', 'B-5', 'C-1', 'C-2', 'D-7', 'E-4', 'F-5'])
  });

  // Quản lý số vé còn lại theo zone của từng sự kiện
  const [zoneRemainingByEvent, setZoneRemainingByEvent] = useState(() => {
    const map = {};
    MOCK_EVENTS.forEach(ev => {
      if (ev.zones) {
        map[ev.id] = Object.fromEntries(ev.zones.map(z => [z.id, z.remaining]));
      }
    });
    return map;
  });

  // Xử lý cập nhật ghế / vé khi thanh toán thành công
  const handlePaymentSuccess = (eventId, eventType, selectedSeats, zoneQuantities) => {
    if (eventType === 'seated') {
      setOccupiedSeatsByEvent(prev => {
        const currentSet = prev[eventId] ? new Set(prev[eventId]) : new Set();
        selectedSeats.forEach(s => currentSet.add(s.code));
        return { ...prev, [eventId]: currentSet };
      });
    } else {
      setZoneRemainingByEvent(prev => {
        const currentZones = prev[eventId] ? { ...prev[eventId] } : {};
        Object.entries(zoneQuantities).forEach(([zId, qty]) => {
          if (qty > 0) {
            currentZones[zId] = Math.max(0, (currentZones[zId] || 0) - qty);
          }
        });
        return { ...prev, [eventId]: currentZones };
      });
    }
  };

  // --- CRUD CHO ADMIN ---
  const handleAddEvent = (newEvent) => {
    setEventsList(prev => [newEvent, ...prev]);
    alert('Thêm sự kiện mới thành công!');
  };

  const handleUpdateEvent = (updatedEvent) => {
    setEventsList(prev => prev.map(e => e.id === updatedEvent.id ? updatedEvent : e));
    alert('Cập nhật thông tin sự kiện thành công!');
  };

  const handleDeleteEvent = (id) => {
    setEventsList(prev => prev.filter(e => e.id !== id));
    alert('Đã xóa sự kiện khỏi hệ thống!');
  };

  const currentEvent = eventsList.find(e => e.id === selectedEventId) || eventsList[0];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-primary)' }}>
      {/* Navigation Bar - Chỉ ẩn khi ở trang Admin (có sidebar riêng) */}
        {!(currentRoute === 'admin' && user && user.role === 'admin') && (
          <Navbar
            currentRoute={currentRoute}
            onNavigate={(route) => navigateTo(route)}
            user={user}
            onLogout={handleLogout}
            cart={cart}
            onOpenCart={() => setIsCartOpen(true)}
          />
        )}

        {/* Main View Router */}
        <main style={{ flex: 1 }}>
          {currentRoute === 'login' && (
            <LoginPage
              onLoginSuccess={handleLoginSuccess}
              onNavigate={(route) => navigateTo(route)}
            />
          )}

          {currentRoute === 'events' && (
            <EventsPage
              events={eventsList}
              onSelectEvent={(event) => navigateTo('detail', event.id)}
            />
          )}

          {currentRoute === 'detail' && (
            <EventDetailPage
              event={currentEvent}
              user={user}
              occupiedSeats={occupiedSeatsByEvent[currentEvent.id] || new Set()}
              zoneRemaining={zoneRemainingByEvent[currentEvent.id] || {}}
              onPaymentSuccess={handlePaymentSuccess}
              onBack={() => navigateTo('events')}
              onRequireLogin={() => navigateTo('login')}
              onAddToCart={handleAddToCart}
              onOpenCart={() => setIsCartOpen(true)}
            />
          )}

          {currentRoute === 'admin' && (
            user && user.role === 'admin' ? (
              <AdminPage
                events={eventsList}
                onAddEvent={handleAddEvent}
                onUpdateEvent={handleUpdateEvent}
                onDeleteEvent={handleDeleteEvent}
                onViewEvent={(event) => navigateTo('detail', event.id)}
                onNavigate={(route) => navigateTo(route)}
                user={user}
                onLogout={handleLogout}
              />
            ) : (
              <div style={{
                padding: '60px 24px',
                textAlign: 'center',
                maxWidth: '500px',
                margin: '100px auto',
                borderRadius: 'var(--radius-xl)',
                backgroundColor: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.25)'
              }}>
                <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#f87171', marginBottom: '8px' }}>
                  Truy cập bị từ chối
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '20px' }}>
                  Bạn cần đăng nhập bằng tài khoản Quản trị viên (Admin) để xem trang này.
                </p>
                <button
                  onClick={() => navigateTo('login')}
                  className="glow-btn-primary"
                  style={{ padding: '10px 24px' }}
                >
                  Đến trang Đăng nhập
                </button>
              </div>
            )
          )}
        </main>

        {/* Global Cart Modal - Làm mờ nền toàn màn hình, đặt ở root app */}
        <CartModal
          isOpen={isCartOpen}
          onClose={() => setIsCartOpen(false)}
          cart={cart}
        />

        {/* Global Footer (Chỉ hiển thị ngoài trang Admin) */}
        {!(currentRoute === 'admin' && user && user.role === 'admin') && (
          <footer style={{
            borderTop: '1px solid var(--border-color)',
            backgroundColor: 'rgba(10, 13, 20, 0.95)',
            padding: '48px 24px 24px',
            marginTop: 'auto'
          }}>
            <div style={{
              maxWidth: '1280px',
              margin: '0 auto',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '32px',
              marginBottom: '36px'
            }}>
              <div>
                <h4 style={{ fontSize: '18px', fontWeight: 800, color: '#fff', marginBottom: '14px' }}>
                  Ticket<span style={{ color: 'var(--accent-pink)' }}>Verse</span>
                </h4>
                <p style={{ color: 'var(--text-muted)', fontSize: '13px', lineHeight: 1.6 }}>
                  Nền tảng phân phối vé sự kiện và nhạc hội trực tuyến hàng đầu. Đảm bảo 100% vé chính hãng và trải nghiệm đặt vé mượt mà nhất.
                </p>
              </div>

              <div>
                <h5 style={{ fontSize: '14px', fontWeight: 700, color: '#fff', marginBottom: '14px' }}>Khám phá</h5>
                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', color: 'var(--text-muted)' }}>
                  <li style={{ cursor: 'pointer' }} onClick={() => navigateTo('events')}>Nhạc hội & Concert</li>
                  <li style={{ cursor: 'pointer' }} onClick={() => navigateTo('events')}>Lễ hội âm nhạc EDM</li>
                  <li style={{ cursor: 'pointer' }} onClick={() => navigateTo('events')}>Fan Meeting</li>
                  <li style={{ cursor: 'pointer' }} onClick={() => navigateTo('events')}>Khu vực & Sơ đồ ghế</li>
                </ul>
              </div>

              <div>
                <h5 style={{ fontSize: '14px', fontWeight: 700, color: '#fff', marginBottom: '14px' }}>Dành cho ban tổ chức</h5>
                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', color: 'var(--text-muted)' }}>
                  <li>Hợp tác phân phối vé</li>
                  <li>Giải pháp Check-in QR bảo mật</li>
                  <li>Quản lý phân khu thời gian thực</li>
                  <li>Báo cáo doanh thu & đối soát</li>
                </ul>
              </div>

              <div>
                <h5 style={{ fontSize: '14px', fontWeight: 700, color: '#fff', marginBottom: '14px' }}>Hỗ trợ khách hàng</h5>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                  <div>Hotline: 1900 6868 (8:00 - 22:00)</div>
                  <div>Email: support@ticketverse.vn</div>
                  <div style={{ marginTop: '8px', color: 'var(--accent-emerald)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Shield size={14} /> Bảo mật giao dịch 100%
                  </div>
                </div>
              </div>
            </div>

            <div style={{
              maxWidth: '1280px',
              margin: '0 auto',
              paddingTop: '20px',
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
              fontSize: '12px',
              color: 'var(--text-dim)'
            }}>
              <div>© 2026 TicketVerse Inc. All rights reserved.</div>
              <div style={{ display: 'flex', gap: '16px' }}>
                <span>Điều khoản sử dụng</span>
                <span>Chính sách bảo mật</span>
                <span>Quy định hoàn hủy vé</span>
              </div>
            </div>
          </footer>
        )}
      </div>
  );
}
