"use strict";

/* =========================================================
   BARAKALINK
   STANDALONE LOGIN + SIGNUP

   This page replaces the authentication modal from index.html.

   Supports:
   - Login with phone OR email
   - Parent / Student registration
   - Ustaz / Ustaza registration
   - Phone + Telegram registration
   - Email + OTP registration
   - Role selection
   - Study field selection
   - Location selection
   - Password visibility
   - Forgot password
   - Login session storage
   - Role-aware redirects
========================================================= */

(() => {

  /* =======================================================
     CONFIGURATION
  ======================================================== */

  const CONFIG = Object.freeze({

    API_BASE:
      String(
        window.BARAKALINK_API_BASE ||
        "http://localhost:5000/api"
      ).replace(
        /\/+$/,
        ""
      ),

    LOGIN_ENDPOINT:
      "/auth/login",

    REGISTER_ENDPOINT:
      "/auth/register/start",

    REGISTER_EMAIL_START:
      "/auth/register/email/start",

    REGISTER_EMAIL_VERIFY:
      "/auth/register/email/verify",

    REGISTER_EMAIL_COMPLETE:
      "/auth/register/email/complete",

    REGISTER_TELEGRAM_START:
      "/auth/register/telegram/start",

    TOKEN_KEY:
      "barakalink_token",

    LEGACY_TOKEN_KEY:
      "token",

    USER_KEY:
      "barakalink_user",

    SESSION_KEY:
      "barakalink_session",

    PARENT_DASHBOARD:
      "dashboard/student.html",

    USTAZ_DASHBOARD:
      "dashboard/teacher.html",

    USTAZ_PROFILE_COMPLETION:
      "ustaz-profile-completion.html",

    PARENT_PROFILE_COMPLETION:
      "profile-completion.html",

    FORGOT_PASSWORD:
      "forgot-password.html"

  });


  /* =======================================================
     DOM
  ======================================================== */

  const loginForm =
    document.getElementById(
      "loginForm"
    );


  const signupForm =
    document.getElementById(
      "signupForm"
    );


  const authTitle =
    document.getElementById(
      "authTitle"
    );


  const authSubtitle =
    document.getElementById(
      "authSubtitle"
    );


  const authModeLabel =
    document.getElementById(
      "authModeLabel"
    );


  const authHeadingIcon =
    document.getElementById(
      "authHeadingIcon"
    );


  const authSwitch =
    document.getElementById(
      "authSwitch"
    );


  const switchText =
    document.getElementById(
      "switchText"
    );


  const switchAuth =
    document.getElementById(
      "switchAuth"
    );


  /* LOGIN */

  const loginIdentifier =
    document.getElementById(
      "loginPhone"
    );


  const loginPassword =
    document.getElementById(
      "loginPassword"
    );


  const loginIdentifierError =
    document.getElementById(
      "loginPhoneError"
    );


  const loginPasswordError =
    document.getElementById(
      "loginPasswordError"
    );


  const loginStatus =
    document.getElementById(
      "loginStatus"
    );


  const loginSubmitButton =
    document.getElementById(
      "loginSubmitButton"
    );


  const loginSubmitText =
    document.querySelector(
      ".login-submit-text"
    );


  const forgotPasswordButton =
    document.getElementById(
      "forgotPasswordButton"
    );


  /* SIGNUP */

  const signupSubmitButton =
    document.getElementById(
      "signupSubmitButton"
    );


  const signupEmailField =
    document.getElementById(
      "signupEmailField"
    );


  const signupEmail =
    document.getElementById(
      "signupEmail"
    );


  const subcity =
    document.getElementById(
      "subcity"
    );


  const area =
    document.getElementById(
      "area"
    );


  const ustazExtra =
    document.getElementById(
      "ustazExtra"
    );


  /* EMAIL OTP */

  const emailOtpSection =
    document.getElementById(
      "emailOtpSection"
    );


  const emailOtp =
    document.getElementById(
      "emailOtp"
    );


  const emailOtpError =
    document.getElementById(
      "emailOtpError"
    );


  const verifyEmailOtpButton =
    document.getElementById(
      "verifyEmailOtpBtn"
    );


  const resendEmailOtpButton =
    document.getElementById(
      "resendEmailOtpBtn"
    );


  const emailOtpBackButton =
    document.getElementById(
      "emailOtpBackBtn"
    );


  const emailOtpDescription =
    document.getElementById(
      "emailOtpDescription"
    );


  /* TELEGRAM */

  const telegramSection =
    document.getElementById(
      "otpSection"
    );


  const telegramButton =
    document.getElementById(
      "verifyOtpBtn"
    );


  const telegramError =
    document.getElementById(
      "otpError"
    );


  /* =======================================================
     SAFETY
  ======================================================== */

  if (
    !loginForm ||
    !signupForm
  ) {

    console.error(
      "[BarakaLink][Auth] Required authentication forms were not found."
    );

    return;

  }


  /* =======================================================
     STATE
  ======================================================== */

  let currentMode =
    "login";


  let pendingRegistration =
    null;


  let emailVerification = {

    verificationId:
      null,

    email:
      null,

    verified:
      false

  };


  /* =======================================================
     AREA DATA
  ======================================================== */

  const areaOptions = {

    bole: [
      "Bole Medhanialem",
      "Atlas",
      "Gerji",
      "Airport"
    ],

    yeka: [
      "CMC",
      "Kotebe",
      "Megenagna",
      "Yeka Abado"
    ],

    kirkos: [
      "Kazanchis",
      "Mexico",
      "Meskel Square",
      "Wello Sefer"
    ],

    arada: [
      "Piazza",
      "Arat Kilo",
      "Shiro Meda"
    ],

    lideta: [
      "Lideta",
      "Teklehaimanot",
      "Tewodros"
    ],

    "nifas-silk": [
      "Sar Bet",
      "Lafto",
      "Weyra"
    ],

    kolfe: [
      "Kolfe",
      "Bethel",
      "Ayer Tena"
    ],

    akaki: [
      "Akaki",
      "Kaliti",
      "Qality"
    ]

  };


  /* =======================================================
     HELPERS
  ======================================================== */

  function text(
    value,
    fallback = ""
  ) {

    if (
      value === null ||
      value === undefined
    ) {

      return fallback;

    }


    const valueText =
      String(
        value
      ).trim();


    return valueText ||
      fallback;

  }


  function setText(
    id,
    value
  ) {

    const element =
      document.getElementById(
        id
      );


    if (element) {

      element.textContent =
        value || "";

    }

  }


  function clearText(
    ...ids
  ) {

    ids.forEach(
      id => {

        setText(
          id,
          ""
        );

      }
    );

  }


  function setButtonBusy(
    button,
    busy,
    busyHtml,
    normalHtml
  ) {

    if (!button) {

      return;

    }


    if (busy) {

      if (
        button.dataset.originalHtml ===
        undefined
      ) {

        button.dataset.originalHtml =
          button.innerHTML;

      }


      button.disabled =
        true;


      button.innerHTML =
        busyHtml;


      return;

    }


    button.disabled =
      false;


    button.innerHTML =
      normalHtml ||
      button.dataset.originalHtml ||
      button.innerHTML;


    delete button.dataset.originalHtml;

  }


  /* =======================================================
     API
  ======================================================== */

  async function apiPost(
    endpoint,
    body
  ) {

    let response;


    try {

      response =
        await fetch(
          `${CONFIG.API_BASE}${endpoint}`,
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",

              "Accept":
                "application/json"
            },

            credentials:
              "include",

            cache:
              "no-store",

            body:
              JSON.stringify(
                body
              )
          }
        );

    } catch (networkError) {

      console.error(
        "[BarakaLink][Auth] Network error:",
        networkError
      );


      const error =
        new Error(
          "Unable to connect to the BarakaLink server."
        );


      error.code =
        "NETWORK_ERROR";


      error.originalError =
        networkError;


      throw error;

    }


    let payload =
      null;


    try {

      payload =
        await response.json();

    } catch (_) {

      payload =
        null;

    }


    if (
      !response.ok
    ) {

      const error =
        new Error(
          text(
            payload?.message,
            "The request could not be completed."
          )
        );


      error.status =
        response.status;


      error.code =
        text(
          payload?.code
        );


      error.payload =
        payload;


      throw error;

    }


    if (
      payload?.success === false
    ) {

      const error =
        new Error(
          text(
            payload?.message,
            "The request could not be completed."
          )
        );


      error.status =
        response.status;


      error.code =
        text(
          payload?.code
        );


      error.payload =
        payload;


      throw error;

    }


    return payload;

  }


  /* =======================================================
     EMAIL
  ======================================================== */

  function normalizeEmail(
    value
  ) {

    return String(
      value || ""
    )
      .trim()
      .toLowerCase();

  }


  function isValidEmail(
    value
  ) {

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      normalizeEmail(
        value
      )
    );

  }


  function isEmailIdentifier(
    value
  ) {

    return String(
      value || ""
    )
      .trim()
      .includes("@");

  }


  /* =======================================================
     PHONE
     -------------------------------------------------------
     Ethiopian mobile numbers

     Local:
       0912345678
       0712345678

     International:
       +251912345678
       +251712345678
       251912345678
       251712345678
       00251912345678
       00251712345678

     Also tolerate:
       2510912345678
       2510712345678

     Final format:
       2519XXXXXXXX
       2517XXXXXXXX
  ======================================================== */

  function normalizePhone(
    value
  ) {

    let phone =
      String(
        value || ""
      )
        .trim()
        .replace(
          /\D/g,
          ""
        );


    if (!phone) {

      return "";

    }


    /*
      Convert international
      00 prefix.
    */

    if (
      phone.startsWith(
        "00"
      )
    ) {

      phone =
        phone.slice(
          2
        );

    }


    /*
      Handle:
        2510712345678
        2510912345678

      by removing the extra
      national leading zero.
    */

    if (
      phone.startsWith(
        "25107"
      ) ||
      phone.startsWith(
        "25109"
      )
    ) {

      phone =
        "251" +
        phone.slice(
          4
        );

    }


    /*
      Already normalized:
        2517XXXXXXXX
        2519XXXXXXXX
    */

    if (
      /^251[79]\d{8}$/.test(
        phone
      )
    ) {

      return phone;

    }


    /*
      Ethiopian local format:
        07XXXXXXXX
        09XXXXXXXX
    */

    if (
      /^0[79]\d{8}$/.test(
        phone
      )
    ) {

      return (
        "251" +
        phone.slice(
          1
        )
      );

    }


    /*
      Local number without
      the leading zero:
        7XXXXXXXX
        9XXXXXXXX
    */

    if (
      /^[79]\d{8}$/.test(
        phone
      )
    ) {

      return (
        "251" +
        phone
      );

    }


    /*
      Invalid phone format.
    */

    return "";

  }


  /*
    Dedicated Ethiopian mobile validator.
  */

  function isValidEthiopianMobile(
    value
  ) {

    return /^251[79]\d{8}$/.test(
      normalizePhone(
        value
      )
    );

  }


  /* =======================================================
     ROLE
  ======================================================== */

  function getSelectedRole() {

    const selected =
      document.querySelector(
        'input[name="role"]:checked'
      );


    return selected
      ? selected.value
      : "parent";

  }


  function setRole(
    role
  ) {

    document
      .querySelectorAll(
        ".role-option[data-role]"
      )
      .forEach(
        option => {

          const radio =
            option.querySelector(
              'input[type="radio"]'
            );


          if (!radio) {

            return;

          }


          const active =
            radio.value ===
            role;


          radio.checked =
            active;


          option.classList.toggle(
            "active",
            active
          );

        }
      );


    if (ustazExtra) {

      ustazExtra.classList.toggle(
        "visible",
        role === "ustaz"
      );

    }

  }


  /* =======================================================
     REGISTRATION METHOD
  ======================================================== */

  function getRegistrationMethod() {

    const selected =
      document.querySelector(
        'input[name="registrationMethod"]:checked'
      );


    return selected &&
      selected.value ===
        "email"
      ? "email"
      : "phone";

  }


  function setRegistrationMethod(
    method
  ) {

    const isEmail =
      method ===
      "email";


    document
      .querySelectorAll(
        ".role-option[data-method]"
      )
      .forEach(
        option => {

          const radio =
            option.querySelector(
              'input[type="radio"]'
            );


          if (!radio) {

            return;

          }


          const active =
            radio.value ===
            method;


          radio.checked =
            active;


          option.classList.toggle(
            "active",
            active
          );

        }
      );


    if (signupEmailField) {

      signupEmailField.style.display =
        isEmail
          ? ""
          : "none";

    }


    if (!isEmail) {

      clearText(
        "signupEmailError"
      );

    }

  }


  /* =======================================================
     LOCATION
  ======================================================== */

  function populateAreas(
    selectedArea = ""
  ) {

    if (!area) {

      return;

    }


    area.innerHTML =
      "";


    const firstOption =
      document.createElement(
        "option"
      );


    firstOption.value =
      "";


    firstOption.textContent =
      "Select Area";


    area.appendChild(
      firstOption
    );


    const locations =
      areaOptions[
        subcity?.value
      ] || [];


    locations.forEach(
      location => {

        const option =
          document.createElement(
            "option"
          );


        option.value =
          location
            .toLowerCase()
            .replace(
              /[^a-z0-9]+/g,
              "-"
            )
            .replace(
              /^-|-$/g,
              ""
            );


        option.textContent =
          location;


        if (
          option.value ===
          selectedArea
        ) {

          option.selected =
            true;

        }


        area.appendChild(
          option
        );

      }
    );

  }


  /* =======================================================
     PASSWORD VISIBILITY
  ======================================================== */

  function setupPasswordToggles() {

    document
      .querySelectorAll(
        "[data-password]"
      )
      .forEach(
        button => {

          button.addEventListener(
            "click",
            () => {

              const input =
                document.getElementById(
                  button.dataset.password
                );


              if (!input) {

                return;

              }


              const icon =
                button.querySelector(
                  "i"
                );


              const show =
                input.type ===
                "password";


              input.type =
                show
                  ? "text"
                  : "password";


              button.setAttribute(
                "aria-label",
                show
                  ? "Hide password"
                  : "Show password"
              );


              if (icon) {

                icon.className =
                  show
                    ? "fa-solid fa-eye-slash"
                    : "fa-solid fa-eye";

              }

            }
          );

        }
      );

  }


  /* =======================================================
     AUTH MODE
  ======================================================== */

  function hideVerificationSections() {

    if (emailOtpSection) {

      emailOtpSection.classList.remove(
        "active"
      );


      emailOtpSection.setAttribute(
        "aria-hidden",
        "true"
      );

    }


    if (telegramSection) {

      telegramSection.classList.remove(
        "active"
      );


      telegramSection.setAttribute(
        "aria-hidden",
        "true"
      );

    }


    if (emailOtpError) {

      emailOtpError.textContent =
        "";

    }


    if (telegramError) {

      telegramError.textContent =
        "";

    }

  }


  function showLogin() {

    currentMode =
      "login";


    loginForm.style.display =
      "flex";


    signupForm.style.display =
      "none";


    hideVerificationSections();


    if (authTitle) {

      authTitle.textContent =
        "Continue Your Journey";

    }


    if (authSubtitle) {

      authSubtitle.textContent =
        "Log in to your BarakaLink account.";

    }


    if (authModeLabel) {

      authModeLabel.textContent =
        "YOUR ACCOUNT";

    }


    if (authHeadingIcon) {

      authHeadingIcon.className =
        "fa-solid fa-right-to-bracket";

    }


    if (switchText) {

      switchText.textContent =
        "Don't have an account?";

    }


    if (switchAuth) {

      switchAuth.textContent =
        "Create one";

    }

  }


  function showSignup(
    role = null
  ) {

    currentMode =
      "signup";


    loginForm.style.display =
      "none";


    signupForm.style.display =
      "flex";


    hideVerificationSections();


    if (role) {

      setRole(
        role
      );

    }


    if (authTitle) {

      authTitle.textContent =
        "Join BarakaLink";

    }


    if (authSubtitle) {

      authSubtitle.textContent =
        "Create your account and start your Quran journey.";

    }


    if (authModeLabel) {

      authModeLabel.textContent =
        "CREATE ACCOUNT";

    }


    if (authHeadingIcon) {

      authHeadingIcon.className =
        "fa-solid fa-user-plus";

    }


    if (switchText) {

      switchText.textContent =
        "Already have an account?";

    }


    if (switchAuth) {

      switchAuth.textContent =
        "Log in";

    }

  }


  function showEmailOtpStep() {

    loginForm.style.display =
      "none";


    signupForm.style.display =
      "none";


    hideVerificationSections();


    if (emailOtpSection) {

      emailOtpSection.classList.add(
        "active"
      );


      emailOtpSection.setAttribute(
        "aria-hidden",
        "false"
      );

    }


    if (authTitle) {

      authTitle.textContent =
        "Verify Your Email";

    }


    if (authSubtitle) {

      authSubtitle.textContent =
        emailVerification.email
          ? `Enter the verification code sent to ${emailVerification.email}.`
          : "Enter the verification code we sent to your email.";

    }


    if (authModeLabel) {

      authModeLabel.textContent =
        "EMAIL VERIFICATION";

    }


    if (authHeadingIcon) {

      authHeadingIcon.className =
        "fa-solid fa-envelope";

    }


    if (emailOtpDescription) {

      emailOtpDescription.textContent =
        emailVerification.email
          ? `Enter the 6-digit code sent to ${emailVerification.email}.`
          : "Enter the 6-digit code we sent to your email.";

    }


    if (emailOtp) {

      emailOtp.value =
        "";


      setTimeout(
        () => {

          emailOtp.focus();

        },
        50
      );

    }

  }


  function showTelegramStep() {

    loginForm.style.display =
      "none";


    signupForm.style.display =
      "none";


    hideVerificationSections();


    if (telegramSection) {

      telegramSection.classList.add(
        "active"
      );


      telegramSection.setAttribute(
        "aria-hidden",
        "false"
      );

    }


    if (authTitle) {

      authTitle.textContent =
        "Verify with Telegram";

    }


    if (authSubtitle) {

      authSubtitle.textContent =
        "Connect your Telegram account to continue.";

    }


    if (authModeLabel) {

      authModeLabel.textContent =
        "TELEGRAM VERIFICATION";

    }


    if (authHeadingIcon) {

      authHeadingIcon.className =
        "fa-brands fa-telegram";

    }

  }


  /* =======================================================
     RESET EMAIL VERIFICATION
  ======================================================== */

  function resetEmailVerification() {

    emailVerification = {

      verificationId:
        null,

      email:
        null,

      verified:
        false

    };


    if (emailOtp) {

      emailOtp.value =
        "";

    }


    if (emailOtpError) {

      emailOtpError.textContent =
        "";

    }

  }


  /* =======================================================
     COLLECT REGISTRATION DATA
  ======================================================== */

  function collectRegistrationData() {

    const role =
      getSelectedRole();


    const data = {

      role,

      firstName:
        text(
          document.getElementById(
            "firstName"
          )?.value
        ),

      lastName:
        text(
          document.getElementById(
            "lastName"
          )?.value
        ),

      phone:
        normalizePhone(
          document.getElementById(
            "signupPhone"
          )?.value
        ),

      subcity:
        text(
          subcity?.value
        ),

      area:
        text(
          area?.value
        ),

      nearestMosque:
        text(
          document.getElementById(
            "nearestMosque"
          )?.value
        ),

      password:
        document.getElementById(
          "signupPassword"
        )?.value || "",

      confirmPassword:
        document.getElementById(
          "confirmPassword"
        )?.value || ""

    };


    if (
      getRegistrationMethod() ===
      "email"
    ) {

      data.email =
        normalizeEmail(
          signupEmail?.value
        );

    }


    if (
      role ===
      "ustaz"
    ) {

      data.experience =
        Number(
          document.getElementById(
            "experience"
          )?.value || 0
        );


      data.gender =
        text(
          document.getElementById(
            "gender"
          )?.value
        );


      data.studyFields =
        Array.from(
          document.querySelectorAll(
            'input[name="studyFields"]:checked'
          )
        ).map(
          input =>
            input.value
        );

    }


    return data;

  }


  /* =======================================================
     REGISTRATION VALIDATION
  ======================================================== */

  function validateRegistration(
    data
  ) {

    clearText(

      "nameError",

      "signupEmailError",

      "signupPhoneError",

      "signupPasswordError",

      "confirmError",

      "nearestMosqueError",

      "signupStatus"

    );


    let valid =
      true;


    /* NAME */

    if (
      !data.firstName ||
      !data.lastName
    ) {

      setText(
        "nameError",
        "Enter your first and last name."
      );


      valid =
        false;

    }


    /* EMAIL */

    if (
      getRegistrationMethod() ===
      "email"
    ) {

      if (
        !data.email
      ) {

        setText(
          "signupEmailError",
          "Enter your email address."
        );


        valid =
          false;

      }

      else if (
        !isValidEmail(
          data.email
        )
      ) {

        setText(
          "signupEmailError",
          "Enter a valid email address."
        );


        valid =
          false;

      }

    }


    /* PHONE */

    if (
      !isValidEthiopianMobile(
        data.phone
      )
    ) {

      setText(
        "signupPhoneError",
        "Enter a valid Ethiopian mobile number starting with 07 or 09."
      );


      valid =
        false;

    }


    /* SUBCITY */

    if (
      !data.subcity
    ) {

      setText(
        "signupStatus",
        "Please select your sub-city."
      );


      valid =
        false;

    }


    /* AREA */

    if (
      !data.area
    ) {

      setText(
        "signupStatus",
        "Please select your area."
      );


      valid =
        false;

    }


    /* MOSQUE */

    if (
      !data.nearestMosque
    ) {

      setText(
        "nearestMosqueError",
        "Enter the name of your nearest mosque."
      );


      valid =
        false;

    }


    /* PASSWORD */

    if (
      data.password.length <
      8
    ) {

      setText(
        "signupPasswordError",
        "Password must be at least 8 characters."
      );


      valid =
        false;

    }


    /* CONFIRM */

    if (
      data.password !==
      data.confirmPassword
    ) {

      setText(
        "confirmError",
        "Passwords do not match."
      );


      valid =
        false;

    }


    /* USTAZ */

    if (
      data.role ===
      "ustaz"
    ) {

      if (
        !Number.isInteger(
          data.experience
        ) ||
        data.experience < 0 ||
        data.experience > 60
      ) {

        setText(
          "signupStatus",
          "Enter valid teaching experience."
        );


        valid =
          false;

      }


      if (
        !data.gender
      ) {

        setText(
          "signupStatus",
          "Please select your gender."
        );


        valid =
          false;

      }


      if (
        !Array.isArray(
          data.studyFields
        ) ||
        !data.studyFields.length
      ) {

        setText(
          "signupStatus",
          "Select at least one study field."
        );


        valid =
          false;

      }

    }


    return valid;

  }


  /* =======================================================
     LOGIN
  ======================================================== */

  async function performLogin(
    identifier,
    password
  ) {

    const payload =
      await apiPost(
        CONFIG.LOGIN_ENDPOINT,
        {

          /*
           * Backend expects identifier.
           */
          identifier,

          password

        }
      );


    const token =
      text(
        payload?.data?.token
      );


    const user =
      payload?.data?.user ||
      null;


    if (!token) {

      throw new Error(
        "Login succeeded, but the server did not return an authentication token."
      );

    }


    if (!user) {

      throw new Error(
        "Login succeeded, but the server did not return your user information."
      );

    }


    return {

      token,

      user

    };

  }


  /* =======================================================
     SESSION
  ======================================================== */

  function saveSession(
    token,
    user
  ) {

    if (!token) {

      throw new Error(
        "No authentication token was returned."
      );

    }


    try {

      localStorage.setItem(
        CONFIG.TOKEN_KEY,
        token
      );


      /*
       * Existing BarakaLink dashboard
       * compatibility.
       */
      localStorage.setItem(
        CONFIG.LEGACY_TOKEN_KEY,
        token
      );


      localStorage.setItem(
        CONFIG.SESSION_KEY,
        "1"
      );


      if (user) {

        localStorage.setItem(
          CONFIG.USER_KEY,
          JSON.stringify(
            user
          )
        );

      }

    } catch (error) {

      console.error(
        "[BarakaLink][Auth] Could not save session:",
        error
      );


      throw new Error(
        "Login succeeded, but your browser could not save the session."
      );

    }

  }


  function clearSession() {

    const keys = [

      CONFIG.TOKEN_KEY,

      CONFIG.LEGACY_TOKEN_KEY,

      CONFIG.USER_KEY,

      CONFIG.SESSION_KEY,

      "access_token",

      "user"

    ];


    keys.forEach(
      key => {

        try {

          localStorage.removeItem(
            key
          );

        } catch (_) {}


        try {

          sessionStorage.removeItem(
            key
          );

        } catch (_) {}

      }
    );

  }


  /* =======================================================
     LOGIN REDIRECT
  ======================================================== */

  function redirectAfterLogin(
    user
  ) {

    const role =
      text(
        user?.role
      ).toLowerCase();


    const profileCompleted =
      Boolean(
        user?.profileCompleted ??
        user?.profile_completed
      );


    console.log(
      "[BarakaLink][Auth] Redirect after login:",
      {
        role,
        profileCompleted
      }
    );


    if (
      role ===
      "ustaz"
    ) {

      if (
        !profileCompleted
      ) {

        window.location.replace(
          CONFIG.USTAZ_PROFILE_COMPLETION
        );


        return;

      }


      window.location.replace(
        CONFIG.USTAZ_DASHBOARD
      );


      return;

    }


    if (
      role ===
      "parent"
    ) {

      /*
       * Keep the parent flow aligned with
       * the application structure.
       */
      if (
        user?.profileCompleted ===
          false ||
        user?.profile_completed ===
          false
      ) {

        window.location.replace(
          CONFIG.PARENT_PROFILE_COMPLETION
        );


        return;

      }


      window.location.replace(
        CONFIG.PARENT_DASHBOARD
      );


      return;

    }


    setText(
      "loginStatus",
      "Your account role could not be recognized. Please contact BarakaLink support."
    );

  }


  /* =======================================================
     LOGIN SUBMIT
  ======================================================== */

  async function handleLoginSubmit(
    event
  ) {

    event.preventDefault();


    clearText(
      "loginPhoneError",
      "loginPasswordError",
      "loginStatus"
    );


    const rawIdentifier =
      text(
        loginIdentifier?.value
      );


    /*
     * IMPORTANT:
     * Do NOT trim or alter the password.
     */
    const password =
      loginPassword?.value ||
      "";


    let identifier =
      "";


    /* -------------------------------------------------------
       IDENTIFIER
    ------------------------------------------------------- */

    if (
      !rawIdentifier
    ) {

      setText(
        "loginPhoneError",
        "Enter your email or phone number."
      );


      return;

    }


    /*
      EMAIL LOGIN
    */

    if (
      isEmailIdentifier(
        rawIdentifier
      )
    ) {

      identifier =
        normalizeEmail(
          rawIdentifier
        );


      if (
        !isValidEmail(
          identifier
        )
      ) {

        setText(
          "loginPhoneError",
          "Enter a valid email address."
        );


        return;

      }

    }

    /*
      PHONE LOGIN
    */

    else {

      identifier =
        normalizePhone(
          rawIdentifier
        );


      if (
        !isValidEthiopianMobile(
          rawIdentifier
        )
      ) {

        setText(
          "loginPhoneError",
          "Enter a valid Ethiopian mobile number starting with 07 or 09."
        );


        return;

      }

    }


    /* -------------------------------------------------------
       PASSWORD
    ------------------------------------------------------- */

    if (
      !password
    ) {

      setText(
        "loginPasswordError",
        "Enter your password."
      );


      return;

    }


    /* -------------------------------------------------------
       LOGIN BUTTON
    ------------------------------------------------------- */

    setButtonBusy(
      loginSubmitButton,
      true,
      `
        Signing in
        <i class="fa-solid fa-spinner fa-spin"></i>
      `,
      `
        <span class="login-submit-text">
          Sign In
        </span>
        <i class="fa-solid fa-arrow-right"></i>
      `
    );


    /*
     * Clear any old session before
     * attempting a new login.
     */
    clearSession();


    try {

      const result =
        await performLogin(
          identifier,
          password
        );


      saveSession(
        result.token,
        result.user
      );


      setText(
        "loginStatus",
        "Login successful. Redirecting..."
      );


      window.setTimeout(
        () => {

          redirectAfterLogin(
            result.user
          );

        },
        300
      );


    } catch (error) {

      console.error(
        "[BarakaLink][Auth] Login failed:",
        error
      );


      setText(
        "loginStatus",
        error?.message ||
        "Unable to sign in."
      );


    } finally {

      setButtonBusy(
        loginSubmitButton,
        false,
        "",
        `
          <span class="login-submit-text">
            Sign In
          </span>
          <i class="fa-solid fa-arrow-right"></i>
        `
      );

    }

  }


  /* =======================================================
     EMAIL REGISTRATION
  ======================================================== */

  async function requestEmailCode(
    email
  ) {

    const response =
      await apiPost(
        CONFIG.REGISTER_EMAIL_START,
        {
          email
        }
      );


    const verificationId =
      response?.data?.verificationId;


    if (!verificationId) {

      throw new Error(
        "The server did not return an email verification ID."
      );

    }


    emailVerification = {

      verificationId,

      email,

      verified:
        false

    };

  }


  async function verifyEmailCode() {

    if (
      !pendingRegistration ||
      !emailVerification.verificationId ||
      !emailVerification.email
    ) {

      throw new Error(
        "Your email verification session has expired. Please start signup again."
      );

    }


    const code =
      String(
        emailOtp?.value ||
        ""
      )
        .replace(
          /\D/g,
          ""
        )
        .slice(
          0,
          6
        );


    if (
      !/^\d{6}$/.test(
        code
      )
    ) {

      throw new Error(
        "Enter the 6-digit email verification code."
      );

    }


    const response =
      await apiPost(
        CONFIG.REGISTER_EMAIL_VERIFY,
        {

          verificationId:
            emailVerification.verificationId,

          email:
            emailVerification.email,

          otp:
            code

        }
      );


    const verified =
      Boolean(
        response?.success ===
          true &&
        response?.data?.verified !==
          false
      );


    if (!verified) {

      throw new Error(
        response?.message ||
        "Email verification failed."
      );

    }


    emailVerification.verified =
      true;

  }


  async function completeEmailRegistration(
    data
  ) {

    if (
      !emailVerification.verified
    ) {

      throw new Error(
        "Please verify your email first."
      );

    }


    const response =
      await apiPost(
        CONFIG.REGISTER_EMAIL_COMPLETE,
        {

          ...data,

          email:
            emailVerification.email,

          emailVerificationId:
            emailVerification.verificationId

        }
      );


    const token =
      text(
        response?.data?.token
      );


    const user =
      response?.data?.user ||
      null;


    if (!token) {

      throw new Error(
        "The server did not return an authentication token."
      );

    }


    saveSession(
      token,
      user
    );


    if (
      user?.role ===
      "ustaz"
    ) {

      window.location.replace(
        CONFIG.USTAZ_PROFILE_COMPLETION
      );


      return;

    }


    window.location.replace(
      CONFIG.PARENT_PROFILE_COMPLETION
    );

  }


  /* =======================================================
     PHONE + TELEGRAM REGISTRATION
  ======================================================== */

  async function startTelegramRegistration(
    data
  ) {

    const response =
      await apiPost(
        CONFIG.REGISTER_ENDPOINT,
        data
      );


    if (
      response?.success !==
      true
    ) {

      throw new Error(
        response?.message ||
        "Unable to start registration."
      );

    }


    const challengeId =
      response?.data?.challengeId;


    const authorizationUrl =
      response?.data?.authorizationUrl;


    if (!challengeId) {

      throw new Error(
        "The registration challenge was not created."
      );

    }


    if (!authorizationUrl) {

      throw new Error(
        "The Telegram authorization URL was not returned."
      );

    }


    pendingRegistration = {

      ...data,

      challengeId

    };


    showTelegramStep();


    /*
     * The backend already created the registration
     * challenge and supplied the Telegram authorization URL.
     *
     * Redirect directly to Telegram.
     */
    window.location.href =
      authorizationUrl;

  }


  /* =======================================================
     EMAIL REGISTRATION
  ======================================================== */

  async function startEmailRegistration(
    data
  ) {

    await requestEmailCode(
      data.email
    );


    pendingRegistration = {

      ...data

    };


    showEmailOtpStep();

  }


  /* =======================================================
     SIGNUP SUBMIT
  ======================================================== */

  async function handleSignupSubmit(
    event
  ) {

    event.preventDefault();


    const data =
      collectRegistrationData();


    if (
      !validateRegistration(
        data
      )
    ) {

      return;

    }


    const method =
      getRegistrationMethod();


    setButtonBusy(
      signupSubmitButton,
      true,
      `
        Continuing
        <i class="fa-solid fa-spinner fa-spin"></i>
      `,
      `
        <span>
          Create Account
        </span>
        <i class="fa-solid fa-arrow-right"></i>
      `
    );


    try {

      /*
       * EMAIL → OTP → ACCOUNT
       */

      if (
        method ===
        "email"
      ) {

        const sameVerifiedEmail =
          emailVerification.verified &&
          emailVerification.email ===
            data.email;


        if (
          sameVerifiedEmail
        ) {

          await completeEmailRegistration(
            data
          );


          return;

        }


        await startEmailRegistration(
          data
        );


        return;

      }


      /*
       * PHONE → TELEGRAM
       */

      await startTelegramRegistration(
        data
      );

    } catch (error) {

      console.error(
        "[BarakaLink][Auth] Registration failed:",
        error
      );


      setText(
        "signupStatus",
        error?.message ||
        "Unable to start registration."
      );

    } finally {

      setButtonBusy(
        signupSubmitButton,
        false,
        "",
        `
          <span>
            Create Account
          </span>
          <i class="fa-solid fa-arrow-right"></i>
        `
      );

    }

  }


  /* =======================================================
     EMAIL OTP VERIFY
  ======================================================== */

  async function handleEmailOtpVerification() {

    clearText(
      "emailOtpError"
    );


    setButtonBusy(
      verifyEmailOtpButton,
      true,
      `
        Verifying
        <i class="fa-solid fa-spinner fa-spin"></i>
      `,
      `
        Verify Email
        <i class="fa-solid fa-arrow-right"></i>
      `
    );


    try {

      await verifyEmailCode();


      /*
       * Email is now verified.
       *
       * Complete the account immediately.
       */
      await completeEmailRegistration(
        pendingRegistration
      );


    } catch (error) {

      console.error(
        "[BarakaLink][Auth] Email verification failed:",
        error
      );


      setText(
        "emailOtpError",
        error?.message ||
        "Unable to verify your email."
      );


    } finally {

      setButtonBusy(
        verifyEmailOtpButton,
        false,
        "",
        `
          Verify Email
          <i class="fa-solid fa-arrow-right"></i>
        `
      );

    }

  }


  /* =======================================================
     RESEND EMAIL OTP
  ======================================================== */

  async function resendEmailCode() {

    if (
      !pendingRegistration ||
      !emailVerification.email
    ) {

      setText(
        "emailOtpError",
        "Your email verification session has expired. Please start signup again."
      );


      return;

    }


    setButtonBusy(
      resendEmailOtpButton,
      true,
      `
        Sending
        <i class="fa-solid fa-spinner fa-spin"></i>
      `,
      "Resend Code"
    );


    try {

      await requestEmailCode(
        emailVerification.email
      );


      if (emailOtpDescription) {

        emailOtpDescription.textContent =
          `A new verification code was sent to ${emailVerification.email}.`;

      }


      setText(
        "emailOtpError",
        ""
      );


    } catch (error) {

      console.error(
        "[BarakaLink][Auth] Email OTP resend failed:",
        error
      );


      setText(
        "emailOtpError",
        error?.message ||
        "Unable to resend the verification code."
      );


    } finally {

      setButtonBusy(
        resendEmailOtpButton,
        false,
        "",
        "Resend Code"
      );

    }

  }


  /* =======================================================
     CHANGE EMAIL
  ======================================================== */

  function changeEmail() {

    resetEmailVerification();


    pendingRegistration =
      null;


    showSignup();


    setRegistrationMethod(
      "email"
    );


    if (signupEmail) {

      setTimeout(
        () => {

          signupEmail.focus();

        },
        50
      );

    }

  }


  /* =======================================================
     TELEGRAM BUTTON
  ======================================================== */

  async function handleTelegramButton() {

    if (
      !pendingRegistration
    ) {

      setText(
        "otpError",
        "Your registration session has expired. Please start signup again."
      );


      return;

    }


    setButtonBusy(
      telegramButton,
      true,
      `
        Opening Telegram
        <i class="fa-solid fa-spinner fa-spin"></i>
      `,
      `
        <i class="fa-brands fa-telegram"></i>
        Continue with Telegram
      `
    );


    try {

      const response =
        await apiPost(
          CONFIG.REGISTER_TELEGRAM_START,
          {
            challengeId:
              pendingRegistration.challengeId
          }
        );


      const authorizationUrl =
        response?.data?.authorizationUrl;


      if (!authorizationUrl) {

        throw new Error(
          "The Telegram authorization URL was not returned."
        );

      }


      window.location.href =
        authorizationUrl;

    } catch (error) {

      console.error(
        "[BarakaLink][Auth] Telegram verification failed:",
        error
      );


      setText(
        "otpError",
        error?.message ||
        "Unable to open Telegram."
      );


      setButtonBusy(
        telegramButton,
        false,
        "",
        `
          <i class="fa-brands fa-telegram"></i>
          Continue with Telegram
        `
      );

    }

  }


  /* =======================================================
     ROLE OPTIONS
  ======================================================== */

  function setupRoleOptions() {

    document
      .querySelectorAll(
        ".role-option[data-role]"
      )
      .forEach(
        option => {

          option.addEventListener(
            "click",
            () => {

              const radio =
                option.querySelector(
                  'input[type="radio"]'
                );


              if (!radio) {

                return;

              }


              setRole(
                radio.value
              );

            }
          );

        }
      );

  }


  /* =======================================================
     METHOD OPTIONS
  ======================================================== */

  function setupMethodOptions() {

    document
      .querySelectorAll(
        ".role-option[data-method]"
      )
      .forEach(
        option => {

          const radio =
            option.querySelector(
              'input[type="radio"]'
            );


          if (!radio) {

            return;

          }


          radio.addEventListener(
            "change",
            () => {

              setRegistrationMethod(
                radio.value
              );

            }
          );


          option.addEventListener(
            "click",
            () => {

              setRegistrationMethod(
                radio.value
              );

            }
          );

        }
      );

  }


  /* =======================================================
     STUDY FIELDS
  ======================================================== */

  function setupStudyFields() {

    document
      .querySelectorAll(
        'input[name="studyFields"]'
      )
      .forEach(
        input => {

          const option =
            input.closest(
              ".role-option"
            );


          if (!option) {

            return;

          }


          function sync() {

            option.classList.toggle(
              "active",
              input.checked
            );

          }


          input.addEventListener(
            "change",
            sync
          );


          sync();

        }
      );

  }


  /* =======================================================
     LOCATION
  ======================================================== */

  function setupLocation() {

    if (!subcity) {

      return;

    }


    subcity.addEventListener(
      "change",
      () => {

        populateAreas();

      }
    );


    populateAreas();

  }


  /* =======================================================
     INPUT CLEANUP
  ======================================================== */

  function setupInputEvents() {

    [
      loginIdentifier,
      loginPassword
    ].forEach(
      input => {

        if (!input) {

          return;

        }


        input.addEventListener(
          "input",
          () => {

            input.classList.remove(
              "input-error"
            );


            const errorId =
              input.id ===
              "loginPhone"
                ? "loginPhoneError"
                : "loginPasswordError";


            setText(
              errorId,
              ""
            );


            if (
              currentMode ===
              "login"
            ) {

              setText(
                "loginStatus",
                ""
              );

            }

          }
        );

      }
    );


    /*
      Clean email OTP input.
    */

    if (emailOtp) {

      emailOtp.addEventListener(
        "input",
        () => {

          const value =
            emailOtp.value
              .replace(
                /\D/g,
                ""
              )
              .slice(
                0,
                6
              );


          if (
            emailOtp.value !==
            value
          ) {

            emailOtp.value =
              value;

          }

        }
      );

    }

  }


  /* =======================================================
     AUTH SWITCH
  ======================================================== */

  function setupAuthSwitch() {

    if (!switchAuth) {

      return;

    }


    switchAuth.addEventListener(
      "click",
      () => {

        if (
          currentMode ===
          "login"
        ) {

          showSignup();

        } else {

          showLogin();

        }

      }
    );

  }


  /* =======================================================
     FORGOT PASSWORD
  ======================================================== */

  function setupForgotPassword() {

    if (!forgotPasswordButton) {

      return;

    }


    forgotPasswordButton.addEventListener(
      "click",
      () => {

        window.location.href =
          CONFIG.FORGOT_PASSWORD;

      }
    );

  }


  /* =======================================================
     URL MODE
  ======================================================== */

  function initializeFromUrl() {

    const params =
      new URLSearchParams(
        window.location.search
      );


    const mode =
      text(
        params.get(
          "mode"
        )
      ).toLowerCase();


    const role =
      text(
        params.get(
          "role"
        )
      ).toLowerCase();


    /*
     * Examples:
     *
     * login.html
     * login.html?mode=login
     * login.html?mode=signup
     * login.html?mode=signup&role=parent
     * login.html?mode=signup&role=ustaz
     */

    if (
      mode ===
      "signup"
    ) {

      if (
        role ===
        "ustaz"
      ) {

        showSignup(
          "ustaz"
        );

      } else {

        showSignup(
          "parent"
        );

      }


      return;

    }


    showLogin();

  }


  /* =======================================================
     FORM SUBMISSION
  ======================================================== */

  function setupForms() {

    loginForm.addEventListener(
      "submit",
      handleLoginSubmit
    );


    signupForm.addEventListener(
      "submit",
      handleSignupSubmit
    );


    if (
      verifyEmailOtpButton
    ) {

      verifyEmailOtpButton.addEventListener(
        "click",
        handleEmailOtpVerification
      );

    }


    if (
      resendEmailOtpButton
    ) {

      resendEmailOtpButton.addEventListener(
        "click",
        resendEmailCode
      );

    }


    if (
      emailOtpBackButton
    ) {

      emailOtpBackButton.addEventListener(
        "click",
        changeEmail
      );

    }


    if (
      telegramButton
    ) {

      telegramButton.addEventListener(
        "click",
        handleTelegramButton
      );

    }

  }


  /* =======================================================
     ENTER KEY ON EMAIL OTP
  ======================================================== */

  function setupOtpKeyboard() {

    if (!emailOtp) {

      return;

    }


    emailOtp.addEventListener(
      "keydown",
      event => {

        if (
          event.key ===
          "Enter"
        ) {

          event.preventDefault();


          if (
            verifyEmailOtpButton &&
            !verifyEmailOtpButton.disabled
          ) {

            verifyEmailOtpButton.click();

          }

        }

      }
    );

  }


  /* =======================================================
     STARTUP
  ======================================================== */

  function initialize() {

    setupPasswordToggles();

    setupRoleOptions();

    setupMethodOptions();

    setupStudyFields();

    setupLocation();

    setupInputEvents();

    setupAuthSwitch();

    setupForgotPassword();

    setupForms();

    setupOtpKeyboard();

    initializeFromUrl();


    console.log(
      "[BarakaLink][Auth] Standalone login/signup initialized."
    );

  }


  if (
    document.readyState ===
    "loading"
  ) {

    document.addEventListener(
      "DOMContentLoaded",
      initialize,
      {
        once: true
      }
    );

  } else {

    initialize();

  }

})();