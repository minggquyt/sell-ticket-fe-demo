import React, { useState } from 'react';
import Navbar from './components/Navbar';
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
      {/* Navigation Bar - Ẩn khi đang ở trang quản trị Admin vì đã có sidebar aside riêng */}
        {!(currentRoute === 'admin' && user && user.role === 'admin') && (
          <Navbar
            currentRoute={currentRoute}
            onNavigate={(route) => navigateTo(route)}
            user={user}
            onLogout={handleLogout}
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
              onBack={() => navigateTo('events')}
              onRequireLogin={() => navigateTo('login')}
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
                maxWidth: '600px',
                margin: '80px auto',
                padding: '36px',
                textAlign: 'center',
                backgroundColor: 'var(--bg-secondary)',
                borderRadius: 'var(--radius-xl)',
                border: '1px solid var(--border-color)'
              }}>
                <Shield size={48} color="var(--accent-pink)" style={{ marginBottom: '16px' }} />
                <h2 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '12px', color: '#fff' }}>
                  Khu vực Quản trị Hệ thống
                </h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '24px', lineHeight: 1.6 }}>
                  {!user
                    ? 'Bạn cần đăng nhập tài khoản quản trị viên (Admin) để truy cập chức năng này.'
                    : 'Tài khoản hiện tại của bạn không có quyền Quản trị viên (Admin). Vui lòng đăng nhập với tài khoản Admin.'}
                </p>
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                  <button
                    onClick={() => navigateTo('events')}
                    style={{
                      padding: '10px 20px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'rgba(255, 255, 255, 0.08)',
                      color: '#fff',
                      fontWeight: 600
                    }}
                  >
                    Quay lại Trang chủ
                  </button>
                  {!user ? (
                    <button
                      onClick={() => navigateTo('login')}
                      className="glow-btn-primary"
                      style={{
                        padding: '10px 20px',
                        borderRadius: 'var(--radius-md)',
                        color: '#fff',
                        fontWeight: 600
                      }}
                    >
                      Đăng nhập Admin
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setUser(prev => ({ ...prev, role: 'admin' }));
                        alert('Đã cấp quyền Quản trị viên tạm thời cho tài khoản này!');
                      }}
                      style={{
                        padding: '10px 20px',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: 'rgba(99, 102, 241, 0.2)',
                        border: '1px solid var(--border-glow)',
                        color: 'var(--primary-light)',
                        fontWeight: 600
                      }}
                    >
                      Kích hoạt quyền Admin (Demo)
                    </button>
                  )}
                </div>
              </div>
            )
          )}
        </main>

        {/* Footer - ẩn khi ở dashboard admin để layout tràn viền chuẩn app */}
        {currentRoute !== 'admin' && (
          <footer style={{
            backgroundColor: '#07090e',
            borderTop: '1px solid var(--border-color)',
            padding: '40px 24px 24px',
            marginTop: '60px'
          }}>
            <div style={{
              maxWidth: '1280px',
              margin: '0 auto',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '32px',
              marginBottom: '32px'
            }}>
              <div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#fff', marginBottom: '12px' }}>
                  Ticket<span style={{ color: 'var(--accent-pink)' }}>Verse</span>
                </div>
                <p style={{ color: 'var(--text-dim)', fontSize: '13px', lineHeight: 1.6 }}>
                  Nền tảng phân phối vé điện tử và quản lý đặt chỗ trực tuyến hàng đầu Việt Nam cho các concert, lễ hội và sự kiện lớn.
                </p>
              </div>

              <div>
                <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#fff', marginBottom: '12px' }}>Tính năng đặt chỗ</h4>
                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', color: 'var(--text-muted)' }}>
                  <li>Sơ đồ ghế trực quan (Seated-based)</li>
                  <li>Vé đứng khu vực (Zone-based)</li>
                  <li>Bộ lọc mức giá tối thiểu dropdown gọn gàng</li>
                  <li>Trang quản trị toàn diện CRUD sự kiện</li>
                </ul>
              </div>

              <div>
                <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#fff', marginBottom: '12px' }}>Phương thức Đăng nhập</h4>
                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', color: 'var(--text-muted)' }}>
                  <li>Google Single Sign-On</li>
                  <li>Zalo Official Login</li>
                  <li>Tài khoản Email & Mật khẩu bảo mật</li>
                </ul>
              </div>

              <div>
                <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#fff', marginBottom: '12px' }}>Hỗ trợ khách hàng</h4>
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
