hero-tcm-shop.jpg 與 pharmacy.jpg 是佔位檔，不是網站使用的圖片。

原本這兩個路徑放的是含簡體中文的照片，已於 2026-09-12 更換。
Cloudflare Pages 的資產邊緣快取仍保有舊檔，zone 層級的 purge 清不掉，
因此在原路徑部署 16x16 佔位圖，強制覆蓋該快取。

網站實際使用的圖片是 hero-ginseng.jpg 與 cinchona.jpg。
確認舊快取不再回傳舊圖後（數週後），這兩個佔位檔即可刪除。
