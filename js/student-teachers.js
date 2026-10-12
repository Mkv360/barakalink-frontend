'use strict';

/* =========================================================
   BARAKALINK STUDENT DASHBOARD TEACHER DISCOVERY

   Teacher loading, matching, filters, sorting, cards,
   profile media, trust indicators, saving, and saved-teacher
   rendering all live in this module.
========================================================= */

import { STUDENT_CONFIG, $, $$ } from './student-core.js';
import { state } from './student-state.js';
import { safeString, normalizeArray, escapeHtml } from './student-utils.js';
import { getStudyFieldLabel } from './student-profile.js';
import { apiRequest } from './student-api.js';

let teacherDiscoveryLoaded = false;
let teacherPhotoViewer = null;

const SAVED_TEACHERS_KEY = 'barakalink_saved_teacher_ids';

const teacherDependencies = {
  showSection: null,
  closeMobileSidebar: null,
};

/* =========================================================
   PARENT CHAT REVIEW MODAL
========================================================= */

let parentChatReviewModalReady = false;
let parentChatReviewModalPreviousFocus = null;

function injectParentChatReviewModalStyles() {
  if (document.querySelector('style[data-barakalink-parent-chat-review-modal]')) {
    return;
  }

  const style = document.createElement('style');
  style.setAttribute('data-barakalink-parent-chat-review-modal', 'true');
  style.textContent = `
    .ustaz-modal[hidden] { display: none !important; }
    .ustaz-modal {
      position: fixed; inset: 0; z-index: 99999;
      display: flex; align-items: center; justify-content: center;
      padding: 20px; opacity: 0; visibility: hidden;
      transition: opacity .22s ease, visibility .22s ease;
    }
    .ustaz-modal.is-open { opacity: 1; visibility: visible; }
    .ustaz-modal-backdrop {
      position: absolute; inset: 0;
      background: rgba(10, 12, 18, .58); backdrop-filter: blur(4px);
    }
    .ustaz-modal-dialog {
      position: relative; z-index: 1; width: min(460px, calc(100vw - 32px));
      max-height: calc(100vh - 32px); overflow-y: auto; padding: 30px 28px 26px;
      border: 1px solid var(--border); border-radius: 22px;
      background: var(--surface); color: var(--text);
      box-shadow: 0 30px 80px rgba(0, 0, 0, .22); text-align: center;
    }
    .ustaz-modal-close {
      position: absolute; top: 12px; right: 12px; width: 38px; height: 38px;
      display: grid; place-items: center; padding: 0; border: 1px solid var(--border);
      border-radius: 11px; background: var(--surface-soft); color: var(--text-muted);
      cursor: pointer; transition: background .2s ease, color .2s ease, border-color .2s ease;
    }
    .ustaz-modal-close:hover { background: var(--surface-muted); color: var(--text); border-color: var(--gold-light); }
    .ustaz-modal-icon {
      width: 58px; height: 58px; display: grid; place-items: center;
      margin: 2px auto 18px; border-radius: 17px;
      background: var(--gold-soft); color: var(--gold-deep); font-size: 21px;
    }
    .ustaz-modal-title {
      margin: 0; color: var(--text); font-family: "Fraunces", Georgia, serif;
      font-size: 29px; font-weight: 600; line-height: 1.1; letter-spacing: -.02em;
    }
    .ustaz-modal-description {
      margin: 14px auto 0; max-width: 390px; color: var(--text-soft);
      font-size: 14px; line-height: 1.7;
    }
    .ustaz-modal-actions { display: flex; justify-content: center; margin-top: 24px; }
    .ustaz-modal-button {
      min-width: 120px; min-height: 42px; padding: 10px 20px;
      border: 1px solid transparent; border-radius: 12px; font: inherit;
      font-size: 13px; font-weight: 700; cursor: pointer;
    }
    .ustaz-modal-button-primary { background: var(--gold); color: #fff; }
    .ustaz-modal-button-primary:hover { background: var(--gold-deep); }
    body.ustaz-modal-open { overflow: hidden; }
    @media (max-width: 640px) {
      .ustaz-modal { padding: 16px; }
      .ustaz-modal-dialog {
        width: min(460px, calc(100vw - 24px)); padding: 28px 20px 22px; border-radius: 20px;
      }
      .ustaz-modal-title { font-size: 26px; }
      .ustaz-modal-description { font-size: 13px; }
    }
    @media (prefers-reduced-motion: reduce) { .ustaz-modal { transition: none; } }
  `;
  document.head.appendChild(style);
}

function setupParentChatReviewModal() {
  if (parentChatReviewModalReady) return;

  const modal = document.getElementById('ustazParentChatReviewModal');
  if (!modal) {
    console.warn('[BarakaLink][Student] Parent chat review modal was not found.');
    return;
  }

  injectParentChatReviewModalStyles();

  const closeButton = document.getElementById('ustazParentChatReviewClose');
  const doneButton = document.getElementById('ustazParentChatReviewDone');
  const backdrop = modal.querySelector('[data-parent-chat-review-close]');

  closeButton?.addEventListener('click', closeParentChatReviewModal);
  doneButton?.addEventListener('click', closeParentChatReviewModal);
  backdrop?.addEventListener('click', closeParentChatReviewModal);

  parentChatReviewModalReady = true;
}

function openParentChatReviewModal() {
  const modal = document.getElementById('ustazParentChatReviewModal');
  if (!modal) {
    console.warn('[BarakaLink][Student] Parent chat review modal was not found.');
    return;
  }

  setupParentChatReviewModal();
  parentChatReviewModalPreviousFocus = document.activeElement;
  modal.hidden = false;
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('ustaz-modal-open');

  requestAnimationFrame(() => {
    modal.classList.add('is-open');
    const focusTarget =
      document.getElementById('ustazParentChatReviewDone') ||
      document.getElementById('ustazParentChatReviewClose');

    try {
      focusTarget?.focus({ preventScroll: true });
    } catch (_) {
      focusTarget?.focus();
    }
  });
}

function closeParentChatReviewModal() {
  const modal = document.getElementById('ustazParentChatReviewModal');
  if (!modal) return;

  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('ustaz-modal-open');

  window.setTimeout(() => {
    if (!modal.classList.contains('is-open')) modal.hidden = true;
  }, 220);

  const previousFocus = parentChatReviewModalPreviousFocus;
  parentChatReviewModalPreviousFocus = null;

  if (previousFocus?.isConnected && typeof previousFocus.focus === 'function') {
    try {
      previousFocus.focus({ preventScroll: true });
    } catch (_) {
      previousFocus.focus();
    }
  }
}

document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  const modal = document.getElementById('ustazParentChatReviewModal');
  if (!modal || modal.hidden) return;
  closeParentChatReviewModal();
});

/* =========================================================
   TEACHER HELPERS
========================================================= */

export function getTeacherDisplayName(teacher) {
  const fullName = safeString(
    teacher?.name ?? teacher?.fullName ?? teacher?.full_name
  );
  if (fullName) return fullName;

  return [
    safeString(teacher?.firstName ?? teacher?.first_name),
    safeString(teacher?.lastName ?? teacher?.last_name),
  ].filter(Boolean).join(' ').trim() || 'Ustaz';
}

export function getTeacherGender(teacher) {
  return safeString(teacher?.gender, '').toLowerCase();
}

export function getTeacherBio(teacher) {
  return safeString(teacher?.bio ?? teacher?.about ?? teacher?.description, '');
}

export function getTeacherLocation(teacher) {
  const location = teacher?.location || {};
  return [
    safeString(teacher?.area ?? teacher?.area_name ?? location.area),
    safeString(teacher?.subcity ?? teacher?.subcity_name ?? location.subcity),
  ].filter(Boolean).join(', ');
}

export function getTeacherStudyFields(teacher) {
  const values = teacher?.studyFields ?? teacher?.study_fields ?? teacher?.fields ?? [];
  if (!Array.isArray(values)) return [];

  return [...new Set(values.map(field => {
    if (typeof field === 'object' && field !== null) {
      return safeString(field.slug) || safeString(field.name);
    }
    return safeString(field);
  }).filter(Boolean))];
}

export function teacherMatchesGender(teacher) {
  const preferred = safeString(
    state.preferences.preferredTeacherGender,
    'no-preference'
  ).toLowerCase();
  if (preferred === 'no-preference' || !preferred) return true;
  return getTeacherGender(teacher) === preferred;
}

export function teacherMatchesStudyFields(teacher) {
  const selected = normalizeArray(state.preferences.studyInterests)
    .map(value => safeString(value).toLowerCase());
  if (!selected.length) return true;

  const teacherFields = getTeacherStudyFields(teacher)
    .map(value => safeString(value).toLowerCase());
  if (!teacherFields.length) return false;
  return selected.some(field => teacherFields.includes(field));
}

export function teacherMatchesFilter(teacher) {
  switch (state.currentTeacherFilter) {
    case 'male':
      return getTeacherGender(teacher) === 'male';
    case 'female':
      return getTeacherGender(teacher) === 'female';
    case 'study':
      return teacherMatchesStudyFields(teacher);
    case 'all':
    default:
      return true;
  }
}

export function teacherMatchesSearch(teacher) {
  const search = safeString(state.searchTerm).toLowerCase();
  if (!search) return true;

  const values = [
    getTeacherDisplayName(teacher),
    getTeacherBio(teacher),
    getTeacherLocation(teacher),
    ...getTeacherStudyFields(teacher).map(field => getStudyFieldLabel(field)),
  ];
  return values.some(value => safeString(value).toLowerCase().includes(search));
}

export function getTeacherDistance(teacher) {
  const value = teacher?.distanceKm ?? teacher?.distance_km ?? teacher?.distance ??
    teacher?.proximityDistance ?? teacher?.proximity_distance;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

export function getTeacherProximityRank(teacher) {
  const number = Number(teacher?.proximityRank ?? teacher?.proximity_rank);
  return Number.isFinite(number) ? number : Number.POSITIVE_INFINITY;
}

export function sortTeachers(teachers) {
  const list = Array.isArray(teachers) ? [...teachers] : [];

  if (state.sortMode === 'nearest') {
    list.sort((a, b) => {
      const distanceA = getTeacherDistance(a);
      const distanceB = getTeacherDistance(b);

      if (distanceA !== null || distanceB !== null) {
        if (distanceA === null) return 1;
        if (distanceB === null) return -1;
        if (distanceA !== distanceB) return distanceA - distanceB;
      }

      const proximityA = getTeacherProximityRank(a);
      const proximityB = getTeacherProximityRank(b);
      if (proximityA !== proximityB) return proximityA - proximityB;
      return getTeacherDisplayName(a).localeCompare(getTeacherDisplayName(b));
    });
  }

  return list;
}

export function applyTeacherFilters() {
  let result = state.teachers.filter(teacher => teacherMatchesFilter(teacher));
  result = result.filter(teacher => teacherMatchesSearch(teacher));
  state.filteredTeachers = sortTeachers(result);
  renderTeacherResults();
}

export function teacherInitials(teacher) {
  const parts = getTeacherDisplayName(teacher).split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map(part => part.charAt(0)).join('').toUpperCase() || 'U';
}

export function resolveTeacherMediaUrl(value) {
  const raw = safeString(value);
  if (!raw) return '';
  if (/^(https?:|data:|blob:|filesystem:)/i.test(raw)) return raw;

  try {
    return new URL(raw, `${STUDENT_CONFIG.API_BASE}/`).href;
  } catch (_) {
    return raw;
  }
}

export function teacherPhotoUrl(teacher) {
  const raw = safeString(
    teacher?.photoUrl ?? teacher?.photoURL ?? teacher?.profilePhotoUrl ??
    teacher?.profile_photo_url ?? teacher?.photo ?? teacher?.avatarUrl ??
    teacher?.avatar_url
  );
  return resolveTeacherMediaUrl(raw);
}

export function getTeacherId(teacher) {
  return teacher?.id ?? teacher?.userId ?? teacher?.user_id ?? null;
}

export function formatTeacherDistance(teacher) {
  const distance = getTeacherDistance(teacher);
  if (!Number.isFinite(distance)) return '';
  const rounded = Number(distance.toFixed(distance < 10 ? 1 : 0));
  return `${rounded} km`;
}

/* =========================================================
   TEACHER AVAILABILITY
========================================================= */

function isExplicitlyDisabled(value) {
  if (value === false || value === 0) return true;
  if (value === null || value === undefined || value === '') return false;

  return [
    '0', 'false', 'off', 'no', 'unavailable', 'disabled',
  ].includes(String(value).trim().toLowerCase());
}

function getTeacherAvailabilityData(teacher) {
  const profile = teacher?.teacherProfile ?? teacher?.teacher_profile ?? {};
  const availabilityValues = [
    teacher?.isAvailable,
    teacher?.is_available,
    profile?.isAvailable,
    profile?.is_available,
  ];
  const acceptingValues = [
    teacher?.acceptingStudents,
    teacher?.accepting_students,
    profile?.acceptingStudents,
    profile?.accepting_students,
  ];
  const hasAvailabilityValue = availabilityValues.some(value =>
    value !== null && value !== undefined && value !== ''
  );

  return { availabilityValues, acceptingValues, hasAvailabilityValue };
}

function isTeacherAcceptingNewStudents(teacher) {
  const { availabilityValues, acceptingValues, hasAvailabilityValue } =
    getTeacherAvailabilityData(teacher);

  // Unknown status is not shown as confirmed available.
  if (!hasAvailabilityValue) return false;

  return !availabilityValues.some(isExplicitlyDisabled) &&
    !acceptingValues.some(isExplicitlyDisabled);
}

function extractTeacherArray(payload) {
  const candidates = [
    payload,
    payload?.data,
    payload?.result,
    payload?.data?.data,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
    if (Array.isArray(candidate?.teachers)) return candidate.teachers;
    if (Array.isArray(candidate?.results)) return candidate.results;
    if (Array.isArray(candidate?.data)) return candidate.data;
  }

  return [];
}

async function fetchCurrentTeacherAvailability(userId) {
  const endpoint = STUDENT_CONFIG.TEACHERS_ENDPOINT;
  if (!endpoint) {
    throw new Error('The teacher availability endpoint is not configured.');
  }

  const payload = await apiRequest(endpoint);
  const teachers = extractTeacherArray(payload);
  const teacher = teachers.find(item => Number(
    item?.userId ?? item?.user_id ?? item?.id ?? item?.user?.id
  ) === Number(userId));

  if (!teacher) {
    throw new Error(
      'Could not verify this Ustaz’s current availability. Refresh Find Ustaz and try again.'
    );
  }

  if (!getTeacherAvailabilityData(teacher).hasAvailabilityValue) {
    throw new Error(
      'The Ustaz’s availability could not be confirmed. Refresh Find Ustaz and try again.'
    );
  }

  return teacher;
}

function updateTeacherAvailabilityBadge(article, teacher) {
  const badge = article.querySelector('[data-teacher-availability]');
  if (!badge) return;

  const available = isTeacherAcceptingNewStudents(teacher);
  badge.classList.toggle('is-available', available);
  badge.classList.toggle('is-unavailable', !available);
  badge.dataset.availability = available ? 'available' : 'unavailable';

  const label = badge.querySelector('[data-teacher-availability-label]');
  if (label) {
    label.textContent = available ? 'Available' : 'Not available';
  }
}

/* =========================================================
   PARENT PROFILE REVIEW / CHAT PERMISSION
========================================================= */

function getParentProfileReviewStatus() {
  const profile = state.profile || {};
  const student = profile.student || {};

  return safeString(
    profile.profileReviewStatus ?? profile.profile_review_status ??
    student.profileReviewStatus ?? student.profile_review_status,
    ''
  ).trim().toLowerCase();
}

function canParentMessageTeachers() {
  const profile = state.profile || {};
  const role = safeString(profile.role, '').toLowerCase();

  // Non-parent dashboard roles retain the existing chat behavior.
  if (role !== 'parent') return true;

  const reviewStatus = getParentProfileReviewStatus();
  return reviewStatus === 'approved' || (!reviewStatus && Boolean(profile.profileCompleted));
}

/* =========================================================
   TEACHER PHOTO VIEWER
========================================================= */

export function ensureTeacherPhotoViewer() {
  if (teacherPhotoViewer) return teacherPhotoViewer;

  const viewer = document.createElement('div');
  viewer.className = 'student-teacher-photo-viewer';
  viewer.hidden = true;
  viewer.setAttribute('aria-hidden', 'true');
  viewer.innerHTML = `
    <div class="student-teacher-photo-viewer-backdrop" data-teacher-photo-close></div>
    <div class="student-teacher-photo-viewer-dialog" role="dialog" aria-modal="true"
      aria-labelledby="studentTeacherPhotoViewerTitle">
      <button type="button" class="student-teacher-photo-viewer-close"
        aria-label="Close profile photo" data-teacher-photo-close>
        <i class="fa-solid fa-xmark" aria-hidden="true"></i>
      </button>
      <div class="student-teacher-photo-viewer-image-wrap">
        <img id="studentTeacherPhotoViewerImage" src="" alt="">
      </div>
      <div class="student-teacher-photo-viewer-caption">
        <strong id="studentTeacherPhotoViewerTitle">Teacher profile photo</strong>
        <span>Profile photo</span>
      </div>
    </div>
  `;

  document.body.appendChild(viewer);
  viewer.querySelectorAll('[data-teacher-photo-close]').forEach(element => {
    element.addEventListener('click', closeTeacherPhotoViewer);
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && teacherPhotoViewer && !teacherPhotoViewer.hidden) {
      closeTeacherPhotoViewer();
    }
  });

  teacherPhotoViewer = viewer;
  return viewer;
}

export function openTeacherPhotoViewer(photoUrl, teacherName) {
  const url = safeString(photoUrl);
  if (!url) return;

  const viewer = ensureTeacherPhotoViewer();
  const image = viewer.querySelector('#studentTeacherPhotoViewerImage');
  const title = viewer.querySelector('#studentTeacherPhotoViewerTitle');
  if (!image) return;

  const displayName = safeString(teacherName, 'Teacher');
  image.src = url;
  image.alt = `${displayName} profile photo`;
  if (title) title.textContent = `${displayName} profile photo`;

  viewer.hidden = false;
  viewer.setAttribute('aria-hidden', 'false');
  document.body.classList.add('student-teacher-photo-viewer-open');
  requestAnimationFrame(() => viewer.classList.add('is-open'));

  const closeButton = viewer.querySelector('.student-teacher-photo-viewer-close');
  if (closeButton) {
    requestAnimationFrame(() => {
      try {
        closeButton.focus({ preventScroll: true });
      } catch (_) {
        closeButton.focus();
      }
    });
  }
}

export function closeTeacherPhotoViewer() {
  if (!teacherPhotoViewer) return;

  teacherPhotoViewer.classList.remove('is-open');
  teacherPhotoViewer.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('student-teacher-photo-viewer-open');

  const viewer = teacherPhotoViewer;
  window.setTimeout(() => {
    if (!viewer.classList.contains('is-open')) viewer.hidden = true;
  }, 220);

  const image = viewer.querySelector('#studentTeacherPhotoViewerImage');
  if (image) image.removeAttribute('src');
}

/* =========================================================
   TEACHER CARD
========================================================= */

export function createTeacherCard(teacher) {
  setupParentChatReviewModal();

  const article = document.createElement('article');
  article.className = 'student-teacher-card';

  const name = getTeacherDisplayName(teacher);
  const gender = getTeacherGender(teacher);
  const location = getTeacherLocation(teacher);
  const bio = getTeacherBio(teacher);
  const fields = getTeacherStudyFields(teacher);
  const distance = formatTeacherDistance(teacher);
  const photoUrl = teacherPhotoUrl(teacher);
  const profileId = teacher?.id ?? teacher?.userId ?? teacher?.user_id ?? '';
  const userId = teacher?.userId ?? teacher?.user_id ?? teacher?.user?.id ?? profileId;

  const genderLabel = gender === 'female' ? 'Ustaza' : gender === 'male' ? 'Ustaz' : 'Teacher';
  const fieldHTML = fields.slice(0, 5).map(field => `
    <span class="student-teacher-field">${escapeHtml(getStudyFieldLabel(field))}</span>
  `).join('');
  const safeName = escapeHtml(name);

  /* TEACHER PROFILE TRUST */
  const trust = teacher?.profileTrust ?? teacher?.profile_trust ?? teacher?.trust ?? {};
  const qualificationList = teacher?.qualifications ??
    teacher?.teacherQualifications ?? teacher?.teacher_qualifications ??
    teacher?.teacherProfile?.qualifications ??
    teacher?.teacherProfile?.teacherQualifications ??
    teacher?.teacherProfile?.teacher_qualifications ??
    teacher?.teacher_profile?.qualifications ??
    teacher?.teacher_profile?.teacherQualifications ??
    teacher?.teacher_profile?.teacher_qualifications ?? [];

  const qualificationSubmitted = trust.qualificationSubmitted === true ||
    trust.qualification_submitted === true ||
    (Array.isArray(qualificationList) && qualificationList.length > 0);
  const identityVerified = trust.identityVerified === true || trust.identity_verified === true;

  let trustState = 'none';
  if (qualificationSubmitted && identityVerified) trustState = 'trusted';
  else if (qualificationSubmitted) trustState = 'credentials';
  else if (identityVerified) trustState = 'identity';

  const trustLabels = {
    credentials: 'Credentials Submitted',
    identity: 'Identity Verified',
    trusted: 'Trusted Profile',
  };
  const trustIcons = {
    credentials: 'fa-solid fa-file-circle-check',
    identity: 'fa-solid fa-user-check',
    trusted: 'fa-solid fa-shield-halved',
  };

  const trustNameDotHTML = trustState !== 'none' ? `
    <span class="student-teacher-name-trust-dot"
      data-trust-state="${trustState}"
      aria-label="${escapeHtml(trustLabels[trustState])}"
      title="${escapeHtml(trustLabels[trustState])}"
      aria-hidden="true"></span>
  ` : '';

  const trustHTML = trustState !== 'none' ? `
    <div class="student-teacher-trust" data-trust-state="${trustState}">
      <i class="${trustIcons[trustState]}" aria-hidden="true"></i>
      <span>${escapeHtml(trustLabels[trustState])}</span>
    </div>
  ` : '';

  /*
   * IMPORTANT: Create the availability badge while building the card.
   * It must not live inside the Chat click handler.
   */
  const initiallyAvailable = isTeacherAcceptingNewStudents(teacher);
  const availabilityBadgeHTML = `
    <div class="student-teacher-availability ${initiallyAvailable ? 'is-available' : 'is-unavailable'}"
      data-teacher-availability
      data-availability="${initiallyAvailable ? 'available' : 'unavailable'}"
      role="status" aria-live="polite">
      <span class="student-teacher-availability-dot" aria-hidden="true"></span>
      <span data-teacher-availability-label>
        ${initiallyAvailable ? 'Available' : 'Not available'}
      </span>
    </div>
  `;

  article.innerHTML = `
    <div class="student-teacher-card-top">
      <div class="student-teacher-avatar" data-teacher-avatar>
        <span>${escapeHtml(teacherInitials(teacher))}</span>
        <img src="" alt="" hidden>
      </div>

      <span class="student-teacher-gender-badge">
        <i class="fa-solid fa-user" aria-hidden="true"></i>
        ${escapeHtml(genderLabel)}
      </span>

      ${distance ? `
        <span class="student-teacher-distance">
          <i class="fa-solid fa-location-dot" aria-hidden="true"></i>
          ${escapeHtml(distance)}
        </span>
      ` : ''}
    </div>

    <div class="student-teacher-card-body">
      <div class="student-teacher-name-row">
        <h3 class="student-teacher-name">${safeName}</h3>
        ${trustNameDotHTML}
        ${availabilityBadgeHTML}
      </div>

      ${trustHTML}

      ${location ? `
        <div class="student-teacher-location">
          <i class="fa-solid fa-location-dot" aria-hidden="true"></i>
          <span>${escapeHtml(location)}</span>
        </div>
      ` : ''}

      ${bio ? `
        <p class="student-teacher-bio">${escapeHtml(bio)}</p>
      ` : ''}

      ${fieldHTML ? `
        <div class="student-teacher-fields">${fieldHTML}</div>
      ` : ''}

      <div class="student-teacher-card-footer">
        <a href="#" class="student-teacher-view" data-teacher-view
          data-teacher-id="${escapeHtml(String(profileId))}">
          View profile
          <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
        </a>

        <button type="button" class="student-teacher-chat" data-teacher-chat
          data-teacher-user-id="${escapeHtml(String(userId))}"
          aria-label="Chat with ${safeName}" title="Chat with ${safeName}">
          <i class="fa-regular fa-comment-dots" aria-hidden="true"></i>
        </button>

        <button type="button" class="student-teacher-save" data-teacher-save
          aria-label="Save ${safeName}"
          data-teacher-id="${escapeHtml(String(profileId))}">
          <i class="fa-regular fa-bookmark" aria-hidden="true"></i>
        </button>
      </div>
    </div>
  `;

  /* TEACHER PROFILE IMAGE */
  const image = article.querySelector('[data-teacher-avatar] img');
  const initials = article.querySelector('[data-teacher-avatar] span');

  if (image && initials && photoUrl) {
    image.alt = `${name} profile photo`;
    image.onload = () => {
      image.hidden = false;
      initials.hidden = true;
    };
    image.onerror = () => {
      image.hidden = true;
      initials.hidden = false;
    };
    image.src = photoUrl;

    const avatar = article.querySelector('[data-teacher-avatar]');
    if (avatar) {
      avatar.setAttribute('role', 'button');
      avatar.setAttribute('tabindex', '0');
      avatar.setAttribute('aria-label', `View ${name} profile photo`);
      avatar.setAttribute('title', 'View profile photo');
      avatar.classList.add('has-photo-preview');

      avatar.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        openTeacherPhotoViewer(photoUrl, name);
      });

      avatar.addEventListener('keydown', event => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        event.stopPropagation();
        openTeacherPhotoViewer(photoUrl, name);
      });
    }
  }

  /* VIEW PUBLIC USTAZ PROFILE */
  const viewButton = article.querySelector('[data-teacher-view]');
  if (viewButton) {
    viewButton.addEventListener('click', event => {
      event.preventDefault();
      const id = viewButton.dataset.teacherId;
      if (!id) {
        setTeacherError('This teacher does not have a profile identifier yet.');
        return;
      }
      window.location.href = `./view-ustaz-profile.html?id=${encodeURIComponent(id)}`;
    });
  }

  /* =========================================================
     CHAT WITH THIS USTAZ
     Availability messages render inside the card, above all buttons.
  ========================================================= */
  const chatButton = article.querySelector('[data-teacher-chat]');
  const parentCanChat = canParentMessageTeachers();

  if (chatButton) {
    if (!parentCanChat) {
      chatButton.setAttribute('aria-disabled', 'true');
      chatButton.setAttribute(
        'title',
        'Messaging becomes available after your Parent profile is approved by BarakaLink.'
      );
      chatButton.classList.add('student-teacher-chat-locked');
      article.setAttribute('data-messaging-status', getParentProfileReviewStatus() || 'pending');
    }

    /* Inline message container. It is inserted before the whole footer/button row. */
    const availabilityMessage = document.createElement('div');
    availabilityMessage.className = 'ustaz-profile-availability-message';
    availabilityMessage.setAttribute('role', 'status');
    availabilityMessage.setAttribute('aria-live', 'polite');
    availabilityMessage.hidden = true;

    const availabilityIcon = document.createElement('i');
    availabilityIcon.className = 'fa-regular fa-clock';
    availabilityIcon.setAttribute('aria-hidden', 'true');

    const availabilityMessageText = document.createElement('span');
    availabilityMessage.append(availabilityIcon, availabilityMessageText);

    const chatActionsContainer = chatButton.closest('.student-teacher-card-footer') || chatButton.parentElement;
    const messageHost = chatActionsContainer?.parentElement;
    if (messageHost && chatActionsContainer) {
      messageHost.insertBefore(availabilityMessage, chatActionsContainer);
    } else if (chatButton.parentElement) {
      chatButton.parentElement.insertBefore(availabilityMessage, chatButton);
    }

    function showTeacherAvailabilityMessage(message) {
      availabilityMessageText.textContent = message;
      availabilityMessage.hidden = false;
    }

    function hideTeacherAvailabilityMessage() {
      availabilityMessageText.textContent = '';
      availabilityMessage.hidden = true;
    }

    let checkingAvailability = false;

    chatButton.addEventListener('click', async event => {
      event.preventDefault();
      event.stopPropagation();

      if (!canParentMessageTeachers()) {
        openParentChatReviewModal();
        return;
      }

      if (checkingAvailability) return;

      const selectedUserId = String(chatButton.dataset.teacherUserId || '').trim();
      if (!/^\d+$/.test(selectedUserId) || Number(selectedUserId) <= 0) {
        showTeacherAvailabilityMessage('This teacher does not have a valid user identifier yet.');
        return;
      }

      checkingAvailability = true;
      chatButton.disabled = true;
      hideTeacherAvailabilityMessage();

      try {
        const currentTeacher = await fetchCurrentTeacherAvailability(selectedUserId);
        const currentlyAvailable = isTeacherAcceptingNewStudents(currentTeacher);
        updateTeacherAvailabilityBadge(article, currentTeacher);

        if (!currentlyAvailable) {
          const currentName = getTeacherDisplayName(currentTeacher) || name;
          showTeacherAvailabilityMessage(
            `${currentName} is currently not available for new students. ` +
            'Chat is temporarily unavailable because this Ustaz has turned off new-student availability. ' +
            'Please check back later.'
          );
          return;
        }

        window.location.href = `./inbox.html?with=${encodeURIComponent(selectedUserId)}`;
      } catch (error) {
        console.error('Could not verify Ustaz availability:', error);
        showTeacherAvailabilityMessage(
          error?.message ||
          'Could not verify this Ustaz’s current availability. Please refresh Find Ustaz and try again.'
        );
      } finally {
        checkingAvailability = false;
        chatButton.disabled = false;
      }
    });
  }

  /* SAVE TEACHER */
  const saveButton = article.querySelector('[data-teacher-save]');
  if (saveButton) {
    syncTeacherSaveState(saveButton, teacher);
    saveButton.addEventListener('click', () => toggleSavedTeacher(teacher, saveButton));
  }

  return article;
}

/* =========================================================
   RENDER TEACHER RESULTS
========================================================= */

export function renderTeacherResults() {
  const list = $('teacherList');
  const empty = $('teacherEmptyState');
  const count = $('studentTeacherResultsCount');
  if (!list) return;

  list.innerHTML = '';
  const teachers = state.filteredTeachers;

  if (count) {
    count.textContent = `${teachers.length} teacher${teachers.length === 1 ? '' : 's'}`;
  }

  if (!teachers.length) {
    if (empty) empty.hidden = false;
    return;
  }

  if (empty) empty.hidden = true;
  const fragment = document.createDocumentFragment();
  teachers.forEach(teacher => fragment.appendChild(createTeacherCard(teacher)));
  list.appendChild(fragment);
}

/* =========================================================
   TEACHER ERROR
========================================================= */

export function setTeacherError(message) {
  const errorPanel = $('studentTeacherError');
  const messageElement = $('studentTeacherErrorMessage');

  if (messageElement) {
    messageElement.textContent = safeString(message, 'Unable to load teacher information.');
  }
  if (errorPanel) errorPanel.hidden = false;
}

export function clearTeacherError() {
  const errorPanel = $('studentTeacherError');
  if (errorPanel) errorPanel.hidden = true;
}

/* =========================================================
   TEACHER LOADING
========================================================= */

export function setTeacherLoading(visible) {
  const loading = $('studentTeacherLoading');
  const list = $('teacherList');
  const empty = $('teacherEmptyState');

  if (loading) loading.hidden = !visible;
  if (visible) {
    if (list) list.hidden = true;
    if (empty) empty.hidden = true;
  } else if (list) {
    list.hidden = false;
  }
}

/* =========================================================
   LOAD TEACHERS
========================================================= */

export async function loadTeachers() {
  clearTeacherError();
  const endpoint = STUDENT_CONFIG.TEACHERS_ENDPOINT;

  if (!endpoint) {
    state.teachers = [];
    state.filteredTeachers = [];
    renderTeacherResults();
    return [];
  }

  setTeacherLoading(true);
  try {
    const payload = await apiRequest(endpoint);
    const teachers = extractTeacherArray(payload);
    state.teachers = teachers;
    applyTeacherFilters();
    return teachers;
  } catch (error) {
    console.error('[student.js] Teacher loading failed:', error);
    state.teachers = [];
    state.filteredTeachers = [];
    setTeacherError(error?.message || 'Unable to load teacher recommendations.');
    renderTeacherResults();
    return [];
  } finally {
    setTeacherLoading(false);
  }
}

/* =========================================================
   RUN TEACHER DISCOVERY
========================================================= */

export async function runTeacherDiscovery() {
  if (teacherDiscoveryLoaded) {
    applyTeacherFilters();
    return;
  }
  teacherDiscoveryLoaded = true;
  await loadTeachers();
}

/* =========================================================
   TEACHER FILTERS
========================================================= */

export function setupTeacherFilters(dependencies = {}) {
  Object.assign(teacherDependencies, dependencies);

  $$('.student-filter').forEach(button => {
    button.addEventListener('click', () => {
      $$('.student-filter').forEach(item => item.classList.remove('active'));
      button.classList.add('active');
      state.currentTeacherFilter = safeString(button.dataset.teacherFilter, 'all').toLowerCase();
      applyTeacherFilters();
    });
  });

  $$('[data-teacher-filter="study"]').forEach(element => {
    element.addEventListener('click', event => {
      if (!element.classList.contains('student-nav-link')) return;

      event.preventDefault();
      teacherDependencies.showSection?.('teachers');
      $$('.student-filter').forEach(filter => {
        filter.classList.toggle('active', filter.dataset.teacherFilter === 'study');
      });
      state.currentTeacherFilter = 'study';
      applyTeacherFilters();
      teacherDependencies.closeMobileSidebar?.();
    });
  });
}

/* =========================================================
   TEACHER SEARCH
========================================================= */

export function setupTeacherSearch() {
  const input = $('studentTeacherSearch');
  const clearButton = $('studentTeacherSearchClear');
  if (!input) return;

  input.addEventListener('input', () => {
    state.searchTerm = input.value.trim();
    if (clearButton) clearButton.hidden = !state.searchTerm;
    applyTeacherFilters();
  });

  if (clearButton) {
    clearButton.addEventListener('click', () => {
      input.value = '';
      state.searchTerm = '';
      clearButton.hidden = true;
      input.focus();
      applyTeacherFilters();
    });
  }
}

/* =========================================================
   TEACHER SORT
========================================================= */

export function setupTeacherSort() {
  const button = $('studentSortButton');
  if (!button) return;

  button.addEventListener('click', () => {
    state.sortMode = 'nearest';
    applyTeacherFilters();
  });
}

/* =========================================================
   SAVED TEACHERS
========================================================= */

export function getSavedTeacherIds() {
  try {
    const raw = localStorage.getItem(SAVED_TEACHERS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map(value => String(value)) : [];
  } catch (_) {
    return [];
  }
}

export function setSavedTeacherIds(ids) {
  localStorage.setItem(
    SAVED_TEACHERS_KEY,
    JSON.stringify([...new Set(ids.map(value => String(value)))])
  );
}

export function isTeacherSaved(teacher) {
  const id = getTeacherId(teacher);
  if (id === null || id === undefined || id === '') return false;
  return getSavedTeacherIds().includes(String(id));
}

export function syncTeacherSaveState(button, teacher) {
  const saved = isTeacherSaved(teacher);
  button.classList.toggle('active', saved);

  const icon = button.querySelector('i');
  if (icon) icon.className = saved ? 'fa-solid fa-bookmark' : 'fa-regular fa-bookmark';

  const name = getTeacherDisplayName(teacher);
  button.setAttribute(
    'aria-label',
    saved ? `Remove ${name} from saved teachers` : `Save ${name}`
  );
}

export function toggleSavedTeacher(teacher, button) {
  const id = getTeacherId(teacher);
  if (id === null || id === undefined || id === '') return;

  const normalizedId = String(id);
  const ids = getSavedTeacherIds();
  const existingIndex = ids.indexOf(normalizedId);

  if (existingIndex >= 0) ids.splice(existingIndex, 1);
  else ids.push(normalizedId);

  setSavedTeacherIds(ids);
  syncTeacherSaveState(button, teacher);
  renderSavedTeachers();
}

/* =========================================================
   SAVED TEACHERS RENDERING
========================================================= */

export function renderSavedTeachers() {
  const container = $('studentSavedTeachers');
  const empty = $('studentSavedEmptyState');
  if (!container) return;

  const savedIds = getSavedTeacherIds();
  state.savedTeachers = state.teachers.filter(teacher => {
    const id = getTeacherId(teacher);
    return id !== null && savedIds.includes(String(id));
  });

  container.innerHTML = '';
  if (!state.savedTeachers.length) {
    if (empty) empty.hidden = false;
    return;
  }

  if (empty) empty.hidden = true;
  const fragment = document.createDocumentFragment();
  state.savedTeachers.forEach(teacher => fragment.appendChild(createTeacherCard(teacher)));
  container.appendChild(fragment);
}

export function setupSavedSection() {
  renderSavedTeachers();
}

/* =========================================================
   TEACHER DISCOVERY COMPATIBILITY / RETRY HELPERS
========================================================= */

export function resetTeacherDiscovery() {
  teacherDiscoveryLoaded = false;
}

export function setTeachers(teachers) {
  state.teachers = Array.isArray(teachers) ? teachers : [];
  teacherDiscoveryLoaded = true;
  state.currentSection = 'teachers';
  applyTeacherFilters();
  renderSavedTeachers();
}
