/**
 * Danh mục và cấu hình sự kiện
 * Dữ liệu sự kiện hiện được đồng bộ trực tiếp từ Supabase Database qua src/services/eventService.js
 */

export const MOCK_EVENTS = [];

export const CATEGORIES = ["Tất cả", "Âm nhạc", "Lễ hội", "Hội thảo", "Hài kịch", "Thể thao"];
export const CITIES = ["Tất cả địa điểm", "Hà Nội", "TP.HCM"];

// Helpers tiện ích cho toàn bộ frontend
export const isSeatedEvent = (event) => {
  if (!event) return false;
  return event.event_type === "SEAT_BASED" || event.type === "seated";
};

export const formatEventDate = (event) => {
  if (!event) return "";
  if (event.start_time) {
    try {
      const d = new Date(event.start_time);
      if (!isNaN(d.getTime())) {
        const day = d.getDate().toString().padStart(2, "0");
        const month = (d.getMonth() + 1).toString().padStart(2, "0");
        const year = d.getFullYear();
        return `${day} Tháng ${month}, ${year}`;
      }
    } catch {
      // fallback
    }
  }
  return event.date || "";
};

export const formatEventTime = (event) => {
  if (!event) return "";
  const timeVal = event.start_time || event.startTime;
  if (timeVal) {
    try {
      const d = new Date(timeVal);
      if (!isNaN(d.getTime())) {
        const hours = d.getHours().toString().padStart(2, "0");
        const minutes = d.getMinutes().toString().padStart(2, "0");
        return `${hours}:${minutes}`;
      }
    } catch {
      // fallback
    }
  }
  return event.time || "";
};

export const getEventVenue = (event) => {
  if (!event) return "";
  return event.location || event.venue || "";
};

export const getMinPrice = (event) => {
  if (!event) return 0;
  return Number(event.min_price ?? event.minPrice ?? 0);
};

export const getMaxPrice = (event) => {
  if (!event) return 0;
  return Number(event.max_price ?? event.maxPrice ?? getMinPrice(event));
};

export const getSingleSeatTier = (event) => {
  if (!event) {
    return { id: "standard", name: "Ghế tiêu chuẩn", price: 0, color: "#6366f1", rows: ["A", "B", "C", "D", "E", "F", "G"] };
  }
  if (event.seatTiers && event.seatTiers.length > 0) {
    return event.seatTiers[0];
  }
  const price = getMinPrice(event);
  return {
    id: "standard",
    name: "Ghế tiêu chuẩn",
    price,
    color: "#6366f1",
    rows: ["A", "B", "C", "D", "E", "F", "G"]
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
