
"use strict";

/* =========================================================
   BARAKALINK — TEACHER / USTAZ DASHBOARD ENTRY POINT
========================================================= */

import {
  loadProfile,
} from "./teacher-api.js";

import {
  getToken,
  redirectToLogin,
  redirectToProfile,
} from "./teacher-auth.js";

import {
  setupDashboardMessages,
} from "./teacher-chat.js";

import {
  renderDashboard,
} from "./teacher-dashboard.js";

import {
  $,
  closeProfileMenu,
  hideError,
  showError,
  showLoading,
} from "./teacher-dom.js";

import {
  setSection,
  setupGlobalInteraction,
  setupHashListener,
  setupLogout,
  setupNavigation,
  setupProfileMenu,
  setupSidebar,
  setupTheme,
} from "./teacher-navigation.js";

/*
 * IMPORTANT
 *
 * teacher-notifications.js is still imported because the teacher
 * messaging modules use helper functions supplied by its runtime
 * initialization, such as:
 *
 *   formatNotificationTime
 *   notificationInitials
 *
 * However, its old notification panel setup is intentionally NOT
 * started here.
 *
 * The real dashboard bell is now handled by the shared
 * NotificationCenter below.
 */
import "./teacher-notifications.js";

import {
  createUstazNotificationCenter,
} from "../notifications/notification-center.js";

import {
  isProfileComplete,
  isUstazRole,
  setupTrustInfo,
} from "./teacher-profile.js";

import {
  state,
} from "./teacher-state.js";

import {
  injectUstazSupportStyles,
  setupSupportControls,
  setupUstazComingSoon,
} from "./teacher-support.js";

import {
  initializeCurrentUserLocation,
} from "../location.js";


/* =========================================================
   DASHBOARD INITIALIZATION LOCK
========================================================= */

let dashboardInitializationInFlight =
  false;


/* =========================================================
   SHARED USTAZ NOTIFICATION CENTER
========================================================= */

let ustazNotificationCenter =
  null;


/* =========================================================
   SAFE SETUP
========================================================= */

function safeSetup(
  stage,
  callback
) {

  try {

    callback();

    console.info(
      `[BarakaLink][Ustaz Dashboard][${stage}] initialized.`
    );

  } catch (error) {

    console.error(
      `[BarakaLink][Ustaz Dashboard][${stage}] failed.`,
      error
    );

  }

}


/* =========================================================
   SHARED NOTIFICATION CENTER
========================================================= */

function setupUstazNotifications() {

  /*
   * Prevent duplicate initialization if dashboard setup
   * is triggered more than once.
   */

  if (
    ustazNotificationCenter
  ) {

    return;

  }


  ustazNotificationCenter =
    createUstazNotificationCenter({

      /*
       * Opening notifications closes the profile menu.
       */
      closeOtherPanel:
        closeProfileMenu,

    });


  /*
   * Start polling for real BarakaLink notifications.
   *
   * The shared center reads:
   *
   *   /api/notifications
   *   /api/notifications/unread-count
   *
   * The bell badge therefore represents ALL unread
   * notifications, not only conversation messages.
   */

  ustazNotificationCenter.startPolling();


  console.info(
    "[BarakaLink][Ustaz Dashboard][notifications] Shared notification center started."
  );

}


/* =========================================================
   LOCATION — BACKGROUND ONLY
========================================================= */

function initializeUstazLocationInBackground() {

  try {

    Promise.resolve(
      initializeCurrentUserLocation()
    )
      .then(
        (result) => {

          if (
            result?.ok
          ) {

            console.info(
              "[BarakaLink][Ustaz][location] Location update completed.",
              {
                quality:
                  result.quality ||
                  result.location?.quality ||
                  "unknown",

                accuracy:
                  result.location?.accuracy ??
                  null,

                serverSaved:
                  result.serverSaved ??
                  true,
              }
            );

            return;

          }


          console.warn(
            "[BarakaLink][Ustaz][location] Location update unavailable.",
            result?.error ||
              result
          );

        }
      )
      .catch(
        (error) => {

          console.warn(
            "[BarakaLink][Ustaz][location] Background location update failed.",
            error
          );

        }
      );

  } catch (error) {

    console.warn(
      "[BarakaLink][Ustaz][location] Unable to start background location.",
      error
    );

  }

}


/* =========================================================
   RETRY
========================================================= */

function setupRetry() {

  const retry =
    $("ustazPageRetry");


  if (
    !retry ||
    retry.dataset.ustazRetryBound === "1"
  ) {

    return;

  }


  retry.dataset.ustazRetryBound =
    "1";


  retry.addEventListener(
    "click",
    () => {

      initialize();

    }
  );

}


/* =========================================================
   AUTHENTICATED PROFILE VALIDATION
========================================================= */

function validateUstazProfile(
  profile
) {

  /*
   * Prefer the profile returned by teacher-api.js.
   *
   * Fall back to state because teacher-api.js also stores:
   *
   *   state.user
   *   state.teacher
   *
   * This prevents a response-shape difference from making
   * the whole dashboard appear blank.
   */

  const user =
    profile?.user ??
    state.user ??
    null;


  const teacher =
    profile?.teacher ??
    state.teacher ??
    null;


  if (
    !user ||
    !teacher
  ) {

    const error =
      new Error(
        "Your BarakaLink Ustaz profile data is incomplete."
      );


    error.code =
      "INVALID_PROFILE_RESPONSE";


    error.stage =
      "profile-validation";


    throw error;

  }


  if (
    !isUstazRole()
  ) {

    const error =
      new Error(
        "This dashboard is only available for Ustaz / Ustaza accounts."
      );


    error.code =
      "INVALID_ROLE";


    error.stage =
      "profile-validation";


    throw error;

  }


  if (
    !isProfileComplete()
  ) {

    const error =
      new Error(
        "Your Ustaz profile is not complete yet."
      );


    error.code =
      "PROFILE_INCOMPLETE";


    error.stage =
      "profile-completion";


    throw error;

  }


  return {
    user,
    teacher,
  };

}


/* =========================================================
   MAIN INITIALIZATION
========================================================= */

async function initialize() {

  if (
    dashboardInitializationInFlight
  ) {

    return;

  }


  dashboardInitializationInFlight =
    true;


  showLoading(
    true
  );


  hideError();


  try {

    /* =======================================================
       AUTHENTICATION
    ======================================================= */

    const token =
      getToken();


    if (
      !token
    ) {

      redirectToLogin();

      return;

    }


    /* =======================================================
       STATIC / UI SETUP

       These must not depend on profile loading.
    ======================================================= */

    safeSetup(
      "navigation",
      setupNavigation
    );


    safeSetup(
      "support",
      () => {

        injectUstazSupportStyles();

        setupSupportControls();

      }
    );


    safeSetup(
      "coming-soon",
      setupUstazComingSoon
    );


    safeSetup(
      "sidebar",
      setupSidebar
    );


    safeSetup(
      "profile-menu",
      setupProfileMenu
    );


    /*
     * IMPORTANT:
     *
     * Do NOT call the old:
     *
     *   setupNotificationPanel
     *
     * here.
     *
     * That old system owns the same bell/panel and only knows
     * about unread conversation messages.
     *
     * The shared NotificationCenter is initialized after the
     * authenticated profile has been successfully loaded.
     */


    safeSetup(
      "messages",
      setupDashboardMessages
    );


    safeSetup(
      "trust-info",
      setupTrustInfo
    );


    safeSetup(
      "global-interaction",
      setupGlobalInteraction
    );


    safeSetup(
      "logout",
      setupLogout
    );


    safeSetup(
      "theme",
      setupTheme
    );


    safeSetup(
      "retry",
      setupRetry
    );


    safeSetup(
      "hash",
      setupHashListener
    );


    /* =======================================================
       LOCATION

       NEVER BLOCK DASHBOARD STARTUP.
    ======================================================= */

    initializeUstazLocationInBackground();


    /* =======================================================
       PROFILE
    ======================================================= */

    let profile;


    try {

      profile =
        await loadProfile();

    } catch (error) {

      console.error(
        "[BarakaLink][Ustaz Dashboard][profile-request] Profile loading failed.",
        error
      );


      if (
        error?.status === 401 ||
        error?.code === "UNAUTHORIZED"
      ) {

        redirectToLogin();

        return;

      }


      showError(
        error?.message ||
          "We could not load your BarakaLink profile."
      );


      return;

    }


    /* =======================================================
       PROFILE VALIDATION
    ======================================================= */

    try {

      validateUstazProfile(
        profile
      );

    } catch (error) {

      console.error(
        `[BarakaLink][Ustaz Dashboard][${
          error?.stage ||
          "profile-validation"
        }] failed.`,
        error
      );


      if (
        error?.code ===
        "PROFILE_INCOMPLETE"
      ) {

        redirectToProfile();

        return;

      }


      if (
        error?.status === 401 ||
        error?.code === "UNAUTHORIZED"
      ) {

        redirectToLogin();

        return;

      }


      showError(
        error?.message ||
          "We could not validate your Ustaz profile."
      );


      return;

    }


    /* =======================================================
       RENDER DASHBOARD

       IMPORTANT:
       No learning-request or learning-connection APIs are
       loaded here anymore.
    ======================================================= */

    console.info(
      "[BarakaLink][Ustaz Dashboard][render] Dashboard rendering started."
    );


    try {

      renderDashboard();

      console.info(
        "[BarakaLink][Ustaz Dashboard][render] Dashboard render complete."
      );

    } catch (error) {

      console.error(
        "[BarakaLink][Ustaz Dashboard][render] Dashboard render failed.",
        error
      );


      showError(
        error?.message ||
          "We could not render your BarakaLink dashboard."
      );


      return;

    }


    /* =======================================================
       SHARED NOTIFICATIONS

       Initialize this only after authentication, profile
       loading, validation, and dashboard rendering succeed.
    ======================================================= */

    safeSetup(
      "notifications",
      setupUstazNotifications
    );


    /* =======================================================
       INITIAL SECTION
    ======================================================= */

    try {

      setSection(
        state.section ||
          "home",
        false,
        false
      );

    } catch (error) {

      console.error(
        "[BarakaLink][Ustaz Dashboard][navigation] Initial section setup failed.",
        error
      );

    }


    /* =======================================================
       COMPLETE
    ======================================================= */

    state.initialized =
      true;


    hideError();


    console.info(
      "[BarakaLink][Ustaz Dashboard] Dashboard initialization complete."
    );

  } catch (error) {

    console.error(
      "[BarakaLink][Ustaz Dashboard] Dashboard initialization failed.",
      error
    );


    if (
      error?.status === 401 ||
      error?.code === "UNAUTHORIZED"
    ) {

      redirectToLogin();

      return;

    }


    showError(
      error?.message ||
        "We could not load your BarakaLink dashboard."
    );

  } finally {

    dashboardInitializationInFlight =
      false;


    showLoading(
      false
    );

  }

}


/* =========================================================
   BOOT
========================================================= */

function boot() {

  if (
    document.readyState ===
    "loading"
  ) {

    document.addEventListener(
      "DOMContentLoaded",
      initialize,
      {
        once: true,
      }
    );

  } else {

    initialize();

  }

}


/* =========================================================
   PUBLIC DASHBOARD API
========================================================= */

window.BarakaLinkUstazDashboard = {

  reload:
    initialize,


  setSection,


  getState:
    () => ({

      ...state,


      studyFields: [
        ...state.studyFields,
      ],


      languages: [
        ...state.languages,
      ],


      availability: [
        ...state.availability,
      ],


      qualifications: [
        ...state.qualifications,
      ],


      notificationPanelOpen:
        state.notificationPanelOpen,


      sidebarOpen:
        state.sidebarOpen,


      unreadMessageCount:
        state.unreadMessageCount,


      messageNotifications:
        Array.isArray(
          state.messageNotifications
        )
          ? state.messageNotifications.map(
              (item) => ({

                id:
                  item.id,

                otherUser: {
                  ...item.otherUser,
                },

                unreadCount:
                  item.unreadCount,

                body:
                  item.body,

                createdAt:
                  item.createdAt,

              })
            )
          : [],

    }),

};


/* =========================================================
   START
========================================================= */

boot();


/* =========================================================
   EXPORTS
========================================================= */

const publicDashboardApi =
  window.BarakaLinkUstazDashboard;


export {
  initialize,
  setupRetry,
  publicDashboardApi,
};
