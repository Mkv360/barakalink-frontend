"use strict";

/* =========================================================
   BARAKALINK — STUDENT / PARENT DASHBOARD ENTRY POINT

   This is the only application entry module.
========================================================= */

/* =========================================================
   PAGE LOADER

   student-loader.js is a self-initializing plain script with
   no exports, so it is imported for its side effects only.
   The module system evaluates it once per page, and the
   script guards itself with data-bl-loader-ready.

   Keep this as the FIRST import so the loader's `hidden`
   bridge is installed before student-core.js or the code
   below can call showPageLoading() / hidePageLoading().
========================================================= */

import "./student-loader.js";
import "./student-help-settings.js";
import {
  $,
  showGlobalError,
  hideGlobalError,
  showPageLoading,
  hidePageLoading,
} from "./student-core.js";

import {
  state,
  getStateSnapshot,
} from "./student-state.js";

import {
  getAuthToken,
  clearSession,
  redirectToLogin,
} from "./student-auth.js";

import {
  reloadDashboardData,
} from "./student-home.js";

import {
  createStudentNotificationCenter,
} from "./notifications/notification-center.js";

import {
  setupSectionNavigation,
  showSection,
} from "./student-navigation.js";

import {
  setupMobileSidebar,
  closeMobileSidebar,
  closeProfileMenu,
  setupProfileMenu,
} from "./student-sidebar.js";

import {
  setupTheme,
} from "./student-theme.js";

import {
  setupTeacherFilters,
  setupTeacherSearch,
  setupTeacherSort,
  setupSavedSection,
  renderTeacherResults,
  loadTeachers,
  resetTeacherDiscovery,
  runTeacherDiscovery,
  setTeachers,
  renderSavedTeachers,
} from "./student-teachers.js";

import {
  setupContentCards,
} from "./student-content.js";

import {
  initializeStudentMessaging,
} from "./student-message.js";

import {
  initializeStudentSupportUI,
} from "./student-support.js";

import {
  initializeCurrentUserLocation,
  refreshCurrentUserLocation,
} from "./location.js";

/* =========================================================
   INITIALIZATION STATE
========================================================= */

let initializationPromise =
  null;

let dashboardInteractionSetup =
  false;

let studentNotificationCenter =
  null;


/* =========================================================
   AUTH / LOGOUT
========================================================= */

function performLogout() {
  clearSession();

  window.location.href =
    "../index.html";
}


function setupLogout() {
  const sidebarLogout =
    $("studentSidebarLogout");

  const menuLogout =
    $("studentMenuLogout");

  if (sidebarLogout) {
    sidebarLogout.addEventListener(
      "click",
      performLogout
    );
  }

  if (menuLogout) {
    menuLogout.addEventListener(
      "click",
      performLogout
    );
  }
}


/* =========================================================
   RETRY
========================================================= */

function setupRetry() {
  const button =
    $("studentPageRetry");

  if (button) {
    button.addEventListener(
      "click",
      initializeDashboard
    );
  }

  const teacherRetry =
    $("studentTeacherRetry");

  if (teacherRetry) {
    teacherRetry.addEventListener(
      "click",
      async () => {
        resetTeacherDiscovery();

        await loadTeachers();
      }
    );
  }
}


/* =========================================================
   NOTIFICATION PANEL COMPATIBILITY WRAPPER
========================================================= */

/*
 * Existing Student dashboard modules still expect a
 * closeNotificationPanel() callback.
 *
 * The old notification module has been replaced by the
 * shared NotificationCenter, so this wrapper keeps the
 * existing navigation/sidebar/profile behavior unchanged.
 */
function closeNotificationPanel() {
  if (
    studentNotificationCenter &&
    typeof studentNotificationCenter.close ===
      "function"
  ) {
    studentNotificationCenter.close();
  }
}


/* =========================================================
   GLOBAL SHELL INTERACTION
========================================================= */

function setupGlobalInteraction() {
  document.addEventListener(
    "click",
    event => {
      const target =
        event.target;

      if (
        !(target instanceof Element)
      ) {
        return;
      }


      /* ---------------------------------------------------
         PROFILE MENU
      --------------------------------------------------- */

      const profileButton =
        $("studentAvatarButton");

      const profileMenu =
        $("studentProfileMenu");

      if (
        profileMenu &&
        profileButton &&
        !profileMenu.contains(target) &&
        !profileButton.contains(target)
      ) {
        closeProfileMenu();
      }


      /* ---------------------------------------------------
         NOTIFICATION PANEL
      --------------------------------------------------- */

      const notificationButton =
        $("studentNotificationButton");

      const notificationPanel =
        $("studentNotificationPanel");

      if (
        notificationPanel &&
        notificationButton &&
        !notificationPanel.contains(target) &&
        !notificationButton.contains(target)
      ) {
        closeNotificationPanel();
      }
    }
  );
}


/* =========================================================
   RESIZE HANDLING
========================================================= */

function setupResizeHandling() {
  window.addEventListener(
    "resize",
    () => {
      if (
        window.innerWidth >
        768
      ) {
        closeMobileSidebar();
      }
    }
  );
}


/* =========================================================
   LOCATION
========================================================= */

/*
 * Location is deliberately separate from the dashboard
 * business logic.
 *
 * The actual implementation lives in:
 *
 *   frontend/js/location.js
 *
 * Both parent and Ustaz use:
 *
 *   PATCH /api/location
 *
 * No exact coordinates are rendered into the UI.
 */
function initializeStudentLocation() {
  void initializeCurrentUserLocation()
    .then(
      (result) => {
        if (result?.ok) {
          console.info(
            "[BarakaLink][Student][location] Location updated successfully.",
            {
              accuracy:
                result.location?.accuracy,
            }
          );

          return;
        }

        console.warn(
          "[BarakaLink][Student][location] Location update skipped.",
          result?.error
        );
      }
    )
    .catch(
      (error) => {
        /*
         * Defensive fallback.
         *
         * A location failure must never prevent the
         * student dashboard from loading.
         */
        console.warn(
          "[BarakaLink][Student][location] Location initialization failed.",
          error
        );
      }
    );
}


/*
 * Fresh location used immediately before teacher discovery.
 *
 * This is important because the teacher-discovery endpoint
 * calculates distance from the parent's stored location.
 */
async function refreshStudentLocation() {
  const result =
    await refreshCurrentUserLocation();

  if (
    !result?.ok
  ) {
    console.warn(
      "[BarakaLink][Student][location] Fresh location unavailable.",
      result?.error
    );
  }

  return result;
}


/* =========================================================
   POST-LOAD SETUP
========================================================= */

function setupDashboardAfterLoad() {
  if (
    dashboardInteractionSetup
  ) {
    return;
  }

  dashboardInteractionSetup =
    true;


  /* -------------------------------------------------------
     NOTIFICATIONS
  ------------------------------------------------------- */

  /*
   * Create the shared Student / Parent notification center.
   *
   * This replaces the old student-notifications.js setup.
   *
   * Existing dashboard modules can still use
   * closeNotificationPanel() through the compatibility
   * wrapper above.
   */
  studentNotificationCenter =
    createStudentNotificationCenter({
      closeOtherPanel:
        closeProfileMenu,
    });

  /*
   * Start shared notification polling.
   */
  studentNotificationCenter.startPolling();


  /* -------------------------------------------------------
     NAVIGATION
  ------------------------------------------------------- */

  setupSectionNavigation({
    closeProfileMenu,

    closeNotificationPanel,

    closeMobileSidebar,

    onTeachersOpen:
    async () => {

      /*
       * Load teachers immediately.
       *
       * Do NOT wait for browser GPS here.
       */
      await runTeacherDiscovery();

      /*
       * Ask for a fresher location in the background.
       *
       * If a better location arrives later, Find Ustaz can be
       * refreshed separately without blocking the first render.
       */
      refreshStudentLocation()
        .then(() => {
          console.info(
            "[BarakaLink][Student][location] Background refresh completed."
          );
        })
        .catch((locationError) => {
          console.warn(
            "[BarakaLink][Student][location] Background refresh failed.",
            locationError
          );
        });

    },
  });


  /* -------------------------------------------------------
     SIDEBAR
  ------------------------------------------------------- */

  setupMobileSidebar({
    closeProfileMenu,

    closeNotificationPanel,
  });


  /* -------------------------------------------------------
     THEME
  ------------------------------------------------------- */

  setupTheme();


  /* -------------------------------------------------------
     PROFILE MENU
  ------------------------------------------------------- */

  setupProfileMenu({
    closeNotificationPanel,
  });


  /* -------------------------------------------------------
     TEACHERS
  ------------------------------------------------------- */

  setupTeacherFilters({
    showSection,

    closeMobileSidebar,
  });

  setupTeacherSearch();

  setupTeacherSort();

  setupSavedSection();


  /* -------------------------------------------------------
     CONTENT
  ------------------------------------------------------- */

  setupContentCards();


  /* -------------------------------------------------------
     LOGOUT / RETRY / GLOBAL EVENTS
  ------------------------------------------------------- */

  setupLogout();

  setupRetry();

  setupGlobalInteraction();

  setupResizeHandling();


  /* -------------------------------------------------------
     INITIAL TEACHER STATE
  ------------------------------------------------------- */

  renderTeacherResults();
}


/* =========================================================
   PROFILE / DASHBOARD INITIALIZATION
========================================================= */

export async function initializeDashboard() {
  if (
    initializationPromise
  ) {
    return initializationPromise;
  }

  initializationPromise =
    (async () => {
      showPageLoading();

      hideGlobalError();

      try {
        /* =================================================
           AUTHENTICATION
        ================================================= */

        const token =
          getAuthToken();

        if (!token) {
          redirectToLogin();
          return;
        }


        /* =================================================
           PROFILE / DASHBOARD DATA
        ================================================= */

        await reloadDashboardData();


        /* =================================================
           PARENT LOCATION

           Start location only after the authenticated
           dashboard profile has loaded successfully.

           This is non-blocking.
        ================================================= */

        initializeStudentLocation();


        /* =================================================
           NOTIFICATIONS

           NotificationCenter is initialized inside
           setupDashboardAfterLoad() so it is created once
           alongside the rest of the dashboard shell.
        ================================================= */


        /* =================================================
           INTERACTIONS
        ================================================= */

        try {
          setupDashboardAfterLoad();
        } catch (setupError) {
          console.error(
            "[student.js] Dashboard interaction setup failed:",
            setupError
          );
        }


        hideGlobalError();
      } catch (error) {
        console.error(
          "[student.js] Dashboard initialization failed:",
          error
        );

        if (
          error?.code ===
            "UNAUTHORIZED" ||
          error?.status === 401
        ) {
          redirectToLogin();
          return;
        }

        if (
          error?.code ===
          "NO_TOKEN"
        ) {
          redirectToLogin();
          return;
        }

        showGlobalError(
          error?.message ||
            "We could not load your BarakaLink dashboard."
        );
      } finally {
        hidePageLoading();

        initializationPromise =
          null;
      }
    })();

  return initializationPromise;
}


/* =========================================================
   RELOAD PROFILE
========================================================= */

export async function reloadProfile() {
  return reloadDashboardData();
}


/* =========================================================
   REQUIRED PUBLIC API
========================================================= */

const publicDashboardApi = {
  reload:
    initializeDashboard,

  reloadProfile,

  setTeachers,

  getState:
    getStateSnapshot,
};

window.BarakaLinkStudentDashboard =
  publicDashboardApi;


/* =========================================================
   DOM READY
========================================================= */

/*
 * Original intended order:
 *
 * 1. messaging initializer
 * 2. dashboard initializer
 * 3. support/coming-soon initializer
 *
 * Location is now initialized as part of authenticated
 * dashboard startup rather than before authentication.
 */

async function handleDomReady() {
  initializeStudentMessaging();

  initializeDashboard();

  initializeStudentSupportUI();
}


if (
  document.readyState ===
  "loading"
) {
  document.addEventListener(
    "DOMContentLoaded",
    handleDomReady,
    {
      once: true,
    }
  );
} else {
  handleDomReady();
}


/* =========================================================
   EXPORT
========================================================= */

export {
  publicDashboardApi,
};