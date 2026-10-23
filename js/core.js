/* ===== Core: tiện ích, dữ liệu, lưu trữ, ôn tập ngắt quãng, điểm, giọng đọc, âm thanh, máy chủ ===== */
(function () {
  'use strict';
  const CFG = window.APP_CONFIG || {};
  const D = window.APP_DATA;

  /* ---------- tiện ích ---------- */
  const U = {
    $(sel, root) { return (root || document).querySelector(sel); },
    $$(sel, root) { return Array.from((root || document).querySelectorAll(sel)); },
    esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); },
    shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; },
    pick(a) { return a[Math.floor(Math.random() * a.length)]; },
    sample(a, n, exclude) { const ex = new Set(exclude || []); return U.shuffle(a.filter(x => !ex.has(x))).slice(0, n); },
    uid() { return 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); },
    noAccent(s) { return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D'); },
    norm(s) { return String(s).toLowerCase().replace(/[’‘`]/g, "'").replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim(); },
    cleanName(s) { return String(s || '').replace(/\s+/g, ' ').trim().slice(0, 40); },
    fmt(n) { return Number(n || 0).toLocaleString('vi-VN'); },
    // Ngày theo giờ Việt Nam
    dayNum(t) { return Math.floor(((t || Date.now()) + 7 * 3600e3) / 86400e3); },
    dayStr(n) { const d = new Date((n == null ? U.dayNum() : n) * 86400e3); return d.toISOString().slice(0, 10); },
    weekStart(n) { n = n == null ? U.dayNum() : n; const dow = (new Date(n * 86400e3).getUTCDay() + 6) % 7; return n - dow; },
    store: {
      get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
      set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
    },
    debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
  };

  /* ---------- chỉ mục dữ liệu ---------- */
  const DB = {
    lessons: D.lessons,
    lessonById: {}, cards: D.cards, cardById: {}, cardsByL: {}, sets: D.sets, setById: {}, setsByL: {},
    sents: D.sents,
    sentsByL: {}, // các câu (id) xuất hiện trong đề của Lesson
    sent(i) { return D.sents[i] || ['', '']; }
  };
  D.lessons.forEach(l => { DB.lessonById[l.id] = l; DB.cardsByL[l.id] = []; DB.setsByL[l.id] = []; DB.sentsByL[l.id] = []; });
  D.cards.forEach(c => { DB.cardById[c.id] = c; DB.cardsByL[c.L].push(c); });
  D.sets.forEach(s => {
    DB.setById[s.id] = s; DB.setsByL[s.L].push(s);
    const seen = new Set(DB.sentsByL[s.L]);
    s.items.forEach(it => { [it.q].concat(it.o).forEach(x => { if (x != null && !seen.has(x)) { seen.add(x); DB.sentsByL[s.L].push(x); } }); });
  });
  DB.itemKey = (setId, n) => 'T:' + setId + ':' + n;
  DB.findItem = key => { const m = /^T:(.+):(\d+)$/.exec(key); if (!m) return null; const s = DB.setById[m[1]]; return s ? { set: s, item: s.items.find(i => i.n == m[2]) } : null; };
  DB.describe = key => { // tên dễ đọc cho 1 mục (dùng ở trang giáo viên, sổ từ khó)
    if (DB.cardById[key]) { const c = DB.cardById[key]; return { en: c.en, vi: c.vi, L: c.L }; }
    if (key.startsWith('S:')) { const s = DB.sent(+key.slice(2)); return { en: s[0], vi: s[1], L: '' }; }
    const f = DB.findItem(key); if (f) { const it = f.item; const t = it.q != null ? DB.sent(it.q) : DB.sent(it.o[it.a]); return { en: t[0], vi: t[1], L: f.set.L, set: f.set.title }; }
    return { en: key, vi: '', L: '' };
  };

  /* ---------- cấp độ & huy hiệu ---------- */
  const LEVELS = [
    { min: 0, name: 'Tân binh', icon: '🥚' }, { min: 300, name: 'Học việc', icon: '🐣' }, { min: 900, name: 'Chiến binh', icon: '🗡️' },
    { min: 2000, name: 'Hiệp sĩ', icon: '🛡️' }, { min: 4000, name: 'Cao thủ', icon: '⚔️' }, { min: 7000, name: 'Đại cao thủ', icon: '🐉' },
    { min: 12000, name: 'Huyền thoại', icon: '👑' }
  ];
  function levelOf(points) {
    let i = 0; while (i + 1 < LEVELS.length && points >= LEVELS[i + 1].min) i++;
    const cur = LEVELS[i], next = LEVELS[i + 1];
    return { idx: i, ...cur, next, pct: next ? Math.min(100, Math.round((points - cur.min) / (next.min - cur.min) * 100)) : 100 };
  }
  const BADGES = [
    { id: 'first', icon: '🎒', name: 'Nhập môn', desc: 'Hoàn thành lượt chơi đầu tiên' },
    { id: 'mission', icon: '✅', name: 'Đúng hẹn', desc: 'Xong nhiệm vụ hôm nay lần đầu' },
    { id: 'streak3', icon: '🔥', name: 'Chăm chỉ 3 ngày', desc: 'Học 3 ngày liên tiếp' },
    { id: 'streak7', icon: '🌋', name: 'Chăm chỉ 7 ngày', desc: 'Học 7 ngày liên tiếp' },
    { id: 'streak30', icon: '☄️', name: 'Bền bỉ 30 ngày', desc: 'Học 30 ngày liên tiếp' },
    { id: 'perfect', icon: '🎯', name: 'Không trượt phát nào', desc: 'Đúng hết một lượt từ 10 câu trở lên' },
    { id: 'combo10', icon: '⚡', name: 'Combo 10', desc: 'Đúng 10 câu liên tiếp' },
    { id: 'fast', icon: '🏎️', name: 'Thần tốc', desc: 'Nối xong 6 cặp dưới 20 giây' },
    { id: 'boss', icon: '👾', name: 'Diệt boss', desc: 'Hạ gục boss lần đầu' },
    { id: 'p1x30', icon: '📷', name: 'Mắt thần', desc: 'Đúng 30 câu Part 1' },
    { id: 'p2x50', icon: '🎧', name: 'Tai thính', desc: 'Đúng 50 câu Part 2' },
    { id: 'master', icon: '📚', name: 'Thạo một bài', desc: 'Thuộc 80% từ của một Lesson' },
    { id: 'w100', icon: '🧠', name: '100 từ', desc: 'Thuộc 100 từ / mục' }
  ];

  /* ---------- hồ sơ người chơi ---------- */
  const KEY = 'tv_state_v1';
  const S = U.store.get(KEY, { profiles: {}, current: null, settings: { rate: 0.95, sfx: true, voiceA: '', voiceB: '', showText: false } });
  S.settings = Object.assign({ rate: 0.95, sfx: true, voiceA: '', voiceB: '', showText: false }, S.settings || {});
  const save = U.debounce(() => U.store.set(KEY, S), 200);
  function saveNow() { U.store.set(KEY, S); }

  function newProfile(name, cls, avatar, id) {
    return {
      id: id || U.uid(), name, cls, avatar, created: Date.now(), points: 0, streak: 0, best: 0, lastDay: null,
      daily: {}, srs: {}, stats: { answered: 0, correct: 0, p1: 0, p2: 0, sessions: 0, boss: 0 }, badges: {},
      mission: null, focus: 'L4', pending: [], wrongLog: {}
    };
  }
  const P = {
    get cur() { return S.current && S.profiles[S.current] || null; },
    all() { return Object.values(S.profiles); },
    use(p) { S.profiles[p.id] = p; S.current = p.id; saveNow(); },
    logout() { S.current = null; saveNow(); },
    remove(id) { delete S.profiles[id]; if (S.current === id) S.current = null; saveNow(); },
    save, saveNow, settings: S.settings, newProfile
  };

  /* ---------- ôn tập ngắt quãng (Leitner 5 hộp) ---------- */
  const INTERVAL = [0, 1, 2, 4, 7, 15];
  const SRS = {
    get(p, id) { return p.srs[id]; }, // [box, due, wrong, seen]
    box(p, id) { const r = p.srs[id]; return r ? r[0] : 0; },
    grade(p, id, ok) {
      const today = U.dayNum();
      const r = p.srs[id] || [0, today, 0, 0];
      if (ok) { r[0] = Math.min(5, r[0] + 1); r[1] = today + INTERVAL[r[0]]; }
      else { r[0] = 1; r[1] = today + 1; r[2]++; p.wrongLog[id] = (p.wrongLog[id] || 0) + 1; }
      r[3]++; p.srs[id] = r;
    },
    due(p, ids) { const t = U.dayNum(); return ids.filter(id => p.srs[id] && p.srs[id][1] <= t); },
    unseen(p, ids) { return ids.filter(id => !p.srs[id]); },
    mastery(p, L) { // % thuộc của 1 Lesson theo thẻ từ
      const cs = DB.cardsByL[L]; if (!cs.length) { // L12: theo câu trong đề
        const items = []; DB.setsByL[L].forEach(s => s.items.forEach(it => items.push(DB.itemKey(s.id, it.n))));
        if (!items.length) return 0; return Math.round(items.reduce((a, id) => a + Math.min(SRS.box(p, id), 4), 0) / (items.length * 4) * 100);
      }
      return Math.round(cs.reduce((a, c) => a + Math.min(SRS.box(p, c.id), 4), 0) / (cs.length * 4) * 100);
    },
    masteredCount(p) { return Object.values(p.srs).filter(r => r[0] >= 4).length; }
  };

  /* ---------- điểm, chuỗi ngày, huy hiệu ---------- */
  const Score = {
    addPoints(p, pts) {
      const d = U.dayStr(); p.points += pts; p.daily[d] = (p.daily[d] || 0) + pts;
      // giữ 70 ngày gần nhất
      const keys = Object.keys(p.daily).sort(); while (keys.length > 70) delete p.daily[keys.shift()];
    },
    touchStreak(p) {
      const t = U.dayNum(); const last = p.lastDay == null ? null : p.lastDay;
      if (last === t) return false;
      p.streak = last === t - 1 ? p.streak + 1 : 1; p.best = Math.max(p.best, p.streak); p.lastDay = t; return true;
    },
    liveStreak(p) { const t = U.dayNum(); return (p.lastDay === t || p.lastDay === t - 1) ? p.streak : 0; },
    today(p) { return p.daily[U.dayStr()] || 0; },
    week(p) { const ws = U.weekStart(); let s = 0; for (let n = ws; n <= U.dayNum(); n++) s += p.daily[U.dayStr(n)] || 0; return s; },
    award(p, id) { if (p.badges[id]) return null; p.badges[id] = Date.now(); return BADGES.find(b => b.id === id); },
    checkBadges(p, ctx) {
      const got = [];
      const a = id => { const b = Score.award(p, id); if (b) got.push(b); };
      if (p.stats.sessions >= 1) a('first');
      if (p.streak >= 3) a('streak3'); if (p.streak >= 7) a('streak7'); if (p.streak >= 30) a('streak30');
      if (ctx && ctx.perfect) a('perfect'); if (ctx && ctx.maxCombo >= 10) a('combo10');
      if (ctx && ctx.fast) a('fast'); if (ctx && ctx.bossWin) a('boss'); if (ctx && ctx.mission) a('mission');
      if (p.stats.p1 >= 30) a('p1x30'); if (p.stats.p2 >= 50) a('p2x50');
      if (DB.lessons.some(l => DB.cardsByL[l.id].length && SRS.mastery(p, l.id) >= 80)) a('master');
      if (SRS.masteredCount(p) >= 100) a('w100');
      return got;
    }
  };

  /* ---------- giọng đọc (Web Speech) ---------- */
  const TTS = {
    ok: 'speechSynthesis' in window, voices: [], seq: 0,
    load() {
      if (!TTS.ok) return;
      const all = speechSynthesis.getVoices();
      const en = all.filter(v => /^en[-_]/i.test(v.lang));
      const score = v => (/en[-_]US/i.test(v.lang) ? 3 : /en[-_](GB|AU|CA)/i.test(v.lang) ? 2 : 1) + (/google|natural|neural|online|samantha|aria|jenny|guy|daniel|karen|serena|alex/i.test(v.name) ? 2 : 0) - (/compact|eloquence|novelty|bad|bells|whisper|zarvox|trinoids|albert|bubbles|cellos|organ|boing|jester|superstar/i.test(v.name) ? 5 : 0);
      TTS.voices = en.sort((a, b) => score(b) - score(a));
    },
    voice(slot) {
      const want = slot === 'B' ? P.settings.voiceB : P.settings.voiceA;
      let v = want && TTS.voices.find(x => x.name === want);
      if (v) return v;
      if (slot === 'B') { // giọng thứ 2 khác giọng chính (ưu tiên khác vùng miền như đề thật)
        const a = TTS.voice('A');
        return TTS.voices.find(x => a && x.name !== a.name && x.lang !== a.lang) || TTS.voices.find(x => a && x.name !== a.name) || a;
      }
      return TTS.voices[0] || null;
    },
    unlock() { if (TTS.ok && !TTS._u) { TTS._u = true; try { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.speak(u); } catch (e) {} } },
    stop() { TTS.seq++; if (TTS.ok) try { speechSynthesis.cancel(); } catch (e) {} },
    say(text, slot, rate) {
      return new Promise(res => {
        if (!TTS.ok || !text) return res();
        const u = new SpeechSynthesisUtterance(String(text).replace(/~|\[|\]/g, ' ').replace(/\s–\s/g, '. '));
        const v = TTS.voice(slot || 'A'); if (v) { u.voice = v; u.lang = v.lang; } else u.lang = 'en-US';
        u.rate = rate || P.settings.rate || 0.95;
        let done = false; const fin = () => { if (!done) { done = true; clearTimeout(t); res(); } };
        const est = 1200 + String(text).split(/\s+/).length * 520 / (u.rate || 1);
        const t = setTimeout(fin, est + 1500);
        u.onend = fin; u.onerror = fin;
        try { speechSynthesis.speak(u); } catch (e) { fin(); }
      });
    },
    async speak(text, slot, rate) { TTS.stop(); const my = TTS.seq; if (TTS.ok && speechSynthesis.paused) speechSynthesis.resume(); await TTS.say(text, slot, rate); return my === TTS.seq; },
    // phát lần lượt [{t, v, gap}] – dùng cho Part 1/Part 2
    async play(list, onStep) {
      TTS.stop(); const my = TTS.seq;
      for (let i = 0; i < list.length; i++) {
        if (my !== TTS.seq) return false;
        onStep && onStep(i);
        await TTS.say(list[i].t, list[i].v, list[i].rate);
        if (my !== TTS.seq) return false;
        await new Promise(r => setTimeout(r, list[i].gap == null ? 450 : list[i].gap));
      }
      onStep && onStep(-1); return true;
    }
  };
  if (TTS.ok) { TTS.load(); speechSynthesis.onvoiceschanged = TTS.load; setTimeout(TTS.load, 800); }

  /* ---------- hiệu ứng âm thanh ---------- */
  const SFX = {
    ctx: null,
    tone(freqs, dur, type, vol) {
      if (!P.settings.sfx) return;
      try {
        SFX.ctx = SFX.ctx || new (window.AudioContext || window.webkitAudioContext)();
        const c = SFX.ctx; let t = c.currentTime;
        freqs.forEach(f => {
          const o = c.createOscillator(), g = c.createGain(); o.type = type || 'triangle'; o.frequency.value = f;
          g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.18, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
          o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + dur + 0.02); t += dur * 0.75;
        });
      } catch (e) {}
    },
    ok() { SFX.tone([660, 990], 0.12); }, bad() { SFX.tone([220, 165], 0.16, 'sawtooth', 0.08); },
    combo() { SFX.tone([660, 880, 1175], 0.09); }, win() { SFX.tone([523, 659, 784, 1047, 1319], 0.13); },
    tap() { SFX.tone([520], 0.05, 'sine', 0.06); }, hit() { SFX.tone([180, 120], 0.12, 'square', 0.07); }
  };

  /* ---------- kết nối Google Sheets (Apps Script) ---------- */
  const API = {
    url: (CFG.API_URL || '').trim(),
    get online() { return !!API.url; },
    async call(action, payload, timeout) {
      if (!API.url) throw new Error('offline');
      const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const tm = setTimeout(() => ctl && ctl.abort(), timeout || 15000);
      try {
        const r = await fetch(API.url, { method: 'POST', body: JSON.stringify(Object.assign({ action }, payload || {})), signal: ctl && ctl.signal, redirect: 'follow' });
        const j = await r.json(); if (!j.ok) throw new Error(j.error || 'Lỗi máy chủ'); return j;
      } finally { clearTimeout(tm); }
    },
    snapshot(p) {
      const mastery = {}; DB.lessons.forEach(l => { mastery[l.id] = SRS.mastery(p, l.id); });
      return { id: p.id, name: p.name, cls: p.cls, avatar: p.avatar, points: p.points, streak: Score.liveStreak(p), best: p.best, lastDay: p.lastDay, mastery,
        progress: { srs: p.srs, stats: p.stats, badges: p.badges, daily: p.daily, focus: p.focus, mission: p.mission, wrongLog: p.wrongLog, streak: p.streak, best: p.best, lastDay: p.lastDay, points: p.points } };
    },
    queue(p, session) { p.pending.push(session); P.saveNow(); return API.flush(p); },
    async flush(p) {
      if (!API.online || !p || API._busy) return false;
      API._busy = true;
      try {
        const sessions = p.pending.slice();
        await API.call('sync', { student: API.snapshot(p), sessions });
        p.pending.splice(0, sessions.length); P.saveNow(); return true;
      } catch (e) { return false; } finally { API._busy = false; }
    },
    cache: {},
    async config(cls) {
      const ck = 'cfg_' + cls;
      if (!API.online) return { locks: {}, newPerDay: CFG.NEW_PER_DAY || 8 };
      try { const j = await API.call('config', { cls }, 8000); U.store.set(ck, j); return j; }
      catch (e) { return U.store.get(ck, { locks: {}, newPerDay: CFG.NEW_PER_DAY || 8 }); }
    },
    async board(cls, period) {
      if (API.online) {
        try { const j = await API.call('board', { cls, period }, 12000); return { rows: j.rows, online: true }; }
        catch (e) { /* rơi xuống dữ liệu máy */ }
      }
      const rows = P.all().filter(p => !cls || p.cls === cls).map(p => ({ id: p.id, name: p.name, cls: p.cls, avatar: p.avatar, streak: Score.liveStreak(p),
        pts: period === 'day' ? Score.today(p) : period === 'week' ? Score.week(p) : p.points }));
      rows.sort((a, b) => b.pts - a.pts);
      return { rows, online: false };
    }
  };
  window.addEventListener('online', () => P.cur && API.flush(P.cur));

  window.TV = { CFG, D, U, DB, LEVELS, levelOf, BADGES, P, SRS, Score, TTS, SFX, API };
})();
