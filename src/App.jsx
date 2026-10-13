import React, { useState, useEffect, useCallback } from 'react';
import Navbar from './components/Navbar';
import CartModal from './components/CartModal';
import LoginPage from './pages/LoginPage';
import EventsPage from './pages/EventsPage';
import EventDetailPage from './pages/EventDetailPage';
import AdminPage from './pages/AdminPage';
import { 
  fetchEvents, 
  fetchSeatsByEvent, 
  createEventOnBackend, 
  deleteEventOnBackend 
} from './services/eventService';
import { Heart, Globe, Shield, HelpCircle, Loader2 } from 'lucide-react';

export default function App() {
  const [currentRoute, setCurrentRoute] = useState('events'); // 'login' | 'events' | 'detail' | 'admin'
  const [eventsList, setEventsList] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);
  const [user, setUser] = useState(null);
  const [cart, setCart] = useState([]); // Giỏ hàng: mảng các vé đã thanh toán thành công
  const [isCartOpen, setIsCartOpen] = useState(false); // Quản lý mở modal giỏ hàng

  // Quản lý ghế đã bán theo từng sự kiện (persistent trong phiên làm việc)
  const [occupiedSeatsByEvent, setOccupiedSeatsByEvent] = useState({});

  // Quản lý số vé còn lại theo zone của từng sự kiện
  const [zoneRemainingByEvent, setZoneRemainingByEvent] = useState({});

  const isAdminLoggedIn = Boolean(user && (user.role === 'admin' || user.role === 'ADMIN'));

  // Khôi phục phiên đăng nhập từ localStorage
  useEffect(() => {
    try {
      const savedUser = localStorage.getItem('sellticket_user');
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        setUser(parsed);
        if (parsed && (parsed.role === 'admin' || parsed.role === 'ADMIN')) {
          setCurrentRoute('admin');
          if (window.location.pathname !== '/admin') {
            window.history.replaceState({}, '', '/admin');
          }
        }
      }
    } catch (e) {
      console.warn('Lỗi đọc user từ localStorage:', e);
    }
  }, []);

  // Nếu user là Admin, luôn khóa chặt ở trang /admin
  useEffect(() => {
    if (isAdminLoggedIn) {
      if (currentRoute !== 'admin') {
        setCurrentRoute('admin');
      }
      if (window.location.pathname !== '/admin') {
        window.history.replaceState({}, '', '/admin');
      }
    }
  }, [isAdminLoggedIn, currentRoute]);

  // Đồng bộ route theo URL trình duyệt (chuẩn route BE quy định)
  useEffect(() => {
    const handleUrlChange = () => {
      const path = window.location.pathname;
      if (user && (user.role === 'admin' || user.role === 'ADMIN')) {
        setCurrentRoute('admin');
        if (path !== '/admin') {
          window.history.replaceState({}, '', '/admin');
        }
        return;
      }
      if (path === '/login') {
        setCurrentRoute('login');
      } else if (path === '/admin') {
        setCurrentRoute('admin');
      } else if (path.startsWith('/events/')) {
        const id = path.replace('/events/', '').split('/')[0];
        if (id) {
          setSelectedEventId(id);
          setCurrentRoute('detail');
        } else {
          setCurrentRoute('events');
        }
      } else {
        setCurrentRoute('events');
      }
    };

    handleUrlChange();
    window.addEventListener('popstate', handleUrlChange);
    return () => window.removeEventListener('popstate', handleUrlChange);
  }, [user]);

  // Tải danh sách sự kiện từ Backend
  const loadEvents = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsLoadingEvents(true);
    try {
      const data = await fetchEvents();
      if (data && data.length > 0) {
        setEventsList(data);
        const map = {};
        data.forEach(ev => {
          if (ev.zones) {
            map[ev.id] = Object.fromEntries(ev.zones.map(z => [z.id, z.available || z.remaining || 50]));
          }
        });
        setZoneRemainingByEvent(prev => ({ ...map, ...prev }));
      } else {
        setEventsList([]);
      }
    } catch (err) {
      console.error('Lỗi khi tải sự kiện từ Backend:', err);
    } finally {
      if (!isSilent) setIsLoadingEvents(false);
    }
  }, []);

  // Tự động kiểm tra và đồng bộ lại định kỳ mỗi 10 giây (ngầm, không nháy màn hình)
  useEffect(() => {
    loadEvents(false);
    const interval = setInterval(() => {
      loadEvents(true);
    }, 10000);
    return () => clearInterval(interval);
  }, [loadEvents]);

  // Điều hướng chuyển trang và cập nhật URL trình duyệt
  const navigateTo = (route, eventId = null) => {
    if (isAdminLoggedIn) {
      setCurrentRoute('admin');
      if (window.location.pathname !== '/admin') {
        window.history.pushState({}, '', '/admin');
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setCurrentRoute(route);
    let targetPath = '/events';
    if (route === 'login') {
      targetPath = '/login';
    } else if (route === 'admin') {
      targetPath = '/admin';
    } else if (route === 'detail' && eventId) {
      setSelectedEventId(eventId);
      targetPath = `/events/${eventId}`;
    } else if (route === 'events') {
      targetPath = '/events';
    }

    if (window.location.pathname !== targetPath) {
      window.history.pushState({}, '', targetPath);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLoginSuccess = (userData) => {
    setUser(userData);
    localStorage.setItem('sellticket_user', JSON.stringify(userData));
    if (userData && (userData.role === 'admin' || userData.role === 'ADMIN')) {
      setCurrentRoute('admin');
      if (window.location.pathname !== '/admin') {
        window.history.pushState({}, '', '/admin');
      }
    } else if (selectedEventId) {
      navigateTo('detail', selectedEventId);
    } else {
      navigateTo('events');
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('sellticket_user');
    setCart([]);
    setCurrentRoute('events');
    window.history.pushState({}, '', '/events');
  };

  // Thêm vé vào giỏ hàng sau khi thanh toán thành công
  const handleAddToCart = (ticketInfo) => {
    setCart(prev => [...prev, ticketInfo]);
  };

  // Xử lý cập nhật ghế / vé khi thanh toán thành công
  const handlePaymentSuccess = (eventId, eventType, selectedSeats, zoneQuantities) => {
    const isSeated = eventType === 'SEAT_BASED' || eventType === 'seated';
    if (isSeated) {
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

  // Đồng bộ trạng thái ghế đã bán từ Backend khi người dùng xem sự kiện
  useEffect(() => {
    if (!selectedEventId) return;
    fetchSeatsByEvent(selectedEventId).then(seats => {
      if (seats && seats.length > 0) {
        const soldOrReserved = seats
          .filter(s => s.status === 'SOLD' || s.status === 'RESERVED')
          .map(s => {
            const num = s.seat_number;
            if (/^[A-G]\d+$/.test(num)) {
              return `${num.charAt(0)}-${num.slice(1)}`;
            }
            return num;
          });
        if (soldOrReserved.length > 0) {
          setOccupiedSeatsByEvent(prev => ({
            ...prev,
            [selectedEventId]: new Set([...(prev[selectedEventId] || []), ...soldOrReserved])
          }));
        }
      }
    }).catch(err => console.warn('Không thể đồng bộ ghế từ Backend:', err));
  }, [selectedEventId]);

  // --- CRUD CHO ADMIN ---
  const handleAddEvent = async (newEvent) => {
    try {
      const created = await createEventOnBackend(newEvent, user?.token);
      setEventsList(prev => [created, ...prev]);
      alert('Thêm sự kiện mới thành công lên hệ thống Backend!');
    } catch (err) {
      console.error(err);
      setEventsList(prev => [newEvent, ...prev]);
      alert('Đã thêm sự kiện: ' + err.message);
    }
  };

  const handleUpdateEvent = (updatedEvent) => {
    setEventsList(prev => prev.map(e => e.id === updatedEvent.id ? updatedEvent : e));
    alert('Cập nhật thông tin sự kiện thành công!');
  };

  const handleDeleteEvent = async (id) => {
    try {
      await deleteEventOnBackend(id, user?.token);
      setEventsList(prev => prev.filter(e => e.id !== id));
      alert('Đã xóa sự kiện thành công khỏi hệ thống Backend!');
    } catch (err) {
      console.error(err);
      setEventsList(prev => prev.filter(e => e.id !== id));
      alert('Đã xóa sự kiện: ' + err.message);
    }
  };

  const currentEvent = eventsList.find(e => e.id === selectedEventId) || (eventsList.length > 0 ? eventsList[0] : null);

  // NẾU TÀI KHOẢN ADMIN ĐÃ ĐĂNG NHẬP: CHỈ HIỂN THỊ TRANG QUẢN TRỊ DUY NHẤT
  if (isAdminLoggedIn) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-primary)' }}>
        <main style={{ flex: 1 }}>
          <AdminPage
            events={eventsList}
            onAddEvent={handleAddEvent}
            onUpdateEvent={handleUpdateEvent}
            onDeleteEvent={handleDeleteEvent}
            user={user}
            onLogout={handleLogout}
          />
        </main>
      </div>
    );
  }

  // GIAO DIỆN DÀNH CHO KHÁCH HÀNG / NGƯỜI DÙNG THƯỜNG
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-primary)' }}>
      {/* Navigation Bar */}
      <Navbar
        currentRoute={currentRoute}
        onNavigate={(route) => navigateTo(route)}
        user={user}
        onLogout={handleLogout}
        cart={cart}
        onOpenCart={() => setIsCartOpen(true)}
      />

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
            isLoading={isLoadingEvents}
            onSelectEvent={(event) => navigateTo('detail', event.id)}
          />
        )}

        {currentRoute === 'detail' && (
          currentEvent ? (
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
          ) : (
            <div style={{ textAlign: 'center', padding: '120px 24px' }}>
              <div style={{
                display: 'inline-block',
                animation: 'spin 1s linear infinite',
                border: '3px solid rgba(255,255,255,0.1)',
                borderTopColor: 'var(--primary-light)',
                borderRadius: '50%',
                width: '36px',
                height: '36px',
                marginBottom: '16px'
              }} />
              <div style={{ color: 'var(--text-muted)', fontSize: '15px' }}>
                {isLoadingEvents ? 'Đang tải thông tin sự kiện...' : 'Không tìm thấy sự kiện.'}
              </div>
            </div>
          )
        )}

        {currentRoute === 'admin' && (
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
