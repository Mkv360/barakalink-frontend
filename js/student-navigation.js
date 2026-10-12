'use strict';

/* =========================================================
   BARAKALINK STUDENT DASHBOARD NAVIGATION
========================================================= */

import { $, $$, setText } from './student-core.js';
import { state } from './student-state.js';
import { safeString } from './student-utils.js';

const SECTION_META = Object.freeze({
  home: {
    eyebrow: 'Dashboard',
    title: 'Home',
  },
  teachers: {
    eyebrow: 'Teacher Discovery',
    title: 'Find Ustaz',
  },
  messages: {
    eyebrow: 'Communication',
    title: 'Messages',
  },
  learning: {
    eyebrow: 'Learning',
    title: 'My Learning',
  },
  saved: {
    eyebrow: 'Saved',
    title: 'Saved Teachers',
  },
  content: {
    eyebrow: 'Islamic Learning',
    title: 'Islamic Content',
  },

  support: {
    eyebrow: 'Support',
    title: 'Support Baraka',
  },

  report: {
    eyebrow: 'Help & Feedback',
    title: 'Report & Feedback',
  },

  help: {
    eyebrow: 'Help Center',
    title: 'Help & Contact',
  },

  settings: {
    eyebrow: 'Preferences',
    title: 'Settings',
  },
});

const navigationDependencies = {
  closeProfileMenu: null,
  closeNotificationPanel: null,
  closeMobileSidebar: null,
  onTeachersOpen: null,
};

export function getSectionMeta(
  section
) {

  return (
    SECTION_META[section] ||
    SECTION_META.home
  );

}


export function setActiveNav(
  section
) {

  $$('.student-nav-link')
    .forEach(
      link => {

        const linkSection =
          link.dataset.section;


        if (
          linkSection &&
          linkSection === section
        ) {

          link.classList.add(
            'active'
          );

        } else {

          link.classList.remove(
            'active'
          );

        }

      }
    );

}


export function updateSectionHeader(
  section
) {

  const meta =
    getSectionMeta(section);


  setText(
    'studentSectionEyebrow',
    meta.eyebrow
  );


  setText(
    'studentSectionTitle',
    meta.title
  );

}


export function showSection(
  section,
  updateHash = true
) {

  const validSection =
    SECTION_META[section]
      ? section
      : 'home';


  $$('[data-section-panel]')
    .forEach(
      panel => {

        const panelSection =
          panel.dataset.sectionPanel;


        panel.hidden =
          panelSection !== validSection;

      }
    );


  state.currentSection =
    validSection;


  setActiveNav(
    validSection
  );


  updateSectionHeader(
    validSection
  );


  navigationDependencies.closeProfileMenu?.();
  navigationDependencies.closeNotificationPanel?.();


  if (
    updateHash &&
    window.location.hash !==
      `#${validSection}`
  ) {

    history.replaceState(
      null,
      '',
      `#${validSection}`
    );

  }


  if (
    validSection === 'teachers'
  ) {

    navigationDependencies.onTeachersOpen?.();

  }


  window.scrollTo({
    top: 0,
    behavior: 'smooth',
  });

}


export function setupSectionNavigation(dependencies = {}) {

  Object.assign(navigationDependencies, dependencies);

  /*
   * Sidebar navigation.
   *
   * IMPORTANT:
   * Dedicated pages such as inbox.html must be allowed
   * to perform normal browser navigation.
   */
  $$('.student-nav-link')
    .forEach(
      link => {

        const section =
          link.dataset.section;

        const href =
          safeString(
            link.getAttribute('href')
          );


        /*
         * Messages is a dedicated page.
         *
         * Do NOT prevent its default navigation.
         * This keeps:
         *
         * Parent Dashboard
         *        ↓
         *    Messages
         *        ↓
         *    inbox.html
         *
         * exactly like the Ustaz side.
         */
        const opensInbox =
          /(^|\/)inbox\.html(?:[?#]|$)/i.test(
            href
          );


        if (opensInbox) {
          return;
        }


        if (!section) {
          return;
        }


        link.addEventListener(
          'click',
          event => {

            event.preventDefault();

            showSection(
              section
            );

            navigationDependencies.closeMobileSidebar?.();

          }
        );

      }
    );


  /*
   * Generic section links.
   */
  $$('[data-section-link]')
    .forEach(
      link => {

        const section =
          link.dataset.sectionLink;


        if (!section) {
          return;
        }


        link.addEventListener(
          'click',
          event => {

            event.preventDefault();

            showSection(
              section
            );

            navigationDependencies.closeMobileSidebar?.();

          }
        );

      }
    );


  /*
   * Hash changes.
   */
  window.addEventListener(
    'hashchange',
    () => {

      const section =
        window.location.hash
          .replace(/^#/, '')
          .trim();


      showSection(
        section || 'home',
        false
      );

    }
  );


  /*
   * Initial hash.
   */
  const initialHash =
    window.location.hash
      .replace(/^#/, '')
      .trim();


  /*
   * Only initialize an internal dashboard section
   * when the current URL actually contains a dashboard hash.
   *
   * A normal inbox.html page will not be affected.
   */
  showSection(
    initialHash || 'home',
    false
  );

}
