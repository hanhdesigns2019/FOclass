# Đấu trường từ vựng TOEIC

Web học từ vựng và luyện nghe TOEIC Part 1, Part 2 cho lớp Foundation, soạn từ giáo trình *GT Foundation 2026*.
Hướng dẫn cài đặt từng bước: xem **[HUONG-DAN.md](HUONG-DAN.md)**.

## Nội dung

| Lesson | Nội dung | Có trong web |
|---|---|---|
| 1–3 | Ngữ âm | 365 từ luyện âm, có phiên âm, nghĩa, giọng đọc |
| 4–5 | Part 1 – Tả tranh chỉ người | 40 từ Language Building kèm ảnh, câu mẫu, bản dịch; 60 câu Part 1 có ảnh từ đề trong sách |
| 6–11 | Part 2 – Who, Where/When, What/Which, Why/How, nghi vấn, trần thuật | 140 mục Language Building kèm hội thoại mẫu; 340 câu Part 2 (Practice + BTVN) |
| 12 | Final Test – Tổng ôn | Đề BTVN 8, BTVN 12 và chế độ trộn |

Tổng cộng 1.747 câu trong đề được dịch sang tiếng Việt để luyện "Học câu".

## Trò chơi

Thẻ từ · Đoán nghĩa trong câu · Nối nhanh tính giờ · Nghe & chọn · Điền từ · Xếp câu · Part 1 mini · Part 2 mini · Đánh boss · Luyện đề trong sách · Học câu · Nhiệm vụ hôm nay (ôn ngắt quãng) · Sổ từ khó.

Điểm, combo, cấp độ, huy hiệu, chuỗi ngày học, bảng xếp hạng Hôm nay / Tuần này / Tổng theo lớp, trang giáo viên.

## Cấu trúc

```
index.html            trang chính
css/style.css         giao diện
js/config.js          cấu hình (link Google Sheets, mã lớp…) – giáo viên sửa file này
js/data.js            nội dung bài học (sinh tự động từ giáo trình)
js/core.js            lưu trữ, ôn tập ngắt quãng, điểm, giọng đọc, kết nối máy chủ
js/games.js           các trò chơi
js/screens.js         các màn hình
anh-tu/, anh-de/      ảnh Language Building và ảnh đề Part 1
backend/Code.gs       mã máy chủ dán vào Google Apps Script
```

Không cần cài đặt hay build: tải nguyên thư mục lên GitHub Pages là chạy.
