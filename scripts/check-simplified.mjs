// 簡體字檢查：掃描 content/ 底下的稿件，發現簡體字就擋下建置。
//
// 為什麼需要這個：魏醫師用 Claude 輸入框的麥克風口述時，轉寫結果是簡體中文
// （macOS 內建聽寫正常）。網站全站禁用簡體，而混進來的字肉眼不一定看得出來。
//
// 字表 simplified-chars.json 由 opencc s2twp 產生，已排除既有文章用過的字，
// 以及台灣繁體確實會用到的繁簡共用字（后、征、准、厘、占、斗、划、伙、范、
// 咸、丑、云、几、据）。誤判時把字加進 simplified-allow.txt，不要改字表。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');

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

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (e.name.endsWith('.md')) acc.push(p);
  }
  return acc;
}

// 回傳 [{ file, line, col, char, suggest, text }]
export function scanSimplified(dirs = ['content']) {
  const table = loadTable();
  const allow = loadAllow();
  const hits = [];
  for (const d of dirs) {
    for (const file of walk(path.join(ROOT, d))) {
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
if (import.meta.url === `file://${process.argv[1]}`) {
  const hits = scanSimplified();
  if (hits.length === 0) {
    console.log('簡體字檢查通過，content/ 底下沒有簡體字。');
  } else {
    console.error(reportSimplified(hits));
    process.exit(1);
  }
}
