// 首頁標籤 / 關鍵字篩選。
// 卡片本身是建置階段寫進 HTML 的靜態內容，這裡只做顯示與隱藏，不產生列表。
(function () {
  var grid = document.getElementById('grid');
  if (!grid) return;
  var cards = [].slice.call(grid.querySelectorAll('.card'));
  var chips = [].slice.call(document.querySelectorAll('#tagChips .chip'));
  var q = document.getElementById('q');
  var countEl = document.getElementById('resultCount');
  var noResult = document.getElementById('noResult');
  var total = cards.length;
  var activeTag = '';

  function apply() {
    var term = (q && q.value || '').trim().toLowerCase();
    var shown = 0;
    cards.forEach(function (c) {
      var tags = (c.dataset.tags || '').split('|');
      var okTag = !activeTag || tags.indexOf(activeTag) !== -1;
      var okTerm = !term || (c.dataset.search || '').indexOf(term) !== -1;
      var show = okTag && okTerm;
      c.hidden = !show;
      if (show) shown++;
    });
    if (noResult) noResult.hidden = shown !== 0;
    if (countEl) {
      countEl.textContent = (shown === total)
        ? total + ' 篇 · 依最後更新時間排序'
        : '顯示 ' + shown + ' / ' + total + ' 篇';
    }
  }

  chips.forEach(function (btn) {
    btn.addEventListener('click', function () {
      activeTag = btn.dataset.tag || '';
      chips.forEach(function (b) { b.setAttribute('aria-pressed', String(b === btn)); });
      apply();
    });
  });

  if (q) {
    var t;
    q.addEventListener('input', function () { clearTimeout(t); t = setTimeout(apply, 120); });
  }
})();
