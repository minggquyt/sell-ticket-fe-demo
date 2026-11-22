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
  singleSeatTier,
  backendZones = {},
  pendingPayment = null,
  handleReserveSeats,
  handleCancelReservation,
  handlePrePaymentClick,
}) {
  const displayTotal =
    pendingPayment?.totalAmount != null ? Number(pendingPayment.totalAmount) : totalPrice;
  const zoneEntries = Object.entries(zoneQuantities || {}).filter(([, qty]) => qty > 0);

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
          {zoneEntries.length === 0 ? (
            <div className="booking-empty">Nhấn dấu (+) để thêm vé theo khu vực.</div>
          ) : (
            <div className="booking-zone-list">
              {zoneEntries.map(([zoneKey, qty]) => {
                const upperKey = String(zoneKey).toUpperCase();
                const matchedStaticZone = event.zones?.find(
                  (z) => String(z.id).toUpperCase() === upperKey,
                );
                const meta = backendZones?.[zoneKey] || backendZones?.[upperKey] || matchedStaticZone;
                const zoneName = meta?.name || zoneKey;
                const unitPrice = Number(meta?.price) || 0;
                return (
                  <div key={zoneKey} className="booking-row">
                    <div>
                      <span className="booking-zone-name">{zoneName}</span>
                      <div className="booking-zone-qty">x {qty} vé</div>
                    </div>
                    <span className="booking-price-strong">{formatVND(unitPrice * qty)}</span>
                  </div>
                );
              })}
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
          <span className="booking-total-value">{formatVND(displayTotal)}</span>
        </div>
      </div>

      <div>
        {/* Nút chính (Giữ chỗ hoặc Thanh toán) */}
        <button
          onClick={isReserved ? handlePrePaymentClick : handleReserveSeats}
          disabled={(!hasSelections && !pendingPayment) || isProcessingPayment || isUpcoming}
          className="glow-btn-pink booking-main-btn"
        >
          {isProcessingPayment ? (
            <div className="booking-btn-row">
              <span className="booking-btn-spinner" />
              <span>Đang tạo mã QR thanh toán...</span>
            </div>
          ) : isUpcoming ? (
            <div className="booking-btn-row">
              <AlertTriangle size={18} className="booking-icon-fixed" />
              <span>Sự kiện chưa mở bán</span>
            </div>
          ) : isReserved ? (
            // TRẠNG THÁI 2: ĐÃ GIỮ GHẾ HOẶC ĐANG CHỜ THANH TOÁN -> HIỂN THỊ NÚT THANH TOÁN VÀ ĐỒNG HỒ ĐẾM NGƯỢC
            <div className="booking-pay-wrap">
              <div className="booking-btn-row booking-btn-row-wrap">
                <CreditCard size={18} className="booking-icon-fixed" />
                <span>
                  {pendingPayment
                    ? `Tiếp tục thanh toán đơn #${pendingPayment.orderCode} • ${formatVND(displayTotal)}`
                    : `Thanh toán QR • ${formatVND(displayTotal)}`}
                </span>
              </div>
              <span className="booking-countdown">
                <Timer size={12} />{' '}
                {pendingPayment
                  ? `Đơn đang chờ thanh toán! Hết hạn sau: ${formatCountdown(countdownSeconds)}`
                  : `Giữ ghế thành công! Hết hạn sau: ${formatCountdown(countdownSeconds)}`}
              </span>
            </div>
          ) : (
            // TRẠNG THÁI 1: CHƯA GIỮ GHẾ -> HIỂN THỊ NÚT GIỮ GHẾ
            <div className="booking-btn-row booking-btn-row-wrap">
              <CreditCard size={18} className="booking-icon-fixed" />
              <span>Giữ chỗ ngay</span>
            </div>
          )}
        </button>

        {/* NÚT HỦY GIỮ GHẾ / HỦY ĐƠN (Chỉ hiện khi isReserved = true) */}
        {isReserved && (
          <button
            onClick={() => handleCancelReservation(false)}
            disabled={isProcessingPayment}
            className="booking-cancel-btn"
          >
            <X size={14} />{' '}
            {pendingPayment
              ? `Hủy đơn #${pendingPayment.orderCode} / Chọn lại ghế`
              : 'Hủy giữ ghế / Chọn lại'}
          </button>
        )}
      </div>
    </div>
  );
}
