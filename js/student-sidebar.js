'use strict';

/* =========================================================
   BARAKALINK STUDENT DASHBOARD SIDEBAR / PROFILE MENU
========================================================= */

import { $ } from './student-core.js';
import { $$ } from './student-core.js';
import { state } from './student-state.js';

const sidebarDependencies = {
  closeProfileMenu: null,
  closeNotificationPanel: null,
};

export function openMobileSidebar() {

  const sidebar =
    $('studentSidebar');

  const overlay =
    $('studentSidebarOverlay');

  const menuToggle =
    $('studentMenuToggle');


  if (sidebar) {
    sidebar.classList.add(
      'active'
    );
  }


  if (overlay) {
    overlay.classList.add(
      'active'
    );

    overlay.setAttribute(
      'aria-hidden',
      'false'
    );
  }


  if (menuToggle) {

    menuToggle.setAttribute(
      'aria-expanded',
      'true'
    );

  }


  document.body.classList.add(
    'student-menu-open'
  );

}


export function closeMobileSidebar() {

  const sidebar =
    $('studentSidebar');

  const overlay =
    $('studentSidebarOverlay');

  const menuToggle =
    $('studentMenuToggle');


  if (sidebar) {
    sidebar.classList.remove(
      'active'
    );
  }


  if (overlay) {

    overlay.classList.remove(
      'active'
    );

    overlay.setAttribute(
      'aria-hidden',
      'true'
    );

  }


  if (menuToggle) {

    menuToggle.setAttribute(
      'aria-expanded',
      'false'
    );

  }


  document.body.classList.remove(
    'student-menu-open'
  );


  /*
   * The profile panel lives inside the mobile sidebar.
   * Closing the sidebar must never leave that panel open
   * when the sidebar is opened again.
   */
  closeProfileMenu();

}


export function setupMobileSidebar(dependencies = {}) {

  Object.assign(sidebarDependencies, dependencies);

  const menuToggle =
    $('studentMenuToggle');

  const closeButton =
    $('studentSidebarClose');

  const overlay =
    $('studentSidebarOverlay');


  if (menuToggle) {

    menuToggle.addEventListener(
      'click',
      () => {

        const sidebar =
          $('studentSidebar');


        if (
          sidebar?.classList.contains(
            'active'
          )
        ) {

          closeMobileSidebar();

        } else {

          openMobileSidebar();

        }

      }
    );

  }


  if (closeButton) {

    closeButton.addEventListener(
      'click',
      closeMobileSidebar
    );

  }


  if (overlay) {

    overlay.addEventListener(
      'click',
      closeMobileSidebar
    );

  }


  document.addEventListener(
    'keydown',
    event => {

      if (
        event.key === 'Escape'
      ) {

        closeMobileSidebar();
        sidebarDependencies.closeProfileMenu?.();
        sidebarDependencies.closeNotificationPanel?.();

      }

    }
  );

}


export function openProfileMenu() {

  const menu =
    $('studentProfileMenu');

  const desktopButton =
    $('studentAvatarButton');

  const mobileButton =
    $('studentSidebarProfileButton');


  if (!menu) {
    return;
  }


  sidebarDependencies.closeNotificationPanel?.();


  menu.hidden =
    false;


  state.profileMenuOpen =
    true;


  [
    desktopButton,
    mobileButton,
  ].forEach(
    button => {

      if (button) {

        button.setAttribute(
          'aria-expanded',
          'true'
        );

      }

    }
  );

}


export function closeProfileMenu() {

  const menu =
    $('studentProfileMenu');

  const desktopButton =
    $('studentAvatarButton');

  const mobileButton =
    $('studentSidebarProfileButton');


  if (menu) {

    menu.hidden =
      true;

  }


  state.profileMenuOpen =
    false;


  [
    desktopButton,
    mobileButton,
  ].forEach(
    button => {

      if (button) {

        button.setAttribute(
          'aria-expanded',
          'false'
        );

      }

    }
  );

}


export function toggleProfileMenu() {

  if (
    state.profileMenuOpen
  ) {

    sidebarDependencies.closeProfileMenu?.();

  } else {

    sidebarDependencies.closeNotificationPanel?.();

    openProfileMenu();

  }

}


export function setupProfileMenu(dependencies = {}) {

  Object.assign(sidebarDependencies, dependencies);

  const buttons = [
    $('studentAvatarButton'),
    $('studentSidebarProfileButton'),
  ].filter(Boolean);


  buttons.forEach(
    button => {

      button.addEventListener(
        'click',
        event => {

          event.stopPropagation();

          toggleProfileMenu();

        }
      );

    }
  );


  const menu =
    $('studentProfileMenu');


  if (menu) {

    menu.addEventListener(
      'click',
      event => {

        event.stopPropagation();

      }
    );

  }


  $$('.student-profile-menu-link')
    .forEach(
      link => {

        link.addEventListener(
          'click',
          closeProfileMenu
        );

      }
    );

}
