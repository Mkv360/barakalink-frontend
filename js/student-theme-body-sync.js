/*
 * student-theme-body-sync.js
 *
 * Extracted from: inline <script> #2, the first script inside <body> of
 *   student-dashboard-light-default.html.
 *
 * MUST be loaded as a plain, blocking script as the FIRST element inside
 * <body> (it needs document.body to exist, so it cannot live in <head>).
 *
 * Depends on:
 *   - <meta id="themeColorMeta"> in <head>
 *   - localStorage key "baraka_theme" (also read by student-theme-bootstrap.js)
 * Toggles the "dark-theme" class on <body> and keeps
 * document.documentElement.style.colorScheme and the theme-color meta
 * in sync whenever the body class changes.
 */
(function () {
  'use strict';
  var themeKey = 'baraka_theme';
  var meta = document.getElementById('themeColorMeta');

  function syncThemeChrome() {
    var dark = document.body.classList.contains('dark-theme');
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
    if (meta) meta.setAttribute('content', dark ? '#17130F' : '#FBF7EE');
  }

  try {
    var savedTheme = localStorage.getItem(themeKey) === 'dark' ? 'dark' : 'light';
    document.body.classList.toggle('dark-theme', savedTheme === 'dark');
  } catch (error) {
    document.body.classList.remove('dark-theme');
  }

  syncThemeChrome();
  new MutationObserver(syncThemeChrome).observe(document.body, {
    attributes: true,
    attributeFilter: ['class']
  });
})();