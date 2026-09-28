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
* Hourly price
* Lesson duration
* Lesson format
* Availability

PAGE 4
* Qur'an recitation recorder
* Recitation title
* Recitation description
* Qualifications

PAGE 5
* Fayda National ID

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

  PHOTO_TYPES: [
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

  mediaStream:
    null,

  recordingTimerId:
    null,

  recordingStartedAt:
    0,

  qualificationCounter:
    1,

  submitting:
    false

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

  window.location.replace(
    "dashboard/teacher.html"
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
      document.createElement("div");

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
      value <= 5
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
      5,
      Math.max(
        1,
        Number(page) || 1
      )
    );

  state.page =
    nextPage;

  const stepIds = [
    "ustazProfileStepOne",
    "ustazProfileStepTwo",
    "ustazProfileStepThree",
    "ustazProfileStepFour",
    "ustazProfileStepFive"
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
      "Identity Verification"

  };

  const descriptions = {

    1:
      "Review the information you provided during Ustaz registration before continuing.",

    2:
      "Help students get to know you and understand how you communicate.",

    3:
      "Tell students how you teach and choose the lesson options you offer.",

    4:
      "Show your recitation and provide your Islamic studies qualifications.",

    5:
      "Provide the private information needed to verify your teacher identity."

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
      `${state.page} of 5`;

  }

  if (backButton) {

    backButton.hidden =
      state.page <= 1;

  }

  if (buttonText) {

    buttonText.textContent =
      state.page === 1
        ? "Save & Continue"
        : state.page === 5
          ? "Complete Profile"
          : "Continue";

  }

  if (buttonIcon) {

    buttonIcon.className =
      state.page === 5
        ? "fa-solid fa-check"
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
PAGE 2 PREFILL
========================================================= */

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
    "profileHourlyRate",
    teacher.hourlyRate ??
      teacher.hourly_rate ??
      teacher.pricePerHour ??
      teacher.price_per_hour ??
      ""
  );

  setValue(
    "profileLessonDuration",
    teacher.lessonDuration ??
      teacher.lesson_duration ??
      ""
  );

  const lessonFormat =
    safeString(
      teacher.lessonFormat ??
      teacher.lesson_format
    );

  if (lessonFormat) {

    const input =
      document.querySelector(
        `input[name="lessonFormat"][value="${CSS.escape(lessonFormat)}"]`
      );

    if (input) {

      input.checked =
        true;

    }

  }

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

  const availability =
    Array.isArray(
      teacher.availabilityDays
    )
      ? teacher.availabilityDays
      : Array.isArray(
          teacher.availability_days
        )
        ? teacher.availability_days
        : [];

  availability.forEach(
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

}


/* =========================================================
LANGUAGE NORMALIZATION
========================================================= */

function normalizeLanguage(value) {

  if (
    value &&
    typeof value === "object"
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
            "";

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

  if (state.mediaStream) {

    state.mediaStream
      .getTracks()
      .forEach(
        track => {

          try {

            track.stop();

          } catch {

            /* Ignore already-stopped tracks. */

          }

        }
      );

  }

  state.mediaStream =
    null;

}


/* =========================================================
REQUEST MICROPHONE
========================================================= */

async function requestRecitationMicrophone() {

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

  const attempts = [

    {
      audio: {
        echoCancellation:
          true,

        noiseSuppression:
          true,

        autoGainControl:
          true,

        channelCount:
          1
      }
    },

    {
      audio: true
    }

  ];

  let lastError =
    null;

  for (
    const constraints of attempts
  ) {

    try {

      return await navigator.mediaDevices.getUserMedia(
        constraints
      );

    } catch (error) {

      lastError =
        error;

      if (
        error?.name !==
          "NotReadableError" &&
        error?.name !==
          "OverconstrainedError" &&
        error?.name !==
          "AbortError"
      ) {

        throw error;

      }

    }

  }

  /*
   * Try explicitly selecting an audio input.
   */

  try {

    const devices =
      await navigator.mediaDevices.enumerateDevices();

    const inputs =
      devices.filter(
        device =>
          device.kind ===
            "audioinput" &&
          device.deviceId
      );

    for (
      const device of inputs
    ) {

      try {

        return await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: {
              exact:
                device.deviceId
            },
            channelCount: 1
          }
        });

      } catch (error) {

        lastError =
          error;

      }

    }

  } catch (error) {

    lastError =
      error;

  }

  throw (
    lastError ||
    new DOMException(
      "The microphone could not be opened.",
      "NotReadableError"
    )
  );

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

  renderRecitationWaveform();

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

      if (
        !navigator.mediaDevices ||
        typeof navigator.mediaDevices.getUserMedia !==
          "function"
      ) {

        showFieldError(
          "profileRecitationError",
          "This browser does not support microphone recording."
        );

        return;

      }

      if (
        typeof MediaRecorder ===
          "undefined"
      ) {

        showFieldError(
          "profileRecitationError",
          "Microphone recording is not supported in this browser."
        );

        return;

      }

      /*
       * Stop any previous recording.
       */

      if (
        state.mediaRecorder &&
        state.mediaRecorder.state !==
          "inactive"
      ) {

        try {

          state.mediaRecorder.stop();

        } catch {

          /* Ignore stale recorder. */

        }

      }

      stopActiveRecitationStream();

      clearRecitationPreview();

      let stream;

      try {

        stream =
          await requestRecitationMicrophone();

        state.mediaStream =
          stream;

      } catch (error) {

        console.error(
          "[BarakaLink][Ustaz Profile] Microphone access failed:",
          error
        );

        const message =
          error?.name ===
            "NotAllowedError"
            ? "Microphone access was blocked. Allow microphone access in your browser and try again."
            : error?.name ===
                "NotFoundError"
              ? "No microphone was found on this device."
              : error?.name ===
                  "NotReadableError"
                ? "The microphone is busy or unavailable. Close other apps or tabs using the microphone, then try again."
                : error?.name ===
                    "NotSupportedError"
                  ? "Microphone recording is not supported by this browser."
                  : error?.name ===
                      "SecurityError"
                    ? "Microphone access is blocked by the browser or page security settings."
                    : "The microphone could not be opened. Check your microphone and try again.";

        showFieldError(
          "profileRecitationError",
          message
        );

        setRecitationStatus(
          "Tap the microphone to try again"
        );

        return;

      }

      state.recordingChunks =
        [];

      state.recordingMimeType =
        getSupportedRecordingMimeType();

      try {

        state.mediaRecorder =
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

      } catch (error) {

        stopActiveRecitationStream();

        console.error(
          "[BarakaLink][Ustaz Profile] MediaRecorder creation failed:",
          error
        );

        showFieldError(
          "profileRecitationError",
          "Your browser could not start audio recording. Please try again or check your microphone."
        );

        return;

      }

      state.mediaRecorder.addEventListener(
        "dataavailable",
        event => {

          if (
            event.data?.size
          ) {

            state.recordingChunks.push(
              event.data
            );

          }

        }
      );


      state.mediaRecorder.addEventListener(
        "stop",
        () => {

          stopActiveRecitationStream();

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

          const blob =
            new Blob(
              chunks,
              {
                type:
                  mimeType
              }
            );

          if (!blob.size) {

            setRecordingUi(
              false
            );

            stopRecitationTimer();

            updateRecitationTimer(
              0
            );

            setRecitationStatus(
              "No audio was recorded. Please try again."
            );

            return;

          }

          acceptAudioBlob(
            blob
          );

        }
      );


      state.mediaRecorder.addEventListener(
        "error",
        event => {

          console.error(
            "[BarakaLink][Ustaz Profile] Recording error:",
            event
          );

          stopActiveRecitationStream();

          stopRecitationTimer();

          setRecordingUi(
            false
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

        state.mediaRecorder.start(
          250
        );

      } catch (error) {

        console.error(
          "[BarakaLink][Ustaz Profile] Failed to start MediaRecorder:",
          error
        );

        stopActiveRecitationStream();

        state.mediaRecorder =
          null;

        setRecordingUi(
          false
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

      if (
        state.mediaRecorder &&
        state.mediaRecorder.state !==
          "inactive"
      ) {

        try {

          state.mediaRecorder.stop();

        } catch (error) {

          console.error(
            "[BarakaLink][Ustaz Profile] Failed to stop recording:",
            error
          );

          stopActiveRecitationStream();

          setRecordingUi(
            false
          );

        }

      } else {

        stopActiveRecitationStream();

        setRecordingUi(
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

    hourlyRate:
      $("profileHourlyRate")?.value ||
      "",

    lessonDuration:
      $("profileLessonDuration")?.value ||
      "",

    lessonFormat:
      document.querySelector(
        'input[name="lessonFormat"]:checked'
      )?.value ||
      "",

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
   * Fayda is intentionally NOT persisted.
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
    "profileHourlyRate",
    draft.hourlyRate
  );

  setValue(
    "profileLessonDuration",
    draft.lessonDuration
  );


  if (
    draft.lessonFormat
  ) {

    const radio =
      document.querySelector(
        `input[name="lessonFormat"][value="${CSS.escape(draft.lessonFormat)}"]`
      );

    if (radio) {

      radio.checked =
        true;

    }

  }


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
VALIDATION
========================================================= */

function validateStep(step) {

  let valid =
    true;

  /*
   * IMPORTANT:
   * clearErrors() is now a real function.
   * There is NO $$$() call.
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

  if (step === 3) {

    const hourlyRate =
      Number(
        $("profileHourlyRate")?.value
      );

    if (
      !Number.isFinite(
        hourlyRate
      ) ||
      hourlyRate <= 0
    ) {

      showFieldError(
        "profileHourlyRateError",
        "Please enter a valid price per hour."
      );

      valid =
        false;

    }


    const lessonFormat =
      document.querySelector(
        'input[name="lessonFormat"]:checked'
      );

    if (!lessonFormat) {

      showFieldError(
        "profileLessonFormatError",
        "Please select a lesson format."
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

  if (step === 5) {

    const fayda =
      safeString(
        $("profileFaydaId")?.value
      );

    if (!fayda) {

      showFieldError(
        "profileFaydaIdError",
        "Please enter your Fayda National ID."
      );

      valid =
        false;

    } else if (
      !/^[0-9]+$/.test(
        fayda
      )
    ) {

      showFieldError(
        "profileFaydaIdError",
        "Fayda National ID must contain numbers only."
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
    page <= 5;
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
      5

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


  append(
    data,
    "teachingApproach",
    $("profileTeachingApproach")?.value
  );


  append(
    data,
    "hourlyRate",
    $("profileHourlyRate")?.value
  );


  append(
    data,
    "lessonDuration",
    $("profileLessonDuration")?.value
  );


  append(
    data,
    "lessonFormat",
    document.querySelector(
      'input[name="lessonFormat"]:checked'
    )?.value
  );


  $$(
    'input[name="languages"]:checked'
  ).forEach(
    input => {

      data.append(
        "languages[]",
        input.value
      );

    }
  );


  $$(
    'input[name="availabilityDays"]:checked'
  ).forEach(
    input => {

      data.append(
        "availabilityDays[]",
        input.value
      );

    }
  );


  $$(
    "[data-qualification-item]"
  ).forEach(
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
          "qualificationCertificates[]",
          certificate
        );

      }

    }
  );


  if (state.photoFile) {

    data.append(
      "profilePhoto",
      state.photoFile
    );

  }


  if (state.audioFile) {

    data.append(
      "recitationAudio",
      state.audioFile
    );

  }


  /*
   * Fayda is ONLY sent on final submission.
   * It is NEVER stored in localStorage.
   */

  append(
    data,
    "faydaNationalId",
    $("profileFaydaId")?.value
  );


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

  const validation =
    validateAllPages();

  if (!validation.valid) {

    setPage(
      validation.page
    );

    setStatus(
      "Please review the highlighted fields.",
      "error"
    );

    const error =
      document.querySelector(
        ".has-error"
      );

    if (error) {

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


  if (
    !USTAZ_PROFILE_CONFIG.COMPLETION_ENDPOINT
  ) {

    setStatus(
      "Your profile is ready, but the Ustaz profile-completion API is not enabled yet.",
      "error"
    );

    console.warn(
      "[BarakaLink][Ustaz Profile] No completion endpoint configured."
    );

    return;

  }


  if (
    state.submitting
  ) {

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


  if (button) {

    button.disabled =
      true;

  }


  if (buttonText) {

    buttonText.textContent =
      "Saving...";

  }


  if (buttonIcon) {

    buttonIcon.className =
      "fa-solid fa-circle-notch fa-spin";

  }


  setStatus(
    "Saving your teaching profile...",
    "loading"
  );


  try {

    const data =
      buildFormData();


    const response =
      await window.BarakaLinkAPI.request(
        USTAZ_PROFILE_CONFIG.COMPLETION_ENDPOINT,
        {
          method:
            "POST",

          body:
            data
        }
      );


    if (
      response?.success ===
        false
    ) {

      throw new Error(
        response?.message ||
        "The server could not save your profile."
      );

    }


    clearDraft();


    setStatus(
      response?.message ||
      "Your Ustaz profile has been completed successfully.",
      "success"
    );


    window.setTimeout(
      redirectToDashboard,
      600
    );


  } catch (error) {

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
      "We could not save your profile.",
      "error"
    );


  } finally {

    state.submitting =
      false;


    if (button) {

      button.disabled =
        false;

    }


    if (buttonText) {

      buttonText.textContent =
        state.page === 1
          ? "Save & Continue"
          : state.page === 5
            ? "Complete Profile"
            : "Continue";

    }


    if (buttonIcon) {

      buttonIcon.className =
        state.page === 5
          ? "fa-solid fa-check"
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

  if (!form) {
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
    function(event) {

      event.preventDefault();


      /*
       * PAGE 1-4
       */

      if (
        state.page <
        5
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
       * PAGE 5
       */

      submitProfile();

    }
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
     * SERVER DATA FIRST
     */

    await loadCurrentProfile();


    /*
     * PAGE 1
     */

    syncRegistrationInformation();


    /*
     * EXISTING PROFILE DATA
     */

    prefillExistingTeacherData();


    /*
     * UI SETUP
     */

    setupPhoto();

    setupLanguageSelection();

    setupRecitation();

    setupQualifications();

    setupForm();

    setupBackButton();

    setupAutoSave();

    setupLogout();


    /*
     * Draft only affects completion fields.
     *
     * Page 1 always comes from server.
     */

    loadDraft();


    /*
     * Existing server media.
     */

    renderExistingPhoto();

    renderExistingRecitation();


    updateBioCounter();

    updateLanguageSelectionUI();


    /*
     * Restore saved page.
     */

    setPage(
      getSavedPage()
    );


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

        studyFieldCount:
          state.studyFields.length
      }
    );


  } catch (error) {

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

    if (
      state.page <
      5
    ) {

      setPage(
        state.page + 1
      );

    }

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