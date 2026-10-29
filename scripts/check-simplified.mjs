// 簡體字檢查：掃描全站會被讀者看到的文字，發現簡體字就擋下建置。
//
// 為什麼需要這個：魏醫師用 Claude 輸入框的麥克風口述時，轉寫結果是簡體中文
// （macOS 內建聽寫正常）。網站全站禁用簡體，而混進來的字肉眼不一定看得出來。
//
// 掃描範圍不只稿件。頁首頁尾、導覽、個資告知寫在 build.mjs；前端提示訊息寫在
// static/*.js；API 回給使用者看的訊息寫在 functions/ 與 lib/；小測驗的題目選項
// 寫在 static/quiz/。這些地方的字一樣會出現在網站上，所以一起掃。
// 判斷標準是「這段文字會不會被讀者看到」，再加上幾個小而乾淨的倉庫文件。
//
// 掃描邏輯是逐字比對字表，只認 CJK 字元，英文、路徑、變數名不受影響。
//
// 字表 simplified-chars.json 由 opencc s2twp 產生，已排除既有文章用過的字，
// 以及台灣繁體確實會用到的繁簡共用字（后、征、准、厘、占、斗、划、伙、范、
// 咸、丑、云、几、据）。誤判時把字加進 simplified-allow.txt，不要改字表。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');

// 掃描範圍。dir 會遞迴走訪，只取 exts 列出的副檔名；file 是單一檔案。
// 新增目錄或檔案型別時改這裡，不要改字表。
export const TARGETS = [
  // 稿件本體，以及文章頁的圖片來源標示
  { dir: 'content', exts: ['.md', '.json'] },
  // 頁面骨架、導覽、頁尾、個資告知等介面文字
  { file: 'build.mjs' },
  // 前端訊息與小測驗題庫（static/quiz/ 的 html／js／css 都在這層遞迴到）
  { dir: 'static', exts: ['.js', '.css', '.html'] },
  // API 回傳給使用者看的訊息
  { dir: 'functions', exts: ['.js'] },
  // 共用邏輯裡的訊息字串（確認信內文等）
  { dir: 'lib', exts: ['.js'] },
  // 工具腳本的輸出訊息，與資料表的欄位註解
  { dir: 'scripts', exts: ['.mjs', '.sql'] },
  // 倉庫文件與設定裡的說明文字
  { file: 'README.md' },
  { file: 'wrangler.toml' },
  { file: 'package.json' },
];

// 不掃的檔案（相對於專案根目錄）。
// 字表本身整份都是簡體字，豁免清單也會列到被排除的繁簡共用字，
// 兩個都是這支程式的資料檔，掃了只會自己擋自己。
const EXCLUDE = new Set([
  'scripts/simplified-chars.json',
  'scripts/simplified-allow.txt',
]);

// dist/ 是 build 的產出，內容全部來自上面這些來源，掃了等於重複。
// static/img/ 底下的圖片無法用程式檢查，圖內文字靠選圖時人工確認。

function loadTable() {
  const p = path.join(HERE, 'simplified-chars.json');
  return JSON.parse(fs.readFileSync(p, 'utf8')).chars;
}

function loadAllow() {
  const p = path.join(HERE, 'simplified-allow.txt');
  if (!fs.existsSync(p)) return new Set();
  const out = new Set();
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const s = line.split('#')[0].trim();
    for (const ch of s) if (ch >= '一' && ch <= '鿿') out.add(ch);
  }
  return out;
}

function walk(dir, exts, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      walk(p, exts, acc);
    } else if (exts.some((x) => e.name.endsWith(x))) {
      acc.push(p);
    }
  }
  return acc;
}

// 把 TARGETS 展開成實際要讀的檔案清單（絕對路徑，已去重、已排除）。
export function collectFiles(targets = TARGETS) {
  const seen = new Set();
  const out = [];
  for (const t of targets) {
    const found = t.file ? [path.join(ROOT, t.file)] : walk(path.join(ROOT, t.dir), t.exts);
    for (const p of found) {
      const rel = path.relative(ROOT, p);
      if (EXCLUDE.has(rel) || seen.has(rel)) continue;
      if (!fs.existsSync(p)) continue;
      seen.add(rel);
      out.push(p);
    }
  }
  return out;
}

// 回傳 [{ file, line, col, char, suggest, text }]
export function scanSimplified(targets = TARGETS) {
  const table = loadTable();
  const allow = loadAllow();
  const hits = [];
  for (const file of collectFiles(targets)) {
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    lines.forEach((text, i) => {
      [...text].forEach((ch, j) => {
        if (table[ch] && !allow.has(ch)) {
          hits.push({
            file: path.relative(ROOT, file),
            line: i + 1,
            col: j + 1,
            char: ch,
            suggest: table[ch],
            text: text.trim().slice(0, 80),
          });
        }
      });
    });
  }
  return hits;
}

export function reportSimplified(hits) {
  const byFile = new Map();
  for (const h of hits) {
    if (!byFile.has(h.file)) byFile.set(h.file, []);
    byFile.get(h.file).push(h);
  }
  const out = [];
  out.push(`發現 ${hits.length} 處簡體字，建置中止。`);
  out.push('');
  for (const [file, list] of byFile) {
    out.push(`  ${file}`);
    for (const h of list) {
      out.push(`    第 ${h.line} 行第 ${h.col} 字：「${h.char}」應為「${h.suggest}」`);
      out.push(`      ${h.text}`);
    }
    out.push('');
  }
  out.push('改掉這些字再建置一次。');
  out.push('建議的對應是逐字轉換的結果，中藥名請依正字自行判斷');
  out.push('（例如白朮的「朮」會被建議成「術」，正字是「朮」）。');
  out.push('若其中有字是正確的台灣繁體用法（例如姓氏、中藥名、古籍用字），');
  out.push('把該字加進 scripts/simplified-allow.txt，一行一個字，# 後面可寫理由。');
  return out.join('\n');
}

// 獨立執行：node scripts/check-simplified.mjs
// 加 --list 可以印出實際掃到哪些檔案，確認範圍有沒有漏。
if (import.meta.url === `file://${process.argv[1]}`) {
  const t0 = performance.now();
  const files = collectFiles();
  const hits = scanSimplified();
  const ms = (performance.now() - t0).toFixed(0);
  if (process.argv.includes('--list')) {
    for (const f of files) console.log('  ' + path.relative(ROOT, f));
  }
  if (hits.length === 0) {
    console.log(`簡體字檢查通過：掃了 ${files.length} 個檔案，沒有簡體字（${ms} ms）。`);
  } else {
    console.error(reportSimplified(hits));
    console.error(`\n（掃了 ${files.length} 個檔案，${ms} ms）`);
    process.exit(1);
  }
}
