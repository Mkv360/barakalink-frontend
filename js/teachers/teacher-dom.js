"use strict";
import { text } from "./teacher-core.js";
import { state } from "./teacher-state.js";

const $ = (id) => document.getElementById(id);
  const $$ = (selector, root = document) =>
    Array.from(root.querySelectorAll(selector));


  function setText(
    id,
    value,
    fallback = ""
  ) {
    const element = $(id);

    if (!element) return;

    element.textContent =
      text(value, fallback);
  }



  function setHidden(
    id,
    hidden
  ) {
    const element = $(id);

    if (!element) return;

    element.hidden =
      Boolean(hidden);
  }



  function showLoading(
    show
  ) {
    const loading =
      $("ustazPageLoading");

    if (loading) {
      loading.hidden =
        !show;
    }
  }



  function showError(
    message
  ) {
    const panel =
      $("ustazPageError");

    const messageElement =
      $("ustazPageErrorMessage");

    if (messageElement) {
      messageElement.textContent =
        text(
          message,
          "Please try again."
        );
    }

    if (panel) {
      panel.hidden =
        false;
    }
  }



  function hideError() {
    const panel =
      $("ustazPageError");

    if (panel) {
      panel.hidden =
        true;
    }
  }



  function openProfileMenu(
    trigger = null
  ) {
    const menu =
      $("ustazProfileMenu");

    if (!menu) {
      return;
    }

    closeNotificationPanel();

    menu.hidden =
      false;

    state.profileMenuOpen =
      true;

    const buttons = [
      $("ustazAvatarButton"),
      $("ustazSidebarProfileButton"),
    ].filter(Boolean);

    buttons.forEach(
      (button) => {
        button.setAttribute(
          "aria-expanded",
          button === trigger
            ? "true"
            : "false"
        );
      }
    );
  }



  function closeProfileMenu() {
    const menu =
      $("ustazProfileMenu");

    const buttons = [
      $("ustazAvatarButton"),
      $("ustazSidebarProfileButton"),
    ].filter(Boolean);

    state.profileMenuOpen =
      false;

    if (menu) {
      menu.hidden =
        true;
    }

    buttons.forEach(
      (button) => {
        button.setAttribute(
          "aria-expanded",
          "false"
        );
      }
    );
  }



  function toggleProfileMenu(
    trigger
  ) {
    const menu =
      $("ustazProfileMenu");

    if (!menu) {
      return;
    }

    if (menu.hidden) {
      openProfileMenu(
        trigger
      );
    } else {
      closeProfileMenu();
    }
  }



  function closeNotificationPanel() {
    const panel =
      $("ustazNotificationPanel");

    const button =
      $("ustazNotificationButton");

    state.notificationPanelOpen =
      false;

    if (panel) {
      panel.hidden =
        true;
    }

    if (button) {
      button.setAttribute(
        "aria-expanded",
        "false"
      );
    }
  }

export { $, $$, setText, setHidden, showLoading, showError, hideError, openProfileMenu, closeProfileMenu, toggleProfileMenu, closeNotificationPanel };
