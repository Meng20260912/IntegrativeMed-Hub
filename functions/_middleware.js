// Cloudflare Pages 會同時用 <專案>.pages.dev 提供同一個網站，造成搜尋引擎看到兩份內容。
// 正式網址轉到自訂網域；預覽網址（分支或提交預覽）保留可用，但標示不收錄。
const PROD_PAGES_HOST = 'integrativemed-hub.pages.dev';

// 副檔名看得出是靜態檔案的路徑（.html 除外，那本來就該回 HTML）。
const STATIC_FILE = /\.(?:avif|bmp|css|gif|ico|jpe?g|js|json|map|mjs|mp3|mp4|pdf|png|svg|txt|webmanifest|webp|woff2?|xml)$/i;

export async function onRequest(context) {
  const url = new URL(context.request.url);
  if (url.hostname === PROD_PAGES_HOST) {
    url.hostname = 'drmjwei.net';
    return Response.redirect(url.toString(), 301);
  }
  const res = await context.next();

  // 靜態檔案（圖片、CSS、JS…）不存在時，Pages 會回傳 404.html 這份 HTML。
  // 瀏覽器拿 HTML 當圖片解讀就是破圖，而且每張破圖都要傳一整頁 HTML。
  // 這類請求改回輕量的純文字 404，HTML 的找不到頁面留給真正的頁面網址。
  if (STATIC_FILE.test(url.pathname) &&
      (res.headers.get('content-type') || '').includes('text/html')) {
    return new Response('404 Not Found\n', {
      status: 404,
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'cache-control': 'no-store',
        'x-robots-tag': 'noindex'
      }
    });
  }

  if (url.hostname.endsWith('.pages.dev')) {
    const out = new Response(res.body, res);
    out.headers.set('x-robots-tag', 'noindex, nofollow');
    return out;
  }
  return res;
}
