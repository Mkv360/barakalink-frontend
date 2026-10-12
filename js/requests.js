/* =========================================================
     PROFILE TRUST (V1 — optional verification signals)

     Reads qualificationSubmitted / identityVerified /
     subscriptionActive from GET /api/profile and derives ONE
     display state from the booleans. The backend never sends
     a badge colour.

     subscriptionActive is parsed and kept in state for later,
     but it intentionally has NO effect on the badge.
  ========================================================= */

  const TRUST_STATES = Object.freeze({
    none: Object.freeze({
      badge: "",
      icon: "",
      title: "Strengthen your profile",
      description:
        "Verification is optional. You can strengthen your profile by submitting your credentials, completing identity verification, or both.",
    }),

    credentials: Object.freeze({
      badge: "Credentials Submitted",
      icon: "fa-solid fa-file-circle-check",
      title: "Qualification documents submitted",
      description:
        "Your qualification documents have been submitted. Completing live identity verification can strengthen your profile further.",
    }),

    identity: Object.freeze({
      badge: "Identity Verified",
      icon: "fa-solid fa-user-check",
      title: "Live identity check complete",
      description:
        "Your live identity check is complete. Adding your qualification documents can bring your profile to Trusted Profile.",
    }),

    trusted: Object.freeze({
      badge: "Trusted Profile",
      icon: "fa-solid fa-award",
      title: "All trust steps completed",
      description:
        "You have completed both optional verification steps on your profile.",
    }),
  });

  function trustFlag(value) {
    return ["true", "1", "yes"].includes(
      text(value).toLowerCase()
    );
  }

  /*
   * Looks for each flag on the teacher profile, then the user,
   * then the top-level payload (each also checked for a nested
   * `trust` object). First source that defines the field wins.
   * Missing fields default to false so nothing breaks while the
   * backend does not send them yet.
   */
  function readTrustFlags(sources = []) {
    const keys = {
      qualificationSubmitted: [
        "qualificationSubmitted",
        "qualification_submitted",
      ],
      identityVerified: [
        "identityVerified",
        "identity_verified",
      ],
      subscriptionActive: [
        "subscriptionActive",
        "subscription_active",
      ],
    };

    const candidates = [];

    sources.forEach((source) => {
      if (!isObject(source)) return;

      candidates.push(source);

      if (isObject(source.trust)) {
        candidates.push(source.trust);
      }
    });

    const flags = {
      qualificationSubmitted: false,
      identityVerified: false,
      subscriptionActive: false,
    };

    Object.keys(keys).forEach((flag) => {
      for (const source of candidates) {
        for (const key of keys[flag]) {
          if (
            source[key] !== undefined &&
            source[key] !== null
          ) {
            flags[flag] = trustFlag(source[key]);
            return;
          }
        }
      }
    });

    return flags;
  }

  /* Display state comes ONLY from the two trust booleans. */
  function getTrustStateKey(flags = {}) {
    const credentials = flags.qualificationSubmitted === true;
    const identity = flags.identityVerified === true;

    if (credentials && identity) return "trusted";
    if (credentials) return "credentials";
    if (identity) return "identity";

    return "none";
  }

  function renderTrustStatus() {
    const panel = $("ustazTrustPanel");

    if (!panel) return;

    const key = getTrustStateKey(state.trust);
    const view = TRUST_STATES[key];

    panel.dataset.trustState = key;

    setHidden("ustazTrustBadge", !view.badge);
    setText("ustazTrustBadgeLabel", view.badge);

    const badgeIcon = $("ustazTrustBadgeIcon");

    if (badgeIcon) {
      badgeIcon.className = view.icon;
    }

    setText("ustazTrustTitle", view.title);
    setText("ustazTrustDescription", view.description);
    setHidden("ustazTrustChecklist", key !== "trusted");
  }

  function setupTrustInfo() {
    const button = $("ustazTrustInfoButton");
    const info = $("ustazTrustInfo");

    if (
      !button ||
      !info ||
      button.dataset.ustazTrustBound === "1"
    ) {
      return;
    }

    button.dataset.ustazTrustBound = "1";

    const setOpen = (open) => {
      info.hidden = !open;

      button.setAttribute(
        "aria-expanded",
        open ? "true" : "false"
      );
    };

    button.addEventListener("click", (event) => {
      event.preventDefault();

      setOpen(info.hidden);
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !info.hidden) {
        setOpen(false);
      }
    });
  }