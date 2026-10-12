'use strict';

(function () {

  /* =========================================================
     BARAKALINK — LEARNING REQUEST CANCELLATION
  ========================================================== */

  const API_BASE =
    window.BARAKALINK_API_BASE ||
    'http://localhost:5000/api';


  /* =========================================================
     ELEMENTS
  ========================================================== */

  const modal =
    document.getElementById(
      'studentLearningCancelModal'
    );

  const form =
    document.getElementById(
      'studentLearningCancelForm'
    );

  const closeButton =
    document.getElementById(
      'studentLearningCancelClose'
    );

  const keepButton =
    document.getElementById(
      'studentLearningCancelKeep'
    );

  const backdrop =
    modal
      ? modal.querySelector(
          '[data-learning-cancel-close]'
        )
      : null;

  const otherWrap =
    document.getElementById(
      'studentLearningCancelOther'
    );

  const otherText =
    document.getElementById(
      'studentLearningCancelOtherText'
    );

  const errorBox =
    document.getElementById(
      'studentLearningCancelError'
    );

  const submitButton =
    document.getElementById(
      'studentLearningCancelSubmit'
    );

  const requestsContainer =
    document.getElementById(
      'studentLearningRequests'
    );


  /* =========================================================
     STATE
  ========================================================== */

  let activeRequestId = null;

  let activeRequestCard = null;


  /* =========================================================
     ERROR
  ========================================================== */

  function clearError() {

    if (!errorBox) {
      return;
    }

    errorBox.textContent = '';

    errorBox.hidden = true;

  }


  function showError(message) {

    if (!errorBox) {
      return;
    }

    errorBox.textContent =
      message ||
      'Something went wrong.';

    errorBox.hidden = false;

  }


  /* =========================================================
     OPEN MODAL
  ========================================================== */

  function openCancelModal(
    requestId,
    requestCard
  ) {

    if (
      !modal ||
      !form ||
      !requestId
    ) {
      return;
    }


    activeRequestId =
      String(requestId);

    activeRequestCard =
      requestCard || null;


    /* Reset form */

    form.reset();


    /* Hide Other field */

    if (otherWrap) {
      otherWrap.hidden = true;
    }


    if (otherText) {
      otherText.value = '';
    }


    clearError();


    /* Open modal */

    modal.hidden = false;

    modal.setAttribute(
      'aria-hidden',
      'false'
    );


    document.body.classList.add(
      'student-learning-cancel-open'
    );


    requestAnimationFrame(function () {

      modal.classList.add(
        'is-open'
      );


      const firstReason =
        form.querySelector(
          'input[name="cancel_reason"]'
        );


      if (firstReason) {
        firstReason.focus();
      }

    });

  }


  /* =========================================================
     CLOSE MODAL
  ========================================================== */

  function closeCancelModal() {

    if (!modal) {
      return;
    }


    modal.classList.remove(
      'is-open'
    );


    modal.setAttribute(
      'aria-hidden',
      'true'
    );


    document.body.classList.remove(
      'student-learning-cancel-open'
    );


    window.setTimeout(function () {

      if (
        !modal.classList.contains(
          'is-open'
        )
      ) {

        modal.hidden = true;

      }

    }, 220);


    activeRequestId = null;

    activeRequestCard = null;

    clearError();

  }


  /* =========================================================
     SHOW / HIDE OTHER TEXT
  ========================================================== */

  function updateOtherField() {

    if (!form || !otherWrap) {
      return;
    }


    const selected =
      form.querySelector(
        'input[name="cancel_reason"]:checked'
      );


    const isOther =
      selected &&
      selected.value === 'other';


    otherWrap.hidden =
      !isOther;


    if (isOther) {

      window.setTimeout(function () {

        if (otherText) {
          otherText.focus();
        }

      }, 0);

    } else if (otherText) {

      otherText.value = '';

    }

  }


  /* =========================================================
     SET LOADING STATE
  ========================================================== */

  function setSubmitting(
    submitting
  ) {

    if (!submitButton) {
      return;
    }


    if (submitting) {

      submitButton.disabled = true;


      submitButton.dataset.originalHtml =
        submitButton.innerHTML;


      submitButton.innerHTML = `
        <i
          class="fa-solid fa-circle-notch fa-spin"
          aria-hidden="true"
        ></i>

        <span>
          Canceling...
        </span>
      `;

    } else {

      submitButton.disabled = false;


      if (
        submitButton.dataset.originalHtml
      ) {

        submitButton.innerHTML =
          submitButton.dataset.originalHtml;

        delete submitButton.dataset.originalHtml;

      }

    }

  }


  /* =========================================================
     CANCEL REQUEST — SERVER
  ========================================================== */

  async function cancelRequest(
    requestId,
    reasonCode,
    reasonText
  ) {

    const endpoint =
      `${API_BASE}/learning-requests/${encodeURIComponent(
        String(requestId)
      )}/cancel`;


    const response =
      await fetch(
        endpoint,
        {
          method: 'POST',

          credentials: 'include',

          headers: {
            'Content-Type':
              'application/json'
          },

          body: JSON.stringify({
            reason_code:
              reasonCode,

            reason_text:
              reasonText || null
          })
        }
      );


    let payload = {};

    try {

      payload =
        await response.json();

    } catch (error) {

      payload = {};

    }


    if (!response.ok) {

      throw new Error(
        payload?.message ||
        payload?.error ||
        `Unable to cancel request (${response.status}).`
      );

    }


    return payload;

  }


  /* =========================================================
     UPDATE REQUEST CARD AFTER SUCCESS
  ========================================================== */

  function updateCanceledCard(
    card
  ) {

    if (!card) {
      return;
    }


    card.dataset.status =
      'cancelled';


    /*
     * Change the status badge.
     */

    const statusElement =
      card.querySelector(
        '.student-learning-request-status'
      );


    if (statusElement) {

      statusElement.className =
        'student-learning-request-status is-cancelled';

      statusElement.textContent =
        'Canceled';

    }


    /*
     * Remove the cancel button.
     */

    const cancelButton =
      card.querySelector(
        '[data-learning-request-cancel]'
      );


    if (cancelButton) {
      cancelButton.remove();
    }


    /*
     * Replace the pending note.
     */

    const note =
      card.querySelector(
        '.student-learning-request-note'
      );


    if (note) {

      note.className =
        'student-learning-request-note is-cancelled';

      note.textContent =
        'This learning request was canceled by you.';

    }


    /*
     * Make sure any request actions wrapper
     * left empty is removed.
     */

    const actions =
      card.querySelector(
        '.student-learning-request-actions'
      );


    if (
      actions &&
      !actions.children.length
    ) {
      actions.remove();
    }

  }


  /* =========================================================
     SUBMIT FORM
  ========================================================== */

  async function handleSubmit(
    event
  ) {

    event.preventDefault();


    clearError();


    if (!activeRequestId) {

      showError(
        'This learning request could not be identified.'
      );

      return;

    }


    const selected =
      form
        ? form.querySelector(
            'input[name="cancel_reason"]:checked'
          )
        : null;


    if (!selected) {

      showError(
        'Please select a reason for canceling your request.'
      );

      return;

    }


    const reasonCode =
      selected.value;


    let reasonText = null;


    if (
      reasonCode === 'other'
    ) {

      reasonText =
        otherText
          ? otherText.value.trim()
          : '';


      if (!reasonText) {

        showError(
          'Please explain the issue before canceling this request.'
        );


        if (otherText) {
          otherText.focus();
        }


        return;

      }

    }


    setSubmitting(true);


    try {

      await cancelRequest(
        activeRequestId,
        reasonCode,
        reasonText
      );


      /*
       * Update the visible card immediately.
       */

      updateCanceledCard(
        activeRequestCard
      );


      /*
       * Tell the rest of the dashboard
       * that a request was canceled.
       */

      window.dispatchEvent(
        new CustomEvent(
          'barakalink:learning-request-canceled',
          {
            detail: {
              requestId:
                activeRequestId,

              reasonCode:
                reasonCode,

              reasonText:
                reasonText
            }
          }
        )
      );


      closeCancelModal();


    } catch (error) {

      console.error(
        '[learning-request-cancel]',
        error
      );


      showError(
        error?.message ||
        'We could not cancel this request. Please try again.'
      );

    } finally {

      setSubmitting(false);

    }

  }


  /* =========================================================
     REQUEST CARD CLICK
     EVENT DELEGATION
  ========================================================== */

  if (requestsContainer) {

    requestsContainer.addEventListener(
      'click',
      function (event) {

        const button =
          event.target.closest(
            '[data-learning-request-cancel]'
          );


        if (!button) {
          return;
        }


        event.preventDefault();

        event.stopPropagation();


        const requestId =
          button.dataset.requestId;


        if (!requestId) {

          console.warn(
            '[learning-request-cancel] Missing request ID.'
          );

          return;

        }


        const card =
          button.closest(
            '.student-learning-request-card'
          );


        openCancelModal(
          requestId,
          card
        );

      }
    );

  }


  /* =========================================================
     REASON CHANGE
  ========================================================== */

  if (form) {

    form.addEventListener(
      'change',
      function (event) {

        if (
          event.target.matches(
            'input[name="cancel_reason"]'
          )
        ) {

          updateOtherField();

        }

      }
    );


    form.addEventListener(
      'submit',
      handleSubmit
    );

  }


  /* =========================================================
     CLOSE CONTROLS
  ========================================================== */

  if (closeButton) {

    closeButton.addEventListener(
      'click',
      closeCancelModal
    );

  }


  if (keepButton) {

    keepButton.addEventListener(
      'click',
      closeCancelModal
    );

  }


  if (backdrop) {

    backdrop.addEventListener(
      'click',
      closeCancelModal
    );

  }


  /* =========================================================
     ESC KEY
  ========================================================== */

  document.addEventListener(
    'keydown',
    function (event) {

      if (
        event.key !== 'Escape'
      ) {
        return;
      }


      if (
        !modal ||
        modal.hidden
      ) {
        return;
      }


      if (
        submitButton &&
        submitButton.disabled
      ) {
        return;
      }


      event.preventDefault();

      closeCancelModal();

    }
  );


  /* =========================================================
     INITIAL SAFETY
  ========================================================== */

  if (modal) {

    modal.hidden = true;

    modal.setAttribute(
      'aria-hidden',
      'true'
    );

  }


})();