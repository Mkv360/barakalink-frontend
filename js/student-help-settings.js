/*
 * BarakaLink — Parent Help & Settings
 *
 * Connects the existing Parent Report, Feedback and Ask BarakaLink forms
 * to the authenticated Parent Support API without changing their markup.
 * Explicit data-submit-endpoint attributes are respected. Known form IDs
 * have safe endpoint fallbacks so a blank HTML attribute cannot silently
 * leave these three forms disconnected.
 */
(function () {
    'use strict';

    const NOT_CONNECTED =
      "Sending isn't available yet, so nothing has been submitted. " +
      "Your text is still here if you'd like to try again later.";

    const byId = (id) => document.getElementById(id);

    const SUPPORT_ENDPOINTS = Object.freeze({
      studentReportForm: '/parent-support/report',
      studentFeedbackForm: '/parent-support/feedback',
      studentContactForm: '/parent-support/contact',
    });


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

        const configuredEndpoint =
          (form.getAttribute('data-submit-endpoint') || '').trim();

        const endpoint =
          configuredEndpoint || SUPPORT_ENDPOINTS[form.id] || '';

        const api = window.BarakaLinkAPI;

        /* Keep unrelated, intentionally-unconnected forms unchanged. */
        if (!endpoint) {
          setStatus(form, NOT_CONNECTED, 'info');
          return;
        }

        /* The shared BarakaLink helper exposes request() in current flows.
           Support post() as a compatibility option for older helper builds. */
        if (
          !api ||
          (typeof api.request !== 'function' && typeof api.post !== 'function')
        ) {
          setStatus(
            form,
            'BarakaLink could not connect to the API helper. Refresh the page and try again.',
            'error'
          );
          return;
        }

        setBusy(form, true);
        setStatus(form, '');

        try {
          const data = collect(form);
          const response = typeof api.request === 'function'
            ? await api.request(endpoint, { method: 'POST', body: data })
            : await api.post(endpoint, data);

          if (response && response.success === false) {
            throw new Error(response.message || 'The message could not be sent.');
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
