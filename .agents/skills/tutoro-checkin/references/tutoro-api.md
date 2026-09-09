# TutorO API Reference

Base URL: `https://api.tutoro.vn/v1`

Mọi request (trừ login) cần header: `Authorization: Bearer <token>`

---

## Authentication

### Login
```
POST /user/login_pass
Content-Type: application/json

{
  "mobile_number": "0xxxxxxxxx",
  "password": "xxx",
  "device_id": "784c3a7b4fcf82b4",
  "firebase_token": "..."
}
```
**Response thành công** (`status_code: 200`):
```json
{
  "message": { "status_code": 200 },
  "data": { "token": "eyJhbGci..." }
}
```

### Auto-login flow
- Bot kiểm tra `TOKEN` trước.
- Nếu không có hoặc bị 401 → gọi `login()` với `TUTORO_PHONE` + `TUTORO_PASSWORD`.
- Token mới được lưu trong memory qua `setToken()` (file `config/index.js`).
- Cơ chế singleton: dùng `loginPromise` để tránh login đồng thời nhiều lần.

---

## Sessions (Buổi học)

### Lấy danh sách buổi học theo ngày
```
GET /class_sessions?from_date=DD/MM/YYYY&to_date=DD/MM/YYYY
```
**Response**: `data.list_sessions[]` — mỗi item có:
| Field | Type | Mô tả |
|-------|------|--------|
| `session_id` | number | ID buổi học |
| `class_name` | string | Tên lớp |
| `session_chapter` | string | Tên bài học |
| `students_number` | number | Số học sinh |
| `datetime.start_time` | number | Giờ bắt đầu (tính bằng **phút** từ 00:00, vd: 540 = 09:00) |
| `datetime.end_time` | number | Giờ kết thúc (tính bằng phút) |

> **Lưu ý quan trọng**: `start_time` và `end_time` là số phút từ 00:00, **KHÔNG phải** timestamp Unix.

---

## Check-in (Điểm danh)

### Thực hiện check-in
```
POST /class_sessions/{session_id}/checkin
Authorization: Bearer <token>
```
**Thành công**: `message.status_code === 200`, `data.state`, `data.checkin_id`
**Đã check-in rồi**: `message.text` chứa "đã check in"

### Kiểm tra trạng thái check-in
```
GET /class_sessions/{session_id}/checkin
```
**Response**: `data.checkin_id`, `data.checkin_datetime` (Unix timestamp), `data.state`

---

## Evaluation (Đánh giá)

### Lấy danh sách học sinh cần đánh giá
```
GET /class_sessions/{session_id}/evaluations
```
**Response**: `data.list_evaluations[0].list_students[]` — mỗi item có:
| Field | Mô tả |
|-------|--------|
| `student_id` | ID học sinh |
| `full_name` | Tên học sinh |
| `evaluation_info.evaluation_status` | `true` nếu đã được đánh giá |

### Submit đánh giá
```
POST /class_sessions/{session_id}/evaluations/{student_id}
Content-Type: application/json
```
Body: xem file `evalData.js` — 15 tiêu chí, mỗi tiêu chí có `id`, `answer`, `point`.

---

## Attendance (Điểm danh học sinh)

### Lấy danh sách điểm danh
```
GET /class_sessions/{session_id}/attendances?language_code=vi
```
**Response**: `data.list_students[]` (nhóm theo center) → `list_students[]` — mỗi item có:
| Field | Mô tả |
|-------|--------|
| `student_id` | ID học sinh |
| `attendance_status` | `"YES"` = có mặt, khác = vắng |

---

## Retry & Error Handling

Hàm `callApi()` trong `services/tutoro.js` xử lý:
1. **401 Unauthorized** → Tự động re-login rồi retry.
2. **HTML response** (WAF/Cloudflare chặn) → Throw error.
3. **Network error** → Retry tối đa 3 lần, delay 5s giữa mỗi lần.
