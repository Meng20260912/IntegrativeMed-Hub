// GET /api/subscribe/unsubscribe?token=… → 退訂，導向 /subscribe/unsubscribed/
//
// 退訂不需要登入、不需要回信、不需要再按一次確認：點連結就生效。這是法規要求。
// 退訂 token 永久有效，不會過期，確認過或還在待確認都能退。
// 另外收 POST，供寄信時的 List-Unsubscribe-Post（信件軟體的一鍵退訂）使用。

import { isToken, nowIso, goto, PAGES, json } from '../../../lib/subscribe.js';

async function unsubscribe(db, token) {
  const row = await db.prepare('SELECT id, status FROM subscribers WHERE unsub_token = ?')
    .bind(token).first();
  if (!row) return false;
  if (row.status !== 'unsubscribed') {
    await db.prepare(`UPDATE subscribers SET status = 'unsubscribed', unsubscribed_at = ? WHERE id = ?`)
      .bind(nowIso(), row.id).run();
  }
  return true;
}

export async function onRequestGet({ request, env }) {
  const token = new URL(request.url).searchParams.get('token');
  if (!isToken(token) || !env.SUBS_DB) return goto(request, PAGES.invalid);
  const done = await unsubscribe(env.SUBS_DB, token);
  return goto(request, done ? PAGES.unsubscribed : PAGES.invalid);
}

// 一鍵退訂（RFC 8058）：信件軟體送 POST，不看畫面，只看狀態碼
export async function onRequestPost({ request, env }) {
  const token = new URL(request.url).searchParams.get('token');
  if (!isToken(token) || !env.SUBS_DB) return json({ ok: false, error: 'invalid-token' }, 400);
  const done = await unsubscribe(env.SUBS_DB, token);
  return done ? json({ ok: true }) : json({ ok: false, error: 'invalid-token' }, 400);
}
