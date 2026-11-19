// 淺色／深色模式。預設跟隨系統；手動切換只記在 sessionStorage（關閉分頁即清除，不留在教室電腦）。
(function () {
  var KEY = 'th-theme';
  var root = document.documentElement;
  var order = ['auto', 'light', 'dark'];
  var label = { auto: '跟隨系統', light: '淺色', dark: '深色' };

  function read() {
    try {
      var v = sessionStorage.getItem(KEY);
      return order.indexOf(v) >= 0 ? v : 'auto';
    } catch (e) {
      return 'auto';
    }
  }

  function apply(mode) {
    if (mode === 'auto') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', mode);
    var btns = document.querySelectorAll('[data-theme-toggle]');
    for (var i = 0; i < btns.length; i++) {
      btns[i].setAttribute('aria-label', '外觀：' + label[mode] + '（點按切換）');
      btns[i].setAttribute('title', '外觀：' + label[mode]);
      btns[i].dataset.mode = mode;
    }
  }

  var current = read();
  apply(current);

  document.addEventListener('DOMContentLoaded', function () {
    apply(current);
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-theme-toggle]');
      if (!btn) return;
      current = order[(order.indexOf(current) + 1) % order.length];
      try {
        sessionStorage.setItem(KEY, current);
      } catch (err) {
        /* 無痕模式或停用儲存時，只套用不記住 */
      }
      apply(current);
    });
  });
})();
