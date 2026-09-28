/* =========================================================
   BARAKALINK
   PROFILE EDIT PAGE

   Responsible for:
   - Loading the authenticated user's complete profile.
   - Loading profile preferences.
   - Editing personal information.
   - Editing location and nearest mosque.
   - Editing Ustaz/Ustaza teaching information.
   - Editing learning preferences.
   - Uploading/replacing/removing profile photo.
   - Returning to the correct dashboard after a successful save.

   IMPORTANT:
   - Authentication identity always comes from the JWT.
   - No user_id is accepted from the browser.
   - Phone number remains read-only.
   - users.avatar_url stores the public relative photo URL.
   - Actual photo files are stored by the backend.
========================================================= */

'use strict';

(function () {


  /* =======================================================
     CONFIGURATION
  ======================================================= */

  const PROFILE_ENDPOINT =
    '/profile';

  const PREFERENCES_ENDPOINT =
    '/profile/preferences';

  const PHOTO_ENDPOINT =
    '/profile/photo';

  const API_BASE =
    String(
      window.BARAKALINK_API_BASE ||
      'http://localhost:5000/api'
    ).replace(/\/+$/, '');

  const API_ORIGIN =
    computeApiOrigin(API_BASE);

  const MAX_PROFILE_PHOTO_BYTES =
    5 * 1024 * 1024;

  const ALLOWED_PROFILE_PHOTO_TYPES =
    new Set([
      'image/jpeg',
      'image/png',
      'image/webp',
    ]);

  const DASHBOARD_PARENT =
    'student.html';

  const DASHBOARD_USTAZ =
    'teacher.html';


  /* =======================================================
     AREA DATA
  ======================================================= */

  const AREA_OPTIONS = Object.freeze({

    bole: [
      { value: 'bole-medhanialem', label: 'Bole Medhanialem' },
      { value: 'atlas', label: 'Atlas' },
      { value: 'gerji', label: 'Gerji' },
      { value: 'airport', label: 'Airport' },
    ],

    yeka: [
      { value: 'cmc', label: 'CMC' },
      { value: 'kotebe', label: 'Kotebe' },
      { value: 'megenagna', label: 'Megenagna' },
      { value: 'yeka-abado', label: 'Yeka Abado' },
    ],

    kirkos: [
      { value: 'kazanchis', label: 'Kazanchis' },
      { value: 'mexico', label: 'Mexico' },
      { value: 'meskel-square', label: 'Meskel Square' },
      { value: 'wello-sefer', label: 'Wello Sefer' },
    ],

    arada: [
      { value: 'piazza', label: 'Piazza' },
      { value: 'arat-kilo', label: 'Arat Kilo' },
      { value: 'shiro-meda', label: 'Shiro Meda' },
    ],

    lideta: [
      { value: 'lideta', label: 'Lideta' },
      { value: 'teklehaimanot', label: 'Teklehaimanot' },
      { value: 'tewodros', label: 'Tewodros' },
    ],

    'nifas-silk': [
      { value: 'sar-bet', label: 'Sar Bet' },
      { value: 'lafto', label: 'Lafto' },
      { value: 'weyra', label: 'Weyra' },
    ],

    kolfe: [
      { value: 'kolfe', label: 'Kolfe' },
      { value: 'bethel', label: 'Bethel' },
      { value: 'ayer-tena', label: 'Ayer Tena' },
    ],

    akaki: [
      { value: 'akaki', label: 'Akaki' },
      { value: 'kaliti', label: 'Kaliti' },
      { value: 'qality', label: 'Qality' },
    ],

  });


  const TEACHING_STUDY_FIELDS = Object.freeze([
    { value: 'quran-basic', label: 'Quran Basic' },
    { value: 'tajweed', label: 'Tajweed' },
    { value: 'hifz', label: 'Hifz' },
    { value: 'tafseer', label: 'Tafseer' },
    { value: 'hadith', label: 'Hadith' },
    { value: 'tarbiyah', label: 'Tarbiyah' },
  ]);


  const LEARNING_STUDY_INTERESTS = Object.freeze([
    { value: 'quran-basic', label: 'Quran Basic' },
    { value: 'tajweed', label: 'Tajweed' },
    { value: 'hifz', label: 'Hifz' },
    { value: 'tafseer', label: 'Tafseer' },
    { value: 'hadith', label: 'Hadith' },
    { value: 'tarbiyah', label: 'Tarbiyah' },
  ]);


  const CONTENT_INTERESTS = Object.freeze([
    { value: 'quran', label: 'Quran' },
    { value: 'tafseer', label: 'Tafseer' },
    { value: 'hadith', label: 'Hadith' },
    { value: 'seerah', label: 'Seerah' },
    { value: 'aqeedah', label: 'Aqeedah' },
    { value: 'fiqh', label: 'Fiqh' },
    { value: 'dua-adhkar', label: 'Dua & Adhkar' },
    { value: 'islamic-manners-character', label: 'Islamic Manners & Character' },
    { value: 'stories-of-the-prophets', label: 'Stories of the Prophets' },
    { value: 'family-parenting-islam', label: 'Family & Parenting in Islam' },
    { value: 'childrens-islamic-education', label: "Children's Islamic Education" },
    { value: 'islamic-history', label: 'Islamic History' },
  ]);


  const VALID_TEACHER_GENDER_PREFERENCES =
    new Set([
      'male',
      'female',
      'no-preference',
    ]);

  const VALID_CONTENT_INTERESTS =
    new Set(
      CONTENT_INTERESTS.map(
        item => item.value
      )
    );

  const VALID_STUDY_INTERESTS =
    new Set(
      LEARNING_STUDY_INTERESTS.map(
        item => item.value
      )
    );

  const VALID_TEACHING_STUDY_FIELDS =
    new Set(
      TEACHING_STUDY_FIELDS.map(
        item => item.value
      )
    );


  /* =======================================================
     DOM
  ======================================================= */

  const form =
    document.getElementById(
      'profileEditForm'
    );

  const statusElement =
    document.getElementById(
      'profileEditStatus'
    );

  const backLink =
    document.getElementById(
      'profileEditBackLink'
    );

  const roleInput =
    document.getElementById(
      'profileEditRole'
    );

  const phoneInput =
    document.getElementById(
      'profileEditPhone'
    );

  const phoneStatus =
    document.getElementById(
      'profileEditPhoneStatus'
    );

  const firstNameInput =
    document.getElementById(
      'profileEditFirstName'
    );

  const lastNameInput =
    document.getElementById(
      'profileEditLastName'
    );

  const bioInput =
    document.getElementById(
      'profileEditBio'
    );

  const bioCount =
    document.getElementById(
      'profileEditBioCount'
    );

  const subcityInput =
    document.getElementById(
      'profileEditSubcity'
    );

  const areaInput =
    document.getElementById(
      'profileEditArea'
    );

  const mosqueInput =
    document.getElementById(
      'profileEditMosque'
    );

  const teacherSection =
    document.getElementById(
      'profileEditTeacherSection'
    );

  const experienceInput =
    document.getElementById(
      'profileEditExperience'
    );

  const genderInput =
    document.getElementById(
      'profileEditGender'
    );

  const teachingFieldsContainer =
    document.getElementById(
      'profileEditStudyFields'
    );

  const teacherPreferencesContainer =
    document.getElementById(
      'profileEditTeacherPreferences'
    );

  const studyInterestsContainer =
    document.getElementById(
      'profileEditStudyInterests'
    );

  const contentInterestsContainer =
    document.getElementById(
      'profileEditContentInterests'
    );

  const photoInput =
    document.getElementById(
      'profileEditPhotoInput'
    );

  const photoPreview =
    document.getElementById(
      'profileEditPhotoPreview'
    );

  const photoInitials =
    document.getElementById(
      'profileEditPhotoInitials'
    );

  const photoName =
    document.getElementById(
      'profileEditPhotoName'
    );

  const photoChangeButton =
    document.getElementById(
      'profileEditPhotoChange'
    );

  const photoRemoveButton =
    document.getElementById(
      'profileEditPhotoRemove'
    );

  const saveButton =
    document.getElementById(
      'profileEditSaveButton'
    );

  const saveText =
    document.getElementById(
      'profileEditSaveText'
    );

  const saveIcon =
    document.getElementById(
      'profileEditSaveIcon'
    );


  /* =======================================================
     STATE
  ======================================================= */

  let currentUser =
    null;

  let currentProfile =
    null;

  let currentPreferences =
    null;

  let currentStepPhotoUrl =
    '';

  let localPhotoFile =
    null;

  let localPhotoObjectUrl =
    null;

  let saveInProgress =
    false;


  /* =======================================================
     BASIC HELPERS
  ======================================================= */

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

    const stringValue =
      String(value).trim();

    return stringValue || fallback;

  }


  function normalizeArray(
    value
  ) {

    if (
      !Array.isArray(value)
    ) {

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
            item =>
              String(item).trim().toLowerCase()
          )
          .filter(Boolean)
      ),
    ];

  }


  function computeApiOrigin(
    base
  ) {

    try {

      return new URL(
        base,
        window.location.origin
      ).origin;

    } catch {

      return window.location.origin;

    }

  }


  function resolvePhotoUrl(
    value
  ) {

    const raw =
      safeString(value);

    if (!raw) {
      return '';
    }

    if (
      /^https?:\/\//i.test(raw)
    ) {

      return raw;

    }

    try {

      return new URL(
        raw.startsWith('/')
          ? raw
          : `/${raw}`,
        `${API_ORIGIN}/`
      ).href;

    } catch {

      return raw;

    }

  }


  function getToken() {

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
      localStorage.getItem('barakalink_token') ||
      localStorage.getItem('token') ||
      ''
    );

  }


  function clearSession() {

    if (
      window.BarakaLinkAPI &&
      typeof window.BarakaLinkAPI.clearToken ===
        'function'
    ) {

      window.BarakaLinkAPI.clearToken();

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
      '../index.html'
    );

  }


  function dashboardForRole(
    role
  ) {

    return String(role || '')
      .trim()
      .toLowerCase() === 'ustaz'
      ? DASHBOARD_USTAZ
      : DASHBOARD_PARENT;

  }


  function setStatus(
    message,
    type = ''
  ) {

    if (!statusElement) {
      return;
    }

    statusElement.textContent =
      message || '';

    statusElement.classList.remove(
      'is-success',
      'is-error',
      'is-loading'
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
      document.getElementById(id);

    if (!element) {
      return;
    }

    element.textContent =
      message || '';

  }


  function clearErrors() {

    [
      'profileEditNameError',
      'profileEditBioError',
      'profileEditSubcityError',
      'profileEditAreaError',
      'profileEditMosqueError',
      'profileEditExperienceError',
      'profileEditGenderError',
      'profileEditStudyFieldsError',
      'profileEditTeacherPreferenceError',
      'profileEditStudyInterestsError',
      'profileEditContentInterestsError',
      'profileEditPhotoError',
    ].forEach(
      id => setError(id, '')
    );

    setStatus('');

  }


  /* =======================================================
     PROFILE EXTRACTION
  ======================================================= */

  function extractProfile(
    payload
  ) {

    const data =
      payload?.data ??
      payload ??
      {};


    if (
      data.user &&
      typeof data.user === 'object'
    ) {

      return {
        user: data.user,
        student: data.student ?? null,
        teacherProfile:
          data.teacherProfile ?? null,
        studyFields:
          data.studyFields ?? [],
      };

    }


    if (
      data.profile &&
      typeof data.profile === 'object'
    ) {

      return {
        user:
          data.profile.user ??
          data.user ??
          data.profile,
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


    return {
      user: data,
      student: null,
      teacherProfile: null,
      studyFields: [],
    };

  }


  function normalizeProfileUser(
    user
  ) {

    return {
      ...(user || {}),

      id:
        user?.id ??
        user?.userId ??
        null,

      role:
        safeString(
          user?.role,
          ''
        ).toLowerCase(),

      firstName:
        safeString(
          user?.firstName ??
          user?.first_name
        ),

      lastName:
        safeString(
          user?.lastName ??
          user?.last_name
        ),

      phone:
        safeString(
          user?.phone
        ),

      telegramVerified:
        Boolean(
          user?.telegramVerified ??
          user?.telegram_verified
        ),

      avatarUrl:
        safeString(
          user?.avatarUrl ??
          user?.avatar_url
        ),

    };

  }


  /* =======================================================
     API
  ======================================================= */

  async function apiRequest(
    path,
    options = {}
  ) {

    const token =
      getToken();


    if (!token) {

      const error =
        new Error(
          'Authentication token is missing.'
        );

      error.status =
        401;

      throw error;

    }


    const normalizedPath =
      String(path || '').startsWith('/')
        ? String(path)
        : `/${String(path)}`;


    const response =
      await fetch(
        `${API_BASE}${normalizedPath}`,
        {
          ...options,

          headers: {
            Accept:
              'application/json',
            Authorization:
              `Bearer ${token}`,
            ...(options.headers || {}),
          },
        }
      );


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

      error.status =
        401;

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


  /* =======================================================
     UI RENDER HELPERS
  ======================================================= */

  function renderChoiceInputs(
    container,
    items,
    name,
    type = 'checkbox'
  ) {

    if (!container) {
      return;
    }


    container.innerHTML =
      '';


    items.forEach(
      item => {

        const label =
          document.createElement('label');

        label.className =
          'profile-edit-choice';


        const input =
          document.createElement('input');

        input.type =
          type;

        input.name =
          name;

        input.value =
          item.value;

        input.dataset.choice =
          item.value;


        const span =
          document.createElement('span');

        span.textContent =
          item.label;


        label.appendChild(input);
        label.appendChild(span);

        container.appendChild(label);

      }
    );

  }


  function populateAreas(
    subcityValue,
    selectedArea = ''
  ) {

    if (!areaInput) {
      return;
    }


    const subcity =
      safeString(
        subcityValue
      ).toLowerCase();


    const locations =
      AREA_OPTIONS[subcity] || [];


    areaInput.innerHTML =
      '';


    const placeholder =
      document.createElement('option');

    placeholder.value =
      '';

    placeholder.textContent =
      subcity
        ? 'Select Area'
        : 'Select Sub-City first';

    areaInput.appendChild(
      placeholder
    );


    locations.forEach(
      location => {

        const option =
          document.createElement('option');

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


    if (
      selectedArea
    ) {

      const normalized =
        safeString(
          selectedArea
        ).toLowerCase();


      const match =
        Array.from(
          areaInput.options
        ).find(
          option =>
            option.value === normalized ||
            option.textContent
              .trim()
              .toLowerCase() === normalized
        );


      if (match) {
        areaInput.value =
          match.value;
      }

    }

  }


  function getProfileLocation() {

    if (
      currentUser?.role === 'ustaz'
    ) {

      return currentProfile?.teacherProfile || {};

    }

    return currentProfile?.student || {};

  }


  function applyPhotoState() {

    const photoUrl =
      localPhotoObjectUrl ||
      resolvePhotoUrl(
        currentStepPhotoUrl
      );


    if (
      photoUrl
    ) {

      if (photoInitials) {
        photoInitials.hidden = true;
      }

      if (photoPreview) {

        photoPreview.onload =
          function () {

            photoPreview.hidden =
              false;

            if (photoInitials) {
              photoInitials.hidden =
                true;
            }

          };

        photoPreview.onerror =
          function () {

            photoPreview.hidden =
              true;

            if (photoInitials) {
              photoInitials.hidden =
                false;
            }

          };

        photoPreview.src =
          photoUrl;

        photoPreview.hidden =
          false;

      }

      if (photoRemoveButton) {
        photoRemoveButton.hidden =
          false;
      }

    } else {

      if (photoPreview) {

        photoPreview.onload =
          null;

        photoPreview.onerror =
          null;

        photoPreview.hidden =
          true;

        photoPreview.removeAttribute(
          'src'
        );

      }

      if (photoInitials) {
        photoInitials.hidden =
          false;
      }

      if (photoRemoveButton) {
        photoRemoveButton.hidden =
          true;
      }

    }

  }


  function updatePhotoName() {

    if (!photoName) {
      return;
    }

    if (localPhotoFile) {

      photoName.textContent =
        localPhotoFile.name;

      return;

    }

    if (currentStepPhotoUrl) {

      photoName.textContent =
        'Profile photo saved';

      return;

    }

    photoName.textContent =
      'No photo selected';

  }


  function clearLocalPhoto() {

    localPhotoFile =
      null;

    if (localPhotoObjectUrl) {

      try {
        URL.revokeObjectURL(
          localPhotoObjectUrl
        );
      } catch {
        // Ignore URL cleanup failures.
      }

      localPhotoObjectUrl =
        null;

    }

    if (photoInput) {
      photoInput.value =
        '';
    }

  }


  function renderRoleSection() {

    const role =
      safeString(
        currentUser?.role
      ).toLowerCase();


    if (roleInput) {

      roleInput.value =
        role === 'ustaz'
          ? 'Ustaz / Ustaza'
          : 'Parent / Student';

    }


    if (teacherSection) {

      teacherSection.hidden =
        role !== 'ustaz';

    }

  }


  function renderMainFields() {

    if (firstNameInput) {
      firstNameInput.value =
        currentUser?.firstName || '';
    }

    if (lastNameInput) {
      lastNameInput.value =
        currentUser?.lastName || '';
    }

    if (phoneInput) {
      phoneInput.value =
        currentUser?.phone || '';
    }

    if (phoneStatus) {
      phoneStatus.textContent =
        currentUser?.telegramVerified
          ? 'Verified'
          : 'Account phone';
    }

    if (bioInput) {
      bioInput.value =
        currentPreferences?.bio || '';
    }

    updateBioCounter();

    const location =
      getProfileLocation();

    if (subcityInput) {
      subcityInput.value =
        safeString(
          location.subcity
        ).toLowerCase();
    }

    populateAreas(
      location.subcity,
      location.area
    );

    if (mosqueInput) {
      mosqueInput.value =
        safeString(
          location.nearestMosque ??
          location.nearest_mosque
        );
    }

    if (
      currentUser?.role === 'ustaz'
    ) {

      if (experienceInput) {
        experienceInput.value =
          currentProfile?.teacherProfile?.experience ??
          '';
      }

      if (genderInput) {
        genderInput.value =
          safeString(
            currentProfile?.teacherProfile?.gender
          ).toLowerCase();
      }

    }

  }


  function renderTeachingStudyFields() {

    if (!teachingFieldsContainer) {
      return;
    }

    const selected =
      new Set(
        normalizeArray(
          currentProfile?.studyFields
        )
          .map(
            field =>
              typeof field === 'object'
                ? safeString(field.slug).toLowerCase()
                : safeString(field).toLowerCase()
          )
          .filter(Boolean)
      );

    renderChoiceInputs(
      teachingFieldsContainer,
      TEACHING_STUDY_FIELDS,
      'profileEditTeachingStudyFields',
      'checkbox'
    );

    teachingFieldsContainer
      .querySelectorAll('input')
      .forEach(
        input => {
          input.checked =
            selected.has(
              input.value
            );
        }
      );

  }


  function renderLearningPreferences() {

    const preferredGender =
      safeString(
        currentPreferences?.preferredTeacherGender,
        'no-preference'
      ).toLowerCase();


    teacherPreferencesContainer
      ?.querySelectorAll(
        'input[name="profileEditTeacherPreference"]'
      )
      .forEach(
        input => {
          input.checked =
            input.value ===
            preferredGender;
        }
      );


    renderChoiceInputs(
      studyInterestsContainer,
      LEARNING_STUDY_INTERESTS,
      'profileEditStudyInterest',
      'checkbox'
    );


    const selectedStudy =
      new Set(
        normalizeArray(
          currentPreferences?.studyInterests
        )
      );

    studyInterestsContainer
      ?.querySelectorAll('input')
      .forEach(
        input => {
          input.checked =
            selectedStudy.has(
              input.value
            );
        }
      );


    renderChoiceInputs(
      contentInterestsContainer,
      CONTENT_INTERESTS,
      'profileEditContentInterest',
      'checkbox'
    );


    const selectedContent =
      new Set(
        normalizeArray(
          currentPreferences?.contentInterests
        )
      );

    contentInterestsContainer
      ?.querySelectorAll('input')
      .forEach(
        input => {
          input.checked =
            selectedContent.has(
              input.value
            );
        }
      );

  }


  function updateBioCounter() {

    if (
      bioInput &&
      bioCount
    ) {

      bioCount.textContent =
        String(
          Math.min(
            500,
            bioInput.value.length
          )
        );

    }

  }


  /* =======================================================
     VALIDATION
  ======================================================= */

  function collectProfilePayload() {

    const payload = {

      firstName:
        safeString(
          firstNameInput?.value
        ),

      lastName:
        safeString(
          lastNameInput?.value
        ),

      phone:
        safeString(
          currentUser?.phone
        ),

      subcity:
        safeString(
          subcityInput?.value
        ).toLowerCase(),

      area:
        safeString(
          areaInput?.value
        ).toLowerCase(),

      nearestMosque:
        safeString(
          mosqueInput?.value
        ),

    };


    if (
      currentUser?.role === 'ustaz'
    ) {

      payload.experience =
        Number(
          experienceInput?.value ||
          0
        );

      payload.gender =
        safeString(
          genderInput?.value
        ).toLowerCase();

      payload.studyFields =
        Array.from(
          teachingFieldsContainer
            ?.querySelectorAll('input:checked') ||
            []
        )
          .map(
            input =>
              safeString(
                input.value
              ).toLowerCase()
          )
          .filter(Boolean);

    }


    return payload;

  }


  function collectPreferencesPayload() {

    const selectedTeacherPreference =
      document.querySelector(
        'input[name="profileEditTeacherPreference"]:checked'
      )?.value ||
      'no-preference';


    return {

      bio:
        safeString(
          bioInput?.value
        ),

      preferredTeacherGender:
        safeString(
          selectedTeacherPreference
        ).toLowerCase(),

      studyInterests:
        Array.from(
          studyInterestsContainer
            ?.querySelectorAll('input:checked') ||
            []
        )
          .map(
            input =>
              safeString(
                input.value
              ).toLowerCase()
          )
          .filter(Boolean),

      contentInterests:
        Array.from(
          contentInterestsContainer
            ?.querySelectorAll('input:checked') ||
            []
        )
          .map(
            input =>
              safeString(
                input.value
              ).toLowerCase()
          )
          .filter(Boolean),

    };

  }


  function validateProfilePayload(
    payload
  ) {

    let valid =
      true;


    if (
      payload.firstName.length < 2 ||
      payload.firstName.length > 100
    ) {

      setError(
        'profileEditNameError',
        'First name must be between 2 and 100 characters.'
      );

      valid =
        false;

    }


    if (
      payload.lastName.length < 2 ||
      payload.lastName.length > 100
    ) {

      setError(
        'profileEditNameError',
        'Last name must be between 2 and 100 characters.'
      );

      valid =
        false;

    }


    if (!payload.subcity) {

      setError(
        'profileEditSubcityError',
        'Please select your sub-city.'
      );

      valid =
        false;

    }


    if (!payload.area) {

      setError(
        'profileEditAreaError',
        'Please select your area.'
      );

      valid =
        false;

    }


    if (
      payload.nearestMosque.length < 2 ||
      payload.nearestMosque.length > 150
    ) {

      setError(
        'profileEditMosqueError',
        'Nearest mosque must be between 2 and 150 characters.'
      );

      valid =
        false;

    }


    if (
      currentUser?.role === 'ustaz'
    ) {

      const experience =
        Number(
          experienceInput?.value
        );

      const gender =
        safeString(
          genderInput?.value
        ).toLowerCase();

      const studyFields =
        normalizeArray(
          payload.studyFields
        );

      if (
        !Number.isInteger(experience) ||
        experience < 0 ||
        experience > 60
      ) {

        setError(
          'profileEditExperienceError',
          'Teaching experience must be between 0 and 60 years.'
        );

        valid =
          false;

      }

      if (
        !['male', 'female'].includes(
          gender
        )
      ) {

        setError(
          'profileEditGenderError',
          'Please select your gender.'
        );

        valid =
          false;

      }

      if (
        studyFields.length === 0
      ) {

        setError(
          'profileEditStudyFieldsError',
          'Select at least one teaching study field.'
        );

        valid =
          false;

      }

      if (
        studyFields.some(
          field =>
            !VALID_TEACHING_STUDY_FIELDS.has(
              field
            )
        )
      ) {

        setError(
          'profileEditStudyFieldsError',
          'One or more teaching study fields are invalid.'
        );

        valid =
          false;

      }

    }


    if (
      bioInput?.value.length > 500
    ) {

      setError(
        'profileEditBioError',
        'About you must be 500 characters or fewer.'
      );

      valid =
        false;

    }

    return valid;

  }


  function validatePreferencesPayload(
    payload
  ) {

    let valid =
      true;


    if (
      !VALID_TEACHER_GENDER_PREFERENCES.has(
        payload.preferredTeacherGender
      )
    ) {

      setError(
        'profileEditTeacherPreferenceError',
        'Please select a valid teacher preference.'
      );

      valid =
        false;

    }


    if (
      payload.studyInterests.some(
        value =>
          !VALID_STUDY_INTERESTS.has(
            value
          )
      )
    ) {

      setError(
        'profileEditStudyInterestsError',
        'One or more study interests are invalid.'
      );

      valid =
        false;

    }


    if (
      payload.contentInterests.some(
        value =>
          !VALID_CONTENT_INTERESTS.has(
            value
          )
      )
    ) {

      setError(
        'profileEditContentInterestsError',
        'One or more Islamic content interests are invalid.'
      );

      valid =
        false;

    }


    return valid;

  }


  function validatePhotoFile(
    file
  ) {

    if (!file) {
      return true;
    }


    if (
      !ALLOWED_PROFILE_PHOTO_TYPES.has(
        file.type
      )
    ) {

      setError(
        'profileEditPhotoError',
        'Profile photo must be JPG, PNG, or WebP.'
      );

      return false;

    }


    if (
      file.size >
      MAX_PROFILE_PHOTO_BYTES
    ) {

      setError(
        'profileEditPhotoError',
        'Profile photo must be 5 MB or smaller.'
      );

      return false;

    }


    return true;

  }


  /* =======================================================
     PHOTO
  ======================================================= */

  function handlePhotoSelected(
    file
  ) {

    setError(
      'profileEditPhotoError',
      ''
    );


    if (!file) {
      return;
    }


    if (!validatePhotoFile(file)) {

      if (photoInput) {
        photoInput.value = '';
      }

      return;

    }


    clearLocalPhoto();

    localPhotoFile =
      file;


    try {

      localPhotoObjectUrl =
        URL.createObjectURL(
          file
        );

    } catch (error) {

      console.error(
        'Unable to create local profile photo preview:',
        error
      );

      clearLocalPhoto();

      setError(
        'profileEditPhotoError',
        'The selected image could not be previewed.'
      );

      return;

    }


    updatePhotoName();
    applyPhotoState();

  }


  async function uploadPhoto(
    file
  ) {

    const token =
      getToken();

    if (!token) {

      const error =
        new Error(
          'Authentication token is missing.'
        );

      error.status =
        401;

      throw error;

    }


    const formData =
      new FormData();

    formData.append(
      'profilePhoto',
      file
    );


    const response =
      await fetch(
        `${API_BASE}${PHOTO_ENDPOINT}`,
        {
          method: 'POST',
          headers: {
            Accept:
              'application/json',
            Authorization:
              `Bearer ${token}`,
          },
          body: formData,
        }
      );


    let data = {};

    try {
      data = await response.json();
    } catch {
      data = {};
    }


    if (!response.ok) {

      const error =
        new Error(
          data?.message ||
          'Unable to upload your profile photo.'
        );

      error.status =
        response.status;

      throw error;

    }


    return data;

  }


  async function removeSavedPhoto() {

    let response;


    if (
      window.BarakaLinkAPI &&
      typeof window.BarakaLinkAPI.delete ===
        'function'
    ) {

      response =
        await window.BarakaLinkAPI.delete(
          PHOTO_ENDPOINT
        );

    } else {

      const token =
        getToken();


      if (!token) {

        const error =
          new Error(
            'Authentication token is missing.'
          );

        error.status =
          401;

        throw error;

      }


      const rawResponse =
        await fetch(
          `${API_BASE}${PHOTO_ENDPOINT}`,
          {
            method: 'DELETE',
            headers: {
              Accept:
                'application/json',
              Authorization:
                `Bearer ${token}`,
            },
          }
        );


      let data = {};

      try {
        data = await rawResponse.json();
      } catch {
        data = {};
      }


      if (!rawResponse.ok) {

        const error =
          new Error(
            data?.message ||
            'Unable to remove your profile photo.'
          );

        error.status =
          rawResponse.status;

        throw error;

      }

      response =
        data;

    }


    if (!response?.success) {

      const error =
        new Error(
          response?.message ||
          'Unable to remove your profile photo.'
        );

      error.status =
        response?.status;

      throw error;

    }


    currentStepPhotoUrl = '';
    clearLocalPhoto();
    updatePhotoName();
    applyPhotoState();

  }


  /* =======================================================
     LOAD PROFILE / PREFERENCES
  ======================================================= */

  async function loadData() {

    setStatus(
      'Loading your profile...',
      'is-loading'
    );


    const [
      profilePayload,
      preferencePayload,
    ] = await Promise.all([
      apiRequest(PROFILE_ENDPOINT),
      apiRequest(PREFERENCES_ENDPOINT),
    ]);


    const extracted =
      extractProfile(
        profilePayload
      );


    currentUser =
      normalizeProfileUser(
        extracted.user
      );

    currentProfile =
      extracted;


    currentPreferences =
      preferencePayload?.data ??
      preferencePayload ??
      {};


    renderRoleSection();
    renderMainFields();
    renderTeachingStudyFields();
    renderLearningPreferences();


    currentStepPhotoUrl =
      safeString(
        currentUser.avatarUrl
      );

    updatePhotoName();
    applyPhotoState();


    if (backLink) {

      backLink.href =
        dashboardForRole(
          currentUser.role
        );

    }


    setStatus('');

  }


  /* =======================================================
     SAVE
  ======================================================= */

  async function saveProfile() {

    if (
      saveInProgress
    ) {
      return;
    }


    clearErrors();


    const profilePayload =
      collectProfilePayload();

    const preferencesPayload =
      collectPreferencesPayload();


    if (
      !validateProfilePayload(
        profilePayload
      ) ||
      !validatePreferencesPayload(
        preferencesPayload
      ) ||
      !validatePhotoFile(
        localPhotoFile
      )
    ) {

      setStatus(
        'Please correct the highlighted fields.',
        'is-error'
      );

      return;

    }


    const token =
      getToken();

    if (!token) {

      redirectToLogin();

      return;

    }


    saveInProgress =
      true;


    if (saveButton) {
      saveButton.disabled =
        true;
    }

    if (saveText) {
      saveText.textContent =
        'Saving...';
    }

    if (saveIcon) {
      saveIcon.className =
        'fa-solid fa-spinner fa-spin';
    }


    try {

      setStatus(
        'Saving your profile...',
        'is-loading'
      );


      await apiRequest(
        PROFILE_ENDPOINT,
        {
          method: 'PATCH',
          headers: {
            'Content-Type':
              'application/json',
          },
          body:
            JSON.stringify(
              profilePayload
            ),
        }
      );


      if (localPhotoFile) {

        setStatus(
          'Uploading your profile photo...',
          'is-loading'
        );


        const uploadResponse =
          await uploadPhoto(
            localPhotoFile
          );


        currentStepPhotoUrl =
          safeString(
            uploadResponse?.data?.avatarUrl
          );

        clearLocalPhoto();

        updatePhotoName();
        applyPhotoState();

      }


      setStatus(
        'Saving your learning preferences...',
        'is-loading'
      );


      await apiRequest(
        PREFERENCES_ENDPOINT,
        {
          method: 'PATCH',
          headers: {
            'Content-Type':
              'application/json',
          },
          body:
            JSON.stringify(
              preferencesPayload
            ),
        }
      );


      setStatus(
        'Your profile has been updated.',
        'is-success'
      );


      if (saveText) {
        saveText.textContent =
          'Saved';
      }

      if (saveIcon) {
        saveIcon.className =
          'fa-solid fa-circle-check';
      }


      window.setTimeout(
        function () {

          window.location.replace(
            dashboardForRole(
              currentUser?.role
            )
          );

        },
        350
      );


    } catch (error) {

      console.error(
        '[profile-edit] Save failed:',
        error
      );


      if (
        error?.status === 401
      ) {

        redirectToLogin();

        return;

      }


      if (
        error?.status === 413
      ) {

        setError(
          'profileEditPhotoError',
          'Profile photo must be 5 MB or smaller.'
        );

      }


      setStatus(
        error?.message ||
        'Unable to update your profile. Please try again.',
        'is-error'
      );


    } finally {

      saveInProgress =
        false;

      if (saveButton) {
        saveButton.disabled =
          false;
      }

      if (saveText && saveText.textContent === 'Saving...') {
        saveText.textContent =
          'Save profile';
      }

      if (saveIcon && saveIcon.classList.contains('fa-spinner')) {
        saveIcon.className =
          'fa-solid fa-check';
      }

    }

  }


  /* =======================================================
     EVENT LISTENERS
  ======================================================= */

  if (subcityInput) {

    subcityInput.addEventListener(
      'change',
      function () {

        populateAreas(
          subcityInput.value,
          ''
        );

        setError(
          'profileEditSubcityError',
          ''
        );

        setError(
          'profileEditAreaError',
          ''
        );

      }
    );

  }


  if (bioInput) {

    bioInput.addEventListener(
      'input',
      updateBioCounter
    );

  }


  if (photoChangeButton && photoInput) {

    photoChangeButton.addEventListener(
      'click',
      function () {
        photoInput.click();
      }
    );

  }


  if (photoInput) {

    photoInput.addEventListener(
      'change',
      function () {

        handlePhotoSelected(
          photoInput.files?.[0] || null
        );

      }
    );

  }


  if (photoRemoveButton) {

    photoRemoveButton.addEventListener(
      'click',
      async function () {

        if (saveInProgress) {
          return;
        }

        setError(
          'profileEditPhotoError',
          ''
        );

        /*
         * A newly selected local file has not reached the server.
         * Remove only the local selection and restore the saved image.
         */
        if (localPhotoFile) {

          clearLocalPhoto();
          updatePhotoName();
          applyPhotoState();
          return;

        }

        if (!currentStepPhotoUrl) {
          applyPhotoState();
          return;
        }

        saveInProgress =
          true;

        photoRemoveButton.disabled =
          true;

        setStatus(
          'Removing your profile photo...',
          'is-loading'
        );

        try {

          await removeSavedPhoto();

          setStatus(
            'Your profile photo has been removed.',
            'is-success'
          );

        } catch (error) {

          console.error(
            '[profile-edit] Photo removal failed:',
            error
          );

          if (
            error?.status === 401
          ) {
            redirectToLogin();
            return;
          }

          setError(
            'profileEditPhotoError',
            error?.message ||
            'Unable to remove your profile photo.'
          );

          setStatus(
            '',
            ''
          );

        } finally {

          saveInProgress =
            false;

          photoRemoveButton.disabled =
            false;

        }

      }
    );

  }


  if (form) {

    form.addEventListener(
      'submit',
      function (event) {

        event.preventDefault();
        saveProfile();

      }
    );

  }


  /* =======================================================
     INIT
  ======================================================= */

  async function init() {

    if (!form) {
      return;
    }

    if (bioInput) {
      bioInput.maxLength =
        500;
    }

    try {

      await loadData();

    } catch (error) {

      console.error(
        '[profile-edit] Initial load failed:',
        error
      );

      if (
        error?.status === 401
      ) {

        redirectToLogin();
        return;

      }

      setStatus(
        error?.message ||
        'Unable to load your profile. Please try again.',
        'is-error'
      );

    }

  }


  if (
    document.readyState ===
    'loading'
  ) {

    document.addEventListener(
      'DOMContentLoaded',
      init
    );

  } else {

    init();

  }


})();
