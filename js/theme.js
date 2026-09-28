(function () {

  "use strict";


  /* =======================================================
     BARAKALINK — THEME
  ======================================================= */

  const body =
    document.body;

  const themeToggle =
    document.getElementById(
      "themeToggle"
    );

  const themeColorMeta =
    document.getElementById(
      "themeColorMeta"
    );


  if (
    !themeToggle
  ) {
    return;
  }


  const themeIcon =
    themeToggle.querySelector(
      "i"
    );


  /* =======================================================
     APPLY THEME
  ======================================================= */

  function applyTheme(
    theme
  ) {

    const isDark =
      theme === "dark";


    body.classList.toggle(
      "dark-theme",
      isDark
    );


    if (themeIcon) {

      themeIcon.className =
        isDark
          ? "fa-solid fa-sun"
          : "fa-solid fa-moon";

    }


    themeToggle.setAttribute(
      "aria-label",
      isDark
        ? "Switch to light theme"
        : "Switch to dark theme"
    );


    if (
      themeColorMeta
    ) {

      themeColorMeta.setAttribute(
        "content",
        isDark
          ? "#17130F"
          : "#FBF7EE"
      );

    }


    localStorage.setItem(
      "baraka_theme",
      isDark
        ? "dark"
        : "light"
    );

  }


  /* =======================================================
     LOAD SAVED THEME
  ======================================================= */

  const savedTheme =
    localStorage.getItem(
      "baraka_theme"
    );


  applyTheme(
    savedTheme === "dark"
      ? "dark"
      : "light"
  );


  /* =======================================================
     TOGGLE
  ======================================================= */

  themeToggle.addEventListener(
    "click",
    function () {

      const currentlyDark =
        body.classList.contains(
          "dark-theme"
        );


      applyTheme(
        currentlyDark
          ? "light"
          : "dark"
      );

    }
  );


  /* =======================================================
     PUBLIC API
  ======================================================= */

  window.BarakaLinkTheme = {

    apply:
      applyTheme

  };

})();