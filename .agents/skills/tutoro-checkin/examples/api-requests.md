# Ví dụ API Requests

## 1. Login
```http
POST https://api.tutoro.vn/v1/user/login_pass
Content-Type: application/json

{
  "mobile_number": "0123456789",
  "password": "mypassword",
  "device_id": "784c3a7b4fcf82b4",
  "firebase_token": "dyn0EuOATmqdSvoceLhT5d..."
}
```

## 2. Lấy lớp học hôm nay
```http
GET https://api.tutoro.vn/v1/class_sessions?from_date=20/08/2025&to_date=20/08/2025
Authorization: Bearer eyJhbGci...
```

## 3. Check-in
```http
POST https://api.tutoro.vn/v1/class_sessions/123456/checkin
Authorization: Bearer eyJhbGci...
```

## 4. Lấy danh sách HS để đánh giá
```http
GET https://api.tutoro.vn/v1/class_sessions/123456/evaluations
Authorization: Bearer eyJhbGci...
```

## 5. Submit đánh giá cho 1 HS
```http
POST https://api.tutoro.vn/v1/class_sessions/123456/evaluations/789
Authorization: Bearer eyJhbGci...
Content-Type: application/json

{
  "id": 11,
  "name": "TEKY - Đánh giá cuối buổi",
  "evaluated_criterias": [
    {
      "id": 123,
      "name": "Mức độ tập trung trong giờ học",
      "type": "SINGLE_CHOICE",
      "sequence": "1",
      "answer": "Bạn rất tập trung...",
      "point": 3
    }
  ]
}
```

## 6. Lấy điểm danh HS (để biết ai vắng)
```http
GET https://api.tutoro.vn/v1/class_sessions/123456/attendances?language_code=vi
Authorization: Bearer eyJhbGci...
```
