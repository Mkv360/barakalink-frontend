'use strict';

import { safeString } from './student-utils.js';

/* =========================================================
   BARAKALINK STUDENT DASHBOARD CORE

   Foundational shared configuration, DOM helpers, and
   dashboard-level loading/error helpers.
   Feature logic belongs in feature modules.
========================================================= */

export function getApiBase() {
  return String(
    window.BarakaLinkAPI?.base ||
    window.BARAKALINK_API_BASE ||
    (
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname === '::1'
        ? 'http://localhost:5000/api'
        : `http://${window.location.hostname}:5000/api`
    )
  ).replace(/\/+$/, '');
}
export const STUDENT_CONFIG = Object.freeze({
  /*
   * api.js is the single source of truth for the API base.
   * The getter keeps lookup lazy so the legacy global api.js
   * can finish loading before any request is made.
   */
  get API_BASE() {
    return getApiBase();
  },

  TOKEN_KEYS: [
    'barakalink_token',
    'token',
    'access_token',
  ],

  TEACHERS_ENDPOINT:
    window.BARAKALINK_TEACHERS_ENDPOINT ||
    '/teachers',

  NOTIFICATIONS_ENDPOINT:
    window.BARAKALINK_NOTIFICATIONS_ENDPOINT ||
    null,

  THEME_KEY:
    'barakalink_theme',

  MAX_NOTIFICATIONS:
    30,
});
export const $ = (id) => document.getElementById(id);

export const $$ = (selector, root = document) =>
  Array.from(root.querySelectorAll(selector));

export function exists(element) {
  return Boolean(element);
}


export function showGlobalError(message) {

  const errorPanel =
    $('studentPageError');

  const errorMessage =
    $('studentPageErrorMessage');


  if (exists(errorMessage)) {
    errorMessage.textContent =
      safeString(
        message,
        'We could not load your dashboard.'
      );
  }


  if (exists(errorPanel)) {
    errorPanel.hidden = false;
  }

}


export function hideGlobalError() {

  const errorPanel =
    $('studentPageError');

  if (exists(errorPanel)) {
    errorPanel.hidden = true;
  }

}


export function showPageLoading() {

  const loading =
    $('studentPageLoading');

  if (exists(loading)) {
    loading.hidden = false;
  }

}


export function hidePageLoading() {

  const loading =
    $('studentPageLoading');

  if (exists(loading)) {
    loading.hidden = true;
  }

}


export function setText(
  id,
  value
) {

  const element =
    $(id);

  if (!element) {
    return;
  }

  element.textContent =
    safeString(value);

}
