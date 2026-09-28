"use strict";

/* =========================================================
   BARAKALINK — USTAZ / TEACHER DASHBOARD
   frontend/js/teacher.js

   - Loads GET /api/profile
   - Renders Ustaz account/profile/dashboard data
   - Renders subjects, languages, availability, qualifications
   - Renders profile photo across desktop/mobile/profile views
   - Handles dashboard navigation and mobile sidebar
   - Handles shared desktop/mobile profile menu
   - Handles light/dark theme
   - Handles recitation mini-player
   - Handles logout and retry
========================================================= */

(() => {
  "use strict";

  const CONFIG = Object.freeze({
    PROFILE_ENDPOINT: "/profile",
    API_BASE: window.BARAKALINK_API_BASE || "http://localhost:5000/api",
    THEME_KEY: "barakalink_theme",
    TOKEN_KEYS: ["barakalink_token", "token", "access_token"],
    MESSAGE_NOTIFICATION_POLL_MS: 15000,
    LOGIN_PATH: "../login.html",
    PROFILE_PATH: "../ustaz-profile.html",
  });

  const state = {
    user: null,
    teacher: null,
    studyFields: [],
    languages: [],
    availability: [],
    qualifications: [],
    section: "home",
    loading: false,
    initialized: false,
    audioBound: false,
    notificationPanelOpen: false,
    sidebarOpen: false,
    messageNotificationTimer: null,
    messageNotificationLoading: false,
    messageNotificationVisibilityBound: false,
    unreadMessageCount: 0,
    messageNotifications: [],
    messageConversations: [],
    messageConversationsLoading: false,
  };

  const $ = (id) => document.getElementById(id);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  function text(value, fallback = "") {
    if (value === null || value === undefined) return fallback;
    const result = String(value).trim();
    return result || fallback;
  }

  function firstName(user = {}) {
    return text(user.firstName ?? user.first_name, "Ustaz");
  }

  function fullName(user = {}) {
    const first = text(user.firstName ?? user.first_name);
    const last = text(user.lastName ?? user.last_name);
    return [first, last].filter(Boolean).join(" ") || "BarakaLink User";
  }

  function getRoleLabel(user = {}, teacher = {}) {
    const direct = text(
      user.roleLabel ??
        user.role_label ??
        teacher.roleLabel ??
        teacher.role_label
    );

    if (direct) return direct;

    const gender = text(user.gender ?? teacher.gender).toLowerCase();
    if (gender === "female") return "Ustaza";
    if (gender === "male") return "Ustaz";
    return "Ustaz / Ustaza";
  }

  function normalizeArray(value) {
    if (Array.isArray(value)) return value;

    if (value === null || value === undefined || value === "") return [];

    if (typeof value === "string") {
      return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }

    return [];
  }

  function itemValue(item, keys = []) {
    if (item === null || item === undefined) return "";
    if (typeof item !== "object") return text(item);

    for (const key of keys) {
      const value = text(item?.[key]);
      if (value) return value;
    }

    return "";
  }

  function labelize(value) {
    const input = text(value);
    if (!input) return "";

    return input
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function getToken() {
    try {
      if (
        window.BarakaLinkAPI &&
        typeof window.BarakaLinkAPI.getToken === "function"
      ) {
        const token = window.BarakaLinkAPI.getToken();
        if (token) return token;
      }
    } catch (error) {
      console.warn("[BarakaLink][Ustaz Dashboard] Unable to read API token:", error);
    }

    for (const key of CONFIG.TOKEN_KEYS) {
      try {
        const localToken = localStorage.getItem(key);
        if (localToken) return localToken;
      } catch (_) {}

      try {
        const sessionToken = sessionStorage.getItem(key);
        if (sessionToken) return sessionToken;
      } catch (_) {}
    }

    return "";
  }

  function clearSession() {
    stopMessageNotificationPolling();

    const keys = [
      ...CONFIG.TOKEN_KEYS,
      "barakalink_user",
      "barakalink_session",
      "user",
    ];

    keys.forEach((key) => {
      try {
        localStorage.removeItem(key);
      } catch (_) {}

      try {
        sessionStorage.removeItem(key);
      } catch (_) {}
    });
  }

  function redirectToLogin() {
    clearSession();
    window.location.replace(CONFIG.LOGIN_PATH);
  }

  function redirectToProfile() {
    window.location.replace(CONFIG.PROFILE_PATH);
  }

  function setText(id, value, fallback = "") {
    const element = $(id);
    if (!element) return;
    element.textContent = text(value, fallback);
  }

  function setHidden(id, hidden) {
    const element = $(id);
    if (!element) return;
    element.hidden = Boolean(hidden);
  }

  /* =========================================================
     THEME
  ========================================================= */

  function getSavedTheme() {
    try {
      const saved = localStorage.getItem(CONFIG.THEME_KEY);
      return saved === "light" || saved === "dark" ? saved : null;
    } catch (_) {
      return null;
    }
  }

  function getInitialTheme() {
    const saved = getSavedTheme();
    if (saved) return saved;

    try {
      if (
        window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches
      ) {
        return "dark";
      }
    } catch (_) {}

    return "light";
  }

  function applyTheme(theme) {
    const value = theme === "dark" ? "dark" : "light";
    const isDark = value === "dark";

    document.documentElement.dataset.theme = value;
    document.documentElement.setAttribute("data-theme", value);
    document.body.classList.toggle("dark-theme", isDark);

    const meta = $("themeColorMeta");
    if (meta) {
      meta.setAttribute("content", isDark ? "#17130F" : "#FBF7EE");
    }

    const button = $("themeToggle");
    if (button) {
      const icon = button.querySelector("i");
      if (icon) {
        icon.className = isDark ? "fa-solid fa-sun" : "fa-solid fa-moon";
      }
      button.setAttribute(
        "aria-label",
        isDark ? "Switch to light theme" : "Switch to dark theme"
      );
    }

    const switchButton = $("ustazThemeSwitch");
    if (switchButton) {
      switchButton.setAttribute("aria-checked", isDark ? "true" : "false");
    }

    try {
      localStorage.setItem(CONFIG.THEME_KEY, value);
    } catch (_) {}
  }

  function toggleTheme() {
    const current = document.body.classList.contains("dark-theme") ? "dark" : "light";
    applyTheme(current === "dark" ? "light" : "dark");
  }

  function setupTheme() {
    applyTheme(getInitialTheme());

    const themeToggle = $("themeToggle");
    if (themeToggle && themeToggle.dataset.ustazThemeBound !== "1") {
      themeToggle.dataset.ustazThemeBound = "1";
      themeToggle.addEventListener("click", toggleTheme);
    }

    const themeSwitch = $("ustazThemeSwitch");
    if (themeSwitch && themeSwitch.dataset.ustazThemeBound !== "1") {
      themeSwitch.dataset.ustazThemeBound = "1";
      themeSwitch.addEventListener("click", toggleTheme);
    }
  }

  /* =========================================================
     MEDIA / AVATARS
  ========================================================= */

  function resolveMediaUrl(value) {
    const raw = text(value);
    if (!raw) return "";

    if (/^(https?:|data:|blob:|filesystem:)/i.test(raw)) {
      return raw;
    }

    if (raw.startsWith("//")) {
      return `${window.location.protocol}${raw}`;
    }

    const apiBase = String(CONFIG.API_BASE).replace(/\/+$/, "");
    const serverBase = apiBase.replace(/\/api$/i, "");

    if (raw.startsWith("/uploads/") || raw.startsWith("/media/")) {
      return `${serverBase}${raw}`;
    }

    if (raw.startsWith("uploads/") || raw.startsWith("media/")) {
      return `${serverBase}/${raw}`;
    }

    if (raw.startsWith("/")) {
      try {
        return new URL(raw, serverBase || window.location.origin).href;
      } catch (_) {
        return raw;
      }
    }

    return `${serverBase}/${raw.replace(/^\/+/, "")}`;
  }

  function getInitials(user = {}) {
    const first = text(user.firstName ?? user.first_name);
    const last = text(user.lastName ?? user.last_name);
    const initials = `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
    return initials || "BL";
  }

  function getProfilePhoto() {
    return text(
      state.user?.avatarUrl ??
        state.user?.avatar_url ??
        state.user?.profilePhoto ??
        state.user?.profile_photo ??
        state.user?.photoUrl ??
        state.user?.photo_url ??
        state.teacher?.avatarUrl ??
        state.teacher?.avatar_url ??
        state.teacher?.profilePhoto ??
        state.teacher?.profile_photo ??
        state.teacher?.profilePhotoUrl ??
        state.teacher?.profile_photo_url ??
        state.teacher?.photoUrl ??
        state.teacher?.photo_url
    );
  }

  function mountAvatar(wrapperId, initialsId, imageId) {
    const wrapper = wrapperId ? $(wrapperId) : null;
    const initials = $(initialsId);
    const image = $(imageId);
    const resolvedWrapper = wrapper || image?.closest(".ustaz-avatar");

    if (!resolvedWrapper || !initials || !image) return;

    const name = fullName(state.user || {});
    const initialsValue = getInitials(state.user || {});
    const photo = resolveMediaUrl(getProfilePhoto());

    initials.textContent = initialsValue;

    if (!photo) {
      image.hidden = true;
      image.removeAttribute("src");
      initials.hidden = false;
      return;
    }

    image.alt = `${name} profile photo`;
    image.hidden = false;
    initials.hidden = false;
    image.src = photo;

    image.onload = () => {
      image.hidden = false;
      initials.hidden = true;
    };

    image.onerror = () => {
      image.hidden = true;
      image.removeAttribute("src");
      initials.hidden = false;
    };
  }

  function mountAllAvatars() {
    mountAvatar("ustazSidebarAvatar", "ustazSidebarAvatarInitials", "ustazSidebarAvatarImage");
    mountAvatar("ustazAvatar", "ustazAvatarInitials", "ustazAvatarImage");
    mountAvatar(null, "ustazProfileMenuInitials", "ustazProfileMenuImage");
    mountAvatar("ustazHomeAvatar", "ustazHomeAvatarInitials", "ustazHomeAvatarImage");
    mountAvatar("ustazProfileAvatar", "ustazProfileAvatarInitials", "ustazProfileAvatarImage");
  }

  /* =========================================================
     PROFILE DATA NORMALIZATION
  ========================================================= */

  function normalizeStudyField(item) {
    if (typeof item === "string") return text(item);
    return itemValue(item, [
      "name",
      "label",
      "title",
      "field",
      "studyField",
      "study_field",
      "slug",
      "code",
      "value",
    ]);
  }

  function normalizeLanguage(item) {
    if (typeof item === "string") return text(item);
    return itemValue(item, [
      "name",
      "language",
      "label",
      "slug",
      "code",
      "value",
    ]);
  }

  function normalizeAvailability(item) {
    if (typeof item === "string" || typeof item === "number") {
      const numeric = Number(item);
      return {
        raw: String(item),
        day: String(item),
        weekday: Number.isFinite(numeric) ? numeric : null,
        dayName: "",
      };
    }

    const rawDay = itemValue(item, [
      "day",
      "dayOfWeek",
      "day_of_week",
      "weekday",
      "value",
    ]);

    const dayName = itemValue(item, [
      "dayName",
      "day_name",
      "name",
      "label",
    ]);

    const numericValue =
      item?.weekday ??
      item?.dayOfWeek ??
      item?.day_of_week ??
      item?.day;

    const numeric = Number(numericValue);

    return {
      raw: rawDay,
      day: rawDay,
      weekday: Number.isFinite(numeric) ? numeric : null,
      dayName,
    };
  }

  function normalizeQualification(item) {
    if (item === null || item === undefined) return null;

    if (typeof item === "string") {
      const title = text(item);
      return title
        ? {
            id: null,
            title,
            institution: "",
            completionYear: "",
            specialization: "",
            certificateUrl: "",
            certificateName: "",
            certificateSize: "",
            certificateMime: "",
          }
        : null;
    }

    if (typeof item !== "object") return null;

    const title = itemValue(item, [
      "title",
      "qualificationTitle",
      "qualification_title",
      "degree",
      "qualificationName",
      "qualification_name",
      "name",
    ]);

    const institution = itemValue(item, [
      "institution",
      "institutionName",
      "institution_name",
      "school",
      "university",
    ]);

    const completionYear = itemValue(item, [
      "completionYear",
      "completion_year",
      "yearCompleted",
      "year_completed",
      "year",
    ]);

    const specialization = itemValue(item, [
      "specialization",
      "specialisation",
      "major",
      "field",
      "focusArea",
      "focus_area",
    ]);

    const certificateUrl = itemValue(item, [
      "certificateUrl",
      "certificate_url",
      "documentUrl",
      "document_url",
      "fileUrl",
      "file_url",
      "certificatePath",
      "certificate_path",
      "certificate",
    ]);

    const certificateName = itemValue(item, [
      "certificateName",
      "certificate_name",
      "documentName",
      "document_name",
      "fileName",
      "file_name",
    ]);

    const certificateSize = itemValue(item, [
      "certificateSize",
      "certificate_size",
      "documentSize",
      "document_size",
      "fileSize",
      "file_size",
    ]);

    const certificateMime = itemValue(item, [
      "certificateMime",
      "certificate_mime",
      "documentMime",
      "document_mime",
      "fileMime",
      "file_mime",
    ]);

    const id = item?.id ?? item?.qualificationId ?? null;

    if (
      !title &&
      !institution &&
      !completionYear &&
      !specialization &&
      !certificateUrl &&
      !certificateName
    ) {
      return null;
    }

    return {
      id,
      title: title || "Qualification",
      institution,
      completionYear,
      specialization,
      certificateUrl,
      certificateName,
      certificateSize,
      certificateMime,
    };
  }

  function normalizeCollection(value, mapper) {
    return normalizeArray(value).map(mapper).filter(Boolean);
  }

  function isObject(value) {
    return value !== null && typeof value === "object";
  }

  function unwrapApiPayload(payload) {
    if (payload === null || payload === undefined) return payload;

    if (typeof payload === "string") {
      try {
        return JSON.parse(payload);
      } catch (_) {
        return payload;
      }
    }

    if (typeof payload.json === "function") {
      return payload.json();
    }

    return payload;
  }

  function extractProfile(payload) {
    const root = unwrapApiPayload(payload) ?? {};
    const rootObject = isObject(root) ? root : {};

    let data = rootObject?.data;
    if (!isObject(data)) {
      data = rootObject;
    }

    // Support the exact current backend response as well as an already-
    // unwrapped BarakaLinkAPI response without changing the backend.
    if (isObject(data?.data) && !data?.user) {
      data = data.data;
    }

    const user =
      data?.user ??
      rootObject?.user ??
      data?.account ??
      null;

    const teacher =
      data?.teacherProfile ??
      data?.teacher_profile ??
      data?.teacher ??
      data?.ustaz ??
      data?.profile?.teacherProfile ??
      data?.profile?.teacher_profile ??
      user?.teacherProfile ??
      user?.teacher_profile ??
      null;

    if (!isObject(user)) {
      const error = new Error(
        "Your BarakaLink account information could not be loaded."
      );
      error.code = "INVALID_PROFILE_RESPONSE";
      error.stage = "profile-normalization";
      error.payload = rootObject;
      throw error;
    }

    if (!isObject(teacher)) {
      console.error(
        "[BarakaLink][Ustaz Dashboard][profile-normalization] No teacher profile found.",
        { user, data }
      );
      const error = new Error("Your Ustaz teaching profile could not be found.");
      error.code = "INVALID_TEACHER_PROFILE";
      error.stage = "profile-normalization";
      throw error;
    }

    const studyFields = normalizeCollection(
      data?.studyFields ??
        data?.study_fields ??
        rootObject?.studyFields ??
        rootObject?.study_fields ??
        teacher?.studyFields ??
        teacher?.study_fields ??
        [],
      normalizeStudyField
    );

    const languages = normalizeCollection(
      data?.languages ??
        data?.teacherLanguages ??
        data?.teacher_languages ??
        rootObject?.languages ??
        rootObject?.teacherLanguages ??
        rootObject?.teacher_languages ??
        teacher?.languages ??
        teacher?.teacherLanguages ??
        teacher?.teacher_languages ??
        [],
      normalizeLanguage
    );

    const availability = normalizeCollection(
      data?.availability ??
        data?.availabilityDays ??
        data?.availability_days ??
        rootObject?.availability ??
        rootObject?.availabilityDays ??
        rootObject?.availability_days ??
        teacher?.availability ??
        teacher?.availabilityDays ??
        teacher?.availability_days ??
        [],
      normalizeAvailability
    );

    const qualifications = normalizeCollection(
      data?.qualifications ??
        data?.teacherQualifications ??
        data?.teacher_qualifications ??
        rootObject?.qualifications ??
        rootObject?.teacherQualifications ??
        rootObject?.teacher_qualifications ??
        teacher?.qualifications ??
        teacher?.teacherQualifications ??
        teacher?.teacher_qualifications ??
        [],
      normalizeQualification
    );

    return {
      user,
      teacher,
      studyFields,
      languages,
      availability,
      qualifications,
    };
  }

  /* =========================================================
     API
  ========================================================= */

  async function requestProfileWithApiHelper() {
    if (
      !window.BarakaLinkAPI ||
      typeof window.BarakaLinkAPI.get !== "function"
    ) {
      return null;
    }

    return window.BarakaLinkAPI.get(CONFIG.PROFILE_ENDPOINT);
  }

  async function requestProfileWithFetch() {
    const base = String(CONFIG.API_BASE).replace(/\/+$/, "");
    const token = getToken();

    const headers = { Accept: "application/json" };
    if (token) {
      headers.Authorization = token.startsWith("Bearer ")
        ? token
        : `Bearer ${token}`;
    }

    let response;

    try {
      response = await fetch(`${base}${CONFIG.PROFILE_ENDPOINT}`, {
        method: "GET",
        headers,
        credentials: "include",
        cache: "no-store",
      });
    } catch (networkError) {
      const error = new Error("Unable to connect to the BarakaLink server.");
      error.code = "NETWORK_ERROR";
      error.stage = "profile-request";
      error.originalError = networkError;
      throw error;
    }

    const raw = await response.text();
    let payload = {};

    try {
      payload = raw ? JSON.parse(raw) : {};
    } catch (_) {
      payload = {
        message: raw || `Request failed with HTTP ${response.status}.`,
      };
    }

    if (response.status === 401) {
      const error = new Error(
        text(payload?.message ?? payload?.error, "Your session has expired.")
      );
      error.status = 401;
      error.code = "UNAUTHORIZED";
      error.stage = "profile-request";
      error.payload = payload;
      throw error;
    }

    if (!response.ok) {
      const error = new Error(
        text(
          payload?.message ?? payload?.error,
          `Request failed with HTTP ${response.status}.`
        )
      );
      error.status = response.status;
      error.stage = "profile-request";
      error.payload = payload;
      throw error;
    }

    return payload;
  }

  async function loadProfile() {
    if (state.loading) return null;
    state.loading = true;

    try {
      console.info("[BarakaLink][Ustaz Dashboard][profile-request] Starting GET /api/profile");

      let payload = null;

      try {
        payload = await requestProfileWithApiHelper();
      } catch (helperError) {
        if (
          helperError?.status === 401 ||
          helperError?.code === "UNAUTHORIZED" ||
          (helperError?.status && helperError.status >= 400)
        ) {
          throw helperError;
        }

        console.warn(
          "[BarakaLink][Ustaz Dashboard][profile-request] BarakaLinkAPI.get failed; using direct fetch fallback.",
          helperError
        );
      }

      if (!payload) {
        payload = await requestProfileWithFetch();
      }

      console.info("[BarakaLink][Ustaz Dashboard][profile-request] /api/profile response received.");

      const unwrapped = await unwrapApiPayload(payload);
      const profile = extractProfile(unwrapped);

      state.user = profile.user;
      state.teacher = profile.teacher;
      state.studyFields = profile.studyFields;
      state.languages = profile.languages;
      state.availability = profile.availability;
      state.qualifications = profile.qualifications;

      console.info(
        "[BarakaLink][Ustaz Dashboard][profile-normalization] Profile normalized.",
        {
          userId: state.user?.id,
          teacherProfileId: state.teacher?.id,
          role: state.user?.role,
          profileCompleted: state.user?.profileCompleted,
          studyFieldCount: state.studyFields.length,
          languageCount: state.languages.length,
          availabilityCount: state.availability.length,
          qualificationCount: state.qualifications.length,
        }
      );

      return profile;
    } finally {
      state.loading = false;
    }
  }

  function isUstazRole() {
    const role = text(state.user?.role).toLowerCase();

    // The canonical BarakaLink role is "ustaz". If no role was returned,
    // let the profile load continue so the actual response can be inspected.
    if (!role) return true;

    return role === "ustaz";
  }

  function isProfileComplete() {
    return Boolean(
      state.user?.profileCompleted ??
        state.user?.profile_completed ??
        false
    );
  }

  /* =========================================================
     FORMATTING
  ========================================================= */

  function formatLocation(teacher = {}) {
    const subcity = text(teacher.subcity ?? teacher.sub_city);
    const area = text(teacher.area);
    return [subcity, area].filter(Boolean).join(" • ") || "Location not set";
  }

  function formatExperience(value) {
    if (value === null || value === undefined || value === "") {
      return "Not provided";
    }

    const number = Number(value);
    if (Number.isFinite(number)) {
      return `${number} ${number === 1 ? "year" : "years"}`;
    }

    return text(value, "Not provided");
  }

  function formatMoney(value) {
    if (value === null || value === undefined || value === "") {
      return "Not set";
    }

    const number = Number(value);
    if (!Number.isFinite(number)) return text(value, "Not set");

    return `ETB ${number.toLocaleString("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })}`;
  }

  function formatDuration(value) {
    if (value === null || value === undefined || value === "") {
      return "Not set";
    }

    const number = Number(value);
    return Number.isFinite(number) ? `${number} minutes` : text(value, "Not set");
  }

  function formatLessonFormat(value) {
    const normalized = text(value).toLowerCase();

    const labels = {
      online: "Online",
      in_person: "In person",
      "in-person": "In person",
      both: "Online & in person",
      hybrid: "Online & in person",
    };

    return labels[normalized] || labelize(value) || "Not set";
  }

  function formatVerification(value) {
    if (value === true) return "Verified";
    if (value === false) return "Not verified";

    const normalized = text(value).toLowerCase();
    if (["true", "1", "yes", "verified"].includes(normalized)) {
      return "Verified";
    }

    return "Not verified";
  }

  function formatDate(value) {
    const raw = text(value);
    if (!raw) return "Not provided";

    const simpleDate = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);

    if (simpleDate) {
      const [, year, month, day] = simpleDate;
      const parsed = new Date(Number(year), Number(month) - 1, Number(day));

      if (Number.isNaN(parsed.getTime())) return raw;

      try {
        return parsed.toLocaleDateString("en-US", {
          day: "numeric",
          month: "long",
          year: "numeric",
        });
      } catch (_) {
        return raw;
      }
    }

    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return raw;

    try {
      return parsed.toLocaleDateString("en-US", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    } catch (_) {
      return raw;
    }
  }

  function teacherValue(...keys) {
    for (const key of keys) {
      const value = state.teacher?.[key];
      if (value !== null && value !== undefined && String(value).trim() !== "") {
        return value;
      }
    }
    return "";
  }

  /* =========================================================
     RENDER: ACCOUNT + SUMMARY
  ========================================================= */

  function renderAccountDetails() {
    const user = state.user || {};
    const teacher = state.teacher || {};

    const name = fullName(user);
    const roleLabel = getRoleLabel(user, teacher);
    const location = formatLocation(teacher);
    const mosque = text(
      teacher.nearestMosque ?? teacher.nearest_mosque,
      "Not set"
    );

    setText("ustazWelcomeName", firstName(user));
    setText("ustazSidebarName", name);
    setText("ustazSidebarRole", roleLabel);
    setText("ustazTopbarName", name);
    setText("ustazTopbarRole", roleLabel);
    setText("ustazHomeName", name);
    setText("ustazProfileName", name);
    setText("ustazProfileRole", roleLabel);
    setText("ustazProfileMenuName", name);

    setText("ustazSidebarLocation", location, "Location not set");
    setText("ustazHomeLocation", location, "Location not set");
    setText("ustazProfileMenuLocation", location, "Not set");
    setText("ustazProfileMenuMosque", mosque, "Not set");

    setText("ustazSummaryLocation", location, "Not set");
    setText("ustazSummaryMosque", mosque, "Not set");

    setText("ustazProfileMenuPhone", text(user.phone, "Phone not available"));
    setText("ustazProfilePhone", text(user.phone, "—"));
    setText("ustazProfileMenuTelegram", formatVerification(user.telegramVerified ?? user.telegram_verified));
    setText("ustazProfileTelegram", formatVerification(user.telegramVerified ?? user.telegram_verified));

    setText(
      "ustazSubcity",
      text(teacher.subcity ?? teacher.sub_city, "Sub-city not set")
    );
    setText("ustazArea", text(teacher.area, "—"));

    setText(
      "ustazProfileSubcity",
      text(teacher.subcity ?? teacher.sub_city, "—")
    );
    setText("ustazProfileArea", text(teacher.area, "—"));
    setText("ustazProfileMosque", mosque, "—");

    setText("ustazExperience", formatExperience(teacher.experience));
    setText("ustazProfileExperience", formatExperience(teacher.experience));
    setText("ustazHomeGender", labelize(teacher.gender) || "—");
    setText("ustazProfileGender", labelize(teacher.gender) || "—");

    setText(
      "ustazProfileDateOfBirth",
      formatDate(
        teacher.dateOfBirth ??
          teacher.date_of_birth ??
          teacher.birthDate ??
          teacher.birth_date
      )
    );

    setText(
      "ustazHomeBio",
      text(
        teacher.bio ?? teacher.about ?? teacher.description,
        "Your teaching bio will appear here."
      )
    );

    setText(
      "ustazProfileBio",
      text(
        teacher.bio ?? teacher.about ?? teacher.description,
        "No bio added yet."
      )
    );

    const rate = formatMoney(
      teacher.hourlyRate ??
        teacher.hourly_rate ??
        teacher.pricePerHour ??
        teacher.price_per_hour
    );

    const duration = formatDuration(
      teacher.lessonDuration ?? teacher.lesson_duration
    );

    const lessonFormat = formatLessonFormat(
      teacher.lessonFormat ?? teacher.lesson_format
    );

    setText("ustazHomeRate", rate);
    setText("ustazProfileRate", rate);
    setText("ustazHomeDuration", duration);
    setText("ustazProfileDuration", duration);
    setText("ustazHomeFormat", lessonFormat);
    setText("ustazProfileFormat", lessonFormat);

    setText(
      "ustazProfileTeachingApproach",
      text(
        teacher.teachingApproach ?? teacher.teaching_approach,
        "Not provided"
      )
    );

    setText(
      "ustazProfileStatus",
      isProfileComplete() ? "Complete" : "Incomplete"
    );

    setText(
      "ustazProfilePill",
      isProfileComplete() ? "Profile complete" : "Profile incomplete"
    );

    setText(
      "ustazProfileMenuStatus",
      labelize(user.accountStatus ?? user.account_status) || "Active"
    );
  }

  function renderSubjects() {
    const subjects = state.studyFields
      .map(normalizeStudyField)
      .map(text)
      .filter(Boolean);

    setText("ustazSubjectsCount", String(subjects.length), "0");
    setText("ustazSummarySubjects", String(subjects.length), "0");

    const containers = [
      $("ustazSubjectList"),
      $("ustazProfileSubjects"),
    ].filter(Boolean);

    containers.forEach((container) => {
      container.replaceChildren();

      if (!subjects.length) {
        const empty = document.createElement("span");
        empty.className = "dashboard-empty-chip";
        empty.textContent = "No study fields selected";
        container.appendChild(empty);
        return;
      }

      subjects.forEach((subject) => {
        const chip = document.createElement("span");
        chip.className = "dashboard-chip";
        chip.textContent = labelize(subject);
        container.appendChild(chip);
      });
    });
  }

  function renderLanguages() {
    let languages = state.languages
      .map(normalizeLanguage)
      .map(labelize)
      .filter(Boolean);

    // If the backend has placed language objects only inside the teacher
    // profile, retain compatibility with that shape too.
    if (!languages.length) {
      languages = normalizeArray(
        state.teacher?.languages ?? state.teacher?.languagesSpoken
      )
        .map(normalizeLanguage)
        .map(labelize)
        .filter(Boolean);
    }

    languages = [...new Set(languages)];

    const value = languages.length ? languages.join(", ") : "Not provided";

    setText("ustazSummaryLanguages", value, "Not set");
    setText("ustazHomeLanguages", value, "Not provided");
    setText("ustazProfileLanguages", value, "Not provided");
  }

  function renderSummary() {
    const teacher = state.teacher || {};

    setText(
      "ustazSummaryLocation",
      formatLocation(teacher),
      "Not set"
    );

    setText(
      "ustazSummaryMosque",
      text(teacher.nearestMosque ?? teacher.nearest_mosque, "Not set"),
      "Not set"
    );
  }

  /* =========================================================
     RENDER: AVAILABILITY
  ========================================================= */

  function availabilityLabel(item) {
    const normalized = normalizeAvailability(item);

    if (normalized.dayName) {
      return normalized.dayName;
    }

    if (
      normalized.weekday !== null &&
      Number.isFinite(normalized.weekday) &&
      normalized.weekday >= 0 &&
      normalized.weekday <= 6
    ) {
      const dayNames = [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ];
      return dayNames[normalized.weekday];
    }

    return labelize(normalized.day);
  }

  function renderAvailability() {
    const container = $("ustazAvailabilityDays");
    const empty = $("ustazAvailabilityEmpty");

    if (!container) return;

    container.replaceChildren();

    let values = state.availability
      .map(availabilityLabel)
      .map(text)
      .filter(Boolean);

    if (!values.length) {
      values = normalizeArray(
        state.teacher?.availabilityDays ??
          state.teacher?.availability_days
      )
        .map(availabilityLabel)
        .map(text)
        .filter(Boolean);
    }

    values = [...new Set(values)];

    if (empty) empty.hidden = values.length > 0;

    values.forEach((day) => {
      const element = document.createElement("div");
      element.className = "ustaz-day active";

      const icon = document.createElement("i");
      icon.className = "fa-regular fa-calendar";

      const label = document.createElement("span");
      label.textContent = day.length > 3 ? day.slice(0, 3) : day;

      element.appendChild(icon);
      element.appendChild(label);
      container.appendChild(element);
    });
  }

  /* =========================================================
     RENDER: QUALIFICATIONS
  ========================================================= */

  function renderQualifications() {
    const containers = [
      $("ustazHomeQualifications"),
      $("ustazProfileQualifications"),
    ].filter(Boolean);

    containers.forEach((container) => {
      container.replaceChildren();

      if (!state.qualifications.length) {
        const empty = document.createElement("div");
        empty.className = "ustaz-qualification-empty";

        const icon = document.createElement("i");
        icon.className = "fa-regular fa-folder-open";

        const label = document.createElement("span");
        label.textContent = "No qualifications added yet.";

        empty.appendChild(icon);
        empty.appendChild(label);
        container.appendChild(empty);
        return;
      }

      state.qualifications.forEach((qualification) => {
        const card = document.createElement("div");
        card.className = "ustaz-qualification-card";

        const heading = document.createElement("div");
        heading.className = "ustaz-qualification-heading";

        const icon = document.createElement("span");
        icon.className = "ustaz-qualification-icon";

        const iconGlyph = document.createElement("i");
        iconGlyph.className = "fa-solid fa-graduation-cap";
        icon.appendChild(iconGlyph);

        const copy = document.createElement("div");

        const title = document.createElement("strong");
        title.textContent = qualification.title;

        const metaParts = [
          qualification.institution,
          qualification.specialization,
          qualification.completionYear
            ? `Completed ${qualification.completionYear}`
            : "",
        ].filter(Boolean);

        const meta = document.createElement("span");
        meta.textContent = metaParts.length
          ? metaParts.join(" • ")
          : "Details not provided";

        copy.appendChild(title);
        copy.appendChild(meta);
        heading.appendChild(icon);
        heading.appendChild(copy);
        card.appendChild(heading);

        if (qualification.certificateUrl) {
          const link = document.createElement("a");
          link.className = "ustaz-qualification-link";
          link.href = resolveMediaUrl(qualification.certificateUrl);
          link.target = "_blank";
          link.rel = "noopener noreferrer";

          const linkIcon = document.createElement("i");
          linkIcon.className = "fa-solid fa-arrow-up-right-from-square";

          const linkLabel = document.createElement("span");
          linkLabel.textContent = qualification.certificateName || "View certificate";

          link.appendChild(linkIcon);
          link.appendChild(linkLabel);
          card.appendChild(link);
        } else if (qualification.certificateName) {
          const fileLabel = document.createElement("div");
          fileLabel.className = "ustaz-qualification-link";

          const fileIcon = document.createElement("i");
          fileIcon.className = "fa-regular fa-file-lines";

          const fileName = document.createElement("span");
          fileName.textContent = qualification.certificateName;

          fileLabel.appendChild(fileIcon);
          fileLabel.appendChild(fileName);
          card.appendChild(fileLabel);
        }

        container.appendChild(card);
      });
    });
  }

  /* =========================================================
     RENDER: RECITATION
  ========================================================= */

  function formatAudioTime(seconds) {
    const total = Math.max(0, Math.floor(Number(seconds) || 0));
    const minutes = Math.floor(total / 60);
    const secondsPart = total % 60;
    return `${minutes}:${String(secondsPart).padStart(2, "0")}`;
  }

  function resetAudioUi() {
    const progress = $("ustazAudioProgress");
    const current = $("ustazAudioTime");
    const duration = $("ustazAudioDuration");
    const play = $("ustazAudioPlay");

    if (progress) {
      progress.value = "0";
      progress.max = "0";
    }

    if (current) current.textContent = "0:00";
    if (duration) duration.textContent = "0:00";

    if (play) {
      play.setAttribute("aria-label", "Play recitation");
      const icon = play.querySelector("i");
      if (icon) icon.className = "fa-solid fa-play";
    }
  }

  function updateAudioButton() {
    const audio = $("ustazAudioPlayer");
    const button = $("ustazAudioPlay");
    if (!audio || !button) return;

    const icon = button.querySelector("i");
    if (icon) {
      icon.className = audio.paused
        ? "fa-solid fa-play"
        : "fa-solid fa-pause";
    }

    button.setAttribute(
      "aria-label",
      audio.paused ? "Play recitation" : "Pause recitation"
    );
  }

  function updateAudioUi() {
    const audio = $("ustazAudioPlayer");
    const progress = $("ustazAudioProgress");
    const current = $("ustazAudioTime");
    const duration = $("ustazAudioDuration");

    if (!audio) return;

    const durationValue = Number(audio.duration);

    if (progress) {
      progress.max = Number.isFinite(durationValue)
        ? String(durationValue)
        : "0";
      progress.value = String(Number(audio.currentTime) || 0);
    }

    if (current) current.textContent = formatAudioTime(audio.currentTime);
    if (duration) duration.textContent = formatAudioTime(audio.duration);
  }

  function bindAudioEvents() {
    if (state.audioBound) return;

    const audio = $("ustazAudioPlayer");
    const play = $("ustazAudioPlay");
    const progress = $("ustazAudioProgress");

    if (!audio) return;

    state.audioBound = true;

    if (play) {
      play.addEventListener("click", async () => {
        try {
          if (audio.paused) {
            await audio.play();
          } else {
            audio.pause();
          }
        } catch (error) {
          console.error(
            "[BarakaLink][Ustaz Dashboard] Unable to play recitation:",
            error
          );
        }

        updateAudioButton();
      });
    }

    audio.addEventListener("play", updateAudioButton);
    audio.addEventListener("pause", updateAudioButton);
    audio.addEventListener("ended", updateAudioButton);
    audio.addEventListener("loadedmetadata", updateAudioUi);
    audio.addEventListener("durationchange", updateAudioUi);
    audio.addEventListener("timeupdate", updateAudioUi);

    if (progress) {
      progress.addEventListener("input", () => {
        const value = Number(progress.value);
        if (Number.isFinite(value) && Number.isFinite(audio.duration)) {
          audio.currentTime = value;
        }
      });
    }

    audio.addEventListener("error", () => {
      console.warn(
        "[BarakaLink][Ustaz Dashboard] Recitation audio could not be loaded.",
        audio.error
      );
    });
  }

  function renderRecitation() {
    const teacher = state.teacher || {};

    const title = text(
      teacher.recitationTitle ?? teacher.recitation_title,
      "No sample loaded"
    );

    const description = text(
      teacher.recitationDescription ?? teacher.recitation_description,
      "Add a recording from your profile page."
    );

    const url = text(
      teacher.recitationAudioUrl ??
        teacher.recitation_audio_url ??
        teacher.recitationUrl ??
        teacher.recitation_url ??
        teacher.sampleRecitationUrl ??
        teacher.sample_recitation_url
    );

    setText("ustazRecitationTitle", title, "No sample loaded");
    setText("ustazRecitationDescription", description, "Add a recording from your profile page.");

    const mini = $("ustazAudioMini");
    const audio = $("ustazAudioPlayer");
    if (!mini || !audio) return;

    bindAudioEvents();

    if (!url) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      mini.hidden = true;
      resetAudioUi();
      return;
    }

    const resolvedUrl = resolveMediaUrl(url);
    if (!resolvedUrl) {
      mini.hidden = true;
      resetAudioUi();
      return;
    }

    audio.pause();
    audio.src = resolvedUrl;
    audio.load();
    mini.hidden = false;
    resetAudioUi();
  }

  /* =========================================================
     DASHBOARD RENDER
  ========================================================= */

  function renderDashboard() {
    renderAccountDetails();
    renderSummary();
    renderSubjects();
    renderLanguages();
    renderAvailability();
    renderQualifications();
    renderRecitation();
    mountAllAvatars();
  }

  /* =========================================================
     NAVIGATION
  ========================================================= */

  function isMobileSidebarMode() {
    return window.matchMedia
      ? window.matchMedia("(max-width: 900px)").matches
      : window.innerWidth <= 900;
  }

  function setSidebarAria(open) {
    const toggle = $("ustazMenuToggle");
    const sidebar = $("ustazSidebar");
    const overlay = $("ustazSidebarOverlay");

    if (toggle) {
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
    }

    if (sidebar) {
      const hiddenOnMobile = isMobileSidebarMode() && !open;
      sidebar.setAttribute("aria-hidden", hiddenOnMobile ? "true" : "false");
    }

    if (overlay) {
      overlay.setAttribute("aria-hidden", open ? "false" : "true");
    }
  }

  function closeSidebar() {
    const root = $("ustazDashboard");
    if (!root) return;

    const sidebar = $("ustazSidebar");

    state.sidebarOpen = false;

    // Keep the legacy root class harmlessly synchronized with the actual
    // class used by the current CSS.
    root.classList.remove("sidebar-open");
    root.classList.remove("ustaz-sidebar-open");

    if (sidebar) {
      sidebar.classList.remove("is-open");
    }

    document.body.classList.remove("ustaz-dashboard-sidebar-open");
    document.body.classList.remove("ustaz-dashboard-scroll-locked");

    setSidebarAria(false);
  }

  function openSidebar() {
    const root = $("ustazDashboard");
    const sidebar = $("ustazSidebar");

    if (!root || !sidebar || !isMobileSidebarMode()) return;

    closeProfileMenu();
    closeNotificationPanel();

    state.sidebarOpen = true;

    root.classList.add("sidebar-open");
    root.classList.add("ustaz-sidebar-open");
    sidebar.classList.add("is-open");

    document.body.classList.add("ustaz-dashboard-sidebar-open");
    document.body.classList.add("ustaz-dashboard-scroll-locked");

    setSidebarAria(true);
  }

  /* =========================================================
     PROFILE MENU
  ========================================================= */

  function openProfileMenu(trigger = null) {
    const menu = $("ustazProfileMenu");
    if (!menu) return;

    closeNotificationPanel();
    menu.hidden = false;
    state.profileMenuOpen = true;

    const buttons = [
      $("ustazAvatarButton"),
      $("ustazSidebarProfileButton"),
    ].filter(Boolean);

    buttons.forEach((button) => {
      button.setAttribute("aria-expanded", button === trigger ? "true" : "false");
    });
  }

  function closeProfileMenu() {
    const menu = $("ustazProfileMenu");
    const buttons = [
      $("ustazAvatarButton"),
      $("ustazSidebarProfileButton"),
    ].filter(Boolean);

    state.profileMenuOpen = false;

    if (menu) {
      menu.hidden = true;
    }

    buttons.forEach((button) => {
      button.setAttribute("aria-expanded", "false");
    });
  }

  function toggleProfileMenu(trigger) {
    const menu = $("ustazProfileMenu");
    if (!menu) return;

    if (menu.hidden) {
      openProfileMenu(trigger);
    } else {
      closeProfileMenu();
    }
  }

  /* =========================================================
     NOTIFICATIONS / UNREAD MESSAGE STATE
  ========================================================= */

  function formatUnreadBadge(count) {
    const value = Math.max(0, Number(count) || 0);
    return value > 99 ? "99+" : String(value);
  }

  function updateMessageBadges(count) {
    const value = Math.max(0, Number(count) || 0);
    const label = formatUnreadBadge(value);

    [$("ustazMessagesBadge"), $("ustazNotificationBadge")].forEach((badge) => {
      if (!badge) return;
      badge.hidden = value === 0;
      badge.textContent = label;
      badge.setAttribute("aria-label", `${value} unread message${value === 1 ? "" : "s"}`);
    });
  }

  function payloadData(payload) {
    if (payload && typeof payload === "object" && payload.data !== undefined) {
      return payload.data;
    }
    return payload || {};
  }

  async function requestMessageNotifications(endpoint) {
    if (window.BarakaLinkAPI && typeof window.BarakaLinkAPI.get === "function") {
      return window.BarakaLinkAPI.get(endpoint);
    }

    const token = getToken();
    if (!token) {
      const error = new Error("Authentication token is missing.");
      error.status = 401;
      throw error;
    }

    const base = String(CONFIG.API_BASE).replace(/\/+$/, "");
    const response = await fetch(`${base}${endpoint}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: token.startsWith("Bearer ")
          ? token
          : `Bearer ${token}`,
      },
      credentials: "include",
      cache: "no-store",
    });

    const raw = await response.text();
    let payload = {};

    try {
      payload = raw ? JSON.parse(raw) : {};
    } catch (_) {
      payload = { message: raw || `Request failed with HTTP ${response.status}.` };
    }

    if (response.status === 401) {
      const error = new Error(
        text(payload?.message ?? payload?.error, "Your session has expired.")
      );
      error.status = 401;
      error.code = "UNAUTHORIZED";
      throw error;
    }

    if (!response.ok || payload?.success === false) {
      const error = new Error(
        text(payload?.message ?? payload?.error, `Request failed with HTTP ${response.status}.`)
      );
      error.status = response.status;
      error.payload = payload;
      throw error;
    }

    return payload;
  }

  function normalizeNotificationConversation(row) {
    if (!row || typeof row !== "object") return null;

    const id = Number(row.id);
    if (!Number.isInteger(id) || id <= 0) return null;

    const other = row.otherUser ?? row.other_user ?? {};
    const otherUser = {
      id: Number(other.id ?? row.otherUserId ?? row.other_user_id),
      firstName: text(other.firstName ?? other.first_name ?? row.otherFirstName ?? row.other_first_name),
      lastName: text(other.lastName ?? other.last_name ?? row.otherLastName ?? row.other_last_name),
      avatarUrl: text(other.avatarUrl ?? other.avatar_url ?? row.otherAvatarUrl ?? row.other_avatar_url),
    };

    if (!Number.isInteger(otherUser.id) || otherUser.id <= 0) return null;

    const unreadCount = Math.max(0, Number(row.unreadCount ?? row.unread_count ?? 0));
    if (unreadCount === 0) return null;

    const unreadMessage = row.unreadMessage ?? row.unread_message ?? null;
    const body = text(
      unreadMessage?.body ??
        row.unreadMessageBody ??
        row.unread_message_body
    );

    const createdAt =
      unreadMessage?.createdAt ??
      unreadMessage?.created_at ??
      row.unreadMessageCreatedAt ??
      row.unread_message_created_at ??
      null;

    return {
      id,
      otherUser,
      unreadCount,
      body,
      createdAt,
    };
  }

  function formatNotificationTime(value) {
    if (!value) return "";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";

    const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));

    if (seconds < 10) return "Just now";
    if (seconds < 60) return `${seconds} seconds ago`;

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;

    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;

    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  function notificationInitials(user) {
    const first = text(user?.firstName);
    const last = text(user?.lastName);
    return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase() || "BL";
  }

  function appendNotificationEmpty(list) {
    const empty = document.createElement("div");
    empty.className = "ustaz-notification-empty";

    const icon = document.createElement("div");
    icon.className = "ustaz-notification-empty-icon";

    const iconGlyph = document.createElement("i");
    iconGlyph.className = "fa-regular fa-bell";
    iconGlyph.setAttribute("aria-hidden", "true");
    icon.appendChild(iconGlyph);

    const title = document.createElement("strong");
    title.textContent = "No new message notifications";

    const message = document.createElement("p");
    message.textContent = "Unread student messages will appear here.";

    empty.append(icon, title, message);
    list.appendChild(empty);
  }

  function renderNotifications() {
    const list = $("ustazNotificationList");
    if (!list) return;

    list.replaceChildren();

    const notifications = Array.isArray(state.messageNotifications)
      ? state.messageNotifications
      : [];

    if (!notifications.length) {
      appendNotificationEmpty(list);
      return;
    }

    const fragment = document.createDocumentFragment();

    notifications.forEach((notification) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "ustaz-message-notification unread";
      button.dataset.conversationId = String(notification.id);
      button.setAttribute("aria-label", `Open new message from ${fullName(notification.otherUser)}`);

      const avatar = document.createElement("span");
      avatar.className = "ustaz-message-notification-avatar";

      const initials = document.createElement("span");
      initials.textContent = notificationInitials(notification.otherUser);
      avatar.appendChild(initials);

      const photo = resolveMediaUrl(notification.otherUser.avatarUrl);
      if (photo) {
        const image = document.createElement("img");
        image.src = photo;
        image.alt = "";
        image.addEventListener("load", () => { initials.hidden = true; }, { once: true });
        image.addEventListener("error", () => { image.remove(); initials.hidden = false; }, { once: true });
        avatar.appendChild(image);
      }

      const copy = document.createElement("span");
      copy.className = "ustaz-message-notification-copy";

      const title = document.createElement("span");
      title.className = "ustaz-message-notification-title";
      title.textContent = "New message";

      const name = document.createElement("strong");
      name.className = "ustaz-message-notification-name";
      name.textContent = fullName(notification.otherUser) || "BarakaLink User";

      const preview = document.createElement("span");
      preview.className = "ustaz-message-notification-preview";
      preview.textContent = notification.body || "You have a new message.";

      copy.append(title, name, preview);

      const time = document.createElement("span");
      time.className = "ustaz-message-notification-time";
      time.textContent = formatNotificationTime(notification.createdAt);

      const dot = document.createElement("span");
      dot.className = "ustaz-message-notification-dot";
      dot.setAttribute("aria-hidden", "true");

      button.append(avatar, copy, time, dot);
      button.addEventListener("click", () => {
        const conversationId = Number(button.dataset.conversationId);
        if (!Number.isInteger(conversationId) || conversationId <= 0) return;

        window.location.href = `inbox.html?conversation=${encodeURIComponent(conversationId)}`;
      });

      fragment.appendChild(button);
    });

    list.appendChild(fragment);
  }

  async function loadUnreadMessageNotifications() {
    const payload = await requestMessageNotifications("/conversations");
    const data = payloadData(payload);
    const rows = Array.isArray(data)
      ? data
      : Array.isArray(data?.conversations)
        ? data.conversations
        : [];

    state.messageNotifications = rows
      .map(normalizeNotificationConversation)
      .filter(Boolean);

    if (state.notificationPanelOpen) {
      renderNotifications();
    }

    return state.messageNotifications;
  }

  async function fetchUnreadMessageCount() {
    if (state.messageNotificationLoading || document.hidden) return;
    state.messageNotificationLoading = true;

    try {
      const payload = await requestMessageNotifications("/conversations/unread-count");
      const data = payloadData(payload);
      const count = Math.max(0, Number(data?.count ?? payload?.count ?? 0));

      state.unreadMessageCount = count;
      updateMessageBadges(count);

      // Keep already-open notification panels synchronized with the source of truth.
      if (state.notificationPanelOpen && count === 0) {
        state.messageNotifications = [];
        renderNotifications();
      }
    } catch (error) {
      if (error?.status === 401 || error?.code === "UNAUTHORIZED") {
        stopMessageNotificationPolling();
        redirectToLogin();
        return;
      }

      console.warn(
        "[BarakaLink][Ustaz Dashboard][message-notifications] Unread count failed.",
        error
      );
    } finally {
      state.messageNotificationLoading = false;
    }
  }

  function stopMessageNotificationPolling() {
    if (state.messageNotificationTimer !== null) {
      window.clearInterval(state.messageNotificationTimer);
      state.messageNotificationTimer = null;
    }
  }

  function startMessageNotificationPolling() {
    stopMessageNotificationPolling();

    if (document.hidden) return;

    void fetchUnreadMessageCount();

    state.messageNotificationTimer = window.setInterval(() => {
      if (document.hidden) return;
      void fetchUnreadMessageCount();
    }, CONFIG.MESSAGE_NOTIFICATION_POLL_MS);
  }

  function setupMessageNotificationPolling() {
    if (!state.messageNotificationVisibilityBound) {
      state.messageNotificationVisibilityBound = true;
      document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
          stopMessageNotificationPolling();
        } else if (state.initialized) {
          startMessageNotificationPolling();
        }
      });
    }

    startMessageNotificationPolling();
  }

  async function openNotificationPanel() {
    const panel = $("ustazNotificationPanel");
    const button = $("ustazNotificationButton");

    if (!panel) return;

    closeProfileMenu();
    state.notificationPanelOpen = true;
    panel.hidden = false;

    if (button) {
      button.setAttribute("aria-expanded", "true");
    }

    try {
      await loadUnreadMessageNotifications();
    } catch (error) {
      console.warn(
        "[BarakaLink][Ustaz Dashboard][message-notifications] Could not load notification details.",
        error
      );
      state.messageNotifications = [];
      renderNotifications();
    }
  }

  function closeNotificationPanel() {
    const panel = $("ustazNotificationPanel");
    const button = $("ustazNotificationButton");

    state.notificationPanelOpen = false;

    if (panel) {
      panel.hidden = true;
    }

    if (button) {
      button.setAttribute("aria-expanded", "false");
    }
  }

  function toggleNotificationPanel() {
    if (state.notificationPanelOpen) {
      closeNotificationPanel();
    } else {
      void openNotificationPanel();
    }
  }

  function setupNotificationPanel() {
    const button = $("ustazNotificationButton");
    const panel = $("ustazNotificationPanel");

    updateMessageBadges(0);
    renderNotifications();

    if (button && button.dataset.ustazNotificationBound !== "1") {
      button.dataset.ustazNotificationBound = "1";
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        toggleNotificationPanel();
      });
    }

    if (panel && panel.dataset.ustazNotificationPanelBound !== "1") {
      panel.dataset.ustazNotificationPanelBound = "1";
      panel.addEventListener("click", (event) => {
        const target = event.target;
        if (target instanceof Element && target.closest(".ustaz-message-notification")) {
          return;
        }
        event.stopPropagation();
      });
    }

    const clearButton = $("ustazNotificationClear");
    if (clearButton && clearButton.dataset.ustazNotificationClearBound !== "1") {
      clearButton.dataset.ustazNotificationClearBound = "1";
      clearButton.addEventListener("click", (event) => {
        event.preventDefault();
        closeNotificationPanel();
      });
    }
  }

  function setupProfileMenu() {
    const menu = $("ustazProfileMenu");
    const buttons = [
      $("ustazAvatarButton"),
      $("ustazSidebarProfileButton"),
    ].filter(Boolean);

    if (!menu) return;

    buttons.forEach((button) => {
      if (button.dataset.ustazProfileBound === "1") return;
      button.dataset.ustazProfileBound = "1";

      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        toggleProfileMenu(button);
      });
    });
  }

  function setupGlobalInteraction() {
    if (document.body.dataset.ustazGlobalInteractionBound === "1") return;
    document.body.dataset.ustazGlobalInteractionBound = "1";

    document.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const profileMenu = $("ustazProfileMenu");
      const profileButtons = [
        $("ustazAvatarButton"),
        $("ustazSidebarProfileButton"),
      ].filter(Boolean);

      const notificationPanel = $("ustazNotificationPanel");
      const notificationButton = $("ustazNotificationButton");

      if (
        profileMenu &&
        !profileMenu.contains(target) &&
        !profileButtons.some((button) => button.contains(target))
      ) {
        closeProfileMenu();
      }

      if (
        notificationPanel &&
        notificationButton &&
        !notificationPanel.contains(target) &&
        !notificationButton.contains(target)
      ) {
        closeNotificationPanel();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;

      if (state.sidebarOpen) closeSidebar();
      if (state.profileMenuOpen) closeProfileMenu();
      if (state.notificationPanelOpen) closeNotificationPanel();
    });
  }

  function setupSidebar() {
    const menuToggle = $("ustazMenuToggle");
    const sidebarClose = $("ustazSidebarClose");
    const overlay = $("ustazSidebarOverlay");

    if (menuToggle && menuToggle.dataset.ustazSidebarBound !== "1") {
      menuToggle.dataset.ustazSidebarBound = "1";
      menuToggle.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (state.sidebarOpen) {
          closeSidebar();
        } else {
          openSidebar();
        }
      });
    }

    if (sidebarClose && sidebarClose.dataset.ustazSidebarBound !== "1") {
      sidebarClose.dataset.ustazSidebarBound = "1";
      sidebarClose.addEventListener("click", (event) => {
        event.preventDefault();
        closeSidebar();
      });
    }

    if (overlay && overlay.dataset.ustazSidebarBound !== "1") {
      overlay.dataset.ustazSidebarBound = "1";
      overlay.addEventListener("click", closeSidebar);
    }

    if (window.__barakaLinkUstazSidebarResizeBound) return;
    window.__barakaLinkUstazSidebarResizeBound = true;

    window.addEventListener("resize", () => {
      if (!isMobileSidebarMode()) {
        closeSidebar();
      }
    });
  }

  /* =========================================================
     LOGOUT / UI STATES
  ========================================================= */

  function logout() {
    try {
      localStorage.removeItem(CONFIG.THEME_KEY);
    } catch (_) {}

    clearSession();
    window.location.replace(CONFIG.LOGIN_PATH);
  }

  function setupLogout() {
    [
      $("ustazSidebarLogout"),
      $("ustazMenuLogout"),
      $("ustazSettingsLogout"),
    ]
      .filter(Boolean)
      .forEach((button) => {
        if (button.dataset.ustazLogoutBound === "1") return;
        button.dataset.ustazLogoutBound = "1";
        button.addEventListener("click", logout);
      });
  }

  function showLoading(show) {
    const loading = $("ustazPageLoading");
    if (loading) loading.hidden = !show;
  }

  function showError(message) {
    const panel = $("ustazPageError");
    const messageElement = $("ustazPageErrorMessage");

    if (messageElement) {
      messageElement.textContent = text(message, "Please try again.");
    }

    if (panel) panel.hidden = false;
  }

  function hideError() {
    const panel = $("ustazPageError");
    if (panel) panel.hidden = true;
  }

  function setupRetry() {
    const retry = $("ustazPageRetry");
    if (!retry || retry.dataset.ustazRetryBound === "1") return;

    retry.dataset.ustazRetryBound = "1";
    retry.addEventListener("click", initialize);
  }

  function setupHashListener() {
    if (window.__barakaLinkUstazHashBound) return;
    window.__barakaLinkUstazHashBound = true;

    window.addEventListener("hashchange", () => {
      const requested = window.location.hash.replace(/^#/, "").trim();
      const allowed = new Set([
        "home",
        "profile",
        "students",
        "messages",
        "availability",
        "settings",
      ]);

      if (allowed.has(requested)) {
        setSection(requested);
      }
    });
  }

  /* =========================================================
     INITIALIZATION
  ========================================================= */

  /* =========================================================
     DASHBOARD MESSAGE SECTION

     The dashboard shows the conversation list only.
     The existing inbox remains the full chat interface.
  ========================================================= */

  function normalizeConversationRow(row) {
    if (!row || typeof row !== "object") return null;

    const id = Number(row.id ?? row.conversationId ?? row.conversation_id);
    if (!Number.isInteger(id) || id <= 0) return null;

    const other = row.otherUser ?? row.other_user ?? {};
    const otherUser = {
      id: Number(other.id ?? row.otherUserId ?? row.other_user_id),
      firstName: text(
        other.firstName ?? other.first_name ?? row.otherFirstName ?? row.other_first_name
      ),
      lastName: text(
        other.lastName ?? other.last_name ?? row.otherLastName ?? row.other_last_name
      ),
      avatarUrl: text(
        other.avatarUrl ?? other.avatar_url ?? row.otherAvatarUrl ?? row.other_avatar_url
      ),
    };

    if (!Number.isInteger(otherUser.id) || otherUser.id <= 0) return null;

    return {
      id,
      otherUser,
      lastMessage: text(
        row.lastMessage ?? row.last_message ?? row.lastMessageBody ?? row.last_message_body
      ),
      updatedAt:
        row.updatedAt ??
        row.updated_at ??
        row.lastMessageCreatedAt ??
        row.last_message_created_at ??
        null,
      unreadCount: Math.max(0, Number(row.unreadCount ?? row.unread_count ?? 0)),
    };
  }

  function appendConversationEmpty(list) {
    const empty = document.createElement("div");
    empty.className = "ustaz-conversation-state";

    const icon = document.createElement("span");
    icon.className = "ustaz-conversation-state-icon";
    icon.innerHTML = '<i class="fa-regular fa-comments" aria-hidden="true"></i>';

    const title = document.createElement("strong");
    title.textContent = "No conversations yet";

    const message = document.createElement("p");
    message.textContent = "Student conversations will appear here when a learner contacts you.";

    empty.append(icon, title, message);
    list.appendChild(empty);
  }

  function renderDashboardConversations() {
    const list = $("ustazConversationList");
    if (!list) return;

    list.replaceChildren();

    const conversations = Array.isArray(state.messageConversations)
      ? state.messageConversations
      : [];

    if (!conversations.length) {
      appendConversationEmpty(list);
      return;
    }

    const fragment = document.createDocumentFragment();

    conversations.forEach((conversation) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "ustaz-dashboard-conversation";
      button.dataset.conversationId = String(conversation.id);
      button.setAttribute(
        "aria-label",
        `Open conversation with ${fullName(conversation.otherUser)}`
      );

      const avatar = document.createElement("span");
      avatar.className = "ustaz-dashboard-conversation-avatar";

      const initials = document.createElement("span");
      initials.textContent = notificationInitials(conversation.otherUser);
      avatar.appendChild(initials);

      const photo = resolveMediaUrl(conversation.otherUser.avatarUrl);
      if (photo) {
        const image = document.createElement("img");
        image.src = photo;
        image.alt = "";
        image.addEventListener("load", () => {
          initials.hidden = true;
        }, { once: true });
        image.addEventListener("error", () => {
          image.remove();
          initials.hidden = false;
        }, { once: true });
        avatar.appendChild(image);
      }

      const copy = document.createElement("span");
      copy.className = "ustaz-dashboard-conversation-copy";

      const name = document.createElement("strong");
      name.className = "ustaz-dashboard-conversation-name";
      name.textContent = fullName(conversation.otherUser) || "BarakaLink User";

      const preview = document.createElement("span");
      preview.className = "ustaz-dashboard-conversation-preview";
      preview.textContent = conversation.lastMessage || "Open conversation";

      copy.append(name, preview);

      const meta = document.createElement("span");
      meta.className = "ustaz-dashboard-conversation-meta";

      const time = document.createElement("time");
      time.textContent = formatNotificationTime(conversation.updatedAt);
      meta.appendChild(time);

      if (conversation.unreadCount > 0) {
        const unread = document.createElement("span");
        unread.className = "ustaz-dashboard-conversation-unread";
        unread.textContent = formatUnreadBadge(conversation.unreadCount);
        unread.setAttribute("aria-label", `${conversation.unreadCount} unread messages`);
        meta.appendChild(unread);
        button.classList.add("has-unread");
      }

      const arrow = document.createElement("i");
      arrow.className = "fa-solid fa-chevron-right ustaz-dashboard-conversation-arrow";
      arrow.setAttribute("aria-hidden", "true");

      button.append(avatar, copy, meta, arrow);

      button.addEventListener("click", () => {
        const conversationId = Number(button.dataset.conversationId);
        if (!Number.isInteger(conversationId) || conversationId <= 0) return;

        window.location.href = `inbox.html?conversation=${encodeURIComponent(conversationId)}`;
      });

      fragment.appendChild(button);
    });

    list.appendChild(fragment);
  }

  async function loadDashboardConversations() {
    const list = $("ustazConversationList");
    if (!list || state.messageConversationsLoading) return;

    state.messageConversationsLoading = true;

    try {
      const payload = await requestMessageNotifications("/conversations");
      const data = payloadData(payload);
      const rows = Array.isArray(data)
        ? data
        : Array.isArray(data?.conversations)
          ? data.conversations
          : [];

      state.messageConversations = rows
        .map(normalizeConversationRow)
        .filter(Boolean);

      renderDashboardConversations();
    } catch (error) {
      console.warn(
        "[BarakaLink][Ustaz Dashboard][messages] Conversation list failed.",
        error
      );

      list.replaceChildren();

      const empty = document.createElement("div");
      empty.className = "ustaz-conversation-state ustaz-conversation-state-error";

      const icon = document.createElement("span");
      icon.className = "ustaz-conversation-state-icon";
      icon.innerHTML = '<i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>';

      const title = document.createElement("strong");
      title.textContent = "Could not load conversations";

      const message = document.createElement("p");
      message.textContent = error?.message || "Please try again.";

      empty.append(icon, title, message);
      list.appendChild(empty);
    } finally {
      state.messageConversationsLoading = false;
    }
  }

  function setupDashboardMessages() {
    const refresh = $("ustazMessagesRefreshButton");
    if (refresh && refresh.dataset.ustazMessagesRefreshBound !== "1") {
      refresh.dataset.ustazMessagesRefreshBound = "1";
      refresh.addEventListener("click", (event) => {
        event.preventDefault();
        void loadDashboardConversations();
      });
    }
  }

  /* =========================================================
     NAVIGATION
  ========================================================= */

  function setSection(section) {
    const allowed = new Set([
      "home",
      "profile",
      "students",
      "messages",
      "availability",
      "settings",
    ]);

    state.section = allowed.has(section) ? section : "home";

    $$('[data-section-panel]').forEach((panel) => {
      panel.hidden = panel.dataset.sectionPanel !== state.section;
    });

    $$('[data-section]').forEach((link) => {
      link.classList.toggle("active", link.dataset.section === state.section);
    });

    const titles = {
      home: ["Dashboard", "Overview"],
      profile: ["Profile", "My Profile"],
      students: ["Teaching", "Students"],
      messages: ["Communication", "Messages"],
      availability: ["Schedule", "Availability"],
      settings: ["Account", "Settings"],
    };

    setText("ustazSectionEyebrow", titles[state.section][0]);
    setText("ustazSectionTitle", titles[state.section][1]);

    const targetHash = `#${state.section}`;
    if (window.location.hash !== targetHash) {
      history.replaceState(null, "", targetHash);
    }

    closeSidebar();
    closeProfileMenu();
    closeNotificationPanel();

    if (state.section === "messages") {
      void loadDashboardConversations();
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function setupNavigation() {
    $$('[data-section]').forEach((link) => {
      if (link.dataset.ustazNavigationBound === "1") return;
      link.dataset.ustazNavigationBound = "1";

      link.addEventListener("click", (event) => {
        event.preventDefault();
        setSection(link.dataset.section);
      });
    });

    $$('[data-section-link]').forEach((link) => {
      if (link.dataset.ustazSectionLinkBound === "1") return;
      link.dataset.ustazSectionLinkBound = "1";

      link.addEventListener("click", (event) => {
        event.preventDefault();
        setSection(link.dataset.sectionLink);
      });
    });

    const initial = window.location.hash.replace(/^#/, "").trim();
    setSection(initial || "home");
  }

  function safeSetup(stage, callback) {
    try {
      callback();
      console.info(`[BarakaLink][Ustaz Dashboard][${stage}] initialized.`);
    } catch (error) {
      console.error(
        `[BarakaLink][Ustaz Dashboard][${stage}] failed.`,
        error
      );
    }
  }

  async function initialize() {
    if (state.loading) return;

    showLoading(true);
    hideError();

    // UI bindings are independent of profile loading. A broken optional
    // control must never turn a successful profile response into a dashboard
    // error state.
    safeSetup("navigation", setupNavigation);
    safeSetup("sidebar", setupSidebar);
    safeSetup("profile-menu", setupProfileMenu);
    safeSetup("notifications", setupNotificationPanel);
    safeSetup("messages", setupDashboardMessages);
    safeSetup("global-interaction", setupGlobalInteraction);
    safeSetup("logout", setupLogout);
    safeSetup("theme", setupTheme);
    safeSetup("retry", setupRetry);
    safeSetup("hash", setupHashListener);

    const token = getToken();
    if (!token) {
      showLoading(false);
      redirectToLogin();
      return;
    }

    try {
      const profile = await loadProfile();

      if (!profile?.user || !profile?.teacher) {
        const error = new Error("Your BarakaLink Ustaz profile data is incomplete.");
        error.code = "INVALID_PROFILE_RESPONSE";
        error.stage = "profile-validation";
        throw error;
      }

      if (!isUstazRole()) {
        const error = new Error(
          "This dashboard is only available for Ustaz / Ustaza accounts."
        );
        error.code = "INVALID_ROLE";
        error.stage = "profile-validation";
        throw error;
      }

      // The provided successful API response has profileCompleted === true,
      // so this path intentionally proceeds directly into the dashboard.
      if (!isProfileComplete()) {
        redirectToProfile();
        return;
      }
    } catch (error) {
      console.error(
        `[BarakaLink][Ustaz Dashboard][${error?.stage || "profile-request"}] failed.`,
        error
      );

      if (
        error?.status === 401 ||
        error?.code === "UNAUTHORIZED"
      ) {
        redirectToLogin();
        return;
      }

      showError(
        error?.message ||
          "We could not load your BarakaLink dashboard."
      );
      return;
    }

    console.info("[BarakaLink][Ustaz Dashboard][render] Dashboard rendering started.");

    try {
      renderDashboard();
      console.info("[BarakaLink][Ustaz Dashboard][render] Dashboard render complete.");
    } catch (error) {
      // Rendering errors are NOT profile-loading errors. Log the real error
      // without replacing an already-successful API response with the global
      // "couldn't load dashboard" state.
      console.error(
        "[BarakaLink][Ustaz Dashboard][render] Dashboard render exception.",
        error
      );
    }

    try {
      setSection(state.section || "home");
    } catch (error) {
      console.error(
        "[BarakaLink][Ustaz Dashboard][navigation] Initial section setup failed.",
        error
      );
    }

    hideError();
    state.initialized = true;
    showLoading(false);

    setupMessageNotificationPolling();

    console.info("[BarakaLink][Ustaz Dashboard] Dashboard initialization complete.");
  }

  function boot() {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", initialize, { once: true });
    } else {
      initialize();
    }
  }

  boot();

  window.BarakaLinkUstazDashboard = {
    reload: initialize,
    setSection,
    getState: () => ({
      ...state,
      studyFields: [...state.studyFields],
      languages: [...state.languages],
      availability: [...state.availability],
      qualifications: [...state.qualifications],
      notificationPanelOpen: state.notificationPanelOpen,
      sidebarOpen: state.sidebarOpen,
      unreadMessageCount: state.unreadMessageCount,
      messageNotifications: state.messageNotifications.map((item) => ({
        id: item.id,
        otherUser: { ...item.otherUser },
        unreadCount: item.unreadCount,
        body: item.body,
        createdAt: item.createdAt,
      })),
    }),
  };
})();
