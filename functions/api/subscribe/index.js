// POST /api/subscribe → 收下 email，寫成「待確認」並產生確認 token
//
// 雙重確認：這裡只寫入 pending，確認信由每日排程寄出，讀者點了信裡的連結才變 confirmed。
// 回應只給狀態代號，畫面上的文字在 static/subscribe.js。
// 其他 HTTP 方法由 Pages 自動回 405（這個模組只匯出 onRequestPost）。
//
//   201 { ok:true, state:'created' }  新訂閱，或重新寄確認信
//   200 { ok:true, state:'pending' }  這個信箱已經在等確認信
//   200 { ok:true, state:'already' }  已經是確認過的訂閱者
//   400 { ok:false, error:'invalid-email' | 'bad-request' }
//   429 { ok:false, error:'rate-limited' }
//   503 { ok:false, error:'unavailable' }  沒有綁定資料庫

import {
  newToken, cleanEmail, cleanSource, nowIso, confirmExpired, throttled, json,
} from '../../../lib/subscribe.js';

export async function onRequestPost({ request, env }) {
  // 跨站送來的請求一律不收
  const origin = request.headers.get('origin');
  if (origin) {
    try {
      if (new URL(origin).host !== new URL(request.url).host) {
        return json({ ok: false, error: 'bad-request' }, 400);
      }
    } catch { return json({ ok: false, error: 'bad-request' }, 400); }
  }

  let b;
  try { b = await request.json(); } catch { return json({ ok: false, error: 'bad-request' }, 400); }
  if (!b || typeof b !== 'object') return json({ ok: false, error: 'bad-request' }, 400);

  const db = env.SUBS_DB;
  if (!db) return json({ ok: false, error: 'unavailable' }, 503);

  // 先擋濫用再驗格式，否則送壞格式試探是免費的
  if (await throttled(db, request, env)) return json({ ok: false, error: 'rate-limited' }, 429);

  // 隱藏欄位（蜜罐）：真人看不到也填不到，有填就是機器人。
  // 回正常成功的樣子，但什麼都不寫入。
  if (typeof b.nickname === 'string' && b.nickname.trim() !== '') {
    return json({ ok: true, state: 'created' }, 201);
  }

  const email = cleanEmail(b.email);
  if (!email) return json({ ok: false, error: 'invalid-email' }, 400);
  const source = cleanSource(b.source);
  const now = nowIso();

  const row = await db.prepare(
    'SELECT id, status, confirm_token_at FROM subscribers WHERE email = ?'
  ).bind(email).first();

  // 已經確認過：不重複寫入，也不重寄確認信
  if (row && row.status === 'confirmed') return json({ ok: true, state: 'already' });

  // 還在等確認信，而且 token 沒過期：不重複寫入，避免有人拿別人的信箱連續觸發寄信
  if (row && row.status === 'pending' && !confirmExpired(row.confirm_token_at)) {
    return json({ ok: true, state: 'pending' });
  }

  // 其餘三種情況都換一組新的確認 token，讓排程重寄一次確認信：
  //   1. 全新的信箱
  //   2. 待確認但 token 已過期
  //   3. 退訂過又回來訂（重新同意，一樣要走確認流程）
  if (!row) {
    try {
      await db.prepare(
        `INSERT INTO subscribers (email, status, confirm_token, confirm_token_at, unsub_token, created_at, source)
         VALUES (?, 'pending', ?, ?, ?, ?, ?)`
      ).bind(email, newToken(), now, newToken(), now, source).run();
    } catch {
      // email 有 UNIQUE 限制：同時送出兩次時後到的會失敗，當成「已在等確認信」
      return json({ ok: true, state: 'pending' });
    }
  } else {
    await db.prepare(
      `UPDATE subscribers
          SET status = 'pending', confirm_token = ?, confirm_token_at = ?, confirm_sent_at = NULL,
              confirmed_at = NULL, source = COALESCE(?, source)
        WHERE id = ?`
    ).bind(newToken(), now, source, row.id).run();
  }

  return json({ ok: true, state: 'created' }, 201);
}

// 這個網址只收 POST。用瀏覽器直接開會到這裡，給個明確的 405 比掉進 404 頁好找問題。
export const onRequestGet = () => new Response('method not allowed\n', {
  status: 405,
  headers: { allow: 'POST', 'content-type': 'text/plain; charset=utf-8', 'x-robots-tag': 'noindex' },
});
