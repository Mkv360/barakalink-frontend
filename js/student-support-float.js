/*
 * student-support-float.js
 *
 * Extracted from: inline <script> #5 near the bottom of <body> of
 *   student-dashboard-light-default.html, the part under the banner
 *   "BARAKALINK SUPPORT FLOAT".
 *   (The coming-soon modal part of the same inline script is in
 *   student-coming-soon.js. The two parts shared one IIFE but no
 *   variables, so each now has its own IIFE wrapper. The code inside is
 *   unchanged.)
 *
 * Load this AFTER student-coming-soon.js to keep the original order.
 *
 * Depends on (markup in student.html):
 *   #studentSupportFloat, #studentSupportFloatClose,
 *   #studentSupportFloatLater, #studentSupportFloatSupport
 * Reads the body class "student-modal-open" (set by student-coming-soon.js).
 * Reads / writes localStorage key: barakalink_support_float_dismissed
 *
 * NOTE FOR STEP 2: in the original HTML this script ran BEFORE the
 * #studentSupportFloat markup existed in the DOM, so the lookups below
 * resolve to null at run time. That ordering is preserved here on purpose.
 * See the report.
 */
(function () {
  'use strict';

  /*
   * ============================================
   * BARAKALINK SUPPORT FLOAT
   * ============================================
   */

  const supportFloat =
    document.getElementById('studentSupportFloat');

  const supportClose =
    document.getElementById('studentSupportFloatClose');

  const supportLater =
    document.getElementById('studentSupportFloatLater');

  const supportButton =
    document.getElementById('studentSupportFloatSupport');

  const SUPPORT_DISMISSED_KEY =
    'barakalink_support_float_dismissed';

  const SUPPORT_DELAY = 1800;

  function wasRecentlyDismissed() {
    try {
      const saved =
        localStorage.getItem(SUPPORT_DISMISSED_KEY);

      if (!saved) return false;

      const timestamp = Number(saved);

      if (!Number.isFinite(timestamp)) {
        return false;
      }

      /*
       * Show again after 7 days.
       */
      return Date.now() - timestamp < 7 * 24 * 60 * 60 * 1000;

    } catch (error) {
      return false;
    }
  }

  function showSupportFloat() {
    if (!supportFloat) return;

    if (document.body.classList.contains('student-modal-open')) {
      return;
    }

    supportFloat.hidden = false;

    requestAnimationFrame(function () {
      supportFloat.classList.add('is-open');
    });
  }

  function hideSupportFloat(remember) {
    if (!supportFloat) return;

    supportFloat.classList.remove('is-open');

    if (remember) {
      try {
        localStorage.setItem(
          SUPPORT_DISMISSED_KEY,
          String(Date.now())
        );
      } catch (error) {
        /* Ignore storage errors */
      }
    }

    setTimeout(function () {
      if (!supportFloat.classList.contains('is-open')) {
        supportFloat.hidden = true;
      }
    }, 220);
  }

  if (
    supportFloat &&
    !wasRecentlyDismissed()
  ) {
    window.setTimeout(function () {
      /*
       * Don't display the support card while a modal
       * or another overlay is open.
       */
      if (!document.body.classList.contains('student-modal-open')) {
        showSupportFloat();
      }
    }, SUPPORT_DELAY);
  }

  if (supportClose) {
    supportClose.addEventListener('click', function () {
      hideSupportFloat(true);
    });
  }

  if (supportLater) {
    supportLater.addEventListener('click', function () {
      hideSupportFloat(true);
    });
  }

  /*
   * When the user chooses to support BarakaLink,
   * dismiss the floating card.
   *
   * Your existing dashboard navigation handles
   * opening the #support section.
   */
  if (supportButton) {
    supportButton.addEventListener('click', function () {
      hideSupportFloat(true);
    });
  }

})();