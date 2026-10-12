'use strict';

(function () {

  const LEARNING_SECTION_ID = 'learning';

  const VIEWS = Object.freeze([
    'learning-overview',
    'learning-requests',
    'active-learning'
  ]);

  const DEFAULT_VIEW = 'learning-overview';


  /* =========================================================
     ELEMENT HELPERS
  ========================================================= */

  function getLearningSection() {
    return document.getElementById(
      LEARNING_SECTION_ID
    );
  }


  function getLearningNavItem() {
    return document.querySelector(
      '.student-nav-item-with-subnav'
    );
  }


  function getLearningNavLink() {
    return document.querySelector(
      '.student-nav-link[data-section="learning"]'
    );
  }


  function getSubnav() {
    const navItem =
      getLearningNavItem();

    if (!navItem) {
      return null;
    }

    return navItem.querySelector(
      '.student-learning-sidebar-subnav'
    );
  }


  function getView(viewId) {

    if (!VIEWS.includes(viewId)) {
      return null;
    }

    return document.getElementById(
      viewId
    );
  }


  function getSubnavLinks() {
    return Array.from(
      document.querySelectorAll(
        '.student-learning-sidebar-link'
      )
    );
  }


  /* =========================================================
     FORCE SUBNAV OPEN
  ========================================================= */

  function openLearningSubnav() {

    const navItem =
      getLearningNavItem();

    const subnav =
      getSubnav();

    if (!navItem || !subnav) {
      return;
    }

    navItem.classList.add(
      'is-open'
    );

    /*
     * Force the actual display value.
     * !important prevents the inline
     * student.html CSS from overriding it.
     */
    subnav.style.setProperty(
      'display',
      'flex',
      'important'
    );
  }


  /* =========================================================
     FORCE SUBNAV CLOSED
  ========================================================= */

  function closeLearningSubnav() {

    const navItem =
      getLearningNavItem();

    const subnav =
      getSubnav();

    if (navItem) {

      navItem.classList.remove(
        'is-open'
      );

    }

    if (subnav) {

      /*
       * Force hidden state.
       * This overrides display:flex from
       * student.html as well.
       */
      subnav.style.setProperty(
        'display',
        'none',
        'important'
      );

    }
  }


  /* =========================================================
     ACTIVE SUBNAV
  ========================================================= */

  function setActiveSubnav(viewId) {

    const activeView =
      VIEWS.includes(viewId)
        ? viewId
        : DEFAULT_VIEW;

    getSubnavLinks().forEach(
      function (link) {

        const linkTarget =
          link.dataset.learningTarget;

        const isActive =
          linkTarget === activeView;

        link.classList.toggle(
          'active',
          isActive
        );

        if (isActive) {

          link.setAttribute(
            'aria-current',
            'page'
          );

        } else {

          link.removeAttribute(
            'aria-current'
          );

        }

      }
    );
  }


  /* =========================================================
     SHOW LEARNING VIEW
  ========================================================= */

  function showLearningView(viewId) {

    const learningSection =
      getLearningSection();

    if (!learningSection) {
      return;
    }

    const activeView =
      VIEWS.includes(viewId)
        ? viewId
        : DEFAULT_VIEW;

    const allViews =
      VIEWS
        .map(getView)
        .filter(Boolean);

    /*
     * Keep the main learning section visible.
     */
    learningSection.hidden = false;

    /*
     * Show only the selected learning view.
     */
    allViews.forEach(
      function (view) {

        view.hidden =
          view.id !== activeView;

      }
    );

    /*
     * My Learning is active,
     * so the subnav must be visible.
     */
    openLearningSubnav();

    setActiveSubnav(
      activeView
    );
  }


  /* =========================================================
     OPEN MAIN LEARNING
  ========================================================= */

  function openMainLearningSection() {

    const learningLink =
      getLearningNavLink();

    if (learningLink) {

      openLearningSubnav();

      learningLink.click();

      return;
    }

    const learningSection =
      getLearningSection();

    if (learningSection) {

      learningSection.hidden = false;

      openLearningSubnav();

    }
  }


  /* =========================================================
     LEARNING SUBNAV CLICK
  ========================================================= */

  function setupLearningSubnav() {

    const links =
      getSubnavLinks();

    if (!links.length) {
      return;
    }

    links.forEach(
      function (link) {

        link.addEventListener(
          'click',
          function (event) {

            event.preventDefault();
            event.stopPropagation();

            const target =
              link.dataset.learningTarget;

            if (!VIEWS.includes(target)) {
              return;
            }

            /*
             * Keep My Learning open.
             */
            openLearningSubnav();

            /*
             * Activate the main Learning section.
             */
            openMainLearningSection();

            /*
             * Wait for student.js navigation.
             */
            window.setTimeout(
              function () {

                showLearningView(
                  target
                );

                /*
                 * Internal views are not
                 * top-level routes.
                 */
                history.replaceState(
                  null,
                  '',
                  '#learning'
                );

              },
              0
            );

          }
        );

      }
    );
  }


  /* =========================================================
     MAIN MY LEARNING CLICK
  ========================================================= */

  function setupMainLearningLink() {

    const learningLink =
      getLearningNavLink();

    if (!learningLink) {
      return;
    }

    learningLink.addEventListener(
      'click',
      function () {

        /*
         * Open immediately.
         */
        openLearningSubnav();

        /*
         * Start on Overview.
         */
        window.setTimeout(
          function () {

            showLearningView(
              DEFAULT_VIEW
            );

          },
          0
        );

      }
    );
  }


  /* =========================================================
     OTHER TOP-LEVEL NAVIGATION
  ========================================================= */

  function setupTopLevelNavigation() {

    /*
     * Use CAPTURE mode so this runs BEFORE
     * student.js handles its navigation.
     */
    document.addEventListener(
      'click',
      function (event) {

        const link =
          event.target.closest(
            '.student-nav-link'
          );

        if (!link) {
          return;
        }

        /*
         * If this is the main My Learning
         * link, keep the subnav open.
         */
        if (
          link.dataset.section ===
          LEARNING_SECTION_ID
        ) {
          return;
        }

        /*
         * Every other top-level navigation
         * item immediately closes My Learning.
         */
        closeLearningSubnav();

      },
      true
    );
  }


  /* =========================================================
     HASH CHANGE
  ========================================================= */

  function setupHashChange() {

    window.addEventListener(
      'hashchange',
      function () {

        const hash =
          window.location.hash
            .replace(/^#/, '')
            .trim();

        /*
         * These belong to My Learning.
         */
        if (
          hash === LEARNING_SECTION_ID ||
          VIEWS.includes(hash)
        ) {

          openLearningSubnav();

          return;
        }

        /*
         * Anything else is another
         * dashboard section.
         */
        closeLearningSubnav();

      }
    );
  }


  /* =========================================================
     INITIAL PAGE STATE
  ========================================================= */

  function handleInitialHash() {

    const hash =
      window.location.hash
        .replace(/^#/, '')
        .trim();


    /*
     * Plain #learning
     */
    if (
      hash === LEARNING_SECTION_ID
    ) {

      window.setTimeout(
        function () {

          openLearningSubnav();

          showLearningView(
            DEFAULT_VIEW
          );

        },
        0
      );

      return;
    }


    /*
     * Direct internal learning view.
     */
    if (
      VIEWS.includes(hash)
    ) {

      window.setTimeout(
        function () {

          openMainLearningSection();

          window.setTimeout(
            function () {

              showLearningView(
                hash
              );

              history.replaceState(
                null,
                '',
                '#learning'
              );

            },
            0
          );

        },
        0
      );

      return;
    }


    /*
     * Everything else starts with
     * the My Learning subnav CLOSED.
     */
    closeLearningSubnav();
  }


  /* =========================================================
     START
  ========================================================= */

  document.addEventListener(
    'DOMContentLoaded',
    function () {

      /*
       * Start hidden.
       */
      closeLearningSubnav();

      setupLearningSubnav();
      setupMainLearningLink();
      setupTopLevelNavigation();
      setupHashChange();

      handleInitialHash();

    }
  );

})();