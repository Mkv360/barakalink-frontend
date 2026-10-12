'use strict';

/* =========================================================
   BARAKALINK STUDENT DASHBOARD PROFILE

   Profile normalization/loading and all profile display
   rendering belong here. Authentication guards remain in
   student-auth.js.
========================================================= */

import { STUDENT_CONFIG, $, setText } from './student-core.js';
import { state } from './student-state.js';
import { safeString, normalizeArray, capitalizeWords } from './student-utils.js';
import { apiRequest } from './student-api.js';

const STUDY_FIELD_LABELS = Object.freeze({
  'quran-basic': 'Quran Basic',
  'quran_basic': 'Quran Basic',
  tajweed: 'Tajweed',
  hifz: 'Hifz',
  tafseer: 'Tafseer',
  hadith: 'Hadith',
  tarbiyah: 'Tarbiyah',
});

const CONTENT_INTEREST_LABELS = Object.freeze({
  quran: 'Quran',
  tafseer: 'Tafseer',
  hadith: 'Hadith',
  seerah: 'Seerah',
  aqeedah: 'Aqeedah',
  fiqh: 'Fiqh',
  'dua-adhkar': 'Dua & Adhkar',
  'islamic-manners-character': 'Islamic Manners & Character',
  'stories-of-the-prophets': 'Stories of the Prophets',
  'family-parenting-islam': 'Family & Parenting in Islam',
  'childrens-islamic-education': "Children's Islamic Education",
  'islamic-history': 'Islamic History',
});
/* =========================================================
   LOCATION DISPLAY NAMES
   Keep database slugs unchanged.
========================================================= */

const LOCATION_LABEL_OVERRIDES = Object.freeze({
  cmc: 'CMC',
});

function formatLocationDisplayName(displayName, slug) {
  const value = safeString(displayName || slug).trim();

  if (!value) {
    return '';
  }

  const key = value.toLowerCase();

  if (LOCATION_LABEL_OVERRIDES[key]) {
    return LOCATION_LABEL_OVERRIDES[key];
  }

  return capitalizeWords(
    value.replace(/[_-]+/g, ' ')
  );
}
export function profileFromPossibleNestedUser(data) {

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


export function extractProfilePayload(payload) {

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


export function normalizeProfile(profile) {

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


export async function loadProfile() {

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


export async function loadPreferences() {

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


export function getFullName() {

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


export function getFirstName() {

  return (
    safeString(
      state.profile?.firstName
    ) ||
    'there'
  );

}


export function getInitials() {

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


export function getLocationParts() {
  const profile = state.profile || {};
  const student = profile.student || {};
  const teacherProfile = profile.teacherProfile || {};

  return {
    subcity: safeString(
      student.subcityName ||
      student.subcity_name ||
      teacherProfile.subcityName ||
      teacherProfile.subcity_name ||
      profile.subcityName ||
      profile.subcity_name ||
      student.subcity ||
      teacherProfile.subcity ||
      profile.subcity
    ),

    area: safeString(
      student.areaName ||
      student.area_name ||
      teacherProfile.areaName ||
      teacherProfile.area_name ||
      profile.areaName ||
      profile.area_name ||
      student.area ||
      teacherProfile.area ||
      profile.area
    ),

    mosque: safeString(
      student.nearestMosque ||
      student.nearest_mosque ||
      teacherProfile.nearestMosque ||
      teacherProfile.nearest_mosque ||
      profile.nearestMosque ||
      profile.nearest_mosque
    ),
  };
}



export function formatLocation() {

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


export function formatTeacherGender(value) {

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


export function getStudyFieldLabel(slug) {

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


export function getContentInterestLabel(key) {

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


export function renderNames() {

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
    `Assalamu Alaykum, ${firstName}`
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


export function resolveAvatarUrl(value) {

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


export function getPossibleAvatarUrl() {

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


export function applyAvatar(
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


export function renderAvatars() {

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


export function renderSummary() {

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


export function createChip(
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


export function renderStudyChips() {

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


export function renderContentChips() {

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


export function renderSelectedTopics() {

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
