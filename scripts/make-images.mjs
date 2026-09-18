// 產生響應式 WebP 圖片：static/img/*.jpg|png → static/img/resp/<檔名>-<寬度>.webp
// 手機只下載小尺寸，大幅減少流量。新增或更換主圖後執行一次：
//   npm i --no-save sharp && node scripts/make-images.mjs
// （sharp 只在本機產圖時使用，不列入 package.json，Cloudflare 建置不需要它）
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const IMG = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'static', 'img');
const OUT = path.join(IMG, 'resp');
const WIDTHS = [480, 800, 1200, 1600];
const SKIP = /^(brand-logo|apple-touch-icon|favicon)|^(hero-tcm-shop|pharmacy)\.jpg$/; // logo 與已棄用的佔位檔不處理

fs.mkdirSync(OUT, { recursive: true });
let made = 0;
for (const f of fs.readdirSync(IMG)) {
  if (!/\.(jpe?g|png)$/i.test(f) || SKIP.test(f)) continue;
  const src = path.join(IMG, f);
  const base = f.replace(/\.[^.]+$/, '');
  const { width } = await sharp(src).metadata();
  // 小於原圖的標準寬度，加上原圖寬度（上限 1600），確保高解析螢幕不模糊
  const ws = [...new Set([...WIDTHS.filter(w => w < width), Math.min(width, 1600)])];
  for (const w of ws) {
    const out = path.join(OUT, `${base}-${w}.webp`);
    if (fs.existsSync(out) && fs.statSync(out).mtimeMs >= fs.statSync(src).mtimeMs) continue;
    await sharp(src).resize({ width: Math.min(w, width), withoutEnlargement: true }).webp({ quality: 74 }).toFile(out);
    made++;
  }
}
console.log(`✓ 產生 ${made} 個 WebP → static/img/resp/`);
