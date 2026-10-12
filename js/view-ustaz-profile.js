'use strict';

/* =========================================================
   BARAKALINK — PUBLIC USTAZ PROFILE
   File: frontend/js/view-ustaz-profile.js

   Existing behavior retained: public profile rendering,
   qualifications/certificate viewer, saved Ustaz, theme,
   chat availability and Parent review restrictions, rating,
   sharing, reporting, and retry/error handling.
========================================================= */

/* CONFIGURATION */
const USTAZ_PROFILE_CONFIG = Object.freeze({
  API_BASE: String(window.BARAKALINK_API_BASE || 'http://localhost:5000/api').replace(/\/+$/, ''),
  TEACHERS_ENDPOINT: window.BARAKALINK_TEACHERS_ENDPOINT || '/teachers',
  THEME_KEY: 'barakalink_theme',
  SAVED_TEACHERS_KEY: 'barakalink_saved_teacher_ids'
});

const $ = id => document.getElementById(id);

/* GENERAL HELPERS */
function safeString(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  return String(value).trim() || fallback;
}

function normalizeArray(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(item => {
    if (item && typeof item === 'object') {
      return safeString(item.slug) || safeString(item.name) || safeString(item.label) || safeString(item.value);
    }
    return safeString(item);
  }).filter(Boolean))];
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

/* STUDY FIELDS */
const STUDY_FIELD_LABELS = Object.freeze({
  'quran-basic': 'Quran Basic', quran_basic: 'Quran Basic', quran: 'Quran',
  tajweed: 'Tajweed', hifz: 'Hifz', tafseer: 'Tafseer', hadith: 'Hadith', tarbiyah: 'Tarbiyah'
});

function getStudyFieldLabel(value) {
  const key = safeString(value).toLowerCase();
  if (STUDY_FIELD_LABELS[key]) return STUDY_FIELD_LABELS[key];
  return key.replace(/[_-]+/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
}

/* URL / TEACHER ID */
function getRequestedTeacherId() {
  return safeString(new URLSearchParams(window.location.search).get('id'));
}

function getTeacherIdentifierValues(teacher) {
  return [teacher?.id, teacher?.userId, teacher?.user_id, teacher?.teacherProfileId,
    teacher?.teacher_profile_id, teacher?.profileId, teacher?.profile_id]
    .filter(value => value !== null && value !== undefined && value !== '')
    .map(String);
}

function teacherMatchesId(teacher, requestedId) {
  return Boolean(requestedId) && getTeacherIdentifierValues(teacher).includes(String(requestedId));
}

/* TEACHER ACCESSORS */
function getTeacherName(teacher) {
  const explicit = safeString(teacher?.name);
  if (explicit) return explicit;
  return [safeString(teacher?.firstName ?? teacher?.first_name),
    safeString(teacher?.lastName ?? teacher?.last_name)].filter(Boolean).join(' ').trim() || 'Ustaz';
}

function getTeacherGender(teacher) { return safeString(teacher?.gender).toLowerCase(); }

function getTeacherLocation(teacher) {
  const location = teacher?.location || {};
  const area = safeString(teacher?.area ?? teacher?.area_name ?? location.area);
  const subcity = safeString(teacher?.subcity ?? teacher?.subcity_name ?? location.subcity);
  return { area, subcity, text: [area, subcity].filter(Boolean).join(', ') };
}

function getTeacherMosque(teacher) {
  return safeString(teacher?.nearestMosque ?? teacher?.nearest_mosque ?? teacher?.mosque ??
    teacher?.nearestMosqueName ?? teacher?.nearest_mosque_name);
}

function getTeacherBio(teacher) {
  return safeString(teacher?.bio ?? teacher?.about ?? teacher?.description);
}

function getTeacherStudyFields(teacher) {
  return normalizeArray(teacher?.studyFields ?? teacher?.study_fields ?? teacher?.fields ?? []);
}

function getTeacherLanguages(teacher) {
  return normalizeArray(teacher?.languages ?? teacher?.language ??
    teacher?.teachingLanguages ?? teacher?.teaching_languages ?? []);
}

function getTeacherAvatar(teacher) {
  return safeString(teacher?.avatarUrl ?? teacher?.avatar_url ?? teacher?.photoUrl ??
    teacher?.photoURL ?? teacher?.profilePhotoUrl ?? teacher?.profile_photo_url ?? teacher?.photo);
}

function getTeacherAudio(teacher) {
  return safeString(teacher?.recitationAudioUrl ?? teacher?.recitation_audio_url ??
    teacher?.audioUrl ?? teacher?.audio_url);
}

/* QUALIFICATIONS */
function getTeacherQualifications(teacher) {
  const value = teacher?.qualifications ?? teacher?.teacherQualifications ?? teacher?.teacher_qualifications ??
    teacher?.teacherProfile?.qualifications ?? teacher?.teacherProfile?.teacherQualifications ??
    teacher?.teacherProfile?.teacher_qualifications ?? teacher?.teacher_profile?.qualifications ??
    teacher?.teacher_profile?.teacherQualifications ?? teacher?.teacher_profile?.teacher_qualifications ?? [];
  if (!Array.isArray(value)) return [];
  return value.map(item => {
    if (!item || typeof item !== 'object') return null;
    const title = safeString(item.title ?? item.qualificationTitle ?? item.qualification_title ?? item.name);
    return {
      id: item.id ?? '',
      title: title || 'Qualification',
      institution: safeString(item.institution ?? item.institutionName ?? item.institution_name),
      completionYear: safeString(item.completionYear ?? item.completion_year ?? item.year),
      specialization: safeString(item.specialization ?? item.specialisation),
      certificateUrl: safeString(item.certificateUrl ?? item.certificate_url),
      certificateName: safeString(item.certificateName ?? item.certificate_name),
      certificateMime: safeString(item.certificateMime ?? item.certificate_mime ?? item.mimeType ?? item.mime_type)
    };
  }).filter(Boolean);
}

function getTeacherProfileTrust(teacher) {
  const trust = teacher?.profileTrust ?? teacher?.profile_trust ?? teacher?.trust ?? {};
  const qualificationSubmitted = trust.qualificationSubmitted === true || trust.qualification_submitted === true ||
    getTeacherQualifications(teacher).length > 0;
  const identityValue = trust.identityVerified ?? trust.identity_verified;
  const identityVerified = identityValue === true || identityValue === 1 || identityValue === '1' ||
    String(identityValue).toLowerCase() === 'true';
  let state = 'none';
  if (qualificationSubmitted && identityVerified) state = 'trusted';
  else if (qualificationSubmitted) state = 'credentials';
  else if (identityVerified) state = 'identity';
  return { state, qualificationSubmitted, identityVerified };
}

function isQualificationPdf(qualification) {
  const mime = safeString(qualification?.certificateMime).toLowerCase();
  const name = safeString(qualification?.certificateName).toLowerCase();
  const url = safeString(qualification?.certificateUrl).toLowerCase();
  return mime === 'application/pdf' || /\.pdf(?:$|[?#])/i.test(name) || /\.pdf(?:$|[?#])/i.test(url);
}

/* MEDIA URL */
function resolveMediaUrl(value) {
  const raw = safeString(value);
  if (!raw) return '';
  if (/^(https?:|data:|blob:|filesystem:)/i.test(raw)) return raw;
  try { return new URL(raw, `${USTAZ_PROFILE_CONFIG.API_BASE}/`).href; }
  catch { return raw; }
}

/* CERTIFICATE VIEWER */
let qualificationViewer = null;

function ensureQualificationViewer() {
  if (qualificationViewer) return qualificationViewer;
  const viewer = document.createElement('div');
  viewer.className = 'ustaz-public-certificate-viewer';
  viewer.hidden = true;
  viewer.setAttribute('aria-hidden', 'true');
  viewer.innerHTML = `
    <div class="ustaz-public-certificate-backdrop" data-qualification-viewer-close></div>
    <div class="ustaz-public-certificate-dialog" role="dialog" aria-modal="true" aria-labelledby="ustazQualificationViewerTitle">
      <div class="ustaz-public-certificate-header">
        <div><span>Certificate</span><h2 id="ustazQualificationViewerTitle">Qualification certificate</h2></div>
        <button type="button" class="ustaz-public-certificate-close" aria-label="Close certificate viewer" data-qualification-viewer-close>
          <i class="fa-solid fa-xmark" aria-hidden="true"></i>
        </button>
      </div>
      <div class="ustaz-public-certificate-body" id="ustazQualificationViewerBody"></div>
    </div>`;
  document.body.appendChild(viewer);
  viewer.querySelectorAll('[data-qualification-viewer-close]').forEach(element => {
    element.addEventListener('click', closeQualificationViewer);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && qualificationViewer && !qualificationViewer.hidden) closeQualificationViewer();
  });
  qualificationViewer = viewer;
  return viewer;
}

function closeQualificationViewer() {
  if (!qualificationViewer) return;
  qualificationViewer.hidden = true;
  qualificationViewer.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('ustaz-public-certificate-open');
  const body = qualificationViewer.querySelector('#ustazQualificationViewerBody');
  if (body) body.replaceChildren();
}

function openQualificationViewer(qualification) {
  const url = resolveMediaUrl(qualification?.certificateUrl);
  if (!url) return;
  const viewer = ensureQualificationViewer();
  const body = viewer.querySelector('#ustazQualificationViewerBody');
  const title = viewer.querySelector('#ustazQualificationViewerTitle');
  if (!body) return;
  body.replaceChildren();
  if (title) title.textContent = qualification?.title || 'Qualification certificate';

  if (isQualificationPdf(qualification)) {
    const iframe = document.createElement('iframe');
    iframe.className = 'ustaz-public-certificate-pdf';
    iframe.src = url;
    iframe.title = `${qualification?.title || 'Qualification'} certificate`;
    iframe.loading = 'eager';
    body.appendChild(iframe);
  } else {
    const image = document.createElement('img');
    image.className = 'ustaz-public-certificate-image';
    image.src = url;
    image.alt = `${qualification?.title || 'Qualification'} certificate`;
    image.addEventListener('error', () => {
      body.replaceChildren();
      const error = document.createElement('div');
      error.className = 'ustaz-public-certificate-error';
      const icon = document.createElement('i');
      icon.className = 'fa-regular fa-image';
      icon.setAttribute('aria-hidden', 'true');
      const strong = document.createElement('strong');
      strong.textContent = 'Certificate could not be displayed.';
      const span = document.createElement('span');
      span.textContent = 'The uploaded certificate could not be loaded.';
      error.append(icon, strong, span);
      body.appendChild(error);
    }, { once: true });
    body.appendChild(image);
  }

  viewer.hidden = false;
  viewer.setAttribute('aria-hidden', 'false');
  document.body.classList.add('ustaz-public-certificate-open');
  const closeButton = viewer.querySelector('.ustaz-public-certificate-close');
  if (closeButton) requestAnimationFrame(() => closeButton.focus());
}

/* FORMATTING / INITIALS */
function formatGender(value) {
  const gender = safeString(value).toLowerCase();
  if (gender === 'female') return 'Ustaza';
  if (gender === 'male') return 'Ustaz';
  return 'Teacher';
}

function formatExperience(value) {
  if (value === null || value === undefined || value === '') return 'Not provided';
  const number = Number(value);
  if (Number.isFinite(number)) return `${number} year${number === 1 ? '' : 's'}`;
  return safeString(value, 'Not provided');
}

function formatHourlyRate(value) {
  if (value === null || value === undefined || value === '') return '—';
  const number = Number(value);
  if (Number.isFinite(number)) return `${number.toLocaleString('en-US')} ETB`;
  return safeString(value, '—');
}

function formatLessonDuration(value) {
  if (value === null || value === undefined || value === '') return 'Not provided';
  const number = Number(value);
  if (Number.isFinite(number)) return `${number} minute${number === 1 ? '' : 's'}`;
  return safeString(value, 'Not provided');
}

function formatLessonFormat(value) {
  const text = safeString(value);
  return text ? text.replace(/[_-]+/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase()) : 'Not provided';
}

function getInitials(teacher) {
  const parts = getTeacherName(teacher).split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map(part => part.charAt(0)).join('').toUpperCase() || 'U';
}

/* PROFILE TRUST */
function renderProfileTrust(teacher) {
  const container = $('ustazPublicTrust');
  const label = $('ustazPublicTrustLabel');
  const icon = $('ustazPublicTrustIcon');
  const infoButton = $('ustazPublicTrustInfoButton');
  const info = $('ustazPublicTrustInfo');
  if (!container || !label || !icon) return;
  const trust = getTeacherProfileTrust(teacher);
  const labels = { none: '', credentials: 'Credentials Submitted', identity: 'Identity Verified', trusted: 'Trusted Profile' };
  const icons = { none: '', credentials: 'fa-solid fa-file-circle-check', identity: 'fa-solid fa-user-check', trusted: 'fa-solid fa-shield-halved' };
  container.dataset.trustState = trust.state;
  label.textContent = labels[trust.state] || '';
  icon.className = icons[trust.state] || '';
  container.hidden = trust.state === 'none';
  if (info) info.hidden = true;
  if (infoButton) infoButton.setAttribute('aria-expanded', 'false');
}

function setupProfileTrustInfo() {
  const button = $('ustazPublicTrustInfoButton');
  const info = $('ustazPublicTrustInfo');
  if (!button || !info || button.dataset.bound === '1') return;
  button.dataset.bound = '1';
  button.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    const expanded = button.getAttribute('aria-expanded') === 'true';
    button.setAttribute('aria-expanded', expanded ? 'false' : 'true');
    info.hidden = expanded;
  });
  document.addEventListener('click', event => {
    if (!button.contains(event.target) && !info.contains(event.target)) {
      button.setAttribute('aria-expanded', 'false');
      info.hidden = true;
    }
  });
}

/* RENDER QUALIFICATIONS */
function renderQualifications(teacher) {
  const container = $('ustazProfileQualifications');
  if (!container) return;
  container.replaceChildren();
  const qualifications = getTeacherQualifications(teacher);
  if (!qualifications.length) {
    const empty = document.createElement('div');
    empty.className = 'ustaz-profile-qualification-empty';
    const icon = document.createElement('i');
    icon.className = 'fa-regular fa-folder-open';
    icon.setAttribute('aria-hidden', 'true');
    const text = document.createElement('span');
    text.textContent = 'No qualifications have been provided.';
    empty.append(icon, text);
    container.appendChild(empty);
    return;
  }
  const fragment = document.createDocumentFragment();
  qualifications.forEach(qualification => {
    const card = document.createElement('article');
    card.className = 'ustaz-profile-qualification-card';
    const copy = document.createElement('div');
    copy.className = 'ustaz-profile-qualification-copy';
    const title = document.createElement('h3');
    title.textContent = qualification.title;
    const meta = document.createElement('div');
    meta.className = 'ustaz-profile-qualification-meta';
    const metaValues = [qualification.institution, qualification.specialization,
      qualification.completionYear ? `Completed ${qualification.completionYear}` : ''].filter(Boolean);
    metaValues.forEach(value => {
      const item = document.createElement('span');
      item.textContent = value;
      meta.appendChild(item);
    });
    copy.appendChild(title);
    if (metaValues.length) copy.appendChild(meta);
    card.appendChild(copy);
    if (qualification.certificateUrl) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'ustaz-profile-qualification-thumbnail';
      button.setAttribute('aria-label', `View certificate for ${qualification.title}`);
      if (isQualificationPdf(qualification)) {
        const pdf = document.createElement('span');
        pdf.className = 'ustaz-profile-qualification-pdf';
        const icon = document.createElement('i');
        icon.className = 'fa-solid fa-file-pdf';
        icon.setAttribute('aria-hidden', 'true');
        const label = document.createElement('small');
        label.textContent = 'PDF';
        pdf.append(icon, label);
        button.appendChild(pdf);
      } else {
        const image = document.createElement('img');
        image.src = resolveMediaUrl(qualification.certificateUrl);
        image.alt = `${qualification.title} certificate`;
        image.loading = 'lazy';
        image.addEventListener('error', () => {
          image.hidden = true;
          button.classList.add('is-broken');
          if (!button.querySelector('.ustaz-profile-qualification-broken')) {
            const fallback = document.createElement('span');
            fallback.className = 'ustaz-profile-qualification-broken';
            const fallbackIcon = document.createElement('i');
            fallbackIcon.className = 'fa-regular fa-image';
            fallbackIcon.setAttribute('aria-hidden', 'true');
            const fallbackText = document.createElement('small');
            fallbackText.textContent = 'Unavailable';
            fallback.append(fallbackIcon, fallbackText);
            button.appendChild(fallback);
          }
        }, { once: true });
        button.appendChild(image);
      }
      const expand = document.createElement('span');
      expand.className = 'ustaz-profile-qualification-expand';
      const expandIcon = document.createElement('i');
      expandIcon.className = 'fa-solid fa-up-right-and-down-left-from-center';
      expandIcon.setAttribute('aria-hidden', 'true');
      expand.appendChild(expandIcon);
      button.appendChild(expand);
      button.addEventListener('click', () => openQualificationViewer(qualification));
      card.appendChild(button);
    }
    fragment.appendChild(card);
  });
  container.appendChild(fragment);
}

/* PUBLIC AVAILABILITY */
function normalizeTeacherAvailability(teacher) {
  const value = teacher?.acceptingStudents ?? teacher?.accepting_students ??
    teacher?.teacherProfile?.acceptingStudents ?? teacher?.teacherProfile?.accepting_students ??
    teacher?.teacher_profile?.acceptingStudents ?? teacher?.teacher_profile?.accepting_students ?? false;
  return value === true || value === 1 || value === '1' || String(value).trim().toLowerCase() === 'true';
}

function renderPublicTeacherAvailability(teacher) {
  const container = $('ustazPublicAvailability');
  const label = $('ustazPublicAvailabilityLabel');
  if (!container || !label) return false;
  const available = normalizeTeacherAvailability(teacher);
  container.classList.toggle('is-available', available);
  container.classList.toggle('is-unavailable', !available);
  container.dataset.availability = available ? 'available' : 'unavailable';
  label.textContent = available ? 'Available' : 'Not available';
  return available;
}

function showPublicUnavailableMessage(teacherName) {
  const chatButton = $('ustazProfileChatButton');
  if (!chatButton) return;
  let notice = $('ustazProfileAvailabilityMessage');
  if (!notice) {
    notice = document.createElement('div');
    notice.id = 'ustazProfileAvailabilityMessage';
    notice.className = 'ustaz-profile-availability-message';
    notice.setAttribute('role', 'status');
    notice.setAttribute('aria-live', 'polite');
    chatButton.before(notice);
  }
  notice.innerHTML = `<i class="fa-regular fa-clock" aria-hidden="true"></i><span>${escapeHtml(teacherName)} is currently not available for new students. Chat is temporarily unavailable because this Ustaz has turned off new-student availability. Please check back later.</span>`;
  notice.hidden = false;
  window.clearTimeout(notice._hideTimer);
  notice._hideTimer = window.setTimeout(() => { notice.hidden = true; }, 6000);
}

/* PARENT CHAT REVIEW MODAL */
let parentChatReviewModalReady = false;
let parentChatReviewModalPreviousFocus = null;

function setupParentChatReviewModal() {
  if (parentChatReviewModalReady) return;
  const modal = $('ustazParentChatReviewModal');
  if (!modal) return;
  const closeButton = $('ustazParentChatReviewClose');
  const doneButton = $('ustazParentChatReviewDone');
  const backdrop = modal.querySelector('[data-parent-chat-review-close]');
  if (closeButton) closeButton.addEventListener('click', closeParentChatReviewModal);
  if (doneButton) doneButton.addEventListener('click', closeParentChatReviewModal);
  if (backdrop) backdrop.addEventListener('click', closeParentChatReviewModal);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !modal.hidden) closeParentChatReviewModal();
  });
  parentChatReviewModalReady = true;
}

function openParentChatReviewModal() {
  const modal = $('ustazParentChatReviewModal');
  if (!modal) {
    console.warn('[BarakaLink][Ustaz Profile] Parent chat review modal was not found.');
    return;
  }
  setupParentChatReviewModal();
  parentChatReviewModalPreviousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  modal.hidden = false;
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('ustaz-modal-open');
  requestAnimationFrame(() => modal.classList.add('is-open'));
  const doneButton = $('ustazParentChatReviewDone');
  if (doneButton) requestAnimationFrame(() => {
    try { doneButton.focus({ preventScroll: true }); }
    catch { doneButton.focus(); }
  });
}

function closeParentChatReviewModal() {
  const modal = $('ustazParentChatReviewModal');
  if (!modal) return;
  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden', 'true');
  modal.hidden = true;
  document.body.classList.remove('ustaz-modal-open');
  const previousFocus = parentChatReviewModalPreviousFocus;
  parentChatReviewModalPreviousFocus = null;
  if (previousFocus && previousFocus.isConnected && typeof previousFocus.focus === 'function') {
    try { previousFocus.focus({ preventScroll: true }); }
    catch { previousFocus.focus(); }
  }
}

/* PARENT REVIEW STATUS */
function getParentProfileReviewStatusFromProfile(profileData) {
  const root = profileData && typeof profileData === 'object' ? profileData : {};
  const user = root.user && typeof root.user === 'object' ? root.user : {};
  const student = root.student && typeof root.student === 'object' ? root.student : {};
  return safeString(root.profileReviewStatus ?? root.profile_review_status ?? user.profileReviewStatus ??
    user.profile_review_status ?? student.profileReviewStatus ?? student.profile_review_status, '').trim().toLowerCase();
}

function getProfileCompletedFromProfile(profileData) {
  const root = profileData && typeof profileData === 'object' ? profileData : {};
  const user = root.user && typeof root.user === 'object' ? root.user : {};
  return Boolean(root.profileCompleted ?? root.profile_completed ?? user.profileCompleted ?? user.profile_completed ?? false);
}

function getProfileRole(profileData) {
  const root = profileData && typeof profileData === 'object' ? profileData : {};
  const user = root.user && typeof root.user === 'object' ? root.user : {};
  return safeString(root.role ?? user.role, '').trim().toLowerCase();
}

function canParentMessageFromProfile(profileData) {
  const role = getProfileRole(profileData);
  if (role !== 'parent') return true;
  const reviewStatus = getParentProfileReviewStatusFromProfile(profileData);
  if (reviewStatus === 'approved') return true;
  if (!reviewStatus && getProfileCompletedFromProfile(profileData)) return true;
  return false;
}

/* AUTHENTICATED PROFILE FOR CHAT CHECK */
async function loadCurrentAuthenticatedProfile() {
  if (!window.BarakaLinkAPI || typeof window.BarakaLinkAPI.get !== 'function') return null;
  let token = '';
  try {
    if (typeof window.BarakaLinkAPI.getToken === 'function') token = safeString(window.BarakaLinkAPI.getToken());
    if (!token) token = safeString(localStorage.getItem('barakalink_token'));
    if (!token) token = safeString(localStorage.getItem('token'));
    if (!token) token = safeString(localStorage.getItem('access_token'));
  } catch { token = ''; }
  if (!token) return null;
  try {
    const payload = await window.BarakaLinkAPI.get('/profile');
    return payload?.data ?? payload ?? {};
  } catch (error) {
    console.warn('[BarakaLink][Ustaz Profile] Could not load current user profile before chat:', error);
    return null;
  }
}

function resolveMessagingUserId(profileData) {
  const candidates = [profileData?.userId, profileData?.user_id, profileData?.user?.id,
    profileData?.user?.userId, profileData?.user?.user_id, profileData?.teacherProfile?.userId,
    profileData?.teacherProfile?.user_id, profileData?.teacher_profile?.userId,
    profileData?.teacher_profile?.user_id, profileData?.teacher?.userId, profileData?.teacher?.user_id];
  for (const value of candidates) {
    const id = Number(value);
    if (Number.isInteger(id) && id > 0) return id;
  }
  return null;
}

function setupUstazChatButton(profileData) {
  const button = $('ustazProfileChatButton');
  if (!button) return;
  const ustazUserId = resolveMessagingUserId(profileData);
  const available = normalizeTeacherAvailability(profileData);
  button.disabled = false;
  button.dataset.ustazUserId = ustazUserId ? String(ustazUserId) : '';
  button.dataset.ustazAvailable = available ? '1' : '0';
  button.title = !ustazUserId ? 'This Ustaz does not have a valid user account ID.' :
    !available ? 'This Ustaz is currently not available for new students.' : 'Chat with this Ustaz.';
  if (button.dataset.chatListenerBound === '1') return;
  button.dataset.chatListenerBound = '1';
  button.addEventListener('click', async event => {
    event.preventDefault();
    event.stopPropagation();
    if (button.dataset.chatChecking === '1') return;
    const currentTeacher = USTAZ_PROFILE_ACTION_STATE.teacher || profileData;
    if (!normalizeTeacherAvailability(currentTeacher)) {
      showPublicUnavailableMessage(getTeacherName(currentTeacher));
      return;
    }
    const id = Number(button.dataset.ustazUserId);
    if (!Number.isInteger(id) || id <= 0) {
      showProfileToast('This Ustaz does not have a valid messaging account.');
      console.error('[BarakaLink][Ustaz Profile] Invalid Ustaz user ID.');
      return;
    }
    button.dataset.chatChecking = '1';
    try {
      const currentUserProfile = await loadCurrentAuthenticatedProfile();
      if (!currentUserProfile) {
        window.location.href = `inbox.html?with=${encodeURIComponent(id)}`;
        return;
      }
      if (!canParentMessageFromProfile(currentUserProfile)) {
        openParentChatReviewModal();
        return;
      }
      window.location.href = `inbox.html?with=${encodeURIComponent(id)}`;
    } catch (error) {
      console.error('[BarakaLink][Ustaz Profile] Chat navigation failed:', error);
      showProfileToast('Unable to open chat right now. Please try again.');
    } finally {
      button.dataset.chatChecking = '0';
    }
  });
}

/* API / LOADING / ERROR — each function is defined exactly once. */
async function loadTeachers() {
  if (!window.BarakaLinkAPI || typeof window.BarakaLinkAPI.get !== 'function') {
    throw new Error('The BarakaLink API helper could not be loaded.');
  }
  const payload = await window.BarakaLinkAPI.get(USTAZ_PROFILE_CONFIG.TEACHERS_ENDPOINT);
  const data = payload?.data ?? payload ?? [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.teachers)) return data.teachers;
  if (Array.isArray(data.results)) return data.results;
  if (Array.isArray(payload?.teachers)) return payload.teachers;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
}

function showLoading() {
  const brandedLoader = $('studentPageLoading');
  const loading = $('ustazProfileLoading');
  const error = $('ustazProfileError');
  const content = $('ustazProfileContent');
  if (brandedLoader) {
    brandedLoader.hidden = false;
    brandedLoader.classList.add('is-visible');
    brandedLoader.setAttribute('aria-hidden', 'false');
  }
  if (loading) loading.hidden = true;
  if (error) error.hidden = true;
  if (content) content.classList.remove('is-visible');
}

function hideLoading() {
  const brandedLoader = $('studentPageLoading');
  const loading = $('ustazProfileLoading');
  if (brandedLoader) {
    brandedLoader.classList.remove('is-visible');
    brandedLoader.setAttribute('aria-hidden', 'true');
    // `hidden` guarantees the overlay cannot continue covering the page.
    brandedLoader.hidden = true;
  }
  if (loading) loading.hidden = true;
}

function showProfileContent() {
  const content = $('ustazProfileContent');
  if (content) content.classList.add('is-visible');
}

function showError(message) {
  const brandedLoader = $('studentPageLoading');
  const loading = $('ustazProfileLoading');
  const error = $('ustazProfileError');
  const content = $('ustazProfileContent');
  const messageElement = $('ustazProfileErrorMessage');
  if (brandedLoader) {
    brandedLoader.classList.remove('is-visible');
    brandedLoader.setAttribute('aria-hidden', 'true');
    brandedLoader.hidden = true;
  }
  if (loading) loading.hidden = true;
  if (content) content.classList.remove('is-visible');
  if (messageElement) messageElement.textContent = safeString(message, 'The Ustaz profile could not be loaded.');
  if (error) error.hidden = false;
}

/* RENDER IDENTITY */
function renderIdentity(teacher) {
  const name = getTeacherName(teacher);
  const gender = getTeacherGender(teacher);
  const location = getTeacherLocation(teacher);
  const initials = getInitials(teacher);
  const avatar = resolveMediaUrl(getTeacherAvatar(teacher));
  const nameElement = $('ustazProfileName');
  const roleElement = $('ustazProfileRole');
  const locationElement = $('ustazProfileLocation');
  const initialsElement = $('ustazProfileInitials');
  const imageElement = $('ustazProfileImage');

  if (nameElement) nameElement.textContent = name;
  if (roleElement) roleElement.innerHTML = `<i class="fa-solid fa-quran" aria-hidden="true"></i><span>${escapeHtml(formatGender(gender))}</span>`;
  if (locationElement) locationElement.innerHTML = `<i class="fa-solid fa-location-dot" aria-hidden="true"></i><span>${escapeHtml(location.text || 'Location not available')}</span>`;
  if (initialsElement) {
    initialsElement.textContent = initials;
    initialsElement.hidden = false;
  }
  if (imageElement) {
    imageElement.hidden = true;
    imageElement.removeAttribute('src');
    imageElement.onload = null;
    imageElement.onerror = null;
    if (avatar) {
      imageElement.alt = `${name} profile photo`;
      imageElement.onload = () => {
        imageElement.hidden = false;
        if (initialsElement) initialsElement.hidden = true;
      };
      imageElement.onerror = () => {
        imageElement.hidden = true;
        if (initialsElement) initialsElement.hidden = false;
      };
      imageElement.src = avatar;
    }
  }
}

function renderBadges(teacher) {
  const container = $('ustazProfileBadges');
  if (!container) return;
  container.replaceChildren();
  const gender = getTeacherGender(teacher);
  const location = getTeacherLocation(teacher);
  const fields = getTeacherStudyFields(teacher);
  const experience = teacher?.experience;
  const badges = [];
  if (gender) badges.push({ icon: 'fa-solid fa-user', text: formatGender(gender) });
  if (experience !== null && experience !== undefined && experience !== '') {
    badges.push({ icon: 'fa-solid fa-clock', text: formatExperience(experience) });
  }
  if (location.text) badges.push({ icon: 'fa-solid fa-location-dot', text: location.text });
  if (fields.length) badges.push({ icon: 'fa-solid fa-layer-group', text: `${fields.length} subject${fields.length === 1 ? '' : 's'}` });
  badges.forEach(badge => {
    const element = document.createElement('span');
    element.className = 'ustaz-profile-badge';
    const icon = document.createElement('i');
    icon.className = badge.icon;
    icon.setAttribute('aria-hidden', 'true');
    const text = document.createElement('span');
    text.textContent = badge.text;
    element.append(icon, text);
    container.appendChild(element);
  });
}

function renderStudyFields(teacher) {
  const container = $('ustazProfileStudyFields');
  const subjectCount = $('ustazProfileSubjectCount');
  const fields = getTeacherStudyFields(teacher);
  if (container) {
    container.replaceChildren();
    if (!fields.length) {
      const empty = document.createElement('span');
      empty.className = 'ustaz-profile-field-empty';
      empty.textContent = 'No study fields listed.';
      container.appendChild(empty);
    } else {
      fields.forEach(field => {
        const element = document.createElement('span');
        element.className = 'ustaz-profile-field';
        element.textContent = getStudyFieldLabel(field);
        container.appendChild(element);
      });
    }
  }
  if (subjectCount) subjectCount.textContent = fields.length ? `${fields.length} subject${fields.length === 1 ? '' : 's'}` : 'Not provided';
}

function renderMainStats(teacher) {
  const mosque = $('ustazProfileMosque');
  const hourlyRate = $('ustazProfileHourlyRate');
  const experience = $('ustazProfileExperience');
  if (mosque) mosque.textContent = getTeacherMosque(teacher) || 'Not provided';
  if (hourlyRate) hourlyRate.textContent = formatHourlyRate(teacher?.hourlyRate ?? teacher?.hourly_rate);
  if (experience) experience.textContent = formatExperience(teacher?.experience);
}

function renderAbout(teacher) {
  const element = $('ustazProfileBio');
  if (element) element.textContent = getTeacherBio(teacher) || 'No biography has been provided.';
}

function renderTeachingApproach(teacher) {
  const element = $('ustazProfileTeachingApproach');
  if (element) element.textContent = safeString(teacher?.teachingApproach ?? teacher?.teaching_approach) || 'No teaching approach has been provided.';
}

function renderLanguages(teacher) {
  const container = $('ustazProfileLanguages');
  if (!container) return;
  container.replaceChildren();
  const languages = getTeacherLanguages(teacher);
  if (!languages.length) {
    const empty = document.createElement('span');
    empty.className = 'ustaz-profile-empty';
    empty.textContent = 'No languages listed.';
    container.appendChild(empty);
    return;
  }
  languages.forEach(language => {
    const element = document.createElement('span');
    element.className = 'ustaz-profile-language';
    element.textContent = language;
    container.appendChild(element);
  });
}

function renderLessonDetails(teacher) {
  const duration = $('ustazProfileLessonDuration');
  const format = $('ustazProfileLessonFormat');
  if (duration) duration.textContent = formatLessonDuration(teacher?.lessonDuration ?? teacher?.lesson_duration);
  if (format) format.textContent = formatLessonFormat(teacher?.lessonFormat ?? teacher?.lesson_format);
}

function renderRecitation(teacher) {
  const title = $('ustazProfileRecitationTitle');
  const description = $('ustazProfileRecitationDescription');
  const audio = $('ustazProfileAudio');
  const audioEmpty = $('ustazProfileAudioEmpty');
  const recitationTitle = safeString(teacher?.recitationTitle ?? teacher?.recitation_title);
  const recitationDescription = safeString(teacher?.recitationDescription ?? teacher?.recitation_description);
  const audioUrl = resolveMediaUrl(getTeacherAudio(teacher));
  if (title) title.textContent = recitationTitle || '';
  if (description) description.textContent = recitationDescription || 'No recitation description has been provided.';
  if (audio) {
    try { audio.pause(); } catch { /* Ignore media state errors. */ }
    audio.hidden = true;
    audio.removeAttribute('src');
    audio.load();
    if (audioUrl) {
      audio.src = audioUrl;
      audio.hidden = false;
      if (audioEmpty) audioEmpty.hidden = true;
    } else if (audioEmpty) {
      audioEmpty.hidden = false;
    }
  }
}

function getAvailabilityItems(availability) {
  if (!availability) return [];
  if (Array.isArray(availability)) {
    return availability.map(item => {
      if (typeof item === 'string' || typeof item === 'number') return { day: '', text: String(item) };
      if (!item || typeof item !== 'object') return null;
      const day = safeString(item.day ?? item.dayName ?? item.day_name);
      const start = safeString(item.start ?? item.startTime ?? item.start_time);
      const end = safeString(item.end ?? item.endTime ?? item.end_time);
      const label = safeString(item.label ?? item.time ?? item.hours);
      let text = label;
      if (!text && start && end) text = `${start} – ${end}`;
      if (!text) text = safeString(item.available ?? item.status);
      return { day, text: text || 'Available' };
    }).filter(Boolean);
  }
  if (typeof availability === 'object') {
    return Object.entries(availability).map(([day, value]) => {
      if (value === null || value === undefined) return null;
      if (typeof value === 'string' || typeof value === 'number') return { day: formatDayName(day), text: String(value) };
      if (typeof value === 'object') {
        const start = safeString(value.start ?? value.startTime ?? value.start_time);
        const end = safeString(value.end ?? value.endTime ?? value.end_time);
        const label = safeString(value.label ?? value.time ?? value.hours);
        return { day: formatDayName(day), text: label || (start && end ? `${start} – ${end}` : 'Available') };
      }
      return null;
    }).filter(Boolean);
  }
  return [];
}

function formatDayName(value) {
  const text = safeString(value);
  return text ? text.replace(/[_-]+/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase()) : '';
}

function renderAvailability(teacher) {
  const container = $('ustazProfileAvailability');
  if (!container) return;
  container.replaceChildren();
  const availability = teacher?.availability ?? teacher?.teacherAvailability ?? teacher?.teacher_availability ?? [];
  const items = getAvailabilityItems(availability);
  if (!items.length) {
    const empty = document.createElement('div');
    empty.className = 'ustaz-profile-empty';
    empty.textContent = 'No availability has been provided.';
    container.appendChild(empty);
    return;
  }
  items.forEach(item => {
    const row = document.createElement('div');
    row.className = 'ustaz-profile-day';
    const day = document.createElement('strong');
    day.textContent = item.day || 'Schedule';
    const time = document.createElement('span');
    time.textContent = item.text;
    row.append(day, time);
    container.appendChild(row);
  });
}

/* SAVE / UNSAVE */
function getTeacherSavedId(teacher) {
  return teacher?.id ?? teacher?.userId ?? teacher?.user_id ?? teacher?.teacherProfileId ?? teacher?.teacher_profile_id ?? null;
}

function getSavedTeacherIds() {
  try {
    const raw = localStorage.getItem(USTAZ_PROFILE_CONFIG.SAVED_TEACHERS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch { return []; }
}

function setSavedTeacherIds(ids) {
  try {
    localStorage.setItem(USTAZ_PROFILE_CONFIG.SAVED_TEACHERS_KEY, JSON.stringify([...new Set(ids.map(String))]));
  } catch (error) {
    console.warn('[BarakaLink][Ustaz Profile] Could not save teacher list:', error);
    showProfileToast('Unable to save this Ustaz in this browser.');
  }
}

function isTeacherSaved(teacher) {
  const id = getTeacherSavedId(teacher);
  return id !== null && id !== undefined && id !== '' && getSavedTeacherIds().includes(String(id));
}

function renderSaveButton(teacher) {
  const button = $('ustazProfileSaveButton');
  const text = $('ustazProfileSaveText');
  if (!button) return;
  const icon = button.querySelector('i');
  const saved = isTeacherSaved(teacher);
  button.classList.toggle('is-saved', saved);
  button.setAttribute('aria-label', saved ? 'Remove Ustaz from saved teachers' : 'Save this Ustaz');
  if (text) text.textContent = saved ? 'Saved Ustaz' : 'Save Ustaz';
  if (icon) icon.className = saved ? 'fa-solid fa-bookmark' : 'fa-regular fa-bookmark';
}

function toggleTeacherSaved(teacher) {
  const id = getTeacherSavedId(teacher);
  if (id === null || id === undefined || id === '') return;
  const normalizedId = String(id);
  const ids = getSavedTeacherIds();
  const index = ids.indexOf(normalizedId);
  if (index >= 0) ids.splice(index, 1);
  else ids.push(normalizedId);
  setSavedTeacherIds(ids);
  renderSaveButton(teacher);
}

function setupSaveButton(teacher) {
  const button = $('ustazProfileSaveButton');
  if (!button) return;
  renderSaveButton(teacher);
  if (button.dataset.saveListenerBound === '1') return;
  button.dataset.saveListenerBound = '1';
  button.addEventListener('click', () => toggleTeacherSaved(USTAZ_PROFILE_ACTION_STATE.teacher || teacher));
}

/* THEME / NAVIGATION */
function getInitialTheme() {
  let stored = '';
  try { stored = localStorage.getItem(USTAZ_PROFILE_CONFIG.THEME_KEY) || ''; } catch { stored = ''; }
  if (stored === 'dark' || stored === 'light') return stored;
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
  return 'light';
}

function updateThemeButton() {
  const button = $('ustazThemeToggle');
  if (!button) return;
  const dark = document.body.classList.contains('dark-theme');
  const icon = button.querySelector('i');
  if (icon) icon.className = dark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
  button.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
  const meta = $('themeColorMeta');
  if (meta) meta.setAttribute('content', dark ? '#17130F' : '#FBF7EE');
}

function applyTheme(theme) {
  const dark = theme === 'dark';
  document.body.classList.toggle('dark-theme', dark);
  try { localStorage.setItem(USTAZ_PROFILE_CONFIG.THEME_KEY, dark ? 'dark' : 'light'); }
  catch (error) { console.warn('[BarakaLink][Ustaz Profile] Theme preference could not be saved:', error); }
  updateThemeButton();
}

function setupBackButton() {
  const button = $('ustazBackButton');
  if (!button || button.dataset.backBound === '1') return;
  button.dataset.backBound = '1';
  button.addEventListener('click', () => { window.location.href = './student.html#teachers'; });
}

function setupTheme() {
  applyTheme(getInitialTheme());
  const button = $('ustazThemeToggle');
  if (!button || button.dataset.themeBound === '1') return;
  button.dataset.themeBound = '1';
  button.addEventListener('click', () => {
    const next = document.body.classList.contains('dark-theme') ? 'light' : 'dark';
    applyTheme(next);
  });
}

/* RENDER ENTIRE PROFILE */
function renderTeacherProfile(teacher) {
  const name = getTeacherName(teacher);
  document.title = `${name} — BarakaLink`;
  renderIdentity(teacher);
  renderPublicTeacherAvailability(teacher);
  renderProfileTrust(teacher);
  renderBadges(teacher);
  renderStudyFields(teacher);
  renderMainStats(teacher);
  renderAbout(teacher);
  renderTeachingApproach(teacher);
  renderLanguages(teacher);
  renderLessonDetails(teacher);
  renderRecitation(teacher);
  renderAvailability(teacher);
  renderQualifications(teacher);
  setupSaveButton(teacher);
  setupUstazChatButton(teacher);
  setupUstazProfileActions(teacher);
}

/* LOAD PROFILE — never leave the branded loader covering the page */
let activeProfileLoadId = 0;
async function loadPublicProfile(requestedId) {
  const thisLoadId = ++activeProfileLoadId;
  showLoading();
  let timeoutId = null;
  try {
    if (!requestedId) throw new Error('No Ustaz profile ID was provided in the page URL.');
    const teachersPromise = loadTeachers();
    const timeoutPromise = new Promise((resolve, reject) => {
      timeoutId = window.setTimeout(() => reject(new Error(
        'Loading this profile took too long. Please check your connection and try again.'
      )), 15000);
    });
    const teachers = await Promise.race([teachersPromise, timeoutPromise]);
    if (thisLoadId !== activeProfileLoadId) return;
    const teacher = teachers.find(item => teacherMatchesId(item, requestedId));
    if (!teacher) throw new Error('This Ustaz profile could not be found. Please return to Find Ustaz and open the profile again.');
    renderTeacherProfile(teacher);
    if (thisLoadId !== activeProfileLoadId) return;
    showProfileContent();
    hideLoading();
    // The ratings request is optional and must not block profile visibility.
    void loadUstazRatingSummary(teacher).catch(error => {
      console.warn('[BarakaLink][Ustaz Profile] Rating summary could not be loaded:', error);
    });
  } catch (error) {
    if (thisLoadId !== activeProfileLoadId) return;
    console.error('[BarakaLink][Ustaz Profile] Profile loading failed:', error);
    showError(error?.message || 'Unable to load this Ustaz profile. Please try again.');
  } finally {
    if (timeoutId !== null) window.clearTimeout(timeoutId);
  }
}

function setupRetry() {
  const button = $('ustazProfileRetry');
  if (!button || button.dataset.retryBound === '1') return;
  button.dataset.retryBound = '1';
  button.addEventListener('click', () => { void loadPublicProfile(getRequestedTeacherId()); });
}

/* =========================================================
   PROFILE ACTIONS — menu, rating, sharing, reports
========================================================= */
const USTAZ_PROFILE_ACTION_STATE = {
  teacher: null,
  selectedRating: null,
  ratingAverage: null,
  ratingCount: 0,
  myRating: null,
  ratingSubmitting: false,
  reportSubmitting: false,
  activeModal: null,
  modalReturnFocus: null,
  toastTimer: null
};

const USTAZ_PROFILE_ACTION_CONFIG = Object.freeze({
  RATING_SUMMARY_ENDPOINT: window.BARAKALINK_USTAZ_RATING_SUMMARY_ENDPOINT || '/teachers/:id/ratings',
  RATING_ENDPOINT: window.BARAKALINK_USTAZ_RATING_ENDPOINT || '/teachers/:id/rating',
  REPORT_ENDPOINT: window.BARAKALINK_USTAZ_REPORT_ENDPOINT || '/teachers/:id/report',
  MAX_REPORT_LENGTH: 1000,
  MODAL_CLASS: 'ustaz-modal-open',
  STAR_LABELS: Object.freeze({ 1: '1 star', 2: '2 stars', 3: '3 stars', 4: '4 stars', 5: '5 stars' })
});

function getAuthenticatedToken() {
  try {
    if (window.BarakaLinkAPI && typeof window.BarakaLinkAPI.getToken === 'function') {
      const token = window.BarakaLinkAPI.getToken();
      if (token) return token;
    }
  } catch (error) {
    console.warn('[BarakaLink][Ustaz Profile] Could not read API token:', error);
  }
  try {
    return localStorage.getItem('barakalink_token') || localStorage.getItem('token') ||
      localStorage.getItem('access_token') || '';
  } catch {
    return '';
  }
}

function resolveProfileActionId(teacher) {
  const requestedId = getRequestedTeacherId();
  if (requestedId) return String(requestedId);
  const candidates = [teacher?.id, teacher?.userId, teacher?.user_id, teacher?.teacherProfileId,
    teacher?.teacher_profile_id, teacher?.profileId, teacher?.profile_id];
  for (const value of candidates) {
    if (value !== null && value !== undefined && String(value).trim() !== '') return String(value);
  }
  return '';
}

function buildActionEndpoint(template, teacher) {
  const id = resolveProfileActionId(teacher);
  if (!template || !id) return '';
  return String(template).replace(':id', encodeURIComponent(id));
}

async function actionRequest(endpoint, options = {}) {
  const token = getAuthenticatedToken();
  if (!token) {
    const error = new Error('Please sign in to continue.');
    error.status = 401;
    error.code = 'NO_TOKEN';
    throw error;
  }
  const method = options.method || 'GET';
  const headers = {
    Accept: 'application/json',
    Authorization: token.startsWith('Bearer ') ? token : `Bearer ${token}`
  };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  let response;
  try {
    response = await fetch(`${USTAZ_PROFILE_CONFIG.API_BASE}${endpoint}`, {
      method,
      headers,
      credentials: 'include',
      cache: 'no-store',
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined
    });
  } catch (networkError) {
    const error = new Error('Unable to connect to the BarakaLink server.');
    error.code = 'NETWORK_ERROR';
    error.originalError = networkError;
    throw error;
  }
  const raw = await response.text();
  let payload = {};
  try {
    payload = raw ? JSON.parse(raw) : {};
  } catch {
    payload = { message: raw || `Request failed with HTTP ${response.status}.` };
  }
  if (!response.ok) {
    const error = new Error(safeString(payload?.message ?? payload?.error, `Request failed with HTTP ${response.status}.`));
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

/* ACTIONS MENU / MODAL HELPERS */
function openProfileActionsMenu() {
  const button = $('ustazProfileMoreButton');
  const menu = $('ustazProfileActionsMenu');
  if (!button || !menu) return;
  menu.hidden = false;
  button.setAttribute('aria-expanded', 'true');
}

function closeProfileActionsMenu() {
  const button = $('ustazProfileMoreButton');
  const menu = $('ustazProfileActionsMenu');
  if (!button || !menu) return;
  menu.hidden = true;
  button.setAttribute('aria-expanded', 'false');
}

function toggleProfileActionsMenu() {
  const menu = $('ustazProfileActionsMenu');
  if (!menu) return;
  if (menu.hidden) openProfileActionsMenu();
  else closeProfileActionsMenu();
}

function lockProfileModalScroll() { document.body.classList.add(USTAZ_PROFILE_ACTION_CONFIG.MODAL_CLASS); }
function unlockProfileModalScroll() { document.body.classList.remove(USTAZ_PROFILE_ACTION_CONFIG.MODAL_CLASS); }
function getModalById(id) { return $(id) || null; }

function openProfileModal(modalId, focusElement) {
  const modal = getModalById(modalId);
  if (!modal) return false;
  USTAZ_PROFILE_ACTION_STATE.modalReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  USTAZ_PROFILE_ACTION_STATE.activeModal = modal;
  modal.hidden = false;
  modal.setAttribute('aria-hidden', 'false');
  lockProfileModalScroll();
  requestAnimationFrame(() => {
    if (focusElement && typeof focusElement.focus === 'function') {
      try { focusElement.focus({ preventScroll: true }); }
      catch { focusElement.focus(); }
    }
  });
  return true;
}

function closeProfileModal(modalId) {
  const modal = getModalById(modalId);
  if (modal) {
    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
  }
  if (USTAZ_PROFILE_ACTION_STATE.activeModal === modal) USTAZ_PROFILE_ACTION_STATE.activeModal = null;
  const rateModal = $('ustazRateModal');
  const reportModal = $('ustazReportModal');
  if ((!rateModal || rateModal.hidden) && (!reportModal || reportModal.hidden)) unlockProfileModalScroll();
  const returnFocus = USTAZ_PROFILE_ACTION_STATE.modalReturnFocus;
  USTAZ_PROFILE_ACTION_STATE.modalReturnFocus = null;
  if (returnFocus && returnFocus.isConnected && typeof returnFocus.focus === 'function') {
    try { returnFocus.focus({ preventScroll: true }); }
    catch { returnFocus.focus(); }
  }
}

function setModalStatus(elementId, message, type = '') {
  const element = $(elementId);
  if (!element) return;
  element.classList.remove('is-success', 'is-error');
  if (!message) {
    element.hidden = true;
    element.textContent = '';
    return;
  }
  if (type === 'success') element.classList.add('is-success');
  if (type === 'error') element.classList.add('is-error');
  element.textContent = message;
  element.hidden = false;
}

/* RATING HELPERS */
function clampRating(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.min(5, Math.max(1, Math.round(number)));
}

function getRatingText(value) {
  return USTAZ_PROFILE_ACTION_CONFIG.STAR_LABELS[value] || 'Select a rating';
}

function updateRateStarVisuals(value, preview = false) {
  const stars = document.querySelectorAll('#ustazRateStars .ustaz-rate-star');
  const rating = clampRating(value);
  stars.forEach(star => {
    const starValue = Number(star.dataset.value);
    const active = Boolean(rating && starValue <= rating);
    star.classList.toggle('is-active', !preview && active);
    star.classList.toggle('is-preview', preview && active);
    star.setAttribute('aria-checked', starValue === rating ? 'true' : 'false');
    star.tabIndex = starValue === rating ? 0 : -1;
    const icon = star.querySelector('i');
    if (icon) icon.className = active ? 'fa-solid fa-star' : 'fa-regular fa-star';
  });
}

function selectProfileRating(value) {
  const rating = clampRating(value);
  if (!rating) return;
  USTAZ_PROFILE_ACTION_STATE.selectedRating = rating;
  updateRateStarVisuals(rating, false);
  const selected = $('ustazRateSelected');
  if (selected) {
    selected.textContent = getRatingText(rating);
    selected.classList.add('is-selected');
  }
  const submit = $('ustazRateSubmit');
  if (submit) submit.disabled = USTAZ_PROFILE_ACTION_STATE.ratingSubmitting;
}

function renderRatingSummary(teacher) {
  const root = $('ustazProfileRating');
  const stars = $('ustazProfileRatingStars');
  const average = $('ustazProfileRatingAverage');
  const count = $('ustazProfileRatingCount');
  if (!root) return;
  const ratingAverageRaw = teacher?.ratingAverage ?? teacher?.rating_average ?? teacher?.averageRating ?? teacher?.average_rating;
  const ratingCountRaw = teacher?.ratingCount ?? teacher?.rating_count ?? teacher?.ratingsCount ?? teacher?.ratings_count;
  const myRatingRaw = teacher?.myRating ?? teacher?.my_rating ?? teacher?.userRating ?? teacher?.user_rating ?? null;
  const numericAverage = Number(ratingAverageRaw);
  const numericCount = Number(ratingCountRaw);
  const hasRatings = Number.isFinite(numericAverage) && Number.isFinite(numericCount) && numericCount > 0;
  USTAZ_PROFILE_ACTION_STATE.ratingAverage = hasRatings ? Math.max(0, Math.min(5, numericAverage)) : null;
  USTAZ_PROFILE_ACTION_STATE.ratingCount = Number.isFinite(numericCount) ? Math.max(0, Math.trunc(numericCount)) : 0;
  USTAZ_PROFILE_ACTION_STATE.myRating = clampRating(myRatingRaw);
  if (average) {
    average.hidden = !hasRatings;
    average.textContent = hasRatings ? numericAverage.toFixed(1) : '';
  }
  if (count) {
    count.textContent = hasRatings ? `${Math.trunc(numericCount)} rating${Math.trunc(numericCount) === 1 ? '' : 's'}` : 'No ratings yet';
  }
  if (stars) {
    stars.setAttribute('aria-label', hasRatings
      ? `Rated ${numericAverage.toFixed(1)} out of 5 from ${Math.trunc(numericCount)} rating${Math.trunc(numericCount) === 1 ? '' : 's'}`
      : 'No ratings yet');
    const rounded = hasRatings ? Math.round(numericAverage) : 0;
    stars.querySelectorAll('i').forEach((icon, index) => {
      icon.className = index < rounded ? 'fa-solid fa-star' : 'fa-regular fa-star';
    });
  }
}

function extractRatingPayload(payload) {
  const root = payload?.data ?? payload ?? {};
  const possible = root?.rating ?? root?.ratingData ?? root;
  return {
    ratingAverage: possible?.ratingAverage ?? possible?.rating_average ?? root?.ratingAverage ?? root?.rating_average,
    ratingCount: possible?.ratingCount ?? possible?.rating_count ?? root?.ratingCount ?? root?.rating_count,
    myRating: possible?.myRating ?? possible?.my_rating ?? root?.myRating ?? root?.my_rating
  };
}

function applyRatingResponse(payload) {
  const teacher = USTAZ_PROFILE_ACTION_STATE.teacher;
  if (!teacher) return;
  const rating = extractRatingPayload(payload);
  if (rating.ratingAverage !== undefined) teacher.ratingAverage = rating.ratingAverage;
  if (rating.ratingCount !== undefined) teacher.ratingCount = rating.ratingCount;
  if (rating.myRating !== undefined) teacher.myRating = rating.myRating;
  renderRatingSummary(teacher);
}

async function loadUstazRatingSummary(teacher) {
  if (!teacher) return;
  const endpointTemplate = USTAZ_PROFILE_ACTION_CONFIG.RATING_SUMMARY_ENDPOINT;
  if (!endpointTemplate) return;
  const endpoint = buildActionEndpoint(endpointTemplate, teacher);
  if (!endpoint) {
    console.warn('[BarakaLink][Ustaz Profile] Could not build rating summary endpoint.');
    return;
  }
  try {
    const payload = await actionRequest(endpoint, { method: 'GET' });
    applyRatingResponse(payload);
    const currentTeacher = USTAZ_PROFILE_ACTION_STATE.teacher;
    if (currentTeacher) {
      USTAZ_PROFILE_ACTION_STATE.myRating = clampRating(currentTeacher.myRating);
      USTAZ_PROFILE_ACTION_STATE.selectedRating = USTAZ_PROFILE_ACTION_STATE.myRating;
    }
    console.info('[BarakaLink][Ustaz Profile] Rating summary loaded.', extractRatingPayload(payload));
  } catch (error) {
    console.warn('[BarakaLink][Ustaz Profile] Rating summary could not be loaded:', error);
  }
}

function openRateModal() {
  closeProfileActionsMenu();
  const teacher = USTAZ_PROFILE_ACTION_STATE.teacher;
  if (!teacher) return;
  const submit = $('ustazRateSubmit');
  const selected = $('ustazRateSelected');
  setModalStatus('ustazRateStatus', '');
  const existingRating = clampRating(USTAZ_PROFILE_ACTION_STATE.myRating);
  USTAZ_PROFILE_ACTION_STATE.selectedRating = existingRating;
  updateRateStarVisuals(existingRating, false);
  if (selected) {
    selected.textContent = existingRating ? getRatingText(existingRating) : 'Select a rating';
    selected.classList.toggle('is-selected', Boolean(existingRating));
  }
  if (submit) {
    submit.disabled = !existingRating;
    submit.textContent = existingRating ? 'Update rating' : 'Submit rating';
  }
  const firstSelectedStar = existingRating
    ? document.querySelector(`#ustazRateStars .ustaz-rate-star[data-value="${existingRating}"]`)
    : $('ustazRateStars')?.querySelector('.ustaz-rate-star');
  openProfileModal('ustazRateModal', firstSelectedStar);
}

function closeRateModal() { closeProfileModal('ustazRateModal'); }

async function submitProfileRating() {
  if (USTAZ_PROFILE_ACTION_STATE.ratingSubmitting) return;
  const teacher = USTAZ_PROFILE_ACTION_STATE.teacher;
  const rating = clampRating(USTAZ_PROFILE_ACTION_STATE.selectedRating);
  if (!teacher) return;
  if (!rating) {
    setModalStatus('ustazRateStatus', 'Please select a rating from 1 to 5.', 'error');
    return;
  }
  const endpointTemplate = USTAZ_PROFILE_ACTION_CONFIG.RATING_ENDPOINT;
  if (!endpointTemplate) {
    setModalStatus('ustazRateStatus', 'The rating service is not connected to the BarakaLink server yet.', 'error');
    return;
  }
  const endpoint = buildActionEndpoint(endpointTemplate, teacher);
  if (!endpoint) {
    setModalStatus('ustazRateStatus', 'This Ustaz profile does not have a valid rating identifier.', 'error');
    return;
  }
  const submit = $('ustazRateSubmit');
  const originalText = submit?.textContent || 'Submit rating';
  USTAZ_PROFILE_ACTION_STATE.ratingSubmitting = true;
  if (submit) {
    submit.disabled = true;
    submit.textContent = 'Saving...';
  }
  setModalStatus('ustazRateStatus', '');
  try {
    const payload = await actionRequest(endpoint, { method: 'PUT', body: { rating } });
    applyRatingResponse(payload);
    USTAZ_PROFILE_ACTION_STATE.myRating = rating;
    teacher.myRating = rating;
    closeRateModal();
  } catch (error) {
    console.error('[BarakaLink][Ustaz Profile] Rating submission failed:', error);
    let message = error?.message || 'Unable to save your rating. Please try again.';
    if (error?.status === 401) message = 'Please sign in before rating this Ustaz.';
    else if (error?.status === 403) message = 'You are not allowed to rate this Ustaz.';
    else if (error?.status === 409) message = 'Your existing rating could not be updated. Please try again.';
    setModalStatus('ustazRateStatus', message, 'error');
  } finally {
    USTAZ_PROFILE_ACTION_STATE.ratingSubmitting = false;
    if (submit) {
      submit.disabled = !USTAZ_PROFILE_ACTION_STATE.selectedRating;
      submit.textContent = originalText;
    }
  }
}

function setupRateStars() {
  const container = $('ustazRateStars');
  if (!container || container.dataset.ratingBound === '1') return;
  container.dataset.ratingBound = '1';
  const stars = Array.from(container.querySelectorAll('.ustaz-rate-star'));
  stars.forEach(star => {
    star.addEventListener('click', () => selectProfileRating(star.dataset.value));
    star.addEventListener('mouseenter', () => updateRateStarVisuals(star.dataset.value, true));
    star.addEventListener('mouseleave', () => updateRateStarVisuals(USTAZ_PROFILE_ACTION_STATE.selectedRating, false));
    star.addEventListener('focus', () => updateRateStarVisuals(star.dataset.value, true));
    star.addEventListener('blur', () => updateRateStarVisuals(USTAZ_PROFILE_ACTION_STATE.selectedRating, false));
    star.addEventListener('keydown', event => {
      const current = clampRating(USTAZ_PROFILE_ACTION_STATE.selectedRating) || Number(star.dataset.value);
      let next = current;
      if (event.key === 'ArrowRight' || event.key === 'ArrowUp') next = Math.min(5, current + 1);
      else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') next = Math.max(1, current - 1);
      else if (event.key === 'Home') next = 1;
      else if (event.key === 'End') next = 5;
      else if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        selectProfileRating(star.dataset.value);
        return;
      } else return;
      event.preventDefault();
      selectProfileRating(next);
      const nextStar = container.querySelector(`.ustaz-rate-star[data-value="${next}"]`);
      if (nextStar) nextStar.focus({ preventScroll: true });
    });
  });
  container.addEventListener('mouseleave', () => updateRateStarVisuals(USTAZ_PROFILE_ACTION_STATE.selectedRating, false));
}

/* SHARE */
async function shareUstazProfile() {
  closeProfileActionsMenu();
  const teacher = USTAZ_PROFILE_ACTION_STATE.teacher;
  const name = teacher ? getTeacherName(teacher) : 'Ustaz';
  const profileUrl = window.location.href;
  const shareData = { title: `${name} — BarakaLink`, text: 'View this Ustaz profile on BarakaLink.', url: profileUrl };
  try {
    if (typeof navigator.share === 'function') {
      await navigator.share(shareData);
      return;
    }
  } catch (error) {
    if (error?.name === 'AbortError') return;
    console.warn('[BarakaLink][Ustaz Profile] Native share failed:', error);
  }
  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(profileUrl);
      showProfileToast('Profile link copied');
      return;
    }
  } catch (error) {
    console.warn('[BarakaLink][Ustaz Profile] Clipboard API failed:', error);
  }
  try {
    const input = document.createElement('input');
    input.value = profileUrl;
    input.setAttribute('readonly', '');
    input.style.position = 'fixed';
    input.style.opacity = '0';
    document.body.appendChild(input);
    input.select();
    const copied = document.execCommand('copy');
    input.remove();
    if (copied) {
      showProfileToast('Profile link copied');
      return;
    }
  } catch (error) {
    console.warn('[BarakaLink][Ustaz Profile] Legacy copy failed:', error);
  }
  showProfileToast('Copy the profile link from your browser address bar.');
}

/* TOAST */
function showProfileToast(message) {
  const toast = $('ustazProfileToast');
  if (!toast) return;
  if (USTAZ_PROFILE_ACTION_STATE.toastTimer) clearTimeout(USTAZ_PROFILE_ACTION_STATE.toastTimer);
  toast.textContent = safeString(message);
  toast.hidden = false;
  USTAZ_PROFILE_ACTION_STATE.toastTimer = window.setTimeout(() => { toast.hidden = true; }, 2500);
}

/* REPORT MODAL */
function openReportModal() {
  closeProfileActionsMenu();
  const modal = $('ustazReportModal');
  const category = $('ustazReportCategory');
  const details = $('ustazReportDetails');
  const submit = $('ustazReportSubmit');
  if (!modal) return;
  if (category) {
    category.value = '';
    category.removeAttribute('aria-invalid');
  }
  if (details) {
    details.value = '';
    details.removeAttribute('aria-invalid');
  }
  updateReportCounter();
  setModalStatus('ustazReportStatus', '');
  if (submit) {
    submit.disabled = false;
    submit.textContent = 'Submit report';
  }
  const opened = openProfileModal('ustazReportModal', category);
  if (!opened && details) details.focus();
}

function closeReportModal() { closeProfileModal('ustazReportModal'); }

function updateReportCounter() {
  const details = $('ustazReportDetails');
  const counter = $('ustazReportCounter');
  if (!details || !counter) return;
  counter.textContent = `${String(details.value || '').length} / ${USTAZ_PROFILE_ACTION_CONFIG.MAX_REPORT_LENGTH}`;
}

const VALID_REPORT_CATEGORIES = new Set([
  'unethical_conduct', 'harassment', 'misleading_profile', 'inappropriate_content', 'safety_concern', 'other'
]);

function validateReportForm() {
  const category = $('ustazReportCategory');
  const details = $('ustazReportDetails');
  if (!category || !details) return { valid: false, message: 'The report form could not be loaded.' };
  const categoryValue = safeString(category.value);
  const detailsValue = safeString(details.value);
  category.removeAttribute('aria-invalid');
  details.removeAttribute('aria-invalid');
  if (!VALID_REPORT_CATEGORIES.has(categoryValue)) {
    category.setAttribute('aria-invalid', 'true');
    category.focus();
    return { valid: false, message: 'Please select an issue type.' };
  }
  if (!detailsValue) {
    details.setAttribute('aria-invalid', 'true');
    details.focus();
    return { valid: false, message: 'Please describe the issue.' };
  }
  if (detailsValue.length > USTAZ_PROFILE_ACTION_CONFIG.MAX_REPORT_LENGTH) {
    details.setAttribute('aria-invalid', 'true');
    details.focus();
    return { valid: false, message: 'Your report must be 1000 characters or fewer.' };
  }
  return { valid: true, category: categoryValue, details: detailsValue };
}

async function submitProfileReport(event) {
  if (event) event.preventDefault();
  if (USTAZ_PROFILE_ACTION_STATE.reportSubmitting) return;
  const teacher = USTAZ_PROFILE_ACTION_STATE.teacher;
  if (!teacher) return;
  const validation = validateReportForm();
  if (!validation.valid) {
    setModalStatus('ustazReportStatus', validation.message, 'error');
    return;
  }
  const endpointTemplate = USTAZ_PROFILE_ACTION_CONFIG.REPORT_ENDPOINT;
  if (!endpointTemplate) {
    setModalStatus('ustazReportStatus', 'The reporting service is not connected to the BarakaLink server yet.', 'error');
    return;
  }
  const endpoint = buildActionEndpoint(endpointTemplate, teacher);
  if (!endpoint) {
    setModalStatus('ustazReportStatus', 'This Ustaz profile does not have a valid report identifier.', 'error');
    return;
  }
  const submit = $('ustazReportSubmit');
  USTAZ_PROFILE_ACTION_STATE.reportSubmitting = true;
  if (submit) {
    submit.disabled = true;
    submit.textContent = 'Submitting...';
  }
  setModalStatus('ustazReportStatus', '');
  try {
    await actionRequest(endpoint, { method: 'POST', body: { category: validation.category, details: validation.details } });
    setModalStatus('ustazReportStatus', 'Thank you. Your report has been submitted for review.', 'success');
    if (submit) {
      submit.disabled = true;
      submit.textContent = 'Report submitted';
    }
    window.setTimeout(() => {
      const modal = $('ustazReportModal');
      if (modal && !modal.hidden) closeReportModal();
    }, 1300);
  } catch (error) {
    console.error('[BarakaLink][Ustaz Profile] Report submission failed:', error);
    let message = error?.message || 'Unable to submit your report. Please try again.';
    if (error?.status === 401) message = 'Please sign in before submitting a report.';
    else if (error?.status === 403) message = 'You are not allowed to submit this report.';
    else if (error?.status === 409) message = 'This report could not be submitted again right now.';
    setModalStatus('ustazReportStatus', message, 'error');
  } finally {
    USTAZ_PROFILE_ACTION_STATE.reportSubmitting = false;
    if (submit) {
      const modal = $('ustazReportModal');
      if (modal && !modal.hidden) {
        submit.disabled = false;
        submit.textContent = 'Submit report';
      }
    }
  }
}

function setupReportForm() {
  const form = $('ustazReportForm');
  if (!form || form.dataset.reportBound === '1') return;
  form.dataset.reportBound = '1';
  form.addEventListener('submit', submitProfileReport);
  const details = $('ustazReportDetails');
  if (details) details.addEventListener('input', () => {
    if (details.value.length > USTAZ_PROFILE_ACTION_CONFIG.MAX_REPORT_LENGTH) {
      details.value = details.value.slice(0, USTAZ_PROFILE_ACTION_CONFIG.MAX_REPORT_LENGTH);
    }
    details.removeAttribute('aria-invalid');
    updateReportCounter();
  });
  const category = $('ustazReportCategory');
  if (category) category.addEventListener('change', () => category.removeAttribute('aria-invalid'));
}

/* MODAL EVENTS */
function setupProfileModalCloseEvents() {
  document.querySelectorAll('[data-modal-close]').forEach(element => {
    if (element.dataset.modalCloseBound === '1') return;
    element.dataset.modalCloseBound = '1';
    element.addEventListener('click', event => {
      event.preventDefault();
      const rateModal = $('ustazRateModal');
      const reportModal = $('ustazReportModal');
      if (rateModal && !rateModal.hidden && element.closest('#ustazRateModal')) {
        closeRateModal();
        return;
      }
      if (reportModal && !reportModal.hidden && element.closest('#ustazReportModal')) closeReportModal();
    });
  });
}

function setupProfileModalEscape() {
  if (document.documentElement.dataset.ustazModalEscapeBound === '1') return;
  document.documentElement.dataset.ustazModalEscapeBound = '1';
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    const actionsMenu = $('ustazProfileActionsMenu');
    if (actionsMenu && !actionsMenu.hidden) {
      closeProfileActionsMenu();
      return;
    }
    const rateModal = $('ustazRateModal');
    if (rateModal && !rateModal.hidden) {
      closeRateModal();
      return;
    }
    const reportModal = $('ustazReportModal');
    if (reportModal && !reportModal.hidden) closeReportModal();
  });
}

function setupProfileActionsOutsideClick() {
  const menu = $('ustazProfileActionsMenu');
  const trigger = $('ustazProfileMoreButton');
  if (!menu || !trigger || menu.dataset.outsideBound === '1') return;
  menu.dataset.outsideBound = '1';
  document.addEventListener('click', event => {
    if (menu.hidden || menu.contains(event.target) || trigger.contains(event.target)) return;
    closeProfileActionsMenu();
  });
}

function setupProfileActionButtons() {
  const more = $('ustazProfileMoreButton');
  const rate = $('ustazProfileRateButton');
  const share = $('ustazProfileShareButton');
  const report = $('ustazProfileReportButton');
  const submitRating = $('ustazRateSubmit');
  if (more && more.dataset.actionsBound !== '1') {
    more.dataset.actionsBound = '1';
    more.addEventListener('click', event => {
      event.stopPropagation();
      toggleProfileActionsMenu();
    });
  }
  if (rate && rate.dataset.actionBound !== '1') {
    rate.dataset.actionBound = '1';
    rate.addEventListener('click', event => {
      event.stopPropagation();
      openRateModal();
    });
  }
  if (share && share.dataset.actionBound !== '1') {
    share.dataset.actionBound = '1';
    share.addEventListener('click', event => {
      event.stopPropagation();
      void shareUstazProfile();
    });
  }
  if (report && report.dataset.actionBound !== '1') {
    report.dataset.actionBound = '1';
    report.addEventListener('click', event => {
      event.stopPropagation();
      openReportModal();
    });
  }
  if (submitRating && submitRating.dataset.ratingSubmitBound !== '1') {
    submitRating.dataset.ratingSubmitBound = '1';
    submitRating.addEventListener('click', event => {
      event.preventDefault();
      void submitProfileRating();
    });
  }
  setupRateStars();
  setupReportForm();
  setupProfileModalCloseEvents();
  setupProfileModalEscape();
  setupProfileActionsOutsideClick();
}

function setupUstazProfileActions(teacher) {
  USTAZ_PROFILE_ACTION_STATE.teacher = teacher || null;
  renderRatingSummary(teacher);
  setupProfileActionButtons();
}

function refreshUstazProfileActionState(teacher) {
  USTAZ_PROFILE_ACTION_STATE.teacher = teacher || null;
  renderRatingSummary(teacher);
  const rateModal = $('ustazRateModal');
  if (!rateModal || rateModal.hidden) return;
  const existingRating = clampRating(teacher?.myRating ?? teacher?.my_rating);
  USTAZ_PROFILE_ACTION_STATE.myRating = existingRating;
  USTAZ_PROFILE_ACTION_STATE.selectedRating = existingRating;
  updateRateStarVisuals(existingRating, false);
}

/* DOM READY — initialize once and ensure profile loading always starts. */
function initializeUstazProfilePage() {
  try { setupTheme(); }
  catch (error) { console.error('[Ustaz Profile] Theme setup failed:', error); }
  try {
    setupBackButton();
    setupRetry();
    setupProfileTrustInfo();
    setupParentChatReviewModal();
  } catch (error) {
    console.error('[Ustaz Profile] UI setup failed:', error);
  }
  void loadPublicProfile(getRequestedTeacherId());
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeUstazProfilePage, { once: true });
} else {
  initializeUstazProfilePage();
}
