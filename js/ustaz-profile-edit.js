'use strict';

/* =========================================================
   BARAKALINK
   USTAZ / USTAZA PROFILE EDIT PAGE

   SINGLE-PAGE EDITOR

   Responsibilities:
   - Load the authenticated Ustaz profile from GET /api/profile.
   - Keep registration identity fields read-only.
   - Edit teaching subjects.
   - Edit location, mosque, experience and teaching profile details.
   - Save the whole page from one Save profile button.
   - Upload/remove profile photo.
   - Handle qualifications and certificate uploads.
   - Handle Qur'an recitation recording, replacement and removal.
   - Handle languages, lesson setup and teaching details.
   - Never require or store Fayda in localStorage.

   Current API usage:
     GET    /api/profile
     PATCH  /api/profile
     PATCH  /api/profile/advanced-edit
     POST   /api/profile/photo
     DELETE /api/profile/photo
========================================================= */

(function () {

  'use strict';


  /* =========================================================
     CONFIGURATION
  ========================================================== */

  const CONFIG = Object.freeze({

    PROFILE_ENDPOINT:
      '/profile',

    PHOTO_ENDPOINT:
      '/profile/photo',

    ADVANCED_EDIT_ENDPOINT:
      window.BARAKALINK_USTAZ_PROFILE_EDIT_ENDPOINT ||
      '/profile/advanced-edit',

    MAX_PHOTO_SIZE:
      5 * 1024 * 1024,

    MAX_AUDIO_SIZE:
      25 * 1024 * 1024,

    MAX_BIO_LENGTH:
      1500,

    PHOTO_TYPES: [
      'image/jpeg',
      'image/png',
      'image/webp'
    ],

    AUDIO_TYPES: [
      'audio/mpeg',
      'audio/wav',
      'audio/x-wav',
      'audio/ogg',
      'audio/mp4',
      'audio/x-m4a',
      'audio/aac',
      'audio/webm'
    ]

  });


  /* =========================================================
     AREA DATA
  ========================================================== */

  const AREA_OPTIONS = Object.freeze({

    bole: [
      {
        value: 'bole-medhanialem',
        label: 'Bole Medhanialem'
      },
      {
        value: 'atlas',
        label: 'Atlas'
      },
      {
        value: 'gerji',
        label: 'Gerji'
      },
      {
        value: 'airport',
        label: 'Airport'
      }
    ],

    yeka: [
      {
        value: 'cmc',
        label: 'CMC'
      },
      {
        value: 'kotebe',
        label: 'Kotebe'
      },
      {
        value: 'megenagna',
        label: 'Megenagna'
      },
      {
        value: 'yeka-abado',
        label: 'Yeka Abado'
      }
    ],

    kirkos: [
      {
        value: 'kazanchis',
        label: 'Kazanchis'
      },
      {
        value: 'mexico',
        label: 'Mexico'
      },
      {
        value: 'meskel-square',
        label: 'Meskel Square'
      },
      {
        value: 'wello-sefer',
        label: 'Wello Sefer'
      }
    ],

    arada: [
      {
        value: 'piazza',
        label: 'Piazza'
      },
      {
        value: 'arat-kilo',
        label: 'Arat Kilo'
      },
      {
        value: 'shiro-meda',
        label: 'Shiro Meda'
      }
    ],

    lideta: [
      {
        value: 'lideta',
        label: 'Lideta'
      },
      {
        value: 'teklehaimanot',
        label: 'Teklehaimanot'
      },
      {
        value: 'tewodros',
        label: 'Tewodros'
      }
    ],

    'nifas-silk': [
      {
        value: 'sar-bet',
        label: 'Sar Bet'
      },
      {
        value: 'lafto',
        label: 'Lafto'
      },
      {
        value: 'weyra',
        label: 'Weyra'
      }
    ],

    kolfe: [
      {
        value: 'kolfe',
        label: 'Kolfe'
      },
      {
        value: 'bethel',
        label: 'Bethel'
      },
      {
        value: 'ayer-tena',
        label: 'Ayer Tena'
      }
    ],

    akaki: [
      {
        value: 'akaki',
        label: 'Akaki'
      },
      {
        value: 'kaliti',
        label: 'Kaliti'
      },
      {
        value: 'qality',
        label: 'Qality'
      }
    ]

  });


  /* =========================================================
     STUDY FIELD OPTIONS
  ========================================================== */

  const STUDY_FIELD_OPTIONS = Object.freeze([

    {
      value: 'quran-basic',
      label: 'Quran Basic',
      icon: 'fa-solid fa-book-open'
    },

    {
      value: 'tajweed',
      label: 'Tajweed',
      icon: 'fa-solid fa-headphones'
    },

    {
      value: 'hifz',
      label: 'Hifz',
      icon: 'fa-solid fa-brain'
    },

    {
      value: 'tafseer',
      label: 'Tafseer',
      icon: 'fa-solid fa-book-quran'
    },

    {
      value: 'hadith',
      label: 'Hadith',
      icon: 'fa-solid fa-mosque'
    },

    {
      value: 'tarbiyah',
      label: 'Tarbiyah',
      icon: 'fa-solid fa-hands-praying'
    }

  ]);


  /* =========================================================
     STATE
  ========================================================== */

  const state = {

    user:
      null,

    teacher:
      null,

    studyFields:
      [],

    languages:
      [],

    availability:
      [],

    qualifications:
      [],

    photoFile:
      null,

    photoObjectUrl:
      '',

    photoRemoved:
      false,

    audioFile:
      null,

    audioObjectUrl:
      '',

    audioRemoved:
      false,

    mediaRecorder:
      null,

    mediaStream:
      null,

    recordingChunks:
      [],

    recordingMimeType:
      '',

    recordingStartedAt:
      0,

    recordingTimerId:
      null,

    removedQualificationIds:
      new Set(),

    saving:
      false

  };


  /* =========================================================
     DOM HELPERS
  ========================================================== */

  function $(
    id
  ) {

    return document.getElementById(
      id
    );

  }


  function $$(
    selector,
    root = document
  ) {

    return Array.from(
      root.querySelectorAll(
        selector
      )
    );

  }


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
      String(
        value
      ).trim();

    return text ||
      fallback;

  }


  function normalizeSubcity(
    value
  ) {

    return safeString(
      value
    )
      .toLowerCase()
      .replace(
        /[\s_-]+/g,
        '-'
      );

  }


  function normalizeArea(
    value
  ) {

    return safeString(
      value
    )
      .toLowerCase()
      .replace(
        /[\s_-]+/g,
        '-'
      );

  }


  function normalizeLanguage(
    value
  ) {

    if (
      value &&
      typeof value ===
        'object'
    ) {

      value =
        value.slug ??
        value.value ??
        value.language ??
        value.name ??
        '';

    }


    const normalized =
      safeString(
        value
      )
        .toLowerCase()
        .replace(
          /\s+/g,
          '-'
        );


    const aliases = {

      oromo:
        'afaan-oromo',

      afaanoromo:
        'afaan-oromo',

      'afaan-oromo':
        'afaan-oromo',

      amharic:
        'amharic',

      tigrinya:
        'tigrinya',

      somali:
        'somali',

      arabic:
        'arabic',

      english:
        'english'

    };


    return (
      aliases[normalized] ||
      normalized
    );

  }


  /* =========================================================
     STUDY FIELD NORMALIZATION
  ========================================================== */

  function normalizeStudyField(
    value
  ) {

    if (
      value &&
      typeof value ===
        'object'
    ) {

      value =
        value.slug ??
        value.value ??
        value.studyField ??
        value.study_field ??
        value.studyFieldSlug ??
        value.study_field_slug ??
        value.name ??
        '';

    }


    const normalized =
      safeString(
        value
      )
        .toLowerCase()
        .trim()
        .replace(
          /\s+/g,
          '-'
        )
        .replace(
          /_+/g,
          '-'
        );


    const aliases = {

      'quran-basic':
        'quran-basic',

      'quran_basic':
        'quran-basic',

      quran:
        'quran-basic',

      'quran-basic-level':
        'quran-basic',

      'quran basic':
        'quran-basic',

      tajweed:
        'tajweed',

      hifz:
        'hifz',

      tafseer:
        'tafseer',

      hadith:
        'hadith',

      tarbiyah:
        'tarbiyah'

    };


    return (
      aliases[normalized] ||
      normalized
    );

  }


  function normalizeDay(
    value
  ) {

    if (
      value &&
      typeof value === 'object'
    ) {

      value =
        value.day ??
        value.dayName ??
        value.weekday ??
        value.day_of_week ??
        '';

    }


    const raw =
      safeString(
        value
      )
        .toLowerCase();


    const numeric =
      Number(
        raw
      );


    if (
      Number.isInteger(
        numeric
      ) &&
      numeric >= 0 &&
      numeric <= 6
    ) {

      return [
        'sunday',
        'monday',
        'tuesday',
        'wednesday',
        'thursday',
        'friday',
        'saturday'
      ][numeric];

    }


    return raw;

  }


  /* =========================================================
     DATE NORMALIZATION
  ========================================================== */

  function normalizeDateInputValue(
    value
  ) {

    const raw =
      safeString(
        value
      );


    if (!raw) {

      return '';

    }


    if (
      /^\d{4}-\d{2}-\d{2}$/.test(
        raw
      )
    ) {

      return raw;

    }


    const match =
      raw.match(
        /^(\d{4}-\d{2}-\d{2})/
      );


    if (match) {

      return match[1];

    }


    const parsed =
      new Date(
        raw
      );


    if (
      Number.isNaN(
        parsed.getTime()
      )
    ) {

      return '';

    }


    return [
      parsed.getUTCFullYear(),
      String(
        parsed.getUTCMonth() + 1
      ).padStart(
        2,
        '0'
      ),
      String(
        parsed.getUTCDate()
      ).padStart(
        2,
        '0'
      )
    ].join(
      '-'
    );

  }


  function setValue(
    id,
    value
  ) {

    const element =
      $(id);


    if (!element) {

      return;

    }


    if (
      element.type ===
      'date'
    ) {

      element.value =
        normalizeDateInputValue(
          value
        );

      return;

    }


    element.value =
      safeString(
        value
      );

  }


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
      safeString(
        value
      );

  }


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
      safeString(
        message
      );


    const field =
      element.closest(
        '.profile-edit-field, .auth-field, .profile-edit-card'
      );


    if (field) {

      field.classList.add(
        'has-error'
      );

    }

  }


function clearFieldError(id) {
  const element = $(id);
  if (!element) return;

  element.textContent = '';

  const field =
    element.closest('.profile-edit-field, .auth-field') ||
    element.closest('.profile-edit-card');

  if (field) {
    field.classList.remove('has-error');
  }

  const controlScope = element.closest('.profile-edit-field, .auth-field');
  if (controlScope) {
    controlScope
      .querySelectorAll('.is-invalid, [aria-invalid="true"]')
      .forEach((control) => {
        control.classList.remove('is-invalid');
        control.removeAttribute('aria-invalid');
      });
  }
}


function clearAllErrors() {
  $$('.form-error').forEach((element) => {
    element.textContent = '';
  });

  $$('.has-error').forEach((element) => {
    element.classList.remove('has-error');
  });

  $$('.is-invalid, [aria-invalid="true"]').forEach((control) => {
    control.classList.remove('is-invalid');
    control.removeAttribute('aria-invalid');
  });
}




  function setStatus(
    message,
    type = ''
  ) {

    const node =
      $('profileStatus');


    if (!node) {

      return;

    }


    node.textContent =
      safeString(
        message
      );


    node.classList.remove(
      'is-success',
      'is-error',
      'is-loading',
      'success',
      'error',
      'loading'
    );


    if (type) {

      node.classList.add(
        type
      );

    }

  }


  /* =========================================================
     AUTH
  ========================================================== */

  function getToken() {

    if (
      window.BarakaLinkAPI &&
      typeof window.BarakaLinkAPI.getToken ===
        'function'
    ) {

      const token =
        window.BarakaLinkAPI.getToken();


      if (token) {

        return token;

      }

    }


    return (
      localStorage.getItem(
        'barakalink_token'
      ) ||
      localStorage.getItem(
        'token'
      ) ||
      ''
    );

  }


  function clearSession() {

    if (
      window.BarakaLinkAPI &&
      typeof window.BarakaLinkAPI.clearToken ===
        'function'
    ) {

      try {

        window.BarakaLinkAPI.clearToken();

      } catch (_) {

        /* Ignore helper cleanup errors. */

      }

    }


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


    window.location.replace(
      'index.html'
    );

  }


  /* =========================================================
     API
  ========================================================== */

  function getApiBase() {

    return String(
      window.BARAKALINK_API_BASE ||
      'http://localhost:5000/api'
    )
      .replace(
        /\/+$/,
        ''
      );

  }


  async function apiRequest(
    endpoint,
    options = {}
  ) {

    const token =
      getToken();


    if (!token) {

      const error =
        new Error(
          'Your session has expired.'
        );


      error.status =
        401;

      error.code =
        'UNAUTHORIZED';


      throw error;

    }


    if (
      window.BarakaLinkAPI &&
      typeof window.BarakaLinkAPI.request ===
        'function'
    ) {

      try {

        return await window.BarakaLinkAPI.request(
          endpoint,
          options
        );

      } catch (error) {

        if (
          error?.status ===
          401
        ) {

          error.code =
            'UNAUTHORIZED';

        }


        throw error;

      }

    }


    const requestPath =
      String(
        endpoint ||
        ''
      ).startsWith(
        '/'
      )
        ? String(endpoint)
        : `/${String(endpoint)}`;


    const isFormData =
      typeof FormData !==
        'undefined' &&
      options.body instanceof
        FormData;


    const headers = {

      Accept:
        'application/json',

      Authorization:
        token.startsWith(
          'Bearer '
        )
          ? token
          : `Bearer ${token}`,

      ...(options.headers || {})

    };


    if (
      options.body &&
      !isFormData &&
      !headers['Content-Type']
    ) {

      headers['Content-Type'] =
        'application/json';

    }


    let response;


    try {

      response =
        await fetch(
          `${getApiBase()}${requestPath}`,
          {
            ...options,
            headers
          }
        );

    } catch (
      networkError
    ) {

      const error =
        new Error(
          'Unable to connect to the BarakaLink server.'
        );


      error.code =
        'NETWORK_ERROR';

      error.originalError =
        networkError;


      throw error;

    }


    const payload =
      await response
        .json()
        .catch(
          () =>
            null
        );


    if (
      response.status ===
      401
    ) {

      const error =
        new Error(
          payload?.message ||
          'Your session has expired.'
        );


      error.status =
        401;

      error.code =
        'UNAUTHORIZED';


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


    return (
      payload ||
      {}
    );

  }


  /* =========================================================
     PROFILE RESPONSE NORMALIZATION
  ========================================================== */

  function extractProfile(
    payload
  ) {

    const root =
      payload &&
      typeof payload ===
        'object'
        ? payload
        : {};


    const data =
      root.data &&
      typeof root.data ===
        'object'
        ? root.data
        : root;


    const user =
      data.user ??
      root.user ??
      null;


    const teacher =
      data.teacherProfile ??
      data.teacher_profile ??
      data.teacher ??
      data.ustaz ??
      data.profile?.teacherProfile ??
      data.profile?.teacher_profile ??
      user?.teacherProfile ??
      user?.teacher_profile ??
      null;


    if (!user) {

      throw new Error(
        'Your BarakaLink account information could not be loaded.'
      );

    }


    if (!teacher) {

      console.error(
        '[BarakaLink][Ustaz Profile Edit] No teacher profile found.',
        {
          user,
          data
        }
      );


      throw new Error(
        'Your Ustaz teaching profile could not be found.'
      );

    }


    const studyFields =
      Array.isArray(
        data.studyFields
      )
        ? data.studyFields
        : Array.isArray(
            data.study_fields
          )
          ? data.study_fields
          : Array.isArray(
              data.profile?.studyFields
            )
            ? data.profile.studyFields
            : Array.isArray(
                data.profile?.study_fields
              )
              ? data.profile.study_fields
              : Array.isArray(
                  teacher.studyFields
                )
                ? teacher.studyFields
                : Array.isArray(
                    teacher.study_fields
                  )
                  ? teacher.study_fields
                  : Array.isArray(
                      teacher.teachingSubjects
                    )
                    ? teacher.teachingSubjects
                    : Array.isArray(
                        teacher.teaching_subjects
                      )
                      ? teacher.teaching_subjects
                      : [];


    const languages =
      Array.isArray(
        data.languages
      )
        ? data.languages
        : Array.isArray(
            data.teacherLanguages
          )
          ? data.teacherLanguages
          : Array.isArray(
              data.teacher_languages
            )
            ? data.teacher_languages
            : Array.isArray(
                teacher.languages
              )
              ? teacher.languages
              : [];


    const availability =
      Array.isArray(
        data.availability
      )
        ? data.availability
        : Array.isArray(
            data.availabilityDays
          )
          ? data.availabilityDays
          : Array.isArray(
              data.availability_days
            )
            ? data.availability_days
            : Array.isArray(
                teacher.availability
              )
              ? teacher.availability
              : Array.isArray(
                  teacher.availabilityDays
                )
                ? teacher.availabilityDays
                : [];


    const qualifications =
      Array.isArray(
        data.qualifications
      )
        ? data.qualifications
        : Array.isArray(
            data.teacherQualifications
          )
          ? data.teacherQualifications
          : Array.isArray(
              data.teacher_qualifications
            )
            ? data.teacher_qualifications
            : Array.isArray(
                teacher.qualifications
              )
                ? teacher.qualifications
                : [];


    return {

      user,

      teacher,

      studyFields,

      languages,

      availability,

      qualifications

    };

  }


  /* =========================================================
     REGISTRATION INFORMATION
  ========================================================== */

  function formatGender(
    value
  ) {

    const gender =
      safeString(
        value
      )
        .toLowerCase();


    if (
      gender ===
      'male'
    ) {

      return 'Male';

    }


    if (
      gender ===
      'female'
    ) {

      return 'Female';

    }


    return safeString(
      value
    );

  }


  function formatPhone(
    value
  ) {

    let digits =
      safeString(
        value
      )
        .replace(
          /\D/g,
          ''
        );


    if (
      digits.startsWith(
        '251'
      )
    ) {

      digits =
        digits.slice(
          3
        );

    }


    if (
      digits.length !==
      9
    ) {

      return digits;

    }


    return (
      digits.slice(
        0,
        3
      ) +
      ' ' +
      digits.slice(
        3,
        6
      ) +
      ' ' +
      digits.slice(
        6
      )
    );

  }


  function getStudyFieldLabel(
    field
  ) {

    if (
      field &&
      typeof field ===
        'object'
    ) {

      const name =
        safeString(
          field.name
        );


      if (name) {

        return name;

      }

    }


    const slug =
      safeString(
        field?.slug ??
        field?.value ??
        field
      );


    if (!slug) {

      return 'Teaching subject';

    }


    const known =
      STUDY_FIELD_OPTIONS.find(
        option =>
          option.value ===
          normalizeStudyField(
            slug
          )
      );


    if (known) {

      return known.label;

    }


    return slug
      .replace(
        /[-_]+/g,
        ' '
      )
      .replace(
        /\b\w/g,
        character =>
          character.toUpperCase()
      );

  }


  function getStudyFieldIcon(
    value
  ) {

    const normalized =
      normalizeStudyField(
        value
      );


    const known =
      STUDY_FIELD_OPTIONS.find(
        option =>
          option.value ===
          normalized
      );


    return (
      known?.icon ||
      'fa-solid fa-book'
    );

  }


  function removeGeneratedStudyFields() {

    const container =
      $('profileStudyFields');


    if (!container) {

      return;

    }


    $$(
      '[data-generated-study-field="true"]',
      container
    )
      .forEach(
        element => {

          element.remove();

        }
      );

  }


  function renderRegisteredStudyFields() {

    const container =
      $('profileStudyFields');


    if (!container) {

      return;

    }


    removeGeneratedStudyFields();


    const selectedFields =
      new Set(
        state.studyFields
          .map(
            normalizeStudyField
          )
          .filter(Boolean)
      );


    /*
     * Synchronize the six normal frontend choices.
     */

    $$(
      'input[name="studyFields"]',
      container
    )
      .forEach(
        input => {

          const value =
            normalizeStudyField(
              input.value
            );


          input.disabled =
            false;


          input.checked =
            selectedFields.has(
              value
            );


          input.removeAttribute(
            'aria-disabled'
          );

        }
      );


    /*
     * Keep any server-side study field that is not yet
     * represented in the standard frontend options.
     */

    const knownValues =
      new Set(
        STUDY_FIELD_OPTIONS.map(
          option =>
            option.value
        )
      );


    const unknownFields =
      Array.from(
        selectedFields
      )
        .filter(
          value =>
            !knownValues.has(
              value
            )
        );


    unknownFields.forEach(
      value => {

        const option =
          document.createElement(
            'label'
          );


        option.className =
          'profile-edit-choice role-option';


        option.dataset.generatedStudyField =
          'true';


        const input =
          document.createElement(
            'input'
          );


        input.type =
          'checkbox';


        input.name =
          'studyFields';


        input.value =
          value;


        input.checked =
          true;


        const icon =
          document.createElement(
            'i'
          );


        icon.className =
          getStudyFieldIcon(
            value
          );


        icon.setAttribute(
          'aria-hidden',
          'true'
        );


        const strong =
          document.createElement(
            'strong'
          );


        strong.textContent =
          getStudyFieldLabel(
            value
          );


        option.appendChild(
          input
        );


        option.appendChild(
          icon
        );


        option.appendChild(
          strong
        );


        container.appendChild(
          option
        );

      }
    );


    updateChoiceVisualState();

  }


  function renderRegistrationInfo() {

    const user =
      state.user ||
      {};


    const teacher =
      state.teacher ||
      {};


    setValue(
      'profileRole',
      'Ustaz / Ustaza'
    );


    setValue(
      'profileFirstName',
      user.firstName ??
      user.first_name ??
      ''
    );


    setValue(
      'profileLastName',
      user.lastName ??
      user.last_name ??
      ''
    );


    setValue(
      'profilePhone',
      formatPhone(
        user.phone
      )
    );


    setValue(
      'profileGender',
      formatGender(
        teacher.gender
      )
    );


    renderRegisteredStudyFields();


    const savedSubcity =
      normalizeSubcity(
        teacher.subcity ??
        teacher.sub_city ??
        ''
      );


    const subcitySelect =
      $('profileSubcity');


    if (subcitySelect) {

      const existingOption =
        Array.from(
          subcitySelect.options
        ).find(
          option =>
            normalizeSubcity(
              option.value
            ) ===
            savedSubcity
        );


      if (
        savedSubcity &&
        !existingOption
      ) {

        const option =
          document.createElement(
            'option'
          );


        option.value =
          savedSubcity;


        option.textContent =
          savedSubcity
            .replace(
              /[-_]+/g,
              ' '
            )
            .replace(
              /\b\w/g,
              character =>
                character.toUpperCase()
            );


        subcitySelect.appendChild(
          option
        );

      }


      subcitySelect.value =
        savedSubcity;

    }


    populateAreas(
      savedSubcity,
      teacher.area ??
      teacher.area_name ??
      ''
    );


    setValue(
      'profileNearestMosque',
      teacher.nearestMosque ??
      teacher.nearest_mosque ??
      ''
    );


    setValue(
      'profileExperience',
      teacher.experience ??
      teacher.teachingExperience ??
      teacher.teaching_experience ??
      ''
    );


    const dob =
      $('profileDateOfBirth');


    if (dob) {

      setValue(
        'profileDateOfBirth',
        teacher.dateOfBirth ??
        teacher.date_of_birth ??
        teacher.birthDate ??
        teacher.birth_date ??
        ''
      );


      dob.disabled =
        true;


      dob.readOnly =
        true;


      dob.setAttribute(
        'aria-readonly',
        'true'
      );


      dob.setAttribute(
        'tabindex',
        '-1'
      );

    }

  }


  /* =========================================================
     AREA SELECT
  ========================================================== */

  function populateAreas(
    subcityValue,
    selectedArea
  ) {

    const select =
      $('profileArea');


    if (!select) {

      return;

    }


    const subcity =
      normalizeSubcity(
        subcityValue
      );


    const area =
      normalizeArea(
        selectedArea
      );


    const options =
      AREA_OPTIONS[subcity] ||
      [];


    select.innerHTML =
      '';


    if (!subcity) {

      const option =
        document.createElement(
          'option'
        );


      option.value =
        '';


      option.textContent =
        'Select Sub-City first';


      select.appendChild(
        option
      );


      select.disabled =
        true;


      return;

    }


    const placeholder =
      document.createElement(
        'option'
      );


    placeholder.value =
      '';


    placeholder.textContent =
      'Select Area';


    select.appendChild(
      placeholder
    );


    if (
      !options.length
    ) {

      const option =
        document.createElement(
          'option'
        );


      option.value =
        area ||
        '';


      option.textContent =
        area
          ? area
              .replace(
                /[-_]+/g,
                ' '
              )
              .replace(
                /\b\w/g,
                character =>
                  character.toUpperCase()
              )
          : 'Select area';


      option.selected =
        Boolean(
          area
        );


      select.appendChild(
        option
      );


      select.disabled =
        false;


      return;

    }


    options.forEach(
      item => {

        const option =
          document.createElement(
            'option'
          );


        option.value =
          item.value;


        option.textContent =
          item.label;


        option.selected =
          normalizeArea(
            item.value
          ) ===
          area;


        select.appendChild(
          option
        );

      }
    );


    select.disabled =
      false;

  }


  /* =========================================================
     ALL EDITABLE FIELDS
  ========================================================== */

  function renderAllEditableFields() {

    const teacher =
      state.teacher ||
      {};


    setValue(
      'profileDateOfBirth',
      teacher.dateOfBirth ??
      teacher.date_of_birth ??
      teacher.birthDate ??
      teacher.birth_date ??
      ''
    );


    setValue(
      'profileBio',
      teacher.bio ??
      teacher.about ??
      teacher.description ??
      ''
    );


    setValue(
      'profileRecitationTitle',
      teacher.recitationTitle ??
      teacher.recitation_title ??
      ''
    );


    setValue(
      'profileRecitationDescription',
      teacher.recitationDescription ??
      teacher.recitation_description ??
      ''
    );


    setValue(
      'profileTeachingApproach',
      teacher.teachingApproach ??
      teacher.teaching_approach ??
      ''
    );


    setValue(
      'profileHourlyRate',
      teacher.hourlyRate ??
      teacher.hourly_rate ??
      teacher.pricePerHour ??
      teacher.price_per_hour ??
      ''
    );


    setValue(
      'profileLessonDuration',
      teacher.lessonDuration ??
      teacher.lesson_duration ??
      ''
    );


    const lessonFormat =
      safeString(
        teacher.lessonFormat ??
        teacher.lesson_format
      )
        .toLowerCase();


    $$(
      'input[name="lessonFormat"]'
    )
      .forEach(
        input => {

          input.checked =
            input.value ===
            lessonFormat;

        }
      );


    const languageSet =
      new Set(
        state.languages.map(
          normalizeLanguage
        )
      );


    $$(
      'input[name="languages"]'
    )
      .forEach(
        input => {

          input.checked =
            languageSet.has(
              normalizeLanguage(
                input.value
              )
            );

        }
      );


    renderRegisteredStudyFields();

    updateChoiceVisualState();

    updateBioCounter();

    renderQualifications();

  }


  /* =========================================================
     CHOICE VISUAL STATE
  ========================================================== */

  function updateChoiceVisualState() {

    $$(
      'label.profile-edit-choice'
    )
      .forEach(
        label => {

          const input =
            label.querySelector(
              'input[type="checkbox"], input[type="radio"]'
            );


          if (!input) {

            return;

          }


          label.classList.toggle(
            'is-selected',
            Boolean(
              input.checked
            )
          );


          label.setAttribute(
            'aria-checked',
            input.checked
              ? 'true'
              : 'false'
          );

        }
      );

  }


  /* =========================================================
     BIO COUNTER
  ========================================================== */

  function updateBioCounter() {

    const bio =
      $('profileBio');


    const counter =
      $('profileBioCount');


    if (
      !bio ||
      !counter
    ) {

      return;

    }


    const max =
      Number(
        bio.maxLength
      ) ||
      CONFIG.MAX_BIO_LENGTH;


    if (
      bio.value.length >
      max
    ) {

      bio.value =
        bio.value.slice(
          0,
          max
        );

    }


    counter.textContent =
      String(
        bio.value.length
      );

  }


  /* =========================================================
     MEDIA URL
  ========================================================== */

  function resolveMediaUrl(
    value
  ) {

    const raw =
      safeString(
        value
      );


    if (!raw) {

      return '';

    }


    try {

      const apiBase =
        window.BarakaLinkAPI?.base ||
        getApiBase();


      return new URL(
        raw,
        `${String(apiBase).replace(/\/+$/, '')}/`
      ).href;

    } catch (_) {

      try {

        return new URL(
          raw,
          window.location.origin
        ).href;

      } catch (_) {

        return raw;

      }

    }

  }


  /* =========================================================
     PROFILE PHOTO
  ========================================================== */

  function getExistingPhotoUrl() {

    const user =
      state.user ||
      {};


    const teacher =
      state.teacher ||
      {};


    return (
      user.avatarUrl ??
      user.avatar_url ??
      teacher.photoUrl ??
      teacher.photo_url ??
      teacher.profilePhotoUrl ??
      teacher.profile_photo_url ??
      teacher.avatarUrl ??
      teacher.avatar_url ??
      ''
    );

  }


  function hasExistingPhoto() {

    return Boolean(
      getExistingPhotoUrl()
    );

  }


  function cleanupPhotoObjectUrl() {

    if (
      !state.photoObjectUrl
    ) {

      return;

    }


    try {

      URL.revokeObjectURL(
        state.photoObjectUrl
      );

    } catch (_) {

      /* Ignore stale URL errors. */

    }


    state.photoObjectUrl =
      '';

  }


  function renderPhotoPreview() {

    const preview =
      $('profilePhotoPreview');


    const placeholder =
      $('profilePhotoPlaceholder');


    const removeButton =
      $('profilePhotoRemoveButton');


    const name =
      $('profilePhotoName');


    if (
      state.photoFile &&
      state.photoObjectUrl
    ) {

      if (preview) {

        preview.src =
          state.photoObjectUrl;

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


      if (name) {

        name.textContent =
          state.photoFile.name;

      }


      return;

    }


    if (
      state.photoRemoved
    ) {

      if (preview) {

        preview.src =
          '';

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


      if (name) {

        name.textContent =
          'No profile photo';

      }


      return;

    }


    const existingUrl =
      getExistingPhotoUrl();


    if (existingUrl) {

      if (preview) {

        preview.src =
          resolveMediaUrl(
            existingUrl
          );

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


      if (name) {

        name.textContent =
          'Current profile photo';

      }


      return;

    }


    if (preview) {

      preview.src =
        '';

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


    if (name) {

      name.textContent =
        'No profile photo';

    }

  }


  function setupPhoto() {

    const input =
      $('profilePhoto');


    const changeButton =
      $('profilePhotoChangeButton');


    const removeButton =
      $('profilePhotoRemoveButton');


    if (
      changeButton &&
      input &&
      changeButton.dataset.bound !==
        'true'
    ) {

      changeButton.dataset.bound =
        'true';


      changeButton.addEventListener(
        'click',
        () => {

          input.click();

        }
      );

    }


    if (
      input &&
      input.dataset.bound !==
        'true'
    ) {

      input.dataset.bound =
        'true';


      input.addEventListener(
        'change',
        () => {

          const file =
            input.files?.[0] ||
            null;


          if (!file) {

            return;

          }


          clearFieldError(
            'profilePhotoError'
          );


          const mime =
            safeString(
              file.type
            )
              .toLowerCase();


          const extensionOk =
            /\.(jpe?g|png|webp)$/i.test(
              file.name
            );


          if (
            !CONFIG.PHOTO_TYPES.includes(
              mime
            ) &&
            !extensionOk
          ) {

            showFieldError(
              'profilePhotoError',
              'Please choose a JPG, PNG, or WebP image.'
            );


            input.value =
              '';


            return;

          }


          if (
            file.size >
            CONFIG.MAX_PHOTO_SIZE
          ) {

            showFieldError(
              'profilePhotoError',
              'The profile photo must be 5 MB or smaller.'
            );


            input.value =
              '';


            return;

          }


          cleanupPhotoObjectUrl();


          state.photoFile =
            file;


          state.photoRemoved =
            false;


          state.photoObjectUrl =
            URL.createObjectURL(
              file
            );


          renderPhotoPreview();

        }
      );

    }


    if (
      removeButton &&
      removeButton.dataset.bound !==
        'true'
    ) {

      removeButton.dataset.bound =
        'true';


      removeButton.addEventListener(
        'click',
        async () => {

          if (
            state.saving
          ) {

            return;

          }


          if (
            state.photoFile
          ) {

            cleanupPhotoObjectUrl();


            state.photoFile =
              null;


            state.photoRemoved =
              false;


            if (input) {

              input.value =
                '';

            }


            renderPhotoPreview();


            return;

          }


          if (
            !hasExistingPhoto()
          ) {

            return;

          }


          const originalText =
            removeButton.innerHTML;


          removeButton.disabled =
            true;


          removeButton.innerHTML = `
            <i
              class="fa-solid fa-circle-notch fa-spin"
              aria-hidden="true"
            ></i>
            Removing...
          `;


          try {

            setStatus(
              'Removing your profile photo...',
              'is-loading'
            );


            await apiRequest(
              CONFIG.PHOTO_ENDPOINT,
              {
                method:
                  'DELETE'
              }
            );


            state.photoRemoved =
              true;


            state.photoFile =
              null;


            cleanupPhotoObjectUrl();


            state.user = {
              ...(state.user || {}),
              avatarUrl:
                '',
              avatar_url:
                ''
            };


            if (input) {

              input.value =
                '';

            }


            renderPhotoPreview();


            setStatus(
              'Profile photo removed.',
              'is-success'
            );


          } catch (
            error
          ) {

            console.error(
              '[BarakaLink][Ustaz Profile Edit] Photo removal failed:',
              error
            );


            if (
              error?.status ===
                401 ||
              error?.code ===
                'UNAUTHORIZED'
            ) {

              redirectToLogin();

              return;

            }


            setStatus(
              error?.message ||
              'We could not remove your profile photo.',
              'is-error'
            );

          } finally {

            removeButton.disabled =
              false;


            removeButton.innerHTML =
              originalText;

          }

        }
      );

    }


    renderPhotoPreview();

  }


  async function uploadPhotoIfNeeded() {

    if (
      !state.photoFile
    ) {

      return;

    }


    const data =
      new FormData();


    data.append(
      'profilePhoto',
      state.photoFile
    );


    await apiRequest(
      CONFIG.PHOTO_ENDPOINT,
      {
        method:
          'POST',

        body:
          data
      }
    );


    state.photoFile =
      null;


    state.photoRemoved =
      false;


    cleanupPhotoObjectUrl();

  }


  /* =========================================================
     RECITATION
  ========================================================== */

  function getExistingRecitationUrl() {

    const teacher =
      state.teacher ||
      {};


    return (
      teacher.recitationAudioUrl ??
      teacher.recitation_audio_url ??
      teacher.recitationUrl ??
      teacher.recitation_url ??
      teacher.sampleRecitationUrl ??
      teacher.sample_recitation_url ??
      teacher.audioUrl ??
      teacher.audio_url ??
      ''
    );

  }


  function formatTime(
    seconds
  ) {

    const total =
      Math.max(
        0,
        Math.floor(
          Number(
            seconds
          ) || 0
        )
      );


    const minutes =
      Math.floor(
        total / 60
      );


    const remaining =
      total % 60;


    return (
      `${minutes}:` +
      String(
        remaining
      ).padStart(
        2,
        '0'
      )
    );

  }


  function updateRecitationTimer(
    seconds
  ) {

    const timer =
      $('profileRecitationTimer');


    if (timer) {

      timer.textContent =
        formatTime(
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


  function getRecordingMimeType() {

    if (
      typeof MediaRecorder ===
        'undefined'
    ) {

      return '';

    }


    if (
      typeof MediaRecorder.isTypeSupported !==
        'function'
    ) {

      return '';

    }


    const candidates = [

      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4'

    ];


    return (
      candidates.find(
        type =>
          MediaRecorder.isTypeSupported(
            type
          )
      ) ||
      ''
    );

  }


  function stopMicrophoneStream() {

    const stream =
      state.mediaStream;


    state.mediaStream =
      null;


    if (
      !stream ||
      typeof stream.getTracks !==
        'function'
    ) {

      return;

    }


    stream
      .getTracks()
      .forEach(
        track => {

          try {

            track.stop();

          } catch (_) {

            /* Ignore track cleanup errors. */

          }

        }
      );

  }


  function cleanupRecorder() {

    stopRecitationTimer();


    const recorder =
      state.mediaRecorder;


    state.mediaRecorder =
      null;


    state.recordingChunks =
      [];


    if (
      recorder &&
      recorder.state !==
        'inactive'
    ) {

      try {

        recorder.stop();

      } catch (_) {

        /* Ignore teardown errors. */

      }

    }


    stopMicrophoneStream();


    state.recordingMimeType =
      '';

  }


  function clearAudioObjectUrl() {

    if (
      !state.audioObjectUrl
    ) {

      return;

    }


    try {

      URL.revokeObjectURL(
        state.audioObjectUrl
      );

    } catch (_) {

      /* Ignore stale URL errors. */

    }


    state.audioObjectUrl =
      '';

  }


  function updateRecitationPlayer(
    source
  ) {

    const preview =
      $('profileRecitationPreview');


    const player =
      $('profileRecitationPlayer');


    const removeButton =
      $('profileRecitationRemoveButton');


    const status =
      $('profileRecitationStatus');


    if (!player) {

      return;

    }


    if (!source) {

      player.pause();


      player.removeAttribute(
        'src'
      );


      player.load();


      if (preview) {

        preview.hidden =
          true;

      }


      if (removeButton) {

        removeButton.hidden =
          true;

      }


      if (status) {

        status.textContent =
          'No recitation recorded yet.';

      }


      return;

    }


    player.src =
      source;


    player.load();


    if (preview) {

      preview.hidden =
        false;

    }


    if (removeButton) {

      removeButton.hidden =
        false;

    }


    if (status) {

      status.textContent =
        state.audioFile
          ? 'New recitation recorded. Tap play to listen.'
          : 'Current recitation sample loaded.';

    }

  }

const stopButton = $('profileRecitationStopButton');
if (stopButton) stopButton.hidden = true;



  function renderExistingRecitation() {

    clearAudioObjectUrl();


    state.audioFile =
      null;


    state.audioRemoved =
      false;


    const existing =
      getExistingRecitationUrl();


    if (!existing) {

      updateRecitationPlayer(
        ''
      );


      return;

    }


    updateRecitationPlayer(
      resolveMediaUrl(
        existing
      )
    );

  }


  function setupRecitation() {

    const recordButton =
      $('profileRecitationRecordButton');


    const stopButton =
      $('profileRecitationStopButton');


    const removeButton =
      $('profileRecitationRemoveButton');


    const player =
      $('profileRecitationPlayer');


    if (
      recordButton &&
      recordButton.dataset.bound !==
        'true'
    ) {

      recordButton.dataset.bound =
        'true';


      recordButton.addEventListener(
        'click',
        async () => {

          clearFieldError(
            'profileRecitationError'
          );


          if (
            state.mediaRecorder &&
            state.mediaRecorder.state !==
              'inactive'
          ) {

            return;

          }


          if (
            !navigator.mediaDevices ||
            typeof navigator.mediaDevices.getUserMedia !==
              'function'
          ) {

            showFieldError(
              'profileRecitationError',
              'Microphone recording is not supported in this browser.'
            );


            return;

          }


          if (
            typeof MediaRecorder ===
              'undefined'
          ) {

            showFieldError(
              'profileRecitationError',
              'Audio recording is not supported in this browser.'
            );


            return;

          }


          recordButton.disabled =
            true;


          try {

            cleanupRecorder();


            clearAudioObjectUrl();


            state.audioFile =
              null;


            state.audioRemoved =
              false;


            state.mediaStream =
              await navigator.mediaDevices.getUserMedia({
                audio:
                  true
              });


            const mimeType =
              getRecordingMimeType();


            state.recordingMimeType =
              mimeType;


            let recorder;


            try {

              recorder =
                mimeType
                  ? new MediaRecorder(
                      state.mediaStream,
                      {
                        mimeType
                      }
                    )
                  : new MediaRecorder(
                      state.mediaStream
                    );

            } catch (
              error
            ) {

              stopMicrophoneStream();

              throw error;

            }


            state.mediaRecorder =
              recorder;


            state.recordingChunks =
              [];


            recorder.addEventListener(
              'dataavailable',
              event => {

                if (
                  event.data &&
                  event.data.size > 0
                ) {

                  state.recordingChunks.push(
                    event.data
                  );

                }

              }
            );


            recorder.addEventListener(
              'stop',
              () => {

                const chunks =
                  state.recordingChunks
                    .slice();


                const finalMime =
                  recorder.mimeType ||
                  state.recordingMimeType ||
                  'audio/webm';


                state.mediaRecorder =
                  null;


                stopRecitationTimer();


                stopMicrophoneStream();


                state.recordingChunks =
                  [];


                if (
                  !chunks.length
                ) {

                  updateRecitationTimer(
                    0
                  );


                  setText(
                    'profileRecitationStatus',
                    'No audio was recorded. Please try again.'
                  );


                  if (stopButton) {

                    stopButton.hidden =
                      true;

                  }


                  if (recordButton) {

                    recordButton.hidden =
                      false;

                    recordButton.disabled =
                      false;

                  }


                  return;

                }


                const blob =
                  new Blob(
                    chunks,
                    {
                      type:
                        finalMime
                    }
                  );


                if (
                  blob.size >
                  CONFIG.MAX_AUDIO_SIZE
                ) {

                  updateRecitationTimer(
                    0
                  );


                  showFieldError(
                    'profileRecitationError',
                    'The recitation sample must be 25 MB or smaller.'
                  );


                  updateRecitationPlayer(
                    ''
                  );


                  if (recordButton) {

                    recordButton.hidden =
                      false;

                    recordButton.disabled =
                      false;

                  }


                  if (stopButton) {

                    stopButton.hidden =
                      true;

                  }


                  return;

                }


                clearAudioObjectUrl();


                const extension =
                  finalMime.includes(
                    'mpeg'
                  )
                    ? 'mp3'
                    : finalMime.includes(
                        'wav'
                      )
                      ? 'wav'
                      : finalMime.includes(
                          'ogg'
                        )
                        ? 'ogg'
                        : finalMime.includes(
                            'mp4'
                          )
                          ? 'm4a'
                          : 'webm';


                state.audioFile =
                  new File(
                    [
                      blob
                    ],
                    `quran-recitation-${Date.now()}.${extension}`,
                    {
                      type:
                        finalMime
                    }
                  );


                state.audioObjectUrl =
                  URL.createObjectURL(
                    state.audioFile
                  );


                state.audioRemoved =
                  false;


                updateRecitationPlayer(
                  state.audioObjectUrl
                );


                updateRecitationTimer(
                  0
                );


                setText(
                  'profileRecitationStatus',
                  'New recitation recorded. Tap play to listen.'
                );


                if (recordButton) {

                  recordButton.hidden =
                    false;

                  recordButton.disabled =
                    false;

                }


                if (stopButton) {

                  stopButton.hidden =
                    true;

                }


                clearFieldError(
                  'profileRecitationError'
                );

              }
            );


            recorder.addEventListener(
              'error',
              event => {

                console.error(
                  '[BarakaLink][Ustaz Profile Edit] Recorder error:',
                  event
                );


                cleanupRecorder();


                if (recordButton) {

                  recordButton.hidden =
                    false;

                  recordButton.disabled =
                    false;

                }


                if (stopButton) {

                  stopButton.hidden =
                    true;

                }


                updateRecitationTimer(
                  0
                );


                setText(
                  'profileRecitationStatus',
                  'Recording failed. Please try again.'
                );


                showFieldError(
                  'profileRecitationError',
                  'The microphone recording failed. Please try again.'
                );

              }
            );


            recorder.start(
              250
            );


            if (recordButton) {

              recordButton.hidden =
                true;

            }


            if (stopButton) {

              stopButton.hidden =
                false;

            }


            setText(
              'profileRecitationStatus',
              'Recording...'
            );


            startRecitationTimer();


          } catch (
            error
          ) {

            console.error(
              '[BarakaLink][Ustaz Profile Edit] Microphone access failed:',
              error
            );


            stopMicrophoneStream();


            const message =
              error?.name ===
                'NotAllowedError'
                  ? 'Microphone access was blocked. Allow microphone access and try again.'
                  : error?.name ===
                      'NotFoundError'
                    ? 'No microphone was found on this device.'
                    : error?.name ===
                        'NotReadableError'
                      ? 'The microphone is unavailable or already in use.'
                      : 'The microphone could not be opened. Check your browser microphone permission.';


       
function showFieldError(id, message) {
  const element = $(id);
  if (!element) return;

  element.textContent = safeString(message);

  const field =
    element.closest('.profile-edit-field, .auth-field') ||
    element.closest('.profile-edit-card');

  if (field) {
    field.classList.add('has-error');
  }

  // Add an accessible invalid state to the actual controls in this field.
  const controlScope = element.closest('.profile-edit-field, .auth-field');
  if (controlScope) {
    controlScope
      .querySelectorAll('input:not([type="file"]), select, textarea')
      .forEach((control) => {
        control.classList.add('is-invalid');
        control.setAttribute('aria-invalid', 'true');
      });
  }
}


            setText(
              'profileRecitationStatus',
              'Tap the microphone to try again.'
            );


            if (recordButton) {

              recordButton.hidden =
                false;

              recordButton.disabled =
                false;

            }


            if (stopButton) {

              stopButton.hidden =
                true;

            }

          }

        }
      );

    }


    if (
      stopButton &&
      stopButton.dataset.bound !==
        'true'
    ) {

      stopButton.dataset.bound =
        'true';


      stopButton.addEventListener(
        'click',
        () => {

          stopRecitationTimer();


          const recorder =
            state.mediaRecorder;


          if (
            recorder &&
            recorder.state !==
              'inactive'
          ) {

            try {

              recorder.stop();

            } catch (
              error
            ) {

              console.error(
                '[BarakaLink][Ustaz Profile Edit] Stop recording failed:',
                error
              );


              cleanupRecorder();


              if (recordButton) {

                recordButton.hidden =
                  false;

                recordButton.disabled =
                  false;

              }


              stopButton.hidden =
                true;

            }

          }

        }
      );

    }


    if (player) {

      player.addEventListener(
        'error',
        () => {

          setText(
            'profileRecitationStatus',
            'The recitation sample could not be loaded.'
          );

        }
      );

    }


    if (
      removeButton &&
      removeButton.dataset.bound !==
        'true'
    ) {

      removeButton.dataset.bound =
        'true';


      removeButton.addEventListener(
        'click',
        () => {

          cleanupRecorder();


          clearAudioObjectUrl();


          state.audioFile =
            null;


          state.audioRemoved =
            true;


          updateRecitationPlayer(
            ''
          );


          setText(
            'profileRecitationStatus',
            'Current recitation will be removed when you save.'
          );


          clearFieldError(
            'profileRecitationError'
          );

        }
      );

    }


    renderExistingRecitation();

  }


  /* =========================================================
     QUALIFICATIONS
  ========================================================== */

  function normalizeQualification(
    item
  ) {

    return {

      id:
        item?.id !== undefined &&
        item?.id !== null
          ? String(
              item.id
            )
          : '',

      title:
        safeString(
          item?.title
        ),

      institution:
        safeString(
          item?.institution
        ),

      year:
        safeString(
          item?.completionYear ??
          item?.completion_year ??
          item?.year
        ),

      specialization:
        safeString(
          item?.specialization
        ),

      certificateUrl:
        safeString(
          item?.certificateUrl ??
          item?.certificate_url
        ),

      certificateName:
        safeString(
          item?.certificateName ??
          item?.certificate_name
        )

    };

  }


  function setupQualificationItem(
    item,
    data = {}
  ) {

    if (!item) {

      return;

    }


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
          data.year ??
          data.completionYear
        );

    }


    if (specialization) {

      specialization.value =
        safeString(
          data.specialization
        );

    }


    if (
      data.id
    ) {

      item.dataset.qualificationId =
        String(
          data.id
        );

    }


    let removeButton =
      item.querySelector(
        '.ustaz-remove-qualification'
      );


    const header =
      item.querySelector(
        '.ustaz-qualification-header'
      );


    if (
      header &&
      !removeButton
    ) {

      removeButton =
        document.createElement(
          'button'
        );


      removeButton.type =
        'button';


      removeButton.className =
        'btn btn-outline ustaz-remove-qualification';


      removeButton.innerHTML = `
        <i
          class="fa-solid fa-trash"
          aria-hidden="true"
        ></i>
        Remove
      `;


      header.appendChild(
        removeButton
      );

    }


    if (
      removeButton &&
      removeButton.dataset.bound !==
        'true'
    ) {

      removeButton.dataset.bound =
        'true';


      removeButton.addEventListener(
        'click',
        () => {

          const id =
            safeString(
              item.dataset.qualificationId
            );


          if (id) {

            state.removedQualificationIds.add(
              id
            );

          }


          item.remove();


          renumberQualifications();


          clearFieldError(
            'profileQualificationError'
          );

        }
      );

    }

  }


  function appendQualificationItem(
    data = {}
  ) {

    const list =
      $('qualificationList');


    if (!list) {

      return;

    }


    const index =
      list.querySelectorAll(
        '[data-qualification-item]'
      ).length;


    const item =
      document.createElement(
        'div'
      );


    item.className =
      'ustaz-qualification-item profile-edit-qualification-item';


    item.dataset.qualificationItem =
      '';


    if (
      data.id
    ) {

      item.dataset.qualificationId =
        String(
          data.id
        );

    }


    item.innerHTML = `

      <div class="ustaz-qualification-header">

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


      <div class="profile-edit-grid">

        <div class="profile-edit-field profile-edit-field-full">

          <label>
            Qualification
          </label>

          <input
            class="auth-input"
            type="text"
            maxlength="150"
            placeholder="Qualification or Islamic studies program"
          >

        </div>


        <div class="profile-edit-field">

          <label>
            Institution
          </label>

          <input
            class="auth-input"
            type="text"
            maxlength="150"
            placeholder="Institution / Madrasa / Institute"
          >

        </div>


        <div class="profile-edit-field">

          <label>
            Year completed
          </label>

          <input
            class="auth-input"
            type="number"
            min="1900"
            max="2100"
            inputmode="numeric"
            placeholder="Year"
          >

        </div>


        <div class="profile-edit-field profile-edit-field-full">

          <label>
            Specialization
          </label>

          <input
            class="auth-input"
            type="text"
            maxlength="150"
            placeholder="Specialization"
          >

        </div>

      </div>


      <label class="file-input-label ustaz-qualification-upload">

        <span>

          <i
            class="fa-solid fa-file-arrow-up"
            aria-hidden="true"
          ></i>

          Supporting certificate

        </span>

        <input
          type="file"
          name="qualificationCertificates[]"
          accept=".pdf,image/jpeg,image/png,image/webp"
        >

      </label>

    `;


    const inputs =
      item.querySelectorAll(
        '.profile-edit-field input'
      );


    const title =
      inputs[0];


    const institution =
      inputs[1];


    const year =
      inputs[2];


    const specialization =
      inputs[3];


    if (title) {

      title.name =
        `qualifications[${index}][title]`;


      title.value =
        safeString(
          data.title
        );

    }


    if (institution) {

      institution.name =
        `qualifications[${index}][institution]`;


      institution.value =
        safeString(
          data.institution
        );

    }


    if (year) {

      year.name =
        `qualifications[${index}][year]`;


      year.value =
        safeString(
          data.year ??
          data.completionYear
        );

    }


    if (specialization) {

      specialization.name =
        `qualifications[${index}][specialization]`;


      specialization.value =
        safeString(
          data.specialization
        );

    }


    const fileInput =
      item.querySelector(
        'input[type="file"]'
      );


    if (fileInput) {

      fileInput.name =
        `qualificationCertificates[${index}]`;

    }


    const fileLabel =
      item.querySelector(
        '.file-input-label'
      );


    if (
      data.certificateUrl ||
      data.certificateName
    ) {

      const existing =
        document.createElement(
          'div'
        );


      existing.className =
        'ustaz-existing-certificate';


      if (
        data.certificateUrl
      ) {

        const link =
          document.createElement(
            'a'
          );


        link.href =
          resolveMediaUrl(
            data.certificateUrl
          );


        link.target =
          '_blank';


        link.rel =
          'noopener noreferrer';


        link.textContent =
          data.certificateName ||
          'View current certificate';


        existing.appendChild(
          link
        );

      } else {

        existing.textContent =
          data.certificateName;

      }


      if (fileLabel) {

        fileLabel.insertAdjacentElement(
          'afterend',
          existing
        );

      } else {

        item.appendChild(
          existing
        );

      }

    }


    list.appendChild(
      item
    );


    setupQualificationItem(
      item,
      data
    );

  }


  function renumberQualifications() {

    const items =
      $$(
        '[data-qualification-item]'
      );


    items.forEach(
      (
        item,
        index
      ) => {

        const strong =
          item.querySelector(
            '.ustaz-qualification-header strong'
          );


        if (strong) {

          strong.textContent =
            `Qualification ${index + 1}`;

        }


        $$(
          'input',
          item
        )
          .forEach(
            input => {

              if (
                input.type ===
                'file'
              ) {

                input.name =
                  `qualificationCertificates[${index}]`;


                return;

              }


              const name =
                input.getAttribute(
                  'name'
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

  }


  function renderQualifications() {

    const list =
      $('qualificationList');


    if (!list) {

      return;

    }


    const serverItems =
      Array.isArray(
        state.qualifications
      )
        ? state.qualifications.map(
            normalizeQualification
          )
        : [];


    list.innerHTML =
      '';


    if (
      serverItems.length
    ) {

      serverItems.forEach(
        appendQualificationItem
      );


      return;

    }


    appendQualificationItem(
      {}
    );

  }


  /* =========================================================
     FORM COLLECTION
  ========================================================== */

  function collectStudyFields() {

    const values =
      $$(
        'input[name="studyFields"]:checked'
      )
        .map(
          input =>
            normalizeStudyField(
              input.value
            )
        )
        .filter(Boolean);


    return Array.from(
      new Set(
        values
      )
    );

  }


  function collectLanguages() {

    return $$(
      'input[name="languages"]:checked'
    )
      .map(
        input =>
          safeString(
            input.value
          ).toLowerCase()
      )
      .filter(Boolean);

  }


  function collectQualifications() {

    return $$(
      '[data-qualification-item]'
    )
      .map(
        (
          item,
          index
        ) => {

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


          const file =
            item.querySelector(
              'input[type="file"]'
            );


          return {

            index,

            id:
              safeString(
                item.dataset.qualificationId
              ),

            title:
              safeString(
                title?.value
              ),

            institution:
              safeString(
                institution?.value
              ),

            year:
              safeString(
                year?.value
              ),

            specialization:
              safeString(
                specialization?.value
              ),

            certificateFile:
              file?.files?.[0] ||
              null

          };

        }
      )
      .filter(
        item =>
          item.title ||
          item.institution ||
          item.year ||
          item.specialization ||
          item.certificateFile
      );

  }


  /* =========================================================
     VALIDATION
  ========================================================== */

  function validateLocationAndExperience() {

    let valid =
      true;


    clearFieldError(
      'profileLocationError'
    );


    clearFieldError(
      'profileAreaError'
    );


    clearFieldError(
      'profileMosqueError'
    );


    clearFieldError(
      'profileNearestMosqueError'
    );


    clearFieldError(
      'profileExperienceError'
    );


    const subcity =
      safeString(
        $('profileSubcity')?.value
      );


    if (!subcity) {

      showFieldError(
        'profileLocationError',
        'Please select your sub-city.'
      );


      valid =
        false;

    }


    const area =
      safeString(
        $('profileArea')?.value
      );


    if (!area) {

      showFieldError(
        'profileAreaError',
        'Please select your area.'
      );


      valid =
        false;

    }


    const mosque =
      safeString(
        $('profileNearestMosque')?.value
      );


    if (
      mosque.length <
      2
    ) {

      showFieldError(
        'profileMosqueError',
        'Please enter your nearest mosque.'
      );


      valid =
        false;

    } else if (
      mosque.length >
      150
    ) {

      showFieldError(
        'profileMosqueError',
        'Nearest mosque must be 150 characters or fewer.'
      );


      valid =
        false;

    }


    const experienceValue =
      safeString(
        $('profileExperience')?.value
      );


    if (
      experienceValue !==
      ''
    ) {

      const experience =
        Number(
          experienceValue
        );


      if (
        !Number.isInteger(
          experience
        ) ||
        experience < 0 ||
        experience > 60
      ) {

        showFieldError(
          'profileExperienceError',
          'Experience must be between 0 and 60 years.'
        );


        valid =
          false;

      }

    }


    return valid;

  }


  function validateTeachingProfile() {

    let valid =
      true;


    clearFieldError(
      'profilePhotoError'
    );


    clearFieldError(
      'profileBioError'
    );


    clearFieldError(
      'profileDateOfBirthError'
    );


    clearFieldError(
      'profileStudyFieldsError'
    );


    clearFieldError(
      'profileLanguagesError'
    );


    clearFieldError(
      'profileRecitationError'
    );


    clearFieldError(
      'profileHourlyRateError'
    );


    clearFieldError(
      'profileLessonFormatError'
    );
clearFieldError(
      'profileTeachingApproachError'
    );


    clearFieldError(
      'profileQualificationError'
    );


    /* -------------------------------------------------------
       BIO
    ------------------------------------------------------- */

    const bio =
      safeString(
        $('profileBio')?.value
      );


    if (
      bio.length <
      20
    ) {

      showFieldError(
        'profileBioError',
        'Please write at least 20 characters about yourself.'
      );


      valid =
        false;

    }


    if (
      bio.length >
      CONFIG.MAX_BIO_LENGTH
    ) {

      showFieldError(
        'profileBioError',
        'Bio must be 1500 characters or fewer.'
      );


      valid =
        false;

    }


    /* -------------------------------------------------------
       PHOTO
    ------------------------------------------------------- */

    const photoExists =
      Boolean(
        state.photoFile ||
        (
          hasExistingPhoto() &&
          !state.photoRemoved
        )
      );


    if (!photoExists) {

      showFieldError(
        'profilePhotoError',
        'Please add a profile photo.'
      );


      valid =
        false;

    }


    /* -------------------------------------------------------
       STUDY FIELDS
    ------------------------------------------------------- */

    const studyFields =
      collectStudyFields();


    if (
      !studyFields.length
    ) {

      showFieldError(
        'profileStudyFieldsError',
        'Please select at least one teaching subject.'
      );


      valid =
        false;

    }


    /* -------------------------------------------------------
       LANGUAGES
    ------------------------------------------------------- */

    const languages =
      collectLanguages();


    if (
      !languages.length
    ) {

      showFieldError(
        'profileLanguagesError',
        'Please select at least one language.'
      );


      valid =
        false;

    }


    /* -------------------------------------------------------
       HOURLY RATE
    ------------------------------------------------------- */

    const hourlyRate =
      Number(
        $('profileHourlyRate')?.value
      );


    if (
      !Number.isFinite(
        hourlyRate
      ) ||
      hourlyRate <=
        0
    ) {

      showFieldError(
        'profileHourlyRateError',
        'Please enter a valid price per hour.'
      );


      valid =
        false;

    }


    /* -------------------------------------------------------
       LESSON FORMAT
    ------------------------------------------------------- */

    const lessonFormat =
      document.querySelector(
        'input[name="lessonFormat"]:checked'
      );


    if (!lessonFormat) {

      showFieldError(
        'profileLessonFormatError',
        'Please select a lesson format.'
      );


      valid =
        false;

    }


    /* -------------------------------------------------------
       QUALIFICATIONS
    ------------------------------------------------------- */

    const qualifications =
      collectQualifications();


    for (
      const qualification of
      qualifications
    ) {

      const empty =
        !(
          qualification.title ||
          qualification.institution ||
          qualification.year ||
          qualification.specialization
        );


      if (empty) {

        continue;

      }


      if (
        !qualification.title
      ) {

        showFieldError(
          'profileQualificationError',
          `Qualification ${qualification.index + 1}: title is required.`
        );


        valid =
          false;


        break;

      }


      if (
        !qualification.institution
      ) {

        showFieldError(
          'profileQualificationError',
          `Qualification ${qualification.index + 1}: institution is required.`
        );


        valid =
          false;


        break;

      }


      if (
        qualification.year
      ) {

        const year =
          Number(
            qualification.year
          );


        if (
          !Number.isInteger(
            year
          ) ||
          year < 1900 ||
          year > 2100
        ) {

          showFieldError(
            'profileQualificationError',
            `Qualification ${qualification.index + 1}: invalid year.`
          );


          valid =
            false;


          break;

        }

      }

    }


    return valid;

  }


  /* =========================================================
     BASIC PROFILE PAYLOAD
  ========================================================== */

  function buildBasicProfilePayload() {

    const studyFields =
      collectStudyFields();


    return {

      firstName:
        state.user?.firstName ??
        state.user?.first_name ??
        '',

      lastName:
        state.user?.lastName ??
        state.user?.last_name ??
        '',

      phone:
        state.user?.phone ??
        '',

      gender:
        safeString(
          state.teacher?.gender
        )
          .toLowerCase(),

      subcity:
        safeString(
          $('profileSubcity')?.value
        ),

      area:
        safeString(
          $('profileArea')?.value
        ),

      nearestMosque:
        safeString(
          $('profileNearestMosque')?.value
        ),

      experience:
        safeString(
          $('profileExperience')?.value
        ),

      /*
       * NEW:
       * Send the currently selected teaching subjects
       * through the normal JSON profile update too.
       */
      studyFields:
        studyFields

    };

  }


  /* =========================================================
     ADVANCED FORM DATA
  ========================================================== */

  function buildAdvancedFormData() {

    const data =
      new FormData();


    const dateOfBirth =
      normalizeDateInputValue(
        $('profileDateOfBirth')?.value
      );


    data.append(
      'role',
      'ustaz'
    );


    if (
      dateOfBirth
    ) {

      data.append(
        'dateOfBirth',
        dateOfBirth
      );

    }


    data.append(
      'bio',
      safeString(
        $('profileBio')?.value
      )
    );


    data.append(
      'recitationTitle',
      safeString(
        $('profileRecitationTitle')?.value
      )
    );


    data.append(
      'recitationDescription',
      safeString(
        $('profileRecitationDescription')?.value
      )
    );


    data.append(
      'teachingApproach',
      safeString(
        $('profileTeachingApproach')?.value
      )
    );


    data.append(
      'hourlyRate',
      safeString(
        $('profileHourlyRate')?.value
      )
    );


    data.append(
      'lessonDuration',
      safeString(
        $('profileLessonDuration')?.value
      )
    );


    const lessonFormat =
      document.querySelector(
        'input[name="lessonFormat"]:checked'
      )?.value ||
      '';


    data.append(
      'lessonFormat',
      lessonFormat
    );


    /* -------------------------------------------------------
       LOCATION / EXPERIENCE
    ------------------------------------------------------- */

    const subcity =
      safeString(
        $('profileSubcity')?.value
      );


    const area =
      safeString(
        $('profileArea')?.value
      );


    const mosque =
      safeString(
        $('profileNearestMosque')?.value
      );


    const experience =
      safeString(
        $('profileExperience')?.value
      );


    if (
      subcity
    ) {

      data.append(
        'subcity',
        subcity
      );

    }


    if (
      area
    ) {

      data.append(
        'area',
        area
      );

    }


    if (
      mosque
    ) {

      data.append(
        'nearestMosque',
        mosque
      );

    }


    data.append(
      'experience',
      experience
    );


    /* -------------------------------------------------------
       TEACHING SUBJECTS
    ------------------------------------------------------- */

    const studyFields =
      collectStudyFields();


    studyFields.forEach(
      studyField => {

        data.append(
          'studyFields[]',
          studyField
        );

      }
    );


    /* -------------------------------------------------------
       LANGUAGES
    ------------------------------------------------------- */

    collectLanguages()
      .forEach(
        language => {

          data.append(
            'languages[]',
            language
          );

        }
      );

    /*
     * Keep the existing saved teaching days unchanged while the edit-page
     * day selector is removed. The current backend replaces the stored list
     * on every advanced-edit save, so pass the existing values through.
     */
    state.availability
      .map(normalizeDay)
      .filter(Boolean)
      .forEach(day => {
        data.append('availabilityDays[]', day);
      });


    /* -------------------------------------------------------
       QUALIFICATIONS
    ------------------------------------------------------- */

    collectQualifications()
      .forEach(
        qualification => {

          if (
            qualification.id
          ) {

            data.append(
              `qualifications[${qualification.index}][id]`,
              qualification.id
            );

          }


          data.append(
            `qualifications[${qualification.index}][title]`,
            qualification.title
          );


          data.append(
            `qualifications[${qualification.index}][institution]`,
            qualification.institution
          );


          data.append(
            `qualifications[${qualification.index}][year]`,
            qualification.year
          );


          data.append(
            `qualifications[${qualification.index}][specialization]`,
            qualification.specialization
          );


          if (
            qualification.certificateFile
          ) {

            data.append(
              `qualificationCertificates[${qualification.index}]`,
              qualification.certificateFile
            );

          }

        }
      );


    /* -------------------------------------------------------
       REMOVED QUALIFICATIONS
    ------------------------------------------------------- */

    state.removedQualificationIds
      .forEach(
        id => {

          data.append(
            'removedQualificationIds[]',
            id
          );

        }
      );


    /* -------------------------------------------------------
       RECITATION
    ------------------------------------------------------- */

    if (
      state.audioFile
    ) {

      data.append(
        'recitationAudio',
        state.audioFile
      );

    }


    if (
      state.audioRemoved &&
      !state.audioFile
    ) {

      data.append(
        'removeRecitation',
        'true'
      );

    }


    /*
     * NEVER append Fayda National ID in edit mode.
     */

    return data;

  }


  /* =========================================================
     SAVE BUTTON
  ========================================================== */

  function setSaveButtonSaving(
    isSaving
  ) {

    const button =
      $('profileSaveButton');


    const buttonText =
      $('profileSaveButtonText');


    const buttonIcon =
      $('profileSaveButtonIcon');


    if (button) {

      button.disabled =
        isSaving;

    }


    if (buttonText) {

      buttonText.textContent =
        isSaving
          ? 'Saving...'
          : 'Save profile';

    }


    if (buttonIcon) {

      buttonIcon.className =
        isSaving
          ? 'fa-solid fa-circle-notch fa-spin'
          : 'fa-solid fa-check';

    }

  }


/* =========================================================
   SAVE EVERYTHING
========================================================== */

async function saveAll() {

  if (
    state.saving
  ) {

    return;

  }


  clearAllErrors();


  const basicValid =
    validateLocationAndExperience();


  const teachingValid =
    validateTeachingProfile();


  if (
    !basicValid ||
    !teachingValid
  ) {

    setStatus(
      'Please review the highlighted fields.',
      'is-error'
    );


    const firstError =
      document.querySelector(
        '.has-error'
      );


    if (
      firstError
    ) {

      firstError.scrollIntoView({
        behavior:
          'smooth',

        block:
          'center'
      });

    }


    return;

  }


  state.saving =
    true;


  setSaveButtonSaving(
    true
  );


  setStatus(
    'Saving your complete teaching profile...',
    'is-loading'
  );


  const selectedStudyFields =
    collectStudyFields();


  console.info(
    '[BarakaLink][Ustaz Profile Edit] Subjects being saved:',
    selectedStudyFields
  );


  try {

    /* -------------------------------------------------------
       1. BASIC PROFILE
    ------------------------------------------------------- */

    const basicPayload =
      buildBasicProfilePayload();


    console.info(
      '[BarakaLink][Ustaz Profile Edit] PATCH /profile payload:',
      basicPayload
    );


    await apiRequest(
      CONFIG.PROFILE_ENDPOINT,
      {

        method:
          'PATCH',

        headers: {

          'Content-Type':
            'application/json'

        },

        body:
          JSON.stringify(
            basicPayload
          )

      }
    );


    /* -------------------------------------------------------
       2. ADVANCED TEACHING PROFILE
    ------------------------------------------------------- */

    const advancedFormData =
      buildAdvancedFormData();


    console.info(
      '[BarakaLink][Ustaz Profile Edit] Advanced studyFields:',
      advancedFormData.getAll(
        'studyFields[]'
      )
    );


    const advancedResponse =
      await apiRequest(
        CONFIG.ADVANCED_EDIT_ENDPOINT,
        {

          method:
            'PATCH',

          body:
            advancedFormData

        }
      );


    if (
      advancedResponse?.success ===
      false
    ) {

      throw new Error(
        advancedResponse?.message ||
        'The server could not save your teaching profile.'
      );

    }


    /* -------------------------------------------------------
       3. PROFILE PHOTO
    ------------------------------------------------------- */

    if (
      state.photoFile
    ) {

      await uploadPhotoIfNeeded();

    }


    /* -------------------------------------------------------
       4. SUCCESS
       -------------------------------------------------------

       We do NOT reload the edit page here.

       The profile has already been saved successfully,
       so send the Ustaz back to the dashboard.
    */

    setStatus(
      advancedResponse?.message ||
      'Your Ustaz profile was updated successfully.',
      'is-success'
    );


    /*
     * Give the success message a moment to render before
     * navigating. This is short enough that the user does
     * not feel stuck, while still making the save feedback
     * visible.
     */

    setTimeout(
      () => {

        window.location.replace(
          'dashboard/teacher.html'
        );

      },
      500
    );


  } catch (
    error
  ) {

    console.error(
      '[BarakaLink][Ustaz Profile Edit] Save failed:',
      error
    );


    if (
      error?.status ===
        401 ||
      error?.code ===
        'UNAUTHORIZED'
    ) {

      redirectToLogin();

      return;

    }


    setStatus(
      error?.message ||
      'We could not save your teaching profile.',
      'is-error'
    );


  } finally {

    state.saving =
      false;


    setSaveButtonSaving(
      false
    );

  }

}

  /* =========================================================
     FORM
  ========================================================== */

  function setupForm() {

    const form =
      $('ustazProfileCompletionForm');


    if (
      !form ||
      form.dataset.ustazEditBound ===
        'true'
    ) {

      return;

    }


    form.dataset.ustazEditBound =
      'true';


    form.addEventListener(
      'submit',
      async event => {

        event.preventDefault();


        await saveAll();

      }
    );

  }


  /* =========================================================
     BACK LINK
  ========================================================== */

  function setupBackLink() {

    const link =
      $('ustazBackToDashboard');


    if (link) {

      link.href =
        'dashboard/teacher.html';

    }

  }


  /* =========================================================
     LOGOUT
  ========================================================== */

  function logout() {

    cleanupRecorder();

    clearAudioObjectUrl();

    cleanupPhotoObjectUrl();

    clearSession();


    window.location.replace(
      'index.html'
    );

  }


  function setupLogout() {

    const buttons = [

      $('logoutButton'),

      $('profileLogoutButton')

    ]
      .filter(
        Boolean
      );


    buttons.forEach(
      button => {

        if (
          button.dataset.ustazEditBound ===
          'true'
        ) {

          return;

        }


        button.dataset.ustazEditBound =
          'true';


        button.addEventListener(
          'click',
          logout
        );

      }
    );

  }


  /* =========================================================
     FIELD EVENTS
  ========================================================== */

  function setupFieldEvents() {

    const form =
      $('ustazProfileCompletionForm');


    if (
      !form ||
      form.dataset.fieldEventsBound ===
        'true'
    ) {

      return;

    }


    form.dataset.fieldEventsBound =
      'true';


    form.addEventListener(
      'input',
      event => {

        const target =
          event.target;


        if (
          target?.id ===
          'profileBio'
        ) {

          updateBioCounter();

          clearFieldError(
            'profileBioError'
          );

        }


        if (
          target?.id ===
          'profileNearestMosque'
        ) {

          clearFieldError(
            'profileMosqueError'
          );


          clearFieldError(
            'profileNearestMosqueError'
          );

        }


        if (
          target?.id ===
          'profileExperience'
        ) {

          clearFieldError(
            'profileExperienceError'
          );

        }


        if (
          target?.id ===
          'profileHourlyRate'
        ) {

          clearFieldError(
            'profileHourlyRateError'
          );

        }


        if (
          target?.id ===
          'profileTeachingApproach'
        ) {

          clearFieldError(
            'profileTeachingApproachError'
          );

        }

      }
    );


    form.addEventListener(
      'change',
      event => {

        const target =
          event.target;


        /* -----------------------------------------------------
           STUDY SUBJECTS
        ----------------------------------------------------- */

        if (
          target?.name ===
          'studyFields'
        ) {

          clearFieldError(
            'profileStudyFieldsError'
          );


          console.info(
            '[BarakaLink][Ustaz Profile Edit] Current subjects:',
            collectStudyFields()
          );

        }


        /* -----------------------------------------------------
           LANGUAGES
        ----------------------------------------------------- */

        if (
          target?.name ===
          'languages'
        ) {

          clearFieldError(
            'profileLanguagesError'
          );

        }


        /* -----------------------------------------------------
           LESSON FORMAT
        ----------------------------------------------------- */

        if (
          target?.name ===
          'lessonFormat'
        ) {

          clearFieldError(
            'profileLessonFormatError'
          );

        }


        /* -----------------------------------------------------
           SUBCITY
        ----------------------------------------------------- */

        if (
          target?.id ===
          'profileSubcity'
        ) {

          populateAreas(
            target.value,
            ''
          );


          clearFieldError(
            'profileLocationError'
          );


          clearFieldError(
            'profileAreaError'
          );

        }


        /* -----------------------------------------------------
           AREA
        ----------------------------------------------------- */

        if (
          target?.id ===
          'profileArea'
        ) {

          clearFieldError(
            'profileAreaError'
          );

        }


        updateChoiceVisualState();

      }
    );

  }


  /* =========================================================
     ADD QUALIFICATION
  ========================================================== */

  function setupAddQualification() {

    const button =
      $('addQualification');


    if (
      !button ||
      button.dataset.ustazEditBound ===
        'true'
    ) {

      return;

    }


    button.dataset.ustazEditBound =
      'true';


    button.addEventListener(
      'click',
      () => {

        appendQualificationItem(
          {}
        );


        renumberQualifications();

      }
    );

  }


  /* =========================================================
     LOAD PROFILE
  ========================================================== */

  async function loadProfile(
    showLoading = true
  ) {

    if (showLoading) {

      setStatus(
        'Loading your profile...',
        'is-loading'
      );

    }


    const payload =
      await apiRequest(
        CONFIG.PROFILE_ENDPOINT,
        {

          method:
            'GET',

          cache:
            'no-store'

        }
      );


    const extracted =
      extractProfile(
        payload
      );


    const role =
      safeString(
        extracted.user?.role
      )
        .toLowerCase();


    if (
      role !==
      'ustaz'
    ) {

      throw new Error(
        'This page is only available for Ustaz / Ustaza accounts.'
      );

    }


    state.user =
      extracted.user;


    state.teacher =
      extracted.teacher;


    state.studyFields =
      Array.isArray(
        extracted.studyFields
      )
        ? extracted.studyFields
        : [];


    state.languages =
      Array.isArray(
        extracted.languages
      )
        ? extracted.languages
        : [];


    state.availability =
      Array.isArray(
        extracted.availability
      )
        ? extracted.availability
        : [];


    state.qualifications =
      Array.isArray(
        extracted.qualifications
      )
        ? extracted.qualifications
        : [];


    console.info(
      '[BarakaLink][Ustaz Profile Edit] Loaded study fields:',
      state.studyFields
    );


    renderRegistrationInfo();


    renderAllEditableFields();


    renderPhotoPreview();


    renderExistingRecitation();


    updateBioCounter();


    updateChoiceVisualState();


    if (showLoading) {

      setStatus(
        '',
        ''
      );

    }


    return extracted;

  }


  /* =========================================================
     CLEANUP
  ========================================================== */

  function cleanup() {

    cleanupRecorder();

    clearAudioObjectUrl();

    cleanupPhotoObjectUrl();

  }


  /* =========================================================
     INITIALIZATION
  ========================================================== */

  async function initialize() {

    const form =
      $('ustazProfileCompletionForm');


    if (!form) {

      console.warn(
        '[BarakaLink][Ustaz Profile Edit] Edit form not found.'
      );


      return;

    }


    if (
      !getToken()
    ) {

      redirectToLogin();

      return;

    }


    try {

      /*
       * Always load authoritative server data first.
       */

      await loadProfile(
        true
      );


      setupBackLink();

      setupLogout();

      setupForm();

      setupFieldEvents();

      setupAddQualification();

      setupPhoto();

      setupRecitation();


      /*
       * Final protection against date-format problems.
       */

      const dob =
        $('profileDateOfBirth');


      if (dob) {

        dob.value =
          normalizeDateInputValue(
            dob.value
          );


        dob.disabled =
          true;


        dob.readOnly =
          true;


        dob.setAttribute(
          'aria-readonly',
          'true'
        );


        dob.setAttribute(
          'tabindex',
          '-1'
        );

      }


      updateBioCounter();

      updateChoiceVisualState();

      renderPhotoPreview();


      setStatus(
        '',
        ''
      );


      console.info(
        '[BarakaLink][Ustaz Profile Edit] Initialized.',
        {

          userId:
            state.user?.id,

          teacherProfileId:
            state.teacher?.id,

          studyFieldCount:
            state.studyFields.length,

          currentStudyFields:
            state.studyFields
              .map(
                normalizeStudyField
              )
              .filter(Boolean),

          languageCount:
            state.languages.length,

          availabilityCount:
            state.availability.length,

          qualificationCount:
            state.qualifications.length,

          advancedEditEndpoint:
            CONFIG.ADVANCED_EDIT_ENDPOINT,

          singlePage:
            true

        }
      );


    } catch (
      error
    ) {

      console.error(
        '[BarakaLink][Ustaz Profile Edit] Initialization failed:',
        error
      );


      if (
        error?.status ===
          401 ||
        error?.code ===
          'UNAUTHORIZED'
      ) {

        redirectToLogin();

        return;

      }


      setStatus(
        error?.message ||
        'We could not load your BarakaLink profile.',
        'is-error'
      );

    }

  }


  /* =========================================================
     GLOBAL CLEANUP HOOK
  ========================================================== */

  if (
    !window.__barakaLinkUstazEditCleanupBound
  ) {

    window.__barakaLinkUstazEditCleanupBound =
      true;


    window.addEventListener(
      'pagehide',
      cleanup
    );


    window.addEventListener(
      'beforeunload',
      cleanup
    );

  }


  /* =========================================================
     PUBLIC DEBUG API
  ========================================================== */

  window.BarakaLinkUstazProfileEdit = {

    reload:
      () =>
        loadProfile(
          true
        ),

    save:
      saveAll,

    saveAll:
      saveAll,

    getState() {

      return {

        user:
          state.user,

        teacher:
          state.teacher,

        studyFields:
          collectStudyFields(),

        languages:
          state.languages,

        availability:
          state.availability,

        qualifications:
          state.qualifications,

        photoSelected:
          Boolean(
            state.photoFile
          ),

        recitationSelected:
          Boolean(
            state.audioFile
          ),

        advancedEditEndpoint:
          CONFIG.ADVANCED_EDIT_ENDPOINT,

        singlePage:
          true

      };

    }

  };


  /* =========================================================
     START
  ========================================================== */

  if (
    document.readyState ===
    'loading'
  ) {

    document.addEventListener(
      'DOMContentLoaded',
      initialize,
      {
        once:
          true
      }
    );

  } else {

    initialize();

  }

})();