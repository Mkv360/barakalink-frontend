'use strict';

/* =========================================================
   BARAKALINK STUDENT DASHBOARD MODALS

   Shared modal UI behavior only. Feature-specific state/API
   work remains in the feature module that owns it.
========================================================= */

import { $, $$ } from './student-core.js';
import { safeString } from './student-utils.js';

const modalDependencies = {
  hideSupportFloat: null,
};

let comingSoonTrigger = null;
let comingSoonOpen = false;
let comingSoonNavigationBound = false;
let comingSoonControlsBound = false;


/* =========================================================
   MODAL ELEMENT HELPERS
========================================================= */

function getComingSoonModal() {

  return $('studentComingSoonModal');

}


function getComingSoonTitle() {

  return $('studentComingSoonTitle');

}


function getComingSoonDescription() {

  return $('studentComingSoonDescription');

}


function getHideSupportFloat() {

  return typeof modalDependencies.hideSupportFloat === 'function'
    ? modalDependencies.hideSupportFloat
    : () => {};

}


/* =========================================================
   FEATURE NAME
========================================================= */

function getComingSoonFeatureName(link) {

  if (!link) {
    return 'This feature';
  }


  const explicitName =
    safeString(
      link.dataset.comingSoon
    );


  if (explicitName) {
    return explicitName;
  }


  /*
   * My Learning is a real dashboard section, so its HTML
   * may use data-section="learning" instead of data-coming-soon.
   * It is intentionally intercepted here until the feature is ready.
   */
  if (
    safeString(
      link.dataset.section
    ).toLowerCase() === 'learning'
  ) {
    return 'My Learning';
  }


  const visibleLabel =
    safeString(
      link.querySelector('span:last-child')?.textContent
    ) ||
    safeString(
      link.textContent
    );


  return visibleLabel || 'This feature';

}


/* =========================================================
   OPEN COMING SOON MODAL
========================================================= */

export function openComingSoonModal(
  featureName,
  trigger
) {

  const modal =
    getComingSoonModal();


  if (!modal) {
    console.warn(
      '[BarakaLink] Coming Soon modal was not found.'
    );
    return;
  }


  const name =
    safeString(
      featureName,
      'This feature'
    );


  comingSoonTrigger =
    trigger ||
    document.activeElement ||
    null;


  const title =
    getComingSoonTitle();

  const description =
    getComingSoonDescription();


  if (title) {

    title.textContent =
      `${name} is coming soon`;

  }


  if (description) {

    description.textContent =
      `We're preparing ${name} for BarakaLink. ` +
      `It will become available here in a future update.`;

  }


  modal.hidden =
    false;


  modal.setAttribute(
    'aria-hidden',
    'false'
  );


  document.body.classList.add(
    'student-modal-open'
  );


  comingSoonOpen =
    true;


  /*
   * The support float should never sit above the modal.
   * If the support module did not provide this dependency,
   * the safe no-op fallback keeps the modal functional.
   */
  getHideSupportFloat()(false);


  requestAnimationFrame(
    () => {

      modal.classList.add(
        'is-open'
      );


      const focusTarget =
        $('studentComingSoonDone') ||
        $('studentComingSoonClose');


      if (focusTarget) {

        try {

          focusTarget.focus({
            preventScroll: true,
          });

        } catch {

          focusTarget.focus();

        }

      }

    }
  );

}


/* =========================================================
   CLOSE COMING SOON MODAL
========================================================= */

export function closeComingSoonModal() {

  const modal =
    getComingSoonModal();


  if (
    !modal ||
    !comingSoonOpen
  ) {
    return;
  }


  comingSoonOpen =
    false;


  modal.classList.remove(
    'is-open'
  );


  modal.setAttribute(
    'aria-hidden',
    'true'
  );


  document.body.classList.remove(
    'student-modal-open'
  );


  window.setTimeout(
    () => {

      if (
        !modal.classList.contains(
          'is-open'
        )
      ) {

        modal.hidden =
          true;

      }

    },
    200
  );


  const trigger =
    comingSoonTrigger;


  comingSoonTrigger =
    null;


  if (
    trigger &&
    trigger.isConnected &&
    typeof trigger.focus === 'function'
  ) {

    try {

      trigger.focus({
        preventScroll: true,
      });

    } catch {

      trigger.focus();

    }

  }

}


/* =========================================================
   REMOVE VISIBLE "SOON" BADGES
========================================================= */

export function removeSoonBadges() {

  $$('.student-nav-soon-mark')
    .forEach(
      badge => {

        badge.remove();

      }
    );

}


/* =========================================================
   COMING SOON NAVIGATION
========================================================= */

export function setupComingSoonNavigation() {

  if (comingSoonNavigationBound) {
    return;
  }


  comingSoonNavigationBound =
    true;


  /*
   * Capture phase is intentional.
   *
   * The dashboard navigation also listens for clicks.
   * Capturing this first prevents the normal dashboard
   * navigation from changing the section/hash for any
   * coming-soon item.
   *
   * Explicit data-coming-soon links are supported, and
   * My Learning is supported through data-section="learning".
   */
  document.addEventListener(
    'click',
    event => {

      const target =
        event.target;


      if (
        !(target instanceof Element)
      ) {

        return;

      }


      const link =
        target.closest(
          '[data-coming-soon], [data-section="learning"]'
        );


      if (!link) {

        return;

      }


      /*
       * Only intercept actual navigation elements.
       * This avoids interfering with unrelated controls
       * that might happen to use the same data attribute.
       */
      if (
        link.tagName !== 'A' &&
        link.getAttribute('role') !== 'link'
      ) {

        return;

      }


      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();


      openComingSoonModal(
        getComingSoonFeatureName(link),
        link
      );

    },
    true
  );

}


/* =========================================================
   MODAL CONTROLS
========================================================= */

export function setupComingSoonModalControls() {

  if (comingSoonControlsBound) {
    return;
  }


  const modal =
    getComingSoonModal();


  if (!modal) {
    console.warn(
      '[BarakaLink] Coming Soon modal HTML is missing.'
    );
    return;
  }


  const closeButton =
    $('studentComingSoonClose');


  const doneButton =
    $('studentComingSoonDone');


  const backdrop =
    modal.querySelector(
      '[data-coming-soon-close]'
    );


  comingSoonControlsBound =
    true;


  if (closeButton) {

    closeButton.addEventListener(
      'click',
      closeComingSoonModal
    );

  }


  if (doneButton) {

    doneButton.addEventListener(
      'click',
      closeComingSoonModal
    );

  }


  if (backdrop) {

    backdrop.addEventListener(
      'click',
      closeComingSoonModal
    );

  }


  /*
   * Capture Escape before other dashboard handlers.
   * Also keep keyboard focus inside the modal while it is open.
   */
  document.addEventListener(
    'keydown',
    event => {

      if (!comingSoonOpen) {
        return;
      }


      if (
        event.key === 'Escape'
      ) {

        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();

        closeComingSoonModal();

        return;

      }


      if (
        event.key !== 'Tab'
      ) {

        return;

      }


      const focusable =
        $$(
          'button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), select:not([disabled])',
          modal
        )
          .filter(
            element =>
              !element.hidden &&
              element.offsetParent !== null
          );


      if (!focusable.length) {
        return;
      }


      const first =
        focusable[0];

      const last =
        focusable[
          focusable.length - 1
        ];


      if (
        event.shiftKey &&
        document.activeElement === first
      ) {

        event.preventDefault();

        last.focus();

      } else if (
        !event.shiftKey &&
        document.activeElement === last
      ) {

        event.preventDefault();

        first.focus();

      }

    },
    true
  );

}


/* =========================================================
   INITIALIZE
========================================================= */

export function initializeStudentModals(
  dependencies = {}
) {

  Object.assign(
    modalDependencies,
    dependencies
  );


  removeSoonBadges();
  setupComingSoonNavigation();
  setupComingSoonModalControls();

}
