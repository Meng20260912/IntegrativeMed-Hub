// IntegrativeMed-Hub — zero-dependency static site generator
// 執行：node build.mjs   輸出：dist/
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const POSTS_DIR = path.join(ROOT, 'content', 'posts');
const STATIC_DIR = path.join(ROOT, 'static');
const OUT = path.join(ROOT, 'dist');

const SITE = {
  name: 'IntegrativeMed-Hub',
  tagline: '中西醫整合醫學學習網站',
  desc: '整合傳統中醫與現代西醫的知識體系：實證回顧、臨床整合觀點與學習資源。',
  lang: 'zh-Hant',
};

const CREDITS = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'credits.json'), 'utf8'));

// 資產版本號：/styles.css 與 /views.js 沒有內容雜湊檔名，而 Cloudflare 給
// 它們 max-age=14400。改版後 HTML 會即時更新、CSS 卻可能還是舊的（頁首標誌
// 就這樣白掉過一次）。用內容雜湊當 query string，改一次就換一次網址。
const assetVer = (rel) => {
  try {
    const h = createHash('sha1').update(fs.readFileSync(path.join(STATIC_DIR, rel))).digest('hex');
    return `?v=${h.slice(0, 8)}`;
  } catch { return ''; }
};
const CSS_V = assetVer('styles.css');
const VIEWS_V = assetVer('views.js');

/* ---------- utils ---------- */
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const attr = (s) => esc(s).replace(/'/g, '&#39;');

/* ---------- git-aware 最後更新時間 ---------- */
function sh(cmd) {
  try { return execSync(cmd, { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); }
  catch { return ''; }
}
// 若是 shallow clone（部分 CI 預設），先補齊歷史，否則每個檔案會拿到同一個 commit 日期
(function ensureFullHistory() {
  if (sh('git rev-parse --is-shallow-repository') === 'true') {
    sh('git fetch --unshallow --quiet') || sh('git fetch --depth=2147483647 --quiet');
  }
})();

function lastUpdated(file, fm) {
  const g = sh(`git log -1 --format=%cI -- "${file.replace(/"/g, '\\"')}"`);
  if (g) return g;                                   // 1. git 提交時間（自動）
  if (fm.updated) return new Date(fm.updated).toISOString();  // 2. frontmatter 覆寫
  try { return fs.statSync(file).mtime.toISOString(); } catch {}  // 3. 檔案 mtime
  return new Date().toISOString();
}

const fmtDate = (iso) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/* ---------- frontmatter ---------- */
function parseFrontmatter(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { fm: {}, body: raw };
  const fm = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z_][\w-]*)\s*:\s*(.*)$/);
    if (!kv) continue;
    let v = kv[2].trim();
    if (/^\[.*\]$/.test(v)) {
      fm[kv[1]] = v.slice(1, -1).split(',').map(s => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
    } else {
      fm[kv[1]] = v.replace(/^["']|["']$/g, '');
    }
  }
  return { fm, body: raw.slice(m[0].length) };
}

/* ---------- 極簡 Markdown 渲染器 ---------- */
function inline(s) {
  return s
    .replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`)
    .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, a, u) => `<img src="${attr(u)}" alt="${attr(a)}" loading="lazy">`)
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, u) =>
      `<a href="${attr(u)}"${/^https?:/.test(u) ? ' target="_blank" rel="noopener noreferrer"' : ''}>${t}</a>`)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
}

function slugifyHeading(t) {
  return t.toLowerCase().replace(/<[^>]+>/g, '').replace(/[^\w一-鿿]+/g, '-').replace(/^-|-$/g, '');
}

function markdown(src) {
  const lines = esc(src).split(/\r?\n/);
  const out = [];
  const toc = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) { i++; continue; }

    // 圍籬程式碼
    if (/^```/.test(line)) {
      const buf = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
      i++;
      out.push(`<pre><code>${buf.join('\n')}</code></pre>`);
      continue;
    }
    // 水平線
    if (/^(---|\*\*\*|___)\s*$/.test(line)) { out.push('<hr>'); i++; continue; }
    // 標題
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      const lvl = h[1].length, txt = inline(h[2].trim()), id = slugifyHeading(h[2]);
      if (lvl === 2) toc.push({ id, txt });
      out.push(`<h${lvl} id="${attr(id)}">${txt}</h${lvl}>`);
      i++; continue;
    }
    // 表格
    if (/^\|/.test(line) && i + 1 < lines.length && /^\|[\s:|-]+\|?\s*$/.test(lines[i + 1])) {
      const cells = (r) => r.replace(/^\||\|$/g, '').split('|').map(c => inline(c.trim()));
      const head = cells(line);
      i += 2;
      const body = [];
      while (i < lines.length && /^\|/.test(lines[i])) body.push(cells(lines[i++]));
      out.push(
        '<div class="table-wrap"><table><thead><tr>' +
        head.map(c => `<th>${c}</th>`).join('') + '</tr></thead><tbody>' +
        body.map(r => '<tr>' + r.map(c => `<td>${c}</td>`).join('') + '</tr>').join('') +
        '</tbody></table></div>'
      );
      continue;
    }
    // 引言
    if (/^&gt;\s?/.test(line)) {
      const buf = [];
      while (i < lines.length && /^&gt;\s?/.test(lines[i])) buf.push(lines[i++].replace(/^&gt;\s?/, ''));
      out.push(`<blockquote>${markdown(buf.join('\n').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&')).html}</blockquote>`);
      continue;
    }
    // 清單
    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\./.test(line);
      const items = [];
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) {
        let txt = lines[i++].replace(/^\s*([-*]|\d+\.)\s+/, '');
        while (i < lines.length && lines[i].trim() && !/^\s*([-*]|\d+\.)\s+/.test(lines[i]) && !/^(#{1,6}\s|```|\|)/.test(lines[i])) {
          txt += ' ' + lines[i++].trim();
        }
        items.push(`<li>${inline(txt)}</li>`);
      }
      out.push(`<${ordered ? 'ol' : 'ul'}>${items.join('')}</${ordered ? 'ol' : 'ul'}>`);
      continue;
    }
    // 段落
    const buf = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|```|&gt;|\s*([-*]|\d+\.)\s|\||---\s*$)/.test(lines[i])) {
      buf.push(lines[i++]);
    }
    if (buf.length) out.push(`<p>${inline(buf.join(' '))}</p>`);
    else i++;
  }
  return { html: out.join('\n'), toc };
}

/* ---------- 版面 ---------- */
function layout({ title, desc, body, canonical, extraHead = '', bodyClass = '' }) {
  return `<!doctype html>
<html lang="${SITE.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${attr(desc)}">
<link rel="canonical" href="${attr(canonical)}">
<meta property="og:title" content="${attr(title)}">
<meta property="og:description" content="${attr(desc)}">
<meta property="og:type" content="website">
<link rel="icon" href="/img/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/img/apple-touch-icon.png">
<link rel="stylesheet" href="/styles.css${CSS_V}">
${extraHead}
</head>
<body${bodyClass ? ` class="${bodyClass}"` : ''}>
<a class="skip" href="#main">跳到主要內容</a>
<header class="site-head">
  <div class="wrap head-inner">
    <a class="brand" href="/">
      <span class="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 64 64" width="34" height="34"><circle cx="32" cy="32" r="32" fill="var(--accent,#8a2f2a)"/><path d="M8 34h18l5-16 6 30 5-14h14" fill="none" stroke="var(--bg,#fbfaf7)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </span>
      <span class="brand-text"><b>IntegrativeMed-Hub</b><small>中西醫整合醫學學習網站</small></span>
    </a>
    <nav><a href="/">文章</a><a href="/about/">關於</a></nav>
  </div>
</header>
<main id="main">
${body}
</main>
<footer class="site-foot">
  <div class="wrap">
    <section class="credits">
      <h2>圖片出處與授權</h2>
      <p class="credits-note">本站圖片採用 Creative Commons 姓名標示（CC BY）授權，依授權條款標示作者、授權條件、來源與修改狀況。</p>
      <ul>
${Object.entries(CREDITS).map(([f, c]) => `        <li><span class="cf">${esc(f)}</span>「<a href="${attr(c.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(c.title)}</a>」，作者 <b>${esc(c.author)}</b>，授權 <a href="${attr(c.licenseUrl)}" target="_blank" rel="noopener noreferrer">${esc(c.license)}</a>，經本站${esc(c.modified)}。</li>`).join('\n')}
      </ul>
    </section>
    <p class="disclaimer"><b>免責聲明：</b>本站內容僅供醫學教育與學術討論之用，不構成診斷或治療建議。任何用藥、停藥或療法選擇，請諮詢您的醫師或藥師。</p>
    <p class="foot-meta">© ${new Date().getFullYear()} IntegrativeMed-Hub · <a href="https://github.com/Meng20260912/IntegrativeMed-Hub" target="_blank" rel="noopener noreferrer">原始碼於 GitHub</a></p>
  </div>
</footer>
</body>
</html>`;
}

/* ---------- 讀取文章 ---------- */
fs.mkdirSync(POSTS_DIR, { recursive: true });
const posts = fs.readdirSync(POSTS_DIR).filter(f => f.endsWith('.md')).map(f => {
  const file = path.join(POSTS_DIR, f);
  const raw = fs.readFileSync(file, 'utf8');
  const { fm, body } = parseFrontmatter(raw);
  const slug = fm.slug || f.replace(/\.md$/, '').replace(/^\d{4}-\d{2}-\d{2}-/, '');
  const { html, toc } = markdown(body);
  const updated = lastUpdated(path.relative(ROOT, file), fm);
  const published = fm.date ? new Date(fm.date).toISOString() : updated;
  const words = body.replace(/\s+/g, '').length;
  return {
    slug, file, html, toc,
    title: fm.title || slug,
    author: fm.author || 'IntegrativeMed-Hub 編輯部',
    authorName: (fm.author || 'IntegrativeMed-Hub 編輯部').split(/\s*[\/／]\s*/)[0],
    authorAffil: (fm.author || '').split(/\s*[\/／]\s*/).slice(1).join(' · '),
    summary: fm.summary || '',
    hero: fm.hero || '',
    heroAlt: fm.heroAlt || fm.title || '',
    tags: Array.isArray(fm.tags) ? fm.tags : (fm.tags ? [fm.tags] : []),
    published, updated,
    readMins: Math.max(1, Math.round(words / 450)),
  };
});

// 需求 7：依「最後更新時間」重新排序，最新的在前
posts.sort((a, b) => new Date(b.updated) - new Date(a.updated) || a.slug.localeCompare(b.slug));

/* ---------- 產出 ---------- */
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
fs.cpSync(STATIC_DIR, OUT, { recursive: true });

// 正式網域。canonical / sitemap / og 一律指向這裡，避免 pages.dev 與自訂網域內容重複被搜尋引擎分散權重。
const SITE_URL = process.env.SITE_URL || 'https://drmjwei.net';

const heroImg = 'hero-tcm-shop.jpg';
const heroCredit = CREDITS[heroImg];

// --- 首頁：卡片直接寫進 HTML（需求 6），不靠 JS 讀 JSON ---
const cards = posts.map(p => `      <article class="card">
        ${p.hero ? `<a class="card-media" href="/posts/${attr(p.slug)}/" tabindex="-1" aria-hidden="true"><img src="/img/${attr(p.hero)}" alt="" loading="lazy" decoding="async"></a>` : ''}
        <div class="card-body">
          <h3><a href="/posts/${attr(p.slug)}/">${esc(p.title)}</a></h3>
          <p class="card-sum">${esc(p.summary)}</p>
          <ul class="card-meta">
            <li class="m-author"><b>${esc(p.authorName)}</b>${p.authorAffil ? `<span class="affil">${esc(p.authorAffil)}</span>` : ''}</li>
            <li><time datetime="${attr(p.published)}">發布 ${fmtDate(p.published)}</time></li>
            <li><time datetime="${attr(p.updated)}">更新 ${fmtDate(p.updated)}</time></li>
            <li class="m-views">瀏覽 <span class="views" data-slug="${attr(p.slug)}">–</span></li>
          </ul>
        </div>
      </article>`).join('\n');

const indexBody = `<section class="hero">
  <div class="hero-media">
    <img src="/img/${attr(heroImg)}" alt="傳統中藥行的藥櫃與陳列" fetchpriority="high" decoding="async" width="1600" height="867">
  </div>
  <div class="wrap hero-copy">
    <h1>中西醫整合醫學<br><span>學習筆記</span></h1>
    <p>把傳統中醫的辨證思維，放到現代實證醫學的檢驗架構下一起讀。這裡整理臨床整合模式、藥物交互作用、研究方法學與證據現況。</p>
    <p class="hero-credit">首頁主視覺：<a href="${attr(heroCredit.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(heroCredit.title)}</a>，${esc(heroCredit.author)}／<a href="${attr(heroCredit.licenseUrl)}" target="_blank" rel="noopener noreferrer">${esc(heroCredit.license)}</a>。完整出處見頁尾。</p>
  </div>
</section>

<section class="wrap posts">
  <div class="posts-head">
    <h2>全部文章</h2>
    <p class="count">${posts.length} 篇 · 依最後更新時間排序</p>
  </div>
  <div class="grid">
${cards}
  </div>
</section>`;

fs.writeFileSync(path.join(OUT, 'index.html'), layout({
  title: `${SITE.name} — ${SITE.tagline}`,
  desc: SITE.desc, canonical: SITE_URL + '/', body: indexBody, bodyClass: 'is-home',
  extraHead: `<script src="/views.js${VIEWS_V}" defer></script>`,
}));

// --- 文章頁：各自獨立網址 /posts/<slug>/（需求 2） ---
for (const p of posts) {
  const c = p.hero ? CREDITS[p.hero] : null;
  const dir = path.join(OUT, 'posts', p.slug);
  fs.mkdirSync(dir, { recursive: true });
  const body = `<article class="post">
  <header class="wrap post-head">
    ${p.tags.length ? `<p class="tags">${p.tags.map(t => `<span>${esc(t)}</span>`).join('')}</p>` : ''}
    <h1>${esc(p.title)}</h1>
    ${p.summary ? `<p class="lede">${esc(p.summary)}</p>` : ''}
    <ul class="post-meta">
      <li class="m-author"><span class="lbl">作者</span> <b>${esc(p.authorName)}</b>${p.authorAffil ? `<span class="affil">${esc(p.authorAffil)}</span>` : ''}</li>
      <li><span class="lbl">發布</span> <time datetime="${attr(p.published)}">${fmtDate(p.published)}</time></li>
      <li><span class="lbl">最後更新</span> <time datetime="${attr(p.updated)}">${fmtDate(p.updated)}</time></li>
      <li><span class="lbl">閱讀</span> 約 ${p.readMins} 分鐘</li>
      <li><span class="lbl">瀏覽</span> <span class="views" data-slug="${attr(p.slug)}" data-count>–</span></li>
    </ul>
  </header>
  ${p.hero ? `<figure class="post-hero">
    <img src="/img/${attr(p.hero)}" alt="${attr(p.heroAlt)}" decoding="async">
    ${c ? `<figcaption>圖：<a href="${attr(c.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(c.title)}</a>，${esc(c.author)}／<a href="${attr(c.licenseUrl)}" target="_blank" rel="noopener noreferrer">${esc(c.license)}</a></figcaption>` : ''}
  </figure>` : ''}
  <div class="wrap prose">
${p.html}
  </div>
  <div class="wrap post-foot">
    <p class="updated-note">本文最後更新於 <time datetime="${attr(p.updated)}">${fmtDate(p.updated)}</time>，更新日期由 Git 提交時間自動產生。</p>
    <a class="back" href="/">← 回文章列表</a>
  </div>
</article>`;
  fs.writeFileSync(path.join(dir, 'index.html'), layout({
    title: `${p.title} — ${SITE.name}`,
    desc: p.summary || SITE.desc,
    canonical: `${SITE_URL}/posts/${p.slug}/`,
    body, bodyClass: 'is-post',
    extraHead: `<script src="/views.js${VIEWS_V}" defer></script>`,
  }));
}

// --- 關於頁 ---
fs.mkdirSync(path.join(OUT, 'about'), { recursive: true });
fs.writeFileSync(path.join(OUT, 'about', 'index.html'), layout({
  title: `關於 — ${SITE.name}`, desc: SITE.desc, canonical: SITE_URL + '/about/',
  body: `<div class="wrap prose page">
<h1>關於本站</h1>
<p>IntegrativeMed-Hub 是一個中西醫整合醫學的學習筆記站。這裡不談療效宣稱，而是整理兩套醫學體系在<strong>概念、證據與臨床實作</strong>上如何對話、又在哪裡衝突。</p>
<h2>編輯原則</h2>
<ul>
<li>任何療效陳述都標示證據等級與來源，區分「有隨機對照試驗支持」「僅有機轉推論」「僅有傳統經驗」。</li>
<li>藥物交互作用一律以具體成分、機轉與臨床後果描述，不使用「純天然所以安全」這類說法。</li>
<li>不確定就寫不確定。方法學上的限制會直接寫出來。</li>
</ul>
<h2>技術</h2>
<p>純靜態網站，由零依賴的 Node 腳本把 Markdown 產生成 HTML，部署於 Cloudflare Pages。首頁文章卡片在建置階段就寫入 HTML，不靠瀏覽器端 JavaScript 產生。瀏覽計數使用 Cloudflare KV，不使用第三方追蹤服務、不放置 Cookie。</p>
<h2>授權</h2>
<p>文字內容採 CC BY 4.0。圖片各自標示原作者與授權，詳見頁尾。</p>
</div>`,
}));

// --- sitemap / robots ---
const urls = ['/', '/about/', ...posts.map(p => `/posts/${p.slug}/`)];
fs.writeFileSync(path.join(OUT, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  urls.map(u => {
    const p = posts.find(x => `/posts/${x.slug}/` === u);
    return `  <url><loc>${SITE_URL}${u}</loc>${p ? `<lastmod>${p.updated.slice(0, 10)}</lastmod>` : ''}</url>`;
  }).join('\n') + `\n</urlset>\n`);
fs.writeFileSync(path.join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap.xml\n`);

console.log(`✓ built ${posts.length} posts → dist/`);
for (const p of posts) console.log(`  /posts/${p.slug}/  更新 ${fmtDate(p.updated)}  發布 ${fmtDate(p.published)}  — ${p.title}`);
