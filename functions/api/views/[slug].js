// GET  /api/views/<slug> → 只讀取
// POST /api/views/<slug> → +1 後回傳
const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
const key = (slug) => 'post:' + slug;
const ok = (slug, views) => new Response(JSON.stringify({ slug, views }), { headers: JSON_HEADERS });

function clean(slug) {
  return typeof slug === 'string' && /^[a-z0-9][a-z0-9-]{0,80}$/.test(slug) ? slug : null;
}

export async function onRequestGet({ env, params }) {
  const slug = clean(params.slug);
  if (!slug) return new Response('bad slug', { status: 400 });
  if (!env.VIEWS) return ok(slug, 0);
  const v = await env.VIEWS.get(key(slug));
  return ok(slug, Number(v) || 0);
}

export async function onRequestPost({ env, params }) {
  const slug = clean(params.slug);
  if (!slug) return new Response('bad slug', { status: 400 });
  if (!env.VIEWS) return ok(slug, 0);
  const n = (Number(await env.VIEWS.get(key(slug))) || 0) + 1;
  await env.VIEWS.put(key(slug), String(n), { metadata: { v: n } });
  return ok(slug, n);
}
