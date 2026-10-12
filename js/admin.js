'use strict';

const ADMIN_CONFIG = Object.freeze({
  API_BASE: String(
    window.BARAKALINK_API_BASE ||
    'http://localhost:5000/api'
  ).replace(/\/+$/, ''),
  DASHBOARD_ENDPOINT: '/admin/dashboard',
  MOSQUES_ENDPOINT: '/admin/mosques',
  USERS_ENDPOINT: '/admin/users',
  PARENT_PROFILES_ENDPOINT: '/admin/parent-profiles',
  USTAZ_ENDPOINT: '/admin/ustaz',
  
PARENT_ENDPOINT: '/admin/parent',
  CONTACTS_ENDPOINT: '/admin/contacts',
  NOTIFICATIONS_ENDPOINT: '/admin/notifications',
  THEME_KEY: 'barakalink_theme',
});

const $ = (id) => document.getElementById(id);
/**
 * Keep page scrolling locked while any Admin modal is open.
 * Closing a photo preview must not close its parent profile.
 */
function syncAdminModalOpenState() {
  const hasOpenModal = Array.from(
    document.querySelectorAll('.admin-modal')
  ).some((modal) => !modal.hidden);

  document.body.classList.toggle(
    'admin-modal-open',
    hasOpenModal
  );
}
const state = {
  users: {
    page: 1,
    limit: 20,
    total: 0,
    pages: 0,
    search: '',
    role: 'all',
    status: 'all',
    loading: false,
  },
  selectedUser: null,
  selectedParentProfile: null,
  ustaz: {
    page: 1,
    limit: 20,
    total: 0,
    pages: 0,
    search: '',
    status: 'all',
    verification: 'all',
    loading: false,
  },
  selectedUstaz: null,
  previewObjectUrl: '',
  selectedContact: null,
  contacts: {
    page: 1,
    limit: 20,
    total: 0,
    pages: 0,
    search: '',
    status: 'all',
    loading: false,
    reloadRequested: false,
  },
  notifications: {
    items: [],
    counts: { total: 0, support: 0, parents: 0, ustaz: 0 },
    readThrough: null,
    loading: false,
    reloadRequested: false,
    pollTimer: null,
  },
  mosques: {
  items: [],
  search: '',
  loading: false,
},
};

function safeString(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

function getToken() {
  try {
    return localStorage.getItem('barakalink_admin_token') || '';
  } catch {
    return '';
  }
}

function clearSession() {
  try {
    localStorage.removeItem('barakalink_admin_token');
    localStorage.removeItem('barakalink_admin');
  } catch {
    // Ignore storage cleanup errors.
  }
}

function redirectToLogin() {
  clearSession();
  window.location.href = './admin-login.html';
}

function setAlert(message = '') {
  const alert = $('adminAlert');
  if (!alert) return;
  alert.textContent = safeString(message);
  alert.hidden = !message;
}

function formatRole(role) {
  const normalized = safeString(role).toLowerCase();
  if (normalized === 'ustaz') return 'Ustaz';
  if (normalized === 'parent') return 'Parent';
  if (normalized === 'admin') return 'Admin';
  return normalized || 'User';
}

function formatStatus(status) {
  const normalized = safeString(status).toLowerCase();
  if (normalized === 'active') return 'Active';
  if (normalized === 'suspended') return 'Suspended';
  return normalized || 'Unknown';
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-ET', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function getInitials(name) {
  const parts = safeString(name, 'Admin').split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part.charAt(0)).join('').toUpperCase() || 'A';
}

async function apiRequest(endpoint, options = {}) {
  const token = getToken();
  if (!token) {
    const error = new Error('Please sign in to continue.');
    error.status = 401;
    throw error;
  }

  const headers = {
    Accept: 'application/json',
    Authorization: token.startsWith('Bearer ') ? token : `Bearer ${token}`,
  };

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  let response;
  try {
    response = await fetch(`${ADMIN_CONFIG.API_BASE}${endpoint}`, {
      method: options.method || 'GET',
      headers,
      credentials: 'include',
      cache: 'no-store',
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
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
    const error = new Error(
      safeString(payload?.message, `Request failed with HTTP ${response.status}.`)
    );
    error.status = response.status;
    error.code = payload?.code || '';
    error.payload = payload;
    throw error;
  }

  return payload;
}

function renderUserSummary(data) {
  const users = data?.users || {};
  const ustaz = data?.ustaz || {};
  const values = {
    statTotalUsers: users.total,
    statParents: users.parents,
    statUstaz: users.ustaz,
    statActiveUsers: users.active,
    statSuspendedUsers: users.suspended,
    statUstazProfiles: ustaz.profiles,
    statAvailableUstaz: ustaz.available,
    statUnavailableUstaz: ustaz.unavailable,
    statPendingUstazReviews: ustaz.pendingReview,
    marketAvailable: ustaz.available,
    marketUnavailable: ustaz.unavailable,
    marketActiveAvailable: ustaz.activeAvailable,
  };

  Object.entries(values).forEach(([id, value]) => {
    const element = $(id);
    if (element) element.textContent = Number(value || 0).toLocaleString('en-US');
  });
}

function renderRecentUsers(users) {
  const body = $('recentUsersBody');
  if (!body) return;
  body.replaceChildren();

  if (!Array.isArray(users) || users.length === 0) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 4;
    cell.className = 'admin-table-empty';
    cell.textContent = 'No registrations found.';
    row.appendChild(cell);
    body.appendChild(row);
    return;
  }

  users.forEach((user) => {
    const row = document.createElement('tr');
    const userCell = document.createElement('td');
    const name = document.createElement('strong');
    name.textContent = safeString(user.name, 'BarakaLink User');
    const date = document.createElement('small');
    date.textContent = formatDate(user.createdAt);
    date.style.display = 'block';
    date.style.marginTop = '4px';
    date.style.color = 'var(--admin-muted)';
    date.style.fontSize = '10px';
    userCell.append(name, date);

    const roleCell = document.createElement('td');
    const role = document.createElement('span');
    role.className = 'admin-role';
    role.textContent = formatRole(user.role);
    roleCell.appendChild(role);

    const statusCell = document.createElement('td');
    const status = document.createElement('span');
    const normalizedStatus = safeString(user.accountStatus).toLowerCase();
    status.className = `admin-status ${normalizedStatus}`;
    status.textContent = formatStatus(normalizedStatus);
    statusCell.appendChild(status);

    const profileCell = document.createElement('td');
    const profile = document.createElement('span');
    profile.className = `admin-profile-state ${user.profileCompleted ? 'complete' : 'incomplete'}`;
    profile.textContent = user.profileCompleted ? 'Complete' : 'Incomplete';
    profileCell.appendChild(profile);

    row.append(userCell, roleCell, statusCell, profileCell);
    body.appendChild(row);
  });
}

function renderAdminIdentity(admin) {
  const name = [admin?.firstName, admin?.lastName]
    .map((value) => safeString(value))
    .filter(Boolean)
    .join(' ') || 'Admin';
  const nameElement = $('adminUserName');
  const initialsElement = $('adminUserInitials');
  if (nameElement) nameElement.textContent = name;
  if (initialsElement) initialsElement.textContent = getInitials(name);
}

async function loadDashboard() {
  setAlert('');
  const refresh = $('adminRefreshButton');
  if (refresh) refresh.disabled = true;

  try {
    const payload = await apiRequest(ADMIN_CONFIG.DASHBOARD_ENDPOINT);
    const data = payload?.data || {};
    renderAdminIdentity(data.admin);
    renderUserSummary(data);
    renderRecentUsers(data.recentRegistrations);
    const health = $('adminHealthPill');
    const healthText = $('adminHealthText');
    if (health) health.dataset.state = 'ok';
    if (healthText) healthText.textContent = 'System connected';
  } catch (error) {
    console.error('[BarakaLink][Admin] Dashboard load failed:', error);
    const health = $('adminHealthPill');
    const healthText = $('adminHealthText');
    if (health) health.dataset.state = 'error';
    if (healthText) healthText.textContent = 'System unavailable';
    if (error?.status === 401) {
      redirectToLogin();
      return;
    }
    if (error?.status === 403) {
      setAlert('This account does not have Admin access.');
      return;
    }
    setAlert(error?.message || 'The Admin dashboard could not be loaded.');
  } finally {
    if (refresh) refresh.disabled = false;
  }
}

function renderUsers(items) {
  const body = $('adminUsersBody');
  if (!body) return;
  body.replaceChildren();

  if (!Array.isArray(items) || items.length === 0) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 5;
    cell.className = 'admin-table-empty';
    cell.textContent = 'No users match these filters.';
    row.appendChild(cell);
    body.appendChild(row);
    return;
  }

  items.forEach((user) => {
    const row = document.createElement('tr');

    const userCell = document.createElement('td');
    userCell.className = 'admin-user-name-cell';
    const name = document.createElement('strong');
    name.textContent = safeString(user.name, 'BarakaLink User');
    const contact = document.createElement('small');
    contact.textContent = safeString(user.email || user.phone, 'No contact information');
    userCell.append(name, contact);

    const roleCell = document.createElement('td');
    const role = document.createElement('span');
    role.className = 'admin-role';
    role.textContent = formatRole(user.role);
    roleCell.appendChild(role);

    const statusCell = document.createElement('td');
    const status = document.createElement('span');
    const normalizedStatus = safeString(user.accountStatus).toLowerCase();
    status.className = `admin-status ${normalizedStatus}`;
    status.textContent = formatStatus(normalizedStatus);
    statusCell.appendChild(status);

    const profileCell = document.createElement('td');
    const profile = document.createElement('span');
    profile.className = `admin-profile-state ${user.profileCompleted ? 'complete' : 'incomplete'}`;
    profile.textContent = user.profileCompleted ? 'Complete' : 'Incomplete';
    profileCell.appendChild(profile);

    const actionsCell = document.createElement('td');
    const viewButton = document.createElement('button');
    viewButton.type = 'button';
    viewButton.className = 'admin-row-action';
    viewButton.textContent = 'View';
    viewButton.addEventListener('click', () => {
      const roleKey = safeString(user.role).toLowerCase();
      if (roleKey === 'ustaz') {
        // Keep one source of truth for Ustaz profile details and review media.
        openUstazDetails(user.id);
      } else if (roleKey === 'parent') {
        // Show the complete Parent profile, preferences and private identity review.
        openParentProfileDetails(user.id);
      } else {
        openUserDetails(user.id);
      }
    });

    const statusButton = document.createElement('button');
    statusButton.type = 'button';
    statusButton.className = `admin-row-action ${normalizedStatus === 'active' ? 'danger' : 'success'}`;
    statusButton.textContent = normalizedStatus === 'active' ? 'Suspend' : 'Reactivate';
    statusButton.style.marginLeft = '6px';
    statusButton.addEventListener('click', () => changeUserStatus(user.id, normalizedStatus === 'active' ? 'suspended' : 'active'));

    actionsCell.append(viewButton, statusButton);
    row.append(userCell, roleCell, statusCell, profileCell, actionsCell);
    body.appendChild(row);
  });
}

function updateUsersPagination() {
  const pagination = $('adminUsersPagination');
  const label = $('adminUsersPageLabel');
  const prev = $('adminUsersPrevButton');
  const next = $('adminUsersNextButton');
  const summary = $('adminUsersResultSummary');

  const pages = state.users.pages;
  const page = state.users.page;
  const total = state.users.total;
  pagination.hidden = pages <= 1;
  if (label) label.textContent = pages ? `Page ${page} of ${pages}` : 'Page 1';
  if (prev) prev.disabled = page <= 1 || state.users.loading;
  if (next) next.disabled = !pages || page >= pages || state.users.loading;
  if (summary) {
    const rolePart = state.users.role === 'all' ? 'all roles' : formatRole(state.users.role);
    const statusPart = state.users.status === 'all' ? 'all statuses' : formatStatus(state.users.status);
    summary.textContent = `${total.toLocaleString('en-US')} user${total === 1 ? '' : 's'} · ${rolePart} · ${statusPart}`;
  }
}

async function loadUsers() {
  if (state.users.loading) return;
  state.users.loading = true;
  updateUsersPagination();

  const params = new URLSearchParams({
    page: String(state.users.page),
    limit: String(state.users.limit),
    search: state.users.search,
    role: state.users.role,
    status: state.users.status,
  });

  try {
    const payload = await apiRequest(`${ADMIN_CONFIG.USERS_ENDPOINT}?${params.toString()}`);
    const data = payload?.data || {};
    state.users.total = Number(data?.pagination?.total || 0);
    state.users.pages = Number(data?.pagination?.pages || 0);
    renderUsers(data.items || []);
    updateUsersPagination();
  } catch (error) {
    console.error('[BarakaLink][Admin] Users load failed:', error);
    if (error?.status === 401) {
      redirectToLogin();
      return;
    }
    if (error?.status === 403) {
      setAlert('This account does not have Admin access.');
      return;
    }
    setAlert(error?.message || 'Users could not be loaded.');
  } finally {
    state.users.loading = false;
    updateUsersPagination();
  }
}

function openModal() {
  const modal = $('adminUserModal');
  if (!modal) return;
  modal.hidden = false;
  document.body.classList.add('admin-modal-open');
}

function closeUserModal() {
  const modal = $('adminUserModal');
  if (!modal) return;
  modal.hidden = true;
  syncAdminModalOpenState();
  state.selectedUser = null;
  state.selectedParentProfile = null;
}

function renderUserDetails(detail) {
  const user = detail?.user || detail || {};
  const title = $('adminUserModalTitle');
  const eyebrow = $('adminUserModalEyebrow');
  const subtitle = $('adminUserModalSubtitle');
  const avatar = $('adminUserModalAvatar');
  const grid = $('adminUserDetailGrid');
  const fullSections = $('adminUserProfileSections');
  const suspend = $('adminUserSuspendButton');
  const reactivate = $('adminUserReactivateButton');
  const approveParent = $('adminUserApproveButton');
const rejectParent = $('adminUserRejectButton');
if (approveParent) {
  approveParent.addEventListener('click', () => {
    updateParentReviewStatus('approved');
  });
}

if (rejectParent) {
  rejectParent.addEventListener('click', () => {
    updateParentReviewStatus('rejected');
  });
}
  if (!grid) return;

  const name = safeString(user?.name, 'BarakaLink User');
  if (title) title.textContent = name;
  if (eyebrow) eyebrow.textContent = safeString(user?.role).toLowerCase() === 'parent'
    ? 'Parent profile details'
    : 'Account details';
  if (subtitle) subtitle.textContent = [safeString(user?.email), safeString(user?.phone)]
    .filter(Boolean)
    .join(' · ') || 'Profile details';
  renderUstazAvatar(avatar, name, user?.avatarUrl || user?.avatar_url || '', true);
  grid.replaceChildren();

  const fields = [
    ['User ID', user?.id],
    ['Role', formatRole(user?.role)],
    ['Email', safeString(user?.email, 'Not provided')],
    ['Phone', safeString(user?.phone, 'Not provided')],
    ['Status', formatStatus(user?.accountStatus)],
    ['Profile', user?.profileCompleted ? 'Complete' : 'Incomplete'],
    ['Telegram', user?.telegramVerified ? 'Verified' : 'Not verified'],
    ['Created', formatDate(user?.createdAt)],
    ['Updated', formatDate(user?.updatedAt)],
  ];

  fields.forEach(([label, value]) => {
    const item = document.createElement('div');
    item.className = 'admin-detail-item';
    const labelEl = document.createElement('span');
    labelEl.textContent = label;
    const valueEl = document.createElement('strong');
    valueEl.textContent = safeString(value, '—');
    item.append(labelEl, valueEl);
    grid.appendChild(item);
  });

  if (fullSections) {
    fullSections.replaceChildren();

    const detailData = detail && typeof detail === 'object' ? detail : {};
    const excludedProfileKeys = new Set([
      'id', 'user_id', 'created_at', 'updated_at',
      'profile_review_status', 'profile_submitted_at',
      'profile_reviewed_at', 'profile_reviewed_by',
      'profile_rejection_reason',
    ]);

    const profileFields = (Array.isArray(detailData.profileFields) ? detailData.profileFields : [])
      .filter((field) => !excludedProfileKeys.has(safeString(field?.key).toLowerCase()));
    const extraUserFields = (Array.isArray(detailData.userFields) ? detailData.userFields : [])
      .filter((field) => ![
        'id', 'role', 'first_name', 'last_name', 'email', 'phone', 'avatar_url',
        'account_status', 'profile_completed', 'telegram_verified', 'created_at', 'updated_at',
      ].includes(safeString(field?.key).toLowerCase()));
    const preferenceFields = (Array.isArray(detailData.preferenceFields) ? detailData.preferenceFields : [])
      .filter((field) => !['id', 'user_id', 'created_at', 'updated_at'].includes(safeString(field?.key).toLowerCase()));

    if (profileFields.length) {
      fullSections.appendChild(detailSection('Parent / Student profile', profileFields));
    } else {
      fullSections.appendChild(textSection('Parent / Student profile', 'No additional Parent profile fields were returned.'));
    }

    if (preferenceFields.length) {
      fullSections.appendChild(detailSection('Learning preferences', preferenceFields));
    }

    if (detailData.preferences && typeof detailData.preferences === 'object') {
      if (safeString(detailData.preferences.bio)) {
        fullSections.appendChild(textSection('Bio', detailData.preferences.bio));
      }
      if (safeString(detailData.preferences.preferredTeacherGender)) {
        fullSections.appendChild(detailSection('Teacher preference', [
          ['Preferred teacher gender', detailData.preferences.preferredTeacherGender, 'preferred_teacher_gender'],
        ]));
      }
    }

    const studyFields = Array.isArray(detailData.studyFields) ? detailData.studyFields : [];
    if (studyFields.length) {
      fullSections.appendChild(listSection('Study interests', studyFields.map((item) => item?.name || item?.slug || item)));
    }

    const contentInterests = Array.isArray(detailData.contentInterests) ? detailData.contentInterests : [];
    if (contentInterests.length) {
      fullSections.appendChild(listSection('Islamic content interests', contentInterests));
    }

    if (extraUserFields.length) {
      fullSections.appendChild(detailSection('Additional account information', extraUserFields));
    }

    if (detailData.profileReviewStatus || detailData.profileSubmittedAt || detailData.profileReviewedAt || detailData.profileRejectionReason) {
      fullSections.appendChild(detailSection('Manual profile review', [
        ['Review status', formatVerification(detailData.profileReviewStatus), 'profile_review_status'],
        ['Submitted at', detailData.profileSubmittedAt, 'profile_submitted_at'],
        ['Reviewed at', detailData.profileReviewedAt, 'profile_reviewed_at'],
        ['Rejection reason', detailData.profileRejectionReason, 'profile_rejection_reason'],
      ]));
    }

    if (detailData.privateIdentityDocuments) {
      fullSections.appendChild(identityDocumentsSection(detailData));
    }
  }
  const status = safeString(user?.accountStatus).toLowerCase();
  const role = safeString(user?.role).toLowerCase();

  const reviewStatus = safeString(
    detail?.profileReviewStatus ||
    detail?.profile?.profileReviewStatus
  ).toLowerCase();

  const isPendingParentReview =
    role === 'parent' &&
    ['pending', 'review'].includes(reviewStatus);

  if (approveParent) {
    approveParent.hidden = !isPendingParentReview;
    approveParent.disabled = false;
  }

  if (rejectParent) {
    rejectParent.hidden = !isPendingParentReview;
    rejectParent.disabled = false;
  }

  if (suspend) {
    suspend.hidden = isPendingParentReview || status !== 'active';
    suspend.disabled = false;
  }

  if (reactivate) {
    reactivate.hidden = isPendingParentReview || status !== 'suspended';
    reactivate.disabled = false;
  }

  openModal();
}

async function updateParentReviewStatus(nextStatus) {
  const detail = state.selectedParentProfile;
  const user = detail?.user || state.selectedUser;
  const userId = Number(user?.id);
  const status = safeString(nextStatus).toLowerCase();

  if (!Number.isInteger(userId) || userId <= 0) {
    setAlert('The selected Parent account could not be identified.');
    return;
  }

  if (safeString(user?.role).toLowerCase() !== 'parent') {
    setAlert('This action is only available for Parent accounts.');
    return;
  }

  if (!['approved', 'rejected'].includes(status)) {
    setAlert('Choose a valid Parent review decision.');
    return;
  }

  const currentReviewStatus = safeString(
    detail?.profileReviewStatus ||
    detail?.profile?.profileReviewStatus
  ).toLowerCase();

  if (!['pending', 'review'].includes(currentReviewStatus)) {
    setAlert(
      'This Parent is not awaiting review. Refresh the profile and try again.'
    );
    return;
  }

  let rejectionReason = '';

  if (status === 'rejected') {
    const enteredReason = window.prompt(
      'Enter the reason for rejecting this Parent profile:',
      ''
    );

    if (enteredReason === null) {
      return;
    }

    rejectionReason = safeString(enteredReason).slice(0, 1000);

    if (!rejectionReason) {
      setAlert('A rejection reason is required.');
      return;
    }
  }

  const confirmed = window.confirm(
    status === 'approved'
      ? 'Approve this Parent profile?'
      : `Reject this Parent profile with the following reason?\n\n${rejectionReason}`
  );

  if (!confirmed) return;

  const approveButton = $('adminUserApproveButton');
  const rejectButton = $('adminUserRejectButton');

  if (approveButton) approveButton.disabled = true;
  if (rejectButton) rejectButton.disabled = true;

  setAlert('');

  try {
    const payload = await apiRequest(
      `${ADMIN_CONFIG.PARENT_ENDPOINT}/${encodeURIComponent(userId)}/review`,
      {
        method: 'PATCH',
        body: {
          status,
          rejectionReason,
        },
      }
    );

    closeUserModal();

    await Promise.all([
      loadUsers(),
      loadDashboard(),
    ]);

    setAlert(
      payload?.message ||
      (status === 'approved'
        ? 'Parent profile approved.'
        : 'Parent profile rejected.')
    );
  } catch (error) {
    console.error(
      '[BarakaLink][Admin] Parent review update failed:',
      error
    );

    if (error?.status === 401) {
      redirectToLogin();
      return;
    }

    setAlert(
      error?.message ||
      'The Parent profile review could not be updated.'
    );
  } finally {
    if (approveButton) approveButton.disabled = false;
    if (rejectButton) rejectButton.disabled = false;
  }
}
async function openParentProfileDetails(userId) {
  setAlert('');
  try {
    const payload = await apiRequest(
      `${ADMIN_CONFIG.PARENT_PROFILES_ENDPOINT}/${encodeURIComponent(userId)}`
    );
    const detail = payload?.data || null;
    if (!detail?.user) {
      throw new Error('The Parent profile details were not returned by the server.');
    }

    state.selectedUser = detail.user;
    state.selectedParentProfile = detail;
    renderUserDetails(detail);
  } catch (error) {
    console.error('[BarakaLink][Admin] Parent profile detail load failed:', error);
    if (error?.status === 401) {
      redirectToLogin();
      return;
    }
    setAlert(error?.message || 'Parent profile details could not be loaded.');
  }
}

async function openUserDetails(userId) {
  setAlert('');
  try {
    const payload = await apiRequest(`${ADMIN_CONFIG.USERS_ENDPOINT}/${encodeURIComponent(userId)}`);
    state.selectedUser = payload?.data?.user || null;
    if (state.selectedUser) renderUserDetails(state.selectedUser);
  } catch (error) {
    console.error('[BarakaLink][Admin] User detail load failed:', error);
    if (error?.status === 401) {
      redirectToLogin();
      return;
    }
    setAlert(error?.message || 'User details could not be loaded.');
  }
}

async function changeUserStatus(userId, nextStatus) {
  const actionWord = nextStatus === 'suspended' ? 'suspend' : 'reactivate';
  const message = nextStatus === 'suspended'
    ? 'Suspend this user account? The user will no longer have an active account.'
    : 'Reactivate this user account?';

  if (!window.confirm(message)) return;

  setAlert('');
  try {
    await apiRequest(`${ADMIN_CONFIG.USERS_ENDPOINT}/${encodeURIComponent(userId)}/status`, {
      method: 'PATCH',
      body: { accountStatus: nextStatus },
    });

    closeUserModal();
    await Promise.all([loadUsers(), loadDashboard()]);
    setAlert(`User account ${actionWord}d successfully.`);
  } catch (error) {
    console.error('[BarakaLink][Admin] User status update failed:', error);
    if (error?.status === 401) {
      redirectToLogin();
      return;
    }
    setAlert(error?.message || 'The user status could not be changed.');
  }
}

function setupUsers() {
  const search = $('adminUsersSearch');
  const role = $('adminUsersRoleFilter');
  const status = $('adminUsersStatusFilter');
  const refresh = $('adminUsersRefreshButton');
  const prev = $('adminUsersPrevButton');
  const next = $('adminUsersNextButton');
  const close = $('adminUserModalClose');
  const suspend = $('adminUserSuspendButton');
  const reactivate = $('adminUserReactivateButton');

  let searchTimer = null;
  if (search) {
    search.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        state.users.search = safeString(search.value).slice(0, 100);
        state.users.page = 1;
        loadUsers();
      }, 300);
    });
  }

  if (role) {
    role.addEventListener('change', () => {
      state.users.role = safeString(role.value).toLowerCase() || 'all';
      state.users.page = 1;
      loadUsers();
    });
  }

  if (status) {
    status.addEventListener('change', () => {
      state.users.status = safeString(status.value).toLowerCase() || 'all';
      state.users.page = 1;
      loadUsers();
    });
  }

  if (refresh) refresh.addEventListener('click', loadUsers);
  if (prev) prev.addEventListener('click', () => {
    if (state.users.page > 1) {
      state.users.page -= 1;
      loadUsers();
    }
  });
  if (next) next.addEventListener('click', () => {
    if (state.users.page < state.users.pages) {
      state.users.page += 1;
      loadUsers();
    }
  });
  if (close) close.addEventListener('click', closeUserModal);

  document.querySelectorAll('[data-admin-modal-close]').forEach((element) => {
    element.addEventListener('click', closeUserModal);
  });

  if (suspend) suspend.addEventListener('click', () => {
    if (state.selectedUser) changeUserStatus(state.selectedUser.id, 'suspended');
  });
  if (reactivate) reactivate.addEventListener('click', () => {
    if (state.selectedUser) changeUserStatus(state.selectedUser.id, 'active');
  });
}


function formatVerification(value) {
  const normalized = safeString(value).toLowerCase();
  if (normalized === 'pending' || normalized === 'review') return 'Pending review';
  if (normalized === 'approved') return 'Approved';
  if (normalized === 'rejected') return 'Rejected';
  return normalized || 'Pending review';
}

function getApiOrigin() {
  return ADMIN_CONFIG.API_BASE.replace(/\/api\/?$/, '').replace(/\/$/, '');
}

function resolveMediaUrl(value) {
  const raw = safeString(value);
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith('//')) return `${window.location.protocol}${raw}`;
  return `${getApiOrigin()}${raw.startsWith('/') ? raw : `/${raw}`}`;
}

function renderUstazAvatar(container, name, photoUrl, large = false) {
  if (!container) return;

  container.replaceChildren();

  if (large) {
    container.classList.add('admin-ustaz-modal-avatar-large');
  }

  const initials = document.createElement('span');
  initials.textContent = getInitials(name).slice(0, 2);
  container.appendChild(initials);

  const resolvedPhotoUrl = resolveMediaUrl(photoUrl);
  if (!resolvedPhotoUrl) return;

  const image = document.createElement('img');
  image.alt = `${name} profile photo`;
  image.hidden = true;

  image.addEventListener('load', () => {
    image.hidden = false;
    initials.hidden = true;
  });

  image.addEventListener('error', () => {
    image.hidden = true;
    initials.hidden = false;
  });

  // Make the large profile photo in the Admin detail/CV modal previewable.
  if (large) {
    image.tabIndex = 0;
    image.setAttribute('role', 'button');
    image.setAttribute('aria-label', `Preview ${name}'s profile photo`);
    image.title = 'Click to enlarge';
    image.style.cursor = 'zoom-in';

    const previewPhoto = () => {
      openDocumentPreview(
        resolvedPhotoUrl,
        `${safeString(name, 'User')} — Profile Photo`,
        'image/jpeg'
      );
    };

    image.addEventListener('click', previewPhoto);

    image.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        previewPhoto();
      }
    });
  }

  image.src = resolvedPhotoUrl;
  container.appendChild(image);
}

function renderUstazRows(items) {
  const body = $('adminUstazBody');
  if (!body) return;
  body.replaceChildren();

  if (!Array.isArray(items) || items.length === 0) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 6;
    cell.className = 'admin-table-empty';
    cell.textContent = 'No Ustaz profiles match these filters.';
    row.appendChild(cell);
    body.appendChild(row);
    return;
  }

  items.forEach((ustaz) => {
    const row = document.createElement('tr');

    const userCell = document.createElement('td');
    const userWrap = document.createElement('div');
    userWrap.className = 'admin-ustaz-name';
    const avatar = document.createElement('div');
    avatar.className = 'admin-ustaz-mini-avatar';
    renderUstazAvatar(avatar, ustaz.name, ustaz.avatarUrl);
    const userText = document.createElement('div');
    const name = document.createElement('strong');
    name.textContent = safeString(ustaz.name, 'BarakaLink Ustaz');
    const contact = document.createElement('small');
    contact.className = 'admin-ustaz-contact';
    contact.textContent = safeString(ustaz.email || ustaz.phone, 'No contact information');
    userText.append(name, contact);
    userWrap.append(avatar, userText);
    userCell.appendChild(userWrap);

    const profileCell = document.createElement('td');
    const chips = document.createElement('div');
    chips.className = 'admin-completeness-line';
    const profileChip = document.createElement('span');
    profileChip.className = `admin-mini-chip ${ustaz.profileCompleted ? 'complete' : 'incomplete'}`;
    profileChip.textContent = ustaz.profileCompleted ? 'Complete' : 'Incomplete';
    chips.appendChild(profileChip);
    if (ustaz.teacherProfileId) {
      const profileId = document.createElement('span');
      profileId.className = 'admin-mini-chip';
      profileId.textContent = `Profile #${ustaz.teacherProfileId}`;
      chips.appendChild(profileId);
    } else {
      const missing = document.createElement('span');
      missing.className = 'admin-mini-chip incomplete';
      missing.textContent = 'No profile';
      chips.appendChild(missing);
    }
    const location = document.createElement('small');
    location.className = 'admin-ustaz-meta-line';
    location.textContent = [ustaz.area, ustaz.subcity].filter(Boolean).join(', ') || 'Location not provided';
    const privateDocs = document.createElement('small');
    privateDocs.className = 'admin-ustaz-meta-line';
    privateDocs.textContent = [
      ustaz.hasSelfie ? 'Selfie' : '',
      ustaz.hasFaydaFront ? 'Fayda front' : '',
      ustaz.hasFaydaBack ? 'Fayda back' : '',
    ].filter(Boolean).join(' · ') || 'No private identity files';
    profileCell.append(chips, location, privateDocs);

    const availabilityCell = document.createElement('td');
    const availability = document.createElement('span');
    availability.className = 'admin-ustaz-availability';
    const dot = document.createElement('span');
    dot.className = `status-dot ${ustaz.acceptingStudents ? 'status-dot-green' : 'status-dot-red'}`;
    const label = document.createElement('span');
    label.textContent = ustaz.acceptingStudents ? 'Available' : 'Not available';
    availability.append(dot, label);
    availabilityCell.appendChild(availability);

    const identityCell = document.createElement('td');
    const identityChip = document.createElement('span');
    const reviewStatus = safeString(ustaz.profileReviewStatus).toLowerCase();
    identityChip.className = `admin-ustaz-review-chip ${reviewStatus === 'approved' ? 'verified' : reviewStatus === 'rejected' ? 'unverified' : 'review'}`;
    identityChip.textContent = formatVerification(reviewStatus);
    identityCell.appendChild(identityChip);

    const statusCell = document.createElement('td');
    const status = document.createElement('span');
    const normalizedStatus = safeString(ustaz.accountStatus).toLowerCase();
    status.className = `admin-status ${normalizedStatus}`;
    status.textContent = formatStatus(normalizedStatus);
    statusCell.appendChild(status);

    const actionCell = document.createElement('td');
    const view = document.createElement('button');
    view.type = 'button';
    view.className = 'admin-row-action admin-ustaz-view-button';
    view.textContent = 'Review';
    view.addEventListener('click', () => openUstazDetails(ustaz.id));
    actionCell.appendChild(view);

    row.append(userCell, profileCell, availabilityCell, identityCell, statusCell, actionCell);
    body.appendChild(row);
  });
}

function updateUstazPagination() {
  const pagination = $('adminUstazPagination');
  const label = $('adminUstazPageLabel');
  const prev = $('adminUstazPrevButton');
  const next = $('adminUstazNextButton');
  const summary = $('adminUstazResultSummary');
  const pages = state.ustaz.pages;
  const page = state.ustaz.page;
  const total = state.ustaz.total;

  if (pagination) pagination.hidden = pages <= 1;
  if (label) label.textContent = pages ? `Page ${page} of ${pages}` : 'Page 1';
  if (prev) prev.disabled = page <= 1 || state.ustaz.loading;
  if (next) next.disabled = !pages || page >= pages || state.ustaz.loading;
  if (summary) summary.textContent = `${total.toLocaleString('en-US')} Ustaz profile${total === 1 ? '' : 's'}`;
}

async function loadUstazProfiles() {
  if (state.ustaz.loading) return;
  state.ustaz.loading = true;
  updateUstazPagination();

  const params = new URLSearchParams({
    page: String(state.ustaz.page),
    limit: String(state.ustaz.limit),
    search: state.ustaz.search,
    status: state.ustaz.status,
    verification: state.ustaz.verification,
  });

  try {
    const payload = await apiRequest(`${ADMIN_CONFIG.USTAZ_ENDPOINT}?${params.toString()}`);
    const data = payload?.data || {};
    state.ustaz.total = Number(data?.pagination?.total || 0);
    state.ustaz.pages = Number(data?.pagination?.pages || 0);
    state.ustaz.items = Array.isArray(data?.items) ? data.items : [];
    renderUstazRows(state.ustaz.items);
    updateUstazPagination();
  } catch (error) {
    console.error('[BarakaLink][Admin] Ustaz profiles load failed:', error);
    if (error?.status === 401) {
      redirectToLogin();
      return;
    }
    setAlert(error?.message || 'Ustaz profiles could not be loaded.');
  } finally {
    state.ustaz.loading = false;
    updateUstazPagination();
  }
}
function renderMosqueStatistics(items, summary = {}) {
  const statistics = {
    adminMosquesStatEntries: items.length,
    adminMosquesStatParents: summary.distinctParents,
    adminMosquesStatUstazs: summary.distinctUstazs,
    adminMosquesStatDistinct: summary.distinctUsers,
  };

  Object.entries(statistics).forEach(([id, value]) => {
    const element = $(id);
    if (!element) return;

    const count = Number(value);

    element.textContent =
      value !== null &&
      value !== undefined &&
      Number.isFinite(count)
        ? count.toLocaleString('en-US')
        : '—';
  });
}
function renderMosques() {
  const body = $('adminMosquesBody');
  const summary = $('adminMosquesResultSummary');

  if (!body) return;

  const term = safeString(state.mosques.search).toLowerCase();

  const items = state.mosques.items.filter((item) =>
    [
      item.subcity,
      item.area,
      item.mosqueName,
    ].some((value) => safeString(value).toLowerCase().includes(term))
  );

  body.replaceChildren();

  if (!items.length) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');

    cell.colSpan = 6;
    cell.className = 'admin-table-empty';
    cell.textContent = state.mosques.items.length
      ? 'No mosque locations match your search.'
      : 'No mosque names have been submitted yet.';

    row.appendChild(cell);
    body.appendChild(row);

    if (summary) {
      summary.textContent = '';
    }

    return;
  }

  let parents = 0;
  let ustazs = 0;
  let totalUsers = 0;

  items.forEach((item) => {
    const row = document.createElement('tr');

    const values = [
      item.subcity,
      item.area,
      item.mosqueName,
      Number(item.parentCount || 0).toLocaleString('en-US'),
      Number(item.ustazCount || 0).toLocaleString('en-US'),
      Number(item.totalUsers || 0).toLocaleString('en-US'),
    ];

    values.forEach((value, index) => {
      const cell = document.createElement('td');
      cell.textContent = safeString(value, 'Not provided');

      if (index >= 3) {
        cell.classList.add('admin-mosques-count');
      }

      row.appendChild(cell);
    });

    parents += Number(item.parentCount || 0);
    ustazs += Number(item.ustazCount || 0);
    totalUsers += Number(item.totalUsers || 0);

    body.appendChild(row);
  });

  if (summary) {
    summary.textContent =
      `${items.length} mosque/location entr${items.length === 1 ? 'y' : 'ies'} · ` +
      `${parents.toLocaleString('en-US')} Parent submissions · ` +
      `${ustazs.toLocaleString('en-US')} Ustaz submissions · ` +
      `${totalUsers.toLocaleString('en-US')} total users`;
  }
}

async function loadMosques() {
  if (state.mosques.loading) return;

  state.mosques.loading = true;

  const feedback = $('adminMosquesFeedback');
  const refresh = $('adminMosquesRefreshButton');

  if (feedback) feedback.textContent = 'Loading submitted mosque locations…';
  if (refresh) refresh.disabled = true;

  try {
    const payload = await apiRequest(ADMIN_CONFIG.MOSQUES_ENDPOINT);
    const items = payload?.data?.items;

    if (!Array.isArray(items)) {
      throw new Error('The server returned an invalid mosque directory response.');
    }

    state.mosques.items = items;

const summary = payload?.data?.summary || {};

renderMosqueStatistics(items, summary);
renderMosques();

    if (feedback) feedback.textContent = '';
  } catch (error) {
    console.error('[BarakaLink][Admin] Mosque locations load failed:', error);

    if (error?.status === 401) {
      redirectToLogin();
      return;
    }

    if (feedback) {
      feedback.textContent =
        error?.message || 'Mosque locations could not be loaded.';
    }
  } finally {
    state.mosques.loading = false;
    if (refresh) refresh.disabled = false;
  }
}

function setupMosques() {
  const search = $('adminMosquesSearch');
  const refresh = $('adminMosquesRefreshButton');

  if (search) {
    search.addEventListener('input', () => {
      state.mosques.search = safeString(search.value).slice(0, 150);
      renderMosques();
    });
  }

  if (refresh) {
    refresh.addEventListener('click', loadMosques);
  }
}

function formatDetailValue(key, value) {
  if (value === null || value === undefined || String(value).trim() === '') return '—';
  const normalizedKey = safeString(key).toLowerCase();

  if (normalizedKey.includes('password') || normalizedKey.includes('token') || normalizedKey.includes('secret')) {
    return '[hidden]';
  }

  if (
    normalizedKey.startsWith('is_') ||
    normalizedKey.startsWith('has_') ||
    normalizedKey.includes('accepting_students') ||
    normalizedKey.includes('profile_completed') ||
    normalizedKey.includes('telegram_verified') ||
    normalizedKey === 'identity_verified'
  ) {
    const normalized = safeString(value).toLowerCase();
    return ['1', 'true', 'yes'].includes(normalized) ? 'Yes' : 'No';
  }

  if (
    normalizedKey.includes('date_of_birth') ||
    normalizedKey.includes('_at') ||
    normalizedKey === 'created_at' ||
    normalizedKey === 'updated_at'
  ) {
    return formatDate(value);
  }

  return String(value);
}

function isMediaField(field) {
  const rawKey = safeString(field?.key);
  const key = rawKey
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase();

  const value = safeString(field?.value).toLowerCase();

  // Match complete field-name tokens, not substrings inside "profile".
  const keyParts = key.split(/[^a-z0-9]+/).filter(Boolean);

  const mediaTokens = new Set([
    'url',
    'path',
    'file',
    'front',
    'back',
    'document',
    'selfie',
    'fayda',
    'avatar',
    'photo',
    'image',
    'certificate',
    'audio',
    'attachment',
  ]);

  const hasMediaKey = keyParts.some((part) => mediaTokens.has(part));

  const hasMediaValue =
    /^https?:\/\/\S+/i.test(value) ||
    /^\/(?:uploads|api\/admin\/)\S*/i.test(value) ||
    /\.(jpg|jpeg|png|webp|gif|pdf|mp3|wav|m4a|ogg)(?:[?#].*)?$/i.test(value);

  return hasMediaKey || hasMediaValue;
}

function isIdentityField(field) {
  const key = safeString(field?.key).toLowerCase();
  return (
    key.includes('fayda') ||
    key.includes('national') ||
    key.includes('identity') ||
    key.includes('id_number') ||
    key.includes('id_front') ||
    key.includes('id_back') ||
    key.includes('document') ||
    key === 'front' ||
    key === 'back'
  );
}

function openDocumentPreview(url, title = 'Document preview', mime = '') {
  const modal = $('adminDocumentPreviewModal');
  const heading = $('adminDocumentPreviewTitle');
  const image = $('adminDocumentPreviewImage');
  const frame = $('adminDocumentPreviewFrame');
  const fallback = $('adminDocumentPreviewFallback');
  const external = $('adminDocumentPreviewExternal');
  if (!modal || !url) return;

  const resolved = resolveMediaUrl(url);
  const lower = `${safeString(mime)} ${resolved}`.toLowerCase();
  const isImage = /image\/(jpeg|jpg|png|webp|gif)/i.test(mime) || /\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(lower);
  const isPdf = /application\/pdf/i.test(mime) || /\.pdf(\?|$)/i.test(lower);

  if (heading) heading.textContent = safeString(title, 'Document preview');
  if (image) {
    image.hidden = !isImage;
    image.removeAttribute('src');
    if (isImage) image.src = resolved;
  }
  if (frame) {
    frame.hidden = !(isPdf || !isImage);
    frame.removeAttribute('src');
    if (isPdf || !isImage) frame.src = resolved;
  }
  if (fallback) fallback.hidden = isImage || isPdf;
  if (external) external.href = resolved;

  modal.hidden = false;
  document.body.classList.add('admin-modal-open');
}

function closeDocumentPreview() {
  const modal = $('adminDocumentPreviewModal');
  const image = $('adminDocumentPreviewImage');
  const frame = $('adminDocumentPreviewFrame');
  if (modal) modal.hidden = true;
  if (image) image.removeAttribute('src');
  if (frame) frame.removeAttribute('src');
  if (state.previewObjectUrl) {
    URL.revokeObjectURL(state.previewObjectUrl);
    state.previewObjectUrl = '';
  }
  syncAdminModalOpenState();
}

async function openProtectedMediaPreview(url, title = 'Private document', mime = '') {
  const modal = $('adminDocumentPreviewModal');
  const heading = $('adminDocumentPreviewTitle');
  const image = $('adminDocumentPreviewImage');
  const frame = $('adminDocumentPreviewFrame');
  const fallback = $('adminDocumentPreviewFallback');
  const external = $('adminDocumentPreviewExternal');
  const token = getToken();

  if (!modal || !url) return;
  if (!token) {
    setAlert('Your Admin session has expired.');
    redirectToLogin();
    return;
  }

  closeDocumentPreview();
  modal.hidden = false;
  document.body.classList.add('admin-modal-open');

  if (heading) heading.textContent = safeString(title, 'Private document');
  if (image) image.hidden = true;
  if (frame) frame.hidden = true;
  if (fallback) {
    fallback.hidden = false;
    fallback.querySelector('p')?.replaceChildren(document.createTextNode('Loading private document…'));
  }
  if (external) external.href = '#';

  try {
    const response = await fetch(resolveMediaUrl(url), {
      method: 'GET',
      headers: {
        Accept: mime || 'image/*',
        Authorization: token.startsWith('Bearer ') ? token : `Bearer ${token}`,
      },
      credentials: 'include',
      cache: 'no-store',
    });

    if (response.status === 401) {
      throw Object.assign(new Error('Your Admin session has expired.'), { status: 401 });
    }

    if (!response.ok) {
      throw Object.assign(new Error(`The private document could not be loaded (HTTP ${response.status}).`), { status: response.status });
    }

    const blob = await response.blob();
    state.previewObjectUrl = URL.createObjectURL(blob);

    const contentType = safeString(response.headers.get('content-type'), mime || blob.type || 'image/jpeg');
    const isImage = /image\/(jpeg|jpg|png|webp|gif)/i.test(contentType);
    const isPdf = /application\/pdf/i.test(contentType);

    if (external) external.href = state.previewObjectUrl;

    if (isImage && image) {
      image.src = state.previewObjectUrl;
      image.hidden = false;
      if (fallback) fallback.hidden = true;
      return;
    }

    if (isPdf && frame) {
      frame.src = state.previewObjectUrl;
      frame.hidden = false;
      if (fallback) fallback.hidden = true;
      return;
    }

    if (fallback) {
      fallback.hidden = false;
      fallback.querySelector('p')?.replaceChildren(document.createTextNode('This private file type cannot be previewed here. Use Open in new tab.'));
    }
  } catch (error) {
    console.error('[BarakaLink][Admin] Private media preview failed:', error);
    if (error?.status === 401) {
      closeDocumentPreview();
      redirectToLogin();
      return;
    }
    if (fallback) {
      fallback.hidden = false;
      fallback.querySelector('p')?.replaceChildren(document.createTextNode(error?.message || 'The private document could not be loaded.'));
    }
    if (external) external.href = '#';
  }
}

function detailSection(title, fields) {
  const section = document.createElement('section');
  section.className = 'admin-ustaz-detail-section';
  const heading = document.createElement('h3');
  heading.textContent = title;
  section.appendChild(heading);

  const grid = document.createElement('div');
  grid.className = 'admin-ustaz-detail-grid';

  (Array.isArray(fields) ? fields : []).forEach((field) => {
    const tuple = Array.isArray(field) ? field : [field?.label, field?.value, field?.key, field?.dataType];
    const label = tuple[0];
    const value = tuple[1];
    const key = tuple[2] || label;
    const dataType = tuple[3] || '';

    const item = document.createElement('div');
    item.className = 'admin-ustaz-detail-item';

    const labelEl = document.createElement('span');
    labelEl.textContent = safeString(label, 'Field');

    const valueWrap = document.createElement('div');
    valueWrap.className = 'admin-ustaz-detail-value-wrap';

    const valueEl = document.createElement('strong');
    valueEl.textContent = formatDetailValue(key, value);
    valueWrap.appendChild(valueEl);

    if (isMediaField({ key, value })) {
      const mediaUrl = safeString(value);
      if (mediaUrl) {
        const action = document.createElement('button');
        action.type = 'button';
        action.className = 'admin-inline-preview-button';
        action.textContent = /audio|mp3|wav|m4a|ogg/i.test(`${key} ${mediaUrl}`) ? 'Open media' : 'Preview';
        action.addEventListener('click', () => openDocumentPreview(mediaUrl, safeString(label, 'Document'), dataType));
        valueWrap.appendChild(action);
      }
    }

    item.append(labelEl, valueWrap);
    grid.appendChild(item);
  });

  section.appendChild(grid);
  return section;
}

function textSection(title, value, fallback = 'Not provided.') {
  const section = document.createElement('section');
  section.className = 'admin-ustaz-detail-section';
  const heading = document.createElement('h3');
  heading.textContent = title;
  const text = document.createElement('p');
  text.className = 'admin-ustaz-detail-text';
  text.textContent = safeString(value, fallback);
  section.append(heading, text);
  return section;
}

function listSection(title, items, emptyText = 'None provided.') {
  const section = document.createElement('section');
  section.className = 'admin-ustaz-detail-section';
  const heading = document.createElement('h3');
  heading.textContent = title;
  section.appendChild(heading);
  const list = document.createElement('ul');
  list.className = 'admin-ustaz-list';
  if (!Array.isArray(items) || !items.length) {
    const li = document.createElement('li');
    li.textContent = emptyText;
    list.appendChild(li);
  } else {
    items.forEach((item) => {
      const li = document.createElement('li');
      li.textContent = safeString(item);
      list.appendChild(li);
    });
  }
  section.appendChild(list);
  return section;
}

function identityDocumentsSection(data) {
  const section = document.createElement('section');
  section.className = 'admin-ustaz-detail-section';

  const heading = document.createElement('h3');
  heading.textContent = 'Private identity review';
  section.appendChild(heading);

  const intro = document.createElement('p');
  intro.className = 'admin-ustaz-detail-text';
  intro.textContent = 'These files are private and are available only to authorized Admin reviewers.';
  section.appendChild(intro);

  const documents = [
    ['Live selfie', data?.privateIdentityDocuments?.selfie],
    ['Fayda front', data?.privateIdentityDocuments?.faydaFront],
    ['Fayda back', data?.privateIdentityDocuments?.faydaBack],
  ];

  const cards = document.createElement('div');
  cards.className = 'admin-document-grid admin-private-identity-grid';

  documents.forEach(([title, documentInfo]) => {
    const card = document.createElement('article');
    card.className = 'admin-document-card';

    const titleEl = document.createElement('strong');
    titleEl.textContent = title;
    card.appendChild(titleEl);

    if (!documentInfo?.available || !documentInfo?.url) {
      const missing = document.createElement('span');
      missing.className = 'admin-document-missing';
      missing.textContent = 'Not submitted';
      card.appendChild(missing);
    } else {
      const meta = document.createElement('span');
      meta.textContent = 'Private Admin-only file';
      card.appendChild(meta);

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'admin-secondary-button';
      button.textContent = title === 'Live selfie' ? 'View selfie' : 'Preview';
      button.addEventListener('click', () => openProtectedMediaPreview(documentInfo.url, title, documentInfo.mime || 'image/jpeg'));
      card.appendChild(button);
    }

    cards.appendChild(card);
  });

  section.appendChild(cards);
  return section;
}

function qualificationsSection(qualifications) {
  const section = document.createElement('section');
  section.className = 'admin-ustaz-detail-section';

  const heading = document.createElement('h3');
  heading.textContent = 'Qualifications & certificates';
  section.appendChild(heading);

  const list = document.createElement('div');
  list.className = 'admin-document-list';

  if (!Array.isArray(qualifications) || !qualifications.length) {
    const empty = document.createElement('p');
    empty.className = 'admin-ustaz-detail-text';
    empty.textContent = 'No qualifications provided.';
    section.appendChild(empty);
    return section;
  }

  qualifications.forEach((item) => {
    const card = document.createElement('article');
    card.className = 'admin-document-card';

    const title = document.createElement('strong');
    title.textContent = safeString(item.title, 'Qualification');

    const meta = document.createElement('span');
    meta.textContent = [item.institution, item.specialization, item.completionYear]
      .filter((value) => value !== null && value !== undefined && String(value).trim() !== '')
      .map(String)
      .join(' · ') || 'No additional details';

    card.append(title, meta);

    if (item.certificateUrl) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'admin-secondary-button';
      button.textContent = 'Preview certificate';
      button.addEventListener('click', () => openDocumentPreview(item.certificateUrl, item.certificateName || item.title || 'Qualification certificate', item.certificateMime || ''));
      card.appendChild(button);
    } else {
      const status = document.createElement('span');
      status.className = 'admin-document-missing';
      status.textContent = 'No certificate file';
      card.appendChild(status);
    }

    list.appendChild(card);
  });

  section.appendChild(list);
  return section;
}

function recitationSection(profile) {
  const section = document.createElement('section');
  section.className = 'admin-ustaz-detail-section';

  const heading = document.createElement('h3');
  heading.textContent = 'Recitation audio';
  section.appendChild(heading);

  if (profile?.recitationTitle) {
    const title = document.createElement('p');
    title.className = 'admin-ustaz-detail-text';
    title.textContent = profile.recitationTitle;
    section.appendChild(title);
  }

  if (profile?.recitationDescription) {
    const description = document.createElement('p');
    description.className = 'admin-ustaz-detail-text';
    description.textContent = profile.recitationDescription;
    description.style.marginTop = '8px';
    section.appendChild(description);
  }

  const url = safeString(profile?.recitationAudioUrl);
  if (!url) {
    const empty = document.createElement('p');
    empty.className = 'admin-ustaz-detail-text';
    empty.textContent = 'No recitation audio was submitted.';
    section.appendChild(empty);
    return section;
  }

  const audio = document.createElement('audio');
  audio.controls = true;
  audio.preload = 'metadata';
  audio.className = 'admin-ustaz-audio-player';
  audio.src = resolveMediaUrl(url);
  section.appendChild(audio);

  return section;
}

function closeUstazModal() {
  const modal = $('adminUstazModal');
  if (!modal) return;
  modal.hidden = true;
  syncAdminModalOpenState();
  state.selectedUstaz = null;
}

function renderUstazDetails(data) {
  const modal = $('adminUstazModal');
  const title = $('adminUstazModalTitle');
  const subtitle = $('adminUstazModalSubtitle');
  const avatar = $('adminUstazModalAvatar');
  const statusBox = $('adminUstazReviewStatus');
  const sections = $('adminUstazDetailSections');
  const publicButton = $('adminUstazPublicProfileButton');
  const approveButton = $('adminUstazApproveButton');
  const rejectButton = $('adminUstazRejectButton');
  if (!modal || !sections) return;

  const user = data?.user || {};
  const profile = data?.profile || {};
  const qualifications = Array.isArray(data?.qualifications) ? data.qualifications : [];

  if (title) title.textContent = safeString(user.name, 'Ustaz');
  if (subtitle) subtitle.textContent = [user.email, user.phone].filter(Boolean).join(' · ') || 'Full Ustaz record';
  renderUstazAvatar(avatar, user.name, user.avatarUrl, true);

  if (statusBox) {
    statusBox.replaceChildren();
    const profileChip = document.createElement('span');
    const reviewStatus = safeString(profile.profileReviewStatus).toLowerCase();
    profileChip.className = `admin-ustaz-review-chip ${reviewStatus === 'approved' ? 'verified' : reviewStatus === 'rejected' ? 'unverified' : 'review'}`;
    profileChip.textContent = formatVerification(reviewStatus);
    const completenessChip = document.createElement('span');
    completenessChip.className = `admin-ustaz-review-chip ${user.profileCompleted ? 'verified' : 'unverified'}`;
    completenessChip.textContent = user.profileCompleted ? 'Profile complete' : 'Profile incomplete';
    statusBox.append(profileChip, completenessChip);
  }

  sections.replaceChildren();

  sections.appendChild(detailSection('Account', [
    ['User ID', user.id, 'id'],
    ['Profile ID', user.teacherProfileId, 'teacher_profile_id'],
    ['Account status', formatStatus(user.accountStatus), 'account_status'],
    ['Profile completion', user.profileCompleted, 'profile_completed'],
    ['Telegram verification', user.telegramVerified, 'telegram_verified'],
    ['Created', user.createdAt, 'created_at'],
    ['Updated', user.updatedAt, 'updated_at'],
  ]));

  const dynamicUserFields = (data.userFields || []).filter((field) => !['first_name', 'last_name', 'email', 'phone', 'avatar_url', 'account_status', 'profile_completed', 'telegram_verified', 'created_at', 'updated_at', 'id'].includes(safeString(field.key).toLowerCase()));
  if (dynamicUserFields.length) {
    sections.appendChild(detailSection('Other submitted account fields', dynamicUserFields));
  }

  sections.appendChild(detailSection('Personal & teaching profile', [
    ['Date of birth', profile.dateOfBirth, 'date_of_birth'],
    ['Gender', profile.gender, 'gender'],
    ['Experience', profile.experience, 'experience'],
    ['Sub-city', profile.subcity, 'subcity'],
    ['Area', profile.area, 'area'],
    ['Nearest mosque', profile.nearestMosque, 'nearest_mosque'],
    ['Hourly rate', profile.hourlyRate, 'hourly_rate'],
    ['Lesson duration', profile.lessonDuration, 'lesson_duration'],
    ['Lesson format', profile.lessonFormat, 'lesson_format'],
    ['Accepting students', profile.acceptingStudents, 'accepting_students'],
  ]));

  sections.appendChild(textSection('Bio', profile.bio));
  sections.appendChild(textSection('Teaching approach', profile.teachingApproach));
  sections.appendChild(listSection('Study fields', (data.studyFields || []).map((item) => item.name || item.slug)));
  sections.appendChild(listSection('Languages', data.languages || []));
  sections.appendChild(listSection('Availability days', (data.availability || []).map((item) => item.dayName)));
  sections.appendChild(qualificationsSection(qualifications));
  sections.appendChild(recitationSection(profile));
  sections.appendChild(identityDocumentsSection(data));

  const profileFieldIdentity = (data.profileFields || []).filter((field) => isIdentityField(field) && !isMediaField(field));
  if (profileFieldIdentity.length) {
    sections.appendChild(detailSection('Identity information', profileFieldIdentity));
  }

  if (Array.isArray(data.identitySources) && data.identitySources.length) {
    data.identitySources.forEach((source) => {
      const fields = (source.rows || []).flatMap((row) => row.fields || []);
      if (fields.length) sections.appendChild(detailSection(`Submitted documents — ${source.table}`, fields));
    });
  }

  sections.appendChild(detailSection('Manual profile review', [
    ['Current review status', formatVerification(profile.profileReviewStatus), 'profile_review_status'],
    ['Submitted at', profile.profileSubmittedAt, 'profile_submitted_at'],
    ['Reviewed at', profile.profileReviewedAt, 'profile_reviewed_at'],
    ['Rejection reason', profile.profileRejectionReason, 'profile_rejection_reason'],
  ]));

  const reviewStatus = safeString(profile.profileReviewStatus).toLowerCase();

  if (approveButton) {
    approveButton.hidden = reviewStatus === 'approved';
    approveButton.disabled = false;
  }

  if (rejectButton) {
    rejectButton.hidden = reviewStatus === 'rejected';
    rejectButton.disabled = false;
  }

  if (publicButton) {
    publicButton.href = `../dashboard/view-ustaz-profile.html?id=${encodeURIComponent(user.id)}`;
    publicButton.hidden = reviewStatus !== 'approved';
  }

  modal.hidden = false;
  document.body.classList.add('admin-modal-open');
}

async function openUstazDetails(userId) {
  setAlert('');
  try {
    const payload = await apiRequest(`${ADMIN_CONFIG.USTAZ_ENDPOINT}/${encodeURIComponent(userId)}`);
    const detail = payload?.data || null;
    const summary = Array.isArray(state.ustaz.items)
      ? state.ustaz.items.find((item) => Number(item?.id) === Number(userId))
      : null;

    if (detail) {
      const existingDocs = detail.privateIdentityDocuments || {};
      const baseUrl = `/api/admin/ustaz/${encodeURIComponent(userId)}/media`;

      detail.privateIdentityDocuments = {
        selfie: {
          available: existingDocs.selfie?.available === true || summary?.hasSelfie === true,
          url: existingDocs.selfie?.url || `${baseUrl}/selfie`,
          label: 'Live selfie',
          mime: existingDocs.selfie?.mime || 'image/jpeg',
        },
        faydaFront: {
          available: existingDocs.faydaFront?.available === true || summary?.hasFaydaFront === true,
          url: existingDocs.faydaFront?.url || `${baseUrl}/fayda-front`,
          label: 'Fayda front',
          mime: existingDocs.faydaFront?.mime || 'image/jpeg',
        },
        faydaBack: {
          available: existingDocs.faydaBack?.available === true || summary?.hasFaydaBack === true,
          url: existingDocs.faydaBack?.url || `${baseUrl}/fayda-back`,
          label: 'Fayda back',
          mime: existingDocs.faydaBack?.mime || 'image/jpeg',
        },
      };

      detail.hasSelfie = summary?.hasSelfie === true || detail.privateIdentityDocuments.selfie.available;
      detail.hasFaydaFront = summary?.hasFaydaFront === true || detail.privateIdentityDocuments.faydaFront.available;
      detail.hasFaydaBack = summary?.hasFaydaBack === true || detail.privateIdentityDocuments.faydaBack.available;
    }

    state.selectedUstaz = detail;
    if (state.selectedUstaz) renderUstazDetails(state.selectedUstaz);
  } catch (error) {
    console.error('[BarakaLink][Admin] Ustaz detail load failed:', error);
    if (error?.status === 401) {
      redirectToLogin();
      return;
    }
    setAlert(error?.message || 'Ustaz profile could not be loaded.');
  }
}

async function updateUstazReviewStatus(status) {
  const ustaz = state.selectedUstaz;
  const userId = ustaz?.user?.id;
  if (!userId) return;

  const normalized = safeString(status).toLowerCase();
  if (!['approved', 'rejected'].includes(normalized)) return;

  let rejectionReason = '';
  if (normalized === 'rejected') {
    rejectionReason = safeString(window.prompt('Enter the reason for rejecting this Ustaz profile:', ''));
    if (!rejectionReason) {
      setAlert('A rejection reason is required.');
      return;
    }
  }

  const action = normalized === 'approved' ? 'approve' : 'reject';
  const confirmation = normalized === 'approved'
    ? 'Approve this Ustaz profile? It will become visible to parents.'
    : 'Reject this Ustaz profile? The Ustaz will be allowed to correct it and submit again.';

  if (!window.confirm(confirmation)) return;

  const approveButton = $('adminUstazApproveButton');
  const rejectButton = $('adminUstazRejectButton');
  if (approveButton) approveButton.disabled = true;
  if (rejectButton) rejectButton.disabled = true;

  try {
    await apiRequest(`${ADMIN_CONFIG.USTAZ_ENDPOINT}/${encodeURIComponent(userId)}/review`, {
      method: 'PATCH',
      body: {
        status: normalized,
        rejectionReason,
      },
    });

    closeUstazModal();
    setAlert(`Ustaz profile ${action}d successfully.`);
    await Promise.all([loadUstazProfiles(), loadDashboard()]);
  } catch (error) {
    console.error('[BarakaLink][Admin] Ustaz review update failed:', error);
    if (error?.status === 401) {
      redirectToLogin();
      return;
    }
    setAlert(error?.message || 'The Ustaz profile review could not be updated.');
  } finally {
    if (approveButton) approveButton.disabled = false;
    if (rejectButton) rejectButton.disabled = false;
  }
}


function setupUstazProfiles() {
  const search = $('adminUstazSearch');
  const status = $('adminUstazStatusFilter');
  const verification = $('adminUstazVerificationFilter');
  const refresh = $('adminUstazRefreshButton');
  const prev = $('adminUstazPrevButton');
  const next = $('adminUstazNextButton');
  const close = $('adminUstazModalClose');
  const documentClose = $('adminDocumentPreviewClose');
  const approveButton = $('adminUstazApproveButton');
  const rejectButton = $('adminUstazRejectButton');

  let searchTimer = null;
  if (search) {
    search.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        state.ustaz.search = safeString(search.value).slice(0, 100);
        state.ustaz.page = 1;
        loadUstazProfiles();
      }, 300);
    });
  }
  if (status) {
    status.addEventListener('change', () => {
      state.ustaz.status = safeString(status.value).toLowerCase() || 'all';
      state.ustaz.page = 1;
      loadUstazProfiles();
    });
  }
  if (verification) {
    verification.addEventListener('change', () => {
      state.ustaz.verification = safeString(verification.value).toLowerCase() || 'all';
      state.ustaz.page = 1;
      loadUstazProfiles();
    });
  }
  if (refresh) refresh.addEventListener('click', loadUstazProfiles);
  if (prev) prev.addEventListener('click', () => {
    if (state.ustaz.page > 1) {
      state.ustaz.page -= 1;
      loadUstazProfiles();
    }
  });
  if (next) next.addEventListener('click', () => {
    if (state.ustaz.page < state.ustaz.pages) {
      state.ustaz.page += 1;
      loadUstazProfiles();
    }
  });
  if (close) close.addEventListener('click', closeUstazModal);
  document.querySelectorAll('[data-admin-ustaz-modal-close]').forEach((element) => {
    element.addEventListener('click', closeUstazModal);
  });
  if (documentClose) documentClose.addEventListener('click', closeDocumentPreview);
  if (approveButton) approveButton.addEventListener('click', () => updateUstazReviewStatus('approved'));
  if (rejectButton) rejectButton.addEventListener('click', () => updateUstazReviewStatus('rejected'));
  document.querySelectorAll('[data-admin-document-modal-close]').forEach((element) => {
    element.addEventListener('click', closeDocumentPreview);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const documentModal = $('adminDocumentPreviewModal');
    const ustazModal = $('adminUstazModal');
    if (documentModal && !documentModal.hidden) {
      closeDocumentPreview();
      return;
    }
    if (ustazModal && !ustazModal.hidden) closeUstazModal();
  });
}


/* =========================================================
   CONTACT / SUPPORT INBOX
========================================================= */
function formatContactStatus(status) {
  const normalized = safeString(status).toLowerCase();
  if (normalized === 'in_progress') return 'In progress';
  if (normalized === 'resolved') return 'Resolved';
  return normalized === 'new' ? 'New' : (normalized || 'Unknown');
}

function formatContactStatusClass(status) {
  const normalized = safeString(status).toLowerCase();
  return normalized === 'in_progress' ? 'in-progress' : normalized;
}

function formatContactType(type) {
  const normalized = safeString(type || 'contact').toLowerCase();
  const labels = {
    contact: 'Public contact',
    report: 'Parent report',
    feedback: 'Parent feedback',
    question: 'Parent question',
  };
  return labels[normalized] || 'Support message';
}

function formatContactTypeClass(type) {
  const normalized = safeString(type || 'contact').toLowerCase();
  return ['contact', 'report', 'feedback', 'question'].includes(normalized)
    ? normalized
    : 'contact';
}

function renderContactCounts(counts) {
  const values = {
    adminContactCountTotal: counts?.total,
    adminContactCountNew: counts?.new,
    adminContactCountInProgress: counts?.inProgress,
    adminContactCountResolved: counts?.resolved,
  };
  Object.entries(values).forEach(([id, value]) => {
    const element = $(id);
    if (element) element.textContent = Number(value || 0).toLocaleString('en-US');
  });
}

function renderContacts(items) {
  const body = $('adminContactsBody');
  if (!body) return;
  body.replaceChildren();

  if (!Array.isArray(items) || items.length === 0) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 6;
    cell.className = 'admin-table-empty';
    cell.textContent = state.contacts.search || state.contacts.status !== 'all'
      ? 'No support submissions match these filters.'
      : 'No support submissions have been received yet.';
    row.appendChild(cell);
    body.appendChild(row);
    return;
  }

  items.forEach((item) => {
    const row = document.createElement('tr');

    const senderCell = document.createElement('td');
    senderCell.className = 'admin-contact-sender';
    const sender = document.createElement('strong');
    sender.textContent = [item.firstName, item.lastName].map((v) => safeString(v)).filter(Boolean).join(' ') || 'BarakaLink User';
    const userId = document.createElement('small');
    userId.textContent = item.userId ? `User ID: ${safeString(item.userId)}` : 'Guest submission · No account';
    senderCell.append(sender, userId);

    const phoneCell = document.createElement('td');
    const phoneLink = document.createElement('a');
    phoneLink.href = `tel:${safeString(item.phone).replace(/[^+\d]/g, '')}`;
    phoneLink.textContent = safeString(item.phone, '—');
    phoneLink.className = 'admin-contact-phone-link';
    phoneCell.appendChild(phoneLink);

    const messageCell = document.createElement('td');
    const type = document.createElement('span');
    type.className = `admin-contact-type-label ${formatContactTypeClass(item.messageType)}`;
    type.textContent = formatContactType(item.messageType);
    messageCell.appendChild(type);

    const submissionType = safeString(item.messageType || 'contact').toLowerCase();
    const reportTopics = {
      technical: 'Technical issue',
      account_profile: 'Account or profile problem',
      ustaz_student: 'Ustaz or student issue',
      messaging: 'Messaging problem',
      safety_trust: 'Safety or trust concern',
      other: 'Other',
    };
    const questionTopics = {
      using_barakalink: 'Using BarakaLink',
      finding_ustaz: 'Finding an Ustaz or Ustaza',
      learning_requests: 'Learning requests',
      messages: 'Messages',
      account_profile: 'My account or profile',
      other: 'Something else',
    };
    const feedbackKinds = {
      appreciation: 'Something I like',
      idea: 'An idea',
      general: 'Something else',
    };
    let selectedTopic = '';
    if (submissionType === 'report' && item.category) {
      selectedTopic = `Topic: ${reportTopics[item.category] || formatSubmissionValue(item.category)}`;
    } else if (submissionType === 'question' && item.topic) {
      selectedTopic = `Topic: ${questionTopics[item.topic] || formatSubmissionValue(item.topic)}`;
    } else if (submissionType === 'feedback' && item.kind) {
      selectedTopic = `Feedback: ${feedbackKinds[item.kind] || formatSubmissionValue(item.kind)}`;
    }
    if (selectedTopic) {
      const topicElement = document.createElement('small');
      topicElement.className = 'admin-contact-topic-preview';
      topicElement.textContent = selectedTopic;
      messageCell.appendChild(topicElement);
    }

    if (safeString(item.subject)) {
      const subject = document.createElement('strong');
      subject.className = 'admin-contact-subject-preview';
      subject.textContent = safeString(item.subject);
      messageCell.appendChild(subject);
    }

    const preview = document.createElement('span');
    preview.className = 'admin-contact-message-preview';
    preview.textContent = safeString(item.message, '—');
    preview.title = safeString(item.message);
    messageCell.appendChild(preview);

    const receivedCell = document.createElement('td');
    receivedCell.textContent = formatDate(item.createdAt);

    const statusCell = document.createElement('td');
    const badge = document.createElement('span');
    badge.className = `admin-contact-status-badge ${formatContactStatusClass(item.status)}`;
    badge.textContent = formatContactStatus(item.status);
    statusCell.appendChild(badge);

    const actionCell = document.createElement('td');
    const viewButton = document.createElement('button');
    viewButton.type = 'button';
    viewButton.className = 'admin-secondary-button admin-contact-view-button';
    viewButton.textContent = 'View details';
    viewButton.addEventListener('click', () => openContactDetails(item));
    actionCell.appendChild(viewButton);

    row.append(senderCell, phoneCell, messageCell, receivedCell, statusCell, actionCell);
    body.appendChild(row);
  });
}

function renderContactsPagination(pagination) {
  const text = $('adminContactsPaginationText');
  const prev = $('adminContactsPrevButton');
  const next = $('adminContactsNextButton');
  const page = Number(pagination?.page || state.contacts.page);
  const pages = Number(pagination?.pages || 0);
  const total = Number(pagination?.total || 0);
  state.contacts.page = page;
  state.contacts.pages = pages;
  state.contacts.total = total;

  if (text) {
    text.textContent = total
      ? `Page ${page} of ${Math.max(pages, 1)} · ${total.toLocaleString('en-US')} message${total === 1 ? '' : 's'}`
      : 'No messages to display.';
  }
  if (prev) prev.disabled = page <= 1 || state.contacts.loading;
  if (next) next.disabled = pages === 0 || page >= pages || state.contacts.loading;
}

async function loadContacts() {
  if (state.contacts.loading) {
    state.contacts.reloadRequested = true;
    return;
  }
  state.contacts.loading = true;
  const refresh = $('adminContactsRefreshButton');
  const feedback = $('adminContactsFeedback');
  if (refresh) refresh.disabled = true;
  if (feedback) feedback.textContent = 'Loading support submissions…';
  renderContactsPagination({ page: state.contacts.page, pages: state.contacts.pages, total: state.contacts.total });

  const params = new URLSearchParams({
    page: String(state.contacts.page),
    limit: String(state.contacts.limit),
    status: state.contacts.status,
  });
  if (state.contacts.search) params.set('q', state.contacts.search);

  try {
    const payload = await apiRequest(`${ADMIN_CONFIG.CONTACTS_ENDPOINT}?${params.toString()}`);
    const data = payload?.data || {};
    renderContactCounts(data.counts || {});
    renderContacts(data.items || []);
    renderContactsPagination(data.pagination || {});
    if (feedback) feedback.textContent = '';
  } catch (error) {
    console.error('[BarakaLink][Admin] Contact inbox load failed:', error);
    if (error?.status === 401) {
      redirectToLogin();
      return;
    }
    if (feedback) feedback.textContent = error?.message || 'Support submissions could not be loaded.';
    renderContacts([]);
  } finally {
    state.contacts.loading = false;
    if (refresh) refresh.disabled = false;
    renderContactsPagination({
      page: state.contacts.page,
      pages: state.contacts.pages,
      total: state.contacts.total,
    });
    if (state.contacts.reloadRequested) {
      state.contacts.reloadRequested = false;
      loadContacts();
    }
  }
}

function openContactDetails(item) {
  if (!item || !item.id) return;
  state.selectedContact = item;

  const eyebrow = $('adminContactModalEyebrow');
  const title = $('adminContactModalTitle');
  const meta = $('adminContactModalMeta');
  const messageHeading = $('adminContactMessageHeading');
  const message = $('adminContactModalMessage');
  const subjectBox = $('adminContactSubjectBox');
  const subjectElement = $('adminContactModalSubject');
  const detailsBox = $('adminContactDetailsBox');
  const detailsElement = $('adminContactModalDetails');
  const status = $('adminContactDetailStatus');
  const call = $('adminContactCallLink');
  const name = [item.firstName, item.lastName].map((v) => safeString(v)).filter(Boolean).join(' ') || 'BarakaLink User';
  const messageType = safeString(item.messageType || 'contact').toLowerCase();
  const typeLabel = formatContactType(messageType);

  if (eyebrow) eyebrow.textContent = typeLabel;
  if (title) title.textContent = name;
  if (message) message.textContent = safeString(item.message, 'No message text provided.');
  if (messageHeading) {
    const headings = {
      report: 'What happened?',
      feedback: 'Feedback',
      question: 'Your question',
      contact: 'Message',
    };
    messageHeading.textContent = headings[messageType] || 'Message';
  }
  if (subjectBox) subjectBox.hidden = !safeString(item.subject);
  if (subjectElement) subjectElement.textContent = safeString(item.subject);
  if (detailsBox) detailsBox.hidden = !safeString(item.details);
  if (detailsElement) detailsElement.textContent = safeString(item.details);
  if (status) status.value = ['new', 'in_progress', 'resolved'].includes(safeString(item.status)) ? item.status : 'new';
  if (call) {
    const normalizedPhone = safeString(item.phone).replace(/[^+\d]/g, '');
    call.href = normalizedPhone ? `tel:${normalizedPhone}` : 'tel:';
    call.hidden = !normalizedPhone;
  }

  if (meta) {
    meta.replaceChildren();
    const details = [
      ['Submission type', typeLabel],
      ['Phone number', safeString(item.phone, 'Not supplied')],
      ['BarakaLink user ID', item.userId ? safeString(item.userId) : 'Guest submission (no account)'],
      ['Received', formatDate(item.createdAt)],
      ['Current status', formatContactStatus(item.status)],
    ];

    if (safeString(item.category)) details.splice(1, 0, ['Report category', formatSubmissionValue(item.category)]);
    if (safeString(item.kind)) details.splice(1, 0, ['Feedback type', formatSubmissionValue(item.kind)]);
    if (safeString(item.topic)) details.splice(1, 0, ['Question topic', formatSubmissionValue(item.topic)]);

    details.forEach(([label, value]) => {
      const wrap = document.createElement('div');
      wrap.className = 'admin-contact-detail-item';
      const labelElement = document.createElement('span');
      labelElement.textContent = label;
      const valueElement = document.createElement('strong');
      valueElement.textContent = value;
      wrap.append(labelElement, valueElement);
      meta.appendChild(wrap);
    });
  }

  const modal = $('adminContactModal');
  if (modal) {
    modal.hidden = false;
    document.body.classList.add('admin-modal-open');
    const closeButton = $('adminContactModalClose');
    if (closeButton) closeButton.focus();
  }
}

function formatSubmissionValue(value) {
  const normalized = safeString(value).replace(/[_-]+/g, ' ').trim();
  return normalized ? normalized.charAt(0).toUpperCase() + normalized.slice(1) : '—';
}
function closeContactDetails() {
  const modal = $('adminContactModal');

  if (modal) {
    modal.hidden = true;
  }

  state.selectedContact = null;
  syncAdminModalOpenState();
}

async function saveContactStatus(event) {
  event.preventDefault();
  const contact = state.selectedContact;
  const statusInput = $('adminContactDetailStatus');
  const saveButton = $('adminContactSaveStatusButton');
  if (!contact?.id || !statusInput) return;

  const nextStatus = safeString(statusInput.value).toLowerCase();
  if (!['new', 'in_progress', 'resolved'].includes(nextStatus)) {
    setAlert('Choose a valid contact message status.');
    return;
  }

  if (saveButton) saveButton.disabled = true;
  try {
    await apiRequest(`${ADMIN_CONFIG.CONTACTS_ENDPOINT}/${encodeURIComponent(contact.id)}`, {
      method: 'PATCH',
      body: { status: nextStatus },
    });
    closeContactDetails();
    setAlert('Contact message status updated.');
    await loadContacts();
  } catch (error) {
    console.error('[BarakaLink][Admin] Contact status update failed:', error);
    if (error?.status === 401) {
      redirectToLogin();
      return;
    }
    setAlert(error?.message || 'The contact message status could not be updated.');
  } finally {
    if (saveButton) saveButton.disabled = false;
  }
}

function setupContacts() {
  const search = $('adminContactSearch');
  const status = $('adminContactStatusFilter');
  const refresh = $('adminContactsRefreshButton');
  const prev = $('adminContactsPrevButton');
  const next = $('adminContactsNextButton');
  const form = $('adminContactStatusForm');
  const close = $('adminContactModalClose');

  let searchTimer = null;
  if (search) {
    search.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        state.contacts.search = safeString(search.value).slice(0, 100);
        state.contacts.page = 1;
        loadContacts();
      }, 250);
    });
  }
  if (status) {
    status.addEventListener('change', () => {
      state.contacts.status = safeString(status.value).toLowerCase() || 'all';
      state.contacts.page = 1;
      loadContacts();
    });
  }
  if (refresh) refresh.addEventListener('click', () => loadContacts());
  if (prev) prev.addEventListener('click', () => {
    if (state.contacts.page > 1) {
      state.contacts.page -= 1;
      loadContacts();
    }
  });
  if (next) next.addEventListener('click', () => {
    if (state.contacts.page < state.contacts.pages) {
      state.contacts.page += 1;
      loadContacts();
    }
  });
  if (form) form.addEventListener('submit', saveContactStatus);
  if (close) close.addEventListener('click', closeContactDetails);
  document.querySelectorAll('[data-admin-contact-modal-close]').forEach((element) => {
    element.addEventListener('click', closeContactDetails);
  });
  document.addEventListener('keydown', (event) => {
    const modal = $('adminContactModal');
    if (event.key === 'Escape' && modal && !modal.hidden) closeContactDetails();
  });
}

/* =========================================================
   ADMIN NOTIFICATIONS
========================================================= */
function setNotificationBadge(id, amount) {
  const element = $(id);
  if (!element) return;
  const count = Math.max(0, Number(amount || 0));
  element.hidden = count < 1;
  element.textContent = count > 99 ? '99+' : String(count);
  element.setAttribute('aria-label', `${count} unread notification${count === 1 ? '' : 's'}`);
}

function renderNotificationCounts(counts = {}) {
  const safeCounts = {
    total: Math.max(0, Number(counts.total || 0)),
    support: Math.max(0, Number(counts.support || 0)),
    parents: Math.max(0, Number(counts.parents || 0)),
    ustaz: Math.max(0, Number(counts.ustaz || 0)),
  };
  state.notifications.counts = safeCounts;

  setNotificationBadge('adminNotificationBadge', safeCounts.total);
  setNotificationBadge('adminNotificationsNavBadge', safeCounts.total);
  setNotificationBadge('adminUsersNavBadge', safeCounts.parents);
  setNotificationBadge('adminUstazNavBadge', safeCounts.ustaz);
  setNotificationBadge('adminSupportNavBadge', safeCounts.support);

  const summary = $('adminNotificationPopoverSummary');
  if (summary) {
    summary.textContent = safeCounts.total
      ? `${safeCounts.total.toLocaleString('en-US')} unread item${safeCounts.total === 1 ? '' : 's'}`
      : "You're all caught up.";
  }
  const cards = {
    adminNotificationsSupportCount: safeCounts.support,
    adminNotificationsParentsCount: safeCounts.parents,
    adminNotificationsUstazCount: safeCounts.ustaz,
  };
  Object.entries(cards).forEach(([id, count]) => {
    const element = $(id);
    if (element) element.textContent = count.toLocaleString('en-US');
  });
}

function notificationIconName(type) {
  const normalized = safeString(type).toLowerCase();
  if (normalized === 'parent') return 'fa-user-plus';
  if (normalized === 'ustaz') return 'fa-user-tie';
  return 'fa-envelope';
}

function renderNotificationList(container, items, compact = false) {
  if (!container) return;
  container.replaceChildren();

  const visibleItems = compact ? (Array.isArray(items) ? items.slice(0, 7) : []) : (Array.isArray(items) ? items : []);
  if (!visibleItems.length) {
    const empty = document.createElement('p');
    empty.className = 'admin-notifications-empty';
    empty.textContent = 'No notifications have been recorded yet.';
    container.appendChild(empty);
    return;
  }

  visibleItems.forEach((item) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `admin-notification-item${item.isRead ? '' : ' is-unread'}`;
    button.dataset.notificationId = safeString(item.id);

    const iconWrap = document.createElement('span');
    iconWrap.className = `admin-notification-item-icon is-${['parent', 'ustaz', 'support'].includes(item.type) ? item.type : 'support'}`;
    const icon = document.createElement('i');
    icon.className = `fa-solid ${notificationIconName(item.type)}`;
    icon.setAttribute('aria-hidden', 'true');
    iconWrap.appendChild(icon);

    const copy = document.createElement('span');
    copy.className = 'admin-notification-item-copy';

    const titleLine = document.createElement('span');
    titleLine.className = 'admin-notification-item-title-row';
    const title = document.createElement('strong');
    title.className = 'admin-notification-item-title';
    title.textContent = safeString(item.title, 'New activity');
    titleLine.appendChild(title);
    if (!item.isRead) {
      const dot = document.createElement('span');
      dot.className = 'admin-notification-unread-dot';
      dot.setAttribute('aria-label', 'Unread');
      titleLine.appendChild(dot);
    }

    const message = document.createElement('span');
    message.className = 'admin-notification-item-message';
    message.textContent = safeString(item.message, 'Open to review this activity.');

    const time = document.createElement('time');
    time.className = 'admin-notification-item-time';
    time.dateTime = safeString(item.createdAt);
    time.textContent = formatDate(item.createdAt);

    copy.append(titleLine, message, time);
    button.append(iconWrap, copy);
    button.addEventListener('click', () => openNotification(item));
    container.appendChild(button);
  });
}

function renderNotifications(items) {
  state.notifications.items = Array.isArray(items) ? items : [];
  renderNotificationList($('adminNotificationsList'), state.notifications.items, false);
  renderNotificationList($('adminNotificationPopoverList'), state.notifications.items, true);
}

function setNotificationStatus(message = '', target = 'both') {
  const text = safeString(message);
  if (target === 'both' || target === 'popover') {
    const popoverStatus = $('adminNotificationPopoverStatus');
    if (popoverStatus) popoverStatus.textContent = text;
  }
  if (target === 'both' || target === 'page') {
    const pageStatus = $('adminNotificationsStatus');
    if (pageStatus) pageStatus.textContent = text;
  }
}

async function loadNotifications(options = {}) {
  const silent = options.silent !== false;
  if (state.notifications.loading) {
    state.notifications.reloadRequested = true;
    return;
  }
  state.notifications.loading = true;

  try {
    const payload = await apiRequest(ADMIN_CONFIG.NOTIFICATIONS_ENDPOINT);
    const data = payload?.data || {};
    state.notifications.readThrough = data.readThrough || null;
    renderNotificationCounts(data.counts || {});
    renderNotifications(data.items || []);
    setNotificationStatus('');
  } catch (error) {
    console.error('[BarakaLink][Admin] Notifications load failed:', error);
    if (error?.status === 401) {
      redirectToLogin();
      return;
    }
    if (!silent) {
      setNotificationStatus(error?.message || 'Notifications could not be loaded.');
    }
  } finally {
    state.notifications.loading = false;
    if (state.notifications.reloadRequested) {
      state.notifications.reloadRequested = false;
      window.setTimeout(() => loadNotifications({ silent: true }), 0);
    }
  }
}

function closeNotificationPopover() {
  const popover = $('adminNotificationPopover');
  const button = $('adminNotificationButton');
  if (popover) popover.hidden = true;
  if (button) button.setAttribute('aria-expanded', 'false');
}

function markNotificationReadLocally(notificationId) {
  const target = state.notifications.items.find((entry) => entry.id === notificationId);
  if (!target || target.isRead) return;

  target.isRead = true;
  const counts = { ...state.notifications.counts };
  counts.total = Math.max(0, counts.total - 1);
  if (target.type === 'support') counts.support = Math.max(0, counts.support - 1);
  if (target.type === 'parent') counts.parents = Math.max(0, counts.parents - 1);
  if (target.type === 'ustaz') counts.ustaz = Math.max(0, counts.ustaz - 1);

  renderNotificationCounts(counts);
  renderNotifications(state.notifications.items);
}

async function openNotification(item) {
  const validSections = new Set(['users', 'ustaz', 'support']);
  const section = validSections.has(item.targetSection) ? item.targetSection : 'notifications';
  const navButton = document.querySelector(`[data-admin-section="${section}"]`);

  try {
    await apiRequest(`${ADMIN_CONFIG.NOTIFICATIONS_ENDPOINT}/read-one`, {
      method: 'POST',
      body: { id: item.id },
    });
    markNotificationReadLocally(item.id);
    // Reload server counts after saving the individual read state.
    await loadNotifications({ silent: true });
  } catch (error) {
    console.error('[BarakaLink][Admin] Mark notification read failed:', error);
    if (error?.status === 401) {
      redirectToLogin();
      return;
    }
    setNotificationStatus(error?.message || 'This notification could not be marked as read.');
  }

  if (navButton) navButton.click();
  closeNotificationPopover();
}

async function markNotificationsRead() {
  const mainButton = $('adminNotificationsMarkReadButton');
  const popoverButton = $('adminNotificationPopoverMarkRead');
  if (!state.notifications.readThrough) {
    await loadNotifications({ silent: false });
  }
  if (!state.notifications.readThrough) return;

  [mainButton, popoverButton].forEach((button) => {
    if (button) button.disabled = true;
  });
  setNotificationStatus('Marking notifications as read…');

  try {
    await apiRequest(`${ADMIN_CONFIG.NOTIFICATIONS_ENDPOINT}/read`, {
      method: 'POST',
      body: { seenThrough: state.notifications.readThrough },
    });
    await loadNotifications({ silent: false });
    setNotificationStatus('Notifications marked as read.');
  } catch (error) {
    console.error('[BarakaLink][Admin] Mark notifications read failed:', error);
    if (error?.status === 401) {
      redirectToLogin();
      return;
    }
    setNotificationStatus(error?.message || 'Notifications could not be marked as read.');
  } finally {
    [mainButton, popoverButton].forEach((button) => {
      if (button) button.disabled = false;
    });
  }
}

function setupNotifications() {
  const bell = $('adminNotificationButton');
  const popover = $('adminNotificationPopover');
  const wrap = $('adminNotificationWrap');
  const markReadButton = $('adminNotificationsMarkReadButton');
  const popoverMarkReadButton = $('adminNotificationPopoverMarkRead');
  const refreshButton = $('adminNotificationsRefreshButton');
  const viewAllButton = $('adminNotificationViewAll');

  if (bell && popover) {
    bell.addEventListener('click', () => {
      const opening = popover.hidden;
      popover.hidden = !opening;
      bell.setAttribute('aria-expanded', opening ? 'true' : 'false');
      if (opening) loadNotifications({ silent: true });
    });
  }
  if (markReadButton) markReadButton.addEventListener('click', markNotificationsRead);
  if (popoverMarkReadButton) popoverMarkReadButton.addEventListener('click', markNotificationsRead);
  if (refreshButton) refreshButton.addEventListener('click', () => loadNotifications({ silent: false }));
  if (viewAllButton) {
    viewAllButton.addEventListener('click', () => {
      const navButton = document.querySelector('[data-admin-section="notifications"]');
      if (navButton) navButton.click();
      closeNotificationPopover();
    });
  }

  document.addEventListener('click', (event) => {
    if (wrap && !wrap.contains(event.target)) closeNotificationPopover();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeNotificationPopover();
  });

  loadNotifications({ silent: true });
  state.notifications.pollTimer = window.setInterval(() => {
    if (!document.hidden) loadNotifications({ silent: true });
  }, 30000);
}

function setupNavigation() {
  const items = Array.from(document.querySelectorAll('[data-admin-section]'));
  const panels = Array.from(document.querySelectorAll('[data-admin-panel]'));

  items.forEach((item) => {
    item.addEventListener('click', () => {
      const section = item.dataset.adminSection;
      items.forEach((other) => other.classList.toggle('is-active', other === item));
      panels.forEach((panel) => panel.classList.toggle('is-visible', panel.dataset.adminPanel === section));

      const title = $('adminPageTitle');
      if (title) {
        const labels = {
          dashboard: 'Dashboard', notifications: 'Notifications', users: 'Users', ustaz: 'Ustaz Profiles',
          reports: 'Reports', support: 'Support',  mosques: 'Mosques', audit: 'Audit Log',
        };
        title.textContent = labels[section] || 'Dashboard';
      }

      if (section === 'notifications') loadNotifications({ silent: false });
      if (section === 'users') loadUsers();
      if (section === 'ustaz') loadUstazProfiles();
      if (section === 'support') loadContacts();
if (section === 'mosques') loadMosques();
      const sidebar = $('adminSidebar');
      const menuButton = $('adminMenuButton');
      if (sidebar) sidebar.classList.remove('is-open');
      if (menuButton) menuButton.setAttribute('aria-expanded', 'false');
    });
  });
}

function getInitialTheme() {
  try {
    const stored = localStorage.getItem(ADMIN_CONFIG.THEME_KEY);
    if (stored === 'dark' || stored === 'light') return stored;
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
  } catch {
    // Ignore storage/media errors.
  }
  return 'light';
}

function updateThemeButton() {
  const button = $('adminThemeToggle');
  if (!button) return;
  const dark = document.body.classList.contains('admin-dark');
  const icon = button.querySelector('i');
  if (icon) icon.className = dark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
  button.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
  const meta = $('adminThemeColorMeta');
  if (meta) meta.setAttribute('content', dark ? '#17130F' : '#FBF7EE');
}

function applyTheme(theme) {
  const dark = theme === 'dark';
  document.body.classList.toggle('admin-dark', dark);
  try { localStorage.setItem(ADMIN_CONFIG.THEME_KEY, dark ? 'dark' : 'light'); } catch {}
  updateThemeButton();
}

function setupTheme() {
  applyTheme(getInitialTheme());
  const button = $('adminThemeToggle');
  if (!button) return;
  button.addEventListener('click', () => {
    applyTheme(document.body.classList.contains('admin-dark') ? 'light' : 'dark');
  });
}

function setupMobileMenu() {
  const button = $('adminMenuButton');
  const sidebar = $('adminSidebar');
  if (!button || !sidebar) return;
  button.addEventListener('click', () => {
    const open = sidebar.classList.toggle('is-open');
    button.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
}

function setupRefresh() {
  const button = $('adminRefreshButton');
  if (button) button.addEventListener('click', loadDashboard);
}

function setupLogout() {
  const button = $('adminLogoutButton');
  if (!button) return;
  button.addEventListener('click', async () => {
    const token = getToken();
    try {
      if (token) {
        await fetch(`${ADMIN_CONFIG.API_BASE}/admin/auth/logout`, {
          method: 'POST',
          headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
          credentials: 'include',
          cache: 'no-store',
        });
      }
    } catch {}
    redirectToLogin();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  setupTheme();
  setupNavigation();
  setupMobileMenu();
  setupRefresh();
  setupLogout();
  setupUsers();
  setupUstazProfiles();
  setupContacts();
  setupMosques();
  setupNotifications();
  updateUstazPagination();
  loadDashboard();
  updateUsersPagination();
});
