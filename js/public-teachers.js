

"use strict";

/* BARAKALINK — PUBLIC LANDING-PAGE TEACHERS
   Loads approved Ustaz profiles from the existing backend.
   Does not require a logged-in parent.
*/

(() => {
  const grid = document.querySelector(".popular-teacher-grid");

  if (!grid) return;

  const LAN_TEST_API_BASE = "http://10.82.205.51:5000/api";
  const API_MODE_KEY = "barakalink_api_mode";

  function isPrivateIPv4(hostname) {
    const parts = String(hostname || "").split(".");

    if (
      parts.length !== 4 ||
      parts.some(
        part =>
          !/^\d{1,3}$/.test(part) ||
          Number(part) > 255
      )
    ) {
      return false;
    }

    const [a, b] = parts.map(Number);

    return (
      a === 10 ||
      (a === 192 && b === 168) ||
      (a === 172 && b >= 16 && b <= 31)
    );
  }

  function getApiMode() {
    const params = new URLSearchParams(window.location.search);
    const requestedMode = params.get("api");

    try {
      if (requestedMode === "lan") {
        sessionStorage.setItem(API_MODE_KEY, "lan");
      } else if (requestedMode === "public") {
        sessionStorage.removeItem(API_MODE_KEY);
      }

      return sessionStorage.getItem(API_MODE_KEY) || "public";
    } catch (_) {
      return requestedMode === "lan" ? "lan" : "public";
    }
  }

  const apiMode = getApiMode();

  function resolveApiBase() {
    // Explicit temporary LAN testing mode.
    if (apiMode === "lan") {
      return LAN_TEST_API_BASE;
    }

    // Prefer the shared BarakaLink API configuration.
    const configuredBase = String(
      window.BarakaLinkAPI?.base ||
      window.BARAKALINK_API_BASE ||
      window.BARAKALINK_PUBLIC_API_BASE ||
      ""
    ).trim().replace(/\/+$/, "");

    if (configuredBase) {
      return configuredBase;
    }

    const hostname = window.location.hostname;

    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1"
    ) {
      return "http://localhost:5000/api";
    }

    // For a frontend served directly from a PC's private LAN address.
    if (isPrivateIPv4(hostname)) {
      return `http://${hostname}:5000/api`;
    }

    // Do not accidentally construct https://github-host:5000/api.
    return "";
  }

  const apiBase = resolveApiBase();

  const makeText = (tag, className, value) => {
    const element = document.createElement(tag);

    if (className) element.className = className;

    element.textContent = value || "";

    return element;
  };

  const getInitials = (teacher) => {
    const first = String(teacher.first_name || "").trim();
    const last = String(teacher.last_name || "").trim();

    return (
      `${first.charAt(0)}${last.charAt(0)}`.toUpperCase() ||
      "U"
    );
  };

  const getName = (teacher) => {
    const name = [
      teacher.first_name,
      teacher.last_name
    ].filter(Boolean).join(" ").trim();

    return name || (
      String(teacher.gender).toLowerCase() === "female"
        ? "Ustaza"
        : "Ustaz"
    );
  };

  const getLocation = (teacher) => {
    return [
      teacher.area,
      teacher.subcity
    ].filter(Boolean).join(", ") || "Location not provided";
  };

  const getExperience = (teacher) => {
    const years = Number(teacher.experience);

    if (!Number.isFinite(years) || years < 0) {
      return "Experience not provided";
    }

    return `${years}+ ${years === 1 ? "year" : "years"} experience`;
  };

  const resolveAvatarUrl = (avatarUrl) => {
    const value = String(avatarUrl || "").trim();

    if (!value || !apiBase) return "";

    try {
      return new URL(value, apiBase).href;
    } catch (_) {
      return "";
    }
  };

  const addAvatar = (container, teacher, large = false) => {
    const avatarUrl = resolveAvatarUrl(teacher.avatar_url);

    if (!avatarUrl) {
      container.textContent = getInitials(teacher);
      return;
    }

    const avatar = document.createElement("img");

    avatar.src = avatarUrl;
    avatar.alt = `${getName(teacher)} profile photo`;
    avatar.loading = "lazy";
    avatar.decoding = "async";
    avatar.style.cssText =
      "width:100%;height:100%;object-fit:cover;border-radius:inherit;";

    avatar.addEventListener("error", () => {
      avatar.remove();

      if (!container.querySelector("img")) {
        container.textContent = getInitials(teacher);
      }
    }, { once: true });

    if (large) {
      container.replaceChildren(avatar);
    } else {
      container.replaceChildren(avatar);
    }
  };

  const createTeacherCard = (teacher) => {
    const card = document.createElement("article");
    card.className = "popular-teacher-card";

    const genderClass =
      String(teacher.gender).toLowerCase() === "female"
        ? "female"
        : "male";

    const image = document.createElement("div");
    image.className = `popular-teacher-image ${genderClass}`;

    addAvatar(image, teacher);

    const content = makeText("div", "popular-teacher-content");
    const top = makeText("div", "popular-teacher-top");
    const nameWrap = document.createElement("div");

    nameWrap.append(makeText("h3", "", getName(teacher)));
    top.append(nameWrap);
    content.append(top);

    content.append(
      makeText("div", "popular-location", `📍 ${getLocation(teacher)}`)
    );

    const tags = makeText("div", "popular-tags");

    const fields = String(teacher.study_fields || "")
      .split(",")
      .map(field => field.trim())
      .filter(Boolean)
      .slice(0, 3);

    if (fields.length) {
      fields.forEach(field => {
        tags.append(makeText("span", "", field));
      });
    } else {
      tags.append(
        makeText("span", "", "Study fields not provided")
      );
    }

    content.append(tags);

    const footer = makeText("div", "popular-teacher-footer");

    footer.append(makeText("span", "", getExperience(teacher)));

    const button = makeText(
      "button",
      "btn btn-primary popular-view-btn",
      ""
    );

    button.type = "button";
    button.dataset.auth = "signup-parent";
    button.append(document.createTextNode("View Profile "));

    const arrow = document.createElement("i");
    arrow.className = "fa-solid fa-arrow-right";
    arrow.setAttribute("aria-hidden", "true");

    button.append(arrow);
    footer.append(button);
    content.append(footer);

    card.append(image, content);

    return card;
  };

  async function loadPopularTeachers() {
    grid.setAttribute("aria-busy", "true");

    try {
      if (!apiBase) {
        throw new Error(
          "No API address is configured. Ensure js/api.js loads before this file."
        );
      }

      const requestUrl = new URL(`${apiBase}/teachers/popular`);

      const requestOptions = {
        method: "GET",
        headers: {
          Accept: "application/json"
        },
        cache: "no-store",
        credentials: "include"
      };

      /*
       * Chrome's Local Network Access support can require the request
       * destination to be declared when an HTTPS page accesses a private
       * HTTP LAN address. This option does not bypass browser permissions.
       */
      if (
        apiMode === "lan" &&
        requestUrl.protocol === "http:" &&
        isPrivateIPv4(requestUrl.hostname)
      ) {
        requestOptions.targetAddressSpace = "local";
      }

      const response = await fetch(
        requestUrl.href,
        requestOptions
      );

      if (!response.ok) {
        throw new Error(
          `Teacher request failed (${response.status}).`
        );
      }

      const payload = await response.json();

      if (
        payload.success !== true ||
        !Array.isArray(payload.data)
      ) {
        throw new Error(
          "The teacher response was not in the expected format."
        );
      }

      const teachers = payload.data;

      if (!teachers.length) {
        grid.replaceChildren(
          makeText(
            "p",
            "popular-teachers-empty",
            "Approved teacher profiles will appear here when available."
          )
        );

        return;
      }

      grid.replaceChildren(
        ...teachers.map(createTeacherCard)
      );

      /* Update the hero card from the first real profile. */
      const featured = teachers[0];
      const heroCard = document.querySelector(".teacher-card");

      if (heroCard) {
        const name = heroCard.querySelector(".teacher-details h3");
        const description = heroCard.querySelector(".teacher-details p");
        const rating = heroCard.querySelector(".teacher-rating");
        const verified = heroCard.querySelector(".verified-label");
        const meta = heroCard.querySelectorAll(".meta-box");
        const pills = heroCard.querySelector(".subject-pills");
        const footer = heroCard.querySelector(".teacher-card-footer");

        if (name) {
          name.textContent = getName(featured);
        }

        if (description) {
          description.textContent =
            String(featured.study_fields || "").trim() ||
            "Quran teacher";
        }

        /* Do not display made-up ratings or verification claims. */
        if (rating) rating.remove();
        if (verified) verified.remove();

        if (meta[0]) {
          const value = meta[0].querySelector("span");

          if (value) {
            value.textContent = getExperience(featured);
          }
        }

        if (meta[1]) {
          const value = meta[1].querySelector("span");

          if (value) {
            value.textContent = getLocation(featured);
          }
        }

        if (pills) {
          pills.replaceChildren();

          String(featured.study_fields || "")
            .split(",")
            .map(field => field.trim())
            .filter(Boolean)
            .slice(0, 3)
            .forEach(field => {
              pills.append(
                makeText("span", "subject-pill", field)
              );
            });
        }

        if (footer) {
          footer.replaceChildren(
            makeText(
              "span",
              "",
              Number(featured.accepting_students)
                ? "Accepting new students"
                : "Teacher profile"
            ),
            makeText("strong", "", "Join to get started →")
          );
        }

        const avatarWrap = heroCard.querySelector(
          ".teacher-avatar-large"
        );

        if (avatarWrap) {
          addAvatar(avatarWrap, featured, true);
        }
      }
    } catch (error) {
      console.error(
        "[BarakaLink] Could not load public teachers:",
        error
      );

      grid.replaceChildren(
        makeText(
          "p",
          "popular-teachers-empty",
          "Teachers could not be loaded right now. Please try again later."
        )
      );
    } finally {
      grid.removeAttribute("aria-busy");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      loadPopularTeachers,
      { once: true }
    );
  } else {
    loadPopularTeachers();
  }
})();
