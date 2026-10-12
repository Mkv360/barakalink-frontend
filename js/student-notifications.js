'use strict';

/* =========================================================
   BARAKALINK STUDENT DASHBOARD NOTIFICATIONS
========================================================= */

import { STUDENT_CONFIG, $, $$ } from './student-core.js';
import { state } from './student-state.js';
import { safeString, formatRelativeDate } from './student-utils.js';
import { apiRequest } from './student-api.js';

const notificationDependencies = {
  closeProfileMenu: null,
};

export function openNotificationPanel() {

  const panel =
    $('studentNotificationPanel');

  const button =
    $('studentNotificationButton');


  if (!panel) {
    return;
  }


  panel.hidden =
    false;


  state.notificationPanelOpen =
    true;


  if (button) {

    button.setAttribute(
      'aria-expanded',
      'true'
    );

  }

}


export function closeNotificationPanel() {

  const panel =
    $('studentNotificationPanel');

  const button =
    $('studentNotificationButton');


  if (!panel) {
    return;
  }


  panel.hidden =
    true;


  state.notificationPanelOpen =
    false;


  if (button) {

    button.setAttribute(
      'aria-expanded',
      'false'
    );

  }

}


export function toggleNotificationPanel() {

  if (
    state.notificationPanelOpen
  ) {

    closeNotificationPanel();

  } else {

    notificationDependencies.closeProfileMenu?.();

    openNotificationPanel();

  }

}


export function setupNotificationPanel(dependencies = {}) {

  Object.assign(notificationDependencies, dependencies);

  const button =
    $('studentNotificationButton');


  if (button) {

    button.addEventListener(
      'click',
      event => {

        event.stopPropagation();

        toggleNotificationPanel();

      }
    );

  }


  const panel =
    $('studentNotificationPanel');


  if (panel) {

    panel.addEventListener(
      'click',
      event => {

        event.stopPropagation();

      }
    );

  }


  document.addEventListener(
    'click',
    () => {

      notificationDependencies.closeProfileMenu?.();
      closeNotificationPanel();

    }
  );


  const clearButton =
    $('studentNotificationClear');


  if (clearButton) {

    clearButton.addEventListener(
      'click',
      () => {

        state.notifications = [];

        renderNotifications();

      }
    );

  }

}


export function renderNotifications() {

  const list =
    $('studentNotificationList');

  const badge =
    $('studentNotificationBadge');


  if (!list) {
    return;
  }


  const notifications =
    Array.isArray(
      state.notifications
    )
      ? state.notifications
      : [];


  list.innerHTML =
    '';


  if (!notifications.length) {

    list.innerHTML =
      `
        <div class="student-notification-empty">

          <div class="student-notification-empty-icon">
            <i
              class="fa-regular fa-bell"
              aria-hidden="true"
            ></i>
          </div>

          <strong>
            No new notifications
          </strong>

          <p>
            New learning and teacher updates will appear here.
          </p>

        </div>
      `;


    if (badge) {
      badge.hidden = true;
    }


    return;

  }


  const limited =
    notifications.slice(
      0,
      STUDENT_CONFIG.MAX_NOTIFICATIONS
    );


  limited.forEach(
    notification => {

      const item =
        document.createElement(
          'article'
        );


      item.className =
        'student-notification-item';


      const title =
        safeString(
          notification.title ??
          notification.name,
          'Notification'
        );


      const message =
        safeString(
          notification.message ??
          notification.body,
          ''
        );


      const createdAt =
        notification.createdAt ??
        notification.created_at ??
        '';


      item.innerHTML =
        `
          <div
            class="student-notification-item-icon"
          >
            <i
              class="fa-regular fa-bell"
              aria-hidden="true"
            ></i>
          </div>

          <div
            class="student-notification-item-copy"
          >

            <strong></strong>

            <p></p>

            <small></small>

          </div>
        `;


      const titleElement =
        item.querySelector(
          'strong'
        );

      const messageElement =
        item.querySelector(
          'p'
        );

      const dateElement =
        item.querySelector(
          'small'
        );


      if (titleElement) {
        titleElement.textContent =
          title;
      }


      if (messageElement) {
        messageElement.textContent =
          message;
      }


      if (dateElement) {
        dateElement.textContent =
          formatRelativeDate(
            createdAt
          );
      }


      list.appendChild(
        item
      );

    }
  );


  if (badge) {

    badge.hidden = false;

    badge.textContent =
      String(
        notifications.length > 99
          ? '99+'
          : notifications.length
      );

  }

}


export async function loadNotifications() {

  /*
   * The current dashboard HTML is ready for notifications,
   * but no confirmed parent notification endpoint has been
   * provided yet.

   * Therefore:
   * - No guessed endpoint
   * - No fake notifications
   * - No failing 404 requests

   * A future endpoint can be enabled by setting:
      window.BARAKALINK_NOTIFICATIONS_ENDPOINT
  */

  const endpoint =
    STUDENT_CONFIG.NOTIFICATIONS_ENDPOINT;


  if (!endpoint) {

    state.notifications = [];

    renderNotifications();

    return [];

  }


  try {

    const payload =
      await apiRequest(
        endpoint
      );


    const data =
      payload?.data ??
      payload ??
      [];


    state.notifications =
      Array.isArray(data)
        ? data
        : Array.isArray(
            data.notifications
          )
          ? data.notifications
          : [];


    renderNotifications();


    return state.notifications;

  } catch (error) {

    console.warn(
      '[student.js] Notifications could not be loaded:',
      error
    );


    state.notifications = [];

    renderNotifications();


    return [];

  }

}
