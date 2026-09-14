// GET  /api/site-views → 讀取全站累計瀏覽人次
// POST /api/site-views → +1 後回傳
// 首頁、關於頁、文章頁每次開啟都計一次（同一分頁重新整理不重複計，由前端 sessionStorage 判斷）。
const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
const KEY = 'site:total';
const ok = (views) => new Response(JSON.stringify({ views }), { headers: JSON_HEADERS });

// 第一次啟用時沒有全站計數，以各文章既有瀏覽數加總作為起始值，
// 避免上線當下從 0 開始（首頁與關於頁過去沒有計數，無法補回）。
async function current(env) {
  const v = await env.VIEWS.get(KEY);
  if (v !== null) return Number(v) || 0;
  let sum = 0, cursor;
  do {
    const res = await env.VIEWS.list({ prefix: 'post:', cursor, limit: 1000 });
    for (const k of res.keys) sum += (k.metadata && k.metadata.v) || 0;
    cursor = res.list_complete ? null : res.cursor;
  } while (cursor);
  return sum;
}

export async function onRequestGet({ env }) {
  if (!env.VIEWS) return ok(0);
  return ok(await current(env));
}

export async function onRequestPost({ env }) {
  if (!env.VIEWS) return ok(0);
  const n = (await current(env)) + 1;
  await env.VIEWS.put(KEY, String(n));
  return ok(n);
}
