# Hướng dẫn cài đặt – Đấu trường từ vựng TOEIC

Web gồm 2 phần:

- **Trang web** (thư mục này) đặt miễn phí trên **GitHub Pages**. Chỉ cần làm Phần 1 + 2 là học sinh đã học được ngay.
- **Google Sheet** lưu điểm của cả lớp (Phần 3). Có Sheet thì bảng xếp hạng mới là của **cả lớp**, giáo viên mới xem được ai đã học, và học sinh đổi máy không mất điểm. Chưa làm Phần 3 thì điểm chỉ lưu trên từng máy.

Tổng thời gian khoảng 20–25 phút, chỉ làm một lần.

---

## Phần 1. Đưa web lên GitHub (khoảng 10 phút)

1. Vào https://github.com, tạo tài khoản (nếu chưa có) và đăng nhập.
2. Bấm dấu **+** góc trên bên phải → **New repository**.
   - **Repository name**: ví dụ `tu-vung-toeic` (không dấu, không cách).
   - Chọn **Public** (GitHub Pages miễn phí cần để Public).
   - Bấm **Create repository**.
3. Ở trang vừa tạo, bấm dòng chữ **uploading an existing file**.
4. **Lần tải thứ nhất:** giải nén file zip, mở thư mục `tu-vung-toeic`, chọn **tất cả** file và thư mục **trừ thư mục `anh-de`**, kéo thả vào trang GitHub. Chờ tải xong rồi bấm **Commit changes**.
5. **Lần tải thứ hai:** bấm **Add file → Upload files**, kéo thả **thư mục `anh-de`** vào, bấm **Commit changes**.

> Vì sao phải tải 2 lần? GitHub chỉ cho tải tối đa 100 file mỗi lần, web có khoảng 115 file.
> Nhớ kéo **những thứ bên trong** thư mục `tu-vung-toeic`, không kéo cả thư mục đó. Sau khi tải xong, trang GitHub phải thấy ngay `index.html` ở danh sách ngoài cùng.

## Phần 2. Bật GitHub Pages để có đường link (2 phút)

1. Trong repository, bấm **Settings** (thanh trên cùng) → menu trái chọn **Pages**.
2. Mục **Source** chọn **Deploy from a branch**. Mục **Branch** chọn `main` và `/ (root)` → **Save**.
3. Chờ 1–2 phút rồi tải lại trang. Đường link hiện ở đầu trang, dạng:
   `https://ten-tai-khoan.github.io/tu-vung-toeic/`

Mở link thử: nhập tên, mã lớp là học được ngay.

---

## Phần 3. Nối Google Sheets để cả lớp đua top chung (khoảng 10 phút)

### 3.1. Tạo Sheet và dán mã máy chủ

1. Vào https://sheets.google.com → tạo **Bảng tính trống**, đặt tên ví dụ `Điểm từ vựng TOEIC`.
2. Menu **Tiện ích mở rộng → Apps Script** (tiếng Anh: *Extensions → Apps Script*).
3. Xóa hết mã có sẵn trong ô soạn thảo. Mở file `backend/Code.gs` (trong thư mục web), sao chép **toàn bộ** và dán vào. Bấm biểu tượng **Lưu** (đĩa mềm).
4. Ở thanh trên cùng, ô chọn hàm chọn **caiDat** → bấm **Chạy** (*Run*).
   - Google sẽ hỏi quyền: bấm **Xem xét quyền** → chọn tài khoản của bạn → **Nâng cao** (*Advanced*) → **Đi tới … (không an toàn)** → **Cho phép**.
   - Đây là mã của chính bạn, chỉ đọc/ghi vào Sheet này.
5. Quay lại Sheet sẽ thấy 6 tab: `HocVien`, `DiemNgay`, `NhatKy`, `TuSai`, `KhoaBai`, `CaiDat`.

### 3.2. Đổi mật khẩu giáo viên

Mở tab **CaiDat**, ô bên cạnh `mat_khau_giao_vien` đang là `giaovien123` → đổi thành mật khẩu của bạn.
Cũng ở tab này, `tu_moi_moi_ngay` là số từ mới mỗi ngày trong Nhiệm vụ hôm nay (mặc định 8).

### 3.3. Triển khai thành ứng dụng web

1. Trong Apps Script, bấm **Triển khai → Tùy chọn triển khai mới** (*Deploy → New deployment*).
2. Bấm biểu tượng bánh răng cạnh "Chọn loại" → **Ứng dụng web** (*Web app*).
3. Điền:
   - **Thực thi dưới dạng** (*Execute as*): **Tôi** (*Me*)
   - **Người có quyền truy cập** (*Who has access*): **Bất kỳ ai** (*Anyone*)
4. Bấm **Triển khai**, sao chép **URL ứng dụng web** (kết thúc bằng `/exec`).
   Dán link này vào thanh địa chỉ trình duyệt để thử: thấy dòng "Máy chủ Đấu trường từ vựng đang chạy" là đúng.

### 3.4. Dán link vào web

1. Trên GitHub, mở file `js/config.js` → bấm biểu tượng **bút chì** (Edit).
2. Sửa dòng `API_URL: ''` thành `API_URL: 'link-vừa-sao-chép'` (giữ nguyên dấu nháy đơn).
   Có thể điền luôn danh sách mã lớp để học sinh chọn, ví dụ `CLASSES: ['F44', 'F49', 'F51']`.
3. Bấm **Commit changes**. Sau 1–2 phút web tự cập nhật.

Xong! Từ giờ điểm của cả lớp lưu về Sheet.

> **Nếu sau này sửa mã trong Apps Script**, phải vào **Triển khai → Quản lý các bản triển khai → Chỉnh sửa (bút chì) → Phiên bản: Phiên bản mới → Triển khai** thì thay đổi mới có hiệu lực. Link `/exec` giữ nguyên.

---

## Phần 4. Gửi cho học sinh

Gửi link GitHub Pages vào nhóm lớp kèm lời dặn:

1. Mở link, nhập **họ tên đầy đủ** và **mã lớp** (ví dụ F44), chọn nhân vật.
2. Mỗi ngày bấm **Nhiệm vụ hôm nay** – web tự chọn từ sắp quên để ôn và thêm từ mới.
3. Nên **thêm web ra màn hình chính** để mở như app:
   - iPhone (Safari): nút Chia sẻ → **Thêm vào MH chính**.
   - Android (Chrome): nút ⋮ → **Thêm vào màn hình chính**.
4. Đổi máy: nhập **đúng họ tên và mã lớp cũ**, bấm **"Đúng, đó là mình"** → điểm và tiến độ được lấy lại.

## Phần 5. Trang giáo viên

Mở link web và thêm `#/teacher` vào cuối, ví dụ `https://ten-tai-khoan.github.io/tu-vung-toeic/#/teacher`, nhập mật khẩu ở tab CaiDat.

- Ai đã học hôm nay, ai chưa học, chuỗi ngày học, điểm hôm nay / tuần / tổng.
- Mức thuộc (%) từng Lesson của từng học sinh.
- Từ và câu cả lớp hay sai nhất.
- **Mở / khóa bài** cho từng lớp theo tiến độ trên lớp. Bài bị khóa không hiện cho học sinh và không vào nhiệm vụ hằng ngày.
- Tải bảng điểm về Excel (CSV).

Muốn xem chi tiết hơn, mở thẳng Google Sheet: tab `NhatKy` ghi từng lượt chơi, tab `DiemNgay` ghi điểm từng ngày.

---

## Câu hỏi thường gặp

**Không nghe được tiếng đọc?**
Web dùng giọng đọc tiếng Anh có sẵn trong máy. Hãy dùng Chrome (Android, máy tính) hoặc Safari (iPhone) bản mới, tắt chế độ im lặng trên iPhone. Android: *Cài đặt → Quản lý chung → Chuyển văn bản thành giọng nói*, cài thêm giọng tiếng Anh. Trong mục **Tôi → Cài đặt** có thể chọn giọng và tốc độ đọc.

**Hai bạn trùng tên trong một lớp?**
Bạn vào sau sẽ được hỏi "Đây có phải là bạn không?" → chọn "Không, mình là người khác" và thêm họ hoặc tên đệm.

**Muốn xóa / sửa điểm một học sinh?**
Mở Sheet, tab `HocVien`, sửa hoặc xóa dòng của học sinh đó (tab `DiemNgay` là điểm theo ngày dùng cho bảng Hôm nay / Tuần này).

**Học sinh không có mạng thì sao?**
Vẫn học được (web đã mở trước đó), điểm được lưu trên máy và tự gửi lên khi có mạng.

**Muốn thêm hoặc sửa từ vựng?**
Nội dung nằm trong `js/data.js`. Gửi danh sách thay đổi cho người soạn web để cập nhật, rồi tải file `data.js` mới lên GitHub (Add file → Upload files, ghi đè file cũ).

**Đổi tên web?**
Sửa `APP_NAME` trong `js/config.js`.
