// 口林 · 检索 · 信件 · 词条 · 分类
// 纯静态：读 5 个 json，改 json 就改了她。

const REPO = 'YOUR_NAME/koulin-dict'; // ← 改成你的 GitHub 仓库，Issue 按钮才生效

const state = {
  tab: 'corpus',
  q: '',
  meta: null, corpus: null, terms: null, cls: null, docs: null
};

const $ = (id) => document.getElementById(id);

// ---------- 文本工具 ----------

const norm = (s) => (s || '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function bigrams(s) {
  if (s.length === 0) return [];
  if (s.length === 1) return [s];
  const out = [];
  for (let i = 0; i < s.length - 1; i++) out.push(s.slice(i, i + 2));
  return out;
}

function dice(a, b) {
  if (!a.length || !b.length) return 0;
  const x = bigrams(a), y = bigrams(b);
  const cnt = new Map();
  for (const g of x) cnt.set(g, (cnt.get(g) || 0) + 1);
  let hit = 0;
  for (const g of y) {
    const n = cnt.get(g) || 0;
    if (n > 0) { hit++; cnt.set(g, n - 1); }
  }
  return (2 * hit) / (x.length + y.length);
}

function score(q, t) {
  const a = norm(q), b = norm(t);
  if (!a.length || !b.length) return 0;
  if (a === b) return 1;
  const d = dice(a, b);
  let c = 0;
  if (a.includes(b) || b.includes(a)) {
    const mn = Math.min(a.length, b.length), mx = Math.max(a.length, b.length);
    c = 0.55 + 0.4 * (mn / mx);
  }
  return Math.max(d, c);
}

function entryScore(entry, q) {
  let best = 0, trig = '';
  for (const t of entry.triggers || []) {
    const s = score(q, t);
    if (s > best) { best = s; trig = t; }
  }
  return { best, trig };
}

function snippet(text, q, radius = 34) {
  const raw = String(text || '');
  const i = raw.toLowerCase().indexOf(String(q).toLowerCase());
  if (i < 0) return raw.slice(0, radius * 2) + (raw.length > radius * 2 ? '…' : '');
  const from = Math.max(0, i - radius), to = Math.min(raw.length, i + String(q).length + radius);
  return (from > 0 ? '…' : '') + raw.slice(from, to) + (to < raw.length ? '…' : '');
}

function highlight(text, q) {
  const raw = String(text || '');
  if (!q) return esc(raw);
  const lower = raw.toLowerCase(), needle = q.toLowerCase();
  let out = '', i = 0;
  while (true) {
    const j = lower.indexOf(needle, i);
    if (j < 0) { out += esc(raw.slice(i)); break; }
    out += esc(raw.slice(i, j)) + '<mark>' + esc(raw.slice(j, j + q.length)) + '</mark>';
    i = j + q.length;
  }
  return out;
}

// ---------- 待补 ----------

const MISS_KEY = 'koulin_missing_v1';

function loadMissing() {
  try { return JSON.parse(localStorage.getItem(MISS_KEY) || '[]'); } catch { return []; }
}

function saveMissing(list) { localStorage.setItem(MISS_KEY, JSON.stringify(list.slice(-200))); }

function addMissing(q) {
  const list = loadMissing();
  if (list.some((x) => x.q === q)) return;
  list.push({ q, t: new Date().toISOString().slice(0, 16).replace('T', ' ') });
  saveMissing(list);
  renderMissing();
}

// ---------- 分类 ----------

function classInfo(code) {
  if (!code || !state.cls) return null;
  for (const top of state.cls.classes || []) {
    if (top.code === code) return { name: top.name, top: top.name };
    for (const ch of top.children || []) {
      if (ch.code === code) return { name: ch.name, top: top.name };
    }
  }
  return null;
}

function classCounts() {
  const n = {};
  for (const e of state.corpus.entries || []) n[e.cls] = (n[e.cls] || 0) + 1;
  for (const d of state.docs.docs || []) n[d.cls] = (n[d.cls] || 0) + 1;
  return n;
}

// ---------- 小工具 ----------

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

function callNo(no, cls) {
  const wrap = el('span', 'callno');
  if (no) wrap.appendChild(el('span', 'no', no));
  const ci = classInfo(cls);
  if (ci) wrap.appendChild(el('span', 'cls', ci.name));
  return wrap;
}

function go(hash) { location.hash = hash; }

// ---------- 头 / 侧栏 ----------

function renderHeader() {
  const m = state.meta;
  $('tagline').textContent = m.tagline || '';
  $('intro').textContent = m.intro || '';
  const box = $('facts');
  box.innerHTML = '';
  for (const f of m.facts || []) {
    const row = el('div', 'fact');
    row.appendChild(el('span', 'k', f.k));
    row.appendChild(el('span', 'v', f.v));
    box.appendChild(row);
  }
}

function renderSide() {
  const counts = classCounts();

  const nav = $('navlist');
  nav.innerHTML = '';
  for (const top of state.cls.classes || []) {
    const n = (top.children || []).reduce((a, c) => a + (counts[c.code] || 0), 0);
    const row = el('a', 'navrow', '');
    row.href = '#/cls/' + top.code;
    row.appendChild(el('span', 'navcode', top.code));
    row.appendChild(el('span', 'navname', top.name));
    row.appendChild(el('span', 'navn', String(n)));
    if (!n) row.classList.add('empty');
    nav.appendChild(row);
  }

  const stats = $('stats');
  stats.innerHTML = '';
  const kv = (k, v) => {
    const d = el('div', 'kvrow');
    d.appendChild(el('span', 'k', k));
    d.appendChild(el('span', 'v', v));
    stats.appendChild(d);
  };
  kv('语料', (state.corpus.entries || []).length);
  kv('信件文档', (state.docs.docs || []).length);
  kv('词条', (state.terms.terms || []).length);
  kv('类目', (state.cls.classes || []).reduce((a, c) => a + (c.children || []).length, 0));
}

// ---------- 检索 ----------

function searchAll(q) {
  const out = [];

  for (const e of state.corpus.entries || []) {
    const { best } = entryScore(e, q);
    const allText = (e.replies || []).map((r) => (r.lines || []).join('')).join('\n');
    const hitBody = norm(allText).includes(norm(q));
    if (best < 0.42 && !hitBody) continue;
    out.push({
      kind: 'corpus', score: best + (hitBody ? 0.25 : 0), e,
      snippet: hitBody ? snippet(allText, q) : (e.replies?.[0]?.lines || []).join('\n')
    });
  }

  for (const d of state.docs.docs || []) {
    const body = d.body.join('\n');
    const titleHit = norm(d.title).includes(norm(q)) || norm(d.to || '').includes(norm(q));
    const lower = body.toLowerCase(), needle = String(q).toLowerCase();
    let n = 0, i = 0;
    while (needle && (i = lower.indexOf(needle, i)) >= 0) { n++; i += needle.length; }
    if (!n && !titleHit) continue;
    out.push({ kind: 'doc', score: 0.6 + Math.min(n, 10) * 0.06 + (titleHit ? 0.2 : 0), d, snippet: n ? snippet(body, q) : d.body.slice(0, 2).join(' ') });
  }

  for (const t of state.terms.terms || []) {
    const body = (t.body || []).join('\n');
    const inTitle = norm(t.title).includes(norm(q));
    const inBody = norm(body).includes(norm(q));
    if (!inTitle && !inBody) continue;
    out.push({ kind: 'term', score: inTitle ? 0.9 : 0.55, t, snippet: snippet(body, q) });
  }

  out.sort((a, b) => b.score - a.score);
  return out.slice(0, 60);
}

function renderSearch(q) {
  const main = $('main');
  main.innerHTML = '';
  const hits = searchAll(q);
  $('stat').textContent = hits.length ? `${hits.length} 条结果` : '没有命中';

  if (!hits.length) {
    main.appendChild(el('div', 'empty', `「${q}」——她的字里还没有这句。回车把它记进「待补」。`));
    return;
  }

  for (const g of [{ kind: 'doc', title: '信件与文档' }, { kind: 'corpus', title: '语料' }, { kind: 'term', title: '词条' }]) {
    const list = hits.filter((h) => h.kind === g.kind);
    if (!list.length) continue;
    main.appendChild(el('h2', 'grp', g.title + '（' + list.length + '）'));

    for (const h of list) {
      const row = el('a', 'res');
      if (h.kind === 'corpus') {
        row.href = '#/e/' + h.e.id;
        row.appendChild(callNo(h.e.no, h.e.cls));
        row.appendChild(el('span', 'restitle', (h.e.triggers || []).slice(0, 2).join(' / ')));
      } else if (h.kind === 'doc') {
        row.href = '#/d/' + h.d.id;
        row.appendChild(callNo(h.d.no, h.d.cls));
        row.appendChild(el('span', 'restitle', h.d.title + (h.d.to ? ' → ' + h.d.to : '')));
      } else {
        row.href = '#/t/' + h.t.id;
        row.appendChild(el('span', 'restitle', h.t.title));
      }
      const p = el('span', 'ressnip');
      p.innerHTML = highlight(h.snippet, q);
      row.appendChild(p);
      main.appendChild(row);
    }
  }
}

// ---------- 列表 ----------

function renderCorpus() {
  const main = $('main');
  main.innerHTML = '';
  const q = state.q.trim();
  let rows = (state.corpus.entries || []).map((e) => ({ e, ...entryScore(e, q) }));
  if (q) rows = rows.filter((r) => r.best >= 0.42).sort((a, b) => b.best - a.best);

  $('stat').textContent = q ? `${rows.length} 条命中`
    : `${state.corpus.entries.length} 条语料 · ${(state.corpus.idle || []).length} 句自言自语`;

  const frag = document.createDocumentFragment();
  for (const { e, best } of rows) {
    const card = el('article', 'entry');
    const top = el('div', 'top');
    top.appendChild(callNo(e.no, e.cls));
    if (e.mood) top.appendChild(el('span', 'mood', e.mood));
    if (q) top.appendChild(el('span', 'chip', `匹配 ${best.toFixed(2)}`));
    for (const t of (e.triggers || []).slice(0, 6)) top.appendChild(el('span', 'chip', t));
    const open = el('a', 'openlink', '记录 →');
    open.href = '#/e/' + e.id;
    top.appendChild(open);
    card.appendChild(top);

    const ul = el('ul', 'replies');
    for (const r of e.replies || []) {
      const li = document.createElement('li');
      if (r.mood) li.appendChild(el('span', 'moodtag', r.mood));
      li.appendChild(document.createTextNode((r.lines || []).join('\n')));
      ul.appendChild(li);
    }
    card.appendChild(ul);
    frag.appendChild(card);
  }
  main.appendChild(frag);
}

function renderDocs() {
  const main = $('main');
  main.innerHTML = '';
  const q = state.q.trim();
  const docs = (state.docs.docs || []);
  $('stat').textContent = `${docs.length} 份文档`;

  for (const d of docs) {
    const card = el('article', 'doc');
    const top = el('div', 'top');
    top.appendChild(callNo(d.no, d.cls));
    const a = el('a', 'restitle', d.title + (d.to ? ' → ' + d.to : ''));
    a.href = '#/d/' + d.id;
    top.appendChild(a);
    card.appendChild(top);
    card.appendChild(el('div', 'docmeta',
      [d.from ? '写自：' + d.from : '', d.date || '', `${d.words || 0} 字`].filter(Boolean).join('　·　')));
    const p = el('p', 'docpeek', d.body.filter((x) => x.trim()).slice(1, 3).join(' '));
    card.appendChild(p);
    main.appendChild(card);
  }
}

function renderTerms() {
  const main = $('main');
  main.innerHTML = '';
  const q = state.q.trim();
  const list = (state.terms.terms || []).filter((t) => !q ||
    (t.title + ' ' + (t.tags || []).join(' ') + ' ' + (t.body || []).join(' ')).toLowerCase().includes(q.toLowerCase()));
  $('stat').textContent = `${list.length} 个词条`;

  for (const t of list) {
    const box = el('article', 'term');
    const h = el('h3');
    const a = el('a', null, t.title);
    a.href = '#/t/' + t.id;
    h.appendChild(a);
    if (t.spoiler) h.appendChild(el('span', 'sp', '剧透'));
    box.appendChild(h);
    for (const p of (t.body || []).slice(0, 2)) {
      const n = el('p');
      n.innerHTML = highlight(p, q);
      box.appendChild(n);
    }
    main.appendChild(box);
  }
}

function renderClass() {
  return renderClassPage(null);
}

function renderClassPage(focus) {
  const main = $('main');
  main.innerHTML = '';
  $('stat').textContent = `${(state.cls.classes || []).length} 个大类 · ${state.cls.scheme || ''}`;
  main.appendChild(el('p', 'hint', state.cls.note || ''));
  const counts = classCounts();

  for (const top of state.cls.classes || []) {
    if (focus && top.code !== focus) continue;
    const box = el('article', 'term');
    box.appendChild(el('h3', null, top.code + '  ' + top.name));
    if (top.desc) box.appendChild(el('p', null, top.desc));

    for (const ch of top.children || []) {
      const n = counts[ch.code] || 0;
      const row = el('div', 'clsrow');
      row.appendChild(el('span', 'no', ch.code));
      row.appendChild(el('span', 'clsname', ch.name));
      if (n) row.appendChild(el('span', 'chip', n + ' 条'));
      if (!n) row.appendChild(el('span', 'emptybadge', '空'));
      if (ch.desc) row.appendChild(el('span', 'clsdesc', ch.desc));
      box.appendChild(row);
      if (ch.example) box.appendChild(el('div', 'clsex', '「' + ch.example + '」'));
    }
    main.appendChild(box);
  }
}

function renderAbout() {
  const main = $('main');
  main.innerHTML = '';
  $('stat').textContent = '';
  const m = state.meta;
  const box = el('div', 'about');

  box.appendChild(el('h2', null, '她不会做的事'));
  const ul = document.createElement('ul');
  for (const r of m.rules || []) ul.appendChild(el('li', null, r));
  box.appendChild(ul);

  box.appendChild(el('h2', null, '作品'));
  const ul2 = document.createElement('ul');
  for (const l of m.links || []) {
    const li = document.createElement('li');
    const a = el('a', null, l.label);
    a.href = l.url; a.target = '_blank'; a.rel = 'noreferrer';
    li.appendChild(a);
    ul2.appendChild(li);
  }
  box.appendChild(ul2);

  box.appendChild(el('h2', null, '怎么扩充'));
  const ol = document.createElement('ol');
  for (const s of [
    '语料写在 data/corpus.json：triggers 触发词、replies 回应、cls 分类号。',
    '长文写在 texts/，然后 node tools/make-docs.mjs 生成 data/documents.json。',
    '一个触发只写一条回应，她会重复。',
    '触发词别太短：「垃圾」会被「这游戏好垃圾」抢走。',
    'mood 只有三种：plain / soft / tease。'
  ]) ol.appendChild(el('li', null, s));
  box.appendChild(ol);

  main.appendChild(box);
}

// ---------- 详情（文献记录） ----------

function detailHead(no, cls, title, sub) {
  const box = el('div', 'record');
  const line = el('div', 'recline');
  line.appendChild(el('span', 'bigno', no || '—'));
  const ci = classInfo(cls);
  if (ci) {
    const a = el('a', 'cls', ci.name);
    a.href = '#/cls/' + (cls.length === 3 ? cls[0] + '00' : cls);
    line.appendChild(a);
  }
  box.appendChild(line);
  if (title) box.appendChild(el('h2', 'rectitle', title));
  if (sub) box.appendChild(el('div', 'recsub', sub));
  return box;
}

function renderEntryDetail(id) {
  const e = (state.corpus.entries || []).find((x) => x.id === id);
  const main = $('main');
  main.innerHTML = '';
  if (!e) { main.appendChild(el('div', 'empty', '没有这条记录。')); return; }
  $('stat').textContent = '';

  const box = detailHead(e.no, e.cls, '', '');
  box.appendChild(el('div', 'reclabel', '触发词'));
  const trig = el('div', 'recchips');
  for (const t of e.triggers || []) trig.appendChild(el('span', 'chip', t));
  box.appendChild(trig);

  box.appendChild(el('div', 'reclabel', '她的回答'));
  const ul = el('ul', 'replies big');
  for (const r of e.replies || []) {
    const li = document.createElement('li');
    if (r.mood) li.appendChild(el('span', 'moodtag', r.mood));
    li.appendChild(document.createTextNode((r.lines || []).join('\n')));
    ul.appendChild(li);
  }
  box.appendChild(ul);

  // 同类其他记录
  const same = (state.corpus.entries || []).filter((x) => x.cls === e.cls && x.id !== e.id);
  if (same.length) {
    box.appendChild(el('div', 'reclabel', '同类'));
    const rel = el('div', 'recchips');
    for (const x of same) {
      const a = el('a', 'chip', x.triggers[0]);
      a.href = '#/e/' + x.id;
      rel.appendChild(a);
    }
    box.appendChild(rel);
  }

  // 来源文档
  const src = (state.docs.docs || []).find((d) => d.cls === e.cls);
  if (src) {
    box.appendChild(el('div', 'reclabel', '同类的文档'));
    const a = el('a', 'doclink', src.title);
    a.href = '#/d/' + src.id;
    box.appendChild(a);
  }

  box.appendChild(backLink());
  main.appendChild(box);
}

function renderDocDetail(id) {
  const d = (state.docs.docs || []).find((x) => x.id === id);
  const main = $('main');
  main.innerHTML = '';
  if (!d) { main.appendChild(el('div', 'empty', '没有这份文档。')); return; }
  $('stat').textContent = '';

  const box = detailHead(d.no, d.cls, d.title,
    [d.from ? '写自：' + d.from : '', d.to ? '致：' + d.to : '', d.date || '', `${d.words || 0} 字`].filter(Boolean).join('　·　'));

  const body = el('div', 'docbody');
  for (const line of d.body) {
    if (!line.trim()) continue;
    body.appendChild(el('p', null, line));
  }
  box.appendChild(body);
  box.appendChild(backLink());
  main.appendChild(box);
}

function renderTermDetail(id) {
  const t = (state.terms.terms || []).find((x) => x.id === id);
  const main = $('main');
  main.innerHTML = '';
  if (!t) { main.appendChild(el('div', 'empty', '没有这个词条。')); return; }
  $('stat').textContent = '';

  const box = el('div', 'record');
  box.appendChild(el('h2', 'rectitle', t.title));
  if (t.spoiler) box.appendChild(el('div', 'recsub', '含剧透'));
  for (const p of t.body || []) box.appendChild(el('p', 'docpeek', p));
  if ((t.tags || []).length) {
    const tags = el('div', 'recchips');
    for (const g of t.tags) tags.appendChild(el('span', 'chip', g));
    box.appendChild(tags);
  }
  box.appendChild(backLink());
  main.appendChild(box);
}

function backLink() {
  const a = el('a', 'backlink', '← 返回');
  a.href = '#';
  return a;
}

// ---------- 路由 ----------

function route() {
  const h = location.hash || '';
  const m = h.match(/^#\/(e|d|t)\/([\w-]+)$/);
  const c = h.match(/^#\/cls(?:\/(\d{3}))?$/);

  if (m) {
    if (m[1] === 'e') renderEntryDetail(m[2]);
    else if (m[1] === 'd') renderDocDetail(m[2]);
    else renderTermDetail(m[2]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return true;
  }
  if (c) { renderClassPage(c[1] || null); window.scrollTo({ top: 0, behavior: 'smooth' }); return true; }
  return false;
}

function setTab(tab) {
  state.tab = tab;
  for (const b of document.querySelectorAll('.tabs button[data-tab]')) {
    b.classList.toggle('on', b.dataset.tab === tab);
  }
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  render();
}

function render() {
  if (route()) return;
  if (state.q.trim()) { renderSearch(state.q.trim()); return; }
  if (state.tab === 'corpus') renderCorpus();
  else if (state.tab === 'docs') renderDocs();
  else if (state.tab === 'terms') renderTerms();
  else if (state.tab === 'cls') renderClass();
  else renderAbout();
}

function randomLine() {
  const all = [];
  for (const e of state.corpus.entries) for (const r of e.replies || []) all.push((r.lines || []).join('\n'));
  for (const id of state.corpus.idle || []) all.push(id);
  if (!all.length) return;
  $('randtext').textContent = all[Math.floor(Math.random() * all.length)];
}

function issueUrl() {
  const list = loadMissing();
  const body = ['她没接住这些话：', '', ...list.map((x) => '- ' + x.q), '', '（来自口林语料页）'].join('\n');
  return `https://github.com/${REPO}/issues/new?title=${encodeURIComponent('待补语料 ' + list.length + ' 条')}&body=${encodeURIComponent(body)}`;
}

function renderMissing() {
  const list = loadMissing();
  $('missCount').textContent = list.length ? `（${list.length}）` : '（空）';
  $('missinfo').textContent = list.length ? list.length + ' 条待补' : '暂无';
  const ul = $('missList');
  ul.innerHTML = '';
  for (const item of list.slice().reverse()) {
    const li = document.createElement('li');
    li.appendChild(el('span', null, item.q));
    li.appendChild(el('span', 't', item.t));
    ul.appendChild(li);
  }
}

// ---------- 启动 ----------

function boot() {
  Promise.all([
    fetch('data/meta.json').then((r) => r.json()),
    fetch('data/corpus.json').then((r) => r.json()),
    fetch('data/terms.json').then((r) => r.json()),
    fetch('data/classification.json').then((r) => r.json()),
    fetch('data/documents.json').then((r) => r.json()).catch(() => ({ docs: [] }))
  ]).then(([meta, corpus, terms, cls, docs]) => {
    state.meta = meta; state.corpus = corpus; state.terms = terms; state.cls = cls; state.docs = docs;

    renderHeader();
    renderSide();
    renderMissing();
    setTab('corpus');

    let typing = null;
    $('q').addEventListener('input', (e) => {
      state.q = e.target.value;
      clearTimeout(typing);
      typing = setTimeout(() => { if (location.hash) history.replaceState(null, '', location.pathname); render(); }, 90);
    });

    $('q').addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      const q = state.q.trim();
      if (!q) return;
      if (!searchAll(q).length) { addMissing(q); renderSearch(q); }
    });

    for (const b of document.querySelectorAll('.tabs button[data-tab]')) {
      b.addEventListener('click', () => { state.q = ''; $('q').value = ''; setTab(b.dataset.tab); });
    }

    $('randBtn').addEventListener('click', randomLine);

    const SIZE_KEY = 'koulin_size_v2';
    const SIZES = ['mid', 'big', 'small'];
    const LABELS = { small: '小', mid: '中', big: '大' };
    const applySize = (name) => {
      document.documentElement.classList.toggle('small', name === 'small');
      document.documentElement.classList.toggle('big', name === 'big');
      $('sizeBtn').textContent = '字号：' + LABELS[name];
      localStorage.setItem(SIZE_KEY, name);
    };
    let sizeName = localStorage.getItem(SIZE_KEY);
    if (!LABELS[sizeName]) sizeName = 'mid';
    applySize(sizeName);
    $('sizeBtn').addEventListener('click', () => {
      sizeName = SIZES[(SIZES.indexOf(sizeName) + 1) % SIZES.length];
      applySize(sizeName);
    });

    $('missIssue').addEventListener('click', () => {
      if (REPO.startsWith('YOUR_NAME')) { alert('先在 app.js 顶部把 REPO 改成你的 GitHub 仓库。'); return; }
      if (!loadMissing().length) { alert('还没有待补条目。'); return; }
      window.open(issueUrl(), '_blank');
    });

    $('missExport').addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(loadMissing(), null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'koulin-missing.json';
      a.click();
    });

    $('missClear').addEventListener('click', () => {
      if (!confirm('清空待补列表？')) return;
      saveMissing([]);
      renderMissing();
    });

    window.addEventListener('hashchange', () => { render(); });
    if (location.hash && location.hash.startsWith('#/')) render();
  }).catch((err) => {
    $('main').innerHTML = '<div class="empty">数据没读出来：' + esc(err.message) +
      '<br>直接双击本地文件会被浏览器拦住 fetch，用本地服务器或部署后再看。</div>';
  });
}

boot();
