"use strict";

/* =========================================================
   BARAKALINK — USTAZ SUPPORT / COMING-SOON MODULE
========================================================= */

import {
  text,
} from "./teacher-core.js";

import {
  $,
  $$,
} from "./teacher-dom.js";

import {
  setSection,
} from "./teacher-navigation.js";

import {
  state,
  SUPPORT_BANK_ACCOUNTS,
  SUPPORT_FLOAT_KEY,
  SUPPORT_FLOAT_COOLDOWN,
  SUPPORT_FLOAT_DELAY,
} from "./teacher-state.js";


/* =========================================================
   LOCAL MODULE STATE
========================================================= */

let ustazComingSoonPreviousFocus =
  null;


/* =========================================================
   COMING-SOON FEATURE NAME
========================================================= */

function getComingSoonFeatureName(
  link
) {

  if (!link) {
    return "This feature";
  }


  const explicit =
    text(
      link.dataset.comingSoon
    );


  if (explicit) {
    return explicit;
  }


  const ariaLabel =
    text(
      link.getAttribute("aria-label")
    );


  if (ariaLabel) {
    return ariaLabel;
  }


  const visibleText =
    text(
      link.textContent
    )
      .replace(/\s+/g, " ")
      .trim();


  return (
    visibleText ||
    "This feature"
  );

}


/* =========================================================
   OPEN COMING-SOON MODAL
========================================================= */

function openUstazComingSoon(
  featureName = "This feature",
  trigger = null
) {

  const modal =
    $("ustazComingSoonModal");

  const title =
    $("ustazComingSoonTitle");

  const description =
    $("ustazComingSoonDescription");


  if (!modal) {

    console.warn(
      "[BarakaLink][Ustaz Dashboard] Coming Soon modal was not found."
    );

    return;

  }


  ustazComingSoonPreviousFocus =
    trigger ||
    document.activeElement ||
    null;


  const feature =
    text(
      featureName,
      "This feature"
    );


  if (title) {

    title.textContent =
      `${feature} is coming soon`;

  }


  if (description) {

    description.textContent =
      `We're preparing ${feature.toLowerCase()} for a future BarakaLink update.`;

  }


  modal.hidden =
    false;


  modal.setAttribute(
    "aria-hidden",
    "false"
  );


  document.body.classList.add(
    "ustaz-coming-soon-open"
  );


  hideUstazSupportFloat(
    false
  );


  requestAnimationFrame(
    () => {

      modal.classList.add(
        "is-open"
      );


      const doneButton =
        $("ustazComingSoonDone");

      const closeButton =
        $("ustazComingSoonClose");


      try {

        (
          doneButton ||
          closeButton
        )?.focus({
          preventScroll: true,
        });

      } catch (_) {

        (
          doneButton ||
          closeButton
        )?.focus();

      }

    }
  );

}


/* =========================================================
   CLOSE COMING-SOON MODAL
========================================================= */

function closeUstazComingSoon() {

  const modal =
    $("ustazComingSoonModal");


  if (!modal) {
    return;
  }


  modal.classList.remove(
    "is-open"
  );


  modal.setAttribute(
    "aria-hidden",
    "true"
  );


  document.body.classList.remove(
    "ustaz-coming-soon-open"
  );


  window.setTimeout(
    () => {

      if (
        !modal.classList.contains(
          "is-open"
        )
      ) {

        modal.hidden =
          true;

      }

    },
    280
  );


  const previous =
    ustazComingSoonPreviousFocus;


  ustazComingSoonPreviousFocus =
    null;


  if (
    previous &&
    typeof previous.focus === "function" &&
    document.contains(previous)
  ) {

    try {

      previous.focus({
        preventScroll: true,
      });

    } catch (_) {

      previous.focus();

    }

  }

}


/* =========================================================
   SETUP COMING-SOON
========================================================= */

function setupUstazComingSoon() {

  const modal =
    $("ustazComingSoonModal");

  const closeButton =
    $("ustazComingSoonClose");

  const doneButton =
    $("ustazComingSoonDone");


  if (!modal) {

    console.warn(
      "[BarakaLink][Ustaz Dashboard] Coming Soon modal HTML is missing."
    );

    return;

  }


  if (
    modal.dataset.ustazComingSoonBound ===
    "1"
  ) {

    return;

  }


  modal.dataset.ustazComingSoonBound =
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


      const link =
        target.closest(
          ".ustaz-nav-coming-soon, [data-coming-soon]"
        );


      if (!link) {
        return;
      }


      if (
        link.tagName !== "A" &&
        link.getAttribute("role") !== "link"
      ) {

        return;

      }


      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();


      openUstazComingSoon(
        getComingSoonFeatureName(link),
        link
      );

    },
    true
  );


  if (closeButton) {

    closeButton.addEventListener(
      "click",
      (event) => {

        event.preventDefault();
        event.stopPropagation();

        closeUstazComingSoon();

      }
    );

  }


  if (doneButton) {

    doneButton.addEventListener(
      "click",
      (event) => {

        event.preventDefault();
        event.stopPropagation();

        closeUstazComingSoon();

      }
    );

  }


  modal
    .querySelectorAll(
      "[data-coming-soon-close]"
    )
    .forEach(
      (element) => {

        element.addEventListener(
          "click",
          (event) => {

            event.preventDefault();
            event.stopPropagation();

            closeUstazComingSoon();

          }
        );

      }
    );


  document.addEventListener(
    "keydown",
    (event) => {

      if (
        event.key === "Escape" &&
        !modal.hidden &&
        modal.classList.contains("is-open")
      ) {

        event.preventDefault();
        event.stopPropagation();

        closeUstazComingSoon();

      }

    },
    true
  );

}


/* =========================================================
   SUPPORT BANK ACCOUNTS
========================================================= */

function getSupportAccounts() {

  return SUPPORT_BANK_ACCOUNTS
    .filter(
      (account) => {

        if (!account) {
          return false;
        }


        if (
          account.enabled !== true
        ) {

          return false;

        }


        return Boolean(
          text(account.bank) &&
          text(account.accountName) &&
          text(account.accountNumber)
        );

      }
    )
    .map(
      (account) => ({

        bank:
          text(
            account.bank
          ),

        accountName:
          text(
            account.accountName
          ),

        accountNumber:
          text(
            account.accountNumber
          ),

      })
    );

}


/* =========================================================
   FIND SUPPORT PANEL
========================================================= */

function getUstazSupportPanel() {

  const supportSection =
    $("support");


  if (!supportSection) {
    return null;
  }


  const directPanel =
    supportSection.querySelector(
      ".ustaz-support-payment-panel"
    );


  if (directPanel) {
    return directPanel;
  }


  const paymentControl =
    supportSection.querySelector(
      "[data-ustaz-support-amount], " +
      "[data-ustaz-support-payment], " +
      "#ustazSupportPayButton"
    );


  if (paymentControl) {

    return (
      paymentControl.closest("article") ||
      paymentControl.closest(".ustaz-panel") ||
      null
    );

  }


  const articles =
    Array.from(
      supportSection.querySelectorAll(
        "article"
      )
    );


  return articles[1] || null;

}


/* =========================================================
   COPY ACCOUNT NUMBER
========================================================= */

async function copyUstazSupportAccountNumber(
  accountNumber
) {

  const value =
    text(
      accountNumber
    );


  if (!value) {
    return false;
  }


  if (
    navigator.clipboard &&
    typeof navigator.clipboard.writeText ===
      "function"
  ) {

    try {

      await navigator.clipboard.writeText(
        value
      );

      return true;

    } catch (_) {
      /* Fallback below. */
    }

  }


  try {

    const textarea =
      document.createElement(
        "textarea"
      );


    textarea.value =
      value;


    textarea.setAttribute(
      "readonly",
      "true"
    );


    textarea.style.position =
      "fixed";


    textarea.style.left =
      "-9999px";


    textarea.style.opacity =
      "0";


    document.body.appendChild(
      textarea
    );


    textarea.focus();

    textarea.select();


    const copied =
      document.execCommand(
        "copy"
      );


    textarea.remove();


    return copied;

  } catch (_) {

    return false;

  }

}


/* =========================================================
   CREATE BANK CARD
========================================================= */

function createUstazSupportBankCard(
  account
) {

  const card =
    document.createElement(
      "div"
    );


  card.className =
    "ustaz-support-bank-card";


  const header =
    document.createElement(
      "div"
    );


  header.className =
    "ustaz-support-bank-card-header";


  const icon =
    document.createElement(
      "div"
    );


  icon.className =
    "ustaz-support-bank-icon";


  icon.innerHTML =
    `
      <i
        class="fa-solid fa-building-columns"
        aria-hidden="true"
      ></i>
    `;


  const bankName =
    document.createElement(
      "h3"
    );


  bankName.className =
    "ustaz-support-bank-name";


  bankName.textContent =
    account.bank;


  header.append(
    icon,
    bankName
  );


  /* -------------------------------------------------------
     ACCOUNT NAME
  ------------------------------------------------------- */

  const accountNameField =
    document.createElement(
      "div"
    );


  accountNameField.className =
    "ustaz-support-bank-field";


  const accountNameLabel =
    document.createElement(
      "span"
    );


  accountNameLabel.className =
    "ustaz-support-bank-label";


  accountNameLabel.textContent =
    "Account Name";


  const accountName =
    document.createElement(
      "strong"
    );


  accountName.className =
    "ustaz-support-bank-value";


  accountName.textContent =
    account.accountName;


  accountNameField.append(
    accountNameLabel,
    accountName
  );


  /* -------------------------------------------------------
     ACCOUNT NUMBER
  ------------------------------------------------------- */

  const accountNumberField =
    document.createElement(
      "div"
    );


  accountNumberField.className =
    "ustaz-support-bank-field";


  const accountNumberLabel =
    document.createElement(
      "span"
    );


  accountNumberLabel.className =
    "ustaz-support-bank-label";


  accountNumberLabel.textContent =
    "Account Number";


  const numberRow =
    document.createElement(
      "div"
    );


  numberRow.className =
    "ustaz-support-bank-number-row";


  const accountNumber =
    document.createElement(
      "strong"
    );


  accountNumber.className =
    "ustaz-support-bank-number";


  accountNumber.textContent =
    account.accountNumber;


  const copyButton =
    document.createElement(
      "button"
    );


  copyButton.type =
    "button";


  copyButton.className =
    "ustaz-support-copy-button";


  copyButton.textContent =
    "Copy";


  copyButton.addEventListener(
    "click",
    async (event) => {

      event.preventDefault();
      event.stopPropagation();


      copyButton.disabled =
        true;


      const copied =
        await copyUstazSupportAccountNumber(
          account.accountNumber
        );


      copyButton.textContent =
        copied
          ? "Copied"
          : "Copy failed";


      copyButton.classList.toggle(
        "is-copied",
        copied
      );


      window.setTimeout(
        () => {

          copyButton.textContent =
            "Copy";


          copyButton.classList.remove(
            "is-copied"
          );


          copyButton.disabled =
            false;

        },
        1800
      );

    }
  );


  numberRow.append(
    accountNumber,
    copyButton
  );


  accountNumberField.append(
    accountNumberLabel,
    numberRow
  );


  card.append(
    header,
    accountNameField,
    accountNumberField
  );


  return card;

}


/* =========================================================
   RENDER SUPPORT ACCOUNTS
========================================================= */

function renderUstazSupportAccounts() {

  const panel =
    getUstazSupportPanel();


  if (!panel) {

    console.warn(
      "[BarakaLink][Ustaz Dashboard] Support payment panel was not found."
    );

    return;

  }


  const accounts =
    getSupportAccounts();


  panel.replaceChildren();


  /* -------------------------------------------------------
     PANEL HEADER
  ------------------------------------------------------- */

  const header =
    document.createElement(
      "div"
    );


  header.className =
    "ustaz-panel-header";


  const inner =
    document.createElement(
      "div"
    );


  const eyebrow =
    document.createElement(
      "span"
    );


  eyebrow.className =
    "ustaz-panel-eyebrow";


  eyebrow.textContent =
    "Bank Support";


  const title =
    document.createElement(
      "h2"
    );


  /*
   * Intentionally kept empty to preserve the original panel
   * layout.
   */
  title.textContent =
    "";


  inner.append(
    eyebrow,
    title
  );


  header.appendChild(
    inner
  );


  panel.appendChild(
    header
  );


  /* -------------------------------------------------------
     DESCRIPTION
  ------------------------------------------------------- */

  const description =
    document.createElement(
      "p"
    );


  description.className =
    "ustaz-support-bank-description";


  description.textContent =
    "Online payments are not available yet. You can support BarakaLink by transferring directly to one of our official bank accounts below.";


  panel.appendChild(
    description
  );


  /* -------------------------------------------------------
     NOTICE
  ------------------------------------------------------- */

  const notice =
    document.createElement(
      "div"
    );


  notice.className =
    "ustaz-support-bank-notice";


  notice.innerHTML =
    `
      <i
        class="fa-solid fa-circle-info"
        aria-hidden="true"
      ></i>

      <span>
        Please verify the account name and account number before making a transfer.
      </span>
    `;


  panel.appendChild(
    notice
  );


  /* -------------------------------------------------------
     HEADING
  ------------------------------------------------------- */

  const heading =
    document.createElement(
      "h3"
    );


  heading.className =
    "ustaz-support-bank-heading";


  heading.textContent =
    "Official bank accounts";


  panel.appendChild(
    heading
  );


  /* -------------------------------------------------------
     ACCOUNT LIST
  ------------------------------------------------------- */

  const list =
    document.createElement(
      "div"
    );


  list.className =
    "ustaz-support-bank-list";


  if (!accounts.length) {

    const empty =
      document.createElement(
        "div"
      );


    empty.className =
      "ustaz-support-bank-empty";


    empty.innerHTML =
      `
        <i
          class="fa-solid fa-building-columns"
          aria-hidden="true"
        ></i>

        <strong>
          Bank account information is not configured yet.
        </strong>

        <span>
          Add the real BarakaLink account name and account number in teacher-state.js.
        </span>
      `;


    list.appendChild(
      empty
    );

  } else {

    accounts.forEach(
      (account) => {

        list.appendChild(
          createUstazSupportBankCard(
            account
          )
        );

      }
    );

  }


  panel.appendChild(
    list
  );


  /* -------------------------------------------------------
     THANK YOU
  ------------------------------------------------------- */

  const thankYou =
    document.createElement(
      "p"
    );


  thankYou.className =
    "ustaz-support-bank-thank-you";


  thankYou.textContent =
    "Thank you for supporting the work behind BarakaLink.";


  panel.appendChild(
    thankYou
  );

}


/* =========================================================
   LOCAL STORAGE
========================================================= */

function getLocalStorage(
  key
) {

  try {

    return localStorage.getItem(
      key
    );

  } catch (_) {

    return null;

  }

}


function setLocalStorage(
  key,
  value
) {

  try {

    localStorage.setItem(
      key,
      value
    );

  } catch (_) {

    /* Storage may be unavailable. */

  }

}


/* =========================================================
   HIDE SUPPORT FLOAT
========================================================= */

function hideUstazSupportFloat(
  remember = false
) {

  const float =
    $("ustazSupportFloat");


  if (!float) {
    return;
  }


  if (remember) {

    setLocalStorage(
      SUPPORT_FLOAT_KEY,
      String(
        Date.now()
      )
    );

  }


  float.classList.remove(
    "is-open"
  );


  window.setTimeout(
    () => {

      if (
        !float.classList.contains(
          "is-open"
        )
      ) {

        float.hidden =
          true;

      }

    },
    220
  );

}


/* =========================================================
   SUPPORT FLOAT DISMISSED RECENTLY
========================================================= */

function supportFloatWasDismissedRecently() {

  const raw =
    getLocalStorage(
      SUPPORT_FLOAT_KEY
    );


  if (!raw) {
    return false;
  }


  const timestamp =
    Number(raw);


  if (
    !Number.isFinite(timestamp)
  ) {

    return false;

  }


  return (
    Date.now() - timestamp <
    SUPPORT_FLOAT_COOLDOWN
  );

}


/* =========================================================
   ENSURE SUPPORT FLOAT
========================================================= */

function ensureUstazSupportFloat() {

  let float =
    $("ustazSupportFloat");


  if (float) {
    return float;
  }


  float =
    document.createElement(
      "aside"
    );


  float.id =
    "ustazSupportFloat";


  float.className =
    "ustaz-support-float";


  float.hidden =
    true;


  float.setAttribute(
    "aria-label",
    "Support BarakaLink"
  );


  float.innerHTML =
    `
      <div
        class="ustaz-support-float-backdrop"
        aria-hidden="true"
      ></div>

      <div
        class="ustaz-support-float-card"
        role="dialog"
        aria-modal="false"
        aria-labelledby="ustazSupportFloatTitle"
      >

        <button
          type="button"
          class="ustaz-support-float-close"
          id="ustazSupportFloatClose"
          aria-label="Close support message"
        >
          <i
            class="fa-solid fa-xmark"
            aria-hidden="true"
          ></i>
        </button>

        <div
          class="ustaz-support-float-icon"
          aria-hidden="true"
        >
          <i
            class="fa-solid fa-heart"
            aria-hidden="true"
          ></i>
        </div>

        <h3 id="ustazSupportFloatTitle">
          Support BarakaLink
        </h3>

        <p>
          Help us keep BarakaLink growing and improving for families, students, and teachers.
        </p>

        <div class="ustaz-support-float-actions">

          <button
            type="button"
            class="ustaz-support-float-support-button"
            id="ustazSupportFloatSupport"
          >
            Support Baraka
          </button>

          <button
            type="button"
            class="ustaz-support-float-later-button"
            id="ustazSupportFloatLater"
          >
            Maybe later
          </button>

        </div>

      </div>
    `;


  document.body.appendChild(
    float
  );


  return float;

}


/* =========================================================
   SETUP SUPPORT FLOAT
========================================================= */

function setupUstazSupportFloat() {

  const float =
    ensureUstazSupportFloat();


  if (!float) {
    return;
  }


  if (
    float.dataset
      .ustazSupportFloatBound ===
    "1"
  ) {

    return;

  }


  float.dataset
    .ustazSupportFloatBound =
    "1";


  const closeButton =
    $("ustazSupportFloatClose");


  const supportButton =
    $("ustazSupportFloatSupport");


  const laterButton =
    $("ustazSupportFloatLater");


  /* -------------------------------------------------------
     Stop internal clicks from reaching dashboard controls
  ------------------------------------------------------- */

  float.addEventListener(
    "click",
    (event) => {

      event.stopPropagation();

    }
  );


  float.addEventListener(
    "pointerdown",
    (event) => {

      event.stopPropagation();

    }
  );


  float.addEventListener(
    "mousedown",
    (event) => {

      event.stopPropagation();

    }
  );


  float.addEventListener(
    "touchstart",
    (event) => {

      event.stopPropagation();

    },
    {
      passive: true,
    }
  );


  /* -------------------------------------------------------
     CLOSE
  ------------------------------------------------------- */

  if (closeButton) {

    closeButton.addEventListener(
      "click",
      (event) => {

        event.preventDefault();
        event.stopPropagation();

        hideUstazSupportFloat(
          true
        );

      }
    );

  }


  /* -------------------------------------------------------
     MAYBE LATER
  ------------------------------------------------------- */

  if (laterButton) {

    laterButton.addEventListener(
      "click",
      (event) => {

        event.preventDefault();
        event.stopPropagation();

        hideUstazSupportFloat(
          true
        );

      }
    );

  }


  /* -------------------------------------------------------
     SUPPORT BARAKA
  ------------------------------------------------------- */

  if (supportButton) {

    supportButton.addEventListener(
      "click",
      (event) => {

        event.preventDefault();
        event.stopPropagation();


        hideUstazSupportFloat(
          true
        );


        window.setTimeout(
          () => {

            openUstazSupportSection();

          },
          50
        );

      }
    );

  }


  /* -------------------------------------------------------
     BACKDROP
  ------------------------------------------------------- */

  const backdrop =
    float.querySelector(
      ".ustaz-support-float-backdrop"
    );


  if (backdrop) {

    backdrop.addEventListener(
      "click",
      (event) => {

        event.preventDefault();
        event.stopPropagation();

      }
    );


    backdrop.addEventListener(
      "pointerdown",
      (event) => {

        event.preventDefault();
        event.stopPropagation();

      }
    );

  }


  /* -------------------------------------------------------
     SHOW AFTER DELAY
  ------------------------------------------------------- */

  window.setTimeout(
    () => {

      if (
        supportFloatWasDismissedRecently()
      ) {

        return;

      }


      if (
        state.section === "support"
      ) {

        return;

      }


      if (
        document.body.classList.contains(
          "ustaz-coming-soon-open"
        )
      ) {

        return;

      }


      float.hidden =
        false;


      requestAnimationFrame(
        () => {

          float.classList.add(
            "is-open"
          );

        }
      );

    },
    SUPPORT_FLOAT_DELAY
  );

}


/* =========================================================
   OPEN SUPPORT SECTION
========================================================= */

function openUstazSupportSection() {

  const supportSection =
    $("support");


  if (!supportSection) {
    return;
  }


  setSection(
    "support"
  );

}


/* =========================================================
   SETUP SUPPORT CONTROLS
========================================================= */

function setupSupportControls() {

  /*
   * Remove obsolete online-payment controls.
   */

  $$(
    [
      "[data-ustaz-support-amount]",
      "[data-ustaz-support-payment]",
      "#ustazSupportCustomWrap",
      "#ustazSupportCustomAmount",
      "#ustazSupportPayButton",
      ".ustaz-support-payment-methods",
      ".ustaz-support-payment-label",
      ".ustaz-support-payment-note",
    ].join(", ")
  )
    .forEach(
      (element) => {

        const wrapper =
          element.closest(
            ".ustaz-support-amounts, " +
            ".ustaz-support-custom-wrap, " +
            ".ustaz-support-payment-methods"
          );


        if (
          wrapper &&
          wrapper !== element
        ) {

          wrapper.remove();

        } else {

          element.remove();

        }

      }
    );


  /* -------------------------------------------------------
     Render official bank accounts
  ------------------------------------------------------- */

  renderUstazSupportAccounts();


  /* -------------------------------------------------------
     Reorder support panels
  ------------------------------------------------------- */

  const supportSection =
    $("support");


  const supportPanel =
    getUstazSupportPanel();


  if (
    supportSection &&
    supportPanel
  ) {

    const supportBox =
      supportPanel.closest("article") ||
      supportPanel;


    const storyBox =
      Array.from(
        supportSection.querySelectorAll(
          "article"
        )
      )
        .find(
          (article) =>
            !article.contains(
              supportPanel
            )
        );


    if (
      supportBox &&
      storyBox &&
      supportBox.parentElement ===
        storyBox.parentElement
    ) {

      storyBox.parentElement.insertBefore(
        supportBox,
        storyBox
      );

    } else if (
      supportPanel.parentElement ===
        supportSection
    ) {

      supportSection.insertBefore(
        supportPanel,
        supportSection.firstElementChild
      );

    }

  }


  setupUstazSupportFloat();

}


/* =========================================================
   SUPPORT UI STYLES
========================================================= */

function injectUstazSupportStyles() {

  if (
    document.querySelector(
      'style[data-barakalink-ustaz-support-ui]'
    )
  ) {

    return;

  }


  const style =
    document.createElement(
      "style"
    );


  style.setAttribute(
    "data-barakalink-ustaz-support-ui",
    "true"
  );


  style.textContent = `
/* =========================================================
   SUPPORT FLOAT
========================================================= */

:where(.ustaz-support-float[hidden]) {
  display: none !important;
}


:where(.ustaz-support-float) {
  position: fixed;
  inset: 0;
  z-index: 10000;
  pointer-events: none;
}


:where(.ustaz-support-float-backdrop) {
  position: absolute;
  inset: 0;
  background: transparent;
  pointer-events: auto;
}


:where(.ustaz-support-float-card) {
  position: absolute;
  top: 86px;
  right: 20px;
  z-index: 2;
  width: min(370px, calc(100vw - 32px));
  padding: 20px;
  border-radius: 18px;
  border: 1px solid rgba(154, 116, 32, 0.16);
  background:
    linear-gradient(
      145deg,
      rgba(255, 255, 255, 0.96),
      rgba(250, 247, 238, 0.96)
    );
  box-shadow:
    0 18px 46px rgba(0, 0, 0, 0.14),
    0 7px 22px rgba(154, 116, 32, 0.10);
  opacity: 0;
  transform: translateY(-10px);
  pointer-events: auto;
  transition:
    opacity 0.22s ease,
    transform 0.22s ease;
}


:where(.ustaz-support-float.is-open .ustaz-support-float-card) {
  opacity: 1;
  transform: translateY(0);
}


:where(.ustaz-support-float-close) {
  position: absolute;
  top: 9px;
  right: 9px;
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: rgb(154, 116, 32);
  cursor: pointer;
  z-index: 3;
  transition:
    background 0.18s ease,
    transform 0.18s ease;
}


:where(.ustaz-support-float-close:hover) {
  background: rgba(154, 116, 32, 0.10);
  transform: scale(1.04);
}


:where(.ustaz-support-float-icon) {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;
  border-radius: 13px;
  color: rgb(154, 116, 32);
  background:
    linear-gradient(
      145deg,
      rgba(255, 255, 255, 0.96),
      rgba(250, 247, 238, 0.96)
    );
  border: 1px solid rgba(154, 116, 32, 0.16);
}


:where(.ustaz-support-float-card h3) {
  margin: 0 36px 7px 0;
  font-size: 1.12rem;
}


:where(.ustaz-support-float-card p) {
  margin: 0;
  line-height: 1.55;
  opacity: 0.78;
}


:where(.ustaz-support-float-actions) {
  display: flex;
  gap: 10px;
  margin-top: 18px;
}


:where(
  .ustaz-support-float-support-button,
  .ustaz-support-float-later-button
) {
  flex: 1 1 0;
  min-height: 43px;
  border-radius: 11px;
  padding: 10px 14px;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
  transition:
    transform 0.18s ease,
    box-shadow 0.18s ease,
    background 0.18s ease,
    border-color 0.18s ease,
    color 0.18s ease;
}


:where(.ustaz-support-float-support-button) {
  border: 1px solid rgb(154, 116, 32);
  background: rgb(154, 116, 32);
  color: #ffffff;
  box-shadow:
    0 6px 14px rgba(154, 116, 32, 0.18);
}


:where(.ustaz-support-float-support-button:hover) {
  background: rgb(139, 104, 28);
  border-color: rgb(139, 104, 28);
  transform: translateY(-1px);
  box-shadow:
    0 8px 17px rgba(154, 116, 32, 0.22);
}


:where(.ustaz-support-float-later-button) {
  border: 1px solid rgba(154, 116, 32, 0.22);
  background:
    linear-gradient(
      145deg,
      rgba(255, 255, 255, 0.96),
      rgba(250, 247, 238, 0.96)
    );
  color: rgb(154, 116, 32);
}


:where(.ustaz-support-float-later-button:hover) {
  border-color: rgba(154, 116, 32, 0.45);
  background: rgba(154, 116, 32, 0.08);
  color: rgb(139, 104, 28);
  transform: translateY(-1px);
}


/* =========================================================
   BANK PANEL
========================================================= */

:where(.ustaz-support-bank-description) {
  margin: 0 0 16px;
  line-height: 1.6;
}


:where(.ustaz-support-bank-notice) {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  margin-bottom: 20px;
  padding: 12px 13px;
  border-radius: 12px;
  border: 1px solid rgba(154, 116, 32, 0.14);
  background:
    linear-gradient(
      145deg,
      rgba(255, 255, 255, 0.96),
      rgba(250, 247, 238, 0.96)
    );
  line-height: 1.45;
  font-size: 0.9rem;
}


:where(.ustaz-support-bank-notice i) {
  margin-top: 2px;
  color: rgb(154, 116, 32);
}


:where(.ustaz-support-bank-heading) {
  margin: 0 0 12px;
  font-size: 1rem;
  color: rgb(154, 116, 32);
}


:where(.ustaz-support-bank-list) {
  display: grid;
  gap: 12px;
}


/* =========================================================
   BANK CARD
========================================================= */

:where(.ustaz-support-bank-card) {
  padding: 16px;
  border-radius: 14px;
  border: 1px solid rgba(154, 116, 32, 0.16);
  background:
    linear-gradient(
      145deg,
      rgba(255, 255, 255, 0.96),
      rgba(250, 247, 238, 0.96)
    );
  box-shadow:
    0 6px 18px rgba(154, 116, 32, 0.08);
  transition:
    transform 0.18s ease,
    box-shadow 0.18s ease,
    border-color 0.18s ease;
}


:where(.ustaz-support-bank-card:hover) {
  transform: translateY(-1px);
  border-color: rgba(154, 116, 32, 0.28);
  box-shadow:
    0 9px 24px rgba(154, 116, 32, 0.11);
}


:where(.ustaz-support-bank-card-header) {
  display: flex;
  align-items: center;
  gap: 11px;
  margin-bottom: 14px;
}


:where(.ustaz-support-bank-icon) {
  width: 40px;
  height: 40px;
  flex: 0 0 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 11px;
  color: rgb(154, 116, 32);
  background:
    linear-gradient(
      145deg,
      rgba(255, 255, 255, 0.96),
      rgba(250, 247, 238, 0.96)
    );
  border: 1px solid rgba(154, 116, 32, 0.18);
}


:where(.ustaz-support-bank-icon i) {
  color: rgb(154, 116, 32);
  font-size: 16px;
}


:where(.ustaz-support-bank-name) {
  margin: 0;
  font-size: 1rem;
  line-height: 1.35;
  color: rgb(154, 116, 32);
}


:where(.ustaz-support-bank-field) {
  margin-top: 10px;
}


:where(.ustaz-support-bank-label) {
  display: block;
  margin-bottom: 4px;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: rgb(154, 116, 32);
  opacity: 0.75;
}


:where(.ustaz-support-bank-value) {
  display: block;
  line-height: 1.45;
  font-weight: 600;
}


:where(.ustaz-support-bank-number-row) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}


:where(.ustaz-support-bank-number) {
  word-break: break-word;
  letter-spacing: 0.035em;
  font-weight: 700;
}


:where(.ustaz-support-copy-button) {
  flex: 0 0 auto;
  border: 1px solid rgba(154, 116, 32, 0.20);
  border-radius: 9px;
  padding: 8px 12px;
  cursor: pointer;
  font: inherit;
  color: rgb(154, 116, 32);
  background:
    linear-gradient(
      145deg,
      rgba(255, 255, 255, 0.96),
      rgba(250, 247, 238, 0.96)
    );
}


:where(.ustaz-support-copy-button:hover) {
  border-color: rgba(154, 116, 32, 0.42);
  transform: translateY(-1px);
}


:where(.ustaz-support-copy-button:active) {
  transform: translateY(0);
}


:where(.ustaz-support-copy-button.is-copied) {
  color: rgb(154, 116, 32);
  border-color: rgb(154, 116, 32);
  font-weight: 700;
}


/* =========================================================
   EMPTY STATE
========================================================= */

:where(.ustaz-support-bank-empty) {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 22px;
  border-radius: 14px;
  border: 1px solid rgba(154, 116, 32, 0.13);
  background:
    linear-gradient(
      145deg,
      rgba(255, 255, 255, 0.96),
      rgba(250, 247, 238, 0.96)
    );
  text-align: center;
  line-height: 1.45;
}


:where(.ustaz-support-bank-empty i) {
  margin-bottom: 2px;
  font-size: 23px;
  color: rgb(154, 116, 32);
}


:where(.ustaz-support-bank-empty strong) {
  color: rgb(154, 116, 32);
}


/* =========================================================
   THANK YOU
========================================================= */

:where(.ustaz-support-bank-thank-you) {
  margin: 18px 0 0;
  padding-top: 16px;
  border-top: 1px solid rgba(154, 116, 32, 0.12);
  line-height: 1.5;
  opacity: 0.75;
}


/* =========================================================
   COMING SOON MODAL
========================================================= */

:where(.ustaz-coming-soon-modal) {
  position: fixed;
  inset: 0;
  z-index: 5000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  opacity: 0;
  visibility: hidden;
  transition:
    opacity 0.2s ease,
    visibility 0.2s ease;
}


:where(.ustaz-coming-soon-modal.is-open) {
  opacity: 1;
  visibility: visible;
}


:where(.ustaz-coming-soon-backdrop) {
  position: absolute;
  inset: 0;
  background: rgba(10, 12, 18, 0.58);
  backdrop-filter: blur(4px);
}


:where(.ustaz-coming-soon-dialog) {
  position: relative;
  z-index: 1;
  width: min(440px, calc(100vw - 40px));
  max-height: calc(100vh - 40px);
  overflow-y: auto;
}


body.ustaz-coming-soon-open {
  overflow: hidden;
}


/* =========================================================
   MOBILE
========================================================= */

@media (max-width: 640px) {

  :where(.ustaz-support-float-card) {
    top: 70px;
    left: 16px;
    right: 16px;
    width: auto;
  }


  :where(.ustaz-support-float-actions) {
    flex-direction: column;
  }


  :where(.ustaz-support-bank-number-row) {
    align-items: stretch;
    flex-direction: column;
    gap: 9px;
  }


  :where(.ustaz-support-copy-button) {
    width: 100%;
  }


  :where(.ustaz-coming-soon-modal) {
    padding: 16px;
  }


  :where(.ustaz-coming-soon-dialog) {
    width: min(440px, calc(100vw - 32px));
  }

}


/* =========================================================
   REDUCED MOTION
========================================================= */

@media (prefers-reduced-motion: reduce) {

  :where(
    .ustaz-support-float-card,
    .ustaz-support-bank-card,
    .ustaz-support-copy-button,
    .ustaz-support-float-close,
    .ustaz-support-float-support-button,
    .ustaz-support-float-later-button,
    .ustaz-coming-soon-modal
  ) {

    transition: none;

  }

}
`;


  document.head.appendChild(
    style
  );

}


/* =========================================================
   EXPORTS
========================================================= */

export {
  getComingSoonFeatureName,
  openUstazComingSoon,
  closeUstazComingSoon,
  setupUstazComingSoon,

  getSupportAccounts,
  getUstazSupportPanel,
  copyUstazSupportAccountNumber,
  createUstazSupportBankCard,
  renderUstazSupportAccounts,

  getLocalStorage,
  setLocalStorage,

  hideUstazSupportFloat,
  supportFloatWasDismissedRecently,
  ensureUstazSupportFloat,
  setupUstazSupportFloat,

  openUstazSupportSection,
  setupSupportControls,

  injectUstazSupportStyles,
};