# Discord Integration

## Cơ chế hoạt động

Bot gửi thông báo qua **Discord Webhook** (không phải Discord Bot), sử dụng embed messages.

## Bypass Cloudflare

Discord đôi khi bị Cloudflare chặn trên các Cloud server. Bot xử lý bằng cách thử 3 URL:
1. `discord.com` (chính)
2. `canary.discord.com` (backup 1)
3. `ptb.discord.com` (backup 2)

## Rate Limiting

- Nếu nhận HTTP 429 → đọc `retry_after` từ response body → chờ đúng thời gian đó + 1s.
- Nếu response là HTML (Cloudflare) → chờ 10s.
- Retry tối đa 3 lần cho mỗi URL.

## Embed Format

Bot luôn gửi dưới dạng embed (không dùng plain text). Mỗi embed có:
```json
{
  "title": "Tiêu đề",
  "description": "Mô tả (tùy chọn)",
  "color": 0x00d26a,
  "fields": [
    { "name": "Tên field", "value": "Giá trị", "inline": true }
  ],
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Bảng màu sử dụng

| Màu | Hex | Dùng cho |
|-----|-----|----------|
| Xanh lá | `0x00d26a` | Check-in thành công |
| Xanh dương | `0x3498db` | Đã check-in trước đó |
| Đỏ | `0xff4757` | Lỗi / thất bại |
| Tím | `0x9b59b6` | Đánh giá tự động |
| Vàng | `0xf1c40f` | Lịch học hôm nay |
| Xám | `0x95a5a6` | Không có lịch |
| Cam | `0xffa502` | Cảnh báo |
