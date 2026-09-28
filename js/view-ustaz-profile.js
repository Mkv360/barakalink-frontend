'use strict';

/* =========================================================
   BARAKALINK
   PUBLIC USTAZ PROFILE

   File:
   frontend/js/view-ustaz-profile.js

   Responsibilities:
   - Read Ustaz ID from URL
   - Load real teacher data
   - Render the public profile
   - Render teaching fields
   - Calculate subject count
   - Render mosque / price / experience
   - Render languages
   - Render lesson details
   - Render availability
   - Render Quran recitation
   - Handle save / unsave
   - Handle theme
   - Handle back button
   - Handle loading/error states

   Uses existing:
   GET /api/teachers
========================================================= */


/* =========================================================
   CONFIGURATION
========================================================= */

const USTAZ_PROFILE_CONFIG = Object.freeze({

  API_BASE:
    String(
      window.BARAKALINK_API_BASE ||
      'http://localhost:5000/api'
    ).replace(/\/+$/, ''),

  TEACHERS_ENDPOINT:
    window.BARAKALINK_TEACHERS_ENDPOINT ||
    '/teachers',

  THEME_KEY:
    'barakalink_theme',

  SAVED_TEACHERS_KEY:
    'barakalink_saved_teacher_ids',

});


/* =========================================================
   DOM
========================================================= */

const $ = (id) =>
  document.getElementById(id);


/* =========================================================
   GENERAL HELPERS
========================================================= */

function safeString(
  value,
  fallback = ''
) {

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


function normalizeArray(
  value
) {

  if (!Array.isArray(value)) {
    return [];
  }


  return [
    ...new Set(
      value
        .map(
          item => {

            if (
              typeof item === 'object' &&
              item !== null
            ) {

              return (
                safeString(item.slug) ||
                safeString(item.name) ||
                safeString(item.label) ||
                safeString(item.value)
              );

            }


            return safeString(item);

          }
        )
        .filter(Boolean)
    ),
  ];

}


/* =========================================================
   STUDY FIELDS
========================================================= */

const STUDY_FIELD_LABELS =
  Object.freeze({

    'quran-basic':
      'Quran Basic',

    'quran_basic':
      'Quran Basic',

    quran:
      'Quran',

    tajweed:
      'Tajweed',

    hifz:
      'Hifz',

    tafseer:
      'Tafseer',

    hadith:
      'Hadith',

    tarbiyah:
      'Tarbiyah',

  });


function getStudyFieldLabel(
  value
) {

  const key =
    safeString(
      value
    ).toLowerCase();


  if (
    STUDY_FIELD_LABELS[key]
  ) {

    return STUDY_FIELD_LABELS[key];

  }


  return key
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, letter =>
      letter.toUpperCase()
    );

}


/* =========================================================
   URL / TEACHER ID
========================================================= */

function getRequestedTeacherId() {

  const params =
    new URLSearchParams(
      window.location.search
    );


  return safeString(
    params.get('id')
  );

}


function getTeacherIdentifierValues(
  teacher
) {

  return [

    teacher?.id,

    teacher?.userId,

    teacher?.user_id,

    teacher?.teacherProfileId,

    teacher?.teacher_profile_id,

    teacher?.profileId,

    teacher?.profile_id,

  ]

    .filter(
      value =>
        value !== null &&
        value !== undefined &&
        value !== ''
    )

    .map(
      value =>
        String(value)
    );

}


function teacherMatchesId(
  teacher,
  requestedId
) {

  if (!requestedId) {
    return false;
  }


  return getTeacherIdentifierValues(
    teacher
  ).includes(
    String(requestedId)
  );

}


/* =========================================================
   TEACHER ACCESSORS
========================================================= */

function getTeacherName(
  teacher
) {

  const explicit =
    safeString(
      teacher?.name
    );


  if (explicit) {
    return explicit;
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
    teacher?.gender
  ).toLowerCase();

}


function getTeacherLocation(
  teacher
) {

  const location =
    teacher?.location ||
    {};


  const area =
    safeString(
      teacher?.area ??
      teacher?.area_name ??
      location.area
    );


  const subcity =
    safeString(
      teacher?.subcity ??
      teacher?.subcity_name ??
      location.subcity
    );


  return {

    area,

    subcity,

    text:
      [
        area,
        subcity,
      ]
        .filter(Boolean)
        .join(', '),

  };

}


function getTeacherMosque(
  teacher
) {

  return safeString(

    teacher?.nearestMosque ??

    teacher?.nearest_mosque ??

    teacher?.mosque ??

    teacher?.nearestMosqueName ??

    teacher?.nearest_mosque_name

  );

}


function getTeacherBio(
  teacher
) {

  return safeString(

    teacher?.bio ??

    teacher?.about ??

    teacher?.description

  );

}


function getTeacherStudyFields(
  teacher
) {

  return normalizeArray(

    teacher?.studyFields ??

    teacher?.study_fields ??

    teacher?.fields ??

    []

  );

}


function getTeacherLanguages(
  teacher
) {

  return normalizeArray(

    teacher?.languages ??

    teacher?.language ??

    teacher?.teachingLanguages ??

    teacher?.teaching_languages ??

    []

  );

}


function getTeacherAvatar(
  teacher
) {

  return safeString(

    teacher?.avatarUrl ??

    teacher?.avatar_url ??

    teacher?.photoUrl ??

    teacher?.photoURL ??

    teacher?.profilePhotoUrl ??

    teacher?.profile_photo_url ??

    teacher?.photo

  );

}


function getTeacherAudio(
  teacher
) {

  return safeString(

    teacher?.recitationAudioUrl ??

    teacher?.recitation_audio_url ??

    teacher?.audioUrl ??

    teacher?.audio_url

  );

}

/* =========================================================
   CHAT / MESSAGING
========================================================= */

function resolveMessagingUserId(profileData) {

  const candidates = [

    // Preferred: actual users.id
    profileData?.userId,
    profileData?.user_id,

    profileData?.user?.id,
    profileData?.user?.userId,
    profileData?.user?.user_id,

    // Possible nested teacher profile representations
    profileData?.teacherProfile?.userId,
    profileData?.teacherProfile?.user_id,

    profileData?.teacher?.userId,
    profileData?.teacher?.user_id,

  ];


  for (const value of candidates) {

    const id =
      Number(value);


    if (
      Number.isInteger(id) &&
      id > 0
    ) {

      return id;

    }

  }


  return null;

}


function setupUstazChatButton(
  profileData
) {

  const button =
    $('ustazProfileChatButton');


  if (!button) {
    return;
  }


  /*
   * Prevent duplicate click listeners if the profile
   * is loaded again after Retry.
   */
  if (
    button.dataset.chatListenerBound === '1'
  ) {

    return;

  }


  const ustazUserId =
    resolveMessagingUserId(
      profileData
    );


  if (!ustazUserId) {

    button.disabled = true;

    button.title =
      'This Ustaz does not have a valid user account ID.';

    console.error(
      '[BarakaLink][Ustaz Profile] Could not resolve Ustaz users.id for messaging.',
      profileData
    );

    return;

  }


  button.disabled =
    false;

  button.dataset.ustazUserId =
    String(ustazUserId);

  button.dataset.chatListenerBound =
    '1';


  button.addEventListener(
    'click',
    () => {

      const id =
        Number(
          button.dataset.ustazUserId
        );


      if (
        !Number.isInteger(id) ||
        id <= 0
      ) {

        console.error(
          '[BarakaLink][Ustaz Profile] Invalid Ustaz user ID.'
        );

        return;

      }


      window.location.href =
        `inbox.html?with=${encodeURIComponent(id)}`;

    }
  );

}
/* =========================================================
   MEDIA URL
========================================================= */

function resolveMediaUrl(
  value
) {

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
      `${USTAZ_PROFILE_CONFIG.API_BASE}/`
    ).href;

  } catch {

    return raw;

  }

}


/* =========================================================
   FORMATTING
========================================================= */

function formatGender(
  value
) {

  const gender =
    safeString(
      value
    ).toLowerCase();


  if (
    gender === 'female'
  ) {

    return 'Ustaza';

  }


  if (
    gender === 'male'
  ) {

    return 'Ustaz';

  }


  return 'Teacher';

}


function formatExperience(
  value
) {

  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {

    return 'Not provided';

  }


  const number =
    Number(value);


  if (
    Number.isFinite(number)
  ) {

    return (
      `${number} year` +
      `${number === 1 ? '' : 's'}`
    );

  }


  return safeString(
    value,
    'Not provided'
  );

}


function formatHourlyRate(
  value
) {

  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {

    return '—';

  }


  const number =
    Number(value);


  if (
    Number.isFinite(number)
  ) {

    return (
      `${number.toLocaleString('en-US')} ETB`
    );

  }


  const text =
    safeString(
      value
    );


  return text || '—';

}


function formatLessonDuration(
  value
) {

  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {

    return 'Not provided';

  }


  const number =
    Number(value);


  if (
    Number.isFinite(number)
  ) {

    return (
      `${number} minute` +
      `${number === 1 ? '' : 's'}`
    );

  }


  return safeString(
    value,
    'Not provided'
  );

}


function formatLessonFormat(
  value
) {

  const text =
    safeString(
      value
    );


  if (!text) {
    return 'Not provided';
  }


  return text
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, letter =>
      letter.toUpperCase()
    );

}


/* =========================================================
   INITIALS
========================================================= */

function getInitials(
  teacher
) {

  const name =
    getTeacherName(
      teacher
    );


  const parts =
    name
      .split(/\s+/)
      .filter(Boolean);


  return (
    parts
      .slice(0, 2)
      .map(
        part =>
          part.charAt(0)
      )
      .join('')
      .toUpperCase() ||
    'U'
  );

}


/* =========================================================
   API
========================================================= */

async function loadTeachers() {

  if (
    !window.BarakaLinkAPI ||
    typeof window.BarakaLinkAPI.get !== 'function'
  ) {

    throw new Error(
      'The BarakaLink API helper could not be loaded.'
    );

  }


  const payload =
    await window.BarakaLinkAPI.get(
      USTAZ_PROFILE_CONFIG.TEACHERS_ENDPOINT
    );


  const data =
    payload?.data ??
    payload ??
    [];


  if (
    Array.isArray(data)
  ) {

    return data;

  }


  if (
    Array.isArray(
      data.teachers
    )
  ) {

    return data.teachers;

  }


  if (
    Array.isArray(
      data.results
    )
  ) {

    return data.results;

  }


  return [];

}


/* =========================================================
   LOADING / ERROR
========================================================= */

function showLoading() {

  const loading =
    $('ustazProfileLoading');

  const error =
    $('ustazProfileError');

  const content =
    $('ustazProfileContent');


  if (loading) {
    loading.hidden = false;
  }


  if (error) {
    error.hidden = true;
  }


  if (content) {

    content.classList.remove(
      'is-visible'
    );

  }

}


function hideLoading() {

  const loading =
    $('ustazProfileLoading');


  if (loading) {
    loading.hidden = true;
  }

}


function showProfileContent() {

  const content =
    $('ustazProfileContent');


  if (content) {

    content.classList.add(
      'is-visible'
    );

  }

}


function showError(
  message
) {

  const loading =
    $('ustazProfileLoading');

  const error =
    $('ustazProfileError');

  const content =
    $('ustazProfileContent');

  const messageElement =
    $('ustazProfileErrorMessage');


  if (loading) {
    loading.hidden = true;
  }


  if (content) {

    content.classList.remove(
      'is-visible'
    );

  }


  if (messageElement) {

    messageElement.textContent =
      safeString(
        message,
        'The Ustaz profile could not be loaded.'
      );

  }


  if (error) {
    error.hidden = false;
  }

}


/* =========================================================
   RENDER IDENTITY
========================================================= */

function renderIdentity(
  teacher
) {

  const name =
    getTeacherName(
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


  const initials =
    getInitials(
      teacher
    );


  const avatar =
    resolveMediaUrl(
      getTeacherAvatar(
        teacher
      )
    );


  const nameElement =
    $('ustazProfileName');

  const roleElement =
    $('ustazProfileRole');

  const locationElement =
    $('ustazProfileLocation');

  const initialsElement =
    $('ustazProfileInitials');

  const imageElement =
    $('ustazProfileImage');


  if (nameElement) {

    nameElement.textContent =
      name;

  }


  if (roleElement) {

    roleElement.innerHTML =
      `
        <i
          class="fa-solid fa-quran"
          aria-hidden="true"
        ></i>

        <span>
          ${escapeHtml(
            formatGender(
              gender
            )
          )}
        </span>
      `;

  }


  if (locationElement) {

    locationElement.innerHTML =
      `
        <i
          class="fa-solid fa-location-dot"
          aria-hidden="true"
        ></i>

        <span>
          ${escapeHtml(
            location.text ||
            'Location not available'
          )}
        </span>
      `;

  }


  if (initialsElement) {

    initialsElement.textContent =
      initials;

    initialsElement.hidden =
      false;

  }


  if (imageElement) {

    imageElement.hidden =
      true;

    imageElement.removeAttribute(
      'src'
    );


    if (avatar) {

      imageElement.alt =
        `${name} profile photo`;


      imageElement.onload =
        () => {

          imageElement.hidden =
            false;

          if (initialsElement) {

            initialsElement.hidden =
              true;

          }

        };


      imageElement.onerror =
        () => {

          imageElement.hidden =
            true;

          if (initialsElement) {

            initialsElement.hidden =
              false;

          }

        };


      imageElement.src =
        avatar;

    }

  }

}


/* =========================================================
   RENDER BADGES
========================================================= */

function renderBadges(
  teacher
) {

  const container =
    $('ustazProfileBadges');


  if (!container) {
    return;
  }


  container.innerHTML =
    '';


  const gender =
    getTeacherGender(
      teacher
    );


  const location =
    getTeacherLocation(
      teacher
    );


  const fields =
    getTeacherStudyFields(
      teacher
    );


  const experience =
    teacher?.experience;


  const badges = [];


  if (gender) {

    badges.push({

      icon:
        'fa-solid fa-user',

      text:
        formatGender(
          gender
        ),

    });

  }


  if (
    experience !== null &&
    experience !== undefined &&
    experience !== ''
  ) {

    badges.push({

      icon:
        'fa-solid fa-clock',

      text:
        formatExperience(
          experience
        ),

    });

  }


  if (
    location.text
  ) {

    badges.push({

      icon:
        'fa-solid fa-location-dot',

      text:
        location.text,

    });

  }


  if (
    fields.length
  ) {

    badges.push({

      icon:
        'fa-solid fa-layer-group',

      text:
        `${fields.length} subject` +
        `${fields.length === 1 ? '' : 's'}`,

    });

  }


  badges.forEach(
    badge => {

      const element =
        document.createElement(
          'span'
        );


      element.className =
        'ustaz-profile-badge';


      const icon =
        document.createElement(
          'i'
        );


      icon.className =
        badge.icon;

      icon.setAttribute(
        'aria-hidden',
        'true'
      );


      const text =
        document.createElement(
          'span'
        );


      text.textContent =
        badge.text;


      element.appendChild(
        icon
      );


      element.appendChild(
        text
      );


      container.appendChild(
        element
      );

    }
  );

}


/* =========================================================
   RENDER TEACHING FIELDS + SUBJECT COUNT
========================================================= */

function renderStudyFields(
  teacher
) {

  const container =
    $('ustazProfileStudyFields');

  const subjectCount =
    $('ustazProfileSubjectCount');


  const fields =
    getTeacherStudyFields(
      teacher
    );


  if (container) {

    container.innerHTML =
      '';


    if (!fields.length) {

      const empty =
        document.createElement(
          'span'
        );


      empty.className =
        'ustaz-profile-field-empty';


      empty.textContent =
        'No study fields listed.';


      container.appendChild(
        empty
      );

    } else {

      fields.forEach(
        field => {

          const element =
            document.createElement(
              'span'
            );


          element.className =
            'ustaz-profile-field';


          element.textContent =
            getStudyFieldLabel(
              field
            );


          container.appendChild(
            element
          );

        }
      );

    }

  }


  /*
   * This fixes:
   *
   * Subjects
   * Not provided
   *
   * by deriving the number from the same fields
   * displayed above.
   */
  if (subjectCount) {

    if (fields.length) {

      subjectCount.textContent =
        `${fields.length} subject` +
        `${fields.length === 1 ? '' : 's'}`;

    } else {

      subjectCount.textContent =
        'Not provided';

    }

  }

}


/* =========================================================
   RENDER MAIN STATS
========================================================= */

function renderMainStats(
  teacher
) {

  const mosque =
    $('ustazProfileMosque');

  const hourlyRate =
    $('ustazProfileHourlyRate');

  const experience =
    $('ustazProfileExperience');


  if (mosque) {

    mosque.textContent =
      getTeacherMosque(
        teacher
      ) ||
      'Not provided';

  }


  if (hourlyRate) {

    hourlyRate.textContent =
      formatHourlyRate(

        teacher?.hourlyRate ??

        teacher?.hourly_rate

      );

  }


  if (experience) {

    experience.textContent =
      formatExperience(
        teacher?.experience
      );

  }

}


/* =========================================================
   RENDER ABOUT
========================================================= */

function renderAbout(
  teacher
) {

  const element =
    $('ustazProfileBio');


  if (!element) {
    return;
  }


  element.textContent =
    getTeacherBio(
      teacher
    ) ||
    'No biography has been provided.';

}


/* =========================================================
   RENDER TEACHING APPROACH
========================================================= */

function renderTeachingApproach(
  teacher
) {

  const element =
    $('ustazProfileTeachingApproach');


  if (!element) {
    return;
  }


  element.textContent =
    safeString(

      teacher?.teachingApproach ??

      teacher?.teaching_approach

    ) ||

    'No teaching approach has been provided.';

}


/* =========================================================
   RENDER LANGUAGES
========================================================= */

function renderLanguages(
  teacher
) {

  const container =
    $('ustazProfileLanguages');


  if (!container) {
    return;
  }


  container.innerHTML =
    '';


  const languages =
    getTeacherLanguages(
      teacher
    );


  if (!languages.length) {

    const empty =
      document.createElement(
        'span'
      );


    empty.className =
      'ustaz-profile-empty';


    empty.textContent =
      'No languages listed.';


    container.appendChild(
      empty
    );


    return;

  }


  languages.forEach(
    language => {

      const element =
        document.createElement(
          'span'
        );


      element.className =
        'ustaz-profile-language';


      element.textContent =
        language;


      container.appendChild(
        element
      );

    }
  );

}


/* =========================================================
   RENDER LESSON DETAILS
========================================================= */

function renderLessonDetails(
  teacher
) {

  const duration =
    $('ustazProfileLessonDuration');

  const format =
    $('ustazProfileLessonFormat');


  if (duration) {

    duration.textContent =
      formatLessonDuration(

        teacher?.lessonDuration ??

        teacher?.lesson_duration

      );

  }


  if (format) {

    format.textContent =
      formatLessonFormat(

        teacher?.lessonFormat ??

        teacher?.lesson_format

      );

  }

}


/* =========================================================
   RENDER RECITATION
========================================================= */

function renderRecitation(
  teacher
) {

  const title =
    $('ustazProfileRecitationTitle');

  const description =
    $('ustazProfileRecitationDescription');

  const audio =
    $('ustazProfileAudio');

  const audioEmpty =
    $('ustazProfileAudioEmpty');


  const recitationTitle =
    safeString(

      teacher?.recitationTitle ??

      teacher?.recitation_title

    );


  const recitationDescription =
    safeString(

      teacher?.recitationDescription ??

      teacher?.recitation_description

    );


  const audioUrl =
    resolveMediaUrl(
      getTeacherAudio(
        teacher
      )
    );


  if (title) {

    title.textContent =
      recitationTitle ||
      'Quran Recitation';

  }


  if (description) {

    description.textContent =
      recitationDescription ||
      'No recitation description has been provided.';

  }


  if (audio) {

    audio.pause();

    audio.hidden =
      true;

    audio.removeAttribute(
      'src'
    );

    audio.load();


    if (audioUrl) {

      audio.src =
        audioUrl;

      audio.hidden =
        false;

      if (audioEmpty) {

        audioEmpty.hidden =
          true;

      }

    } else {

      if (audioEmpty) {

        audioEmpty.hidden =
          false;

      }

    }

  }

}


/* =========================================================
   AVAILABILITY NORMALIZATION
========================================================= */

function getAvailabilityItems(
  availability
) {

  if (!availability) {
    return [];
  }


  /*
   * Array:
   * [
   *   {
   *     day: "Monday",
   *     start: "09:00",
   *     end: "12:00"
   *   }
   * ]
   */
  if (
    Array.isArray(
      availability
    )
  ) {

    return availability

      .map(
        item => {

          if (
            typeof item === 'string' ||
            typeof item === 'number'
          ) {

            return {

              day:
                '',

              text:
                String(item),

            };

          }


          if (
            !item ||
            typeof item !== 'object'
          ) {

            return null;

          }


          const day =
            safeString(

              item.day ??

              item.dayName ??

              item.day_name

            );


          const start =
            safeString(

              item.start ??

              item.startTime ??

              item.start_time

            );


          const end =
            safeString(

              item.end ??

              item.endTime ??

              item.end_time

            );


          const label =
            safeString(

              item.label ??

              item.time ??

              item.hours

            );


          let text =
            label;


          if (
            !text &&
            start &&
            end
          ) {

            text =
              `${start} – ${end}`;

          }


          if (!text) {

            text =
              safeString(

                item.available ??

                item.status

              );

          }


          return {

            day,
            text:
              text || 'Available',

          };

        }
      )

      .filter(Boolean);

  }


  /*
   * Object:
   * {
   *   monday: {
   *     start: "09:00",
   *     end: "12:00"
   *   }
   * }
   */
  if (
    typeof availability === 'object'
  ) {

    return Object.entries(
      availability
    )

      .map(
        ([day, value]) => {

          if (
            value === null ||
            value === undefined
          ) {

            return null;

          }


          if (
            typeof value === 'string' ||
            typeof value === 'number'
          ) {

            return {

              day:
                formatDayName(
                  day
                ),

              text:
                String(value),

            };

          }


          if (
            typeof value === 'object'
          ) {

            const start =
              safeString(

                value.start ??

                value.startTime ??

                value.start_time

              );


            const end =
              safeString(

                value.end ??

                value.endTime ??

                value.end_time

              );


            const label =
              safeString(

                value.label ??

                value.time ??

                value.hours

              );


            return {

              day:
                formatDayName(
                  day
                ),

              text:
                label ||

                (
                  start && end
                    ? `${start} – ${end}`
                    : 'Available'
                ),

            };

          }


          return null;

        }
      )

      .filter(Boolean);

  }


  return [];

}


function formatDayName(
  value
) {

  const text =
    safeString(
      value
    );


  if (!text) {
    return '';
  }


  return text
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, letter =>
      letter.toUpperCase()
    );

}


/* =========================================================
   RENDER AVAILABILITY
========================================================= */

function renderAvailability(
  teacher
) {

  const container =
    $('ustazProfileAvailability');


  if (!container) {
    return;
  }


  container.innerHTML =
    '';


  const availability =

    teacher?.availability ??

    teacher?.teacherAvailability ??

    teacher?.teacher_availability ??

    [];


  const items =
    getAvailabilityItems(
      availability
    );


  if (!items.length) {

    const empty =
      document.createElement(
        'div'
      );


    empty.className =
      'ustaz-profile-empty';


    empty.textContent =
      'No availability has been provided.';


    container.appendChild(
      empty
    );


    return;

  }


  items.forEach(
    item => {

      const row =
        document.createElement(
          'div'
        );


      row.className =
        'ustaz-profile-day';


      const day =
        document.createElement(
          'strong'
        );


      day.textContent =
        item.day ||
        'Schedule';


      const time =
        document.createElement(
          'span'
        );


      time.textContent =
        item.text;


      row.appendChild(
        day
      );


      row.appendChild(
        time
      );


      container.appendChild(
        row
      );

    }
  );

}


/* =========================================================
   SAVED TEACHER
========================================================= */

function getTeacherSavedId(
  teacher
) {

  /*
   * Match the identifier used by the Find Ustaz card first.
   */
  return (
    teacher?.id ??
    teacher?.userId ??
    teacher?.user_id ??
    teacher?.teacherProfileId ??
    teacher?.teacher_profile_id ??
    null
  );

}


function getSavedTeacherIds() {

  try {

    const raw =
      localStorage.getItem(
        USTAZ_PROFILE_CONFIG.SAVED_TEACHERS_KEY
      );


    const parsed =
      raw
        ? JSON.parse(raw)
        : [];


    return Array.isArray(
      parsed
    )

      ? parsed.map(
          value =>
            String(value)
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

    USTAZ_PROFILE_CONFIG.SAVED_TEACHERS_KEY,

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


function isTeacherSaved(
  teacher
) {

  const id =
    getTeacherSavedId(
      teacher
    );


  if (
    id === null ||
    id === undefined ||
    id === ''
  ) {

    return false;

  }


  return getSavedTeacherIds()
    .includes(
      String(id)
    );

}


function renderSaveButton(
  teacher
) {

  const button =
    $('ustazProfileSaveButton');

  const text =
    $('ustazProfileSaveText');


  if (!button) {
    return;
  }


  const icon =
    button.querySelector(
      'i'
    );


  const saved =
    isTeacherSaved(
      teacher
    );


  button.classList.toggle(
    'is-saved',
    saved
  );


  button.setAttribute(
    'aria-label',
    saved
      ? 'Remove Ustaz from saved teachers'
      : 'Save this Ustaz'
  );


  if (text) {

    text.textContent =
      saved
        ? 'Saved Ustaz'
        : 'Save Ustaz';

  }


  if (icon) {

    icon.className =
      saved
        ? 'fa-solid fa-bookmark'
        : 'fa-regular fa-bookmark';

  }

}


function toggleTeacherSaved(
  teacher
) {

  const id =
    getTeacherSavedId(
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


  const ids =
    getSavedTeacherIds();


  const index =
    ids.indexOf(
      normalizedId
    );


  if (index >= 0) {

    ids.splice(
      index,
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


  renderSaveButton(
    teacher
  );

}


/* =========================================================
   THEME
========================================================= */

function getInitialTheme() {

  const stored =
    localStorage.getItem(
      USTAZ_PROFILE_CONFIG.THEME_KEY
    );


  if (
    stored === 'dark' ||
    stored === 'light'
  ) {

    return stored;

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


function updateThemeButton() {

  const button =
    $('ustazThemeToggle');


  if (!button) {
    return;
  }


  const dark =
    document.body.classList.contains(
      'dark-theme'
    );


  const icon =
    button.querySelector(
      'i'
    );


  if (icon) {

    icon.className =
      dark
        ? 'fa-solid fa-sun'
        : 'fa-solid fa-moon';

  }


  button.setAttribute(
    'aria-label',
    dark
      ? 'Switch to light theme'
      : 'Switch to dark theme'
  );


  const meta =
    $('themeColorMeta');


  if (meta) {

    meta.setAttribute(
      'content',
      dark
        ? '#17130F'
        : '#FBF7EE'
    );

  }

}


function applyTheme(
  theme
) {

  const dark =
    theme === 'dark';


  document.body.classList.toggle(
    'dark-theme',
    dark
  );


  localStorage.setItem(
    USTAZ_PROFILE_CONFIG.THEME_KEY,
    dark
      ? 'dark'
      : 'light'
  );


  updateThemeButton();

}


/* =========================================================
   NAVIGATION
========================================================= */

function setupBackButton() {

  const button =
    $('ustazBackButton');


  if (!button) {
    return;
  }


  button.addEventListener(
    'click',
    () => {

      window.location.href =
        './student.html#teachers';

    }
  );

}


function setupTheme() {

  applyTheme(
    getInitialTheme()
  );


  const button =
    $('ustazThemeToggle');


  if (!button) {
    return;
  }


  button.addEventListener(
    'click',
    () => {

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
  );

}


/* =========================================================
   SAVE BUTTON SETUP
========================================================= */

function setupSaveButton(
  teacher
) {

  const button =
    $('ustazProfileSaveButton');


  if (!button) {
    return;
  }


  renderSaveButton(
    teacher
  );


  button.addEventListener(
    'click',
    () => {

      toggleTeacherSaved(
        teacher
      );

    }
  );

}


/* =========================================================
   RENDER EVERYTHING
========================================================= */
function renderTeacherProfile(
  teacher
) {

  const name =
    getTeacherName(
      teacher
    );


  document.title =
    `${name} — BarakaLink`;


  renderIdentity(
    teacher
  );


  renderBadges(
    teacher
  );


  renderStudyFields(
    teacher
  );


  renderMainStats(
    teacher
  );


  renderAbout(
    teacher
  );


  renderTeachingApproach(
    teacher
  );


  renderLanguages(
    teacher
  );


  renderLessonDetails(
    teacher
  );


  renderRecitation(
    teacher
  );


  renderAvailability(
    teacher
  );


  setupSaveButton(
    teacher
  );


  /*
   * Initialize parent → Ustaz messaging.
   *
   * IMPORTANT:
   * This must use the Ustaz's users.id,
   * not teacher_profiles.id.
   */
  setupUstazChatButton(
    teacher
  );

}
/* =========================================================
   LOAD PROFILE
========================================================= */

async function loadPublicProfile(
  requestedId
) {

  showLoading();


  try {

    if (!requestedId) {

      throw new Error(
        'No Ustaz profile was specified.'
      );

    }


    const teachers =
      await loadTeachers();


    const teacher =
      teachers.find(
        item =>
          teacherMatchesId(
            item,
            requestedId
          )
      );


    if (!teacher) {

      throw new Error(
        'This Ustaz profile could not be found.'
      );

    }


    renderTeacherProfile(
      teacher
    );


    hideLoading();

    showProfileContent();


  } catch (error) {

    console.error(
      '[view-ustaz-profile.js] Profile loading failed:',
      error
    );


    showError(
      error?.message ||
      'Unable to load this Ustaz profile.'
    );

  }

}


/* =========================================================
   RETRY
========================================================= */

function setupRetry() {

  const button =
    $('ustazProfileRetry');


  if (!button) {
    return;
  }


  button.addEventListener(
    'click',
    () => {

      const id =
        getRequestedTeacherId();


      loadPublicProfile(
        id
      );

    }
  );

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
   DOM READY
========================================================= */

document.addEventListener(
  'DOMContentLoaded',
  () => {

    setupTheme();

    setupBackButton();

    setupRetry();


    const requestedTeacherId =
      getRequestedTeacherId();


    loadPublicProfile(
      requestedTeacherId
    );

  }
);