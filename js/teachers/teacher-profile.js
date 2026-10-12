"use strict";

/* =========================================================
   TEACHER PROFILE
   - Qualification certificate viewer
   - Ustaz availability switch
   - Profile/account rendering
   - Subjects
   - Languages
   - Availability days
   - Qualifications
   - Trust / verification status
========================================================= */

import {
  firstDefinedObjectValue,
  firstName,
  fullName,
  getInitials,
  getRoleLabel,
  isObject,
  itemValue,
  labelize,
  normalizeArray,
  resolveMediaUrl,
  text,
  unwrapApiPayload,
} from "./teacher-core.js";

import {
  $,
  setText,
} from "./teacher-dom.js";

import {
  state,
} from "./teacher-state.js";

import {
  getToken,
} from "./teacher-auth.js";


/* =========================================================
   QUALIFICATION CERTIFICATE VIEWER
========================================================= */

let certificateViewer = null;


function ensureCertificateViewer() {
  if (certificateViewer) {
    return certificateViewer;
  }

  const viewer =
    document.createElement("div");

  viewer.className =
    "ustaz-certificate-viewer";

  viewer.hidden =
    true;

  viewer.setAttribute(
    "aria-hidden",
    "true"
  );

  viewer.innerHTML = `
    <div
      class="ustaz-certificate-viewer-backdrop"
      data-certificate-viewer-close
    ></div>

    <div
      class="ustaz-certificate-viewer-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ustazCertificateViewerTitle"
    >
      <div class="ustaz-certificate-viewer-header">

        <div>
          <span class="ustaz-panel-eyebrow">
            Certificate
          </span>

          <h2 id="ustazCertificateViewerTitle">
            Qualification certificate
          </h2>
        </div>

        <button
          type="button"
          class="ustaz-certificate-viewer-close"
          aria-label="Close certificate viewer"
          data-certificate-viewer-close
        >
          <i class="fa-solid fa-xmark"></i>
        </button>

      </div>

      <div
        class="ustaz-certificate-viewer-body"
        id="ustazCertificateViewerBody"
      ></div>
    </div>
  `;

  document.body.appendChild(
    viewer
  );

  viewer
    .querySelectorAll(
      "[data-certificate-viewer-close]"
    )
    .forEach(
      (element) => {
        element.addEventListener(
          "click",
          closeCertificateViewer
        );
      }
    );

  document.addEventListener(
    "keydown",
    (event) => {
      if (
        event.key === "Escape" &&
        certificateViewer &&
        !certificateViewer.hidden
      ) {
        closeCertificateViewer();
      }
    }
  );

  certificateViewer =
    viewer;

  return viewer;
}


function closeCertificateViewer() {
  if (!certificateViewer) {
    return;
  }

  certificateViewer.hidden =
    true;

  certificateViewer.setAttribute(
    "aria-hidden",
    "true"
  );

  document.body.classList.remove(
    "ustaz-certificate-viewer-open"
  );

  const body =
    certificateViewer.querySelector(
      "#ustazCertificateViewerBody"
    );

  if (body) {
    body.replaceChildren();
  }
}


function openCertificateViewer(
  qualification
) {
  const url =
    resolveMediaUrl(
      qualification?.certificateUrl ??
        qualification?.certificate_url
    );

  if (!url) {
    return;
  }

  const viewer =
    ensureCertificateViewer();

  const body =
    viewer.querySelector(
      "#ustazCertificateViewerBody"
    );

  const titleElement =
    viewer.querySelector(
      "#ustazCertificateViewerTitle"
    );

  if (!body) {
    return;
  }

  body.replaceChildren();

  if (titleElement) {
    titleElement.textContent =
      qualification?.title ||
      "Qualification certificate";
  }

  const mime =
    text(
      qualification?.certificateMime ??
        qualification?.certificate_mime
    ).toLowerCase();

  const filename =
    text(
      qualification?.certificateName ??
        qualification?.certificate_name
    ).toLowerCase();

  const isPdf =
    mime === "application/pdf" ||
    /\.pdf(?:$|\?)/i.test(filename) ||
    /\.pdf(?:$|\?)/i.test(url);

  if (isPdf) {
    const iframe =
      document.createElement("iframe");

    iframe.className =
      "ustaz-certificate-viewer-pdf";

    iframe.src =
      url;

    iframe.title =
      `${
        qualification?.title ||
        "Qualification"
      } certificate`;

    iframe.loading =
      "lazy";

    body.appendChild(
      iframe
    );
  } else {
    const image =
      document.createElement("img");

    image.className =
      "ustaz-certificate-viewer-image";

    image.src =
      url;

    image.alt =
      `${
        qualification?.title ||
        "Qualification"
      } certificate`;

    image.loading =
      "lazy";

    image.decoding =
      "async";

    image.addEventListener(
      "error",
      () => {
        body.replaceChildren();

        const error =
          document.createElement("div");

        error.className =
          "ustaz-certificate-viewer-error";

        error.innerHTML = `
          <i class="fa-regular fa-image"></i>

          <strong>
            Certificate could not be displayed.
          </strong>

          <span>
            The uploaded certificate could not be loaded.
          </span>
        `;

        body.appendChild(
          error
        );
      },
      {
        once: true,
      }
    );

    body.appendChild(
      image
    );
  }

  viewer.hidden =
    false;

  viewer.setAttribute(
    "aria-hidden",
    "false"
  );

  document.body.classList.add(
    "ustaz-certificate-viewer-open"
  );

  const closeButton =
    viewer.querySelector(
      ".ustaz-certificate-viewer-close"
    );

  if (closeButton) {
    requestAnimationFrame(
      () => {
        closeButton.focus();
      }
    );
  }
}


/* =========================================================
   USTAZ AVAILABILITY
   Source of truth:
   teacher_profiles.accepting_students
========================================================= */

function normalizeAvailabilityValue(
  value
) {
  if (
    value === true ||
    value === 1 ||
    value === "1" ||
    value === "true"
  ) {
    return true;
  }

  return false;
}


function getUstazAvailability() {
  const teacher =
    state.teacher || {};

  return normalizeAvailabilityValue(
    teacher.acceptingStudents ??
      teacher.accepting_students ??
      false
  );
}


function renderUstazAvailability(
  options = {}
) {
  const switchButton =
    document.getElementById(
      "ustazAvailabilitySwitch"
    );

  const status =
    document.getElementById(
      "ustazProfileAvailability"
    );

  const available =
    getUstazAvailability();

  if (status) {
    status.textContent =
      available
        ? "Available"
        : "Not available";

    status.dataset.availability =
      available
        ? "available"
        : "unavailable";
  }

  if (switchButton) {
    switchButton.setAttribute(
      "aria-checked",
      available
        ? "true"
        : "false"
    );

    switchButton.setAttribute(
      "aria-label",
      available
        ? "Set yourself as not available"
        : "Set yourself as available"
    );

    switchButton.classList.toggle(
      "is-on",
      available
    );

    /*
     * Never accidentally re-enable the switch
     * while a request is in progress.
     */
    if (
      typeof options.disabled ===
      "boolean"
    ) {
      switchButton.disabled =
        options.disabled;
    } else {
      switchButton.disabled =
        switchButton.dataset
          .ustazAvailabilityUpdating ===
        "1";
    }
  }

  return available;
}


async function updateUstazAvailability(
  available
) {
  const token =
    getToken();

  if (!token) {
    const error =
      new Error(
        "Authentication required."
      );

    error.status =
      401;

    error.code =
      "AUTH_REQUIRED";

    throw error;
  }

  const apiBase =
    String(
      window.BarakaLinkAPI?.base ||
      window.BARAKALINK_API_BASE ||
      "http://localhost:5000/api"
    ).replace(
      /\/+$/,
      ""
    );

  const response =
    await fetch(
      `${apiBase}/profile/availability`,
      {
        method: "PATCH",

        headers: {
          "Content-Type":
            "application/json",

          "Authorization":
            `Bearer ${token}`,
        },

        body:
          JSON.stringify({
            available:
              Boolean(available),
          }),
      }
    );

  let payload =
    null;

  try {
    payload =
      await response.json();
  } catch (_) {
    payload =
      null;
  }

  if (!response.ok) {
    const error =
      new Error(
        payload?.message ||
        "Could not update your availability."
      );

    error.status =
      response.status;

    error.code =
      payload?.code ||
      "AVAILABILITY_UPDATE_FAILED";

    throw error;
  }

  const savedAvailable =
    normalizeAvailabilityValue(
      payload?.data?.available ??
        available
    );

  /*
   * Keep local state synchronized with
   * the value confirmed by the server.
   */
  if (
    state.teacher &&
    typeof state.teacher === "object"
  ) {
    state.teacher.acceptingStudents =
      savedAvailable;

    state.teacher.accepting_students =
      savedAvailable
        ? 1
        : 0;
  }

  return savedAvailable;
}


function setupUstazAvailabilitySwitch() {
  const switchButton =
    document.getElementById(
      "ustazAvailabilitySwitch"
    );

  if (!switchButton) {
    return;
  }

  /*
   * Update the switch even when it was already
   * initialized.
   */
  renderUstazAvailability();

  if (
    switchButton.dataset
      .ustazAvailabilityBound ===
    "1"
  ) {
    return;
  }

  switchButton.dataset
    .ustazAvailabilityBound =
    "1";

  switchButton.addEventListener(
    "click",
    async () => {
      if (
        switchButton.disabled ||
        switchButton.dataset
          .ustazAvailabilityUpdating ===
          "1"
      ) {
        return;
      }

      const previousValue =
        getUstazAvailability();

      const nextValue =
        !previousValue;

      /*
       * Optimistic UI:
       * immediately update the local state
       * while the server request is running.
       */
      if (state.teacher) {
        state.teacher.acceptingStudents =
          nextValue;

        state.teacher.accepting_students =
          nextValue
            ? 1
            : 0;
      }

      switchButton.dataset
        .ustazAvailabilityUpdating =
        "1";

      renderUstazAvailability({
        disabled: true,
      });

      try {
        const savedValue =
          await updateUstazAvailability(
            nextValue
          );

        if (state.teacher) {
          state.teacher.acceptingStudents =
            savedValue;

          state.teacher.accepting_students =
            savedValue
              ? 1
              : 0;
        }

        console.info(
          "[BarakaLink][Ustaz] Availability updated.",
          {
            available:
              savedValue,
          }
        );
      } catch (error) {
        /*
         * Roll back if the server rejects
         * the change.
         */
        if (state.teacher) {
          state.teacher.acceptingStudents =
            previousValue;

          state.teacher.accepting_students =
            previousValue
              ? 1
              : 0;
        }

        console.error(
          "[BarakaLink][Ustaz] Availability update failed.",
          error
        );

        window.alert(
          error?.message ||
          "We could not update your availability."
        );
      } finally {
        delete switchButton.dataset
          .ustazAvailabilityUpdating;

        renderUstazAvailability({
          disabled: false,
        });
      }
    }
  );
}


/* =========================================================
   PROFILE PHOTO
========================================================= */

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


function mountAvatar(
  wrapperId,
  initialsId,
  imageId
) {
  const wrapper =
    wrapperId
      ? $(wrapperId)
      : null;

  const initials =
    $(initialsId);

  const image =
    $(imageId);

  const resolvedWrapper =
    wrapper ||
    image?.closest(
      ".ustaz-avatar"
    );

  if (
    !resolvedWrapper ||
    !initials ||
    !image
  ) {
    return;
  }

  const name =
    fullName(
      state.user || {}
    );

  const initialsValue =
    getInitials(
      state.user || {}
    );

  const photo =
    resolveMediaUrl(
      getProfilePhoto()
    );

  initials.textContent =
    initialsValue;

  if (!photo) {
    image.hidden =
      true;

    image.removeAttribute(
      "src"
    );

    initials.hidden =
      false;

    return;
  }

  image.alt =
    `${name} profile photo`;

  image.hidden =
    false;

  initials.hidden =
    false;

  image.src =
    photo;

  image.onload = () => {
    image.hidden =
      false;

    initials.hidden =
      true;
  };

  image.onerror = () => {
    image.hidden =
      true;

    image.removeAttribute(
      "src"
    );

    initials.hidden =
      false;
  };
}


function mountAllAvatars() {
  mountAvatar(
    "ustazSidebarAvatar",
    "ustazSidebarAvatarInitials",
    "ustazSidebarAvatarImage"
  );

  mountAvatar(
    "ustazAvatar",
    "ustazAvatarInitials",
    "ustazAvatarImage"
  );

  mountAvatar(
    null,
    "ustazProfileMenuInitials",
    "ustazProfileMenuImage"
  );

  mountAvatar(
    "ustazHomeAvatar",
    "ustazHomeAvatarInitials",
    "ustazHomeAvatarImage"
  );

  mountAvatar(
    "ustazProfileAvatar",
    "ustazProfileAvatarInitials",
    "ustazProfileAvatarImage"
  );
}


/* =========================================================
   NORMALIZERS
========================================================= */

function normalizeStudyField(
  item
) {
  if (typeof item === "string") {
    return text(item);
  }

  return itemValue(
    item,
    [
      "name",
      "label",
      "title",
      "field",
      "studyField",
      "study_field",
      "slug",
      "code",
      "value",
    ]
  );
}


function normalizeLanguage(
  item
) {
  if (typeof item === "string") {
    return text(item);
  }

  return itemValue(
    item,
    [
      "name",
      "language",
      "label",
      "slug",
      "code",
      "value",
    ]
  );
}


function normalizeAvailability(
  item
) {
  if (
    typeof item === "string" ||
    typeof item === "number"
  ) {
    const numeric =
      Number(item);

    return {
      raw: String(item),
      day: String(item),
      weekday:
        Number.isFinite(numeric)
          ? numeric
          : null,
      dayName: "",
    };
  }

  const rawDay =
    itemValue(
      item,
      [
        "day",
        "dayOfWeek",
        "day_of_week",
        "weekday",
        "value",
      ]
    );

  const dayName =
    itemValue(
      item,
      [
        "dayName",
        "day_name",
        "name",
        "label",
      ]
    );

  const numericValue =
    item?.weekday ??
    item?.dayOfWeek ??
    item?.day_of_week ??
    item?.day;

  const numeric =
    Number(numericValue);

  return {
    raw: rawDay,
    day: rawDay,
    weekday:
      Number.isFinite(numeric)
        ? numeric
        : null,
    dayName,
  };
}


function normalizeQualification(
  item
) {
  if (
    item === null ||
    item === undefined
  ) {
    return null;
  }

  if (
    typeof item === "string"
  ) {
    const title =
      text(item);

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

  if (
    typeof item !== "object"
  ) {
    return null;
  }

  const title =
    itemValue(
      item,
      [
        "title",
        "qualificationTitle",
        "qualification_title",
        "degree",
        "qualificationName",
        "qualification_name",
        "name",
      ]
    );

  const institution =
    itemValue(
      item,
      [
        "institution",
        "institutionName",
        "institution_name",
        "school",
        "university",
      ]
    );

  const completionYear =
    itemValue(
      item,
      [
        "completionYear",
        "completion_year",
        "yearCompleted",
        "year_completed",
        "year",
      ]
    );

  const specialization =
    itemValue(
      item,
      [
        "specialization",
        "specialisation",
        "major",
        "field",
        "focusArea",
        "focus_area",
      ]
    );

  const certificateUrl =
    itemValue(
      item,
      [
        "certificateUrl",
        "certificate_url",
        "documentUrl",
        "document_url",
        "fileUrl",
        "file_url",
        "certificatePath",
        "certificate_path",
        "certificate",
      ]
    );

  const certificateName =
    itemValue(
      item,
      [
        "certificateName",
        "certificate_name",
        "documentName",
        "document_name",
        "fileName",
        "file_name",
      ]
    );

  const certificateSize =
    itemValue(
      item,
      [
        "certificateSize",
        "certificate_size",
        "documentSize",
        "document_size",
        "fileSize",
        "file_size",
      ]
    );

  const certificateMime =
    itemValue(
      item,
      [
        "certificateMime",
        "certificate_mime",
        "documentMime",
        "document_mime",
        "fileMime",
        "file_mime",
      ]
    );

  const id =
    item?.id ??
    item?.qualificationId ??
    null;

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
    title:
      title ||
      "Qualification",
    institution,
    completionYear,
    specialization,
    certificateUrl,
    certificateName,
    certificateSize,
    certificateMime,
  };
}


function normalizeCollection(
  value,
  mapper
) {
  return normalizeArray(
    value
  )
    .map(mapper)
    .filter(Boolean);
}


/* =========================================================
   PROFILE EXTRACTION
========================================================= */

function extractProfile(
  payload
) {
  const root =
    unwrapApiPayload(
      payload
    ) ?? {};

  const rootObject =
    isObject(root)
      ? root
      : {};

  let data =
    rootObject?.data;

  if (!isObject(data)) {
    data =
      rootObject;
  }

  if (
    isObject(data?.data) &&
    !data?.user
  ) {
    data =
      data.data;
  }

  const user =
    data?.user ??
    rootObject?.user ??
    data?.account ??
    null;

  const teacherCandidate =
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
    const error =
      new Error(
        "Your BarakaLink account information could not be loaded."
      );

    error.code =
      "INVALID_PROFILE_RESPONSE";

    error.stage =
      "profile-normalization";

    error.payload =
      rootObject;

    throw error;
  }

  if (!isObject(teacherCandidate)) {
    console.error(
      "[BarakaLink][Ustaz Dashboard][profile-normalization] No teacher profile found.",
      {
        user,
        data,
      }
    );

    const error =
      new Error(
        "Your Ustaz teaching profile could not be found."
      );

    error.code =
      "INVALID_TEACHER_PROFILE";

    error.stage =
      "profile-normalization";

    throw error;
  }

  /*
   * Keep the original teacher object as the primary source.
   */
  const teacherSources = [
    teacherCandidate,
    data?.profile,
    rootObject?.profile,
    data,
    rootObject,
  ];

  const teacher = {
    ...teacherCandidate,
  };


  /* ---------------------------------------------------------
     HOURLY RATE
  --------------------------------------------------------- */

  const hourlyRate =
    firstDefinedObjectValue(
      teacherSources,
      [
        "hourlyRate",
        "hourly_rate",
        "pricePerHour",
        "price_per_hour",
      ]
    );

  if (
    hourlyRate !== undefined
  ) {
    teacher.hourlyRate =
      hourlyRate;
  }


  /* ---------------------------------------------------------
     LESSON DURATION
  --------------------------------------------------------- */

  const lessonDuration =
    firstDefinedObjectValue(
      teacherSources,
      [
        "lessonDuration",
        "lesson_duration",
      ]
    );

  if (
    lessonDuration !== undefined
  ) {
    teacher.lessonDuration =
      lessonDuration;
  }


  /* ---------------------------------------------------------
     LESSON FORMAT
  --------------------------------------------------------- */

  const lessonFormat =
    firstDefinedObjectValue(
      teacherSources,
      [
        "lessonFormat",
        "lesson_format",
      ]
    );

  if (
    lessonFormat !== undefined
  ) {
    teacher.lessonFormat =
      lessonFormat;
  }


  /* ---------------------------------------------------------
     TEACHING APPROACH
  --------------------------------------------------------- */

  const teachingApproach =
    firstDefinedObjectValue(
      teacherSources,
      [
        "teachingApproach",
        "teaching_approach",
      ]
    );

  if (
    teachingApproach !== undefined
  ) {
    teacher.teachingApproach =
      teachingApproach;
  }


  /* ---------------------------------------------------------
     OLD / LEGACY AVAILABILITY FIELD
  --------------------------------------------------------- */

  const isAvailable =
    firstDefinedObjectValue(
      teacherSources,
      [
        "isAvailable",
        "is_available",
      ]
    );

  if (
    isAvailable !== undefined
  ) {
    teacher.isAvailable =
      isAvailable;
  }


  /* ---------------------------------------------------------
     NEW USTAZ AVAILABILITY FIELD
     DB field:
       teacher_profiles.accepting_students
  --------------------------------------------------------- */

  const acceptingStudents =
    firstDefinedObjectValue(
      teacherSources,
      [
        "acceptingStudents",
        "accepting_students",
      ]
    );

  if (
    acceptingStudents !== undefined
  ) {
    const normalized =
      normalizeAvailabilityValue(
        acceptingStudents
      );

    teacher.acceptingStudents =
      normalized;

    teacher.accepting_students =
      normalized
        ? 1
        : 0;
  }


  /* ---------------------------------------------------------
     STUDY FIELDS
  --------------------------------------------------------- */

  const studyFields =
    normalizeCollection(
      data?.studyFields ??
        data?.study_fields ??
        rootObject?.studyFields ??
        rootObject?.study_fields ??
        teacher?.studyFields ??
        teacher?.study_fields ??
        [],
      normalizeStudyField
    );


  /* ---------------------------------------------------------
     LANGUAGES
  --------------------------------------------------------- */

  const languages =
    normalizeCollection(
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


  /* ---------------------------------------------------------
     AVAILABILITY DAYS
  --------------------------------------------------------- */

  const availability =
    normalizeCollection(
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


  /* ---------------------------------------------------------
     QUALIFICATIONS
  --------------------------------------------------------- */

  const qualifications =
    normalizeCollection(
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


  /* ---------------------------------------------------------
     TRUST
  --------------------------------------------------------- */

  const trust =
    readTrustFlags([
      teacher,
      user,
      data,
      rootObject,
    ]);


  /*
   * Existing qualification records are treated as
   * credentials submitted when there is no explicit
   * trust flag.
   */
  if (
    !trust.qualificationSubmitted &&
    qualifications.length > 0
  ) {
    trust.qualificationSubmitted =
      true;
  }


  return {
    user,
    teacher,
    studyFields,
    languages,
    availability,
    qualifications,
    trust,
  };
}


/* =========================================================
   FORMATTERS
========================================================= */

function formatLocation(
  teacher = {}
) {
  const subcity =
    text(
      teacher.subcity ??
        teacher.sub_city
    );

  const area =
    text(
      teacher.area
    );

  return (
    [subcity, area]
      .filter(Boolean)
      .join(" • ") ||
    "Location not set"
  );
}


function formatExperience(
  value
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "Not provided";
  }

  const number =
    Number(value);

  if (
    Number.isFinite(number)
  ) {
    return `${number} ${
      number === 1
        ? "year"
        : "years"
    }`;
  }

  return text(
    value,
    "Not provided"
  );
}


function formatMoney(
  value
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "Not set";
  }

  const number =
    Number(value);

  if (
    !Number.isFinite(number)
  ) {
    return text(
      value,
      "Not set"
    );
  }

  return `ETB ${number.toLocaleString(
    "en-US",
    {
      minimumFractionDigits:
        0,
      maximumFractionDigits:
        2,
    }
  )}`;
}


function formatDuration(
  value
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "Not set";
  }

  const number =
    Number(value);

  return Number.isFinite(number)
    ? `${number} minutes`
    : text(
        value,
        "Not set"
      );
}


function formatLessonFormat(
  value
) {
  const normalized =
    text(value).toLowerCase();

  const labels = {
    online: "Online",
    in_person: "In person",
    "in-person":
      "In person",
    both:
      "Online & in person",
    hybrid:
      "Online & in person",
  };

  return (
    labels[normalized] ||
    labelize(value) ||
    "Not set"
  );
}


function formatAvailabilityStatus(
  value
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "Not set";
  }

  if (
    typeof value === "boolean"
  ) {
    return value
      ? "Available"
      : "Not available";
  }

  const normalized =
    text(value).toLowerCase();

  if (
    [
      "1",
      "true",
      "yes",
      "on",
      "available",
    ].includes(normalized)
  ) {
    return "Available";
  }

  if (
    [
      "0",
      "false",
      "no",
      "off",
      "unavailable",
      "not available",
    ].includes(normalized)
  ) {
    return "Not available";
  }

  const numeric =
    Number(value);

  if (
    numeric === 1
  ) {
    return "Available";
  }

  if (
    numeric === 0
  ) {
    return "Not available";
  }

  return "Not set";
}


function formatVerification(
  value
) {
  if (value === true) {
    return "Verified";
  }

  if (value === false) {
    return "Not verified";
  }

  const normalized =
    text(value).toLowerCase();

  if (
    [
      "true",
      "1",
      "yes",
      "verified",
    ].includes(normalized)
  ) {
    return "Verified";
  }

  return "Not verified";
}


function formatDate(
  value
) {
  const raw =
    text(value);

  if (!raw) {
    return "Not provided";
  }

  const simpleDate =
    /^(\d{4})-(\d{2})-(\d{2})$/.exec(
      raw
    );

  if (simpleDate) {
    const [
      ,
      year,
      month,
      day,
    ] = simpleDate;

    const parsed =
      new Date(
        Number(year),
        Number(month) - 1,
        Number(day)
      );

    if (
      Number.isNaN(
        parsed.getTime()
      )
    ) {
      return raw;
    }

    try {
      return parsed.toLocaleDateString(
        "en-US",
        {
          day: "numeric",
          month: "long",
          year: "numeric",
        }
      );
    } catch (_) {
      return raw;
    }
  }

  const parsed =
    new Date(raw);

  if (
    Number.isNaN(
      parsed.getTime()
    )
  ) {
    return raw;
  }

  try {
    return parsed.toLocaleDateString(
      "en-US",
      {
        day: "numeric",
        month: "long",
        year: "numeric",
      }
    );
  } catch (_) {
    return raw;
  }
}


function teacherValue(
  ...keys
) {
  for (const key of keys) {
    const value =
      state.teacher?.[key];

    if (
      value !== null &&
      value !== undefined &&
      String(value).trim() !== ""
    ) {
      return value;
    }
  }

  return "";
}


/* =========================================================
   ACCOUNT DETAILS
========================================================= */

function renderAccountDetails() {
  const user =
    state.user || {};

  const teacher =
    state.teacher || {};

  const name =
    fullName(user);

  const roleLabel =
    getRoleLabel(
      user,
      teacher
    );

  const location =
    formatLocation(
      teacher
    );

  const mosque =
    text(
      teacher.nearestMosque ??
        teacher.nearest_mosque,
      "Not set"
    );


  /* ---------------------------------------------------------
     NAMES / ROLE
  --------------------------------------------------------- */

  setText(
    "ustazWelcomeName",
    firstName(user)
  );

  setText(
    "ustazSidebarName",
    name
  );

  setText(
    "ustazSidebarRole",
    roleLabel
  );

  setText(
    "ustazTopbarName",
    name
  );

  setText(
    "ustazTopbarRole",
    roleLabel
  );

  setText(
    "ustazHomeName",
    name
  );

  setText(
    "ustazProfileName",
    name
  );

  setText(
    "ustazProfileRole",
    roleLabel
  );

  setText(
    "ustazProfileMenuName",
    name
  );


  /* ---------------------------------------------------------
     LOCATION
  --------------------------------------------------------- */

  setText(
    "ustazSidebarLocation",
    location,
    "Location not set"
  );

  setText(
    "ustazHomeLocation",
    location,
    "Location not set"
  );

  setText(
    "ustazProfileMenuLocation",
    location,
    "Not set"
  );


  /* ---------------------------------------------------------
     MOSQUE
  --------------------------------------------------------- */

  setText(
    "ustazProfileMenuMosque",
    mosque,
    "Not set"
  );

  setText(
    "ustazSummaryLocation",
    location,
    "Not set"
  );

  setText(
    "ustazSummaryMosque",
    mosque,
    "Not set"
  );


  /* ---------------------------------------------------------
     CONTACT
  --------------------------------------------------------- */

  setText(
    "ustazProfileMenuPhone",
    text(
      user.phone,
      "Phone not available"
    )
  );

  setText(
    "ustazProfilePhone",
    text(
      user.phone,
      "—"
    )
  );


  /* ---------------------------------------------------------
     TELEGRAM
  --------------------------------------------------------- */

  const telegramVerification =
    formatVerification(
      user.telegramVerified ??
        user.telegram_verified
    );

  setText(
    "ustazProfileMenuTelegram",
    telegramVerification
  );

  setText(
    "ustazProfileTelegram",
    telegramVerification
  );


  /* ---------------------------------------------------------
     LOCATION DETAILS
  --------------------------------------------------------- */

  setText(
    "ustazSubcity",
    text(
      teacher.subcity ??
        teacher.sub_city,
      "Sub-city not set"
    )
  );

  setText(
    "ustazArea",
    text(
      teacher.area,
      "—"
    )
  );

  setText(
    "ustazProfileSubcity",
    text(
      teacher.subcity ??
        teacher.sub_city,
      "—"
    )
  );

  setText(
    "ustazProfileArea",
    text(
      teacher.area,
      "—"
    )
  );

  setText(
    "ustazProfileMosque",
    mosque,
    "—"
  );


  /* ---------------------------------------------------------
     EXPERIENCE
  --------------------------------------------------------- */

  const experience =
    formatExperience(
      teacher.experience
    );

  setText(
    "ustazExperience",
    experience
  );

  setText(
    "ustazProfileExperience",
    experience
  );


  /* ---------------------------------------------------------
     GENDER
  --------------------------------------------------------- */

  const gender =
    labelize(
      teacher.gender
    ) || "—";

  setText(
    "ustazHomeGender",
    gender
  );

  setText(
    "ustazProfileGender",
    gender
  );


  /* ---------------------------------------------------------
     DATE OF BIRTH
  --------------------------------------------------------- */

  setText(
    "ustazProfileDateOfBirth",
    formatDate(
      teacher.dateOfBirth ??
        teacher.date_of_birth ??
        teacher.birthDate ??
        teacher.birth_date
    )
  );


  /* ---------------------------------------------------------
     BIO
  --------------------------------------------------------- */

  const homeBio =
    text(
      teacher.bio ??
        teacher.about ??
        teacher.description,
      "Your teaching bio will appear here."
    );

  const profileBio =
    text(
      teacher.bio ??
        teacher.about ??
        teacher.description,
      "No bio added yet."
    );

  setText(
    "ustazHomeBio",
    homeBio
  );

  setText(
    "ustazProfileBio",
    profileBio
  );


  /* ---------------------------------------------------------
     RATE
  --------------------------------------------------------- */

  const rate =
    formatMoney(
      teacher.hourlyRate ??
        teacher.hourly_rate ??
        teacher.pricePerHour ??
        teacher.price_per_hour
    );


  /* ---------------------------------------------------------
     LESSON DURATION
  --------------------------------------------------------- */

  const duration =
    formatDuration(
      teacher.lessonDuration ??
        teacher.lesson_duration
    );


  /* ---------------------------------------------------------
     LESSON FORMAT
  --------------------------------------------------------- */

  const lessonFormat =
    formatLessonFormat(
      teacher.lessonFormat ??
        teacher.lesson_format
    );


  /* ---------------------------------------------------------
     HOME PROFILE VALUES
  --------------------------------------------------------- */

  setText(
    "ustazHomeRate",
    rate
  );

  setText(
    "ustazHomeDuration",
    duration
  );

  setText(
    "ustazHomeFormat",
    lessonFormat
  );


  /* ---------------------------------------------------------
     PROFILE VALUES
  --------------------------------------------------------- */

  setText(
    "ustazProfileRate",
    rate
  );

  setText(
    "ustazProfileDuration",
    duration
  );

  setText(
    "ustazProfileFormat",
    lessonFormat
  );


  /* ---------------------------------------------------------
     TEACHING APPROACH
  --------------------------------------------------------- */

  setText(
    "ustazProfileTeachingApproach",
    text(
      teacher.teachingApproach ??
        teacher.teaching_approach,
      "Not provided"
    )
  );


  /* ---------------------------------------------------------
     USTAZ AVAILABILITY
     
     IMPORTANT:
     This uses acceptingStudents / accepting_students.
     
     It does NOT use the old isAvailable field.
  --------------------------------------------------------- */

  setupUstazAvailabilitySwitch();


  /* ---------------------------------------------------------
     PROFILE COMPLETION
  --------------------------------------------------------- */

  setText(
    "ustazProfileStatus",
    isProfileComplete()
      ? "Complete"
      : "Incomplete"
  );

  setText(
    "ustazProfilePill",
    isProfileComplete()
      ? "Profile complete"
      : "Profile incomplete"
  );


  /* ---------------------------------------------------------
     ACCOUNT STATUS
  --------------------------------------------------------- */

  setText(
    "ustazProfileMenuStatus",
    labelize(
      user.accountStatus ??
        user.account_status
    ) || "Active"
  );
}


/* =========================================================
   SUBJECTS
========================================================= */

function renderSubjects() {
  const subjects =
    state.studyFields
      .map(
        normalizeStudyField
      )
      .map(text)
      .filter(Boolean);

  setText(
    "ustazSubjectsCount",
    String(subjects.length),
    "0"
  );

  setText(
    "ustazSummarySubjects",
    String(subjects.length),
    "0"
  );

  const containers = [
    $("ustazSubjectList"),
    $("ustazProfileSubjects"),
  ].filter(Boolean);

  containers.forEach(
    (container) => {
      container.replaceChildren();

      if (!subjects.length) {
        const empty =
          document.createElement(
            "span"
          );

        empty.className =
          "dashboard-empty-chip";

        empty.textContent =
          "No study fields selected";

        container.appendChild(
          empty
        );

        return;
      }

      subjects.forEach(
        (subject) => {
          const chip =
            document.createElement(
              "span"
            );

          chip.className =
            "dashboard-chip";

          chip.textContent =
            labelize(subject);

          container.appendChild(
            chip
          );
        }
      );
    }
  );
}


/* =========================================================
   LANGUAGES
========================================================= */

function renderLanguages() {
  let languages =
    state.languages
      .map(
        normalizeLanguage
      )
      .map(labelize)
      .filter(Boolean);

  if (!languages.length) {
    languages =
      normalizeArray(
        state.teacher?.languages ??
          state.teacher?.languagesSpoken
      )
        .map(
          normalizeLanguage
        )
        .map(labelize)
        .filter(Boolean);
  }

  languages = [
    ...new Set(
      languages
    ),
  ];

  const value =
    languages.length
      ? languages.join(", ")
      : "Not provided";

  setText(
    "ustazSummaryLanguages",
    value,
    "Not set"
  );

  setText(
    "ustazHomeLanguages",
    value,
    "Not provided"
  );

  setText(
    "ustazProfileLanguages",
    value,
    "Not provided"
  );
}


/* =========================================================
   SUMMARY
========================================================= */

function renderSummary() {
  const teacher =
    state.teacher || {};

  setText(
    "ustazSummaryLocation",
    formatLocation(
      teacher
    ),
    "Not set"
  );

  setText(
    "ustazSummaryMosque",
    text(
      teacher.nearestMosque ??
        teacher.nearest_mosque,
      "Not set"
    ),
    "Not set"
  );
}


/* =========================================================
   AVAILABILITY DAY LABEL
========================================================= */

function availabilityLabel(
  item
) {
  const normalized =
    normalizeAvailability(
      item
    );

  if (
    normalized.dayName
  ) {
    return normalized.dayName;
  }

  if (
    normalized.weekday !== null &&
    Number.isFinite(
      normalized.weekday
    ) &&
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

    return dayNames[
      normalized.weekday
    ];
  }

  return labelize(
    normalized.day
  );
}


/* =========================================================
   AVAILABILITY DAYS
========================================================= */

function renderAvailability() {
  const container =
    $("ustazAvailabilityDays");

  const empty =
    $("ustazAvailabilityEmpty");

  if (!container) {
    return;
  }

  container.replaceChildren();

  let values =
    state.availability
      .map(
        availabilityLabel
      )
      .map(text)
      .filter(Boolean);

  if (!values.length) {
    values =
      normalizeArray(
        state.teacher?.availabilityDays ??
          state.teacher?.availability_days
      )
        .map(
          availabilityLabel
        )
        .map(text)
        .filter(Boolean);
  }

  values = [
    ...new Set(values),
  ];

  if (empty) {
    empty.hidden =
      values.length > 0;
  }

  values.forEach(
    (day) => {
      const element =
        document.createElement(
          "div"
        );

      element.className =
        "ustaz-day active";

      const icon =
        document.createElement(
          "i"
        );

      icon.className =
        "fa-regular fa-calendar";

      const label =
        document.createElement(
          "span"
        );

      label.textContent =
        day.length > 3
          ? day.slice(0, 3)
          : day;

      element.appendChild(
        icon
      );

      element.appendChild(
        label
      );

      container.appendChild(
        element
      );
    }
  );
}


/* =========================================================
   QUALIFICATIONS
========================================================= */

function renderQualifications() {
  const containers = [
    $("ustazHomeQualifications"),
    $("ustazProfileQualifications"),
  ].filter(Boolean);

  containers.forEach(
    (container) => {
      container.replaceChildren();

      if (
        !state.qualifications.length
      ) {
        const empty =
          document.createElement(
            "div"
          );

        empty.className =
          "ustaz-qualification-empty";

        const icon =
          document.createElement(
            "i"
          );

        icon.className =
          "fa-regular fa-folder-open";

        const label =
          document.createElement(
            "span"
          );

        label.textContent =
          "No qualifications added yet.";

        empty.appendChild(
          icon
        );

        empty.appendChild(
          label
        );

        container.appendChild(
          empty
        );

        return;
      }

      state.qualifications.forEach(
        (qualification) => {
          const card =
            document.createElement(
              "article"
            );

          card.className =
            "ustaz-qualification-card";


          /* -------------------------------------------------
             QUALIFICATION HEADING
          ------------------------------------------------- */

          const heading =
            document.createElement(
              "div"
            );

          heading.className =
            "ustaz-qualification-heading";

          const icon =
            document.createElement(
              "span"
            );

          icon.className =
            "ustaz-qualification-icon";

          const iconGlyph =
            document.createElement(
              "i"
            );

          iconGlyph.className =
            "fa-solid fa-graduation-cap";

          icon.appendChild(
            iconGlyph
          );

          const copy =
            document.createElement(
              "div"
            );

          const title =
            document.createElement(
              "strong"
            );

          title.textContent =
            qualification.title ||
            "Qualification";

          const metaParts = [
            qualification.institution,
            qualification.specialization,
            qualification.completionYear
              ? `Completed ${qualification.completionYear}`
              : "",
          ].filter(Boolean);

          const meta =
            document.createElement(
              "span"
            );

          meta.textContent =
            metaParts.length
              ? metaParts.join(" • ")
              : "Details not provided";

          copy.appendChild(
            title
          );

          copy.appendChild(
            meta
          );

          heading.appendChild(
            icon
          );

          heading.appendChild(
            copy
          );

          card.appendChild(
            heading
          );


          /* -------------------------------------------------
             CERTIFICATE THUMBNAIL
          ------------------------------------------------- */

          const certificateUrl =
            qualification.certificateUrl ??
            qualification.certificate_url ??
            "";

          if (certificateUrl) {
            const thumbnailButton =
              document.createElement(
                "button"
              );

            thumbnailButton.type =
              "button";

            thumbnailButton.className =
              "ustaz-qualification-thumbnail";

            thumbnailButton.setAttribute(
              "aria-label",
              `View certificate for ${
                qualification.title ||
                "qualification"
              }`
            );

            const mime =
              text(
                qualification.certificateMime ??
                  qualification.certificate_mime
              ).toLowerCase();

            const filename =
              text(
                qualification.certificateName ??
                  qualification.certificate_name
              ).toLowerCase();

            const isPdf =
              mime ===
                "application/pdf" ||
              /\.pdf(?:$|\?)/i.test(
                filename
              );


            /* -----------------------------------------------
               IMAGE THUMBNAIL
            ------------------------------------------------ */

            if (!isPdf) {
              const image =
                document.createElement(
                  "img"
                );

              image.className =
                "ustaz-qualification-thumbnail-image";

              image.src =
                resolveMediaUrl(
                  certificateUrl
                );

              image.alt =
                `${
                  qualification.title ||
                  "Qualification"
                } certificate`;

              image.loading =
                "lazy";

              image.decoding =
                "async";

              image.addEventListener(
                "error",
                () => {
                  image.hidden =
                    true;

                  const fallback =
                    document.createElement(
                      "span"
                    );

                  fallback.className =
                    "ustaz-qualification-thumbnail-fallback";

                  fallback.innerHTML = `
                    <i class="fa-regular fa-image"></i>
                    <span>View certificate</span>
                  `;

                  thumbnailButton.prepend(
                    fallback
                  );
                },
                {
                  once: true,
                }
              );

              thumbnailButton.appendChild(
                image
              );
            } else {
              /* ---------------------------------------------
                 PDF THUMBNAIL
              ---------------------------------------------- */

              const pdfThumbnail =
                document.createElement(
                  "span"
                );

              pdfThumbnail.className =
                "ustaz-qualification-pdf-thumbnail";

              pdfThumbnail.innerHTML = `
                <i class="fa-solid fa-file-pdf"></i>
                <span>PDF certificate</span>
              `;

              thumbnailButton.appendChild(
                pdfThumbnail
              );
            }


            /* -----------------------------------------------
               VIEW ICON
            ------------------------------------------------ */

            const overlay =
              document.createElement(
                "span"
              );

            overlay.className =
              "ustaz-qualification-thumbnail-overlay";

            overlay.innerHTML = `
              <i class="fa-solid fa-expand"></i>
            `;

            thumbnailButton.appendChild(
              overlay
            );


            /* -----------------------------------------------
               OPEN VIEWER
            ------------------------------------------------ */

            thumbnailButton.addEventListener(
              "click",
              () => {
                openCertificateViewer(
                  qualification
                );
              }
            );

            card.appendChild(
              thumbnailButton
            );
          } else if (
            qualification.certificateName ||
            qualification.certificate_name
          ) {
            /* ---------------------------------------------
               CERTIFICATE WITHOUT URL
            ---------------------------------------------- */

            const fileLabel =
              document.createElement(
                "div"
              );

            fileLabel.className =
              "ustaz-qualification-file";

            const fileIcon =
              document.createElement(
                "i"
              );

            fileIcon.className =
              "fa-regular fa-file-lines";

            const fileText =
              document.createElement(
                "span"
              );

            fileText.textContent =
              "Certificate uploaded";

            fileLabel.appendChild(
              fileIcon
            );

            fileLabel.appendChild(
              fileText
            );

            card.appendChild(
              fileLabel
            );
          }

          container.appendChild(
            card
          );
        }
      );
    }
  );
}


/* =========================================================
   TRUST
========================================================= */

function trustFlag(
  value
) {
  return [
    "true",
    "1",
    "yes",
  ].includes(
    text(value).toLowerCase()
  );
}


function readTrustFlags(
  sources = []
) {
  const keys = {
    qualificationSubmitted: [
      "qualificationSubmitted",
      "qualification_submitted",
    ],

    identityVerified: [
      "identityVerified",
      "identity_verified",
    ],

    subscriptionActive: [
      "subscriptionActive",
      "subscription_active",
    ],
  };

  const candidates = [];

  sources.forEach(
    (source) => {
      if (
        !isObject(source)
      ) {
        return;
      }

      candidates.push(
        source
      );

      if (
        isObject(source.trust)
      ) {
        candidates.push(
          source.trust
        );
      }

      if (
        isObject(source.profileTrust)
      ) {
        candidates.push(
          source.profileTrust
        );
      }

      if (
        isObject(source.profile_trust)
      ) {
        candidates.push(
          source.profile_trust
        );
      }
    }
  );

  const flags = {
    qualificationSubmitted:
      false,

    identityVerified:
      false,

    subscriptionActive:
      false,
  };

  Object.keys(keys).forEach(
    (flag) => {
      for (
        const source of candidates
      ) {
        for (
          const key of keys[flag]
        ) {
          if (
            source[key] !==
              undefined &&
            source[key] !==
              null
          ) {
            flags[flag] =
              trustFlag(
                source[key]
              );

            return;
          }
        }
      }
    }
  );

  return flags;
}


function getTrustStateKey(
  flags = {}
) {
  const credentials =
    flags.qualificationSubmitted ===
    true;

  const identity =
    flags.identityVerified ===
    true;

  if (
    credentials &&
    identity
  ) {
    return "trusted";
  }

  if (credentials) {
    return "credentials";
  }

  if (identity) {
    return "identity";
  }

  return "none";
}


function renderTrustStatus() {
  const key =
    getTrustStateKey(
      state.trust
    );

  const labels = {
    none: "",
    credentials:
      "Credentials Submitted",
    identity:
      "Identity Verified",
    trusted:
      "Trusted Profile",
  };

  const icons = {
    none: "",
    credentials:
      "fa-solid fa-file-circle-check",
    identity:
      "fa-solid fa-user-check",
    trusted:
      "fa-solid fa-shield-halved",
  };


  /* =======================================================
     OVERVIEW CARD
  ======================================================= */

  const overviewIndicator =
    $(
      "ustazProfileTrustIndicator"
    );

  const overviewLabel =
    $(
      "ustazProfileTrustLabel"
    );

  const overviewInfoButton =
    $(
      "ustazProfileTrustInfoButton"
    );

  if (
    overviewIndicator &&
    overviewLabel
  ) {
    overviewIndicator.dataset
      .trustState =
      key;

    overviewLabel.textContent =
      labels[key] || "";

    overviewIndicator.hidden =
      key === "none";

    if (
      overviewInfoButton
    ) {
      overviewInfoButton.hidden =
        key === "none";
    }
  }


  /* =======================================================
     MY PROFILE — TEACHING PROFILE
  ======================================================= */

  const pageTrust =
    $(
      "ustazProfilePageTrust"
    );

  const pageTrustIcon =
    $(
      "ustazProfilePageTrustIcon"
    );

  const pageTrustLabel =
    $(
      "ustazProfilePageTrustLabel"
    );

  const pageProfileCard =
    document.querySelector(
      ".ustaz-profile-identity-compact"
    );

  if (
    pageProfileCard
  ) {
    pageProfileCard.dataset
      .trustState =
      key;
  }

  if (
    pageTrust &&
    pageTrustIcon &&
    pageTrustLabel
  ) {
    pageTrust.dataset
      .trustState =
      key;

    pageTrustLabel.textContent =
      labels[key] || "";

    pageTrustIcon.className =
      icons[key] || "";

    pageTrust.hidden =
      key === "none";
  }
}


/* =========================================================
   TRUST INFO
========================================================= */

function setupTrustInfo() {
  const button =
    $(
      "ustazProfileTrustInfoButton"
    );

  const info =
    $(
      "ustazProfileTrustInfo"
    );

  if (
    !button ||
    !info ||
    button.dataset
      .ustazTrustBound ===
      "1"
  ) {
    return;
  }

  button.dataset
    .ustazTrustBound =
    "1";

  const setOpen =
    (open) => {
      info.hidden =
        !open;

      button.setAttribute(
        "aria-expanded",
        open
          ? "true"
          : "false"
      );
    };

  button.addEventListener(
    "click",
    (event) => {
      event.preventDefault();

      event.stopPropagation();

      setOpen(
        info.hidden
      );
    }
  );

  document.addEventListener(
    "click",
    (event) => {
      const target =
        event.target;

      if (
        target instanceof
          Element &&
        !button.contains(
          target
        ) &&
        !info.contains(
          target
        ) &&
        !info.hidden
      ) {
        setOpen(false);
      }
    }
  );

  document.addEventListener(
    "keydown",
    (event) => {
      if (
        event.key ===
          "Escape" &&
        !info.hidden
      ) {
        setOpen(false);
      }
    }
  );
}


/* =========================================================
   ROLE / PROFILE STATE
========================================================= */

function isUstazRole() {
  const role =
    text(
      state.user?.role
    ).toLowerCase();

  if (!role) {
    return true;
  }

  return role ===
    "ustaz";
}


function isProfileComplete() {
  return Boolean(
    state.user?.profileCompleted ??
      state.user?.profile_completed ??
      false
  );
}


/* =========================================================
   EXPORTS
========================================================= */

export {
  ensureCertificateViewer,
  closeCertificateViewer,
  openCertificateViewer,

  normalizeAvailabilityValue,
  getUstazAvailability,
  renderUstazAvailability,
  updateUstazAvailability,
  setupUstazAvailabilitySwitch,

  getProfilePhoto,
  mountAvatar,
  mountAllAvatars,

  normalizeStudyField,
  normalizeLanguage,
  normalizeAvailability,
  normalizeQualification,
  normalizeCollection,
  extractProfile,

  formatLocation,
  formatExperience,
  formatMoney,
  formatDuration,
  formatLessonFormat,
  formatAvailabilityStatus,
  formatVerification,
  formatDate,

  teacherValue,

  renderAccountDetails,
  renderSubjects,
  renderLanguages,
  renderSummary,
  availabilityLabel,
  renderAvailability,
  renderQualifications,

  trustFlag,
  readTrustFlags,
  getTrustStateKey,
  renderTrustStatus,
  setupTrustInfo,

  isUstazRole,
  isProfileComplete,
};