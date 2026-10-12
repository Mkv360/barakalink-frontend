"use strict";
import { CONFIG, state } from "./teacher-state.js";

function getToken() {
    try {
      if (
        window.BarakaLinkAPI &&
        typeof window.BarakaLinkAPI.getToken ===
          "function"
      ) {
        const token =
          window.BarakaLinkAPI.getToken();

        if (token) return token;
      }
    } catch (error) {
      console.warn(
        "[BarakaLink][Ustaz Dashboard] Unable to read API token:",
        error
      );
    }

    for (const key of CONFIG.TOKEN_KEYS) {
      try {
        const localToken =
          localStorage.getItem(key);

        if (localToken) return localToken;
      } catch (_) {}

      try {
        const sessionToken =
          sessionStorage.getItem(key);

        if (sessionToken) return sessionToken;
      } catch (_) {}
    }

    return "";
  }



  function clearSession() {
    stopMessageNotificationPolling();

    const keys = [
      ...CONFIG.TOKEN_KEYS,
      "barakalink_user",
      "barakalink_session",
      "user",
    ];

    keys.forEach((key) => {
      try {
        localStorage.removeItem(key);
      } catch (_) {}

      try {
        sessionStorage.removeItem(key);
      } catch (_) {}
    });
  }



  function redirectToLogin() {
    clearSession();
    window.location.replace(
      CONFIG.LOGIN_PATH
    );
  }



  function redirectToProfile() {
    window.location.replace(
      CONFIG.PROFILE_PATH
    );
  }



  function stopMessageNotificationPolling() {
    if (
      state.messageNotificationTimer !==
      null
    ) {
      window.clearInterval(
        state.messageNotificationTimer
      );

      state.messageNotificationTimer =
        null;
    }
  }

export { getToken, clearSession, redirectToLogin, redirectToProfile, stopMessageNotificationPolling };
