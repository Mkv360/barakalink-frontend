
/* =========================================================
   BARAKALINK SHARED PAGE LOADER

   Features:
   - Safe initialization even if the script loads early
   - Automatic hiding after the page load event
   - Smooth show/hide transitions
   - Loading message rotation every 1.8 seconds
   - Same-origin page navigation support
   - Minimum visible duration
   - Back/forward cache support
   - Public show() and hide() methods
========================================================= */

(function () {
  'use strict';

  function initializeBarakaLinkLoader() {
    const loader = document.getElementById('barakaLinkPageLoader');

    if (!loader) {
      console.warn(
        '[BarakaLink Loader] Loader HTML was not found. ' +
        'Check that the loader markup exists on this page.'
      );
      return;
    }

    // Prevent this same loader element from being initialized twice.
    if (loader.dataset.blLoaderReady === 'true') {
      return;
    }

    loader.dataset.blLoaderReady = 'true';

    const messages = Array.from(
      loader.querySelectorAll('.bl-loader-message')
    );

    const reduceMotion = Boolean(
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );

    const MIN_VISIBLE_MS = 720;
    const FADE_MS = reduceMotion ? 0 : 240;

    let desiredVisible = !loader.hidden;

    let visibleSince = desiredVisible
      ? performance.now()
      : 0;

    let hideTimer = null;
    let fadeTimer = null;
    let messageTimer = null;

    let messageIndex = Math.max(
      0,
      messages.findIndex(function (item) {
        return item.classList.contains('is-active');
      })
    );

    function clearHideTimers() {
      window.clearTimeout(hideTimer);
      window.clearTimeout(fadeTimer);

      hideTimer = null;
      fadeTimer = null;
    }

    function stopMessageRotation() {
      if (messageTimer !== null) {
        window.clearInterval(messageTimer);
        messageTimer = null;
      }
    }

    function setMessage(index) {
      if (!messages.length) return;

      messageIndex = (index + messages.length) % messages.length;

      messages.forEach(function (item, i) {
        item.classList.toggle(
          'is-active',
          i === messageIndex
        );
      });
    }

    function startMessageRotation() {
      if (
        reduceMotion ||
        messages.length < 2 ||
        messageTimer !== null
      ) {
        return;
      }

      messageTimer = window.setInterval(function () {
        if (desiredVisible) {
          setMessage(messageIndex + 1);
        }
      }, 1800);
    }

    function show() {
      const wasVisible = desiredVisible;

      desiredVisible = true;

      clearHideTimers();

      loader.hidden = false;
      loader.setAttribute('aria-hidden', 'false');

      loader.classList.remove('is-leaving');

      document.body.setAttribute('aria-busy', 'true');

      if (!wasVisible) {
        visibleSince = performance.now();

        loader.classList.remove('is-visible');

        window.requestAnimationFrame(function () {
          if (desiredVisible) {
            loader.classList.add('is-visible');
          }
        });
      } else {
        loader.classList.add('is-visible');
      }

      startMessageRotation();
    }

    function finishHide() {
      if (desiredVisible) return;

      loader.hidden = true;

      loader.setAttribute('aria-hidden', 'true');

      loader.classList.remove(
        'is-leaving',
        'is-visible'
      );

      document.body.setAttribute('aria-busy', 'false');

      stopMessageRotation();
    }

    function hide() {
      if (!desiredVisible) return;

      desiredVisible = false;

      clearHideTimers();

      const elapsed = visibleSince
        ? performance.now() - visibleSince
        : MIN_VISIBLE_MS;

      const waitForMinimum = Math.max(
        0,
        MIN_VISIBLE_MS - elapsed
      );

      hideTimer = window.setTimeout(function () {
        if (desiredVisible) return;

        loader.classList.remove('is-visible');

        if (FADE_MS > 0) {
          loader.classList.add('is-leaving');
        }

        fadeTimer = window.setTimeout(
          finishHide,
          FADE_MS
        );
      }, waitForMinimum);
    }

    function isNavigablePageLink(link, event) {
      if (
        !link ||
        event.defaultPrevented ||
        event.button !== 0
      ) {
        return false;
      }

      if (
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return false;
      }

      if (
        link.hasAttribute('download') ||
        (
          link.target &&
          link.target.toLowerCase() !== '_self'
        )
      ) {
        return false;
      }

      if (
        link.hasAttribute('data-no-loader') ||
        link.hasAttribute('data-auth') ||
        link.hasAttribute('data-section') ||
        link.hasAttribute('data-section-link') ||
        link.hasAttribute('data-coming-soon')
      ) {
        return false;
      }

      const rawHref = link.getAttribute('href');

      if (
        !rawHref ||
        rawHref.trim() === '' ||
        rawHref.trim() === '#'
      ) {
        return false;
      }

      if (
        /^(?:javascript:|mailto:|tel:|sms:)/i.test(
          rawHref.trim()
        )
      ) {
        return false;
      }

      let targetUrl;

      try {
        targetUrl = new URL(
          rawHref,
          window.location.href
        );
      } catch {
        return false;
      }

      if (targetUrl.origin !== window.location.origin) {
        return false;
      }

      // Ignore in-page anchors.
      if (
        targetUrl.pathname === window.location.pathname &&
        targetUrl.search === window.location.search &&
        targetUrl.hash !== ''
      ) {
        return false;
      }

      return (
        targetUrl.pathname !== window.location.pathname ||
        targetUrl.search !== window.location.search
      );
    }

    // Show the loader for real same-origin page navigation.
    document.addEventListener('click', function (event) {
      const target = event.target;

      if (!(target instanceof Element)) return;

      const link = target.closest('a[href]');

      if (isNavigablePageLink(link, event)) {
        show();
      }
    });

    // Automatically hide the loader when page loading finishes.
    if (loader.dataset.loaderAutoHide === 'load') {
      const hideWhenLoaded = function () {
        hide();
      };

      if (document.readyState === 'complete') {
        window.setTimeout(hideWhenLoaded, 0);
      } else {
        window.addEventListener(
          'load',
          hideWhenLoaded,
          { once: true }
        );
      }
    }

    // Handle browser back/forward cache restoration.
    window.addEventListener('pageshow', function (event) {
      if (event.persisted) {
        hide();
      }
    });

    // Initialize the loader's starting state.
    if (desiredVisible) {
      loader.classList.add('is-visible');

      loader.setAttribute('aria-hidden', 'false');

      document.body.setAttribute('aria-busy', 'true');

      startMessageRotation();
    }

    // Public API for pages that control the loader manually.
    window.BarakaLinkLoader = Object.freeze({
      show: show,
      hide: hide
    });
  }

  // Support scripts placed in the head or after the loader markup.
  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      initializeBarakaLinkLoader,
      { once: true }
    );
  } else {
    initializeBarakaLinkLoader();
  }
})();
