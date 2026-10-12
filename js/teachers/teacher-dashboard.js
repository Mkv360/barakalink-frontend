"use strict";

/* =========================================================
   BARAKALINK — USTAZ DASHBOARD RENDERER
========================================================= */

import {
  mountAllAvatars,
  renderAccountDetails,
  renderAvailability,
  renderLanguages,
  renderQualifications,
  renderSubjects,
  renderSummary,
  renderTrustStatus,
} from "./teacher-profile.js";

import {
  renderProfileRecitation,
  renderRecitation,
} from "./teacher-recitation.js";


/* =========================================================
   RENDER DASHBOARD
========================================================= */

function renderDashboard() {

  renderAccountDetails();

  renderSummary();

  renderSubjects();

  renderLanguages();

  renderAvailability();

  renderQualifications();

  renderRecitation();

  renderProfileRecitation();

  mountAllAvatars();

  renderTrustStatus();

}


/* =========================================================
   EXPORT
========================================================= */

export {
  renderDashboard,
};