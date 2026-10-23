import SeatMap from './SeatMap.jsx';
import './SeatSelector.css';

// Khối chọn ghế cho sự kiện Seated-based (tách từ EventDetailPage ở Phần 3d).
// Phần lưới ghế do SeatMap đảm nhiệm (đã tách ở Phần 3b, CSS ở SeatMap.css);
// SeatSelector là ranh giới của khu vực chọn ghế trong trang chi tiết.
export default function SeatSelector({
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
  return (
    <SeatMap
      groupedSeats={groupedSeats}
      seats={seats}
      tier={tier}
      isUpcoming={isUpcoming}
      occupiedSeats={occupiedSeats}
      selectedSeats={selectedSeats}
      onToggleSeat={onToggleSeat}
      fallbackTotalSeats={fallbackTotalSeats}
      fallbackRowsCount={fallbackRowsCount}
    />
  );
}
