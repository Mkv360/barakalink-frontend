/**
 * BarakaLink
 * Forgot Password
 *
 * Flow:
 * 1. User enters phone
 * 2. Backend starts password-reset challenge
 * 3. Backend returns Telegram authorization URL
 * 4. User verifies with Telegram
 * 5. Telegram redirects to auth-callback.html?ticket=...
 * 6. Ticket is exchanged
 * 7. Backend returns a short-lived reset authorization token
 * 8. User is redirected to reset-password.html
 */

"use strict";

(function () {

  /* =======================================================
     CONSTANTS
  ======================================================= */

  const RESET_TOKEN_KEY =
    "barakalink_password_reset_token";

  /* =======================================================
     ELEMENTS
  ======================================================= */

  const form =
    document.getElementById(
      "forgotPasswordForm"
    );

  const phoneInput =
    document.getElementById(
      "forgotPhone"
    );

  const phoneError =
    document.getElementById(
      "forgotPhoneError"
    );

  const statusElement =
    document.getElementById(
      "forgotStatus"
    );

  const continueButton =
    document.getElementById(
      "forgotContinueButton"
    );

  const telegramStep =
    document.getElementById(
      "forgotStepTelegram"
    );

  const phoneStep =
    document.getElementById(
      "forgotStepPhone"
    );

  const telegramButton =
    document.getElementById(
      "forgotTelegramButton"
    );

  const telegramError =
    document.getElementById(
      "forgotTelegramError"
    );


  /* =======================================================
     STATE
  ======================================================= */

  let pendingReset =
    null;


  /* =======================================================
     PHONE NORMALIZATION
  ======================================================= */

  function normalizePhone(value) {

    let phone =
      String(value || "")
        .replace(
          /\D/g,
          ""
        );

    if (
      phone.startsWith("251")
    ) {

      return phone;

    }

    if (
      phone.startsWith("0")
    ) {

      phone =
        phone.slice(1);

    }

    if (
      phone.startsWith("9") &&
      phone.length === 9
    ) {

      return `251${phone}`;

    }

    return phone;
  }


  /* =======================================================
     UI
  ======================================================= */

  function setText(
    element,
    text
  ) {

    if (element) {
      element.textContent =
        text || "";
    }
  }


  function clearMessages() {

    setText(
      phoneError,
      ""
    );

    setText(
      statusElement,
      ""
    );

    setText(
      telegramError,
      ""
    );
  }


  function showTelegramStep() {

    if (phoneStep) {
      phoneStep.style.display =
        "none";
    }

    if (telegramStep) {
      telegramStep.style.display =
        "block";
    }
  }


  function showPhoneStep() {

    if (telegramStep) {
      telegramStep.style.display =
        "none";
    }

    if (phoneStep) {
      phoneStep.style.display =
        "block";
    }
  }


  function setButtonLoading(
    button,
    loadingText
  ) {

    if (!button) {
      return;
    }

    if (
      !button.dataset.originalHtml
    ) {

      button.dataset.originalHtml =
        button.innerHTML;

    }

    button.disabled =
      true;

    button.innerHTML =
      `
      ${loadingText}
      <i class="fa-solid fa-spinner fa-spin"></i>
      `;
  }


  function restoreButton(
    button
  ) {

    if (!button) {
      return;
    }

    button.disabled =
      false;

    if (
      button.dataset.originalHtml
    ) {

      button.innerHTML =
        button.dataset.originalHtml;

    }
  }


  /* =======================================================
     VALIDATION
  ======================================================= */

  function validatePhone(
    phone
  ) {

    if (
      !/^2519\d{8}$/.test(
        phone
      )
    ) {

      setText(
        phoneError,
        "Enter a valid Ethiopian phone number."
      );

      return false;
    }

    return true;
  }


  /* =======================================================
     START RESET
  ======================================================= */

  async function startPasswordReset(
    phone
  ) {

    if (!window.BarakaLinkAPI) {

      throw new Error(
        "BarakaLink API is not available."
      );
    }

    const response =
      await window.BarakaLinkAPI.post(
        "/auth/forgot-password/start",
        {
          phone
        }
      );

    if (!response?.success) {

      throw new Error(
        response?.message ||
        "Unable to start password recovery."
      );
    }

    const challengeId =
      response?.data?.challengeId;

    if (!challengeId) {

      throw new Error(
        "The server did not return a recovery challenge."
      );
    }

    pendingReset = {
      challengeId,
      phone
    };

    /*
      Some backend implementations may return the
      authorization URL directly.

      Others may require /auth/forgot-password/telegram/start.
      We support both without weakening verification.
    */

    const authorizationUrl =
      response?.data?.authorizationUrl;

    if (authorizationUrl) {
      return authorizationUrl;
    }

    const telegramResponse =
      await window.BarakaLinkAPI.post(
        "/auth/forgot-password/telegram/start",
        {
          challengeId
        }
      );

    if (!telegramResponse?.success) {

      throw new Error(
        telegramResponse?.message ||
        "Unable to start Telegram verification."
      );
    }

    const url =
      telegramResponse?.data?.authorizationUrl;

    if (!url) {

      throw new Error(
        "Telegram authorization URL was not returned."
      );
    }

    return url;
  }


  /* =======================================================
     FORM SUBMIT
  ======================================================= */

  if (form) {

    form.addEventListener(
      "submit",
      async function (event) {

        event.preventDefault();

        clearMessages();

        const phone =
          normalizePhone(
            phoneInput?.value || ""
          );

        if (
          !validatePhone(
            phone
          )
        ) {

          return;
        }

        setButtonLoading(
          continueButton,
          "Starting recovery"
        );

        try {

          /*
            Generic server-side wording is important here.
            The backend should not reveal whether an account exists.
          */

          const authorizationUrl =
            await startPasswordReset(
              phone
            );

          window.location.href =
            authorizationUrl;

        } catch (error) {

          console.error(
            "Forgot password error:",
            error
          );

          /*
            We display only the server's safe public message.
          */

          setText(
            statusElement,
            error?.message ||
            "Unable to start password recovery."
          );

          restoreButton(
            continueButton
          );
        }

      }
    );

  }


  /* =======================================================
     TELEGRAM RETRY
  ======================================================= */

  if (telegramButton) {

    telegramButton.addEventListener(
      "click",
      async function () {

        setText(
          telegramError,
          ""
        );

        if (!pendingReset?.challengeId) {

          setText(
            telegramError,
            "Your recovery session has expired. Please start again."
          );

          showPhoneStep();

          return;
        }

        setButtonLoading(
          telegramButton,
          "Opening Telegram"
        );

        try {

          const response =
            await window.BarakaLinkAPI.post(
              "/auth/forgot-password/telegram/start",
              {
                challengeId:
                  pendingReset.challengeId
              }
            );

          if (!response?.success) {

            throw new Error(
              response?.message ||
              "Unable to start Telegram verification."
            );
          }

          const authorizationUrl =
            response?.data?.authorizationUrl;

          if (!authorizationUrl) {

            throw new Error(
              "Telegram authorization URL was not returned."
            );
          }

          window.location.href =
            authorizationUrl;

        } catch (error) {

          console.error(
            "Telegram recovery error:",
            error
          );

          setText(
            telegramError,
            error?.message ||
            "Unable to open Telegram."
          );

          restoreButton(
            telegramButton
          );
        }

      }
    );

  }


  /* =======================================================
     PUBLIC API
  ======================================================= */

  window.BarakaLinkForgotPassword = {

    normalizePhone,

    showTelegramStep,

    showPhoneStep

  };

})();