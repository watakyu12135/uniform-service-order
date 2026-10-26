(function () {
  "use strict";

  let warningShown = false;
  let timerId = null;
  let lastTouchAt = 0;
  const listeners = [];

  function addTrackedListener(target, eventName, handler, options) {
    target.addEventListener(eventName, handler, options);
    listeners.push({ target: target, eventName: eventName, handler: handler, options: options });
  }

  function removeTrackedListeners() {
    listeners.splice(0).forEach(function (item) {
      item.target.removeEventListener(item.eventName, item.handler, item.options);
    });
  }

  function recordActivity() {
    const current = Date.now();
    // 連続入力でsessionStorageを書き続けないよう、更新は15秒に1回まで。
    if (current - lastTouchAt < 15000) return;
    if (window.uniformAuth.touch()) {
      lastTouchAt = current;
      warningShown = false;
    }
  }

  function start(options) {
    stop();
    options = options || {};
    const statusElement = options.statusElement || null;
    const onWarning = options.onWarning || function (seconds) {
      return window.confirm("無操作による認証終了まで約" + seconds + "秒です。入力を続けますか？");
    };
    const onExpired = options.onExpired || function () {
      window.uniformAuth.logout("timeout");
      location.replace("login.html?expired=1");
    };

    // 実際の入力・選択・ボタン操作で無操作時間だけを延長する。
    addTrackedListener(document, "input", recordActivity, true);
    addTrackedListener(document, "change", recordActivity, true);
    addTrackedListener(document, "click", function (event) {
      if (event.target.closest("button, a, input[type='button'], input[type='submit']")) {
        recordActivity();
      }
    }, true);

    function check() {
      const result = window.uniformAuth.validateSession();
      if (!result.ok) {
        stop();
        onExpired(result.reason);
        return;
      }

      const cfg = window.APP_CONFIG || {};
      const current = Date.now();
      const idleExpiresAt = Number(result.session.lastActivityAt) + Number(cfg.idleTimeoutMinutes || 2) * 60000;
      const absoluteExpiresAt = Number(result.session.absoluteExpiresAt);
      const expiresAt = Math.min(idleExpiresAt, absoluteExpiresAt);
      const idleRemaining = Math.max(0, idleExpiresAt - current);
      const absoluteRemaining = Math.max(0, absoluteExpiresAt - current);
      const remaining = Math.min(idleRemaining, absoluteRemaining);
      const seconds = Math.ceil(remaining / 1000);

      if (statusElement) {
        const idleMinutes = Math.max(1, Math.ceil(idleRemaining / 60000));
        const absoluteMinutes = Math.max(1, Math.ceil(absoluteRemaining / 60000));
        statusElement.textContent = "無操作 " + idleMinutes + "分 / 最大 " + absoluteMinutes + "分";
      }

      if (!warningShown && seconds <= Number(cfg.warningBeforeSeconds || 30)) {
        warningShown = true;
        if (onWarning(seconds) === true && window.uniformAuth.touch()) {
          lastTouchAt = Date.now();
          warningShown = false;
        }
      }
    }

    check();
    timerId = window.setInterval(check, 1000);
  }

  function stop() {
    if (timerId) window.clearInterval(timerId);
    timerId = null;
    removeTrackedListeners();
  }

  window.uniformSessionManager = Object.freeze({ start: start, stop: stop, recordActivity: recordActivity });
})();
