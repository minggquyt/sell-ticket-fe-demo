// Hàm định dạng dùng chung cho toàn app (trước đây chép 4 bản ở 4 file)

const vndFormatter = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' });

// Định dạng số tiền sang VND, ví dụ: 500000 -> "500.000 ₫"
export const formatVND = (val) => vndFormatter.format(val);
