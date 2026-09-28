'use strict';

/* =========================================================
   BARAKALINK
   STUDENT / PARENT DASHBOARD
   student.js

   Responsible for:
   - Authentication/session check
   - Parent role guard
   - Loading current profile
   - Loading profile preferences
   - Rendering dashboard information
   - Light/dark theme
   - Sidebar on mobile
   - Dashboard section navigation
   - Profile dropdown
   - Notification panel UI
   - Teacher filters/search UI
   - Graceful handling when teacher API is not yet available

   IMPORTANT:
   This file does NOT create fake teacher records.
   Teacher discovery is prepared for the real backend API.
========================================================= */


/* =========================================================
   CONFIGURATION
========================================================= */

const STUDENT_CONFIG = Object.freeze({

  /*
   api.js already supports window.BARAKALINK_API_BASE.
   The default below matches the current local backend.
  */
  API_BASE:
    String(
      window.BARAKALINK_API_BASE ||
      'http://localhost:5000/api'
    ).replace(/\/+$/, ''),

  /*
   Current BarakaLink frontend authentication storage.
  */
  TOKEN_KEYS: [
    'barakalink_token',
    'token'
  ],

  /*
   The teacher-discovery endpoint is intentionally NOT
   hard-coded to a route that has not been confirmed.

   Later, the backend can expose the endpoint by defining:

      window.BARAKALINK_TEACHERS_ENDPOINT = '/teachers';

   or a complete URL.
  */
TEACHERS_ENDPOINT:
  window.BARAKALINK_TEACHERS_ENDPOINT ||
  '/teachers',
  /*
   Optional future notification endpoint.
   No request is made unless configured.
  */
  NOTIFICATIONS_ENDPOINT:
    window.BARAKALINK_NOTIFICATIONS_ENDPOINT || null,

  /*
   Theme storage.
  */
  THEME_KEY: 'barakalink_theme',

  /*
   Maximum number of visible notification items.
  */
  MAX_NOTIFICATIONS: 30,

});


/* =========================================================
   STATE
========================================================= */

const state = {

  user: null,

  profile: null,

  preferences: {

    bio: '',

    preferredTeacherGender: 'no-preference',

    studyInterests: [],

    contentInterests: [],

  },

  teachers: [],

  filteredTeachers: [],

  savedTeachers: [],

  notifications: [],

  currentSection: 'home',

  currentTeacherFilter: 'all',

  searchTerm: '',

  sortMode: 'nearest',

  profileMenuOpen: false,

  notificationPanelOpen: false,

};


/* =========================================================
   DOM HELPERS
========================================================= */

const $ = (id) => document.getElementById(id);

const $$ = (selector, root = document) =>
  Array.from(root.querySelectorAll(selector));


function exists(element) {
  return Boolean(element);
}


function safeString(value, fallback = '') {

  if (
    value === null ||
    value === undefined
  ) {
    return fallback;
  }

  const stringValue = String(value).trim();

  return stringValue || fallback;
}


function normalizeArray(value) {

  if (!Array.isArray(value)) {
    return [];
  }

  return [
    ...new Set(
      value
        .filter(
          item =>
            typeof item === 'string' ||
            typeof item === 'number'
        )
        .map(
          item => String(item).trim()
        )
        .filter(Boolean)
    ),
  ];

}


function capitalizeWords(value) {

  const text = safeString(value);

  if (!text) {
    return '';
  }

  return text
    .split(/\s+/)
    .map(
      word =>
        word.charAt(0).toUpperCase() +
        word.slice(1).toLowerCase()
    )
    .join(' ');

}


/* =========================================================
   TOKEN / SESSION
========================================================= */

function getAuthToken() {

  /*
   * Prefer the shared BarakaLinkAPI token helper so the dashboard
   * uses exactly the same authentication source as login and the
   * profile-completion page.
   */
  if (
    window.BarakaLinkAPI &&
    typeof window.BarakaLinkAPI.getToken === 'function'
  ) {

    const sharedToken =
      window.BarakaLinkAPI.getToken();

    if (sharedToken) {
      return sharedToken;
    }

  }


  for (const key of STUDENT_CONFIG.TOKEN_KEYS) {

    const token =
      localStorage.getItem(key);

    if (token) {
      return token;
    }

  }


  return null;

}


function clearSession() {

  for (const key of STUDENT_CONFIG.TOKEN_KEYS) {
    localStorage.removeItem(key);
  }

  /*
   * These are harmless to remove if present.
   * The current BarakaLink auth flow stores the JWT
   * primarily under barakalink_token.
  */

  localStorage.removeItem('barakalink_user');

}


/* =========================================================
   API
========================================================= */

async function apiRequest(
  path,
  options = {}
) {

  const token = getAuthToken();

  if (!token) {

    const error = new Error(
      'Authentication token is missing.'
    );

    error.code = 'NO_TOKEN';

    throw error;

  }


  const cleanPath =
    String(path || '').startsWith('/')
      ? String(path)
      : `/${String(path)}`;


  const url =
    `${STUDENT_CONFIG.API_BASE}${cleanPath}`;


  const headers = {
    Accept: 'application/json',
    ...(options.headers || {}),
    Authorization: `Bearer ${token}`,
  };


  /*
   * Only add JSON Content-Type when a body exists.
   */
  if (
    options.body &&
    !headers['Content-Type']
  ) {

    headers['Content-Type'] =
      'application/json';

  }


  let response;

  try {

    response = await fetch(
      url,
      {
        ...options,
        headers,
      }
    );

  } catch (error) {

    const networkError =
      new Error(
        'Unable to connect to the BarakaLink server.'
      );

    networkError.code = 'NETWORK_ERROR';
    networkError.originalError = error;

    throw networkError;

  }


  let payload = null;

  try {
    payload = await response.json();
  } catch {
    payload = null;
  }


  if (response.status === 401) {

    const error = new Error(
      payload?.message ||
      'Your session has expired.'
    );

    error.code = 'UNAUTHORIZED';
    error.status = 401;

    throw error;

  }


  if (!response.ok) {

    const error = new Error(
      payload?.message ||
      payload?.error ||
      `Request failed with status ${response.status}.`
    );

    error.status = response.status;
    error.payload = payload;

    throw error;

  }


  return payload;

}


/* =========================================================
   REDIRECTS
========================================================= */

function redirectToLogin() {

  clearSession();

  window.location.href =
    '../index.html';

}


function redirectToProfileCompletion() {

  window.location.href =
    '../profile-completion.html';

}


function redirectToUstazDashboard() {

  /*
   * student.html is inside dashboard/,
   * so teacher.html is beside it.
  */

  window.location.href =
    './teacher.html';

}


/* =========================================================
   ERROR HANDLING
========================================================= */

function showGlobalError(message) {

  const errorPanel =
    $('studentPageError');

  const errorMessage =
    $('studentPageErrorMessage');


  if (exists(errorMessage)) {
    errorMessage.textContent =
      safeString(
        message,
        'We could not load your dashboard.'
      );
  }


  if (exists(errorPanel)) {
    errorPanel.hidden = false;
  }

}


function hideGlobalError() {

  const errorPanel =
    $('studentPageError');

  if (exists(errorPanel)) {
    errorPanel.hidden = true;
  }

}


function showPageLoading() {

  const loading =
    $('studentPageLoading');

  if (exists(loading)) {
    loading.hidden = false;
  }

}


function hidePageLoading() {

  const loading =
    $('studentPageLoading');

  if (exists(loading)) {
    loading.hidden = true;
  }

}


/* =========================================================
   PROFILE DATA NORMALIZATION
========================================================= */

function extractProfilePayload(payload) {

  /*
   * Current backend response:
   *
   *   data: {
   *     user,
   *     student,
   *     teacherProfile,
   *     studyFields
   *   }
   *
   * Keep ALL profile siblings. The old implementation selected only
   * data.user and silently discarded data.student, which is why the
   * dashboard showed "Location not set" even though registration had
   * already saved subcity, area, and nearest mosque.
   */

  const data =
    payload?.data ?? payload ?? {};


  if (
    data.profile &&
    typeof data.profile === 'object'
  ) {

    return {
      ...data.profile,

      user:
        data.user ??
        data.profile.user ??
        null,

      student:
        data.student ??
        data.profile.student ??
        null,

      teacherProfile:
        data.teacherProfile ??
        data.profile.teacherProfile ??
        null,

      studyFields:
        data.studyFields ??
        data.profile.studyFields ??
        [],
    };

  }


  if (
    data.user &&
    typeof data.user === 'object'
  ) {

    return {
      ...data.user,

      student:
        data.student ??
        null,

      teacherProfile:
        data.teacherProfile ??
        null,

      studyFields:
        data.studyFields ??
        [],
    };

  }


  return data || {};

}


function profileFromPossibleNestedUser(data) {

  if (
    data &&
    typeof data === 'object' &&
    data.user &&
    typeof data.user === 'object'
  ) {

    return data.user;

  }

  return null;

}


function normalizeProfile(profile) {

  const source =
    profile || {};


  /*
   * Some backend responses may place the parent
   * location under student.
  */

  const student =
    source.student || {};


  return {

    ...source,

    id:
      source.id ??
      source.userId ??
      student.userId ??
      null,

    role:
      safeString(
        source.role,
        ''
      ).toLowerCase(),

    firstName:
      safeString(
        source.firstName ??
        source.first_name,
        ''
      ),

    lastName:
      safeString(
        source.lastName ??
        source.last_name,
        ''
      ),

    phone:
      safeString(
        source.phone,
        ''
      ),

    profileCompleted:
      Boolean(
        source.profileCompleted ??
        source.profile_completed ??
        false
      ),

    telegramVerified:
      Boolean(
        source.telegramVerified ??
        source.telegram_verified ??
        false
      ),

    accountStatus:
      safeString(
        source.accountStatus ??
        source.account_status,
        ''
      ),

    avatarUrl:
      safeString(
        source.avatarUrl ??
        source.avatar_url ??
        source.photoUrl ??
        source.photoURL ??
        source.profilePhotoUrl ??
        source.profile_photo_url,
        ''
      ),

    student: {

      ...(student || {}),

      userId:
        student.userId ??
        student.user_id ??
        source.id ??
        source.userId ??
        null,

      subcity:
        safeString(
          student.subcity ??
          source.subcity,
          ''
        ),

      area:
        safeString(
          student.area ??
          source.area,
          ''
        ),

      nearestMosque:
        safeString(
          student.nearestMosque ??
          student.nearest_mosque ??
          source.nearestMosque ??
          source.nearest_mosque,
          ''
        ),

    },

  };

}


/* =========================================================
   LOAD PROFILE
========================================================= */

async function loadProfile() {

  const payload =
    await apiRequest('/profile');


  const profile =
    extractProfilePayload(payload);


  state.profile =
    normalizeProfile(profile);


  state.user =
    state.profile;


  return state.profile;

}


/* =========================================================
   LOAD PREFERENCES
========================================================= */

async function loadPreferences() {

  try {

    const payload =
      await apiRequest(
        '/profile/preferences'
      );


    const data =
      payload?.data ??
      payload ??
      {};

    /*
     * Accept the normal response shape as well as a nested
     * preferences object. Some backend versions have returned
     * profile preference data under `data.preferences`.
     */
    const preferenceData =
      data?.preferences &&
      typeof data.preferences === 'object'
        ? data.preferences
        : data;

    const profileBio =
      safeString(
        state.profile?.bio ??
        state.profile?.aboutYou ??
        state.profile?.about_you,
        ''
      );


    state.preferences = {

      bio:
        safeString(
          preferenceData?.bio ??
          preferenceData?.aboutYou ??
          preferenceData?.about_you ??
          profileBio,
          ''
        ),

      preferredTeacherGender:
        safeString(
          data.preferredTeacherGender,
          'no-preference'
        ).toLowerCase(),

      studyInterests:
        normalizeArray(
          data.studyInterests
        ),

      contentInterests:
        normalizeArray(
          data.contentInterests
        ),

    };


    return state.preferences;

  } catch (error) {

    /*
     * Preferences are not allowed to prevent the parent
     * from accessing the dashboard.

     * This is particularly important while the Step 2
     * database tables are being added or when an older
     * account has no preferences record.
    */

    console.warn(
      '[student.js] Preferences could not be loaded:',
      error
    );


    state.preferences = {

      bio:
        safeString(
          state.profile?.bio ??
          state.profile?.aboutYou ??
          state.profile?.about_you,
          ''
        ),

      preferredTeacherGender:
        'no-preference',

      studyInterests: [],

      contentInterests: [],

    };


    return state.preferences;

  }

}


/* =========================================================
   PROFILE DISPLAY HELPERS
========================================================= */

function getFullName() {

  const first =
    safeString(
      state.profile?.firstName
    );

  const last =
    safeString(
      state.profile?.lastName
    );


  return [
    first,
    last,
  ]
    .filter(Boolean)
    .join(' ')
    .trim();

}


function getFirstName() {

  return (
    safeString(
      state.profile?.firstName
    ) ||
    'there'
  );

}


function getInitials() {

  const first =
    safeString(
      state.profile?.firstName
    );

  const last =
    safeString(
      state.profile?.lastName
    );


  const initials = [
    first.charAt(0),
    last.charAt(0),
  ]
    .join('')
    .toUpperCase();


  return initials || 'BL';

}


function getLocationParts() {

  const student =
    state.profile?.student || {};


  return {

    subcity:
      safeString(
        student.subcity
      ),

    area:
      safeString(
        student.area
      ),

    mosque:
      safeString(
        student.nearestMosque
      ),

  };

}


function formatLocation() {

  const location =
    getLocationParts();


  const parts = [
    location.area,
    location.subcity,
  ]
    .filter(Boolean);


  return (
    parts.join(', ') ||
    'Location not set'
  );

}


function formatTeacherGender(value) {

  const gender =
    safeString(
      value,
      'no-preference'
    ).toLowerCase();


  switch (gender) {

    case 'male':
      return 'Ustaz';

    case 'female':
      return 'Ustaza';

    case 'no-preference':
    case 'none':
    case '':
      return 'No preference';

    default:
      return capitalizeWords(
        gender.replace(/-/g, ' ')
      );

  }

}


/* =========================================================
   STUDY FIELD LABELS
========================================================= */

const STUDY_FIELD_LABELS = Object.freeze({

  'quran-basic':
    'Quran Basic',

  'quran_basic':
    'Quran Basic',

  'tajweed':
    'Tajweed',

  'hifz':
    'Hifz',

  'tafseer':
    'Tafseer',

  'hadith':
    'Hadith',

  'tarbiyah':
    'Tarbiyah',

});


function getStudyFieldLabel(slug) {

  const key =
    safeString(
      slug
    ).toLowerCase();


  return (
    STUDY_FIELD_LABELS[key] ||
    capitalizeWords(
      key
        .replace(/[_-]+/g, ' ')
    )
  );

}


/* =========================================================
   CONTENT INTEREST LABELS
========================================================= */

const CONTENT_INTEREST_LABELS = Object.freeze({

  quran:
    'Quran',

  tafseer:
    'Tafseer',

  hadith:
    'Hadith',

  seerah:
    'Seerah',

  aqeedah:
    'Aqeedah',

  fiqh:
    'Fiqh',

  'dua-adhkar':
    'Dua & Adhkar',

  'islamic-manners-character':
    'Islamic Manners & Character',

  'stories-of-the-prophets':
    'Stories of the Prophets',

  'family-parenting-islam':
    'Family & Parenting in Islam',

  'childrens-islamic-education':
    'Children\'s Islamic Education',

  'islamic-history':
    'Islamic History',

});


function getContentInterestLabel(key) {

  const normalized =
    safeString(
      key
    ).toLowerCase();


  return (
    CONTENT_INTEREST_LABELS[normalized] ||
    capitalizeWords(
      normalized
        .replace(/[_-]+/g, ' ')
    )
  );

}


/* =========================================================
   RENDER TEXT
========================================================= */

function setText(
  id,
  value
) {

  const element =
    $(id);

  if (!element) {
    return;
  }

  element.textContent =
    safeString(value);

}


/* =========================================================
   RENDER PROFILE NAME
========================================================= */

function renderNames() {

  const fullName =
    getFullName();

  const firstName =
    getFirstName();

  const initials =
    getInitials();

  const role =
    safeString(
      state.profile?.role,
      'parent'
    ).toLowerCase();

  const roleLabelText =
    role === 'ustaz'
      ? 'Ustaz / Ustaza'
      : 'Parent / Student';

  const telegramVerified =
    Boolean(
      state.profile?.telegramVerified
    );


  setText(
    'studentWelcomeText',
    `Welcome back, ${firstName}`
  );


  setText(
    'studentTopbarName',
    fullName || 'BarakaLink User'
  );


  setText(
    'studentSidebarName',
    fullName || 'BarakaLink User'
  );


  setText(
    'studentProfileMenuName',
    fullName || 'BarakaLink User'
  );


  setText(
    'studentTopbarRole',
    roleLabelText
  );


  setText(
    'studentSidebarRole',
    roleLabelText
  );


  setText(
    'studentProfileMenuRole',
    roleLabelText
  );


  setText(
    'studentAvatarInitials',
    initials
  );


  setText(
    'studentSidebarAvatarInitials',
    initials
  );


  setText(
    'studentProfileMenuInitials',
    initials
  );


  setText(
    'studentProfileMenuVerification',
    telegramVerified
      ? 'Telegram verified'
      : 'Telegram not verified'
  );

}



/* =========================================================
   RENDER AVATAR
========================================================= */

function resolveAvatarUrl(value) {

  const raw =
    safeString(value);

  if (!raw) {
    return '';
  }

  try {

    return new URL(
      raw,
      `${STUDENT_CONFIG.API_BASE}/`
    ).href;

  } catch {

    return raw;

  }

}


function getPossibleAvatarUrl() {

  const candidates = [

    state.profile?.avatarUrl,

    state.profile?.avatar_url,

    state.profile?.photoUrl,

    state.profile?.photoURL,

    state.profile?.profilePhotoUrl,

    state.profile?.profile_photo_url,

    state.preferences?.photoUrl,

    state.preferences?.photoURL,

    state.preferences?.profilePhotoUrl,

    state.preferences?.profile_photo_url,

  ];


  for (const value of candidates) {

    const url =
      resolveAvatarUrl(value);


    if (url) {
      return url;
    }

  }


  return '';

}


function applyAvatar(
  containerId,
  initialsId,
  imageId
) {

  const container =
    $(containerId);

  const initials =
    $(initialsId);

  const image =
    $(imageId);


  if (
    !container ||
    !initials ||
    !image
  ) {
    return;
  }


  const imageUrl =
    getPossibleAvatarUrl();


  if (!imageUrl) {

    initials.hidden = false;
    image.hidden = true;
    image.removeAttribute('src');

    return;

  }


  image.onload =
    () => {

      image.hidden = false;
      initials.hidden = true;

    };


  image.onerror =
    () => {

      image.hidden = true;
      initials.hidden = false;

      image.removeAttribute('src');

    };


  image.src =
    imageUrl;

}


function renderAvatars() {

  applyAvatar(
    'studentAvatar',
    'studentAvatarInitials',
    'studentAvatarImage'
  );


  applyAvatar(
    'studentSidebarAvatar',
    'studentSidebarAvatarInitials',
    'studentSidebarAvatarImage'
  );


  applyAvatar(
    'studentProfileMenuAvatar',
    'studentProfileMenuInitials',
    'studentProfileMenuImage'
  );

}


/* =========================================================
   RENDER SUMMARY
========================================================= */

function renderSummary() {

  const studyInterests =
    normalizeArray(
      state.preferences.studyInterests
    );


  const contentInterests =
    normalizeArray(
      state.preferences.contentInterests
    );


  const location =
    getLocationParts();

  const formattedLocation =
    formatLocation();


  setText(
    'studentLocation',
    formattedLocation
  );


  const sidebarBioText =
    safeString(
      state.preferences?.bio ??
      state.profile?.bio ??
      state.profile?.aboutYou ??
      state.profile?.about_you,
      ''
    );


  setText(
    'studentSidebarBio',
    sidebarBioText
  );


  const sidebarBio =
    $('studentSidebarBio');

  if (sidebarBio) {
    sidebarBio.hidden =
      !sidebarBioText;
  }


  setText(
    'studentNearestMosque',
    location.mosque || 'Not set'
  );


  setText(
    'studentStudyCount',
    String(
      studyInterests.length
    )
  );


  setText(
    'studentGenderPreference',
    formatTeacherGender(
      state.preferences.preferredTeacherGender
    )
  );


  setText(
    'studentContentCount',
    String(
      contentInterests.length
    )
  );


  renderStudyChips();
  renderContentChips();
  renderSelectedTopics();

}


/* =========================================================
   GENERIC CHIP CREATION
========================================================= */

function createChip(
  label,
  iconClass = ''
) {

  const chip =
    document.createElement('span');


  chip.className =
    'student-chip';


  if (iconClass) {

    const icon =
      document.createElement('i');

    icon.className =
      iconClass;

    icon.setAttribute(
      'aria-hidden',
      'true'
    );

    chip.appendChild(icon);

  }


  const text =
    document.createElement(
      'span'
    );

  text.textContent =
    label;


  chip.appendChild(text);


  return chip;

}


/* =========================================================
   RENDER STUDY CHIPS
========================================================= */

function renderStudyChips() {

  const container =
    $('studentStudyInterests');


  if (!container) {
    return;
  }


  container.innerHTML =
    '';


  const fields =
    normalizeArray(
      state.preferences.studyInterests
    );


  if (!fields.length) {

    const empty =
      document.createElement(
        'div'
      );

    empty.className =
      'student-chip-empty';


    empty.innerHTML =
      `
        <i
          class="fa-solid fa-book-open"
          aria-hidden="true"
        ></i>

        <span>
          No study fields selected yet.
        </span>
      `;


    container.appendChild(
      empty
    );


    return;

  }


  fields.forEach(
    field => {

      container.appendChild(
        createChip(
          getStudyFieldLabel(field),
          'fa-solid fa-book-open'
        )
      );

    }
  );

}


/* =========================================================
   RENDER CONTENT CHIPS
========================================================= */

function renderContentChips() {

  const container =
    $('studentContentInterests');


  if (!container) {
    return;
  }


  container.innerHTML =
    '';


  const interests =
    normalizeArray(
      state.preferences.contentInterests
    );


  if (!interests.length) {

    const empty =
      document.createElement(
        'div'
      );

    empty.className =
      'student-chip-empty';


    empty.innerHTML =
      `
        <i
          class="fa-solid fa-mosque"
          aria-hidden="true"
        ></i>

        <span>
          No content interests selected yet.
        </span>
      `;


    container.appendChild(
      empty
    );


    return;

  }


  interests.forEach(
    interest => {

      container.appendChild(
        createChip(
          getContentInterestLabel(interest),
          'fa-solid fa-mosque'
        )
      );

    }
  );

}


/* =========================================================
   RENDER SELECTED TOPICS
========================================================= */

function renderSelectedTopics() {

  const container =
    $('studentSelectedTopics');


  if (!container) {
    return;
  }


  container.innerHTML =
    '';


  const interests =
    normalizeArray(
      state.preferences.contentInterests
    );


  if (!interests.length) {

    const empty =
      document.createElement(
        'div'
      );

    empty.className =
      'student-chip-empty';


    empty.innerHTML =
      `
        <i
          class="fa-solid fa-book-open"
          aria-hidden="true"
        ></i>

        <span>
          Your selected Islamic topics will appear here.
        </span>
      `;


    container.appendChild(
      empty
    );


    return;

  }


  interests.forEach(
    interest => {

      container.appendChild(
        createChip(
          getContentInterestLabel(interest),
          'fa-solid fa-check'
        )
      );

    }
  );

}


/* =========================================================
   ROLE GUARD
========================================================= */

function enforceParentRole() {

  const role =
    safeString(
      state.profile?.role
    ).toLowerCase();


  if (!role) {

    throw new Error(
      'Your account role could not be determined.'
    );

  }


  if (role === 'ustaz') {

    redirectToUstazDashboard();

    return false;

  }


  if (role !== 'parent') {

    throw new Error(
      'This dashboard is only available to parent accounts.'
    );

  }


  return true;

}


/* =========================================================
   PROFILE COMPLETION GUARD
========================================================= */

function enforceProfileCompletion() {

  const completed =
    Boolean(
      state.profile?.profileCompleted
    );


  if (!completed) {

    redirectToProfileCompletion();

    return false;

  }


  return true;

}


/* =========================================================
   ACCOUNT STATUS
========================================================= */

function enforceAccountStatus() {

  const status =
    safeString(
      state.profile?.accountStatus
    ).toLowerCase();


  /*
   * The backend currently creates verified registration
   * accounts with an active account status.

   * If another status is returned, let the user see a
   * clear message rather than pretending the account works.
  */

  if (
    status &&
    status !== 'active'
  ) {

    throw new Error(
      `This account is currently ${capitalizeWords(status)}.`
    );

  }


  return true;

}


/* =========================================================
   SECTION NAVIGATION
========================================================= */

const SECTION_META = Object.freeze({

  home: {
    eyebrow: 'Dashboard',
    title: 'Home',
  },

  teachers: {
    eyebrow: 'Teacher Discovery',
    title: 'Find Ustaz',
  },

  learning: {
    eyebrow: 'Learning',
    title: 'My Learning',
  },

  saved: {
    eyebrow: 'Saved',
    title: 'Saved Teachers',
  },

  content: {
    eyebrow: 'Islamic Learning',
    title: 'Islamic Content',
  },

});


function getSectionMeta(
  section
) {

  return (
    SECTION_META[section] ||
    SECTION_META.home
  );

}


function setActiveNav(
  section
) {

  $$('.student-nav-link')
    .forEach(
      link => {

        const linkSection =
          link.dataset.section;


        if (
          linkSection &&
          linkSection === section
        ) {

          link.classList.add(
            'active'
          );

        } else {

          link.classList.remove(
            'active'
          );

        }

      }
    );

}


function updateSectionHeader(
  section
) {

  const meta =
    getSectionMeta(section);


  setText(
    'studentSectionEyebrow',
    meta.eyebrow
  );


  setText(
    'studentSectionTitle',
    meta.title
  );

}


function showSection(
  section,
  updateHash = true
) {

  const validSection =
    SECTION_META[section]
      ? section
      : 'home';


  $$('[data-section-panel]')
    .forEach(
      panel => {

        const panelSection =
          panel.dataset.sectionPanel;


        panel.hidden =
          panelSection !== validSection;

      }
    );


  state.currentSection =
    validSection;


  setActiveNav(
    validSection
  );


  updateSectionHeader(
    validSection
  );


  closeProfileMenu();
  closeNotificationPanel();


  if (
    updateHash &&
    window.location.hash !==
      `#${validSection}`
  ) {

    history.replaceState(
      null,
      '',
      `#${validSection}`
    );

  }


  if (
    validSection === 'teachers'
  ) {

    runTeacherDiscovery();

  }


  window.scrollTo({
    top: 0,
    behavior: 'smooth',
  });

}


/* =========================================================
   NAVIGATION EVENTS
========================================================= */

function setupSectionNavigation() {

  /*
   * Sidebar navigation.
  */

  $$('.student-nav-link')
    .forEach(
      link => {

        const section =
          link.dataset.section;


        if (!section) {
          return;
        }


        link.addEventListener(
          'click',
          event => {

            event.preventDefault();

            showSection(
              section
            );

            closeMobileSidebar();

          }
        );

      }
    );


  /*
   * Generic section links.
  */

  $$('[data-section-link]')
    .forEach(
      link => {

        const section =
          link.dataset.sectionLink;


        if (!section) {
          return;
        }


        link.addEventListener(
          'click',
          event => {

            event.preventDefault();

            showSection(
              section
            );

            closeMobileSidebar();

          }
        );

      }
    );


  /*
   * Hash changes.
  */

  window.addEventListener(
    'hashchange',
    () => {

      const section =
        window.location.hash
          .replace(/^#/, '')
          .trim();


      showSection(
        section || 'home',
        false
      );

    }
  );


  /*
   * Initial hash.
  */

  const initialHash =
    window.location.hash
      .replace(/^#/, '')
      .trim();


  showSection(
    initialHash || 'home',
    false
  );

}


/* =========================================================
   MOBILE SIDEBAR
========================================================= */

function openMobileSidebar() {

  const sidebar =
    $('studentSidebar');

  const overlay =
    $('studentSidebarOverlay');

  const menuToggle =
    $('studentMenuToggle');


  if (sidebar) {
    sidebar.classList.add(
      'active'
    );
  }


  if (overlay) {
    overlay.classList.add(
      'active'
    );

    overlay.setAttribute(
      'aria-hidden',
      'false'
    );
  }


  if (menuToggle) {

    menuToggle.setAttribute(
      'aria-expanded',
      'true'
    );

  }


  document.body.classList.add(
    'student-menu-open'
  );

}


function closeMobileSidebar() {

  const sidebar =
    $('studentSidebar');

  const overlay =
    $('studentSidebarOverlay');

  const menuToggle =
    $('studentMenuToggle');


  if (sidebar) {
    sidebar.classList.remove(
      'active'
    );
  }


  if (overlay) {

    overlay.classList.remove(
      'active'
    );

    overlay.setAttribute(
      'aria-hidden',
      'true'
    );

  }


  if (menuToggle) {

    menuToggle.setAttribute(
      'aria-expanded',
      'false'
    );

  }


  document.body.classList.remove(
    'student-menu-open'
  );


  /*
   * The profile panel lives inside the mobile sidebar.
   * Closing the sidebar must never leave that panel open
   * when the sidebar is opened again.
   */
  closeProfileMenu();

}


function setupMobileSidebar() {

  const menuToggle =
    $('studentMenuToggle');

  const closeButton =
    $('studentSidebarClose');

  const overlay =
    $('studentSidebarOverlay');


  if (menuToggle) {

    menuToggle.addEventListener(
      'click',
      () => {

        const sidebar =
          $('studentSidebar');


        if (
          sidebar?.classList.contains(
            'active'
          )
        ) {

          closeMobileSidebar();

        } else {

          openMobileSidebar();

        }

      }
    );

  }


  if (closeButton) {

    closeButton.addEventListener(
      'click',
      closeMobileSidebar
    );

  }


  if (overlay) {

    overlay.addEventListener(
      'click',
      closeMobileSidebar
    );

  }


  document.addEventListener(
    'keydown',
    event => {

      if (
        event.key === 'Escape'
      ) {

        closeMobileSidebar();
        closeProfileMenu();
        closeNotificationPanel();

      }

    }
  );

}


/* =========================================================
   THEME
========================================================= */

function getSavedTheme() {

  const value =
    localStorage.getItem(
      STUDENT_CONFIG.THEME_KEY
    );


  if (
    value === 'light' ||
    value === 'dark'
  ) {
    return value;
  }


  return null;

}


function getInitialTheme() {

  const saved =
    getSavedTheme();


  if (saved) {
    return saved;
  }


  if (
    window.matchMedia &&
    window.matchMedia(
      '(prefers-color-scheme: dark)'
    ).matches
  ) {

    return 'dark';

  }


  return 'light';

}


function updateThemeMeta(
  isDark
) {

  const meta =
    $('themeColorMeta');


  if (!meta) {
    return;
  }


  meta.setAttribute(
    'content',
    isDark
      ? '#17130F'
      : '#FBF7EE'
  );

}


function updateThemeButton(
  isDark
) {

  const button =
    $('themeToggle');


  if (!button) {
    return;
  }


  const icon =
    button.querySelector('i');


  if (icon) {

    icon.className =
      isDark
        ? 'fa-solid fa-sun'
        : 'fa-solid fa-moon';

  }


  button.setAttribute(
    'aria-label',
    isDark
      ? 'Switch to light theme'
      : 'Switch to dark theme'
  );

}


function applyTheme(
  theme
) {

  const isDark =
    theme === 'dark';


  document.body.classList.toggle(
    'dark-theme',
    isDark
  );


  localStorage.setItem(
    STUDENT_CONFIG.THEME_KEY,
    isDark
      ? 'dark'
      : 'light'
  );


  updateThemeMeta(
    isDark
  );


  updateThemeButton(
    isDark
  );

}


function toggleTheme() {

  const next =
    document.body.classList.contains(
      'dark-theme'
    )
      ? 'light'
      : 'dark';


  applyTheme(
    next
  );

}


function setupTheme() {

  applyTheme(
    getInitialTheme()
  );


  const button =
    $('themeToggle');


  if (button) {

    button.addEventListener(
      'click',
      toggleTheme
    );

  }

}


/* =========================================================
   PROFILE MENU
========================================================= */

function openProfileMenu() {

  const menu =
    $('studentProfileMenu');

  const desktopButton =
    $('studentAvatarButton');

  const mobileButton =
    $('studentSidebarProfileButton');


  if (!menu) {
    return;
  }


  closeNotificationPanel();


  menu.hidden =
    false;


  state.profileMenuOpen =
    true;


  [
    desktopButton,
    mobileButton,
  ].forEach(
    button => {

      if (button) {

        button.setAttribute(
          'aria-expanded',
          'true'
        );

      }

    }
  );

}


function closeProfileMenu() {

  const menu =
    $('studentProfileMenu');

  const desktopButton =
    $('studentAvatarButton');

  const mobileButton =
    $('studentSidebarProfileButton');


  if (menu) {

    menu.hidden =
      true;

  }


  state.profileMenuOpen =
    false;


  [
    desktopButton,
    mobileButton,
  ].forEach(
    button => {

      if (button) {

        button.setAttribute(
          'aria-expanded',
          'false'
        );

      }

    }
  );

}


function toggleProfileMenu() {

  if (
    state.profileMenuOpen
  ) {

    closeProfileMenu();

  } else {

    closeNotificationPanel();

    openProfileMenu();

  }

}


function setupProfileMenu() {

  const buttons = [
    $('studentAvatarButton'),
    $('studentSidebarProfileButton'),
  ].filter(Boolean);


  buttons.forEach(
    button => {

      button.addEventListener(
        'click',
        event => {

          event.stopPropagation();

          toggleProfileMenu();

        }
      );

    }
  );


  const menu =
    $('studentProfileMenu');


  if (menu) {

    menu.addEventListener(
      'click',
      event => {

        event.stopPropagation();

      }
    );

  }


  $$('.student-profile-menu-link')
    .forEach(
      link => {

        link.addEventListener(
          'click',
          closeProfileMenu
        );

      }
    );

}


/* =========================================================
   NOTIFICATION PANEL
========================================================= */

function openNotificationPanel() {

  const panel =
    $('studentNotificationPanel');

  const button =
    $('studentNotificationButton');


  if (!panel) {
    return;
  }


  panel.hidden =
    false;


  state.notificationPanelOpen =
    true;


  if (button) {

    button.setAttribute(
      'aria-expanded',
      'true'
    );

  }

}


function closeNotificationPanel() {

  const panel =
    $('studentNotificationPanel');

  const button =
    $('studentNotificationButton');


  if (!panel) {
    return;
  }


  panel.hidden =
    true;


  state.notificationPanelOpen =
    false;


  if (button) {

    button.setAttribute(
      'aria-expanded',
      'false'
    );

  }

}


function toggleNotificationPanel() {

  if (
    state.notificationPanelOpen
  ) {

    closeNotificationPanel();

  } else {

    closeProfileMenu();

    openNotificationPanel();

  }

}


function setupNotificationPanel() {

  const button =
    $('studentNotificationButton');


  if (button) {

    button.addEventListener(
      'click',
      event => {

        event.stopPropagation();

        toggleNotificationPanel();

      }
    );

  }


  const panel =
    $('studentNotificationPanel');


  if (panel) {

    panel.addEventListener(
      'click',
      event => {

        event.stopPropagation();

      }
    );

  }


  document.addEventListener(
    'click',
    () => {

      closeProfileMenu();
      closeNotificationPanel();

    }
  );


  const clearButton =
    $('studentNotificationClear');


  if (clearButton) {

    clearButton.addEventListener(
      'click',
      () => {

        state.notifications = [];

        renderNotifications();

      }
    );

  }

}


/* =========================================================
   NOTIFICATION RENDERING
========================================================= */

function renderNotifications() {

  const list =
    $('studentNotificationList');

  const badge =
    $('studentNotificationBadge');


  if (!list) {
    return;
  }


  const notifications =
    Array.isArray(
      state.notifications
    )
      ? state.notifications
      : [];


  list.innerHTML =
    '';


  if (!notifications.length) {

    list.innerHTML =
      `
        <div class="student-notification-empty">

          <div class="student-notification-empty-icon">
            <i
              class="fa-regular fa-bell"
              aria-hidden="true"
            ></i>
          </div>

          <strong>
            No new notifications
          </strong>

          <p>
            New learning and teacher updates will appear here.
          </p>

        </div>
      `;


    if (badge) {
      badge.hidden = true;
    }


    return;

  }


  const limited =
    notifications.slice(
      0,
      STUDENT_CONFIG.MAX_NOTIFICATIONS
    );


  limited.forEach(
    notification => {

      const item =
        document.createElement(
          'article'
        );


      item.className =
        'student-notification-item';


      const title =
        safeString(
          notification.title ??
          notification.name,
          'Notification'
        );


      const message =
        safeString(
          notification.message ??
          notification.body,
          ''
        );


      const createdAt =
        notification.createdAt ??
        notification.created_at ??
        '';


      item.innerHTML =
        `
          <div
            class="student-notification-item-icon"
          >
            <i
              class="fa-regular fa-bell"
              aria-hidden="true"
            ></i>
          </div>

          <div
            class="student-notification-item-copy"
          >

            <strong></strong>

            <p></p>

            <small></small>

          </div>
        `;


      const titleElement =
        item.querySelector(
          'strong'
        );

      const messageElement =
        item.querySelector(
          'p'
        );

      const dateElement =
        item.querySelector(
          'small'
        );


      if (titleElement) {
        titleElement.textContent =
          title;
      }


      if (messageElement) {
        messageElement.textContent =
          message;
      }


      if (dateElement) {
        dateElement.textContent =
          formatRelativeDate(
            createdAt
          );
      }


      list.appendChild(
        item
      );

    }
  );


  if (badge) {

    badge.hidden = false;

    badge.textContent =
      String(
        notifications.length > 99
          ? '99+'
          : notifications.length
      );

  }

}


/* =========================================================
   DATE FORMATTING
========================================================= */

function formatRelativeDate(
  value
) {

  if (!value) {
    return '';
  }


  const date =
    new Date(value);


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    return safeString(
      value
    );

  }


  const diff =
    Date.now() -
    date.getTime();


  const seconds =
    Math.floor(
      diff / 1000
    );


  if (seconds < 60) {
    return 'Just now';
  }


  const minutes =
    Math.floor(
      seconds / 60
    );


  if (minutes < 60) {

    return (
      `${minutes} minute` +
      `${minutes === 1 ? '' : 's'} ago`
    );

  }


  const hours =
    Math.floor(
      minutes / 60
    );


  if (hours < 24) {

    return (
      `${hours} hour` +
      `${hours === 1 ? '' : 's'} ago`
    );

  }


  const days =
    Math.floor(
      hours / 24
    );


  if (days < 7) {

    return (
      `${days} day` +
      `${days === 1 ? '' : 's'} ago`
    );

  }


  return date.toLocaleDateString(
    'en-US',
    {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }
  );

}


/* =========================================================
   OPTIONAL NOTIFICATIONS API
========================================================= */

async function loadNotifications() {

  /*
   * The current dashboard HTML is ready for notifications,
   * but no confirmed parent notification endpoint has been
   * provided yet.

   * Therefore:
   * - No guessed endpoint
   * - No fake notifications
   * - No failing 404 requests

   * A future endpoint can be enabled by setting:
      window.BARAKALINK_NOTIFICATIONS_ENDPOINT
  */

  const endpoint =
    STUDENT_CONFIG.NOTIFICATIONS_ENDPOINT;


  if (!endpoint) {

    state.notifications = [];

    renderNotifications();

    return [];

  }


  try {

    const payload =
      await apiRequest(
        endpoint
      );


    const data =
      payload?.data ??
      payload ??
      [];


    state.notifications =
      Array.isArray(data)
        ? data
        : Array.isArray(
            data.notifications
          )
          ? data.notifications
          : [];


    renderNotifications();


    return state.notifications;

  } catch (error) {

    console.warn(
      '[student.js] Notifications could not be loaded:',
      error
    );


    state.notifications = [];

    renderNotifications();


    return [];

  }

}


/* =========================================================
   TEACHER SEARCH
========================================================= */

function getTeacherDisplayName(
  teacher
) {

  const fullName =
    safeString(
      teacher?.name
    );


  if (fullName) {
    return fullName;
  }


  return [
    safeString(
      teacher?.firstName ??
      teacher?.first_name
    ),

    safeString(
      teacher?.lastName ??
      teacher?.last_name
    ),

  ]
    .filter(Boolean)
    .join(' ')
    .trim() ||
    'Ustaz';

}


function getTeacherGender(
  teacher
) {

  return safeString(
    teacher?.gender,
    ''
  ).toLowerCase();

}


function getTeacherBio(
  teacher
) {

  return safeString(
    teacher?.bio ??
    teacher?.about ??
    teacher?.description,
    ''
  );

}


function getTeacherLocation(
  teacher
) {

  const location =
    teacher?.location || {};


  return [

    safeString(
      teacher?.area ??
      teacher?.area_name ??
      location.area
    ),

    safeString(
      teacher?.subcity ??
      teacher?.subcity_name ??
      location.subcity
    ),

  ]
    .filter(Boolean)
    .join(', ');

}
function getTeacherStudyFields(
  teacher
) {

  const values =
    teacher?.studyFields ??
    teacher?.study_fields ??
    teacher?.fields ??
    [];


  if (!Array.isArray(values)) {
    return [];
  }


  return [
    ...new Set(
      values
        .map(
          field => {

            if (
              typeof field === 'object' &&
              field !== null
            ) {

              return (
                safeString(
                  field.slug
                ) ||
                safeString(
                  field.name
                )
              );

            }


            return safeString(
              field
            );

          }
        )
        .filter(Boolean)
    ),
  ];

}
/* =========================================================
   TEACHER MATCHING
========================================================= */

function teacherMatchesGender(
  teacher
) {

  const preferred =
    safeString(
      state.preferences.preferredTeacherGender,
      'no-preference'
    ).toLowerCase();


  if (
    preferred === 'no-preference' ||
    !preferred
  ) {

    return true;

  }


  const teacherGender =
    getTeacherGender(
      teacher
    );


  return (
    teacherGender ===
    preferred
  );

}


function teacherMatchesStudyFields(
  teacher
) {

  const selected =
    normalizeArray(
      state.preferences.studyInterests
    ).map(
      value =>
        safeString(
          value
        ).toLowerCase()
    );


  if (!selected.length) {
    return true;
  }


  const teacherFields =
    getTeacherStudyFields(
      teacher
    ).map(
      value =>
        safeString(
          value
        ).toLowerCase()
    );


  if (!teacherFields.length) {
    return false;
  }


  return selected.some(
    field =>
      teacherFields.includes(
        field
      )
  );

}


function teacherMatchesFilter(
  teacher
) {

  switch (
    state.currentTeacherFilter
  ) {

    case 'male':

      return (
        getTeacherGender(
          teacher
        ) === 'male'
      );


    case 'female':

      return (
        getTeacherGender(
          teacher
        ) === 'female'
      );


    case 'study':

      return teacherMatchesStudyFields(
        teacher
      );


    case 'all':
    default:

      return true;

  }

}


function teacherMatchesSearch(
  teacher
) {

  const search =
    safeString(
      state.searchTerm
    ).toLowerCase();


  if (!search) {
    return true;
  }


  const values = [

    getTeacherDisplayName(
      teacher
    ),

    getTeacherBio(
      teacher
    ),

    getTeacherLocation(
      teacher
    ),

    ...getTeacherStudyFields(
      teacher
    ).map(
      field =>
        getStudyFieldLabel(
          field
        )
    ),

  ];


  return values.some(
    value =>
      safeString(
        value
      )
        .toLowerCase()
        .includes(search)
  );

}

/* =========================================================
   TEACHER SORT / DISTANCE HELPERS
========================================================= */

function getTeacherDistance(teacher) {

  const value =
    teacher?.distanceKm ??
    teacher?.distance_km ??
    teacher?.distance ??
    teacher?.proximityDistance ??
    teacher?.proximity_distance;

  const number =
    Number(value);

  return (
    Number.isFinite(number) &&
    number >= 0
  )
    ? number
    : null;

}


function getTeacherProximityRank(teacher) {

  const value =
    teacher?.proximityRank ??
    teacher?.proximity_rank;

  const number =
    Number(value);

  return Number.isFinite(number)
    ? number
    : Number.POSITIVE_INFINITY;

}


function sortTeachers(
  teachers
) {

  const list =
    Array.isArray(teachers)
      ? [...teachers]
      : [];


  if (
    state.sortMode === 'nearest'
  ) {

    list.sort(
      (a, b) => {

        const distanceA =
          getTeacherDistance(a);

        const distanceB =
          getTeacherDistance(b);


        /*
         * Use real kilometer distance when
         * the backend provides it.
         */
        if (
          Number.isFinite(distanceA) ||
          Number.isFinite(distanceB)
        ) {

          /*
           * Teachers without a real distance
           * go after teachers with a distance.
           */
          if (
            distanceA === null
          ) {

            return 1;

          }

          if (
            distanceB === null
          ) {

            return -1;

          }

          if (
            distanceA !== distanceB
          ) {

            return (
              distanceA -
              distanceB
            );

          }

        }


        /*
         * No real kilometer distance:
         *
         * 0 = same area
         * 1 = same subcity
         * 2 = elsewhere
         */
        const proximityA =
          getTeacherProximityRank(a);

        const proximityB =
          getTeacherProximityRank(b);


        if (
          proximityA !== proximityB
        ) {

          return (
            proximityA -
            proximityB
          );

        }


        /*
         * Same proximity:
         * alphabetical by teacher name.
         */
        return getTeacherDisplayName(a)
          .localeCompare(
            getTeacherDisplayName(b)
          );

      }
    );

  }


  return list;

}

/* =========================================================
   APPLY TEACHER FILTERS
========================================================= */

function applyTeacherFilters() {

  let result =
    state.teachers.filter(
      teacher =>
        teacherMatchesFilter(
          teacher
        )
    );


  result =
    result.filter(
      teacher =>
        teacherMatchesSearch(
          teacher
        )
    );


  result =
    sortTeachers(
      result
    );


  state.filteredTeachers =
    result;


  renderTeacherResults();

}


/* =========================================================
   TEACHER CARD HELPERS
========================================================= */

function teacherInitials(
  teacher
) {

  const name =
    getTeacherDisplayName(
      teacher
    );


  const parts =
    name
      .split(/\s+/)
      .filter(Boolean);


  const initials =
    parts
      .slice(0, 2)
      .map(
        part =>
          part.charAt(0)
      )
      .join('')
      .toUpperCase();


  return initials || 'U';

}

function resolveTeacherMediaUrl(value) {

  const raw =
    safeString(value);

  if (!raw) {
    return '';
  }

  if (
    /^(https?:|data:|blob:|filesystem:)/i.test(
      raw
    )
  ) {
    return raw;
  }

  try {

    return new URL(
      raw,
      `${STUDENT_CONFIG.API_BASE}/`
    ).href;

  } catch {

    return raw;

  }

}
function teacherPhotoUrl(
  teacher
) {

  const raw =
    safeString(

      teacher?.photoUrl ??

      teacher?.photoURL ??

      teacher?.profilePhotoUrl ??

      teacher?.profile_photo_url ??

      teacher?.photo ??

      teacher?.avatarUrl ??

      teacher?.avatar_url

    );


  return resolveTeacherMediaUrl(
    raw
  );

}

function formatTeacherDistance(
  teacher
) {

  const distance =
    getTeacherDistance(
      teacher
    );


  if (
    !Number.isFinite(
      distance
    )
  ) {

    return '';

  }


  const rounded =
    Number(
      distance.toFixed(
        distance < 10
          ? 1
          : 0
      )
    );


  return `${rounded} km`;

}


/* =========================================================
   RENDER TEACHER CARD
========================================================= */

function createTeacherCard(
  teacher
) {

  const article =
    document.createElement(
      'article'
    );


  article.className =
    'student-teacher-card';


  const name =
    getTeacherDisplayName(
      teacher
    );


  const gender =
    getTeacherGender(
      teacher
    );


  const location =
    getTeacherLocation(
      teacher
    );


  const bio =
    getTeacherBio(
      teacher
    );


  const fields =
    getTeacherStudyFields(
      teacher
    );


  const distance =
    formatTeacherDistance(
      teacher
    );


  const photoUrl =
    teacherPhotoUrl(
      teacher
    );


  const profileId =
    teacher?.id ??
    teacher?.userId ??
    teacher?.user_id ??
    '';


  const genderLabel =
    gender === 'female'
      ? 'Ustaza'
      : gender === 'male'
        ? 'Ustaz'
        : 'Teacher';


  const fieldHTML =
    fields
      .slice(0, 5)
      .map(
        field =>
          `
            <span
              class="student-teacher-field"
            >
              ${escapeHtml(
                getStudyFieldLabel(
                  field
                )
              )}
            </span>
          `
      )
      .join('');


  const safeName =
    escapeHtml(
      name
    );


  article.innerHTML =
    `
      <div
        class="student-teacher-card-top"
      >

        <div
          class="student-teacher-avatar"
          data-teacher-avatar
        >

          <span>
            ${escapeHtml(
              teacherInitials(
                teacher
              )
            )}
          </span>

          <img
            src=""
            alt=""
            hidden
          >

        </div>


        <span
          class="student-teacher-gender-badge"
        >
          <i
            class="fa-solid fa-user"
            aria-hidden="true"
          ></i>

          ${escapeHtml(
            genderLabel
          )}
        </span>


        ${
          distance
            ? `
              <span
                class="student-teacher-distance"
              >
                <i
                  class="fa-solid fa-location-dot"
                  aria-hidden="true"
                ></i>

                ${escapeHtml(
                  distance
                )}
              </span>
            `
            : ''
        }

      </div>


      <div
        class="student-teacher-card-body"
      >

        <h3
          class="student-teacher-name"
        >
          ${safeName}
        </h3>


        ${
          location
            ? `
              <div
                class="student-teacher-location"
              >

                <i
                  class="fa-solid fa-location-dot"
                  aria-hidden="true"
                ></i>

                <span>
                  ${escapeHtml(
                    location
                  )}
                </span>

              </div>
            `
            : ''
        }


        ${
          bio
            ? `
              <p
                class="student-teacher-bio"
              >
                ${escapeHtml(
                  bio
                )}
              </p>
            `
            : ''
        }


        ${
          fieldHTML
            ? `
              <div
                class="student-teacher-fields"
              >
                ${fieldHTML}
              </div>
            `
            : ''
        }


        <div
          class="student-teacher-card-footer"
        >

          <a
            href="#"
            class="student-teacher-view"
            data-teacher-view
            data-teacher-id="${escapeHtml(
              String(
                profileId
              )
            )}"
          >

            View profile

            <i
              class="fa-solid fa-arrow-right"
              aria-hidden="true"
            ></i>

          </a>


          <button
            type="button"
            class="student-teacher-save"
            data-teacher-save
            aria-label="Save ${safeName}"
            data-teacher-id="${escapeHtml(
              String(
                profileId
              )
            )}"
          >

            <i
              class="fa-regular fa-bookmark"
              aria-hidden="true"
            ></i>

          </button>

        </div>

      </div>
    `;


  /*
   * Profile image.
  */

  const image =
    article.querySelector(
      '[data-teacher-avatar] img'
    );

  const initials =
    article.querySelector(
      '[data-teacher-avatar] span'
    );


  if (
    image &&
    initials &&
    photoUrl
  ) {

    image.alt =
      `${name} profile photo`;


    image.onload =
      () => {

        image.hidden = false;
        initials.hidden = true;

      };


    image.onerror =
      () => {

        image.hidden = true;
        initials.hidden = false;

      };


    image.src =
      photoUrl;

  }


 /*
 * View public Ustaz profile.
 */

const viewButton =
  article.querySelector(
    '[data-teacher-view]'
  );


if (viewButton) {

  viewButton.addEventListener(
    'click',
    event => {

      event.preventDefault();


      const id =
        viewButton.dataset.teacherId;


      if (!id) {

        setTeacherError(
          'This teacher does not have a profile identifier yet.'
        );

        return;

      }


      window.location.href =
        `./view-ustaz-profile.html?id=${encodeURIComponent(id)}`;

    }
  );

}
  /*
   * Save teacher.
  */

  const saveButton =
    article.querySelector(
      '[data-teacher-save]'
    );


  if (saveButton) {

    syncTeacherSaveState(
      saveButton,
      teacher
    );


    saveButton.addEventListener(
      'click',
      () => {

        toggleSavedTeacher(
          teacher,
          saveButton
        );

      }
    );

  }


  return article;

}


/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeHtml(
  value
) {

  return String(
    value ?? ''
  )
    .replaceAll(
      '&',
      '&amp;'
    )
    .replaceAll(
      '<',
      '&lt;'
    )
    .replaceAll(
      '>',
      '&gt;'
    )
    .replaceAll(
      '"',
      '&quot;'
    )
    .replaceAll(
      "'",
      '&#039;'
    );

}


/* =========================================================
   TEACHER RESULTS RENDER
========================================================= */

function renderTeacherResults() {

  const list =
    $('teacherList');

  const empty =
    $('teacherEmptyState');

  const count =
    $('studentTeacherResultsCount');


  if (!list) {
    return;
  }


  list.innerHTML =
    '';


  const teachers =
    state.filteredTeachers;


  if (count) {

    count.textContent =
      `${teachers.length} teacher` +
      `${teachers.length === 1 ? '' : 's'}`;

  }


  if (!teachers.length) {

    if (empty) {

      empty.hidden =
        false;

    }


    return;

  }


  if (empty) {

    empty.hidden =
      true;

  }


  const fragment =
    document.createDocumentFragment();


  teachers.forEach(
    teacher => {

      fragment.appendChild(
        createTeacherCard(
          teacher
        )
      );

    }
  );


  list.appendChild(
    fragment
  );

}


/* =========================================================
   TEACHER EMPTY / ERROR STATES
========================================================= */

function setTeacherError(
  message
) {

  const errorPanel =
    $('studentTeacherError');

  const messageElement =
    $('studentTeacherErrorMessage');


  if (messageElement) {

    messageElement.textContent =
      safeString(
        message,
        'Unable to load teacher information.'
      );

  }


  if (errorPanel) {
    errorPanel.hidden = false;
  }

}


function clearTeacherError() {

  const errorPanel =
    $('studentTeacherError');


  if (errorPanel) {
    errorPanel.hidden = true;
  }

}


/* =========================================================
   TEACHER LOADING
========================================================= */

function setTeacherLoading(
  visible
) {

  const loading =
    $('studentTeacherLoading');

  const list =
    $('teacherList');

  const empty =
    $('teacherEmptyState');


  if (loading) {
    loading.hidden =
      !visible;
  }


  if (visible) {

    if (list) {
      list.hidden = true;
    }

    if (empty) {
      empty.hidden = true;
    }

  } else {

    if (list) {
      list.hidden = false;
    }

  }

}


/* =========================================================
   LOAD TEACHERS
========================================================= */

async function loadTeachers() {

  clearTeacherError();


  const endpoint =
    STUDENT_CONFIG.TEACHERS_ENDPOINT;


  /*
   * Backend endpoint is not confirmed yet.
   * Keep the page functional without a fake API call.
  */

  if (!endpoint) {

    state.teachers = [];

    state.filteredTeachers = [];

    renderTeacherResults();

    return [];

  }


  setTeacherLoading(
    true
  );


  try {

    const payload =
      await apiRequest(
        endpoint
      );


    const data =
      payload?.data ??
      payload ??
      [];


    let teachers = [];


    if (
      Array.isArray(data)
    ) {

      teachers =
        data;

    } else if (
      Array.isArray(
        data.teachers
      )
    ) {

      teachers =
        data.teachers;

    } else if (
      Array.isArray(
        data.results
      )
    ) {

      teachers =
        data.results;

    }


    state.teachers =
      teachers;


    applyTeacherFilters();


    return teachers;

  } catch (error) {

    console.error(
      '[student.js] Teacher loading failed:',
      error
    );


    state.teachers = [];
    state.filteredTeachers = [];


    setTeacherError(
      error.message ||
      'Unable to load teacher recommendations.'
    );


    renderTeacherResults();


    return [];

  } finally {

    setTeacherLoading(
      false
    );

  }

}


/* =========================================================
   RUN DISCOVERY
========================================================= */

let teacherDiscoveryLoaded =
  false;


async function runTeacherDiscovery() {

  /*
   * Avoid repeated API calls every time the user clicks
   * Home → Find Ustaz → Home → Find Ustaz.
  */

  if (
    teacherDiscoveryLoaded
  ) {

    applyTeacherFilters();

    return;

  }


  teacherDiscoveryLoaded =
    true;


  await loadTeachers();

}


/* =========================================================
   TEACHER FILTER EVENTS
========================================================= */

function setupTeacherFilters() {

  $$('.student-filter')
    .forEach(
      button => {

        button.addEventListener(
          'click',
          () => {

            $$('.student-filter')
              .forEach(
                item =>
                  item.classList.remove(
                    'active'
                  )
              );


            button.classList.add(
              'active'
            );


            state.currentTeacherFilter =
              safeString(
                button.dataset.teacherFilter,
                'all'
              ).toLowerCase();


            applyTeacherFilters();

          }
        );

      }
    );


  /*
   * Sidebar "Study Fields" uses the same filter.
  */

  $$('[data-teacher-filter="study"]')
    .forEach(
      element => {

        element.addEventListener(
          'click',
          event => {

            /*
             * The standalone filter button already has
             * its own handler. This block only ensures
             * sidebar items navigate to teacher discovery.
            */

            if (
              element.classList.contains(
                'student-nav-link'
              )
            ) {

              event.preventDefault();

              showSection(
                'teachers'
              );


              $$('.student-filter')
                .forEach(
                  filter => {

                    filter.classList.toggle(
                      'active',
                      filter.dataset.teacherFilter ===
                        'study'
                    );

                  }
                );


              state.currentTeacherFilter =
                'study';


              applyTeacherFilters();

              closeMobileSidebar();

            }

          }
        );

      }
    );

}


/* =========================================================
   TEACHER SEARCH
========================================================= */

function setupTeacherSearch() {

  const input =
    $('studentTeacherSearch');

  const clearButton =
    $('studentTeacherSearchClear');


  if (!input) {
    return;
  }


  input.addEventListener(
    'input',
    () => {

      state.searchTerm =
        input.value.trim();


      if (clearButton) {

        clearButton.hidden =
          !state.searchTerm;

      }


      applyTeacherFilters();

    }
  );


  if (clearButton) {

    clearButton.addEventListener(
      'click',
      () => {

        input.value =
          '';

        state.searchTerm =
          '';

        clearButton.hidden =
          true;


        input.focus();

        applyTeacherFilters();

      }
    );

  }

}


/* =========================================================
   TEACHER SORT
========================================================= */

function setupTeacherSort() {

  const button =
    $('studentSortButton');


  if (!button) {
    return;
  }


  button.addEventListener(
    'click',
    () => {

      /*
       * Current intended ordering:
       * nearest first.

       * A future backend could support additional
       * sort modes. Until then we keep the UI truthful.
      */

      state.sortMode =
        'nearest';


      applyTeacherFilters();

    }
  );

}


/* =========================================================
   SAVED TEACHERS
========================================================= */

const SAVED_TEACHERS_KEY =
  'barakalink_saved_teacher_ids';


function getSavedTeacherIds() {

  try {

    const raw =
      localStorage.getItem(
        SAVED_TEACHERS_KEY
      );


    const parsed =
      raw
        ? JSON.parse(raw)
        : [];


    return Array.isArray(parsed)
      ? parsed.map(
          value => String(value)
        )
      : [];

  } catch {

    return [];

  }

}


function setSavedTeacherIds(
  ids
) {

  localStorage.setItem(
    SAVED_TEACHERS_KEY,
    JSON.stringify(
      [
        ...new Set(
          ids.map(
            value =>
              String(value)
          )
        ),
      ]
    )
  );

}


function getTeacherId(
  teacher
) {

  return (
    teacher?.id ??
    teacher?.userId ??
    teacher?.user_id ??
    null
  );

}


function isTeacherSaved(
  teacher
) {

  const id =
    getTeacherId(
      teacher
    );


  if (
    id === null ||
    id === undefined ||
    id === ''
  ) {
    return false;
  }


  const savedIds =
    getSavedTeacherIds();


  return savedIds.includes(
    String(id)
  );

}


function syncTeacherSaveState(
  button,
  teacher
) {

  const saved =
    isTeacherSaved(
      teacher
    );


  button.classList.toggle(
    'active',
    saved
  );


  const icon =
    button.querySelector(
      'i'
    );


  if (icon) {

    icon.className =
      saved
        ? 'fa-solid fa-bookmark'
        : 'fa-regular fa-bookmark';

  }


  const name =
    getTeacherDisplayName(
      teacher
    );


  button.setAttribute(
    'aria-label',
    saved
      ? `Remove ${name} from saved teachers`
      : `Save ${name}`
  );

}


function toggleSavedTeacher(
  teacher,
  button
) {

  const id =
    getTeacherId(
      teacher
    );


  if (
    id === null ||
    id === undefined ||
    id === ''
  ) {

    return;

  }


  const normalizedId =
    String(id);


  let ids =
    getSavedTeacherIds();


  const existingIndex =
    ids.indexOf(
      normalizedId
    );


  if (
    existingIndex >= 0
  ) {

    ids.splice(
      existingIndex,
      1
    );

  } else {

    ids.push(
      normalizedId
    );

  }


  setSavedTeacherIds(
    ids
  );


  syncTeacherSaveState(
    button,
    teacher
  );


  renderSavedTeachers();

}


/* =========================================================
   RENDER SAVED TEACHERS
========================================================= */

function renderSavedTeachers() {

  const container =
    $('studentSavedTeachers');

  const empty =
    $('studentSavedEmptyState');


  if (!container) {
    return;
  }


  const savedIds =
    getSavedTeacherIds();


  state.savedTeachers =
    state.teachers.filter(
      teacher => {

        const id =
          getTeacherId(
            teacher
          );


        return (
          id !== null &&
          savedIds.includes(
            String(id)
          )
        );

      }
    );


  container.innerHTML =
    '';


  if (
    !state.savedTeachers.length
  ) {

    if (empty) {
      empty.hidden = false;
    }

    return;

  }


  if (empty) {
    empty.hidden = true;
  }


  const fragment =
    document.createDocumentFragment();


  state.savedTeachers.forEach(
    teacher => {

      fragment.appendChild(
        createTeacherCard(
          teacher
        )
      );

    }
  );


  container.appendChild(
    fragment
  );

}


/* =========================================================
   SAVED SECTION SETUP
========================================================= */

function setupSavedSection() {

  renderSavedTeachers();

}


/* =========================================================
   CONTENT TOPIC INTERACTIONS
========================================================= */

function setupContentCards() {

  $$('.student-content-card')
    .forEach(
      card => {

        card.addEventListener(
          'click',
          () => {

            const topic =
              safeString(
                card.dataset.topic
              );


            /*
             * There is no content API contract supplied yet.
             * Keep the topic selectable without inventing
             * a content URL.
            */

            console.info(
              '[student.js] Islamic content topic selected:',
              topic
            );

          }
        );

      }
    );

}


/* =========================================================
   LOGOUT
========================================================= */

function performLogout() {

  clearSession();

  window.location.href =
    '../index.html';

}


function setupLogout() {

  const sidebarLogout =
    $('studentSidebarLogout');


  const menuLogout =
    $('studentMenuLogout');


  if (sidebarLogout) {

    sidebarLogout.addEventListener(
      'click',
      performLogout
    );

  }


  if (menuLogout) {

    menuLogout.addEventListener(
      'click',
      performLogout
    );

  }

}


/* =========================================================
   RETRY
========================================================= */

function setupRetry() {

  const button =
    $('studentPageRetry');


  if (!button) {
    return;
  }


  button.addEventListener(
    'click',
    initializeDashboard
  );


  const teacherRetry =
    $('studentTeacherRetry');


  if (teacherRetry) {

    teacherRetry.addEventListener(
      'click',
      async () => {

        teacherDiscoveryLoaded =
          false;


        await loadTeachers();

      }
    );

  }

}


/* =========================================================
   GLOBAL CLICK / OUTSIDE INTERACTION
========================================================= */

function setupGlobalInteraction() {

  document.addEventListener(
    'click',
    event => {

      const target =
        event.target;


      if (
        !(target instanceof Element)
      ) {
        return;
      }


      const profileButton =
        $('studentAvatarButton');

      const profileMenu =
        $('studentProfileMenu');


      if (
        profileMenu &&
        profileButton &&
        !profileMenu.contains(target) &&
        !profileButton.contains(target)
      ) {

        closeProfileMenu();

      }


      const notificationButton =
        $('studentNotificationButton');

      const notificationPanel =
        $('studentNotificationPanel');


      if (
        notificationPanel &&
        notificationButton &&
        !notificationPanel.contains(target) &&
        !notificationButton.contains(target)
      ) {

        closeNotificationPanel();

      }

    }
  );

}


/* =========================================================
   RESIZE
========================================================= */

function setupResizeHandling() {

  window.addEventListener(
    'resize',
    () => {

      /*
       * When moving from mobile to desktop, make sure
       * the off-canvas state does not remain locked.
      */

      if (
        window.innerWidth > 768
      ) {

        closeMobileSidebar();

      }

    }
  );

}


/* =========================================================
   RENDER LEARNING PLACEHOLDERS
========================================================= */

function renderLearningSummary() {

  /*
   * No lessons/progress API has been provided yet.

   * Keep these values honest until the learning backend
   * is implemented.
  */

  setText(
    'studentLessonCount',
    '0'
  );


  setText(
    'studentLearningProgress',
    '—'
  );

}


/* =========================================================
   MAIN PROFILE RENDER
========================================================= */

function renderDashboard() {

  renderNames();

  renderAvatars();

  renderSummary();

  renderLearningSummary();

  renderSavedTeachers();

  renderNotifications();

}


/* =========================================================
   PROFILE RELOAD
========================================================= */

async function reloadDashboardData() {

  const [
    profile,
    preferences,
  ] = await Promise.all([
    loadProfile(),
    loadPreferences(),
  ]);


  /*
   * Profile must be checked after it is loaded.
  */

  enforceParentRole();

  enforceAccountStatus();

  enforceProfileCompletion();


  state.profile =
    profile;


  state.preferences =
    preferences;


  renderDashboard();


  return {

    profile,

    preferences,

  };

}


/* =========================================================
   INITIALIZE DASHBOARD
========================================================= */

let initializationPromise =
  null;


async function initializeDashboard() {

  /*
   * Prevent duplicate initialization calls caused by
   * retry buttons or repeated DOM events.
  */

  if (
    initializationPromise
  ) {

    return initializationPromise;

  }


  initializationPromise =
    (async () => {

      showPageLoading();

      hideGlobalError();


      try {

        const token =
          getAuthToken();


        if (!token) {

          redirectToLogin();

          return;

        }


        await reloadDashboardData();


        /*
         * Notifications are optional until their dedicated parent
         * endpoint is enabled. Their failure must never turn the
         * entire dashboard into a global error state.
         */
        try {

          await loadNotifications();

        } catch (notificationError) {

          console.warn(
            '[student.js] Optional notifications setup failed:',
            notificationError
          );

        }


        /*
         * Dashboard controls are UI enhancements. A problem in one
         * optional interaction should not make the already-loaded
         * profile appear to have failed.
         */
        try {

          setupDashboardAfterLoad();

        } catch (setupError) {

          console.error(
            '[student.js] Dashboard interaction setup failed:',
            setupError
          );

        }


        hideGlobalError();


      } catch (error) {

        console.error(
          '[student.js] Dashboard initialization failed:',
          error
        );


        if (
          error?.code ===
          'UNAUTHORIZED' ||
          error?.status === 401
        ) {

          redirectToLogin();

          return;

        }


        if (
          error?.code ===
          'NO_TOKEN'
        ) {

          redirectToLogin();

          return;

        }


        showGlobalError(
          error?.message ||
          'We could not load your BarakaLink dashboard.'
        );

      } finally {

        hidePageLoading();

        /*
         * Allow another explicit retry after failure.
        */

        initializationPromise =
          null;

      }

    })();


  return initializationPromise;

}


/* =========================================================
   POST-LOAD SETUP
========================================================= */

let dashboardInteractionSetup =
  false;


function setupDashboardAfterLoad() {

  if (
    dashboardInteractionSetup
  ) {

    return;

  }


  dashboardInteractionSetup =
    true;


  setupSectionNavigation();

  setupMobileSidebar();

  setupTheme();

  setupProfileMenu();

  setupNotificationPanel();

  setupTeacherFilters();

  setupTeacherSearch();

  setupTeacherSort();

  setupSavedSection();

  setupContentCards();

  setupLogout();

  setupRetry();

  setupGlobalInteraction();

  setupResizeHandling();


  /*
   * Teacher results are deliberately loaded only when the
   * teacher-discovery section is opened, unless a valid
   * endpoint is configured.
  */

  renderTeacherResults();

}


/* =========================================================
   EXTERNAL API
   Useful later when the teacher backend is ready.
========================================================= */

window.BarakaLinkStudentDashboard = {

  reload:
    initializeDashboard,

  reloadProfile:
    reloadDashboardData,

  setTeachers(
    teachers
  ) {

    state.teachers =
      Array.isArray(teachers)
        ? teachers
        : [];


    teacherDiscoveryLoaded =
      true;


    state.currentSection =
      'teachers';


    applyTeacherFilters();

    renderSavedTeachers();

  },

  getState() {

    return {
      ...state,
      preferences: {
        ...state.preferences,
        studyInterests: [
          ...state.preferences
            .studyInterests,
        ],
        contentInterests: [
          ...state.preferences
            .contentInterests,
        ],
      },
      teachers: [
        ...state.teachers,
      ],
      filteredTeachers: [
        ...state.filteredTeachers,
      ],
      savedTeachers: [
        ...state.savedTeachers,
      ],
      notifications: [
        ...state.notifications,
      ],
    };

  },

};


/* =========================================================
   DOM READY
========================================================= */

document.addEventListener(
  'DOMContentLoaded',
  () => {

    initializeDashboard();

  }
);