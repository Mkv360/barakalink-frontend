/**
 * BarakaLink
 * Parent Profile Completion - Five-Step Same-Page Wizard
 *
 * Flow:
 *   Step 1 -> Account / registration information
 *   Step 2 -> Profile photo + Parent preferences
 *   Step 3 -> Fayda National ID (front + back)
 *   Step 4 -> Live selfie (camera only)
 *   Step 5 -> Review and submit for manual review
 *
 * IMPORTANT:
 * - Step 2 is NOT the final profile completion.
 * - /profile/preferences is NOT used for final submission because the
 *   existing endpoint marks users.profile_completed = 1.
 * - Profile photo is uploaded on Step 2 so the final parent-review
 *   endpoint can require an existing public avatar.
 * - Fayda and selfie files stay in browser memory until Step 5.
 * - Final completion uses POST /api/profile/parent-complete.
 * - No user_id is accepted from the browser.
 * - Authentication comes from the existing BarakaLinkAPI JWT.
 *
 * CHANGE TAGS (search for "FIX-" to find every edited spot):
 *   FIX-1  Wizard start is idempotent: a late/second load can never
 *          re-initialise the wizard or send it back to Step 1.
 *   FIX-2  Step 2 -> Step 3 transition cleanup (single setStep(3)).
 *   FIX-3  Session checkpoint so an external page reload resumes the
 *          wizard instead of restarting at Step 1 (no files/selfie stored).
 *   FIX-4  Camera lifecycle: one stream at a time, no leaks, stale
 *          getUserMedia results discarded, camera stops on any step change.
 *   FIX-5  Live selfie presentation (the live view itself now lives in the
 *          FIX-7 modal; the card on Step 4 only shows the confirmed selfie).
 *   FIX-6  The form's submit listener is installed immediately after the
 *          form is looked up, before any other top-level code runs, so no
 *          later failure in this file can leave the form without a handler
 *          (this is what prevents the native POST -> HTTP 405).
 *   FIX-7  Live selfie opens in the in-page camera modal
 *          (#parentSelfieCameraModal). A captured photo is only "pending";
 *          it becomes selfieFile solely when the user clicks
 *          "Use This Selfie". Closing/cancelling discards the pending
 *          photo and keeps any previously confirmed selfie.
 *   FIX-8  API base URL resolution is safe for phones and public URLs:
 *          an explicit window.BARAKALINK_API_BASE is honored on every host
 *          (but a localhost value is ignored when the page is not itself on
 *          localhost, and an http:// value is ignored on an https:// page);
 *          the Cloudflare frontend->backend pair is a named map instead of
 *          an inline literal; an unmapped https host no longer silently
 *          becomes "http://<frontend-host>:5000/api" (wrong host, wrong
 *          port, and blocked as mixed content) - it resolves to "" and the
 *          first request that needs it fails with a clear message.
 *   FIX-9  The three raw fetch() calls (profile photo upload, profile photo
 *          delete fallback, final parent-complete submit) go through one
 *          apiFetch() helper, so "server unreachable / blocked" shows a
 *          readable message with the API address instead of the browser's
 *          bare "Failed to fetch" / "Load failed".
 *   FIX-10 If the first load of the account data fails (for example the API
 *          is unreachable), tapping the main button retries the load instead
 *          of replacing the real error with "still loading".
 */

"use strict";

(function () {

  /* =======================================================
     CONFIGURATION
  ======================================================= */

  const PROFILE_ENDPOINT = "/profile";
  const CURRENT_USER_ENDPOINT = "/auth/me";
  const PREFERENCES_ENDPOINT = "/profile/preferences";
  const PHOTO_ENDPOINT = "/profile/photo";
  const PARENT_COMPLETE_ENDPOINT = "/profile/parent-complete";

  /*
   * FIX-8: public frontend host -> public backend API base.
   *
   * The frontend URL and the backend API URL are DIFFERENT public
   * addresses (two tunnels). The browser's own hostname is never reused
   * as the API host. The pair below is the one that was already in this
   * file. Cloudflare quick tunnels get a NEW random hostname every time
   * cloudflared is restarted, so when either tunnel is restarted, update
   * this pair (or set window.BARAKALINK_API_BASE before this script loads)
   * and add the new frontend origin to the backend CORS allow-list.
   */

const PUBLIC_API_BY_FRONTEND_HOST = Object.freeze({
  "mkv360.github.io":
    "https://recently-reg-conditioning-instances.trycloudflare.com/api"
});


  function isLoopbackHost(hostname) {
    return hostname === "localhost" || hostname === "127.0.0.1";
  }

  function cleanApiBase(value) {
    return String(value || "").trim().replace(/\/+$/, "");
  }

  /*
   * Rejects API addresses that can never work from the current page:
   *  - a localhost API on a page that is not itself on localhost
   *    (on a phone, "localhost" is the phone, not the computer);
   *  - an http:// API on an https:// page (blocked as mixed content).
   */
  function isUsableApiBase(base) {
    try {
      const url = new URL(base, window.location.origin);
      const pageIsLoopback = isLoopbackHost(window.location.hostname);
      const baseIsLoopback = isLoopbackHost(url.hostname);

      if (url.protocol !== "https:" && url.protocol !== "http:") {
        return false;
      }

      if (baseIsLoopback && !pageIsLoopback) {
        return false;
      }

      if (
        window.location.protocol === "https:" &&
        url.protocol === "http:" &&
        !baseIsLoopback
      ) {
        return false;
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  function resolveApiBase() {
    const pageHost = window.location.hostname;

    /* 1. Explicit override (existing knob), now honored on every host. */
    const override = cleanApiBase(window.BARAKALINK_API_BASE);

    if (override) {
      if (isUsableApiBase(override)) {
        return override;
      }

      console.warn(
        `BarakaLink: ignoring window.BARAKALINK_API_BASE (${override}); it cannot work from ${window.location.origin}.`
      );
    }

    /* 2. Known public frontend host -> its separate public backend. */
    const mapped = Object.prototype.hasOwnProperty.call(
      PUBLIC_API_BY_FRONTEND_HOST,
      pageHost
    )
      ? cleanApiBase(PUBLIC_API_BY_FRONTEND_HOST[pageHost])
      : "";

    if (mapped && isUsableApiBase(mapped)) {
      return mapped;
    }

    /* 3. Normal computer development (unchanged). */
    if (isLoopbackHost(pageHost)) {
      return "http://localhost:5000/api";
    }

    /*
     * 4. Any other https page (an unmapped public/tunnel host): there is
     *    no valid API address to guess. "http://<this-host>:5000/api" would
     *    be the wrong host, the wrong port and blocked as mixed content.
     */
    if (window.location.protocol === "https:") {
      console.error(
        `BarakaLink: no API address is configured for "${pageHost}". ` +
        "Set window.BARAKALINK_API_BASE (an https URL ending in /api) or add " +
        "this host to PUBLIC_API_BY_FRONTEND_HOST in profile-completion.js."
      );
      return "";
    }

    /* 5. Phone / LAN development over plain http (unchanged). */
    return `http://${pageHost}:5000/api`;
  }

  const API_BASE = resolveApiBase();
  const API_ORIGIN = computeApiOrigin(API_BASE);

  const DEFAULT_PAGE = "index.html";
const DASHBOARD_PARENT = "dashboard/student.html";
  const DASHBOARD_USTAZ = "dashboard/teacher.html";

  const TOTAL_STEPS = 5;

  const MAX_PROFILE_PHOTO_BYTES = 5 * 1024 * 1024;
  const MAX_FAYDA_BYTES = 8 * 1024 * 1024;
  const MAX_SELFIE_BYTES = 5 * 1024 * 1024;

  /* FIX-3: sessionStorage key for the wizard checkpoint. */
  const WIZARD_CHECKPOINT_KEY = "barakalink_parent_profile_wizard_v1";

  /* FIX-5: default helper text shown in the idle selfie state. */
  const DEFAULT_SELFIE_STATUS =
    "Start the camera, center your face, and take one clear selfie.";

  const ALLOWED_IMAGE_TYPES = new Set([
    "image/jpeg",
    "image/png",
    "image/webp"
  ]);

  const ALLOWED_CONTENT_INTERESTS = new Set([
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

  const ALLOWED_STUDY_INTERESTS = new Set([
    "quran-basic",
    "tajweed",
    "hifz",
    "tafseer",
    "hadith",
    "tarbiyah"
  ]);

  const ALLOWED_TEACHER_GENDER_PREFERENCES = new Set([
    "male",
    "female",
    "no-preference"
  ]);

  const AREA_OPTIONS = Object.freeze({
    bole: [
      { value: "bole-medhanialem", label: "Bole Medhanialem" },
      { value: "atlas", label: "Atlas" },
      { value: "gerji", label: "Gerji" },
      { value: "airport", label: "Airport" }
    ],
    yeka: [
      { value: "cmc", label: "CMC" },
      { value: "kotebe", label: "Kotebe" },
      { value: "megenagna", label: "Megenagna" },
      { value: "yeka-abado", label: "Yeka Abado" }
    ],
    kirkos: [
      { value: "kazanchis", label: "Kazanchis" },
      { value: "mexico", label: "Mexico" },
      { value: "meskel-square", label: "Meskel Square" },
      { value: "wello-sefer", label: "Wello Sefer" }
    ],
    arada: [
      { value: "piazza", label: "Piazza" },
      { value: "arat-kilo", label: "Arat Kilo" },
      { value: "shiro-meda", label: "Shiro Meda" }
    ],
    lideta: [
      { value: "lideta", label: "Lideta" },
      { value: "teklehaimanot", label: "Teklehaimanot" },
      { value: "tewodros", label: "Tewodros" }
    ],
    "nifas-silk": [
      { value: "sar-bet", label: "Sar Bet" },
      { value: "lafto", label: "Lafto" },
      { value: "weyra", label: "Weyra" }
    ],
    kolfe: [
      { value: "kolfe", label: "Kolfe" },
      { value: "bethel", label: "Bethel" },
      { value: "ayer-tena", label: "Ayer Tena" }
    ],
    akaki: [
      { value: "akaki", label: "Akaki" },
      { value: "kaliti", label: "Kaliti" },
      { value: "qality", label: "Qality" }
    ]
  });

  /* =======================================================
     DOM REFERENCES
  ======================================================= */

  const form = document.getElementById("profileCompletionForm");

  /*
   * FIX-6: install the submit handler BEFORE anything else.
   *
   * handleFormSubmit is a function declaration (hoisted), and its very
   * first statement is event.preventDefault(), so a native POST to
   * profile-completion.html (HTTP 405 on the static server) cannot happen
   * once this line has run, even if some later top-level statement in this
   * file were to throw. The inline onsubmit="return false;" in the HTML
   * stays as the safety net for the one case this file cannot cover: the
   * script not running at all (404 on the path, syntax error, blocked).
   */
  if (form) {
    form.addEventListener("submit", handleFormSubmit);
  } else {
    console.error(
      "profileCompletionForm was not found; the profile wizard cannot start."
    );
  }

  const stepOne = document.getElementById("profileStepOne");
  const stepTwo = document.getElementById("profileStepTwo");
  const stepThree = document.getElementById("profileStepThree");
  const stepFour = document.getElementById("profileStepFour");
  const stepFive = document.getElementById("profileStepFive");

  const stepElements = [
    stepOne,
    stepTwo,
    stepThree,
    stepFour,
    stepFive
  ];

  const stepTitle = document.getElementById("profileStepTitle");
  const stepDescription = document.getElementById("profileStepDescription");
  const progressNumber = document.getElementById("profileProgressNumber");
  const stepIndicator = document.getElementById("profileStepIndicator");

  const roleInput = document.getElementById("profileRole");
  const firstNameInput = document.getElementById("profileFirstName");
  const lastNameInput = document.getElementById("profileLastName");
  const phoneInput = document.getElementById("profilePhone");
  const phoneVerified = document.getElementById("profilePhoneVerified");
  const subcityInput = document.getElementById("profileSubcity");
  const areaInput = document.getElementById("profileArea");
  const nearestMosqueInput = document.getElementById("profileNearestMosque");

  const ustazSection = document.getElementById("ustazProfileSection");
  const experienceInput = document.getElementById("profileExperience");
  const genderInput = document.getElementById("profileGender");
  const studyFieldInputs = document.querySelectorAll('input[name="studyFields"]');

  const profilePhotoInput = document.getElementById("profilePhoto");
  const profilePhotoPreview = document.getElementById("profilePhotoPreview");
  const profilePhotoPlaceholder = document.getElementById("profilePhotoPlaceholder");
  const profilePhotoChangeButton = document.getElementById("profilePhotoChangeButton");
  const profilePhotoRemoveButton = document.getElementById("profilePhotoRemoveButton");

  const profileBioInput = document.getElementById("profileBio");
  const profileBioCount = document.getElementById("profileBioCount");
  const studyInterestInputs = document.querySelectorAll('input[name="studyInterests"]');
  const contentInterestInputs = document.querySelectorAll('input[name="contentInterests"]');
  const teacherGenderPreferenceInputs = document.querySelectorAll('input[name="preferredTeacherGender"]');

  const faydaFrontInput = document.getElementById("parentFaydaFront");
  const faydaFrontCameraInput = document.getElementById("parentFaydaFrontCamera");
  const faydaFrontPreview = document.getElementById("parentFaydaFrontPreview");
  const faydaFrontPlaceholder = document.getElementById("parentFaydaFrontPlaceholder");
  const faydaFrontUploadButton = document.getElementById("parentFaydaFrontUploadButton");
  const faydaFrontCaptureButton = document.getElementById("parentFaydaFrontCaptureButton");
  const faydaFrontRemoveButton = document.getElementById("parentFaydaFrontRemoveButton");

  const faydaBackInput = document.getElementById("parentFaydaBack");
  const faydaBackCameraInput = document.getElementById("parentFaydaBackCamera");
  const faydaBackPreview = document.getElementById("parentFaydaBackPreview");
  const faydaBackPlaceholder = document.getElementById("parentFaydaBackPlaceholder");
  const faydaBackUploadButton = document.getElementById("parentFaydaBackUploadButton");
  const faydaBackCaptureButton = document.getElementById("parentFaydaBackCaptureButton");
  const faydaBackRemoveButton = document.getElementById("parentFaydaBackRemoveButton");

  /* Step 4 card (shows the CONFIRMED selfie only; data-mode drives the CSS). */
  const selfieCard = document.getElementById("parentSelfieCard");
  const selfieVideo = document.getElementById("parentSelfieVideo");
  const selfieCanvas = document.getElementById("parentSelfieCanvas");
  const selfiePreview = document.getElementById("parentSelfiePreview");
  const selfiePlaceholder = document.getElementById("parentSelfiePlaceholder");
  const selfieStartButton = document.getElementById("parentSelfieStartButton");
  const selfieCaptureButton = document.getElementById("parentSelfieCaptureButton");
  const selfieRetakeButton = document.getElementById("parentSelfieRetakeButton");
  const selfieStatus = document.getElementById("parentSelfieStatus");

  /* FIX-7: in-page camera modal (all IDs already exist in the HTML). */
  const pageShell = document.querySelector(".profile-completion-page");
  const selfieModal = document.getElementById("parentSelfieCameraModal");
  const selfieModalVideo = document.getElementById("parentSelfieModalVideo");
  const selfieModalPreview = document.getElementById("parentSelfieModalPreview");
  const selfieModalStage = document.getElementById("parentSelfieCameraStage");
  const selfieModalGuide = document.getElementById("parentSelfieFaceGuide");
  const selfieModalPlaceholder = document.getElementById("parentSelfieCameraPlaceholder");
  const selfieModalStatus = document.getElementById("parentSelfieModalStatus");
  const selfieModalCloseButton = document.getElementById("parentSelfieModalCloseButton");
  const selfieModalStartButton = document.getElementById("parentSelfieModalStartButton");
  const selfieModalCaptureButton = document.getElementById("parentSelfieModalCaptureButton");
  const selfieModalRetakeButton = document.getElementById("parentSelfieModalRetakeButton");
  const selfieModalUseButton = document.getElementById("parentSelfieModalUseButton");

  const reviewConfirmation = document.getElementById("profileReviewConfirmation");

  const statusElement = document.getElementById("profileStatus");
  const saveButton = document.getElementById("profileSaveButton");
  const saveButtonText = document.getElementById("profileSaveButtonText");
  const saveButtonIcon = document.getElementById("profileSaveButtonIcon");
  const backButton = document.getElementById("profileBackButton");
  const logoutButton = document.getElementById("profileLogoutButton");
  const headerLogoutButton = document.getElementById("logoutButton");
  const completionNote = document.getElementById("profileCompletionNote");

  /* =======================================================
     STATE
  ======================================================= */

  let currentUser = null;
  let currentStep = 1;
  let submitting = false;

  /* FIX-1: one-time initialisation flags. */
  let initStarted = false;
  let pageStateInitialized = false;
  let wizardStarted = false;

  /* FIX-10: true only while loadCurrentUser() is running. */
  let loadInFlight = false;

  let profilePhotoFile = null;
  let profilePhotoObjectUrl = null;
  let existingAvatarUrl = "";

  let faydaFrontFile = null;
  let faydaFrontObjectUrl = null;
  let faydaBackFile = null;
  let faydaBackObjectUrl = null;

  /* selfieFile / selfieObjectUrl = the CONFIRMED selfie (what Step 5 submits). */
  let selfieFile = null;
  let selfieObjectUrl = null;
  let selfieStream = null;

  /* FIX-4: camera lifecycle guards. */
  let selfieCameraRequestId = 0;
  let selfieStarting = false;
  let selfieCapturing = false;

  /* FIX-7: modal state. The pending selfie is captured but NOT yet confirmed. */
  let selfiePendingFile = null;
  let selfiePendingObjectUrl = null;
  let selfieModalOpen = false;
  let selfieModalOpener = null;
  let selfieModalPreviousOverflow = "";

  let storedStepTwoData = {
    bio: "",
    studyInterests: [],
    contentInterests: [],
    preferredTeacherGender: "no-preference"
  };

  /* =======================================================
     BASIC HELPERS
  ======================================================= */

  function setStatus(message, type = "") {
    if (!statusElement) return;

    statusElement.textContent = message || "";
    statusElement.classList.remove("success", "error", "loading");

    if (type) {
      statusElement.classList.add(type);
    }
  }

  function setError(id, message) {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = message || "";
    }
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
      "profileTeacherGenderError",
      "parentFaydaFrontError",
      "parentFaydaBackError",
      "parentSelfieError",
      "profileReviewConfirmationError"
    ].forEach((id) => setError(id, ""));

    setStatus("");
  }

  function scrollToFirstError(scopeSelector) {
    const scope = document.querySelector(scopeSelector) || document;
    const firstError = scope.querySelector(".form-error:not(:empty)");

    if (firstError) {
      firstError.scrollIntoView({
        behavior: "smooth",
        block: "center"
      });
    }
  }

  function getToken() {
    if (
      !window.BarakaLinkAPI ||
      typeof window.BarakaLinkAPI.getToken !== "function"
    ) {
      return null;
    }

    return window.BarakaLinkAPI.getToken();
  }

  /*
   * FIX-9: single entry point for this file's raw fetch() calls.
   *
   * A browser reports "server unreachable", "blocked by CORS" and
   * "blocked as mixed content" all as the same bare TypeError ("Failed to
   * fetch" / "Load failed"), which tells a parent nothing and gives a
   * phone tester nothing to act on. This turns that into one readable
   * message that names the API address actually used, and logs the real
   * error to the console. HTTP error responses (4xx/5xx) are NOT handled
   * here - they still reach the callers' existing response.ok handling.
   */
  async function apiFetch(path, options, stage) {
    if (!API_BASE) {
      const configError = new Error(
        "This page has no backend API address configured, so it cannot reach the BarakaLink server. Please contact BarakaLink support."
      );
      configError.configuration = true;

      if (stage) {
        configError.stage = stage;
      }

      throw configError;
    }

    try {
      return await fetch(`${API_BASE}${path}`, options);
    } catch (networkError) {
      console.error(
        "BarakaLink API request could not be completed:",
        `${API_BASE}${path}`,
        networkError
      );

      const error = new Error(
        `Cannot reach the BarakaLink server (${API_ORIGIN}). Check your internet connection and try again.`
      );
      error.network = true;
      error.cause = networkError;

      if (stage) {
        error.stage = stage;
      }

      throw error;
    }
  }

  function logout() {
    /* FIX-7: closes the camera modal too, and releases any camera stream. */
    closeSelfieModal({ restoreFocus: false, refreshCard: false });
    clearWizardCheckpoint(); /* FIX-3 */

    if (
      window.BarakaLinkAPI &&
      typeof window.BarakaLinkAPI.clearToken === "function"
    ) {
      window.BarakaLinkAPI.clearToken();
    }

    try {
      sessionStorage.removeItem("barakalink_telegram_ticket");
    } catch (error) {
      console.warn("Unable to clear Telegram session reference:", error);
    }

    releaseAllObjectUrls();
    window.location.replace(DEFAULT_PAGE);
  }

  /* =======================================================
     ROLE / PHONE HELPERS
  ======================================================= */

  function normalizeRole(value) {
    return String(value || "").trim().toLowerCase();
  }

  function roleLabel(role) {
    return normalizeRole(role) === "ustaz"
      ? "Ustaz / Ustaza"
      : "Parent / Student";
  }

  function dashboardForRole(role) {
    return normalizeRole(role) === "ustaz"
      ? DASHBOARD_USTAZ
      : DASHBOARD_PARENT;
  }

  function formatPhoneForDisplay(value) {
    const phone = String(value || "").replace(/\D/g, "");

    if (phone.startsWith("251") && phone.length === 12) {
      return `${phone.slice(3, 6)} ${phone.slice(6, 9)} ${phone.slice(9)}`;
    }

    if (phone.startsWith("0") && phone.length === 10) {
      return `${phone.slice(1, 4)} ${phone.slice(4, 7)} ${phone.slice(7)}`;
    }

    return value || "";
  }

  function normalizePhoneForSubmit(value) {
    let phone = String(value || "").replace(/\D/g, "");

    if (phone.startsWith("00")) {
      phone = phone.slice(2);
    }

    if (phone.startsWith("251")) {
      return phone;
    }

    if (phone.startsWith("0")) {
      phone = phone.slice(1);
    }

    if (phone.startsWith("9") && phone.length === 9) {
      return `251${phone}`;
    }

    return phone;
  }

  /* =======================================================
     PROFILE RESPONSE NORMALIZATION
  ======================================================= */

  function extractUser(response) {
    if (response?.data?.user && typeof response.data.user === "object") {
      return response.data.user;
    }

    if (response?.user && typeof response.user === "object") {
      return response.user;
    }

    if (
      response?.data &&
      typeof response.data === "object" &&
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

  function buildProfileCompletionUser(response) {
    const data =
      response?.data && typeof response.data === "object"
        ? response.data
        : response || {};

    const baseUser = extractUser(response) || {};

    const student =
      data?.student && typeof data.student === "object"
        ? data.student
        : baseUser?.student && typeof baseUser.student === "object"
          ? baseUser.student
          : {};

    const teacherProfile =
      data?.teacherProfile && typeof data.teacherProfile === "object"
        ? data.teacherProfile
        : baseUser?.teacherProfile && typeof baseUser.teacherProfile === "object"
          ? baseUser.teacherProfile
          : {};

    const studyFields = Array.isArray(data?.studyFields)
      ? data.studyFields
      : Array.isArray(baseUser?.studyFields)
        ? baseUser.studyFields
        : [];

    return {
      ...baseUser,
      student,
      teacherProfile,
      studyFields,

      firstName:
        baseUser?.firstName ??
        baseUser?.first_name ??
        data?.firstName ??
        data?.first_name ??
        "",

      lastName:
        baseUser?.lastName ??
        baseUser?.last_name ??
        data?.lastName ??
        data?.last_name ??
        "",

      phone:
        baseUser?.phone ??
        baseUser?.phone_number ??
        data?.phone ??
        data?.phone_number ??
        "",

      role:
        baseUser?.role ??
        data?.role ??
        "",

      avatarUrl:
        baseUser?.avatarUrl ??
        baseUser?.avatar_url ??
        data?.avatarUrl ??
        data?.avatar_url ??
        "",
subcity:
  baseUser?.subcity ||
  baseUser?.profile?.subcity ||
  student?.subcity ||
  teacherProfile?.subcity ||
  "",

subcityName:
  baseUser?.subcityName ||
  student?.subcityName ||
  teacherProfile?.subcityName ||
  "",

area:
  baseUser?.area ||
  baseUser?.profile?.area ||
  student?.area ||
  teacherProfile?.area ||
  "",

areaName:
  baseUser?.areaName ||
  student?.areaName ||
  teacherProfile?.areaName ||
  "",

nearestMosque:
  baseUser?.nearestMosque ||
  baseUser?.nearest_mosque ||
  baseUser?.profile?.nearestMosque ||
  baseUser?.profile?.nearest_mosque ||
  student?.nearestMosque ||
  student?.nearest_mosque ||
  teacherProfile?.nearestMosque ||
  teacherProfile?.nearest_mosque ||
  "",
      profileReviewStatus:
        baseUser?.profileReviewStatus ??
        baseUser?.profile_review_status ??
        student?.profileReviewStatus ??
        student?.profile_review_status ??
        "",

      profileSubmittedAt:
        baseUser?.profileSubmittedAt ??
        baseUser?.profile_submitted_at ??
        student?.profileSubmittedAt ??
        student?.profile_submitted_at ??
        null,

      profileReviewedAt:
        baseUser?.profileReviewedAt ??
        baseUser?.profile_reviewed_at ??
        student?.profileReviewedAt ??
        student?.profile_reviewed_at ??
        null,

      profileRejectionReason:
        baseUser?.profileRejectionReason ??
        baseUser?.profile_rejection_reason ??
        student?.profileRejectionReason ??
        student?.profile_rejection_reason ??
        ""
    };
  }

  function getFirstName(user) {
    return (
      user?.firstName ??
      user?.first_name ??
      user?.profile?.firstName ??
      user?.profile?.first_name ??
      ""
    );
  }

  function getLastName(user) {
    return (
      user?.lastName ??
      user?.last_name ??
      user?.profile?.lastName ??
      user?.profile?.last_name ??
      ""
    );
  }

  function getPhone(user) {
    return (
      user?.phone ??
      user?.phone_number ??
      user?.profile?.phone ??
      ""
    );
  }

  function getSubcity(user) {
    return (
      user?.subcity ??
      user?.profile?.subcity ??
      user?.student?.subcity ??
      user?.studentProfile?.subcity ??
      user?.teacherProfile?.subcity ??
      ""
    );
  }

  function getArea(user) {
    return (
      user?.area ??
      user?.profile?.area ??
      user?.student?.area ??
      user?.studentProfile?.area ??
      user?.teacherProfile?.area ??
      ""
    );
  }

  function getNearestMosque(user) {
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

  function getExperience(user) {
    return (
      user?.experience ??
      user?.teacherProfile?.experience ??
      user?.teacher_profile?.experience ??
      ""
    );
  }

  function getGender(user) {
    return (
      user?.gender ??
      user?.teacherProfile?.gender ??
      user?.teacher_profile?.gender ??
      ""
    );
  }

  function getStudyFields(user) {
    const fields =
      user?.studyFields ??
      user?.study_fields ??
      user?.teacherProfile?.studyFields ??
      user?.teacherProfile?.study_fields ??
      user?.teacher_profile?.studyFields ??
      user?.teacher_profile?.study_fields ??
      [];

    if (!Array.isArray(fields)) {
      return [];
    }

    return fields
      .map((field) => {
        if (typeof field === "string") {
          return field;
        }

        return field?.slug ?? field?.field_key ?? field?.value ?? "";
      })
      .filter(Boolean);
  }

  function getReviewStatus(user) {
    return String(
      user?.profileReviewStatus ??
      user?.profile_review_status ??
      ""
    )
      .trim()
      .toLowerCase();
  }

  function isProfileCompleted(user) {
    const value = user?.profileCompleted ?? user?.profile_completed;

    return value === true || value === 1 || value === "1";
  }

  /* =======================================================
     AREA SELECT
  ======================================================= */

  function populateAreas(subcityValue, selectedArea = "") {
    if (!areaInput) return;

    areaInput.innerHTML = "";

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = subcityValue
      ? "Select Area"
      : "Select Sub-City first";
    areaInput.appendChild(placeholder);

    const key = String(subcityValue || "").trim().toLowerCase();
    const locations = AREA_OPTIONS[key] || [];

    locations.forEach((location) => {
      const option = document.createElement("option");
      option.value = location.value;
      option.textContent = location.label;
      areaInput.appendChild(option);
    });

    areaInput.disabled = locations.length === 0;

    if (!selectedArea) return;

    const normalizedArea = String(selectedArea).trim().toLowerCase();
    const matchingOption = Array.from(areaInput.options).find((option) => {
      return (
        option.value === normalizedArea ||
        option.textContent.trim().toLowerCase() === normalizedArea
      );
    });

    if (matchingOption) {
      areaInput.value = matchingOption.value;
    }
  }

  /* =======================================================
     ROLE UI
  ======================================================= */

  function applyRoleUI(role) {
    const normalizedRole = normalizeRole(role);

    if (roleInput) {
      roleInput.value = roleLabel(normalizedRole);
    }

    if (ustazSection) {
      ustazSection.hidden = normalizedRole !== "ustaz";
    }
  }

  /* =======================================================
     CHECKBOX / RADIO HELPERS
  ======================================================= */

  function updateInputCardState(input) {
    if (!input) return;

    const card = input.closest(".role-option");
    if (!card) return;

    card.classList.toggle("active", Boolean(input.checked));
  }

  function initializeInputCardStates() {
    [
      ...Array.from(studyFieldInputs),
      ...Array.from(studyInterestInputs),
      ...Array.from(contentInterestInputs),
      ...Array.from(teacherGenderPreferenceInputs)
    ].forEach(updateInputCardState);
  }

  function getCheckedValues(inputs) {
    return Array.from(inputs || [])
      .filter((input) => input.checked)
      .map((input) => String(input.value || "").trim().toLowerCase())
      .filter(Boolean);
  }

  function getSelectedRadioValue(inputs) {
    const selected = Array.from(inputs || []).find((input) => input.checked);

    return selected
      ? String(selected.value || "").trim().toLowerCase()
      : "";
  }

  /* =======================================================
     STEP 1 FORM POPULATION
  ======================================================= */

  function applyUserToForm(user) {
    currentUser = user;

    existingAvatarUrl =
      user?.avatarUrl ??
      user?.avatar_url ??
      existingAvatarUrl ??
      "";

    const role = normalizeRole(user?.role);
    applyRoleUI(role);

    if (firstNameInput) {
      firstNameInput.readOnly = false;
      firstNameInput.value = getFirstName(user);
    }

    if (lastNameInput) {
      lastNameInput.readOnly = false;
      lastNameInput.value = getLastName(user);
    }

    if (phoneInput) {
      phoneInput.value = formatPhoneForDisplay(getPhone(user));
      phoneInput.readOnly = true;
      phoneInput.disabled = false;
    }

    if (phoneVerified) {
      phoneVerified.hidden = !getPhone(user);
    }

    const subcity = getSubcity(user);

    if (subcityInput) {
      subcityInput.value = String(subcity || "").trim().toLowerCase();
    }

    populateAreas(subcity, getArea(user));

    if (nearestMosqueInput) {
      nearestMosqueInput.value = getNearestMosque(user);
    }

    if (normalizeRole(user?.role) === "ustaz") {
      if (experienceInput) {
        const experience = getExperience(user);
        experienceInput.value =
          experience === null || experience === undefined
            ? ""
            : experience;
      }

      if (genderInput) {
        genderInput.value = String(getGender(user) || "")
          .trim()
          .toLowerCase();
      }

      const selectedFields = new Set(
        getStudyFields(user).map((field) =>
          String(field).trim().toLowerCase()
        )
      );

      studyFieldInputs.forEach((input) => {
        input.checked = selectedFields.has(
          String(input.value).trim().toLowerCase()
        );
        updateInputCardState(input);
      });
    }

    renderProfilePhotoState();
  }

  /* =======================================================
     PREFERENCES LOAD / APPLY
  ======================================================= */

  async function loadSavedPreferences() {
    if (!window.BarakaLinkAPI) return;

    try {
      const response = await window.BarakaLinkAPI.get(PREFERENCES_ENDPOINT);

      if (!response?.success) {
        return;
      }

      const data = response?.data || {};

      storedStepTwoData = {
        bio: String(data?.bio || ""),
        studyInterests: Array.isArray(data?.studyInterests)
          ? data.studyInterests.map((value) =>
              String(value).trim().toLowerCase()
            )
          : [],
        contentInterests: Array.isArray(data?.contentInterests)
          ? data.contentInterests.map((value) =>
              String(value).trim().toLowerCase()
            )
          : [],
        preferredTeacherGender:
          String(data?.preferredTeacherGender || "no-preference")
            .trim()
            .toLowerCase()
      };

      if (profileBioInput) {
        profileBioInput.value = storedStepTwoData.bio;
      }

      studyInterestInputs.forEach((input) => {
        input.checked = storedStepTwoData.studyInterests.includes(
          String(input.value).trim().toLowerCase()
        );
        updateInputCardState(input);
      });

      contentInterestInputs.forEach((input) => {
        input.checked = storedStepTwoData.contentInterests.includes(
          String(input.value).trim().toLowerCase()
        );
        updateInputCardState(input);
      });

      teacherGenderPreferenceInputs.forEach((input) => {
        input.checked =
          String(input.value).trim().toLowerCase() ===
          storedStepTwoData.preferredTeacherGender;
        updateInputCardState(input);
      });

      updateBioCounter();
    } catch (error) {
      console.warn("Unable to load saved Parent preferences:", error);
    }
  }

  function collectStepTwoData() {
    return {
      bio: profileBioInput?.value.trim() || "",
      studyInterests: getCheckedValues(studyInterestInputs),
      contentInterests: getCheckedValues(contentInterestInputs),
      preferredTeacherGender:
        getSelectedRadioValue(teacherGenderPreferenceInputs) ||
        "no-preference"
    };
  }

  /* =======================================================
     VALIDATION - STEP 1
  ======================================================= */

  function validateStepOne() {
    clearErrors();
    let valid = true;

    const firstName = firstNameInput?.value.trim() || "";
    const lastName = lastNameInput?.value.trim() || "";

    if (!firstName || !lastName) {
      setError("profileNameError", "Enter your first and last name.");
      valid = false;
    }

    if (firstName.length > 100) {
      setError("profileNameError", "First name is too long.");
      valid = false;
    }

    if (lastName.length > 100) {
      setError("profileNameError", "Last name is too long.");
      valid = false;
    }

    const phone = normalizePhoneForSubmit(
      getPhone(currentUser) || phoneInput?.value || ""
    );

    if (!/^2519\d{8}$/.test(phone)) {
      setError("profilePhoneError", "Your verified phone number is invalid.");
      valid = false;
    }

    const subcity = subcityInput?.value.trim().toLowerCase() || "";
    if (!subcity) {
      setError("profileSubcityError", "Please select your sub-city.");
      valid = false;
    }

    const area = areaInput?.value.trim().toLowerCase() || "";
    if (!area) {
      setError("profileAreaError", "Please select your area.");
      valid = false;
    }

    const nearestMosque = nearestMosqueInput?.value.trim() || "";
    if (!nearestMosque) {
      setError(
        "profileNearestMosqueError",
        "Enter the name of your nearest mosque."
      );
      valid = false;
    }

    if (nearestMosque.length > 150) {
      setError(
        "profileNearestMosqueError",
        "Nearest mosque name is too long."
      );
      valid = false;
    }

    if (normalizeRole(currentUser?.role) === "ustaz") {
      const experienceRaw = experienceInput?.value.trim() || "";
      const experience = Number(experienceRaw);
      const gender = genderInput?.value.trim().toLowerCase() || "";
      const studyFields = getCheckedValues(studyFieldInputs);

      if (
        experienceRaw === "" ||
        !Number.isInteger(experience) ||
        experience < 0 ||
        experience > 60
      ) {
        setError(
          "profileExperienceError",
          "Enter teaching experience from 0 to 60 years."
        );
        valid = false;
      }

      if (!["male", "female"].includes(gender)) {
        setError("profileGenderError", "Please select your gender.");
        valid = false;
      }

      if (studyFields.length === 0) {
        setError(
          "profileStudyFieldsError",
          "Select at least one study field."
        );
        valid = false;
      }
    }

    if (!valid) {
      scrollToFirstError("#profileStepOne");
    }

    return valid;
  }

  /* =======================================================
     VALIDATION - STEP 2
  ======================================================= */

  function hasProfilePhoto() {
    return Boolean(profilePhotoFile || existingAvatarUrl);
  }

  function validateStepTwo() {
    clearErrors();
    let valid = true;

    const bio = profileBioInput?.value.trim() || "";

    if (bio.length > 500) {
      setError(
        "profileBioError",
        "About you must be 500 characters or fewer."
      );
      valid = false;
    }

    const selectedStudyInterests = getCheckedValues(studyInterestInputs);
    if (
      selectedStudyInterests.some(
        (value) => !ALLOWED_STUDY_INTERESTS.has(value)
      )
    ) {
      setError(
        "profileStudyInterestsError",
        "One or more study interests are invalid."
      );
      valid = false;
    }

    const selectedContentInterests = getCheckedValues(contentInterestInputs);
    if (
      selectedContentInterests.some(
        (value) => !ALLOWED_CONTENT_INTERESTS.has(value)
      )
    ) {
      setError(
        "profileContentInterestsError",
        "One or more Islamic content interests are invalid."
      );
      valid = false;
    }

    const teacherPreference = getSelectedRadioValue(
      teacherGenderPreferenceInputs
    );

    if (!ALLOWED_TEACHER_GENDER_PREFERENCES.has(teacherPreference)) {
      setError(
        "profileTeacherGenderError",
        "Please select a valid teacher preference."
      );
      valid = false;
    }

    if (profilePhotoFile) {
      if (!ALLOWED_IMAGE_TYPES.has(profilePhotoFile.type)) {
        setError(
          "profilePhotoError",
          "Profile photo must be JPG, PNG, or WebP."
        );
        valid = false;
      } else if (profilePhotoFile.size > MAX_PROFILE_PHOTO_BYTES) {
        setError(
          "profilePhotoError",
          "Profile photo must be 5 MB or smaller."
        );
        valid = false;
      }
    }

    if (!hasProfilePhoto()) {
      setError(
        "profilePhotoError",
        "Please add your profile photo before continuing."
      );
      valid = false;
    }

    if (!valid) {
      scrollToFirstError("#profileStepTwo");
    }

    return valid;
  }

  /* =======================================================
     VALIDATION - STEP 3 FAYDA
  ======================================================= */

  function validateFaydaFile(file, errorId, label) {
    if (!file) return true;

    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      setError(errorId, `${label} must be JPG, PNG, or WebP.`);
      return false;
    }

    if (file.size > MAX_FAYDA_BYTES) {
      setError(errorId, `${label} must be 8 MB or smaller.`);
      return false;
    }

    return true;
  }

  function hasExistingFaydaFront() {
    return Boolean(
      currentUser?.student?.hasFaydaFront ??
      currentUser?.student?.has_fayda_front ??
      currentUser?.hasFaydaFront
    );
  }

  function hasExistingFaydaBack() {
    return Boolean(
      currentUser?.student?.hasFaydaBack ??
      currentUser?.student?.has_fayda_back ??
      currentUser?.hasFaydaBack
    );
  }

  function hasExistingSelfie() {
    return Boolean(
      currentUser?.student?.hasSelfie ??
      currentUser?.student?.has_selfie ??
      currentUser?.hasSelfie
    );
  }

  function validateStepThree() {
    setError("parentFaydaFrontError", "");
    setError("parentFaydaBackError", "");

    let valid = true;

    const frontExists = Boolean(
      faydaFrontFile || hasExistingFaydaFront()
    );

    const backExists = Boolean(
      faydaBackFile || hasExistingFaydaBack()
    );

    if (!frontExists) {
      setError(
        "parentFaydaFrontError",
        "Please provide the front side of your Fayda National ID."
      );
      valid = false;
    } else if (faydaFrontFile && !validateFaydaFile(
      faydaFrontFile,
      "parentFaydaFrontError",
      "Fayda front"
    )) {
      valid = false;
    }

    if (!backExists) {
      setError(
        "parentFaydaBackError",
        "Please provide the back side of your Fayda National ID."
      );
      valid = false;
    } else if (faydaBackFile && !validateFaydaFile(
      faydaBackFile,
      "parentFaydaBackError",
      "Fayda back"
    )) {
      valid = false;
    }

    if (!valid) {
      scrollToFirstError("#profileStepThree");
    }

    return valid;
  }

  /* =======================================================
     VALIDATION - STEP 4 SELFIE
     (validates the CONFIRMED selfie only; a pending capture
     inside the modal never counts)
  ======================================================= */

  function validateSelfie() {
    setError("parentSelfieError", "");

    if (selfieFile) {
      if (selfieFile.type !== "image/jpeg") {
        setError(
          "parentSelfieError",
          "The live selfie could not be prepared correctly. Please retake it."
        );
        return false;
      }

      if (selfieFile.size > MAX_SELFIE_BYTES) {
        setError(
          "parentSelfieError",
          "Selfie must be 5 MB or smaller."
        );
        return false;
      }

      return true;
    }

    if (hasExistingSelfie()) {
      return true;
    }

    setError(
      "parentSelfieError",
      "Please take a live selfie before continuing."
    );
    return false;
  }

  function validateStepFive() {
    /*
     * There is no separate confirmation-checkbox requirement.
     * By reaching Step 5, the wizard has already required: 
     * - a server-confirmed profile photo
     * - Fayda front + back
     * - a live selfie
     *
     * The final Submit button itself is the user's submission action.
     */
    setError("profileReviewConfirmationError", "");
    return true;
  }

  /* =======================================================
     STEP UI
  ======================================================= */

  const STEP_META = {
    1: {
      title: "Your information",
      description:
        "Review your account information and complete the required details.",
      button: "Save & Continue",
      icon: "fa-solid fa-arrow-right",
      note:
        "Your registration information is saved before you continue to your Parent profile."
    },
    2: {
      title: "Your Parent profile",
      description:
        "Add your profile photo and tell us about your learning interests.",
      button: "Continue to Fayda",
      icon: "fa-solid fa-arrow-right",
      note:
        "Your profile preferences are collected now and submitted together for manual review on the final page."
    },
    3: {
      title: "Fayda National ID",
      description:
        "Provide the front and back of your Fayda National ID for private manual review.",
      button: "Continue to Selfie",
      icon: "fa-solid fa-arrow-right",
      note:
        "Your Fayda National ID is private and is only used for authorized manual identity review."
    },
    4: {
      title: "Live selfie",
      description:
        "Use your device camera to take one clear live selfie.",
      button: "Continue to Review",
      icon: "fa-solid fa-arrow-right",
      note:
        "Your live selfie is private and will be submitted with your Fayda documents for manual review."
    },
    5: {
      title: "Review & submit",
      description:
        "Review everything carefully, confirm the information, and submit your Parent profile for manual review.",
      button: "Submit for Review",
      icon: "fa-solid fa-paper-plane",
      note:
        "After submission, your profile remains under review until a BarakaLink administrator makes a decision."
    }
  };

  function updateStepIndicator(step) {
    if (!stepIndicator) return;

    const items = stepIndicator.querySelectorAll(
      ".profile-step-indicator-item"
    );

    items.forEach((item) => {
      const itemStep = Number(item.dataset.step);
      item.classList.toggle("is-active", itemStep === step);
      item.classList.toggle("is-complete", itemStep < step);
      item.setAttribute("aria-current", itemStep === step ? "step" : "false");
    });
  }

  function setSaveButtonState(disabled, text, iconClass) {
    if (!saveButton) return;

    saveButton.disabled = Boolean(disabled);

    if (saveButtonText && text) {
      saveButtonText.textContent = text;
    }

    if (saveButtonIcon && iconClass) {
      saveButtonIcon.className = iconClass;
    }
  }

  function setStep(step) {
    const normalizedStep = Math.min(
      TOTAL_STEPS,
      Math.max(1, Number(step) || 1)
    );

    currentStep = normalizedStep;

    /*
     * FIX-4 / FIX-7: the live camera (and the camera modal) never survive
     * a step change. Leaving Step 4 (Back, Continue, any programmatic jump)
     * closes the modal, discards any unconfirmed capture and releases the
     * stream here, in one place, instead of relying on each caller to
     * remember. The confirmed selfie is untouched. Step 4's card is
     * re-rendered below, so no card refresh is needed from the close call.
     */
    closeSelfieModal({ restoreFocus: false, refreshCard: false });

    stepElements.forEach((element, index) => {
      if (element) {
        element.hidden = index + 1 !== normalizedStep;
      }
    });

    const meta = STEP_META[normalizedStep];

    if (stepTitle) {
      stepTitle.textContent = meta.title;
    }

    if (stepDescription) {
      stepDescription.textContent = meta.description;
    }

    if (progressNumber) {
      progressNumber.textContent = `Step ${normalizedStep} of ${TOTAL_STEPS}`;
    }

    updateStepIndicator(normalizedStep);

    if (backButton) {
      backButton.hidden = normalizedStep === 1;
    }

    if (completionNote) {
      completionNote.textContent = meta.note;
    }

    if (normalizedStep < TOTAL_STEPS) {
      setSaveButtonState(false, meta.button, meta.icon);
    } else {
      setSaveButtonState(false, meta.button, meta.icon);
    }

    clearErrors();

    if (normalizedStep === 2) {
      updateBioCounter();
    }

    if (normalizedStep === 4) {
      if (selfieFile) {
        showCapturedSelfie();
      } else {
        /* FIX-4/5: also restores the placeholder, which a stopped
           camera used to leave hidden (blank stage on re-entry). */
        showSelfieIdle();
      }
    }

    /* FIX-3: remember where the user is (no-op until the wizard started). */
    saveWizardCheckpoint();

    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  /* =======================================================
     WIZARD CHECKPOINT (FIX-3)

     Stores ONLY the current step number and the Step 2 text /
     preferences in sessionStorage (per tab, cleared when the tab
     closes). Fayda images, the selfie and tokens are never stored.

     Purpose: if the page is reloaded by something outside this
     script (a live-reload dev server, the mobile browser reclaiming
     the tab while the camera app is open, an accidental refresh),
     the wizard resumes where the user was instead of Step 1.
  ======================================================= */

  function getWizardUserKey() {
    const id = currentUser?.id ?? currentUser?.userId ?? currentUser?.user_id;

    if (id !== undefined && id !== null && id !== "") {
      return String(id);
    }

    return normalizePhoneForSubmit(getPhone(currentUser));
  }

  function saveWizardCheckpoint() {
    if (!wizardStarted || !currentUser) return;

    try {
      sessionStorage.setItem(
        WIZARD_CHECKPOINT_KEY,
        JSON.stringify({
          v: 1,
          userKey: getWizardUserKey(),
          step: currentStep,
          stepTwo: collectStepTwoData()
        })
      );
    } catch (error) {
      /* Storage unavailable (private mode / quota): resume is a bonus. */
    }
  }

  function readWizardCheckpoint() {
    try {
      const raw = sessionStorage.getItem(WIZARD_CHECKPOINT_KEY);
      if (!raw) return null;

      const data = JSON.parse(raw);

      if (!data || data.v !== 1) return null;
      if (String(data.userKey || "") !== getWizardUserKey()) return null;

      const step = Number(data.step);
      if (!Number.isInteger(step) || step < 1 || step > TOTAL_STEPS) {
        return null;
      }

      return {
        step,
        stepTwo:
          data.stepTwo && typeof data.stepTwo === "object"
            ? data.stepTwo
            : null
      };
    } catch (error) {
      return null;
    }
  }

  function clearWizardCheckpoint() {
    try {
      sessionStorage.removeItem(WIZARD_CHECKPOINT_KEY);
    } catch (error) {
      /* Nothing to clear. */
    }
  }

  function applyStepTwoToForm(data) {
    if (!data || typeof data !== "object") return;

    if (profileBioInput) {
      profileBioInput.value = String(data.bio || "").slice(0, 500);
    }

    const studyValues = Array.isArray(data.studyInterests)
      ? data.studyInterests.map((value) => String(value).trim().toLowerCase())
      : [];

    const contentValues = Array.isArray(data.contentInterests)
      ? data.contentInterests.map((value) => String(value).trim().toLowerCase())
      : [];

    studyInterestInputs.forEach((input) => {
      input.checked = studyValues.includes(
        String(input.value).trim().toLowerCase()
      );
      updateInputCardState(input);
    });

    contentInterestInputs.forEach((input) => {
      input.checked = contentValues.includes(
        String(input.value).trim().toLowerCase()
      );
      updateInputCardState(input);
    });

    let preference = String(data.preferredTeacherGender || "")
      .trim()
      .toLowerCase();

    if (!ALLOWED_TEACHER_GENDER_PREFERENCES.has(preference)) {
      preference = "no-preference";
    }

    teacherGenderPreferenceInputs.forEach((input) => {
      input.checked = String(input.value).trim().toLowerCase() === preference;
    });
    teacherGenderPreferenceInputs.forEach(updateInputCardState);

    updateBioCounter();
  }

  /* =======================================================
     WIZARD START (FIX-1)

     The wizard is started exactly once, after the account data has
     loaded. Nothing that runs later (a second load(), a slow
     response arriving after the user already moved on) can call
     setStep(1) again.
  ======================================================= */

  function startWizard() {
    if (wizardStarted) return;

    const checkpoint = readWizardCheckpoint();
    wizardStarted = true;

    /* The user is already past Step 1: never pull them back. */
    if (currentStep !== 1) {
      saveWizardCheckpoint();
      return;
    }

    if (!checkpoint || checkpoint.step < 2) {
      setStep(1);
      return;
    }

    applyStepTwoToForm(checkpoint.stepTwo);

    /*
     * Fayda images and the selfie live only in memory, so they cannot
     * be restored. Resume no further than Step 3, and only when the
     * profile photo is already confirmed by the server.
     */
    let target = Math.min(checkpoint.step, 3);

    if (target >= 3 && !existingAvatarUrl) {
      target = 2;
    }

    setStep(target);

    if (target === 3 && checkpoint.step >= 3) {
      setStatus(
        "This page was refreshed. Your profile details were kept - please add your Fayda photos again."
      );
    }
  }

  /* =======================================================
     PROFILE PHOTO
  ======================================================= */

  function computeApiOrigin(base) {
    try {
      return new URL(base, window.location.origin).origin;
    } catch (error) {
      console.warn("Unable to resolve API origin:", error);
      return window.location.origin;
    }
  }

  function resolveAvatarUrl(avatarUrl) {
    const value = String(avatarUrl || "").trim();

    if (!value) return "";

    if (/^https?:\/\//i.test(value)) {
      return value;
    }

    if (value.startsWith("/")) {
      return `${API_ORIGIN}${value}`;
    }

    return `${API_ORIGIN}/${value}`;
  }

  function releasePhotoObjectUrl() {
    if (!profilePhotoObjectUrl) return;

    try {
      URL.revokeObjectURL(profilePhotoObjectUrl);
    } catch (error) {
      console.warn("Unable to release profile photo object URL:", error);
    }

    profilePhotoObjectUrl = null;
  }

  function releaseFaydaObjectUrls() {
    [
      ["front", faydaFrontObjectUrl],
      ["back", faydaBackObjectUrl]
    ].forEach(([, objectUrl]) => {
      if (!objectUrl) return;
      try {
        URL.revokeObjectURL(objectUrl);
      } catch (error) {
        console.warn("Unable to release Fayda object URL:", error);
      }
    });

    faydaFrontObjectUrl = null;
    faydaBackObjectUrl = null;
  }

  function releaseSelfieObjectUrl() {
    if (!selfieObjectUrl) return;

    try {
      URL.revokeObjectURL(selfieObjectUrl);
    } catch (error) {
      console.warn("Unable to release selfie object URL:", error);
    }

    selfieObjectUrl = null;
  }

  function releaseAllObjectUrls() {
    releasePhotoObjectUrl();
    releaseFaydaObjectUrls();
    releaseSelfieObjectUrl();
    releasePendingSelfieUrl(); /* FIX-7 */
  }

  function showPhotoPlaceholder() {
    if (profilePhotoPreview) {
      profilePhotoPreview.onload = null;
      profilePhotoPreview.onerror = null;
      profilePhotoPreview.hidden = true;
      profilePhotoPreview.removeAttribute("src");
    }

    if (profilePhotoPlaceholder) {
      profilePhotoPlaceholder.hidden = false;
    }

    if (profilePhotoRemoveButton) {
      profilePhotoRemoveButton.hidden = true;
    }
  }

  function handleAvatarLoadError() {
    existingAvatarUrl = "";
    showPhotoPlaceholder();
  }

  function showPhotoPreview(src, isRemote) {
    if (!src) {
      showPhotoPlaceholder();
      return;
    }

    if (profilePhotoPreview) {
      profilePhotoPreview.hidden = true;
      profilePhotoPreview.onload = () => {
        profilePhotoPreview.hidden = false;
      };
      profilePhotoPreview.onerror = isRemote
        ? handleAvatarLoadError
        : null;
      profilePhotoPreview.src = src;
    }

    if (profilePhotoPlaceholder) {
      profilePhotoPlaceholder.hidden = true;
    }

    if (profilePhotoRemoveButton) {
      profilePhotoRemoveButton.hidden = false;
    }
  }

  function renderProfilePhotoState() {
    if (profilePhotoFile && profilePhotoObjectUrl) {
      showPhotoPreview(profilePhotoObjectUrl, false);
      return;
    }

    if (existingAvatarUrl) {
      showPhotoPreview(resolveAvatarUrl(existingAvatarUrl), true);
      return;
    }

    showPhotoPlaceholder();
  }

  function clearLocalPhotoSelection() {
    profilePhotoFile = null;
    releasePhotoObjectUrl();

    if (profilePhotoInput) {
      profilePhotoInput.value = "";
    }
  }

  function resetPhotoPreview() {
    clearLocalPhotoSelection();
    existingAvatarUrl = "";
    showPhotoPlaceholder();
  }

  function handlePhotoSelected(file) {
    setError("profilePhotoError", "");

    if (!file) return;

    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      clearLocalPhotoSelection();
      renderProfilePhotoState();
      setError(
        "profilePhotoError",
        "Please choose a JPG, PNG, or WebP image."
      );
      return;
    }

    if (file.size > MAX_PROFILE_PHOTO_BYTES) {
      clearLocalPhotoSelection();
      renderProfilePhotoState();
      setError(
        "profilePhotoError",
        "Profile photo must be 5 MB or smaller."
      );
      return;
    }

    profilePhotoFile = file;
    releasePhotoObjectUrl();

    try {
      profilePhotoObjectUrl = URL.createObjectURL(file);
      renderProfilePhotoState();
    } catch (error) {
      console.error("Profile photo preview failed:", error);
      clearLocalPhotoSelection();
      renderProfilePhotoState();
      setError(
        "profilePhotoError",
        "The selected image could not be previewed."
      );
    }
  }

  async function uploadProfilePhotoFile(file) {
    const token = getToken();

    if (!token) {
      const error = new Error("Not authenticated.");
      error.status = 401;
      error.stage = "photo";
      throw error;
    }

    if (!file) {
      const error = new Error("No profile photo was selected.");
      error.stage = "photo";
      throw error;
    }

    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      const error = new Error("Profile photo must be JPG, PNG, or WebP.");
      error.status = 400;
      error.stage = "photo";
      throw error;
    }

    if (file.size > MAX_PROFILE_PHOTO_BYTES) {
      const error = new Error("Profile photo must be 5 MB or smaller.");
      error.status = 413;
      error.stage = "photo";
      throw error;
    }

    const formData = new FormData();
    formData.append("profilePhoto", file);

    /* FIX-9: apiFetch() instead of a bare fetch(). */
    const response = await apiFetch(
      PHOTO_ENDPOINT,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json"
        },
        body: formData
      },
      "photo"
    );

    let data = {};

    try {
      data = await response.json();
    } catch (error) {
      data = {};
    }

    if (!response.ok) {
      const error = new Error(
        data?.message || "Unable to upload your profile photo."
      );
      error.status = response.status;
      error.stage = "photo";
      throw error;
    }

    return data;
  }

  async function deleteProfilePhotoRequest() {
    if (
      window.BarakaLinkAPI &&
      typeof window.BarakaLinkAPI.delete === "function"
    ) {
      return window.BarakaLinkAPI.delete(PHOTO_ENDPOINT);
    }

    const token = getToken();

    if (!token) {
      const error = new Error("Not authenticated.");
      error.status = 401;
      throw error;
    }

    /* FIX-9: apiFetch() instead of a bare fetch(). */
    const response = await apiFetch(
      PHOTO_ENDPOINT,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json"
        }
      }
    );

    let data = {};

    try {
      data = await response.json();
    } catch (error) {
      data = {};
    }

    if (!response.ok) {
      const error = new Error(
        data?.message || "Unable to remove your profile photo."
      );
      error.status = response.status;
      throw error;
    }

    return data;
  }

  async function removeSavedPhoto() {
    if (!window.BarakaLinkAPI) {
      setError(
        "profilePhotoError",
        "BarakaLink API is not available."
      );
      return;
    }

    const token = getToken();
    if (!token) {
      logout();
      return;
    }

    if (profilePhotoRemoveButton) {
      profilePhotoRemoveButton.disabled = true;
    }

    setStatus("Removing your profile photo...", "loading");

    try {
      const response = await deleteProfilePhotoRequest();

      if (!response?.success) {
        const error = new Error(
          response?.message ||
            "Unable to remove your profile photo."
        );
        error.status = response?.status;
        throw error;
      }

      resetPhotoPreview();
      setStatus("Your profile photo has been removed.", "success");
    } catch (error) {
      console.error("Profile photo removal error:", error);

      if (error?.status === 401) {
        logout();
        return;
      }

      setError(
        "profilePhotoError",
        error?.message ||
          "Unable to remove your profile photo. Please try again."
      );
      setStatus("");
    } finally {
      if (profilePhotoRemoveButton) {
        profilePhotoRemoveButton.disabled = false;
      }
    }
  }

  async function handleRemovePhotoClick() {
    if (submitting) return;

    setError("profilePhotoError", "");

    if (profilePhotoFile) {
      clearLocalPhotoSelection();
      renderProfilePhotoState();
      return;
    }

    if (existingAvatarUrl) {
      await removeSavedPhoto();
      return;
    }

    resetPhotoPreview();
  }

  /* =======================================================
     FAYDA FILES
  ======================================================= */

  function setFaydaPreview(preview, placeholder, removeButton, src) {
    if (!src) {
      if (preview) {
        preview.hidden = true;
        preview.removeAttribute("src");
      }
      if (placeholder) placeholder.hidden = false;
      if (removeButton) removeButton.hidden = true;
      return;
    }

    if (preview) {
      preview.hidden = false;
      preview.src = src;
    }

    if (placeholder) placeholder.hidden = true;
    if (removeButton) removeButton.hidden = false;
  }

  function setFaydaFile(side, file) {
    const isFront = side === "front";
    const errorId = isFront
      ? "parentFaydaFrontError"
      : "parentFaydaBackError";
    const preview = isFront ? faydaFrontPreview : faydaBackPreview;
    const placeholder = isFront
      ? faydaFrontPlaceholder
      : faydaBackPlaceholder;
    const removeButton = isFront
      ? faydaFrontRemoveButton
      : faydaBackRemoveButton;

    setError(errorId, "");

    if (!file) return;

    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      setError(errorId, "Fayda image must be JPG, PNG, or WebP.");
      return;
    }

    if (file.size > MAX_FAYDA_BYTES) {
      setError(errorId, "Fayda image must be 8 MB or smaller.");
      return;
    }

    if (isFront) {
      faydaFrontFile = file;

      if (faydaFrontObjectUrl) {
        URL.revokeObjectURL(faydaFrontObjectUrl);
      }

      faydaFrontObjectUrl = URL.createObjectURL(file);
      setFaydaPreview(
        preview,
        placeholder,
        removeButton,
        faydaFrontObjectUrl
      );
    } else {
      faydaBackFile = file;

      if (faydaBackObjectUrl) {
        URL.revokeObjectURL(faydaBackObjectUrl);
      }

      faydaBackObjectUrl = URL.createObjectURL(file);
      setFaydaPreview(
        preview,
        placeholder,
        removeButton,
        faydaBackObjectUrl
      );
    }
  }

  function clearFaydaFile(side) {
    if (side === "front") {
      faydaFrontFile = null;

      if (faydaFrontObjectUrl) {
        URL.revokeObjectURL(faydaFrontObjectUrl);
      }

      faydaFrontObjectUrl = null;

      if (faydaFrontInput) faydaFrontInput.value = "";
      if (faydaFrontCameraInput) faydaFrontCameraInput.value = "";

      setFaydaPreview(
        faydaFrontPreview,
        faydaFrontPlaceholder,
        faydaFrontRemoveButton,
        ""
      );
      setError("parentFaydaFrontError", "");
      return;
    }

    faydaBackFile = null;

    if (faydaBackObjectUrl) {
      URL.revokeObjectURL(faydaBackObjectUrl);
    }

    faydaBackObjectUrl = null;

    if (faydaBackInput) faydaBackInput.value = "";
    if (faydaBackCameraInput) faydaBackCameraInput.value = "";

    setFaydaPreview(
      faydaBackPreview,
      faydaBackPlaceholder,
      faydaBackRemoveButton,
      ""
    );
    setError("parentFaydaBackError", "");
  }

  /* =======================================================
     LIVE SELFIE (FIX-4 / FIX-5 / FIX-7)

     Two cooperating pieces:

     1) The Step 4 CARD shows only the CONFIRMED selfie
        (selfieFile / selfieObjectUrl). "Start Camera" / "Retake"
        on the card open the modal.

     2) The in-page camera MODAL (#parentSelfieCameraModal) owns the
        live stream, the capture and the review:
          starting -> live -> captured (pending, not yet confirmed)
        "Use This Selfie" promotes the pending photo to selfieFile.
        Close / backdrop / Escape discard the pending photo, release
        the camera and leave any confirmed selfie untouched.

     Still the same getUserMedia() call, the same canvas capture, the
     same selfieFile / selfieStream state and the same element IDs.
     Camera guarantees: one stream at a time, stale getUserMedia
     results are released the moment they arrive, and the stream is
     stopped on capture, close, step change, page hidden, page
     unload and logout.
  ======================================================= */

  function setSelfieStatus(message) {
    if (selfieStatus) {
      selfieStatus.textContent = message || "";
    }
  }

  /* Card buttons: idle -> Start Camera, captured -> Retake. */
  function updateSelfieControls({ mode }) {
    if (selfieCard) {
      selfieCard.dataset.mode = mode;
    }

    if (selfieStartButton) {
      selfieStartButton.hidden = mode !== "idle";
    }

    /* Capturing happens inside the modal; this card button stays hidden. */
    if (selfieCaptureButton) {
      selfieCaptureButton.hidden = true;
    }

    if (selfieRetakeButton) {
      selfieRetakeButton.hidden = mode !== "captured";
    }
  }

  /* Keep the modal stage the same shape as the real camera frame so the
     face is never cropped or stretched (CSS may read --selfie-aspect). */
  function setSelfieAspect(width, height) {
    if (!selfieModalStage || !width || !height) return;

    selfieModalStage.style.setProperty("--selfie-aspect", `${width} / ${height}`);
  }

  function syncSelfieAspectFromVideo() {
    if (selfieModalVideo) {
      setSelfieAspect(selfieModalVideo.videoWidth, selfieModalVideo.videoHeight);
    }
  }

  function stopSelfieCamera() {
    /* Invalidate any getUserMedia() request that has not resolved yet,
       so its stream is released the moment it arrives. */
    selfieCameraRequestId += 1;
    selfieStarting = false;

    if (selfieStream) {
      selfieStream.getTracks().forEach((track) => track.stop());
      selfieStream = null;
    }

    [selfieModalVideo, selfieVideo].forEach((video) => {
      if (!video) return;

      video.pause();
      video.srcObject = null;
      video.hidden = true;
    });
  }

  /* Card idle state: nothing confirmed, camera off, placeholder visible. */
  function showSelfieIdle(message) {
    if (selfieVideo) {
      selfieVideo.hidden = true;
    }

    if (selfiePreview) {
      selfiePreview.hidden = true;
      selfiePreview.removeAttribute("src");
    }

    if (selfiePlaceholder) {
      selfiePlaceholder.hidden = false;
    }

    setSelfieStatus(message || DEFAULT_SELFIE_STATUS);
    updateSelfieControls({ mode: "idle" });
  }

  /* Discards the CONFIRMED selfie. Only used to reset the page on load. */
  function clearSelfieSelection() {
    selfieFile = null;
    releaseSelfieObjectUrl();

    setError("parentSelfieError", "");
    showSelfieIdle();
  }

  /* Card state when a selfie has been CONFIRMED. */
  function showCapturedSelfie() {
    if (selfieVideo) {
      selfieVideo.hidden = true;
    }

    if (selfieObjectUrl && selfiePreview) {
      selfiePreview.src = selfieObjectUrl;
      selfiePreview.hidden = false;
    }

    if (selfiePlaceholder) {
      selfiePlaceholder.hidden = true;
    }

    setSelfieStatus(
      "Selfie confirmed. Tap Retake if you want to replace it, or continue to the next step."
    );
    updateSelfieControls({ mode: "captured" });
  }

  /* ---------- pending (unconfirmed) capture ---------- */

  function releasePendingSelfieUrl() {
    if (!selfiePendingObjectUrl) return;

    try {
      URL.revokeObjectURL(selfiePendingObjectUrl);
    } catch (error) {
      console.warn("Unable to release pending selfie object URL:", error);
    }

    selfiePendingObjectUrl = null;
  }

  function discardPendingSelfie() {
    selfiePendingFile = null;
    releasePendingSelfieUrl();

    if (selfieModalPreview) {
      selfieModalPreview.hidden = true;
      selfieModalPreview.removeAttribute("src");
    }
  }

  /* Returns "" when the file is acceptable, otherwise a readable message. */
  function validateSelfieFile(file) {
    if (!file || typeof file.size !== "number" || file.size <= 0) {
      return "The captured selfie is empty. Please retake it.";
    }

    if (file.type !== "image/jpeg") {
      return "The live selfie could not be prepared correctly. Please retake it.";
    }

    if (file.size > MAX_SELFIE_BYTES) {
      return "The captured selfie is larger than 5 MB. Please retake it.";
    }

    return "";
  }

  /* ---------- modal presentation ---------- */

  function setSelfieModalMessage(message, isError) {
    if (!selfieModalStatus) return;

    selfieModalStatus.textContent = message || "";
    selfieModalStatus.dataset.state = isError ? "error" : "info";
  }

  function focusSelfieModalPrimary() {
    const target = [
      selfieModalUseButton,
      selfieModalCaptureButton,
      selfieModalStartButton,
      selfieModalCloseButton
    ].find((button) => button && !button.hidden && !button.disabled);

    if (target) {
      target.focus({ preventScroll: true });
    }
  }

  /*
   * One place decides what the modal shows.
   * mode: "starting" | "live" | "captured" | "error"
   * The JS toggles the `hidden` attribute directly, so the modal works
   * whatever the CSS does with data-mode (the stage also gets
   * data-mode="<mode>" for styling).
   */
  function setSelfieModalMode(mode, message) {
    const isLive = mode === "live";
    const isCaptured = mode === "captured";
    const isError = mode === "error";

    if (selfieModalStage) {
      selfieModalStage.dataset.mode = mode;
    }

    if (selfieModalVideo) {
      selfieModalVideo.hidden = !isLive;
    }

    if (selfieModalPreview) {
      selfieModalPreview.hidden = !isCaptured;
    }

    if (selfieModalGuide) {
      selfieModalGuide.hidden = !isLive;
    }

    if (selfieModalPlaceholder) {
      selfieModalPlaceholder.hidden = isLive || isCaptured;

      const label = selfieModalPlaceholder.querySelector("span");
      if (label) {
        label.textContent = isError
          ? "Camera unavailable"
          : "Preparing your camera...";
      }
    }

    if (selfieModalStartButton) {
      selfieModalStartButton.hidden = !isError;
      selfieModalStartButton.disabled = false;
    }

    if (selfieModalCaptureButton) {
      selfieModalCaptureButton.hidden = !isLive;
      selfieModalCaptureButton.disabled = false;
    }

    if (selfieModalRetakeButton) {
      selfieModalRetakeButton.hidden = !isCaptured;
    }

    if (selfieModalUseButton) {
      selfieModalUseButton.hidden = !isCaptured;
    }

    setSelfieModalMessage(message, isError);

    /* The button that had focus may have just been hidden. */
    if (selfieModalOpen) {
      focusSelfieModalPrimary();
    }
  }

  function showSelfieCameraError(message) {
    setSelfieModalMode("error", message);

    /* Also kept on the card, so the reason is still visible after the
       user closes the modal. Cleared on the next attempt. */
    setError("parentSelfieError", message);
  }

  /* ---------- open / close ---------- */

  function openSelfieModal(opener) {
    if (selfieModalOpen || submitting) return;

    setError("parentSelfieError", "");

    if (
      !selfieModal ||
      !selfieModalVideo ||
      !selfieModalPreview ||
      !selfieCanvas
    ) {
      setError(
        "parentSelfieError",
        "The camera window is not available on this page. Please refresh and try again."
      );
      return;
    }

    selfieModalOpener = opener || document.activeElement || null;
    selfieModalOpen = true;

    /* A new session always starts without an unconfirmed capture. */
    discardPendingSelfie();

    selfieModal.hidden = false;
    selfieModal.removeAttribute("aria-hidden");

    /* The modal is a sibling of the page shell (not inside it), so making
       the shell inert blocks pointer, keyboard and screen-reader access to
       everything behind the modal. */
    if (pageShell) {
      pageShell.setAttribute("inert", "");
    }

    selfieModalPreviousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    startModalCamera();
  }

  /*
   * Safe to call at any time (also when the modal is closed): it always
   * releases the camera. Options:
   *   restoreFocus - return focus to the control that opened the modal
   *   refreshCard  - re-render the Step 4 card (confirmed selfie / idle)
   */
  function closeSelfieModal({ restoreFocus = true, refreshCard = true } = {}) {
    stopSelfieCamera();

    if (!selfieModalOpen) return;

    selfieModalOpen = false;

    /* Unconfirmed capture is discarded; a confirmed selfie is untouched. */
    discardPendingSelfie();

    if (selfieModal) {
      selfieModal.hidden = true;
      selfieModal.setAttribute("aria-hidden", "true");
    }

    if (pageShell) {
      pageShell.removeAttribute("inert");
    }

    document.body.style.overflow = selfieModalPreviousOverflow;

    if (refreshCard) {
      if (selfieFile) {
        showCapturedSelfie();
      } else {
        showSelfieIdle();
      }
    }

    if (restoreFocus) {
      const opener = selfieModalOpener;

      let target =
        opener && opener.isConnected && !opener.hidden ? opener : null;

      if (!target) {
        target =
          [selfieRetakeButton, selfieStartButton].find(
            (button) => button && !button.hidden
          ) || null;
      }

      if (target) {
        target.focus({ preventScroll: true });
      }
    }

    selfieModalOpener = null;
  }

  /* ---------- camera inside the modal ---------- */

  async function startModalCamera() {
    if (!selfieModalOpen || selfieStarting) return;

    setError("parentSelfieError", "");

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showSelfieCameraError(
        window.isSecureContext === false
          ? "Camera access is blocked because this page is not served over a secure connection (HTTPS or localhost)."
          : "Your browser does not support live camera access."
      );
      return;
    }

    stopSelfieCamera();

    const requestId = ++selfieCameraRequestId;
    selfieStarting = true;

    setSelfieModalMode(
      "starting",
      "Starting your camera. Allow camera access if your browser asks."
    );

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 960 }
        },
        audio: false
      });

      /* The user closed the modal, hid the page or restarted while the
         permission prompt was open: release this stream immediately. */
      if (requestId !== selfieCameraRequestId || !selfieModalOpen) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      selfieStream = stream;
      selfieModalVideo.srcObject = stream;
      selfieModalVideo.muted = true;
      selfieModalVideo.playsInline = true;
      selfieModalVideo.hidden = false;

      await selfieModalVideo.play();

      if (requestId !== selfieCameraRequestId) {
        return;
      }

      syncSelfieAspectFromVideo();

      setSelfieModalMode(
        "live",
        "Camera is ready. Center your face in the outline, then tap Capture Selfie."
      );
    } catch (error) {
      if (requestId !== selfieCameraRequestId) {
        return;
      }

      console.error("Unable to start live selfie camera:", error);
      stopSelfieCamera();

      const message =
        error?.name === "NotAllowedError"
          ? "Camera permission was denied. Please allow camera access and try again."
          : error?.name === "NotFoundError"
            ? "No camera was found on this device."
            : error?.name === "NotReadableError"
              ? "Your camera is being used by another app. Close it and try again."
              : error?.name === "SecurityError"
                ? "Camera access is blocked by your browser settings or security policy."
                : "Unable to start the camera. Please try again.";

      showSelfieCameraError(message);
    } finally {
      if (requestId === selfieCameraRequestId) {
        selfieStarting = false;
      }
    }
  }

  async function captureModalSelfie() {
    if (selfieCapturing || !selfieModalOpen) return;

    if (!selfieModalVideo || !selfieCanvas || !selfieStream) {
      setSelfieModalMessage(
        "Start the live camera before capturing your selfie.",
        true
      );
      return;
    }

    const width = selfieModalVideo.videoWidth;
    const height = selfieModalVideo.videoHeight;

    if (!width || !height) {
      setSelfieModalMessage(
        "The camera is still preparing. Please try again.",
        true
      );
      return;
    }

    selfieCapturing = true;

    /* If the modal is closed or restarted while toBlob()/decode() is
       pending, this token no longer matches and the result is dropped. */
    const sessionToken = selfieCameraRequestId;

    if (selfieModalCaptureButton) {
      selfieModalCaptureButton.disabled = true;
    }

    try {
      selfieCanvas.width = width;
      selfieCanvas.height = height;

      const context = selfieCanvas.getContext("2d");

      if (!context) {
        setSelfieModalMessage(
          "Unable to capture the selfie from the camera.",
          true
        );
        return;
      }

      context.drawImage(selfieModalVideo, 0, 0, width, height);

      const blob = await new Promise((resolve) => {
        selfieCanvas.toBlob(resolve, "image/jpeg", 0.9);
      });

      if (sessionToken !== selfieCameraRequestId || !selfieModalOpen) {
        return;
      }

      /* toBlob() silently falls back to PNG when JPEG is unsupported. */
      if (!blob || blob.type !== "image/jpeg") {
        setSelfieModalMessage(
          "Unable to prepare the selfie. Please try again.",
          true
        );
        return;
      }

      const file = new File(
        [blob],
        `parent-selfie-${Date.now()}.jpg`,
        {
          type: "image/jpeg",
          lastModified: Date.now()
        }
      );

      const problem = validateSelfieFile(file);

      if (problem) {
        setSelfieModalMessage(problem, true);
        return;
      }

      const objectUrl = URL.createObjectURL(file);

      /* Prove the browser can actually decode the photo before offering it. */
      try {
        selfieModalPreview.src = objectUrl;

        if (typeof selfieModalPreview.decode === "function") {
          await selfieModalPreview.decode();
        }
      } catch (decodeError) {
        console.error("Captured selfie could not be decoded:", decodeError);

        URL.revokeObjectURL(objectUrl);
        selfieModalPreview.removeAttribute("src");

        if (sessionToken === selfieCameraRequestId && selfieModalOpen) {
          setSelfieModalMessage(
            "The captured photo could not be displayed. Please try again.",
            true
          );
        }

        return;
      }

      if (sessionToken !== selfieCameraRequestId || !selfieModalOpen) {
        URL.revokeObjectURL(objectUrl);
        selfieModalPreview.removeAttribute("src");
        return;
      }

      releasePendingSelfieUrl();
      selfiePendingFile = file;
      selfiePendingObjectUrl = objectUrl;

      setSelfieAspect(width, height);

      /* Release the camera right after the frame has been captured. */
      stopSelfieCamera();

      setSelfieModalMode(
        "captured",
        "Photo captured. Check that your whole face is clear and well lit, then tap Use This Selfie, or retake it."
      );
    } finally {
      selfieCapturing = false;

      if (selfieModalCaptureButton) {
        selfieModalCaptureButton.disabled = false;
      }
    }
  }

  function retakeModalSelfie() {
    if (!selfieModalOpen) return;

    /* Only the unconfirmed capture is dropped; selfieFile is untouched. */
    discardPendingSelfie();
    startModalCamera();
  }

  function useModalSelfie() {
    if (!selfieModalOpen) return;

    if (!selfiePendingFile || !selfiePendingObjectUrl) {
      setSelfieModalMessage("Capture a selfie first.", true);
      return;
    }

    const problem = validateSelfieFile(selfiePendingFile);

    if (problem) {
      setSelfieModalMessage(problem, true);
      return;
    }

    /* The replacement is accepted: only now is the old selfie dropped. */
    releaseSelfieObjectUrl();

    selfieFile = selfiePendingFile;
    selfieObjectUrl = selfiePendingObjectUrl;
    selfiePendingFile = null;
    selfiePendingObjectUrl = null; /* ownership moved to selfieObjectUrl */

    setError("parentSelfieError", "");

    /* Closes the modal and re-renders the card with the confirmed selfie. */
    closeSelfieModal();
  }

  /* Page hidden / tab switched: release the camera. */
  function pauseSelfieCameraIfActive() {
    if (!selfieStream && !selfieStarting) return;

    stopSelfieCamera();

    if (selfieModalOpen) {
      setSelfieModalMode(
        "error",
        "The camera was turned off because the page was hidden. Tap Try Camera Again to continue."
      );
    }
  }

  function handleSelfieModalKeydown(event) {
    if (!selfieModalOpen) return;

    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closeSelfieModal();
    }
  }

  /* =======================================================
     STEP 1 SAVE
  ======================================================= */

  async function saveStepOne() {
    if (submitting || !validateStepOne()) return;

    if (!window.BarakaLinkAPI) {
      setStatus("BarakaLink API is not available.", "error");
      return;
    }

    if (!getToken()) {
      logout();
      return;
    }

    submitting = true;
    setSaveButtonState(true, "Saving...", "fa-solid fa-spinner fa-spin");
    setStatus("Saving your information...", "loading");

    const role = normalizeRole(currentUser?.role);

    const payload = {
      firstName: firstNameInput?.value.trim() || "",
      lastName: lastNameInput?.value.trim() || "",
      phone: normalizePhoneForSubmit(
        getPhone(currentUser) || phoneInput?.value || ""
      ),
      subcity: subcityInput?.value.trim().toLowerCase() || "",
      area: areaInput?.value.trim().toLowerCase() || "",
      nearestMosque: nearestMosqueInput?.value.trim() || ""
    };

    if (role === "ustaz") {
      payload.experience = Number(experienceInput?.value || 0);
      payload.gender = genderInput?.value.trim().toLowerCase() || "";
      payload.studyFields = getCheckedValues(studyFieldInputs);
    }

    try {
      const response = await window.BarakaLinkAPI.patch(
        PROFILE_ENDPOINT,
        payload
      );

      if (!response?.success) {
        const error = new Error(
          response?.message || "Unable to save your information."
        );
        error.status = response?.status;
        throw error;
      }

      try {
        const refreshed = await window.BarakaLinkAPI.get(PROFILE_ENDPOINT);

        if (refreshed?.success) {
          const refreshedUser = buildProfileCompletionUser(refreshed);
          if (refreshedUser) {
            currentUser = refreshedUser;
            applyUserToForm(refreshedUser);
          }
        }
      } catch (refreshError) {
        console.warn(
          "Unable to refresh profile after Step 1 save:",
          refreshError
        );
      }

      submitting = false;
      setSaveButtonState(false, STEP_META[1].button, STEP_META[1].icon);
      setStatus("Your information has been saved.", "success");

      setStep(2);
    } catch (error) {
      console.error("Profile Step 1 save error:", error);

      if (error?.status === 401) {
        logout();
        return;
      }

      submitting = false;
      setSaveButtonState(false, STEP_META[1].button, STEP_META[1].icon);
      setStatus(
        error?.message ||
          "Unable to save your information. Please try again.",
        "error"
      );
    }
  }

  /* =======================================================
     STEP 2 CONTINUE
     Upload avatar if a new one was selected, but DO NOT
     finalize profile completion here.
  ======================================================= */

  async function continueStepTwo() {
    if (submitting || !validateStepTwo()) return;

    if (!window.BarakaLinkAPI) {
      setStatus("BarakaLink API is not available.", "error");
      return;
    }

    if (!getToken()) {
      logout();
      return;
    }

    submitting = true;

    /* FIX-2: the button text reflects what is really happening. */
    setSaveButtonState(
      true,
      profilePhotoFile ? "Uploading..." : "Continuing...",
      "fa-solid fa-spinner fa-spin"
    );

    /* FIX-3: persist the Step 2 choices BEFORE the upload starts, so a
       reload that lands during or right after the upload loses nothing. */
    saveWizardCheckpoint();

    try {
      storedStepTwoData = collectStepTwoData();

      if (profilePhotoFile) {
        setStatus("Uploading your profile photo...", "loading");

        const uploadResponse = await uploadProfilePhotoFile(profilePhotoFile);

        if (!uploadResponse?.success) {
          const error = new Error(
            uploadResponse?.message ||
              "Unable to upload your profile photo."
          );
          error.status = uploadResponse?.status;
          throw error;
        }

        existingAvatarUrl =
          uploadResponse?.data?.avatarUrl ||
          uploadResponse?.data?.avatar_url ||
          existingAvatarUrl ||
          "";

        clearLocalPhotoSelection();
        renderProfilePhotoState();

        if (currentUser) {
          currentUser.avatarUrl = existingAvatarUrl;
          currentUser.avatar_url = existingAvatarUrl;
        }
      }

      if (!existingAvatarUrl) {
        const error = new Error(
          "Your profile photo has not been confirmed by the server."
        );
        error.stage = "photo";
        throw error;
      }

      submitting = false;
      setSaveButtonState(false, STEP_META[2].button, STEP_META[2].icon);

      /*
       * FIX-2: exactly one setStep(3). The old "ready, continue to
       * Fayda" status was set right before this call and then wiped by
       * setStep() -> clearErrors(), so it never showed; it is removed.
       */
      setStep(3);
    } catch (error) {
      console.error("Profile Step 2 continue error:", error);

      if (error?.status === 401) {
        logout();
        return;
      }

      submitting = false;
      setSaveButtonState(false, STEP_META[2].button, STEP_META[2].icon);

      if (error?.status === 413) {
        setError(
          "profilePhotoError",
          "Profile photo must be 5 MB or smaller."
        );
      }

      if (error?.stage === "photo" || !error?.stage) {
        setStatus(
          error?.message ||
            "Unable to continue. Please make sure your profile photo is available.",
          "error"
        );
      }
    }
  }

  /* =======================================================
     STEP 3 CONTINUE
  ======================================================= */

  function continueStepThree() {
    if (submitting || !validateStepThree()) return;

    setStep(4);
    setStatus("Fayda documents are ready. Take your live selfie.", "success");
  }

  /* =======================================================
     STEP 4 CONTINUE
  ======================================================= */

  function continueStepFour() {
    if (submitting || !validateSelfie()) return;

    stopSelfieCamera();
    setStep(5);
    setStatus(
      "Your selfie is ready. Review everything before submission.",
      "success"
    );
  }

  /* =======================================================
     SUBMISSION SUCCESS MODAL

     Created dynamically so the existing HTML/CSS structure does not
     need a new modal block. The existing button styles are reused.
  ======================================================= */

  let submissionSuccessModal = null;
  let submissionSuccessModalButton = null;

  function closeSubmissionSuccessModal() {
    if (!submissionSuccessModal) {
      return;
    }

    const modal = submissionSuccessModal;
    submissionSuccessModal = null;
    submissionSuccessModalButton = null;

    if (modal.parentNode) {
      modal.parentNode.removeChild(modal);
    }

    document.body.classList.remove("profile-submission-modal-open");
    document.removeEventListener(
      "keydown",
      handleSubmissionSuccessKeydown
    );

    stopSelfieCamera();
    releaseAllObjectUrls();

    window.location.replace(
      dashboardForRole(currentUser?.role)
    );
  }

  function showSubmissionSuccessModal() {
    if (submissionSuccessModal) {
      return;
    }

    const overlay = document.createElement("div");
    overlay.setAttribute("role", "presentation");
    overlay.className = "profile-submission-success-overlay";

    Object.assign(overlay.style, {
      position: "fixed",
      inset: "0",
      zIndex: "99999",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px",
      background: "rgba(0, 0, 0, 0.48)"
    });

    const dialog = document.createElement("div");
    dialog.className = "profile-completion-card profile-submission-success-dialog";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", "profileSubmissionSuccessTitle");
    dialog.setAttribute("aria-describedby", "profileSubmissionSuccessDescription");

    Object.assign(dialog.style, {
      width: "min(100%, 520px)",
      maxWidth: "520px",
      margin: "0 auto"
    });

    dialog.innerHTML = `
      <div class="profile-completion-icon" aria-hidden="true">
        <i class="fa-solid fa-circle-check"></i>
      </div>

      <h2 id="profileSubmissionSuccessTitle">
        Registration submitted
      </h2>

      <p id="profileSubmissionSuccessDescription">
        Your BarakaLink registration has been submitted successfully for manual review. You will be notified within 48 hours when your profile is approved.
      </p>

      <p>
        You can continue to browse Ustaz and Ustaza profiles while your submission is under review. Messaging will become available after your Parent profile is approved by BarakaLink.
      </p>

      <div class="profile-form-actions">
        <button
          class="btn btn-primary"
          id="profileSubmissionSuccessOk"
          type="button"
        >
          OK
        </button>
      </div>
    `;

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    document.body.classList.add("profile-submission-modal-open");

    submissionSuccessModal = overlay;
    submissionSuccessModalButton = dialog.querySelector(
      "#profileSubmissionSuccessOk"
    );

    if (submissionSuccessModalButton) {
      submissionSuccessModalButton.addEventListener(
        "click",
        closeSubmissionSuccessModal
      );

      window.requestAnimationFrame(() => {
        submissionSuccessModalButton.focus();
      });
    }

    document.addEventListener("keydown", handleSubmissionSuccessKeydown);
  }

  function handleSubmissionSuccessKeydown(event) {
    if (!submissionSuccessModal) {
      document.removeEventListener(
        "keydown",
        handleSubmissionSuccessKeydown
      );
      return;
    }

    if (event.key === "Escape" || event.key === "Enter") {
      event.preventDefault();
      closeSubmissionSuccessModal();
    }
  }

  /* =======================================================
     FINAL SUBMISSION
     POST /api/profile/parent-complete
  ======================================================= */

  function appendFileIfPresent(formData, fieldName, file) {
    if (file) {
      formData.append(fieldName, file);
    }
  }

  async function submitParentProfileForReview() {
    if (submitting || !validateStepFive()) return;

    if (!getToken()) {
      logout();
      return;
    }

    if (!existingAvatarUrl) {
      setStatus(
        "Your profile photo must be uploaded before final submission.",
        "error"
      );
      setStep(2);
      return;
    }

    if (!faydaFrontFile && !hasExistingFaydaFront()) {
      setStatus(
        "The front of your Fayda National ID is required.",
        "error"
      );
      setStep(3);
      return;
    }

    if (!faydaBackFile && !hasExistingFaydaBack()) {
      setStatus(
        "The back of your Fayda National ID is required.",
        "error"
      );
      setStep(3);
      return;
    }

    if (!selfieFile && !hasExistingSelfie()) {
      setStatus(
        "Your live selfie is required.",
        "error"
      );
      setStep(4);
      return;
    }

    submitting = true;
    setSaveButtonState(
      true,
      "Submitting...",
      "fa-solid fa-spinner fa-spin"
    );
    setStatus(
      "Submitting your Parent profile for manual review...",
      "loading"
    );

    stopSelfieCamera();

    const preferences = collectStepTwoData();
    const formData = new FormData();

    formData.append("bio", preferences.bio);
    preferences.studyInterests.forEach((interest) => {
      formData.append("studyInterests", interest);
    });

    preferences.contentInterests.forEach((interest) => {
      formData.append("contentInterests", interest);
    });
    formData.append(
      "preferredTeacherGender",
      preferences.preferredTeacherGender
    );

    appendFileIfPresent(formData, "faydaFront", faydaFrontFile);
    appendFileIfPresent(formData, "faydaBack", faydaBackFile);
    appendFileIfPresent(formData, "selfiePhoto", selfieFile);

    try {
      /* FIX-9: apiFetch() instead of a bare fetch(). */
      const response = await apiFetch(
        PARENT_COMPLETE_ENDPOINT,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${getToken()}`,
            Accept: "application/json"
          },
          body: formData
        }
      );

      let data = {};

      try {
        data = await response.json();
      } catch (error) {
        data = {};
      }

      if (!response.ok) {
        const error = new Error(
          data?.message ||
            "Unable to submit your Parent profile for review."
        );
        error.status = response.status;
        throw error;
      }

      if (!data?.success) {
        const error = new Error(
          data?.message ||
            "The server did not confirm your Parent profile submission."
        );
        error.status = response.status;
        throw error;
      }

      const profileCompleted =
        data?.data?.profileCompleted === true ||
        data?.data?.profileCompleted === 1 ||
        data?.data?.profileCompleted === "1";

      const reviewStatus = String(
        data?.data?.profileReviewStatus || "pending"
      )
        .trim()
        .toLowerCase();

      if (!profileCompleted || reviewStatus !== "pending") {
        const error = new Error(
          "The server did not confirm that your profile is pending manual review."
        );
        throw error;
      }
      submitting = false;

      clearWizardCheckpoint(); /* FIX-3: submitted, nothing to resume. */

      window.location.replace(
        dashboardForRole(currentUser?.role)
      );

      return;
    } catch (error) {
      console.error("Parent profile final submission error:", error);

      if (error?.status === 401) {
        logout();
        return;
      }

      submitting = false;
      setSaveButtonState(
        false,
        STEP_META[5].button,
        STEP_META[5].icon
      );

      if (error?.status === 413) {
        setStatus(
          "One or more verification files are too large. Please review the file size limits and try again.",
          "error"
        );
      } else {
        setStatus(
          error?.message ||
            "Unable to submit your Parent profile. Please try again.",
          "error"
        );
      }
    }
  }

  /* =======================================================
     FORM SUBMIT ROUTER
     (registered once, at the top of this file - see FIX-6)
  ======================================================= */

  async function handleFormSubmit(event) {
    /* FIX-6: first statement, synchronous, before any await. */
    event.preventDefault();

    /* FIX-1: ignore submits until the account data has loaded. */
    if (!wizardStarted) {
      if (loadInFlight) {
        setStatus(
          "Your information is still loading. If this message stays, refresh the page.",
          "loading"
        );
      } else {
        /* FIX-10: the first load failed (for example the API could not be
           reached). Tapping the button retries it; the real error from
           loadCurrentUser() is shown instead of a misleading "loading". */
        await loadCurrentUser();
      }
      return;
    }

    if (currentStep === 1) {
      await saveStepOne();
      return;
    }

    if (currentStep === 2) {
      await continueStepTwo();
      return;
    }

    if (currentStep === 3) {
      continueStepThree();
      return;
    }

    if (currentStep === 4) {
      continueStepFour();
      return;
    }

    if (currentStep === 5) {
      await submitParentProfileForReview();
    }
  }

  /* =======================================================
     BACK NAVIGATION
  ======================================================= */

  function handleBack() {
    if (submitting) return;

    stopSelfieCamera();

    if (currentStep > 1) {
      setStep(currentStep - 1);
    }
  }

  /* =======================================================
     BIO COUNTER
  ======================================================= */

  function updateBioCounter() {
    if (!profileBioInput || !profileBioCount) return;

    profileBioCount.textContent = String(
      Math.min(String(profileBioInput.value || "").length, 500)
    );
  }

  /* =======================================================
     EXISTING PENDING / APPROVED STATE
  ======================================================= */

  function handleExistingReviewState(user) {
    const reviewStatus = getReviewStatus(user);

    if (reviewStatus === "approved") {
      window.location.replace(dashboardForRole(user?.role));
      return true;
    }

      if (reviewStatus === "pending") {
      window.location.replace(
        dashboardForRole(user?.role)
      );

      return true;
    }
    /*
     * Legacy users with profile_completed=true but no review status
     * are considered already completed and can continue to the dashboard.
     */
    if (isProfileCompleted(user) && !reviewStatus) {
      window.location.replace(dashboardForRole(user?.role));
      return true;
    }

    /*
     * Rejected profiles remain editable and may resubmit.
     */
    return false;
  }

  /* =======================================================
     LOAD CURRENT PROFILE

     FIX-1: this used to end with
         initializePageState();
         setStep(1);
     on EVERY call. Any load that finished after the user had moved
     on (a slow /profile/preferences response, or a second call to
     BarakaLinkProfileCompletion.load()) therefore wiped the wizard
     and sent it back to Step 1. It now starts the wizard once, and a
     later call only refreshes data without touching the UI or step.

     FIX-10: loadInFlight tracks a running load, so a second call
     while one is already running is ignored, and handleFormSubmit()
     can tell "still loading" apart from "the first load failed".
  ======================================================= */

  async function loadCurrentUser() {
    /* FIX-10 */
    if (loadInFlight) return;

    const token = getToken();

    if (!token) {
      logout();
      return;
    }

    loadInFlight = true;
    setStatus("Loading your information...", "loading");

    try {
      if (!window.BarakaLinkAPI) {
        throw new Error("BarakaLink API is not available.");
      }

      const response = await window.BarakaLinkAPI.get(PROFILE_ENDPOINT);

      if (!response?.success) {
        const error = new Error(
          response?.message ||
            "Unable to load your account information."
        );
        error.status = response?.status;
        throw error;
      }

      const user = buildProfileCompletionUser(response);

      if (!user) {
        throw new Error(
          "The server returned an incomplete user profile."
        );
      }

      currentUser = user;

      const handledReviewState = handleExistingReviewState(user);
      if (handledReviewState) {
        return;
      }

      /* Wizard already running: refresh data only, never touch it. */
      if (wizardStarted) {
        setStatus("");
        return;
      }

      applyUserToForm(user);

      await loadSavedPreferences();

      setStatus("");
      startWizard();
    } catch (error) {
      console.error(
        "Unable to load current BarakaLink profile:",
        error
      );

      if (error?.status === 401) {
        logout();
        return;
      }

      if (!wizardStarted) {
        setSaveButtonState(
          false,
          STEP_META[1].button,
          STEP_META[1].icon
        );
      }

      setStatus(
        error?.message ||
          "We could not load your registration information. Please try again.",
        "error"
      );
    } finally {
      loadInFlight = false;
    }
  }

  /* =======================================================
     INITIAL PAGE STATE

     FIX-1: runs once. It used to run twice on every page load
     (init() and the end of loadCurrentUser()), and each run reset
     the Fayda previews and the selfie while leaving the Fayda files
     in memory.
  ======================================================= */

  function initializePageState() {
    if (pageStateInitialized) return;
    pageStateInitialized = true;

    if (firstNameInput) firstNameInput.readOnly = false;
    if (lastNameInput) lastNameInput.readOnly = false;
    if (phoneInput) phoneInput.readOnly = true;

    if (profileBioInput) {
      profileBioInput.maxLength = 500;
    }

    initializeInputCardStates();
    renderProfilePhotoState();

    setFaydaPreview(
      faydaFrontPreview,
      faydaFrontPlaceholder,
      faydaFrontRemoveButton,
      ""
    );

    setFaydaPreview(
      faydaBackPreview,
      faydaBackPlaceholder,
      faydaBackRemoveButton,
      ""
    );

    clearSelfieSelection();
    setStep(1);
  }

  /* =======================================================
     EVENT LISTENERS - SUB-CITY
  ======================================================= */

  if (subcityInput) {
    subcityInput.addEventListener("change", () => {
      populateAreas(subcityInput.value, "");
      setError("profileSubcityError", "");
      setError("profileAreaError", "");
    });
  }

  /* =======================================================
     EVENT LISTENERS - CARD STATES
  ======================================================= */

  studyFieldInputs.forEach((input) => {
    input.addEventListener("change", () => updateInputCardState(input));
  });

  studyInterestInputs.forEach((input) => {
    input.addEventListener("change", () => updateInputCardState(input));
  });

  contentInterestInputs.forEach((input) => {
    input.addEventListener("change", () => updateInputCardState(input));
  });

  teacherGenderPreferenceInputs.forEach((input) => {
    input.addEventListener("change", () => {
      teacherGenderPreferenceInputs.forEach(updateInputCardState);
    });
  });

  /* =======================================================
     EVENT LISTENERS - PROFILE PHOTO
  ======================================================= */

  if (profilePhotoChangeButton && profilePhotoInput) {
    profilePhotoChangeButton.addEventListener("click", () => {
      profilePhotoInput.click();
    });
  }

  if (profilePhotoInput) {
    profilePhotoInput.addEventListener("change", () => {
      const file = profilePhotoInput.files?.[0] || null;
      handlePhotoSelected(file);
    });
  }

  if (profilePhotoRemoveButton) {
    profilePhotoRemoveButton.addEventListener(
      "click",
      handleRemovePhotoClick
    );
  }

  if (profileBioInput) {
    profileBioInput.addEventListener("input", updateBioCounter);
  }

  /* =======================================================
     EVENT LISTENERS - FAYDA FRONT
  ======================================================= */

  if (faydaFrontUploadButton && faydaFrontInput) {
    faydaFrontUploadButton.addEventListener("click", () => {
      faydaFrontInput.click();
    });
  }

  if (faydaFrontCaptureButton && faydaFrontCameraInput) {
    faydaFrontCaptureButton.addEventListener("click", () => {
      faydaFrontCameraInput.click();
    });
  }

  if (faydaFrontInput) {
    faydaFrontInput.addEventListener("change", () => {
      setFaydaFile("front", faydaFrontInput.files?.[0] || null);
    });
  }

  if (faydaFrontCameraInput) {
    faydaFrontCameraInput.addEventListener("change", () => {
      setFaydaFile(
        "front",
        faydaFrontCameraInput.files?.[0] || null
      );
    });
  }

  if (faydaFrontRemoveButton) {
    faydaFrontRemoveButton.addEventListener("click", () => {
      if (submitting) return;
      clearFaydaFile("front");
    });
  }

  /* =======================================================
     EVENT LISTENERS - FAYDA BACK
  ======================================================= */

  if (faydaBackUploadButton && faydaBackInput) {
    faydaBackUploadButton.addEventListener("click", () => {
      faydaBackInput.click();
    });
  }

  if (faydaBackCaptureButton && faydaBackCameraInput) {
    faydaBackCaptureButton.addEventListener("click", () => {
      faydaBackCameraInput.click();
    });
  }

  if (faydaBackInput) {
    faydaBackInput.addEventListener("change", () => {
      setFaydaFile("back", faydaBackInput.files?.[0] || null);
    });
  }

  if (faydaBackCameraInput) {
    faydaBackCameraInput.addEventListener("change", () => {
      setFaydaFile(
        "back",
        faydaBackCameraInput.files?.[0] || null
      );
    });
  }

  if (faydaBackRemoveButton) {
    faydaBackRemoveButton.addEventListener("click", () => {
      if (submitting) return;
      clearFaydaFile("back");
    });
  }

  /* =======================================================
     EVENT LISTENERS - LIVE SELFIE (FIX-7)

     Card: Start Camera / Retake open the modal.
     Modal: close, backdrop, Escape, Try Again, Capture, Retake, Use.
  ======================================================= */

  if (selfieStartButton) {
    selfieStartButton.addEventListener("click", () => {
      openSelfieModal(selfieStartButton);
    });
  }

  /* Retake on the card opens the modal; the confirmed selfie is kept
     until a replacement is accepted with "Use This Selfie". */
  if (selfieRetakeButton) {
    selfieRetakeButton.addEventListener("click", () => {
      openSelfieModal(selfieRetakeButton);
    });
  }

  if (selfieModalCloseButton) {
    selfieModalCloseButton.addEventListener("click", () => {
      closeSelfieModal();
    });
  }

  if (selfieModal) {
    selfieModal.addEventListener("click", (event) => {
      const target = event.target;

      if (
        target === selfieModal ||
        (target instanceof Element && target.closest("[data-selfie-modal-close]"))
      ) {
        closeSelfieModal();
      }
    });
  }

  if (selfieModalStartButton) {
    selfieModalStartButton.addEventListener("click", startModalCamera);
  }

  if (selfieModalCaptureButton) {
    selfieModalCaptureButton.addEventListener("click", captureModalSelfie);
  }

  if (selfieModalRetakeButton) {
    selfieModalRetakeButton.addEventListener("click", retakeModalSelfie);
  }

  if (selfieModalUseButton) {
    selfieModalUseButton.addEventListener("click", useModalSelfie);
  }

  /* Keep the stage shaped like the real camera frame
     (also follows a phone rotating while the camera is open). */
  if (selfieModalVideo) {
    selfieModalVideo.addEventListener("loadedmetadata", syncSelfieAspectFromVideo);
    selfieModalVideo.addEventListener("resize", syncSelfieAspectFromVideo);
  }

  document.addEventListener("keydown", handleSelfieModalKeydown);

  /* =======================================================
     BACK BUTTON
  ======================================================= */

  if (backButton) {
    backButton.addEventListener("click", handleBack);
  }

  /* =======================================================
     FORM SUBMIT

     Registered at the top of this file (FIX-6), right after the form
     is looked up. It is deliberately NOT registered a second time
     here: a duplicate listener would run every step twice.
  ======================================================= */

  /* =======================================================
     LOGOUT
  ======================================================= */

  if (logoutButton) {
    logoutButton.addEventListener("click", logout);
  }

  if (headerLogoutButton) {
    headerLogoutButton.addEventListener("click", logout);
  }

  /* =======================================================
     PAGE LIFECYCLE
  ======================================================= */

  window.addEventListener("beforeunload", () => {
    stopSelfieCamera();
  });

  /* FIX-4: pagehide is the reliable "page going away" event on
     mobile browsers, where beforeunload often never fires. */
  window.addEventListener("pagehide", () => {
    stopSelfieCamera();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      pauseSelfieCameraIfActive();
    }
  });

  /* =======================================================
     FINAL REVIEW CHECKBOX

     The final submit action itself is the confirmation. Keep the
     existing HTML untouched, but do not make the old checkbox a
     submission requirement.
  ======================================================= */

  function disableLegacyReviewCheckbox() {
    if (!reviewConfirmation) {
      return;
    }

    reviewConfirmation.disabled = true;

    const wrapper = reviewConfirmation.closest(".auth-field");
    if (wrapper) {
      wrapper.hidden = true;
    }
  }

  /* =======================================================
     INITIALIZATION
  ======================================================= */

  async function init() {
    if (!form) return;

    /* FIX-1: never initialise twice. */
    if (initStarted) return;
    initStarted = true;

    initializePageState();
    disableLegacyReviewCheckbox();

    /*
     * FIX-1: block "Save & Continue" until the account data has loaded.
     * Otherwise a fast click could move the wizard on while the load
     * was still in flight, and the load would then drag it back.
     * setStep() re-enables the button as soon as the wizard starts.
     */
    setSaveButtonState(true, STEP_META[1].button, STEP_META[1].icon);

    await loadCurrentUser();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  /* =======================================================
     PUBLIC CONTROL API
  ======================================================= */

  window.BarakaLinkProfileCompletion = {
    load: loadCurrentUser,
    save: () => {
      if (currentStep === 1) return saveStepOne();
      if (currentStep === 2) return continueStepTwo();
      if (currentStep === 3) return continueStepThree();
      if (currentStep === 4) return continueStepFour();
      return submitParentProfileForReview();
    },
    saveStepOne,
    continueStepTwo,
    continueStepThree,
    continueStepFour,
    submitParentProfileForReview,
    goToStep: setStep,
    logout,
    /* FIX-8: read-only, for checking which API address this page resolved
       (remote-debugging a phone, or a quick check on the computer). */
    apiBase: API_BASE
  };

})();
