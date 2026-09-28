(function () {

  "use strict";


  /* =======================================================
     BARAKALINK — LANDING PAGE
     
     Main entry point.
     
     Feature-specific behavior lives in separate files:
     
     navigation.js
     theme.js
     auth.js
     filters.js
     contact.js
  ======================================================= */


  /* =======================================================
     LANGUAGE
  ======================================================= */

  const languageButton =
    document.getElementById(
      "languageButton"
    );

  const languageMenu =
    document.getElementById(
      "languageMenu"
    );


  if (
    languageButton &&
    languageMenu
  ) {

    languageButton.addEventListener(
      "click",
      function (event) {

        event.stopPropagation();


        const open =
          languageMenu.classList.toggle(
            "open"
          );


        languageButton.setAttribute(
          "aria-expanded",
          String(open)
        );

      }
    );


    languageMenu
      .querySelectorAll(
        "[data-language]"
      )
      .forEach(
        function (button) {

          button.addEventListener(
            "click",
            function () {

              const selectedLanguage =
                button.dataset.language;


              languageMenu.classList.remove(
                "open"
              );


              languageButton.setAttribute(
                "aria-expanded",
                "false"
              );


              /*
                 Connect this to the real
                 BarakaLink language system.
              */

              console.log(
                "Selected language:",
                selectedLanguage
              );

            }
          );

        }
      );


    document.addEventListener(
      "click",
      function () {

        languageMenu.classList.remove(
          "open"
        );


        languageButton.setAttribute(
          "aria-expanded",
          "false"
        );

      }
    );

  }


  /* =======================================================
     LANDING PAGE READY
  ======================================================= */

  document.dispatchEvent(
    new CustomEvent(
      "barakalink:landing-ready"
    )
  );

})();