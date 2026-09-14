// 瀏覽計數：呼叫同站的 Cloudflare Pages Function（KV 儲存）
// 無需第三方帳號、無 API 金鑰、無 Cookie、無追蹤。
(function () {
  var nf = new Intl.NumberFormat('zh-Hant');
  function paint(map) {
    document.querySelectorAll('.views[data-slug]').forEach(function (el) {
      var v = map[el.dataset.slug];
      el.textContent = typeof v === 'number' ? nf.format(v) : '0';
    });
  }
  // 全站累計瀏覽人次：每個頁面開啟時計一次（同分頁重整不重複計），首頁主視覺顯示總數
  (function () {
    var key = 'imh:site:' + location.pathname, seen = false;
    try { seen = sessionStorage.getItem(key) === '1'; } catch (e) {}
    fetch('/api/site-views', { method: seen ? 'GET' : 'POST' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d) return;
        try { sessionStorage.setItem(key, '1'); } catch (e) {}
        document.querySelectorAll('.site-views').forEach(function (el) {
          el.textContent = nf.format(d.views || 0);
          var box = el.closest('[hidden]'); if (box) box.hidden = false;
        });
      }).catch(function () {});
  })();

  var single = document.querySelector('.views[data-count]');
  if (single) {
    // 文章頁：計數一次（同分頁重整不重複計）
    var slug = single.dataset.slug, key = 'imh:' + slug;
    var seen = false;
    try { seen = sessionStorage.getItem(key) === '1'; } catch (e) {}
    fetch('/api/views/' + encodeURIComponent(slug), { method: seen ? 'GET' : 'POST' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d) return;
        try { sessionStorage.setItem(key, '1'); } catch (e) {}
        var m = {}; m[slug] = d.views; paint(m);
      }).catch(function () {});
  } else if (document.querySelector('.views[data-slug]')) {
    // 首頁：一次取回全部計數填進卡片
    fetch('/api/views')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { if (d && d.views) paint(d.views); })
      .catch(function () {});
  }
})();
