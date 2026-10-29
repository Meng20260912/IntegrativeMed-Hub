#!/usr/bin/env node
// 訂閱名單讀寫（給寄送排程用）
//
// 為什麼不做對外的 API：這張表裡每一列都是個人資料，一個帶密鑰的公開端點就是
// 全站最值得攻擊的目標——密鑰寫在排程那端、放在環境變數或設定檔，外洩一次全部名單就走了。
// 改用 wrangler 直接查 D1：走的是魏醫師自己的 Cloudflare 登入，程式裡不留任何密鑰，
// 網站上也沒有多出任何可以抓名單的網址。
//
// 用法（在專案根目錄執行）：
//   node scripts/subscribers.mjs pending            待寄確認信的人（含 confirm_token）
//   node scripts/subscribers.mjs confirmed          已確認的訂閱者（含 unsub_token）
//   node scripts/subscribers.mjs mark-sent 3 7 11   把這幾筆標記為「確認信已寄出」
//   node scripts/subscribers.mjs stats              各狀態人數
//
// 加 --local 查本機 wrangler pages dev 的資料庫，不加就是查線上（--remote）。
// 輸出 JSON；要 CSV 加 --csv。
//
// 排程端需要的網址自己組：
//   確認 https://drmjwei.net/api/subscribe/confirm?token=<confirm_token>
//   退訂 https://drmjwei.net/api/subscribe/unsubscribe?token=<unsub_token>
// 每封信底部都必須放退訂連結。

import { execFileSync } from 'node:child_process';

const DB = 'site-subscribers';
const argv = process.argv.slice(2);
const flag = (f) => { const i = argv.indexOf(f); if (i >= 0) argv.splice(i, 1); return i >= 0; };
const LOCAL = flag('--local');
const CSV = flag('--csv');
const cmd = argv.shift();

function query(sql) {
  const args = ['--yes', 'wrangler', 'd1', 'execute', DB, LOCAL ? '--local' : '--remote',
                '--json', '--command', sql];
  let out;
  try {
    out = execFileSync('npx', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    process.stderr.write((e.stderr || e.message || '') + '\n');
    process.exit(1);
  }
  const i = out.indexOf('[');            // wrangler 可能先印一兩行提示
  const parsed = JSON.parse(out.slice(i < 0 ? 0 : i));
  const first = Array.isArray(parsed) ? parsed[0] : parsed;
  return (first && first.results) || [];
}

function emit(rows) {
  if (!CSV) { console.log(JSON.stringify(rows, null, 2)); return; }
  if (!rows.length) return;
  const cols = Object.keys(rows[0]);
  const q = (v) => v === null || v === undefined ? '' : `"${String(v).replace(/"/g, '""')}"`;
  console.log(cols.join(','));
  for (const r of rows) console.log(cols.map((c) => q(r[c])).join(','));
}

switch (cmd) {
  case 'pending':
    emit(query(
      `SELECT id, email, confirm_token, unsub_token, created_at, source
         FROM subscribers
        WHERE status = 'pending' AND confirm_sent_at IS NULL
        ORDER BY id`));
    break;

  case 'confirmed':
    emit(query(
      `SELECT id, email, unsub_token, confirmed_at
         FROM subscribers
        WHERE status = 'confirmed'
        ORDER BY id`));
    break;

  case 'mark-sent': {
    const ids = argv.filter((x) => /^\d+$/.test(x));
    if (!ids.length || ids.length !== argv.length) {
      console.error('mark-sent 後面要接一個或多個整數 id');
      process.exit(1);
    }
    query(`UPDATE subscribers SET confirm_sent_at = '${new Date().toISOString()}'
            WHERE id IN (${ids.join(',')}) AND status = 'pending'`);
    console.log(`已標記 ${ids.length} 筆確認信寄出`);
    break;
  }

  case 'stats':
    emit(query('SELECT status, COUNT(*) AS n FROM subscribers GROUP BY status ORDER BY status'));
    break;

  default:
    console.error(`用法：node scripts/subscribers.mjs <pending|confirmed|mark-sent <id…>|stats> [--local] [--csv]`);
    process.exit(1);
}
