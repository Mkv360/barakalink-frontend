/*
 * BarakaLink — Ustaz dashboard branded loader.
 *
 * Use as a classic (non-module) script immediately after the
 * #ustazBrandedPageLoading markup in teacher.html.
 *
 * Responsibilities:
 * - Match the Parent loader's animation and message rotation.
 * - Keep the existing hidden property API available.
 * - Show briefly when switching dashboard sections/subsections.
 * - Show and paint before same-origin page navigation, without flashing menu controls.
 * - Hide when the existing dashboard loading/error UI resolves.
 * - Expose window.BarakaLinkTeacherLoader.show()/hide() for future use.
 */
(function () {
  'use strict';

  var loader = document.getElementById('ustazBrandedPageLoading');
  if (!loader || loader.dataset.blLoaderReady === 'true') return;
  loader.dataset.blLoaderReady = 'true';

  var messages = Array.from(loader.querySelectorAll('.bl-loader-message'));
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
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
  var readinessObserver = null;

  var activeMessage = Math.max(
    0,
    messages.findIndex(function (message) {
      return message.classList.contains('is-active');
    })
  );

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

  function showForInternalNavigation() {
    if (navigationHideTimer !== null) {
      window.clearTimeout(navigationHideTimer);
    }
    showLoader();
    navigationHideTimer = window.setTimeout(function () {
      navigationHideTimer = null;
      hideLoader();
    }, 80);
  }

  function currentVisibleSection() {
    var panel = document.querySelector('[data-section-panel]:not([hidden])');
    return panel ? panel.getAttribute('data-section-panel') : '';
  }

  function currentStudentsView() {
    var view = document.querySelector('[data-ustaz-students-view]:not([hidden])');
    return view ? view.getAttribute('data-ustaz-students-view') : '';
  }

  function normalizedTarget(link) {
    if (link.hasAttribute('data-students-target')) {
      return {
        type: 'students-view',
        value: link.getAttribute('data-students-target') || ''
      };
    }

    if (link.hasAttribute('data-section-link')) {
      return {
        type: 'section',
        value: link.getAttribute('data-section-link') || ''
      };
    }

    if (link.hasAttribute('data-section')) {
      var section = link.getAttribute('data-section') || '';
      return {
        type: section === 'students' ? 'students-view' : 'section',
        value: section === 'students' ? 'students-overview' : section
      };
    }

    return null;
  }

  function handleDocumentClick(event) {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey || event.ctrlKey || event.shiftKey || event.altKey
    ) return;

    var target = event.target;
    if (!(target instanceof Element)) return;

    // Opening/closing menus and Coming Soon items must never show the loader.
    if (target.closest(
      '#ustazMenuToggle, #ustazSidebarClose, #ustazAvatarButton, ' +
      '#ustazSidebarProfileButton, #ustazNotificationButton, ' +
      '[data-coming-soon], .ustaz-nav-coming-soon'
    )) return;

    // Handle section and subsection changes through the existing dashboard nav.
    var navControl = target.closest('[data-section], [data-section-link], [data-students-target]');
    if (navControl) {
      var navTarget = normalizedTarget(navControl);
      if (!navTarget || !navTarget.value) return;

      var alreadyThere = navTarget.type === 'students-view'
        ? currentVisibleSection() === 'students' && currentStudentsView() === navTarget.value
        : currentVisibleSection() === navTarget.value;

      if (!alreadyThere) showForInternalNavigation();
      return;
    }

    var link = target.closest('a[href]');
    if (!link || link.hasAttribute('download')) return;

    var targetWindow = link.getAttribute('target');
    if (targetWindow && targetWindow.toLowerCase() !== '_self') return;

    var href = (link.getAttribute('href') || '').trim();
    if (!href || href.charAt(0) === '#' || /^javascript:/i.test(href)) return;

    var destination;
    try {
      destination = new URL(link.href, window.location.href);
    } catch (_) {
      return;
    }

    if (destination.origin !== window.location.origin) return;

    // The existing in-page section navigation should handle same-document links.
    if (
      destination.pathname === window.location.pathname &&
      destination.search === window.location.search
    ) return;

    // Prevent the browser from leaving before the loader has painted and faded in.
    // This is important for Edit Profile links in the sidebar and avatar dropdown.
    event.preventDefault();

    if (pageNavigationPending) return;
    pageNavigationPending = true;

    if (pageNavigationFallbackTimer !== null) {
      window.clearTimeout(pageNavigationFallbackTimer);
      pageNavigationFallbackTimer = null;
    }

    if (pageNavigationTimer !== null) {
      window.clearTimeout(pageNavigationTimer);
      pageNavigationTimer = null;
    }

    showLoader();

    var destinationUrl = destination.href;

    // Allow the browser to paint the overlay before starting navigation.
    // Match the CSS fade-in duration (250 ms); reduced-motion users skip the wait.
    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () {
        pageNavigationTimer = window.setTimeout(function () {
          pageNavigationTimer = null;
          window.location.assign(destinationUrl);
        }, reduced ? 0 : 260);
      });
    });

    // If navigation is blocked for any reason, recover rather than leave an overlay.
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

  function dashboardIsReadyOrHasError() {
    var existingSpinner = document.getElementById('ustazPageLoading');
    var existingError = document.getElementById('ustazPageError');

    if (existingError && !existingError.hidden) {
      hideLoader();
      return;
    }

    if (existingSpinner) {
      var style = window.getComputedStyle(existingSpinner);
      if (existingSpinner.hidden || style.display === 'none' || style.visibility === 'hidden') {
        hideLoader();
      }
    }
  }

  function setupDashboardReadinessBridge() {
    dashboardIsReadyOrHasError();

    if (!window.MutationObserver || readinessObserver) return;

    readinessObserver = new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i += 1) {
        var mutation = mutations[i];
        var node = mutation.target;
        if (!node || !(node instanceof Element)) continue;

        if (
          node.id === 'ustazPageLoading' ||
          node.id === 'ustazPageError' ||
          (mutation.type === 'childList' && node.querySelector &&
            (node.querySelector('#ustazPageLoading') || node.querySelector('#ustazPageError')))
        ) {
          dashboardIsReadyOrHasError();
          break;
        }
      }
    });

    readinessObserver.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['hidden', 'class', 'style']
    });

    // Safety fallback: even if another script fails, the branded overlay won't last forever.
    window.setTimeout(function () {
      dashboardIsReadyOrHasError();
      if (desiredVisible) hideLoader();
    }, 18000);
  }

  // Keep the same hidden=true / hidden=false control pattern as the Parent loader.
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
    console.warn('[BarakaLink] Ustaz loader transition bridge could not be installed.', error);
  }

  // Make the loader reusable by other Ustaz dashboard modules if needed.
  window.BarakaLinkTeacherLoader = {
    show: showLoader,
    hide: hideLoader,
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

  // Capture phase runs before the existing navigation handlers call preventDefault().
  document.addEventListener('click', handleDocumentClick, true);

  window.addEventListener('hashchange', showForInternalNavigation);
  window.addEventListener('popstate', showForInternalNavigation);

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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupDashboardReadinessBridge, { once: true });
  } else {
    setupDashboardReadinessBridge();
  }
})();
