'use strict';

/* =========================================================
   BARAKALINK STUDENT DASHBOARD
   SUPPORT BARAKA

   CURRENT MODEL
   ---------------------------------------------------------
   - No online payment integration
   - No Chapa / Telebirr checkout
   - No payment amount selection
   - No payment-method selection
   - Bank-transfer information only
   - Copy account number button
   - Floating Support Baraka invitation

   IMPORTANT
   ---------------------------------------------------------
   The existing Support page appearance is preserved.

   The existing Support panels remain unchanged internally.
   Only their position is adjusted so the official bank-
   account panel appears before the contribution/story panel.

========================================================= */

import { $, $$ } from './student-core.js';
import { state } from './student-state.js';
import { safeString } from './student-utils.js';
import { initializeStudentModals } from './student-modals.js';


/* =========================================================
   SUPPORT FLOAT SETTINGS
========================================================= */

const SUPPORT_FLOAT_KEY =
  'barakalink_student_support_float_dismissed_v2';

const SUPPORT_FLOAT_COOLDOWN =
  7 * 24 * 60 * 60 * 1000;

const SUPPORT_FLOAT_DELAY =
  2500;


/* =========================================================
   BARAKALINK BANK ACCOUNTS
========================================================= */

const SUPPORT_BANK_ACCOUNTS = [

  {
    bank: 'Commercial Bank of Ethiopia (CBE)',
    accountName: 'Danakil Labs',
    accountNumber: '546378291-20938476',
    enabled: true
  },

  {
    bank: 'Awash Bank',
    accountName: 'Danakil Labs',
    accountNumber: '2345678',
    enabled: true
  },

  {
    bank: 'Dashen Bank',
    accountName: '',
    accountNumber: '',
    enabled: false
  },

  {
    bank: 'Wegagen Bank',
    accountName: '',
    accountNumber: '',
    enabled: false
  },

  {
    bank: 'Hibret Bank',
    accountName: '',
    accountNumber: '',
    enabled: false
  },

  {
    bank: 'Nib International Bank',
    accountName: '',
    accountNumber: '',
    enabled: false
  },

  {
    bank: 'Bank of Abyssinia',
    accountName: '',
    accountNumber: '',
    enabled: false
  },

  {
    bank: 'Zemen Bank',
    accountName: '',
    accountNumber: '',
    enabled: false
  },

  {
    bank: 'Lion International Bank',
    accountName: '',
    accountNumber: '',
    enabled: false
  },

  {
    bank: 'Cooperative Bank of Oromia (CBO)',
    accountName: '',
    accountNumber: '',
    enabled: false
  },

  {
    bank: 'Oromia Bank',
    accountName: '',
    accountNumber: '',
    enabled: false
  },

  {
    bank: 'Berhan Bank',
    accountName: '',
    accountNumber: '',
    enabled: false
  },

  {
    bank: 'Abay Bank',
    accountName: '',
    accountNumber: '',
    enabled: false
  },

  {
    bank: 'Bunna International Bank',
    accountName: '',
    accountNumber: '',
    enabled: false
  },

  {
    bank: 'Addis International Bank',
    accountName: '',
    accountNumber: '',
    enabled: false
  },

  {
    bank: 'Enat Bank',
    accountName: '',
    accountNumber: '',
    enabled: false
  },

  {
    bank: 'Debub Global Bank',
    accountName: '',
    accountNumber: '',
    enabled: false
  },

  {
    bank: 'ZamZam Bank',
    accountName: '',
    accountNumber: '',
    enabled: false
  },

  {
    bank: 'Hijra Bank',
    accountName: '',
    accountNumber: '',
    enabled: false
  },

  {
    bank: 'Goh Betoch Bank',
    accountName: '',
    accountNumber: '',
    enabled: false
  },

  {
    bank: 'Amhara Bank',
    accountName: '',
    accountNumber: '',
    enabled: false
  },

  {
    bank: 'Ahadu Bank',
    accountName: '',
    accountNumber: '',
    enabled: false
  },

  {
    bank: 'Sinqee Bank',
    accountName: '',
    accountNumber: '',
    enabled: false
  },

  {
    bank: 'Tsehay Bank',
    accountName: '',
    accountNumber: '',
    enabled: false
  },

  {
    bank: 'Tsedey Bank',
    accountName: '',
    accountNumber: '',
    enabled: false
  },

  {
    bank: 'Shabelle Bank',
    accountName: '',
    accountNumber: '',
    enabled: false
  },

  {
    bank: 'Sidama Bank',
    accountName: '',
    accountNumber: '',
    enabled: false
  },

  {
    bank: 'Gadaa Bank',
    accountName: '',
    accountNumber: '',
    enabled: false
  },

  {
    bank: 'Omo Bank',
    accountName: '',
    accountNumber: '',
    enabled: false
  },

  {
    bank: 'Siket Bank',
    accountName: '',
    accountNumber: '',
    enabled: false
  },

  {
    bank: 'Rammis Bank',
    accountName: '',
    accountNumber: '',
    enabled: false
  },

  {
    bank: 'Development Bank of Ethiopia (DBE)',
    accountName: '',
    accountNumber: '',
    enabled: false
  }

];


/* =========================================================
   GET ACTIVE ACCOUNTS
========================================================= */

function getSupportAccounts() {

  return SUPPORT_BANK_ACCOUNTS
    .filter(
      account => {

        if (!account) {
          return false;
        }

        if (account.enabled !== true) {
          return false;
        }

        return (
          safeString(account.bank) &&
          safeString(account.accountName) &&
          safeString(account.accountNumber)
        );

      }
    )
    .map(
      account => ({

        bank:
          safeString(account.bank),

        accountName:
          safeString(account.accountName),

        accountNumber:
          safeString(account.accountNumber)

      })
    );

}


/* =========================================================
   LOCAL STORAGE
========================================================= */

export function getLocalStorage(
  key
) {

  try {

    return localStorage.getItem(
      key
    );

  } catch {

    return null;

  }

}


export function setLocalStorage(
  key,
  value
) {

  try {

    localStorage.setItem(
      key,
      value
    );

  } catch {

    /* Storage may be unavailable. */

  }

}


/* =========================================================
   SUPPORT FLOAT
========================================================= */

export function getSupportFloat() {

  return $('studentSupportFloat');

}


export function supportWasDismissedRecently() {

  const raw =
    getLocalStorage(
      SUPPORT_FLOAT_KEY
    );

  if (!raw) {
    return false;
  }

  const timestamp =
    Number(raw);

  if (!Number.isFinite(timestamp)) {
    return false;
  }

  return (
    Date.now() - timestamp <
    SUPPORT_FLOAT_COOLDOWN
  );

}


export function markSupportFloatDismissed() {

  setLocalStorage(
    SUPPORT_FLOAT_KEY,
    String(Date.now())
  );

}


export function showSupportFloat() {

  const float =
    getSupportFloat();

  if (!float) {
    return;
  }

  if (
    state.currentSection === 'support'
  ) {
    return;
  }

  if (
    document.body.classList.contains(
      'student-modal-open'
    )
  ) {
    return;
  }

  float.hidden =
    false;

  requestAnimationFrame(
    () => {

      float.classList.add(
        'is-open'
      );

    }
  );

}


export function hideSupportFloat(
  remember = false
) {

  const float =
    getSupportFloat();

  if (!float) {
    return;
  }

  if (remember) {

    markSupportFloatDismissed();

  }

  float.classList.remove(
    'is-open'
  );

  window.setTimeout(
    () => {

      if (
        !float.classList.contains(
          'is-open'
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
   OPEN SUPPORT SECTION
========================================================= */

export function openSupportSection() {

  const supportNav =
    document.querySelector(
      '.student-nav-link[data-section="support"]'
    );

  if (supportNav) {

    supportNav.click();

    return true;

  }


  const supportLink =
    document.querySelector(
      '[data-section-link="#support"]'
    );

  if (supportLink) {

    supportLink.click();

    return true;

  }


  const supportSection =
    document.getElementById(
      'support'
    );

  if (supportSection) {

    window.location.hash =
      'support';

    return true;

  }


  return false;

}


/* =========================================================
   SUPPORT FLOAT SETUP
========================================================= */

export function setupSupportFloat() {

  const float =
    getSupportFloat();

  if (!float) {
    return;
  }


  const closeButton =
    $('studentSupportFloatClose');


  const laterButton =
    $('studentSupportFloatLater');


  const supportButton =
    $('studentSupportFloatSupport');


  if (closeButton) {

    closeButton.addEventListener(
      'click',
      event => {

        event.preventDefault();

        hideSupportFloat(
          true
        );

      }
    );

  }


  if (laterButton) {

    laterButton.addEventListener(
      'click',
      event => {

        event.preventDefault();

        hideSupportFloat(
          true
        );

      }
    );

  }


  if (supportButton) {

    supportButton.addEventListener(
      'click',
      event => {

        event.preventDefault();

        hideSupportFloat(
          true
        );

        window.setTimeout(
          () => {

            openSupportSection();

          },
          50
        );

      }
    );

  }


  if (
    supportWasDismissedRecently()
  ) {

    return;

  }


  window.setTimeout(
    () => {

      const dashboard =
        $('studentDashboard');

      if (!dashboard) {
        return;
      }


      const loading =
        $('studentPageLoading');


      if (
        loading &&
        !loading.hidden
      ) {

        return;

      }


      if (
        state.currentSection === 'support'
      ) {

        return;

      }


      showSupportFloat();

    },
    SUPPORT_FLOAT_DELAY
  );

}


/* =========================================================
   COPY TEXT
========================================================= */

async function copyText(
  value
) {

  const text =
    safeString(value);

  if (!text) {
    return false;
  }


  if (
    navigator.clipboard &&
    typeof navigator.clipboard.writeText ===
      'function'
  ) {

    try {

      await navigator.clipboard.writeText(
        text
      );

      return true;

    } catch {

      /* Continue with fallback. */

    }

  }


  try {

    const textarea =
      document.createElement(
        'textarea'
      );


    textarea.value =
      text;


    textarea.setAttribute(
      'readonly',
      'true'
    );


    textarea.style.position =
      'fixed';


    textarea.style.left =
      '-9999px';


    textarea.style.opacity =
      '0';


    document.body.appendChild(
      textarea
    );


    textarea.focus();


    textarea.select();


    const copied =
      document.execCommand(
        'copy'
      );


    textarea.remove();


    return copied;

  } catch {

    return false;

  }

}


/* =========================================================
   COPY BUTTON STATE
========================================================= */

function setCopyButtonState(
  button,
  copied
) {

  if (!button) {
    return;
  }


  if (!button.dataset.originalLabel) {

    button.dataset.originalLabel =
      button.textContent.trim();

  }


  if (copied) {

    button.textContent =
      'Copied';


    button.classList.add(
      'is-copied'
    );


    window.setTimeout(
      () => {

        button.textContent =
          button.dataset.originalLabel ||
          'Copy account number';


        button.classList.remove(
          'is-copied'
        );

      },
      1800
    );


    return;

  }


  button.textContent =
    'Copy failed';


  window.setTimeout(
    () => {

      button.textContent =
        button.dataset.originalLabel ||
        'Copy account number';

    },
    1800
  );

}


/* =========================================================
   COPY BUTTONS
========================================================= */

export function setupSupportCopyButtons() {

  $$(
    '[data-copy-support-account]'
  )
    .forEach(
      button => {

        if (
          button.dataset.supportCopyBound ===
          'true'
        ) {

          return;

        }


        button.dataset.supportCopyBound =
          'true';


        button.dataset.originalLabel =
          button.textContent.trim();


        button.addEventListener(
          'click',
          async event => {

            event.preventDefault();


            const accountNumber =
              safeString(
                button.dataset.copySupportAccount
              );


            if (!accountNumber) {

              setCopyButtonState(
                button,
                false
              );

              return;

            }


            const copied =
              await copyText(
                accountNumber
              );


            setCopyButtonState(
              button,
              copied
            );

          }
        );

      }
    );

}


/* =========================================================
   FIND EXISTING PAYMENT PANEL
========================================================= */

function findSupportPaymentPanel() {

  const supportSection =
    document.getElementById(
      'support'
    );

  if (!supportSection) {
    return null;
  }


  const studentPanel =
    supportSection.querySelector(
      '.student-support-payment-panel'
    );

  if (studentPanel) {
    return studentPanel;
  }


  const ustazPanel =
    supportSection.querySelector(
      '.ustaz-support-payment-panel'
    );

  if (ustazPanel) {
    return ustazPanel;
  }


  const control =
    supportSection.querySelector(
      '[data-support-amount], ' +
      '[data-student-support-amount], ' +
      '[data-support-payment], ' +
      '[data-student-support-payment], ' +
      '#studentSupportPayButton'
    );

  if (control) {

    return (
      control.closest('article') ||
      control.closest('[class*="panel"]')
    );

  }


  const articles =
    Array.from(
      supportSection.querySelectorAll(
        'article'
      )
    );


  return (
    articles[1] ||
    articles[0] ||
    null
  );

}


/* =========================================================
   SUPPORT SECTION ORDER
=========================================================

   IMPORTANT
   ---------------------------------------------------------
   This is the only layout/order change in this file.

   The existing bank panel remains exactly as rendered.
   The existing contribution/story panel remains exactly as
   rendered. We simply move the bank panel before the other
   Support article.

========================================================= */

function moveSupportBankPanelFirst() {

  const supportSection =
    document.getElementById(
      'support'
    );

  if (!supportSection) {
    return;
  }

  const paymentPanel =
    findSupportPaymentPanel();

  if (!paymentPanel) {
    return;
  }

  const paymentArticle =
    paymentPanel.closest('article') ||
    paymentPanel;

  const articles =
    Array.from(
      supportSection.querySelectorAll(
        'article'
      )
    );

  const contributionArticle =
    articles.find(
      article =>
        article !== paymentArticle
    );

  if (
    !contributionArticle ||
    !paymentArticle ||
    contributionArticle.parentNode !==
      paymentArticle.parentNode
  ) {
    return;
  }

  contributionArticle.parentNode.insertBefore(
    paymentArticle,
    contributionArticle
  );

}


/* =========================================================
   CREATE BANK CARD
========================================================= */

function createBankCard(
  account
) {

  const card =
    document.createElement(
      'div'
    );


  card.className =
    'student-support-bank-card';


  const header =
    document.createElement(
      'div'
    );


  header.className =
    'student-support-bank-card-header';


  const icon =
    document.createElement(
      'div'
    );


  icon.className =
    'student-support-bank-icon';


  icon.innerHTML =
    `
      <i
        class="fa-solid fa-building-columns"
        aria-hidden="true"
      ></i>
    `;


  const bankName =
    document.createElement(
      'h3'
    );


  bankName.className =
    'student-support-bank-name';


  bankName.textContent =
    account.bank;


  header.append(
    icon,
    bankName
  );


  const accountNameBlock =
    document.createElement(
      'div'
    );


  accountNameBlock.className =
    'student-support-bank-field';


  const accountNameLabel =
    document.createElement(
      'span'
    );


  accountNameLabel.className =
    'student-support-bank-label';


  accountNameLabel.textContent =
    'Account Name';


  const accountNameValue =
    document.createElement(
      'strong'
    );


  accountNameValue.className =
    'student-support-bank-value';


  accountNameValue.textContent =
    account.accountName;


  accountNameBlock.append(
    accountNameLabel,
    accountNameValue
  );


  const accountNumberBlock =
    document.createElement(
      'div'
    );


  accountNumberBlock.className =
    'student-support-bank-field';


  const accountNumberLabel =
    document.createElement(
      'span'
    );


  accountNumberLabel.className =
    'student-support-bank-label';


  accountNumberLabel.textContent =
    'Account Number';


  const accountNumberRow =
    document.createElement(
      'div'
    );


  accountNumberRow.className =
    'student-support-bank-number-row';


  const accountNumber =
    document.createElement(
      'strong'
    );


  accountNumber.className =
    'student-support-bank-number';


  accountNumber.textContent =
    account.accountNumber;


  const copyButton =
    document.createElement(
      'button'
    );


  copyButton.type =
    'button';


  copyButton.className =
    'student-support-copy-button';


  copyButton.textContent =
    'Copy';


  copyButton.dataset.copySupportAccount =
    account.accountNumber;


  accountNumberRow.append(
    accountNumber,
    copyButton
  );


  accountNumberBlock.append(
    accountNumberLabel,
    accountNumberRow
  );


  card.append(
    header,
    accountNameBlock,
    accountNumberBlock
  );


  return card;

}


/* =========================================================
   REPLACE PAYMENT PANEL CONTENT
========================================================= */

export function renderSupportBankAccounts() {

  const panel =
    findSupportPaymentPanel();


  if (!panel) {

    console.warn(
      '[BarakaLink] Support payment panel was not found.'
    );

    return;

  }


  const accounts =
    getSupportAccounts();


  panel.replaceChildren();


  const header =
    document.createElement(
      'div'
    );


  header.className =
    'student-support-bank-panel-header';


  const eyebrow =
    document.createElement(
      'span'
    );


  eyebrow.className =
    'student-support-bank-panel-eyebrow';


  eyebrow.textContent =
    'Bank Support';


  const title =
    document.createElement(
      'h2'
    );


  title.textContent =
    '';


  header.append(
    eyebrow,
    title
  );


  panel.appendChild(
    header
  );


  const description =
    document.createElement(
      'p'
    );


  description.className =
    'student-support-bank-description';


  description.textContent =
    'Online payments are not available yet.';


  panel.appendChild(
    description
  );


  const notice =
    document.createElement(
      'div'
    );


  notice.className =
    'student-support-bank-notice';


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


  const accountsHeading =
    document.createElement(
      'h3'
    );


  accountsHeading.className =
    'student-support-bank-heading';


  accountsHeading.textContent =
    'Official bank accounts';


  panel.appendChild(
    accountsHeading
  );


  const list =
    document.createElement(
      'div'
    );


  list.className =
    'student-support-bank-list';


  if (!accounts.length) {

    const empty =
      document.createElement(
        'div'
      );


    empty.className =
      'student-support-bank-empty';


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
          Add the real BarakaLink account name and account number in student-support.js.
        </span>
      `;


    list.appendChild(
      empty
    );

  } else {

    accounts.forEach(
      account => {

        list.appendChild(
          createBankCard(
            account
          )
        );

      }
    );

  }


  panel.appendChild(
    list
  );


  const thankYou =
    document.createElement(
      'p'
    );


  thankYou.className =
    'student-support-bank-thank-you';


  thankYou.textContent =
    'Thank you for supporting the work behind BarakaLink.';


  panel.appendChild(
    thankYou
  );


  setupSupportCopyButtons();

}


/* =========================================================
   OPTIONAL LEGACY CLEANUP
========================================================= */

function hideLegacyPaymentElements() {

  const selectors = [

    '[data-support-amount]',

    '[data-support-payment]',

    '#studentSupportCustomWrap',

    '#studentSupportPayButton',

    '.student-support-amounts',

    '.student-support-payment-methods',

    '.student-support-payment-options',

    '.student-support-checkout',

    '.student-support-payment-note'

  ];


  selectors.forEach(
    selector => {

      $$(selector)
        .forEach(
          element => {

            element.hidden =
              true;

            element.setAttribute(
              'aria-hidden',
              'true'
            );

          }
        );

    }
  );

}


/* =========================================================
   SUPPORT STYLES
========================================================= */

export function injectBarakaSupportStyles() {

  if (
    document.querySelector(
      'style[data-barakalink-support-ui]'
    )
  ) {

    return;

  }


  const style =
    document.createElement(
      'style'
    );


  style.setAttribute(
    'data-barakalink-support-ui',
    'true'
  );


  style.textContent =
`
:where(.student-support-float[hidden]),
:where(.student-coming-soon-modal[hidden]) {
  display: none !important;
}


/* =========================================================
   SUPPORT FLOAT
========================================================= */

:where(.student-support-float) {
  position: fixed;
  top: 86px;
  right: 20px;
  z-index: 800;
  width: min(370px, calc(100vw - 32px));
  opacity: 0;
  transform: translateY(-8px);
  transition:
    opacity 0.22s ease,
    transform 0.22s ease;
}


:where(.student-support-float.is-open) {
  opacity: 1;
  transform: translateY(0);
}


/* =========================================================
   BANK PANEL HEADER
========================================================= */

:where(.student-support-bank-panel-header) {
  margin-bottom: 14px;
}


:where(.student-support-bank-panel-eyebrow) {
  display: block;
  margin-bottom: 5px;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgb(154, 116, 32);
  opacity: 0.8;
}


:where(.student-support-bank-panel-header h2) {
  margin: 0;
}


/* =========================================================
   BANK DESCRIPTION
========================================================= */

:where(.student-support-bank-description) {
  margin: 0 0 16px;
  line-height: 1.6;
}


/* =========================================================
   BANK NOTICE
========================================================= */

:where(.student-support-bank-notice) {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  margin-bottom: 20px;
  padding: 12px 13px;
  border-radius: 12px;

  background:
    linear-gradient(
      145deg,
      rgba(255, 255, 255, 0.96),
      rgba(250, 247, 238, 0.96)
    );

  border: 1px solid rgba(154, 116, 32, 0.14);

  line-height: 1.45;
  font-size: 0.9rem;
}


:where(.student-support-bank-notice i) {
  flex: 0 0 auto;
  margin-top: 2px;
  color: rgb(154, 116, 32);
}


/* =========================================================
   BANK HEADING
========================================================= */

:where(.student-support-bank-heading) {
  margin: 0 0 12px;
  font-size: 1rem;
  color: rgb(154, 116, 32);
}


/* =========================================================
   BANK LIST
========================================================= */

:where(.student-support-bank-list) {
  display: grid;
  gap: 12px;
}


/* =========================================================
   BANK CARD
========================================================= */

:where(.student-support-bank-card) {
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


:where(.student-support-bank-card:hover) {
  transform: translateY(-1px);

  border-color:
    rgba(154, 116, 32, 0.28);

  box-shadow:
    0 9px 24px rgba(154, 116, 32, 0.11);
}


/* =========================================================
   BANK CARD HEADER
========================================================= */

:where(.student-support-bank-card-header) {
  display: flex;
  align-items: center;
  gap: 11px;
  margin-bottom: 14px;
}


/* =========================================================
   BANK ICON
========================================================= */

:where(.student-support-bank-icon) {
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

  box-shadow:
    0 4px 12px rgba(154, 116, 32, 0.07);
}


:where(.student-support-bank-icon i) {
  color: rgb(154, 116, 32);
  font-size: 16px;
}


/* =========================================================
   BANK NAME
========================================================= */

:where(.student-support-bank-name) {
  margin: 0;
  font-size: 1rem;
  line-height: 1.35;
  color: rgb(154, 116, 32);
}


/* =========================================================
   BANK FIELD
========================================================= */

:where(.student-support-bank-field) {
  margin-top: 10px;
}


/* =========================================================
   BANK LABEL
========================================================= */

:where(.student-support-bank-label) {
  display: block;
  margin-bottom: 4px;

  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;

  color: rgb(154, 116, 32);

  opacity: 0.75;
}


/* =========================================================
   ACCOUNT NAME
========================================================= */

:where(.student-support-bank-value) {
  display: block;
  line-height: 1.45;
  font-weight: 600;
}


/* =========================================================
   ACCOUNT NUMBER ROW
========================================================= */

:where(.student-support-bank-number-row) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}


/* =========================================================
   ACCOUNT NUMBER
========================================================= */

:where(.student-support-bank-number) {
  display: block;
  word-break: break-word;
  letter-spacing: 0.035em;
  font-weight: 700;
}


/* =========================================================
   COPY BUTTON
========================================================= */

:where(.student-support-copy-button) {
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

  box-shadow:
    0 3px 9px rgba(154, 116, 32, 0.05);

  transition:
    background 0.18s ease,
    border-color 0.18s ease,
    transform 0.18s ease,
    box-shadow 0.18s ease;
}


:where(.student-support-copy-button:hover) {
  color: rgb(154, 116, 32);

  border-color:
    rgba(154, 116, 32, 0.42);

  transform: translateY(-1px);

  box-shadow:
    0 5px 12px rgba(154, 116, 32, 0.09);
}


:where(.student-support-copy-button:active) {
  transform: translateY(0);
}


/* =========================================================
   COPIED STATE
========================================================= */

:where(.student-support-copy-button.is-copied) {
  color: rgb(154, 116, 32);
  border-color: rgb(154, 116, 32);
  font-weight: 700;
}


/* =========================================================
   EMPTY STATE
========================================================= */

:where(.student-support-bank-empty) {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;

  gap: 7px;

  padding: 22px;

  border-radius: 14px;

  background:
    linear-gradient(
      145deg,
      rgba(255, 255, 255, 0.96),
      rgba(250, 247, 238, 0.96)
    );

  border: 1px solid rgba(154, 116, 32, 0.13);

  text-align: center;

  line-height: 1.45;
}


:where(.student-support-bank-empty i) {
  margin-bottom: 2px;
  font-size: 23px;
  color: rgb(154, 116, 32);
}


:where(.student-support-bank-empty strong) {
  color: rgb(154, 116, 32);
}


/* =========================================================
   THANK YOU
========================================================= */

:where(.student-support-bank-thank-you) {
  margin: 18px 0 0;
  padding-top: 16px;

  border-top:
    1px solid rgba(154, 116, 32, 0.12);

  line-height: 1.5;
  opacity: 0.75;
}


:where(.student-support-bank-thank-you::first-letter) {
  color: rgb(154, 116, 32);
}


/* =========================================================
   OLD PAYMENT CONTROLS
========================================================= */

:where(
  [data-support-amount],
  [data-support-payment],
  #studentSupportCustomWrap,
  #studentSupportPayButton,
  .student-support-amounts,
  .student-support-payment-methods,
  .student-support-payment-options,
  .student-support-checkout
) {
  display: none !important;
}


/* =========================================================
   COMING SOON MODAL
========================================================= */

:where(.student-coming-soon-modal) {
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


:where(.student-coming-soon-modal.is-open) {
  opacity: 1;
  visibility: visible;
}


/* =========================================================
   COMING SOON BACKDROP
========================================================= */

:where(.student-coming-soon-backdrop) {
  position: absolute;
  inset: 0;

  background:
    rgba(10, 12, 18, 0.58);

  backdrop-filter:
    blur(4px);
}


/* =========================================================
   COMING SOON DIALOG
========================================================= */

:where(.student-coming-soon-dialog) {
  position: relative;
  z-index: 1;

  width:
    min(440px, calc(100vw - 40px));

  max-height:
    calc(100vh - 40px);

  overflow-y: auto;
}


/* =========================================================
   MODAL BODY LOCK
========================================================= */

body.student-modal-open {
  overflow: hidden;
}


/* =========================================================
   MOBILE
========================================================= */

@media (max-width: 640px) {

  :where(.student-support-float) {
    top: 76px;
    left: 16px;
    right: 16px;
    width: auto;
  }


  :where(.student-support-bank-card) {
    padding: 15px;
  }


  :where(.student-support-bank-number-row) {
    align-items: stretch;
    flex-direction: column;
    gap: 9px;
  }


  :where(.student-support-copy-button) {
    width: 100%;
  }


  :where(.student-coming-soon-modal) {
    padding: 16px;
  }


  :where(.student-coming-soon-dialog) {
    width:
      min(440px, calc(100vw - 32px));
  }

}


/* =========================================================
   REDUCED MOTION
========================================================= */

@media (prefers-reduced-motion: reduce) {

  :where(
    .student-support-float,
    .student-support-bank-card,
    .student-support-copy-button,
    .student-coming-soon-modal
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
   INITIALIZE
========================================================= */

export function initializeStudentSupportUI() {

  injectBarakaSupportStyles();


  initializeStudentModals({
    hideSupportFloat
  });


  hideLegacyPaymentElements();


  renderSupportBankAccounts();


  /*
   * ONLY POSITION CHANGE:
   * Place the existing bank panel before the existing
   * contribution/story panel. No panel styling or content
   * is changed here.
   */
  moveSupportBankPanelFirst();


  setupSupportFloat();

}
