# Kết nối Backend Heroku & Cấu hình Môi trường — Tài liệu Frontend (`sell-ticket-fe-demo`)

**Phạm vi:** Frontend `sell-ticket-fe-demo/` — Đồng bộ với Backend nhánh `fix/heroku-be-deploy-audit` (không cài thêm thư viện, không thay đổi UI/nghiệp vụ)  
**Backend Production URL:** `https://sell-ticket-be-bcn-bcc127d1b2cd.herokuapp.com/api`  
**Nhánh làm việc:** `fix/heroku-be-deploy-audit`  
**Cập nhật:** 2026-11-24  
**Kiểm tra build/lint:** `npm run build` PASS · ESLint `0` lỗi trên `eventService.js` & `guestService.js` · `fe-api-url` check PASS

---

## 1. Tổng quan vấn đề đã khắc phục

Trước đây trong [src/services/eventService.js](../src/services/eventService.js), `API_BASE_URL` luôn ép `localhost` về `http://localhost:3000/api` (không thể override bằng `VITE_API_URL` khi dev local) và fallback trên production lại trỏ về `http://localhost:3000/api` nếu thiếu biến môi trường. Ngoài ra, nếu cấu hình `VITE_API_URL` truyền URL gốc Heroku thiếu `/api` (hoặc dư dấu `/`), các lời gọi API sẽ bị sai đường dẫn.

Các thay đổi đã triển khai:
- Chuẩn hóa nguồn sự thật `API_BASE_URL` duy nhất tại [src/services/eventService.js](../src/services/eventService.js) ([src/services/guestService.js](../src/services/guestService.js) tự động dùng chung `API_BASE_URL`).
- Tạo file mẫu cấu hình [.env.example](../.env.example) hướng dẫn `VITE_API_URL` cho local và production.
- Sửa đường dẫn script `"server"` trong [package.json](../package.json) từ `../be/app.js` sang `../sell-ticket-be-demo/app.js`.

---

## 2. Hợp đồng phân giải `API_BASE_URL` ([src/services/eventService.js](../src/services/eventService.js))

| Export | Giá trị / Trách nhiệm |
| :--- | :--- |
| `DEFAULT_LOCAL_API_URL` | `'http://localhost:3000/api'` |
| `DEFAULT_PROD_API_URL` | `'https://sell-ticket-be-bcn-bcc127d1b2cd.herokuapp.com/api'` |
| `normalizeApiBaseUrl(rawUrl)` | Cắt khoảng trắng & mọi dấu `/` cuối; tự gắn `/api` nếu chưa kết thúc bằng `/api` (không phân biệt hoa thường). Chuỗi rỗng trả về `''`. |
| `resolveApiBaseUrl(envUrl, hostname)` | Ưu tiên `VITE_API_URL` hợp lệ trước; nếu rỗng thì dùng `DEFAULT_LOCAL_API_URL` trên `localhost`/`127.0.0.1`, các domain khác dùng `DEFAULT_PROD_API_URL`. |
| `API_BASE_URL` | Kết quả từ `resolveApiBaseUrl(import.meta.env?.VITE_API_URL, typeof window !== 'undefined' ? window.location.hostname : '')`. |

### Các edge case đã xử lý
- `VITE_API_URL="https://sell-ticket-be-bcn-bcc127d1b2cd.herokuapp.com/"` → `https://sell-ticket-be-bcn-bcc127d1b2cd.herokuapp.com/api`
- `VITE_API_URL="https://sell-ticket-be-bcn-bcc127d1b2cd.herokuapp.com/api/"` → `https://sell-ticket-be-bcn-bcc127d1b2cd.herokuapp.com/api` (không bị lặp `/api/api`)
- `VITE_API_URL="   "` → fallback theo `hostname` (`localhost`/`127.0.0.1` → local BE; Vercel/production → Heroku BE)
- Khi dev local muốn trỏ tạm sang BE Heroku hoặc staging, chỉ cần đặt `VITE_API_URL` trong `.env.local`; để gọi BE local thì để trống hoặc xóa `.env.local`.

---

## 3. Đồng bộ với Backend & Checklist Triển khai Vercel/Hosting

### 3.1. Đồng bộ CORS & `Retry-After` từ Backend
- Backend nhánh `fix/heroku-be-deploy-audit` đã bổ sung `Access-Control-Expose-Headers: Retry-After`, giúp `apiRequest` trong [src/services/eventService.js](../src/services/eventService.js) đọc được `err.retryAfter` khi gặp `429` (rate limit / gửi lại OTP).
- Khi deploy production, đảm bảo Backend Heroku đã thêm origin domain Frontend (không có `/` cuối) vào `FRONTEND_ORIGIN` / `CORS_ORIGINS`.

### 3.2. Các bước cấu hình trên Vercel / Hosting Frontend
1. Vào **Environment Variables** của project Frontend trên Vercel, đặt:
   ```dotenv
   VITE_API_URL=https://sell-ticket-be-bcn-bcc127d1b2cd.herokuapp.com/api
   ```
2. **Redeploy** bản production (Vite đóng gói biến `VITE_*` tại thời điểm build).
3. Kiểm tra nhanh trên trình duyệt:
   - Mở danh sách sự kiện (`/events`) xác nhận request gọi tới `https://sell-ticket-be-bcn-bcc127d1b2cd.herokuapp.com/api/events`.
   - Thử đăng nhập, giữ ghế, mở `/checkout/:orderCode` xác nhận SSE `GET /api/orders/:orderCode/events` mở `200 text/event-stream` ổn định.

---

## 4. Lệnh kiểm tra cục bộ
```powershell
cd sell-ticket-fe-demo
npx eslint src/services/eventService.js src/services/guestService.js
npm run build
```
