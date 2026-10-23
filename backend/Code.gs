/**
 * MÁY CHỦ CHO "ĐẤU TRƯỜNG TỪ VỰNG TOEIC" – chạy trên Google Apps Script, lưu dữ liệu vào Google Sheet.
 *
 * Cách cài (chi tiết trong HUONG-DAN.md):
 *  1. Tạo một Google Sheet mới → Tiện ích mở rộng → Apps Script.
 *  2. Xóa hết mã có sẵn, dán toàn bộ file này vào, bấm Lưu.
 *  3. Chọn hàm "caiDat" ở thanh trên, bấm Chạy (lần đầu Google hỏi quyền → cho phép).
 *  4. Triển khai → Tùy chọn triển khai mới → Loại: Ứng dụng web
 *     - Thực thi dưới dạng: Tôi
 *     - Người có quyền truy cập: Bất kỳ ai
 *  5. Sao chép "URL ứng dụng web" (kết thúc bằng /exec) → dán vào API_URL trong js/config.js.
 *
 * Các tab trong Sheet:
 *  HocVien  – danh sách học sinh, tổng điểm, chuỗi ngày, mức thuộc từng bài
 *  DiemNgay – điểm theo từng ngày (dùng cho bảng xếp hạng Hôm nay / Tuần này)
 *  NhatKy   – từng lượt chơi
 *  TuSai    – các từ / câu học sinh hay sai, theo lớp
 *  KhoaBai  – bài bị khóa của từng lớp
 *  CaiDat   – mật khẩu giáo viên, số từ mới mỗi ngày
 */

var TZ = 'Asia/Ho_Chi_Minh';
var SH = { HV: 'HocVien', DN: 'DiemNgay', NK: 'NhatKy', TS: 'TuSai', KB: 'KhoaBai', CD: 'CaiDat' };
var HEAD = {
  HocVien: ['id', 'Họ tên', 'Lớp', 'Nhân vật', 'Tổng điểm', 'Chuỗi ngày', 'Chuỗi dài nhất', 'Ngày học cuối', 'Hoạt động gần nhất', 'Ngày tham gia', 'Mức thuộc từng bài', 'Tiến độ 1', 'Tiến độ 2', 'Tiến độ 3', 'Tiến độ 4', 'Tiến độ 5'],
  DiemNgay: ['Ngày', 'id', 'Họ tên', 'Lớp', 'Điểm', 'Câu đúng', 'Tổng câu', 'Số lượt'],
  NhatKy: ['Thời gian', 'Ngày', 'id', 'Họ tên', 'Lớp', 'Chế độ', 'Bài', 'Điểm', 'Đúng', 'Tổng'],
  TuSai: ['Lớp', 'Mục', 'Số lần sai', 'Lần sai gần nhất'],
  KhoaBai: ['Lớp', 'Bài bị khóa (ví dụ: L10,L11,L12)'],
  CaiDat: ['Khóa', 'Giá trị', 'Ghi chú']
};
var DEFAULT_SETTINGS = [
  ['mat_khau_giao_vien', 'giaovien123', 'Mật khẩu vào Trang giáo viên trên web. Hãy đổi ngay!'],
  ['tu_moi_moi_ngay', 8, 'Số từ mới trong Nhiệm vụ hôm nay']
];
var CHUNK = 45000; // giới hạn 50.000 ký tự mỗi ô

/* ================= điểm vào ================= */
function doGet(e) {
  return out({ ok: true, msg: 'Máy chủ Đấu trường từ vựng đang chạy. Dán đường link này vào API_URL trong js/config.js.' });
}

function doPost(e) {
  var req;
  try { req = JSON.parse(e.postData.contents); } catch (err) { return out({ ok: false, error: 'Dữ liệu gửi lên không hợp lệ' }); }
  try {
    ensureSheets_();
    switch (req.action) {
      case 'config': return out(actConfig_(req));
      case 'join': return out(withLock_(function () { return actJoin_(req); }));
      case 'sync': return out(withLock_(function () { return actSync_(req); }));
      case 'board': return out(actBoard_(req));
      case 'teacher': return out(actTeacher_(req));
      case 'setLocks': return out(withLock_(function () { return actSetLocks_(req); }));
      default: return out({ ok: false, error: 'Không rõ yêu cầu: ' + req.action });
    }
  } catch (err) {
    return out({ ok: false, error: String(err && err.message || err) });
  }
}

/** Chạy hàm này 1 lần sau khi dán mã để tạo các tab. */
function caiDat() {
  ensureSheets_();
  SpreadsheetApp.getActiveSpreadsheet().toast('Đã tạo xong các tab. Giờ hãy Triển khai thành Ứng dụng web.', 'Đấu trường từ vựng', 8);
}

/* ================= các yêu cầu ================= */
function actConfig_(req) {
  var st = settings_();
  return { ok: true, locks: locksOf_(String(req.cls || '').toUpperCase()), newPerDay: Number(st.tu_moi_moi_ngay) || 8 };
}

function actJoin_(req) {
  var name = cleanText_(req.name, 40), cls = cleanText_(req.cls, 20).toUpperCase().replace(/\s+/g, ''), avatar = cleanText_(req.avatar, 8) || '🙂';
  if (name.length < 2 || !cls) throw new Error('Thiếu họ tên hoặc mã lớp');
  var hv = table_(SH.HV), key = keyOf_(name, cls), now = new Date();
  var idx = -1;
  for (var i = 0; i < hv.rows.length; i++) { if (keyOf_(hv.rows[i][1], hv.rows[i][2]) === key) { idx = i; break; } }
  if (idx >= 0) {
    var r = hv.rows[idx];
    var same = req.id && String(req.id) === String(r[0]);
    if (!same && !req.confirm) return { ok: true, exists: true, student: studentOut_(r) };
    hv.sheet.getRange(idx + 2, 9).setValue(now);
    return { ok: true, exists: true, student: studentOut_(r), progress: readProgress_(r) };
  }
  var id = /^[a-z0-9]{6,40}$/i.test(String(req.id || '')) && !hv.rows.some(function (x) { return String(x[0]) === String(req.id); }) ? String(req.id) : newId_();
  var row = [id, name, cls, avatar, 0, 0, 0, '', now, now, '{}', '', '', '', '', ''];
  hv.sheet.appendRow(row);
  return { ok: true, exists: false, student: studentOut_(row), progress: null };
}

function actSync_(req) {
  var s = req.student || {}; var sessions = req.sessions || [];
  if (!s.id) throw new Error('Thiếu mã học sinh');
  var hv = table_(SH.HV), idx = -1;
  for (var i = 0; i < hv.rows.length; i++) { if (String(hv.rows[i][0]) === String(s.id)) { idx = i; break; } }
  var name = cleanText_(s.name, 40), cls = cleanText_(s.cls, 20).toUpperCase(), now = new Date();
  var prog = JSON.stringify(s.progress || {});
  var chunks = []; for (var k = 0; k < 5; k++) chunks.push(prog.slice(k * CHUNK, (k + 1) * CHUNK));
  var lastDay = s.lastDay != null && s.lastDay !== '' ? dayStrFromNum_(Number(s.lastDay)) : '';
  var row;
  if (idx >= 0) {
    var old = hv.rows[idx];
    var pts = Math.max(Number(old[4]) || 0, Number(s.points) || 0);
    row = [old[0], name || old[1], cls || old[2], cleanText_(s.avatar, 8) || old[3], pts, Number(s.streak) || 0, Math.max(Number(old[6]) || 0, Number(s.best) || 0), lastDay || old[7], now, old[9], JSON.stringify(s.mastery || {})].concat(chunks);
    hv.sheet.getRange(idx + 2, 1, 1, row.length).setValues([row]);
  } else {
    row = [String(s.id), name, cls, cleanText_(s.avatar, 8) || '🙂', Number(s.points) || 0, Number(s.streak) || 0, Number(s.best) || 0, lastDay, now, now, JSON.stringify(s.mastery || {})].concat(chunks);
    hv.sheet.appendRow(row);
  }
  if (sessions.length) {
    // điểm theo ngày
    var dn = table_(SH.DN), map = {};
    dn.rows.forEach(function (r, i) { map[ds_(r[0]) + '|' + r[1]] = i; });
    var logRows = [], mist = {};
    sessions.forEach(function (x) {
      var d = /^\d{4}-\d{2}-\d{2}$/.test(String(x.date)) ? String(x.date) : today_();
      var k = d + '|' + s.id;
      if (map[k] == null) { dn.rows.push([d, String(s.id), name, cls, 0, 0, 0, 0]); map[k] = dn.rows.length - 1; dn.added = (dn.added || 0) + 1; }
      var r = dn.rows[map[k]];
      r[2] = name; r[3] = cls; r[4] = (Number(r[4]) || 0) + (Number(x.pts) || 0); r[5] = (Number(r[5]) || 0) + (Number(x.correct) || 0); r[6] = (Number(r[6]) || 0) + (Number(x.total) || 0); r[7] = (Number(r[7]) || 0) + 1;
      dn.dirty = true;
      logRows.push([new Date(Number(x.at) || Date.now()), d, String(s.id), name, cls, cleanText_(x.mode, 20), cleanText_(x.L, 6), Number(x.pts) || 0, Number(x.correct) || 0, Number(x.total) || 0]);
      (x.wrong || []).slice(0, 60).forEach(function (w) { w = cleanText_(w, 40); if (w) mist[w] = (mist[w] || 0) + 1; });
    });
    if (dn.dirty) {
      dn.sheet.getRange(2, 1, dn.rows.length, 8).setValues(dn.rows.map(function (r) { return [String(ds_(r[0])), r[1], r[2], r[3], r[4], r[5], r[6], r[7]]; }));
    }
    var nk = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SH.NK);
    nk.getRange(nk.getLastRow() + 1, 1, logRows.length, logRows[0].length).setValues(logRows);
    // từ hay sai
    var items = Object.keys(mist);
    if (items.length) {
      var ts = table_(SH.TS), tmap = {};
      ts.rows.forEach(function (r, i) { tmap[r[0] + '|' + r[1]] = i; });
      items.forEach(function (it) {
        var kk = cls + '|' + it;
        if (tmap[kk] == null) { ts.rows.push([cls, it, 0, '']); tmap[kk] = ts.rows.length - 1; }
        var r = ts.rows[tmap[kk]]; r[2] = (Number(r[2]) || 0) + mist[it]; r[3] = today_();
      });
      ts.sheet.getRange(2, 1, ts.rows.length, 4).setValues(ts.rows.map(function (r) { return [r[0], r[1], r[2], String(ds_(r[3]))]; }));
    }
  }
  clearBoardCache_(cls);
  return { ok: true };
}

function actBoard_(req) {
  var cls = String(req.cls || '').toUpperCase(), period = ['day', 'week', 'all'].indexOf(req.period) >= 0 ? req.period : 'day';
  var cache = CacheService.getScriptCache(), ck = 'board_' + period + '_' + (cls || '*');
  var hit = cache.get(ck); if (hit) return JSON.parse(hit);
  var hv = table_(SH.HV), today = today_(), yest = addDays_(today, -1), ws = weekStart_(today);
  var studs = {};
  hv.rows.forEach(function (r) {
    if (!r[0]) return;
    if (cls && String(r[2]).toUpperCase() !== cls) return;
    var last = ds_(r[7]);
    studs[r[0]] = { id: String(r[0]), name: r[1], cls: r[2], avatar: r[3], streak: (last === today || last === yest) ? Number(r[5]) || 0 : 0, pts: period === 'all' ? Number(r[4]) || 0 : 0 };
  });
  if (period !== 'all') {
    table_(SH.DN).rows.forEach(function (r) {
      var d = ds_(r[0]); var st = studs[r[1]]; if (!st) return;
      if ((period === 'day' && d === today) || (period === 'week' && d >= ws && d <= today)) st.pts += Number(r[4]) || 0;
    });
  }
  var rows = Object.keys(studs).map(function (k) { return studs[k]; }).sort(function (a, b) { return b.pts - a.pts; }).slice(0, 150);
  var res = { ok: true, rows: rows, today: today };
  try { cache.put(ck, JSON.stringify(res), 45); } catch (e) {}
  return res;
}

function actTeacher_(req) {
  checkPw_(req.password);
  var hv = table_(SH.HV), today = today_(), yest = addDays_(today, -1), ws = weekStart_(today);
  var studs = {}, list = [];
  hv.rows.forEach(function (r) {
    if (!r[0]) return;
    var last = ds_(r[7]); var m = {}; try { m = JSON.parse(r[10] || '{}'); } catch (e) {}
    var s = { id: String(r[0]), name: r[1], cls: String(r[2]), avatar: r[3], points: Number(r[4]) || 0, streak: (last === today || last === yest) ? Number(r[5]) || 0 : 0, best: Number(r[6]) || 0, lastActive: last, today: 0, week: 0, mastery: m };
    studs[s.id] = s; list.push(s);
  });
  table_(SH.DN).rows.forEach(function (r) {
    var d = ds_(r[0]); var s = studs[r[1]]; if (!s) return;
    if (d === today) s.today += Number(r[4]) || 0;
    if (d >= ws && d <= today) s.week += Number(r[4]) || 0;
  });
  var mistakes = table_(SH.TS).rows.map(function (r) { return { cls: String(r[0]), item: String(r[1]), n: Number(r[2]) || 0 }; });
  var locks = {};
  table_(SH.KB).rows.forEach(function (r) { if (r[0]) locks[String(r[0]).toUpperCase()] = parseLocks_(r[1]); });
  return { ok: true, today: today, students: list, mistakes: mistakes, locks: locks };
}

function actSetLocks_(req) {
  checkPw_(req.password);
  var cls = cleanText_(req.cls, 20).toUpperCase(); if (!cls) throw new Error('Thiếu mã lớp');
  var val = Object.keys(req.locks || {}).filter(function (k) { return req.locks[k] && /^L\d{1,2}$/.test(k); }).join(',');
  var kb = table_(SH.KB), idx = -1;
  kb.rows.forEach(function (r, i) { if (String(r[0]).toUpperCase() === cls) idx = i; });
  if (idx >= 0) kb.sheet.getRange(idx + 2, 2).setValue(val); else kb.sheet.appendRow([cls, val]);
  return { ok: true };
}

/* ================= tiện ích ================= */
function out(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
function withLock_(fn) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) throw new Error('Máy chủ đang bận, thử lại sau ít giây');
  try { return fn(); } finally { lock.releaseLock(); }
}
function ensureSheets_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var FMT = { DiemNgay: 'A:A', TuSai: 'D:D', NhatKy: 'B:B', HocVien: 'H:H', KhoaBai: 'B:B' }; // giữ ngày ở dạng chữ
  Object.keys(HEAD).forEach(function (name) {
    var sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    if (sh.getLastRow() === 0) {
      sh.appendRow(HEAD[name]); sh.setFrozenRows(1); sh.getRange(1, 1, 1, HEAD[name].length).setFontWeight('bold');
      if (FMT[name]) sh.getRange(FMT[name]).setNumberFormat('@');
      if (name === SH.CD) DEFAULT_SETTINGS.forEach(function (r) { sh.appendRow(r); });
    }
  });
  var s1 = ss.getSheetByName('Sheet1') || ss.getSheetByName('Trang tính1');
  if (s1 && s1.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(s1);
}
function table_(name) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  var n = sh.getLastRow() - 1, w = HEAD[name].length;
  var rows = n > 0 ? sh.getRange(2, 1, n, w).getValues() : [];
  return { sheet: sh, rows: rows };
}
function settings_() {
  var o = {}; table_(SH.CD).rows.forEach(function (r) { if (r[0]) o[String(r[0]).trim()] = r[1]; }); return o;
}
function checkPw_(pw) {
  var real = String(settings_().mat_khau_giao_vien || '');
  if (!real || String(pw || '') !== real) throw new Error('Sai mật khẩu giáo viên');
}
function locksOf_(cls) {
  var res = {};
  table_(SH.KB).rows.forEach(function (r) { if (String(r[0]).toUpperCase() === cls) res = parseLocks_(r[1]); });
  return res;
}
function parseLocks_(v) { var o = {}; String(v || '').split(/[,\s;]+/).forEach(function (x) { x = x.trim().toUpperCase(); if (/^L\d{1,2}$/.test(x)) o[x] = true; }); return o; }
function readProgress_(r) {
  var s = [r[11], r[12], r[13], r[14], r[15]].map(function (x) { return x || ''; }).join('');
  if (!s) return null; try { return JSON.parse(s); } catch (e) { return null; }
}
function studentOut_(r) { return { id: String(r[0]), name: r[1], cls: r[2], avatar: r[3], points: Number(r[4]) || 0 }; }
function cleanText_(v, max) { return String(v == null ? '' : v).replace(/[\r\n\t]+/g, ' ').replace(/^[=+\-@]+/, '').trim().slice(0, max || 60); }
function keyOf_(name, cls) { return noAccent_(String(name)).toLowerCase().replace(/\s+/g, ' ').trim() + '|' + String(cls).toUpperCase().replace(/\s+/g, ''); }
function noAccent_(s) { return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D'); }
function newId_() { return 'u' + Utilities.getUuid().replace(/-/g, '').slice(0, 16); }
function today_() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd'); }
function ds_(v) { if (v instanceof Date) return Utilities.formatDate(v, TZ, 'yyyy-MM-dd'); return String(v || ''); }
function addDays_(d, n) { var t = new Date(d + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); }
function weekStart_(d) { var t = new Date(d + 'T00:00:00Z'); var dow = (t.getUTCDay() + 6) % 7; return addDays_(d, -dow); }
function dayStrFromNum_(n) { return new Date(n * 86400000).toISOString().slice(0, 10); }
function clearBoardCache_(cls) {
  var c = CacheService.getScriptCache(), keys = [];
  ['day', 'week', 'all'].forEach(function (p) { keys.push('board_' + p + '_*'); if (cls) keys.push('board_' + p + '_' + cls); });
  c.removeAll(keys);
}
