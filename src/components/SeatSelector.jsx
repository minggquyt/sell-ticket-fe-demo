import SeatMap from './SeatMap.jsx';
import './SeatSelector.css';

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
  isLocked = false,
  lockMessage = '',
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
      isLocked={isLocked}
      lockMessage={lockMessage}
    />
  );
}
