import { useState } from 'react';
import {
  ArrowLeft,
  Bell,
  CheckCheck,
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
};

export default function NotificationsPage({
  user,
  notifications = [],
  onOpenLink,
  onRefresh,
  onBack,
  onRequireLogin,
}) {
  const toast = useToast();
  const [filter, setFilter] = useState('all'); // 'all' | 'unread' | 'refund' | 'order'

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
  const orderCount = notifications.filter((n) => n.category === 'order').length;

  const filtered = notifications.filter((n) => {
    if (filter === 'unread') return !n.isRead;
    if (filter === 'refund') return n.category === 'refund';
    if (filter === 'order') return n.category === 'order';
    return true;
  });

  const handleMarkAllRead = () => {
    toast.markAllRead(notifications.map((n) => n.id));
  };

  const openLink = (item, link) => {
    toast.markRead(item.id);
    if (link?.path?.startsWith('/')) {
      onOpenLink?.(link.path);
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
              Theo dõi trạng thái đơn vé, hoàn tiền và cảnh báo tài khoản ngân hàng. Bấm vào thông
              báo để đi tới đúng đơn hàng.
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
          onClick={() => setFilter('order')}
          className={`ntf-tab${filter === 'order' ? ' active' : ''}`}
        >
          Đơn đặt vé <span className="ntf-tab-count">{orderCount}</span>
        </button>
      </div>

      {/* Danh sách thông báo có đánh số thứ tự */}
      {filtered.length === 0 ? (
        <div className="glass-panel ntf-empty">
          <Bell size={36} className="ntf-empty-icon" />
          <h3>Không có thông báo nào trong mục này</h3>
          <p>
            Mọi thông báo mới về đơn đặt vé, hoàn tiền và tài khoản ngân hàng sẽ xuất hiện tại đây.
          </p>
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
                role="button"
                tabIndex={0}
                onClick={() => openLink(item, item.link)}
                onKeyDown={(e) => {
                  if (e.target !== e.currentTarget) return;
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openLink(item, item.link);
                  }
                }}
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

                  {(item.link || item.secondaryLink) && (
                    <div className="ntf-item-footer">
                      {item.link && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openLink(item, item.link);
                          }}
                          className="ntf-cta-btn"
                        >
                          <span>{item.link.label}</span>
                          <ArrowRight size={14} />
                        </button>
                      )}
                      {item.secondaryLink && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openLink(item, item.secondaryLink);
                          }}
                          className="ntf-secondary-btn"
                        >
                          <span>{item.secondaryLink.label}</span>
                          <ArrowRight size={14} />
                        </button>
                      )}
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
