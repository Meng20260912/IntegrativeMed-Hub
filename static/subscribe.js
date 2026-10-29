// 訂閱新文章通知：把表單送到同站的 /api/subscribe（Cloudflare D1 儲存）
// 沒有第三方服務、沒有追蹤腳本、沒有 Cookie。JavaScript 失效時表單會改走一般送出，
// 由 /subscribe/ 頁面的說明接手（見 noscript 區塊）。
(function () {
  // 畫面上的文字都在這裡，API 只回狀態代號
  var MSG = {
    created: '收到了。確認信由每日排程寄出，一天內會寄到你的信箱，請點信裡的連結完成訂閱。沒看到的話，記得找一下垃圾信匣。',
    pending: '這個信箱已經在等確認信了，一天內會寄到。請點信裡的連結完成訂閱。',
    already: '你已經訂閱了，新文章上線時會寄通知給你。',
    'invalid-email': '這個信箱的格式看起來不對，麻煩檢查一下再送出。',
    'rate-limited': '這個網路位置剛剛送出太多次，請過一小時再試。',
    unavailable: '訂閱功能維護中，請稍後再試。',
    error: '送出時出了狀況，請稍後再試一次。'
  };

  function show(box, text, ok) {
    if (!box) return;
    box.textContent = text;
    box.className = 'sub-msg' + (ok ? ' is-ok' : ' is-err');
    box.hidden = false;
  }

  document.querySelectorAll('form[data-subscribe]').forEach(function (form) {
    var box = form.parentNode.querySelector('[data-sub-msg]');
    var btn = form.querySelector('button[type=submit]');
    var input = form.querySelector('input[name=email]');

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = (input && input.value || '').trim();
      if (!email) { show(box, '請先填入電子郵件地址。', false); if (input) input.focus(); return; }

      if (btn) { btn.disabled = true; btn.dataset.label = btn.textContent; btn.textContent = '送出中…'; }

      fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: email,
          nickname: (form.querySelector('input[name=nickname]') || {}).value || '',
          source: location.pathname
        })
      }).then(function (r) {
        return r.json().then(function (d) { return { status: r.status, data: d || {} }; });
      }).then(function (res) {
        var d = res.data;
        if (d.ok) {
          show(box, MSG[d.state] || MSG.created, true);
          if (d.state !== 'already' && input) input.value = '';
        } else {
          show(box, MSG[d.error] || MSG.error, false);
        }
      }).catch(function () {
        show(box, MSG.error, false);
      }).then(function () {
        if (btn) { btn.disabled = false; btn.textContent = btn.dataset.label || '訂閱'; }
      });
    });
  });
})();
