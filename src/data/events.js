export const CATEGORIES = ['Tất cả', 'Âm nhạc', 'Lễ hội', 'Hội thảo', 'Hài kịch', 'Thể thao'];
export const CITIES = ['Tất cả địa điểm', 'Hà Nội', 'TP.HCM'];

// Giới hạn số vé tối đa trong một lần đặt (dùng ở trang chi tiết sự kiện)
export const MAX_TICKETS_PER_ORDER = 5;

// Helpers tiện ích cho toàn bộ frontend
export const isSeatedEvent = (event) => {
  if (!event) return false;
  return event.event_type === 'SEAT_BASED' || event.type === 'seated';
};

export const formatEventDate = (event) => {
  if (!event) return '';
  if (event.start_time) {
    try {
      const d = new Date(event.start_time);
      if (!isNaN(d.getTime())) {
        const day = d.getDate().toString().padStart(2, '0');
        const month = (d.getMonth() + 1).toString().padStart(2, '0');
        const year = d.getFullYear();
        return `${day} Tháng ${month}, ${year}`;
      }
    } catch {
      // fallback
    }
  }
  return event.date || '';
};

export const formatEventTime = (event) => {
  if (!event) return '';
  const timeVal = event.start_time || event.startTime;
  if (timeVal) {
    try {
      const d = new Date(timeVal);
      if (!isNaN(d.getTime())) {
        const hours = d.getHours().toString().padStart(2, '0');
        const minutes = d.getMinutes().toString().padStart(2, '0');
        return `${hours}:${minutes}`;
      }
    } catch {
      // fallback
    }
  }
  return event.time || '';
};

export const getEventVenue = (event) => {
  if (!event) return '';
  return event.location || event.venue || '';
};

export const getMinPrice = (event) => {
  if (!event) return 0;
  const p1 = Number(event.minPrice);
  if (!isNaN(p1) && p1 > 0) return p1;
  const p2 = Number(event.min_price);
  if (!isNaN(p2) && p2 > 0) return p2;
  const p3 = Number(event.price);
  if (!isNaN(p3) && p3 > 0) return p3;
  const p4 = Number(event.seatPrice);
  if (!isNaN(p4) && p4 > 0) return p4;
  if (event.seatConfig?.price && Number(event.seatConfig.price) > 0) {
    return Number(event.seatConfig.price);
  }
  if (Array.isArray(event.seatTiers) && event.seatTiers.length > 0) {
    const p = Number(event.seatTiers[0].price);
    if (!isNaN(p) && p > 0) return p;
  }
  if (Array.isArray(event.zones) && event.zones.length > 0) {
    const valid = event.zones.map((z) => Number(z.price)).filter((p) => !isNaN(p) && p > 0);
    if (valid.length > 0) return Math.min(...valid);
  }
  return 0;
};

export const getMaxPrice = (event) => {
  if (!event) return 0;
  const p1 = Number(event.maxPrice);
  if (!isNaN(p1) && p1 > 0) return p1;
  const p2 = Number(event.max_price);
  if (!isNaN(p2) && p2 > 0) return p2;
  return getMinPrice(event);
};

export const getSingleSeatTier = (event) => {
  if (!event) {
    return {
      id: 'standard',
      name: 'Ghế tiêu chuẩn',
      price: 0,
      color: '#6366f1',
      rows: ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
    };
  }
  if (event.seatTiers && event.seatTiers.length > 0) {
    return event.seatTiers[0];
  }
  const price = getMinPrice(event);
  return {
    id: 'standard',
    name: 'Ghế tiêu chuẩn',
    price,
    color: '#6366f1',
    rows: ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
  };
};

export const isUpcomingEvent = (event) => {
  if (!event) return false;
  return (
    event.status === 'upcoming' ||
    Boolean(event.isUpcoming) ||
    Boolean(event.isUpComing) ||
    Boolean(event.is_upcoming)
  );
};
