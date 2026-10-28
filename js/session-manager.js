(function () {
  "use strict";

  let idleWarningShown = false;
  let absoluteWarningShown = false;
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
    if (current - lastTouchAt < 15000) return;
    if (window.uniformAuth.touch()) {
      lastTouchAt = current;
      idleWarningShown = false;
    }
  }

  function start(options) {
    stop();
    idleWarningShown = false;
    absoluteWarningShown = false;
    options = options || {};

    const statusElement = options.statusElement || null;
    const onIdleWarning = options.onIdleWarning || function (seconds) {
      return window.confirm(
        "無操作による認証終了まで約" + seconds +
        "秒です。\n\n入力を続けますか？"
      );
    };
    const onAbsoluteWarning = options.onAbsoluteWarning || function (seconds) {
      window.alert(
        "この認証は最大利用時間に達するため、約" + seconds +
        "秒後に終了します。\n\n入力中の内容を確認してください。"
      );
    };
    const onExpired = options.onExpired || function (reason) {
      const logoutReason = reason === "idle-timeout" ? "idle-timeout" : "absolute-timeout";
      window.uniformAuth.logout(logoutReason);
      location.replace("login.html");
    };

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
      const warningSeconds = Number(cfg.warningBeforeSeconds || 30);
      const idleExpiresAt = Number(result.session.lastActivityAt) + Number(cfg.idleTimeoutMinutes || 2) * 60000;
      const absoluteExpiresAt = Number(result.session.absoluteExpiresAt);
      const idleSeconds = Math.max(0, Math.ceil((idleExpiresAt - current) / 1000));
      const absoluteSeconds = Math.max(0, Math.ceil((absoluteExpiresAt - current) / 1000));

      if (statusElement) {
        const idleLabel = idleSeconds >= 60
          ? Math.ceil(idleSeconds / 60) + "分"
          : idleSeconds + "秒";
        const absoluteLabel = absoluteSeconds >= 60
          ? Math.ceil(absoluteSeconds / 60) + "分"
          : absoluteSeconds + "秒";
        statusElement.textContent = "無操作 " + idleLabel + " / 最大 " + absoluteLabel;
      }

      // 最大利用時間は延長できないため、警告は1回だけ表示する。
      if (!absoluteWarningShown && absoluteSeconds <= warningSeconds) {
        absoluteWarningShown = true;
        onAbsoluteWarning(absoluteSeconds);
        return;
      }

      // 最大期限が先に来る場合は、無操作警告を重ねて表示しない。
      if (absoluteSeconds <= idleSeconds) return;

      // 無操作警告は「続ける」で延長できるため、次の無操作時には再表示可能。
      if (!idleWarningShown && idleSeconds <= warningSeconds) {
        idleWarningShown = true;
        if (onIdleWarning(idleSeconds) === true && window.uniformAuth.touch()) {
          lastTouchAt = Date.now();
          idleWarningShown = false;
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

  window.uniformSessionManager = Object.freeze({
    start: start,
    stop: stop,
    recordActivity: recordActivity
  });
})();
