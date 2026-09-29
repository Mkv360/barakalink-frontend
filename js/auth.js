/**
 * BarakaLink
 * Authentication
 *
 * Handles:
 * - Login with phone OR email (one identifier field)
 * - Parent / Student registration
 * - Ustaz / Ustaza registration
 * - Role selection
 * - Study field selection
 * - Location selection
 * - Password visibility
 * - Registration method choice:
 *     A) Phone  → Telegram verification
 *     B) Email → Email OTP → Account creation
 * - Forgot password entry point
 */

"use strict";

(function () {

  /* =======================================================
     ELEMENT REFERENCES
  ======================================================= */

  const body =
    document.body;

  const authOverlay =
    document.getElementById(
      "authOverlay"
    );

  const authTitle =
    document.getElementById(
      "authTitle"
    );

  const authSubtitle =
    document.getElementById(
      "authSubtitle"
    );

  const closeAuth =
    document.getElementById(
      "closeAuth"
    );

  const loginForm =
    document.getElementById(
      "loginForm"
    );

  const signupForm =
    document.getElementById(
      "signupForm"
    );


  /* =======================================================
     TELEGRAM SECTION
  ======================================================= */

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
     EMAIL OTP SECTION
  ======================================================= */

  const emailOtpSection =
    document.getElementById(
      "emailOtpSection"
    );

  const emailOtpInput =
    document.getElementById(
      "emailOtp"
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

  const emailOtpError =
    document.getElementById(
      "emailOtpError"
    );


  /* =======================================================
     AUTH SWITCH
  ======================================================= */

  const authSwitch =
    document.getElementById(
      "authSwitch"
    );

  const switchAuth =
    document.getElementById(
      "switchAuth"
    );

  const switchText =
    document.getElementById(
      "switchText"
    );


  /* =======================================================
     ROLE OPTIONS
  ======================================================= */

  const roleOptions =
    document.querySelectorAll(
      '.role-option[data-role]'
    );


  /* =======================================================
     REGISTRATION METHOD OPTIONS
     (Phone + Telegram  /  Email + Email OTP)
  ======================================================= */

  const methodOptions =
    document.querySelectorAll(
      '.role-option[data-method]'
    );


  /* =======================================================
     STUDY FIELD CHECKBOXES
  ======================================================= */

  const studyFieldInputs =
    document.querySelectorAll(
      '.study-field-options input[name="studyFields"]'
    );


  const ustazExtra =
    document.getElementById(
      "ustazExtra"
    );


  const subcity =
    document.getElementById(
      "subcity"
    );

  const area =
    document.getElementById(
      "area"
    );


  /* =======================================================
     EMAIL INPUTS / ERRORS
  ======================================================= */

  const signupEmail =
    document.getElementById(
      "signupEmail"
    );

  const signupEmailField =
    document.getElementById(
      "signupEmailField"
    );


  /* =======================================================
     SAFETY
  ======================================================= */

  if (
    !authOverlay ||
    !loginForm ||
    !signupForm
  ) {
    return;
  }


  /* =======================================================
     STATE
  ======================================================= */

  let currentAuth =
    "login";


  let pendingRegistration =
    null;


  /*
    Temporary email verification state.
    The OTP itself is never stored here — it is only read
    from the input when the user presses "Verify Email".
  */

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
  ======================================================= */

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
  ======================================================= */

  function getElement(id) {

    return document.getElementById(
      id
    );

  }


  function setText(
    id,
    message
  ) {

    const element =
      getElement(id);

    if (element) {

      element.textContent =
        message;

    }

  }


  function clearText(...ids) {

    ids.forEach(
      function (id) {

        setText(
          id,
          ""
        );

      }
    );

  }


  function normalizePhone(value) {

    let phone =
      String(value || "")
        .trim()
        .replace(
          /\D/g,
          ""
        );


    if (
      phone.startsWith("00")
    ) {

      phone =
        phone.slice(2);

    }


    if (
      phone.startsWith("2519") ||
      phone.startsWith("2517")
    ) {

      return phone;

    }


    if (
      phone.startsWith("09") &&
      phone.length === 10
    ) {

      return `251${phone.slice(1)}`;

    }


    if (
      phone.startsWith("07") &&
      phone.length === 10
    ) {

      return `251${phone.slice(1)}`;

    }


    if (
      (
        phone.startsWith("9") ||
        phone.startsWith("7")
      ) &&
      phone.length === 9
    ) {

      return `251${phone}`;

    }


    return phone;

  }


  function isValidEmail(value) {

    const email =
      String(value || "")
        .trim()
        .toLowerCase();

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      email
    );

  }


  function normalizeEmail(value) {

    return String(value || "")
      .trim()
      .toLowerCase();

  }


  function isEmailIdentifier(value) {

    return String(value || "")
      .includes("@");

  }


  /*
    Disables a button and swaps its content while a
    request is running, then restores the original
    content afterwards.
  */

  function setButtonBusy(
    button,
    busy,
    busyHtml
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


    if (
      button.dataset.originalHtml !==
      undefined
    ) {

      button.innerHTML =
        button.dataset.originalHtml;


      delete button.dataset.originalHtml;

    }

  }


  function resetEmailVerification() {

    emailVerification = {

      verificationId:
        null,

      email:
        null,

      verified:
        false

    };


    if (emailOtpInput) {

      emailOtpInput.value =
        "";

    }

  }


  function createSessionExpiredError() {

    const error =
      new Error(
        "Your email verification session has expired. Please start signup again."
      );

    error.sessionExpired =
      true;

    return error;

  }


  /* =======================================================
     ROLE
  ======================================================= */

  function getSelectedRole() {

    const selected =
      document.querySelector(
        'input[name="role"]:checked'
      );

    return selected
      ? selected.value
      : "parent";

  }


  function setRole(role) {

    roleOptions.forEach(
      function (option) {

        const radio =
          option.querySelector(
            'input[type="radio"]'
          );

        if (!radio) {
          return;
        }

        const active =
          radio.value === role;

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
     ROLE CARD EVENTS
  ======================================================= */

  roleOptions.forEach(
    function (option) {

      option.addEventListener(
        "click",
        function () {

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


  /* =======================================================
     REGISTRATION METHOD
     -------------------------------------------------------
    phone → Phone + Telegram flow
   email → Email OTP → direct account creation
  ======================================================= */

  function getRegistrationMethod() {

    const selected =
      document.querySelector(
        'input[name="registrationMethod"]:checked'
      );

    return selected &&
      selected.value === "email"
      ? "email"
      : "phone";

  }


  function setRegistrationMethod(method) {

    const useEmail =
      method === "email";


    methodOptions.forEach(
      function (option) {

        const radio =
          option.querySelector(
            'input[type="radio"]'
          );

        if (!radio) {
          return;
        }

        const active =
          radio.value ===
          (
            useEmail
              ? "email"
              : "phone"
          );

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
        useEmail
          ? ""
          : "none";

    }


    if (!useEmail) {

      clearText(
        "signupEmailError"
      );

    }

  }


  methodOptions.forEach(
    function (option) {

      const radio =
        option.querySelector(
          'input[type="radio"]'
        );

      if (!radio) {
        return;
      }

      radio.addEventListener(
        "change",
        function () {

          setRegistrationMethod(
            radio.value
          );

        }
      );

    }
  );


  /* =======================================================
     STUDY FIELD SELECTION
  ======================================================= */

  studyFieldInputs.forEach(
    function (input) {

      const option =
        input.closest(
          ".role-option"
        );

      if (!option) {
        return;
      }


      function syncStudyFieldState() {

        option.classList.toggle(
          "active",
          input.checked
        );

      }


      input.addEventListener(
        "change",
        syncStudyFieldState
      );


      syncStudyFieldState();

    }
  );


  /* =======================================================
     SUBCITY → AREA
  ======================================================= */

  if (
    subcity &&
    area
  ) {

    subcity.addEventListener(
      "change",
      function () {

        area.innerHTML =
          `
          <option value="">
            Select Area
          </option>
          `;


        const locations =
          areaOptions[
            subcity.value
          ] || [];


        locations.forEach(
          function (location) {

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


            area.appendChild(
              option
            );

          }
        );

      }
    );

  }


  /* =======================================================
     PASSWORD VISIBILITY
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
              getElement(
                button.dataset.password
              );

            if (!input) {
              return;
            }


            const icon =
              button.querySelector(
                "i"
              );


            const shouldShow =
              input.type ===
              "password";


            input.type =
              shouldShow
                ? "text"
                : "password";


            if (icon) {

              icon.className =
                shouldShow
                  ? "fa-solid fa-eye-slash"
                  : "fa-solid fa-eye";

            }


            button.setAttribute(
              "aria-label",
              shouldShow
                ? "Hide password"
                : "Show password"
            );

          }
        );

      }
    );


  /* =======================================================
     EMAIL OTP UI
  ======================================================= */

  function showEmailOtpStep() {

    signupForm.style.display =
      "none";

    loginForm.style.display =
      "none";

    hideTelegramStep();


    if (authSwitch) {

      authSwitch.style.display =
        "none";

    }


    if (emailOtpSection) {

      emailOtpSection.classList.add(
        "active"
      );

      emailOtpSection.setAttribute(
        "aria-hidden",
        "false"
      );

    }


    if (emailOtpError) {

      emailOtpError.textContent =
        "";

    }


    if (emailOtpInput) {

      emailOtpInput.value =
        "";

    }


    authTitle.textContent =
      "Verify Your Email";


    authSubtitle.textContent =
      `Enter the verification code sent to ${emailVerification.email}.`;


    setTimeout(
      function () {

        if (emailOtpInput) {

          emailOtpInput.focus();

        }

      },
      50
    );

  }


  function hideEmailOtpStep() {

    if (emailOtpSection) {

      emailOtpSection.classList.remove(
        "active"
      );

      emailOtpSection.setAttribute(
        "aria-hidden",
        "true"
      );

    }


    if (emailOtpError) {

      emailOtpError.textContent =
        "";

    }

  }


  /* =======================================================
     TELEGRAM UI
  ======================================================= */

  function showTelegramStep() {

    signupForm.style.display =
      "none";

    loginForm.style.display =
      "none";


    hideEmailOtpStep();


    if (authSwitch) {

      authSwitch.style.display =
        "none";

    }


    if (telegramSection) {

      telegramSection.classList.add(
        "active"
      );

    }


    authTitle.textContent =
      "Verify with Telegram";


    authSubtitle.textContent =
      "Connect your Telegram account to securely verify your identity.";

  }


  function hideTelegramStep() {

    if (telegramSection) {

      telegramSection.classList.remove(
        "active"
      );

    }


    if (telegramError) {

      telegramError.textContent =
        "";

    }

  }


  /* =======================================================
     AUTH MODAL OPEN
  ======================================================= */

  function openAuth(mode) {

    currentAuth =
      mode;


    pendingRegistration =
      null;


    resetEmailVerification();


    hideEmailOtpStep();
    hideTelegramStep();


    if (
      mode === "signup-parent"
    ) {

      setRole(
        "parent"
      );

      showSignup();

    }


    else if (
      mode === "signup-ustaz"
    ) {

      setRole(
        "ustaz"
      );

      showSignup();

    }


    else if (
      mode === "signup"
    ) {

      showSignup();

    }


    else {

      showLogin();

    }


    authOverlay.classList.add(
      "open"
    );


    authOverlay.setAttribute(
      "aria-hidden",
      "false"
    );


    body.classList.add(
      "modal-open"
    );


    if (
      window.BarakaLinkNavigation
    ) {

      window.BarakaLinkNavigation.close();

    }


    setTimeout(
      function () {

        const focusTarget =
          currentAuth === "login"
            ? getElement(
                "loginPhone"
              )
            : getElement(
                "firstName"
              );


        if (focusTarget) {

          focusTarget.focus();

        }

      },
      50
    );

  }


  /* =======================================================
     SHOW LOGIN
  ======================================================= */

  function showLogin() {

    authTitle.textContent =
      "Welcome Back";


    authSubtitle.textContent =
      "Log in to your BarakaLink account.";


    loginForm.style.display =
      "flex";


    signupForm.style.display =
      "none";


    hideEmailOtpStep();
    hideTelegramStep();


    if (authSwitch) {

      authSwitch.style.display =
        "block";

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


  /* =======================================================
     SHOW SIGNUP
  ======================================================= */

  function showSignup() {

    authTitle.textContent =
      "Join BarakaLink";


    authSubtitle.textContent =
      "Create your account and start your Quran learning journey.";


    loginForm.style.display =
      "none";


    signupForm.style.display =
      "flex";


    hideEmailOtpStep();
    hideTelegramStep();


    if (authSwitch) {

      authSwitch.style.display =
        "block";

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


  /* =======================================================
     CLOSE AUTH
  ======================================================= */

  function closeAuthModal() {

    authOverlay.classList.remove(
      "open"
    );


    authOverlay.setAttribute(
      "aria-hidden",
      "true"
    );


    body.classList.remove(
      "modal-open"
    );


    hideEmailOtpStep();
    hideTelegramStep();


    pendingRegistration =
      null;


    resetEmailVerification();

  }


  if (closeAuth) {

    closeAuth.addEventListener(
      "click",
      closeAuthModal
    );

  }


  authOverlay.addEventListener(
    "click",
    function (event) {

      if (
        event.target ===
        authOverlay
      ) {

        closeAuthModal();

      }

    }
  );


  /* =======================================================
     ESCAPE
  ======================================================= */

  document.addEventListener(
    "keydown",
    function (event) {

      if (
        event.key !== "Escape"
      ) {

        return;

      }


      if (
        authOverlay.classList.contains(
          "open"
        )
      ) {

        closeAuthModal();

      }

    }
  );


  /* =======================================================
     AUTH BUTTONS
  ======================================================= */

  document
    .querySelectorAll(
      "[data-auth]"
    )
    .forEach(
      function (element) {

        element.addEventListener(
          "click",
          function (event) {

            event.preventDefault();


            openAuth(
              element.dataset.auth
            );

          }
        );

      }
    );


  /* =======================================================
     LOGIN ↔ SIGNUP
  ======================================================= */

  if (switchAuth) {

    switchAuth.addEventListener(
      "click",
      function () {

        if (
          currentAuth === "login"
        ) {

          openAuth(
            "signup"
          );

        } else {

          openAuth(
            "login"
          );

        }

      }
    );

  }


  /* =======================================================
     COLLECT PARENT DATA
     -------------------------------------------------------
     `email` is only included when the user chose the
     Email + OTP + Telegram method.
  ======================================================= */

  function collectParentData() {

    const data = {

      role:
        "parent",

      firstName:
        getElement(
          "firstName"
        )?.value.trim() || "",

      lastName:
        getElement(
          "lastName"
        )?.value.trim() || "",

      phone:
        normalizePhone(
          getElement(
            "signupPhone"
          )?.value || ""
        ),

      subcity:
        getElement(
          "subcity"
        )?.value || "",

      area:
        getElement(
          "area"
        )?.value || "",

      nearestMosque:
        getElement(
          "nearestMosque"
        )?.value.trim() || "",

      password:
        getElement(
          "signupPassword"
        )?.value || "",

      confirmPassword:
        getElement(
          "confirmPassword"
        )?.value || ""

    };


    if (
      getRegistrationMethod() ===
      "email"
    ) {

      data.email =
        normalizeEmail(
          getElement(
            "signupEmail"
          )?.value || ""
        );

    }


    return data;

  }


  /* =======================================================
     COLLECT USTAZ DATA
  ======================================================= */

  function collectUstazData() {

    const base =
      collectParentData();


    const studies =
      Array.from(
        document.querySelectorAll(
          'input[name="studyFields"]:checked'
        )
      ).map(
        function (input) {

          return input.value;

        }
      );


    return {

      ...base,

      role:
        "ustaz",

      experience:
        Number(
          getElement(
            "experience"
          )?.value || 0
        ),

      gender:
        getElement(
          "gender"
        )?.value || "",

      studyFields:
        studies

    };

  }


  /* =======================================================
     VALIDATION
  ======================================================= */

  function validateRegistration(data) {

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


    /* ---------------------------------------------------
       NAME
    --------------------------------------------------- */

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


    /* ---------------------------------------------------
       EMAIL
       (only when registering with Email + OTP + Telegram)
    --------------------------------------------------- */

    if (
      getRegistrationMethod() ===
      "email"
    ) {

      if (!data.email) {

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


    /* ---------------------------------------------------
       PHONE
    --------------------------------------------------- */

    if (
      !/^251[79]\d{8}$/.test(
        data.phone
      )
    ) {

      setText(
        "signupPhoneError",
        "Enter a valid Ethiopian phone number."
      );

      valid =
        false;

    }


    /* ---------------------------------------------------
       LOCATION
    --------------------------------------------------- */

    if (!data.subcity) {

      setText(
        "signupStatus",
        "Please select your sub-city."
      );

      valid =
        false;

    }


    if (!data.area) {

      setText(
        "signupStatus",
        "Please select your area."
      );

      valid =
        false;

    }


    /* ---------------------------------------------------
       MOSQUE
    --------------------------------------------------- */

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


    /* ---------------------------------------------------
       PASSWORD
    --------------------------------------------------- */

    if (
      data.password.length < 8
    ) {

      setText(
        "signupPasswordError",
        "Password must be at least 8 characters."
      );

      valid =
        false;

    }


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


    /* ---------------------------------------------------
       USTAZ REQUIREMENTS
    --------------------------------------------------- */

    if (
      data.role === "ustaz"
    ) {

      if (
        !Number.isFinite(
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


      if (!data.gender) {

        setText(
          "signupStatus",
          "Please select your gender."
        );

        valid =
          false;

      }


      if (
        !data.studyFields ||
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
     EMAIL VERIFICATION — REQUEST A CODE
     POST /auth/register/email/start
  ======================================================= */

  async function requestEmailCode(email) {

    if (
      !window.BarakaLinkAPI
    ) {

      throw new Error(
        "BarakaLink API is not available."
      );

    }


    const response =
      await window.BarakaLinkAPI.post(
        "/auth/register/email/start",
        {
          email
        }
      );


    if (
      !response ||
      !response.success
    ) {

      throw new Error(
        response?.message ||
        "Unable to send email verification code."
      );

    }


    const verificationId =
      response.data?.verificationId;


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


  /* =======================================================
     EMAIL VERIFICATION — START (PATH B)
  ======================================================= */

  async function beginEmailRegistration(data) {

    await requestEmailCode(
      data.email
    );


    pendingRegistration = {

      ...data

    };


    showEmailOtpStep();

  }


  /* =======================================================
     EMAIL VERIFICATION — CHECK THE CODE
     POST /auth/register/email/verify
  ======================================================= */

  async function verifyEmailCode() {

    if (
      !pendingRegistration ||
      !emailVerification.verificationId ||
      !emailVerification.email
    ) {

      throw createSessionExpiredError();

    }


    const otp =
      String(
        emailOtpInput?.value || ""
      )
      .trim();


    if (
      !/^\d{6}$/.test(
        otp
      )
    ) {

      throw new Error(
        "Enter the 6-digit email verification code."
      );

    }


    const response =
      await window.BarakaLinkAPI.post(
        "/auth/register/email/verify",
        {
          verificationId:
            emailVerification.verificationId,

          email:
            emailVerification.email,

          otp
        }
      );


    /*
      Accepts both:
        { success: true }
        { success: true, data: { verified: true } }
    */

    const verified =
      Boolean(
        response &&
        response.success === true &&
        response.data?.verified !== false
      );


    if (!verified) {

      throw new Error(
        response?.message ||
        "Email verification failed."
      );

    }


    emailVerification.verified =
      true;


    if (emailOtpInput) {

      emailOtpInput.value =
        "";

    }

  }

/* =======================================================
   COMPLETE EMAIL REGISTRATION
   -------------------------------------------------------
   Email → OTP → Account

   IMPORTANT:
   This function does NOT call Telegram.
   ======================================================= */

async function completeEmailRegistration(data) {

  if (!window.BarakaLinkAPI) {

    throw new Error(
      "BarakaLink API is not available."
    );

  }


  if (
    !emailVerification.verificationId ||
    !emailVerification.email ||
    !emailVerification.verified
  ) {

    throw createSessionExpiredError();

  }


  const response =
    await window.BarakaLinkAPI.post(
      "/auth/register/email/complete",
      {

        ...data,

        email:
          emailVerification.email,

        emailVerificationId:
          emailVerification.verificationId

      }
    );


  if (
    !response ||
    !response.success
  ) {

    throw new Error(
      response?.message ||
      "Unable to create your account."
    );

  }


  const token =
    response.data?.token;


  if (!token) {

    throw new Error(
      "The server did not return an authentication token."
    );

  }


  /*
    Email registration is now fully authenticated.
    No Telegram callback is required.
  */

  window.BarakaLinkAPI.setToken(
    token
  );


  const user =
    response.data?.user;


  /*
    Newly registered accounts go to the
    role-specific profile completion page.
  */

  if (
    user?.role === "ustaz"
  ) {

    window.location.replace(
      "ustaz-profile-completion.html"
    );

    return;

  }


  window.location.replace(
    "profile-completion.html"
  );

}
  /* =======================================================
     BACK TO THE SIGNUP FORM
  ======================================================= */

  function returnToSignup(message) {

    resetEmailVerification();


    pendingRegistration =
      null;


    showSignup();


    clearText(
      "signupStatus"
    );


    if (message) {

      setText(
        "signupStatus",
        message
      );

    }

  }


  /* =======================================================
     START TELEGRAM REGISTRATION
     -------------------------------------------------------
     Shared by both registration paths.

     Path A: `data` has no emailVerificationId.
     Path B: `data` includes emailVerificationId.
  ======================================================= */

  async function beginTelegramRegistration(data) {

    if (
      !window.BarakaLinkAPI
    ) {

      throw new Error(
        "BarakaLink API is not available."
      );

    }


    /*
      Never continue an email registration
      whose email has not been verified.
    */

    if (
      data.emailVerificationId &&
      !emailVerification.verified
    ) {

      throw new Error(
        "Please verify your email before continuing."
      );

    }


    const response =
      await window.BarakaLinkAPI.post(
        "/auth/register/start",
        data
      );


    if (
      !response.success
    ) {

      throw new Error(
        response.message ||
        "Unable to start registration."
      );

    }


    pendingRegistration = {

      ...data,

      challengeId:
        response.data?.challengeId

    };


    const authorizationUrl =
      response.data?.authorizationUrl;


    if (!authorizationUrl) {

      throw new Error(
        "Telegram authorization URL was not returned."
      );

    }


    showTelegramStep();


    window.location.href =
      authorizationUrl;

  }


  /* =======================================================
     SIGNUP SUBMIT
  ======================================================= */

  signupForm.addEventListener(
    "submit",
    async function (event) {

      event.preventDefault();


      const role =
        getSelectedRole();


      const data =
        role === "ustaz"
          ? collectUstazData()
          : collectParentData();


      if (
        !validateRegistration(
          data
        )
      ) {

        return;

      }


      const signupButton =
        signupForm.querySelector(
          'button[type="submit"]'
        );


      /* -------------------------------------------------
         PATH A
         Phone → Telegram
         (unchanged behavior)
      ------------------------------------------------- */

      if (
        getRegistrationMethod() !==
        "email"
      ) {

        setButtonBusy(
          signupButton,
          true,
          `
          Continuing
          <i class="fa-solid fa-spinner fa-spin"></i>
          `
        );


        try {

          await beginTelegramRegistration(
            data
          );

        } catch (error) {

          console.error(
            "Registration error:",
            error
          );


          setText(
            "signupStatus",
            error.message ||
            "Unable to start registration."
          );

        } finally {

          setButtonBusy(
            signupButton,
            false
          );

        }

        return;

      }
/* -------------------------------------------------
   PATH B
   Email → OTP → Account

   IMPORTANT:
   No Telegram is used here.
------------------------------------------------- */

const sameVerifiedEmail =
  emailVerification.verified &&
  emailVerification.email ===
    data.email;


if (sameVerifiedEmail) {

  setButtonBusy(
    signupButton,
    true,
    `
    Creating account
    <i class="fa-solid fa-spinner fa-spin"></i>
    `
  );


  try {

    await completeEmailRegistration(
      data
    );

  } catch (error) {

    console.error(
      "Email registration completion error:",
      error
    );


    if (
      error.sessionExpired ||
      error.status === 410
    ) {

      returnToSignup(
        error.message
      );

    }

    else {

      setText(
        "signupStatus",
        error.message ||
        "Unable to create your account."
      );

    }

  } finally {

    setButtonBusy(
      signupButton,
      false
    );

  }

  return;

}
      setButtonBusy(
        signupButton,
        true,
        `
        Sending email code
        <i class="fa-solid fa-spinner fa-spin"></i>
        `
      );


      try {

        await beginEmailRegistration(
          data
        );

      } catch (error) {

        console.error(
          "Email registration error:",
          error
        );


        setText(
          "signupStatus",
          error.message ||
          "Unable to start email verification."
        );

      } finally {

        setButtonBusy(
          signupButton,
          false
        );

      }

    }
  );


  /* =======================================================
     EMAIL OTP INPUT
  ======================================================= */

  if (emailOtpInput) {

    /*
      Digits only, maximum 6.
    */

    emailOtpInput.addEventListener(
      "input",
      function () {

        const digits =
          emailOtpInput.value
            .replace(
              /\D/g,
              ""
            )
            .slice(
              0,
              6
            );


        if (
          emailOtpInput.value !==
          digits
        ) {

          emailOtpInput.value =
            digits;

        }

      }
    );


    emailOtpInput.addEventListener(
      "keydown",
      function (event) {

        if (
          event.key !== "Enter"
        ) {

          return;

        }


        event.preventDefault();


        if (
          verifyEmailOtpButton &&
          !verifyEmailOtpButton.disabled
        ) {

          verifyEmailOtpButton.click();

        }

      }
    );

  }


  /* =======================================================
     EMAIL OTP BUTTON
  ======================================================= */

  if (
    verifyEmailOtpButton
  ) {

    verifyEmailOtpButton.addEventListener(
      "click",
      async function () {

        if (
          emailOtpError
        ) {

          emailOtpError.textContent =
            "";

        }


        setButtonBusy(
          verifyEmailOtpButton,
          true,
          `
          Verifying
          <i class="fa-solid fa-spinner fa-spin"></i>
          `
        );


        /*
          1) Check the code with the backend
        */

        try {

          await verifyEmailCode();

        } catch (error) {

          console.error(
            "Email OTP verification error:",
            error
          );


          if (
            error.sessionExpired
          ) {

            returnToSignup(
              error.message
            );

          }

          else if (
            emailOtpError
          ) {

            emailOtpError.textContent =
              error.message ||
              "Unable to verify your email.";


            if (emailOtpInput) {

              emailOtpInput.focus();

            }

          }


          setButtonBusy(
            verifyEmailOtpButton,
            false
          );

          return;

        }


/*
  2) Email verified → create the account directly.

  IMPORTANT:
  No Telegram registration starts here.
*/

try {

  await completeEmailRegistration(
    pendingRegistration
  );

} catch (error) {

  console.error(
    "Email registration completion error:",
    error
  );


  /*
    410 means the verification session
    is no longer valid.
  */

  if (
    error.status === 410 ||
    error.sessionExpired
  ) {

    resetEmailVerification();


    returnToSignup(
      error.message ||
      "Your email verification session has expired. Please start again."
    );

  }

  else {

    /*
      Keep the verified email state so the
      user can fix another registration field
      without repeating OTP verification.
    */

    showSignup();


    setText(
      "signupStatus",
      error.message ||
      "Unable to create your account."
    );

  }

} finally {

  setButtonBusy(
    verifyEmailOtpButton,
    false
  );

}

      }
    );

  }


  /* =======================================================
     EMAIL OTP — RESEND
  ======================================================= */

  if (
    resendEmailOtpButton
  ) {

    resendEmailOtpButton.addEventListener(
      "click",
      async function () {

        if (
          emailOtpError
        ) {

          emailOtpError.textContent =
            "";

        }


        setButtonBusy(
          resendEmailOtpButton,
          true,
          `
          Sending
          <i class="fa-solid fa-spinner fa-spin"></i>
          `
        );


        try {

          if (
            !pendingRegistration ||
            !emailVerification.email
          ) {

            throw createSessionExpiredError();

          }


          await requestEmailCode(
            emailVerification.email
          );


          showEmailOtpStep();


          authSubtitle.textContent =
            `A new verification code was sent to ${emailVerification.email}.`;

        } catch (error) {

          console.error(
            "Email OTP resend error:",
            error
          );


          if (
            error.sessionExpired
          ) {

            returnToSignup(
              error.message
            );

          }

          else if (
            emailOtpError
          ) {

            emailOtpError.textContent =
              error.message ||
              "Unable to resend the verification code.";

          }

        } finally {

          setButtonBusy(
            resendEmailOtpButton,
            false
          );

        }

      }
    );

  }


  /* =======================================================
     EMAIL OTP — CHANGE EMAIL / GO BACK
  ======================================================= */

  if (
    emailOtpBackButton
  ) {

    emailOtpBackButton.addEventListener(
      "click",
      function () {

        returnToSignup();


        setTimeout(
          function () {

            if (signupEmail) {

              signupEmail.focus();

            }

          },
          50
        );

      }
    );

  }


  /* =======================================================
     TELEGRAM BUTTON
  ======================================================= */

  if (
    telegramButton
  ) {

    telegramButton.addEventListener(
      "click",
      async function () {

        if (
          !pendingRegistration
        ) {

          if (
            telegramError
          ) {

            telegramError.textContent =
              "Your registration session has expired. Please start again.";

          }

          return;

        }


        telegramError.textContent =
          "";


        telegramButton.disabled =
          true;


        telegramButton.innerHTML =
          `
          Opening Telegram
          <i class="fa-solid fa-spinner fa-spin"></i>
          `;


        try {

          const response =
            await window.BarakaLinkAPI.post(
              "/auth/register/telegram/start",
              {
                challengeId:
                  pendingRegistration.challengeId
              }
            );


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

          telegramError.textContent =
            error.message ||
            "Unable to open Telegram.";


          telegramButton.disabled =
            false;


          telegramButton.innerHTML =
            `
            <i class="fa-brands fa-telegram"></i>
            Continue with Telegram
            `;

        }

      }
    );

  }


  /* =======================================================
     LOGIN
     -------------------------------------------------------
     Accepts:
       - Ethiopian phone number
       - Email address

     Sends:
       { identifier, password }
  ======================================================= */

  loginForm.addEventListener(
    "submit",
    async function (event) {

      event.preventDefault();


      clearText(
        "loginPhoneError",
        "loginPasswordError",
        "loginStatus"
      );


      const identifierInput =
        getElement(
          "loginPhone"
        );


      const passwordInput =
        getElement(
          "loginPassword"
        );


      const identifier =
        String(
          identifierInput?.value || ""
        )
        .trim();


      const password =
        passwordInput?.value || "";


      let valid =
        true;


      if (!identifier) {

        setText(
          "loginPhoneError",
          "Enter your email or phone number."
        );

        valid =
          false;

      }


      else if (
        isEmailIdentifier(
          identifier
        )
      ) {

        if (
          !isValidEmail(
            identifier
          )
        ) {

          setText(
            "loginPhoneError",
            "Enter a valid email address."
          );

          valid =
            false;

        }

      }


      else {

        const phone =
          normalizePhone(
            identifier
          );


        if (
          !/^251[79]\d{8}$/.test(
            phone
          )
        ) {

          setText(
            "loginPhoneError",
            "Enter a valid email or Ethiopian phone number."
          );

          valid =
            false;

        }

      }


      if (!password) {

        setText(
          "loginPasswordError",
          "Enter your password."
        );

        valid =
          false;

      }


      if (!valid) {

        return;

      }


      const loginButton =
        loginForm.querySelector(
          'button[type="submit"]'
        );


      if (loginButton) {

        loginButton.disabled =
          true;

      }


      try {

        const normalizedIdentifier =
          isEmailIdentifier(
            identifier
          )
            ? normalizeEmail(
                identifier
              )
            : normalizePhone(
                identifier
              );


        const response =
          await window.BarakaLinkAPI.post(
            "/auth/login",
            {
              identifier:
                normalizedIdentifier,

              password
            }
          );


        if (
          !response.success
        ) {

          throw new Error(
            response.message ||
            "Login failed."
          );

        }


        const token =
          response.data?.token;


        if (!token) {

          throw new Error(
            "The server did not return an authentication token."
          );

        }


        window.BarakaLinkAPI.setToken(
          token
        );


        const user =
          response.data?.user;


        if (
          user?.role === "ustaz"
        ) {

          window.location.href =
            "dashboard/teacher.html";

        }

        else {

          window.location.href =
            "dashboard/student.html";

        }

      } catch (error) {

        console.error(
          "Login error:",
          error
        );


        setText(
          "loginStatus",
          error.message ||
          "Unable to sign in."
        );


        if (loginButton) {

          loginButton.disabled =
            false;

        }

      }

    }
  );


  /* =======================================================
     FORGOT PASSWORD
  ======================================================= */

  const forgotPasswordButton =
    getElement(
      "forgotPasswordButton"
    );


  if (
    forgotPasswordButton
  ) {

    forgotPasswordButton.addEventListener(
      "click",
      function () {

        window.location.href =
          "forgot-password.html";

      }
    );

  }


  /* =======================================================
     AUTH CALLBACK SUPPORT
  ======================================================= */

  /*
    Telegram redirects back to:

    auth-callback.html?ticket=...

    That page is handled by auth-callback.js.
  */


  /* =======================================================
     PUBLIC API
  ======================================================= */

  window.BarakaLinkAuth = {

    open:
      openAuth,

    close:
      closeAuthModal,

    setRole:
      setRole,

    getRole:
      getSelectedRole

  };


})();
