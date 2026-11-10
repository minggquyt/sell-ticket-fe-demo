import { useState } from 'react';
import {
  ArrowLeft,
  Bell,
  CheckCheck,
  Trash2,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Info,
  XCircle,
  ArrowRight,
} from 'lucide-react';
import { useToast } from '../components/toastContext.js';
import './OrderHistoryPage.css';
import './NotificationsPage.css';

const LEVEL_ICONS = {
  error: XCircle,
  warning: AlertTriangle,
  success: CheckCircle2,
  info: Info,
};

const CATEGORY_LABELS = {
  refund: 'Hoàn tiền & Ngân hàng',
  order: 'Đơn đặt vé',
  toast: 'Thông báo nổi (Toast)',
};

export default function NotificationsPage({
  user,
  notifications = [],
  onNavigate,
  onRefresh,
  onBack,
  onRequireLogin,
}) {
  const toast = useToast();
  const [filter, setFilter] = useState('all'); // 'all' | 'unread' | 'refund' | 'toast'

  if (!user) {
    return (
      <div className="order-history-page">
        <div className="glass-panel order-history-guest">
          <h2 className="order-history-guest-title">Trung tâm Thông báo</h2>
          <p className="order-history-guest-text">
            Vui lòng đăng nhập để xem thông báo hoàn tiền, trạng thái vé và lịch sử cảnh báo.
          </p>
          <div className="order-history-guest-actions">
            <button onClick={onRequireLogin} className="glow-btn-primary order-history-btn-primary">
              Đăng nhập ngay
            </button>
          </div>
        </div>
      </div>
    );
  }

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const refundCount = notifications.filter((n) => n.category === 'refund').length;
  const toastCount = notifications.filter((n) => n.category === 'toast').length;

  const filtered = notifications.filter((n) => {
    if (filter === 'unread') return !n.isRead;
    if (filter === 'refund') return n.category === 'refund';
    if (filter === 'toast') return n.category === 'toast';
    return true;
  });

  const handleMarkAllRead = () => {
    toast.markAllRead(notifications.map((n) => n.id));
  };

  const handleActionClick = (item) => {
    toast.markRead(item.id);
    if (item.actionRoute && onNavigate) {
      onNavigate(item.actionRoute);
    }
  };

  return (
    <div className="order-history-page animate-fade-in">
      <div className="oh-top-bar">
        <button onClick={onBack} className="event-back-btn">
          <ArrowLeft size={15} />
          <span>Quay lại</span>
        </button>

        <div className="ntf-top-actions">
          {onRefresh && (
            <button type="button" onClick={onRefresh} className="ntf-action-btn">
              <RefreshCw size={14} />
              <span>Làm mới</span>
            </button>
          )}
          {unreadCount > 0 && (
            <button type="button" onClick={handleMarkAllRead} className="ntf-action-btn primary">
              <CheckCheck size={15} />
              <span>Đánh dấu đã đọc tất cả ({unreadCount})</span>
            </button>
          )}
          {toastCount > 0 && (
            <button
              type="button"
              onClick={() => toast.clearHistory()}
              className="ntf-action-btn danger"
            >
              <Trash2 size={14} />
              <span>Xóa lịch sử Toast ({toastCount})</span>
            </button>
          )}
        </div>
      </div>

      <div className="ntf-header">
        <div className="ntf-header-title-row">
          <div className="ntf-header-icon">
            <Bell size={22} />
          </div>
          <div>
            <h1 className="ntf-title">Trung tâm Thông báo</h1>
            <p className="ntf-subtitle">
              Theo dõi toàn bộ cảnh báo tài khoản ngân hàng, trạng thái hoàn tiền và các thông báo
              nổi (Toast) bạn có thể đã bỏ lỡ.
            </p>
          </div>
        </div>
      </div>

      {/* Bộ lọc tab */}
      <div className="ntf-tabs">
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={`ntf-tab${filter === 'all' ? ' active' : ''}`}
        >
          Tất cả <span className="ntf-tab-count">{notifications.length}</span>
        </button>
        <button
          type="button"
          onClick={() => setFilter('unread')}
          className={`ntf-tab${filter === 'unread' ? ' active' : ''}`}
        >
          Chưa đọc <span className="ntf-tab-count unread">{unreadCount}</span>
        </button>
        <button
          type="button"
          onClick={() => setFilter('refund')}
          className={`ntf-tab${filter === 'refund' ? ' active' : ''}`}
        >
          Hoàn tiền &amp; Ngân hàng <span className="ntf-tab-count">{refundCount}</span>
        </button>
        <button
          type="button"
          onClick={() => setFilter('toast')}
          className={`ntf-tab${filter === 'toast' ? ' active' : ''}`}
        >
          Lịch sử Toast <span className="ntf-tab-count">{toastCount}</span>
        </button>
      </div>

      {/* Danh sách thông báo có đánh số thứ tự */}
      {filtered.length === 0 ? (
        <div className="glass-panel ntf-empty">
          <Bell size={36} className="ntf-empty-icon" />
          <h3>Không có thông báo nào trong mục này</h3>
          <p>Mọi thông báo mới về hoàn tiền, tài khoản ngân hàng và thao tác sẽ xuất hiện tại đây.</p>
        </div>
      ) : (
        <div className="ntf-list">
          {filtered.map((item, idx) => {
            const Icon = LEVEL_ICONS[item.level] || Info;
            const timeStr = item.createdAt
              ? new Date(item.createdAt).toLocaleString('vi-VN')
              : '';

            return (
              <div
                key={item.id}
                onClick={() => !item.isRead && toast.markRead(item.id)}
                className={`glass-panel ntf-card ntf-level-${item.level}${!item.isRead ? ' unread' : ''}`}
              >
                {/* Số thứ tự #1, #2, #3... */}
                <div className="ntf-number-col">
                  <span className="ntf-index-badge">#{idx + 1}</span>
                  {!item.isRead && <span className="ntf-unread-dot" title="Chưa đọc" />}
                </div>

                <div className={`ntf-icon-wrap ntf-icon-${item.level}`}>
                  <Icon size={19} />
                </div>

                <div className="ntf-content">
                  <div className="ntf-meta-row">
                    <span className={`ntf-category-tag ntf-cat-${item.category}`}>
                      {CATEGORY_LABELS[item.category] || 'Hệ thống'}
                    </span>
                    {item.urgent && !item.isRead && (
                      <span className="ntf-urgent-badge">Cần chú ý</span>
                    )}
                    {timeStr && <span className="ntf-time">{timeStr}</span>}
                  </div>

                  <h3 className="ntf-item-title">{item.title}</h3>
                  <p className="ntf-item-msg">{item.message}</p>

                  {item.actionLabel && (
                    <div className="ntf-item-footer">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleActionClick(item);
                        }}
                        className="ntf-cta-btn"
                      >
                        <span>{item.actionLabel}</span>
                        <ArrowRight size={14} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
