"use strict";

/* =========================================================
   BARAKALINK — USTAZ DASHBOARD NAVIGATION
========================================================= */

import { clearSession } from "./teacher-auth.js";

import {
  $,
  $$,
  closeNotificationPanel,
  closeProfileMenu,
  setText,
  toggleProfileMenu,
} from "./teacher-dom.js";

import {
  CONFIG,
  state,
} from "./teacher-state.js";

/* =========================================================
   BARAKALINK — DASHBOARD NAVIGATION LOADER
   Integrated into the existing navigation module.
========================================================= */

let navigationLoaderHideTimer = null;
let navigationPageLoaderFallbackTimer = null;


function ensureNavigationLoader() {
  let loader = $("ustazNavigationLoader");

  if (loader) {
    return loader;
  }

  loader = document.createElement("div");
  loader.id = "ustazNavigationLoader";
  loader.className = "ustaz-navigation-loader";
  loader.hidden = true;
  loader.setAttribute("aria-hidden", "true");

  loader.innerHTML = `
    <div
      class="ustaz-navigation-loader-card"
      role="status"
      aria-live="polite"
    >
      <div class="ustaz-navigation-loader-brand">
        <span class="ustaz-navigation-loader-brand-icon">
          <i class="fa-solid fa-book-quran" aria-hidden="true"></i>
        </span>
        <strong>BarakaLink</strong>
      </div>

      <span
        class="ustaz-navigation-loader-spinner"
        aria-hidden="true"
      ></span>

      <strong
        class="ustaz-navigation-loader-message"
        data-ustaz-navigation-loader-message
      >
        Preparing your teaching space...
      </strong>

      <span class="ustaz-navigation-loader-caption">
        Please wait a moment
      </span>
    </div>
  `;

  document.body.appendChild(loader);

  return loader;
}


function showNavigationLoader(
  message = "Preparing your teaching space..."
) {
  if (navigationLoaderHideTimer !== null) {
    window.clearTimeout(navigationLoaderHideTimer);
    navigationLoaderHideTimer = null;
  }

  const loader = ensureNavigationLoader();

  const messageElement = loader.querySelector(
    "[data-ustaz-navigation-loader-message]"
  );

  if (messageElement) {
    messageElement.textContent = message;
  }

  loader.hidden = false;
  loader.setAttribute("aria-hidden", "false");

  // Allow the browser to apply the initial state before fading in.
  requestAnimationFrame(() => {
    if (!loader.hidden) {
      loader.classList.add("is-visible");
    }
  });
}


function hideNavigationLoaderAfter(delay = 220) {
  if (navigationLoaderHideTimer !== null) {
    window.clearTimeout(navigationLoaderHideTimer);
  }

  navigationLoaderHideTimer = window.setTimeout(() => {
    const loader = $("ustazNavigationLoader");

    if (!loader) {
      navigationLoaderHideTimer = null;
      return;
    }

    loader.classList.remove("is-visible");
    loader.setAttribute("aria-hidden", "true");

    navigationLoaderHideTimer = window.setTimeout(() => {
      if (!loader.classList.contains("is-visible")) {
        loader.hidden = true;
      }

      navigationLoaderHideTimer = null;
    }, 180);
  }, delay);
}


/*
 * Display the loader when leaving the dashboard for another
 * same-origin HTML page. Links handled by the existing
 * section navigation or Coming Soon modal are left alone.
 */
function setupNavigationLoaderLinks() {
  if (
    document.documentElement.dataset
      .ustazPageLoaderBound === "1"
  ) {
    return;
  }

  document.documentElement.dataset.ustazPageLoaderBound = "1";

  document.addEventListener("click", (event) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    const target = event.target;

    if (!(target instanceof Element)) {
      return;
    }

    const link = target.closest("a[href]");

    if (
      !link ||
      link.hasAttribute("download")
    ) {
      return;
    }

    const targetWindow = link.getAttribute("target");

    if (
      targetWindow &&
      targetWindow.toLowerCase() !== "_self"
    ) {
      return;
    }

    const href = link.getAttribute("href")?.trim();

    if (
      !href ||
      href.startsWith("#") ||
      /^javascript:/i.test(href)
    ) {
      return;
    }

    let destination;

    try {
      destination = new URL(link.href, window.location.href);
    } catch {
      return;
    }

    if (destination.origin !== window.location.origin) {
      return;
    }

    // Same document: let the existing section navigation handle it.
    if (
      destination.pathname === window.location.pathname &&
      destination.search === window.location.search
    ) {
      return;
    }

    showNavigationLoader("Opening page...");

    if (navigationPageLoaderFallbackTimer !== null) {
      window.clearTimeout(navigationPageLoaderFallbackTimer);
    }

    // If navigation does not occur, don't leave the overlay stuck.
    navigationPageLoaderFallbackTimer = window.setTimeout(() => {
      navigationPageLoaderFallbackTimer = null;
      hideNavigationLoaderAfter(0);
    }, 5000);
  });
}


/* =========================================================
   STUDENTS SUB-NAVIGATION TARGETS
========================================================= */

/*
 * The old "student-requests" subsection has been removed
 * together with the old learning-request architecture.
 *
 * Current Students navigation:
 *
 *   Students Overview
 *   Active Students
 *
 * Keep "active-students" only if that section is still part
 * of the current Ustaz dashboard UI.
 */

const STUDENTS_SUBSECTION_TARGETS =
  Object.freeze([
    "students-overview",
  ]);


/* =========================================================
   THEME
========================================================= */

function getSavedTheme() {

  try {

    const saved =
      localStorage.getItem(
        CONFIG.THEME_KEY
      );


    return (
      saved === "light" ||
      saved === "dark"
    )
      ? saved
      : null;

  } catch (_) {

    return null;

  }

}


function getInitialTheme() {

  const saved =
    getSavedTheme();


  if (saved) {
    return saved;
  }


  try {

    if (
      window.matchMedia &&
      window.matchMedia(
        "(prefers-color-scheme: dark)"
      ).matches
    ) {

      return "dark";

    }

  } catch (_) {}


  return "light";

}


function applyTheme(
  theme
) {

  const value =
    theme === "dark"
      ? "dark"
      : "light";


  const isDark =
    value === "dark";


  document.documentElement.dataset.theme =
    value;


  document.documentElement.setAttribute(
    "data-theme",
    value
  );


  document.body.classList.toggle(
    "dark-theme",
    isDark
  );


  const meta =
    $("themeColorMeta");


  if (meta) {

    meta.setAttribute(
      "content",
      isDark
        ? "#17130F"
        : "#FBF7EE"
    );

  }


  const button =
    $("themeToggle");


  if (button) {

    const icon =
      button.querySelector("i");


    if (icon) {

      icon.className =
        isDark
          ? "fa-solid fa-sun"
          : "fa-solid fa-moon";

    }


    button.setAttribute(
      "aria-label",
      isDark
        ? "Switch to light theme"
        : "Switch to dark theme"
    );

  }


  const switchButton =
    $("ustazThemeSwitch");


  if (switchButton) {

    switchButton.setAttribute(
      "aria-checked",
      isDark
        ? "true"
        : "false"
    );

  }


  try {

    localStorage.setItem(
      CONFIG.THEME_KEY,
      value
    );

  } catch (_) {}

}


function toggleTheme() {

  const current =
    document.body.classList.contains(
      "dark-theme"
    )
      ? "dark"
      : "light";


  applyTheme(
    current === "dark"
      ? "light"
      : "dark"
  );

}


function setupTheme() {

  applyTheme(
    getInitialTheme()
  );


  const themeToggle =
    $("themeToggle");


  if (
    themeToggle &&
    themeToggle.dataset
      .ustazThemeBound !== "1"
  ) {

    themeToggle.dataset
      .ustazThemeBound =
      "1";


    themeToggle.addEventListener(
      "click",
      toggleTheme
    );

  }


  const themeSwitch =
    $("ustazThemeSwitch");


  if (
    themeSwitch &&
    themeSwitch.dataset
      .ustazThemeBound !== "1"
  ) {

    themeSwitch.dataset
      .ustazThemeBound =
      "1";


    themeSwitch.addEventListener(
      "click",
      toggleTheme
    );

  }

}


/* =========================================================
   MOBILE SIDEBAR
========================================================= */

function isMobileSidebarMode() {

  return window.matchMedia
    ? window.matchMedia(
        "(max-width: 900px)"
      ).matches
    : window.innerWidth <= 900;

}


function setSidebarAria(
  open
) {

  const toggle =
    $("ustazMenuToggle");


  const sidebar =
    $("ustazSidebar");


  const overlay =
    $("ustazSidebarOverlay");


  if (toggle) {

    toggle.setAttribute(
      "aria-expanded",
      open
        ? "true"
        : "false"
    );


    toggle.setAttribute(
      "aria-label",
      open
        ? "Close navigation"
        : "Open navigation"
    );

  }


  if (sidebar) {

    const hiddenOnMobile =
      isMobileSidebarMode() &&
      !open;


    sidebar.setAttribute(
      "aria-hidden",
      hiddenOnMobile
        ? "true"
        : "false"
    );

  }


  if (overlay) {

    overlay.setAttribute(
      "aria-hidden",
      open
        ? "false"
        : "true"
    );

  }

}


function closeSidebar() {

  const root =
    $("ustazDashboard");


  if (!root) {
    return;
  }


  const sidebar =
    $("ustazSidebar");


  state.sidebarOpen =
    false;


  root.classList.remove(
    "sidebar-open"
  );


  root.classList.remove(
    "ustaz-sidebar-open"
  );


  if (sidebar) {

    sidebar.classList.remove(
      "is-open"
    );

  }


  document.body.classList.remove(
    "ustaz-dashboard-sidebar-open"
  );


  document.body.classList.remove(
    "ustaz-dashboard-scroll-locked"
  );


  setSidebarAria(
    false
  );

}


function openSidebar() {

  const root =
    $("ustazDashboard");


  const sidebar =
    $("ustazSidebar");


  if (
    !root ||
    !sidebar ||
    !isMobileSidebarMode()
  ) {

    return;

  }


  closeProfileMenu();

  closeNotificationPanel();


  state.sidebarOpen =
    true;


  root.classList.add(
    "sidebar-open"
  );


  root.classList.add(
    "ustaz-sidebar-open"
  );


  sidebar.classList.add(
    "is-open"
  );


  document.body.classList.add(
    "ustaz-dashboard-sidebar-open"
  );


  document.body.classList.add(
    "ustaz-dashboard-scroll-locked"
  );


  setSidebarAria(
    true
  );

}


/* =========================================================
   PROFILE MENU
========================================================= */

function setupProfileMenu() {

  const menu =
    $("ustazProfileMenu");


  const buttons = [
    $("ustazAvatarButton"),
    $("ustazSidebarProfileButton"),
  ]
    .filter(Boolean);


  if (!menu) {
    return;
  }


  buttons.forEach(
    (button) => {

      if (
        button.dataset
          .ustazProfileBound === "1"
      ) {

        return;

      }


      button.dataset
        .ustazProfileBound =
        "1";


      button.addEventListener(
        "click",
        (event) => {

          event.preventDefault();

          event.stopPropagation();


          toggleProfileMenu(
            button
          );

        }
      );

    }
  );

}


/* =========================================================
   GLOBAL INTERACTION
========================================================= */

function setupGlobalInteraction() {

  if (
    document.body.dataset
      .ustazGlobalInteractionBound ===
    "1"
  ) {

    return;

  }


  document.body.dataset
    .ustazGlobalInteractionBound =
    "1";


  document.addEventListener(
    "click",
    (event) => {

      const target =
        event.target;


      if (
        !(target instanceof Element)
      ) {

        return;

      }


      const profileMenu =
        $("ustazProfileMenu");


      const profileButtons = [
        $("ustazAvatarButton"),
        $("ustazSidebarProfileButton"),
      ]
        .filter(Boolean);


      const notificationPanel =
        $("ustazNotificationPanel");


      const notificationButton =
        $("ustazNotificationButton");


      if (
        profileMenu &&
        !profileMenu.contains(
          target
        ) &&
        !profileButtons.some(
          (button) =>
            button.contains(
              target
            )
        )
      ) {

        closeProfileMenu();

      }


      if (
        notificationPanel &&
        notificationButton &&
        !notificationPanel.contains(
          target
        ) &&
        !notificationButton.contains(
          target
        )
      ) {

        closeNotificationPanel();

      }

    }
  );


  document.addEventListener(
    "keydown",
    (event) => {

      if (
        event.key !== "Escape"
      ) {

        return;

      }


      if (
        state.sidebarOpen
      ) {

        closeSidebar();

      }


      if (
        state.profileMenuOpen
      ) {

        closeProfileMenu();

      }


      if (
        state.notificationPanelOpen
      ) {

        closeNotificationPanel();

      }

    }
  );

}


/* =========================================================
   SIDEBAR
========================================================= */

function setupSidebar() {

  const menuToggle =
    $("ustazMenuToggle");


  const sidebarClose =
    $("ustazSidebarClose");


  const overlay =
    $("ustazSidebarOverlay");


  if (
    menuToggle &&
    menuToggle.dataset
      .ustazSidebarBound !== "1"
  ) {

    menuToggle.dataset
      .ustazSidebarBound =
      "1";


    menuToggle.addEventListener(
      "click",
      (event) => {

        event.preventDefault();

        event.stopPropagation();


        if (
          state.sidebarOpen
        ) {

          closeSidebar();

        } else {

          openSidebar();

        }

      }
    );

  }


  if (
    sidebarClose &&
    sidebarClose.dataset
      .ustazSidebarBound !== "1"
  ) {

    sidebarClose.dataset
      .ustazSidebarBound =
      "1";


    sidebarClose.addEventListener(
      "click",
      (event) => {

        event.preventDefault();

        closeSidebar();

      }
    );

  }


  if (
    overlay &&
    overlay.dataset
      .ustazSidebarBound !== "1"
  ) {

    overlay.dataset
      .ustazSidebarBound =
      "1";


    overlay.addEventListener(
      "click",
      closeSidebar
    );

  }


  if (
    window.__barakaLinkUstazSidebarResizeBound
  ) {

    return;

  }


  window.__barakaLinkUstazSidebarResizeBound =
    true;


  window.addEventListener(
    "resize",
    () => {

      if (
        !isMobileSidebarMode()
      ) {

        closeSidebar();

      }

    }
  );

}


/* =========================================================
   LOGOUT
========================================================= */

function logout() {

  try {

    localStorage.removeItem(
      CONFIG.THEME_KEY
    );

  } catch (_) {}


  clearSession();


  window.location.replace(
    CONFIG.LOGIN_PATH
  );

}


function setupLogout() {

  [
    $("ustazSidebarLogout"),
    $("ustazMenuLogout"),
    $("ustazSettingsLogout"),
  ]
    .filter(Boolean)
    .forEach(
      (button) => {

        if (
          button.dataset
            .ustazLogoutBound === "1"
        ) {

          return;

        }


        button.dataset
          .ustazLogoutBound =
          "1";


        button.addEventListener(
          "click",
          logout
        );

      }
    );

}


/* =========================================================
   HASH LISTENER
========================================================= */

function setupHashListener() {

  if (
    window.__barakaLinkUstazHashBound
  ) {

    return;

  }


  window.__barakaLinkUstazHashBound =
    true;


  window.addEventListener(
    "hashchange",
    () => {

      const requested =
        window.location.hash
          .replace(
            /^#/,
            ""
          )
          .trim();


      const allowed =
        new Set([
          "home",
          "profile",
          "students",
          "messages",
          "availability",
          "support",
          "settings",
        ]);


      if (
        allowed.has(
          requested
        )
      ) {

        setSection(
          requested
        );

      }

    }
  );

}


/* =========================================================
   STUDENTS SUBSECTION HELPERS
========================================================= */

function isStudentsSubsection(
  target
) {

  return STUDENTS_SUBSECTION_TARGETS.includes(
    target
  );

}


function setActiveStudentsSidebarLink(
  target
) {

  $$(
    ".ustaz-students-sidebar-link, [data-students-target]"
  )
    .forEach(
      (link) => {

        const isActive =
          Boolean(target) &&
          link.dataset.studentsTarget ===
            target;


        link.classList.toggle(
          "active",
          isActive
        );

      }
    );

}


function setStudentsSidebarOpen(
  isOpen
) {

  const navItem =
    document.querySelector(
      ".ustaz-nav-item-with-subnav"
    );


  if (!navItem) {

    return;

  }


  navItem.classList.toggle(
    "is-open",
    Boolean(isOpen)
  );

}


/* =========================================================
   SET TOP-LEVEL SECTION
========================================================= */

function setSection(
  section,
  updateHash = true,
  scrollToTop = true
) {
const allowed = new Set([
  "home",
  "profile",
  "students",
  "messages",
  "availability",
  "support",
  "report",
  "help",
  "settings",
]);


  const validSection =
    allowed.has(section)
      ? section
      : "home";


  state.section =
    validSection;


  /* -------------------------------------------------------
     Show exactly one real dashboard section
  ------------------------------------------------------- */

  $$(
    "[data-section-panel]"
  )
    .forEach(
      (panel) => {

        panel.hidden =
          panel.dataset.sectionPanel !==
          state.section;

      }
    );


  /* -------------------------------------------------------
     Main sidebar active state
  ------------------------------------------------------- */

  $$(
    "[data-section]"
  )
    .forEach(
      (link) => {

        link.classList.toggle(
          "active",
          link.dataset.section ===
            state.section
        );

      }
    );


  /* -------------------------------------------------------
     Students internal navigation
  ------------------------------------------------------- */

  if (
    state.section === "students"
  ) {

    setStudentsSidebarOpen(
      true
    );


    /*
     * When entering Students from a top-level link,
     * default to Students Overview.
     */
    setActiveStudentsSidebarLink(
      "students-overview"
    );

  } else {

    setStudentsSidebarOpen(
      false
    );


    setActiveStudentsSidebarLink(
      null
    );

  }


  /* -------------------------------------------------------
     Section titles
  ------------------------------------------------------- */

  const titles = {

    home: [
      "Dashboard",
      "Overview",
    ],

    profile: [
      "Profile",
      "My Profile",
    ],

    students: [
      "Teaching",
      "Students",
    ],

    messages: [
      "Communication",
      "Messages",
    ],

    availability: [
      "Schedule",
      "Availability",
    ],

    support: [
      "Support",
      "Support Baraka",
    ],
report: [
  "Help & Feedback",
  "Report & Feedback",
],

help: [
  "Help & Contact",
  "Help & Contact",
],
    settings: [
      "Account",
      "Settings",
    ],

  };


  setText(
    "ustazSectionEyebrow",
    titles[validSection][0]
  );


  setText(
    "ustazSectionTitle",
    titles[validSection][1]
  );


  /* -------------------------------------------------------
     URL
  ------------------------------------------------------- */

  if (
    updateHash &&
    window.location.hash !==
      `#${validSection}`
  ) {

    history.replaceState(
      null,
      "",
      `#${validSection}`
    );

  }


  closeSidebar();


  if (scrollToTop) {

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });

  }

}


/* =========================================================
   SHOW STUDENTS SUBSECTION
========================================================= */

function showStudentsSubsection(
  target,
  updateHash = true
) {

  const validTarget =
    isStudentsSubsection(
      target
    )
      ? target
      : "students-overview";


  /*
   * Students remains the real dashboard section.
   */
  setSection(
    "students",
    false,
    false
  );


  /* -------------------------------------------------------
     Hide all Students internal views
  ------------------------------------------------------- */

  $$(
    "[data-ustaz-students-view]"
  )
    .forEach(
      (view) => {

        view.hidden =
          view.dataset.ustazStudentsView !==
            validTarget;

      }
    );


  setActiveStudentsSidebarLink(
    validTarget
  );


  setStudentsSidebarOpen(
    true
  );


  /* -------------------------------------------------------
     Internal subsection URL
  ------------------------------------------------------- */

  if (
    updateHash &&
    window.location.hash !==
      `#${validTarget}`
  ) {

    history.replaceState(
      null,
      "",
      `#${validTarget}`
    );

  }


  /*
   * IMPORTANT:
   *
   * The old incoming-learning-request loader has been
   * completely removed.
   *
   * There is intentionally NO call here to:
   *
   *   ensureIncomingLearningRequestsForView()
   */


  const targetElement =
    $(validTarget);


  if (targetElement) {

    targetElement.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });

  }

}


/* =========================================================
   SETUP NAVIGATION
========================================================= */

function setupNavigation() {

  /* -------------------------------------------------------
     Top-level sidebar navigation
  ------------------------------------------------------- */

  $$(
    "[data-section]"
  )
    .forEach(
      (link) => {

        if (
          link.dataset
            .ustazNavigationBound === "1"
        ) {

          return;

        }


        link.dataset
          .ustazNavigationBound =
          "1";


        link.addEventListener(
          "click",
          (event) => {

            event.preventDefault();


            const section =
              link.dataset.section;


            /*
             * Clicking Students opens Overview.
             */
            if (
              section === "students"
            ) {

              showStudentsSubsection(
                "students-overview"
              );


              return;

            }


            setSection(
              section
            );

          }
        );

      }
    );


  /* -------------------------------------------------------
     Generic dashboard links
  ------------------------------------------------------- */

  $$(
    "[data-section-link]"
  )
    .forEach(
      (link) => {

        if (
          link.dataset
            .ustazSectionLinkBound === "1"
        ) {

          return;

        }


        link.dataset
          .ustazSectionLinkBound =
          "1";


        link.addEventListener(
          "click",
          (event) => {

            event.preventDefault();


            setSection(
              link.dataset.sectionLink
            );

          }
        );

      }
    );


  /* -------------------------------------------------------
     Students internal sidebar links
  ------------------------------------------------------- */

  $$(
    "[data-students-target]"
  )
    .forEach(
      (link) => {

        if (
          link.dataset
            .ustazStudentsNavigationBound === "1"
        ) {

          return;

        }


        link.dataset
          .ustazStudentsNavigationBound =
          "1";


        const target =
          link.dataset.studentsTarget;


        if (
          !isStudentsSubsection(
            target
          )
        ) {

          return;

        }


        link.addEventListener(
          "click",
          (event) => {

            event.preventDefault();


            showStudentsSubsection(
              target
            );

          }
        );

      }
    );


  /* -------------------------------------------------------
     Hash navigation
  ------------------------------------------------------- */

  if (
    !window.__barakaLinkUstazStudentsHashBound
  ) {

    window.__barakaLinkUstazStudentsHashBound =
      true;


    window.addEventListener(
      "hashchange",
      () => {

        const hash =
          window.location.hash
            .replace(
              /^#/,
              ""
            )
            .trim();


        if (
          isStudentsSubsection(
            hash
          )
        ) {

          showStudentsSubsection(
            hash,
            false
          );


          return;

        }


        if (
          hash === "student-requests"
        ) {

          /*
           * Backward compatibility for an old saved URL.
           *
           * The request section no longer exists, so redirect
           * that URL to Students Overview.
           */
          showStudentsSubsection(
            "students-overview",
            false
          );


          return;

        }


        setSection(
          hash || "home",
          false
        );

      }
    );

  }


  /* -------------------------------------------------------
     Initial URL
  ------------------------------------------------------- */

  const initialHash =
    window.location.hash
      .replace(
        /^#/,
        ""
      )
      .trim();


  if (
    isStudentsSubsection(
      initialHash
    )
  ) {

    showStudentsSubsection(
      initialHash,
      false
    );

  } else if (
    initialHash === "students"
  ) {

    showStudentsSubsection(
      "students-overview",
      false
    );

  } else if (
    initialHash === "student-requests"
  ) {

    /*
     * Old URL -> current Students Overview.
     */
    showStudentsSubsection(
      "students-overview",
      false
    );

  } else {

    setSection(
      initialHash || "home",
      false
    );

  }

}


/* =========================================================
   EXPORTS
========================================================= */

export {
  getSavedTheme,
  getInitialTheme,
  applyTheme,
  toggleTheme,
  setupTheme,

  isMobileSidebarMode,
  setSidebarAria,
  closeSidebar,
  openSidebar,

  setupProfileMenu,
  setupGlobalInteraction,
  setupSidebar,

  logout,
  setupLogout,

  setupHashListener,

  isStudentsSubsection,
  setActiveStudentsSidebarLink,
  setStudentsSidebarOpen,

  setSection,
  showStudentsSubsection,

  setupNavigation,
};