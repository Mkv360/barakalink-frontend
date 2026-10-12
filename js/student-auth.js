'use strict';

/* =========================================================
   BARAKALINK STUDENT DASHBOARD AUTHENTICATION
========================================================= */

import { STUDENT_CONFIG } from './student-core.js';
import { state } from './student-state.js';
import { safeString, capitalizeWords } from './student-utils.js';

export function getAuthToken() {

  /*
   * Prefer the shared BarakaLinkAPI token helper so the dashboard
   * uses exactly the same authentication source as login and the
   * profile-completion page.
   */
  if (
    window.BarakaLinkAPI &&
    typeof window.BarakaLinkAPI.getToken === 'function'
  ) {

    const sharedToken =
      window.BarakaLinkAPI.getToken();

    if (sharedToken) {
      return sharedToken;
    }

  }


  for (const key of STUDENT_CONFIG.TOKEN_KEYS) {

    const token =
      localStorage.getItem(key);

    if (token) {
      return token;
    }

  }


  return null;

}


export function clearSession() {

  for (const key of STUDENT_CONFIG.TOKEN_KEYS) {
    localStorage.removeItem(key);
  }

  /*
   * These are harmless to remove if present.
   * The current BarakaLink auth flow stores the JWT
   * primarily under barakalink_token.
  */

  localStorage.removeItem('barakalink_user');

}


export function redirectToLogin() {

  clearSession();

  window.location.href =
    '../index.html';

}


export function redirectToProfileCompletion() {

  window.location.href =
    '../profile-completion.html';

}


export function redirectToUstazDashboard() {

  /*
   * student.html is inside dashboard/,
   * so teacher.html is beside it.
  */

  window.location.href =
    './teacher.html';

}


export function enforceParentRole() {

  const role =
    safeString(
      state.profile?.role
    ).toLowerCase();


  if (!role) {

    throw new Error(
      'Your account role could not be determined.'
    );

  }


  if (role === 'ustaz') {

    redirectToUstazDashboard();

    return false;

  }


  if (role !== 'parent') {

    throw new Error(
      'This dashboard is only available to parent accounts.'
    );

  }


  return true;

}


export function enforceProfileCompletion() {

  const completed =
    Boolean(
      state.profile?.profileCompleted
    );


  if (!completed) {

    redirectToProfileCompletion();

    return false;

  }


  return true;

}


export function enforceAccountStatus() {

  const status =
    safeString(
      state.profile?.accountStatus
    ).toLowerCase();


  /*
   * The backend currently creates verified registration
   * accounts with an active account status.

   * If another status is returned, let the user see a
   * clear message rather than pretending the account works.
  */

  if (
    status &&
    status !== 'active'
  ) {

    throw new Error(
      `This account is currently ${capitalizeWords(status)}.`
    );

  }


  return true;

}
