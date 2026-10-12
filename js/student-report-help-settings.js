/*
 * student-report-help-settings.js
 *
 * Extracted from: inline <script> #6, the last script in <body> of
 *   student-dashboard-light-default.html
 *   ("REPORT & FEEDBACK / HELP & CONTACT / SETTINGS BEHAVIOUR").
 *
 * Load as a plain, blocking script at the END of <body>, after all the
 * markup it queries (it looks elements up immediately, not on DOMContentLoaded).
 *
 * Depends on (markup in student.html):
 *   form[data-student-form] (#studentReportForm, #studentFeedbackForm,
 *   #studentContactForm), [data-counter-for], [data-required],
 *   .student-form-status, #themeToggle, #studentSettingsThemeButton,
 *   #studentSettingsThemeLabel, #studentSettingsLogout, #studentSidebarLogout
 * Reads window.BarakaLinkAPI.post at SUBMIT time (api.js loads later with
 * defer, so it is not required to exist when this script first runs).
 *
 * Front-end only: a form is posted only if its data-submit-endpoint is
 * filled in. No endpoint is assumed.
 */
(function () {
  'use strict';

  const NOT_CONNECTED =
    "Sending isn't available yet, so nothing has been submitted. " +
    "Your text is still here if you'd like to try again later.";

  const byId = (id) => document.getElementById(id);


  /* -------------------------------------------------------
     CHARACTER COUNTERS
  ------------------------------------------------------- */

  function updateCounter(counter) {
    const field = byId(counter.getAttribute('data-counter-for'));

    if (!field) return;

    const max = field.getAttribute('maxlength');

    counter.textContent =
      field.value.length + (max ? ' / ' + max : '');
  }


  /* -------------------------------------------------------
     VALIDATION
  ------------------------------------------------------- */

  function isRadioGroup(item) {
    return item.getAttribute('role') === 'radiogroup';
  }

  function isEmpty(item) {
    return isRadioGroup(item)
      ? !item.querySelector('input:checked')
      : !String(item.value || '').trim();
  }

  function setError(item, message) {
    const box = byId(item.id + 'Error');

    if (box) box.textContent = message || '';

    if (message) {
      item.setAttribute('aria-invalid', 'true');
    } else {
      item.removeAttribute('aria-invalid');
    }
  }

  /* Returns the first control that needs attention, or null. */
  function validate(form) {
    let firstInvalid = null;

    form.querySelectorAll('[data-required]').forEach((item) => {
      const missing = isEmpty(item);

      setError(
        item,
        missing
          ? (item.getAttribute('data-error') || 'This field is required.')
          : ''
      );

      if (missing && !firstInvalid) {
        firstInvalid = isRadioGroup(item)
          ? item.querySelector('input')
          : item;
      }
    });

    return firstInvalid;
  }


  /* -------------------------------------------------------
     STATUS / BUSY
  ------------------------------------------------------- */

  function setStatus(form, message, tone) {
    const box = form.querySelector('.student-form-status');

    if (!box) return;

    box.textContent = message || '';

    if (message) {
      box.setAttribute('data-tone', tone || 'info');
    } else {
      box.removeAttribute('data-tone');
    }
  }

  function setBusy(form, busy) {
    const button = form.querySelector('button[type="submit"]');

    if (button) button.disabled = busy;

    form.setAttribute('aria-busy', busy ? 'true' : 'false');
  }

  function collect(form) {
    const data = {};

    new FormData(form).forEach((value, key) => {
      data[key] = String(value).trim();
    });

    return data;
  }


  /* -------------------------------------------------------
     FORMS
  ------------------------------------------------------- */

  function setupForm(form) {
    const counters = form.querySelectorAll('[data-counter-for]');

    counters.forEach(updateCounter);


    /* Clear a field's error as soon as it has been fixed. */
    function onEdit(event) {
      const target = event.target;

      if (!(target instanceof Element)) return;

      const item = target.closest('[data-required]');

      if (
        item &&
        item.getAttribute('aria-invalid') === 'true' &&
        !isEmpty(item)
      ) {
        setError(item, '');
      }

      counters.forEach(updateCounter);

      setStatus(form, '');
    }

    form.addEventListener('input', onEdit);
    form.addEventListener('change', onEdit);


    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      const firstInvalid = validate(form);

      if (firstInvalid) {
        setStatus(
          form,
          'Please check the highlighted fields.',
          'error'
        );

        firstInvalid.focus();

        return;
      }

      const endpoint =
        (form.getAttribute('data-submit-endpoint') || '').trim();

      const api = window.BarakaLinkAPI;

      /* Not connected: say so honestly and keep the text. */
      if (!endpoint || !api || typeof api.post !== 'function') {
        setStatus(form, NOT_CONNECTED, 'info');
        return;
      }

      setBusy(form, true);
      setStatus(form, '');

      try {
        const response = await api.post(endpoint, collect(form));

        if (response && response.success === false) {
          throw new Error(response.message || '');
        }

        form.reset();
        counters.forEach(updateCounter);

        setStatus(
          form,
          'Thank you. Your message has been sent.',
          'success'
        );
      } catch (error) {
        setStatus(
          form,
          (error && error.message) ||
            'We could not send this right now. Please try again.',
          'error'
        );
      } finally {
        setBusy(form, false);
      }
    });
  }

  document
    .querySelectorAll('form[data-student-form]')
    .forEach(setupForm);


  /* -------------------------------------------------------
     SETTINGS: THEME
     Uses the existing top-bar theme button, so there is
     still only one theme mechanism.
  ------------------------------------------------------- */

  const themeSource = byId('themeToggle');
  const themeButton = byId('studentSettingsThemeButton');
  const themeLabel = byId('studentSettingsThemeLabel');

  if (themeSource && themeButton && themeLabel) {
    const syncThemeLabel = () => {
      themeLabel.textContent =
        themeSource.getAttribute('aria-label') || 'Switch theme';
    };

    themeButton.addEventListener('click', () => {
      themeSource.click();
    });

    new MutationObserver(syncThemeLabel).observe(
      themeSource,
      {
        attributes: true,
        attributeFilter: ['aria-label'],
      }
    );

    syncThemeLabel();
  }


  /* -------------------------------------------------------
     SETTINGS: LOG OUT
     Hands off to the existing sidebar logout button, which
     already clears the session and redirects.
  ------------------------------------------------------- */

  const settingsLogout = byId('studentSettingsLogout');

  if (settingsLogout) {
    settingsLogout.addEventListener('click', () => {
      const realLogout = byId('studentSidebarLogout');

      if (realLogout) realLogout.click();
    });
  }
})();