# TutorO Auto Check-in Bot 

Bot tự động điểm danh, tự động đánh giá học sinh cho giáo viên Teky trên nền tảng TutorO, chạy hoàn toàn tự động 24/7 và thông báo kết quả qua Discord. Đặc biệt, Bot đi kèm với một **Web Dashboard** giúp bạn tùy chỉnh chế độ đánh giá cho từng lớp bằng điện thoại một cách tiện lợi.

## Tính Năng Chính
- **Tự Động Điểm Danh:** Tự động check-in lớp học đúng 15 phút trước giờ học.
- **Tự Động Đánh Giá:** Tự động tick 15 tiêu chí đánh giá vào 5 phút sau khi giờ học kết thúc.
- **Auto-Login:** Tự động lấy lại Token mới nếu Token cũ bị hết hạn.
- **Báo Cáo Discord:** Báo cáo chi tiết từng lớp check-in thành công và tổng kết toàn bộ số liệu cuối ngày.
- **Web Dashboard:** Trang web giúp giáo viên chuyển đổi qua lại giữa chế độ đánh giá "Bình Thường" và "Tích Cực".

---

## 1. Cài đặt và Chạy trên Máy tính (Local)

### Yêu cầu:
- Cài đặt [Node.js](https://nodejs.org/en/) trên máy.
- Đã có tài khoản Github và Git.

### Các bước chạy:
1. Tải code về máy và cài đặt thư viện:
   ```bash
   npm install
   ```
2. Đổi tên file `.env.example` thành `.env` và điền thông tin của bạn vào:
   - `TUTORO_TOKEN`: (Không bắt buộc nếu đã điền Phone/Password)
   - `TUTORO_PHONE`: Số điện thoại đăng nhập TutorO
   - `TUTORO_PASSWORD`: Mật khẩu đăng nhập TutorO
   - `DISCORD_WEBHOOK`: Đường link Webhook của kênh Discord để nhận thông báo.
3. Khởi chạy Bot:
   ```bash
   npm start
   ```
   Lúc này bảng điều khiển web sẽ chạy tại: `http://localhost:3000`

---

## 2. Hướng dẫn Đẩy lên Đám Mây (Render) để chạy 24/7 Miễn Phí

Để không phải treo máy tính, bạn có thể đẩy code lên [Render](https://render.com).

1. Đẩy toàn bộ code lên một kho chứa (Repository) Github cá nhân.
2. Đăng nhập vào Render, tạo một **New Web Service**.
3. Kết nối với kho chứa Github của bạn.
4. Cấu hình Render:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
5. Cuộn xuống mục **Environment Variables** (Biến môi trường) và thêm 3 biến:
   - `TUTORO_PHONE` = <Số điện thoại của bạn>
   - `TUTORO_PASSWORD` = <Mật khẩu của bạn>
   - `DISCORD_WEBHOOK` = <Link Discord>
6. Bấm **Deploy**. Sau khi Deploy thành công, Render sẽ cấp cho bạn một đường link Web (Ví dụ: `https://bot-checkin.onrender.com`). Hãy lưu link này vào điện thoại để dùng Web Dashboard.

---

## 3. Hướng dẫn thiết lập UptimeRobot (Giữ Bot luôn thức)

Do Render bản miễn phí sẽ tự động tắt máy chủ nếu không có ai truy cập trong 15 phút, chúng ta sẽ dùng UptimeRobot để "nháy máy" liên tục giúp Bot sống 24/7.

1. Truy cập [UptimeRobot](https://uptimerobot.com) và tạo tài khoản.
2. Nhấn vào **+ Add New Monitor**.
3. Cấu hình như sau:
   - **Monitor Type**: HTTP(s)
   - **Friendly Name**: TutorO Bot (Hoặc bất cứ tên gì bạn thích)
   - **URL (or IP)**: Dán đường link Web Render của bạn vào (Ví dụ: `https://bot-checkin.onrender.com`)
   - **Monitoring Interval**: 5 minutes
4. Bấm **Create Monitor**. 

Hoàn tất! Cột mốc trạng thái màu xanh lá cây báo hiệu Bot của bạn đã chính thức bước vào trạng thái bất tử 24/7. Chúc bạn có những giờ dạy học thảnh thơi! 
