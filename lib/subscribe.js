// 訂閱「新文章通知」共用邏輯：給 functions/api/subscribe/ 底下三個端點使用。
//
// 放在 functions/ 之外，是因為 Pages Functions 會把 functions/ 裡的每個 .js 當成一個網址。
// 這個檔只是共用模組，不該有自己的網址。
//
// 這份名單只用於網站新文章通知，與專業電子報名單（DailyReports/recipients.json）完全分開。

/* ---------- token ---------- */
// 192 bits 的亂數，來源是 Web Crypto 的 CSPRNG（crypto.getRandomValues），
// 轉成 32 個字元的 base64url。比 randomUUID 的 122 bits 更長，且沒有連字號、好放進網址。
export function newToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export const TOKEN_RE = /^[A-Za-z0-9_-]{22,64}$/;
export const isToken = (t) => typeof t === 'string' && TOKEN_RE.test(t);

/* ---------- email ---------- */
// 保守的格式檢查：擋掉沒有 @、沒有網域結尾、含空白或引號逗號等明顯不是信箱的字串。
// 不保證信箱真的存在——那由確認信負責（雙重確認）。
const EMAIL_RE = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~.-]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*\.[A-Za-z]{2,24}$/;

// 正規化：去前後空白、轉小寫。回傳 null 表示格式不合。
export function cleanEmail(raw) {
  if (typeof raw !== 'string') return null;
  const e = raw.trim().toLowerCase();
  if (e.length < 6 || e.length > 254) return null;
  if (e.includes('..')) return null;
  if (!EMAIL_RE.test(e)) return null;
  return e;
}

// 來源頁面：只收本站的路徑，長度設上限，不收完整網址或查詢字串。
export function cleanSource(raw) {
  if (typeof raw !== 'string') return null;
  const s = raw.trim().split('?')[0].split('#')[0];
  if (!s.startsWith('/') || s.length > 120 || !/^\/[A-Za-z0-9/_-]*$/.test(s)) return null;
  return s;
}

/* ---------- 時間 ---------- */
export const nowIso = () => new Date().toISOString();
// 確認 token 的有效期。確認信由每日排程寄出，期限要留得寬一點。
export const CONFIRM_TTL_DAYS = 30;
export function confirmExpired(issuedAt) {
  if (!issuedAt) return true;
  const t = Date.parse(issuedAt);
  if (Number.isNaN(t)) return true;
  return Date.now() - t > CONFIRM_TTL_DAYS * 864e5;
}

/* ---------- 濫用防護 ---------- */
// 同一個 IP 一小時內最多 5 次。不存原始 IP，只存加鹽後的 SHA-256。
export const THROTTLE_WINDOW_MS = 3600e3;
export const THROTTLE_DEFAULT_MAX = 5;

export function clientIp(request) {
  // 正式環境由 Cloudflare 填入 CF-Connecting-IP，讀者送什麼都會被覆寫，無法假造。
  return request.headers.get('cf-connecting-ip')
    || (request.headers.get('x-forwarded-for') || '').split(',')[0].trim()
    || 'no-ip';
}

async function sha256hex(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// 回傳 true 表示已超過上限，應該擋下。
export async function throttled(db, request, env) {
  const max = Number(env.SUBSCRIBE_MAX_PER_HOUR) || THROTTLE_DEFAULT_MAX;
  const salt = env.SUBSCRIBE_IP_SALT || 'drmjwei-subscribe';
  const hash = await sha256hex(clientIp(request) + '|' + salt);
  const now = Date.now();

  const row = await db.prepare('SELECT window_start, hits FROM subscribe_throttle WHERE ip_hash = ?')
    .bind(hash).first();

  if (row && now - Date.parse(row.window_start) < THROTTLE_WINDOW_MS) {
    if (row.hits >= max) return true;
    await db.prepare('UPDATE subscribe_throttle SET hits = hits + 1 WHERE ip_hash = ?').bind(hash).run();
    return false;
  }

  await db.prepare(
    `INSERT INTO subscribe_throttle (ip_hash, window_start, hits) VALUES (?, ?, 1)
     ON CONFLICT(ip_hash) DO UPDATE SET window_start = excluded.window_start, hits = 1`
  ).bind(hash, new Date(now).toISOString()).run();

  // 過了時間窗的紀錄沒有用處，順手刪掉
  await db.prepare('DELETE FROM subscribe_throttle WHERE window_start < ?')
    .bind(new Date(now - THROTTLE_WINDOW_MS).toISOString()).run();
  return false;
}

/* ---------- 回應 ---------- */
const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };

// 文案留在前端（static/subscribe.js），這裡只回狀態代號，方便日後改字不動 API。
export const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });

// 確認與退訂的結果頁（由 build.mjs 產生的靜態頁）
export const PAGES = {
  confirmed: '/subscribe/confirmed/',
  unsubscribed: '/subscribe/unsubscribed/',
  invalid: '/subscribe/invalid/',
  expired: '/subscribe/expired/',
};

export function goto(request, page) {
  const url = new URL(request.url);
  url.pathname = page;
  url.search = '';
  return new Response(null, {
    status: 302,
    headers: { location: url.toString(), 'cache-control': 'no-store', 'x-robots-tag': 'noindex' },
  });
}
