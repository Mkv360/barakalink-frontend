

  document
    .querySelectorAll('.legal-mobile-nav-links a')
    .forEach(function (link) {

      link.addEventListener('click', function () {

        var details =
          link.closest('details');

        if (details) {
          details.removeAttribute('open');
        }

      });

    });


(function () {

  'use strict';


  /* =====================================================
     ELEMENTS
  ====================================================== */

  const sections = Array.from(
    document.querySelectorAll(
      '.legal-section[id]'
    )
  );


  const desktopLinks = Array.from(
    document.querySelectorAll(
      '.legal-sidebar a[href^="#"]'
    )
  );


  const mobileLinks = Array.from(
    document.querySelectorAll(
      '.legal-mobile-nav-links a[href^="#"]'
    )
  );


  const mobileDetails =
    document.querySelector(
      '.legal-mobile-nav details'
    );


  /* =====================================================
     ACTIVE STATE
  ====================================================== */

  function setActiveSection(id) {

    if (!id) {
      return;
    }


    desktopLinks.forEach(function (link) {

      const isActive =
        link.getAttribute('href') === '#' + id;

      link.classList.toggle(
        'active',
        isActive
      );

    });


    mobileLinks.forEach(function (link) {

      const isActive =
        link.getAttribute('href') === '#' + id;

      link.classList.toggle(
        'active',
        isActive
      );

    });

  }


  /* =====================================================
     CLICK HANDLING
  ====================================================== */

  function handleSectionClick(link) {

    link.addEventListener(
      'click',
      function () {

        const href =
          link.getAttribute('href');

        if (!href || href === '#') {
          return;
        }


        const id =
          href.substring(1);

        setActiveSection(id);


        if (mobileDetails) {
          mobileDetails.removeAttribute(
            'open'
          );
        }

      }
    );

  }


  desktopLinks.forEach(
    handleSectionClick
  );


  mobileLinks.forEach(
    handleSectionClick
  );


  /* =====================================================
     SCROLL TRACKING
  ====================================================== */

  if ('IntersectionObserver' in window) {

    const observer =
      new IntersectionObserver(
        function (entries) {

          const visibleSections =
            entries
              .filter(function (entry) {
                return entry.isIntersecting;
              })
              .sort(function (a, b) {
                return (
                  a.boundingClientRect.top -
                  b.boundingClientRect.top
                );
              });


          if (visibleSections.length) {

            setActiveSection(
              visibleSections[0]
                .target
                .id
            );

          }

        },
        {
          root: null,

          rootMargin:
            '-120px 0px -55% 0px',

          threshold:
            [0, 0.1, 0.25, 0.5]
        }
      );


    sections.forEach(function (section) {
      observer.observe(section);
    });

  }


  /* =====================================================
     INITIAL HASH
  ====================================================== */

  const initialHash =
    window.location.hash.replace(
      '#',
      ''
    );


  if (initialHash) {

    setActiveSection(
      initialHash
    );

  } else {

    setActiveSection(
      'terms'
    );

  }

})();
