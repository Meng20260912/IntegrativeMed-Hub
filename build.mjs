// 讀經典，看實證 Classics & Evidence — zero-dependency static site generator
// 執行：node build.mjs   輸出：dist/
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { scanSimplified, reportSimplified } from './scripts/check-simplified.mjs';

// 稿件不得出現簡體字（含圖說、標題、摘要）。發現就擋下建置，不要讓它上線。
{
  const hits = scanSimplified();
  if (hits.length) {
    console.error('\n' + reportSimplified(hits) + '\n');
    process.exit(1);
  }
}

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const POSTS_DIR = path.join(ROOT, 'content', 'posts');
const STATIC_DIR = path.join(ROOT, 'static');
const OUT = path.join(ROOT, 'dist');

// 個人品牌下的兩個網站：本站（學術）與衛教部落格（大眾）
const BLOG_URL = 'https://blog.drmjwei.net';
const TOOLS_URL = 'https://tools.drmjwei.net';
// 給中醫住院醫師的線上工具（免登入、免費、資料不離開瀏覽器）
const TOOLS = [
  { url: TOOLS_URL + '/?src=footer', name: '病因病機圖工作台', host: 'tools.drmjwei.net',
    audience: '中醫住院醫師 · 實習醫師',
    desc: '貼上病例報告的理法病機分析，產生可編輯的病因病機圖與檢核清單，並匯出 PowerPoint。' },
];
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
  tagline: '讀中醫經典與現代研究，也寫臨床與教育的觀點',
  desc: '讀中醫經典，也讀現代研究：經典心得、研究方法學解讀與中西醫整合的臨床觀點。',
  lang: 'zh-Hant',
};

// 文章分類（標籤頁）。每篇文章在 frontmatter 以 category: <slug> 指定分類；
// 跨兩類的文章寫 category: [classics, clinic-notes]，列在第一個的是「主分類」：
// 文章頁導覽列高亮、麵包屑、首頁卡片標籤都用主分類，其餘分類只多出現在對應的分類頁與文章頁標籤。
// 順序即導覽列順序。細部關鍵字仍用 tags。
const CATEGORIES = [
  { slug: 'evidence', name: '讀懂實證', desc: '研究方法學、試驗設計與證據分級。一篇研究的結論能相信到什麼程度，從方法學段落讀起。' },
  { slug: 'medical-updates', name: '西醫新知速寫', desc: '與中西醫合療相關的現代醫學新指引、新藥與重要研究。' },
  { slug: 'tcm-theory', name: '中醫理論新讀', desc: '臟腑、氣血、經絡等中醫理論，放到現代生理與病理的脈絡裡重新理解。' },
  { slug: 'classics', name: '經典夜讀', desc: '中醫典籍的讀書心得，連結臨床上的觀察與思考。' },
  { slug: 'clinic-notes', name: '診間筆記', desc: '用藥安全、針灸與中西醫合療的臨床實務，以及看診時的觀察。' },
  { slug: 'translational', name: '轉譯研究工作坊', desc: '從實驗室到病床：生物醫學與中醫藥轉譯研究的設計、工具與經驗。' },
  { slug: 'books-podcasts', name: '書單與 Podcast', desc: '值得推薦的醫學書籍與 Podcast。' },
  { slug: 'beyond-white-coat', name: '白袍之外', desc: '醫療行政、中醫教育與行醫路上的雜想。' },
];
const CAT = Object.fromEntries(CATEGORIES.map(c => [c.slug, c]));

// 作者（Person）結構化資料：讓搜尋引擎把文章作者連到同一個人與其學經歷、粉專、部落格
const FB_URL = 'https://www.facebook.com/profile.php?id=61557561663928';

// 正式網域。canonical / sitemap / og / RSS 一律指向這裡，
// 避免 pages.dev 與自訂網域內容重複被搜尋引擎分散權重。
const SITE_URL = process.env.SITE_URL || 'https://drmjwei.net';
const AUTHOR_ID = `${SITE_URL}/about/#person`;
const AUTHOR_REF = { '@type': 'Person', '@id': AUTHOR_ID, name: '魏孟鈞', url: `${SITE_URL}/about/` };
const PERSON = {
  '@type': 'Person',
  '@id': AUTHOR_ID,
  name: '魏孟鈞',
  alternateName: 'Meng-Jiun Wei',
  url: `${SITE_URL}/about/`,
  image: `${SITE_URL}/img/about-profile.jpg`,
  jobTitle: '中醫內科主治醫師',
  worksFor: { '@type': 'Hospital', name: '佛教慈濟醫療財團法人台北慈濟醫院', url: 'https://taipei.tzuchi.com.tw/' },
  memberOf: { '@type': 'Organization', name: '台灣福爾摩沙經方中醫學會', url: 'https://sites.google.com/view/twformosajingfang/' },
  alumniOf: [
    { '@type': 'CollegeOrUniversity', name: '中國醫藥大學' },
    { '@type': 'CollegeOrUniversity', name: '長庚大學' },
  ],
  knowsAbout: ['中醫內科', '中西醫整合醫療', '心血管疾病', '周邊動脈疾病', '中醫藥轉譯醫學'],
  sameAs: [FB_URL, BLOG_URL],
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
// 圖片也加內容雜湊版本號：換圖後瀏覽器與 CDN 會立刻取得新檔，不會沿用舊快取
const imgSrc = (name) => `/img/${name}${assetVer(path.join('img', name))}`;

// 響應式圖片：若 static/img/resp/ 有 scripts/make-images.mjs 產生的 WebP，
// 輸出 <picture>，讓手機下載小尺寸；沒有就退回原圖。
const RESP_DIR = path.join(STATIC_DIR, 'img', 'resp');
const RESP_FILES = fs.existsSync(RESP_DIR) ? fs.readdirSync(RESP_DIR) : [];
function respSrcset(name) {
  const base = name.replace(/\.[^.]+$/, '');
  const re = new RegExp('^' + base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '-(\\d+)\\.webp$');
  return RESP_FILES.map(f => { const m = f.match(re); return m ? [Number(m[1]), f] : null; })
    .filter(Boolean).sort((a, b) => a[0] - b[0])
    .map(([w, f]) => `/img/resp/${f}${assetVer(path.join('img', 'resp', f))} ${w}w`).join(', ');
}
function picture(name, imgAttrs, sizes) {
  const img = `<img src="${attr(imgSrc(name))}"${imgAttrs}>`;
  const ss = /\.svg$/i.test(name) ? '' : respSrcset(name);
  return ss ? `<picture><source type="image/webp" srcset="${attr(ss)}" sizes="${sizes}">${img}</picture>` : img;
}

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

// 一律以台北時區顯示日期，避免 Cloudflare 在 UTC 建置時，台灣凌晨的提交被算成前一天
const TPE_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' });
const fmtDate = (iso) => TPE_DATE.format(new Date(iso));

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
// 也支援合併引用：[6,10]、[1–3]、[2,5-7]（逗號可全形，範圍號可用 – 或 -）。
const CITE = /\[(\d{1,3}(?:\s*[,，–-]\s*\d{1,3})*)\](?!\()/g;
function citeIds(spec) {
  const ids = [];
  for (const part of spec.split(/\s*[,，]\s*/)) {
    const r = part.split(/\s*[–-]\s*/).map(Number);
    if (r.length === 2 && r[0] < r[1] && r[1] - r[0] <= 50) for (let n = r[0]; n <= r[1]; n++) ids.push(String(n));
    else ids.push(...r.map(String));
  }
  return ids;
}
function citeHtml(m, spec) {
  if (!/[,，–-]/.test(spec)) return REFS.has(spec) ? `<a class="cite" href="#ref-${spec}" aria-label="參考文獻 ${spec}">[${spec}]</a>` : m;
  // 合併引用：逐一連結，保留原本的逗號與範圍寫法
  const parts = spec.split(/(\s*[,，–-]\s*)/);
  if (!citeIds(spec).some(n => REFS.has(n))) return m;
  return '<span class="cite-group">[' + parts.map(t => /^\d+$/.test(t) && REFS.has(t)
    ? `<a class="cite" href="#ref-${t}" aria-label="參考文獻 ${t}">${t}</a>` : t.replace(/\s+/g, '')).join('') + ']</span>';
}
let REFS = new Set();
function collectRefs(src) {
  return new Set(src.split(/\r?\n/).map(l => (l.match(REF_LINE) || [])[1]).filter(Boolean));
}
function citedIds(src) {
  const text = src.split(/\r?\n/).filter(l => !REF_LINE.test(l)).join('\n');
  return new Set([...text.matchAll(CITE)].flatMap(m => citeIds(m[1])));
}

function inline(s) {
  return s
    .replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`)
    .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, a, u) => `<img src="${attr(u)}" alt="${attr(a)}" loading="lazy">`)
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, u) =>
      `<a href="${attr(u)}"${/^https?:/.test(u) ? ' target="_blank" rel="noopener noreferrer"' : ''}>${t}</a>`)
    .replace(CITE, citeHtml)
    .replace(/==([^=\n]+)==/g, '<mark>$1</mark>')
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
      // 首行寫 [!重點] 時，輸出「診間重點」色塊，與引用原文區分
      const callout = /^\[!重點\]\s*$/.test((buf[0] || '').trim());
      // 首行寫 [!名詞註解]、[!指引註解] 等「[!…註解]」時，輸出輔助性的註解框（術語表樣式），
      // 條目開頭的「**名詞**：」改成標籤，避免被當成正文的粗體強調
      const gloss = (buf[0] || '').trim().match(/^\[!([^\]\s]{1,10}註解)\]\s*$/);
      if (callout || gloss) buf.shift();
      const inner = markdown(buf.join('\n').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&')).html;
      if (gloss) {
        const body = inner
          .replace(/^<ul>/gm, '<ul class="gloss-list">')
          .replace(/<li><strong>([^<]+)<\/strong>\s*[：:]\s*/g, '<li><span class="term">$1</span><span class="gloss-sep">：</span>');
        out.push(`<aside class="gloss" aria-label="${attr(gloss[1])}"><p class="gloss-title">${gloss[1]}</p>${body}</aside>`);
        continue;
      }
      const cls = callout ? ' class="callout"' : '';
      out.push(`<blockquote${cls}>${inner}</blockquote>`);
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

// 分類導覽列：頁首下方一列，窄螢幕可左右滑動
function catNav(current = '') {
  return `<nav class="cat-nav" aria-label="文章分類"><div class="wrap"><ul>
${CATEGORIES.map(c => `    <li><a href="/category/${c.slug}/"${c.slug === current ? ' aria-current="page"' : ''}>${esc(c.name)}</a></li>`).join('\n')}
  </ul></div></nav>${current ? `<script>(function(){var a=document.querySelector('.cat-nav [aria-current]');if(!a)return;var u=a.closest('ul');u.scrollLeft=a.parentNode.offsetLeft-(u.clientWidth-a.offsetWidth)/2;})();</script>` : ''}`;
}

// 標題襯線字只下載本頁標題實際用到的字（Google Fonts text= 子集），
// 避免整套 Noto Serif TC 被切成十幾個分片、手機上拖慢首次繪製。
// 收字範圍對應 styles.css 裡用 var(--serif) 的元素：h1、h2、網站名稱、首頁作者名、首頁測驗入口標題。
const SERIF_FONT_PLACEHOLDER = '%%SERIF_FONT_URL%%';
function subsetSerifFont(html) {
  const chunks = [];
  for (const m of html.matchAll(/<h[12][^>]*>([\s\S]*?)<\/h[12]>/g)) chunks.push(m[1]);
  for (const m of html.matchAll(/<span class="brand-text"><b>([\s\S]*?)<span class="brand-en">/g)) chunks.push(m[1]);
  for (const m of html.matchAll(/class="hero-name"[^>]*>([\s\S]*?)<\/a>/g)) chunks.push(m[1]);
  for (const m of html.matchAll(/class="quiz-title"[^>]*>([\s\S]*?)<\/span>/g)) chunks.push(m[1]);
  const text = chunks.join('')
    .replace(/<[^>]+>/g, '')
    .replace(/&(amp|lt|gt|quot|#39);/g, (_, e) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" })[e])
    .replace(/\s+/g, '');
  const chars = [...new Set([...text])].sort().join('');
  const url = `https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@900&display=swap&text=${encodeURIComponent(chars)}`;
  return html.replaceAll(SERIF_FONT_PLACEHOLDER, attr(url));
}

function layout({ title, desc, body, canonical = '', extraHead = '', bodyClass = '',
                  ogType = 'website', image = '', schema = null, showHeader = true, currentCat = '' }) {
  const img = image || `${SITE_URL}/img/banner-integrative.jpg`;
  return subsetSerifFont(`<!doctype html>
<html lang="${SITE.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${attr(desc)}">
<meta name="theme-color" content="#12395f" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0e141b" media="(prefers-color-scheme: dark)">
${canonical ? `<link rel="canonical" href="${attr(canonical)}">\n` : ''}<meta property="og:site_name" content="${attr(SITE.name)}">
<meta property="og:locale" content="zh_TW">
<meta property="og:title" content="${attr(title)}">
<meta property="og:description" content="${attr(desc)}">
<meta property="og:type" content="${attr(ogType)}">
${canonical ? `<meta property="og:url" content="${attr(canonical)}">\n` : ''}<meta property="og:image" content="${attr(img)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${attr(title)}">
<meta name="twitter:description" content="${attr(desc)}">
<meta name="twitter:image" content="${attr(img)}">
<link rel="icon" href="/favicon.ico" sizes="32x32">
<link rel="icon" href="${imgSrc('favicon.svg')}" type="image/svg+xml">
<link rel="apple-touch-icon" href="${imgSrc('apple-touch-icon.png')}">
<link rel="alternate" type="application/rss+xml" title="${attr(SITE.name)}" href="/feed.xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<!-- 內文用系統內建中文字型；只有標題載入襯線字，且非同步載入、不阻擋畫面顯示 -->
<link rel="preload" as="style" href="${SERIF_FONT_PLACEHOLDER}" onload="this.onload=null;this.rel='stylesheet'">
<noscript><link rel="stylesheet" href="${SERIF_FONT_PLACEHOLDER}"></noscript>
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
    <nav><a href="/">文章</a><a href="/about/">關於</a><a href="${TOOLS_URL}/?src=nav" class="nav-tool" target="_blank" rel="noopener noreferrer"><span class="nav-long">教學</span>工具<span class="nav-arrow"> ↗</span></a><a href="${BLOG_URL}" class="nav-blog"><span class="nav-long">衛教</span>部落格<span class="nav-arrow"> ↗</span></a></nav>
  </div>
  ${catNav(currentCat)}
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
    <section class="sites tools">
      <h2>給住院醫師的工具</h2>
      <p class="sites-note">寫病例報告時用得上的小工具，免登入、免費，貼上的內容不會離開你的瀏覽器。</p>
      <div class="sites-grid">
${TOOLS.map(x => `        <a class="site-card" href="${attr(x.url)}" target="_blank" rel="noopener noreferrer">
          <span class="site-aud">${esc(x.audience)}</span>
          <b>${esc(x.name)}</b>
          <span class="site-host">${esc(x.host)} ↗</span>
          <span class="site-desc">${esc(x.desc)}</span>
        </a>`).join('\n')}
      </div>
    </section>
    <p class="disclaimer"><b>免責聲明：</b>本站內容僅供醫學教育與學術討論之用，不構成診斷或治療建議。任何用藥、停藥或療法選擇，請諮詢您的醫師或藥師。</p>
    <p class="foot-meta">© ${new Date().getFullYear()} ${esc(SITE.name)} ${esc(SITE.nameEn)} · <a href="https://github.com/Meng20260912/IntegrativeMed-Hub" target="_blank" rel="noopener noreferrer">原始碼於 GitHub</a></p>
  </div>
</footer>
</body>
</html>`);
}

/* ---------- 訂閱新文章通知 ---------- */
// 表單放在文章頁底部、首頁最後，以及 /subscribe/ 專頁。不用彈出式視窗。
// 送出後的提示文字在 static/subscribe.js；寫入 D1 的 API 在 functions/api/subscribe/。
// 這份名單只用於網站新文章通知，與專業電子報名單分開，彼此不互通。
// 下面的個資告知是第一版草稿，待魏醫師審過定稿。
const SUB_NOTICE = [
  ['蒐集目的', '寄送本站新文章通知。'],
  ['蒐集項目', '電子郵件地址，以及你從哪一頁送出訂閱。'],
  ['使用範圍', '只用來寄送本站新文章通知。不提供給第三方，不用於廣告投放，也不與其他名單合併。'],
  ['保存期限', '保存到你退訂為止。退訂後停止寄送，信箱留在退訂名單裡，只用來確保不會再寄信給你。'],
  ['退訂方式', '每封通知信底部都有退訂連結，點一下就生效，不需要登入，也不必回信。'],
  ['費用', '訂閱免費。'],
];
const SUB_V = assetVer('subscribe.js');
function subscribeForm({ id = 'main', heading = '訂閱新文章通知', open = false, lede = '新文章上線時，寄一封通知到你的信箱。訂閱免費，隨時可以退訂。' } = {}) {
  const i = id;   // 同一頁只有一個表單，id 用固定字串，不用流水號
  return `<section class="sub" aria-labelledby="sub-h-${i}">
  <h2 id="sub-h-${i}">${esc(heading)}</h2>
  <p class="sub-lede">${esc(lede)}</p>
  <form class="sub-form" data-subscribe novalidate>
    <label class="skip" for="sub-email-${i}">電子郵件地址</label>
    <input class="sub-input" id="sub-email-${i}" type="email" name="email" required
           maxlength="254" inputmode="email" autocomplete="email" spellcheck="false"
           placeholder="your.name@example.com">
    <p class="sub-hp" aria-hidden="true"><label for="sub-nick-${i}">暫不使用</label><input id="sub-nick-${i}" type="text" name="nickname" tabindex="-1" autocomplete="off"></p>
    <button class="sub-btn" type="submit">訂閱</button>
  </form>
  <p class="sub-msg" data-sub-msg role="status" aria-live="polite" hidden></p>
  <p class="sub-brief">只寄本站的新文章通知，不提供給第三方。確認信由每日排程寄出，一天內會寄到。</p>
  <details class="sub-terms"${open ? ' open' : ''}>
    <summary>個人資料蒐集告知</summary>
    <ul>
${SUB_NOTICE.map(([k, v]) => `      <li><b>${esc(k)}：</b>${esc(v)}</li>`).join('\n')}
    </ul>
    <p>這份名單只用於本站的新文章通知，與作者另外寄送的專業電子報分開，兩邊不互通。</p>
    <p>你可以要求查詢、更正或刪除自己的資料；直接回覆任何一封通知信即可。不填信箱不影響你閱讀本站的任何內容。</p>
  </details>
  <noscript><p class="sub-noscript">這個表單需要瀏覽器的 JavaScript。若已關閉，請改從<a href="/subscribe/">訂閱頁</a>送出，或直接回信告知要訂閱。</p></noscript>
</section>`;
}

/* ---------- 閱讀時間 ---------- */
// 只計讀者真正要讀的文字：
// - 內嵌 <svg>…</svg> 整段不算（座標、樣式、<title>/<desc> 都是給螢幕閱讀器的），圖說 <figcaption> 照算
// - 其他 HTML 標籤去掉、保留標籤內文字
// - Markdown 連結只算連結文字、不算網址；圖片整個不算
// - 參考文獻條目（「- [n] 」開頭）不算；正文的引用標號 [n] 不算
// - 表格保留儲存格文字，去掉 | 與分隔列；#、*、> 等標記不算
// 計數方式：中文字（含全形標點）每字 1 單位；英文單字或數字每個 1 單位、閱讀時以 2 個中文字計
// （中文每分鐘約 450 字，英文約 200 字，一個英文字約等於兩個中文字的閱讀時間）。
function readingStats(md) {
  const text = md
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;|&#\d+;/gi, ' ')
    .split(/\r?\n/).filter(l => !REF_LINE.test(l))
    .filter(l => !/^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/.test(l))   // 表格分隔列
    .join('\n')
    .replace(/```[^\n]*\n/g, '\n')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/\[\d{1,3}(?:\s*[,，–-]\s*\d{1,3})*\]/g, ' ');
  const latin = (text.match(/[A-Za-z0-9]+(?:[.'’][A-Za-z0-9]+)*/g) || []).length;
  const cjk = text
    .replace(/[A-Za-z0-9]+(?:[.'’][A-Za-z0-9]+)*/g, ' ')
    .replace(/[\x00-\x7F]/g, '')       // ASCII 標點與 Markdown 標記
    .replace(/\s+/g, '').length;
  return { words: cjk + latin, readMins: Math.max(1, Math.round((cjk + latin * 2) / 450)) };
}

/* ---------- 讀取文章 ---------- */
// category 可寫單一 slug 或 [slug, slug]；第一個有效的為主分類（category），全部有效的為 categories
function parseCategories(f, v) {
  const raw = (Array.isArray(v) ? v : [v || '']).map(s => String(s).trim());
  const valid = [];
  for (const s of raw) {
    if (!CAT[s]) console.warn(`⚠ ${f}：category「${s}」不在分類清單中`);
    else if (!valid.includes(s)) valid.push(s);
  }
  return { category: valid[0] || '', categories: valid };
}

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
  const { words, readMins } = readingStats(body);
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
    ...parseCategories(f, fm.category),
    published, updated, words,
    readMins,
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
const catCount = (slug) => posts.filter(p => p.categories.includes(slug)).length;

// 卡片上的分類標籤：首頁用主分類；分類頁傳入目前分類，跨類文章在各分類頁顯示該頁的分類
const cardHtml = (p, cat = p.category) => `      <article class="card" data-tags="${attr(p.tags.join('|'))}" data-search="${attr(p.searchText)}">
        ${p.hero ? `<a class="card-thumb" href="/posts/${attr(p.slug)}/" tabindex="-1" aria-hidden="true">${picture(p.hero, ' alt="" loading="lazy" decoding="async"', '(min-width: 1100px) 360px, (min-width: 700px) 50vw, 100vw')}</a>` : ''}
        <div class="card-body">
          <p class="card-date">${cat ? `<a class="card-cat" href="/category/${cat}/">${esc(CAT[cat].name)}</a>` : ''}<time datetime="${attr(p.updated)}">${fmtDate(p.updated).replace(/-/g, '/')}</time> 更新</p>
          <h3><a href="/posts/${attr(p.slug)}/">${esc(p.title)}</a></h3>
          <p class="card-sum">${esc(p.summary)}</p>
          ${p.tags.length ? `<ul class="card-tags">${p.tags.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
          <div class="card-meta">
            <span class="m-author"><b>${esc(p.authorName)}</b>${p.authorAffil ? `<span class="affil">${esc(p.authorAffil)}</span>` : ''}</span>
            <span><time datetime="${attr(p.published)}">發布 ${fmtDate(p.published).replace(/-/g, '/')}</time></span>
            <span>瀏覽 <span class="views" data-slug="${attr(p.slug)}">–</span></span>
          </div>
        </div>
      </article>`;
const cards = posts.map(p => cardHtml(p)).join('\n');

const latestPost = posts[0];
const indexBody = `<section class="hero">
  <div class="hero-cover">${picture(heroImg, ` alt="" fetchpriority="high" decoding="async"${sizeAttr(heroImg)}`, '100vw')}</div>
  <div class="hero-overlay"></div>
  <div class="hero-content">
    <p class="hero-en">${esc(SITE.nameEn)}</p>
    <h1>${esc(SITE.name)}</h1>
    <p class="hero-sub">把傳統中醫的辨證思維，放到現代實證醫學的檢驗架構下一起讀</p>
    <p class="hero-by"><a class="hero-name" href="/about/#cv">魏孟鈞</a><span class="hero-title">台北慈濟醫院中醫部　中醫內科主治醫師</span></p>
    <p class="hero-views" hidden>全站累計瀏覽 <span class="site-views">–</span> 人次</p>
    <p class="hero-updated">最近更新 ${fmtDate(latestPost.updated).replace(/-/g, '/')}｜<a href="/posts/${attr(latestPost.slug)}/">${esc(latestPost.title)}</a></p>
    ${heroCredit ? `<p class="hero-credit">主視覺：<a href="${attr(heroCredit.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(heroCredit.title)}</a>，${esc(heroCredit.author)}／<a href="${attr(heroCredit.licenseUrl)}" target="_blank" rel="noopener noreferrer">${esc(heroCredit.license)}</a>。完整出處見頁尾。</p>` : `<p class="hero-credit">主視覺為情境示意圖（AI 生成），非真實臨床照片。</p>`}
  </div>
</section>


<div class="wrap toolbar">
  <div class="toolbar-inner">
    <ul class="chips" aria-label="文章分類">
      <li><a class="chip" href="/" aria-current="page">全部 <span class="n">${posts.length}</span></a></li>
${CATEGORIES.map(c => { const n = catCount(c.slug); return `      <li><a class="chip" href="/category/${c.slug}/">${esc(c.name)}${n ? ` <span class="n">${n}</span>` : ''}</a></li>`; }).join('\n')}
    </ul>
    <div class="toolbar-row">
      <div class="search">
        <label class="skip" for="q">搜尋文章</label>
        <input type="search" id="q" placeholder="搜尋標題、摘要或標籤…" autocomplete="off">
      </div>
      <div class="toolbar-links">
        <a href="${TOOLS_URL}/?src=home" class="btn-blog" target="_blank" rel="noopener noreferrer">病因病機圖工作台 ↗</a>
        <a href="${BLOG_URL}" class="btn-blog">衛教部落格 ↗</a>
        <a href="/about/">關於本站</a>
        <a href="/feed.xml">RSS</a>
      </div>
    </div>
  </div>
</div>

<section class="wrap quiz-promo" aria-labelledby="quiz-promo-title">
  <a class="quiz-card" href="/quiz/hospital-or-clinic/?src=home">
    <img src="/quiz/hospital-or-clinic/og.jpg" alt="" width="1200" height="630" decoding="async">
    <span class="quiz-text">
      <span class="quiz-kicker">中醫實習醫學生小測驗</span>
      <span class="quiz-title" id="quiz-promo-title">選配前先測一下：你是醫院型還是診所型？</span>
      <span class="quiz-meta">16 題情境題，約 3 分鐘，從七個面向看看自己比較偏哪一邊</span>
      <span class="quiz-btn">開始測驗 →</span>
    </span>
  </a>
</section>

<section class="wrap posts">
  <div class="posts-head">
    <h2>全部文章</h2>
    <p class="count" id="resultCount">${posts.length} 篇 · 依最後更新時間排序</p>
  </div>
  <div class="grid" id="grid">
${cards}
  </div>
  <p class="no-result" id="noResult" hidden>沒有符合的文章。試試其他關鍵字，或從上方分類瀏覽。</p>
</section>

<div class="wrap sub-wrap">
${subscribeForm({ id: 'home', heading: '訂閱新文章通知' })}
</div>`;

fs.writeFileSync(path.join(OUT, 'index.html'), layout({
  title: `${SITE.name}｜${SITE.nameEn}`,
  desc: SITE.desc, canonical: SITE_URL + '/', body: indexBody, bodyClass: 'is-home',
  image: `${SITE_URL}/img/${heroImg}`,
  showHeader: false,
  extraHead: `<script src="/views.js${VIEWS_V}" defer></script>\n<script src="/filter.js${assetVer('filter.js')}" defer></script>\n<script src="/subscribe.js${SUB_V}" defer></script>`,
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
          author: AUTHOR_REF,
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
    <p class="tags">${p.categories.map(c => `<a class="post-cat" href="/category/${c}/">${esc(CAT[c].name)}</a>`).join('')}${p.tags.map(t => `<span>${esc(t)}</span>`).join('')}</p>
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
    ${picture(p.hero, ` alt="${attr(p.heroAlt)}" decoding="async" fetchpriority="high"${sizeAttr(p.hero)}`, '(min-width: 960px) 880px, 100vw')}
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
  <div class="wrap sub-wrap">
${subscribeForm({ id: 'post', heading: '訂閱新文章通知' })}
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
    body, bodyClass: 'is-post', currentCat: p.category,
    ogType: 'article',
    image: ogImage,
    extraHead: [
      `<meta property="article:published_time" content="${attr(p.published)}">`,
      `<meta property="article:modified_time" content="${attr(p.updated)}">`,
      `<meta property="article:author" content="${attr(p.authorName)}">`,
      ...p.tags.map(t => `<meta property="article:tag" content="${attr(t)}">`),
      `<script src="/views.js${VIEWS_V}" defer></script>`,
      `<script src="/subscribe.js${SUB_V}" defer></script>`,
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
          ...(p.categories.length ? { articleSection: p.categories.length > 1 ? p.categories.map(c => CAT[c].name) : CAT[p.category].name } : {}),
          image: [ogImage],
          author: {
            ...AUTHOR_REF,
            ...(p.authorAffil ? { affiliation: { '@type': 'Organization', name: p.authorAffil } } : {}),
          },
          publisher: AUTHOR_REF,
          isPartOf: { '@id': `${SITE_URL}/#blog` },
          license: 'https://creativecommons.org/licenses/by/4.0/',
        },
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: '文章', item: `${SITE_URL}/` },
            ...(p.category ? [{ '@type': 'ListItem', position: 2, name: CAT[p.category].name, item: `${SITE_URL}/category/${p.category}/` }] : []),
            { '@type': 'ListItem', position: p.category ? 3 : 2, name: p.title, item: url },
          ],
        },
      ],
    },
  }));
}

// --- 分類頁：/category/<slug>/ ---
for (const c of CATEGORIES) {
  const list = posts.filter(p => p.categories.includes(c.slug));
  const dir = path.join(OUT, 'category', c.slug);
  fs.mkdirSync(dir, { recursive: true });
  const body = `<section class="wrap cat-head">
  <p class="cat-kicker">文章分類</p>
  <h1>${esc(c.name)}</h1>
  <p class="cat-desc">${esc(c.desc)}</p>
</section>
<section class="wrap posts">
  <div class="posts-head">
    <h2>${list.length ? `共 ${list.length} 篇` : '文章準備中'}</h2>
    ${list.length ? '<p class="count">依最後更新時間排序</p>' : ''}
  </div>
  ${list.length ? `<div class="grid">
${list.map(p => cardHtml(p, c.slug)).join('\n')}
  </div>` : `<p class="cat-empty">這個分類的第一篇文章還在撰寫中，歡迎先逛逛<a href="/">其他文章</a>。</p>`}
</section>`;
  fs.writeFileSync(path.join(dir, 'index.html'), layout({
    title: `${c.name} — ${SITE.name}`, desc: c.desc, canonical: `${SITE_URL}/category/${c.slug}/`,
    body, bodyClass: 'is-cat', currentCat: c.slug,
    // 空分類先不讓搜尋引擎收錄，避免被判定為內容稀少的頁面；有文章後自動解除
    extraHead: list.length ? `<script src="/views.js${VIEWS_V}" defer></script>` : '<meta name="robots" content="noindex, follow">',
    schema: {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: c.name, description: c.desc, url: `${SITE_URL}/category/${c.slug}/`,
      isPartOf: { '@id': `${SITE_URL}/#website` },
    },
  }));
}

// --- 關於頁 ---
fs.mkdirSync(path.join(OUT, 'about'), { recursive: true });
fs.writeFileSync(path.join(OUT, 'about', 'index.html'), layout({
  title: `關於 — ${SITE.name}`, desc: SITE.desc, canonical: SITE_URL + '/about/',
  extraHead: `<script src="/views.js${VIEWS_V}" defer></script>`,
  schema: {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    url: `${SITE_URL}/about/`,
    name: `關於作者 — ${SITE.name}`,
    mainEntity: PERSON,
  },
  body: `<div class="wrap page-logo"><img src="${attr(imgSrc('brand-logo.png'))}" alt="魏孟鈞中醫師"${sizeAttr('brand-logo.png')} fetchpriority="high" decoding="async"></div>
<div class="wrap prose page">
<h1>關於作者</h1>
<figure class="about-profile">${picture('about-profile.jpg', ` alt="魏孟鈞醫師個人介紹圖：台北慈濟醫院中醫部中醫內科主治醫師，列出現職、專長領域、研究方向與醫療特色"${sizeAttr('about-profile.jpg')} decoding="async"`, '(min-width: 600px) 520px, 100vw')}</figure>
<p><strong>魏孟鈞</strong>（Meng-Jiun Wei），台北慈濟醫院中醫部中醫內科主治醫師。</p>
<ul>
<li><strong>專長領域：</strong>心血管疾病調理、周邊動脈疾病照護、重症與術後整合照護、安寧緩和醫療、代謝與內分泌失調</li>
<li><strong>研究方向：</strong>中西醫整合醫療、雷射針灸與循環改善、中藥抗發炎機轉研究、心血管保護與重症照護</li>
</ul>
<p>寫給一般民眾的衛教文章，放在<a href="${BLOG_URL}" target="_blank" rel="noopener noreferrer me">魏孟鈞中醫師衛教部落格</a>；日常衛教與門診消息，請見<a href="${FB_URL}" target="_blank" rel="noopener noreferrer me">臉書粉絲專頁</a>。</p>
<h2 id="cv">學經歷</h2>
<h3>現職</h3>
<ul class="cv-list cv-now">
<li><span class="cv-what">台北慈濟醫院中醫部　中醫內科主治醫師</span></li>
<li><span class="cv-what">台灣福爾摩沙經方中醫學會　理事</span></li>
</ul>
<h3>學歷</h3>
<ul class="cv-list cv-now">
<li><span class="cv-what">國立陽明交通大學　傳統醫藥研究所博士班（就讀中）</span></li>
<li><span class="cv-what">中國醫藥大學　學士後中醫學系（醫學士）</span></li>
<li><span class="cv-what">長庚大學　生物醫學系（理學士）</span></li>
</ul>
<h3>經歷</h3>
<ul class="cv-list cv-now">
<li><span class="cv-what">中醫內科專科醫師</span></li>
<li><span class="cv-what">台北慈濟醫院中醫部　行政總醫師</span></li>
<li><span class="cv-what">台北慈濟醫院中醫部　教學總醫師</span></li>
<li><span class="cv-what">台北慈濟醫院中醫部　中醫內科總醫師</span></li>
<li><span class="cv-what">台北慈濟醫院中醫部　住院醫師</span></li>
<li><span class="cv-what">台北慈濟醫院中醫部　實習醫師</span></li>
<li><span class="cv-what">亞東紀念醫院　見習醫師</span></li>
<li><span class="cv-what">衛生福利部雙和醫院腎臟內科　研究助理</span></li>
</ul>
<h2 id="publications">著作與發表</h2>
<h3>期刊論文</h3>
<ul class="cv-list pub-list">
<li><span class="cv-when">2026</span><span class="cv-what">Huang KL, Yang MC, Wu YK, <b class="me">Wei MJ</b>, Kang HF, Liu GT, Kuo CY, Tzeng IS, Hsieh PC, Lan CC. Anti-inflammatory and polarization-modulating effects of <i>Houttuynia cordata</i> in LPS-stimulated RAW264.7 macrophages. <i>J Tradit Complement Med</i>. 2026;16(2):200–209. <a href="https://pubmed.ncbi.nlm.nih.gov/41788166/" target="_blank" rel="noopener noreferrer">PMID 41788166</a></span></li>
<li><span class="cv-when">2024</span><span class="cv-what"><span class="pub-first">第一作者</span><b class="me">Wei MJ</b>, Huang KL, Kang HF, Liu GT, Kuo CY, Tzeng IS, Hsieh PC, Lan CC. Jing Si Herbal Tea modulates macrophage polarization and inflammatory signaling in LPS-induced inflammation. <i>Int J Med Sci</i>. 2024;21(15):3046–3057. <a href="https://pubmed.ncbi.nlm.nih.gov/39628684/" target="_blank" rel="noopener noreferrer">PMID 39628684</a></span></li>
<li><span class="cv-when">2021</span><span class="cv-what">Lu PH, Yu MC, <b class="me">Wei MJ</b>, Kuo KL. The therapeutic strategies for uremic toxins control in chronic kidney disease. <i>Toxins (Basel)</i>. 2021;13(8):573. <a href="https://pubmed.ncbi.nlm.nih.gov/34437444/" target="_blank" rel="noopener noreferrer">PMID 34437444</a></span></li>
<li><span class="cv-when">2017</span><span class="cv-what">Chen CH, Chen TH, Wu MY, Chou TC, Chen JR, <b class="me">Wei MJ</b>, Lee SL, Hong LY, Zheng CM, Chiu IJ, Lin YF, Hsu CM, Hsu YH. Far-infrared protects vascular endothelial cells from advanced glycation end products-induced injury via PLZF-mediated autophagy in diabetic mice. <i>Sci Rep</i>. 2017;7:40442. <a href="https://pubmed.ncbi.nlm.nih.gov/28071754/" target="_blank" rel="noopener noreferrer">PMID 28071754</a></span></li>
</ul>
<h3>中文論文與臨床案例</h3>
<ul class="cv-list pub-list">
<li><span class="cv-when">2026</span><span class="cv-what"><span class="pub-first">第一作者</span><b class="me">魏孟鈞</b>、謝伯駿、游志勤。柴胡劑合併針灸治療改善良性攝護腺增生致頻尿、夜尿之病例報告。《中醫藥研究論叢》。2026;29(1):163–182。<a href="https://doi.org/10.6516/TJTCM.202603_29(1).0012" target="_blank" rel="noopener noreferrer">DOI</a></span></li>
<li><span class="cv-when">2025</span><span class="cv-what"><span class="pub-first">第一作者</span><b class="me">魏孟鈞</b>、謝伯駿。慢性阻塞性肺病急性發作之中西醫整合治療顯效醫案。《中醫臨床顯效案例彙編（十五）》。</span></li>
<li><span class="cv-when">2024</span><span class="cv-what"><span class="pub-first">第一作者</span><b class="me">魏孟鈞</b>、謝伯駿。中西醫共同照護成功脫離呼吸器顯效醫案。《中醫臨床顯效案例彙編（十四）》。</span></li>
<li><span class="cv-when">2024</span><span class="cv-what"><span class="pub-first">第一作者</span><b class="me">魏孟鈞</b>、謝伯駿。中西醫整合照護外傷後氣胸顯效醫案。《中醫臨床顯效案例彙編（十四）》。</span></li>
</ul>
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

// --- 訂閱頁與確認／退訂結果頁 ---
// /subscribe/ 是可以收錄的說明頁；其餘四頁只有點了信裡的連結才會到，標 noindex 也不列入 sitemap。
// functions/api/subscribe/ 的三個端點就是導向這幾個網址（見 lib/subscribe.js 的 PAGES）。
function subPage(slug, { title, desc, body, form = false, noindex = true }) {
  const dir = path.join(OUT, 'subscribe', slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), layout({
    title: `${title} — ${SITE.name}`,
    desc,
    canonical: noindex ? '' : `${SITE_URL}/subscribe/${slug ? slug + '/' : ''}`,
    extraHead: (noindex ? '<meta name="robots" content="noindex, follow">\n' : '')
      + (form ? `<script src="/subscribe.js${SUB_V}" defer></script>` : ''),
    body,
  }));
}

subPage('', {
  noindex: false, form: true,
  title: '訂閱新文章通知',
  desc: '本站有新文章時寄一封通知到你的信箱。訂閱免費，每封信底部都有退訂連結，點一下就生效。',
  body: `<div class="wrap prose page">
<h1>訂閱新文章通知</h1>
<p>本站有新文章上線時，寄一封通知到你的信箱，裡面只放標題、一兩句摘要和連結。<strong>訂閱免費</strong>，不寄廣告，也不轉給任何第三方。</p>
<h2>流程</h2>
<ol>
<li>填入信箱送出。</li>
<li>收一封確認信，點裡面的連結。確認信由每日排程寄出，<strong>一天內會寄到</strong>，不是即時寄出的。</li>
<li>點了連結才算訂閱完成，之後新文章上線就會收到通知。</li>
</ol>
<p>沒有點確認連結的信箱不會收到任何通知信，確認連結發出後 30 天內有效。</p>
<h2>想退訂的時候</h2>
<p>每封通知信底部都有退訂連結，點一下就生效，不需要登入、不必回信，也不會再問你第二次。</p>
<h2>與專業電子報的關係</h2>
<p>這份名單只用於本站的新文章通知。作者另外寄送的專業電子報（指引更新與專業知識整理）是獨立的名單，兩邊不互通。訂了這裡不會收到那一份，訂了那一份也不會自動被加進這裡。</p>
</div>
<div class="wrap sub-wrap">
${subscribeForm({ id: 'page', heading: '填入信箱開始訂閱', open: true })}
</div>`,
});

subPage('confirmed', {
  title: '訂閱確認完成',
  desc: '訂閱已經確認完成，本站有新文章時會寄通知到你的信箱。',
  body: `<div class="wrap prose page">
<h1>訂閱確認完成</h1>
<p>確認好了，你的信箱已經在新文章通知名單裡。之後本站有新文章上線，就會寄一封通知給你。</p>
<p>想停止收信，每封通知信底部都有退訂連結，點一下就生效。</p>
<ul>
<li><a href="/">回首頁，瀏覽全部文章</a></li>
<li><a href="/about/">關於本站與作者</a></li>
</ul>
</div>`,
});

subPage('unsubscribed', {
  title: '已經退訂',
  desc: '退訂完成，之後不會再收到本站的新文章通知。',
  body: `<div class="wrap prose page">
<h1>已經退訂</h1>
<p>退訂完成，之後不會再收到本站的新文章通知。這一步不需要再做任何確認。</p>
<p>你的信箱留在退訂名單裡，只用來確保不會再寄信給你。想重新訂閱，隨時可以從<a href="/subscribe/">訂閱頁</a>再填一次。</p>
<ul>
<li><a href="/">回首頁，瀏覽全部文章</a></li>
<li><a href="/feed.xml">改用 RSS 追蹤新文章</a></li>
</ul>
</div>`,
});

subPage('invalid', {
  title: '這個連結沒有作用',
  desc: '這個訂閱連結查不到對應的紀錄，可能是網址被信件軟體截斷或少了幾個字。',
  body: `<div class="wrap prose page">
<h1>這個連結沒有作用</h1>
<p>這個連結查不到對應的訂閱紀錄。常見的原因有幾個：網址被信件軟體折行截斷、複製時少了幾個字，或是這筆訂閱已經退訂過了。</p>
<p>想訂閱的話，到<a href="/subscribe/">訂閱頁</a>重新填一次信箱就好。</p>
<p>如果你是想退訂卻點不動，請改用最近一封通知信底部的退訂連結；還是不行就直接回覆那封信，作者會把你的信箱移出名單。</p>
</div>`,
});

subPage('expired', {
  form: true,
  title: '確認連結已經過期',
  desc: '訂閱確認連結在發出後 30 天內有效，這一封已經超過期限。重新填一次信箱就會再寄新的確認信。',
  body: `<div class="wrap prose page">
<h1>確認連結已經過期</h1>
<p>訂閱確認連結在發出後 30 天內有效，手上這一封已經超過期限了。期限是為了避免舊信件裡的連結被別人撿去用。</p>
<p>重新填一次信箱，排程就會再寄一封新的確認信給你。</p>
</div>
<div class="wrap sub-wrap">
${subscribeForm({ id: 'again', heading: '重新寄一封確認信' })}
</div>`,
});

// --- 找不到頁面 ---
// Cloudflare Pages 找不到資產時，會先看輸出目錄根部有沒有 404.html。
// 有就回傳它並帶真正的 404 狀態碼；沒有就退回 index.html 並回傳 200，
// 瀏覽器把那份 HTML 當圖片解讀就成了破圖，搜尋引擎也會收錄成重複內容。
// 這一頁標示 noindex，也不列入 sitemap。
fs.writeFileSync(path.join(OUT, '404.html'), layout({
  title: `找不到這個頁面 — ${SITE.name}`,
  desc: '這個網址可能已經變更，或是輸入時漏了字。從首頁的文章列表或頁首的分類列都能找回想看的內容。',
  extraHead: '<meta name="robots" content="noindex, follow">\n',
  body: `<div class="wrap prose page">
<h1>找不到這個頁面</h1>
<p>這個網址可能已經變更，或是輸入時漏了字。網站上的文章都還在，從下面幾個入口可以找回來。</p>
<ul>
<li><a href="/">回首頁，瀏覽全部文章</a></li>
<li><a href="/about/">關於本站與作者</a></li>
</ul>
<p>頁首的分類列也可以直接跳到各個主題。</p>
<h2>最近更新的文章</h2>
<ul>
${posts.slice(0, 5).map(p => `<li><a href="/posts/${attr(p.slug)}/">${esc(p.title)}</a></li>`).join('\n')}
</ul>
</div>`,
}));

// --- sitemap / robots ---
const newest = posts.length ? posts[0].updated.slice(0, 10) : new Date().toISOString().slice(0, 10);
// static/quiz/<名稱>/index.html 的小測驗頁也列入 sitemap
const QUIZ_DIR = path.join(STATIC_DIR, 'quiz');
const quizUrls = fs.existsSync(QUIZ_DIR)
  ? fs.readdirSync(QUIZ_DIR).filter(d => fs.existsSync(path.join(QUIZ_DIR, d, 'index.html'))).map(d => `/quiz/${d}/`)
  : [];
const urls = ['/', '/about/', '/subscribe/', ...quizUrls, ...CATEGORIES.filter(c => posts.some(p => p.categories.includes(c.slug))).map(c => `/category/${c.slug}/`), ...posts.map(p => `/posts/${p.slug}/`)];
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
${[...p.categories.map(c => CAT[c].name), ...p.tags].map(t => `    <category>${esc(t)}</category>`).join('\n')}
    <description>${esc(p.summary)}</description>
  </item>`).join('\n')}
</channel>
</rss>\n`);

console.log(`✓ built ${posts.length} posts → dist/`);
for (const p of posts) console.log(`  /posts/${p.slug}/  更新 ${fmtDate(p.updated)}  發布 ${fmtDate(p.published)}  — ${p.title}`);
