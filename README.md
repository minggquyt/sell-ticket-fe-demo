# TicketVerse — bản src-2 + màu ghế RESERVED / PAYMENT_PROCESSING

## Nguồn
- Gốc: file `src-2.rar` user gửi ngày 2026-10-30 (bản mới hơn `~/workspace/ticketverse-full`
  ngày 23/10 — có thêm `ETicketModal`, `OrderHistoryPage`, `AdminRefundsTab`).
  Đã giải nén nguyên vẹn vào `src/` (giữ CRLF như bản Windows gốc).
- File nén đính kèm: `ticketverse-src2-seat-status.zip` = toàn bộ `src/` sau khi sửa.

## Thay đổi (chỉ FE, không sửa BE, không đổi hợp đồng API)
Chỉ 2 file trong `src/components/`:
- `SeatMap.jsx` — ghế người khác đang giữ (`RESERVED`) tô vàng hổ phách,
  ghế người khác đang chờ thanh toán (`PAYMENT_PROCESSING`) tô xanh cyan;
  thêm 2 mục vào chú thích + tooltip riêng từng trạng thái.
  Chỉ tô màu khi ghế thật sự nằm trong `occupiedSeats` (tầng trên đã loại
  ghế của chính mình + ghế hết hạn giữ), nên ghế mình giữ / ghế hết hạn
  vẫn hiện như ghế trống và bấm được.
- `SeatMap.css` — class `.seat-btn-reserved` / `.seat-btn-payment` + 2 swatch
  chú thích (dùng sẵn biến `--accent-amber` / `--accent-cyan` trong `index.css`).
  Không inline style, đúng quy ước mỗi component một file `.css` riêng.

Lưu ý kỹ thuật: `occupiedSeats` đang lưu mã dạng `A-1` còn `seat_number` BE
trả `A1`, nên `SeatMap` chuẩn hóa cả 2 phía bằng `parseSeatCode`
(`utils/seatLayout.js`) trước khi tra cứu — nếu không, 2 màu mới sẽ không
hiện (và ghế người khác giữ trước đây cũng không bị chặn đúng).

## Màu
- Trống: màu hạng ghế (mặc định indigo `#6366f1`) · Đang chọn: hồng `#ec4899`
- Đã bán (SOLD): xám `#334155` · Đang giữ chỗ (RESERVED): vàng `#f59e0b`
- Đang thanh toán (PAYMENT_PROCESSING): cyan `#06b6d4`

## Kiểm thử (Chrome headless + mock BE, 2026-10-30)
- Build Vite: PASS. ESLint `SeatMap.jsx`: 0 lỗi.
- Test mới `~/workspace/ticketverse-tests/e2e-seat-status.mjs`: **13/13 PASS**
  (C2 vàng + disabled + tooltip giữ chỗ, D5 cyan + disabled + tooltip chờ
  thanh toán, B3 xám, E1 hết hạn giữ vẫn bấm được, E2 ghế của mình vẫn bấm
  được, hồi quy chọn/bỏ chọn A1, không lỗi JS).
- Hồi quy `e2e-seatmap.mjs` (Phần 3b): **9/9 PASS**.
- Ảnh chụp sơ đồ ghế: `~/workspace/ticketverse-tests/shots/seat-status-map.png`

## Cách dùng
Giải nén `ticketverse-src2-seat-status.zip` đè lên thư mục `src/` của project
trên máy user (chỉ 2 file trên thực sự đổi), rồi chạy FE như bình thường.
Muốn thấy màu mới cần có ghế ở trạng thái RESERVED / PAYMENT_PROCESSING
của user khác còn hạn giữ trên BE thật.

## 31/10/2026 — Polling realtime ghế 3 giây (anh duyệt)
- Thêm 1 `useEffect` polling ở `src/pages/EventDetailPage.jsx` (ngay sau
  effect tải ghế lúc mở trang): gọi lại `reloadBackendSeats()` có sẵn mỗi
  3 giây, tạm dừng khi tab bị ẩn, quay lại tab thì tải ngay + chạy tiếp,
  dừng hẳn khi rời trang. Chỉ đọc lại ghế (cả zone), không đụng ghế đang
  chọn / đếm ngược / thanh toán. Không sửa BE/API, không thêm thư viện.
- Kiểm thử: build Vite PASS; test mới `e2e-seat-polling.mjs` **7/7 PASS**
  (A giữ C2 → B thấy vàng sau ~0,5s không F5; A hủy → B thấy trống lại sau
  ~3,0s; chọn ghế vẫn bình thường sau nhiều vòng polling); hồi quy
  `e2e-seatmap.mjs` 9/9 + `e2e-seat-status.mjs` 13/13 PASS.
- ESLint `EventDetailPage.jsx`: 13 → 14 vấn đề, +1 warning `exhaustive-deps`
  (thiếu `reloadBackendSeats`, cùng loại với warning đã có ở effect tải ghế
  lúc mở trang), 0 lỗi mới.

## 10/11/2026 — Mua vé không cần đăng nhập (guest checkout, anh duyệt làm hết 5 phần)

Luồng mới song song với luồng đăng nhập cũ (không đổi luồng cũ):
- **P1 — Form khách ở bước giữ ghế:** khi chưa đăng nhập, `BookingSummary`
  hiện `GuestCheckoutForm` (email bắt buộc + họ tên bắt buộc + SĐT tuỳ chọn,
  tự điền lại từ localStorage `sellticket_guest`). Chưa điền email thì không
  giữ được ghế. FE gửi kèm `guestEmail/email/customerEmail/fullName/
  customerName/phone/customerPhone` vào các API sẵn có (giữ ghế, giữ zone,
  bắt đầu thanh toán, nhả ghế) — BE cũ bỏ qua field thừa, BE mới đọc được.
  FE không tự tạo user; khớp/tạo user sau thanh toán là việc BE.
- **P2 — Về từ PayOS không cần token:** màn hình thành công dùng email khách
  (`user?.email || activeGuest.email || paidOrderInfo.customerEmail`), hiện
  vé ngay + banner "Đặt mật khẩu để xem lại vé". Đơn vừa mua lưu localStorage
  `sellticket_last_order` {orderCode, email}.
- **P3 — Nhận lại tài khoản (claim):** `LoginPage` thêm mode `claim`
  (`/login?mode=claim&email=...&code=...`), 2 bước: nhập email → check +
  gửi mã → nhập mã + mật khẩu mới → đăng nhập rồi về Lịch sử đặt vé.
  Đăng ký bằng email đã tồn tại hiện hộp gợi ý sang luồng claim.
  FE gọi 3 endpoint BE MỚI (BE chưa có → 404 → UI báo rõ "BE chưa hỗ trợ",
  không crash): `POST /api/auth/check-email` → `{exists, hasPassword}`,
  `POST /api/auth/request-password-setup`,
  `POST /api/auth/verify-and-set-password` (body `{email, code,
  verificationCode, password}`).
- **P4 — Tra cứu vé cho khách:** `OrderHistoryPage` khi chưa đăng nhập hiện
  form tra cứu (mã đơn + email), dùng lại `GET /api/orders/:orderCode/status`
  không cần token, đối chiếu `customerEmail` trên đơn khớp mới hiện vé
  (sai email → "Email không khớp"). Tự tra cứu đơn cuối đã lưu. Navbar:
  khách thấy nút "Tra cứu vé", user thấy "Lịch sử đặt vé".
- **P5 — Kiểm thử:** build Vite PASS (436KB JS / 85KB CSS); ESLint các file
  đã sửa = đúng baseline bản rar (18 problems, 0 lỗi mới); test mới
  `ticketverse-tests/e2e-guest-checkout.mjs` **23/23 PASS** (A1–A9 luồng
  khách, B1–B2 về từ PayOS không token, C1–C4 claim, D1–D2 đăng ký trùng
  email, E1–E4 tra cứu, F1–F2 hồi quy đã đăng nhập); hồi quy
  `e2e-seatmap.mjs` 9/9, `e2e-seat-status.mjs` 13/13, `e2e-seat-polling.mjs`
  7/7 PASS. Test nghiệm thu `e2e-acceptance.mjs` đã sửa mock checkout
  (trả orderCode + URL có orderCode, mock trạng thái đơn + lịch sử) và cập
  nhật A4–A6 theo màn hình thành công hiện tại → **14/14 PASS** (bản rar
  gốc cũng chỉ đạt 11/14 ở 3 mục này do test cũ lệch với giao diện mới,
  không phải do lần sửa này).

Giả định đã chốt (user không trả lời 4 câu hỏi mở): xác thực bằng mã OTP
nhập trên web (có hỗ trợ deep-link `?mode=claim&email=&code=`); tra cứu vé
khách bằng mã đơn + email; sau claim xong về Lịch sử đặt vé.

**Phụ thuộc BE (chưa có):** 3 endpoint trên + BE khớp email với userid sẵn
có hoặc tạo user mới (email + password null) sau khi thanh toán thành công,
lỗi thì không tạo user. Tới khi BE có, FE đã gọi đúng và báo rõ khi 404.

## Gộp vào bản main mới — 10/11/2026 chiều

Nguồn: `sell-ticket-fe-demo-main.zip` (anh gửi 15:40). Gộp toàn bộ 5 phần guest
trên vào bản main, **không ghi đè code mới của main**: giữ `CustomerInfoModal`
(modal SĐT + CCCD 12 số trước thanh toán — bản main đã có sẵn, nên mục "FE phải
sửa sau khi BE xong" về SĐT/CCCD không còn cần làm khi dùng bản này), giữ
`startCheckout(checkoutPayload)` dạng payload, giữ `ETicketModal` (hiện SĐT +
CCCD người đặt) và `AdminRefundsTab` của main. Guest được gộp lên trên luồng
main: form khách ở BookingSummary, giữ ghế/thanh toán kèm `guestEmail`,
về từ PayOS không token, tra cứu vé + claim OTP, nút "Tra cứu vé" ở Navbar.
Bỏ `console.log(token)` sót trong `handlePayment` của main. Sửa nhỏ CSS banner
claim: nút "Đặt mật khẩu để xem lại vé" xuống dòng full-width (trước đó bị
chật/tràn chữ trong thẻ thành công).

Kiểm thử trên bản đã gộp: build PASS; guest checkout **24/24 PASS** (thêm A7b:
checkout gửi kèm SĐT + CCCD từ modal); nghiệm thu 14/14; seatmap 9/9;
seat-status 13/13; polling 7/7. Test đã cập nhật bước điền modal SĐT/CCCD
trước khi bấm "Tiếp tục thanh toán".
