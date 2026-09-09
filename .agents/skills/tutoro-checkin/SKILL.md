---
name: tutoro-checkin
description: >-
  Dùng skill này khi người dùng hỏi về kiến trúc, quy trình hoạt động, cách debug,
  hoặc cách mở rộng bot TutorO Auto Check-in. Bao gồm: cơ chế check-in tự động,
  đánh giá học sinh, tích hợp Discord, Web Dashboard, và TutorO API.
---

# TutorO Auto Check-in Bot — Hướng dẫn cho AI Agent

## Tổng quan dự án

Bot Node.js chạy 24/7, tự động **điểm danh** và **đánh giá học sinh** trên nền tảng TutorO cho giáo viên Teky, kèm thông báo Discord và Web Dashboard.

**Tech stack**: Node.js (ESM), vanilla HTTP server, dotenv, fetch API.

---

## Kiến trúc file

```
src/
├── index.js          # Entry point — vòng lặp 24/7, khởi chạy server
├── server.js         # HTTP server: Web Dashboard + API endpoints
├── config/index.js   # Đọc .env, thiết lập timezone (Asia/Ho_Chi_Minh)
├── core/
│   ├── checkin.js     # Logic chính: check-in, đánh giá, lên lịch
│   └── evalData.js    # Payload đánh giá (15 tiêu chí × 2 chế độ)
├── services/
│   ├── tutoro.js      # Gọi TutorO API (sessions, checkin, evaluation)
│   └── discord.js     # Gửi embed message qua Discord Webhook
└── utils/
    └── time.js        # Hàm thời gian: sleep, formatDuration, msUntilTomorrow6AM
```

---

## Luồng hoạt động chính

1. `index.js` bật Web server (`startServer()`) và chạy vòng lặp `while(true)`.
2. Mỗi ngày, `processToday()` gọi API lấy danh sách buổi học → sắp xếp theo giờ.
3. Với mỗi buổi:
   - **Check-in**: Chờ đến 15 phút trước giờ học → gọi API `POST /class_sessions/{id}/checkin`.
   - **Đánh giá**: 5 phút sau giờ kết thúc → gọi API đánh giá từng học sinh (bỏ qua vắng mặt, lớp Camp).
4. Kết quả gửi qua Discord Webhook dưới dạng embed.
5. Sau khi xong, bot `sleep()` đến 6:00 sáng hôm sau rồi lặp lại.

---

## Các API endpoint trên Web Dashboard

| Method | Path               | Mô tả                                          |
|--------|--------------------|-------------------------------------------------|
| GET    | `/`                | Trang Dashboard — hiển thị danh sách lớp hôm nay |
| HEAD   | `/`                | Health check cho UptimeRobot                    |
| POST   | `/api/set-mode`    | Đổi chế độ đánh giá (`{sessionId, mode}`)       |
| POST   | `/api/evaluate-now`| Đánh giá thủ công ngay (`{sessionId}`)          |

### Chế độ đánh giá (mode)
- `0` = Không đánh giá (mặc định cho lớp Camp)
- `1` = Bình thường (point = 3 cho mỗi tiêu chí)
- `2` = Tích cực (point = 4 cho mỗi tiêu chí)

---

## Biến môi trường (.env)

| Biến              | Bắt buộc | Mô tả                              |
|-------------------|----------|-------------------------------------|
| `TUTORO_TOKEN`    | Không    | Token API (tự refresh nếu có phone/pass) |
| `TUTORO_PHONE`    | Có       | SĐT đăng nhập TutorO               |
| `TUTORO_PASSWORD` | Có       | Mật khẩu TutorO                    |
| `DISCORD_WEBHOOK` | Có       | URL Discord Webhook                 |
| `PORT`            | Không    | Port cho web server (mặc định 3000) |

---

## Quy tắc khi chỉnh sửa code

1. **Luôn dùng ESM** (`import/export`), không dùng `require`.
2. **Console log dùng tag**: `[CHECKIN]`, `[DANH GIA]`, `[INFO]`, `[LOI]`, `[CHO]`, `[DONE]`.
3. **Delay giữa các API call**: `sleep(2000)` giữa mỗi lần đánh giá để tránh rate limit.
4. **Lớp Camp** tự động được set `mode = 0` khi chưa được cấu hình.
5. **Payload đánh giá** có 15 tiêu chí cố định — chỉ khác nhau ở `point` và `answer`.
6. **Discord embed** luôn có trường `timestamp` là `new Date().toISOString()`.

---

## Hướng dẫn debug thường gặp

### Token hết hạn (lỗi 401)
- Kiểm tra `TUTORO_PHONE` và `TUTORO_PASSWORD` trong `.env`.
- Bot có cơ chế auto-login nếu có phone/password.

### Không đánh giá được
- Kiểm tra `getEvalMode()` — có thể lớp đang ở mode 0.
- Kiểm tra `getAbsentStudentIds()` — học sinh vắng bị bỏ qua.
- Xem log tag `[DANH GIA]` để biết chi tiết.

### Dashboard trắng
- Kiểm tra port (`PORT` trong `.env` hoặc mặc định 3000).
- Kiểm tra API `getSessionsToday()` có lỗi không.

---

## Tham khảo thêm

### Tài liệu chi tiết (references/)
- TutorO API chi tiết: [tutoro-api.md](./references/tutoro-api.md)
- Discord integration: [discord-integration.md](./references/discord-integration.md)

### Ví dụ (examples/)
- Các API request mẫu: [api-requests.md](./examples/api-requests.md)

### Files trong dự án
- File test đánh giá: [test_eval.js](../../test_eval.js)
- File kiểm tra dữ liệu HS: [check_student_data.js](../../check_student_data.js)
- File HTTP requests mẫu: [index (1).http](../../index%20(1).http)
