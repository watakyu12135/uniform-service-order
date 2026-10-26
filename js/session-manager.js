(function () {
  "use strict";

  let warningShown = false;
  let timerId = null;

  function start(options) {
    options = options || {};
    const statusElement = options.statusElement || null;
    const onWarning = options.onWarning || function (seconds) {
      return window.confirm("認証期限まで約" + seconds + "秒です。入力を続けますか？");
    };
    const onExpired = options.onExpired || function () {
      window.uniformAuth.logout("timeout");
      location.replace("login.html?expired=1");
    };

    function check() {
      const result = window.uniformAuth.validateSession();
      if (!result.ok) { clearInterval(timerId); onExpired(result.reason); return; }

      const cfg = window.APP_CONFIG || {};
      const now = Date.now();
      const idleExpiresAt = Number(result.session.lastActivityAt) + Number(cfg.idleTimeoutMinutes || 2) * 60000;
      const expiresAt = Math.min(idleExpiresAt, Number(result.session.absoluteExpiresAt));
      const remaining = Math.max(0, expiresAt - now);
      const seconds = Math.ceil(remaining / 1000);
      if (statusElement) statusElement.textContent = "認証残り約 " + Math.ceil(seconds / 60) + " 分";

      if (!warningShown && seconds <= Number(cfg.warningBeforeSeconds || 30)) {
        warningShown = true;
        if (onWarning(seconds) === true && window.uniformAuth.touch()) warningShown = false;
      }
    }

    check();
    timerId = window.setInterval(check, 1000);
  }

  function stop() { if (timerId) clearInterval(timerId); timerId = null; }
  window.uniformSessionManager = Object.freeze({ start, stop });
})();
