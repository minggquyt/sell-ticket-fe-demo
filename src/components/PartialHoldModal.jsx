import { AlertTriangle, X, Armchair, CheckCircle2, Ban } from 'lucide-react';
import './PartialHoldModal.css';
import { formatVND } from '../utils/format.js';

export default function PartialHoldModal({
  isOpen,
  onClose,
  onConfirm,
  isSubmitting = false,
  unavailableSeats = [],
  availableSeats = [],
  seatPrice = 0,
}) {
  if (!isOpen) return null;

  const estimatedAmount =
    availableSeats.reduce((sum, seat) => sum + (Number(seat.price) || Number(seatPrice) || 0), 0) ||
    availableSeats.length * (Number(seatPrice) || 0);

  return (
    <div
      onClick={!isSubmitting ? onClose : undefined}
      className="partial-hold-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="partial-hold-title"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-panel animate-fade-in partial-hold-panel"
      >
        {/* Header */}
        <div className="partial-hold-header">
          <div className="partial-hold-header-left">
            <div className="partial-hold-header-icon">
              <AlertTriangle size={22} />
            </div>
            <div>
              <h3 id="partial-hold-title" className="partial-hold-title">
                Một số ghế vừa được giữ
              </h3>
              <div className="partial-hold-subtitle">
                Chỉ còn {availableSeats.length}/{availableSeats.length + unavailableSeats.length} ghế
                bạn chọn đang trống
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="partial-hold-close-btn"
            aria-label="Đóng modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="partial-hold-body">
          <p className="partial-hold-desc">
            Trong lúc bạn thao tác, một số ghế đã có người khác giữ trước. Bạn có muốn tiếp tục giữ{' '}
            <strong>{availableSeats.length} ghế còn khả dụng</strong> không?
          </p>

          {/* Ghế không còn trống */}
          {unavailableSeats.length > 0 && (
            <div className="partial-hold-section">
              <div className="partial-hold-section-label partial-hold-label-danger">
                <Ban size={14} />
                <span>Ghế đã có người giữ ({unavailableSeats.length})</span>
              </div>
              <div className="partial-hold-chip-list">
                {unavailableSeats.map((seatCode, idx) => (
                  <span key={`${seatCode}-${idx}`} className="partial-hold-chip is-unavailable">
                    {typeof seatCode === 'string'
                      ? seatCode
                      : seatCode?.seat_number || seatCode?.code || 'N/A'}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Ghế còn trống */}
          <div className="partial-hold-section">
            <div className="partial-hold-section-label partial-hold-label-success">
              <CheckCircle2 size={14} />
              <span>Ghế còn trống có thể giữ ({availableSeats.length})</span>
            </div>
            <div className="partial-hold-chip-list">
              {availableSeats.map((seat, idx) => (
                <span key={seat.id || seat.seat_number || idx} className="partial-hold-chip is-available">
                  <Armchair size={14} />
                  <span>{seat.seat_number || seat.seatNumber}</span>
                </span>
              ))}
            </div>
          </div>

          {/* Ghi chú lưu ý */}
          <div className="partial-hold-notice">
            Ghế trống hiện chưa bị khóa tạm — hãy xác nhận sớm để tránh người khác giữ mất.
          </div>
        </div>

        {/* Footer */}
        <div className="partial-hold-footer">
          <div className="partial-hold-summary">
            <div className="partial-hold-summary-label">Tạm tính ({availableSeats.length} ghế):</div>
            <div className="partial-hold-summary-value">
              {estimatedAmount > 0 ? formatVND(estimatedAmount) : `${availableSeats.length} ghế`}
            </div>
          </div>

          <div className="partial-hold-actions">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="partial-hold-cancel-btn"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isSubmitting || availableSeats.length === 0}
              className="glow-btn-primary partial-hold-confirm-btn"
            >
              {isSubmitting ? 'Đang giữ ghế...' : `Giữ ${availableSeats.length} ghế còn lại`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}