// Cloudflare Pages 會同時用 <專案>.pages.dev 提供同一個網站，造成搜尋引擎看到兩份內容。
// 正式網址轉到自訂網域；預覽網址（分支或提交預覽）保留可用，但標示不收錄。
const PROD_PAGES_HOST = 'integrativemed-hub.pages.dev';

export async function onRequest(context) {
  const url = new URL(context.request.url);
  if (url.hostname === PROD_PAGES_HOST) {
    url.hostname = 'drmjwei.net';
    return Response.redirect(url.toString(), 301);
  }
  const res = await context.next();
  if (url.hostname.endsWith('.pages.dev')) {
    const out = new Response(res.body, res);
    out.headers.set('x-robots-tag', 'noindex, nofollow');
    return out;
  }
  return res;
}
