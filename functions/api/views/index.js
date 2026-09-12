// GET /api/views  → 一次回傳所有文章的瀏覽數，供首頁卡片填值
const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };

export async function onRequestGet({ env }) {
  if (!env.VIEWS) return new Response(JSON.stringify({ views: {} }), { headers: JSON_HEADERS });
  const views = {};
  let cursor;
  do {
    const res = await env.VIEWS.list({ prefix: 'post:', cursor, limit: 1000 });
    for (const k of res.keys) {
      // 計數同時寫在 metadata，list 一次就拿得到，不必逐筆 get
      views[k.name.slice(5)] = (k.metadata && k.metadata.v) || 0;
    }
    cursor = res.list_complete ? null : res.cursor;
  } while (cursor);
  return new Response(JSON.stringify({ views }), { headers: JSON_HEADERS });
}
