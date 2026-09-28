(function () {

  "use strict";


  /* =======================================================
     BARAKALINK — CONTACT FORM
  ======================================================= */

  const contactForm =
    document.getElementById(
      "contactForm"
    );


  if (
    !contactForm
  ) {
    return;
  }


  contactForm.addEventListener(
    "submit",
    function (event) {

      event.preventDefault();


      /* ---------------------------------------------------
         Require authentication
      --------------------------------------------------- */

      const token =
        localStorage.getItem(
          "barakalink_token"
        );


      if (!token) {

        if (
          window.BarakaLinkAuth
        ) {

          window.BarakaLinkAuth.open(
            "signup"
          );

        }

        return;

      }


      /* ---------------------------------------------------
         Fields
      --------------------------------------------------- */

      const firstName =
        document
          .getElementById(
            "contactFirstName"
          )
          ?.value
          .trim() || "";


      const lastName =
        document
          .getElementById(
            "contactLastName"
          )
          ?.value
          .trim() || "";


      const phone =
        document
          .getElementById(
            "contactPhone"
          )
          ?.value
          .trim() || "";


      const message =
        document
          .getElementById(
            "contactMessage"
          )
          ?.value
          .trim() || "";


      const status =
        document.getElementById(
          "contactStatus"
        );


      /* ---------------------------------------------------
         Validation
      --------------------------------------------------- */

      if (
        !firstName ||
        !lastName ||
        !phone ||
        !message
      ) {

        if (status) {

          status.textContent =
            "Please complete all fields.";

        }

        return;

      }


      /* ---------------------------------------------------
         TEMPORARY FRONTEND VERSION
      --------------------------------------------------- */

      if (status) {

        status.textContent =
          "Your message is ready to be sent through the BarakaLink API.";

      }

    }
  );

})();