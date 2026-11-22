# Khóa chọn ghế / khu vực khi đang giữ chỗ & Đồng bộ giới hạn 4 vé (`sell-ticket-fe-demo`)

**Phạm vi:** chỉ Frontend `sell-ticket-fe-demo/` (không chỉnh sửa Backend, không đổi Database, không thêm thư viện)  
**Nhánh làm việc:** `feat/lock-seat-selection-during-hold`  
**Cập nhật:** 2026-11-23  
**Kiểm tra build/lint:** `npm run build` PASS · ESLint `0` lỗi, `0` warning trên toàn bộ file chỉnh sửa

---

## 1. Tổng quan mục tiêu & thay đổi

Giải quyết triệt để tình trạng người dùng vẫn bấm chọn/bỏ chọn ghế hoặc đổi số lượng vé trong lúc đang giữ chỗ, đang thanh toán, đang gọi API hoặc đang giữ vé ở sự kiện khác, đồng thời đồng bộ giới hạn tối đa `4` vé theo Backend:

- **Khóa 2 lớp (UI + Handler) cho cả Seated-based và Zone-based:** khi người dùng đang giữ chỗ (`RESERVED`), chờ thanh toán (`PAYMENT_PROCESSING`), đang gửi request giữ chỗ (`isReserving`), đang khởi tạo thanh toán (`isProcessingPayment`), hoặc đang có phiên hoạt động ở sự kiện khác (`otherEventSession`) → toàn bộ nút ghế trên sơ đồ và nút `+/-` khu vực đều chuyển sang trạng thái `disabled` kèm tooltip + banner hướng dẫn bấm hủy trước khi chọn lại.
- **Chống race condition & lệch dữ liệu thanh toán:** khóa nút `"Giữ chỗ ngay"` và sơ đồ chọn vé ngay khi `isReserving === true`, đồng bộ lại `selectedSeats` theo `heldSeatsData` từ server sau khi giữ ghế thành công, và ưu tiên dùng `reservedSeatIds` trong `handlePayment()`.
- **Đồng bộ hằng số `MAX_TICKETS_PER_ORDER = 4`:** loại bỏ toàn bộ text/điều kiện hardcode số `5` rải rác trên giao diện (khớp với `RequestSeatHoldDTO` và `ReserveZoneDTO` tối đa `4` vé ở Backend).
- **An toàn chuyển trang & dọn mã nguồn:** thêm `key={currentEvent.id}` cho `<EventDetailPage />` tại [src/App.jsx](../src/App.jsx) để tránh rò state khi đổi sự kiện trực tiếp; thêm cờ `cancelled` và reset `verifyingPendingRef` khi unmount/đổi sự kiện; kiểm tra `expiry` trước khi bật `isReserved` ở nhánh Zone-based; xóa `console.log("bắt đầu thanh toán")`, gỡ `.clineignore` khỏi `.gitignore` và dọn sạch `6` lỗi + `4` warning ESLint của `EventDetailPage.jsx`.

---

## 2. Kiến trúc trạng thái khóa & Hợp đồng Props

### 2.1. Nguồn sự thật duy nhất (`isSelectionLocked`)

Tại [src/pages/EventDetailPage.jsx](../src/pages/EventDetailPage.jsx), trạng thái khóa được dẫn xuất trực tiếp (không nhân bản state):

```js
const isSelectionLocked =
  isReserved || isReserving || isProcessingPayment || Boolean(otherEventSession);
```

| Thứ tự ưu tiên | Điều kiện | Banner `.detail-lock-notice` phía trên sơ đồ | Hành vi `BookingSummary` |
| :--- | :--- | :--- | :--- |
| 1 | `isReserved && pendingPayment` | Nhắc đơn `#orderCode` đang chờ thanh toán, hướng dẫn bấm **Tiếp tục thanh toán** hoặc **Hủy đơn / Chọn lại ghế** | Nút chính: `Tiếp tục thanh toán đơn #...` · Nút hủy: `Hủy đơn #... / Chọn lại ghế` |
| 2 | `isReserved && !pendingPayment` | Nhắc đang giữ `{heldCount}` ghế/vé, hướng dẫn bấm **Thanh toán QR** hoặc **Hủy giữ ghế / Chọn lại** | Nút chính: `Thanh toán QR • ...` · Nút hủy: `Hủy giữ ghế / Chọn lại` |
| 3 | `otherEventSession` | Thông báo đang có phiên giữ ghế / thanh toán tại sự kiện khác, hướng dẫn hoàn tất hoặc hủy ở `PendingPaymentBanner` phía trên | Nút chính `disabled`, hiển thị `"Đang có phiên giữ chỗ khác"` |
| 4 | `isReserving` / `isProcessingPayment` | Khóa sơ đồ ghế/stepper (không hiển thị banner cảnh báo riêng) | Nút chính `disabled` kèm spinner `"Đang giữ chỗ..."` / `"Đang tạo mã QR thanh toán..."`; nút hủy cũng `disabled` |

### 2.2. Props bổ sung cho các component con

Tất cả props mới đều có giá trị mặc định để giữ tương thích ngược:

- **`SeatSelector` & `SeatMap`** ([src/components/SeatSelector.jsx](../src/components/SeatSelector.jsx), [src/components/SeatMap.jsx](../src/components/SeatMap.jsx)):
  - `isLocked = false`: khóa nút ghế (`disabled={isOccupied || isLocked}`), gắn class `.seat-btn-locked` (`cursor: not-allowed`, giảm `opacity: 0.45` cho ghế chưa chọn nhưng giữ `opacity: 1` với `.seat-btn-selected` để nhận diện rõ ghế mình đang giữ).
  - `lockMessage = ''`: hiển thị trong thuộc tính `title` khi hover ghế đang bị khóa (vẫn giữ nguyên thứ tự ưu tiên `isUpcoming` → `isReserved` → `isPaymentProcessing` → `isOccupied`).
- **`ZoneSelector`** ([src/components/ZoneSelector.jsx](../src/components/ZoneSelector.jsx)):
  - `isLocked = false`: `disabled` cả nút `-` và `+`, bỏ class active/active-accent, gắn `.zone-root-locked` lên wrapper để làm mờ nhẹ `.zone-stepper` (`opacity: 0.55`).
  - `lockMessage = ''`: gắn `title` trên cả `.zone-stepper` lẫn nút `-` / `+` (không dùng `pointer-events: none` trên root khi khóa để hover tooltip vẫn hoạt động).
- **`BookingSummary`** ([src/components/BookingSummary.jsx](../src/components/BookingSummary.jsx)):
  - `isReserving = false`: hiển thị spinner `"Đang giữ chỗ..."`, `disabled` cả nút chính và nút hủy giữ ghế.
  - `otherEventSession = null`: khóa nút chính khi chưa giữ chỗ ở sự kiện hiện tại (`Boolean(otherEventSession && !isReserved)`).

---

## 3. Đồng bộ phiên xuyên sự kiện & Chống rò state

- **Đọc phiên sự kiện khác không cần polling mới:** trong `useEffect` khôi phục phiên của `EventDetailPage`, helper `syncOtherEventSession()` gọi `getActiveSessions(activeUserId)` từ [src/utils/paymentSession.js](../src/utils/paymentSession.js) tìm phiên có `String(s.eventId) !== String(event.id)`.
- **Phản ứng tức thì qua sự kiện trình duyệt:** lắng nghe sẵn `RESERVATION_CHANGED_EVENT` và `storage`. Khi người dùng bấm **"Hủy giữ chỗ"** / **"Hủy đơn"** trên `PendingPaymentBanner` (hoặc trên tab khác), `syncOtherEventSession()` cập nhật `otherEventSession` về `null` và mở khóa sơ đồ ngay lập tức mà không cần tải lại trang.
- **Đồng bộ từ Backend khi localStorage trống:** khi `fetchMyActiveSession(token)` trả về phiên của sự kiện khác, FE lưu vào storage qua `syncServerReservationToStorage(..., { silent: true })` và cập nhật `otherEventSession`.
- **An toàn khi chuyển sự kiện / hủy effect:**
  - [src/App.jsx](../src/App.jsx) truyền `key={currentEvent.id}` vào `<EventDetailPage />` để reset sạch state khi chuyển thẳng `/events/A` ↔ `/events/B`.
  - `useEffect` khôi phục phiên dùng biến `cancelled` để chặn callback `.then`/`.catch` cũ ghi đè state, đồng thời reset `verifyingPendingRef.current = null` trong hàm cleanup.
  - Nhánh `holdZones` kiểm tra `returnedSeatIds.length === 0 || !expiry` trước khi bật `setIsReserved(true)`.

---

## 4. Đồng bộ giới hạn `MAX_TICKETS_PER_ORDER` (`4` vé)

Toàn bộ nhãn hiển thị, tooltip, toast cảnh báo và điều kiện nút bấm trên Frontend đều import `MAX_TICKETS_PER_ORDER` từ [src/data/events.js](../src/data/events.js):

| File | Vị trí đã đồng bộ |
| :--- | :--- |
| [src/pages/EventDetailPage.jsx](../src/pages/EventDetailPage.jsx) | Toast giới hạn Seated/Zone, badge trên banner (`Seated-based` / `Zone-based`), dòng mô tả ở `.detail-notice` |
| [src/components/SeatMap.jsx](../src/components/SeatMap.jsx) | Dòng tổng kết dưới sơ đồ (`Tối đa {MAX_TICKETS_PER_ORDER} ghế.`) |
| [src/components/ZoneSelector.jsx](../src/components/ZoneSelector.jsx) | Điều kiện `active-accent` của nút `+` (`< MAX_TICKETS_PER_ORDER`) và footer `/ {MAX_TICKETS_PER_ORDER} vé tối đa` |
| [src/components/BookingSummary.jsx](../src/components/BookingSummary.jsx) | Tiêu đề `Ghế đã chọn (n/4)` và `Vé khu vực (n/4)` |
| [src/pages/EventsPage.jsx](../src/pages/EventsPage.jsx) | 2 nhãn lọc loại hình vé (`Seated-based` và `Zone-based`) |
| [src/components/EventFormModal.jsx](../src/components/EventFormModal.jsx) | Nhãn option `ZONE_BASED` trong modal tạo/sửa sự kiện |

---

## 5. Danh sách file tác động

| File | Vai trò |
| :--- | :--- |
| `.gitignore` | Xóa dòng `.clineignore` thừa |
| `src/App.jsx` | Gắn `key={currentEvent.id}` cho `<EventDetailPage />` |
| `src/pages/EventDetailPage.jsx` | Khóa chọn 2 lớp, chống race `isReserving`, ưu tiên `reservedSeatIds`, khóa xuyên sự kiện, đồng bộ `MAX_TICKETS_PER_ORDER`, xóa `console.log`, sửa edge-case & dọn sạch lỗi/warning ESLint |
| `src/pages/EventDetailPage.css` | Thêm style `.detail-lock-notice` (nền/viền amber) |
| `src/components/SeatSelector.jsx` | Chuyển tiếp `isLocked`, `lockMessage` xuống `SeatMap` |
| `src/components/SeatMap.jsx` | Khóa nút ghế, tooltip giải thích, class `.seat-btn-locked`, đồng bộ `MAX_TICKETS_PER_ORDER` |
| `src/components/SeatMap.css` | Style `.seat-btn-locked`, `.seat-btn-locked.seat-btn-selected`, `.seat-btn:not(:disabled):active` |
| `src/components/ZoneSelector.jsx` | Khóa nút `+/-`, gắn `title` + `.zone-root-locked`, sửa điều kiện `< MAX_TICKETS_PER_ORDER` và footer |
| `src/components/ZoneSelector.css` | Style `.zone-root-locked .zone-stepper` |
| `src/components/BookingSummary.jsx` | Hiển thị spinner `"Đang giữ chỗ..."`, khóa nút khi `isReserving` / `otherEventSession`, đồng bộ `MAX_TICKETS_PER_ORDER` |
| `src/pages/EventsPage.jsx` | Dùng `MAX_TICKETS_PER_ORDER` cho nhãn bộ lọc loại hình vé |
| `src/components/EventFormModal.jsx` | Dùng `MAX_TICKETS_PER_ORDER` cho option `ZONE_BASED` |
| `docs/LOCK_SEAT_SELECTION_DURING_HOLD.md` | Tài liệu kỹ thuật của đợt nâng cấp |
| `README.md` | Bổ sung mục tổng quan thay đổi ngày 23/11/2026 |

---

## 6. Kiểm tra & Kịch bản QA thủ công

### 6.1. Kiểm tra tự động (đã chạy trên mã nguồn cuối)
- **ESLint các file chỉnh sửa** (`App.jsx`, `EventDetailPage.jsx`, `SeatSelector.jsx`, `SeatMap.jsx`, `ZoneSelector.jsx`, `BookingSummary.jsx`, `EventsPage.jsx`, `EventFormModal.jsx`): **0 lỗi, 0 warning**.
- **Vite build (`npm run build`):** **PASS**.
- **Grep giới hạn `5` cũ & log debug** (`tối đa 5\b|max 5\b|/5\)|< 5\b|console\.log.*bắt đầu thanh toán`): **0 kết quả**.

### 6.2. Kịch bản QA thủ công trên trình duyệt (`npm run dev`)
1. **Seated-based (`RESERVED`):** chọn ghế → bấm `"Giữ chỗ ngay"` → banner khóa hiện rõ, ghế đang giữ vẫn nổi màu hồng, các ghế còn lại mờ & `disabled`; click bất kỳ ghế nào không đổi lựa chọn; bấm **"Hủy giữ ghế / Chọn lại"** → sơ đồ mở khóa ngay.
2. **Seated-based (`PAYMENT_PROCESSING`):** bấm `"Thanh toán QR"` → quay lại trang chi tiết sự kiện → sơ đồ vẫn khóa, banner nhắc đơn `#orderCode` đang chờ thanh toán; chỉ mở khóa sau khi bấm **"Hủy đơn / Chọn lại ghế"**.
3. **Zone-based:** chọn đủ `4` vé trước khi giữ → nút `+` `disabled` & tắt màu hồng, các nhãn hiển thị `4/4`; sau khi bấm `"Giữ chỗ ngay"` → cả `-` và `+` của mọi khu vực đều `disabled`.
4. **Mạng chậm (DevTools Network → Slow 3G):** bấm `"Giữ chỗ ngay"` → nút chuyển `"Đang giữ chỗ..."` và sơ đồ khóa ngay; bấm lặp không gửi request trùng.
5. **Xuyên sự kiện:** giữ ghế ở Sự kiện A → mở Sự kiện B → Sự kiện B bị khóa kèm banner giải thích → bấm **"Hủy giữ chỗ"** trên `PendingPaymentBanner` → Sự kiện B tự mở khóa ngay không cần F5.
