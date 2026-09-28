/**
 * BarakaLink
 * Reset Password
 *
 * Uses a short-lived, one-time password-reset authorization
 * token obtained only after successful Telegram verification.
 */

"use strict";

(function () {

  /* =======================================================
     CONSTANTS
  ======================================================= */

  const RESET_TOKEN_KEY =
    "barakalink_password_reset_token";

  const MIN_PASSWORD_LENGTH =
    8;

  /* =======================================================
     ELEMENTS
  ======================================================= */

  const form =
    document.getElementById(
      "resetPasswordForm"
    );

  const passwordInput =
    document.getElementById(
      "newPassword"
    );

  const confirmInput =
    document.getElementById(
      "confirmNewPassword"
    );

  const passwordError =
    document.getElementById(
      "newPasswordError"
    );

  const confirmError =
    document.getElementById(
      "confirmNewPasswordError"
    );

  const statusElement =
    document.getElementById(
      "resetStatus"
    );

  const submitButton =
    document.getElementById(
      "resetPasswordButton"
    );


  /* =======================================================
     RESET TOKEN
  ======================================================= */

  function getResetToken() {

    try {

      return sessionStorage.getItem(
        RESET_TOKEN_KEY
      );

    } catch {

      return null;

    }
  }


  function setResetToken(
    token
  ) {

    if (!token) {
      return;
    }

    try {

      sessionStorage.setItem(
        RESET_TOKEN_KEY,
        token
      );

    } catch (error) {

      throw new Error(
        "Unable to create a secure recovery session."
      );

    }
  }


  function clearResetToken() {

    try {

      sessionStorage.removeItem(
        RESET_TOKEN_KEY
      );

    } catch {

      /* Ignore storage errors. */
    }
  }


  /* =======================================================
     PASSWORD TOGGLE
  ======================================================= */

  document
    .querySelectorAll(
      "[data-password]"
    )
    .forEach(
      function (button) {

        button.addEventListener(
          "click",
          function () {

            const input =
              document.getElementById(
                button.dataset.password
              );

            if (!input) {
              return;
            }

            const icon =
              button.querySelector("i");

            const show =
              input.type === "password";

            input.type =
              show
                ? "text"
                : "password";

            if (icon) {

              icon.className =
                show
                  ? "fa-solid fa-eye-slash"
                  : "fa-solid fa-eye";
            }

            button.setAttribute(
              "aria-label",
              show
                ? "Hide password"
                : "Show password"
            );

          }
        );

      }
    );


  /* =======================================================
     UI HELPERS
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


  function setLoading(
    loading
  ) {

    if (!submitButton) {
      return;
    }

    if (loading) {

      if (
        !submitButton.dataset.originalHtml
      ) {

        submitButton.dataset.originalHtml =
          submitButton.innerHTML;
      }

      submitButton.disabled =
        true;

      submitButton.innerHTML =
        `
        Resetting password
        <i class="fa-solid fa-spinner fa-spin"></i>
        `;

    } else {

      submitButton.disabled =
        false;

      if (
        submitButton.dataset.originalHtml
      ) {

        submitButton.innerHTML =
          submitButton.dataset.originalHtml;
      }

    }

  }


  function clearErrors() {

    setText(
      passwordError,
      ""
    );

    setText(
      confirmError,
      ""
    );

    setText(
      statusElement,
      ""
    );

  }


  /* =======================================================
     VALIDATION
  ======================================================= */

  function validatePassword(
    password
  ) {

    if (
      password.length <
      MIN_PASSWORD_LENGTH
    ) {

      setText(
        passwordError,
        `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`
      );

      return false;
    }

    return true;
  }


  function validateConfirmation(
    password,
    confirmation
  ) {

    if (
      password !== confirmation
    ) {

      setText(
        confirmError,
        "Passwords do not match."
      );

      return false;
    }

    return true;
  }


  /* =======================================================
     RESET REQUEST
  ======================================================= */

  async function submitPasswordReset(
    resetToken,
    password
  ) {

    if (!window.BarakaLinkAPI) {

      throw new Error(
        "BarakaLink API is not available."
      );
    }

    /*
      Do NOT place the reset token into the normal
      BarakaLink authorization header automatically.
      It is a distinct credential.
    */

    const response =
      await fetch(
        `${window.BarakaLinkAPI.base}/auth/reset-password`,
        {
          method:
            "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify({
              resetToken,
              password
            })
        }
      );

    let data;

    try {

      data =
        await response.json();

    } catch {

      throw new Error(
        "Invalid server response."
      );

    }

    if (!response.ok) {

      const error =
        new Error(
          data?.message ||
          "Password reset failed."
        );

      error.status =
        response.status;

      error.data =
        data;

      throw error;
    }

    if (!data?.success) {

      throw new Error(
        data?.message ||
        "Password reset failed."
      );

    }

    return data;
  }


  /* =======================================================
     FORM SUBMIT
  ======================================================= */

  if (form) {

    form.addEventListener(
      "submit",
      async function (event) {

        event.preventDefault();

        clearErrors();

        const resetToken =
          getResetToken();

        if (!resetToken) {

          setText(
            statusElement,
            "Your password recovery session is missing or has expired. Please start again."
          );

          return;
        }

        const password =
          passwordInput?.value || "";

        const confirmation =
          confirmInput?.value || "";

        let valid =
          true;

        if (
          !validatePassword(
            password
          )
        ) {

          valid =
            false;
        }

        if (
          !validateConfirmation(
            password,
            confirmation
          )
        ) {

          valid =
            false;
        }

        if (!valid) {
          return;
        }

        setLoading(
          true
        );

        try {

          await submitPasswordReset(
            resetToken,
            password
          );

          /*
            The token must not survive successful consumption.
          */

          clearResetToken();

          setText(
            statusElement,
            "Your password has been reset successfully. Redirecting to login..."
          );

          passwordInput.value =
            "";

          confirmInput.value =
            "";

          window.setTimeout(
            function () {

              window.location.replace(
                "index.html"
              );

            },
            1000
          );

        } catch (error) {

          console.error(
            "Password reset error:",
            error
          );

          /*
            An expired or consumed reset token should be
            discarded so it cannot keep being retried.
          */

          if (
            error?.status === 400 ||
            error?.status === 401 ||
            error?.status === 403 ||
            error?.status === 410
          ) {

            clearResetToken();

          }

          setText(
            statusElement,
            error?.message ||
            "Unable to reset your password."
          );

          setLoading(
            false
          );

        }

      }
    );

  }


  /* =======================================================
     PUBLIC API
  ======================================================= */

  window.BarakaLinkResetPassword = {

    getResetToken,

    setResetToken,

    clearResetToken

  };


})();