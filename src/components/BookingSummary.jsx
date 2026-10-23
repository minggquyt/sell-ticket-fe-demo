import { AlertTriangle, CreditCard, Timer, X } from 'lucide-react';
import { formatVND } from '../utils/format.js';
import './BookingSummary.css';

// Panel tóm tắt đặt vé bên phải trang chi tiết (tách từ EventDetailPage ở Phần 3d):
// ghế/vé đã chọn, tổng tiền, nút giữ chỗ / thanh toán / hủy giữ ghế.
// Toàn bộ state và hàm xử lý đặt vé vẫn do EventDetailPage giữ, truyền xuống qua props.
export default function BookingSummary({
  event,
  isSeated,
  selectedSeats,
  zoneQuantities,
  totalZoneCount,
  totalPrice,
  hasSelections,
  isReserved,
  countdownSeconds,
  formatCountdown,
  isProcessingPayment,
  isUpcoming,
  user,
  singleSeatTier,
  handleReserveSeats,
  handlePayment,
  handleCancelReservation,
}) {
  return (
    <div className="glass-panel booking-summary-panel">
      <h3 className="booking-title">Thông tin đặt vé</h3>

      {isSeated ? (
        <div className="booking-section">
          <div className="booking-section-head">
            <span>Ghế đã chọn ({selectedSeats.length}/5):</span>
            <span className="booking-tier-badge">{singleSeatTier.name}</span>
          </div>
          {selectedSeats.length === 0 ? (
            <div className="booking-empty">Chưa có ghế nào được chọn.</div>
          ) : (
            <div className="booking-seat-list">
              {selectedSeats.map((seat) => {
                return (
                  <div key={seat.code} className="booking-row">
                    <div className="booking-row-left">
                      <span className="booking-seat-code">{seat.code}</span>
                      <span className="booking-muted">({seat.tier})</span>
                    </div>
                    <span className="booking-price-strong">{formatVND(seat.price)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="booking-section">
          <div className="booking-zone-label">Vé khu vực ({totalZoneCount}/5):</div>
          {totalZoneCount === 0 ? (
            <div className="booking-empty">Nhấn dấu (+) để thêm vé theo khu vực.</div>
          ) : (
            <div className="booking-zone-list">
              {event.zones
                ?.filter((z) => (zoneQuantities[z.id] || 0) > 0)
                .map((z) => (
                  <div key={z.id} className="booking-row">
                    <div>
                      <span className="booking-zone-name">{z.name}</span>
                      <div className="booking-zone-qty">x {zoneQuantities[z.id]} vé</div>
                    </div>
                    <span className="booking-price-strong">
                      {formatVND(z.price * zoneQuantities[z.id])}
                    </span>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      <div className="booking-totals">
        <div className="booking-fee-row">
          <span>Phí tiện ích / VAT:</span>
          <span>0 đ (Miễn phí)</span>
        </div>
        <div className="booking-total-row">
          <span className="booking-total-label">Tổng thanh toán:</span>
          <span className="booking-total-value">{formatVND(totalPrice)}</span>
        </div>
      </div>

      {!user && (
        <div className="booking-login-warn">
          <AlertTriangle size={15} className="booking-icon-fixed" />
          <span>Bạn cần đăng nhập để hoàn tất giữ chỗ và nhận vé qua email.</span>
        </div>
      )}
      <div>
        {/* Nút chính (Giữ chỗ hoặc Thanh toán) */}
        <button
          onClick={isReserved ? handlePayment : handleReserveSeats}
          disabled={!hasSelections || isProcessingPayment || isUpcoming}
          className="glow-btn-pink booking-main-btn"
        >
          {isProcessingPayment ? (
            <div className="booking-btn-row">
              <span className="booking-btn-spinner" />
              <span>Đang kết nối PayOS...</span>
            </div>
          ) : isUpcoming ? (
            <div className="booking-btn-row">
              <AlertTriangle size={18} className="booking-icon-fixed" />
              <span>Sự kiện chưa mở bán</span>
            </div>
          ) : isReserved ? (
            // TRẠNG THÁI 2: ĐÃ GIỮ GHẾ -> HIỂN THỊ NÚT THANH TOÁN VÀ ĐỒNG HỒ ĐẾM NGƯỢC
            <div className="booking-pay-wrap">
              <div className="booking-btn-row booking-btn-row-wrap">
                <CreditCard size={18} className="booking-icon-fixed" />
                <span>
                  {user
                    ? `Thanh toán qua PayOS • ${formatVND(totalPrice)}`
                    : 'Đăng nhập & Thanh toán'}
                </span>
              </div>
              <span className="booking-countdown">
                <Timer size={12} /> Giữ ghế thành công! Hết hạn sau:{' '}
                {formatCountdown(countdownSeconds)}
              </span>
            </div>
          ) : (
            // TRẠNG THÁI 1: CHƯA GIỮ GHẾ -> HIỂN THỊ NÚT GIỮ GHẾ
            <div className="booking-btn-row booking-btn-row-wrap">
              <CreditCard size={18} className="booking-icon-fixed" />
              <span>{user ? 'Giữ chỗ ngay' : 'Đăng nhập & Giữ chỗ'}</span>
            </div>
          )}
        </button>

        {/* NÚT HỦY GIỮ GHẾ (Chỉ hiện khi isReserved = true) */}
        {isReserved && (
          <button
            onClick={handleCancelReservation}
            disabled={isProcessingPayment}
            className="booking-cancel-btn"
          >
            <X size={14} /> Hủy giữ ghế / Chọn lại
          </button>
        )}
      </div>
    </div>
  );
}
