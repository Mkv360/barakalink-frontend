"use strict";

/* =========================================================
BARAKALINK
USTAZ PROFILE COMPLETION
========================

PAGE 1
* Loads the authenticated Ustaz account
* Reads the backend response:
  data.user
  data.teacherProfile
  data.studyFields
* Also supports:
  data.user.teacherProfile
  data.user.teacherProfile.studyFields

PAGE 2
* Profile photo
* Date of birth
* Bio
* Languages

PAGE 3
* Teaching approach
* Lesson duration
* Lesson format
* Current platform: IN-PERSON ONLY

PAGE 4
* Qur'an recitation recorder
* Recitation title
* Recitation description
* Qualifications

PAGE 5
* Fayda National ID

PAGE 6
* Private identity selfie
* Submit profile for manual admin review



CURRENT LESSON FORMAT RULE
* In-person is the only available lesson format.
* Online is disabled.
* Online & in-person is disabled.

========================================================= */


/* =========================================================
CONFIGURATION
========================================================= */
const USTAZ_PROFILE_CONFIG = Object.freeze({

  PROFILE_ENDPOINT:
    "/profile",

  COMPLETION_ENDPOINT:
    window.BARAKALINK_USTAZ_PROFILE_ENDPOINT ||
    "/profile/complete",

  DRAFT_KEY:
    "barakalink_ustaz_profile_draft",

  PAGE_KEY:
    "barakalink_ustaz_profile_page",

  MAX_PHOTO_SIZE:
    5 * 1024 * 1024,

  MAX_AUDIO_SIZE:
    25 * 1024 * 1024,

  MAX_FAYDA_IMAGE_SIZE:
    8 * 1024 * 1024,

  MAX_SELFIE_SIZE:
    5 * 1024 * 1024,

  PHOTO_TYPES: [
    "image/jpeg",
    "image/png",
    "image/webp"
  ],

  FAYDA_IMAGE_TYPES: [
    "image/jpeg",
    "image/png",
    "image/webp"
  ],

  SELFIE_TYPES: [
    "image/jpeg",
    "image/png",
    "image/webp"
  ],

  AUDIO_TYPES: [
    "audio/mpeg",
    "audio/wav",
    "audio/ogg",
    "audio/mp4",
    "audio/x-m4a",
    "audio/aac",
    "audio/webm"
  ],

  MAX_BIO_LENGTH:
    1500

});

/* =========================================================
CURRENT PLATFORM RULES
========================================================= */

const USTAZ_LESSON_FORMAT = "in-person";


/* =========================================================
STATE
========================================================= */

const state = {

  page:
    1,

  profile:
    null,

  user:
    null,

  teacherProfile:
    null,

  studyFields:
    [],
  photoFile:
    null,

  selfieFile:
    null,

  selfieStream:
    null,

  selfieCameraActive:
    false,

  /* Live selfie modal lifecycle and unconfirmed capture. */
  selfieCameraRequestId:
    0,

  selfieStarting:
    false,

  selfieCapturing:
    false,

  selfiePendingFile:
    null,

  selfiePendingObjectUrl:
    "",

  selfieModalOpen:
    false,

  selfieModalOpener:
    null,

  selfieModalPreviousOverflow:
    "",

  faydaFrontFile:
    null,

  faydaBackFile:
    null,

  audioFile:
    null,

  audioPlaybackUrl:
    "",

  recordingChunks:
    [],

  recordingMimeType:
    "",

  mediaRecorder:
    null,

  microphoneRequestInProgress:
    false,

  recordingSessionActive:
    false,

  mediaStream:
    null,

  recordingTimerId:
    null,

  recordingStartedAt:
    0,

  qualificationCounter:
    1,

  submitting:
    false,

  reviewStatus:
    "",

  reviewRejectionReason:
    ""

};


/* =========================================================
DOM HELPERS
========================================================= */

function $(id) {

  return document.getElementById(id);

}


function $$(selector, root = document) {

  return Array.from(
    root.querySelectorAll(selector)
  );

}


function safeString(value, fallback = "") {

  if (
    value === null ||
    value === undefined
  ) {

    return fallback;

  }

  const text =
    String(value).trim();

  return text || fallback;

}


/* =========================================================
TOKEN
========================================================= */

function getToken() {

  if (
    window.BarakaLinkAPI &&
    typeof window.BarakaLinkAPI.getToken ===
      "function"
  ) {

    const token =
      window.BarakaLinkAPI.getToken();

    if (token) {
      return token;
    }

  }

  return (
    localStorage.getItem(
      "barakalink_token"
    ) ||
    localStorage.getItem(
      "token"
    )
  );

}


/* =========================================================
SESSION
========================================================= */

function clearSession() {

  localStorage.removeItem(
    "barakalink_token"
  );

  localStorage.removeItem(
    "token"
  );

  localStorage.removeItem(
    "barakalink_user"
  );

}


function redirectToLogin() {

  clearSession();

  window.location.replace(
    "login.html"
  );

}


function redirectToDashboard() {

  /*
   * Build the dashboard URL relative to the current page.
   * This avoids issues with the current URL path.
   */

  const dashboardUrl =
    new URL(
      "dashboard/teacher.html",
      window.location.href
    ).href;


  console.info(
    "[BarakaLink][Ustaz Profile] Redirecting to dashboard:",
    dashboardUrl
  );


  window.location.replace(
    dashboardUrl
  );

}


/* =========================================================
API PROFILE LOADING
========================================================= */

async function loadCurrentProfile() {

  if (
    !window.BarakaLinkAPI ||
    typeof window.BarakaLinkAPI.get !==
      "function"
  ) {

    throw new Error(
      "BarakaLink API is not available."
    );

  }

  const response =
    await window.BarakaLinkAPI.get(
      USTAZ_PROFILE_CONFIG.PROFILE_ENDPOINT
    );

  const apiData =
    response?.data || {};

  const user =
    apiData.user || null;

  if (!user) {

    throw new Error(
      "Your BarakaLink account information could not be loaded."
    );

  }

  const role =
    safeString(
      user.role
    ).toLowerCase();

  if (
    role !== "ustaz"
  ) {

    throw new Error(
      "This page is only available for Ustaz / Ustaza accounts."
    );

  }

  /*
   * Current backend:
   * response.data.teacherProfile
   *
   * Future nested:
   * response.data.user.teacherProfile
   */

  const teacherProfile =
    user.teacherProfile ||
    apiData.teacherProfile ||
    null;

  /*
   * Current backend:
   * response.data.studyFields
   *
   * Future nested:
   * response.data.user.teacherProfile.studyFields
   */

  const studyFields =
    teacherProfile?.studyFields ||
    apiData.studyFields ||
    [];

  if (!teacherProfile) {

    console.error(
      "[BarakaLink][Ustaz Profile] Backend returned no teacher profile.",
      {
        user,
        apiData
      }
    );

    throw new Error(
      "Your Ustaz teaching profile could not be found."
    );

  }

  state.user =
    user;

  state.teacherProfile =
    teacherProfile;

  state.studyFields =
    Array.isArray(studyFields)
      ? studyFields
      : [];

  state.profile = {

    user,

    teacherProfile,

    studyFields:
      state.studyFields

  };

  console.debug(
    "[BarakaLink][Ustaz Profile] Registration profile loaded:",
    {
      userId:
        user.id,

      role:
        user.role,

      firstName:
        user.firstName ??
        user.first_name,

      lastName:
        user.lastName ??
        user.last_name,

      phone:
        user.phone,

      teacherProfile,

      studyFieldCount:
        state.studyFields.length,

      studyFields:
        state.studyFields
    }
  );

  return state.profile;

}


/* =========================================================
BASIC VALUE SETTER
========================================================= */

function setValue(id, value) {

  const element =
    $(id);

  if (!element) {

    console.warn(
      `[BarakaLink][Ustaz Profile] Element #${id} not found.`
    );

    return;

  }

  element.value =
    safeString(value);

}


/* =========================================================
LOCATION FORMAT
========================================================= */

function formatLocation(value) {

  const text =
    safeString(value);

  if (!text) {
    return "";
  }

  return text
    .replace(/[-_]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map(
      word =>
        word.charAt(0).toUpperCase() +
        word.slice(1).toLowerCase()
    )
    .join(" ");

}


/* =========================================================
GENDER FORMAT
========================================================= */

function formatGender(value) {

  const gender =
    safeString(value)
      .toLowerCase();

  if (gender === "male") {
    return "Male";
  }

  if (gender === "female") {
    return "Female";
  }

  return safeString(value);

}


/* =========================================================
PHONE DISPLAY
========================================================= */

function formatPhoneDisplay(value) {

  const digits =
    safeString(value)
      .replace(/\D/g, "");

  if (digits.length !== 9) {
    return digits;
  }

  return (
    digits.slice(0, 3) +
    " " +
    digits.slice(3, 6) +
    " " +
    digits.slice(6)
  );

}


/* =========================================================
PAGE 1 SYNCHRONIZATION
========================================================= */

function syncRegistrationInformation() {

  const user =
    state.user || {};

  const teacher =
    state.teacherProfile || {};

  setValue(
    "profileFirstName",
    user.firstName ??
      user.first_name ??
      ""
  );

  setValue(
    "profileLastName",
    user.lastName ??
      user.last_name ??
      ""
  );

  /*
   * Backend stores:
   * 251710774737
   *
   * HTML displays +251 separately.
   */

  let phone =
    safeString(user.phone);

  if (
    phone.startsWith("251")
  ) {

    phone =
      phone.slice(3);

  }

  setValue(
    "profilePhone",
    formatPhoneDisplay(phone)
  );

  setValue(
    "profileSubcity",
    formatLocation(
      teacher.subcity ??
      teacher.sub_city
    )
  );

  setValue(
    "profileArea",
    formatLocation(
      teacher.area
    )
  );

  setValue(
    "profileNearestMosque",
    teacher.nearestMosque ??
      teacher.nearest_mosque ??
      ""
  );

  const experience =
    teacher.experience;

  setValue(
    "profileExperience",
    (
      experience === null ||
      experience === undefined ||
      experience === ""
    )
      ? ""
      : experience
  );

  setValue(
    "profileGender",
    formatGender(
      teacher.gender
    )
  );

  renderRegisteredStudyFields();

  console.debug(
    "[BarakaLink][Ustaz Profile] Page 1 synchronized:",
    {
      user,
      teacherProfile:
        teacher,
      studyFields:
        state.studyFields
    }
  );

}


/* =========================================================
STUDY FIELD ICONS
========================================================= */

const STUDY_FIELD_ICONS =
  Object.freeze({

    "quran-basic":
      "fa-solid fa-book-open",

    quran_basic:
      "fa-solid fa-book-open",

    tajweed:
      "fa-solid fa-headphones",

    hifz:
      "fa-solid fa-brain",

    tafseer:
      "fa-solid fa-book-quran",

    hadith:
      "fa-solid fa-mosque",

    tarbiyah:
      "fa-solid fa-hands-praying"

  });


/* =========================================================
STUDY FIELD LABEL
========================================================= */

function getStudyFieldLabel(field) {

  const name =
    safeString(
      field?.name
    );

  if (name) {
    return name;
  }

  const slug =
    safeString(
      field?.slug
    );

  if (!slug) {
    return "Teaching Subject";
  }

  return slug
    .replace(/[-_]+/g, " ")
    .replace(
      /\b\w/g,
      character =>
        character.toUpperCase()
    );

}


/* =========================================================
RENDER REGISTERED STUDY FIELDS
========================================================= */

function renderRegisteredStudyFields() {

  const container =
    $("profileStudyFields");

  if (!container) {
    return;
  }

  container.innerHTML =
    "";

  const fields =
    Array.isArray(state.studyFields)
      ? state.studyFields
      : [];

  if (fields.length === 0) {

    const empty =
      document.createElement(
        "div"
      );

    empty.className =
      "profile-study-fields-empty";

    empty.innerHTML = `
      <i
        class="fa-solid fa-circle-info"
        aria-hidden="true"
      ></i>

      <span>
        No teaching subjects were found in your registration.
      </span>
    `;

    container.appendChild(
      empty
    );

    return;
  }

  fields.forEach(
    function(field) {

      const slug =
        safeString(
          field?.slug
        ).toLowerCase();

      const item =
        document.createElement(
          "label"
        );

      item.className =
        "role-option registered-study-field";

      const input =
        document.createElement(
          "input"
        );

      input.type =
        "checkbox";

      input.checked =
        true;

      input.disabled =
        true;

      input.tabIndex =
        -1;

      const icon =
        document.createElement(
          "i"
        );

      icon.className =
        STUDY_FIELD_ICONS[slug] ||
        "fa-solid fa-book";

      const label =
        document.createElement(
          "strong"
        );

      label.textContent =
        getStudyFieldLabel(
          field
        );

      item.appendChild(
        input
      );

      item.appendChild(
        icon
      );

      item.appendChild(
        label
      );

      container.appendChild(
        item
      );

    }
  );

  console.debug(
    "[BarakaLink][Ustaz Profile] Study fields rendered:",
    state.studyFields
  );

}


/* =========================================================
PAGE NAVIGATION
========================================================= */

function getSavedPage() {

  try {

    const value =
      Number(
        localStorage.getItem(
          USTAZ_PROFILE_CONFIG.PAGE_KEY
        )
      );

    return (
      Number.isInteger(value) &&
      value >= 1 &&
      value <= 6
    )
      ? value
      : 1;

  } catch {

    return 1;

  }

}


function rememberPage(page) {

  try {

    localStorage.setItem(
      USTAZ_PROFILE_CONFIG.PAGE_KEY,
      String(page)
    );

  } catch {

    /* Ignore storage problems. */

  }

}


function setPage(page) {

  const nextPage =
    Math.min(
      6,
      Math.max(
        1,
        Number(page) || 1
      )
    );

  if (
    state.page === 6 &&
    nextPage !== 6
  ) {

    closeSelfieModal({
      restoreFocus: false
    });

    stopSelfieCamera();

  }

  state.page =
    nextPage;

  const stepIds = [
    "ustazProfileStepOne",
    "ustazProfileStepTwo",
    "ustazProfileStepThree",
    "ustazProfileStepFour",
    "ustazProfileStepFive",
    "ustazProfileStepSix"
  ];

  stepIds.forEach(
    (id, index) => {

      const element =
        $(id);

      if (element) {

        element.hidden =
          index + 1 !==
          state.page;

      }

    }
  );

  const titles = {

    1:
      "Your registration information",

    2:
      "About You",

    3:
      "Teaching & Lesson Setup",

    4:
      "Qur'an Recitation & Qualifications",

    5:
      "Fayda National ID",

    6:
      "Selfie & Review Submission"

  };
  const descriptions = {

    1:
      "Review the information you provided during Ustaz registration before continuing.",

    2:
      "Help parents get to know you and understand how you teach.",

    3:
      "Tell parents how you teach and choose the lesson options you offer.",

    4:
      "Show your recitation and provide your Islamic studies qualifications.",

    5:
      "Upload both sides of your Fayda National ID for private admin review.",

    6:
      "Take a private selfie and submit your completed Ustaz profile for manual admin review."

  };

  const title =
    $("profileStepTitle");

  const description =
    $("profileStepDescription");

  const number =
    $("profileProgressNumber");

  const backButton =
    $("profileBackButton");

  const buttonText =
    $("profileSaveButtonText");

  const buttonIcon =
    $("profileSaveButtonIcon");

  if (title) {

    title.textContent =
      titles[state.page];

  }

  if (description) {

    description.textContent =
      descriptions[state.page];

  }

    if (number) {

    number.textContent =
      `Step ${state.page} of 6`;

  }

  if (backButton) {

    backButton.hidden =
      state.page <= 1;

  }

  if (buttonText) {

    buttonText.textContent =
      state.reviewStatus ===
        USTAZ_REVIEW_STATUS.PENDING
        ? "Under Review"
        : state.page === 1
          ? "Save & Continue"
          : state.page === 6
            ? "Submit for Review"
            : "Continue";

  }

  if (buttonIcon) {

    buttonIcon.className =
      state.reviewStatus ===
        USTAZ_REVIEW_STATUS.PENDING
        ? "fa-solid fa-clock"
        : state.page === 6
          ? "fa-solid fa-paper-plane"
          : "fa-solid fa-arrow-right";

  }

  updateStepIndicator();

  updateLanguageSelectionUI();

  rememberPage(
    state.page
  );

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });

}


function updateStepIndicator() {

  const indicator =
    $("profileStepIndicator");

  if (!indicator) {
    return;
  }

  indicator
    .querySelectorAll("[data-step]")
    .forEach(
      item => {

        const itemStep =
          Number(
            item.dataset.step
          );

        const number =
          item.querySelector(
            ".profile-step-indicator-number"
          );

        item.classList.toggle(
          "is-active",
          itemStep === state.page
        );

        item.classList.toggle(
          "is-complete",
          itemStep < state.page
        );

        item.setAttribute(
          "aria-current",
          itemStep === state.page
            ? "step"
            : "false"
        );

        if (number) {

          number.innerHTML =
            itemStep < state.page
              ? '<i class="fa-solid fa-check"></i>'
              : String(itemStep);

        }

      }
    );

  indicator
    .querySelectorAll(
      ".profile-step-indicator-line"
    )
    .forEach(
      (line, index) => {

        line.classList.toggle(
          "is-complete",
          index + 1 <
            state.page
        );

      }
    );

}

/* =========================================================
   AVAILABILITY HELPERS
========================================================= */

function normalizeBoolean(value) {

  if (
    value === true ||
    value === 1 ||
    value === "1" ||
    value === "true" ||
    value === "TRUE" ||
    value === "on"
  ) {
    return true;
  }

  if (
    value === false ||
    value === 0 ||
    value === "0" ||
    value === "false" ||
    value === "FALSE" ||
    value === "off"
  ) {
    return false;
  }

  return false;
}


function readTeacherAvailability(teacher) {

  const source =
    teacher ||
    {};

  return normalizeBoolean(
    source.isAvailable ??
    source.is_available ??
    source.availability ??
    source.available
  );

}


function updateAvailabilityUI() {

  const input =
    $("profileAvailability");

  const title =
    $("profileAvailabilityTitle");

  const description =
    $("profileAvailabilityDescription");

  if (!input) {
    return;
  }

  const available =
    Boolean(
      input.checked
    );

  if (title) {

    title.textContent =
      available
        ? "Available for students"
        : "Currently unavailable";

  }

  if (description) {

    description.textContent =
      available
        ? "Parents can find your profile and start a new chat."
        : "Your profile will not appear in parent discovery.";

  }

}


function setupAvailability() {

  const input =
    $("profileAvailability");

  if (!input) {
    return;
  }

  input.addEventListener(
    "change",
    function () {

      updateAvailabilityUI();

      saveDraft();

    }
  );

  updateAvailabilityUI();

}
function prefillExistingTeacherData() {

  const teacher =
    state.teacherProfile ||
    {};

  setValue(
    "profileDateOfBirth",
    teacher.dateOfBirth ??
      teacher.date_of_birth ??
      teacher.birthDate ??
      teacher.birth_date ??
      ""
  );

  setValue(
    "profileBio",
    teacher.bio ??
      teacher.about ??
      teacher.description ??
      ""
  );

  setValue(
    "profileRecitationTitle",
    teacher.recitationTitle ??
      teacher.recitation_title ??
      ""
  );

  setValue(
    "profileRecitationDescription",
    teacher.recitationDescription ??
      teacher.recitation_description ??
      ""
  );

  setValue(
    "profileTeachingApproach",
    teacher.teachingApproach ??
      teacher.teaching_approach ??
      ""
  );

  setValue(
    "profileLessonDuration",
    teacher.lessonDuration ??
      teacher.lesson_duration ??
      ""
  );


  /* =======================================================
     HOURLY PRICE
  ======================================================= */

  const hourlyRate =
    teacher.hourlyRate ??
    teacher.hourly_rate ??
    teacher.pricePerHour ??
    teacher.price_per_hour ??
    "";

  setValue(
    "profileHourlyRate",
    hourlyRate
  );


  /* =======================================================
     AVAILABILITY

     A brand-new, incomplete profile starts available by default.
     Admin approval remains a separate server-side gate; this
     default must never make an unapproved profile discoverable.
     Existing reviewed profiles keep their saved server value.
  ======================================================= */
const isNewIncompleteProfile =
  !Boolean(
    state.user?.profileCompleted ??
    state.user?.profile_completed ??
    false
  ) &&
  !state.reviewStatus;

const availability =
  isNewIncompleteProfile
    ? true
    : readTeacherAvailability(
        teacher
      );

const availabilityInput =
  $("profileAvailability");

if (availabilityInput) {

  availabilityInput.checked =
    availability;

}

updateAvailabilityUI();

  /* =======================================================
     LESSON FORMAT
  ======================================================= */

  enforceInPersonLessonFormat();


  /* =======================================================
     LANGUAGES
  ======================================================= */

  const languages =
    Array.isArray(
      teacher.languages
    )
      ? teacher.languages
      : Array.isArray(
          teacher.languagesSpoken
        )
        ? teacher.languagesSpoken
        : [];

  languages.forEach(
    language => {

      const value =
        normalizeLanguage(
          language
        );

      const input =
        document.querySelector(
          `input[name="languages"][value="${CSS.escape(value)}"]`
        );

      if (input) {

        input.checked =
          true;

      }

    }
  );


  /* =======================================================
     OLD AVAILABILITY DAYS
     Kept for compatibility with existing data.
  ======================================================= */

  const availabilityDays =
    Array.isArray(
      teacher.availabilityDays
    )
      ? teacher.availabilityDays
      : Array.isArray(
          teacher.availability_days
        )
        ? teacher.availability_days
        : [];

  availabilityDays.forEach(
    day => {

      const value =
        safeString(day)
          .toLowerCase();

      const input =
        document.querySelector(
          `input[name="availabilityDays"][value="${CSS.escape(value)}"]`
        );

      if (input) {

        input.checked =
          true;

      }

    }
  );

  updateBioCounter();

  updateLanguageSelectionUI();

  updateAvailabilityUI();

}

/* =========================================================
LESSON FORMAT
CURRENTLY IN-PERSON ONLY
========================================================= */

function enforceInPersonLessonFormat() {

  const inputs =
    $$(
      'input[name="lessonFormat"]'
    );

  if (!inputs.length) {
    return;
  }

  inputs.forEach(
    input => {

      const value =
        safeString(
          input.value
        ).toLowerCase();

      const isInPerson =
        value === USTAZ_LESSON_FORMAT;

      /*
       * Online and both remain visible in HTML
       * but cannot currently be selected.
       */
      input.disabled =
        !isInPerson;

      /*
       * In-person is the only active option.
       */
      input.checked =
        isInPerson;

    }
  );

}


function setupLessonFormat() {

  const container =
    $("profileLessonFormatOptions");

  if (!container) {
    return;
  }

  if (
    container.dataset.lessonFormatSetup ===
      "true"
  ) {

    enforceInPersonLessonFormat();

    return;

  }

  container.dataset.lessonFormatSetup =
    "true";

  /*
   * Extra protection in case markup,
   * saved drafts, or older browser state
   * tries to select an unavailable option.
   */
  container.addEventListener(
    "change",
    function(event) {

      const input =
        event.target.closest(
          'input[name="lessonFormat"]'
        );

      if (!input) {
        return;
      }

      if (
        input.value !==
        USTAZ_LESSON_FORMAT
      ) {

        enforceInPersonLessonFormat();

        return;

      }

      clearFieldError(
        "profileLessonFormatError"
      );

      enforceInPersonLessonFormat();

      saveDraft();

    }
  );

  enforceInPersonLessonFormat();

}


/* =========================================================
LANGUAGE NORMALIZATION
========================================================= */

function normalizeLanguage(value) {

  if (
    value &&
    typeof value ===
      "object"
  ) {

    value =
      value.slug ??
      value.value ??
      value.name;

  }

  const normalized =
    safeString(value)
      .toLowerCase()
      .replace(
        /\s+/g,
        "-"
      );

  const aliases = {

    oromo:
      "afaan-oromo",

    afaanoromo:
      "afaan-oromo",

    "afaan-oromo":
      "afaan-oromo",

    amharic:
      "amharic",

    tigrinya:
      "tigrinya",

    somali:
      "somali",

    arabic:
      "arabic",

    english:
      "english"

  };

  return (
    aliases[normalized] ||
    normalized
  );

}


/* =========================================================
PHOTO SETUP
========================================================= */

function setupPhoto() {

  const input =
    $("profilePhoto");

  const chooseButton =
    $("profilePhotoChangeButton");

  const removeButton =
    $("profilePhotoRemoveButton");

  const preview =
    $("profilePhotoPreview");

  const placeholder =
    $("profilePhotoPlaceholder");

  if (
    chooseButton &&
    input
  ) {

    chooseButton.addEventListener(
      "click",
      function() {

        input.click();

      }
    );

  }

  if (input) {

    input.addEventListener(
      "change",
      function() {

        const file =
          input.files?.[0] ||
          null;

        if (!file) {
          return;
        }

        clearFieldError(
          "profilePhotoError"
        );

        if (
          !USTAZ_PROFILE_CONFIG.PHOTO_TYPES.includes(
            file.type
          )
        ) {

          showFieldError(
            "profilePhotoError",
            "Please choose a JPG, PNG, or WebP image."
          );

          input.value =
            "";

          return;

        }

        if (
          file.size >
          USTAZ_PROFILE_CONFIG.MAX_PHOTO_SIZE
        ) {

          showFieldError(
            "profilePhotoError",
            "The profile photo must be 5 MB or smaller."
          );

          input.value =
            "";

          return;

        }

        state.photoFile =
          file;

        const url =
          URL.createObjectURL(
            file
          );

        if (preview) {

          preview.src =
            url;

          preview.hidden =
            false;

          preview.onload =
            function() {

              URL.revokeObjectURL(
                url
              );

            };

        }

        if (placeholder) {

          placeholder.hidden =
            true;

        }

        if (removeButton) {

          removeButton.hidden =
            false;

        }

      }
    );

  }

  if (removeButton) {

    removeButton.addEventListener(
      "click",
      function() {

        state.photoFile =
          null;

        if (input) {

          input.value =
            "";

        }
if (preview) {

  preview.src =
    "data:,";

  preview.hidden =
    true;

}

        if (placeholder) {

          placeholder.hidden =
            false;

        }

        removeButton.hidden =
          true;

        clearFieldError(
          "profilePhotoError"
        );

        saveDraft();

      }
    );

  }

}


/* =========================================================
EXISTING PHOTO
========================================================= */

function renderExistingPhoto() {

  const teacher =
    state.teacherProfile ||
    {};

  const url =
    teacher.photoUrl ??
    teacher.photo_url ??
    teacher.profilePhotoUrl ??
    teacher.profile_photo_url ??
    teacher.avatarUrl ??
    teacher.avatar_url ??
    "";

  if (!url) {
    return;
  }

  const preview =
    $("profilePhotoPreview");

  const placeholder =
    $("profilePhotoPlaceholder");

  const removeButton =
    $("profilePhotoRemoveButton");

  if (preview) {

    preview.src =
      resolveMediaUrl(url);

    preview.hidden =
      false;

  }

  if (placeholder) {

    placeholder.hidden =
      true;

  }

  if (removeButton) {

    removeButton.hidden =
      false;

  }

}

/* =========================================================
FAYDA DOCUMENTS
========================================================= */

function setupFaydaDocuments() {

  setupFaydaDocument({
    key:
      "front",

    inputId:
      "profileFaydaFront",

    cameraInputId:
      "profileFaydaFrontCamera",

    uploadButtonId:
      "profileFaydaFrontUploadButton",

    captureButtonId:
      "profileFaydaFrontCaptureButton",

    removeButtonId:
      "profileFaydaFrontRemoveButton",

    previewId:
      "profileFaydaFrontPreview",

    placeholderId:
      "profileFaydaFrontPlaceholder",

    errorId:
      "profileFaydaFrontError"
  });


  setupFaydaDocument({
    key:
      "back",

    inputId:
      "profileFaydaBack",

    cameraInputId:
      "profileFaydaBackCamera",

    uploadButtonId:
      "profileFaydaBackUploadButton",

    captureButtonId:
      "profileFaydaBackCaptureButton",

    removeButtonId:
      "profileFaydaBackRemoveButton",

    previewId:
      "profileFaydaBackPreview",

    placeholderId:
      "profileFaydaBackPlaceholder",

    errorId:
      "profileFaydaBackError"
  });

}


function setupFaydaDocument(config) {

  const input =
    $(config.inputId);

  const cameraInput =
    $(config.cameraInputId);

  const uploadButton =
    $(config.uploadButtonId);

  const captureButton =
    $(config.captureButtonId);

  const removeButton =
    $(config.removeButtonId);

  if (!input) {
    return;
  }

  if (
    input.dataset.faydaSetup ===
      "true"
  ) {

    return;

  }

  input.dataset.faydaSetup =
    "true";


  /* =======================================================
     UPLOAD
  ======================================================= */

  if (uploadButton) {

    uploadButton.addEventListener(
      "click",
      function() {

        input.click();

      }
    );

  }


  /* =======================================================
     CAMERA
  ======================================================= */

  if (
    captureButton &&
    cameraInput
  ) {

    captureButton.addEventListener(
      "click",
      function() {

        cameraInput.click();

      }
    );

  }


  /* =======================================================
     NORMAL FILE
  ======================================================= */

  input.addEventListener(
    "change",
    function() {

      const file =
        input.files?.[0] ||
        null;

      handleFaydaFile(
        config,
        file
      );

    }
  );


  /* =======================================================
     CAMERA FILE
  ======================================================= */

  if (cameraInput) {

    cameraInput.addEventListener(
      "change",
      function() {

        const file =
          cameraInput.files?.[0] ||
          null;

        handleFaydaFile(
          config,
          file
        );

      }
    );

  }


  /* =======================================================
     REMOVE
  ======================================================= */

  if (removeButton) {

    removeButton.addEventListener(
      "click",
      function() {

        removeFaydaDocument(
          config
        );

      }
    );

  }

}


function handleFaydaFile(
  config,
  file
) {

  if (!file) {
    return;
  }

  clearFieldError(
    config.errorId
  );


  /* =======================================================
     TYPE
  ======================================================= */

  if (
    !USTAZ_PROFILE_CONFIG.FAYDA_IMAGE_TYPES.includes(
      file.type
    )
  ) {

    showFieldError(
      config.errorId,
      "Please choose a JPG, PNG, or WebP image."
    );

    resetFaydaInput(
      config
    );

    return;

  }


  /* =======================================================
     SIZE
  ======================================================= */

  if (
    file.size >
    USTAZ_PROFILE_CONFIG.MAX_FAYDA_IMAGE_SIZE
  ) {

    showFieldError(
      config.errorId,
      "The Fayda image must be 8 MB or smaller."
    );

    resetFaydaInput(
      config
    );

    return;

  }


  /* =======================================================
     STORE
  ======================================================= */

  if (
    config.key ===
      "front"
  ) {

    state.faydaFrontFile =
      file;

  } else {

    state.faydaBackFile =
      file;

  }


  /* =======================================================
     PREVIEW
  ======================================================= */

  renderFaydaFilePreview(
    config,
    file
  );


  updateFaydaDocumentButtons(
    config,
    true
  );

  saveDraft();

}


function renderFaydaFilePreview(
  config,
  file
) {

  const preview =
    $(config.previewId);

  const placeholder =
    $(config.placeholderId);

  if (!preview) {
    return;
  }

  const url =
    URL.createObjectURL(
      file
    );

  preview.src =
    url;

  preview.hidden =
    false;

  if (placeholder) {

    placeholder.hidden =
      true;

  }

  preview.onload =
    function() {

      try {

        URL.revokeObjectURL(
          url
        );

      } catch {

        /* Ignore stale object URLs. */

      }

    };

}


function renderExistingFaydaDocuments() {

  const teacher =
    state.teacherProfile ||
    {};

  const faydaDocuments =
    teacher.faydaDocuments ||
    teacher.fayda_documents ||
    {};


  const frontUrl =
    faydaDocuments.frontUrl ??
    faydaDocuments.front_url ??
    teacher.faydaFrontUrl ??
    teacher.fayda_front_url ??
    teacher.faydaFrontImageUrl ??
    teacher.fayda_front_image_url ??
    "";


  const backUrl =
    faydaDocuments.backUrl ??
    faydaDocuments.back_url ??
    teacher.faydaBackUrl ??
    teacher.fayda_back_url ??
    teacher.faydaBackImageUrl ??
    teacher.fayda_back_image_url ??
    "";


  if (frontUrl) {

    renderExistingFaydaDocument(
      {
        key:
          "front",

        previewId:
          "profileFaydaFrontPreview",

        placeholderId:
          "profileFaydaFrontPlaceholder",

        removeButtonId:
          "profileFaydaFrontRemoveButton",

        errorId:
          "profileFaydaFrontError"
      },
      frontUrl
    );

  }


  if (backUrl) {

    renderExistingFaydaDocument(
      {
        key:
          "back",

        previewId:
          "profileFaydaBackPreview",

        placeholderId:
          "profileFaydaBackPlaceholder",

        removeButtonId:
          "profileFaydaBackRemoveButton",

        errorId:
          "profileFaydaBackError"
      },
      backUrl
    );

  }

}


function renderExistingFaydaDocument(
  config,
  url
) {

  const preview =
    $(config.previewId);

  const placeholder =
    $(config.placeholderId);

  const removeButton =
    $(config.removeButtonId);

  if (!preview) {
    return;
  }

  preview.src =
    resolveMediaUrl(
      url
    );

  preview.hidden =
    false;

  if (placeholder) {

    placeholder.hidden =
      true;

  }

  if (removeButton) {

    removeButton.hidden =
      false;

  }

}


function updateFaydaDocumentButtons(
  config,
  hasFile
) {

  const removeButton =
    $(config.removeButtonId);

  if (removeButton) {

    removeButton.hidden =
      !hasFile;

  }

}


function resetFaydaInput(
  config
) {

  const input =
    $(config.inputId);

  const cameraInput =
    $(config.cameraInputId);

  if (input) {

    input.value =
      "";

  }

  if (cameraInput) {

    cameraInput.value =
      "";

  }


  if (
    config.key ===
      "front"
  ) {

    state.faydaFrontFile =
      null;

  } else {

    state.faydaBackFile =
      null;

  }

}


function removeFaydaDocument(
  config
) {

  resetFaydaInput(
    config
  );

  const preview =
    $(config.previewId);

  const placeholder =
    $(config.placeholderId);

  const removeButton =
    $(config.removeButtonId);

  if (preview) {

    preview.src =
      "data:,";

    preview.hidden =
      true;

  }

  if (placeholder) {

    placeholder.hidden =
      false;

  }

  if (removeButton) {

    removeButton.hidden =
      true;

  }

  clearFieldError(
    config.errorId
  );

  saveDraft();

}


function hasExistingFaydaFront() {

  const teacher =
    state.teacherProfile ||
    {};

  const documents =
    teacher.faydaDocuments ||
    teacher.fayda_documents ||
    {};

  return Boolean(

    documents.frontUrl ??
    documents.front_url ??
    teacher.faydaFrontUrl ??
    teacher.fayda_front_url ??
    teacher.faydaFrontImageUrl ??
    teacher.fayda_front_image_url

  );

}


function hasExistingFaydaBack() {

  const teacher =
    state.teacherProfile ||
    {};

  const documents =
    teacher.faydaDocuments ||
    teacher.fayda_documents ||
    {};

  return Boolean(

    documents.backUrl ??
    documents.back_url ??
    teacher.faydaBackUrl ??
    teacher.fayda_back_url ??
    teacher.faydaBackImageUrl ??
    teacher.fayda_back_image_url

  );

}
/* =========================================================
MEDIA URL
========================================================= */

function resolveMediaUrl(value) {

  const raw =
    safeString(value);

  if (!raw) {
    return "";
  }

  try {

    const base =
      window.BarakaLinkAPI?.base ||
      window.location.origin;

    return new URL(
      raw,
      `${base.replace(/\/+$/, "")}/`
    ).href;

  } catch {

    return raw;

  }

}


/* =========================================================
RECITATION TIME
========================================================= */

function formatRecitationTime(seconds) {

  const totalSeconds =
    Math.max(
      0,
      Math.floor(
        Number(seconds) || 0
      )
    );

  const minutes =
    Math.floor(
      totalSeconds / 60
    );

  const remainingSeconds =
    totalSeconds % 60;

  return (
    `${minutes}:` +
    String(
      remainingSeconds
    ).padStart(
      2,
      "0"
    )
  );

}


/* =========================================================
RECORDER MIME TYPE
========================================================= */

function getSupportedRecordingMimeType() {

  if (
    typeof MediaRecorder ===
      "undefined" ||
    typeof MediaRecorder.isTypeSupported !==
      "function"
  ) {

    return "";

  }

  const candidates = [

    "audio/webm;codecs=opus",

    "audio/webm",

    "audio/ogg;codecs=opus",

    "audio/mp4"

  ];

  return (
    candidates.find(
      type =>
        MediaRecorder.isTypeSupported(type)
    ) ||
    ""
  );

}


/* =========================================================
RECITATION TIMER
========================================================= */

function updateRecitationTimer(seconds) {

  const timer =
    $("profileRecitationTimer");

  if (timer) {

    timer.textContent =
      formatRecitationTime(
        seconds
      );

  }

}


function stopRecitationTimer() {

  if (
    state.recordingTimerId
  ) {

    clearInterval(
      state.recordingTimerId
    );

  }

  state.recordingTimerId =
    null;

}


function startRecitationTimer() {

  stopRecitationTimer();

  state.recordingStartedAt =
    Date.now();

  const tick =
    () => {

      const elapsed =
        (
          Date.now() -
          state.recordingStartedAt
        ) / 1000;

      updateRecitationTimer(
        elapsed
      );

    };

  tick();

  state.recordingTimerId =
    setInterval(
      tick,
      250
    );

}


/* =========================================================
RECITATION STATUS
========================================================= */

function setRecitationStatus(
  message,
  recording = false
) {

  const status =
    $("profileRecitationStatus");

  const recorder =
    $("profileRecitationRecorder");

  if (status) {

    status.textContent =
      message;

  }

  if (recorder) {

    recorder.classList.toggle(
      "is-recording",
      recording
    );

  }

}


/* =========================================================
RECITATION WAVEFORM
========================================================= */

function renderRecitationWaveform() {

  const waveform =
    $("profileRecitationWaveform");

  if (
    !waveform ||
    waveform.childElementCount
  ) {

    return;

  }

  const heights = [

    8, 12, 18, 10,
    22, 15, 27, 12,
    20, 30, 18, 10,
    24, 34, 16, 28,
    12, 22, 32, 15,
    25, 14, 30, 18,
    10, 23, 16, 28,
    12, 20, 9, 17

  ];

  heights.forEach(
    (
      height,
      index
    ) => {

      const bar =
        document.createElement(
          "span"
        );

      bar.style.setProperty(
        "--bar-height",
        `${height}px`
      );

      bar.style.setProperty(
        "--bar-delay",
        `${(index % 8) * -0.14}s`
      );

      waveform.appendChild(
        bar
      );

    }
  );

}


/* =========================================================
PLAYBACK UI
========================================================= */

function updateRecitationPlaybackUi() {

  const audio =
    $("profileRecitationPlayer");

  const progress =
    $("profileRecitationProgress");

  const current =
    $("profileRecitationCurrentTime");

  const duration =
    $("profileRecitationDuration");

  if (!audio) {
    return;
  }

  if (progress) {

    const max =
      Number.isFinite(
        audio.duration
      )
        ? audio.duration
        : 0;

    progress.max =
      String(max);

    progress.value =
      String(
        audio.currentTime || 0
      );

  }

  if (current) {

    current.textContent =
      formatRecitationTime(
        audio.currentTime
      );

  }

  if (duration) {

    duration.textContent =
      formatRecitationTime(
        audio.duration
      );

  }

}


function updateRecitationPlayButton() {

  const audio =
    $("profileRecitationPlayer");

  const button =
    $("profileRecitationPlayButton");

  const icon =
    button?.querySelector("i");

  if (
    !audio ||
    !button ||
    !icon
  ) {

    return;

  }

  const playing =
    !audio.paused;

  icon.className =
    playing
      ? "fa-solid fa-pause"
      : "fa-solid fa-play";

  button.setAttribute(
    "aria-label",
    playing
      ? "Pause recitation"
      : "Play recitation"
  );

}


/* =========================================================
CLEAR RECITATION PREVIEW
========================================================= */

function clearRecitationPreview() {

  const preview =
    $("profileRecitationPreview");

  const player =
    $("profileRecitationPlayer");

  const removeButton =
    $("profileRecitationRemoveButton");

  if (player) {

    player.pause();

    player.removeAttribute(
      "src"
    );

    player.load();

  }

  if (preview) {

    preview.hidden =
      true;

  }

  if (removeButton) {

    removeButton.hidden =
      true;

  }

  if (state.audioPlaybackUrl) {

    try {

      URL.revokeObjectURL(
        state.audioPlaybackUrl
      );

    } catch {

      /* Ignore stale object URLs. */

    }

  }

  state.audioPlaybackUrl =
    "";

  state.audioFile =
    null;

  updateRecitationPlaybackUi();

  updateRecitationPlayButton();

}


/* =========================================================
STOP MICROPHONE STREAM
========================================================= */

function stopActiveRecitationStream() {

  const stream =
    state.mediaStream;

  if (!stream) {
    return;
  }

  const tracks =
    typeof stream.getTracks ===
      "function"
      ? stream.getTracks()
      : [];

  console.debug(
    "[BarakaLink][Ustaz Profile][Recorder] Releasing microphone stream:",
    {
      active:
        stream.active,

      audioTrackCount:
        stream.getAudioTracks?.().length || 0,

      tracks:
        tracks.map(track => ({
          label:
            track.label,

          readyState:
            track.readyState,

          enabled:
            track.enabled,

          muted:
            track.muted
        }))
    }
  );

  /*
   * Clear the state reference before stopping tracks so a re-entrant
   * recorder lifecycle event can never reuse this stream.
   */

  state.mediaStream =
    null;

  tracks.forEach(
    track => {

      try {

        track.stop();

      } catch {

        /* Ignore already-stopped tracks. */

      }

    }
  );

  console.debug(
    "[BarakaLink][Ustaz Profile][Recorder] Microphone stream released."
  );

}


/* =========================================================
REQUEST MICROPHONE
========================================================= */

async function requestRecitationMicrophone() {

  if (
    state.microphoneRequestInProgress
  ) {

    throw new DOMException(
      "A microphone request is already in progress.",
      "AbortError"
    );

  }

  if (
    state.recordingSessionActive
  ) {

    throw new DOMException(
      "A recording session is already active.",
      "AbortError"
    );

  }

  if (
    state.mediaRecorder &&
    state.mediaRecorder.state !==
      "inactive"
  ) {

    throw new DOMException(
      "A MediaRecorder instance is still active.",
      "AbortError"
    );

  }

  /*
   * A new recording attempt always starts with a fresh recorder-owned
   * microphone stream. Never reuse a previous live stream here.
   */

  if (state.mediaStream) {

    console.debug(
      "[BarakaLink][Ustaz Profile][Recorder] Cleaning stale recorder stream before new microphone request."
    );

    stopActiveRecitationStream();

  }

  if (
    !navigator.mediaDevices ||
    typeof navigator.mediaDevices.getUserMedia !==
      "function"
  ) {

    throw new DOMException(
      "Microphone recording is not supported.",
      "NotSupportedError"
    );

  }

  state.microphoneRequestInProgress =
    true;

  let acquiredStream =
    null;

  try {

    console.debug(
      "[BarakaLink][Ustaz Profile][Recorder] Requesting microphone:",
      {
        mediaStream:
          state.mediaStream,

        mediaRecorder:
          state.mediaRecorder,

        mediaRecorderState:
          state.mediaRecorder?.state,

        recordingSessionActive:
          state.recordingSessionActive,

        microphoneRequestInProgress:
          state.microphoneRequestInProgress
      }
    );

    /*
     * Keep the microphone request deliberately simple.
     * Do not enumerate devices or retry automatically.
     */

    acquiredStream =
      await navigator.mediaDevices.getUserMedia({
        audio:
          true
      });

    const audioTracks =
      typeof acquiredStream?.getAudioTracks ===
        "function"
        ? acquiredStream.getAudioTracks()
        : [];

    const liveTrack =
      audioTracks.find(
        track =>
          track.readyState === "live"
      );

    console.debug(
      "[BarakaLink][Ustaz Profile][Recorder] Microphone request returned:",
      {
        streamActive:
          acquiredStream?.active,

        audioTrackCount:
          audioTracks.length,

        audioTracks:
          audioTracks.map(track => ({
            readyState:
              track.readyState,

            enabled:
              track.enabled,

            muted:
              track.muted,

            label:
              track.label
          }))
      }
    );

    if (
      !acquiredStream ||
      !acquiredStream.active ||
      !liveTrack
    ) {

      if (acquiredStream) {

        acquiredStream
          .getTracks()
          .forEach(
            track => {

              try {
                track.stop();
              } catch {
                /* Ignore cleanup errors. */
              }

            }
          );

      }

      throw new DOMException(
        "The microphone did not provide a usable audio stream.",
        "NotReadableError"
      );

    }

    state.mediaStream =
      acquiredStream;

    console.debug(
      "[BarakaLink][Ustaz Profile][Recorder] Microphone stream stored:",
      {
        active:
          acquiredStream.active,

        track:
          {
            readyState:
              liveTrack.readyState,

            enabled:
              liveTrack.enabled,

            muted:
              liveTrack.muted,

            label:
              liveTrack.label
          },

        mediaStream:
          state.mediaStream
      }
    );

    return acquiredStream;

  } catch (error) {

    /*
     * A failed request must never leave the returned stream, or any
     * previous recorder-owned stream, occupying the microphone.
     */

    if (acquiredStream) {

      acquiredStream
        .getTracks()
        .forEach(
          track => {

            try {
              track.stop();
            } catch {
              /* Ignore cleanup errors. */
            }

          }
        );

    }

    if (
      state.mediaStream ===
      acquiredStream
    ) {

      state.mediaStream =
        null;

    }

    console.debug(
      "[BarakaLink][Ustaz Profile][Recorder] Microphone request ended:",
      {
        errorName:
          error?.name,

        errorMessage:
          error?.message,

        mediaStream:
          state.mediaStream,

        mediaRecorder:
          state.mediaRecorder,

        mediaRecorderState:
          state.mediaRecorder?.state,

        recordingSessionActive:
          state.recordingSessionActive,

        microphoneRequestInProgress:
          state.microphoneRequestInProgress
      }
    );

    throw error;

  } finally {

    state.microphoneRequestInProgress =
      false;

  }

}


/* =========================================================
LANGUAGE SELECTION UI
========================================================= */

function updateLanguageSelectionUI() {

  const container =
    $("profileLanguages");

  const chips =
    $("profileLanguagesSelectedChips");

  if (!container) {
    return;
  }

  const labels =
    container.querySelectorAll(
      "label.role-option"
    );

  const selected =
    [];

  labels.forEach(
    label => {

      const input =
        label.querySelector(
          'input[type="checkbox"]'
        );

      const value =
        input?.value || "";

      const checked =
        Boolean(
          input?.checked
        );

      /*
       * This is the important visual selected state.
       */

      label.classList.toggle(
        "is-selected",
        checked
      );

      label.setAttribute(
        "aria-checked",
        checked
          ? "true"
          : "false"
      );

      if (checked) {

        const strong =
          label.querySelector(
            "strong"
          );

        selected.push(
          strong?.textContent?.trim() ||
          value
        );

      }

    }
  );

  if (!chips) {
    return;
  }

  chips.innerHTML =
    "";

  if (selected.length === 0) {

    const empty =
      document.createElement(
        "span"
      );

    empty.className =
      "language-selection-empty";

    empty.textContent =
      "No languages selected yet";

    chips.appendChild(
      empty
    );

    return;

  }

  selected.forEach(
    language => {

      const chip =
        document.createElement(
          "span"
        );

      chip.className =
        "language-selection-chip";

      chip.textContent =
        language;

      chips.appendChild(
        chip
      );

    }
  );

}


function setupLanguageSelection() {

  const container =
    $("profileLanguages");

  if (
    !container ||
    container.dataset.languageSetup ===
      "true"
  ) {

    updateLanguageSelectionUI();

    return;

  }

  container.dataset.languageSetup =
    "true";

  container.addEventListener(
    "change",
    event => {

      if (
        !event.target.matches(
          'input[name="languages"]'
        )
      ) {

        return;

      }

      clearFieldError(
        "profileLanguagesError"
      );

      updateLanguageSelectionUI();

      saveDraft();

    }
  );

  updateLanguageSelectionUI();

}


/* =========================================================
RECITATION RECORDER SETUP
========================================================= */

function setupRecitation() {

  const recorder =
    $("profileRecitationRecorder");

  const recordButton =
    $("profileRecitationRecordButton");

  const stopButton =
    $("profileRecitationStopButton");

  const preview =
    $("profileRecitationPreview");

  const player =
    $("profileRecitationPlayer");

  const playButton =
    $("profileRecitationPlayButton");

  const progress =
    $("profileRecitationProgress");

  const removeButton =
    $("profileRecitationRemoveButton");

  if (
    !recordButton ||
    !stopButton ||
    !player
  ) {

    return;

  }

  if (
    recordButton.dataset.recitationRecorderSetup ===
      "true"
  ) {

    return;

  }

  recordButton.dataset.recitationRecorderSetup =
    "true";

  renderRecitationWaveform();

  const setRecorderControlsDisabled =
    disabled => {

      recordButton.disabled =
        disabled;

      const fileButton =
        $("profileRecitationFileButton");

      if (fileButton) {

        fileButton.disabled =
          disabled;

      }

    };

  const setRecordingUi =
    recording => {

      recordButton.hidden =
        recording;

      stopButton.hidden =
        !recording;

      if (recorder) {

        recorder.classList.toggle(
          "is-recording",
          recording
        );

      }

      setRecorderControlsDisabled(
        recording
      );

    };


  const acceptAudioBlob =
    blob => {

      const mimeType =
        state.recordingMimeType ||
        blob.type ||
        "audio/webm";

      if (
        blob.size >
        USTAZ_PROFILE_CONFIG.MAX_AUDIO_SIZE
      ) {

        setRecordingUi(
          false
        );

        stopRecitationTimer();

        updateRecitationTimer(
          0
        );

        setRecitationStatus(
          "Recording was too large. Please record a shorter sample."
        );

        showFieldError(
          "profileRecitationError",
          "The recitation sample must be 25 MB or smaller."
        );

        return;

      }

      if (state.audioPlaybackUrl) {

        try {

          URL.revokeObjectURL(
            state.audioPlaybackUrl
          );

        } catch {

          /* Ignore stale object URLs. */

        }

      }

      const extension =
        mimeType.includes("mpeg")
          ? "mp3"
          : mimeType.includes("wav")
            ? "wav"
            : mimeType.includes("ogg")
              ? "ogg"
              : mimeType.includes("mp4")
                ? "m4a"
                : "webm";

      const file =
        new File(
          [blob],
          `quran-recitation-${Date.now()}.${extension}`,
          {
            type:
              mimeType
          }
        );

      const url =
        URL.createObjectURL(
          file
        );

      state.audioFile =
        file;

      state.audioPlaybackUrl =
        url;

      player.src =
        url;

      if (preview) {

        preview.hidden =
          false;

      }

      if (removeButton) {

        removeButton.hidden =
          false;

      }

      setRecordingUi(
        false
      );

      stopRecitationTimer();

      setRecitationStatus(
        "Recitation recorded. Tap play to listen."
      );

      clearFieldError(
        "profileRecitationError"
      );

      player.load();

      updateRecitationPlaybackUi();

      updateRecitationPlayButton();

      saveDraft();

    };


  /* =======================================================
  RECORD BUTTON
  ======================================================= */

  recordButton.addEventListener(
    "click",
    async () => {

      clearFieldError(
        "profileRecitationError"
      );

      /*
       * The microphone request lock is owned by
       * requestRecitationMicrophone().
       */

      if (
        state.microphoneRequestInProgress
      ) {

        return;

      }

      if (
        state.recordingSessionActive
      ) {

        return;

      }

      if (
        state.mediaRecorder &&
        state.mediaRecorder.state !==
          "inactive"
      ) {

        return;

      }

      if (
        !navigator.mediaDevices ||
        typeof navigator.mediaDevices.getUserMedia !==
          "function"
      ) {

        showFieldError(
          "profileRecitationError",
          "This browser does not support microphone recording. You can use an audio file instead."
        );

        return;

      }

      if (
        typeof MediaRecorder ===
          "undefined"
      ) {

        showFieldError(
          "profileRecitationError",
          "Microphone recording is not supported in this browser. You can use an audio file instead."
        );

        return;

      }

      /*
       * Disable the controls immediately so a user cannot initiate a
       * second recorder request while getUserMedia() is pending.
       * The actual request lock remains inside requestRecitationMicrophone().
       */

      setRecorderControlsDisabled(
        true
      );

      clearRecitationPreview();

      let stream =
        null;

      try {

        stream =
          await requestRecitationMicrophone();

        const liveTrack =
          stream
            ?.getAudioTracks?.()
            .find(
              track =>
                track.readyState === "live"
            );

        console.debug(
          "[BarakaLink][Ustaz Profile][Recorder] Stream ready for MediaRecorder:",
          {
            streamActive:
              stream?.active,

            track:
              liveTrack
                ? {
                    readyState:
                      liveTrack.readyState,

                    enabled:
                      liveTrack.enabled,

                    muted:
                      liveTrack.muted,

                    label:
                      liveTrack.label
                  }
                : null,

            mediaStream:
              state.mediaStream,

            mediaRecorder:
              state.mediaRecorder,

            mediaRecorderState:
              state.mediaRecorder?.state,

            recordingSessionActive:
              state.recordingSessionActive,

            microphoneRequestInProgress:
              state.microphoneRequestInProgress
          }
        );

        if (
          !stream ||
          !stream.active ||
          !liveTrack
        ) {

          stopActiveRecitationStream();

          throw new DOMException(
            "The microphone stream was not usable for recording.",
            "NotReadableError"
          );

        }

      } catch (error) {

        console.error(
          "[BarakaLink][Ustaz Profile] Microphone access failed:",
          error
        );

        const message =
          error?.name ===
            "NotAllowedError"
            ?
              "Microphone access was blocked. Allow microphone access for BarakaLink and try again."
            :
          error?.name ===
            "NotFoundError"
            ?
              "No microphone was found on this device."
            :
          error?.name ===
            "NotReadableError"
            ?
              "The microphone is unavailable or already in use. Close other apps or browser tabs using the microphone, then try again."
            :
          error?.name ===
            "OverconstrainedError"
            ?
              "The microphone could not satisfy the requested settings. Try again."
            :
          error?.name ===
            "SecurityError"
            ?
              "Microphone access is blocked by the browser or page security settings."
            :
              "The microphone could not be opened. Check your microphone and try again.";

        showFieldError(
          "profileRecitationError",
          message
        );

        setRecitationStatus(
          "Tap the microphone to try again"
        );

        stopActiveRecitationStream();

        state.recordingChunks =
          [];

        state.recordingMimeType =
          "";

        state.recordingSessionActive =
          false;

        state.mediaRecorder =
          null;

        setRecorderControlsDisabled(
          false
        );

        return;

      }

      /*
       * requestRecitationMicrophone() returned a fresh, verified stream.
       */

      state.recordingChunks =
        [];

      state.recordingMimeType =
        getSupportedRecordingMimeType();

      let recorderInstance =
        null;

      try {

        recorderInstance =
          state.recordingMimeType
            ? new MediaRecorder(
                stream,
                {
                  mimeType:
                    state.recordingMimeType
                }
              )
            : new MediaRecorder(
                stream
              );

        state.mediaRecorder =
          recorderInstance;

        state.recordingSessionActive =
          true;

        console.debug(
          "[BarakaLink][Ustaz Profile][Recorder] MediaRecorder created:",
          {
            state:
              recorderInstance.state,

            mimeType:
              recorderInstance.mimeType,

            mediaStream:
              state.mediaStream,

            recordingSessionActive:
              state.recordingSessionActive
          }
        );

      } catch (error) {

        console.error(
          "[BarakaLink][Ustaz Profile] MediaRecorder creation failed:",
          error
        );

        state.mediaRecorder =
          null;

        state.recordingSessionActive =
          false;

        state.recordingChunks =
          [];

        state.recordingMimeType =
          "";

        stopActiveRecitationStream();

        setRecorderControlsDisabled(
          false
        );

        showFieldError(
          "profileRecitationError",
          "Your browser could not start audio recording. You can use an audio file instead."
        );

        return;

      }

      let recordingFailed =
        false;

      recorderInstance.addEventListener(
        "dataavailable",
        event => {

          if (
            recordingFailed ||
            state.mediaRecorder !==
              recorderInstance
          ) {

            return;

          }

          if (
            event.data?.size
          ) {

            state.recordingChunks.push(
              event.data
            );

          }

        }
      );

      recorderInstance.addEventListener(
        "stop",
        () => {

          /*
           * A failed recorder may still dispatch its final stop event.
           * Use that event to release the recorder reference only after
           * the failed MediaRecorder has reached its terminal lifecycle.
           */

          if (recordingFailed) {

            stopRecitationTimer();

            state.recordingChunks =
              [];

            if (
              state.mediaRecorder ===
                recorderInstance
            ) {

              state.mediaRecorder =
                null;

              state.recordingSessionActive =
                false;

            }

            stopActiveRecitationStream();

            return;

          }

          if (
            state.mediaRecorder !==
              recorderInstance
          ) {

            return;

          }

          stopRecitationTimer();

          const chunks =
            state.recordingChunks ||
            [];

          const mimeType =
            state.recordingMimeType ||
            chunks[0]?.type ||
            "audio/webm";

          state.recordingChunks =
            [];

          state.mediaRecorder =
            null;

          state.recordingSessionActive =
            false;

          stopActiveRecitationStream();

          const blob =
            new Blob(
              chunks,
              {
                type:
                  mimeType
              }
            );

          console.debug(
            "[BarakaLink][Ustaz Profile][Recorder] Recording stopped:",
            {
              chunkCount:
                chunks.length,

              blobSize:
                blob.size,

              mediaStream:
                state.mediaStream,

              mediaRecorder:
                state.mediaRecorder,

              recordingSessionActive:
                state.recordingSessionActive
            }
          );

          if (!blob.size) {

            setRecordingUi(
              false
            );

            updateRecitationTimer(
              0
            );

            setRecitationStatus(
              "No audio was recorded. Please try again."
            );

            setRecorderControlsDisabled(
              false
            );

            return;

          }

          acceptAudioBlob(
            blob
          );

        }
      );

      recorderInstance.addEventListener(
        "error",
        event => {

          recordingFailed =
            true;

          console.error(
            "[BarakaLink][Ustaz Profile] Recording error:",
            event
          );

          stopRecitationTimer();

          state.recordingChunks =
            [];

          if (
            state.mediaRecorder ===
              recorderInstance
          ) {

            if (
              recorderInstance.state ===
                "inactive"
            ) {

              state.mediaRecorder =
                null;

              state.recordingSessionActive =
                false;

            } else {

              /*
               * Keep the failed recorder reference while the browser
               * finishes its terminal lifecycle so another MediaRecorder
               * cannot be created on top of it.
               */

              state.recordingSessionActive =
                true;

            }

          }

          stopActiveRecitationStream();

          setRecordingUi(
            false
          );

          setRecorderControlsDisabled(
            false
          );

          updateRecitationTimer(
            0
          );

          setRecitationStatus(
            "Recording failed. Please try again."
          );

          showFieldError(
            "profileRecitationError",
            "The microphone recording failed. Please try again."
          );

        }
      );

      try {

        console.debug(
          "[BarakaLink][Ustaz Profile][Recorder] Starting MediaRecorder:",
          {
            state:
              recorderInstance.state,

            streamActive:
              stream.active,

            audioTracks:
              stream.getAudioTracks().map(track => ({
                readyState:
                  track.readyState,

                enabled:
                  track.enabled,

                muted:
                  track.muted,

                label:
                  track.label
              }))
          }
        );

        recorderInstance.start(
          250
        );

        console.debug(
          "[BarakaLink][Ustaz Profile][Recorder] MediaRecorder started:",
          {
            state:
              recorderInstance.state,

            mediaRecorder:
              state.mediaRecorder,

            mediaStream:
              state.mediaStream,

            recordingSessionActive:
              state.recordingSessionActive
          }
        );

      } catch (error) {

        console.error(
          "[BarakaLink][Ustaz Profile] Failed to start MediaRecorder:",
          error
        );

        recordingFailed =
          true;

        state.mediaRecorder =
          null;

        state.recordingSessionActive =
          false;

        state.recordingChunks =
          [];

        stopRecitationTimer();

        stopActiveRecitationStream();

        setRecordingUi(
          false
        );

        setRecorderControlsDisabled(
          false
        );

        updateRecitationTimer(
          0
        );

        showFieldError(
          "profileRecitationError",
          "The browser could not start the recording. Please try again."
        );

        return;

      }

      setRecordingUi(
        true
      );

      setRecitationStatus(
        "Recording...",
        true
      );

      startRecitationTimer();

    }
  );


  /* =======================================================
  STOP BUTTON
  ======================================================= */

  stopButton.addEventListener(
    "click",
    () => {

      stopRecitationTimer();

      const recorderInstance =
        state.mediaRecorder;

      if (
        recorderInstance &&
        recorderInstance.state !==
          "inactive"
      ) {

        console.debug(
          "[BarakaLink][Ustaz Profile][Recorder] Stop requested:",
          {
            state:
              recorderInstance.state,

            mediaStream:
              state.mediaStream,

            recordingSessionActive:
              state.recordingSessionActive
          }
        );

        try {

          recorderInstance.stop();

        } catch (error) {

          console.error(
            "[BarakaLink][Ustaz Profile] Failed to stop recording:",
            error
          );

          state.mediaRecorder =
            null;

          state.recordingSessionActive =
            false;

          state.recordingChunks =
            [];

          stopActiveRecitationStream();

          setRecordingUi(
            false
          );

          setRecorderControlsDisabled(
            false
          );

          updateRecitationTimer(
            0
          );

          setRecitationStatus(
            "Recording failed. Please try again."
          );

        }

      } else {

        state.mediaRecorder =
          null;

        state.recordingSessionActive =
          false;

        stopActiveRecitationStream();

        setRecordingUi(
          false
        );

        setRecorderControlsDisabled(
          false
        );

      }

    }
  );


  /* =======================================================
  PLAY / PAUSE
  ======================================================= */

  if (playButton) {

    playButton.addEventListener(
      "click",
      async () => {

        if (!player.src) {
          return;
        }

        try {

          if (player.paused) {

            await player.play();

          } else {

            player.pause();

          }

        } catch (error) {

          console.error(
            "[BarakaLink][Ustaz Profile] Audio playback failed:",
            error
          );

          showFieldError(
            "profileRecitationError",
            "The recording could not be played."
          );

        }

      }
    );

  }


  /* =======================================================
  PROGRESS / SEEK
  ======================================================= */

  if (progress) {

    progress.addEventListener(
      "input",
      () => {

        if (
          Number.isFinite(
            player.duration
          )
        ) {

          player.currentTime =
            Number(
              progress.value
            );

        }

      }
    );

  }

  player.addEventListener(
    "loadedmetadata",
    updateRecitationPlaybackUi
  );

  player.addEventListener(
    "durationchange",
    updateRecitationPlaybackUi
  );

  player.addEventListener(
    "timeupdate",
    () => {

      updateRecitationPlaybackUi();

      updateRecitationPlayButton();

    }
  );

  player.addEventListener(
    "play",
    updateRecitationPlayButton
  );

  player.addEventListener(
    "pause",
    updateRecitationPlayButton
  );

  player.addEventListener(
    "ended",
    () => {

      updateRecitationPlaybackUi();

      updateRecitationPlayButton();

    }
  );


  /* =======================================================
  REMOVE RECORDING
  ======================================================= */

  if (removeButton) {

    removeButton.addEventListener(
      "click",
      () => {

        clearRecitationPreview();

        setRecitationStatus(
          "Tap the microphone to record a new sample"
        );

        updateRecitationTimer(
          0
        );

        saveDraft();

      }
    );

  }

  setRecordingUi(
    false
  );

  updateRecitationPlaybackUi();

  updateRecitationPlayButton();

}


if (!window.__barakaLinkUstazMicCleanupBound) {

  window.__barakaLinkUstazMicCleanupBound =
    true;

  const cleanupMicrophone = () => {

    stopRecitationTimer();

    const recorderInstance =
      state.mediaRecorder;

    /*
     * Clear the shared recorder reference before stopping so a late
     * stop/data event cannot be mistaken for the next recording session.
     */

    state.mediaRecorder =
      null;

    state.recordingSessionActive =
      false;

    state.recordingChunks =
      [];

    state.microphoneRequestInProgress =
      false;

    if (
      recorderInstance &&
      recorderInstance.state !== "inactive"
    ) {

      try {

        recorderInstance.stop();

      } catch {

        /* Ignore teardown errors. */

      }

    }

    stopActiveRecitationStream();

  };

  window.addEventListener(
    "pagehide",
    cleanupMicrophone
  );

  window.addEventListener(
    "beforeunload",
    cleanupMicrophone
  );

}


/* =========================================================
EXISTING RECITATION
========================================================= */

function renderExistingRecitation() {

  const teacher =
    state.teacherProfile ||
    {};

  const url =
    teacher.recitationUrl ??
    teacher.recitation_url ??
    teacher.sampleRecitationUrl ??
    teacher.sample_recitation_url ??
    teacher.audioUrl ??
    teacher.audio_url ??
    "";

  if (!url) {

    setRecitationStatus(
      "Tap the microphone to record a new sample"
    );

    return;

  }

  const preview =
    $("profileRecitationPreview");

  const player =
    $("profileRecitationPlayer");

  if (player) {

    player.src =
      resolveMediaUrl(url);

    player.load();

  }

  if (preview) {

    preview.hidden =
      false;

  }

  const removeButton =
    $("profileRecitationRemoveButton");

  if (removeButton) {

    removeButton.hidden =
      false;

  }

  setRecitationStatus(
    "Existing recitation sample loaded."
  );

  updateRecitationPlaybackUi();

  updateRecitationPlayButton();

}


/* =========================================================
BIO COUNTER
========================================================= */

function updateBioCounter() {

  const bio =
    $("profileBio");

  const counter =
    $("profileBioCount");

  if (
    !bio ||
    !counter
  ) {

    return;

  }

  const maximum =
    Number(
      bio.maxLength
    ) ||
    USTAZ_PROFILE_CONFIG.MAX_BIO_LENGTH;

  if (
    bio.value.length >
    maximum
  ) {

    bio.value =
      bio.value.slice(
        0,
        maximum
      );

  }

  counter.textContent =
    String(
      bio.value.length
    );

}


/* =========================================================
QUALIFICATIONS
========================================================= */

function setupQualifications() {

  const button =
    $("addQualification");

  if (!button) {
    return;
  }

  if (
    button.dataset.qualificationSetup ===
      "true"
  ) {

    return;

  }

  button.dataset.qualificationSetup =
    "true";

  button.addEventListener(
    "click",
    function() {

      addQualification();

      saveDraft();

    }
  );

}


function addQualification(data = {}) {

  const list =
    $("qualificationList");

  if (!list) {
    return;
  }

  const index =
    state.qualificationCounter;

  const item =
    document.createElement(
      "div"
    );

  item.className =
    "ustaz-qualification-item";

  item.dataset.qualificationItem =
    "";

  item.innerHTML = `

    <div
      class="ustaz-qualification-header"
    >

      <strong>
        Qualification ${index + 1}
      </strong>

      <button
        type="button"
        class="btn btn-outline ustaz-remove-qualification"
      >

        <i
          class="fa-solid fa-trash"
          aria-hidden="true"
        ></i>

        Remove

      </button>

    </div>


    <input
      class="auth-input"
      type="text"
      name="qualifications[${index}][title]"
      placeholder="Qualification or Islamic studies program"
      maxlength="150"
    >


    <input
      class="auth-input"
      type="text"
      name="qualifications[${index}][institution]"
      placeholder="Institution / Madrasa / Institute"
      maxlength="150"
    >


    <div class="name-row">

      <input
        class="auth-input"
        type="number"
        name="qualifications[${index}][year]"
        placeholder="Year completed"
        min="1900"
        max="2100"
      >


      <input
        class="auth-input"
        type="text"
        name="qualifications[${index}][specialization]"
        placeholder="Specialization"
        maxlength="150"
      >

    </div>


    <label class="file-input-label">

      <span>
        Supporting certificate
      </span>

      <input
        type="file"
        name="qualificationCertificates[]"
        accept=".pdf,image/jpeg,image/png,image/webp"
      >

    </label>

  `;

  const title =
    item.querySelector(
      '[name*="[title]"]'
    );

  const institution =
    item.querySelector(
      '[name*="[institution]"]'
    );

  const year =
    item.querySelector(
      '[name*="[year]"]'
    );

  const specialization =
    item.querySelector(
      '[name*="[specialization]"]'
    );

  if (title) {

    title.value =
      safeString(
        data.title
      );

  }

  if (institution) {

    institution.value =
      safeString(
        data.institution
      );

  }

  if (year) {

    year.value =
      safeString(
        data.year
      );

  }

  if (specialization) {

    specialization.value =
      safeString(
        data.specialization
      );

  }

  const removeButton =
    item.querySelector(
      ".ustaz-remove-qualification"
    );

  if (removeButton) {

    removeButton.addEventListener(
      "click",
      function() {

        item.remove();

        renumberQualifications();

        saveDraft();

      }
    );

  }

  list.appendChild(
    item
  );

  state.qualificationCounter +=
    1;

}


function renumberQualifications() {

  const items =
    $$(
      "[data-qualification-item]"
    );

  items.forEach(
    function(
      item,
      index
    ) {

      const title =
        item.querySelector(
          ".ustaz-qualification-header strong"
        );

      if (title) {

        title.textContent =
          `Qualification ${index + 1}`;

      }

      $$(
        "input",
        item
      ).forEach(
        function(input) {

          const name =
            input.getAttribute(
              "name"
            );

          if (!name) {
            return;
          }

          input.name =
            name.replace(
              /qualifications\[\d+\]/,
              `qualifications[${index}]`
            );

        }
      );

    }
  );

  state.qualificationCounter =
    items.length;

}


/* =========================================================
DRAFT
========================================================= */
function saveDraft() {

  const draft = {

    page:
      state.page,

    dateOfBirth:
      $("profileDateOfBirth")?.value ||
      "",

    bio:
      $("profileBio")?.value ||
      "",

    recitationTitle:
      $("profileRecitationTitle")?.value ||
      "",

    recitationDescription:
      $("profileRecitationDescription")?.value ||
      "",

    teachingApproach:
      $("profileTeachingApproach")?.value ||
      "",

    lessonDuration:
      $("profileLessonDuration")?.value ||
      "",

    hourlyRate:
      $("profileHourlyRate")?.value ||
      "",

    availability:
      Boolean(
        $("profileAvailability")?.checked
      ),

    lessonFormat:
      USTAZ_LESSON_FORMAT,

    languages:
      $$(
        'input[name="languages"]:checked'
      ).map(
        input =>
          input.value
      ),

    availabilityDays:
      $$(
        'input[name="availabilityDays"]:checked'
      ).map(
        input =>
          input.value
      ),

    qualifications:
      $$(
        "[data-qualification-item]"
      ).map(
        item => ({

          title:
            item.querySelector(
              '[name*="[title]"]'
            )?.value ||
            "",

          institution:
            item.querySelector(
              '[name*="[institution]"]'
            )?.value ||
            "",

          year:
            item.querySelector(
              '[name*="[year]"]'
            )?.value ||
            "",

          specialization:
            item.querySelector(
              '[name*="[specialization]"]'
            )?.value ||
            ""

        })
      )

  };


  /*
   * Fayda image files are NEVER stored in localStorage.
   */

  try {

    localStorage.setItem(
      USTAZ_PROFILE_CONFIG.DRAFT_KEY,
      JSON.stringify(
        draft
      )
    );

  } catch (error) {

    console.warn(
      "[BarakaLink][Ustaz Profile] Draft save failed:",
      error
    );

  }

}



function loadDraft() {

  let draft =
    null;

  try {

    const raw =
      localStorage.getItem(
        USTAZ_PROFILE_CONFIG.DRAFT_KEY
      );

    if (raw) {

      draft =
        JSON.parse(
          raw
        );

    }

  } catch (error) {

    console.warn(
      "[BarakaLink][Ustaz Profile] Draft load failed:",
      error
    );

  }

  if (
    !draft ||
    typeof draft !==
      "object"
  ) {

    enforceInPersonLessonFormat();

    return;

  }

  setValue(
    "profileDateOfBirth",
    draft.dateOfBirth
  );

  setValue(
    "profileBio",
    draft.bio
  );

  setValue(
    "profileRecitationTitle",
    draft.recitationTitle
  );

  setValue(
    "profileRecitationDescription",
    draft.recitationDescription
  );

  setValue(
    "profileTeachingApproach",
    draft.teachingApproach
  );

  setValue(
    "profileLessonDuration",
    draft.lessonDuration
  );
  setValue(
    "profileHourlyRate",
    draft.hourlyRate
  );


  const availabilityInput =
    $("profileAvailability");

  const teacher =
    state.teacherProfile ||
    {};

  const hasServerAvailability = [
    teacher.isAvailable,
    teacher.is_available,
    teacher.available,
    teacher.availability,
    teacher.availableForParents,
    teacher.available_for_parents,
    teacher.acceptingStudents,
    teacher.accepting_students
  ].some(
    value =>
      value !== undefined &&
      value !== null &&
      value !== ""
  );

  const isNewIncompleteProfile =
    !Boolean(
      state.user?.profileCompleted ??
      state.user?.profile_completed ??
      false
    ) &&
    !state.reviewStatus;

  /*
   * Availability comes from the current server profile.
   * Never let an old local draft override an explicit server
   * value. For a brand-new incomplete profile, preserve the
   * enabled default selected during server-data prefill.
   */
  if (
    availabilityInput &&
    !hasServerAvailability &&
    !isNewIncompleteProfile &&
    draft.availability !== undefined
  ) {

    availabilityInput.checked =
      normalizeBoolean(
        draft.availability,
        availabilityInput.checked
      );

  }

  updateAvailabilityUI();
  /*
   * Ignore any old saved hourlyRate field.
   *
   * Ignore any old saved online/both lesson format.
   *
   * Current platform rule is always in-person.
   */

  enforceInPersonLessonFormat();

  normalizeArray(
    draft.languages
  ).forEach(
    language => {

      const normalized =
        normalizeLanguage(
          language
        );

      const input =
        document.querySelector(
          `input[name="languages"][value="${CSS.escape(normalized)}"]`
        );

      if (input) {

        input.checked =
          true;

      }

    }
  );

  normalizeArray(
    draft.availabilityDays
  ).forEach(
    day => {

      const normalized =
        safeString(day)
          .toLowerCase();

      const input =
        document.querySelector(
          `input[name="availabilityDays"][value="${CSS.escape(normalized)}"]`
        );

      if (input) {

        input.checked =
          true;

      }

    }
  );

  const first =
    $$(
      "[data-qualification-item]"
    )[0];

  if (
    first &&
    Array.isArray(
      draft.qualifications
    ) &&
    draft.qualifications[0]
  ) {

    const item =
      draft.qualifications[0];

    setElementValue(
      first.querySelector(
        '[name*="[title]"]'
      ),
      item.title
    );

    setElementValue(
      first.querySelector(
        '[name*="[institution]"]'
      ),
      item.institution
    );

    setElementValue(
      first.querySelector(
        '[name*="[year]"]'
      ),
      item.year
    );

    setElementValue(
      first.querySelector(
        '[name*="[specialization]"]'
      ),
      item.specialization
    );

  }

  if (
    Array.isArray(
      draft.qualifications
    )
  ) {

    for (
      let index = 1;
      index <
        draft.qualifications.length;
      index += 1
    ) {

      addQualification(
        draft.qualifications[index]
      );

    }

  }

  updateBioCounter();

  updateLanguageSelectionUI();

  /*
   * Final safety check after draft restoration.
   */
  enforceInPersonLessonFormat();

}


function normalizeArray(value) {

  if (
    !Array.isArray(
      value
    )
  ) {

    return [];

  }

  return [
    ...new Set(
      value
        .map(
          item => {

            if (
              item &&
              typeof item ===
                "object"
            ) {

              return (
                item.slug ??
                item.value ??
                item.name ??
                ""
              );

            }

            return item;

          }
        )
        .map(
          item =>
            safeString(
              item
            )
        )
        .filter(Boolean)
    )
  ];

}


function setElementValue(
  element,
  value
) {

  if (element) {

    element.value =
      safeString(
        value
      );

  }

}


/* =========================================================
CLEAR DRAFT
========================================================= */

function clearDraft() {

  try {

    localStorage.removeItem(
      USTAZ_PROFILE_CONFIG.DRAFT_KEY
    );

    localStorage.removeItem(
      USTAZ_PROFILE_CONFIG.PAGE_KEY
    );

  } catch {

    /* Ignore storage errors. */

  }

}



/* =========================================================
PRIVATE IDENTITY SELFIE — IN-PAGE CAMERA MODAL

The profile card shows only the last confirmed selfie. The modal owns
the live stream and a pending capture. A captured image is promoted to
state.selfieFile only when the user clicks "Use This Selfie".

Closing/cancelling the modal discards the pending image but never clears
a previously confirmed local selfie or an existing server selfie.
========================================================= */

function stopSelfieCamera() {

  /* Invalidate any permission/capture request that is still resolving. */
  state.selfieCameraRequestId += 1;
  state.selfieStarting = false;

  const stream =
    state.selfieStream;

  if (stream) {

    stream.getTracks().forEach(
      track => {

        try {
          track.stop();
        } catch {
          /* Ignore tracks that are already stopped. */
        }

      }
    );

  }

  state.selfieStream =
    null;

  state.selfieCameraActive =
    false;

  const videos = [
    $("ustazSelfieModalVideo"),
    $("ustazSelfieVideo")
  ];

  videos.forEach(
    video => {

      if (!video) {
        return;
      }

      try {
        video.pause();
      } catch {
        /* Ignore videos that have not started. */
      }

      video.srcObject =
        null;

      video.hidden =
        true;

    }
  );

  const startButton =
    $("ustazSelfieStartButton");

  const captureButton =
    $("ustazSelfieCaptureButton");

  if (startButton) {
    startButton.hidden = false;
  }

  /* The old in-card capture control is retained for markup compatibility.
     Capturing is now handled by the modal's own button. */
  if (captureButton) {
    captureButton.hidden = true;
  }

}


function validateSelfieFile(file) {

  if (!file) {
    return false;
  }

  clearFieldError(
    "ustazSelfieError"
  );

  if (
    !USTAZ_PROFILE_CONFIG.SELFIE_TYPES.includes(
      file.type
    )
  ) {

    showFieldError(
      "ustazSelfieError",
      "Please choose a JPG, PNG, or WebP selfie."
    );

    return false;

  }

  if (
    file.size >
    USTAZ_PROFILE_CONFIG.MAX_SELFIE_SIZE
  ) {

    showFieldError(
      "ustazSelfieError",
      "The selfie must be 5 MB or smaller."
    );

    return false;

  }

  return true;

}


function renderSelfiePreview(file) {

  const preview =
    $("ustazSelfiePreview");

  const placeholder =
    $("ustazSelfiePlaceholder");

  if (!preview || !file) {
    return;
  }

  const url =
    URL.createObjectURL(file);

  preview.onload =
    function() {

      try {
        URL.revokeObjectURL(url);
      } catch {
        /* Ignore stale object URLs. */
      }

      preview.onload = null;

    };

  preview.onerror =
    function() {

      try {
        URL.revokeObjectURL(url);
      } catch {
        /* Ignore stale object URLs. */
      }

      preview.onerror = null;

    };

  preview.src =
    url;

  preview.hidden =
    false;

  if (placeholder) {
    placeholder.hidden = true;
  }

}


function setSelfieFile(file) {

  if (!validateSelfieFile(file)) {
    return false;
  }

  state.selfieFile =
    file;

  stopSelfieCamera();

  renderSelfiePreview(file);

  const retakeButton =
    $("ustazSelfieRetakeButton");

  if (retakeButton) {
    retakeButton.hidden = false;
  }

  const status =
    $("ustazSelfieStatus");

  if (status) {
    status.textContent =
      "Selfie confirmed. You can retake it before submitting your profile for admin review.";
  }

  return true;

}


/* ---------- modal and element helpers ---------- */

function getSelfieModalElements() {

  return {
    modal: $("ustazSelfieCameraModal"),
    shell: document.querySelector(".profile-completion-page"),
    video: $("ustazSelfieModalVideo"),
    preview: $("ustazSelfieModalPreview"),
    canvas: $("ustazSelfieCanvas"),
    stage: $("ustazSelfieModalStage"),
    guide: $("ustazSelfieFaceGuide"),
    placeholder: $("ustazSelfieModalPlaceholder"),
    status: $("ustazSelfieModalStatus"),
    closeButton: $("ustazSelfieModalCloseButton"),
    startButton: $("ustazSelfieModalStartButton"),
    captureButton: $("ustazSelfieModalCaptureButton"),
    retakeButton: $("ustazSelfieModalRetakeButton"),
    useButton: $("ustazSelfieModalUseButton")
  };

}


function setSelfieAspect(width, height) {

  const stage =
    $("ustazSelfieModalStage");

  if (
    stage &&
    width > 0 &&
    height > 0
  ) {

    stage.style.setProperty(
      "--ustaz-selfie-aspect",
      `${width} / ${height}`
    );

  }

}


function syncSelfieAspectFromVideo() {

  const video =
    $("ustazSelfieModalVideo");

  if (!video) {
    return;
  }

  setSelfieAspect(
    video.videoWidth,
    video.videoHeight
  );

}


function setSelfieModalMessage(message, isError = false) {

  const status =
    $("ustazSelfieModalStatus");

  if (!status) {
    return;
  }

  status.textContent =
    message || "";

  status.dataset.state =
    isError ? "error" : "info";

}


function focusSelfieModalPrimary() {

  const elements =
    getSelfieModalElements();

  const target = [
    elements.useButton,
    elements.captureButton,
    elements.retakeButton,
    elements.startButton,
    elements.closeButton
  ].find(
    button =>
      button &&
      !button.hidden &&
      !button.disabled
  );

  if (target) {
    target.focus({
      preventScroll: true
    });
  }

}


function setSelfieModalMode(mode, message, isError = false) {

  const elements =
    getSelfieModalElements();

  const isLive =
    mode === "live";

  const isCaptured =
    mode === "captured";

  const hasError =
    mode === "error" || isError;

  if (elements.stage) {
    elements.stage.dataset.mode = mode;
  }

  if (elements.video) {
    elements.video.hidden = !isLive;
  }

  if (elements.preview) {
    elements.preview.hidden = !isCaptured;
  }

  if (elements.guide) {
    elements.guide.hidden = !isLive;
  }

  if (elements.placeholder) {

    elements.placeholder.hidden =
      isLive || isCaptured;

    const label =
      elements.placeholder.querySelector("span");

    if (label) {
      label.textContent =
        hasError
          ? "Camera unavailable"
          : "Preparing your camera…";
    }

  }

  if (elements.startButton) {
    elements.startButton.hidden = !hasError;
    elements.startButton.disabled = false;
  }

  if (elements.captureButton) {
    elements.captureButton.hidden = !isLive;
    elements.captureButton.disabled = false;
  }

  if (elements.retakeButton) {
    elements.retakeButton.hidden = !isCaptured;
  }

  if (elements.useButton) {
    elements.useButton.hidden = !isCaptured;
  }

  setSelfieModalMessage(
    message,
    hasError
  );

  if (state.selfieModalOpen) {
    focusSelfieModalPrimary();
  }

}


function releasePendingSelfieUrl() {

  if (!state.selfiePendingObjectUrl) {
    return;
  }

  try {
    URL.revokeObjectURL(
      state.selfiePendingObjectUrl
    );
  } catch {
    /* Ignore already-released object URLs. */
  }

  state.selfiePendingObjectUrl =
    "";

}


function discardPendingSelfie() {

  state.selfiePendingFile =
    null;

  releasePendingSelfieUrl();

  const preview =
    $("ustazSelfieModalPreview");

  if (preview) {

    preview.onload = null;
    preview.onerror = null;
    preview.hidden = true;
    preview.src = "data:,";

  }

}


function openSelfieModal(opener) {

  if (
    state.selfieModalOpen ||
    state.submitting ||
    state.reviewStatus === USTAZ_REVIEW_STATUS.PENDING
  ) {
    return;
  }

  const elements =
    getSelfieModalElements();

  if (
    !elements.modal ||
    !elements.video ||
    !elements.preview ||
    !elements.canvas ||
    !elements.stage
  ) {

    showFieldError(
      "ustazSelfieError",
      "The camera window is not available on this page. Please refresh and try again."
    );

    return;

  }

  clearFieldError(
    "ustazSelfieError"
  );

  state.selfieModalOpener =
    opener || document.activeElement || null;

  state.selfieModalOpen =
    true;

  discardPendingSelfie();

  elements.modal.hidden =
    false;

  elements.modal.setAttribute(
    "aria-hidden",
    "false"
  );

  /* This modal is outside the page shell. Make the page behind it inert. */
  if (elements.shell) {
    elements.shell.setAttribute("inert", "");
  }

  state.selfieModalPreviousOverflow =
    document.body.style.overflow;

  document.body.style.overflow =
    "hidden";

  setSelfieModalMode(
    "starting",
    "Preparing your camera. Allow camera access if your browser asks."
  );

  window.requestAnimationFrame(
    () => {

      if (
        state.selfieModalOpen &&
        elements.closeButton
      ) {
        elements.closeButton.focus({
          preventScroll: true
        });
      }

    }
  );

  startSelfieCamera();

}


function closeSelfieModal({
  restoreFocus = true
} = {}) {

  const elements =
    getSelfieModalElements();

  stopSelfieCamera();

  if (!state.selfieModalOpen) {
    if (elements.modal) {
      elements.modal.hidden = true;
      elements.modal.setAttribute("aria-hidden", "true");
    }
    return;
  }

  state.selfieModalOpen =
    false;

  /* An unconfirmed photo is discarded; state.selfieFile is left alone. */
  discardPendingSelfie();

  if (elements.modal) {

    elements.modal.hidden =
      true;

    elements.modal.setAttribute(
      "aria-hidden",
      "true"
    );

  }

  if (elements.shell) {
    elements.shell.removeAttribute("inert");
  }

  document.body.style.overflow =
    state.selfieModalPreviousOverflow;

  if (restoreFocus) {

    const opener =
      state.selfieModalOpener;

    let target =
      opener &&
      opener.isConnected &&
      !opener.hidden &&
      !opener.disabled
        ? opener
        : null;

    if (!target) {

      target = [
        $("ustazSelfieRetakeButton"),
        $("ustazSelfieStartButton")
      ].find(
        button =>
          button &&
          !button.hidden &&
          !button.disabled
      ) || null;

    }

    if (target) {
      target.focus({
        preventScroll: true
      });
    }

  }

  state.selfieModalOpener =
    null;

}


async function startSelfieCamera() {

  if (
    !state.selfieModalOpen ||
    state.selfieStarting
  ) {
    return;
  }

  const video =
    $("ustazSelfieModalVideo");

  if (
    !navigator.mediaDevices ||
    typeof navigator.mediaDevices.getUserMedia !== "function"
  ) {

    const message =
      window.isSecureContext === false
        ? "Camera access requires HTTPS or localhost. Open this page through a secure connection and try again."
        : "This browser does not support live camera access.";

    setSelfieModalMode(
      "error",
      message,
      true
    );

    showFieldError(
      "ustazSelfieError",
      message
    );

    return;

  }

  stopSelfieCamera();

  const requestId =
    ++state.selfieCameraRequestId;

  state.selfieStarting =
    true;

  setSelfieModalMode(
    "starting",
    "Starting your camera. Allow camera access if your browser asks."
  );

  try {

    const stream =
      await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 960 }
        },
        audio: false
      });

    /* If the modal closed or the user retried, do not keep this stream. */
    if (
      requestId !== state.selfieCameraRequestId ||
      !state.selfieModalOpen
    ) {

      stream.getTracks().forEach(
        track => track.stop()
      );

      return;

    }

    state.selfieStream =
      stream;

    video.srcObject =
      stream;

    video.muted =
      true;

    video.playsInline =
      true;

    video.hidden =
      false;

    await video.play();

    if (
      requestId !== state.selfieCameraRequestId ||
      !state.selfieModalOpen
    ) {
      return;
    }

    state.selfieCameraActive =
      true;

    syncSelfieAspectFromVideo();

    clearFieldError(
      "ustazSelfieError"
    );

    setSelfieModalMode(
      "live",
      "Camera is ready. Center your face in the outline, then tap Capture Selfie."
    );

  } catch (error) {

    if (
      requestId !== state.selfieCameraRequestId
    ) {
      return;
    }

    console.error(
      "[BarakaLink][Ustaz Profile][Selfie] Camera access failed:",
      error
    );

    stopSelfieCamera();

    let message =
      "Unable to start the camera. Please try again.";

    if (error?.name === "NotAllowedError") {
      message =
        "Camera permission was denied. Allow camera access in your browser settings, then try again.";
    } else if (error?.name === "NotFoundError") {
      message =
        "No camera was found on this device.";
    } else if (error?.name === "NotReadableError") {
      message =
        "Your camera may be in use by another app. Close that app and try again.";
    } else if (error?.name === "SecurityError") {
      message =
        "Camera access is blocked by your browser security settings.";
    }

    showFieldError(
      "ustazSelfieError",
      message
    );

    setSelfieModalMode(
      "error",
      message,
      true
    );

  } finally {

    if (
      requestId === state.selfieCameraRequestId
    ) {
      state.selfieStarting = false;
    }

  }

}


async function captureSelfie() {

  if (
    state.selfieCapturing ||
    !state.selfieModalOpen
  ) {
    return;
  }

  const video =
    $("ustazSelfieModalVideo");

  const canvas =
    $("ustazSelfieCanvas");

  const captureButton =
    $("ustazSelfieModalCaptureButton");

  if (
    !video ||
    !canvas ||
    !state.selfieCameraActive ||
    !state.selfieStream
  ) {

    setSelfieModalMessage(
      "Start the live camera before capturing your selfie.",
      true
    );

    return;

  }

  const width =
    video.videoWidth;

  const height =
    video.videoHeight;

  if (!width || !height) {

    setSelfieModalMessage(
      "The camera is still preparing. Please try again.",
      true
    );

    return;

  }

  state.selfieCapturing =
    true;

  const sessionToken =
    state.selfieCameraRequestId;

  if (captureButton) {
    captureButton.disabled = true;
  }

  try {

    canvas.width =
      width;

    canvas.height =
      height;

    const context =
      canvas.getContext("2d");

    if (!context) {

      setSelfieModalMessage(
        "Unable to capture the selfie from the camera.",
        true
      );

      return;

    }

    context.drawImage(
      video,
      0,
      0,
      width,
      height
    );

    const blob =
      await new Promise(
        resolve => canvas.toBlob(
          resolve,
          "image/jpeg",
          0.9
        )
      );

    if (
      sessionToken !== state.selfieCameraRequestId ||
      !state.selfieModalOpen
    ) {
      return;
    }

    if (!blob || blob.type !== "image/jpeg") {

      setSelfieModalMessage(
        "Unable to prepare the selfie. Please try again.",
        true
      );

      return;

    }

    const file =
      new File(
        [blob],
        `ustaz-selfie-${Date.now()}.jpg`,
        {
          type: "image/jpeg",
          lastModified: Date.now()
        }
      );

    if (!validateSelfieFile(file)) {

      setSelfieModalMessage(
        "The selfie must be a valid image and 5 MB or smaller. Please try again.",
        true
      );

      return;

    }

    const objectUrl =
      URL.createObjectURL(file);

    const preview =
      $("ustazSelfieModalPreview");

    try {

      preview.src =
        objectUrl;

      if (typeof preview.decode === "function") {
        await preview.decode();
      }

    } catch (decodeError) {

      console.error(
        "[BarakaLink][Ustaz Profile][Selfie] Captured preview could not be decoded:",
        decodeError
      );

      URL.revokeObjectURL(objectUrl);
      preview.src = "data:,";

      if (
        sessionToken === state.selfieCameraRequestId &&
        state.selfieModalOpen
      ) {

        setSelfieModalMessage(
          "The captured photo could not be displayed. Please try again.",
          true
        );

      }

      return;

    }

    if (
      sessionToken !== state.selfieCameraRequestId ||
      !state.selfieModalOpen
    ) {

      URL.revokeObjectURL(objectUrl);
      preview.src = "data:,";
      return;

    }

    discardPendingSelfie();

    state.selfiePendingFile =
      file;

    state.selfiePendingObjectUrl =
      objectUrl;

    /* discardPendingSelfie resets the preview; attach the newly confirmed-pending URL. */
    preview.src =
      objectUrl;

    preview.hidden =
      false;

    setSelfieAspect(
      width,
      height
    );

    /* Release the camera as soon as the frame has been captured. */
    stopSelfieCamera();

    setSelfieModalMode(
      "captured",
      "Photo captured. Check that your face is clear and well lit, then choose Use This Selfie or retake it."
    );

  } finally {

    state.selfieCapturing =
      false;

    if (captureButton) {
      captureButton.disabled = false;
    }

  }

}


function retakeModalSelfie() {

  if (!state.selfieModalOpen) {
    return;
  }

  discardPendingSelfie();
  startSelfieCamera();

}


function useModalSelfie() {

  if (
    !state.selfieModalOpen ||
    !state.selfiePendingFile
  ) {

    setSelfieModalMessage(
      "Capture a selfie first.",
      true
    );

    return;

  }

  if (!validateSelfieFile(state.selfiePendingFile)) {

    setSelfieModalMessage(
      "Please retake the selfie and make sure it is a supported image smaller than 5 MB.",
      true
    );

    return;

  }

  /* Only the explicit confirmation replaces the previously confirmed file. */
  const acceptedFile =
    state.selfiePendingFile;

  if (!setSelfieFile(acceptedFile)) {
    return;
  }

  closeSelfieModal();

}


/* The browser may suspend a page while its camera permission prompt is open. */
function pauseSelfieCameraIfActive() {

  if (
    !state.selfieStream &&
    !state.selfieStarting
  ) {
    return;
  }

  stopSelfieCamera();

  if (state.selfieModalOpen) {

    setSelfieModalMode(
      "error",
      "The camera was turned off because the page was hidden. Tap Try Camera Again to continue.",
      true
    );

  }

}


function handleSelfieModalKeydown(event) {

  if (!state.selfieModalOpen) {
    return;
  }

  if (event.key === "Escape") {

    event.preventDefault();
    event.stopPropagation();

    closeSelfieModal();

    return;

  }

  /* Keep keyboard focus inside the modal while the page behind it is inert. */
  if (event.key === "Tab") {

    const elements =
      getSelfieModalElements();

    const focusable = [
      elements.closeButton,
      elements.startButton,
      elements.retakeButton,
      elements.captureButton,
      elements.useButton
    ].filter(
      element =>
        element &&
        !element.hidden &&
        !element.disabled
    );

    if (!focusable.length) {
      return;
    }

    const first =
      focusable[0];

    const last =
      focusable[focusable.length - 1];

    if (
      event.shiftKey &&
      document.activeElement === first
    ) {

      event.preventDefault();
      last.focus();

    } else if (
      !event.shiftKey &&
      document.activeElement === last
    ) {

      event.preventDefault();
      first.focus();

    }

  }

}


function clearSelfieSelection() {

  state.selfieFile =
    null;

  const preview =
    $("ustazSelfiePreview");

  const placeholder =
    $("ustazSelfiePlaceholder");

  const retakeButton =
    $("ustazSelfieRetakeButton");

  if (preview) {

    preview.onload = null;
    preview.onerror = null;
    preview.src = "data:,";
    preview.hidden = true;

  }

  if (placeholder) {
    placeholder.hidden = false;
  }

  if (retakeButton) {
    retakeButton.hidden = true;
  }

  closeSelfieModal({
    restoreFocus: false
  });

  clearFieldError(
    "ustazSelfieError"
  );

  const status =
    $("ustazSelfieStatus");

  if (status) {
    status.textContent =
      "Start the camera, center your face, and take one clear selfie.";
  }

}


function setupSelfie() {

  const startButton =
    $("ustazSelfieStartButton");

  const captureButton =
    $("ustazSelfieCaptureButton");

  const retakeButton =
    $("ustazSelfieRetakeButton");

  const modal =
    $("ustazSelfieCameraModal");

  const modalCloseButton =
    $("ustazSelfieModalCloseButton");

  const modalStartButton =
    $("ustazSelfieModalStartButton");

  const modalCaptureButton =
    $("ustazSelfieModalCaptureButton");

  const modalRetakeButton =
    $("ustazSelfieModalRetakeButton");

  const modalUseButton =
    $("ustazSelfieModalUseButton");

  if (
    !startButton ||
    !modal ||
    !modalCaptureButton
  ) {

    console.warn(
      "[BarakaLink][Ustaz Profile][Selfie] Camera modal controls not found."
    );

    return;

  }

  if (
    startButton.dataset.selfieSetup === "true"
  ) {
    return;
  }

  startButton.dataset.selfieSetup =
    "true";

  /* Keep the legacy card capture control hidden: camera actions now live in the modal. */
  if (captureButton) {
    captureButton.hidden = true;
  }

  startButton.addEventListener(
    "click",
    function() {
      openSelfieModal(startButton);
    }
  );

  if (retakeButton) {

    retakeButton.addEventListener(
      "click",
      function() {
        openSelfieModal(retakeButton);
      }
    );

  }

  if (modalCloseButton) {
    modalCloseButton.addEventListener(
      "click",
      () => closeSelfieModal()
    );
  }

  modal.addEventListener(
    "click",
    function(event) {

      const target =
        event.target;

      if (
        target === modal ||
        (
          target instanceof Element &&
          target.closest("[data-ustaz-selfie-modal-close]")
        )
      ) {
        closeSelfieModal();
      }

    }
  );

  if (modalStartButton) {
    modalStartButton.addEventListener(
      "click",
      startSelfieCamera
    );
  }

  modalCaptureButton.addEventListener(
    "click",
    captureSelfie
  );

  if (modalRetakeButton) {
    modalRetakeButton.addEventListener(
      "click",
      retakeModalSelfie
    );
  }

  if (modalUseButton) {
    modalUseButton.addEventListener(
      "click",
      useModalSelfie
    );
  }

  const modalVideo =
    $("ustazSelfieModalVideo");

  if (modalVideo) {

    modalVideo.addEventListener(
      "loadedmetadata",
      syncSelfieAspectFromVideo
    );

    modalVideo.addEventListener(
      "resize",
      syncSelfieAspectFromVideo
    );

  }

  document.addEventListener(
    "keydown",
    handleSelfieModalKeydown
  );

  document.addEventListener(
    "visibilitychange",
    function() {
      if (document.hidden) {
        pauseSelfieCameraIfActive();
      }
    }
  );

  window.addEventListener(
    "pagehide",
    function() {
      closeSelfieModal({
        restoreFocus: false
      });
    }
  );

  window.addEventListener(
    "beforeunload",
    function() {
      closeSelfieModal({
        restoreFocus: false
      });
    }
  );

}


/* =========================================================
END PRIVATE IDENTITY SELFIE
========================================================= */


function hasExistingSelfie() {

  const teacher =
    state.teacherProfile ||
    {};

  return Boolean(
    teacher.selfieUrl ??
    teacher.selfie_url ??
    teacher.identitySelfieUrl ??
    teacher.identity_selfie_url ??
    teacher.verificationSelfieUrl ??
    teacher.verification_selfie_url
  );

}


function renderExistingSelfie() {

  const teacher =
    state.teacherProfile ||
    {};

  const url =
    teacher.selfieUrl ??
    teacher.selfie_url ??
    teacher.identitySelfieUrl ??
    teacher.identity_selfie_url ??
    teacher.verificationSelfieUrl ??
    teacher.verification_selfie_url ??
    "";

  if (!url) {

    return;

  }

  const preview =
    $("ustazSelfiePreview");

  const placeholder =
    $("ustazSelfiePlaceholder");

  if (preview) {

    preview.src =
      resolveMediaUrl(
        url
      );

    preview.hidden =
      false;

  }

  if (placeholder) {

    placeholder.hidden =
      true;

  }

  const retakeButton =
    $("ustazSelfieRetakeButton");

  if (retakeButton) {

    retakeButton.hidden =
      false;

  }

  const status =
    $("ustazSelfieStatus");

  if (status) {

    status.textContent =
      "A selfie is already on your private review record. You can replace it before submission if needed.";

  }

}


const USTAZ_REVIEW_STATUS = Object.freeze({

  PENDING:
    "pending",

  APPROVED:
    "approved",

  REJECTED:
    "rejected"

});


function normalizeReviewStatus(value) {

  const status =
    safeString(
      value
    )
      .toLowerCase()
      .replace(
        /[\s_-]+/g,
        "-"
      );

  if (
    [
      "pending",
      "under-review",
      "in-review",
      "review"
    ].includes(
      status
    )
  ) {

    return USTAZ_REVIEW_STATUS.PENDING;

  }

  if (
    [
      "approved",
      "approve"
    ].includes(
      status
    )
  ) {

    return USTAZ_REVIEW_STATUS.APPROVED;

  }

  if (
    [
      "rejected",
      "reject",
      "declined"
    ].includes(
      status
    )
  ) {

    return USTAZ_REVIEW_STATUS.REJECTED;

  }

  return "";

}


function getProfileReviewStatus(source = {}) {

  return normalizeReviewStatus(
    source?.profileReviewStatus ??
    source?.profile_review_status
  );

}


function getProfileReviewReason(source = {}) {

  return safeString(
    source?.reviewRejectionReason ??
    source?.review_rejection_reason
  );

}


function showReviewNotice(
  status,
  reason = ""
) {

  const notice =
    $("ustazReviewNotice");

  const title =
    $("ustazReviewNoticeTitle");

  const message =
    $("ustazReviewNoticeMessage");

  if (!notice) {

    return;

  }

  notice.hidden =
    !status;

  notice.dataset.reviewStatus =
    status || "";

  if (
    status ===
      USTAZ_REVIEW_STATUS.PENDING
  ) {

    if (title) {

      title.textContent =
        "Your Ustaz account is under review";

    }

    if (message) {

      message.textContent =
        "Your profile and private identity documents have been submitted to BarakaLink admins. You can log in and view your information, but editing is locked until the review is completed. You will be notified when a decision is made, normally within 48 hours.";

    }

    return;

  }

  if (
    status ===
      USTAZ_REVIEW_STATUS.REJECTED
  ) {

    if (title) {

      title.textContent =
        "Your Ustaz profile needs changes";

    }

    if (message) {

      message.textContent =
        reason
          ? `Admin review was not approved. Reason: ${reason}`
          : "Admin review was not approved. Please review your profile, make the requested changes, and submit it again.";

    }

    return;

  }

  if (
    status ===
      USTAZ_REVIEW_STATUS.APPROVED
  ) {

    if (title) {

      title.textContent =
        "Your Ustaz profile has been approved";

    }

    if (message) {

      message.textContent =
        "Your Ustaz profile has been approved by BarakaLink admins.";

    }

  }

}


function setReviewLock(locked) {

  const form =
    $("ustazProfileCompletionForm");

  if (!form) {

    return;

  }

  form.classList.toggle(
    "is-review-locked",
    locked
  );

  form
    .querySelectorAll(
      "input, textarea, select, button"
    )
    .forEach(
      element => {

        if (
          element.id ===
            "profileLogoutButton"
        ) {

          return;

        }

        element.disabled =
          locked;

      }
    );

}


function applyReviewState() {

  const status =
    state.reviewStatus;

  showReviewNotice(
    status,
    state.reviewRejectionReason
  );

  if (
    status ===
      USTAZ_REVIEW_STATUS.PENDING
  ) {

    setReviewLock(
      true
    );

    closeSelfieModal({
      restoreFocus: false
    });

    stopSelfieCamera();

    return;

  }

  setReviewLock(
    false
  );

}


/* =========================================================
VALIDATION
========================================================= */

function validateStep(step) {

  let valid =
    true;

  /*
   * IMPORTANT:
   * clearErrors() is now a real function.
   */

  clearErrors();


  /* =======================================================
  PAGE 1
  ======================================================= */

  if (step === 1) {

    return true;

  }


  /* =======================================================
  PAGE 2 — ABOUT YOU
  ======================================================= */

  if (step === 2) {

    const dateOfBirth =
      safeString(
        $("profileDateOfBirth")?.value
      );

    if (!dateOfBirth) {

      showFieldError(
        "profileDateOfBirthError",
        "Please enter your date of birth."
      );

      valid =
        false;

    }

    const bio =
      safeString(
        $("profileBio")?.value
      );

    if (
      bio.length < 20
    ) {

      showFieldError(
        "profileBioError",
        "Please write at least 20 characters about yourself."
      );

      valid =
        false;

    }

    const languages =
      $$(
        'input[name="languages"]:checked'
      );

    if (
      languages.length === 0
    ) {

      showFieldError(
        "profileLanguagesError",
        "Please select at least one language."
      );

      valid =
        false;

    }

    const photoExists =
      state.photoFile ||
      hasExistingPhoto();

    if (!photoExists) {

      showFieldError(
        "profilePhotoError",
        "Please add a profile photo."
      );

      valid =
        false;

    }

    return valid;

  }


  /* =======================================================
  PAGE 3 — TEACHING & LESSON SETUP
  ======================================================= */
  /* =======================================================
  PAGE 3 — TEACHING & LESSON SETUP
  ======================================================= */

  if (step === 3) {

    enforceInPersonLessonFormat();


    /* =====================================================
       HOURLY PRICE
    ===================================================== */

    const hourlyRateRaw =
      safeString(
        $("profileHourlyRate")?.value
      );

    const hourlyRate =
      Number(
        hourlyRateRaw
      );

    if (
      !hourlyRateRaw ||
      !Number.isFinite(hourlyRate) ||
      hourlyRate <= 0
    ) {

      showFieldError(
        "profileHourlyRateError",
        "Please enter a valid price per hour."
      );

      valid =
        false;

    }


    /* =====================================================
       LESSON FORMAT
    ===================================================== */

    const lessonFormat =
      document.querySelector(
        'input[name="lessonFormat"]:checked'
      );

    if (
      !lessonFormat ||
      lessonFormat.value !==
        USTAZ_LESSON_FORMAT
    ) {

      showFieldError(
        "profileLessonFormatError",
        "In-person lessons are currently the only available lesson format."
      );

      valid =
        false;

    }


    return valid;

  }

  /* =======================================================
  PAGE 4 — RECITATION & QUALIFICATIONS
  ======================================================= */

  if (step === 4) {

    const audioExists =
      state.audioFile ||
      hasExistingRecitation();

    if (!audioExists) {

      showFieldError(
        "profileRecitationError",
        "Please record a sample Qur'an recitation."
      );

      valid =
        false;

    }

    return valid;

  }


  /* =======================================================
  PAGE 5 — FAYDA
  ======================================================= */

    /* =======================================================
  PAGE 5 — FAYDA DOCUMENTS
  ======================================================= */

  if (step === 5) {

    const frontExists =
      Boolean(
        state.faydaFrontFile ||
        hasExistingFaydaFront()
      );

    if (!frontExists) {

      showFieldError(
        "profileFaydaFrontError",
        "Please upload or take a photo of the front of your Fayda ID."
      );

      valid =
        false;

    }


    const backExists =
      Boolean(
        state.faydaBackFile ||
        hasExistingFaydaBack()
      );

    if (!backExists) {

      showFieldError(
        "profileFaydaBackError",
        "Please upload or take a photo of the back of your Fayda ID."
      );

      valid =
        false;

    }


    return valid;

  }


  /* =======================================================
  PAGE 6 — SELFIE
  ======================================================= */

  if (step === 6) {

    const selfieExists =
      Boolean(
        state.selfieFile ||
        hasExistingSelfie()
      );

    if (!selfieExists) {

      showFieldError(
        "ustazSelfieError",
        "Please take a clear live selfie before submitting your profile."
      );

      valid =
        false;

    }

    return valid;

  }

  return valid;

}


function validateAllPages() {

  clearErrors();

  for (
    let page = 2;
    page <= 6;
    page += 1
  ) {

    if (
      !validateStep(page)
    ) {

      return {

        valid:
          false,

        page

      };

    }

  }

  return {

    valid:
      true,

    page:
      6

  };

}


/*
 * Backward-compatible alias.
 */

function validatePageTwo() {

  return validateAllPages().valid;

}


/* =========================================================
EXISTING MEDIA
========================================================= */

function hasExistingPhoto() {

  const teacher =
    state.teacherProfile ||
    {};

  return Boolean(

    teacher.photoUrl ??
    teacher.photo_url ??
    teacher.profilePhotoUrl ??
    teacher.profile_photo_url ??
    teacher.avatarUrl ??
    teacher.avatar_url

  );

}


function hasExistingRecitation() {

  const teacher =
    state.teacherProfile ||
    {};

  return Boolean(

    teacher.recitationUrl ??
    teacher.recitation_url ??
    teacher.sampleRecitationUrl ??
    teacher.sample_recitation_url ??
    teacher.audioUrl ??
    teacher.audio_url

  );

}


/* =========================================================
ERROR UI
========================================================= */

function showFieldError(
  id,
  message
) {

  const element =
    $(id);

  if (!element) {
    return;
  }

  element.textContent =
    message;

  const field =
    element.closest(
      ".auth-field"
    );

  if (field) {

    field.classList.add(
      "has-error"
    );

  }

}


function clearFieldError(
  id
) {

  const element =
    $(id);

  if (!element) {
    return;
  }

  element.textContent =
    "";

  const field =
    element.closest(
      ".auth-field"
    );

  if (field) {

    field.classList.remove(
      "has-error"
    );

  }

}


/*
 * FIXED:
 *
 * Old broken code:
 *
 * $$$(".form-error")
 *
 * Correct:
 *
 * $$()
 */

function clearErrors() {

  $$(".form-error")
    .forEach(
      element => {

        element.textContent =
          "";

      }
    );

  $$(".has-error")
    .forEach(
      element => {

        element.classList.remove(
          "has-error"
        );

      }
    );

}


/* =========================================================
STATUS
========================================================= */

function setStatus(
  text,
  type = ""
) {

  const element =
    $("profileStatus");

  if (!element) {
    return;
  }

  element.textContent =
    text;

  element.classList.remove(
    "success",
    "error",
    "loading"
  );

  if (type) {

    element.classList.add(
      type
    );

  }

}


/* =========================================================
FORM DATA
========================================================= */
function buildFormData() {

  const data =
    new FormData();


  data.append(
    "role",
    "ustaz"
  );


  /* =======================================================
     ABOUT
  ======================================================= */

  append(
    data,
    "dateOfBirth",
    $("profileDateOfBirth")?.value
  );

  append(
    data,
    "bio",
    $("profileBio")?.value
  );


  /* =======================================================
     RECITATION
  ======================================================= */

  append(
    data,
    "recitationTitle",
    $("profileRecitationTitle")?.value
  );

  append(
    data,
    "recitationDescription",
    $("profileRecitationDescription")?.value
  );


  /* =======================================================
     TEACHING
  ======================================================= */

  append(
    data,
    "teachingApproach",
    $("profileTeachingApproach")?.value
  );

  append(
    data,
    "lessonDuration",
    $("profileLessonDuration")?.value
  );


  /* =======================================================
     PRICE
  ======================================================= */

  append(
    data,
    "hourlyRate",
    $("profileHourlyRate")?.value
  );


  /* =======================================================
     AVAILABILITY
  ======================================================= */

  data.append(
    "availability",
    $("profileAvailability")?.checked
      ? "1"
      : "0"
  );


  /* =======================================================
     LESSON FORMAT
  ======================================================= */

  data.append(
    "lessonFormat",
    USTAZ_LESSON_FORMAT
  );


  /* =======================================================
     LANGUAGES
  ======================================================= */

  $$(
    'input[name="languages"]:checked'
  )
    .forEach(
      input => {

        data.append(
          "languages[]",
          input.value
        );

      }
    );


  /* =======================================================
     OLD AVAILABILITY DAYS
     Kept for compatibility.
  ======================================================= */

  $$(
    'input[name="availabilityDays"]:checked'
  )
    .forEach(
      input => {

        data.append(
          "availabilityDays[]",
          input.value
        );

      }
    );


  /* =======================================================
     QUALIFICATIONS
  ======================================================= */

  $$(
    '[data-qualification-item]'
  )
    .forEach(
      (
        item,
        index
      ) => {

        append(
          data,
          `qualifications[${index}][title]`,
          item.querySelector(
            '[name*="[title]"]'
          )?.value
        );

        append(
          data,
          `qualifications[${index}][institution]`,
          item.querySelector(
            '[name*="[institution]"]'
          )?.value
        );

        append(
          data,
          `qualifications[${index}][year]`,
          item.querySelector(
            '[name*="[year]"]'
          )?.value
        );

        append(
          data,
          `qualifications[${index}][specialization]`,
          item.querySelector(
            '[name*="[specialization]"]'
          )?.value
        );


        const certificate =
          item.querySelector(
            'input[type="file"]'
          )?.files?.[0];


        if (certificate) {

          data.append(
            `qualificationCertificates[${index}]`,
            certificate
          );

        }

      }
    );


  /* =======================================================
     PROFILE PHOTO
  ======================================================= */

  if (
    state.photoFile
  ) {

    data.append(
      "profilePhoto",
      state.photoFile
    );

  }


  /* =======================================================
     RECITATION AUDIO
  ======================================================= */

  if (
    state.audioFile
  ) {

    data.append(
      "recitationAudio",
      state.audioFile
    );

  }


  /* =======================================================
     FAYDA FRONT
  ======================================================= */

  if (
    state.faydaFrontFile
  ) {

    data.append(
      "faydaFront",
      state.faydaFrontFile
    );

  }


  /* =======================================================
     FAYDA BACK
  ======================================================= */

  if (
    state.faydaBackFile
  ) {

    data.append(
      "faydaBack",
      state.faydaBackFile
    );

  }

/* =======================================================
   IDENTITY SELFIE
======================================================= */

if (
  state.selfieFile
) {

  data.append(
    "selfiePhoto",
    state.selfieFile
  );

}

  return data;

}

function append(
  formData,
  key,
  value
) {

  if (
    value !== undefined &&
    value !== null &&
    String(value).trim() !== ""
  ) {

    formData.append(
      key,
      String(value).trim()
    );

  }

}


/* =========================================================
FINAL SUBMISSION
========================================================= */

async function submitProfile() {

  /*
   * This function is only valid on the final wizard step.
   */

  if (
    state.page !== 6
  ) {

    console.warn(
      "[BarakaLink][Ustaz Profile] Final submission called before page 6."
    );

    return;

  }


  if (
    state.submitting ||
    state.reviewStatus ===
      USTAZ_REVIEW_STATUS.PENDING
  ) {

    return;

  }


  /* =======================================================
     VALIDATE ENTIRE PROFILE
  ======================================================= */

  const validation =
    validateAllPages();


  if (
    !validation.valid
  ) {

    setPage(
      validation.page
    );


    setStatus(
      "Please review the highlighted fields.",
      "error"
    );


    const errorElement =
      document.querySelector(
        ".has-error"
      );


    if (
      errorElement
    ) {

      errorElement.scrollIntoView({
        behavior:
          "smooth",

        block:
          "center"
      });

    }


    return;

  }


  /* =======================================================
     SAVE DRAFT
  ======================================================= */

  saveDraft();


  const endpoint =
    USTAZ_PROFILE_CONFIG.COMPLETION_ENDPOINT;


  if (
    !endpoint
  ) {

    setStatus(
      "The profile-completion API is not configured.",
      "error"
    );


    return;

  }


  state.submitting =
    true;


  const button =
    $("profileSaveButton");

  const buttonText =
    $("profileSaveButtonText");

  const buttonIcon =
    $("profileSaveButtonIcon");


  if (
    button
  ) {

    button.disabled =
      true;

  }


  if (
    buttonText
  ) {

    buttonText.textContent =
      "Submitting for Review...";

  }


  if (
    buttonIcon
  ) {

    buttonIcon.className =
      "fa-solid fa-circle-notch fa-spin";

  }


  setStatus(
    "Submitting your Ustaz profile for admin review...",
    "loading"
  );


  try {

    /* =====================================================
       BUILD FINAL PAYLOAD
    ===================================================== */

    const data =
      buildFormData();


    console.info(
      "[BarakaLink][Ustaz Profile] Final profile submission:",
      {
        endpoint,

        page:
          state.page,

        hasPhoto:
          Boolean(
            state.photoFile
          ),

        hasRecitation:
          Boolean(
            state.audioFile
          ),

                lessonFormat:
          USTAZ_LESSON_FORMAT,

        hourlyRate:
          $("profileHourlyRate")?.value ||
          "",

        availability:
          Boolean(
            $("profileAvailability")?.checked
          ),

        hasFaydaFront:
          Boolean(
            state.faydaFrontFile ||
            hasExistingFaydaFront()
          ),

        hasFaydaBack:
          Boolean(
            state.faydaBackFile ||
            hasExistingFaydaBack()
          ),

        hasSelfie:
          Boolean(
            state.selfieFile ||
            hasExistingSelfie()
          )
      }
    );


    /* =====================================================
       SUBMIT TO SERVER
    ===================================================== */

    const response =
      await window.BarakaLinkAPI.request(
        endpoint,
        {
          method:
            "POST",

          body:
            data
        }
      );


    console.info(
      "[BarakaLink][Ustaz Profile] Completion response:",
      response
    );


    if (
      response?.success ===
      false
    ) {

      throw new Error(
        response?.message ||
        "The server could not complete your profile."
      );

    }


    /* =====================================================
       REVIEW STATUS
    ===================================================== */

    const responseData =
      response?.data ||
      response ||
      {};

    const reviewStatus =
      getProfileReviewStatus(
        responseData
      ) ||
      getProfileReviewStatus(
        responseData?.user ||
        {}
      ) ||
      getProfileReviewStatus(
        responseData?.teacherProfile ||
        {}
      ) ||
      USTAZ_REVIEW_STATUS.PENDING;

    const rejectionReason =
      getProfileReviewReason(
        responseData
      ) ||
      getProfileReviewReason(
        responseData?.user ||
        {}
      ) ||
      getProfileReviewReason(
        responseData?.teacherProfile ||
        {}
      );

    state.reviewStatus =
      reviewStatus;

    state.reviewRejectionReason =
      rejectionReason;

    /*
     * Submission into the admin review queue is NOT the
     * same thing as approval.
     */

    clearDraft();

    if (
      reviewStatus ===
        USTAZ_REVIEW_STATUS.APPROVED
    ) {

      setStatus(
        response?.message ||
        "Your Ustaz profile has been approved.",
        "success"
      );

      applyReviewState();

      redirectToDashboard();

      return;

    }

    if (
      reviewStatus ===
        USTAZ_REVIEW_STATUS.REJECTED
    ) {

      setStatus(
        rejectionReason
          ? `Your profile was not approved: ${rejectionReason}`
          : response?.message ||
            "Your profile was not approved. Please review the requested changes.",
        "error"
      );

      applyReviewState();

      return;

    }

    /*
     * Normal final state: pending manual review.
     */

    setStatus(
      response?.message ||
      "Your profile has been submitted for admin review. You will be notified when a decision is made, normally within 48 hours.",
      "success"
    );

    applyReviewState();

    setPage(
      1
    );

    return;


  } catch (
    error
  ) {

    console.error(
      "[BarakaLink][Ustaz Profile] Submission failed:",
      error
    );


    if (
      error?.status ===
        401 ||
      error?.code ===
        "UNAUTHORIZED"
    ) {

      redirectToLogin();

      return;

    }


    setStatus(
      error?.message ||
      "We could not complete your profile.",
      "error"
    );

  } finally {

    state.submitting =
      false;


    if (
      button
    ) {

      button.disabled =
        state.reviewStatus ===
          USTAZ_REVIEW_STATUS.PENDING;

    }


    if (
      buttonText
    ) {

      buttonText.textContent =
        state.reviewStatus ===
          USTAZ_REVIEW_STATUS.PENDING
          ? "Under Review"
          : state.page === 6
            ? "Submit for Review"
            : state.page === 1
              ? "Save & Continue"
              : "Continue";

    }


    if (
      buttonIcon
    ) {

      buttonIcon.className =
        state.reviewStatus ===
          USTAZ_REVIEW_STATUS.PENDING
          ? "fa-solid fa-clock"
          : state.page === 6
            ? "fa-solid fa-paper-plane"
            : "fa-solid fa-arrow-right";

    }

  }

}


/* =========================================================
FORM
========================================================= */

function setupForm() {

  const form =
    $("ustazProfileCompletionForm");


  if (
    !form
  ) {

    console.warn(
      "[BarakaLink][Ustaz Profile] Completion form not found."
    );

    return;

  }


  if (
    form.dataset.profileSetup ===
      "true"
  ) {

    return;

  }


  form.dataset.profileSetup =
    "true";


  form.addEventListener(
    "submit",
    async function(event) {

      /*
       * Always prevent the browser's native form submission.
       */

      event.preventDefault();

      event.stopPropagation();


      /*
       * Ignore duplicate submission while the final request
       * is already in progress.
       */

      if (
        state.submitting ||
        state.reviewStatus ===
          USTAZ_REVIEW_STATUS.PENDING
      ) {

        return;

      }


      /* =====================================================
         FINAL PAGE
      ===================================================== */

      if (
        state.page >= 6
      ) {

        state.page =
          6;


        await submitProfile();


        return;

      }


      /* =====================================================
         PAGES 1-5
      ===================================================== */

      if (
        !validateStep(
          state.page
        )
      ) {

        setStatus(
          "Please review the highlighted fields.",
          "error"
        );


        const error =
          document.querySelector(
            ".has-error"
          );


        if (
          error
        ) {

          error.scrollIntoView({
            behavior:
              "smooth",

            block:
              "center"
          });

        }


        return;

      }


      saveDraft();


      setPage(
        state.page + 1
      );


      setStatus(
        "",
        ""
      );

    },
    false
  );

}


/* =========================================================
BACK BUTTON
========================================================= */

function setupBackButton() {

  const button =
    $("profileBackButton");

  if (!button) {
    return;
  }

  if (
    button.dataset.profileBackSetup ===
      "true"
  ) {

    return;

  }

  button.dataset.profileBackSetup =
    "true";

  button.addEventListener(
    "click",
    function() {

      if (
        state.page <=
        1
      ) {

        return;

      }

      saveDraft();

      setPage(
        state.page - 1
      );

      setStatus(
        "",
        ""
      );

    }
  );

}


/* =========================================================
AUTO SAVE
========================================================= */

function setupAutoSave() {

  const form =
    $("ustazProfileCompletionForm");

  if (!form) {
    return;
  }

  let timer =
    null;

  function schedule() {

    window.clearTimeout(
      timer
    );

    timer =
      window.setTimeout(
        function() {

          updateBioCounter();

          /*
           * Enforce current lesson-format architecture
           * before saving any draft.
           */
          enforceInPersonLessonFormat();

          saveDraft();

        },
        300
      );

  }

  form.addEventListener(
    "input",
    schedule
  );

  form.addEventListener(
    "change",
    schedule
  );

}


/* =========================================================
LOGOUT
========================================================= */

function logout() {

  clearDraft();

  clearSession();

  window.location.replace(
    "index.html"
  );

}


function setupLogout() {

  const topLogout =
    $("logoutButton");

  const formLogout =
    $("profileLogoutButton");

  if (topLogout) {

    topLogout.addEventListener(
      "click",
      logout
    );

  }

  if (formLogout) {

    formLogout.addEventListener(
      "click",
      logout
    );

  }

}


/* =========================================================
INITIALIZATION
========================================================= */

async function initialize() {

  try {

    const token =
      getToken();


    if (!token) {

      redirectToLogin();

      return;

    }


    /*
     * =====================================================
     * SERVER DATA FIRST
     * =====================================================
     */

    await loadCurrentProfile();


    /*
     * =====================================================
     * IMPORTANT
     *
     * If the server says this Ustaz profile is already
     * complete, do NOT initialize the completion wizard.
     * =====================================================
     */

    const serverProfileCompleted =
      Boolean(
        state.user?.profileCompleted ??
        state.user?.profile_completed ??
        false
      );

    state.reviewStatus =
      getProfileReviewStatus(
        state.user
      ) ||
      getProfileReviewStatus(
        state.teacherProfile
      );

    state.reviewRejectionReason =
      getProfileReviewReason(
        state.user
      ) ||
      getProfileReviewReason(
        state.teacherProfile
      );

    /*
     * Approval is now separate from profile completion.
     * Pending/rejected profiles stay in the Ustaz flow.
     */

    if (
      state.reviewStatus ===
        USTAZ_REVIEW_STATUS.APPROVED
    ) {

      console.info(
        "[BarakaLink][Ustaz Profile] Profile is approved. Redirecting to teacher dashboard."
      );

      clearDraft();

      redirectToDashboard();

      return;

    }

    /*
     * Backward compatibility with the old backend:
     * if it only reports profileCompleted=true and provides
     * no review status, preserve the existing redirect.
     */

    if (
      serverProfileCompleted &&
      !state.reviewStatus
    ) {

      clearDraft();

      redirectToDashboard();

      return;

    }


    /*
     * =====================================================
     * PAGE 1
     * =====================================================
     */

    syncRegistrationInformation();


    /*
     * =====================================================
     * EXISTING PROFILE DATA
     * =====================================================
     */
/* =========================================================
AVAILABILITY
========================================================= */

function normalizeBoolean(value, fallback = false) {

  if (
    typeof value ===
      "boolean"
  ) {

    return value;

  }

  if (
    typeof value ===
      "number"
  ) {

    return value !== 0;

  }

  const normalized =
    safeString(
      value
    ).toLowerCase();

  if (
    [
      "true",
      "1",
      "yes",
      "on",
      "available",
      "active"
    ].includes(
      normalized
    )
  ) {

    return true;

  }

  if (
    [
      "false",
      "0",
      "no",
      "off",
      "unavailable",
      "inactive"
    ].includes(
      normalized
    )
  ) {

    return false;

  }

  return fallback;

}


function readTeacherAvailability(
  teacher
) {

  if (!teacher) {

    return true;

  }

  const candidates = [

    /* Current database source of truth. */
    teacher.acceptingStudents,
    teacher.accepting_students,

    /* Legacy API/database fields, for compatibility. */
    teacher.isAvailable,
    teacher.is_available,

    teacher.availableForParents,
    teacher.available_for_parents,
    teacher.available,
    teacher.availability

  ];

  for (
    const candidate of candidates
  ) {

    if (
      candidate !== undefined &&
      candidate !== null &&
      candidate !== ""
    ) {

      return normalizeBoolean(
        candidate,
        true
      );

    }

  }

  /*
   * V1 default:
   * newly completed Ustaz profiles are available.
   */

  return true;

}


function updateAvailabilityUI() {

  const input =
    $("profileAvailability");

  const title =
    $("profileAvailabilityTitle");

  const description =
    $("profileAvailabilityDescription");

  if (!input) {
    return;
  }

  const available =
    Boolean(
      input.checked
    );

  if (title) {

    title.textContent =
      available
        ? "Available to parents"
        : "Currently unavailable";

  }

  if (description) {

    description.textContent =
      available
        ? "After admin approval, parents can find your profile and start a conversation."
        : "After approval, your profile will stay out of new parent searches.";

  }

}


function setupAvailability() {

  const input =
    $("profileAvailability");

  if (!input) {
    return;
  }

  if (
    input.dataset.availabilitySetup ===
      "true"
  ) {

    updateAvailabilityUI();

    return;

  }

  input.dataset.availabilitySetup =
    "true";

  input.addEventListener(
    "change",
    function() {

      clearFieldError(
        "profileAvailabilityError"
      );

      updateAvailabilityUI();

      saveDraft();

    }
  );

  updateAvailabilityUI();

}
    prefillExistingTeacherData();


    /*
     * =====================================================
     * UI SETUP
     * =====================================================
     */
    setupPhoto();

    setupSelfie();

    setupFaydaDocuments();

    setupAvailability();

    setupLanguageSelection();

    setupLessonFormat();

    setupRecitation();
    setupQualifications();
    setupForm();

    setupBackButton();

    setupAutoSave();

    setupLogout();


    /*
     * =====================================================
     * DRAFT
     *
     * Only load the draft when the server says the profile
     * is NOT complete.
     *
     * Page 1 always comes from the server.
     * =====================================================
     */

    if (
      state.reviewStatus !==
        USTAZ_REVIEW_STATUS.PENDING
    ) {

      loadDraft();

    }


    /*
     * =====================================================
     * EXISTING SERVER MEDIA
     * =====================================================
     */
    renderExistingPhoto();

    renderExistingSelfie();

    renderExistingFaydaDocuments();

    renderExistingRecitation();

    updateBioCounter();

    updateLanguageSelectionUI();

    updateAvailabilityUI();

    enforceInPersonLessonFormat();

    /*
     * =====================================================
     * RESTORE SAVED WIZARD PAGE
     * =====================================================
     */

    setPage(
      state.reviewStatus ===
        USTAZ_REVIEW_STATUS.PENDING
        ? 1
        : getSavedPage()
    );

    applyReviewState();


    setStatus(
      "",
      ""
    );


    console.info(
      "[BarakaLink][Ustaz Profile] Profile completion initialized.",
      {
        userId:
          state.user?.id,

        teacherProfileId:
          state.teacherProfile?.id,

        profileCompleted:
          serverProfileCompleted,

        reviewStatus:
          state.reviewStatus,

        lessonFormat:
          USTAZ_LESSON_FORMAT,

        studyFieldCount:
          state.studyFields.length
      }
    );


  } catch (
    error
  ) {

    console.error(
      "[BarakaLink][Ustaz Profile] Initialization failed:",
      error
    );


    if (
      error?.status ===
        401 ||
      error?.code ===
        "UNAUTHORIZED"
    ) {

      redirectToLogin();

      return;

    }


    setStatus(
      error?.message ||
      "We could not load your BarakaLink profile.",
      "error"
    );

  }

}


/* =========================================================
PUBLIC API
========================================================= */

window.BarakaLinkUstazProfileCompletion = {

  next() {

    /*
     * Pages 1-4 move forward normally.
     */

    if (
      state.page <
      6
    ) {

      if (
        !validateStep(
          state.page
        )
      ) {

        setStatus(
          "Please review the highlighted fields.",
          "error"
        );

        return;

      }


      saveDraft();


      setPage(
        state.page + 1
      );


      setStatus(
        "",
        ""
      );


      return;

    }


    /*
     * Page 6 is the final submission step.
     */

    if (
      state.reviewStatus ===
        USTAZ_REVIEW_STATUS.PENDING
    ) {

      return;

    }

    submitProfile();

  },

  back() {

    if (
      state.page >
      1
    ) {

      setPage(
        state.page - 1
      );

    }

  },

  reloadProfile:
    loadCurrentProfile,

  syncRegistrationInformation,

  saveDraft,

  loadDraft,

  clearDraft,

  validate:
    validateAllPages,

  validateStep,

  submit:
    submitProfile

};


/* =========================================================
START
========================================================= */

if (
  document.readyState ===
    "loading"
) {

  document.addEventListener(
    "DOMContentLoaded",
    initialize,
    {
      once:
        true
    }
  );

} else {

  initialize();

}