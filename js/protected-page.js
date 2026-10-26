(function () {
  "use strict";

  function currentReturnPath() {
    return location.pathname.split("/").pop() + location.search;
  }

  function redirectToLogin(reason) {
    if (document.documentElement) document.documentElement.style.visibility = "hidden";
    const params = new URLSearchParams();
    params.set("return", currentReturnPath());
    if (reason === "idle" || reason === "absolute") params.set("expired", "1");
    location.replace("login.html?" + params.toString());
  }

  function validateOrRedirect() {
    const result = window.uniformAuth.validateSession();
    if (!result.ok) {
      redirectToLogin(result.reason);
      return null;
    }
    if (document.documentElement) document.documentElement.style.visibility = "";
    return result.session;
  }

  window.uniformProtectedPage = Object.freeze({ validateOrRedirect, redirectToLogin });
  window.addEventListener("pageshow", function () { validateOrRedirect(); });
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") validateOrRedirect();
  });
})();
