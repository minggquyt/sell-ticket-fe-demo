import { LayoutDashboard, Ticket, LogOut, X } from 'lucide-react';
import './AdminSidebar.css';

// Thanh điều hướng trái của trang quản trị (tách từ AdminPage ở Phần 3c).
// CSS responsive của sidebar (trượt ra/vào trên mobile, cố định trên desktop) ở AdminSidebar.css.
export default function AdminSidebar({
  user,
  activeTab,
  eventsCount,
  ticketsCount,
  isMobileSidebarOpen,
  onSelectTab,
  onClose,
  onLogout,
  onNavigate,
}) {
  return (
    <aside className={`admin-sidebar ${isMobileSidebarOpen ? 'admin-sidebar-open' : ''}`}>
      {/* Trên cùng: Logo và Tên web + Nút đóng trên mobile */}
      <div className="sidebar-head">
        <div onClick={() => onNavigate && onNavigate('events')} className="sidebar-logo-wrap">
          <div className="sidebar-logo-icon">
            <Ticket size={24} color="#ffffff" />
          </div>
          <div>
            <div className="sidebar-logo-title">
              Ticket
              <span className="sidebar-logo-verse">Verse</span>
            </div>
            <div className="sidebar-logo-sub">Admin Console</div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="admin-sidebar-close-btn"

          title="Đóng menu"
        >
          <X size={18} />
        </button>
      </div>

      {/* Danh sách các mục điều hướng Sidebar */}
      <div className="sidebar-nav">
        <div className="sidebar-section-label">Hệ thống Quản lý</div>

        {/* Mục 1: Quản lý sự kiện (CRUD) */}
        <button
          onClick={() => onSelectTab('events')}
          className={`sidebar-nav-btn theme-indigo${activeTab === 'events' ? ' active' : ''}`}
        >
          <div className="sidebar-nav-btn-inner">
            <LayoutDashboard
              size={19}
              color={activeTab === 'events' ? 'var(--primary-light)' : 'var(--text-dim)'}
            />
            <span>Quản lý sự kiện</span>
          </div>
          <span
            className={`sidebar-count-badge theme-indigo${activeTab === 'events' ? ' active' : ''}`}
          >
            {eventsCount}
          </span>
        </button>

        {/* Mục 2: Quản lý vé */}
        <button
          onClick={() => onSelectTab('tickets')}
          className={`sidebar-nav-btn theme-pink${activeTab === 'tickets' ? ' active' : ''}`}
        >
          <div className="sidebar-nav-btn-inner">
            <Ticket
              size={19}
              color={activeTab === 'tickets' ? 'var(--accent-pink)' : 'var(--text-dim)'}
            />
            <span>Quản lý vé</span>
          </div>
          <span
            className={`sidebar-count-badge theme-pink${activeTab === 'tickets' ? ' active' : ''}`}
          >
            {ticketsCount}
          </span>
        </button>
      </div>

      {/* Góc dưới sidebar: Admin profile & Đăng xuất */}
      <div className="sidebar-foot">
        <div className="sidebar-profile">
          <img
            src={
              user?.avatar ||
              'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80'
            }
            alt="avatar"
            className="sidebar-avatar"
          />
          <div className="sidebar-profile-text">
            <div className="sidebar-profile-name">{user?.name || 'Administrator'}</div>
            <div className="sidebar-profile-role">Quản trị viên</div>
          </div>
        </div>

        <button
          onClick={() => (onLogout ? onLogout() : onNavigate && onNavigate('events'))}
          title="Đăng xuất khỏi trang quản trị"
          className="sidebar-logout-btn"
        >
          <LogOut size={16} />
        </button>
      </div>
    </aside>
  );
}
