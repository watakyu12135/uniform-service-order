(function () {
  "use strict";

  function currentFileName() {
    return location.pathname.split("/").pop() || "index.html";
  }

  function currentReturnPath() {
    return currentFileName() + location.search;
  }

  function redirectToLogin(reason) {
    const params = new URLSearchParams();
    params.set("return", currentReturnPath());
    if (reason === "idle-timeout" || reason === "absolute-timeout" || reason === "timeout") {
      params.set("expired", "1");
    }
    location.replace("login.html?" + params.toString());
  }

  function enforceCustomerContext(session) {
    // customerを利用する入力画面だけを対象にする。confirm.htmlはsessionStorageの入力内容を使用する。
    if (currentFileName() !== "index.html") return true;

    const authenticatedCustomer = String(session.customerKey || "").trim();
    if (!authenticatedCustomer) {
      window.uniformAuth.logout("customer-context-missing");
      redirectToLogin("customer-context-missing");
      return false;
    }

    const url = new URL(location.href);
    const requestedCustomer = String(url.searchParams.get("customer") || "").trim();

    if (requestedCustomer === authenticatedCustomer) return true;

    // URLのcustomerが未指定または別顧客なら、認証済み顧客の値で強制的に置き換える。
    // 不正な値をindex.htmlの既存初期化処理へ渡さないため、即座にlocation.replaceする。
    url.searchParams.set("customer", authenticatedCustomer);
    sessionStorage.setItem("uniformCustomerContextNotice", "corrected");
    location.replace(url.pathname.split("/").pop() + "?" + url.searchParams.toString() + url.hash);
    return false;
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

    if (!enforceCustomerContext(result.session)) return null;
    return result.session;
  }

  window.uniformProtectedPage = Object.freeze({
    validateOrRedirect: validateOrRedirect,
    redirectToLogin: redirectToLogin,
    enforceCustomerContext: enforceCustomerContext
  });

  window.addEventListener("pageshow", function () {
    validateOrRedirect();
  });

  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") validateOrRedirect();
  });
})();
