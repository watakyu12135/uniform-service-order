(function () {
  "use strict";

  function getConfig() {
    if (!window.APP_CONFIG) {
      throw new Error("APP_CONFIGが読み込まれていません。");
    }
    return window.APP_CONFIG;
  }

  async function submitRegistration(payload) {
    const config = getConfig();

    if (config.mode === "preview" || config.allowExternalRegistration !== true) {
      return {
        ok: true,
        preview: true,
        message: "実験版のため外部へ送信していません。",
        payload: payload
      };
    }

    if (!config.registrationApiUrl) {
      throw new Error("登録APIのURLが設定されていません。");
    }

    const response = await fetch(config.registrationApiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload)
    });

    const responseText = await response.text();
    let responseBody = null;
    if (responseText) {
      try {
        responseBody = JSON.parse(responseText);
      } catch {
        responseBody = { message: responseText };
      }
    }

    if (!response.ok) {
      const error = new Error(
        responseBody?.message || "登録APIへの送信に失敗しました。"
      );
      error.status = response.status;
      error.body = responseBody;
      throw error;
    }

    return {
      ok: true,
      preview: false,
      message: responseBody?.message || "登録しました。",
      data: responseBody
    };
  }

  window.uniformApiClient = Object.freeze({ submitRegistration });
})();
