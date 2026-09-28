/**
 * BarakaLink
 * Profile Completion - Two-Step Same-Page Wizard
 *
 * Purpose:
 * - Load the authenticated user's existing registration information.
 * - Show the information entered during the signup modal.
 * - Allow the user to review and correct editable registration data.
 * - Keep Telegram-verified phone number read-only.
 * - Save Step 1 corrections through PATCH /api/profile.
 * - Continue to Step 2 on the SAME PAGE.
 * - Collect optional personalization preferences.
 * - Preview, upload, and remove a profile photo through the backend.
 * - Keep Step 2 separate from registration information.
 * - Never pretend Step 2 was saved when the backend does not confirm it.
 *
 * STEP 1:
 * - Account type
 * - First name
 * - Last name
 * - Phone
 * - Sub-city
 * - Area
 * - Nearest mosque
 * - Ustaz/Ustaza teaching information
 *
 * STEP 2:
 * - Profile photo
 * - About you / bio
 * - Study interests
 * - Islamic content interests
 * - Preferred Ustaz/Ustaza gender
 *
 * IMPORTANT:
 * - No user_id is accepted from the browser.
 * - Authentication identity comes from the JWT through BarakaLinkAPI.
 * - profile_completed remains false after Step 1.
 * - Step 2 must not claim success unless the backend confirms it.
 */

"use strict";

(function () {


  /* =======================================================
     CONFIGURATION
  ======================================================= */

  const PROFILE_ENDPOINT =
    "/profile";

  const CURRENT_USER_ENDPOINT =
    "/auth/me";

  const PREFERENCES_ENDPOINT =
    "/profile/preferences";

  const PHOTO_ENDPOINT =
    "/profile/photo";

  /*
   * API base used for direct multipart photo requests.
   *
   * This follows the same local-development convention already
   * used by the BarakaLink frontend.
   */
  const API_BASE =
    String(
      window.BARAKALINK_API_BASE ||
      "http://localhost:5000/api"
    ).replace(
      /\/+$/,
      ""
    );


  /*
   * API origin is used for server-backed uploaded files.
   *
   * Example:
   *   /uploads/profile-photos/14-photo.webp
   *
   * becomes:
   *   http://localhost:5000/uploads/profile-photos/14-photo.webp
   */
  const API_ORIGIN =
    computeApiOrigin(
      API_BASE
    );


  const MAX_PROFILE_PHOTO_BYTES =
    5 * 1024 * 1024;


  const ALLOWED_PROFILE_PHOTO_TYPES =
    new Set([
      "image/jpeg",
      "image/png",
      "image/webp"
    ]);


  const DEFAULT_PAGE =
    "index.html";

  const DASHBOARD_PARENT =
    "dashboard/student.html";

  const DASHBOARD_USTAZ =
    "dashboard/teacher.html";


  /* =======================================================
     DOM REFERENCES
  ======================================================= */

  const form =
    document.getElementById(
      "profileCompletionForm"
    );


  /* -------------------------------------------------------
     STEP 1
  ------------------------------------------------------- */

  const stepOne =
    document.getElementById(
      "profileStepOne"
    );

  const stepTwo =
    document.getElementById(
      "profileStepTwo"
    );


  /* -------------------------------------------------------
     HEADER
  ------------------------------------------------------- */

  const stepTitle =
    document.getElementById(
      "profileStepTitle"
    );

  const stepDescription =
    document.getElementById(
      "profileStepDescription"
    );

  const progressNumber =
    document.getElementById(
      "profileProgressNumber"
    );


  /* -------------------------------------------------------
     STEP 1 INPUTS
  ------------------------------------------------------- */

  const roleInput =
    document.getElementById(
      "profileRole"
    );

  const firstNameInput =
    document.getElementById(
      "profileFirstName"
    );

  const lastNameInput =
    document.getElementById(
      "profileLastName"
    );

  const phoneInput =
    document.getElementById(
      "profilePhone"
    );

  const phoneVerified =
    document.getElementById(
      "profilePhoneVerified"
    );

  const subcityInput =
    document.getElementById(
      "profileSubcity"
    );

  const areaInput =
    document.getElementById(
      "profileArea"
    );

  const nearestMosqueInput =
    document.getElementById(
      "profileNearestMosque"
    );

  const ustazSection =
    document.getElementById(
      "ustazProfileSection"
    );

  const experienceInput =
    document.getElementById(
      "profileExperience"
    );

  const genderInput =
    document.getElementById(
      "profileGender"
    );

  const studyFieldInputs =
    document.querySelectorAll(
      'input[name="studyFields"]'
    );


  /* -------------------------------------------------------
     STEP 2 INPUTS
  ------------------------------------------------------- */

  const profilePhotoInput =
    document.getElementById(
      "profilePhoto"
    );

  const profilePhotoPreview =
    document.getElementById(
      "profilePhotoPreview"
    );

  const profilePhotoPlaceholder =
    document.getElementById(
      "profilePhotoPlaceholder"
    );

  const profilePhotoChangeButton =
    document.getElementById(
      "profilePhotoChangeButton"
    );

  const profilePhotoRemoveButton =
    document.getElementById(
      "profilePhotoRemoveButton"
    );

  const profileBioInput =
    document.getElementById(
      "profileBio"
    );

  const profileBioCount =
    document.getElementById(
      "profileBioCount"
    );

  const studyInterestInputs =
    document.querySelectorAll(
      'input[name="studyInterests"]'
    );

  const contentInterestInputs =
    document.querySelectorAll(
      'input[name="contentInterests"]'
    );

  const teacherGenderPreferenceInputs =
    document.querySelectorAll(
      'input[name="preferredTeacherGender"]'
    );


  /* -------------------------------------------------------
     STATUS / ACTIONS
  ------------------------------------------------------- */

  const statusElement =
    document.getElementById(
      "profileStatus"
    );

  const saveButton =
    document.getElementById(
      "profileSaveButton"
    );

  const saveButtonText =
    document.getElementById(
      "profileSaveButtonText"
    );

  const saveButtonIcon =
    document.getElementById(
      "profileSaveButtonIcon"
    );

  const backButton =
    document.getElementById(
      "profileBackButton"
    );

  const logoutButton =
    document.getElementById(
      "profileLogoutButton"
    );

  const headerLogoutButton =
    document.getElementById(
      "logoutButton"
    );

  const completionNote =
    document.getElementById(
      "profileCompletionNote"
    );


  /* =======================================================
     STATE
  ======================================================= */

  let currentUser =
    null;

  let currentStep =
    1;

  let submitting =
    false;

  /*
   * A File selected by the user but not yet uploaded.
   */
  let profilePhotoFile =
    null;

  /*
   * Temporary browser object URL used only for local preview.
   */
  let profilePhotoObjectUrl =
    null;

  /*
   * Last server-confirmed avatar path.
   *
   * Example:
   *   /uploads/profile-photos/14-uuid.webp
   */
  let existingAvatarUrl =
    "";


  /* =======================================================
     AREA DATA
     
     These values mirror the current signup location
     choices already used by auth.js.
  ======================================================= */

  const AREA_OPTIONS = Object.freeze({

    bole: [
      {
        value: "bole-medhanialem",
        label: "Bole Medhanialem"
      },
      {
        value: "atlas",
        label: "Atlas"
      },
      {
        value: "gerji",
        label: "Gerji"
      },
      {
        value: "airport",
        label: "Airport"
      }
    ],

    yeka: [
      {
        value: "cmc",
        label: "CMC"
      },
      {
        value: "kotebe",
        label: "Kotebe"
      },
      {
        value: "megenagna",
        label: "Megenagna"
      },
      {
        value: "yeka-abado",
        label: "Yeka Abado"
      }
    ],

    kirkos: [
      {
        value: "kazanchis",
        label: "Kazanchis"
      },
      {
        value: "mexico",
        label: "Mexico"
      },
      {
        value: "meskel-square",
        label: "Meskel Square"
      },
      {
        value: "wello-sefer",
        label: "Wello Sefer"
      }
    ],

    arada: [
      {
        value: "piazza",
        label: "Piazza"
      },
      {
        value: "arat-kilo",
        label: "Arat Kilo"
      },
      {
        value: "shiro-meda",
        label: "Shiro Meda"
      }
    ],

    lideta: [
      {
        value: "lideta",
        label: "Lideta"
      },
      {
        value: "teklehaimanot",
        label: "Teklehaimanot"
      },
      {
        value: "tewodros",
        label: "Tewodros"
      }
    ],

    "nifas-silk": [
      {
        value: "sar-bet",
        label: "Sar Bet"
      },
      {
        value: "lafto",
        label: "Lafto"
      },
      {
        value: "weyra",
        label: "Weyra"
      }
    ],

    kolfe: [
      {
        value: "kolfe",
        label: "Kolfe"
      },
      {
        value: "bethel",
        label: "Bethel"
      },
      {
        value: "ayer-tena",
        label: "Ayer Tena"
      }
    ],

    akaki: [
      {
        value: "akaki",
        label: "Akaki"
      },
      {
        value: "kaliti",
        label: "Kaliti"
      },
      {
        value: "qality",
        label: "Qality"
      }
    ]

  });


  /* =======================================================
     STEP 2 CONSTANTS
  ======================================================= */

  const ALLOWED_CONTENT_INTERESTS =
    new Set([
      "quran",
      "tafseer",
      "hadith",
      "seerah",
      "aqeedah",
      "fiqh",
      "dua-adhkar",
      "islamic-manners-character",
      "stories-of-the-prophets",
      "family-parenting-islam",
      "childrens-islamic-education",
      "islamic-history"
    ]);


  const ALLOWED_STUDY_INTERESTS =
    new Set([
      "quran-basic",
      "tajweed",
      "hifz",
      "tafseer",
      "hadith",
      "tarbiyah"
    ]);


  const ALLOWED_TEACHER_GENDER_PREFERENCES =
    new Set([
      "male",
      "female",
      "no-preference"
    ]);


  /* =======================================================
     STATUS HELPERS
  ======================================================= */

  function setStatus(
    message,
    type = ""
  ) {

    if (!statusElement) {
      return;
    }

    statusElement.textContent =
      message || "";

    statusElement.classList.remove(
      "success",
      "error",
      "loading"
    );

    if (type) {

      statusElement.classList.add(
        type
      );

    }

  }


  function setError(
    id,
    message
  ) {

    const element =
      document.getElementById(
        id
      );

    if (!element) {
      return;
    }

    element.textContent =
      message || "";

  }


  function clearErrors() {

    [
      "profileNameError",
      "profilePhoneError",
      "profileSubcityError",
      "profileAreaError",
      "profileNearestMosqueError",
      "profileExperienceError",
      "profileGenderError",
      "profileStudyFieldsError",
      "profilePhotoError",
      "profileBioError",
      "profileStudyInterestsError",
      "profileContentInterestsError",
      "profileTeacherGenderError"
    ].forEach(
      function (id) {

        setError(
          id,
          ""
        );

      }
    );

    setStatus(
      ""
    );

  }


  function clearStepTwoErrors() {

    [
      "profilePhotoError",
      "profileBioError",
      "profileStudyInterestsError",
      "profileContentInterestsError",
      "profileTeacherGenderError"
    ].forEach(
      function (id) {

        setError(
          id,
          ""
        );

      }
    );

    setStatus(
      ""
    );

  }


  /* =======================================================
     TOKEN
  ======================================================= */

  function getToken() {

    if (
      !window.BarakaLinkAPI ||
      typeof window.BarakaLinkAPI.getToken !==
        "function"
    ) {

      return null;

    }

    return window.BarakaLinkAPI.getToken();

  }


  /* =======================================================
     LOGOUT
  ======================================================= */

  function logout() {

    if (
      window.BarakaLinkAPI &&
      typeof window.BarakaLinkAPI.clearToken ===
        "function"
    ) {

      window.BarakaLinkAPI.clearToken();

    }

    try {

      sessionStorage.removeItem(
        "barakalink_telegram_ticket"
      );

    } catch (error) {

      console.warn(
        "Unable to clear Telegram session reference:",
        error
      );

    }

    releasePhotoObjectUrl();

    window.location.replace(
      DEFAULT_PAGE
    );

  }


  /* =======================================================
     ROLE HELPERS
  ======================================================= */

  function normalizeRole(
    value
  ) {

    return String(
      value || ""
    )
      .trim()
      .toLowerCase();

  }


  function roleLabel(
    role
  ) {

    const normalized =
      normalizeRole(
        role
      );

    if (
      normalized === "ustaz"
    ) {

      return "Ustaz / Ustaza";

    }

    return "Parent / Student";

  }


  function dashboardForRole(
    role
  ) {

    return normalizeRole(
      role
    ) === "ustaz"
      ? DASHBOARD_USTAZ
      : DASHBOARD_PARENT;

  }


  /* =======================================================
     PHONE
  ======================================================= */

  function formatPhoneForDisplay(
    value
  ) {

    const phone =
      String(
        value || ""
      )
        .replace(
          /\D/g,
          ""
        );

    if (
      phone.startsWith("251") &&
      phone.length === 12
    ) {

      return (
        phone.slice(3, 6) +
        " " +
        phone.slice(6, 9) +
        " " +
        phone.slice(9)
      );

    }

    if (
      phone.startsWith("0") &&
      phone.length === 10
    ) {

      return (
        phone.slice(1, 4) +
        " " +
        phone.slice(4, 7) +
        " " +
        phone.slice(7)
      );

    }

    return value || "";

  }


  function normalizePhoneForSubmit(
    value
  ) {

    let phone =
      String(
        value || ""
      )
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
     USER RESPONSE NORMALIZATION
  ======================================================= */

  function extractUser(
    response
  ) {

    if (
      response?.data?.user &&
      typeof response.data.user ===
        "object"
    ) {

      return response.data.user;

    }

    if (
      response?.user &&
      typeof response.user ===
        "object"
    ) {

      return response.user;

    }

    if (
      response?.data &&
      typeof response.data ===
        "object" &&
      (
        response.data.firstName ||
        response.data.first_name ||
        response.data.phone ||
        response.data.role
      )
    ) {

      return response.data;

    }

    return null;

  }


  /* =======================================================
     USER FIELD HELPERS
  ======================================================= */

  function getFirstName(
    user
  ) {

    return (
      user?.firstName ??
      user?.first_name ??
      user?.profile?.firstName ??
      user?.profile?.first_name ??
      ""
    );

  }


  function getLastName(
    user
  ) {

    return (
      user?.lastName ??
      user?.last_name ??
      user?.profile?.lastName ??
      user?.profile?.last_name ??
      ""
    );

  }


  function getPhone(
    user
  ) {

    return (
      user?.phone ??
      user?.phone_number ??
      user?.profile?.phone ??
      ""
    );

  }


  function getSubcity(
    user
  ) {

    return (
      user?.subcity ??
      user?.profile?.subcity ??
      user?.student?.subcity ??
      user?.studentProfile?.subcity ??
      user?.teacherProfile?.subcity ??
      ""
    );

  }


  function getArea(
    user
  ) {

    return (
      user?.area ??
      user?.profile?.area ??
      user?.student?.area ??
      user?.studentProfile?.area ??
      user?.teacherProfile?.area ??
      ""
    );

  }


  function getNearestMosque(
    user
  ) {

    return (
      user?.nearestMosque ??
      user?.nearest_mosque ??
      user?.profile?.nearestMosque ??
      user?.profile?.nearest_mosque ??
      user?.student?.nearestMosque ??
      user?.student?.nearest_mosque ??
      user?.studentProfile?.nearestMosque ??
      user?.studentProfile?.nearest_mosque ??
      user?.teacherProfile?.nearestMosque ??
      user?.teacherProfile?.nearest_mosque ??
      ""
    );

  }


  function getExperience(
    user
  ) {

    return (
      user?.experience ??
      user?.teacherProfile?.experience ??
      user?.teacher_profile?.experience ??
      ""
    );

  }


  function getGender(
    user
  ) {

    return (
      user?.gender ??
      user?.teacherProfile?.gender ??
      user?.teacher_profile?.gender ??
      ""
    );

  }


  function getStudyFields(
    user
  ) {

    const fields =
      user?.studyFields ??
      user?.study_fields ??
      user?.teacherProfile?.studyFields ??
      user?.teacherProfile?.study_fields ??
      user?.teacher_profile?.studyFields ??
      user?.teacher_profile?.study_fields ??
      [];

    if (
      !Array.isArray(fields)
    ) {

      return [];

    }

    return fields
      .map(
        function (field) {

          if (
            typeof field ===
              "string"
          ) {

            return field;

          }

          return (
            field?.slug ??
            field?.field_key ??
            field?.value ??
            ""
          );

        }
      )
      .filter(Boolean);

  }


  function isProfileCompleted(
    user
  ) {

    const value =
      user?.profileCompleted ??
      user?.profile_completed;

    return (
      value === true ||
      value === 1 ||
      value === "1"
    );

  }


  /* =======================================================
     AREA SELECT
  ======================================================= */

  function populateAreas(
    subcityValue,
    selectedArea = ""
  ) {

    if (!areaInput) {
      return;
    }

    areaInput.innerHTML =
      "";

    const placeholder =
      document.createElement(
        "option"
      );

    placeholder.value =
      "";

    placeholder.textContent =
      subcityValue
        ? "Select Area"
        : "Select Sub-City first";

    areaInput.appendChild(
      placeholder
    );

    const locations =
      AREA_OPTIONS[
        String(
          subcityValue || ""
        )
          .trim()
          .toLowerCase()
      ] || [];


    locations.forEach(
      function (location) {

        const option =
          document.createElement(
            "option"
          );

        option.value =
          location.value;

        option.textContent =
          location.label;

        areaInput.appendChild(
          option
        );

      }
    );


    areaInput.disabled =
      locations.length === 0;


    if (selectedArea) {

      const normalizedArea =
        String(
          selectedArea
        )
          .trim()
          .toLowerCase();


      const matchingOption =
        Array.from(
          areaInput.options
        ).find(
          function (option) {

            return (
              option.value ===
                normalizedArea ||
              option.textContent
                .trim()
                .toLowerCase() ===
                normalizedArea
            );

          }
        );


      if (
        matchingOption
      ) {

        areaInput.value =
          matchingOption.value;

      }

    }

  }


  /* =======================================================
     ROLE-SPECIFIC UI
  ======================================================= */

  function applyRoleUI(
    role
  ) {

    const normalizedRole =
      normalizeRole(
        role
      );


    if (roleInput) {

      roleInput.value =
        roleLabel(
          normalizedRole
        );

    }


    if (ustazSection) {

      ustazSection.hidden =
        normalizedRole !==
        "ustaz";

    }

  }


  /* =======================================================
     ACTIVE CARD STATE
  ======================================================= */

  function updateInputCardState(
    input
  ) {

    if (!input) {
      return;
    }

    const card =
      input.closest(
        ".role-option"
      );

    if (!card) {
      return;
    }

    card.classList.toggle(
      "active",
      Boolean(
        input.checked
      )
    );

  }


  function initializeInputCardStates() {

    [
      ...Array.from(
        studyFieldInputs
      ),
      ...Array.from(
        studyInterestInputs
      ),
      ...Array.from(
        contentInterestInputs
      ),
      ...Array.from(
        teacherGenderPreferenceInputs
      )
    ].forEach(
      updateInputCardState
    );

  }


  /* =======================================================
     POPULATE STEP 1 FORM
  ======================================================= */

  function applyUserToForm(
    user
  ) {

    currentUser =
      user;


    existingAvatarUrl =
      user?.avatarUrl ??
      user?.avatar_url ??
      "";


    const role =
      normalizeRole(
        user?.role
      );


    applyRoleUI(
      role
    );


    if (firstNameInput) {

      firstNameInput.readOnly =
        false;

      firstNameInput.value =
        getFirstName(
          user
        );

    }


    if (lastNameInput) {

      lastNameInput.readOnly =
        false;

      lastNameInput.value =
        getLastName(
          user
        );

    }


    if (phoneInput) {

      const phone =
        getPhone(
          user
        );

      phoneInput.value =
        formatPhoneForDisplay(
          phone
        );

      phoneInput.readOnly =
        true;

      phoneInput.disabled =
        false;

    }


    if (phoneVerified) {

      phoneVerified.hidden =
        !getPhone(
          user
        );

    }


    const subcity =
      getSubcity(
        user
      );


    if (subcityInput) {

      subcityInput.value =
        String(
          subcity || ""
        )
          .trim()
          .toLowerCase();

    }


    populateAreas(
      subcity,
      getArea(
        user
      )
    );


    if (
      nearestMosqueInput
    ) {

      nearestMosqueInput.value =
        getNearestMosque(
          user
        );

    }


    if (
      role === "ustaz"
    ) {

      if (
        experienceInput
      ) {

        const experience =
          getExperience(
            user
          );

        experienceInput.value =
          experience === null ||
          experience === undefined
            ? ""
            : experience;

      }


      if (
        genderInput
      ) {

        genderInput.value =
          String(
            getGender(
              user
            ) || ""
          )
            .trim()
            .toLowerCase();

      }


      const selectedFields =
        new Set(
          getStudyFields(
            user
          )
            .map(
              function (field) {

                return String(
                  field
                )
                  .trim()
                  .toLowerCase();

              }
            )
        );


      studyFieldInputs.forEach(
        function (input) {

          input.checked =
            selectedFields.has(
              String(
                input.value
              )
                .trim()
                .toLowerCase()
            );

          updateInputCardState(
            input
          );

        }
      );

    }


    renderAvatarState();

  }


  /* =======================================================
     STEP 1 VALIDATION
  ======================================================= */

  function validateStepOne() {

    clearErrors();

    let valid =
      true;


    const firstName =
      firstNameInput?.value
        .trim() || "";

    const lastName =
      lastNameInput?.value
        .trim() || "";


    if (
      !firstName ||
      !lastName
    ) {

      setError(
        "profileNameError",
        "Enter your first and last name."
      );

      valid =
        false;

    }


    if (
      firstName &&
      firstName.length > 100
    ) {

      setError(
        "profileNameError",
        "First name is too long."
      );

      valid =
        false;

    }


    if (
      lastName &&
      lastName.length > 100
    ) {

      setError(
        "profileNameError",
        "Last name is too long."
      );

      valid =
        false;

    }


    const phone =
      normalizePhoneForSubmit(
        getPhone(
          currentUser
        ) ||
        phoneInput?.value ||
        ""
      );


    if (
      !/^2519\d{8}$/.test(
        phone
      )
    ) {

      setError(
        "profilePhoneError",
        "Your verified phone number is invalid."
      );

      valid =
        false;

    }


    const subcity =
      subcityInput?.value
        .trim()
        .toLowerCase() || "";


    if (
      !subcity
    ) {

      setError(
        "profileSubcityError",
        "Please select your sub-city."
      );

      valid =
        false;

    }


    const area =
      areaInput?.value
        .trim()
        .toLowerCase() || "";


    if (
      !area
    ) {

      setError(
        "profileAreaError",
        "Please select your area."
      );

      valid =
        false;

    }


    const nearestMosque =
      nearestMosqueInput?.value
        .trim() || "";


    if (
      !nearestMosque
    ) {

      setError(
        "profileNearestMosqueError",
        "Enter the name of your nearest mosque."
      );

      valid =
        false;

    }


    if (
      nearestMosque.length > 150
    ) {

      setError(
        "profileNearestMosqueError",
        "Nearest mosque name is too long."
      );

      valid =
        false;

    }


    const role =
      normalizeRole(
        currentUser?.role
      );


    if (
      role === "ustaz"
    ) {

      const experienceRaw =
        experienceInput?.value
          .trim() || "";


      const experience =
        Number(
          experienceRaw
        );


      const gender =
        genderInput?.value
          .trim()
          .toLowerCase() || "";


      const studyFields =
        Array.from(
          studyFieldInputs
        )
          .filter(
            function (input) {
              return input.checked;
            }
          )
          .map(
            function (input) {
              return input.value;
            }
          );


      if (
        experienceRaw === "" ||
        !Number.isInteger(
          experience
        ) ||
        experience < 0 ||
        experience > 60
      ) {

        setError(
          "profileExperienceError",
          "Enter teaching experience from 0 to 60 years."
        );

        valid =
          false;

      }


      if (
        ![
          "male",
          "female"
        ].includes(
          gender
        )
      ) {

        setError(
          "profileGenderError",
          "Please select your gender."
        );

        valid =
          false;

      }


      if (
        studyFields.length === 0
      ) {

        setError(
          "profileStudyFieldsError",
          "Select at least one study field."
        );

        valid =
          false;

      }

    }


    if (!valid) {

      scrollToFirstError(
        "#profileStepOne"
      );

    }


    return valid;

  }


  /* =======================================================
     STEP 2 VALIDATION
  ======================================================= */

  function validateStepTwo() {

    clearStepTwoErrors();

    let valid =
      true;


    const bio =
      profileBioInput?.value
        .trim() || "";


    if (
      bio.length > 500
    ) {

      setError(
        "profileBioError",
        "About you must be 500 characters or fewer."
      );

      valid =
        false;

    }


    const selectedStudyInterests =
      getCheckedValues(
        studyInterestInputs
      );


    const invalidStudyInterest =
      selectedStudyInterests.find(
        function (value) {

          return !ALLOWED_STUDY_INTERESTS.has(
            value
          );

        }
      );


    if (
      invalidStudyInterest
    ) {

      setError(
        "profileStudyInterestsError",
        "One or more study interests are invalid."
      );

      valid =
        false;

    }


    const selectedContentInterests =
      getCheckedValues(
        contentInterestInputs
      );


    const invalidContentInterest =
      selectedContentInterests.find(
        function (value) {

          return !ALLOWED_CONTENT_INTERESTS.has(
            value
          );

        }
      );


    if (
      invalidContentInterest
    ) {

      setError(
        "profileContentInterestsError",
        "One or more Islamic content interests are invalid."
      );

      valid =
        false;

    }


    const teacherPreference =
      getSelectedRadioValue(
        teacherGenderPreferenceInputs
      );


    if (
      !ALLOWED_TEACHER_GENDER_PREFERENCES.has(
        teacherPreference
      )
    ) {

      setError(
        "profileTeacherGenderError",
        "Please select a valid teacher preference."
      );

      valid =
        false;

    }


    if (
      profilePhotoFile
    ) {

      if (
        !ALLOWED_PROFILE_PHOTO_TYPES.has(
          profilePhotoFile.type
        )
      ) {

        setError(
          "profilePhotoError",
          "Profile photo must be JPG, PNG, or WebP."
        );

        valid =
          false;

      } else if (
        profilePhotoFile.size >
        MAX_PROFILE_PHOTO_BYTES
      ) {

        setError(
          "profilePhotoError",
          "Profile photo must be 5 MB or smaller."
        );

        valid =
          false;

      }

    }


    if (!valid) {

      scrollToFirstError(
        "#profileStepTwo"
      );

    }


    return valid;

  }


  function scrollToFirstError(
    scopeSelector
  ) {

    const scope =
      document.querySelector(
        scopeSelector
      ) ||
      document;


    const firstError =
      scope.querySelector(
        ".form-error:not(:empty)"
      );


    if (
      firstError
    ) {

      firstError.scrollIntoView({
        behavior:
          "smooth",

        block:
          "center"
      });

    }

  }


  /* =======================================================
     CHECKED INPUT HELPERS
  ======================================================= */

  function getCheckedValues(
    inputs
  ) {

    return Array.from(
      inputs || []
    )
      .filter(
        function (input) {
          return input.checked;
        }
      )
      .map(
        function (input) {

          return String(
            input.value || ""
          )
            .trim()
            .toLowerCase();

        }
      )
      .filter(Boolean);

  }


  function getSelectedRadioValue(
    inputs
  ) {

    const selected =
      Array.from(
        inputs || []
      )
        .find(
          function (input) {
            return input.checked;
          }
        );


    return selected
      ? String(
          selected.value || ""
        )
          .trim()
          .toLowerCase()
      : "";

  }


  /* =======================================================
     STEP UI
  ======================================================= */

  function setStep(
    step
  ) {

    const normalizedStep =
      Number(step) === 2
        ? 2
        : 1;


    currentStep =
      normalizedStep;


    const isStepOne =
      normalizedStep === 1;


    if (stepOne) {

      stepOne.hidden =
        !isStepOne;

    }


    if (stepTwo) {

      stepTwo.hidden =
        isStepOne;

    }


    if (stepTitle) {

      stepTitle.textContent =
        isStepOne
          ? "Your information"
          : "Personalize your learning";

    }


    if (stepDescription) {

      stepDescription.textContent =
        isStepOne
          ? "Review your account information and complete the required details."
          : "Tell us what you are interested in so we can personalize your BarakaLink learning experience.";

    }


    if (progressNumber) {

      progressNumber.textContent =
        isStepOne
          ? "1 of 2"
          : "2 of 2";

    }


    if (backButton) {

      backButton.hidden =
        isStepOne;

    }


    if (saveButtonText) {

      saveButtonText.textContent =
        isStepOne
          ? "Save & Continue"
          : "Complete Profile";

    }


    if (saveButtonIcon) {

      saveButtonIcon.className =
        isStepOne
          ? "fa-solid fa-arrow-right"
          : "fa-solid fa-check";

    }


    if (completionNote) {

      completionNote.textContent =
        isStepOne
          ? "Your profile must be completed before you can access your BarakaLink dashboard."
          : "Your preferences can be updated later from your profile.";

    }


    clearErrors();


    if (!isStepOne) {

      updateBioCounter();


      window.requestAnimationFrame(
        function () {

          if (
            profileBioInput
          ) {

            profileBioInput.focus();

          }

        }
      );

    } else {

      window.requestAnimationFrame(
        function () {

          if (
            firstNameInput
          ) {

            firstNameInput.focus();

          }

        }
      );

    }


    window.scrollTo({
      top:
        0,

      behavior:
        "smooth"
    });

  }


  /* =======================================================
     STEP 1 SAVE
  ======================================================= */

  async function saveStepOne() {

    if (
      submitting
    ) {

      return;

    }


    if (
      !validateStepOne()
    ) {

      return;

    }


    if (
      !window.BarakaLinkAPI
    ) {

      setStatus(
        "BarakaLink API is not available.",
        "error"
      );

      return;

    }


    const token =
      getToken();


    if (!token) {

      logout();

      return;

    }


    submitting =
      true;


    const originalButtonHTML =
      saveButton?.innerHTML ||
      "";


    if (
      saveButton
    ) {

      saveButton.disabled =
        true;

      saveButton.innerHTML =
        `
          Saving...
          <i class="fa-solid fa-spinner fa-spin"></i>
        `;

    }


    setStatus(
      "Saving your information...",
      "loading"
    );


    const role =
      normalizeRole(
        currentUser?.role
      );


    const payload = {

      firstName:
        firstNameInput?.value
          .trim() ||
        "",

      lastName:
        lastNameInput?.value
          .trim() ||
        "",

      /*
       * Phone is used only for backend consistency validation.
       * Authentication identity remains the JWT user.
       */
      phone:
        normalizePhoneForSubmit(
          getPhone(
            currentUser
          ) ||
          phoneInput?.value ||
          ""
        ),

      subcity:
        subcityInput?.value
          .trim()
          .toLowerCase() ||
        "",

      area:
        areaInput?.value
          .trim()
          .toLowerCase() ||
        "",

      nearestMosque:
        nearestMosqueInput?.value
          .trim() ||
        ""

    };


    if (
      role === "ustaz"
    ) {

      payload.experience =
        Number(
          experienceInput?.value ||
          0
        );


      payload.gender =
        genderInput?.value
          .trim()
          .toLowerCase() ||
        "";


      payload.studyFields =
        Array.from(
          studyFieldInputs
        )
          .filter(
            function (input) {
              return input.checked;
            }
          )
          .map(
            function (input) {
              return input.value;
            }
          );

    }


    try {

      const response =
        await window.BarakaLinkAPI.patch(
          PROFILE_ENDPOINT,
          payload
        );


      if (
        !response?.success
      ) {

        const error =
          new Error(
            response?.message ||
            "Unable to save your information."
          );

        error.status =
          response?.status;

        throw error;

      }


      setStatus(
        "Your information has been saved.",
        "success"
      );


      /*
       * Refresh from GET /api/profile, not /auth/me.
       *
       * This endpoint is now the complete profile source for this
       * page and includes avatarUrl, student/teacher data, and
       * studyFields.
       */
      try {

        const refreshed =
          await window.BarakaLinkAPI.get(
            PROFILE_ENDPOINT
          );


        if (
          refreshed?.success
        ) {

          const refreshedUser =
            extractUser(
              refreshed
            );


          if (
            refreshedUser
          ) {

            currentUser =
              refreshedUser;

            applyUserToForm(
              refreshedUser
            );

          }

        }

      } catch (refreshError) {

        console.warn(
          "Unable to refresh profile after Step 1 save:",
          refreshError
        );

      }


      submitting =
        false;


      if (
        saveButton
      ) {

        saveButton.disabled =
          false;

        saveButton.innerHTML =
          originalButtonHTML ||
          `
            <span id="profileSaveButtonText">
              Save &amp; Continue
            </span>

            <i
              class="fa-solid fa-arrow-right"
              id="profileSaveButtonIcon"
            ></i>
          `;

      }


      /*
       * Step 1 MUST stay on this page.
       */
      setStep(
        2
      );


    } catch (error) {

      console.error(
        "Profile Step 1 save error:",
        error
      );


      if (
        error?.status === 401
      ) {

        logout();

        return;

      }


      setStatus(
        error?.message ||
        "Unable to save your information. Please try again.",
        "error"
      );


      if (
        saveButton
      ) {

        saveButton.disabled =
          false;

        saveButton.innerHTML =
          originalButtonHTML ||
          `
            <span id="profileSaveButtonText">
              Save &amp; Continue
            </span>

            <i
              class="fa-solid fa-arrow-right"
              id="profileSaveButtonIcon"
            ></i>
          `;

      }


      submitting =
        false;

    }

  }


  /* =======================================================
     STEP 2 PAYLOAD
  ======================================================= */

  function collectStepTwoData() {

    const bio =
      profileBioInput?.value
        .trim() ||
      "";


    const studyInterests =
      getCheckedValues(
        studyInterestInputs
      );


    const contentInterests =
      getCheckedValues(
        contentInterestInputs
      );


    const preferredTeacherGender =
      getSelectedRadioValue(
        teacherGenderPreferenceInputs
      ) ||
      "no-preference";


    return {

      bio,

      studyInterests,

      contentInterests,

      preferredTeacherGender

    };

  }


  /* =======================================================
     STEP 2 SAVE
  ======================================================= */

  async function saveStepTwo() {

    if (
      submitting
    ) {

      return;

    }


    if (
      !validateStepTwo()
    ) {

      return;

    }


    if (
      !window.BarakaLinkAPI
    ) {

      setStatus(
        "BarakaLink API is not available.",
        "error"
      );

      return;

    }


    const token =
      getToken();


    if (!token) {

      logout();

      return;

    }


    submitting =
      true;


    const originalButtonHTML =
      saveButton?.innerHTML ||
      "";


    if (
      saveButton
    ) {

      saveButton.disabled =
        true;

      saveButton.innerHTML =
        `
          Saving...
          <i class="fa-solid fa-spinner fa-spin"></i>
        `;

    }


    const preferences =
      collectStepTwoData();


    try {

      /*
       * Required sequence:
       *
       * 1. Validate Step 2
       * 2. Verify authentication
       * 3. Upload selected photo, if any
       * 4. Save preferences
       * 5. Require profileCompleted=true
       * 6. Redirect to dashboard
       */


      if (
        profilePhotoFile
      ) {

        setStatus(
          "Uploading your profile photo...",
          "loading"
        );


        const uploadResponse =
          await uploadProfilePhotoFile(
            profilePhotoFile
          );


        if (
          !uploadResponse?.success
        ) {

          const uploadError =
            new Error(
              uploadResponse?.message ||
              "Unable to upload your profile photo."
            );

          uploadError.stage =
            "photo";

          throw uploadError;

        }


        existingAvatarUrl =
          uploadResponse?.data?.avatarUrl ||
          "";


        clearLocalPhotoSelection();

        renderAvatarState();

      }


      setStatus(
        "Saving your preferences...",
        "loading"
      );


      const response =
        await window.BarakaLinkAPI.patch(
          PREFERENCES_ENDPOINT,
          preferences
        );


      if (
        !response?.success
      ) {

        const preferencesError =
          new Error(
            response?.message ||
            "Unable to save your preferences."
          );

        preferencesError.stage =
          "preferences";

        preferencesError.status =
          response?.status;

        throw preferencesError;

      }


      const responseProfileCompleted =
        response?.data?.profileCompleted;


      const completed =
        responseProfileCompleted === true ||
        responseProfileCompleted === 1 ||
        responseProfileCompleted === "1";


      if (
        !completed
      ) {

        const incompleteError =
          new Error(
            "The server did not confirm that your profile is complete."
          );

        incompleteError.stage =
          "preferences";

        throw incompleteError;

      }


      setStatus(
        "Your profile has been completed successfully.",
        "success"
      );


      if (
        saveButton
      ) {

        saveButton.innerHTML =
          `
            Completed
            <i class="fa-solid fa-circle-check"></i>
          `;

      }


      releasePhotoObjectUrl();


      window.setTimeout(
        function () {

          window.location.replace(
            dashboardForRole(
              currentUser?.role
            )
          );

        },
        300
      );


    } catch (error) {

      console.error(
        "Profile Step 2 save error:",
        error
      );


      if (
        error?.status === 401
      ) {

        logout();

        return;

      }


      if (
        error?.stage === "photo"
      ) {

        if (
          error?.status === 413
        ) {

          setError(
            "profilePhotoError",
            "Profile photo must be 5 MB or smaller."
          );

        } else {

          setError(
            "profilePhotoError",
            error?.message ||
            "Unable to upload your profile photo."
          );

        }

      }


      if (
        error?.stage === "preferences"
      ) {

        if (
          error?.status === 404
        ) {

          setStatus(
            "Your preferences are ready, but the Step 2 server endpoint is not available yet.",
            "error"
          );

        } else {

          setStatus(
            error?.message ||
            "Unable to save your preferences. Please try again.",
            "error"
          );

        }

      }


      if (
        !error?.stage
      ) {

        if (
          error?.status === 413
        ) {

          setError(
            "profilePhotoError",
            "Profile photo must be 5 MB or smaller."
          );

          setStatus(
            "Unable to upload your profile photo. Please try again.",
            "error"
          );

        } else {

          setStatus(
            error?.message ||
            "Unable to complete your profile. Please try again.",
            "error"
          );

        }

      }


      if (
        saveButton
      ) {

        saveButton.disabled =
          false;

        saveButton.innerHTML =
          originalButtonHTML ||
          `
            <span id="profileSaveButtonText">
              Complete Profile
            </span>

            <i
              class="fa-solid fa-check"
              id="profileSaveButtonIcon"
            ></i>
          `;

      }


      submitting =
        false;

    }

  }


  /* =======================================================
     AVATAR URL RESOLUTION
  ======================================================= */

  function computeApiOrigin(
    base
  ) {

    try {

      return new URL(
        base,
        window.location.origin
      ).origin;

    } catch (error) {

      console.warn(
        "Unable to resolve API origin:",
        error
      );

      return window.location.origin;

    }

  }


  function resolveAvatarUrl(
    avatarUrl
  ) {

    const value =
      String(
        avatarUrl || ""
      ).trim();


    if (!value) {

      return "";

    }


    if (
      /^https?:\/\//i.test(
        value
      )
    ) {

      return value;

    }


    if (
      value.startsWith("/")
    ) {

      return `${API_ORIGIN}${value}`;

    }


    return `${API_ORIGIN}/${value}`;

  }


  /* =======================================================
     PHOTO PREVIEW / AVATAR RENDERING
  ======================================================= */

  function releasePhotoObjectUrl() {

    if (
      profilePhotoObjectUrl
    ) {

      try {

        URL.revokeObjectURL(
          profilePhotoObjectUrl
        );

      } catch (error) {

        console.warn(
          "Unable to release profile photo object URL:",
          error
        );

      }


      profilePhotoObjectUrl =
        null;

    }

  }


  function clearLocalPhotoSelection() {

    profilePhotoFile =
      null;


    releasePhotoObjectUrl();


    if (
      profilePhotoInput
    ) {

      profilePhotoInput.value =
        "";

    }

  }


  function resetPhotoPreview() {

    clearLocalPhotoSelection();

    existingAvatarUrl =
      "";

    showPhotoPlaceholder();

  }


  function showPhotoPlaceholder() {

    if (
      profilePhotoPreview
    ) {

      profilePhotoPreview.onload =
        null;

      profilePhotoPreview.onerror =
        null;

      profilePhotoPreview.hidden =
        true;

      profilePhotoPreview.removeAttribute(
        "src"
      );

    }


    if (
      profilePhotoPlaceholder
    ) {

      profilePhotoPlaceholder.hidden =
        false;

    }


    if (
      profilePhotoRemoveButton
    ) {

      profilePhotoRemoveButton.hidden =
        true;

    }

  }


  function showPhotoPreview(
    src,
    isRemote
  ) {

    if (!src) {

      showPhotoPlaceholder();

      return;

    }


    if (
      profilePhotoPreview
    ) {

      profilePhotoPreview.onload =
        function () {

          profilePhotoPreview.hidden =
            false;

        };


      profilePhotoPreview.onerror =
        isRemote
          ? handleAvatarLoadError
          : null;


      profilePhotoPreview.src =
        src;

      profilePhotoPreview.hidden =
        false;

    }


    if (
      profilePhotoPlaceholder
    ) {

      profilePhotoPlaceholder.hidden =
        true;

    }


    if (
      profilePhotoRemoveButton
    ) {

      profilePhotoRemoveButton.hidden =
        false;

    }

  }


  function handleAvatarLoadError() {

    existingAvatarUrl =
      "";

    showPhotoPlaceholder();

  }


  function renderAvatarState() {

    /*
     * Local selection takes visual priority.
     */
    if (
      profilePhotoFile &&
      profilePhotoObjectUrl
    ) {

      showPhotoPreview(
        profilePhotoObjectUrl,
        false
      );

      return;

    }


    /*
     * Otherwise display the server-saved photo.
     */
    if (
      existingAvatarUrl
    ) {

      showPhotoPreview(
        resolveAvatarUrl(
          existingAvatarUrl
        ),
        true
      );

      return;

    }


    showPhotoPlaceholder();

  }


  function handlePhotoSelected(
    file
  ) {

    clearStepTwoErrors();


    if (!file) {

      return;

    }


    if (
      !ALLOWED_PROFILE_PHOTO_TYPES.has(
        file.type
      )
    ) {

      clearLocalPhotoSelection();

      renderAvatarState();

      setError(
        "profilePhotoError",
        "Please choose a JPG, PNG, or WebP image."
      );

      return;

    }


    if (
      file.size >
      MAX_PROFILE_PHOTO_BYTES
    ) {

      clearLocalPhotoSelection();

      renderAvatarState();

      setError(
        "profilePhotoError",
        "Profile photo must be 5 MB or smaller."
      );

      return;

    }


    profilePhotoFile =
      file;


    releasePhotoObjectUrl();


    try {

      profilePhotoObjectUrl =
        URL.createObjectURL(
          file
        );


      renderAvatarState();

    } catch (error) {

      console.error(
        "Profile photo preview failed:",
        error
      );


      clearLocalPhotoSelection();

      renderAvatarState();


      setError(
        "profilePhotoError",
        "The selected image could not be previewed."
      );

    }

  }


  /* =======================================================
     PHOTO UPLOAD / REMOVE
  ======================================================= */

  async function uploadProfilePhotoFile(
    file
  ) {

    const token =
      getToken();


    if (!token) {

      const error =
        new Error(
          "Not authenticated."
        );

      error.status =
        401;

      error.stage =
        "photo";

      throw error;

    }


    if (!file) {

      const error =
        new Error(
          "No profile photo was selected."
        );

      error.stage =
        "photo";

      throw error;

    }


    if (
      !ALLOWED_PROFILE_PHOTO_TYPES.has(
        file.type
      )
    ) {

      const error =
        new Error(
          "Profile photo must be JPG, PNG, or WebP."
        );

      error.status =
        400;

      error.stage =
        "photo";

      throw error;

    }


    if (
      file.size >
      MAX_PROFILE_PHOTO_BYTES
    ) {

      const error =
        new Error(
          "Profile photo must be 5 MB or smaller."
        );

      error.status =
        413;

      error.stage =
        "photo";

      throw error;

    }


    const formData =
      new FormData();


    formData.append(
      "profilePhoto",
      file
    );


    /*
     * Do NOT set Content-Type manually.
     *
     * The browser must generate:
     * multipart/form-data; boundary=...
     */
    const response =
      await fetch(
        `${API_BASE}${PHOTO_ENDPOINT}`,
        {
          method:
            "POST",

          headers: {
            Authorization:
              `Bearer ${token}`,

            Accept:
              "application/json"
          },

          body:
            formData
        }
      );


    let data =
      {};


    try {

      data =
        await response.json();

    } catch (parseError) {

      data =
        {};

    }


    if (
      !response.ok
    ) {

      const error =
        new Error(
          data?.message ||
          "Unable to upload your profile photo."
        );

      error.status =
        response.status;

      error.stage =
        "photo";

      throw error;

    }


    return data;

  }


  async function deleteProfilePhotoRequest() {

    if (
      window.BarakaLinkAPI &&
      typeof window.BarakaLinkAPI.delete ===
        "function"
    ) {

      return window.BarakaLinkAPI.delete(
        PHOTO_ENDPOINT
      );

    }


    const token =
      getToken();


    if (!token) {

      const error =
        new Error(
          "Not authenticated."
        );

      error.status =
        401;

      throw error;

    }


    const response =
      await fetch(
        `${API_BASE}${PHOTO_ENDPOINT}`,
        {
          method:
            "DELETE",

          headers: {
            Authorization:
              `Bearer ${token}`,

            Accept:
              "application/json"
          }
        }
      );


    let data =
      {};


    try {

      data =
        await response.json();

    } catch (parseError) {

      data =
        {};

    }


    if (
      !response.ok
    ) {

      const error =
        new Error(
          data?.message ||
          "Unable to remove your profile photo."
        );

      error.status =
        response.status;

      throw error;

    }


    return data;

  }


  async function removeSavedPhoto() {

    if (
      !window.BarakaLinkAPI
    ) {

      setError(
        "profilePhotoError",
        "BarakaLink API is not available."
      );

      return;

    }


    const token =
      getToken();


    if (!token) {

      logout();

      return;

    }


    if (
      profilePhotoRemoveButton
    ) {

      profilePhotoRemoveButton.disabled =
        true;

    }


    setStatus(
      "Removing your profile photo...",
      "loading"
    );


    try {

      const response =
        await deleteProfilePhotoRequest();


      if (
        !response?.success
      ) {

        const error =
          new Error(
            response?.message ||
            "Unable to remove your profile photo."
          );

        error.status =
          response?.status;

        throw error;

      }


      resetPhotoPreview();


      setStatus(
        "Your profile photo has been removed.",
        "success"
      );


    } catch (error) {

      console.error(
        "Profile photo removal error:",
        error
      );


      if (
        error?.status === 401
      ) {

        logout();

        return;

      }


      setError(
        "profilePhotoError",
        error?.message ||
        "Unable to remove your profile photo. Please try again."
      );


      setStatus(
        ""
      );


    } finally {

      if (
        profilePhotoRemoveButton
      ) {

        profilePhotoRemoveButton.disabled =
          false;

      }

    }

  }


  async function handleRemovePhotoClick() {

    if (
      submitting
    ) {

      return;

    }


    setError(
      "profilePhotoError",
      ""
    );


    /*
     * A local selection that has not been uploaded:
     * remove only the browser preview.
     */
    if (
      profilePhotoFile
    ) {

      clearLocalPhotoSelection();

      renderAvatarState();

      return;

    }


    /*
     * A saved server photo:
     * remove it through the backend.
     */
    if (
      existingAvatarUrl
    ) {

      await removeSavedPhoto();

      return;

    }


    resetPhotoPreview();

  }


  /* =======================================================
     BIO COUNTER
  ======================================================= */

  function updateBioCounter() {

    if (
      !profileBioInput ||
      !profileBioCount
    ) {

      return;

    }


    const length =
      String(
        profileBioInput.value ||
        ""
      ).length;


    profileBioCount.textContent =
      String(
        Math.min(
          length,
          500
        )
      );

  }


  /* =======================================================
     STEP 2 DATA INITIALIZATION
  ======================================================= */

  function initializeStepTwo() {

    updateBioCounter();

    initializeInputCardStates();

    renderAvatarState();

  }


  /* =======================================================
     LOAD CURRENT PROFILE
  ======================================================= */

  async function loadCurrentUser() {

    const token =
      getToken();


    if (!token) {

      logout();

      return;

    }


    setStatus(
      "Loading your information...",
      "loading"
    );


    try {

      if (
        !window.BarakaLinkAPI
      ) {

        throw new Error(
          "BarakaLink API is not available."
        );

      }


      /*
       * IMPORTANT:
       *
       * Profile completion uses GET /api/profile as the
       * authoritative profile endpoint.
       *
       * It returns:
       *   data.user
       *   data.student
       *   data.teacherProfile
       *   data.studyFields
       *
       * and now includes:
       *   data.user.avatarUrl
       */
      const response =
        await window.BarakaLinkAPI.get(
          PROFILE_ENDPOINT
        );


      if (
        !response?.success
      ) {

        const error =
          new Error(
            response?.message ||
            "Unable to load your account information."
          );

        error.status =
          response?.status;

        throw error;

      }


      const user =
        extractUser(
          response
        );


      if (!user) {

        throw new Error(
          "The server returned an incomplete user profile."
        );

      }


      if (
        isProfileCompleted(
          user
        )
      ) {

        window.location.replace(
          dashboardForRole(
            user.role
          )
        );

        return;

      }


      applyUserToForm(
        user
      );


      initializeStepTwo();


      setStep(
        1
      );


      setStatus(
        ""
      );


    } catch (error) {

      console.error(
        "Unable to load current BarakaLink profile:",
        error
      );


      if (
        error?.status === 401
      ) {

        logout();

        return;

      }


      setStatus(
        error?.message ||
        "We could not load your registration information. Please try again.",
        "error"
      );

    }

  }


  /* =======================================================
     SUB-CITY CHANGE
  ======================================================= */

  if (
    subcityInput
  ) {

    subcityInput.addEventListener(
      "change",
      function () {

        populateAreas(
          subcityInput.value,
          ""
        );


        setError(
          "profileSubcityError",
          ""
        );


        setError(
          "profileAreaError",
          ""
        );

      }
    );

  }


  /* =======================================================
     STEP 1 STUDY FIELD VISUAL STATE
  ======================================================= */

  studyFieldInputs.forEach(
    function (input) {

      input.addEventListener(
        "change",
        function () {

          updateInputCardState(
            input
          );

        }
      );

    }
  );


  /* =======================================================
     STEP 2 STUDY INTEREST VISUAL STATE
  ======================================================= */

  studyInterestInputs.forEach(
    function (input) {

      input.addEventListener(
        "change",
        function () {

          updateInputCardState(
            input
          );

        }
      );

    }
  );


  /* =======================================================
     STEP 2 CONTENT INTEREST VISUAL STATE
  ======================================================= */

  contentInterestInputs.forEach(
    function (input) {

      input.addEventListener(
        "change",
        function () {

          updateInputCardState(
            input
          );

        }
      );

    }
  );


  /* =======================================================
     STEP 2 TEACHER GENDER VISUAL STATE
  ======================================================= */

  teacherGenderPreferenceInputs.forEach(
    function (input) {

      input.addEventListener(
        "change",
        function () {

          teacherGenderPreferenceInputs.forEach(
            function (radio) {

              updateInputCardState(
                radio
              );

            }
          );

        }
      );

    }
  );


  /* =======================================================
     PHOTO CHOOSE BUTTON
  ======================================================= */

  if (
    profilePhotoChangeButton &&
    profilePhotoInput
  ) {

    profilePhotoChangeButton.addEventListener(
      "click",
      function () {

        profilePhotoInput.click();

      }
    );

  }


  /* =======================================================
     PHOTO INPUT
  ======================================================= */

  if (
    profilePhotoInput
  ) {

    profilePhotoInput.addEventListener(
      "change",
      function () {

        const file =
          profilePhotoInput.files?.[0] ||
          null;


        handlePhotoSelected(
          file
        );

      }
    );

  }


  /* =======================================================
     PHOTO REMOVE
  ======================================================= */

  if (
    profilePhotoRemoveButton
  ) {

    profilePhotoRemoveButton.addEventListener(
      "click",
      handleRemovePhotoClick
    );

  }


  /* =======================================================
     BIO COUNTER
  ======================================================= */

  if (
    profileBioInput
  ) {

    profileBioInput.addEventListener(
      "input",
      updateBioCounter
    );

  }


  /* =======================================================
     BACK BUTTON
  ======================================================= */

  if (
    backButton
  ) {

    backButton.addEventListener(
      "click",
      function () {

        if (
          submitting
        ) {

          return;

        }


        setStep(
          1
        );

      }
    );

  }


  /* =======================================================
     FORM SUBMIT
  ======================================================= */

  if (
    form
  ) {

    form.addEventListener(
      "submit",
      function (event) {

        event.preventDefault();


        if (
          currentStep === 1
        ) {

          saveStepOne();

          return;

        }


        if (
          currentStep === 2
        ) {

          saveStepTwo();

        }

      }
    );

  }


  /* =======================================================
     LOGOUT
  ======================================================= */

  if (
    logoutButton
  ) {

    logoutButton.addEventListener(
      "click",
      logout
    );

  }


  if (
    headerLogoutButton
  ) {

    headerLogoutButton.addEventListener(
      "click",
      logout
    );

  }


  /* =======================================================
     INITIALIZATION
  ======================================================= */

  async function init() {

    if (
      !form
    ) {

      return;

    }


    if (
      firstNameInput
    ) {

      firstNameInput.readOnly =
        false;

    }


    if (
      lastNameInput
    ) {

      lastNameInput.readOnly =
        false;

    }


    if (
      phoneInput
    ) {

      phoneInput.readOnly =
        true;

    }


    if (
      profileBioInput
    ) {

      profileBioInput.maxLength =
        500;

    }


    showPhotoPlaceholder();


    await loadCurrentUser();

  }


  if (
    document.readyState ===
    "loading"
  ) {

    document.addEventListener(
      "DOMContentLoaded",
      init
    );

  } else {

    init();

  }


  /* =======================================================
     PUBLIC DEBUG / CONTROL API
  ======================================================= */

  window.BarakaLinkProfileCompletion = {

    load:
      loadCurrentUser,

    save:
      function () {

        if (
          currentStep === 1
        ) {

          return saveStepOne();

        }

        return saveStepTwo();

      },

    saveStepOne,

    saveStepTwo,

    goToStep:
      setStep,

    logout

  };


})();