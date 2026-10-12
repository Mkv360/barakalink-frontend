"use strict";

/* =========================================================
   BARAKALINK STUDENT DASHBOARD HOME

   Home rendering and the dashboard profile-data reload
   composition live here. Feature renderers remain in their
   dedicated modules.
========================================================= */

import { state } from "./student-state.js";

import {
  renderNames,
  renderAvatars,
  renderSummary,
  loadProfile,
  loadPreferences,
} from "./student-profile.js";

import {
  enforceParentRole,
  enforceAccountStatus,
  enforceProfileCompletion,
} from "./student-auth.js";

import {
  renderSavedTeachers,
} from "./student-teachers.js";

import {
  renderNotifications,
} from "./student-notifications.js";


/* =========================================================
   DASHBOARD RENDER
========================================================= */

export function renderDashboard() {

  renderNames();

  renderAvatars();

  renderSummary();

  renderSavedTeachers();

  renderNotifications();

}


/* =========================================================
   DASHBOARD DATA
========================================================= */

export async function reloadDashboardData() {

  const [
    profile,
    preferences,
  ] = await Promise.all([

    loadProfile(),

    loadPreferences(),

  ]);


  /* -------------------------------------------------------
     PROFILE VALIDATION
  ------------------------------------------------------- */

  enforceParentRole();

  enforceAccountStatus();

  enforceProfileCompletion();


  /* -------------------------------------------------------
     STATE
  ------------------------------------------------------- */

  state.profile =
    profile;

  state.preferences =
    preferences;


  /* -------------------------------------------------------
     RENDER
  ------------------------------------------------------- */

  renderDashboard();


  return {

    profile,

    preferences,

  };

}