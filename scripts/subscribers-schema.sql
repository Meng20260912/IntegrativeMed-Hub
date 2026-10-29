-- 網站新文章通知的訂閱名單（D1 資料庫，binding SUBS_DB，資料庫 site-subscribers）
--
-- 這份名單與 /Users/arsen/DailyReports/recipients.json 的專業週報名單完全分開，
-- 兩邊不互通、不互相匯入：當初同意收專業週報的人，沒有同意收網站新文章通知。
--
-- 這裡存的是個人資料（電子郵件地址），所以不與 quiz-stats 共用資料庫。
-- 小測驗那份資料庫明確標示「不存個人資料」，混在一起會讓它的性質改變。

CREATE TABLE IF NOT EXISTS subscribers (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  email            TEXT    NOT NULL UNIQUE,   -- 一律正規化為小寫並去掉前後空白
  status           TEXT    NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'confirmed', 'unsubscribed')),

  -- 確認用 token：會過期，確認完成後就失效（確認信重寄時換新的）
  confirm_token    TEXT    UNIQUE,
  confirm_token_at TEXT,                      -- token 產生時間，過期日從這裡算
  confirm_sent_at  TEXT,                      -- 確認信實際寄出時間（由寄送排程回寫）

  -- 退訂用 token：永久有效、不會過期。
  -- 退訂連結必須永遠點得動（法規要求不得要求登入或額外驗證），
  -- 所以不跟會過期的確認 token 共用同一個值。
  unsub_token      TEXT    NOT NULL UNIQUE,

  created_at       TEXT    NOT NULL,          -- 第一次送出訂閱的時間（ISO 8601、UTC）
  confirmed_at     TEXT,                      -- 點下確認連結的時間（退訂後重新訂閱會清掉重算）
  unsubscribed_at  TEXT,                      -- 最後一次退訂的時間（重新訂閱時保留，看得出退過又回來）
  source           TEXT                       -- 從哪一頁送出訂閱，例如 /posts/xxx/（選填）
);

CREATE INDEX IF NOT EXISTS idx_subscribers_status ON subscribers (status);
-- 寄送排程要找「待寄確認信」：status='pending' AND confirm_sent_at IS NULL
CREATE INDEX IF NOT EXISTS idx_subscribers_pending ON subscribers (status, confirm_sent_at);

-- 濫用防護：同一個 IP 短時間內大量送出就擋下。
-- 不存原始 IP。ip_hash 是 SHA-256(IP + 鹽)，鹽放在 Pages 環境變數 SUBSCRIBE_IP_SALT。
-- 過了時間窗就沒有用處，寫入時順手刪掉舊紀錄。
CREATE TABLE IF NOT EXISTS subscribe_throttle (
  ip_hash      TEXT    PRIMARY KEY,
  window_start TEXT    NOT NULL,              -- 這個時間窗的起點（ISO 8601、UTC）
  hits         INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_throttle_window ON subscribe_throttle (window_start);
