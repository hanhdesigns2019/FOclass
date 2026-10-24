/* ===== Màn hình: vào lớp, trang chủ, bài học, xếp hạng, hồ sơ, sổ từ khó, giáo viên ===== */
(function () {
  'use strict';
  const { CFG, U, DB, P, SRS, Score, TTS, SFX, API, levelOf, BADGES } = window.TV;
  const TVG = window.TVG;
  const esc = U.esc;
  const AVATARS = ['🦊', '🐼', '🐯', '🦁', '🐸', '🐵', '🐧', '🦄', '🐲', '🤖', '👾', '🐱', '🐶', '🐨', '🦉', '🐙', '🦖', '🐝', '🦋', '🐳', '🦈', '🐺', '🐮', '🐰'];
  const UI = { cfg: { locks: {}, newPerDay: CFG.NEW_PER_DAY || 8 }, boardCache: {} };
  const app = () => U.$('#app');

  /* ---------- khung chung ---------- */
  function nav(active) {
    return `<nav class="tabbar" aria-label="Điều hướng chính">
      <a href="#/" class="${active === 'home' ? 'on' : ''}"><span aria-hidden="true">🏠</span>Học</a>
      <a href="#/board" class="${active === 'board' ? 'on' : ''}"><span aria-hidden="true">🏆</span>Xếp hạng</a>
      <a href="#/words" class="${active === 'words' ? 'on' : ''}"><span aria-hidden="true">📕</span>Từ khó</a>
      <a href="#/me" class="${active === 'me' ? 'on' : ''}"><span aria-hidden="true">${P.cur ? P.cur.avatar : '👤'}</span>Tôi</a></nav>`;
  }
  function page(active, inner) { app().innerHTML = `<div class="page">${inner}</div>${nav(active)}`; window.scrollTo(0, 0); }
  function toast(msg) { let t = U.$('#toast'); if (!t) { t = document.createElement('div'); t.id = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); } t.textContent = msg; t.className = 'show'; clearTimeout(t._h); t._h = setTimeout(() => t.className = '', 2600); }

  /* ---------- vào lớp ---------- */
  function joinScreen(prefill) {
    const pf = prefill || {}; const av = pf.avatar || U.pick(AVATARS);
    const classes = (CFG.CLASSES || []);
    const locals = P.all();
    app().innerHTML = `<div class="page join">
      <div class="join-hero"><p class="join-kicker">${esc(CFG.APP_NAME || 'Đấu trường từ vựng TOEIC')}</p><h1>Tạo nhân vật để vào lớp</h1><p class="muted">Học từ trong câu, nghe như đề thật, thi đua cùng cả lớp mỗi ngày.</p></div>
      <form id="joinform" class="card form" autocomplete="off">
        <label for="jname">Họ tên của bạn</label>
        <input id="jname" name="name" required maxlength="40" placeholder="Ví dụ: Nguyễn Minh Anh" value="${esc(pf.name || '')}">
        <label for="jcls">Mã lớp</label>
        <input id="jcls" name="cls" required maxlength="20" list="clslist" placeholder="Ví dụ: F44" value="${esc(pf.cls || '')}">
        <datalist id="clslist">${classes.map(c => `<option value="${esc(c)}">`).join('')}</datalist>
        <fieldset class="avatars"><legend>Chọn nhân vật</legend>${AVATARS.map(a => `<label class="av"><input type="radio" name="avatar" value="${a}" ${a === av ? 'checked' : ''}><span>${a}</span></label>`).join('')}</fieldset>
        <p class="form-err" id="jerr" role="alert"></p>
        <button class="btn primary wide big" type="submit">Vào lớp</button>
      </form>
      ${locals.length ? `<div class="card"><h2 class="h3">Người chơi trên máy này</h2>${locals.map(p => `<button class="who-row" data-use="${p.id}"><span class="avc">${p.avatar}</span><span><b>${esc(p.name)}</b><small>Lớp ${esc(p.cls)} · ${U.fmt(p.points)} điểm</small></span></button>`).join('')}</div>` : ''}
      <p class="center muted small"><a href="#/teacher">Trang giáo viên</a></p></div>`;
    U.$('#joinform').addEventListener('submit', async e => {
      e.preventDefault();
      const f = e.target; const name = U.cleanName(f.name.value); const cls = U.cleanName(f.cls.value).toUpperCase().replace(/\s+/g, ''); const avatar = (f.querySelector('input[name=avatar]:checked') || {}).value || '🦊';
      const err = U.$('#jerr');
      if (name.length < 2) { err.textContent = 'Nhập họ tên (ít nhất 2 ký tự).'; return; }
      if (!cls) { err.textContent = 'Nhập mã lớp giáo viên đã cho.'; return; }
      const btn = f.querySelector('button[type=submit]'); btn.disabled = true; btn.textContent = 'Đang vào lớp…';
      try { await doJoin(name, cls, avatar, pf.confirmed); }
      catch (ex) { err.textContent = ex.message || 'Không vào được lớp, thử lại.'; btn.disabled = false; btn.textContent = 'Vào lớp'; }
    });
    U.$$('[data-use]').forEach(b => b.addEventListener('click', () => { P.use(P.all().find(p => p.id === b.dataset.use)); location.hash = '#/'; route(); }));
  }
  const keyOf = (name, cls) => U.noAccent(name).toLowerCase().replace(/\s+/g, ' ') + '|' + cls.toUpperCase();
  async function doJoin(name, cls, avatar, confirmed) {
    const local = P.all().find(p => keyOf(p.name, p.cls) === keyOf(name, cls));
    if (!API.online) {
      const p = local || P.newProfile(name, cls, avatar); if (!local) p.avatar = avatar; P.use(p); welcome(p); return;
    }
    let j;
    try { j = await API.call('join', { name, cls, avatar, id: local ? local.id : '', confirm: !!confirmed }); }
    catch (e) {
      // mất mạng: vẫn cho học, đồng bộ sau
      const p = local || P.newProfile(name, cls, avatar); P.use(p); welcome(p); toast('Chưa kết nối được máy chủ, điểm sẽ gửi lên sau.'); return;
    }
    if (j.exists && !confirmed && !(local && local.id === j.student.id)) { confirmSame(name, cls, avatar, j.student); return; }
    const st = j.student;
    let p = local && local.id === st.id ? local : P.newProfile(st.name, st.cls, st.avatar || avatar, st.id);
    mergeServer(p, j.progress, st);
    P.use(p); API.flush(p); welcome(p);
  }
  function mergeServer(p, prog, st) {
    if (!prog) return;
    if ((prog.points || 0) > (p.points || 0)) {
      ['srs', 'stats', 'badges', 'daily', 'focus', 'mission', 'wrongLog', 'streak', 'best', 'lastDay', 'points'].forEach(k => { if (prog[k] != null) p[k] = prog[k]; });
    }
    if (st && st.avatar) p.avatar = st.avatar;
  }
  function confirmSame(name, cls, avatar, s) {
    app().innerHTML = `<div class="page join"><div class="card confirm"><p class="big-emo">${esc(s.avatar || '🙂')}</p><h1 class="h2">Lớp ${esc(cls)} đã có bạn “${esc(s.name)}”</h1><p>Bạn ấy có ${U.fmt(s.points)} điểm. Đây có phải là bạn (đang đăng nhập trên máy khác) không?</p>
      <button class="btn primary wide" id="yesme">Đúng, đó là mình</button><button class="btn ghost wide" id="notme">Không, mình là người khác</button></div></div>`;
    U.$('#yesme').onclick = async () => { U.$('#yesme').disabled = true; try { await doJoin(name, cls, avatar, true); } catch (e) { toast(e.message); } };
    U.$('#notme').onclick = () => { joinScreen({ name: name + ' ', cls, avatar }); U.$('#jerr').textContent = 'Thêm họ hoặc tên đệm để khác bạn kia, ví dụ “' + name + ' Trần”.'; U.$('#jname').focus(); };
  }
  function welcome(p) { location.hash = '#/'; route(); toast(`Chào ${p.name}! Cùng học nào ${p.avatar}`); }

  /* ---------- trang chủ ---------- */
  async function loadCfg() { const p = P.cur; if (!p) return; const c = await API.config(p.cls); UI.cfg = Object.assign({ locks: {}, newPerDay: CFG.NEW_PER_DAY || 8 }, c); }
  function missionInfo(p) {
    const t = U.dayNum(); const locks = UI.cfg.locks || {};
    const due = DB.cards.filter(c => !locks[c.L] && p.srs[c.id] && p.srs[c.id][1] <= t).length;
    const done = p.mission && p.mission.day === U.dayStr() && p.mission.done;
    return { due, done, fresh: UI.cfg.newPerDay || 8 };
  }
  function home() {
    const p = P.cur; const lv = levelOf(p.points); const streak = Score.liveStreak(p); const mi = missionInfo(p);
    const focusL = DB.lessonById[p.focus] || DB.lessonById.L4;
    const lessonTiles = DB.lessons.map(l => {
      const locked = !!(UI.cfg.locks || {})[l.id]; const m = SRS.mastery(p, l.id);
      return `<a class="ltile ${locked ? 'locked' : ''} k-${l.kind}" href="${locked ? '#/' : '#/L/' + l.id}" ${locked ? 'aria-disabled="true"' : ''}>
        <span class="lno">${l.no}</span><span class="lic" aria-hidden="true">${l.icon}</span><span class="lsub">${esc(l.sub)}</span><span class="ltt">${esc(l.title)}</span>
        <span class="lbar" aria-label="Đã thuộc ${m}%"><i style="width:${m}%"></i></span><span class="lpct">${locked ? '🔒 Chưa mở' : m + '%'}</span></a>`;
    }).join('');
    page('home', `
      <header class="hero">
        <div class="me-row"><span class="avc big" aria-hidden="true">${p.avatar}</span><div class="me-txt"><h1>${esc(p.name)}</h1><p>Lớp ${esc(p.cls)} · ${lv.icon} ${lv.name}</p></div><div class="streak ${streak ? 'on' : ''}" title="Chuỗi ngày học"><span aria-hidden="true">🔥</span><b>${streak}</b><small>ngày</small></div></div>
        <div class="xp"><div class="xpbar"><i style="width:${lv.pct}%"></i></div><p><b>${U.fmt(p.points)}</b> điểm${lv.next ? ` · còn ${U.fmt(lv.next.min - p.points)} điểm để lên ${lv.next.icon} ${lv.next.name}` : ' · cấp cao nhất'}</p></div>
      </header>
      <section class="mission ${mi.done ? 'done' : ''}">
        <div class="mission-txt"><h2>${mi.done ? 'Đã xong nhiệm vụ hôm nay' : 'Nhiệm vụ hôm nay'}</h2>
          <p>${mi.done ? 'Giỏi lắm! Muốn thêm điểm thì ôn tiếp hoặc chơi boss.' : `${mi.due} từ đến hạn ôn · ${mi.fresh} từ mới`}</p>
          <p class="focus">Bài đang học: <b>Lesson ${focusL.no}</b> – ${esc(focusL.title)} <a href="#/focus">Đổi</a></p></div>
        <a class="btn ${mi.done ? 'ghost' : 'primary'} big" href="#/mission">${mi.done ? 'Ôn thêm' : 'Bắt đầu'}</a>
      </section>
      <section class="quick">
        <a class="qa" href="#/play/boss/ALL"><span aria-hidden="true">👾</span><b>Đánh boss tổng hợp</b><small>Trộn từ và đề mọi bài</small></a>
        <a class="qa" href="#/L/${(UI.cfg.locks || {}).L12 ? focusL.id : 'L12'}"><span aria-hidden="true">📝</span><b>Luyện đề</b><small>Part 1 + Part 2 trong sách</small></a>
      </section>
      <h2 class="sec">Bài học</h2>
      <section class="lgrid">${lessonTiles}</section>
      <section class="card mini-board"><div class="mb-head"><h2 class="h3">Top hôm nay · Lớp ${esc(p.cls)}</h2><a href="#/board">Xem bảng</a></div><div id="miniboard"><p class="muted">Đang tải…</p></div></section>
      ${p.pending.length && API.online ? `<p class="center muted small">Còn ${p.pending.length} lượt chơi chưa gửi lên máy chủ – sẽ tự gửi khi có mạng.</p>` : ''}
    `);
    API.board(p.cls, 'day').then(r => {
      const el = U.$('#miniboard'); if (!el) return;
      const rows = r.rows.filter(x => x.pts > 0).slice(0, 5); const myRank = r.rows.findIndex(x => x.id === p.id) + 1;
      el.innerHTML = rows.length ? `<ol class="board sm">${rows.map((x, i) => boardRow(x, i, p.id)).join('')}</ol>${myRank > 5 ? `<p class="muted small">Bạn đang hạng ${myRank}.</p>` : ''}` : '<p class="muted">Chưa ai có điểm hôm nay. Ghi điểm đầu tiên nào!</p>';
    });
  }
  function focusScreen() {
    const p = P.cur;
    page('home', `<header class="sub-head"><a class="back" href="#/" aria-label="Quay lại">←</a><h1>Chọn bài đang học</h1></header>
      <p class="muted">Từ mới trong Nhiệm vụ hôm nay sẽ lấy từ bài này trước.</p>
      <div class="list">${DB.lessons.filter(l => DB.cardsByL[l.id].length && !(UI.cfg.locks || {})[l.id]).map(l => `<button class="who-row ${p.focus === l.id ? 'on' : ''}" data-focus="${l.id}"><span class="avc">${l.icon}</span><span><b>Lesson ${l.no} – ${esc(l.title)}</b><small>${esc(l.sub)} · ${DB.cardsByL[l.id].length} từ · đã thuộc ${SRS.mastery(p, l.id)}%</small></span></button>`).join('')}</div>`);
    U.$$('[data-focus]').forEach(b => b.onclick = () => { p.focus = b.dataset.focus; P.saveNow(); location.hash = '#/'; route(); });
  }

  /* ---------- trang bài học ---------- */
  const MODES = {
    ph: [['flash', '📇', 'Thẻ từ', 'Nghe, xem phiên âm, lật thẻ'], ['listen', '🎧', 'Nghe & chọn', 'Nghe từ, đoán âm'], ['meaning', '🎯', 'Đoán nghĩa', 'Chọn nghĩa đúng'], ['match', '🔗', 'Nối nhanh', 'Nối từ với nghĩa, tính giờ'], ['write', '✍️', 'Nghe viết', 'Nghe và gõ lại từ'], ['mix', '🔀', 'Trộn tất cả', 'Đảo đủ các dạng'], ['boss', '👾', 'Đánh boss', '3 tim, hạ gục boss']],
    p1: [['flash', '📇', 'Thẻ từ', 'Ảnh, phiên âm, câu mẫu'], ['meaning', '🎯', 'Đoán nghĩa trong câu', 'Từ tô vàng nghĩa là gì?'], ['match', '🔗', 'Nối nhanh', 'Nối từ với nghĩa, tính giờ'], ['listen', '🎧', 'Nghe & chọn', 'Nghe từ, chọn đúng chữ'], ['write', '✍️', 'Điền từ', 'Gõ từ còn thiếu trong câu'], ['order', '🧩', 'Xếp câu', 'Ghép mảnh thành câu'], ['mini', '📷', 'Part 1 mini', 'Nhìn tranh, nghe 4 câu'], ['mix', '🔀', 'Trộn tất cả', 'Đảo đủ các dạng'], ['boss', '👾', 'Đánh boss', '3 tim, hạ gục boss']],
    p2: [['flash', '📇', 'Thẻ từ', 'Nghĩa và hội thoại mẫu'], ['meaning', '🎯', 'Đoán nghĩa trong câu', 'Phần tô vàng nghĩa là gì?'], ['match', '🔗', 'Nối nhanh', 'Nối nhanh, tính giờ'], ['listen', '🎧', 'Nghe & chọn', 'Nghe, chọn đúng chữ'], ['write', '✍️', 'Điền từ', 'Gõ phần còn thiếu'], ['order', '🧩', 'Xếp câu', 'Ghép mảnh thành câu'], ['mini', '🗣️', 'Part 2 mini', 'Nghe hỏi, chọn câu đáp'], ['mix', '🔀', 'Trộn tất cả', 'Đảo đủ các dạng'], ['boss', '👾', 'Đánh boss', '3 tim, hạ gục boss']],
    rv: [['mix', '🔀', 'Luyện ngẫu nhiên', 'Câu Part 1 + Part 2'], ['boss', '👾', 'Đánh boss', 'Đề trộn, 3 tim']],
    de: [['flash', '📇', 'Thẻ từ', 'Nghĩa, phiên âm, câu trong đề'], ['meaning', '🎯', 'Đoán nghĩa trong câu', 'Mỗi lần một câu đề khác'], ['wsent', '💡', 'Hiểu cả câu', 'Biết nghĩa từ, chọn nghĩa cả câu'], ['match', '🔗', 'Nối nhanh', 'Nối từ với nghĩa, tính giờ'], ['listen', '🎧', 'Nghe & chọn', 'Nghe từ, chọn đúng chữ'], ['write', '✍️', 'Điền từ', 'Gõ từ còn thiếu trong câu đề'], ['order', '🧩', 'Xếp câu', 'Ghép lại câu trong đề'], ['mini', '📝', 'Câu đề có từ này', 'Làm câu Part 1/Part 2 thật'], ['mix', '🔀', 'Trộn tất cả', 'Đảo đủ các dạng'], ['boss', '👾', 'Đánh boss', '3 tim, hạ gục boss']]
  };
  const modeGrid = (list, L, deck) => `<div class="modes">${list.map(([id, ic, name, desc]) => `<a class="mode m-${id}" href="#/play/${id}/${L}${deck ? '/' + deck : ''}"><span class="mic" aria-hidden="true">${ic}</span><b>${name}</b><small>${desc}</small></a>`).join('')}</div>`;
  function lessonScreen(L) {
    const p = P.cur; const l = DB.lessonById[L]; if (!l) { location.hash = '#/'; return route(); }
    if ((UI.cfg.locks || {})[L]) { toast('Bài này giáo viên chưa mở.'); location.hash = '#/'; return route(); }
    UI.lastLesson = L;
    if (DB.cardsByL[L].length && p.focus !== L) { p.focus = L; P.save(); }
    const m = SRS.mastery(p, L); const cards = DB.deck(L, 'lb'); const deCards = DB.deck(L, 'de');
    const sets = DB.setsByL[L];
    const examSets = sets.filter(s => s.part === 2 || s.photo);
    const sentCount = DB.sentsByL[L].length;
    const allSets = L === 'L12' ? DB.sets.filter(s => s.part === 2 || s.photo) : examSets;
    page('home', `<header class="sub-head"><a class="back" href="#/" aria-label="Quay lại">←</a><div><p class="kick">Lesson ${l.no} · ${esc(l.sub)}</p><h1>${esc(l.title)}</h1></div></header>
      <div class="mastery"><div class="lbar big"><i style="width:${m}%"></i></div><p>Đã thuộc <b>${m}%</b>${cards.length ? ` · ${cards.length} ${l.kind === 'ph' ? 'từ luyện âm' : 'mục Language Building'}` : ''}</p></div>
      ${l.tip ? `<details class="tip"><summary>Kiến thức cần nhớ</summary><p>${esc(l.tip)}</p></details>` : ''}
      <h2 class="sec">${l.kind === 'rv' ? 'Luyện tổng hợp' : l.kind === 'ph' ? 'Trò chơi' : 'Trò chơi · Language Building'}</h2>
      ${modeGrid(MODES[l.kind], L)}
      ${deCards.length ? `<h2 class="sec">Trò chơi · Từ vựng trong đề <span class="chip">${deCards.length} từ</span></h2><p class="muted small sec-note">Từ lấy từ câu Part ${l.kind === 'p1' ? '1' : l.kind === 'rv' ? '1 + 2' : '2'} và BTVN của bài này. Mỗi lượt chơi đổi sang câu đề khác để các em vừa nhớ từ, vừa hiểu câu.</p>${modeGrid(MODES.de, L, 'de')}` : ''}
      ${allSets.length ? `<h2 class="sec">Luyện đề trong sách</h2><div class="sets">${allSets.map(s => { const done = s.items.filter(it => SRS.box(p, DB.itemKey(s.id, it.n)) > 0).length; return `<a class="setrow" href="#/exam/${s.id}"><span class="setp p${s.part}">Part ${s.part}</span><span class="sett"><b>${esc(s.title)}</b><small>${s.items.length} câu${s.L !== L ? ' · Lesson ' + s.L.slice(1) : ''} · đã làm ${done}</small></span><span aria-hidden="true">›</span></a>`; }).join('')}</div>` : ''}
      ${sentCount ? `<h2 class="sec">Học câu</h2><a class="setrow wide" href="#/play/sent/${L}"><span class="setp s">💬</span><span class="sett"><b>Dịch câu trong đề</b><small>${sentCount} câu của Lesson ${l.no} · nghe, hiểu nghĩa, xếp câu</small></span><span aria-hidden="true">›</span></a>` : ''}
      ${cards.length ? `<h2 class="sec">Danh sách ${l.kind === 'ph' ? '' : 'Language Building '}(${cards.length})</h2><div class="wlist">${cards.map(c => wordRow(c, p)).join('')}</div>` : ''}
      ${deCards.length ? `<details class="wdetails"><summary class="sec">Danh sách từ vựng trong đề (${deCards.length})</summary><div class="wlist">${deCards.map(c => wordRow(c, p)).join('')}</div></details>` : ''}
    `);
  }
  function wordRow(c, p) {
    const b = SRS.box(p, c.id);
    return `<div class="wrow">${TVG.spk(TVG.speakText(c))}<div class="wtx"><b>${esc(c.en)}</b>${c.ipa ? ` <span class="ipa">${esc(c.ipa)}</span>` : ''}<p>${esc(c.vi)}${c.snd ? ` <span class="chip">${esc(c.snd)}</span>` : ''}</p></div><span class="dots" title="Mức nhớ ${b}/5">${'●'.repeat(b)}${'○'.repeat(5 - b)}</span></div>`;
  }

  /* ---------- chạy trò chơi ---------- */
  function startPlay(mode, L, deck) {
    const p = P.cur; const back = L === 'ALL' ? '#/' : '#/L/' + L;
    if (mode === 'flash') { if (!DB.deck(L, deck).length) { location.hash = back; return route(); } return TVG.flash({ L, back, deck }); }
    if (mode === 'match') { if (DB.deck(L, deck).length < 3) { toast('Bài này chưa có từ để nối.'); location.hash = back; return route(); } return TVG.match({ L, back, deck }); }
    let qs, title;
    if (mode === 'boss') { qs = TVG.buildBoss(p, L === 'ALL' ? null : L, UI.cfg.locks, deck); title = 'Đánh boss'; }
    else { qs = TVG.buildLessonSession(p, L, mode, mode === 'sent' ? 12 : 10, deck); }
    if (!qs.length) { toast('Chưa có câu hỏi cho phần này.'); location.hash = back; return route(); }
    TVG.run({ qs, mode, L: L === 'ALL' ? '' : L, deck, boss: mode === 'boss', back, title });
  }
  function startMission() {
    const p = P.cur;
    const m = TVG.buildMission(p, UI.cfg.locks || {}, UI.cfg.newPerDay || 8);
    if (!m.qs.length) { const qs = TVG.buildBoss(p, null, UI.cfg.locks); return TVG.run({ qs, mode: 'mission', mission: true, back: '#/' }); }
    TVG.run({ qs: m.qs, mode: 'mission', mission: true, back: '#/' });
  }
  function replay(o) {
    if (o.mode === 'match') { TVG.Run.cur = null; return TVG.match({ L: o.L, back: o.back, deck: o.deck }); }
    if (o.mode === 'test' && o.setId) return TVG.exam(DB.setById[o.setId], o.back);
    if (o.mission) return startMission();
    startPlay(o.mode, o.L || 'ALL', o.deck);
  }

  /* ---------- bảng xếp hạng ---------- */
  function boardRow(x, i, me) {
    const medal = (x.pts > 0 && ['🥇', '🥈', '🥉'][i]) || `<span class="rk">${i + 1}</span>`;
    return `<li class="${x.id === me ? 'me' : ''}"><span class="medal">${medal}</span><span class="avc">${esc(x.avatar || '🙂')}</span><span class="bn"><b>${esc(x.name)}</b><small>${x.cls ? 'Lớp ' + esc(x.cls) : ''}${x.streak ? ` · 🔥${x.streak}` : ''}</small></span><b class="bp">${U.fmt(x.pts)}</b></li>`;
  }
  async function boardScreen() {
    const p = P.cur; UI.bp = UI.bp || 'day'; UI.bs = UI.bs || 'class';
    const periods = [['day', 'Hôm nay'], ['week', 'Tuần này'], ['all', 'Tổng']];
    page('board', `<header class="sub-head"><h1>Bảng xếp hạng</h1></header>
      <div class="seg" role="tablist">${periods.map(([k, n]) => `<button role="tab" aria-selected="${UI.bp === k}" data-bp="${k}">${n}</button>`).join('')}</div>
      <div class="seg sm" role="tablist"><button role="tab" aria-selected="${UI.bs === 'class'}" data-bs="class">Lớp ${esc(p.cls)}</button><button role="tab" aria-selected="${UI.bs === 'all'}" data-bs="all">Tất cả các lớp</button></div>
      <div id="board"><p class="muted">Đang tải…</p></div>`);
    U.$$('[data-bp]').forEach(b => b.onclick = () => { UI.bp = b.dataset.bp; boardScreen(); });
    U.$$('[data-bs]').forEach(b => b.onclick = () => { UI.bs = b.dataset.bs; boardScreen(); });
    const r = await API.board(UI.bs === 'class' ? p.cls : '', UI.bp);
    const el = U.$('#board'); if (!el) return;
    const rows = r.rows.slice(0, 100);
    el.innerHTML = (rows.length ? `<ol class="board">${rows.map((x, i) => boardRow(x, i, p.id)).join('')}</ol>` : '<p class="muted center">Chưa có ai ghi điểm trong mục này.</p>')
      + (r.online ? '' : `<p class="muted small center">${API.online ? 'Không kết nối được máy chủ, đang hiện người chơi trên máy này.' : 'Đang chạy chế độ một máy: chỉ hiện người chơi trên máy này. Giáo viên nối Google Sheets để cả lớp đua top chung.'}</p>`);
  }

  /* ---------- hồ sơ & cài đặt ---------- */
  function meScreen() {
    const p = P.cur; const lv = levelOf(p.points); const s = P.settings;
    const acc = p.stats.answered ? Math.round(p.stats.correct / p.stats.answered * 100) : 0;
    const voices = TTS.voices;
    const vopt = sel => `<option value="">Tự động</option>` + voices.map(v => `<option value="${esc(v.name)}" ${sel === v.name ? 'selected' : ''}>${esc(v.name)} (${esc(v.lang)})</option>`).join('');
    page('me', `<header class="sub-head"><h1>Nhân vật của bạn</h1></header>
      <div class="card profile"><span class="avc huge">${p.avatar}</span><div><h2 class="h2">${esc(p.name)}</h2><p>Lớp ${esc(p.cls)} · ${lv.icon} ${lv.name}</p><p class="muted small">${U.fmt(p.points)} điểm · chuỗi dài nhất ${p.best} ngày</p></div></div>
      <div class="stats4"><div><b>${U.fmt(Score.today(p))}</b><span>điểm hôm nay</span></div><div><b>${U.fmt(Score.week(p))}</b><span>điểm tuần này</span></div><div><b>${SRS.masteredCount(p)}</b><span>mục đã thuộc</span></div><div><b>${acc}%</b><span>trả lời đúng</span></div></div>
      <h2 class="sec">Huy hiệu (${Object.keys(p.badges).length}/${BADGES.length})</h2>
      <div class="badges">${BADGES.map(b => `<div class="badge ${p.badges[b.id] ? 'got' : ''}"><span>${b.icon}</span><div><b>${esc(b.name)}</b><p>${esc(b.desc)}</p></div></div>`).join('')}</div>
      <h2 class="sec">Đổi nhân vật</h2>
      <div class="avatars inline">${AVATARS.map(a => `<button class="av ${a === p.avatar ? 'on' : ''}" data-av="${a}" aria-label="Chọn ${a}"><span>${a}</span></button>`).join('')}</div>
      <h2 class="sec">Cài đặt</h2>
      <div class="card form settings">
        ${TTS.ok ? `<label for="rate">Tốc độ đọc</label><select id="rate"><option value="0.7" ${s.rate == 0.7 ? 'selected' : ''}>Chậm</option><option value="0.85" ${s.rate == 0.85 ? 'selected' : ''}>Hơi chậm</option><option value="0.95" ${s.rate == 0.95 ? 'selected' : ''}>Bình thường</option><option value="1.1" ${s.rate == 1.1 ? 'selected' : ''}>Nhanh như đề thi</option></select>
        <label for="va">Giọng đọc chính</label><select id="va">${vopt(s.voiceA)}</select>
        <label for="vb">Giọng đọc thứ hai (câu trả lời Part 2)</label><select id="vb">${vopt(s.voiceB)}</select>
        <button class="btn ghost" id="testv" type="button">🔊 Nghe thử</button>` : `<p class="warn">Trình duyệt này không có giọng đọc tiếng Anh. Hãy mở bằng Chrome hoặc Safari bản mới.</p>`}
        ${TTS.ok && !voices.length ? '<p class="warn small">Chưa tìm thấy giọng tiếng Anh trên máy. Trên Android: Cài đặt › Quản lý chung › Chuyển văn bản thành giọng nói › cài tiếng Anh.</p>' : ''}
        <label class="sw"><input type="checkbox" id="sfx" ${s.sfx ? 'checked' : ''}> Âm thanh hiệu ứng khi đúng / sai</label>
        <label class="sw"><input type="checkbox" id="showtext" ${s.showText ? 'checked' : ''}> Hiện chữ các đáp án Part 1, Part 2 trước khi chọn (dễ hơn)</label>
      </div>
      <div class="card"><p class="small muted">${API.online ? (p.pending.length ? `Còn ${p.pending.length} lượt chưa gửi lên máy chủ.` : 'Đã đồng bộ với lớp.') : 'Chế độ một máy (giáo viên chưa nối Google Sheets).'}</p>
        <button class="btn ghost wide" id="switch">Đổi người chơi / Vào lớp khác</button></div>
      <p class="center small"><a href="#/teacher">Trang giáo viên</a></p>`);
    U.$$('[data-av]').forEach(b => b.onclick = () => { p.avatar = b.dataset.av; P.saveNow(); API.flush(p); meScreen(); });
    const on = (id, ev, fn) => { const el = U.$('#' + id); el && el.addEventListener(ev, fn); };
    on('rate', 'change', e => { s.rate = +e.target.value; P.saveNow(); TTS.speak('This is the listening speed.'); });
    on('va', 'change', e => { s.voiceA = e.target.value; P.saveNow(); TTS.speak('Hello, I will read the questions.', 'A'); });
    on('vb', 'change', e => { s.voiceB = e.target.value; P.saveNow(); TTS.speak('And I will read the answers.', 'B'); });
    on('testv', 'click', () => TTS.play([{ t: 'Where is the supply room?', v: 'A' }, { t: 'It is on the second floor.', v: 'B' }]));
    on('sfx', 'change', e => { s.sfx = e.target.checked; P.saveNow(); SFX.ok(); });
    on('showtext', 'change', e => { s.showText = e.target.checked; P.saveNow(); });
    on('switch', 'click', () => { P.logout(); location.hash = '#/join'; route(); });
  }

  /* ---------- sổ từ khó ---------- */
  function wordsScreen() {
    const p = P.cur;
    const list = Object.entries(p.wrongLog || {}).filter(([id]) => DB.cardById[id] || id.startsWith('S:') || DB.findItem(id)).sort((a, b) => b[1] - a[1]).slice(0, 60);
    page('words', `<header class="sub-head"><h1>Sổ từ khó</h1></header>
      <p class="muted">Mục nào bạn trả lời sai sẽ được ghi vào đây. Luyện cho đến khi thuộc.</p>
      ${list.length ? `<a class="btn primary wide big" href="#/hard">Luyện sổ từ khó (${Math.min(list.length, 12)} câu)</a><div class="wlist">${list.map(([id, n]) => { const d = DB.describe(id); return `<div class="wrow">${TVG.spk(d.en)}<div class="wtx"><b>${esc(d.en)}</b><p>${esc(d.vi)}</p></div><span class="cnt" title="Số lần sai">✗${n}</span></div>`; }).join('')}</div>` : '<div class="card empty"><p class="big-emo">📕</p><p>Sổ đang trống. Chơi vài lượt, mục nào sai sẽ xuất hiện ở đây để bạn luyện lại.</p><a class="btn primary" href="#/">Đi học thôi</a></div>'}`);
  }
  function startHard() {
    const p = P.cur; const G = TVG.G;
    const ids = Object.entries(p.wrongLog || {}).sort((a, b) => b[1] - a[1]).slice(0, 30).map(x => x[0]);
    const qs = U.shuffle(ids).slice(0, 12).map(id => {
      if (DB.cardById[id]) { const c = DB.cardById[id]; return U.pick([G.meaning, G.en2vi, G.listen, G.cloze])(c); }
      if (id.startsWith('S:')) { const sid = +id.slice(2); const L = DB.lessons.find(l => DB.sentsByL[l.id].includes(sid)); return G.sentVi(sid, L ? DB.sentsByL[L.id] : DB.sentsByL.L6); }
      const f = DB.findItem(id); return f ? G.testItem(f.set, f.item) : null;
    }).filter(Boolean);
    if (!qs.length) { location.hash = '#/words'; return route(); }
    TVG.run({ qs, mode: 'hard', back: '#/words' });
  }

  /* ---------- trang giáo viên ---------- */
  async function teacherScreen() {
    const pw = sessionStorage.getItem('tv_tpw');
    if (!pw) return teacherLogin();
    app().innerHTML = `<div class="page wide"><p class="muted">Đang tải dữ liệu lớp…</p></div>`;
    let data;
    try {
      if (API.online) data = await API.call('teacher', { password: pw }, 25000);
      else { if (pw !== (CFG.LOCAL_TEACHER_PASSWORD || 'giaovien')) throw new Error('Sai mật khẩu'); data = localTeacherData(); }
    } catch (e) { sessionStorage.removeItem('tv_tpw'); return teacherLogin(e.message); }
    renderTeacher(data);
  }
  function teacherLogin(err) {
    app().innerHTML = `<div class="page join"><header class="sub-head"><a class="back" href="#/" aria-label="Quay lại">←</a><h1>Trang giáo viên</h1></header>
      <form class="card form" id="tform"><label for="tpw">Mật khẩu giáo viên</label><input id="tpw" type="password" required autocomplete="current-password">
      <p class="form-err" role="alert">${esc(err || '')}</p><button class="btn primary wide" type="submit">Xem lớp</button>
      <p class="muted small">${API.online ? 'Mật khẩu nằm trong tab CaiDat của Google Sheet.' : 'Chưa nối Google Sheets: chỉ xem được người chơi trên máy này. Mật khẩu mặc định là “giaovien” (đổi trong js/config.js).'}</p></form></div>`;
    U.$('#tform').onsubmit = e => { e.preventDefault(); sessionStorage.setItem('tv_tpw', U.$('#tpw').value); teacherScreen(); };
  }
  function localTeacherData() {
    const today = U.dayStr();
    const students = P.all().map(p => { const mastery = {}; DB.lessons.forEach(l => mastery[l.id] = SRS.mastery(p, l.id)); return { id: p.id, name: p.name, cls: p.cls, avatar: p.avatar, points: p.points, today: Score.today(p), week: Score.week(p), streak: Score.liveStreak(p), lastActive: p.lastDay != null ? U.dayStr(p.lastDay) : '', mastery }; });
    const mist = {}; P.all().forEach(p => Object.entries(p.wrongLog || {}).forEach(([id, n]) => { const k = p.cls + '|' + id; mist[k] = (mist[k] || 0) + n; }));
    const mistakes = Object.entries(mist).map(([k, n]) => { const [cls, item] = k.split(/\|(.+)/); return { cls, item, n }; });
    return { today, students, mistakes, locks: U.store.get('tv_local_locks', {}), local: true };
  }
  function renderTeacher(data) {
    UI.tdata = data; const classes = [...new Set(data.students.map(s => s.cls))].sort();
    UI.tcls = UI.tcls && (classes.includes(UI.tcls) || UI.tcls === '*') ? UI.tcls : (classes[0] || '*');
    const cls = UI.tcls; const studs = data.students.filter(s => cls === '*' || s.cls === cls).sort((a, b) => b.week - a.week || b.points - a.points);
    const todayStr = data.today || U.dayStr();
    const active = studs.filter(s => s.today > 0);
    const idle = studs.filter(s => !(s.today > 0));
    const mist = {}; data.mistakes.filter(m => cls === '*' || m.cls === cls).forEach(m => { mist[m.item] = (mist[m.item] || 0) + m.n; });
    const hard = Object.entries(mist).sort((a, b) => b[1] - a[1]).slice(0, 15);
    const locks = (data.locks || {})[cls] || {};
    const lessonCols = DB.lessons.filter(l => l.kind !== 'ph');
    app().innerHTML = `<div class="page wide teacher">
      <header class="sub-head"><a class="back" href="#/" aria-label="Về trang học sinh">←</a><div><p class="kick">Trang giáo viên${data.local ? ' · dữ liệu trên máy này' : ''}</p><h1>Theo dõi lớp</h1></div><button class="btn ghost sm" id="tlogout">Thoát</button></header>
      <div class="seg wrap">${classes.map(c => `<button aria-selected="${c === cls}" data-tc="${esc(c)}">Lớp ${esc(c)}</button>`).join('')}<button aria-selected="${cls === '*'}" data-tc="*">Tất cả</button></div>
      <div class="stats4"><div><b>${studs.length}</b><span>học sinh</span></div><div><b>${active.length}/${studs.length}</b><span>đã học hôm nay</span></div><div><b>${studs.length ? U.fmt(Math.round(studs.reduce((a, s) => a + s.week, 0) / studs.length)) : 0}</b><span>điểm TB tuần này</span></div><div><b>${studs.filter(s => s.streak >= 3).length}</b><span>giữ chuỗi ≥ 3 ngày</span></div></div>
      ${idle.length ? `<div class="card warnbox"><h2 class="h3">Chưa học hôm nay (${idle.length})</h2><p>${idle.map(s => `${esc(s.avatar || '')} ${esc(s.name)}${s.lastActive ? ` <span class="muted small">(lần cuối ${esc(s.lastActive)})</span>` : ''}`).join(', ')}</p></div>` : `<div class="card okbox"><p>Cả lớp đã học hôm nay 🎉</p></div>`}
      <h2 class="sec">Học sinh</h2>
      <div class="tablewrap"><table class="ttable"><thead><tr><th>Học sinh</th><th>Hôm nay</th><th>Tuần</th><th>Tổng</th><th>Chuỗi</th>${lessonCols.map(l => `<th title="${esc(l.title)}">L${l.no}</th>`).join('')}</tr></thead>
      <tbody>${studs.map(s => `<tr class="${s.today > 0 ? '' : 'idle'}"><td><span class="avc sm">${esc(s.avatar || '')}</span> ${esc(s.name)}${cls === '*' ? ` <small class="muted">${esc(s.cls)}</small>` : ''}</td><td>${U.fmt(s.today)}</td><td>${U.fmt(s.week)}</td><td>${U.fmt(s.points)}</td><td>${s.streak ? '🔥' + s.streak : '–'}</td>${lessonCols.map(l => { const v = (s.mastery || {})[l.id] || 0; return `<td><span class="heat" style="--v:${v}">${v}</span></td>`; }).join('')}</tr>`).join('')}</tbody></table></div>
      <button class="btn ghost" id="csv">Tải bảng điểm (CSV)</button>
      <h2 class="sec">Từ / câu cả lớp hay sai</h2>
      ${hard.length ? `<ol class="hardlist">${hard.map(([id, n]) => { const d = DB.describe(id); return `<li><b>${esc(d.en)}</b> <span class="muted">${esc(d.vi)}</span>${d.L ? ` <span class="chip">Lesson ${esc(d.L.slice(1))}</span>` : ''} <span class="cnt">✗${n}</span></li>`; }).join('')}</ol>` : '<p class="muted">Chưa có dữ liệu.</p>'}
      ${cls !== '*' ? `<h2 class="sec">Mở / khóa bài cho lớp ${esc(cls)}</h2><p class="muted small">Bài bị khóa sẽ không hiện cho học sinh lớp này và không có trong nhiệm vụ hằng ngày.</p>
      <div class="locks">${DB.lessons.map(l => `<label class="sw lockrow"><input type="checkbox" data-lock="${l.id}" ${locks[l.id] ? '' : 'checked'}> Lesson ${l.no} – ${esc(l.title)}</label>`).join('')}</div>
      <button class="btn primary" id="savelocks">Lưu</button>` : ''}
    </div>`;
    U.$$('[data-tc]').forEach(b => b.onclick = () => { UI.tcls = b.dataset.tc; renderTeacher(UI.tdata); });
    U.$('#tlogout').onclick = () => { sessionStorage.removeItem('tv_tpw'); location.hash = '#/'; route(); };
    U.$('#csv').onclick = () => {
      const head = ['Họ tên', 'Lớp', 'Điểm hôm nay', 'Điểm tuần', 'Tổng điểm', 'Chuỗi ngày', 'Lần học cuối'].concat(lessonCols.map(l => 'L' + l.no + ' (%)'));
      const rows = studs.map(s => [s.name, s.cls, s.today, s.week, s.points, s.streak, s.lastActive || ''].concat(lessonCols.map(l => (s.mastery || {})[l.id] || 0)));
      const csv = '﻿' + [head].concat(rows).map(r => r.map(x => '"' + String(x).replace(/"/g, '""') + '"').join(',')).join('\n');
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = `bang-diem-${cls === '*' ? 'tat-ca' : cls}-${todayStr}.csv`; a.click();
    };
    const sl = U.$('#savelocks');
    sl && (sl.onclick = async () => {
      const nl = {}; U.$$('[data-lock]').forEach(i => { if (!i.checked) nl[i.dataset.lock] = true; });
      sl.disabled = true; sl.textContent = 'Đang lưu…';
      try {
        if (data.local) { const all = U.store.get('tv_local_locks', {}); all[cls] = nl; U.store.set('tv_local_locks', all); data.locks = all; }
        else { await API.call('setLocks', { password: sessionStorage.getItem('tv_tpw'), cls, locks: nl }); data.locks = Object.assign({}, data.locks, { [cls]: nl }); }
        toast('Đã lưu. Học sinh sẽ thấy thay đổi khi mở lại web.');
      } catch (e) { toast('Không lưu được: ' + e.message); }
      sl.disabled = false; sl.textContent = 'Lưu';
    });
  }

  /* ---------- pháo giấy ---------- */
  function confetti() {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const c = document.createElement('canvas'); c.className = 'confetti'; document.body.appendChild(c);
    const ctx = c.getContext('2d'); const W = c.width = innerWidth, H = c.height = innerHeight;
    const cols = ['#2F4BFF', '#FFD23F', '#12A150', '#FF7A1A', '#E5383B', '#7B61FF'];
    const ps = Array.from({ length: 120 }, () => ({ x: W / 2 + (Math.random() - .5) * 80, y: H * 0.35, vx: (Math.random() - .5) * 12, vy: -Math.random() * 12 - 4, r: Math.random() * 6 + 4, c: U.pick(cols), a: Math.random() * 6, va: (Math.random() - .5) * .3 }));
    let f = 0; (function tick() { ctx.clearRect(0, 0, W, H); ps.forEach(p => { p.vy += .35; p.x += p.vx; p.y += p.vy; p.a += p.va; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.fillStyle = p.c; ctx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2); ctx.restore(); }); if (++f < 140) requestAnimationFrame(tick); else c.remove(); })();
  }

  /* ---------- điều hướng ---------- */
  async function route() {
    const h = location.hash || '#/';
    TTS.stop(); U.$$('.confetti').forEach(c => c.remove());
    if (h !== '#/teacher' && !P.cur) { if (h !== '#/join') location.hash = '#/join'; return joinScreen(); }
    if (!/^#\/(play|exam|mission|hard)/.test(h)) { TVG.abandon(); TVG.Run.cur = null; TVG.Run.match = null; TVG.Run.flash = null; document.body.classList.remove('in-game'); }
    let m;
    if (h === '#/join') return P.cur ? (location.hash = '#/', route()) : joinScreen();
    if (h === '#/teacher') return teacherScreen();
    if (!UI.cfgLoaded) { UI.cfgLoaded = true; loadCfg().then(() => { if ((location.hash || '#/') === '#/') home(); }); }
    if (h === '#/' || h === '#') return home();
    if (h === '#/focus') return focusScreen();
    if ((m = /^#\/L\/(L\d+)$/.exec(h))) return lessonScreen(m[1]);
    if ((m = /^#\/play\/(\w+)\/(L\d+|ALL)(?:\/(de))?$/.exec(h))) return startPlay(m[1], m[2], m[3]);
    if ((m = /^#\/exam\/(.+)$/.exec(h))) { const s = DB.setById[decodeURIComponent(m[1])]; if (s) return TVG.exam(s, '#/L/' + (UI.lastLesson || s.L)); }
    if (h === '#/mission') return startMission();
    if (h === '#/board') return boardScreen();
    if (h === '#/me') return meScreen();
    if (h === '#/words') return wordsScreen();
    if (h === '#/hard') return startHard();
    location.hash = '#/'; home();
  }
  window.addEventListener('hashchange', route);
  // nút loa dùng chung ngoài trò chơi
  document.addEventListener('click', e => {
    if (TVG.Run.cur || TVG.Run.flash) return; const b = e.target.closest('[data-say]'); if (!b) return; e.preventDefault(); TTS.unlock(); TTS.speak(b.dataset.say, b.dataset.slot);
  });
  window.TVUI = { route, replay, confetti, toast, refreshBadge() {} };
  document.addEventListener('DOMContentLoaded', () => { route(); const p = P.cur; if (p) API.flush(p); });
})();
