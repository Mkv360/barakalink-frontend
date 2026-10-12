'use strict';

const ADMIN_LOGIN_CONFIG = Object.freeze({
  API_BASE: String(
    window.BARAKALINK_API_BASE ||
    window.BarakaLinkAPI?.base ||
    'http://localhost:5000/api'
  ).replace(/\/+$/, ''),
  LOGIN_ENDPOINT: '/admin/auth/login',
  TOKEN_KEYS: ['barakalink_admin_token'],
  THEME_KEY: 'barakalink_theme',
  DASHBOARD_PATH: './admin.html',
});

const $ = (id) => document.getElementById(id);

function cleanString(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  const result = String(value).trim();
  return result || fallback;
}

function setStatus(message = '', type = '') {
  const element = $('adminLoginStatus');
  if (!element) return;
  element.textContent = cleanString(message);
  element.dataset.status = type;
}

function clearFieldErrors() {
  ['adminEmailError', 'adminPasswordError'].forEach((id) => {
    const element = $(id);
    if (element) element.textContent = '';
  });
}

function setFieldError(id, message) {
  const element = $(id);
  if (element) element.textContent = message;
}

function clearExistingSession() {
  try {
    ADMIN_LOGIN_CONFIG.TOKEN_KEYS.forEach((key) => localStorage.removeItem(key));
    localStorage.removeItem('barakalink_admin');
  } catch (_) {}
}

function storeToken(token) {
  const value = cleanString(token);
  if (!value) return false;
  try {
    localStorage.setItem('barakalink_admin_token', value);
  } catch (_) {
    return false;
  }
  return true;
}

function getPayloadToken(payload) {
  return cleanString(
    payload?.data?.token ??
    payload?.data?.accessToken ??
    payload?.accessToken ??
    payload?.token
  );
}

function getPayloadUser(payload) {
  return (
    payload?.data?.admin ??
    payload?.admin ??
    payload?.data?.user ??
    payload?.user ??
    null
  );
}

function getUserRole(user, payload) {
  return cleanString(
    user?.role ??
    user?.accountRole ??
    user?.account_role ??
    payload?.data?.role ??
    payload?.role
  ).toLowerCase();
}

function getAccountStatus(user, payload) {
  return cleanString(
    user?.accountStatus ??
    user?.account_status ??
    payload?.data?.accountStatus ??
    payload?.accountStatus
  ).toLowerCase();
}

async function login(email, password) {
  let response;

  try {
    response = await fetch(
      `${ADMIN_LOGIN_CONFIG.API_BASE}${ADMIN_LOGIN_CONFIG.LOGIN_ENDPOINT}`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        cache: 'no-store',
        body: JSON.stringify({
          identifier: email,
          email,
          password,
        }),
      }
    );
  } catch (error) {
    const networkError = new Error('Unable to connect to the BarakaLink server.');
    networkError.code = 'NETWORK_ERROR';
    networkError.originalError = error;
    throw networkError;
  }

  const raw = await response.text();
  let payload = {};

  try {
    payload = raw ? JSON.parse(raw) : {};
  } catch (_) {
    payload = { message: raw || `Request failed with HTTP ${response.status}.` };
  }

  if (!response.ok) {
    const error = new Error(
      cleanString(payload?.message ?? payload?.error, `Login failed with HTTP ${response.status}.`)
    );
    error.status = response.status;
    error.code = cleanString(payload?.code);
    error.payload = payload;
    throw error;
  }

  return payload;
}

function getInitialTheme() {
  try {
    const stored = localStorage.getItem(ADMIN_LOGIN_CONFIG.THEME_KEY);
    if (stored === 'dark' || stored === 'light') return stored;
    if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark';
  } catch (_) {}
  return 'light';
}

function applyTheme(theme) {
  const dark = theme === 'dark';
  document.body.classList.toggle('admin-dark', dark);
  document.body.classList.toggle('dark-theme', dark);
  document.documentElement.classList.toggle('admin-dark', dark);

  const button = $('adminLoginThemeToggle');
  const icon = button?.querySelector('i');
  if (icon) icon.className = dark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
  if (button) button.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');

  const meta = $('adminLoginThemeColorMeta');
  if (meta) meta.setAttribute('content', dark ? '#17130F' : '#FBF7EE');

  try { localStorage.setItem(ADMIN_LOGIN_CONFIG.THEME_KEY, dark ? 'dark' : 'light'); } catch (_) {}
}

function setupTheme() {
  applyTheme(getInitialTheme());
  $('adminLoginThemeToggle')?.addEventListener('click', () => {
    const isDark = document.body.classList.contains('admin-dark');
    applyTheme(isDark ? 'light' : 'dark');
  });
}

function setupPasswordToggle() {
  document.querySelectorAll('[data-password]').forEach((button) => {
    button.addEventListener('click', () => {
      const target = $(button.dataset.password);
      if (!target) return;
      const show = target.type === 'password';
      target.type = show ? 'text' : 'password';
      const icon = button.querySelector('i');
      if (icon) icon.className = show ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';
      button.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
    });
  });
}

async function handleSubmit(event) {
  event.preventDefault();
  clearFieldErrors();
  setStatus('');

  const email = cleanString($('adminEmail')?.value).toLowerCase();
  const password = cleanString($('adminPassword')?.value);

  let valid = true;

  if (!email) {
    setFieldError('adminEmailError', 'Admin email is required.');
    valid = false;
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    setFieldError('adminEmailError', 'Enter a valid email address.');
    valid = false;
  }

  if (!password) {
    setFieldError('adminPasswordError', 'Password is required.');
    valid = false;
  }

  if (!valid) return;

  const submit = $('adminLoginSubmit');
  if (submit) submit.disabled = true;
  setStatus('Signing in securely…');
  clearExistingSession();

  try {
    const payload = await login(email, password);
    const token = getPayloadToken(payload);
    const user = getPayloadUser(payload);
    const role = getUserRole(user, payload) || 'admin';
    const status = getAccountStatus(user, payload) || 'active';

    if (!token) {
      throw new Error('The server did not return an authentication token.');
    }

    if (role && role !== 'admin') {
      throw Object.assign(new Error('This account is not an administrator.'), { code: 'ADMIN_REQUIRED', status: 403 });
    }

    if (status && status !== 'active') {
      throw Object.assign(new Error('This administrator account is not active.'), { code: 'ADMIN_INACTIVE', status: 403 });
    }

    if (!storeToken(token)) {
      throw new Error('Unable to save the administrator session in this browser.');
    }

    try {
      if (user) localStorage.setItem('barakalink_admin', JSON.stringify(user));
    } catch (_) {}

    setStatus('Admin sign in successful. Opening dashboard…', 'success');
    window.location.replace(ADMIN_LOGIN_CONFIG.DASHBOARD_PATH);
  } catch (error) {
    console.error('[BarakaLink][Admin Login]', error);

    if (error?.status === 401) {
      setStatus(error.message || 'Incorrect admin email or password.', 'error');
    } else if (error?.status === 403 || error?.code === 'ADMIN_REQUIRED' || error?.code === 'ADMIN_INACTIVE') {
      setStatus(error.message || 'Admin access is required for this page.', 'error');
    } else if (error?.code === 'NETWORK_ERROR') {
      setStatus(error.message, 'error');
    } else {
      setStatus(error?.message || 'Admin sign in failed.', 'error');
    }
  } finally {
    if (submit) submit.disabled = false;
  }
}

function init() {
  setupTheme();
  setupPasswordToggle();
  $('adminLoginForm')?.addEventListener('submit', handleSubmit);
  $('adminEmail')?.focus();
}

document.addEventListener('DOMContentLoaded', init);
