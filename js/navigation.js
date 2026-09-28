(function () {

  "use strict";


  /* =======================================================
     BARAKALINK — NAVIGATION
  ======================================================= */

  const body =
    document.body;

  const siteNav =
    document.getElementById(
      "siteNav"
    );

  const mobileToggle =
    document.getElementById(
      "mobileToggle"
    );

  const mobileNavigation =
    document.getElementById(
      "mobileNavigation"
    );


  /* =======================================================
     SAFETY
  ======================================================= */

  if (
    !siteNav ||
    !mobileToggle ||
    !mobileNavigation
  ) {
    return;
  }


  /* =======================================================
     NAVIGATION SCROLL
  ======================================================= */

  function updateNav() {

    siteNav.classList.toggle(
      "scrolled",
      window.scrollY > 10
    );

  }


  updateNav();


  window.addEventListener(
    "scroll",
    updateNav,
    {
      passive: true
    }
  );


  /* =======================================================
     MOBILE NAVIGATION
  ======================================================= */

  function closeMobileNavigation() {

    mobileNavigation.classList.remove(
      "open"
    );

    mobileToggle.setAttribute(
      "aria-expanded",
      "false"
    );

    mobileToggle.setAttribute(
      "aria-label",
      "Open menu"
    );

  }


  function openMobileNavigation() {

    mobileNavigation.classList.add(
      "open"
    );

    mobileToggle.setAttribute(
      "aria-expanded",
      "true"
    );

    mobileToggle.setAttribute(
      "aria-label",
      "Close menu"
    );

  }


  mobileToggle.addEventListener(
    "click",
    function () {

      const isOpen =
        mobileNavigation.classList.contains(
          "open"
        );


      if (isOpen) {

        closeMobileNavigation();

      } else {

        openMobileNavigation();

      }

    }
  );


  mobileNavigation
    .querySelectorAll("a")
    .forEach(
      function (link) {

        link.addEventListener(
          "click",
          closeMobileNavigation
        );

      }
    );


  /* =======================================================
     ESCAPE KEY
  ======================================================= */

  document.addEventListener(
    "keydown",
    function (event) {

      if (
        event.key === "Escape"
      ) {

        if (
          mobileNavigation.classList.contains(
            "open"
          )
        ) {

          closeMobileNavigation();

        }

      }

    }
  );


  /* =======================================================
     PUBLIC API
  ======================================================= */

  window.BarakaLinkNavigation = {

    close:
      closeMobileNavigation,

    open:
      openMobileNavigation

  };


  /* =======================================================
     AUTH / BODY CONNECTION
  ======================================================= */

  window.BarakaLinkNavigationBody =
    body;

})();