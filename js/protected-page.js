(function () {
  "use strict";

  function currentReturnPath() {
    return location.pathname.split("/").pop() + location.search;
  }

  function redirectToLogin(reason) {
    const params = new URLSearchParams();
    params.set("return", currentReturnPath());
    if (reason === "idle-timeout" || reason === "absolute-timeout" || reason === "timeout") {
      params.set("expired", "1");
    }
    location.replace("login.html?" + params.toString());
  }

  function validateOrRedirect() {
    if (!window.uniformAuth || typeof window.uniformAuth.validateSession !== "function") {
      console.error("認証スクリプトを読み込めませんでした。");
      return null;
    }

    const result = window.uniformAuth.validateSession();
    if (!result.ok) {
      redirectToLogin(result.reason);
      return null;
    }
    return result.session;
  }

  window.uniformProtectedPage = Object.freeze({
    validateOrRedirect: validateOrRedirect,
    redirectToLogin: redirectToLogin
  });

  // 戻る操作やタブ復帰時も認証を再確認する。
  window.addEventListener("pageshow", function () {
    validateOrRedirect();
  });

  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") validateOrRedirect();
  });
})();
