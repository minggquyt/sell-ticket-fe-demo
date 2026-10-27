import { useEffect } from 'react';
import {
  CheckCircle2,
  ShieldCheck,
  X,
  Calendar,
  MapPin,
  Clock,
  Ticket,
  Armchair,
  Layers,
  ExternalLink,
} from 'lucide-react';
import { formatVND } from '../utils/format.js';
import './ETicketModal.css';

export default function ETicketModal({
  isOpen,
  onClose,
  order,
  event,
  user,
  onSelectEvent,
}) {
  // Đóng modal khi bấm ESC
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose && onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen || !order) return null;

  const items = Array.isArray(order.items) ? order.items : [];
  const seatNumbers = items.map((i) => i.seatNumber || i.seat_number).filter(Boolean);
  const zoneCounts = {};
  items.forEach((i) => {
    const zName = i.zoneName || i.zone_name || 'STANDARD';
    zoneCounts[zName] = (zoneCounts[zName] || 0) + 1;
  });
  const zoneSummary = Object.entries(zoneCounts)
    .map(([z, q]) => `${z} x${q}`)
    .join(', ');

  const isSeated =
    order.eventType === 'SEAT_BASED' ||
    event?.type === 'seated' ||
    event?.event_type === 'SEAT_BASED' ||
    seatNumbers.length > 0;

  const eventDate =
    order.eventStartTime
      ? new Date(order.eventStartTime).toLocaleDateString('vi-VN')
      : event?.date || (order.createdAt ? new Date(order.createdAt).toLocaleDateString('vi-VN') : 'Đang cập nhật');

  const eventTime =
    order.eventStartTime
      ? new Date(order.eventStartTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
      : event?.time || '19:30';

  const eventVenue = order.location || event?.venue || event?.location || 'Chưa xác định';
  const eventId = order.eventId || event?.id;

  return (
    <div className="etm-overlay animate-fade-in" onClick={onClose}>
      <div className="glass-panel etm-card" onClick={(e) => e.stopPropagation()}>
        {/* Nút đóng ở góc trên */}
        <button onClick={onClose} className="etm-close-btn" aria-label="Đóng vé">
          <X size={20} />
        </button>

        {/* Header vé */}
        <div className="etm-header">
          <div className="etm-success-icon">
            <CheckCircle2 size={36} />
          </div>

          <div className="etm-badge">
            <ShieldCheck size={14} /> Vé điện tử hợp lệ (E-Ticket)
          </div>

          <h3 className="etm-title">Thông tin Vé điện tử</h3>

          <p className="etm-subtitle">
            Vé thuộc tài khoản{' '}
            <strong className="etm-highlight-white">{user?.email || order?.customerEmail}</strong>{' '}
            và được xác thực an toàn trên hệ thống.
          </p>
        </div>

        {/* Hộp chi tiết vé (Giống màn hình thanh toán thành công) */}
        <div className="etm-ticket-box">
          <div className="etm-ticket-row">
            <span className="etm-label">Mã đơn hàng:</span>
            <span className="etm-val-code">#{order.orderCode}</span>
          </div>

          <div className="etm-ticket-row">
            <span className="etm-label">Sự kiện:</span>
            <span className="etm-val-title">{order.eventTitle || event?.title}</span>
          </div>

          <div className="etm-ticket-row">
            <span className="etm-label">Thời gian:</span>
            <span className="etm-val">
              {eventDate} • {eventTime}
            </span>
          </div>

          <div className="etm-ticket-row">
            <span className="etm-label">Địa điểm:</span>
            <span className="etm-val">{eventVenue}</span>
          </div>

          {isSeated ? (
            <div className="etm-ticket-row">
              <span className="etm-label">Ghế ngồi:</span>
              <span className="etm-val-accent">
                {seatNumbers.length > 0 ? seatNumbers.join(', ') : 'Chưa chỉ định'}
              </span>
            </div>
          ) : (
            <div className="etm-ticket-row">
              <span className="etm-label">Khu vực / Số lượng:</span>
              <span className="etm-val-accent">
                {zoneSummary || `${items.length} vé`}
              </span>
            </div>
          )}

          {/* Chi tiết từng vé con trong đơn */}
          {items.length > 1 && (
            <div className="etm-items-sublist">
              <div className="etm-items-sublist-title">Danh sách {items.length} vị trí vé:</div>
              <div className="etm-items-sublist-grid">
                {items.map((it, idx) => (
                  <div key={idx} className="etm-subitem-chip">
                    <span className="etm-subitem-seat">{it.seatNumber || it.seat_number}</span>
                    <span className="etm-subitem-zone">({it.zoneName || it.zone_name || 'Standard'})</span>
                    <span className="etm-subitem-price">{formatVND(Number(it.price) || 0)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="etm-ticket-total-row">
            <span className="etm-label-plain">Tổng thanh toán:</span>
            <span className="etm-total-value">
              {formatVND(Number(order.totalAmount) || 0)}
            </span>
          </div>
        </div>

        {/* Nút hành động */}
        <div className="etm-actions">
          <button onClick={onClose} className="etm-btn-secondary">
            Đóng vé
          </button>
          {eventId && onSelectEvent && (
            <button
              onClick={() => {
                onClose();
                onSelectEvent(eventId);
              }}
              className="glow-btn-primary etm-btn-primary"
            >
              <span>Đến trang sự kiện</span>
              <ExternalLink size={15} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
