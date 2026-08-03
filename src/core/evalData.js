// Dữ liệu đánh giá (JSON payload mẫu cho API)

export const EVAL_PAYLOAD_NORMAL = {
  "id": 11,
  "name": "TEKY - Đánh giá cuối buổi",
  "evaluated_criterias": [
    {
      "id": 123,
      "name": "Mức độ tập trung trong giờ học",
      "type": "SINGLE_CHOICE",
      "sequence": "1",
      "answer": "Bạn rất tập trung, thể hiện qua sự tương tác với toàn bộ nội dung bài học",
      "point": 3
    },
    {
      "id": 178,
      "name": "Ý tưởng dự án/sản phẩm",
      "type": "SINGLE_CHOICE",
      "sequence": "1",
      "answer": "Dự án thể hiện được 1 phần chủ đề/vấn đề của bài học",
      "point": 3
    },
    {
      "id": 130,
      "name": "Tư duy phản biện (Critical Thinking)",
      "type": "SINGLE_CHOICE",
      "sequence": "1",
      "answer": "Bạn tích cực lắng nghe và đặt câu hỏi",
      "point": 3
    },
    {
      "id": 131,
      "name": "Hợp tác nhóm (Collaboration)",
      "type": "SINGLE_CHOICE",
      "sequence": "1",
      "answer": "Bạn nỗ lực hoàn thành nhiệm vụ được giao, hướng tới đạt mục tiêu của nhóm",
      "point": 3
    },
    {
      "id": 132,
      "name": "Chia sẻ ý tưởng (Communication)",
      "type": "SINGLE_CHOICE",
      "sequence": "1",
      "answer": "Bạn trình bày được ý tưởng, nhưng chưa trôi chảy",
      "point": 3
    },
    {
      "id": 124,
      "name": "Mức độ tương tác trong giờ học",
      "type": "SINGLE_CHOICE",
      "sequence": "1",
      "answer": "Bạn chủ động tham gia các hoạt động trong lớp",
      "point": 3
    },
    {
      "id": 126,
      "name": "Đi muộn/trễ",
      "type": "SINGLE_CHOICE",
      "sequence": "1",
      "answer": "Bạn đi học đúng giờ",
      "point": 0
    },
    {
      "id": 127,
      "name": "Bài tập về nhà",
      "type": "SINGLE_CHOICE",
      "sequence": "1",
      "answer": "Bạn đã thực hiện bài tập, độ chính xác từ 50% đến 80%",
      "point": 3
    },
    {
      "id": 128,
      "name": "Kiến thức cũ",
      "type": "SINGLE_CHOICE",
      "sequence": "1",
      "answer": "Bạn nhớ được kiến thức cũ nhưng còn bối rối trong việc áp dụng",
      "point": 3
    },
    {
      "id": 129,
      "name": "Kiến thức mới",
      "type": "SINGLE_CHOICE",
      "sequence": "1",
      "answer": "Bạn tiếp thu kiến thức tốt. Hoàn thành 100% các nhiệm vụ bài học",
      "point": 3
    },
    {
      "id": 181,
      "name": "Tính hoàn thiện",
      "type": "SINGLE_CHOICE",
      "sequence": "1",
      "answer": "Dự án có thông tin giới thiệu cơ bản",
      "point": 3
    },
    {
      "id": 133,
      "name": "Sáng tạo (Creativity)",
      "type": "SINGLE_CHOICE",
      "sequence": "1",
      "answer": "Bạn hoàn thiện nhiệm vụ theo mẫu của giáo viên",
      "point": 3
    },
    {
      "id": 179,
      "name": "Thiết kế",
      "type": "SINGLE_CHOICE",
      "sequence": "1",
      "answer": "Dự án dựa trên thiết kế có sẵn",
      "point": 3
    },
    {
      "id": 180,
      "name": "Kiến thức",
      "type": "SINGLE_CHOICE",
      "sequence": "1",
      "answer": "Đã sử dụng tất cả các kiến thức bắt buộc. Các tính năng hoạt động bình thường",
      "point": 3
    },
    {
      "id": 125,
      "name": "Thái độ giao tiếp trong lớp học",
      "type": "SINGLE_CHOICE",
      "sequence": "1",
      "answer": "Bạn trao đổi, giao tiếp rất chủ động với thầy cô và bạn bè",
      "point": 3
    }
  ]
};

export const EVAL_PAYLOAD_HIGH = {
  "id": 11,
  "name": "TEKY - Đánh giá cuối buổi",
  "evaluated_criterias": [
    {
      "id": 123,
      "name": "Mức độ tập trung trong giờ học",
      "type": "SINGLE_CHOICE",
      "sequence": "1",
      "answer": "Bạn rất tập trung, thể hiện qua sự tương tác với toàn bộ nội dung bài học",
      "point": 4
    },
    {
      "id": 178,
      "name": "Ý tưởng dự án/sản phẩm",
      "type": "SINGLE_CHOICE",
      "sequence": "1",
      "answer": "Dự án có sự mở rộng về chủ đề/vấn đề của bài học",
      "point": 4
    },
    {
      "id": 130,
      "name": "Tư duy phản biện (Critical Thinking)",
      "type": "SINGLE_CHOICE",
      "sequence": "1",
      "answer": "Bạn tích cực lắng nghe và đặt câu hỏi, trao đổi xây dựng bài học",
      "point": 4
    },
    {
      "id": 131,
      "name": "Hợp tác nhóm (Collaboration)",
      "type": "SINGLE_CHOICE",
      "sequence": "1",
      "answer": "Bạn nỗ lực hoàn thành nhiệm vụ được giao, hướng tới đạt mục tiêu của nhóm",
      "point": 4
    },
    {
      "id": 132,
      "name": "Chia sẻ ý tưởng (Communication)",
      "type": "SINGLE_CHOICE",
      "sequence": "1",
      "answer": "Trình bày thuyết phục và xử lý tình huống tốt",
      "point": 4
    },
    {
      "id": 124,
      "name": "Mức độ tương tác trong giờ học",
      "type": "SINGLE_CHOICE",
      "sequence": "1",
      "answer": "Bạn tích cực tham gia các hoạt động trong lớp, đôi lúc còn đề xuất các hoạt động trò chơi cho cả lớp",
      "point": 4
    },
    {
      "id": 126,
      "name": "Đi muộn/trễ",
      "type": "SINGLE_CHOICE",
      "sequence": "1",
      "answer": "Bạn đi học đúng giờ",
      "point": 0
    },
    {
      "id": 127,
      "name": "Bài tập về nhà",
      "type": "SINGLE_CHOICE",
      "sequence": "1",
      "answer": "Bạn đã thực hiện đầy đủ các bài tập, độ chính xác từ 80% đến 90%",
      "point": 4
    },
    {
      "id": 128,
      "name": "Kiến thức cũ",
      "type": "SINGLE_CHOICE",
      "sequence": "1",
      "answer": "Bạn nhớ rõ kiến thức cũ và biết cách áp dụng và kết hợp kiến thức mới để giải quyết thử thách được đặt ra",
      "point": 4
    },
    {
      "id": 129,
      "name": "Kiến thức mới",
      "type": "SINGLE_CHOICE",
      "sequence": "1",
      "answer": "Bạn tiếp thu kiến thức tốt. Hoàn thành 100% các nhiệm vụ bài học",
      "point": 4
    },
    {
      "id": 181,
      "name": "Tính hoàn thiện",
      "type": "SINGLE_CHOICE",
      "sequence": "1",
      "answer": "Dự án có thông tin giới thiệu cơ bản: Tên sản phẩm, người thực hiện",
      "point": 4
    },
    {
      "id": 133,
      "name": "Sáng tạo (Creativity)",
      "type": "SINGLE_CHOICE",
      "sequence": "1",
      "answer": "Bạn tự tin phát triển ý tưởng cá nhân, dám thử nghiệm, thực hiện các phương án khác nhau để giải quyết vấn đề",
      "point": 4
    },
    {
      "id": 179,
      "name": "Thiết kế",
      "type": "SINGLE_CHOICE",
      "sequence": "1",
      "answer": "Dự án được thiết kế theo hướng cá nhân hóa. Các tài nguyên được sử dụng nhất quán, hài hòa",
      "point": 4
    },
    {
      "id": 180,
      "name": "Kiến thức",
      "type": "SINGLE_CHOICE",
      "sequence": "1",
      "answer": "Dự án sử dụng các kiến thức nâng cao",
      "point": 4
    },
    {
      "id": 125,
      "name": "Thái độ giao tiếp trong lớp học",
      "type": "SINGLE_CHOICE",
      "sequence": "1",
      "answer": "Bạn đã tự tin trong giao tiếp và tương tác với thầy cô, bạn bè",
      "point": 4
    }
  ]
};
