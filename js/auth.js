
/**
 * BarakaLink
 * Authentication
 *
 * Handles:
 * - Login
 * - Parent / Student registration
 * - Ustaz / Ustaza registration
 * - Role selection
 * - Study field selection
 * - Location selection
 * - Password visibility
 * - Telegram verification
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


  /* -------------------------------------------------------
     ROLE OPTIONS ONLY
     Do not include study-field cards here.
  ------------------------------------------------------- */

  const roleOptions =
    document.querySelectorAll(
      '.role-option[data-role]'
    );


  /* -------------------------------------------------------
     STUDY FIELD CHECKBOXES
  ------------------------------------------------------- */

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

  function getElement(
    id
  ) {

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


  function clearText(
    ...ids
  ) {

    ids.forEach(
      function (id) {

        setText(
          id,
          ""
        );

      }
    );

  }

function normalizePhone(
  value
) {

  let phone =
    String(value || "")
      .trim()
      .replace(
        /\D/g,
        ""
      );


  /*
    Convert 00XXXXXXXXXXXX
    to international format.
  */

  if (
    phone.startsWith("00")
  ) {

    phone =
      phone.slice(2);

  }


  /*
    Already international:
      2519XXXXXXXX
      2517XXXXXXXX
  */

  if (
    phone.startsWith("2519") ||
    phone.startsWith("2517")
  ) {

    return phone;

  }


  /*
    Local Ethio Telecom:
      09XXXXXXXX
  */

  if (
    phone.startsWith("09") &&
    phone.length === 10
  ) {

    return `251${phone.slice(1)}`;

  }


  /*
    Local Safaricom:
      07XXXXXXXX
  */

  if (
    phone.startsWith("07") &&
    phone.length === 10
  ) {

    return `251${phone.slice(1)}`;

  }


  /*
    Without the leading zero:
      9XXXXXXXX
      7XXXXXXXX
  */

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


  function setRole(
    role
  ) {

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


    if (
      ustazExtra
    ) {

      ustazExtra.classList.toggle(
        "visible",
        role === "ustaz"
      );

    }

  }


  /* -------------------------------------------------------
     ROLE CARD EVENTS
     Only role cards are handled here.
  ------------------------------------------------------- */

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


      /*
        The checkbox remains the source of truth.
        The card's active class simply mirrors it.
      */

      input.addEventListener(
        "change",
        syncStudyFieldState
      );


      /*
        Initialize the visual state correctly
        when the modal/page first loads.
      */

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
              input.type === "password";


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
     AUTH MODAL OPEN
  ======================================================= */

  function openAuth(
    mode
  ) {

    currentAuth =
      mode;


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


        if (
          focusTarget
        ) {

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


    hideTelegramStep();


    if (
      authSwitch
    ) {

      authSwitch.style.display =
        "block";

    }


    if (
      switchText
    ) {

      switchText.textContent =
        "Don't have an account?";

    }


    if (
      switchAuth
    ) {

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


    hideTelegramStep();


    if (
      authSwitch
    ) {

      authSwitch.style.display =
        "block";

    }


    if (
      switchText
    ) {

      switchText.textContent =
        "Already have an account?";

    }


    if (
      switchAuth
    ) {

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


    hideTelegramStep();


    pendingRegistration =
      null;

  }


  if (
    closeAuth
  ) {

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

  if (
    switchAuth
  ) {

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
  ======================================================= */

  function collectParentData() {

    return {

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

  function validateRegistration(
    data
  ) {

    clearText(
  "nameError",
  "signupPhoneError",
  "signupPasswordError",
  "confirmError",
  "nearestMosqueError",
  "signupStatus"
);


    let valid =
      true;


    /* ---------------------------------------------------
       Name
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
       Phone
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
       Location
    --------------------------------------------------- */

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
       Password
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
       Ustaz requirements
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
     START TELEGRAM REGISTRATION
  ======================================================= */

  async function beginTelegramRegistration(
    data
  ) {

    if (
      !window.BarakaLinkAPI
    ) {

      throw new Error(
        "BarakaLink API is not available."
      );

    }


    /*
      The backend stores this registration
      temporarily and returns a Telegram
      authorization URL.
    */

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
        response.data.challengeId

    };


    /*
      Backend should return something like:

      {
        success: true,
        data: {
          challengeId: "...",
          authorizationUrl: "..."
        }
      }
    */

    const authorizationUrl =
      response.data.authorizationUrl;


    if (
      !authorizationUrl
    ) {

      throw new Error(
        "Telegram authorization URL was not returned."
      );

    }


    showTelegramStep();


    /*
      Open Telegram authorization.
    */

    window.location.href =
      authorizationUrl;

  }


  /* =======================================================
     SHOW TELEGRAM
  ======================================================= */

  function showTelegramStep() {

    signupForm.style.display =
      "none";


    loginForm.style.display =
      "none";


    if (
      authSwitch
    ) {

      authSwitch.style.display =
        "none";

    }


    if (
      telegramSection
    ) {

      telegramSection.classList.add(
        "active"
      );

    }


    authTitle.textContent =
      "Verify with Telegram";


    authSubtitle.textContent =
      "Connect your Telegram account to securely verify your identity.";

  }


  /* =======================================================
     HIDE TELEGRAM
  ======================================================= */

  function hideTelegramStep() {

    if (
      telegramSection
    ) {

      telegramSection.classList.remove(
        "active"
      );

    }


    if (
      telegramError
    ) {

      telegramError.textContent =
        "";

    }

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


      if (
        signupButton
      ) {

        signupButton.disabled =
          true;


        signupButton.dataset.originalText =
          signupButton.innerHTML;


        signupButton.innerHTML =
          `
          Starting Telegram verification
          <i class="fa-brands fa-telegram"></i>
          `;

      }


      try {

        await beginTelegramRegistration(
          data
        );

      } catch (
        error
      ) {

        console.error(
          "Registration error:",
          error
        );


        setText(
          "signupStatus",
          error.message ||
          "Unable to start registration."
        );


        if (
          signupButton
        ) {

          signupButton.disabled =
            false;


          signupButton.innerHTML =
            signupButton.dataset.originalText;

        }

      }

    }
  );


  /* =======================================================
     TELEGRAM BUTTON

     This is used mainly for a return/retry
     situation. Normally beginTelegramRegistration()
     redirects directly to Telegram.
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


          if (
            !authorizationUrl
          ) {

            throw new Error(
              "Telegram authorization URL was not returned."
            );

          }


          window.location.href =
            authorizationUrl;

        } catch (
          error
        ) {

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


      const phoneInput =
        getElement(
          "loginPhone"
        );


      const passwordInput =
        getElement(
          "loginPassword"
        );


      const phone =
        normalizePhone(
          phoneInput?.value || ""
        );


      const password =
        passwordInput?.value || "";


      let valid =
        true;


     if (
  !/^251[79]\d{8}$/.test(
    phone
  )
) {

        setText(
          "loginPhoneError",
          "Enter a valid Ethiopian phone number."
        );


        valid =
          false;

      }


      if (
        !password
      ) {

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


      if (
        loginButton
      ) {

        loginButton.disabled =
          true;

      }


      try {

        const response =
          await window.BarakaLinkAPI.post(
            "/auth/login",
            {
              phone,
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


        if (
          !token
        ) {

          throw new Error(
            "The server did not return an authentication token."
          );

        }


        window.BarakaLinkAPI.setToken(
          token
        );


        const user =
          response.data?.user;


        /*
          Dashboard selection is based on
          the authenticated role.
        */

        if (
          user?.role === "ustaz"
        ) {

          window.location.href =
            "dashboard/teacher.html";

        } else {

          window.location.href =
            "dashboard/student.html";

        }

      } catch (
        error
      ) {

        console.error(
          "Login error:",
          error
        );


        setText(
          "loginStatus",
          error.message ||
          "Unable to sign in."
        );


        if (
          loginButton
        ) {

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
