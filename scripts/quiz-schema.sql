-- 小測驗匿名作答（D1 資料庫，binding QUIZ_DB）
-- 只存作答內容與日期，不存 IP、User-Agent 或任何可識別資訊。
CREATE TABLE IF NOT EXISTS responses (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  quiz    TEXT    NOT NULL,          -- 測驗代號，例如 hospital-or-clinic
  version TEXT    NOT NULL,          -- 題目版本（quiz-data.js 的 QUIZ_VERSION）
  day     TEXT    NOT NULL,          -- 作答日期 YYYY-MM-DD（不記錄時間）
  answers TEXT    NOT NULL,          -- JSON 陣列：各題選項索引 0–3
  motives TEXT    NOT NULL,          -- JSON 陣列：動機題選項索引，未答為 null
  result  TEXT    NOT NULL,          -- hospital / clinic
  score   INTEGER NOT NULL,          -- 總分，負數偏醫院、正數偏診所
  mbti    TEXT                       -- 選填 MBTI 類型
);
CREATE INDEX IF NOT EXISTS idx_responses_quiz ON responses (quiz, version);
