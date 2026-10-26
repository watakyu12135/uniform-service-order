(function () {
  "use strict";

  const SESSION_KEY = "uniformAuthSession";

  function now() { return Date.now(); }
  function config() { return window.APP_CONFIG || {}; }

  function clearPreviousApplicationData() {
    // 新しい認証を開始するときは、前回の入力途中・確認・修正データを引き継がない。
    [
      "uniformDraft",
      "uniformDraftPending",
      "uniformReturnToIndex",
      "uniformConfirmPin",
      "uniformComplete",
      "uniformMailDraft",
      "uniformEditData",
      "uniformEditCustomer"
    ].forEach(function (key) {
      sessionStorage.removeItem(key);
    });
  }

  function createSession(authMethod, customerKey, customerName) {
    clearPreviousApplicationData();
    const issuedAt = now();
    const session = {
      authenticated: true,
      authMethod: authMethod,
      customerKey: customerKey || "gtYuD7SG",
      customerName: customerName || "AWS移行実験用顧客",
      issuedAt: issuedAt,
      lastActivityAt: issuedAt,
      absoluteExpiresAt: issuedAt + (Number(config().absoluteTimeoutMinutes || 5) * 60 * 1000)
    };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return session;
  }

  function login(userId, password, customerKey) {
    // GitHub Pages上の画面確認専用。AWS移行後はCognito認証へ交換する。
    if (userId === "TEST" && password === "TEST1234") {
      return { ok: true, session: createSession("password-test", customerKey) };
    }
    return { ok: false, message: "ユーザーIDまたはパスワードが正しくありません。" };
  }

  function loginWithQr(token, customerKey) {
    const results = {
      QR_TEST_EXPIRED: "このQRコードは有効期限が切れています。",
      QR_TEST_DISABLED: "このQRコードは現在停止されています。",
      QR_TEST_INVALID: "QRコードを確認できませんでした。"
    };
    if (token === "QR_TEST_SUCCESS") {
      return { ok: true, session: createSession("qr-test", customerKey) };
    }
    return { ok: false, message: results[token] || "QR認証コードが指定されていないか、不正です。" };
  }

  function getSession() {
    try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null"); }
    catch { return null; }
  }

  function validateSession() {
    const session = getSession();
    if (!session || session.authenticated !== true) return { ok: false, reason: "unauthenticated" };
    const current = now();
    const idleLimit = Number(config().idleTimeoutMinutes || 2) * 60 * 1000;
    if (current >= Number(session.absoluteExpiresAt || 0)) return { ok: false, reason: "absolute-timeout" };
    if (current - Number(session.lastActivityAt || 0) >= idleLimit) return { ok: false, reason: "idle-timeout" };
    return { ok: true, session: session };
  }

  function touch() {
    const checked = validateSession();
    if (!checked.ok) return false;
    checked.session.lastActivityAt = now();
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(checked.session));
    return true;
  }

  function logout(reason) {
    sessionStorage.removeItem(SESSION_KEY);
    if (reason) sessionStorage.setItem("uniformLogoutReason", reason);
  }

  function requireAuth() {
    const checked = validateSession();
    if (checked.ok) return checked.session;
    logout(checked.reason);
    const returnUrl = location.pathname.split("/").pop() + location.search;
    location.replace("login.html?return=" + encodeURIComponent(returnUrl));
    return null;
  }

  window.uniformAuth = Object.freeze({ login, loginWithQr, getSession, validateSession, touch, logout, requireAuth, clearPreviousApplicationData });
})();
