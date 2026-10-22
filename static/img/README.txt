這個資料夾放文章主圖與網站圖片，resp/ 底下是 scripts/make-images.mjs
產生的響應式 WebP（480／800／1200／1600 寬），建置時一併複製到 dist/img/。

2026-09-12 曾把兩張含簡體中文的照片換掉。Cloudflare Pages 的資產邊緣快取
仍保有舊檔、zone 層級的 purge 清不掉，當時在原路徑（hero-tcm-shop.jpg、
pharmacy.jpg）部署 16x9 佔位圖強制覆蓋。確認舊圖不再回傳後，
兩個佔位檔已於 2026-10-22 刪除。
