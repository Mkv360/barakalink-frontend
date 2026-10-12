'use strict';

/* =========================================================
   BARAKALINK
   START LEARNING
   Parent learning request flow

   Responsibilities:
   - Read teacherProfileId from URL
   - Load selected Ustaz
   - Load parent's learners
   - Render teacher + study fields + learners
   - Request BarakaLink-approved quote
   - Show regulated pricing
   - Submit learning request
   - Theme handling
   - Back / retry handling

   Existing backend endpoints:
   GET  /api/teachers
   GET  /api/learners
   POST /api/learning/quote
   POST /api/learning/requests
========================================================= */


/* =========================================================
   CONFIGURATION
========================================================= */

const START_LEARNING_CONFIG = Object.freeze({

  API_BASE:
    String(
      window.BARAKALINK_API_BASE ||
      'http://localhost:5000/api'
    ).replace(/\/+$/, ''),

  TEACHERS_ENDPOINT:
    window.BARAKALINK_TEACHERS_ENDPOINT ||
    '/teachers',

  LEARNERS_ENDPOINT:
    '/learners',

  QUOTE_ENDPOINT:
    '/learning/quote',

  REQUESTS_ENDPOINT:
    '/learning/requests',

  THEME_KEY:
    'barakalink_theme',

});


/* =========================================================
   DOM
========================================================= */

const $ =
  (id) =>
    document.getElementById(id);


/* =========================================================
   STATE
========================================================= */

const state = {

  teacher: null,

  teacherProfileId: null,

  learners: [],

  selectedLearnerIds: [],

  quote: null,

  loadingQuote: false,

  submitting: false,

};


/* =========================================================
   HELPERS
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


function capitalizeWords(
  value
) {

  const text =
    safeString(value);

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
   STUDY FIELD MAP
========================================================= */

const STUDY_FIELD_IDS =
  Object.freeze({

    'quran-basic': 1,
    'quran_basic': 1,

    tajweed: 2,

    hifz: 3,

    tafseer: 4,

    hadith: 5,

    tarbiyah: 6,

  });


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


function getStudyFieldId(
  value
) {

  const numeric =
    Number(value);

  if (
    Number.isInteger(numeric) &&
    numeric > 0
  ) {
    return numeric;
  }

  const key =
    safeString(
      value
    ).toLowerCase();

  return (
    STUDY_FIELD_IDS[key] ||
    null
  );

}


function getStudyFieldLabel(
  value
) {

  const numeric =
    Number(value);

  if (
    Number.isInteger(numeric)
  ) {

    const found =
      Object.entries(
        STUDY_FIELD_IDS
      ).find(
        ([, id]) =>
          id === numeric
      );

    if (found) {

      return (
        STUDY_FIELD_LABELS[
          found[0]
        ] ||
        capitalizeWords(
          found[0]
        )
      );

    }

  }

  const key =
    safeString(
      value
    ).toLowerCase();

  return (
    STUDY_FIELD_LABELS[key] ||
    capitalizeWords(
      key.replace(
        /[_-]+/g,
        ' '
      )
    ) ||
    'Study field'
  );

}


/* =========================================================
   AUTH
========================================================= */

function getAuthToken() {

  if (
    window.BarakaLinkAPI &&
    typeof window.BarakaLinkAPI.getToken ===
      'function'
  ) {

    const sharedToken =
      window.BarakaLinkAPI.getToken();

    if (sharedToken) {
      return sharedToken;
    }

  }

  return (
    localStorage.getItem(
      'barakalink_token'
    ) ||
    localStorage.getItem(
      'token'
    ) ||
    null
  );

}


function clearSession() {

  localStorage.removeItem(
    'barakalink_token'
  );

  localStorage.removeItem(
    'token'
  );

  localStorage.removeItem(
    'barakalink_user'
  );

}


function redirectToLogin() {

  clearSession();

  window.location.href =
    '../index.html';

}


/* =========================================================
   API
========================================================= */

async function apiRequest(
  path,
  options = {}
) {

  const token =
    getAuthToken();

  if (!token) {

    const error =
      new Error(
        'Authentication token is missing.'
      );

    error.code =
      'NO_TOKEN';

    throw error;

  }


  const cleanPath =
    String(
      path || ''
    ).startsWith('/')
      ? String(path)
      : `/${String(path)}`;


  const url =
    `${START_LEARNING_CONFIG.API_BASE}${cleanPath}`;


  const headers = {

    Accept:
      'application/json',

    ...(options.headers || {}),

    Authorization:
      `Bearer ${token}`,

  };


  if (
    options.body !== undefined &&
    options.body !== null &&
    !headers['Content-Type']
  ) {

    headers['Content-Type'] =
      'application/json';

  }


  let response;

  try {

    response =
      await fetch(
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

    networkError.code =
      'NETWORK_ERROR';

    networkError.originalError =
      error;

    throw networkError;

  }


  let payload =
    null;

  try {

    payload =
      await response.json();

  } catch {

    payload =
      null;

  }


  if (
    response.status === 401
  ) {

    const error =
      new Error(
        payload?.message ||
        'Your session has expired.'
      );

    error.code =
      'UNAUTHORIZED';

    error.status =
      401;

    error.payload =
      payload;

    throw error;

  }


  if (!response.ok) {

    const error =
      new Error(
        payload?.message ||
        payload?.error ||
        `Request failed with status ${response.status}.`
      );

    error.status =
      response.status;

    error.payload =
      payload;

    throw error;

  }


  return payload;

}


/* =========================================================
   URL
========================================================= */

function getRequestedTeacherProfileId() {

  const params =
    new URLSearchParams(
      window.location.search
    );

  const value =
    params.get(
      'teacherProfileId'
    );

  const id =
    Number(value);

  if (
    Number.isInteger(id) &&
    id > 0
  ) {

    return id;

  }

  return null;

}


/* =========================================================
   MEDIA
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
      `${START_LEARNING_CONFIG.API_BASE}/`
    ).href;

  } catch {

    return raw;

  }

}


/* =========================================================
   TEACHER ACCESSORS
========================================================= */

function getTeacherName(
  teacher
) {

  return (
    safeString(
      teacher?.name
    ) ||
    [
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
      .join(' ') ||
    'Ustaz'
  );

}


function getTeacherProfileId(
  teacher
) {

  const candidates = [

    teacher?.teacherProfileId,

    teacher?.teacher_profile_id,

    teacher?.profileId,

    teacher?.profile_id,

  ];


  for (
    const value of candidates
  ) {

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


function getTeacherLocation(
  teacher
) {

  const area =
    safeString(

      teacher?.area ??
      teacher?.area_name

    );

  const subcity =
    safeString(

      teacher?.subcity ??
      teacher?.subcity_name

    );

  return [
    area,
    subcity,
  ]
    .filter(Boolean)
    .map(
      value =>
        capitalizeWords(value)
    )
    .join(', ');

}


function getTeacherStudyFields(
  teacher
) {

  const source =

    teacher?.studyFields ??

    teacher?.study_fields ??

    teacher?.fields ??

    [];


  if (!Array.isArray(source)) {

    return [];

  }


  return source

    .map(
      item => {

        if (
          item &&
          typeof item ===
            'object'
        ) {

          const id =
            getStudyFieldId(
              item.id ??
              item.studyFieldId ??
              item.study_field_id ??
              item.slug ??
              item.code ??
              item.name
            );

          if (!id) {
            return null;
          }

          return {

            id,

            slug:
              safeString(
                item.slug
              ),

            name:
              safeString(
                item.name
              ) ||
              getStudyFieldLabel(id),

          };

        }


        const id =
          getStudyFieldId(
            item
          );

        if (!id) {
          return null;
        }

        return {

          id,

          slug:
            safeString(
              item
            ),

          name:
            getStudyFieldLabel(
              item
            ),

        };

      }
    )

    .filter(Boolean)

    .filter(
      (
        item,
        index,
        array
      ) =>
        array.findIndex(
          candidate =>
            candidate.id ===
            item.id
        ) === index
    );

}


/* =========================================================
   TEACHER MATCHING
========================================================= */

function teacherMatchesProfileId(
  teacher,
  requestedId
) {

  const values = [

    teacher?.teacherProfileId,

    teacher?.teacher_profile_id,

    teacher?.profileId,

    teacher?.profile_id,

    teacher?.id,

  ];


  return values.some(
    value =>
      Number(value) ===
      Number(requestedId)
  );

}


/* =========================================================
   LOAD TEACHER
========================================================= */

async function loadTeacher() {

  const requestedId =
    getRequestedTeacherProfileId();


  if (!requestedId) {

    throw new Error(
      'No Ustaz profile was specified.'
    );

  }


  const payload =
    await apiRequest(
      START_LEARNING_CONFIG.TEACHERS_ENDPOINT
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


  const teacher =
    teachers.find(
      item =>
        teacherMatchesProfileId(
          item,
          requestedId
        )
    );


  if (!teacher) {

    throw new Error(
      'This Ustaz could not be found.'
    );

  }


  const actualProfileId =
    getTeacherProfileId(
      teacher
    ) ||
    requestedId;


  state.teacher =
    teacher;

  state.teacherProfileId =
    actualProfileId;


  return teacher;

}


/* =========================================================
   LOAD LEARNERS
========================================================= */

async function loadLearners() {

  const payload =
    await apiRequest(
      START_LEARNING_CONFIG.LEARNERS_ENDPOINT
    );


  const data =
    payload?.data ??
    payload ??
    [];


  let learners = [];


  if (
    Array.isArray(data)
  ) {

    learners =
      data;

  } else if (
    Array.isArray(
      data.learners
    )
  ) {

    learners =
      data.learners;

  } else if (
    Array.isArray(
      data.students
    )
  ) {

    learners =
      data.students;

  }


  state.learners =
    learners.filter(
      learner =>
        learner &&
        (
          learner.isActive ===
            true ||
          learner.is_active ===
            1 ||
          Number(
            learner.isActive ??
            learner.is_active ??
            0
          ) === 1
        )
    );


  return state.learners;

}


/* =========================================================
   LOADING / ERROR STATES
========================================================= */

function showLoading() {

  const loading =
    $('startLearningLoading');

  const error =
    $('startLearningError');

  const content =
    $('startLearningContent');


  if (loading) {
    loading.hidden =
      false;
  }


  if (error) {
    error.hidden =
      true;
  }


  if (content) {
    content.hidden =
      true;
  }

}


function hideLoading() {

  const loading =
    $('startLearningLoading');

  if (loading) {
    loading.hidden =
      true;
  }

}


function showContent() {

  const content =
    $('startLearningContent');

  if (content) {
    content.hidden =
      false;
  }

}


function showError(
  message
) {

  const loading =
    $('startLearningLoading');

  const error =
    $('startLearningError');

  const content =
    $('startLearningContent');

  const messageElement =
    $('startLearningErrorMessage');


  if (loading) {
    loading.hidden =
      true;
  }


  if (content) {
    content.hidden =
      true;
  }


  if (messageElement) {

    messageElement.textContent =
      safeString(
        message,
        'The learning request could not be prepared.'
      );

  }


  if (error) {
    error.hidden =
      false;
  }

}


/* =========================================================
   RENDER TEACHER
========================================================= */

function getTeacherInitials(
  teacher
) {

  const name =
    getTeacherName(
      teacher
    );

  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(
      part =>
        part.charAt(0)
          .toUpperCase()
    )
    .join('') || 'U';

}


function renderTeacher() {

  const teacher =
    state.teacher;

  if (!teacher) {
    return;
  }


  const name =
    getTeacherName(
      teacher
    );

  const location =
    getTeacherLocation(
      teacher
    );

  const avatar =
    resolveMediaUrl(
      getTeacherAvatar(
        teacher
      )
    );

  const fields =
    getTeacherStudyFields(
      teacher
    );


  const nameElement =
    $('startLearningTeacherName');

  const locationElement =
    $('startLearningTeacherLocation');

  const initialsElement =
    $('startLearningTeacherInitials');

  const imageElement =
    $('startLearningTeacherImage');

  const fieldsContainer =
    $('startLearningTeacherFields');


  if (nameElement) {

    nameElement.textContent =
      name;

  }


  if (locationElement) {

    locationElement.textContent =
      location ||
      'Location not available';

  }


  if (initialsElement) {

    initialsElement.textContent =
      getTeacherInitials(
        teacher
      );

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


  if (fieldsContainer) {

    fieldsContainer.innerHTML =
      fields
        .map(
          field =>
            `
              <span
                class="start-learning-teacher-field"
              >
                ${escapeHtml(
                  field.name
                )}
              </span>
            `
        )
        .join('');

  }


  document.title =
    `${name} — Start Learning | BarakaLink`;

}


/* =========================================================
   RENDER STUDY FIELDS
========================================================= */

function renderStudyFieldOptions() {

  const select =
    $('startLearningStudyField');

  if (!select) {
    return;
  }


  const fields =
    getTeacherStudyFields(
      state.teacher
    );


  select.innerHTML = `
    <option value="">
      Select a study field
    </option>
  `;


  fields.forEach(
    field => {

      const option =
        document.createElement(
          'option'
        );

      option.value =
        String(field.id);

      option.textContent =
        field.name;

      select.appendChild(
        option
      );

    }
  );


  if (
    fields.length ===
    1
  ) {

    select.value =
      String(
        fields[0].id
      );

  }

}


/* =========================================================
   RENDER LEARNERS
========================================================= */

function getLearnerName(
  learner
) {

  return (
    [
      safeString(
        learner?.firstName ??
        learner?.first_name
      ),
      safeString(
        learner?.lastName ??
        learner?.last_name
      ),
    ]
      .filter(Boolean)
      .join(' ') ||
    'Learner'
  );

}


function getLearnerId(
  learner
) {

  const id =
    Number(
      learner?.id
    );

  return (
    Number.isInteger(id) &&
    id > 0
      ? id
      : null
  );

}


function renderLearners() {

  const container =
    $('startLearningLearners');

  if (!container) {
    return;
  }


  container.innerHTML =
    '';


  state.selectedLearnerIds =
    [];


  if (
    !state.learners.length
  ) {

    container.innerHTML = `
      <div class="start-learning-learners-empty">

        <i
          class="fa-solid fa-user-plus"
          aria-hidden="true"
        ></i>

        <p>
          You do not have any active learners yet.
        </p>

        <a
          href="./student.html#profile"
          class="start-learning-add-learner"
        >
          Add a learner from your profile
        </a>

      </div>
    `;

    return;

  }


  state.learners.forEach(
    learner => {

      const id =
        getLearnerId(
          learner
        );

      if (!id) {
        return;
      }


      const name =
        getLearnerName(
          learner
        );


      const label =
        document.createElement(
          'label'
        );

      label.className =
        'start-learning-learner-option';


      label.innerHTML = `
        <input
          type="checkbox"
          name="learnerIds"
          value="${escapeHtml(id)}"
        >

        <span class="start-learning-learner-check">
          <i
            class="fa-solid fa-check"
            aria-hidden="true"
          ></i>
        </span>

        <span class="start-learning-learner-info">

          <strong>
            ${escapeHtml(name)}
          </strong>

        </span>
      `;


      const checkbox =
        label.querySelector(
          'input'
        );


      checkbox.addEventListener(
        'change',
        () => {

          updateSelectedLearners();

          state.quote =
            null;

          scheduleQuote();

        }
      );


      container.appendChild(
        label
      );

    }
  );

}


/* =========================================================
   SELECTED LEARNERS
========================================================= */

function updateSelectedLearners() {

  state.selectedLearnerIds =
    Array.from(
      document.querySelectorAll(
        '#startLearningLearners input[name="learnerIds"]:checked'
      )
    )
      .map(
        input =>
          Number(input.value)
      )
      .filter(
        Number.isInteger
      );

}


/* =========================================================
   FORM VALUES
========================================================= */

function getSelectedStudyFieldId() {

  const select =
    $('startLearningStudyField');

  return (
    Number(
      select?.value
    ) || null
  );

}


function getSelectedDuration() {

  const select =
    $('startLearningDuration');

  return (
    Number(
      select?.value
    ) || null
  );

}


function getSelectedLessonMode() {

  const checked =
    document.querySelector(
      'input[name="lessonMode"]:checked'
    );

  return (
    checked?.value ===
    'shared'
      ? 'shared'
      : 'individual'
  );

}


function getSelectedLessonsPerWeek() {

  const select =
    $('startLearningLessonsPerWeek');

  return (
    Number(
      select?.value
    ) || null
  );

}


function getParentMessage() {

  return safeString(
    $('startLearningMessage')?.value
  );

}


/* =========================================================
   QUOTE INPUT
========================================================= */

function getQuoteInput() {

  updateSelectedLearners();


  return {

    teacherProfileId:
      state.teacherProfileId,

    studyFieldId:
      getSelectedStudyFieldId(),

    durationMinutes:
      getSelectedDuration(),

    learnerIds:
      [...state.selectedLearnerIds],

    lessonMode:
      getSelectedLessonMode(),

    lessonsPerWeek:
      getSelectedLessonsPerWeek(),

  };

}


function isQuoteInputComplete(
  input
) {

  return Boolean(

    Number.isInteger(
      input.teacherProfileId
    ) &&

    input.teacherProfileId > 0 &&

    Number.isInteger(
      input.studyFieldId
    ) &&

    input.studyFieldId > 0 &&

    Number.isInteger(
      input.durationMinutes
    ) &&

    input.durationMinutes > 0 &&

    Array.isArray(
      input.learnerIds
    ) &&

    input.learnerIds.length > 0 &&

    (
      input.lessonMode ===
        'individual' ||
      input.lessonMode ===
        'shared'
    ) &&

    Number.isInteger(
      input.lessonsPerWeek
    ) &&

    input.lessonsPerWeek > 0

  );

}


/* =========================================================
   PRICE DISPLAY
========================================================= */

function formatMoney(
  value,
  currency = 'ETB'
) {

  const amount =
    Number(value);

  if (
    !Number.isFinite(
      amount
    )
  ) {

    return '—';

  }


  return (
    `${amount.toLocaleString(
      'en-US',
      {
        minimumFractionDigits:
          amount % 1 === 0
            ? 0
            : 2,

        maximumFractionDigits:
          2,
      }
    )} ${currency}`
  );

}


/* =========================================================
   QUOTE EMPTY STATE
========================================================= */

function renderEmptyPrice() {

  const empty =
    $('startLearningPriceEmpty');

  const result =
    $('startLearningPriceResult');


  if (empty) {
    empty.hidden =
      false;
  }

  if (result) {
    result.hidden =
      true;
  }


  setText(
    'startLearningApprovedTariff',
    '—'
  );

  setText(
    'startLearningLessonAmount',
    '—'
  );

  setText(
    'startLearningWeeklyAmount',
    '—'
  );

  setText(
    'startLearningFourWeekAmount',
    '—'
  );

}


/* =========================================================
   QUOTE LOADING STATE
========================================================= */

function showQuoteLoading() {

  state.loadingQuote =
    true;


  const empty =
    $('startLearningPriceEmpty');

  const result =
    $('startLearningPriceResult');


  if (result) {

    result.hidden =
      true;

  }


  if (empty) {

    empty.hidden =
      false;

    empty.innerHTML = `
      <i
        class="fa-solid fa-calculator"
        aria-hidden="true"
      ></i>

      <p>
        Calculating the BarakaLink-approved price...
      </p>
    `;

  }


  updateSubmitButton();

}


function hideQuoteLoading() {

  state.loadingQuote =
    false;

  updateSubmitButton();

}


/* =========================================================
   QUOTE RESULT
========================================================= */

function renderQuote(
  quote
) {

  const empty =
    $('startLearningPriceEmpty');

  const result =
    $('startLearningPriceResult');


  /*
   * Backend response shape:
   *
   * data: {
   *   tariff: {
   *     approvedTariffPerHour,
   *     currency
   *   },
   *   calculation: {
   *     lessonAmount,
   *     weeklyAmount,
   *     fourWeekAmount
   *   }
   * }
   *
   * Support the existing flat shape too.
   */

  const tariff =
    quote?.tariff ||
    {};

  const calculation =
    quote?.calculation ||
    {};


  const approvedTariff =
    quote?.approvedTariffPerHour ??
    quote?.approved_tariff_per_hour ??
    tariff.approvedTariffPerHour ??
    tariff.approved_tariff_per_hour;


  const lessonAmount =
    quote?.lessonAmount ??
    quote?.lesson_amount ??
    calculation.lessonAmount ??
    calculation.lesson_amount;


  const weeklyAmount =
    quote?.weeklyAmount ??
    quote?.weekly_amount ??
    calculation.weeklyAmount ??
    calculation.weekly_amount;


  const fourWeekAmount =
    quote?.fourWeekAmount ??
    quote?.four_week_amount ??
    calculation.fourWeekAmount ??
    calculation.four_week_amount;


  const currency =
    quote?.currency ||
    tariff.currency ||
    'ETB';


  setText(
    'startLearningApprovedTariff',
    formatMoney(
      approvedTariff,
      currency
    ) + ' / hr'
  );


  setText(
    'startLearningLessonAmount',
    formatMoney(
      lessonAmount,
      currency
    )
  );


  setText(
    'startLearningWeeklyAmount',
    formatMoney(
      weeklyAmount,
      currency
    )
  );


  setText(
    'startLearningFourWeekAmount',
    formatMoney(
      fourWeekAmount,
      currency
    )
  );


  /*
   * IMPORTANT:
   * Hide the "Calculating..." state immediately
   * after a successful response.
   */
  if (empty) {

    empty.hidden =
      true;

  }


  if (result) {

    result.hidden =
      false;

  }


  updateSubmitButton();

}


/*
 * Alias kept intentionally so the quote request
 * can use a semantically explicit render function.
 */
function renderQuoteResult(
  quote
) {

  renderQuote(
    quote
  );

}


/* =========================================================
   QUOTE ERROR
========================================================= */

function renderQuoteError(
  message
) {

  const empty =
    $('startLearningPriceEmpty');

  const result =
    $('startLearningPriceResult');


  if (result) {

    result.hidden =
      true;

  }


  if (empty) {

    empty.hidden =
      false;

    empty.innerHTML = `
      <i
        class="fa-solid fa-circle-exclamation"
        aria-hidden="true"
      ></i>

      <p>
        ${escapeHtml(
          safeString(
            message,
            'No approved tariff is available for these selections.'
          )
        )}
      </p>
    `;

  }


  state.quote =
    null;

  updateSubmitButton();

}


function showQuoteError(
  message
) {

  renderQuoteError(
    message
  );

}


/* =========================================================
   QUOTE RESULT RESET
========================================================= */

function hideQuoteResult() {

  state.quote =
    null;

  renderEmptyPrice();

  updateSubmitButton();

}


/* =========================================================
   TEXT HELPER
========================================================= */

function setText(
  id,
  value
) {

  const element =
    $(id);

  if (element) {
    element.textContent =
      value;
  }

}


/* =========================================================
   QUOTE REQUEST STATE
========================================================= */

let quoteTimer =
  null;

let quoteRequestSequence =
  0;


/* =========================================================
   SCHEDULE QUOTE
========================================================= */

function scheduleQuote() {

  if (quoteTimer) {

    clearTimeout(
      quoteTimer
    );

    quoteTimer =
      null;

  }


  /*
   * Invalidate any request that is already running.
   * This prevents an old quote from overwriting a new
   * selection if the user changes the form quickly.
   */
  quoteRequestSequence += 1;

  const scheduledSequence =
    quoteRequestSequence;


  quoteTimer =
    setTimeout(
      () => {

        quoteTimer =
          null;

        requestQuote(
          scheduledSequence
        );

      },
      150
    );

}


/* =========================================================
   REQUEST QUOTE
========================================================= */

async function requestQuote(
  sequence = null
) {

  /*
   * Direct calls create a new request sequence.
   * Scheduled calls already have their sequence.
   */
  const requestSequence =
    sequence === null
      ? ++quoteRequestSequence
      : sequence;


  const input =
    getQuoteInput();


  /*
   * Do not call the server until the form
   * contains everything required for a quote.
   */
  if (
    !isQuoteInputComplete(
      input
    )
  ) {

    if (
      requestSequence ===
      quoteRequestSequence
    ) {

      hideQuoteResult();

    }

    return;

  }


  /*
   * Show loading immediately.
   */
  showQuoteLoading();


  try {

    const payload =
      await apiRequest(
        START_LEARNING_CONFIG.QUOTE_ENDPOINT,
        {
          method:
            'POST',

          body:
            JSON.stringify(
              input
            ),

        }
      );


    /*
     * Ignore an older response if the user has
     * already changed the form.
     */
    if (
      requestSequence !==
      quoteRequestSequence
    ) {

      return;

    }


    const quoteData =
      payload?.data ??
      payload ??
      null;


    if (!quoteData) {

      throw new Error(
        'The quote response was empty.'
      );

    }


    /*
     * Store the complete backend quote.
     */
    state.quote =
      quoteData;


    /*
     * Render immediately.
     *
     * This changes the UI from:
     * "Calculating..."
     *
     * to the actual tariff and amounts.
     */
    renderQuoteResult(
      quoteData
    );


  } catch (error) {

    /*
     * Ignore stale request errors.
     */
    if (
      requestSequence !==
      quoteRequestSequence
    ) {

      return;

    }


    console.error(
      '[start-learning.js] Quote failed:',
      error
    );


    showQuoteError(
      error?.message ||
      'Unable to calculate the approved lesson price.'
    );


  } finally {

    /*
     * Only the newest request is allowed to
     * clear the loading state.
     */
    if (
      requestSequence ===
      quoteRequestSequence
    ) {

      hideQuoteLoading();

    }

  }

}


/* =========================================================
   SUBMIT BUTTON
========================================================= */

function updateSubmitButton() {

  const button =
    $('startLearningSubmitButton');

  if (!button) {
    return;
  }


  const hasQuote =
    Boolean(
      state.quote
    );


  const complete =
    isQuoteInputComplete(
      getQuoteInput()
    );


  button.disabled =
    state.submitting ||
    state.loadingQuote ||
    !complete ||
    !hasQuote;


  button.setAttribute(
    'aria-disabled',
    button.disabled
      ? 'true'
      : 'false'
  );

}


function setSubmitButtonLoading(
  loading
) {

  const button =
    $('startLearningSubmitButton');

  if (!button) {
    return;
  }


  const icon =
    button.querySelector(
      'i'
    );

  const text =
    button.querySelector(
      'span'
    );


  if (loading) {

    if (icon) {

      icon.className =
        'fa-solid fa-spinner fa-spin';

    }

    if (text) {

      text.textContent =
        'Sending request...';

    }

  } else {

    if (icon) {

      icon.className =
        'fa-solid fa-paper-plane';

    }

    if (text) {

      text.textContent =
        'Send Learning Request';

    }

  }

}


/* =========================================================
   SUBMIT REQUEST
========================================================= */

async function submitLearningRequest() {

  if (
    state.submitting
  ) {

    return;

  }


  updateSelectedLearners();


  const input =
    getQuoteInput();


  if (
    !isQuoteInputComplete(
      input
    )
  ) {

    return;

  }


  /*
   * A quote must exist before the parent can submit.
   */
  if (
    !state.quote
  ) {

    await requestQuote();

    if (
      !state.quote
    ) {

      return;

    }

  }


  state.submitting =
    true;


  setSubmitButtonLoading(
    true
  );

  updateSubmitButton();


  try {

    const payload =
      await apiRequest(
        START_LEARNING_CONFIG.REQUESTS_ENDPOINT,
        {
          method:
            'POST',

          body:
            JSON.stringify({

              ...input,

              parentMessage:
                getParentMessage(),

            }),

        }
      );


    const data =
      payload?.data ??
      payload ??
      {};


    const requestId =
      data?.id ??
      data?.requestId ??
      data?.learningRequestId;


    /*
     * The backend request was successfully created.
     */
    showSuccessState(
      requestId
    );

  } catch (error) {

    console.error(
      '[start-learning.js] Learning request submission failed:',
      error
    );


    showSubmitError(
      error?.message ||
      'We could not send your learning request.'
    );

  } finally {

    state.submitting =
      false;

    setSubmitButtonLoading(
      false
    );

    updateSubmitButton();

  }

}


/* =========================================================
   SUCCESS STATE
========================================================= */

function showSuccessState(
  requestId
) {

  const content =
    $('startLearningContent');

  if (!content) {
    return;
  }


  const requestText =
    requestId
      ? `Request #${requestId}`
      : 'Your learning request';


  content.innerHTML = `
    <section
      class="start-learning-success"
      aria-live="polite"
    >

      <div class="start-learning-success-icon">

        <i
          class="fa-solid fa-check"
          aria-hidden="true"
        ></i>

      </div>

      <span class="start-learning-eyebrow">
        Request sent
      </span>

      <h1>
        Your learning request has been sent
      </h1>

      <p>
        ${escapeHtml(
          requestText
        )}
        is now waiting for the Ustaz to respond.
      </p>

      <div class="start-learning-success-actions">

        <button
          type="button"
          class="start-learning-success-primary"
          id="startLearningViewLearningButton"
        >

          <i
            class="fa-solid fa-book-open-reader"
            aria-hidden="true"
          ></i>

          <span>
            View My Learning
          </span>

        </button>


        <button
          type="button"
          class="start-learning-success-secondary"
          id="startLearningBackToTeachersButton"
        >

          <i
            class="fa-solid fa-arrow-left"
            aria-hidden="true"
          ></i>

          <span>
            Find Another Ustaz
          </span>

        </button>

      </div>

    </section>
  `;


  const learningButton =
    $('startLearningViewLearningButton');

  const teachersButton =
    $('startLearningBackToTeachersButton');


  if (learningButton) {

    learningButton.addEventListener(
      'click',
      () => {

        window.location.href =
          './student.html#learning';

      }
    );

  }


  if (teachersButton) {

    teachersButton.addEventListener(
      'click',
      () => {

        window.location.href =
          './student.html#teachers';

      }
    );

  }

}


/* =========================================================
   SUBMIT ERROR
========================================================= */

function showSubmitError(
  message
) {

  const submitSection =
    document.querySelector(
      '.start-learning-submit-section'
    );

  if (!submitSection) {
    return;
  }


  let errorElement =
    $('startLearningSubmitError');


  if (!errorElement) {

    errorElement =
      document.createElement(
        'div'
      );

    errorElement.id =
      'startLearningSubmitError';

    errorElement.className =
      'start-learning-submit-error';

    submitSection.prepend(
      errorElement
    );

  }


  errorElement.innerHTML = `
    <i
      class="fa-solid fa-circle-exclamation"
      aria-hidden="true"
    ></i>

    <span>
      ${escapeHtml(
        safeString(
          message,
          'We could not send your learning request.'
        )
      )}
    </span>
  `;

}


/* =========================================================
   FORM EVENTS
========================================================= */

function setupFormEvents() {

  const studyField =
    $('startLearningStudyField');

  const duration =
    $('startLearningDuration');

  const lessonsPerWeek =
    $('startLearningLessonsPerWeek');

  const message =
    $('startLearningMessage');

  const submit =
    $('startLearningSubmitButton');


  if (studyField) {

    studyField.addEventListener(
      'change',
      () => {

        state.quote =
          null;

        scheduleQuote();

      }
    );

  }


  if (duration) {

    duration.addEventListener(
      'change',
      () => {

        state.quote =
          null;

        scheduleQuote();

      }
    );

  }


  if (lessonsPerWeek) {

    lessonsPerWeek.addEventListener(
      'change',
      () => {

        state.quote =
          null;

        scheduleQuote();

      }
    );

  }


  document
    .querySelectorAll(
      'input[name="lessonMode"]'
    )
    .forEach(
      input => {

        input.addEventListener(
          'change',
          () => {

            state.quote =
              null;

            scheduleQuote();

          }
        );

      }
    );


  if (message) {

    message.addEventListener(
      'input',
      () => {

        /*
         * Message does not affect the quote.
         * No request is needed here.
         */

      }
    );

  }


  if (submit) {

    submit.addEventListener(
      'click',
      submitLearningRequest
    );

  }

}


/* =========================================================
   BACK BUTTON
========================================================= */

function setupBackButton() {

  const button =
    $('startLearningBackButton');

  if (!button) {
    return;
  }


  button.addEventListener(
    'click',
    () => {

      const teacherProfileId =
        state.teacherProfileId ||
        getRequestedTeacherProfileId();


      if (teacherProfileId) {

        window.location.href =
          `./view-ustaz-profile.html?id=${encodeURIComponent(
            teacherProfileId
          )}`;

        return;

      }


      window.location.href =
        './student.html#teachers';

    }
  );

}


/* =========================================================
   RETRY
========================================================= */

function setupRetry() {

  const button =
    $('startLearningRetry');

  if (!button) {
    return;
  }


  button.addEventListener(
    'click',
    initializeStartLearning
  );

}


/* =========================================================
   THEME
========================================================= */

function getInitialTheme() {

  const stored =
    localStorage.getItem(
      START_LEARNING_CONFIG.THEME_KEY
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
    $('startLearningThemeToggle');

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
    START_LEARNING_CONFIG.THEME_KEY,
    dark
      ? 'dark'
      : 'light'
  );


  updateThemeButton();

}


function setupTheme() {

  applyTheme(
    getInitialTheme()
  );


  const button =
    $('startLearningThemeToggle');

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
   INITIALIZATION
========================================================= */

let initializationPromise =
  null;


async function initializeStartLearning() {

  if (
    initializationPromise
  ) {

    return initializationPromise;

  }


  initializationPromise =
    (async () => {

      showLoading();


      try {

        const token =
          getAuthToken();


        if (!token) {

          redirectToLogin();

          return;

        }


        await Promise.all([
          loadTeacher(),
          loadLearners(),
        ]);


        renderTeacher();

        renderStudyFieldOptions();

        renderLearners();

        renderEmptyPrice();

        setupFormEvents();

        updateSubmitButton();

        setupBackButton();

        setupRetry();

        showContent();

        hideLoading();

      } catch (error) {

        console.error(
          '[start-learning.js] Initialization failed:',
          error
        );


        if (
          error?.code ===
            'UNAUTHORIZED' ||
          error?.status ===
            401 ||
          error?.code ===
            'NO_TOKEN'
        ) {

          redirectToLogin();

          return;

        }


        showError(
          error?.message ||
          'We could not prepare your learning request.'
        );

      } finally {

        initializationPromise =
          null;

      }

    })();


  return initializationPromise;

}


/* =========================================================
   DOM READY
========================================================= */

document.addEventListener(
  'DOMContentLoaded',
  () => {

    setupTheme();

    initializeStartLearning();

  }
);