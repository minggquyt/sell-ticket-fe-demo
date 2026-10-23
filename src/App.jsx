import { useState, useEffect, useCallback } from 'react';
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
  updateEventOnBackend,
  deleteEventOnBackend,
} from './services/eventService';
import { parseSeatCode } from './utils/seatLayout.js';
import { Routes, Route, Navigate, useNavigate, useLocation, useParams } from 'react-router-dom';
import { ToastProvider } from './components/Toast.jsx';
import Footer from './components/Footer.jsx';
import './App.css';
import { useToast } from './components/toastContext.js';

// Kiểm tra quyền admin ở một chỗ duy nhất (role có thể là 'admin' hoặc 'ADMIN')
const isAdminUser = (u) => Boolean(u && (u.role === 'admin' || u.role === 'ADMIN'));

// Gộp sự kiện backend vừa lưu với dữ liệu form gửi lên: các trường layout/ghế
// lấy theo form khi backend không trả về (dùng chung cho Thêm mới và Cập nhật)
const mergeSavedEvent = (formEvent, savedEvent) => ({
  ...formEvent,
  ...savedEvent,
  rowsCount: formEvent.rowsCount || savedEvent.rowsCount,
  seatsPerRow: formEvent.seatsPerRow || savedEvent.seatsPerRow,
  totalSeats: formEvent.totalSeats || savedEvent.totalSeats,
  seatConfig: {
    ...(savedEvent.seatConfig || {}),
    ...(formEvent.seatConfig || {}),
    rowsCount: formEvent.rowsCount || savedEvent.rowsCount,
    seatsPerRow: formEvent.seatsPerRow || savedEvent.seatsPerRow,
  },
});

// Cuộn lên đầu trang mỗi khi chuyển route (H2)
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);
  return null;
}

// Trang chi tiết sự kiện: lấy id từ URL bằng useParams (H2).
// Cách chọn sự kiện giữ nguyên như router tự chế trước đây: tìm theo id,
// chưa có trong danh sách thì tạm lấy sự kiện đầu tiên, danh sách trống thì báo đang tải/không tìm thấy.
function EventDetailRoute({
  eventsList,
  isLoadingEvents,
  user,
  occupiedSeatsByEvent,
  zoneRemainingByEvent,
  onPaymentSuccess,
  onBack,
  onRequireLogin,
  onAddToCart,
  onOpenCart,
}) {
  const { id } = useParams();
  const currentEvent =
    eventsList.find((e) => e.id === id) || (eventsList.length > 0 ? eventsList[0] : null);

  if (!currentEvent) {
    return (
      <div className="app-loading">
        <div className="app-loading-spinner" />
        <div className="app-loading-text">
          {isLoadingEvents ? 'Đang tải thông tin sự kiện...' : 'Không tìm thấy sự kiện.'}
        </div>
      </div>
    );
  }

  return (
    <EventDetailPage
      event={currentEvent}
      user={user}
      occupiedSeats={occupiedSeatsByEvent[currentEvent.id] || new Set()}
      zoneRemaining={zoneRemainingByEvent[currentEvent.id] || {}}
      onPaymentSuccess={onPaymentSuccess}
      onBack={onBack}
      onRequireLogin={onRequireLogin}
      onAddToCart={onAddToCart}
      onOpenCart={onOpenCart}
    />
  );
}

function AppShell() {
  const [eventsList, setEventsList] = useState([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);
  const [user, setUser] = useState(null);
  const [cart, setCart] = useState([]); // Giỏ hàng: mảng các vé đã thanh toán thành công
  const [isCartOpen, setIsCartOpen] = useState(false); // Quản lý mở modal giỏ hàng

  // Quản lý ghế đã bán theo từng sự kiện (persistent trong phiên làm việc)
  const [occupiedSeatsByEvent, setOccupiedSeatsByEvent] = useState({});

  // Quản lý số vé còn lại theo zone của từng sự kiện
  const [zoneRemainingByEvent, setZoneRemainingByEvent] = useState({});

  const isAdminLoggedIn = isAdminUser(user);

  // --- React Router (H2): route lấy từ URL thật, không còn state tự chế ---
  const navigate = useNavigate();
  const location = useLocation();
  const urlEventId = location.pathname.match(/^\/events\/([^/]+)/)?.[1] || null;
  const currentRoute =
    location.pathname === '/login'
      ? 'login'
      : location.pathname === '/admin'
        ? 'admin'
        : urlEventId
          ? 'detail'
          : 'events';

  // Nhớ sự kiện đang xem dở để đăng nhập xong quay lại đúng trang chi tiết (như router tự chế trước đây).
  // Cập nhật ngay trong lúc render theo mẫu React khuyến nghị, không dùng effect.
  const [lastViewedEventId, setLastViewedEventId] = useState(null);
  if (urlEventId && urlEventId !== lastViewedEventId) {
    setLastViewedEventId(urlEventId);
  }

  const toast = useToast();

  // Khôi phục phiên đăng nhập từ localStorage
  useEffect(() => {
    try {
      const savedUser = localStorage.getItem('sellticket_user');
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        setUser(parsed);
      }
    } catch (e) {
      console.warn('Lỗi đọc user từ localStorage:', e);
    }
  }, []);

  // Tải danh sách sự kiện từ Backend
  const loadEvents = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsLoadingEvents(true);
    try {
      const data = await fetchEvents();
      if (data && data.length > 0) {
        setEventsList(data);
        const map = {};
        data.forEach((ev) => {
          if (ev.zones) {
            map[ev.id] = Object.fromEntries(
              ev.zones.map((z) => [z.id, z.available || z.remaining || 50]),
            );
          }
        });
        setZoneRemainingByEvent((prev) => ({ ...map, ...prev }));
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

  // Điều hướng chuyển trang (H2: giữ nguyên chữ ký cũ, ruột dùng React Router)
  const navigateTo = (route, eventId = null) => {
    if (isAdminLoggedIn) {
      navigate('/admin');
      return;
    }
    if (route === 'login') {
      navigate('/login');
    } else if (route === 'admin') {
      navigate('/admin');
    } else if (route === 'detail' && eventId) {
      navigate(`/events/${eventId}`);
    } else {
      navigate('/events');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLoginSuccess = (userData) => {
    setUser(userData);
    localStorage.setItem('sellticket_user', JSON.stringify(userData));
    if (isAdminUser(userData)) {
      navigate('/admin');
    } else if (lastViewedEventId) {
      navigateTo('detail', lastViewedEventId);
    } else {
      navigateTo('events');
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('sellticket_user');
    setCart([]);
    navigate('/events');
  };

  // Thêm vé vào giỏ hàng sau khi thanh toán thành công
  const handleAddToCart = (ticketInfo) => {
    setCart((prev) => [...prev, ticketInfo]);
  };

  // Xử lý cập nhật ghế / vé khi thanh toán thành công
  const handlePaymentSuccess = (eventId, eventType, selectedSeats, zoneQuantities) => {
    const isSeated = eventType === 'SEAT_BASED' || eventType === 'seated';
    if (isSeated) {
      setOccupiedSeatsByEvent((prev) => {
        const currentSet = prev[eventId] ? new Set(prev[eventId]) : new Set();
        selectedSeats.forEach((s) => currentSet.add(s.code));
        return { ...prev, [eventId]: currentSet };
      });
    } else {
      setZoneRemainingByEvent((prev) => {
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
    if (!urlEventId) return;
    fetchSeatsByEvent(urlEventId)
      .then((seats) => {
        if (seats && seats.length > 0) {
          const now = new Date();
          const soldOrReserved = seats
            .filter((s) => {
              if (s.status === 'SOLD') return true;
              // Chỉ coi là đã đặt nếu là ghế đang giữ của NGƯỜI KHÁC và còn trong thời gian giữ:
              if (
                (s.status === 'RESERVED' || s.status === 'PAYMENT_PROCESSING') &&
                s.reserved_until
              ) {
                const notExpired = new Date(s.reserved_until) > now;
                const isOtherUser = !user?.id || (s.reserved_by && s.reserved_by !== user.id);
                return notExpired && isOtherUser;
              }
              return false;
            })
            .map((s) => {
              const parsed = parseSeatCode(s.seat_number);
              return parsed ? `${parsed.row}-${parsed.number}` : s.seat_number;
            });

          setOccupiedSeatsByEvent((prev) => ({
            ...prev,
            [urlEventId]: new Set(soldOrReserved),
          }));
        }
      })
      .catch((err) => console.warn('Không thể đồng bộ ghế từ Backend:', err));
  }, [urlEventId, user?.id]);

  // --- CRUD CHO ADMIN ---
  const handleAddEvent = async (newEvent) => {
    try {
      const created = await createEventOnBackend(newEvent, user?.token);
      const merged = mergeSavedEvent(newEvent, created);
      setEventsList((prev) => [merged, ...prev]);
      toast.success('Thêm sự kiện mới thành công lên hệ thống Backend!');
    } catch (err) {
      console.error(err);
      setEventsList((prev) => [newEvent, ...prev]);
      toast.error('Đã thêm sự kiện: ' + err.message);
    }
  };

  const handleUpdateEvent = async (updatedEvent) => {
    try {
      const saved = await updateEventOnBackend(updatedEvent.id, updatedEvent, user?.token);
      const merged = mergeSavedEvent(updatedEvent, saved);
      setEventsList((prev) => prev.map((e) => (e.id === updatedEvent.id ? merged : e)));
      toast.success('Cập nhật thông tin sự kiện và giá vé thành công lên hệ thống!');
    } catch (err) {
      console.error(err);
      setEventsList((prev) => prev.map((e) => (e.id === updatedEvent.id ? updatedEvent : e)));
      toast.error('Đã cập nhật sự kiện: ' + err.message);
    }
  };

  const handleDeleteEvent = async (id) => {
    try {
      await deleteEventOnBackend(id, user?.token);
      setEventsList((prev) => prev.filter((e) => e.id !== id));
      toast.success('Đã xóa sự kiện thành công khỏi hệ thống Backend!');
    } catch (err) {
      console.error(err);
      setEventsList((prev) => prev.filter((e) => e.id !== id));
      toast.error('Đã xóa sự kiện: ' + err.message);
    }
  };
  const eventsElement = (
    <EventsPage
      events={eventsList}
      isLoading={isLoadingEvents}
      onSelectEvent={(event) => navigateTo('detail', event.id)}
    />
  );

  const accessDeniedElement = (
    <div className="access-denied">
      <h3 className="access-denied-title">Truy cập bị từ chối</h3>
      <p className="access-denied-text">
        Bạn cần đăng nhập bằng tài khoản Quản trị viên (Admin) để xem trang này.
      </p>
      <button onClick={() => navigateTo('login')} className="glow-btn-primary access-denied-btn">
        Đến trang Đăng nhập
      </button>
    </div>
  );

  // NẾU TÀI KHOẢN ADMIN ĐÃ ĐĂNG NHẬP: CHỈ HIỂN THỊ TRANG QUẢN TRỊ DUY NHẤT
  if (isAdminLoggedIn) {
    return (
      <div className="app-shell">
        {location.pathname !== '/admin' && <Navigate to="/admin" replace />}
        <main className="app-main">
          <AdminPage
            events={eventsList}
            onAddEvent={handleAddEvent}
            onUpdateEvent={handleUpdateEvent}
            onDeleteEvent={handleDeleteEvent}
            onViewEvent={(ev) => navigateTo('detail', ev.id)}
            onNavigate={navigateTo}
            user={user}
            onLogout={handleLogout}
          />
        </main>
      </div>
    );
  }

  // GIAO DIỆN DÀNH CHO KHÁCH HÀNG / NGƯỜI DÙNG THƯỜNG
  return (
    <div className="app-shell">
      <ScrollToTop />

      {/* Navigation Bar */}
      <Navbar
        currentRoute={currentRoute}
        onNavigate={(route) => navigateTo(route)}
        user={user}
        onLogout={handleLogout}
        cart={cart}
        onOpenCart={() => setIsCartOpen(true)}
      />

      {/* Main View Router — React Router (H2) */}
      <main className="app-main">
        <Routes>
          <Route path="/" element={eventsElement} />
          <Route path="/events" element={eventsElement} />
          <Route
            path="/events/:id"
            element={
              <EventDetailRoute
                eventsList={eventsList}
                isLoadingEvents={isLoadingEvents}
                user={user}
                occupiedSeatsByEvent={occupiedSeatsByEvent}
                zoneRemainingByEvent={zoneRemainingByEvent}
                onPaymentSuccess={handlePaymentSuccess}
                onBack={() => navigateTo('events')}
                onRequireLogin={() => navigateTo('login')}
                onAddToCart={handleAddToCart}
                onOpenCart={() => setIsCartOpen(true)}
              />
            }
          />
          <Route path="/login" element={<LoginPage onLoginSuccess={handleLoginSuccess} />} />
          <Route path="/admin" element={accessDeniedElement} />
          <Route path="*" element={<Navigate to="/events" replace />} />
        </Routes>
      </main>

      {/* Global Cart Modal - Làm mờ nền toàn màn hình, đặt ở root app */}
      <CartModal isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} cart={cart} />

      {/* Global Footer (Chỉ hiển thị ngoài trang Admin) — tách thành component ở Phần 3a */}
      {!(currentRoute === 'admin' && isAdminLoggedIn) && <Footer onNavigate={navigateTo} />}
    </div>
  );
}

// Gốc app: bọc ToastProvider để mọi trang dùng được toast (H3)
export default function App() {
  return (
    <ToastProvider>
      <AppShell />
    </ToastProvider>
  );
}
