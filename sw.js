/* Lưu tạm để web mở được cả khi mạng yếu. Mã nguồn luôn lấy bản mới nhất khi có mạng. */
const CACHE = 'tv-v1';
self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // Google Sheets, font: để trình duyệt tự xử lý
  if (/\/(anh-tu|anh-de|icons)\//.test(url.pathname)) {
    // ảnh: lấy trong bộ nhớ trước
    e.respondWith(caches.open(CACHE).then(c => c.match(req).then(hit => hit || fetch(req).then(r => { if (r.ok) c.put(req, r.clone()); return r; }))));
  } else {
    // trang & mã: lấy bản mới, mất mạng thì dùng bản đã lưu
    e.respondWith(fetch(req).then(r => { if (r.ok) { const cp = r.clone(); caches.open(CACHE).then(c => c.put(req, cp)); } return r; }).catch(() => caches.match(req).then(hit => hit || caches.match('./index.html'))));
  }
});
