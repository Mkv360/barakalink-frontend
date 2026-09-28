(function () {

  "use strict";


  /* =======================================================
     BARAKALINK — FILTER CHIPS
  ======================================================= */

  const filterChips =
    document.querySelectorAll(
      ".filter-chip"
    );


  if (
    !filterChips.length
  ) {
    return;
  }


  filterChips.forEach(
    function (chip) {

      chip.addEventListener(
        "click",
        function () {

          filterChips.forEach(
            function (item) {

              item.classList.remove(
                "active"
              );

            }
          );


          chip.classList.add(
            "active"
          );

        }
      );

    }
  );

})();