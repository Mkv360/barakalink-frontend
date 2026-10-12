'use strict';

/* =========================================================
   BARAKALINK STUDENT DASHBOARD THEME
========================================================= */

import { STUDENT_CONFIG, $ } from './student-core.js';

export function getSavedTheme() {

  const value =
    localStorage.getItem(
      STUDENT_CONFIG.THEME_KEY
    );


  if (
    value === 'light' ||
    value === 'dark'
  ) {
    return value;
  }


  return null;

}


export function getInitialTheme() {

  const saved =
    getSavedTheme();


  if (saved) {
    return saved;
  }


  if (
    window.matchMedia &&
    window.matchMedia(
      '(prefers-color-scheme: dark)'
    ).matches
  ) {

    return 'dark';

  }


  return 'light';

}


export function updateThemeMeta(
  isDark
) {

  const meta =
    $('themeColorMeta');


  if (!meta) {
    return;
  }


  meta.setAttribute(
    'content',
    isDark
      ? '#17130F'
      : '#FBF7EE'
  );

}


export function updateThemeButton(
  isDark
) {

  const button =
    $('themeToggle');


  if (!button) {
    return;
  }


  const icon =
    button.querySelector('i');


  if (icon) {

    icon.className =
      isDark
        ? 'fa-solid fa-sun'
        : 'fa-solid fa-moon';

  }


  button.setAttribute(
    'aria-label',
    isDark
      ? 'Switch to light theme'
      : 'Switch to dark theme'
  );

}


export function applyTheme(
  theme
) {

  const isDark =
    theme === 'dark';


  document.body.classList.toggle(
    'dark-theme',
    isDark
  );


  localStorage.setItem(
    STUDENT_CONFIG.THEME_KEY,
    isDark
      ? 'dark'
      : 'light'
  );


  updateThemeMeta(
    isDark
  );


  updateThemeButton(
    isDark
  );

}


export function toggleTheme() {

  const next =
    document.body.classList.contains(
      'dark-theme'
    )
      ? 'light'
      : 'dark';


  applyTheme(
    next
  );

}


export function setupTheme() {

  applyTheme(
    getInitialTheme()
  );


  const button =
    $('themeToggle');


  if (button) {

    button.addEventListener(
      'click',
      toggleTheme
    );

  }

}
