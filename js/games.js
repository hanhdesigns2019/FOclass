/* ===== Trò chơi: sinh câu hỏi, chạy lượt chơi, nối nhanh, thẻ từ, luyện đề ===== */
(function () {
  'use strict';
  const { U, DB, P, SRS, Score, TTS, SFX, API } = window.TV;
  const esc = U.esc;
  const LETTERS = ['A', 'B', 'C', 'D'];

  /* ---------- tiện ích hiển thị ---------- */
  function markHL(text, parts) {
    let html = esc(text);
    (parts || []).filter(Boolean).forEach(h => {
      const e = esc(h); const i = html.toLowerCase().indexOf(e.toLowerCase());
      if (i >= 0) html = html.slice(0, i) + '<mark class="hl">' + html.slice(i, i + e.length) + '</mark>' + html.slice(i + e.length);
    });
    return html;
  }
  function pic(c, size) {
    if (c.img) return `<img class="pic ${size || ''}" src="${esc(c.img)}" alt="" loading="lazy">`;
    if (c.emo) return `<span class="emo ${size || ''}" aria-hidden="true">${c.emo}</span>`;
    return '';
  }
  const spk = (text, slot, label) => `<button class="spk" type="button" data-say="${esc(text)}" data-slot="${slot || 'A'}" aria-label="${esc(label || 'Nghe')}">🔊</button>`;
  const speakText = c => c.t === 'ph' ? c.en.replace(/\s*\(.*\)/, '') : c.en.replace(/\s*\((.*?)\)/g, ', $1').replace(/\s~\s/g, ', ').replace(/\[.*?\]/g, '').replace(/\s–\s/g, '. ').replace(/\s\/\s/g, '. ');
  const isP1 = c => c.L === 'L4' || c.L === 'L5';
  const isP2 = c => c.t === 'v' && !isP1(c);
  const hlOf = (c, fld) => (c.hl || []).filter(h => h[0] === fld).map(h => h[1]);
  function dialogue(c, showVi) {
    return `<div class="dlg">
      <div class="dl q"><span class="who">Hỏi</span><p>${markHL(c.q, hlOf(c, 'q'))} ${spk(c.q, 'A')}</p>${showVi ? `<p class="vi">${esc(c.qVi)}</p>` : ''}</div>
      <div class="dl a"><span class="who">Đáp</span><p>${markHL(c.a, hlOf(c, 'a'))} ${spk(c.a, 'B')}</p>${showVi ? `<p class="vi">${esc(c.aVi)}</p>` : ''}</div></div>`;
  }
  function pool(c, n) {
    let ps = DB.cardsByL[c.L].filter(x => x.id !== c.id);
    if (ps.length < n + 3) ps = ps.concat(DB.cards.filter(x => x.L !== c.L && x.t === c.t && isP1(x) === isP1(c)));
    return ps;
  }
  function distinctBy(arr, key, n, avoid) {
    const out = [], seen = new Set((avoid || []).map(x => String(x).toLowerCase()));
    for (const x of U.shuffle(arr)) { const k = String(key(x)).toLowerCase(); if (!seen.has(k)) { seen.add(k); out.push(x); } if (out.length >= n) break; }
    return out;
  }
  function mcqOpts(correctHtml, wrongHtmls) { return U.shuffle([{ html: correctHtml, ok: true }].concat(wrongHtmls.map(h => ({ html: h, ok: false })))); }

  /* ---------- sinh câu hỏi cho thẻ từ ---------- */
  const G = {};
  G.en2vi = c => {
    const d = distinctBy(pool(c, 3), x => x.vi, 3, [c.vi]);
    return { kind: 'mcq', id: c.id, base: 10, tag: 'Chọn nghĩa đúng', auto: () => TTS.speak(speakText(c)),
      html: `<div class="term">${pic(c, 'sm')}<h2 class="word">${esc(c.en)}</h2><p class="ipa">${esc(c.ipa || '')}${c.pos ? ` <i>(${esc(c.pos)})</i>` : ''}</p>${spk(speakText(c))}</div>`,
      options: mcqOpts(esc(c.vi), d.map(x => esc(x.vi))), reveal: revealCard(c) };
  };
  G.vi2en = c => {
    const d = distinctBy(pool(c, 3), x => x.en, 3, [c.en]);
    return { kind: 'mcq', id: c.id, base: 10, tag: 'Chọn từ tiếng Anh', html: `<div class="term">${pic(c, 'sm')}<h2 class="word vi-word">${esc(c.vi)}</h2></div>`,
      options: mcqOpts(esc(c.en), d.map(x => esc(x.en))), after: () => TTS.speak(speakText(c)), reveal: revealCard(c) };
  };
  G.meaning = c => {
    if (c.t === 'ph') return G.en2vi(c);
    if (isP1(c)) {
      const d = distinctBy(pool(c, 3), x => x.vi, 3, [c.vi]);
      return { kind: 'mcq', id: c.id, base: 10, tag: 'Đoán nghĩa trong câu', auto: () => TTS.speak(c.ex),
        html: `<div class="ctx">${pic(c, 'md')}<p class="sent">${markHL(c.ex, [c.cl])} ${spk(c.ex)}</p><p class="ask">Từ tô vàng nghĩa là gì?</p></div>`,
        options: mcqOpts(esc(c.vi), d.map(x => esc(x.vi))), reveal: `<p class="rv-en">${markHL(c.ex, [c.cl])}</p><p class="rv-vi">${esc(c.exVi)}</p><p class="rv-w"><b>${esc(c.en)}</b> ${esc(c.ipa || '')} = ${esc(c.vi)}</p>` };
    }
    if (c.pair) {
      const others = DB.cards.filter(x => x.pair && x.id !== c.id);
      const d = distinctBy(others, x => x.aVi, 3, [c.aVi]);
      return { kind: 'mcq', id: c.id, base: 10, tag: 'Hiểu câu đáp', auto: () => TTS.play([{ t: c.q, v: 'A' }, { t: c.a, v: 'B' }]),
        html: `<div class="ctx">${pic(c, 'xs')}${dialogue(c)}<p class="ask">Câu đáp tô vàng nghĩa là gì?</p></div>`,
        options: mcqOpts(esc(c.aVi), d.map(x => esc(x.aVi))), reveal: dialogue(c, true) };
    }
    const d = distinctBy(pool(c, 3), x => x.vi, 3, [c.vi]);
    return { kind: 'mcq', id: c.id, base: 10, tag: 'Đoán nghĩa trong câu', auto: () => TTS.play([{ t: c.q, v: 'A' }, { t: c.a, v: 'B' }]),
      html: `<div class="ctx">${pic(c, 'xs')}${dialogue(c)}<p class="ask">Phần tô vàng nghĩa là gì?</p></div>`,
      options: mcqOpts(esc(c.vi), d.map(x => esc(x.vi))), reveal: dialogue(c, true) + `<p class="rv-w"><b>${esc(c.en)}</b> = ${esc(c.vi)}</p>` };
  };
  G.listen = c => {
    if (c.pair) {
      const d = distinctBy(DB.cards.filter(x => x.pair && x.id !== c.id), x => x.a, 3, [c.a]);
      return { kind: 'mcq', id: c.id, base: 10, tag: 'Nghe và chọn câu bạn nghe được', auto: () => TTS.speak(c.a, 'B'),
        html: `<div class="listen">${bigPlay(c.a, 'B')}<p class="ask">Bạn nghe thấy câu nào?</p></div>`,
        options: mcqOpts(esc(c.a), d.map(x => esc(x.a))), reveal: `<p class="rv-en">${esc(c.a)}</p><p class="rv-vi">${esc(c.aVi)}</p>` };
    }
    const d = distinctBy(pool(c, 3), x => x.en, 3, [c.en]);
    return { kind: 'mcq', id: c.id, base: 10, tag: 'Nghe và chọn từ', auto: () => TTS.speak(speakText(c)),
      html: `<div class="listen">${bigPlay(speakText(c))}<p class="ask">Bạn nghe thấy từ nào?</p></div>`,
      options: mcqOpts(esc(c.en), d.map(x => esc(x.en))), reveal: revealCard(c) };
  };
  G.sound = c => {
    const sounds = [...new Set(DB.cardsByL[c.L].map(x => x.snd))].filter(s => s !== c.snd && !c.ipa.includes(s.replace(/\//g, '')));
    const d = U.shuffle(sounds).slice(0, 3);
    return { kind: 'mcq', id: c.id, base: 10, tag: 'Nghe và đoán âm', auto: () => TTS.speak(speakText(c)),
      html: `<div class="listen">${bigPlay(speakText(c))}<p class="ask">Từ bạn nghe có chứa âm nào?</p></div>`,
      options: mcqOpts(`<span class="ipa-opt">${esc(c.snd)}</span>`, d.map(s => `<span class="ipa-opt">${esc(s)}</span>`)), reveal: revealCard(c) };
  };
  G.cloze = c => {
    if (c.t === 'ph') {
      return { kind: 'type', id: c.id, base: 15, tag: 'Nghe và viết lại', auto: () => TTS.speak(speakText(c)),
        html: `<div class="listen">${bigPlay(speakText(c))}<p class="ask">Gõ từ bạn nghe được <span class="muted">(nghĩa: ${esc(c.vi)})</span></p></div>`,
        answer: [c.en.replace(/\s*\(.*\)/, '')], hint: c.en[0], reveal: revealCard(c) };
    }
    if (isP1(c)) {
      const blank = c.ex.replace(new RegExp('\\b' + c.cl + '\\b'), '_____');
      return { kind: 'type', id: c.id, base: 15, tag: 'Điền từ vào câu',
        html: `<div class="ctx">${pic(c, 'md')}<p class="sent">${esc(blank).replace('_____', '<span class="blank">_____</span>')}</p><p class="vi">${esc(c.exVi)}</p><p class="ask">Gợi ý: dùng từ <b>${esc(c.en)}</b> (${esc(c.vi)}) ở dạng đúng</p></div>`,
        answer: [c.cl], hint: c.cl.slice(0, 2), after: () => TTS.speak(c.ex), reveal: `<p class="rv-en">${markHL(c.ex, [c.cl])}</p><p class="rv-vi">${esc(c.exVi)}</p>` };
    }
    const h = (c.hl || [])[0];
    if (!c.pair && c.hl.length === 1 && h && h[1].split(' ').length <= 4) {
      const fld = h[0], line = c[fld], i = line.toLowerCase().indexOf(h[1].toLowerCase());
      const blank = esc(line.slice(0, i)) + '<span class="blank">_____</span>' + esc(line.slice(i + h[1].length));
      const other = fld === 'a' ? `<div class="dl q"><span class="who">Hỏi</span><p>${esc(c.q)}</p></div>` : '';
      const mine = `<div class="dl ${fld}"><span class="who">${fld === 'a' ? 'Đáp' : 'Hỏi'}</span><p>${blank}</p><p class="vi">${esc(c[fld + 'Vi'])}</p></div>`;
      const after = fld === 'q' ? `<div class="dl a"><span class="who">Đáp</span><p>${esc(c.a)}</p></div>` : '';
      return { kind: 'type', id: c.id, base: 15, tag: 'Điền từ vào câu', html: `<div class="ctx">${pic(c, 'xs')}<div class="dlg">${other}${mine}${after}</div><p class="ask">Nghĩa cần điền: <b>${esc(c.vi)}</b></p></div>`,
        answer: [h[1]], hint: h[1].slice(0, 2), after: () => TTS.play([{ t: c.q, v: 'A' }, { t: c.a, v: 'B' }]), reveal: dialogue(c, true) };
    }
    return G.order(c);
  };
  G.order = c => {
    if (c.t === 'ph') return G.listen(c);
    let en, vi, slot = 'A';
    if (isP1(c)) { en = c.ex; vi = c.exVi; }
    else {
      const useA = c.a.split(' ').length >= 3 || c.q.split(' ').length > 12;
      en = useA ? c.a : c.q; vi = useA ? c.aVi : c.qVi; slot = useA ? 'B' : 'A';
      if (en.split(' ').length < 3) { en = c.q; vi = c.qVi; slot = 'A'; }
    }
    return orderQ(c.id, en, vi, slot, isP1(c) ? pic(c, 'sm') : (c.pair || !c.q ? '' : `<p class="ctx-line"><span class="who">${slot === 'B' ? 'Hỏi' : 'Đáp'}</span> ${esc(slot === 'B' ? c.q : c.a)}</p>`), revealCard(c));
  };
  function orderQ(id, en, vi, slot, extra, reveal) {
    const words = en.split(' ');
    return { kind: 'order', id, base: 15, tag: 'Xếp câu', html: `<div class="ctx">${extra || ''}<p class="vi big-vi">${esc(vi)}</p><p class="ask">Xếp các mảnh thành câu tiếng Anh đúng nghĩa</p></div>`,
      words, answer: [en], after: () => TTS.speak(en, slot), reveal: reveal || `<p class="rv-en">${esc(en)}</p><p class="rv-vi">${esc(vi)}</p>` };
  }
  G.p1 = c => {
    if (!isP1(c)) return c.t === 'ph' ? G.sound(c) : G.p2(c);
    const others = distinctBy(DB.cards.filter(x => isP1(x) && x.id !== c.id), x => x.ex, 3, [c.ex]);
    const st = U.shuffle([c.ex].concat(others.map(x => x.ex)));
    return p1Q(c.id, c.img, st, st.indexOf(c.ex), st.map(s => s === c.ex ? c.exVi : (DB.cards.find(x => x.ex === s) || {}).exVi), 'Part 1 mini');
  };
  G.p2 = c => {
    if (!isP2(c)) return G.p1(c);
    const grp = c.g;
    let others = DB.cards.filter(x => isP2(x) && x.id !== c.id && x.g !== grp && ['who', 'where', 'when', 'what', 'which', 'why', 'how'].includes(x.g));
    if (['who', 'where', 'when', 'what', 'which', 'why', 'how'].includes(grp)) others = others.filter(x => !(grp === 'what' && x.g === 'which') && !(grp === 'which' && x.g === 'what'));
    const d = distinctBy(others, x => x.a, 2, [c.a]);
    const rs = U.shuffle([{ t: c.a, vi: c.aVi, ok: true }].concat(d.map(x => ({ t: x.a, vi: x.aVi, ok: false }))));
    return p2Q(c.id, c.q, c.qVi, rs.map(r => r.t), rs.findIndex(r => r.ok), rs.map(r => r.vi), 'Part 2 mini', c);
  };
  function revealCard(c) {
    if (c.t === 'ph') return `<p class="rv-w"><b>${esc(c.en)}</b> ${esc(c.ipa)} = ${esc(c.vi)} <span class="chip">${esc(c.snd)}</span> ${spk(speakText(c))}</p>`;
    if (isP1(c)) return `<p class="rv-w"><b>${esc(c.en)}</b> ${esc(c.ipa || '')} = ${esc(c.vi)} ${spk(speakText(c))}</p><p class="rv-en">${markHL(c.ex, [c.cl])}</p><p class="rv-vi">${esc(c.exVi)}</p>`;
    return `<p class="rv-w"><b>${esc(c.en)}</b> = ${esc(c.vi)}</p>` + dialogue(c, true);
  }
  function bigPlay(text, slot) { return `<button class="bigplay" type="button" data-say="${esc(text)}" data-slot="${slot || 'A'}" aria-label="Nghe lại"><span>▶</span></button>`; }

  /* ---------- Part 1 / Part 2 (dạng đề thật) ---------- */
  function p1Q(id, img, statements, ans, vis, tag) {
    return { kind: 'p1', id, base: 15, tag: tag || 'Part 1', cat: 'p1', statements, ans, vis,
      audio: () => TTS.play(statements.map((s, i) => ({ t: LETTERS[i] + '. ' + s, v: i % 2 ? 'B' : 'A', gap: 650 }))),
      html: `<div class="p1"><img class="photo" src="${esc(img)}" alt="Tranh Part 1"><button class="play-row" type="button" data-act="replay">▶ Nghe 4 câu mô tả</button></div>`,
      options: statements.map((s, i) => ({ html: `<span class="opt-text">${esc(s)}</span>`, ok: i === ans, hidden: true })),
      reveal: statements.map((s, i) => `<p class="rv-line ${i === ans ? 'good' : ''}"><b>${LETTERS[i]}.</b> ${esc(s)}<br><span class="vi">${esc(vis[i] || '')}</span></p>`).join('') };
  }
  function p2Q(id, q, qVi, responses, ans, vis, tag, card) {
    return { kind: 'p2', id, base: 15, tag: tag || 'Part 2', cat: 'p2', ans,
      audio: () => TTS.play([{ t: q, v: 'A', gap: 800 }].concat(responses.map((r, i) => ({ t: LETTERS[i] + '. ' + r, v: 'B', gap: 600 })))),
      html: `<div class="p2"><div class="p2-q"><span class="q-mark" aria-hidden="true">?</span><p class="hidden-q" data-q>${esc(q)}</p></div><button class="play-row" type="button" data-act="replay">▶ Nghe câu hỏi và 3 câu trả lời</button></div>`,
      options: responses.map((r, i) => ({ html: `<span class="opt-text">${esc(r)}</span>`, ok: i === ans, hidden: true })),
      reveal: `<p class="rv-line"><b>Hỏi:</b> ${esc(q)}<br><span class="vi">${esc(qVi)}</span></p>` + responses.map((r, i) => `<p class="rv-line ${i === ans ? 'good' : ''}"><b>${LETTERS[i]}.</b> ${esc(r)}<br><span class="vi">${esc(vis[i] || '')}</span></p>`).join('') };
  }
  G.testItem = (set, it) => {
    const key = DB.itemKey(set.id, it.n);
    if (set.part === 1) return Object.assign(p1Q(key, it.img, it.o.map(i => DB.sent(i)[0]), it.a, it.o.map(i => DB.sent(i)[1]), set.title + ' · Câu ' + it.n), { n: it.n });
    return Object.assign(p2Q(key, DB.sent(it.q)[0], DB.sent(it.q)[1], it.o.map(i => DB.sent(i)[0]), it.a, it.o.map(i => DB.sent(i)[1]), set.title + ' · Câu ' + it.n), { n: it.n });
  };

  /* ---------- học câu (dịch câu trong đề) ---------- */
  G.sentVi = (sid, poolIds, listenOnly) => {
    const s = DB.sent(sid);
    const d = distinctBy(poolIds.filter(x => x !== sid).map(x => DB.sent(x)), x => x[1], 3, [s[1]]);
    return { kind: 'mcq', id: 'S:' + sid, base: listenOnly ? 12 : 10, tag: listenOnly ? 'Nghe và chọn nghĩa' : 'Dịch câu', auto: () => TTS.speak(s[0]),
      html: listenOnly ? `<div class="listen">${bigPlay(s[0])}<p class="ask">Câu bạn nghe có nghĩa là gì?</p></div>` : `<div class="ctx"><p class="sent">${esc(s[0])} ${spk(s[0])}</p><p class="ask">Câu này nghĩa là gì?</p></div>`,
      options: mcqOpts(esc(s[1]), d.map(x => esc(x[1]))), reveal: `<p class="rv-en">${esc(s[0])} ${spk(s[0])}</p><p class="rv-vi">${esc(s[1])}</p>` };
  };
  G.sentOrder = sid => { const s = DB.sent(sid); return orderQ('S:' + sid, s[0], s[1], 'A'); };

  /* ---------- chọn thẻ cho một lượt ---------- */
  function pickCards(p, cards, n) {
    const t = U.dayNum();
    const scoreOf = c => { const r = p.srs[c.id]; if (!r) return 2 + Math.random(); if (r[1] <= t) return 4 + (5 - r[0]) + Math.random(); return (5 - r[0]) * 0.6 + Math.random(); };
    return cards.slice().sort((a, b) => scoreOf(b) - scoreOf(a)).slice(0, n);
  }
  function pickIds(p, ids, n) {
    const t = U.dayNum();
    const scoreOf = id => { const r = p.srs[id]; if (!r) return 2 + Math.random(); if (r[1] <= t) return 4 + (5 - r[0]) + Math.random(); return (5 - r[0]) * 0.6 + Math.random(); };
    return ids.slice().sort((a, b) => scoreOf(b) - scoreOf(a)).slice(0, n);
  }
  const MODE_GEN = {
    meaning: c => U.pick([G.meaning, G.meaning, G.en2vi, G.vi2en])(c),
    listen: c => c.t === 'ph' ? U.pick([G.listen, G.sound])(c) : G.listen(c),
    write: c => G.cloze(c),
    order: c => G.order(c),
    mini: c => c.t === 'ph' ? G.sound(c) : isP1(c) ? G.p1(c) : G.p2(c),
    mix: c => U.pick(c.t === 'ph' ? [G.en2vi, G.vi2en, G.listen, G.sound, G.cloze] : isP1(c) ? [G.meaning, G.en2vi, G.vi2en, G.listen, G.cloze, G.order, G.p1] : [G.meaning, G.en2vi, G.vi2en, G.listen, G.cloze, G.order, G.p2, G.p2])(c)
  };
  function testItemsOf(L) {
    const out = []; DB.setsByL[L].forEach(s => { if (s.part === 2 || s.photo) s.items.forEach(it => out.push({ s, it })); }); return out;
  }
  function buildLessonSession(p, L, mode, n) {
    const cards = DB.cardsByL[L];
    if (mode === 'sent') {
      const ids = DB.sentsByL[L]; const chosen = pickIds(p, ids.map(i => 'S:' + i), n || 10).map(x => +x.slice(2));
      return chosen.map(sid => { const r = Math.random(); const len = DB.sent(sid)[0].split(' ').length; return (r < 0.25 && len >= 3 && len <= 12) ? G.sentOrder(sid) : G.sentVi(sid, ids, r > 0.65); });
    }
    if (!cards.length) { // L12: chỉ có đề
      const items = testItemsOf(L); const keys = pickIds(p, items.map(x => DB.itemKey(x.s.id, x.it.n)), n || 10);
      return keys.map(k => { const f = DB.findItem(k); return G.testItem(f.set, f.item); });
    }
    const chosen = pickCards(p, cards, n || 10);
    const qs = chosen.map(c => MODE_GEN[mode] ? MODE_GEN[mode](c) : MODE_GEN.mix(c));
    if (mode === 'mix') { const items = U.shuffle(testItemsOf(L)).slice(0, 2); items.forEach(x => qs.splice(Math.floor(Math.random() * qs.length), 0, G.testItem(x.s, x.it))); }
    return qs;
  }
  function buildBoss(p, L, locks) {
    locks = locks || {};
    const cards = L ? DB.cardsByL[L] : DB.cards.filter(c => c.t === 'v' && !locks[c.L]);
    const qs = pickCards(p, cards.length ? cards : [], 10).map(c => MODE_GEN.mix(c));
    const items = U.shuffle(L ? testItemsOf(L) : DB.lessons.filter(l => !locks[l.id]).reduce((a, l) => a.concat(testItemsOf(l.id)), [])).slice(0, cards.length ? 3 : 13);
    items.forEach(x => qs.splice(Math.floor(Math.random() * (qs.length + 1)), 0, G.testItem(x.s, x.it)));
    return U.shuffle(qs).slice(0, 13);
  }
  function buildMission(p, locks, newPerDay) {
    const open = DB.lessons.filter(l => !locks[l.id]);
    const openIds = new Set(open.map(l => l.id));
    const t = U.dayNum();
    const due = DB.cards.filter(c => openIds.has(c.L) && p.srs[c.id] && p.srs[c.id][1] <= t).sort((a, b) => p.srs[a.id][1] - p.srs[b.id][1]).slice(0, 18);
    // từ mới: bài đang học trước, sau đó các bài kế tiếp
    const order = open.map(l => l.id); const fi = Math.max(0, order.indexOf(p.focus));
    const seq = order.slice(fi).concat(order.slice(0, fi));
    let fresh = [];
    for (const L of seq) { if (fresh.length >= newPerDay) break; fresh = fresh.concat(DB.cardsByL[L].filter(c => !p.srs[c.id]).slice(0, newPerDay - fresh.length)); }
    // khối: [giới thiệu từ mới + 1 câu dễ], câu ôn đến hạn, câu đề
    const blocks = [];
    fresh.forEach(c => blocks.push([{ kind: 'intro', card: c, id: null }, U.pick(c.t === 'ph' ? [G.en2vi, G.listen] : [G.en2vi, G.listen, G.meaning])(c)]));
    due.forEach(c => blocks.push([MODE_GEN.mix(c)]));
    const focusItems = testItemsOf(p.focus).concat(openIds.has('L12') ? testItemsOf('L12') : []);
    const dueItems = open.reduce((a, l) => a.concat(testItemsOf(l.id)), []).filter(x => { const r = p.srs[DB.itemKey(x.s.id, x.it.n)]; return r && r[1] <= t; });
    U.shuffle(dueItems).slice(0, 3).concat(U.shuffle(focusItems).slice(0, dueItems.length >= 3 ? 1 : 3)).forEach(x => blocks.push([G.testItem(x.s, x.it)]));
    // ôn lại từ mới thêm 1 lần ở nửa sau
    const late = fresh.map(c => [MODE_GEN.mix(c)]);
    const qs = [].concat(...U.shuffle(blocks), ...U.shuffle(late));
    return { qs, due: due.length, fresh: fresh.length };
  }

  /* ---------- trình chạy lượt chơi ---------- */
  const Run = { cur: null };
  function run(opts) {
    // opts: {title, qs, mode, L, boss, mission, back}
    const p = P.cur; TTS.unlock();
    const st = Run.cur = { ...opts, i: 0, pts: 0, combo: 0, maxCombo: 0, correct: 0, total: 0, wrong: [], hp: 100, hearts: 3, answered: false, t0: 0, log: [] };
    if (opts.boss) st.dmg = Math.ceil(100 / Math.max(6, Math.round(opts.qs.length * 0.7)));
    document.body.classList.add('in-game');
    renderQ();
  }
  function hud(st) {
    const n = st.qs.filter(q => q.kind !== 'intro').length; const done = st.qs.slice(0, st.i).filter(q => q.kind !== 'intro').length;
    const mult = st.combo >= 5 ? '<span class="mult">×2</span>' : '';
    const boss = st.boss ? `<div class="boss-bar"><span class="boss-face ${st.hp <= 0 ? 'ko' : ''}" aria-hidden="true">👾</span><div class="hp"><i style="width:${Math.max(0, st.hp)}%"></i></div><span class="hearts" aria-label="Còn ${st.hearts} tim">${'❤️'.repeat(st.hearts)}${'🤍'.repeat(3 - st.hearts)}</span></div>` : '';
    return `<header class="ghud"><button class="x" data-act="quit" aria-label="Thoát">✕</button><div class="prog"><i style="width:${Math.round(done / Math.max(1, n) * 100)}%"></i></div><div class="gpts"><b>${U.fmt(st.pts)}</b>${st.combo >= 2 ? `<span class="combo">🔥${st.combo}</span>` : ''}${mult}</div></header>${boss}`;
  }
  function renderQ() {
    const st = Run.cur; const app = U.$('#app');
    if (st.i >= st.qs.length || (st.boss && (st.hp <= 0 || st.hearts <= 0))) return finish();
    const q = st.qs[st.i]; st.answered = false; st.hinted = false;
    if (q.kind === 'intro') return renderIntro(q);
    const showText = P.settings.showText;
    let body = '';
    if (q.kind === 'mcq' || q.kind === 'p1' || q.kind === 'p2') {
      body = `<div class="opts ${q.kind !== 'mcq' ? 'exam' : ''}" role="group" aria-label="Các lựa chọn">${q.options.map((o, i) => `<button class="opt ${o.hidden && !showText ? 'conceal' : ''}" data-opt="${i}" type="button"><span class="bub">${LETTERS[i]}</span><span class="otx">${o.html}</span></button>`).join('')}</div>`;
      if ((q.kind === 'p1' || q.kind === 'p2') && !showText) body += `<p class="exam-note">Chữ của các câu sẽ hiện sau khi bạn chọn. Muốn hiện chữ trước, bật trong mục Tôi › Cài đặt.</p>`;
    } else if (q.kind === 'type') {
      body = `<form class="typebox" data-act="typeform" autocomplete="off"><input id="typein" type="text" inputmode="text" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="Gõ câu trả lời…" aria-label="Câu trả lời"><div class="trow"><button type="button" class="btn ghost" data-act="hint">Gợi ý</button><button type="submit" class="btn primary">Kiểm tra</button></div></form>`;
    } else if (q.kind === 'order') {
      st.orderPicked = []; st.orderPool = U.shuffle(q.words.map((w, i) => ({ w, i })));
      body = `<div class="order"><div class="order-line" data-line aria-live="polite"></div><div class="order-pool">${st.orderPool.map((o, k) => `<button type="button" class="chipw" data-chip="${k}">${esc(o.w)}</button>`).join('')}</div><div class="trow"><button type="button" class="btn ghost" data-act="undo">Xóa bớt</button><button type="button" class="btn primary" data-act="ordercheck">Kiểm tra</button></div></div>`;
    }
    app.innerHTML = `<section class="game ${st.boss ? 'is-boss' : ''}">${hud(st)}<div class="qwrap"><p class="qtag">${esc(q.tag || '')}</p><div class="qbody">${q.html}</div>${body}</div><div class="fb" id="fb" aria-live="assertive"></div></section>`;
    st.t0 = Date.now();
    if (q.kind === 'type') setTimeout(() => { const i = U.$('#typein'); i && i.focus(); }, 60);
    if (q.audio) setTimeout(() => q.audio(), 250); else if (q.auto) setTimeout(() => q.auto(), 200);
  }
  function renderIntro(q) {
    const c = q.card, st = Run.cur;
    const back = c.t === 'ph' ? `<p class="ex">Âm <span class="chip">${esc(c.snd)}</span> ${esc(c.sndName || '')}</p>` : isP1(c) ? `<p class="ex">${markHL(c.ex, [c.cl])} ${spk(c.ex)}</p><p class="vi">${esc(c.exVi)}</p>` : dialogue(c, true);
    U.$('#app').innerHTML = `<section class="game">${hud(st)}<div class="qwrap intro"><p class="qtag">Từ mới</p><div class="flash-face">${pic(c, 'lg')}<h2 class="word">${esc(c.en)}</h2><p class="ipa">${esc(c.ipa || '')}${c.pos ? ` <i>(${esc(c.pos)})</i>` : ''}</p>${spk(speakText(c))}<p class="mean">${esc(c.vi)}</p>${back}</div><button class="btn primary wide" data-act="next">Đã hiểu, kiểm tra mình nhé</button></div></section>`;
    setTimeout(() => TTS.speak(speakText(c)), 250);
  }
  function check(given) {
    const st = Run.cur, q = st.qs[st.i]; if (st.answered) return; st.answered = true; TTS.stop();
    let ok;
    if (q.kind === 'mcq' || q.kind === 'p1' || q.kind === 'p2') ok = !!q.options[given].ok;
    else { const g = U.norm(given); ok = q.answer.some(a => U.norm(a) === g); }
    const p = P.cur; st.total++;
    const secs = (Date.now() - st.t0) / 1000;
    let gain = 0;
    if (ok) {
      st.correct++; st.combo++; st.maxCombo = Math.max(st.maxCombo, st.combo);
      gain = (st.hinted ? 10 : q.base) + (q.kind === 'mcq' ? (secs < 5 ? 5 : secs < 9 ? 2 : 0) : 0);
      if (st.combo >= 5) gain *= 2;
      st.pts += gain; st.combo >= 5 && st.combo % 5 === 0 ? SFX.combo() : SFX.ok();
      if (q.cat === 'p1') p.stats.p1++; if (q.cat === 'p2') p.stats.p2++;
      if (st.boss) { st.hp -= st.dmg; SFX.hit(); }
    } else {
      st.combo = 0; SFX.bad(); if (q.id) st.wrong.push(q.id);
      if (st.boss) st.hearts--;
    }
    p.stats.answered++; if (ok) p.stats.correct++;
    if (q.id) SRS.grade(p, q.id, ok);
    P.save();
    // hiển thị
    if (q.kind === 'mcq' || q.kind === 'p1' || q.kind === 'p2') {
      U.$$('.opt').forEach((b, i) => { b.disabled = true; b.classList.remove('conceal'); if (q.options[i].ok) b.classList.add('right'); else if (i === given) b.classList.add('wrong'); });
      const hq = U.$('[data-q]'); hq && hq.classList.remove('hidden-q');
    }
    if (q.kind === 'type') { const inp = U.$('#typein'); inp.disabled = true; inp.classList.add(ok ? 'right' : 'wrong'); }
    if (q.kind === 'order') { U.$('[data-line]').classList.add(ok ? 'right' : 'wrong'); }
    const answerLine = (q.kind === 'type' || q.kind === 'order') && !ok ? `<p class="fb-ans">Đáp án: <b>${esc(q.answer[0])}</b></p>` : '';
    const fb = U.$('#fb');
    fb.className = 'fb show ' + (ok ? 'good' : 'bad');
    fb.innerHTML = `<div class="fb-in"><p class="fb-title">${ok ? U.pick(['Chính xác!', 'Giỏi lắm!', 'Chuẩn luôn!', 'Tuyệt!']) + ` <span class="gain">+${gain}</span>` : U.pick(['Chưa đúng rồi', 'Sai mất rồi', 'Tiếc quá'])}</p>${answerLine}<div class="fb-rv">${q.reveal || ''}</div><button class="btn ${ok ? 'good' : 'bad'} wide" data-act="next">${st.boss && (st.hp <= 0 || st.hearts <= 0) ? 'Xem kết quả' : 'Tiếp tục'}</button></div>`;
    U.$('.ghud').outerHTML = hud(st).split('</header>')[0] + '</header>';
    const bb = U.$('.boss-bar'); if (bb && st.boss) bb.outerHTML = hud(st).split('</header>')[1];
    if (q.after && (ok || q.kind !== 'mcq')) setTimeout(q.after, 150);
    setTimeout(() => { const b = U.$('#fb [data-act="next"]'); b && b.focus({ preventScroll: true }); }, 50);
  }
  function finish() {
    const st = Run.cur; const p = P.cur; TTS.stop(); if (st.finished) return; st.finished = true;
    document.body.classList.remove('in-game');
    const ctx = { maxCombo: st.maxCombo, perfect: st.total >= 10 && st.correct === st.total };
    let bonus = 0, notes = [];
    if (st.boss) {
      const win = st.hp <= 0; ctx.bossWin = win;
      if (win) { bonus += 100; p.stats.boss++; notes.push('Hạ gục boss +100'); }
    }
    if (st.mission && st.total > 0) {
      const today = U.dayStr();
      if (!(p.mission && p.mission.day === today && p.mission.done)) {
        const firstToday = p.lastDay !== U.dayNum();
        bonus += 50; notes.push('Xong nhiệm vụ hôm nay +50');
        const sb = Math.min(p.streak + (firstToday ? 1 : 0), 10) * 5; if (sb) { bonus += sb; notes.push('Thưởng chuỗi ngày +' + sb); }
        p.mission = { day: today, done: true }; ctx.mission = true;
      }
    }
    const total = st.pts + bonus;
    if (st.total > 0) { p.stats.sessions++; Score.touchStreak(p); }
    Score.addPoints(p, total);
    const badges = Score.checkBadges(p, ctx);
    P.saveNow();
    if (st.total > 0) API.queue(p, { date: U.dayStr(), at: Date.now(), pts: total, correct: st.correct, total: st.total, mode: st.mode, L: st.L || '', wrong: st.wrong.slice(0, 40) });
    renderEnd({ st, total, notes, badges });
  }
  function renderEnd({ st, total, notes, badges }) {
    const acc = st.total ? Math.round(st.correct / st.total * 100) : 0;
    const wrongIds = [...new Set(st.wrong)];
    const win = st.boss ? st.hp <= 0 : acc >= 60;
    const title = st.boss ? (win ? 'Boss đã gục ngã!' : 'Boss vẫn còn đứng…') : acc === 100 ? 'Hoàn hảo!' : acc >= 80 ? 'Làm tốt lắm!' : acc >= 50 ? 'Cố thêm chút nữa!' : 'Ôn lại rồi thử tiếp nhé';
    if (win) { SFX.win(); window.TVUI && window.TVUI.confetti(); }
    U.$('#app').innerHTML = `<section class="end">
      <div class="end-top ${win ? 'win' : ''}"><p class="end-emo" aria-hidden="true">${st.boss ? (win ? '🏆' : '👾') : acc >= 80 ? '🌟' : acc >= 50 ? '💪' : '📖'}</p><h1>${title}</h1>
      <p class="end-pts"><b>+${U.fmt(total)}</b> điểm</p>
      <div class="end-stats"><div><b>${st.correct}/${st.total}</b><span>câu đúng</span></div><div><b>${acc}%</b><span>chính xác</span></div><div><b>${st.maxCombo}</b><span>combo cao nhất</span></div></div>
      ${notes.length ? `<ul class="end-notes">${notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}</div>
      ${badges.length ? `<div class="end-badges"><h2>Huy hiệu mới</h2>${badges.map(b => `<div class="badge got"><span>${b.icon}</span><div><b>${esc(b.name)}</b><p>${esc(b.desc)}</p></div></div>`).join('')}</div>` : ''}
      ${wrongIds.length ? `<div class="end-wrong"><h2>Cần ôn lại (${wrongIds.length})</h2><p class="muted">Những mục này sẽ quay lại trong nhiệm vụ ngày mai.</p>${wrongIds.map(id => { const d = DB.describe(id); return `<div class="wrow">${spk(d.en)}<div><b>${esc(d.en)}</b><p>${esc(d.vi)}</p></div></div>`; }).join('')}</div>` : ''}
      <div class="end-actions"><button class="btn primary wide" data-act="again">Chơi lượt nữa</button><button class="btn ghost wide" data-act="back">${st.back === '#/' ? 'Về trang chủ' : 'Về bài học'}</button></div></section>`;
    window.TVUI && window.TVUI.refreshBadge && window.TVUI.refreshBadge();
  }

  // rời trò chơi giữa chừng (bấm nút Quay lại của trình duyệt): vẫn ghi điểm các câu đã làm
  function abandon() {
    const st = Run.cur; if (!st || st.finished || !st.qs || !st.total) return;
    st.finished = true; const p = P.cur; if (!p) return;
    p.stats.sessions++; Score.touchStreak(p); Score.addPoints(p, st.pts); Score.checkBadges(p, { maxCombo: st.maxCombo }); P.saveNow();
    API.queue(p, { date: U.dayStr(), at: Date.now(), pts: st.pts, correct: st.correct, total: st.total, mode: st.mode, L: st.L || '', wrong: st.wrong.slice(0, 40) });
  }

  /* ---------- sự kiện trong game ---------- */
  document.addEventListener('click', e => {
    const st = Run.cur; if (!st || !document.body.contains(e.target)) return;
    const sayBtn = e.target.closest('[data-say]');
    if (sayBtn) { e.preventDefault(); TTS.unlock(); TTS.speak(sayBtn.dataset.say, sayBtn.dataset.slot); return; }
    const t = e.target.closest('[data-opt],[data-act],[data-chip]'); if (!t) return;
    if (!U.$('.game') && !U.$('.end')) return;
    if (t.dataset.opt != null) { check(+t.dataset.opt); return; }
    if (t.dataset.chip != null) { orderTap(+t.dataset.chip); return; }
    const a = t.dataset.act;
    if (a === 'next') { st.i++; renderQ(); }
    else if (a === 'replay') { const q = st.qs[st.i]; q.audio && q.audio(); }
    else if (a === 'quit') {
      if (st.total === 0) { TTS.stop(); document.body.classList.remove('in-game'); Run.cur = null; location.hash = st.back || '#/'; window.TVUI.route(); return; }
      if (U.$('.qsheet')) return;
      const d = document.createElement('div'); d.className = 'qsheet'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true');
      d.innerHTML = `<div class="qs-in"><p class="h3">Dừng lượt chơi?</p><p class="muted">Điểm của ${st.total} câu đã làm vẫn được cộng.</p><div class="trow"><button class="btn ghost" data-act="quit-no" type="button">Chơi tiếp</button><button class="btn bad" data-act="quit-yes" type="button">Dừng và xem điểm</button></div></div>`;
      U.$('.game').appendChild(d); U.$('[data-act="quit-no"]', d).focus();
    }
    else if (a === 'quit-no') { const d = U.$('.qsheet'); d && d.remove(); }
    else if (a === 'quit-yes') { const d = U.$('.qsheet'); d && d.remove(); finish(); }
    else if (a === 'hint') { const q = st.qs[st.i]; st.hinted = true; const inp = U.$('#typein'); if (q.hint && inp && !inp.value) inp.value = q.hint; inp && inp.focus(); t.disabled = true; t.textContent = 'Đã gợi ý'; }
    else if (a === 'undo') { if (st.orderPicked.length) { st.orderPicked.pop(); drawOrder(); } }
    else if (a === 'ordercheck') { if (!st.answered) check(st.orderPicked.map(k => st.orderPool[k].w).join(' ')); }
    else if (a === 'again') { const o = Run.cur; Run.cur = null; window.TVUI.replay(o); }
    else if (a === 'back') { Run.cur = null; location.hash = st.back || '#/'; window.TVUI.route(); }
  });
  document.addEventListener('submit', e => {
    if (e.target.matches('[data-act="typeform"]')) { e.preventDefault(); const st = Run.cur; if (!st || st.answered) return; const v = U.$('#typein').value.trim(); if (!v) return; check(v); }
  });
  document.addEventListener('keydown', e => {
    const st = Run.cur; if (!st || !U.$('.game')) return;
    if (e.key === 'Enter' && st.answered) { const b = U.$('#fb [data-act="next"]'); if (b && document.activeElement !== b) { e.preventDefault(); b.click(); } return; }
    const q = st.qs[st.i]; if (!q || st.answered) return;
    if (q.kind === 'intro' && e.key === 'Enter') { const b = U.$('[data-act="next"]'); b && b.click(); return; }
    if ((q.kind === 'mcq' || q.kind === 'p1' || q.kind === 'p2') && /^[1-4a-dA-D]$/.test(e.key) && document.activeElement.tagName !== 'INPUT') {
      const i = /\d/.test(e.key) ? +e.key - 1 : 'abcd'.indexOf(e.key.toLowerCase()); if (i < q.options.length) check(i);
    }
  });
  function orderTap(k) {
    const st = Run.cur; if (st.answered) return;
    if (st.orderPicked.includes(k)) st.orderPicked = st.orderPicked.filter(x => x !== k); else st.orderPicked.push(k);
    SFX.tap(); drawOrder();
  }
  function drawOrder() {
    const st = Run.cur;
    U.$('[data-line]').innerHTML = st.orderPicked.map(k => `<button type="button" class="chipw on" data-chip="${k}">${esc(st.orderPool[k].w)}</button>`).join('');
    U.$$('.order-pool .chipw').forEach(b => { b.classList.toggle('used', st.orderPicked.includes(+b.dataset.chip)); });
  }

  /* ---------- Nối nhanh ---------- */
  function match(opts) {
    // opts: {L, back}
    const p = P.cur; TTS.unlock();
    let cards = DB.cardsByL[opts.L];
    const chosen = pickCards(p, cards, 6);
    const pairMode = chosen.every(c => c.pair);
    const left = chosen.map(c => ({ id: c.id, html: esc(pairMode ? c.q : c.t === 'ph' ? c.en : c.en.replace(/ – .*/, '')), say: pairMode ? c.q : speakText(c) }));
    const right = chosen.map(c => ({ id: c.id, html: esc(pairMode ? c.a : c.vi) }));
    const ms = { L: opts.L, back: opts.back, left: U.shuffle(left), right: U.shuffle(right), sel: null, done: new Set(), miss: new Set(), t0: Date.now(), penalty: 0, pairMode, chosen };
    Run.match = ms; document.body.classList.add('in-game');
    U.$('#app').innerHTML = `<section class="game match"><header class="ghud"><button class="x" data-mact="quit" aria-label="Thoát">✕</button><div class="mtitle">${pairMode ? 'Nối câu hỏi với câu đáp' : 'Nối từ với nghĩa'}</div><div class="timer" id="mtimer">0.0s</div></header>
      <div class="mgrid"><div class="mcol">${ms.left.map(x => `<button class="mtile en" data-mt="L:${x.id}" type="button">${x.html}</button>`).join('')}</div><div class="mcol">${ms.right.map(x => `<button class="mtile vi" data-mt="R:${x.id}" type="button">${x.html}</button>`).join('')}</div></div>
      <p class="muted center">Chạm một ô bên trái, rồi chạm ô đúng nghĩa bên phải. Nối sai bị cộng 2 giây.</p></section>`;
    ms.tick = setInterval(() => { const el = U.$('#mtimer'); if (!el) return clearInterval(ms.tick); el.textContent = (((Date.now() - ms.t0) / 1000) + ms.penalty).toFixed(1) + 's'; }, 100);
  }
  document.addEventListener('click', e => {
    const ms = Run.match; if (!ms || !U.$('.match')) return;
    if (e.target.closest('[data-mact="quit"]')) { clearInterval(ms.tick); Run.match = null; document.body.classList.remove('in-game'); location.hash = ms.back; window.TVUI.route(); return; }
    const t = e.target.closest('[data-mt]'); if (!t || t.classList.contains('gone')) return;
    const [side, id] = t.dataset.mt.split(/:(.+)/);
    if (side === 'L') { const c = DB.cardById[id]; if (c) TTS.speak(ms.pairMode ? c.q : speakText(c)); }
    if (!ms.sel || ms.sel.side === side) { U.$$('.mtile.sel').forEach(x => x.classList.remove('sel')); t.classList.add('sel'); ms.sel = { side, id, el: t }; SFX.tap(); return; }
    if (ms.sel.id === id) {
      SFX.ok(); [ms.sel.el, t].forEach(x => { x.classList.remove('sel'); x.classList.add('gone'); x.disabled = true; }); ms.done.add(id); ms.sel = null;
      if (ms.done.size === ms.chosen.length) matchEnd();
    } else {
      SFX.bad(); ms.penalty += 2; ms.miss.add(id); ms.miss.add(ms.sel.id); const a = ms.sel.el; [a, t].forEach(x => { x.classList.add('shake'); setTimeout(() => x.classList.remove('shake', 'sel'), 400); }); ms.sel = null;
    }
  });
  function matchEnd() {
    const ms = Run.match; clearInterval(ms.tick); const p = P.cur;
    const secs = (Date.now() - ms.t0) / 1000 + ms.penalty;
    ms.chosen.forEach(c => SRS.grade(p, c.id, !ms.miss.has(c.id)));
    const pts = ms.chosen.length * 5 + Math.max(0, Math.round(45 - secs));
    const st = { mode: 'match', L: ms.L, back: ms.back, pts, correct: ms.chosen.length - [...ms.miss].filter(id => ms.chosen.some(c => c.id === id)).length, total: ms.chosen.length, maxCombo: 0, wrong: [...ms.miss], qs: [], boss: false, finished: true };
    Run.match = null; Run.cur = st;
    const fast = secs < 20 && ms.miss.size === 0;
    p.stats.answered += st.total; p.stats.correct += st.correct;
    // dùng chung phần kết thúc
    const ctx = { fast, perfect: false, maxCombo: 0 };
    p.stats.sessions++; Score.touchStreak(p); Score.addPoints(p, pts); const badges = Score.checkBadges(p, ctx); P.saveNow();
    API.queue(p, { date: U.dayStr(), at: Date.now(), pts, correct: st.correct, total: st.total, mode: 'match', L: ms.L, wrong: st.wrong });
    document.body.classList.remove('in-game');
    renderEnd({ st, total: pts, notes: [`Thời gian: ${secs.toFixed(1)} giây`, fast ? 'Thần tốc! Dưới 20 giây, không nối sai' : 'Xong dưới 20 giây và không sai để nhận huy hiệu Thần tốc'], badges });
  }

  /* ---------- Thẻ từ (lật thẻ) ---------- */
  function flash(opts) {
    const p = P.cur; TTS.unlock();
    const cards = opts.cards || DB.cardsByL[opts.L];
    const fs = Run.flash = { L: opts.L, back: opts.back, cards: opts.shuffle ? U.shuffle(cards) : cards.slice(), i: 0, flipped: false, seen: new Set() };
    drawFlash();
  }
  function drawFlash() {
    const fs = Run.flash, c = fs.cards[fs.i], p = P.cur; fs.flipped = false; fs.seen.add(c.id);
    const box = SRS.box(p, c.id);
    const back = c.t === 'ph' ? `<p class="ex">Âm <span class="chip">${esc(c.snd)}</span> ${esc(c.sndName || '')}</p>` : isP1(c) ? `<p class="ex">${markHL(c.ex, [c.cl])} ${spk(c.ex)}</p><p class="vi">${esc(c.exVi)}</p>` : dialogue(c, true);
    U.$('#app').innerHTML = `<section class="flashwrap"><header class="ghud"><button class="x" data-fact="quit" aria-label="Đóng">✕</button><div class="prog"><i style="width:${Math.round((fs.i + 1) / fs.cards.length * 100)}%"></i></div><div class="gpts"><b>${fs.i + 1}</b>/${fs.cards.length}</div></header>
      <div class="flash" data-fact="flip" role="button" tabindex="0" aria-label="Lật thẻ">
        <div class="flash-face face-front">${pic(c, 'lg')}<h2 class="word">${esc(c.en)}</h2><p class="ipa">${esc(c.ipa || '')}${c.pos ? ` <i>(${esc(c.pos)})</i>` : ''}</p>${spk(speakText(c))}<p class="muted tap">Chạm để lật thẻ</p></div>
        <div class="flash-face face-back"><h2 class="word sm">${esc(c.en)}</h2><p class="mean">${esc(c.vi)}</p>${back}</div>
      </div>
      <p class="boxline">Mức nhớ: ${'●'.repeat(box)}${'○'.repeat(5 - box)}</p>
      <div class="frow"><button class="btn ghost" data-fact="prev" ${fs.i === 0 ? 'disabled' : ''}>Trước</button><button class="btn bad" data-fact="no">Chưa nhớ</button><button class="btn good" data-fact="yes">Đã nhớ</button></div></section>`;
    setTimeout(() => TTS.speak(speakText(c)), 200);
  }
  document.addEventListener('click', e => {
    const fs = Run.flash; if (!fs || !U.$('.flashwrap')) return;
    const sayBtn = e.target.closest('[data-say]'); if (sayBtn) { e.stopPropagation(); TTS.speak(sayBtn.dataset.say, sayBtn.dataset.slot); return; }
    const t = e.target.closest('[data-fact]'); if (!t) return; const a = t.dataset.fact; const p = P.cur; const c = fs.cards[fs.i];
    if (a === 'flip') { fs.flipped = !fs.flipped; U.$('.flash').classList.toggle('flipped', fs.flipped); if (fs.flipped) TTS.speak(c.ex || c.q || speakText(c)); }
    else if (a === 'prev') { if (fs.i > 0) { fs.i--; drawFlash(); } }
    else if (a === 'yes' || a === 'no') {
      const r = p.srs[c.id];
      if (a === 'no') { p.srs[c.id] = [1, U.dayNum(), (r ? r[2] : 0), (r ? r[3] : 0) + 1]; }
      else if (!r) { p.srs[c.id] = [1, U.dayNum() + 1, 0, 1]; }
      Score.addPoints(p, 2); P.save(); SFX.tap();
      if (fs.i < fs.cards.length - 1) { fs.i++; drawFlash(); } else endFlash();
    } else if (a === 'quit') endFlash();
  });
  document.addEventListener('keydown', e => { const fs = Run.flash; if (!fs || !U.$('.flashwrap')) return; if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); U.$('.flash').click(); } if (e.key === 'ArrowRight') U.$('[data-fact="yes"]').click(); if (e.key === 'ArrowLeft') U.$('[data-fact="prev"]').click(); });
  function endFlash() {
    const fs = Run.flash; Run.flash = null; const p = P.cur;
    if (fs.seen.size >= 3) { p.stats.sessions++; Score.touchStreak(p); Score.checkBadges(p, {}); P.saveNow(); API.queue(p, { date: U.dayStr(), at: Date.now(), pts: fs.seen.size * 2, correct: 0, total: 0, mode: 'flash', L: fs.L, wrong: [] }); }
    location.hash = fs.back; window.TVUI.route();
  }

  /* ---------- Luyện đề (đề trong sách) ---------- */
  function exam(set, back) {
    const qs = set.items.map(it => G.testItem(set, it));
    run({ title: set.title, qs, mode: 'test', L: set.L, back, setId: set.id });
  }

  window.TVG = { G, run, abandon, match, flash, exam, buildLessonSession, buildBoss, buildMission, Run, markHL, pic, spk, speakText, dialogue, isP1 };
})();
