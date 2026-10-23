/*
  CẤU HÌNH – giáo viên chỉ cần sửa file này.
  Sau khi cài Google Sheets (xem HUONG-DAN.md), dán đường link Web App vào API_URL.
  Để trống API_URL thì web vẫn chạy, nhưng điểm và bảng xếp hạng chỉ lưu trên từng máy.
*/
window.APP_CONFIG = {
  // Link Web App của Google Apps Script, dạng https://script.google.com/macros/s/..../exec
  API_URL: '',

  // Tên hiển thị trên đầu trang
  APP_NAME: 'Đấu trường từ vựng TOEIC',

  // Gợi ý mã lớp khi học sinh vào lớp (học sinh vẫn có thể tự gõ mã khác). Ví dụ: ['F44', 'F49', 'F51']
  CLASSES: [],

  // Số từ mới mỗi ngày trong "Nhiệm vụ hôm nay" (Google Sheets có thể ghi đè trong tab CaiDat)
  NEW_PER_DAY: 8,

  // Mật khẩu trang giáo viên KHI CHƯA nối Google Sheets (chỉ xem được dữ liệu trên máy này).
  // Khi đã nối Google Sheets, mật khẩu thật nằm trong tab CaiDat của Sheet.
  LOCAL_TEACHER_PASSWORD: 'giaovien'
};
