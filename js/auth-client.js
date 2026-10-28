(function () {
  "use strict";

  const SESSION_KEY = "uniformAuthSession";
  const LOGOUT_BROADCAST_KEY = "uniformLogoutBroadcast";

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
      return { ok: true, session: createSession("password-test", "gtYuD7SG") };
    }
    return { ok: false, message: "ユーザーIDまたはパスワードが正しくありません。" };
  }

  function checkCustomerAccess(customerStatus) {
    if (customerStatus === "expired") {
      return {
        ok: false,
        stage: "customer",
        code: "CUSTOMER_EXPIRED",
        message: "この採寸ページの公開期限は終了しています。"
      };
    }
    if (customerStatus === "disabled") {
      return {
        ok: false,
        stage: "customer",
        code: "CUSTOMER_DISABLED",
        message: "この採寸ページは現在利用できません。"
      };
    }
    return { ok: true };
  }

  function loginWithQr(token, customerKey, customerStatus) {
    // 第1段階：QR認証コード自体を確認する。
    if (token === "QR_TEST_DISABLED") {
      return {
        ok: false,
        stage: "qr",
        code: "QR_DISABLED",
        message: "このQRコードは現在使用できません。"
      };
    }
    if (token !== "QR_TEST_SUCCESS") {
      return {
        ok: false,
        stage: "qr",
        code: "QR_INVALID",
        message: "QRコードを確認できませんでした。"
      };
    }

    // 第2段階：QRに紐づく顧客の有効状態と公開期限を確認する。
    const customerResult = checkCustomerAccess(customerStatus || "active");
    if (!customerResult.ok) return customerResult;

    return {
      ok: true,
      stage: "complete",
      session: createSession("qr-test", "gtYuD7SG")
    };
  }

  function bindCustomerIdentity(customerCode, customerName) {
    const session = getSession();
    if (!session) return { ok: false, message: "認証セッションがありません。" };
    const code = String(customerCode || "").trim();
    const name = String(customerName || "").trim();
    if (!code || !name) return { ok: false, message: "顧客コードまたは顧客名称を取得できません。" };
    if ((session.customerCode && session.customerCode !== code) ||
        (session.customerName && session.customerName !== name && session.customerName !== "AWS移行実験用顧客")) {
      return { ok: false, message: "認証セッションと顧客設定が一致しません。" };
    }
    session.customerCode = code;
    session.customerName = name;
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return { ok: true, session: session };
  }

  function getSession() {
    try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null"); }
    catch { return null; }
  }

  function getLogoutBroadcast() {
    try { return JSON.parse(localStorage.getItem(LOGOUT_BROADCAST_KEY) || "null"); }
    catch { return null; }
  }

  function validateSession() {
    const session = getSession();
    if (!session || session.authenticated !== true) return { ok: false, reason: "unauthenticated" };
    const broadcast = getLogoutBroadcast();
    if (broadcast && Number(broadcast.at || 0) > Number(session.issuedAt || 0)) {
      return { ok: false, reason: "cross-tab-logout" };
    }
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

  function logout(reason, options) {
    const normalizedReason = reason === "idle-timeout" ? "idle-timeout" :
      ((reason === "absolute-timeout" || reason === "timeout") ? "absolute-timeout" : "manual");
    const shouldBroadcast = !options || options.broadcast !== false;
    sessionStorage.removeItem(SESSION_KEY);
    clearPreviousApplicationData();
    sessionStorage.removeItem("uniformCustomer");
    sessionStorage.removeItem("uniformCustomerContextNotice");
    sessionStorage.setItem("uniformLogoutReason", normalizedReason);
    if (shouldBroadcast) localStorage.setItem(LOGOUT_BROADCAST_KEY, JSON.stringify({ reason: normalizedReason, at: now(), nonce: Math.random().toString(36).slice(2) }));
  }

  function requireAuth() {
    const checked = validateSession();
    if (checked.ok) return checked.session;
    logout(checked.reason);
    const returnUrl = location.pathname.split("/").pop() + location.search;
    location.replace("login.html?return=" + encodeURIComponent(returnUrl));
    return null;
  }

  window.uniformAuth = Object.freeze({ login, loginWithQr, checkCustomerAccess, getSession, validateSession, touch, logout, requireAuth, clearPreviousApplicationData });
})();
