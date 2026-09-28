
/**
 * BarakaLink
 * Telegram authentication callback
 *
 * Handles:
 * - Telegram callback errors
 * - Registration verification tickets
 * - Password-reset verification tickets
 * - One-time ticket exchange
 * - JWT storage
 * - Password-reset token storage
 * - Role-based profile-completion redirect for newly registered users
 * - Role-based dashboard redirect for completed accounts
 * - Safe URL cleanup
 *
 * Expected backend endpoint:
 *
 * POST /api/auth/telegram/ticket
 *
 * Registration response:
 * {
 *   success: true,
 *   data: {
 *     type: "registration",
 *     token: "...",
 *     user: {...}
 *   }
 * }
 *
 * Password reset response:
 * {
 *   success: true,
 *   data: {
 *     type: "password_reset",
 *     resetToken: "..."
 *   }
 * }
 */

"use strict";

(function () {

  /* =======================================================
     CONSTANTS
  ======================================================= */

  const DASHBOARD_ROUTES = Object.freeze({
    ustaz: "dashboard/teacher.html",
    parent: "dashboard/student.html"
  });

  /*
    Newly registered users are sent to a role-specific
    profile completion page before entering the dashboard.
  */

  const PROFILE_COMPLETION_ROUTES = Object.freeze({
    ustaz: "ustaz-profile-completion.html",
    parent: "profile-completion.html"
  });

  const DEFAULT_RETURN_PATH =
    "index.html";

  const TELEGRAM_TICKET_STORAGE_KEY =
    "barakalink_telegram_ticket";

  const PASSWORD_RESET_TOKEN_KEY =
    "barakalink_password_reset_token";


  /* =======================================================
     ELEMENT REFERENCES
  ======================================================= */

  const title =
    document.getElementById(
      "callbackTitle"
    );

  const message =
    document.getElementById(
      "callbackMessage"
    );

  const spinner =
    document.getElementById(
      "callbackSpinner"
    );

  const errorElement =
    document.getElementById(
      "callbackError"
    );

  const retryButton =
    document.getElementById(
      "callbackRetry"
    );


  /* =======================================================
     UI STATE
  ======================================================= */

  function setState({
    heading = "",
    text = "",
    error = "",
    loading = false,
    showRetry = Boolean(error)
  } = {}) {

    if (title) {

      title.textContent =
        heading;

    }

    if (message) {

      message.textContent =
        text;

    }

    if (errorElement) {

      errorElement.textContent =
        error;

    }

    if (spinner) {

      spinner.style.display =
        loading
          ? "block"
          : "none";

    }

    if (retryButton) {

      retryButton.style.display =
        showRetry
          ? "inline-flex"
          : "none";

    }

  }


  /* =======================================================
     URL PARAMETERS
  ======================================================= */

  function getQueryParameters() {

    const params =
      new URLSearchParams(
        window.location.search
      );

    return {
      ticket:
        params.get("ticket"),

      error:
        params.get("error"),

      errorDescription:
        params.get("error_description"),

      message:
        params.get("message"),

      flow:
        params.get("flow")
    };

  }


  /* =======================================================
     SAFE ERROR MESSAGE
  ======================================================= */

  function getProviderErrorMessage(
    params
  ) {

    /*
      Never display arbitrary URL content as trusted
      HTML. textContent is used everywhere, so this
      remains plain text.
    */

    const providerMessage =
      params.errorDescription ||
      params.message;

    if (
      providerMessage &&
      providerMessage.length <= 300
    ) {

      return providerMessage;

    }

    return (
      "Telegram verification was cancelled or could not be completed."
    );

  }


  /* =======================================================
     REMOVE SENSITIVE URL DATA
  ======================================================= */

  function clearSensitiveUrl() {

    try {

      const cleanUrl =
        window.location.origin +
        window.location.pathname;

      window.history.replaceState(
        null,
        document.title,
        cleanUrl
      );

    } catch (error) {

      /*
        Failure to clean the callback URL should not stop
        authentication from completing.
      */

      console.warn(
        "Unable to clean callback URL:",
        error
      );

    }

  }


  /* =======================================================
     TEMPORARY TICKET STORAGE
  ======================================================= */

  function rememberTicket(
    ticket
  ) {

    if (!ticket) {
      return;
    }

    try {

      sessionStorage.setItem(
        TELEGRAM_TICKET_STORAGE_KEY,
        ticket
      );

    } catch (error) {

      /*
        Session storage is only a defensive browser-side
        reference. Authentication still depends entirely
        on server-side validation.
      */

      console.warn(
        "Unable to store temporary Telegram ticket:",
        error
      );

    }

  }


  function removeRememberedTicket() {

    try {

      sessionStorage.removeItem(
        TELEGRAM_TICKET_STORAGE_KEY
      );

    } catch (error) {

      console.warn(
        "Unable to remove temporary Telegram ticket:",
        error
      );

    }

  }


  /* =======================================================
     PASSWORD RESET TOKEN
  ======================================================= */

  function storePasswordResetToken(
    resetToken
  ) {

    if (!resetToken) {

      throw new Error(
        "The server did not return a password recovery token."
      );

    }

    try {

      sessionStorage.setItem(
        PASSWORD_RESET_TOKEN_KEY,
        resetToken
      );

    } catch (error) {

      console.error(
        "Unable to store reset token:",
        error
      );

      throw new Error(
        "Unable to create a secure password recovery session."
      );

    }

  }


  function removePasswordResetToken() {

    try {

      sessionStorage.removeItem(
        PASSWORD_RESET_TOKEN_KEY
      );

    } catch (error) {

      console.warn(
        "Unable to remove password reset token:",
        error
      );

    }

  }


  /* =======================================================
     PROFILE COMPLETION STATE
  ======================================================= */

  function isProfileCompleted(
    user
  ) {

    /*
      Support both naming styles in case the backend
      currently returns either:

        profileCompleted
        profile_completed

      The server remains the source of truth.
    */

    if (
      typeof user?.profileCompleted === "boolean"
    ) {

      return user.profileCompleted;

    }

    if (
      typeof user?.profile_completed === "boolean"
    ) {

      return user.profile_completed;

    }

    if (
      user?.profileCompleted === 1 ||
      user?.profileCompleted === "1"
    ) {

      return true;

    }

    if (
      user?.profile_completed === 1 ||
      user?.profile_completed === "1"
    ) {

      return true;

    }

    return false;

  }


  /* =======================================================
     PROFILE COMPLETION ROUTE
  ======================================================= */

  function getProfileCompletionRoute(
    user
  ) {

    const role =
      String(
        user?.role || ""
      )
        .trim()
        .toLowerCase();

    return (
      PROFILE_COMPLETION_ROUTES[role] ||
      PROFILE_COMPLETION_ROUTES.parent
    );

  }


  /* =======================================================
     ROLE REDIRECT
  ======================================================= */

  function redirectAfterAuthentication(
    user,
    options = {}
  ) {

    const isRegistration =
      options.registration === true;

    /*
      Newly registered accounts must complete the
      role-specific profile flow before entering a dashboard.

      Parent:
        profile-completion.html

      Ustaz:
        ustaz-profile-completion.html
    */

    if (
      isRegistration &&
      !isProfileCompleted(user)
    ) {

      const profileRoute =
        getProfileCompletionRoute(
          user
        );

      window.location.replace(
        profileRoute
      );

      return;

    }

    /*
      For authenticated users whose profile is already
      complete, continue to the role dashboard.
    */

    const role =
      String(
        user?.role || ""
      )
        .trim()
        .toLowerCase();

    const target =
      DASHBOARD_ROUTES[role] ||
      DEFAULT_RETURN_PATH;

    window.location.replace(
      target
    );

  }


  /* =======================================================
     TICKET EXCHANGE
  ======================================================= */

  async function exchangeTicket(
    ticket
  ) {

    if (!window.BarakaLinkAPI) {

      throw new Error(
        "BarakaLink API is not available."
      );

    }

    if (
      typeof ticket !== "string" ||
      !ticket.trim()
    ) {

      throw new Error(
        "The verification ticket is missing."
      );

    }

    const response =
      await window.BarakaLinkAPI.post(
        "/auth/telegram/ticket",
        {
          ticket:
            ticket.trim()
        }
      );

    if (!response?.success) {

      throw new Error(
        response?.message ||
        "Telegram verification could not be completed."
      );

    }

    if (!response.data) {

      throw new Error(
        "The server returned an incomplete verification response."
      );

    }

    return response.data;

  }


  /* =======================================================
     HANDLE REGISTRATION
  ======================================================= */

  function handleRegistrationResult(
    data
  ) {

    const token =
      data?.token;

    if (!token) {

      throw new Error(
        "The server did not return an authentication token."
      );

    }

    /*
      Registration has completed server-side.
      Store the normal BarakaLink JWT.
    */

    window.BarakaLinkAPI.setToken(
      token
    );

    /*
      A password-reset credential must never remain
      active when normal authentication succeeds.
    */

    removePasswordResetToken();

    setState({
      heading:
        "Verification complete",

      text:
        "Your BarakaLink account has been verified successfully. Redirecting to profile setup...",

      loading:
        false,

      showRetry:
        false
    });

    window.setTimeout(
      function () {

        redirectAfterAuthentication(
          data?.user,
          {
            registration:
              true
          }
        );

      },
      350
    );

  }


  /* =======================================================
     HANDLE PASSWORD RESET
  ======================================================= */

  function handlePasswordResetResult(
    data
  ) {

    const resetToken =
      data?.resetToken;

    if (!resetToken) {

      throw new Error(
        "The server did not return a password recovery token."
      );

    }

    /*
      This is NOT a login JWT.
      It must only authorize the password-reset endpoint.
    */

    storePasswordResetToken(
      resetToken
    );

    /*
      Do not retain a normal login JWT from a previous
      session while entering password recovery.
    */

    if (window.BarakaLinkAPI) {

      window.BarakaLinkAPI.clearToken();

    }

    setState({
      heading:
        "Telegram verified",

      text:
        "Your identity has been verified. Redirecting you to create a new password...",

      loading:
        false,

      showRetry:
        false
    });

    window.setTimeout(
      function () {

        window.location.replace(
          "reset-password.html"
        );

      },
      350
    );

  }


  /* =======================================================
     HANDLE UNKNOWN TICKET TYPE
  ======================================================= */

  function handleTicketResult(
    data
  ) {

    const type =
      String(
        data?.type || ""
      )
        .trim()
        .toLowerCase();

    /*
      Explicit type is preferred.
    */

    if (
      type === "registration"
    ) {

      handleRegistrationResult(
        data
      );

      return;

    }

    if (
      type === "password_reset"
    ) {

      handlePasswordResetResult(
        data
      );

      return;

    }

    /*
      Backward-compatible fallback:
      a response containing a JWT is treated as
      successful registration authentication.
    */

    if (
      data?.token
    ) {

      handleRegistrationResult(
        data
      );

      return;

    }

    if (
      data?.resetToken
    ) {

      handlePasswordResetResult(
        data
      );

      return;

    }

    throw new Error(
      "The verification response was incomplete or invalid."
    );

  }


  /* =======================================================
     MAIN CALLBACK FLOW
  ======================================================= */

  async function processCallback() {

    setState({
      heading:
        "Verifying your Telegram",

      text:
        "Please wait while we securely complete your verification.",

      loading:
        true,

      showRetry:
        false
    });

    const params =
      getQueryParameters();

    /*
      Clean the URL as early as possible.
      The ticket is already captured in memory.
    */

    clearSensitiveUrl();

    /*
      Provider-level error.
    */

    if (
      params.error
    ) {

      throw new Error(
        getProviderErrorMessage(
          params
        )
      );

    }

    const ticket =
      typeof params.ticket === "string"
        ? params.ticket.trim()
        : "";

    if (!ticket) {

      throw new Error(
        "No verification ticket was received."
      );

    }

    /*
      Store only as a temporary browser reference.
      The server remains the source of truth.
    */

    rememberTicket(
      ticket
    );

    /*
      A ticket must be accepted exactly once by the
      server. If the server has already consumed it,
      the exchange must fail.
    */

    const result =
      await exchangeTicket(
        ticket
      );

    /*
      The ticket has now been processed.
      Do not keep the temporary copy.
    */

    removeRememberedTicket();

    handleTicketResult(
      result
    );

  }


  /* =======================================================
     RETURN BUTTON
  ======================================================= */

  if (retryButton) {

    retryButton.addEventListener(
      "click",
      function () {

        /*
          Clean up any temporary authentication state
          before returning to the public page.
        */

        removeRememberedTicket();

        /*
          A failed callback must not accidentally leave
          a reset credential around.
        */

        removePasswordResetToken();

        window.location.replace(
          DEFAULT_RETURN_PATH
        );

      }
    );

  }


  /* =======================================================
     START CALLBACK PROCESSING
  ======================================================= */

  processCallback()
    .catch(
      function (error) {

        console.error(
          "Telegram callback error:",
          error
        );

        removeRememberedTicket();

        /*
          Do not automatically delete a reset token here.
          If the server returned a valid reset token and a
          later navigation issue occurs, keeping it in the
          current session can still allow recovery to continue.

          The token itself is short-lived and one-time server-side.
        */

        setState({

          heading:
            "Verification failed",

          text:
            "We could not complete your Telegram verification.",

          error:
            error?.message ||
            "Please return to BarakaLink and try again.",

          loading:
            false,

          showRetry:
            true

        });

      }
    );


  /* =======================================================
     PUBLIC API
  ======================================================= */

  window.BarakaLinkAuthCallback = {

    process:
      processCallback,

    exchangeTicket,

    clearSensitiveUrl,

    removeRememberedTicket,

    removePasswordResetToken

  };

})();
