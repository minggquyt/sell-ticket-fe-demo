import { formatVND } from '../utils/format.js';
import './SeatMap.css';

// Sơ đồ ghế dùng chung (Phần 3b) — tách từ khối chọn ghế của EventDetailPage.
// Nhận ghế đã nhóm theo hàng (groupedSeats) + danh sách ghế gốc (seats) để tính
// dòng tổng kết; trạng thái từng ghế (trống / đã bán / đang chọn) thể hiện bằng
// class trạng thái, màu của hạng ghế truyền qua biến CSS --tier-color.
// Đây là bản sơ đồ ghế duy nhất của app: nơi nào cần hiện sơ đồ ghế
// (trang chi tiết, xem trước trong admin sau này) đều dùng component này.
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
                      const isOccupied =
                        isUpcoming ||
                        seat.status === 'SOLD' ||
                        occupiedSeats.has(seatCode) ||
                        (seatId && occupiedSeats.has(seatId));
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
                              : isOccupied
                                ? `Ghế ${seatCode} đã có người mua`
                                : `Ghế ${seatCode}\n${tier.name} (${formatVND(seat.price)})`
                          }
                          className={`seat-btn${isOccupied ? ' seat-btn-occupied' : ''}${
                            isSelected ? ' seat-btn-selected' : ''
                          }`}
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
