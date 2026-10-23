// Logic xếp hàng ghế dùng chung.
//
// Nguyên tắc (H1): layout của một sự kiện được SUY TỪ DANH SÁCH GHẾ THẬT
// mà backend đã sinh (mã ghế dạng "A1", "B12"...). Không còn lưu layout ở
// localStorage, không giấu trong highlights, không đoán từ tiêu đề.

// Chuyển số thứ tự hàng (0, 1, 2...) thành chữ cái hàng: 0 -> A, 25 -> Z, 26 -> AA...
export const getRowLetter = (idx) => {
  if (idx < 0) return '';
  if (idx < 26) return String.fromCharCode(65 + idx);
  return String.fromCharCode(64 + Math.floor(idx / 26)) + String.fromCharCode(65 + (idx % 26));
};

// Tách mã ghế thành hàng + số ghế: "A1" -> { row: 'A', number: 1 }, "B-12" -> { row: 'B', number: 12 }
// Trả về null nếu mã không theo dạng chữ + số.
export const parseSeatCode = (code) => {
  const m = String(code || '').match(/^([A-Za-z]+)-?(\d+)$/);
  if (!m) return null;
  return { row: m[1].toUpperCase(), number: parseInt(m[2], 10) };
};

// Khóa sắp xếp hàng: hàng ngắn chữ đứng trước (A..Z rồi mới AA, AB...)
const rowSortKey = (letter) => [letter.length, letter];

// Lấy mã ghế từ một object ghế của backend (ưu tiên seat_number)
const seatCodeOf = (seat) => seat?.seat_number || seat?.code || seat?.seatCode || '';

/**
 * Suy layout từ danh sách ghế thật.
 * - Ghế có mã dạng chữ + số: nhóm theo đúng chữ hàng của nó (A1..A7, B1..B7...),
 *   hàng không đều nhau vẫn xếp đúng vì đếm theo từng nhóm.
 * - Ghế không có mã hợp lệ: chia nối tiếp thành các hàng có độ dài bằng hàng
 *   dài nhất hiện có (hoặc 12 nếu chưa có hàng nào), đặt tên hàng bằng các
 *   chữ cái chưa dùng.
 * Trả về { rows: [{ letter, seats: [...ghế, kèm trường number] }], rowsCount, seatsPerRow, totalSeats }
 */
export function deriveSeatLayout(seats) {
  const list = Array.isArray(seats) ? seats : [];
  const groups = new Map();
  const loose = [];

  list.forEach((seat) => {
    const parsed = parseSeatCode(seatCodeOf(seat));
    if (parsed) {
      if (!groups.has(parsed.row)) groups.set(parsed.row, []);
      groups.get(parsed.row).push({ ...seat, number: parsed.number });
    } else {
      loose.push(seat);
    }
  });

  const letters = [...groups.keys()].sort((a, b) => {
    const [lenA, sA] = rowSortKey(a);
    const [lenB, sB] = rowSortKey(b);
    return lenA - lenB || (sA < sB ? -1 : sA > sB ? 1 : 0);
  });

  const rows = letters.map((letter) => ({
    letter,
    seats: groups.get(letter).sort((a, b) => a.number - b.number),
  }));

  if (loose.length > 0) {
    const chunkSize = rows.length > 0 ? Math.max(...rows.map((r) => r.seats.length)) : 12;
    const used = new Set(letters);
    let letterIdx = 0;
    const nextLetter = () => {
      while (used.has(getRowLetter(letterIdx))) letterIdx += 1;
      const letter = getRowLetter(letterIdx);
      used.add(letter);
      return letter;
    };
    for (let i = 0; i < loose.length; i += chunkSize) {
      const chunk = loose.slice(i, i + chunkSize).map((seat, j) => ({ ...seat, number: j + 1 }));
      rows.push({ letter: nextLetter(), seats: chunk });
    }
  }

  return {
    rows,
    rowsCount: rows.length,
    seatsPerRow: rows.length > 0 ? Math.max(...rows.map((r) => r.seats.length)) : 0,
    totalSeats: list.length,
  };
}
