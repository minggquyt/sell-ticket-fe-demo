import { Armchair, Layers, Calendar, MapPin, ChevronRight, Eye, Edit3, Trash2 } from 'lucide-react';
import {
  isSeatedEvent,
  isUpcomingEvent,
  formatEventDate,
  formatEventTime,
  getEventVenue,
  getMinPrice,
  getMaxPrice,
} from '../data/events';
import { formatVND } from '../utils/format.js';
import './EventCard.css';

export default function EventCard({
  event,
  variant = 'public',
  onSelect,
  onView,
  onEdit,
  onDelete,
}) {
  if (variant === 'admin') {
    return <AdminEventCard event={event} onView={onView} onEdit={onEdit} onDelete={onDelete} />;
  }
  return <PublicEventCard event={event} onSelect={onSelect} />;
}

function TypeBadge({ isSeated, small = false }) {
  return (
    <span
      className={`${isSeated ? 'badge-type-seated' : 'badge-type-zone'} event-card-type-badge${
        small ? ' event-card-type-badge-sm' : ''
      }`}
    >
      {isSeated ? <Armchair size={small ? 12 : 13} /> : <Layers size={small ? 12 : 13} />}
      {isSeated ? 'Seated-based' : 'Zone-based'}
    </span>
  );
}

function PublicEventCard({ event, onSelect }) {
  const isSeated = isSeatedEvent(event);
  return (
    <div onClick={() => onSelect(event)} className="glass-panel event-card event-card-public">
      {/* Thumbnail & Badges */}
      <div className="event-card-media">
        <img src={event.image} alt={event.title} className="event-card-img" />
        <div className="event-card-gradient" />

        {/* Status Badge (Upcoming) */}
        {isUpcomingEvent(event) && (
          <div className="event-card-pos event-card-pos-tl">
            <span className="badge-status-upcoming event-card-status-badge">Sắp diễn ra</span>
          </div>
        )}

        {/* Type Badge */}
        <div className="event-card-pos event-card-pos-tr">
          <TypeBadge isSeated={isSeated} />
        </div>

        {/* Category */}
        <div className="event-card-category">{event.category}</div>
      </div>

      {/* Body Content */}
      <div className="event-card-body">
        <div>
          <h3 className="event-card-title">{event.title}</h3>

          <div className="event-card-meta">
            <div className="event-card-meta-row">
              <Calendar size={15} color="var(--primary-light)" />
              <span>
                {formatEventDate(event)} • {formatEventTime(event) || event.time}
              </span>
            </div>
            <div className="event-card-meta-row">
              <MapPin size={15} color="var(--accent-pink)" />
              <span className="event-card-ellipsis">{getEventVenue(event)}</span>
            </div>
          </div>
        </div>

        {/* Price and CTA */}
        <div className="event-card-foot">
          <div>
            <div className="event-card-price-label">{isSeated ? 'Đồng giá' : 'Giá chỉ từ'}</div>
            <div className="event-card-price">{formatVND(getMinPrice(event))}</div>
          </div>

          <button className={`${isSeated ? 'glow-btn-primary' : 'glow-btn-pink'} event-card-cta`}>
            {isUpcomingEvent(event) ? 'Xem chi tiết' : 'Đặt vé ngay'}
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

function AdminEventCard({ event, onView, onEdit, onDelete }) {
  const isSeated = isSeatedEvent(event);
  return (
    <div className="glass-panel event-card event-card-admin">
      {/* Ảnh bìa + Category badge + Type badge */}
      <div className="event-card-admin-media">
        <img src={event.image} alt={event.title} className="event-card-admin-img" />
        <div className="event-card-pos event-card-pos-tl-sm">
          <span className="event-card-admin-category">{event.category}</span>
        </div>
        <div className="event-card-pos event-card-pos-tr-sm">
          <TypeBadge isSeated={isSeated} small />
        </div>
      </div>

      {/* Tiêu đề & Thông tin ngày/địa điểm */}
      <div className="event-card-admin-info">
        <h3 className="event-card-admin-title">{event.title}</h3>
        <div className="event-card-meta event-card-meta-admin">
          <div className="event-card-meta-row">
            <Calendar size={14} color="var(--primary-light)" className="event-card-meta-icon" />
            <span>{formatEventDate(event)}</span>
          </div>
          <div className="event-card-meta-row">
            <MapPin size={14} color="var(--accent-pink)" className="event-card-meta-icon" />
            <span className="event-card-ellipsis">{getEventVenue(event)}</span>
          </div>
        </div>
      </div>

      {/* Giá vé */}
      <div className="event-card-pricebox">
        <span className="event-card-pricebox-label">
          {isSeated ? 'Giá ghế ngồi:' : 'Giá vé từ:'}
        </span>
        <div className="event-card-pricebox-value">
          <span className="event-card-price event-card-price-admin">
            {formatVND(getMinPrice(event))}
          </span>
          {!isSeated && (
            <span className="event-card-price-max">- {formatVND(getMaxPrice(event))}</span>
          )}
        </div>
      </div>

      {/* Thao tác CRUD: Xem, Sửa, Xóa */}
      <div className="event-card-actions">
        <button
          onClick={() => onView && onView(event)}
          className="event-card-action event-card-action-view"
          title="Xem trang chi tiết khán giả"
        >
          <Eye size={15} /> <span>Xem</span>
        </button>
        <button
          onClick={() => onEdit(event)}
          className="event-card-action event-card-action-edit"
          title="Chỉnh sửa thông tin sự kiện"
        >
          <Edit3 size={15} /> <span>Sửa</span>
        </button>
        <button
          onClick={() => onDelete(event)}
          className="event-card-action event-card-action-delete"
          title="Xóa sự kiện"
        >
          <Trash2 size={15} /> <span>Xóa</span>
        </button>
      </div>
    </div>
  );
}
