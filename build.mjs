// 讀經典，看實證 Classics & Evidence — zero-dependency static site generator
// 執行：node build.mjs   輸出：dist/
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const POSTS_DIR = path.join(ROOT, 'content', 'posts');
const STATIC_DIR = path.join(ROOT, 'static');
const OUT = path.join(ROOT, 'dist');

// 個人品牌下的兩個網站：本站（學術）與衛教部落格（大眾）
const BLOG_URL = 'https://blog.drmjwei.net';
const SITES = [
  { url: '/', name: '讀經典，看實證', sub: 'drmjwei.net',
    audience: '中醫學生 · 臨床同業',
    desc: '中醫經典心得、研究方法學與臨床整合觀點。標示證據等級，不做療效宣稱。', here: true },
  { url: BLOG_URL, name: '魏孟鈞中醫師｜中醫內科', sub: 'blog.drmjwei.net',
    audience: '一般民眾 · 病人與家屬',
    desc: '把門診常見問題寫成看得懂的衛教：胸悶、靜脈曲張、排濕、季節保養。', here: false },
];

const SITE = {
  name: '讀經典，看實證',
  nameEn: 'Classics & Evidence',
  tagline: '從經典、研究到臨床的中醫筆記',
  desc: '讀中醫經典，也讀現代研究：經典心得、研究方法學解讀與中西醫整合的臨床觀點。',
  lang: 'zh-Hant',
};

// 正式網域。canonical / sitemap / og / RSS 一律指向這裡，
// 避免 pages.dev 與自訂網域內容重複被搜尋引擎分散權重。
const SITE_URL = process.env.SITE_URL || 'https://drmjwei.net';

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
// 圖片也加內容雜湊版本號：換圖後瀏覽器與 CDN 會立刻取得新檔，不會沿用舊快取
const imgSrc = (name) => `/img/${name}${assetVer(path.join('img', name))}`;

// 讀取 JPEG/PNG 實際尺寸，讓 width/height 屬性正確保留版面空間，避免圖片載入時跳動
function imgSize(name) {
  try {
    if (/\.svg$/i.test(name)) {
      const v = fs.readFileSync(path.join(STATIC_DIR, 'img', name), 'utf8')
        .match(/viewBox\s*=\s*["']\s*[\d.-]+\s+[\d.-]+\s+([\d.]+)\s+([\d.]+)/);
      return v ? { w: Math.round(+v[1]), h: Math.round(+v[2]) } : null;
    }
    const b = fs.readFileSync(path.join(STATIC_DIR, 'img', name));
    if (b[0] === 0x89 && b[1] === 0x50) return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) }; // PNG
    let i = 2;
    while (i < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const m = b[i + 1];
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
        return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) };
      }
      i += 2 + b.readUInt16BE(i + 2);
    }
  } catch {}
  return null;
}
const sizeAttr = (name) => { const d = imgSize(name); return d ? ` width="${d.w}" height="${d.h}"` : ''; };
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
// 參考文獻：文末清單中以「- [n] 」開頭的條目視為文獻，正文的 [n] 會連到對應條目。
// 只有清單中確實存在的編號才會轉成連結，避免產生指向不存在錨點的死連結。
const REF_LINE = /^\s*[-*]\s+\[(\d{1,3})\]\s/;
const CITE = /\[(\d{1,3})\](?!\()/g;
let REFS = new Set();
function collectRefs(src) {
  return new Set(src.split(/\r?\n/).map(l => (l.match(REF_LINE) || [])[1]).filter(Boolean));
}
function citedIds(src) {
  const text = src.split(/\r?\n/).filter(l => !REF_LINE.test(l)).join('\n');
  return new Set([...text.matchAll(CITE)].map(m => m[1]));
}

function inline(s) {
  return s
    .replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`)
    .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, a, u) => `<img src="${attr(u)}" alt="${attr(a)}" loading="lazy">`)
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, u) =>
      `<a href="${attr(u)}"${/^https?:/.test(u) ? ' target="_blank" rel="noopener noreferrer"' : ''}>${t}</a>`)
    .replace(CITE, (m, n) => REFS.has(n) ? `<a class="cite" href="#ref-${n}" aria-label="參考文獻 ${n}">[${n}]</a>` : m)
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

    // 內嵌圖表：<figure> 區塊原樣輸出，供 SVG 圖解使用（會繼承頁面的 CSS 變數，自動跟隨深色模式）
    if (/^&lt;figure/.test(line)) {
      const buf = [];
      while (i < lines.length && !/^&lt;\/figure&gt;/.test(lines[i])) buf.push(lines[i++]);
      buf.push(lines[i++] || '');
      out.push(buf.join('\n').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&'));
      continue;
    }
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
        '</tbody></table></div>' +
        // 窄螢幕上表格需橫向捲動，給一個明確的提示（CSS 控制只在手機顯示）
        '<p class="table-hint" aria-hidden="true">表格可左右滑動</p>'
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
      let isRefList = false;
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) {
        let txt = lines[i++].replace(/^\s*([-*]|\d+\.)\s+/, '');
        while (i < lines.length && lines[i].trim() && !/^\s*([-*]|\d+\.)\s+/.test(lines[i]) && !/^(#{1,6}\s|```|\|)/.test(lines[i])) {
          txt += ' ' + lines[i++].trim();
        }
        const ref = txt.match(/^\[(\d{1,3})\]\s+([\s\S]*)$/);
        if (ref && REFS.has(ref[1])) {
          isRefList = true;
          items.push(`<li id="ref-${ref[1]}" class="ref-item"><span class="ref-num">[${ref[1]}]</span> ${inline(ref[2])}</li>`);
        } else {
          items.push(`<li>${inline(txt)}</li>`);
        }
      }
      const tag = ordered ? 'ol' : 'ul';
      out.push(`<${tag}${isRefList ? ' class="ref-list"' : ''}>${items.join('')}</${tag}>`);
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
// JSON-LD 安全序列化：避免內容中的 </script> 提前關閉標籤
const jsonLd = (obj) => JSON.stringify(obj).replace(/</g, '\\u003c');

function layout({ title, desc, body, canonical, extraHead = '', bodyClass = '',
                  ogType = 'website', image = '', schema = null, showHeader = true }) {
  const img = image || `${SITE_URL}/img/banner-integrative.jpg`;
  return `<!doctype html>
<html lang="${SITE.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${attr(desc)}">
<meta name="theme-color" content="#12395f" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0e141b" media="(prefers-color-scheme: dark)">
<link rel="canonical" href="${attr(canonical)}">
<meta property="og:site_name" content="${attr(SITE.name)}">
<meta property="og:locale" content="zh_TW">
<meta property="og:title" content="${attr(title)}">
<meta property="og:description" content="${attr(desc)}">
<meta property="og:type" content="${attr(ogType)}">
<meta property="og:url" content="${attr(canonical)}">
<meta property="og:image" content="${attr(img)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${attr(title)}">
<meta name="twitter:description" content="${attr(desc)}">
<meta name="twitter:image" content="${attr(img)}">
<link rel="icon" href="/img/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/img/apple-touch-icon.png">
<link rel="alternate" type="application/rss+xml" title="${attr(SITE.name)}" href="/feed.xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700&family=Noto+Serif+TC:wght@700;900&display=swap">
<link rel="stylesheet" href="/styles.css${CSS_V}">
${schema ? `<script type="application/ld+json">${jsonLd(schema)}</script>\n` : ''}${extraHead}
</head>
<body${bodyClass ? ` class="${bodyClass}"` : ''}>
<a class="skip" href="#main">跳到主要內容</a>
${showHeader ? `<header class="site-head">
  <div class="wrap head-inner">
    <a class="brand" href="/">
      <span class="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 64 64" width="34" height="34" role="img"><circle cx="32" cy="32" r="32" fill="var(--navy,#12395f)"/><path d="M8 34h18l5-16 6 30 5-14h14" fill="none" stroke="var(--surface,#fff)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </span>
      <span class="brand-text"><b>${esc(SITE.name)}<span class="brand-en">${esc(SITE.nameEn)}</span></b><small>${esc(SITE.tagline)}</small></span>
    </a>
    <nav><a href="/">文章</a><a href="/about/">關於</a><a href="${BLOG_URL}" class="nav-blog"><span class="nav-long">衛教</span>部落格<span class="nav-arrow"> ↗</span></a></nav>
  </div>
</header>` : ''}
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
    <a class="brand-logo" href="/about/" aria-label="魏孟鈞中醫師">
      <img src="${attr(imgSrc('brand-logo-sm.png'))}" alt="魏孟鈞中醫師"${sizeAttr('brand-logo-sm.png')} loading="lazy" decoding="async">
    </a>
    <section class="sites">
      <h2>魏孟鈞的兩個網站</h2>
      <p class="sites-note">同一個人，兩種讀者。內容深度與寫法不同，但出自同一套臨床判斷。</p>
      <div class="sites-grid">
${SITES.map(x => `        <a class="site-card${x.here ? ' is-here' : ''}" href="${attr(x.url)}"${x.here ? '' : ' target="_blank" rel="noopener noreferrer"'}>
          <span class="site-aud">${esc(x.audience)}</span>
          <b>${esc(x.name)}</b>
          <span class="site-host">${esc(x.sub)}${x.here ? '（目前所在）' : ' ↗'}</span>
          <span class="site-desc">${esc(x.desc)}</span>
        </a>`).join('\n')}
      </div>
    </section>
    <p class="disclaimer"><b>免責聲明：</b>本站內容僅供醫學教育與學術討論之用，不構成診斷或治療建議。任何用藥、停藥或療法選擇，請諮詢您的醫師或藥師。</p>
    <p class="foot-meta">© ${new Date().getFullYear()} ${esc(SITE.name)} ${esc(SITE.nameEn)} · <a href="https://github.com/Meng20260912/IntegrativeMed-Hub" target="_blank" rel="noopener noreferrer">原始碼於 GitHub</a></p>
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
  REFS = collectRefs(body);
  const cited = citedIds(body);
  for (const n of cited) if (!REFS.has(n)) console.warn(`⚠ ${f}：正文引用 [${n}] 找不到對應文獻`);
  for (const n of REFS) if (!cited.has(n)) console.warn(`⚠ ${f}：文獻 [${n}] 未在正文中被引用`);
  const { html, toc } = markdown(body);
  const updated = lastUpdated(path.relative(ROOT, file), fm);
  const published = fm.date ? new Date(fm.date).toISOString() : updated;
  const words = body.replace(/\s+/g, '').length;
  return {
    slug, file, html, toc,
    title: fm.title || slug,
    author: fm.author || '魏孟鈞',
    authorName: (fm.author || '魏孟鈞').split(/\s*[\/／]\s*/)[0],
    authorAffil: (fm.author || '').split(/\s*[\/／]\s*/).slice(1).join(' · '),
    summary: fm.summary || '',
    hero: fm.hero || '',
    heroAlt: fm.heroAlt || fm.title || '',
    heroCaption: fm.heroCaption || '',
    tags: Array.isArray(fm.tags) ? fm.tags : (fm.tags ? [fm.tags] : []),
    published, updated, words,
    readMins: Math.max(1, Math.round(words / 450)),
    // 首頁搜尋索引：標題＋摘要＋標籤＋內文純文字（去 Markdown 標記與多餘空白）
    searchText: (
      (fm.title || '') + ' ' + (fm.summary || '') + ' ' +
      (Array.isArray(fm.tags) ? fm.tags.join(' ') : (fm.tags || '')) + ' ' +
      body.replace(/```[\s\S]*?```/g, ' ')
          .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
          .replace(/[#*>`|_~-]/g, ' ')
    ).replace(/\s+/g, ' ').trim().toLowerCase(),
  };
});

// 需求 7：依「最後更新時間」重新排序，最新的在前
posts.sort((a, b) => new Date(b.updated) - new Date(a.updated) || a.slug.localeCompare(b.slug));

/* ---------- 產出 ---------- */
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
fs.cpSync(STATIC_DIR, OUT, { recursive: true });

const heroImg = 'banner-integrative.jpg';
const heroCredit = CREDITS[heroImg];

// --- 首頁：卡片直接寫進 HTML（需求 6），不靠 JS 讀 JSON ---
const allTags = [...new Set(posts.flatMap(p => p.tags))].sort();
const tagCount = (t) => posts.filter(p => p.tags.includes(t)).length;

const cards = posts.map(p => `      <article class="card" data-tags="${attr(p.tags.join('|'))}" data-search="${attr(p.searchText)}">
        ${p.hero ? `<a class="card-thumb" href="/posts/${attr(p.slug)}/" tabindex="-1" aria-hidden="true"><img src="${attr(imgSrc(p.hero))}" alt="" loading="lazy" decoding="async"></a>` : ''}
        <div class="card-body">
          <p class="card-date"><time datetime="${attr(p.updated)}">${fmtDate(p.updated).replace(/-/g, '/')}</time> 更新</p>
          <h3><a href="/posts/${attr(p.slug)}/">${esc(p.title)}</a></h3>
          <p class="card-sum">${esc(p.summary)}</p>
          ${p.tags.length ? `<ul class="card-tags">${p.tags.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
          <div class="card-meta">
            <span class="m-author"><b>${esc(p.authorName)}</b>${p.authorAffil ? `<span class="affil">${esc(p.authorAffil)}</span>` : ''}</span>
            <span><time datetime="${attr(p.published)}">發布 ${fmtDate(p.published).replace(/-/g, '/')}</time></span>
            <span>瀏覽 <span class="views" data-slug="${attr(p.slug)}">–</span></span>
          </div>
        </div>
      </article>`).join('\n');

const latestPost = posts[0];
const indexBody = `<section class="hero">
  <div class="hero-cover"><img src="${attr(imgSrc(heroImg))}" alt="" fetchpriority="high" decoding="async"${sizeAttr(heroImg)}></div>
  <div class="hero-overlay"></div>
  <div class="hero-content">
    <p class="hero-en">${esc(SITE.nameEn)}</p>
    <h1>${esc(SITE.name)}</h1>
    <p class="hero-sub">把傳統中醫的辨證思維，放到現代實證醫學的檢驗架構下一起讀</p>
    <p class="hero-by">— 魏孟鈞</p>
    <p class="hero-updated">最近更新 ${fmtDate(latestPost.updated).replace(/-/g, '/')}｜<a href="/posts/${attr(latestPost.slug)}/">${esc(latestPost.title)}</a></p>
    ${heroCredit ? `<p class="hero-credit">主視覺：<a href="${attr(heroCredit.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(heroCredit.title)}</a>，${esc(heroCredit.author)}／<a href="${attr(heroCredit.licenseUrl)}" target="_blank" rel="noopener noreferrer">${esc(heroCredit.license)}</a>。完整出處見頁尾。</p>` : `<p class="hero-credit">主視覺為情境示意圖（AI 生成），非真實臨床照片。</p>`}
  </div>
</section>

<div class="wrap toolbar">
  <div class="toolbar-inner">
    <ul class="chips" id="tagChips">
      <li><button type="button" class="chip" data-tag="" aria-pressed="true">全部 <span class="n">${posts.length}</span></button></li>
${allTags.map(t => `      <li><button type="button" class="chip" data-tag="${attr(t)}" aria-pressed="false">${esc(t)} <span class="n">${tagCount(t)}</span></button></li>`).join('\n')}
    </ul>
    <div class="toolbar-row">
      <div class="search">
        <label class="skip" for="q">搜尋文章</label>
        <input type="search" id="q" placeholder="搜尋標題、摘要或標籤…" autocomplete="off">
      </div>
      <div class="toolbar-links">
        <a href="${BLOG_URL}" class="btn-blog">衛教部落格 ↗</a>
        <a href="/about/">關於本站</a>
        <a href="/feed.xml">RSS</a>
      </div>
    </div>
  </div>
</div>

<section class="wrap posts">
  <div class="posts-head">
    <h2>全部文章</h2>
    <p class="count" id="resultCount">${posts.length} 篇 · 依最後更新時間排序</p>
  </div>
  <div class="grid" id="grid">
${cards}
  </div>
  <p class="no-result" id="noResult" hidden>沒有符合的文章。試試其他關鍵字或標籤。</p>
</section>`;

fs.writeFileSync(path.join(OUT, 'index.html'), layout({
  title: `${SITE.name}｜${SITE.nameEn}`,
  desc: SITE.desc, canonical: SITE_URL + '/', body: indexBody, bodyClass: 'is-home',
  image: `${SITE_URL}/img/${heroImg}`,
  showHeader: false,
  extraHead: `<script src="/views.js${VIEWS_V}" defer></script>\n<script src="/filter.js${assetVer('filter.js')}" defer></script>`,
  schema: {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        url: `${SITE_URL}/`,
        name: SITE.name,
        alternateName: SITE.nameEn,
        description: SITE.desc,
        inLanguage: 'zh-Hant-TW',
      },
      {
        '@type': 'Blog',
        '@id': `${SITE_URL}/#blog`,
        url: `${SITE_URL}/`,
        name: SITE.name,
        isPartOf: { '@id': `${SITE_URL}/#website` },
        inLanguage: 'zh-Hant-TW',
        blogPost: posts.map(p => ({
          '@type': 'BlogPosting',
          headline: p.title,
          url: `${SITE_URL}/posts/${p.slug}/`,
          datePublished: p.published,
          dateModified: p.updated,
          author: { '@type': 'Person', name: p.authorName },
        })),
      },
    ],
  },
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
    <img src="${attr(imgSrc(p.hero))}" alt="${attr(p.heroAlt)}" decoding="async" fetchpriority="high"${sizeAttr(p.hero)}>
    ${c ? `<figcaption>圖：<a href="${attr(c.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(c.title)}</a>，${esc(c.author)}／<a href="${attr(c.licenseUrl)}" target="_blank" rel="noopener noreferrer">${esc(c.license)}</a></figcaption>` : (p.heroCaption ? `<figcaption>${esc(p.heroCaption)}</figcaption>` : '')}
  </figure>` : ''}
  ${p.toc.length >= 4 ? `<nav class="wrap toc" aria-label="本文章節">
    <h2>本文章節</h2>
    <ol>
${p.toc.map(t => `      <li><a href="#${attr(t.id)}">${t.txt}</a></li>`).join('\n')}
    </ol>
  </nav>` : ''}
  <div class="wrap prose">
${p.html}
  </div>
  <div class="wrap post-foot">
    <p class="updated-note">本文最後更新於 <time datetime="${attr(p.updated)}">${fmtDate(p.updated)}</time>，更新日期由 Git 提交時間自動產生。</p>
    <a class="back" href="/">← 回文章列表</a>
  </div>
</article>`;
  const url = `${SITE_URL}/posts/${p.slug}/`;
  // 臉書、LINE 的分享預覽不支援 SVG，SVG 主圖改用站台 banner
  const ogImage = `${SITE_URL}/img/${p.hero && !p.hero.endsWith('.svg') ? p.hero : heroImg}`;
  fs.writeFileSync(path.join(dir, 'index.html'), layout({
    title: `${p.title} — ${SITE.name}`,
    desc: p.summary || SITE.desc,
    canonical: url,
    body, bodyClass: 'is-post',
    ogType: 'article',
    image: ogImage,
    extraHead: [
      `<meta property="article:published_time" content="${attr(p.published)}">`,
      `<meta property="article:modified_time" content="${attr(p.updated)}">`,
      `<meta property="article:author" content="${attr(p.authorName)}">`,
      ...p.tags.map(t => `<meta property="article:tag" content="${attr(t)}">`),
      `<script src="/views.js${VIEWS_V}" defer></script>`,
    ].join('\n'),
    schema: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'BlogPosting',
          '@id': `${url}#article`,
          headline: p.title,
          description: p.summary,
          url,
          mainEntityOfPage: { '@type': 'WebPage', '@id': url },
          datePublished: p.published,
          dateModified: p.updated,
          inLanguage: 'zh-Hant-TW',
          wordCount: p.words,
          keywords: p.tags.join(', '),
          image: [ogImage],
          author: {
            '@type': 'Person',
            name: p.authorName,
            ...(p.authorAffil ? { affiliation: { '@type': 'Organization', name: p.authorAffil } } : {}),
          },
          publisher: { '@type': 'Organization', name: SITE.name, url: `${SITE_URL}/` },
          isPartOf: { '@id': `${SITE_URL}/#blog` },
          license: 'https://creativecommons.org/licenses/by/4.0/',
        },
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: '文章', item: `${SITE_URL}/` },
            { '@type': 'ListItem', position: 2, name: p.title, item: url },
          ],
        },
      ],
    },
  }));
}

// --- 關於頁 ---
fs.mkdirSync(path.join(OUT, 'about'), { recursive: true });
fs.writeFileSync(path.join(OUT, 'about', 'index.html'), layout({
  title: `關於 — ${SITE.name}`, desc: SITE.desc, canonical: SITE_URL + '/about/',
  body: `<div class="wrap page-logo"><img src="${attr(imgSrc('brand-logo.png'))}" alt="魏孟鈞中醫師"${sizeAttr('brand-logo.png')} fetchpriority="high" decoding="async"></div>
<div class="wrap prose page">
<h1>關於作者</h1>
<figure class="about-profile"><img src="${attr(imgSrc('about-profile.jpg'))}" alt="魏孟鈞醫師個人介紹圖：台北慈濟醫院中醫部中醫內科主治醫師，列出現職、專長領域、研究方向與醫療特色"${sizeAttr('about-profile.jpg')} decoding="async"></figure>
<p><strong>魏孟鈞</strong>，台北慈濟醫院中醫部中醫內科主治醫師。</p>
<ul>
<li><strong>專長領域：</strong>心血管疾病調理、周邊動脈疾病照護、重症與術後整合照護、安寧緩和醫療、代謝與內分泌失調</li>
<li><strong>研究方向：</strong>中西醫整合醫療、雷射針灸與循環改善、中藥抗發炎機轉研究、心血管保護與重症照護</li>
</ul>
<p>寫給一般民眾的衛教文章，放在<a href="${BLOG_URL}" target="_blank" rel="noopener noreferrer">魏孟鈞中醫師衛教部落格</a>。</p>
<h2>關於本站</h2>
<p>「讀經典，看實證」（Classics &amp; Evidence）是一個中醫學習筆記站，內容包含中醫經典的讀書心得、現代研究的方法學解讀，以及兩者如何落到臨床。這裡整理中西兩套醫學在<strong>概念、證據與臨床實作</strong>上如何對話、又在哪裡衝突，不做療效宣稱。</p>
<h3>編輯原則</h3>
<ul>
<li>任何療效陳述都標示證據等級與來源，區分「有隨機對照試驗支持」「僅有機轉推論」「僅有傳統經驗」。</li>
<li>藥物交互作用一律以具體成分、機轉與臨床後果描述，不使用「純天然所以安全」這類說法。</li>
<li>不確定就寫不確定。方法學上的限制會直接寫出來。</li>
</ul>
<h3>技術</h3>
<p>純靜態網站，由零依賴的 Node 腳本把 Markdown 產生成 HTML，部署於 Cloudflare Pages。首頁文章卡片在建置階段就寫入 HTML，不靠瀏覽器端 JavaScript 產生。瀏覽計數使用 Cloudflare KV，不使用第三方追蹤服務、不放置 Cookie。</p>
<h3>授權</h3>
<p>文字內容採 CC BY 4.0。圖片各自標示原作者與授權，詳見頁尾。</p>
</div>`,
}));

// --- sitemap / robots ---
const newest = posts.length ? posts[0].updated.slice(0, 10) : new Date().toISOString().slice(0, 10);
const urls = ['/', '/about/', ...posts.map(p => `/posts/${p.slug}/`)];
fs.writeFileSync(path.join(OUT, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  urls.map(u => {
    const p = posts.find(x => `/posts/${x.slug}/` === u);
    const lastmod = p ? p.updated.slice(0, 10) : newest;           // 首頁／關於頁也給 lastmod
    const priority = u === '/' ? '1.0' : (p ? '0.8' : '0.5');
    return `  <url><loc>${SITE_URL}${u}</loc><lastmod>${lastmod}</lastmod><priority>${priority}</priority></url>`;
  }).join('\n') + `\n</urlset>\n`);
fs.writeFileSync(path.join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap.xml\n`);

// --- RSS ---
const rssDate = (iso) => new Date(iso).toUTCString();
fs.writeFileSync(path.join(OUT, 'feed.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>${esc(SITE.name)} ${esc(SITE.nameEn)}</title>
  <link>${SITE_URL}/</link>
  <description>${esc(SITE.desc)}</description>
  <language>zh-Hant-TW</language>
  <lastBuildDate>${rssDate(posts.length ? posts[0].updated : new Date().toISOString())}</lastBuildDate>
  <atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml"/>
${posts.map(p => `  <item>
    <title>${esc(p.title)}</title>
    <link>${SITE_URL}/posts/${p.slug}/</link>
    <guid isPermaLink="true">${SITE_URL}/posts/${p.slug}/</guid>
    <pubDate>${rssDate(p.published)}</pubDate>
    <author>${esc(p.authorName)}</author>
${p.tags.map(t => `    <category>${esc(t)}</category>`).join('\n')}
    <description>${esc(p.summary)}</description>
  </item>`).join('\n')}
</channel>
</rss>\n`);

console.log(`✓ built ${posts.length} posts → dist/`);
for (const p of posts) console.log(`  /posts/${p.slug}/  更新 ${fmtDate(p.updated)}  發布 ${fmtDate(p.published)}  — ${p.title}`);
