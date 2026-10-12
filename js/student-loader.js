/*
 * BarakaLink — Student/Parent dashboard branded loader.
 *
 * File: frontend/js/student-loader.js
 *
 * Keeps the existing Parent-side BarakaLink animation and hidden-property
 * bridge, and adds smooth loader behavior for sidebar navigation:
 * - Internal dashboard sections and hash-based sidebar items
 * - Same-origin links that open another page (including Edit Profile)
 * - Browser back/forward navigation
 *
 * IMPORTANT:
 * Load as a plain blocking script IMMEDIATELY AFTER the #studentPageLoading
 * element in student.html, before student-init.js / deferred app modules.
 */
(function () {
  'use strict';

  var loader = document.getElementById('studentPageLoading');
  if (!loader || loader.dataset.blLoaderReady === 'true') return;
  loader.dataset.blLoaderReady = 'true';

  var messages = Array.from(loader.querySelectorAll('.bl-loader-message'));
  var reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var minimumMs = 820;
  var fadeMs = reduced ? 0 : 250;
  var desiredVisible = !loader.hasAttribute('hidden');
  var visibleSince = desiredVisible ? performance.now() : 0;
  var hideTimer = null;
  var fadeTimer = null;
  var messageTimer = null;
  var navigationHideTimer = null;
  var pageNavigationFallbackTimer = null;
  var pageNavigationTimer = null;
  var pageNavigationPending = false;

  // Prevent a section click and its follow-up hash/history event from
  // starting the same animation twice (the Messages section exposed this race).
  var internalNavigationPending = false;
  var lastClickedInternalTarget = '';
  var lastClickedInternalAt = 0;
  var historyNavigationTimer = null;

  var activeMessage = Math.max(0, messages.findIndex(function (message) {
    return message.classList.contains('is-active');
  }));

  function clearHideTimers() {
    window.clearTimeout(hideTimer);
    window.clearTimeout(fadeTimer);
    hideTimer = null;
    fadeTimer = null;
  }

  function setMessage(index) {
    if (!messages.length) return;
    activeMessage = (index + messages.length) % messages.length;
    messages.forEach(function (item, i) {
      item.classList.toggle('is-active', i === activeMessage);
    });
  }

  function startMessages() {
    if (reduced || messages.length < 2 || messageTimer !== null) return;
    messageTimer = window.setInterval(function () {
      if (desiredVisible) setMessage(activeMessage + 1);
    }, 2600);
  }

  function stopMessages() {
    if (messageTimer !== null) {
      window.clearInterval(messageTimer);
      messageTimer = null;
    }
  }

  function showLoader() {
    var wasVisible = desiredVisible;
    desiredVisible = true;
    clearHideTimers();

    if (loader.hasAttribute('hidden')) loader.removeAttribute('hidden');
    loader.setAttribute('aria-hidden', 'false');
    document.body.setAttribute('aria-busy', 'true');
    loader.classList.remove('is-leaving');

    if (!wasVisible) {
      visibleSince = performance.now();
      loader.classList.remove('is-visible');
      window.requestAnimationFrame(function () {
        if (desiredVisible) loader.classList.add('is-visible');
      });
    } else {
      loader.classList.add('is-visible');
    }

    startMessages();
  }

  function finishHide() {
    if (desiredVisible) return;
    loader.setAttribute('hidden', '');
    loader.setAttribute('aria-hidden', 'true');
    loader.classList.remove('is-leaving', 'is-visible');
    document.body.setAttribute('aria-busy', 'false');
    stopMessages();
  }

  function hideLoader() {
    if (!desiredVisible) return;
    desiredVisible = false;
    clearHideTimers();

    var elapsed = visibleSince ? performance.now() - visibleSince : minimumMs;
    hideTimer = window.setTimeout(function () {
      if (desiredVisible) return;
      loader.classList.remove('is-visible');
      if (fadeMs > 0) loader.classList.add('is-leaving');
      fadeTimer = window.setTimeout(finishHide, fadeMs);
    }, Math.max(0, minimumMs - elapsed));
  }

  function showForInternalNavigation(target) {
    var now = performance.now();

    // Remember the click target so hashchange/popstate caused by the same
    // navigation cannot reopen the loader during its fade-out.
    if (target) {
      lastClickedInternalTarget = String(target);
      lastClickedInternalAt = now;
    }

    if (navigationHideTimer !== null) {
      window.clearTimeout(navigationHideTimer);
      navigationHideTimer = null;
    }

    // A click handler plus hash/history event may represent one navigation.
    // Keep the current animation alive instead of restarting it and flashing.
    if (internalNavigationPending && desiredVisible) {
      return;
    }

    internalNavigationPending = true;
    showLoader();

    // Make every genuine navigation start its own minimum-visible window,
    // without resetting it for duplicate events that arrive afterwards.
    visibleSince = performance.now();

    navigationHideTimer = window.setTimeout(function () {
      navigationHideTimer = null;
      internalNavigationPending = false;
      hideLoader();
    }, reduced ? 120 : 150);
  }

  function handleHistoryNavigation() {
    var now = performance.now();
    var hashTarget = window.location.hash.replace(/^#/, '').trim();
    var visibleTarget = currentVisibleSection();
    var recentClick = now - lastClickedInternalAt < 2200;

    // Ignore the history event generated by a click already animated above.
    // This avoids the Messages-specific fade-out/fade-in flash.
    if (
      recentClick &&
      lastClickedInternalTarget &&
      (hashTarget === lastClickedInternalTarget ||
       visibleTarget === lastClickedInternalTarget)
    ) {
      return;
    }

    if (historyNavigationTimer !== null) {
      window.clearTimeout(historyNavigationTimer);
    }

    historyNavigationTimer = window.setTimeout(function () {
      historyNavigationTimer = null;
      showForInternalNavigation(hashTarget || visibleTarget || '');
    }, 40);
  }

  function currentVisibleSection() {
    var selectors = [
      '[data-section-panel]:not([hidden])',
      '[data-student-section-panel]:not([hidden])',
      '.student-section:not([hidden])'
    ];

    for (var i = 0; i < selectors.length; i += 1) {
      var panel = document.querySelector(selectors[i]);
      if (panel) {
        return panel.getAttribute('data-section-panel') ||
          panel.getAttribute('data-student-section-panel') ||
          panel.id || '';
      }
    }

    return '';
  }

  function normalizedInternalTarget(control) {
    if (control.hasAttribute('data-students-target')) {
      return control.getAttribute('data-students-target') || '';
    }
    if (control.hasAttribute('data-section-link')) {
      return control.getAttribute('data-section-link') || '';
    }
    if (control.hasAttribute('data-section')) {
      return control.getAttribute('data-section') || '';
    }
    if (control.hasAttribute('data-student-section')) {
      return control.getAttribute('data-student-section') || '';
    }

    var href = control.getAttribute('href') || '';
    if (href.charAt(0) === '#' && href.length > 1) {
      return decodeURIComponent(href.slice(1));
    }

    return '';
  }

  function isMenuOrModalControl(target) {
    return !!target.closest(
      '#studentMenuToggle, #studentSidebarToggle, #studentSidebarClose, ' +
      '#studentAvatarButton, #studentProfileButton, #studentSidebarProfileButton, ' +
      '#studentNotificationButton, #studentNotificationsButton, ' +
      '.student-menu-toggle, .student-sidebar-toggle, .student-sidebar-close, ' +
      '.student-profile-trigger, .student-notification-trigger, ' +
      '[data-student-menu-toggle], [data-student-sidebar-toggle], ' +
      '[data-student-profile-menu-toggle], [data-coming-soon], ' +
      '.student-nav-coming-soon, [data-modal-open], [data-modal-close]'
    );
  }

  function handleDocumentClick(event) {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey || event.ctrlKey || event.shiftKey || event.altKey
    ) return;

    var target = event.target;
    if (!(target instanceof Element)) return;
    if (isMenuOrModalControl(target)) return;

    // Internal sidebar/section navigation. Capture runs before page modules
    // call preventDefault(), but does not change the app's navigation logic.
    var navControl = target.closest(
      '[data-section], [data-section-link], [data-students-target], [data-student-section]'
    );

    if (navControl) {
      var navTarget = normalizedInternalTarget(navControl);
      var currentTarget = currentVisibleSection();
      var alreadyThere = navTarget && navTarget === currentTarget;

      if (!alreadyThere && navTarget) showForInternalNavigation(navTarget);
      return;
    }

    var link = target.closest('a[href]');
    if (!link || link.hasAttribute('download')) return;

    var targetWindow = link.getAttribute('target');
    if (targetWindow && targetWindow.toLowerCase() !== '_self') return;

    var href = (link.getAttribute('href') || '').trim();
    if (!href || /^javascript:/i.test(href) || /^mailto:/i.test(href) || /^tel:/i.test(href)) return;

    var destination;
    try {
      destination = new URL(link.href, window.location.href);
    } catch (_) {
      return;
    }

    if (destination.origin !== window.location.origin) return;

    var sameDocument =
      destination.pathname === window.location.pathname &&
      destination.search === window.location.search;

    if (sameDocument) {
      // Same page, different hash: give hash-based sidebar navigation the
      // same loader treatment. The browser/app keeps control of the hash.
      if (destination.hash && destination.hash !== window.location.hash) {
        showForInternalNavigation();
      }
      return;
    }

    // For real page navigation, wait until the branded overlay has painted
    // and begun its fade-in before changing pages. This avoids a single-frame
    // flash from sidebar and dropdown Edit Profile links.
    event.preventDefault();
    if (pageNavigationPending) return;
    pageNavigationPending = true;

    clearPageNavigationTimers();
    showLoader();
    var destinationUrl = destination.href;

    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () {
        pageNavigationTimer = window.setTimeout(function () {
          pageNavigationTimer = null;
          window.location.assign(destinationUrl);
        }, reduced ? 0 : 260);
      });
    });

    // If the browser refuses navigation or another handler cancels the flow,
    // release the lock and hide the overlay rather than leaving it stuck.
    pageNavigationFallbackTimer = window.setTimeout(function () {
      pageNavigationFallbackTimer = null;
      pageNavigationPending = false;
      if (pageNavigationTimer !== null) {
        window.clearTimeout(pageNavigationTimer);
        pageNavigationTimer = null;
      }
      hideLoader();
    }, 7000);
  }

  function clearPageNavigationTimers() {
    if (pageNavigationFallbackTimer !== null) {
      window.clearTimeout(pageNavigationFallbackTimer);
      pageNavigationFallbackTimer = null;
    }
    if (pageNavigationTimer !== null) {
      window.clearTimeout(pageNavigationTimer);
      pageNavigationTimer = null;
    }
  }

  // Preserve the existing API used by student-init.js and other modules:
  // setting loader.hidden true/false starts the same fade/minimum-time logic.
  try {
    Object.defineProperty(loader, 'hidden', {
      configurable: true,
      enumerable: true,
      get: function () { return !desiredVisible; },
      set: function (value) {
        if (Boolean(value)) hideLoader();
        else showLoader();
      }
    });
  } catch (error) {
    console.warn('[BarakaLink] Loader transition bridge could not be installed.', error);
  }

  // Optional reusable API for existing and future Student dashboard modules.
  window.BarakaLinkStudentLoader = {
    show: showLoader,
    hide: hideLoader,
    showForInternalNavigation: showForInternalNavigation,
    setMessage: function (message) {
      var text = String(message || '').trim();
      if (!text || !messages.length) return;
      setMessage(0);
      messages[0].textContent = text;
      for (var i = 1; i < messages.length; i += 1) {
        messages[i].textContent = '';
      }
    }
  };

  // Capture before app click handlers so navigation can animate smoothly.
  document.addEventListener('click', handleDocumentClick, true);
  window.addEventListener('hashchange', handleHistoryNavigation);
  window.addEventListener('popstate', handleHistoryNavigation);

  // Keep the existing startup visibility and animation behavior.
  if (desiredVisible) {
    loader.classList.add('is-visible');
    loader.removeAttribute('hidden');
    loader.setAttribute('aria-hidden', 'false');
    document.body.setAttribute('aria-busy', 'true');
    startMessages();
  } else {
    loader.setAttribute('hidden', '');
    loader.setAttribute('aria-hidden', 'true');
  }
})();
