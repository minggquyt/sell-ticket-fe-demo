import { formatVND } from '../utils/format.js';
import { parseSeatCode } from '../utils/seatLayout.js';
import './SeatMap.css';

export default function SeatMap({
  groupedSeats,
  seats,
  tier,
  isUpcoming,
  occupiedSeats,
  selectedSeats,
  onToggleSeat,
  fallbackTotalSeats,
  fallbackRowsCount,
}) {
  const rowLetters = Object.keys(groupedSeats).sort();
  const availableCount = seats.filter(
    (s) =>
      s.status === 'AVAILABLE' && !occupiedSeats.has(s.seat_number) && !occupiedSeats.has(s.id),
  ).length;

  // Khóa chuẩn hóa 'A1'/'A-1' -> 'A-1': occupiedSeats do App/EventDetailPage
  // đẩy lên đang ở dạng 'A-1' (parseSeatCode), còn seat_number BE trả 'A1'.
  // Chuẩn hóa cả 2 phía để tra cứu trạng thái giữ ghế không bị trượt.
  const normalizeSeatKey = (code) => {
    const parsed = parseSeatCode(code);
    return parsed ? `${parsed.row}-${parsed.number}` : String(code || '');
  };
  const occupiedKeys = new Set([...occupiedSeats].map((k) => normalizeSeatKey(k)));

  return (
    <div className="seatmap-wrap" style={{ '--tier-color': tier.color }}>
      <div className="seatmap-stage">
        <div className="seatmap-stage-bar" />
        <span className="seatmap-stage-label">SÂN KHẤU CHÍNH (STAGE)</span>
      </div>

      {/* Chú thích màu ghế */}
      <div className="seatmap-legend">
        <div className="seatmap-legend-item">
          <div className="seatmap-legend-swatch seatmap-legend-swatch-tier" />
          <span className="seatmap-legend-name">{tier.name}</span>
          <span className="seatmap-legend-price">({formatVND(tier.price)})</span>
        </div>
        <div className="seatmap-legend-item">
          <div className="seatmap-legend-swatch seatmap-legend-swatch-sold" />
          <span className="seatmap-legend-dim">Đã bán</span>
        </div>
        <div className="seatmap-legend-item">
          <div className="seatmap-legend-swatch seatmap-legend-swatch-reserved" />
          <span className="seatmap-legend-dim">Đang giữ chỗ</span>
        </div>
        <div className="seatmap-legend-item">
          <div className="seatmap-legend-swatch seatmap-legend-swatch-payment" />
          <span className="seatmap-legend-dim">Đang thanh toán</span>
        </div>
        <div className="seatmap-legend-item">
          <div className="seatmap-legend-swatch seatmap-legend-swatch-selected" />
          <span className="seatmap-legend-selected">Đang chọn</span>
        </div>
      </div>

      {/* Sơ đồ ghế cố định, hiển thị đầy đủ, KHÔNG có thanh cuộn ngang */}
      <div className="seat-chart-container">
        <div className="seat-chart-grid">
          {
            // Duyệt qua các tên hàng được sinh ra tự động từ dữ liệu BE (VD: ['A', 'B', 'C'])
            rowLetters.map((row) => {
              const rowSeats = groupedSeats[row]; // Mảng các ghế trong hàng này
              return (
                <div key={row} className="seating-row">
                  {/* Ký hiệu hàng bên trái */}
                  <span className="row-label">{row}</span>

                  <div className="seat-row-btns">
                    {rowSeats.map((seat) => {
                      // Lấy trực tiếp id và seat_number từ object ghế của BE trả về
                      const seatId = seat.id;
                      const seatCode = seat.seat_number; // VD: "A1", "A2", "A12"
                      const seatCol = seat.colNumber || seatCode.replace(/^[A-Za-z]+/, '');

                      // Kiểm tra trạng thái dựa trên dữ liệu thật từ BE
                      const isInOccupied =
                        occupiedSeats.has(seatCode) ||
                        (seatId && occupiedSeats.has(seatId)) ||
                        occupiedKeys.has(normalizeSeatKey(seatCode));
                      // Ghế người khác đang giữ / đang thanh toán: chỉ tô màu
                      // khác khi nó thật sự nằm trong occupiedSeats (tầng trên
                      // đã loại ghế của chính mình + ghế hết hạn giữ).
                      const isReserved =
                        !isUpcoming && seat.status === 'RESERVED' && isInOccupied;
                      const isPaymentProcessing =
                        !isUpcoming && seat.status === 'PAYMENT_PROCESSING' && isInOccupied;
                      const isOccupied = isUpcoming || seat.status === 'SOLD' || isInOccupied;
                      const isSelected =
                        !isUpcoming &&
                        selectedSeats.some(
                          (s) => (seatId && s.id === seatId) || s.code === seatCode,
                        );

                      return (
                        <button
                          key={seatId || seatCode}
                          onClick={() => onToggleSeat(seat)}
                          disabled={isOccupied}
                          title={
                            isUpcoming
                              ? `Ghế ${seatCode} (Sự kiện chưa mở bán)`
                              : isReserved
                                ? `Ghế ${seatCode} đang được giữ chỗ`
                                : isPaymentProcessing
                                  ? `Ghế ${seatCode} đang chờ thanh toán`
                                  : isOccupied
                                    ? `Ghế ${seatCode} đã có người mua`
                                    : `Ghế ${seatCode}\n${tier.name} (${formatVND(seat.price)})`
                          }
                          className={`seat-btn${
                            isReserved
                              ? ' seat-btn-reserved'
                              : isPaymentProcessing
                                ? ' seat-btn-payment'
                                : isOccupied
                                  ? ' seat-btn-occupied'
                                  : ''
                          }${isSelected ? ' seat-btn-selected' : ''}`}
                        >
                          {/* Hiển thị số thứ tự ghế bên trong nút (A1..A12 trên desktop, 1..12 trên mobile) */}
                          <span className="seat-code-full">{seat.displayCode || seatCode}</span>
                          <span className="seat-code-short">{seat.seatCol || seatCol}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Ký hiệu hàng bên phải */}
                  <span className="row-label">{row}</span>
                </div>
              );
            })
          }
        </div>
      </div>

      <div className="seatmap-summary">
        * Tổng số ghế:{' '}
        <strong className="seatmap-summary-strong">
          {seats.length || fallbackTotalSeats || 84} ghế
        </strong>{' '}
        ({rowLetters.length || fallbackRowsCount || 7} hàng{' '}
        {rowLetters.length > 0 ? `A-${rowLetters[rowLetters.length - 1]}` : ''}
        ). Còn trống: <strong className="seatmap-summary-emerald">{availableCount} ghế</strong>.
        Đồng giá <strong className="seatmap-summary-pink">{formatVND(tier.price)}</strong> / ghế.
        Tối đa 5 ghế.
      </div>
    </div>
  );
}
