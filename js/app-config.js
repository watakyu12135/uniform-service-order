(function () {
  "use strict";

  window.APP_CONFIG = Object.freeze({
    environmentName: "AWS移行実験版",
    mode: "preview",
    allowExternalRegistration: false,
    registrationApiUrl: "",
    idleTimeoutMinutes: 2,
    absoluteTimeoutMinutes: 5,
    warningBeforeSeconds: 30,
    debug: true
  });
})();
