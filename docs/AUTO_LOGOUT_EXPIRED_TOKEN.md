# Tự động đăng xuất khi Token hết hạn — Tài liệu Frontend (`sell-ticket-fe-demo`)

**Phạm vi:** Frontend `sell-ticket-fe-demo/` — Đồng bộ với Backend nhánh `fix/auto-logout-expired-token` (không cài thêm thư viện, không thay đổi Database)  
**Nhánh làm việc:** `fix/auto-logout-expired-token`  
**Cập nhật:** 2026-11-23  
**Kiểm tra build/lint:** `npm run build` PASS · ESLint `0` lỗi mới · `authSession` unit check PASS

---

## 🎯 1. Tổng quan mục tiêu & Các vấn đề đã khắc phục

Hoàn thiện luồng tự động đăng xuất khi JWT hết hạn hoặc bị vô hiệu trên Backend, bảo đảm người dùng không thể chọn sự kiện/thao tác tiếp với token đã chết rồi mới vấp lỗi kỹ thuật, đồng thời xử lý triệt để các lỗi cạnh tranh và lệch đồng hồ:

- **Bù lệch đồng hồ client–server (`serverOffsetMs`):** Tính và lưu độ lệch từ `serverTime` của API `/auth/login` (fallback từ JWT `iat` nếu lệch > 30s) để tránh vòng lặp đá về `/login` khi máy người dùng chạy nhanh/chậm giờ.
- **Tự đăng xuất đúng 1 lần (idempotent), không chồng toast:** Dùng `handledExpiredTokenRef` theo token hiện tại, gắn `err.isAuthError = true` ở tầng API/SSE, chuẩn hóa thông điệp thân thiện (`DEFAULT_AUTH_EXPIRED_MESSAGE`) và chặn `toast.error`/`toast.warning` trùng ở tất cả caller.
- **Bảo toàn đường dẫn quay lại (`sellticket_after_login_path`):** Lưu return path an toàn trước khi điều hướng về `/login` từ các route bảo vệ (đặc biệt trang thanh toán QR `/checkout/:orderCode`) hoặc từ thao tác người dùng bị `401`.
- **Đồng bộ cả REST lẫn SSE (`subscribeOrderEvents`):** Stream SSE gặp `401` tự gọi `notifyAuthExpired(..., { source: 'sse' })` giống hệt REST, không để lệch trạng thái UI và `localStorage`.
- **Tách bạch `401` xác thực khỏi `403 FORBIDDEN`:** Chỉ coi `401`, `data.code` (`TOKEN_EXPIRED` / `TOKEN_INVALID` / `AUTH_REQUIRED`), hoặc fallback câu lỗi JWT cũ là lỗi xác thực; không đăng xuất nhầm khi gặp `403` phân quyền/nghiệp vụ.
- **Ổn định hiệu năng & đa tab:** Memoize `toast` trong `ToastProvider`, tách 3 `useEffect` trong `AppShell` (chỉ phụ thuộc `[activeToken, activeServerOffsetMs]`), cap `setTimeout` theo giới hạn 32-bit `2_147_483_647 ms` đệ quy, đồng bộ đa tab 2 chiều kể cả `localStorage.clear()`, và thông báo 1 lần khi mở lại web với token quá hạn (`wasExpired`).

---

## 🧩 2. Trung tâm quản lý phiên (`src/utils/authSession.js`) & `ToastProvider`

### 2.1. Hằng số & API chuẩn trong [src/utils/authSession.js](../src/utils/authSession.js)

Mọi thao tác đọc/ghi/xóa phiên đăng nhập và return path đều đi qua module này (có guard `typeof window !== 'undefined'`, `typeof localStorage !== 'undefined'`, `typeof sessionStorage !== 'undefined'` và bọc `try/catch`):

| Export | Trách nhiệm |
| :--- | :--- |
| `AUTH_USER_STORAGE_KEY` (`'sellticket_user'`) | Key lưu phiên đăng nhập trong `localStorage` |
| `AUTH_EXPIRED_EVENT` (`'sellticket:auth-expired'`) | CustomEvent phát trên `window` kèm `{ detail: { reason, source } }` |
| `AFTER_LOGIN_PATH_KEY` (`'sellticket_after_login_path'`) | Key lưu đường dẫn quay lại sau đăng nhập trong `sessionStorage` |
| `DEFAULT_EXPIRY_SKEW_SECONDS` (`5`) | Ngưỡng trừ hao hết hạn trước `5` giây |
| `MAX_SETTIMEOUT_DELAY_MS` (`2147483647`) | Giới hạn delay 32-bit của `window.setTimeout` (~24.85 ngày) |
| `DEFAULT_AUTH_EXPIRED_MESSAGE` | `'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'` |
| `computeAuthServerOffsetMs(serverTime, token)` | Tính `serverTime - Date.now()`, fallback `iat * 1000 - Date.now()` nếu `\|delta\| > 30s` |
| `getRemainingTokenMs(token, options)` | Trả ms còn lại tới `exp * 1000 - skewSeconds * 1000` theo `Date.now() + serverOffsetMs` |
| `isJwtExpired(token, options)` | Hỗ trợ cả `number` lẫn `{ skewSeconds, serverOffsetMs }`, trả `true` nếu `remaining <= 0` |
| `readInitialAuthState()` / `readStoredUser()` | Đọc `sellticket_user`; nếu quá hạn thì tự xóa storage và trả `{ user: null, wasExpired: true }` |
| `writeStoredUser(userData)` / `clearStoredAuth()` | Ghi/xóa `sellticket_user` an toàn qua `localStorage` |
| `saveAfterLoginPath(path)` / `consumeAfterLoginPath()` | Chỉ lưu path nội bộ `/...` (chặn `//`, `/login`, `/admin`), đọc xong xóa ngay |
| `isProtectedPathname(pathname)` | `true` cho `/admin`, `/my-tickets`, `/profile`, `/notifications`, `/checkout/:orderCode` |
| `isAuthError(status, payload)` | `true` với `401`, `code` thuộc `TOKEN_EXPIRED`/`TOKEN_INVALID`/`AUTH_REQUIRED`, hoặc fallback `403` cũ |
| `getFriendlyAuthExpiredMessage(payload)` | Lọc message kỹ thuật chứa `"token"` thành `DEFAULT_AUTH_EXPIRED_MESSAGE` |
| `notifyAuthExpired(reason, meta)` | Xóa storage và bắn `AUTH_EXPIRED_EVENT` kèm `source` (`'api'` \| `'background'` \| `'action'` \| `'sse'` \| `'proactive'`) |

### 2.2. Memoize `ToastProvider` ([src/components/Toast.jsx](../src/components/Toast.jsx))

`ToastContext.Provider` value (`toast`) được bọc bằng `useMemo(..., [push, readIds, markRead, markAllRead])` để giữ tham chiếu ổn định, tránh làm các component/effect tiêu thụ `useToast()` bị teardown và đăng ký lại khi phát toast.

---

## 🔄 3. Vòng đời phiên & Ma trận điều hướng (`App.jsx`, `LoginPage.jsx`)

### 3.1. Bù lệch đồng hồ khi đăng nhập ([src/pages/LoginPage.jsx](../src/pages/LoginPage.jsx))

Hàm `toUserData(loginRes, fallbackName, fallbackPhone = null)` tính sẵn `serverOffsetMs: computeAuthServerOffsetMs(serverTime, authToken)` và được dùng thống nhất cho cả 3 luồng: đăng nhập email, đăng ký mới và nhận lại vé (`claim`).

### 3.2. Kiến trúc 3 `useEffect` độc lập trong `AppShell` ([src/App.jsx](../src/App.jsx))

Các giá trị `toast`, `navigate`, `location`, `user?.token` được đồng bộ qua `useRef` để effect theo dõi phiên chỉ phụ thuộc `[activeToken, activeServerOffsetMs]`, sạch cảnh báo React Hooks / React Compiler:

1. **Effect 1 — Thông báo khi mở lại web với token quá hạn:** Kiểm tra `initialAuth.wasExpired` (chống lặp StrictMode bằng `initialExpiredNotifiedRef`), bắn đúng 1 toast `info`; nếu đang đứng ở route bảo vệ thì lưu return path và chuyển `/login`.
2. **Effect 2 — Giám sát phiên hiện tại:**
   - Hẹn timer theo `getRemainingTokenMs(...)`; nếu vượt `MAX_SETTIMEOUT_DELAY_MS` thì hẹn từng chặng đệ quy; nếu `<= 0` thì hẹn `setTimeout(..., 0)` (không gọi `setState` đồng bộ trong effect).
   - Lắng nghe `visibilitychange` (`visible`), `focus`, và `AUTH_EXPIRED_EVENT`.
   - `performAutoLogout` dùng `handledExpiredTokenRef` làm khóa idempotent để đảm bảo 1 token hết hạn chỉ logout + bắn toast đúng 1 lần kể cả khi nhiều API lỗi song song.
3. **Effect 3 — Đồng bộ đa tab luôn bật (`[]`):** Lắng nghe `storage` kể cả khi chưa đăng nhập và khi tab khác chạy `localStorage.clear()` (`event.key === null`):
   - Tab khác logout/hết hạn (`prevToken && !nextUser`) → clear state + toast `"Phiên đăng nhập đã kết thúc ở tab khác."` + về `/login` nếu đang ở route bảo vệ.
   - Tab khác vừa login (`!prevToken && nextUser`) → cập nhật `user`; nếu tab hiện tại đang đứng ở `/login` thì điều hướng về `/admin` hoặc `consumeAfterLoginPath() || '/events'`.
   - Tab khác đổi tài khoản (`prevToken && nextUser && nextUser.token !== prevToken`) → cập nhật `user` và reset `cart`.

### 3.3. Ma trận hành vi điều hướng khi hết hạn

| Ngữ cảnh xảy ra hết hạn | Trạng thái auth / cart | Toast | Lưu `sellticket_after_login_path` | Điều hướng |
| :--- | :--- | :--- | :---: | :--- |
| Mở lại web đã quá hạn (`wasExpired`) ở route công khai (`/`, `/events`, `/events/:id`) | Xóa storage, `user = null`, `cart = []` | 1 toast `info` | Không | **Giữ nguyên trang công khai** |
| Mở lại web đã quá hạn ở route bảo vệ (`/checkout/:code`, `/profile`, `/my-tickets`, `/notifications`, `/admin`) | Xóa storage, `user = null`, `cart = []` | 1 toast `info` | Có (trừ `/admin`) | `navigate('/login', { replace: true })` |
| Hết hạn thụ động (timer / `focus` / `visibilitychange` / `source: 'background'`) ở route công khai | Xóa storage, `user = null`, `cart = []` | 1 toast `info` | Không | **Giữ nguyên trang công khai** |
| Hết hạn ở route bảo vệ (mọi nguồn) | Xóa storage, `user = null`, `cart = []` | 1 toast `info` | Có (trừ `/admin`) | `navigate('/login', { replace: true })` |
| Thao tác chủ động (`source: 'action' \| 'proactive'`) trên `/events/:id` gặp token chết | Xóa storage, `user = null`, `cart = []` | 1 toast `info` duy nhất | Có (`/events/:id`) | `navigate('/login', { replace: true })` |
| Tab khác đăng xuất / `localStorage.clear()` (`storage` event) | `user = null`, `cart = []` | 1 toast `info` tab khác | Có nếu ở route bảo vệ | `/login` nếu route bảo vệ; giữ nguyên nếu công khai |

---

## 🌐 4. Tầng API/SSE & Quy tắc cho Callers

### 4.1. API & SSE Layer ([src/services/eventService.js](../src/services/eventService.js))

- `apiRequest(path, { method, body, token, fallbackError, authSource = 'action' })`: chỉ kích hoạt `notifyAuthExpired` khi `Boolean(token) && isAuthError(res.status, payload)`, gắn `err.isAuthError = true` và chuẩn hóa `err.message` bằng `getFriendlyAuthExpiredMessage(payload)`.
- Các lời gọi polling/đồng bộ ngầm dùng `authSource: 'background'`: `fetchMyOrderHistory`, `fetchMyActiveSession`, và `fetchOrderPayment(..., { background: true })`.
- `subscribeOrderEvents`: kiểm tra `isAuthError(res.status, payload)` khi handshake thất bại, gắn `err.isAuthError = true`, gọi `notifyAuthExpired(..., { source: 'sse' })` song song `onAuthError?.(err)`; còn `403` không phải lỗi auth đi về `onNotFound`.

### 4.2. Quy tắc cho toàn bộ Callers

- Không đọc/ghi thô `localStorage['sellticket_user']` hoặc `sessionStorage['sellticket_after_login_path']` ở component/page — luôn dùng `authSession.js`.
- Trong `catch (err)` của mọi caller có bắn toast lỗi, kiểm tra `if (err?.isAuthError) return;` để tránh hiện toast đỏ trùng với toast tự đăng xuất.
- Trong [src/pages/EventDetailPage.jsx](../src/pages/EventDetailPage.jsx), `handleReserveSeats` và `handlePayment` kiểm tra chủ động `isJwtExpired(token, { serverOffsetMs: user?.serverOffsetMs || 0 })` trước khi gửi request; `releaseSeats` dọn rác local chỉ gọi khi có `token`.
- Trong [src/hooks/useOrderCheckout.js](../src/hooks/useOrderCheckout.js), ưu tiên `authExpired` trước `!token` khi tính `uiState`, tách `403` nghiệp vụ sang `NOT_FOUND`, và không gọi lại `loadOrderPayment` nếu `cancelCurrentOrder` thất bại do `isAuthError`.

---

## 📁 5. Danh sách file tác động

| File | Vai trò |
| :--- | :--- |
| [src/utils/authSession.js](../src/utils/authSession.js) | Toàn bộ helper vòng đời phiên, `serverOffsetMs`, 32-bit timer helpers, `saveAfterLoginPath`/`consumeAfterLoginPath`, `isAuthError` chuẩn |
| [src/components/Toast.jsx](../src/components/Toast.jsx) | Memoize `toast` context value bằng `useMemo` |
| [src/services/eventService.js](../src/services/eventService.js) | Chuẩn hóa `apiRequest` (`Boolean(token)`, `err.isAuthError`, `authSource`) và `subscribeOrderEvents` SSE |
| [src/pages/LoginPage.jsx](../src/pages/LoginPage.jsx) | Gắn `serverOffsetMs` trong `toUserData` cho cả login, register và claim |
| [src/App.jsx](../src/App.jsx) | 3 `useEffect` quản lý hết hạn/đa tab, `handledExpiredTokenRef`, ma trận điều hướng, bỏ đọc thô storage, chặn toast trùng Admin CRUD |
| [src/pages/EventDetailPage.jsx](../src/pages/EventDetailPage.jsx) | Dùng `readStoredUser()`, check `isJwtExpired` chủ động trước giữ ghế/thanh toán, chặn `toast.error` trùng, bảo vệ `releaseSeats` |
| [src/hooks/useOrderCheckout.js](../src/hooks/useOrderCheckout.js) | Dùng `isAuthError` thay cho gộp mọi `403`, ưu tiên `AUTH_EXPIRED` trước `AUTH_REQUIRED`, chặn gọi thừa sau `401` |
| [src/pages/CheckoutPage.jsx](../src/pages/CheckoutPage.jsx) | Dùng `saveAfterLoginPath`, không bắn `toast.warning` khi hủy đơn fail do `authExpired` |
| [src/components/PendingPaymentBanner.jsx](../src/components/PendingPaymentBanner.jsx) | Truyền `background: true` cho polling `fetchOrderPayment`, bỏ qua toast/sync thừa khi `err?.isAuthError` |
| [src/pages/ProfilePage.jsx](../src/pages/ProfilePage.jsx) | Bỏ qua `setBanksError` và `toast.error` khi `err?.isAuthError` |
| [src/pages/AdminPage.jsx](../src/pages/AdminPage.jsx) | Bỏ qua `toast.error` ở `handleConfirmRefund` & `handleMarkBankError` khi `err?.isAuthError` |
| [docs/AUTO_LOGOUT_EXPIRED_TOKEN.md](./AUTO_LOGOUT_EXPIRED_TOKEN.md) | Tài liệu kỹ thuật đầy đủ cho team FE |
| [README.md](../README.md) | Bổ sung mục tổng quan thay đổi ngày 23/11/2026 |

---

## 🧪 6. Kiểm tra & Kịch bản QA thủ công

### 6.1. Kiểm tra tự động (đã chạy trên mã nguồn cuối)
- **ESLint 9 file sạch** (`authSession.js`, `Toast.jsx`, `App.jsx`, `LoginPage.jsx`, `EventDetailPage.jsx`, `useOrderCheckout.js`, `CheckoutPage.jsx`, `PendingPaymentBanner.jsx`, `ProfilePage.jsx`): **0 lỗi** (chỉ còn 1 warning `exhaustive-deps` có sẵn ở `ProfilePage.jsx:68`).
- **ESLint file có tồn dư từ trước** (`eventService.js`, `AdminPage.jsx`): **0 lỗi/warning mới** (chỉ giữ nguyên các dòng tồn dư ngoài phạm vi task).
- **Production build (`npm run build`):** **PASS** (`2003 modules transformed`).
- **Unit check `authSession.js` qua Node ESM:** `authSession.check OK` (skew clock 2 ngày, `isAuthError` 401 vs 403 FORBIDDEN vs fallback, `isProtectedPathname`).

### 6.2. Kịch bản QA thủ công (đặt tạm `JWT_EXPIRES_IN=20s` ở BE `.env`)
1. **Hết hạn tự động ở trang công khai (`/events`):** Đăng nhập → đứng yên chờ `~15s` → tự logout tại chỗ về trạng thái khách + đúng **1** toast thông báo.
2. **Mở lại tab sau khi đã quá hạn:** Đóng tab chờ `25s` → mở `/events` (logout tại chỗ + 1 toast); mở thẳng `/my-tickets` → về `/login`, đăng nhập lại tự quay về `/my-tickets`.
3. **Phục hồi trang thanh toán QR (`/checkout/:orderCode`):** Chờ token hết hạn trên `/checkout/:orderCode` → về `/login`, đăng nhập lại tự quay đúng `/checkout/:orderCode`.
4. **Lệch đồng hồ client:** Chỉnh giờ OS nhanh trước 2 ngày → đăng nhập không bị đá vòng lặp về `/login`, vẫn tự logout sau `~15s` thực tế.
5. **Token invalid (`401 TOKEN_INVALID`):** Đổi `JWT_SECRET` + restart BE khi đang ở `/events/:id` → bấm Giữ ghế → chỉ hiện 1 toast thân thiện duy nhất (không có toast đỏ `"Token không hợp lệ hoặc đã hết hạn."`), chuyển `/login` và đăng nhập lại quay về `/events/:id`.
6. **Đồng bộ đa tab:** Mở 2 tab (`/events` và `/profile` hoặc `/admin`) → logout/hết hạn hoặc `localStorage.clear()` ở Tab 1 → Tab 2 tự logout và rời khỏi route bảo vệ.
7. **Không logout nhầm với `403 FORBIDDEN`:** Dùng tài khoản `CUSTOMER` gọi API Admin → BE trả `403 FORBIDDEN` → FE giữ nguyên phiên đăng nhập.
