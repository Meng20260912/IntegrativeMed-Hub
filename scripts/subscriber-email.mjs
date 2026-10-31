#!/usr/bin/env node
// 訂閱者信件版型（確認信、新文章通知）
//
// 為什麼放在網站專案裡：這兩封信是寄給讀者的，掛的是網站的招牌，配色與字體要跟
// styles.css 的品牌一致（深藍 #12395f、連結藍 #1d6fa5、重點土黃 #c2a052、標題襯線體）。
// 寄給魏醫師自己的那幾份電子報是另一套深藍版型，在 DailyReports/ 底下，兩者不共用。
//
// 用法（在專案根目錄執行）：
//   node scripts/subscriber-email.mjs confirm <confirm_token> [--out <資料夾>]
//   node scripts/subscriber-email.mjs notify  <unsub_token> <posts.json> [--out <資料夾>]
//
// 產出 <資料夾>/confirm.html＋confirm.txt 或 notify.html＋notify.txt，
// 預設寫到系統暫存資料夾（不要寫進專案，免得弄亂 git 狀態）。
// html 給 Gmail 連接器的 htmlBody，txt 給 body。
//
// posts.json 格式（新文章通知，一到多篇）：
//   [{ "title": "文章標題",
//      "url": "https://drmjwei.net/posts/<slug>/",
//      "summary": "一到兩句摘要，從 feed.xml 的 description 取前一兩句即可",
//      "category": "診間筆記",            // 可省略，feed 的第一個 category
//      "date": "2026-10-22",              // 可省略
//      "image": "https://drmjwei.net/img/xxx-hero.jpg" }]  // 可省略，有才放
//
// 每封信都必須帶那個人專屬的 token，所以一人一封、不可以群發（見 subscribers.mjs）。
// Gmail 網頁版會移除 <div>／<span> 上的 background，底色一律寫在 td 的 bgcolor 屬性。

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const SITE = 'https://drmjwei.net';
const NAME = '讀經典，看實證';
const NAME_EN = 'Classics & Evidence';
const AUTHOR = '魏孟鈞中醫師';
// 頁首的品牌標誌用 static/img/author-badge.png（240×240、22 KB）。
// 不要用 brand-logo.png：那張是粉專版面，裡面有臉書圖示與搜尋列，放進信裡會像在推廣粉專。
const BADGE = `${SITE}/img/author-badge.png`;

// 取自 static/styles.css 的品牌色
const NAVY = '#12395f';
const BLUE = '#1d6fa5';
const BLUE_SOFT = '#e9f0f7';
const PAPER = '#f4f7fa';
const SURFACE_2 = '#eef3f8';
const INK = '#16202b';
const INK_2 = '#4c5a68';
const INK_3 = '#5f6f80';
const LINE = '#e0e7ef';
const HL_BG = '#fbf4df';     // 診間重點色塊
const HL_LINE = '#c2a052';
const HL_INK = '#8a6a24';

const SERIF = '"Songti TC","Noto Serif TC",Georgia,serif';
const SANS = '"PingFang TC","Hiragino Sans TC","Microsoft JhengHei","Noto Sans TC",system-ui,sans-serif';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function button(href, label) {
  return `<table cellpadding="0" cellspacing="0" border="0" style="margin:22px 0 6px"><tr>
<td bgcolor="${BLUE}" style="border-radius:8px;padding:14px 30px">
<a href="${href}" style="color:#ffffff;font-size:17px;font-weight:700;text-decoration:none;white-space:nowrap">${label}</a>
</td></tr></table>`;
}

function note(text) {
  // 土黃色重點框，跟文章裡的「診間重點」同一個視覺語言
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0"><tr>
<td bgcolor="${HL_BG}" style="border-left:4px solid ${HL_LINE};padding:14px 16px;font-size:16px;line-height:1.8;color:${HL_INK}">${text}</td>
</tr></table>`;
}

function shell(inner, footer) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${PAPER}">
<table width="100%" cellpadding="0" cellspacing="0" bgcolor="${PAPER}"><tr><td align="center" style="padding:24px 10px">
<table width="100%" cellpadding="0" cellspacing="0" bgcolor="#FFFFFF" style="max-width:600px;font-family:${SANS};color:${INK};text-align:left;border:1px solid ${LINE}">
<tr><td style="padding:22px 26px 18px;border-bottom:3px solid ${HL_LINE}">
<table cellpadding="0" cellspacing="0" border="0"><tr>
<td width="76" valign="middle"><img src="${BADGE}" width="64" height="64" alt="${AUTHOR}" style="display:block;border:0;width:64px;height:64px"></td>
<td valign="middle">
<div style="font-family:${SERIF};font-size:21px;font-weight:900;color:${NAVY};line-height:1.4">${NAME}</div>
<div style="font-size:13px;letter-spacing:.06em;color:${INK_3};margin-top:2px">${NAME_EN}</div>
<div style="font-size:14px;color:${INK_2};margin-top:3px">${AUTHOR}　drmjwei.net</div>
</td></tr></table>
</td></tr>
${inner}
<tr><td bgcolor="${SURFACE_2}" style="padding:18px 26px 22px;font-size:14px;line-height:1.85;color:${INK_3}">${footer}</td></tr>
</table></td></tr></table></body></html>`;
}

function confirmMail(token) {
  const url = `${SITE}/api/subscribe/confirm?token=${encodeURIComponent(token)}`;
  const inner = `<tr><td style="padding:26px 26px 24px">
<div style="font-family:${SERIF};font-size:26px;font-weight:900;color:${NAVY};line-height:1.5">請確認訂閱</div>
<div style="font-size:17px;line-height:1.85;color:${INK_2};margin-top:14px">
有人用這個信箱在「${NAME}」（drmjwei.net）訂閱了新文章通知。按下面的按鈕才算完成訂閱，之後站上有新文章，我會寄一封短信通知你。</div>
${button(url, '確認訂閱 →')}
<div style="font-size:14px;line-height:1.8;color:${INK_3};margin-top:10px">
按鈕點不了的話，把這個網址貼到瀏覽器：<br>
<a href="${url}" style="color:${BLUE};word-break:break-all">${esc(url)}</a></div>
${note('<b>如果不是你本人訂閱的，請直接忽略這封信</b>，沒有點連結就不會收到任何通知。')}
<div style="font-size:15px;line-height:1.85;color:${INK_3}">
這個連結 30 天內有效。訂閱免費，之後隨時可以退訂。</div>
</td></tr>`;
  const footer = `這是「${NAME}」（drmjwei.net）的訂閱確認信。在你點下確認之前，不會收到任何通知。<br>
網站：<a href="${SITE}/" style="color:${BLUE};text-decoration:none">drmjwei.net</a>`;
  const text = `請確認訂閱：${NAME}

有人用這個信箱在「${NAME}」（drmjwei.net）訂閱了新文章通知。
點下面的連結才算完成訂閱：

${url}

如果不是你本人訂閱的，請直接忽略這封信，沒有點連結就不會收到任何通知。

這個連結 30 天內有效。訂閱免費，之後隨時可以退訂。`;
  return { html: shell(inner, footer), text, subject: `請確認訂閱：${NAME}` };
}

function postCard(p, first) {
  // 分隔線要在主圖上面，否則圖會看起來像前一篇的
  const rule = first ? '' : `<tr><td style="border-top:1px solid ${LINE};font-size:0;line-height:0">&nbsp;</td></tr>`;
  const img = p.image
    ? `<tr><td style="padding:${first ? '0' : '18px'} 0 14px"><img src="${esc(p.image)}" width="548" alt="" style="width:100%;max-width:548px;height:auto;display:block;border:0"></td></tr>`
    : `<tr><td height="${first ? 4 : 18}" style="font-size:0;line-height:0">&nbsp;</td></tr>`;
  const cat = p.category
    ? `<table cellpadding="0" cellspacing="0" border="0" style="margin-bottom:9px"><tr>
<td bgcolor="${BLUE_SOFT}" style="border-radius:4px;padding:3px 10px;font-size:13px;font-weight:700;color:${NAVY};white-space:nowrap">${esc(p.category)}</td></tr></table>`
    : '';
  const date = p.date ? `<span style="color:${INK_3};font-size:14px">　${esc(p.date)}</span>` : '';
  return `<tr><td style="padding:${first ? '16' : '22'}px 26px 0">
<table width="100%" cellpadding="0" cellspacing="0" border="0">${rule}${img}
<tr><td>${cat}
<div style="font-family:${SERIF};font-size:21px;font-weight:900;line-height:1.6">
<a href="${esc(p.url)}" style="color:${NAVY};text-decoration:none">${esc(p.title)}</a></div>
<div style="font-size:16px;line-height:1.85;color:${INK_2};margin-top:8px">${esc(p.summary)}${date}</div>
<div style="font-size:16px;line-height:1.8;margin-top:10px">
<a href="${esc(p.url)}" style="color:${BLUE};font-weight:700;text-decoration:none">閱讀全文 →</a></div>
</td></tr></table></td></tr>`;
}

function notifyMail(token, posts) {
  const url = `${SITE}/api/subscribe/unsubscribe?token=${encodeURIComponent(token)}`;
  const many = posts.length > 1;
  const head = `<tr><td style="padding:24px 26px 0">
<div style="font-family:${SERIF};font-size:24px;font-weight:900;color:${NAVY};line-height:1.5">${many ? `新文章 ${posts.length} 篇` : '新文章'}</div>
<div style="font-size:16px;line-height:1.85;color:${INK_2};margin-top:8px">${many ? '站上有幾篇新文章，點標題就能讀。' : '站上有一篇新文章。'}</div>
</td></tr>`;
  const cards = posts.map((p, i) => postCard(p, i === 0)).join('');
  const inner = head + cards + `<tr><td style="padding:24px 26px 26px"></td></tr>`;
  const footer = `這是「${NAME}」（drmjwei.net）的新文章通知，與我另外寄送的專業電子報不同。<br>
不想再收到的話：<a href="${url}" style="color:${BLUE};font-weight:700">點這裡退訂</a>，點一下就生效，不需要登入，也不必回信。<br>
網站：<a href="${SITE}/" style="color:${BLUE};text-decoration:none">drmjwei.net</a>`;
  const text = `${NAME}｜${many ? `新文章 ${posts.length} 篇` : '新文章'}

${posts.map((p) => `${p.title}\n${p.summary}\n${p.url}`).join('\n\n')}

———
這是「${NAME}」（drmjwei.net）的新文章通知，與我另外寄送的專業電子報不同。
不想再收到請點這裡退訂（點一下就生效，不需要登入，也不必回信）：
${url}`;
  const subject = many ? `${NAME}：本週新文章 ${posts.length} 篇` : posts[0].title;
  return { html: shell(inner, footer), text, subject };
}

// ── CLI ───────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const outIdx = argv.indexOf('--out');
let outDir = path.join(os.tmpdir(), 'drmjwei-subscriber-mail');
if (outIdx >= 0) { outDir = argv[outIdx + 1]; argv.splice(outIdx, 2); }
const cmd = argv.shift();

const die = (msg) => { console.error(msg); process.exit(1); };

let mail, base;
if (cmd === 'confirm') {
  const token = argv.shift();
  if (!token) die('用法：node scripts/subscriber-email.mjs confirm <confirm_token> [--out <資料夾>]');
  mail = confirmMail(token); base = 'confirm';
} else if (cmd === 'notify') {
  const token = argv.shift();
  const file = argv.shift();
  if (!token || !file) die('用法：node scripts/subscriber-email.mjs notify <unsub_token> <posts.json> [--out <資料夾>]');
  const posts = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(posts) || !posts.length) die('posts.json 要是至少一筆的陣列');
  for (const p of posts) if (!p.title || !p.url || !p.summary) die('每篇都要有 title、url、summary');
  mail = notifyMail(token, posts); base = 'notify';
} else {
  die(`用法：
  node scripts/subscriber-email.mjs confirm <confirm_token> [--out <資料夾>]
  node scripts/subscriber-email.mjs notify  <unsub_token> <posts.json> [--out <資料夾>]`);
}

fs.mkdirSync(outDir, { recursive: true });
const htmlPath = path.join(outDir, `${base}.html`);
const txtPath = path.join(outDir, `${base}.txt`);
fs.writeFileSync(htmlPath, mail.html);
fs.writeFileSync(txtPath, mail.text);
console.log(`主旨：${mail.subject}`);
console.log(`htmlBody：${htmlPath}`);
console.log(`body：${txtPath}`);
