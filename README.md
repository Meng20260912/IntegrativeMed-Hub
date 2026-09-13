# 讀經典，看實證 Classics & Evidence

**從經典、研究到臨床的中醫筆記** · drmjwei.net（GitHub repo：IntegrativeMed-Hub）

純靜態網站，由零依賴的 Node 腳本建置，部署於 Cloudflare Pages。

## 如何新增一篇文章

1. 在 `content/posts/` 新增一個 `.md` 檔（檔名建議 `YYYY-MM-DD-slug.md`）
2. 填好 frontmatter：

```markdown
---
title: 文章標題
slug: url-slug          # 網址會是 /posts/url-slug/
author: Meng            # 顯示在文章頁與首頁卡片
date: 2026-09-12        # 發布日期
summary: 一到兩句摘要，會顯示在首頁卡片
hero: pharmacy.jpg      # static/img/ 底下的檔名（可省略）
heroAlt: 圖片替代文字
tags: [標籤一, 標籤二]
---

正文（Markdown）…
```

3. `git commit` 並 `git push`

Cloudflare Pages 會自動重跑 `node build.mjs`，首頁**自動長出新卡片**、**重新依最後更新時間排序**（最新的在前）。不需要手動改任何 HTML。

## 日期是怎麼來的

- **發布日期**：frontmatter 的 `date`
- **最後更新日期**：該檔案最後一次 Git commit 的時間（`git log -1 --format=%cI -- <file>`）

所以你只要編輯文章並 push，那篇文章的「最後更新」就會自動變成新日期，首頁排序也會跟著往前移。其他文章不受影響。

若建置環境取不到 Git 歷史，會依序退回 frontmatter 的 `updated:` 欄位、再退回檔案 mtime。

## 圖片與授權

圖片放 `static/img/`，並在 `content/credits.json` 登記作者與授權。頁尾會**自動**依 CC BY 規則列出：作品名、作者、授權條款、來源連結、修改狀況。

## 瀏覽計數器

- `functions/api/views/[slug].js` — 單篇 +1 / 讀取
- `functions/api/views/index.js` — 一次回傳全部，供首頁卡片填值

儲存在 Cloudflare KV（binding `VIEWS`，設定於 `wrangler.toml`）。**不需要註冊第三方帳號、程式碼中不含任何 API 金鑰**，也不使用 Cookie 或追蹤腳本。

## 本機開發

```bash
npm run build     # 產生 dist/
npm run dev       # 建置後用 wrangler 起本機伺服器（含 Functions 與 KV）
```

## 部署

Cloudflare Pages 連動本 repo，推送到 `main` 即自動建置部署。

| 設定項 | 值 |
|---|---|
| Build command | `node build.mjs` |
| Build output directory | `dist` |

## 授權

文字內容 CC BY 4.0。圖片各自標示，見頁尾與 `content/credits.json`。
