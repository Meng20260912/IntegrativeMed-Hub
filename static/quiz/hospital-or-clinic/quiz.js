import {
  QUIZ_ID, QUIZ_VERSION, DIMENSIONS, QUESTIONS, MOTIVES, SUMMARY, RESULTS,
  ESCAPE_NOTES, NEAR_TIE_NOTE, ASK_LIST, OTHER_ROUTES, AUTHOR_NOTE, MBTI_TYPES, MBTI_NOTES,
} from './quiz-data.js?v=3';

const $ = (id) => document.getElementById(id);
const KEYS = ['A', 'B', 'C', 'D'];
const DIM = Object.fromEntries(DIMENSIONS.map((d) => [d.key, d]));

// 題目順序：14 題面向題依序出現（同面向兩題拆開），動機題放最後
const ORDER = [0, 2, 4, 6, 8, 10, 12, 1, 3, 5, 7, 9, 11, 13];
const STEPS = [
  ...ORDER.map((i) => ({ kind: 'q', i })),
  ...MOTIVES.map((m, i) => ({ kind: 'm', i })),
];
const TOTAL = STEPS.length;

// 選項顯示順序每次隨機打亂，避免作答者發現「A 都偏醫院」的規律；記錄仍存原始索引
const shuffle = (n) => { const a = [...Array(n).keys()]; for (let i = n - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
let perms = [];
const newPerms = () => { perms = STEPS.map((s) => (s.kind === 'q' ? shuffle(4) : [0, 1, 2, 3])); };
newPerms();

let step = 0;
const answers = new Array(QUESTIONS.length).fill(null); // 選項索引
const motives = new Array(MOTIVES.length).fill(null);
let mbti = null;
let sent = false;

function show(id) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('is-active', s.id === id));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderStep() {
  const s = STEPS[step];
  const item = s.kind === 'q' ? QUESTIONS[s.i] : MOTIVES[s.i];
  const picked = s.kind === 'q' ? answers[s.i] : motives[s.i];
  const dim = s.kind === 'q' ? DIM[item.dim] : { icon: '🔍', name: '你的動機' };

  $('p-dim').textContent = `${dim.icon} ${dim.name}`;
  $('p-count').textContent = `${step + 1} / ${TOTAL}`;
  $('p-fill').style.width = `${(step / TOTAL) * 100}%`;
  $('q-text').textContent = item.q;

  const box = $('q-opts');
  box.innerHTML = '';
  perms[step].forEach((idx, pos) => {
    const o = item.options[idx];
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'opt' + (picked === idx ? ' is-picked' : '');
    b.innerHTML = `<span class="k">${KEYS[pos]}</span><span></span>`;
    b.lastChild.textContent = o.t;
    b.addEventListener('click', () => pick(idx, b));
    box.appendChild(b);
  });

  const card = $('q-card');
  card.classList.remove('swap');
  void card.offsetWidth;
  card.classList.add('swap');
  $('btn-back').hidden = step === 0;
}

let locked = false;
function pick(idx, btn) {
  if (locked) return;
  locked = true;
  const s = STEPS[step];
  if (s.kind === 'q') answers[s.i] = idx; else motives[s.i] = idx;
  btn.parentElement.querySelectorAll('.opt').forEach((x) => x.classList.remove('is-picked'));
  btn.classList.add('is-picked');
  setTimeout(() => {
    locked = false;
    if (step < TOTAL - 1) { step++; renderStep(); }
    else { $('p-fill').style.width = '100%'; show('s-mbti'); }
  }, 260);
}

function score() {
  const dims = Object.fromEntries(DIMENSIONS.map((d) => [d.key, 0]));
  let total = 0, strong = 0;
  QUESTIONS.forEach((q, i) => {
    const v = q.options[answers[i]].v;
    dims[q.dim] += v;
    total += v;
    if (Math.abs(v) === 2) strong += Math.sign(v);
  });
  let type;
  if (total !== 0) type = total < 0 ? 'hospital' : 'clinic';
  else {
    const lean = Object.values(dims).reduce((a, v) => a + Math.sign(v), 0);
    type = lean > 0 || (lean === 0 && strong > 0) ? 'clinic' : 'hospital';
  }
  return { dims, total, type };
}

function li(text) { const el = document.createElement('li'); el.textContent = text; return el; }

function renderResult() {
  const { dims, total, type } = score();
  const R = RESULTS[type];
  const root = $('s-result');
  root.classList.toggle('is-hospital', type === 'hospital');
  root.classList.toggle('is-clinic', type === 'clinic');

  $('r-badge').innerHTML = document.querySelector(type === 'hospital' ? '.vs-h svg' : '.vs-c svg').outerHTML;
  $('r-name').textContent = R.name;
  $('r-tagline').textContent = R.tagline;
  const tie = $('r-tie');
  tie.hidden = Math.abs(total) > 3;
  tie.textContent = NEAR_TIE_NOTE;
  $('r-summary').textContent = SUMMARY;

  // 光譜
  const sp = $('r-spectra');
  sp.innerHTML = '';
  DIMENSIONS.forEach((d) => {
    const v = dims[d.key]; // -4..4
    const pct = ((v + 4) / 8) * 100;
    const lean = v < 0 ? '<span class="sp-lean h">偏醫院</span>' : v > 0 ? '<span class="sp-lean c">偏診所</span>' : '<span class="sp-lean">中間</span>';
    const row = document.createElement('div');
    row.innerHTML = `<div class="sp-name"><span>${d.icon} ${d.name}</span>${lean}</div>
      <div class="sp-track" role="img" aria-label="${d.name}：${v < 0 ? '偏醫院' : v > 0 ? '偏診所' : '中間'}"><span class="sp-dot"></span></div>
      <div class="sp-ends"><span>${d.left}</span><span>${d.right}</span></div>`;
    sp.appendChild(row);
    requestAnimationFrame(() => requestAnimationFrame(() => { row.querySelector('.sp-dot').style.left = `${pct}%`; }));
  });

  // 逃開型動機
  const notes = MOTIVES.map((m, i) => (motives[i] != null && m.options[motives[i]].escape ? ESCAPE_NOTES[m.key] : null)).filter(Boolean);
  $('r-escape-wrap').hidden = notes.length === 0;
  $('r-escape').innerHTML = '<b>離開一種累之前，先確認自己能接受另一種累</b>';
  notes.forEach((n) => { const p = document.createElement('p'); p.style.margin = '.4em 0 0'; p.textContent = n; $('r-escape').appendChild(p); });

  const good = $('r-good'); good.innerHTML = ''; R.good.forEach((t) => good.appendChild(li(t)));
  const prep = $('r-prepare'); prep.innerHTML = ''; R.prepare.forEach((t) => prep.appendChild(li(t)));

  // MBTI
  $('r-mbti-wrap').hidden = !mbti;
  if (mbti) {
    $('r-mbti-type').textContent = mbti;
    const ul = $('r-mbti'); ul.innerHTML = '';
    mbti.split('').forEach((k) => { const el = li(MBTI_NOTES[k]); el.dataset.k = k; ul.appendChild(el); });
  }

  const ask = $('r-ask'); ask.innerHTML = ''; ASK_LIST.forEach((t) => ask.appendChild(li(t)));
  $('r-author').innerHTML = '';
  AUTHOR_NOTE.forEach((t) => { const p = document.createElement('p'); p.textContent = t; $('r-author').appendChild(p); });
  const routes = $('r-routes'); routes.innerHTML = '';
  OTHER_ROUTES.forEach((r) => {
    const d = document.createElement('div'); d.className = 'route';
    d.innerHTML = '<b></b><p></p>'; d.firstChild.textContent = r.name; d.lastChild.textContent = r.text;
    routes.appendChild(d);
  });

  show('s-result');
  submit(type, total);
}

// 匿名統計：只送選項索引、結果與選填的 MBTI；不送任何個人資料
function submit(type, total) {
  if (sent || !$('consent').checked) return;
  sent = true;
  const body = JSON.stringify({ v: QUIZ_VERSION, a: answers, m: motives, t: type, s: total, mbti });
  try {
    fetch(`/api/quiz/${QUIZ_ID}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true }).catch(() => {});
  } catch { /* 統計失敗不影響測驗 */ }
}

// MBTI 選單
MBTI_TYPES.forEach((t) => {
  const b = document.createElement('button');
  b.type = 'button'; b.textContent = t;
  b.addEventListener('click', () => { mbti = t; renderResult(); });
  $('mbti-grid').appendChild(b);
});
$('btn-mbti-skip').addEventListener('click', () => { mbti = null; renderResult(); });
$('btn-back-mbti').addEventListener('click', () => { step = TOTAL - 1; show('s-quiz'); renderStep(); });

$('btn-start').addEventListener('click', () => { step = 0; show('s-quiz'); renderStep(); });
$('btn-back').addEventListener('click', () => { if (step > 0) { step--; renderStep(); } });
$('btn-retry').addEventListener('click', () => {
  answers.fill(null); motives.fill(null); mbti = null; sent = false; step = 0; newPerms();
  $('share-msg').textContent = '';
  show('s-start');
});
$('btn-share').addEventListener('click', async () => {
  const url = location.origin + location.pathname;
  const name = $('r-name').textContent;
  const text = `我測出來是「${name}」！選配前先測一下，你是醫院型還是診所型？16 題、3 分鐘：`;
  try {
    if (navigator.share) { await navigator.share({ title: '你是醫院型還是診所型？', text, url }); return; }
    await navigator.clipboard.writeText(`${text}${url}`);
    $('share-msg').textContent = '已複製連結，可以貼到 LINE 群組了！';
  } catch { /* 使用者取消分享 */ }
});
