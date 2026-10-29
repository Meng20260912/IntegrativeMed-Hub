// GET /api/subscribe/confirm?token=… → 完成訂閱確認，導向結果頁
//
// 導向的頁面都是 build.mjs 產生的靜態頁，標示 noindex 也不列入 sitemap：
//   成功、或重複點同一個連結 → /subscribe/confirmed/
//   token 過期                → /subscribe/expired/
//   token 查不到、或已退訂    → /subscribe/invalid/
//
// 確認完成後不清掉 confirm_token，讓讀者重複點同一封信的連結也看到「已完成」。

import { isToken, confirmExpired, nowIso, goto, PAGES } from '../../../lib/subscribe.js';

export async function onRequestGet({ request, env }) {
  const token = new URL(request.url).searchParams.get('token');
  if (!isToken(token)) return goto(request, PAGES.invalid);

  const db = env.SUBS_DB;
  if (!db) return goto(request, PAGES.invalid);

  const row = await db.prepare(
    'SELECT id, status, confirm_token_at FROM subscribers WHERE confirm_token = ?'
  ).bind(token).first();

  if (!row) return goto(request, PAGES.invalid);
  if (row.status === 'confirmed') return goto(request, PAGES.confirmed);
  if (row.status === 'unsubscribed') return goto(request, PAGES.invalid);
  if (confirmExpired(row.confirm_token_at)) return goto(request, PAGES.expired);

  await db.prepare(
    `UPDATE subscribers SET status = 'confirmed', confirmed_at = ? WHERE id = ? AND status = 'pending'`
  ).bind(nowIso(), row.id).run();

  return goto(request, PAGES.confirmed);
}
