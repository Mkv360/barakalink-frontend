"use strict";
import { payloadData, requestMessageNotifications } from "./teacher-api.js";
import { redirectToLogin, stopMessageNotificationPolling } from "./teacher-auth.js";
import { firstName, formatUnreadBadge, fullName, resolveMediaUrl, text } from "./teacher-core.js";
import { $, closeNotificationPanel, closeProfileMenu } from "./teacher-dom.js";
import { CONFIG, state } from "./teacher-state.js";

function normalizeNotificationConversation(
    row
  ) {
    if (
      !row ||
      typeof row !==
        "object"
    ) {
      return null;
    }

    const id =
      Number(
        row.id
      );

    if (
      !Number.isInteger(
        id
      ) ||
      id <= 0
    ) {
      return null;
    }

    const other =
      row.otherUser ??
      row.other_user ??
      {};

    const otherUser = {
      id: Number(
        other.id ??
          row.otherUserId ??
          row.other_user_id
      ),

      firstName: text(
        other.firstName ??
          other.first_name ??
          row.otherFirstName ??
          row.other_first_name
      ),

      lastName: text(
        other.lastName ??
          other.last_name ??
          row.otherLastName ??
          row.other_last_name
      ),

      avatarUrl: text(
        other.avatarUrl ??
          other.avatar_url ??
          row.otherAvatarUrl ??
          row.other_avatar_url
      ),
    };

    if (
      !Number.isInteger(
        otherUser.id
      ) ||
      otherUser.id <= 0
    ) {
      return null;
    }

    const unreadCount =
      Math.max(
        0,
        Number(
          row.unreadCount ??
            row.unread_count ??
            0
        )
      );

    if (
      unreadCount ===
      0
    ) {
      return null;
    }

    const unreadMessage =
      row.unreadMessage ??
      row.unread_message ??
      null;

    const body =
      text(
        unreadMessage?.body ??
          row.unreadMessageBody ??
          row.unread_message_body
      );

    const createdAt =
      unreadMessage?.createdAt ??
      unreadMessage?.created_at ??
      row.unreadMessageCreatedAt ??
      row.unread_message_created_at ??
      null;

    return {
      id,
      otherUser,
      unreadCount,
      body,
      createdAt,
    };
  }



  function formatNotificationTime(
    value
  ) {
    if (!value) {
      return "";
    }

    const date =
      new Date(value);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return "";
    }

    const seconds =
      Math.max(
        0,
        Math.floor(
          (
            Date.now() -
            date.getTime()
          ) /
            1000
        )
      );

    if (seconds < 10) {
      return "Just now";
    }

    if (seconds < 60) {
      return `${seconds} seconds ago`;
    }

    const minutes =
      Math.floor(
        seconds / 60
      );

    if (minutes < 60) {
      return `${minutes} minute${
        minutes === 1
          ? ""
          : "s"
      } ago`;
    }

    const hours =
      Math.floor(
        minutes / 60
      );

    if (hours < 24) {
      return `${hours} hour${
        hours === 1
          ? ""
          : "s"
      } ago`;
    }

    const days =
      Math.floor(
        hours / 24
      );

    if (days < 7) {
      return `${days} day${
        days === 1
          ? ""
          : "s"
      } ago`;
    }

    return date.toLocaleDateString(
      undefined,
      {
        month: "short",
        day: "numeric",
      }
    );
  }



  function notificationInitials(
    user
  ) {
    const first =
      text(
        user?.firstName
      );

    const last =
      text(
        user?.lastName
      );

    return (
      `${first.charAt(0)}${last.charAt(0)}`
        .toUpperCase() ||
      "BL"
    );
  }



  function appendNotificationEmpty(
    list
  ) {
    const empty =
      document.createElement(
        "div"
      );

    empty.className =
      "ustaz-notification-empty";

    const icon =
      document.createElement(
        "div"
      );

    icon.className =
      "ustaz-notification-empty-icon";

    const iconGlyph =
      document.createElement(
        "i"
      );

    iconGlyph.className =
      "fa-regular fa-bell";

    iconGlyph.setAttribute(
      "aria-hidden",
      "true"
    );

    icon.appendChild(
      iconGlyph
    );

    const title =
      document.createElement(
        "strong"
      );

    title.textContent =
      "No new message notifications";

    const message =
      document.createElement(
        "p"
      );

    message.textContent =
      "Unread student messages will appear here.";

    empty.append(
      icon,
      title,
      message
    );

    list.appendChild(
      empty
    );
  }



  function renderNotifications() {
    const list =
      $("ustazNotificationList");

    if (!list) {
      return;
    }

    list.replaceChildren();

    const notifications =
      Array.isArray(
        state.messageNotifications
      )
        ? state.messageNotifications
        : [];

    if (!notifications.length) {
      appendNotificationEmpty(
        list
      );

      return;
    }

    const fragment =
      document.createDocumentFragment();

    notifications.forEach(
      (notification) => {
        const button =
          document.createElement(
            "button"
          );

        button.type =
          "button";

        button.className =
          "ustaz-message-notification unread";

        button.dataset.conversationId =
          String(
            notification.id
          );

        button.setAttribute(
          "aria-label",
          `Open new message from ${fullName(
            notification.otherUser
          )}`
        );

        const avatar =
          document.createElement(
            "span"
          );

        avatar.className =
          "ustaz-message-notification-avatar";

        const initials =
          document.createElement(
            "span"
          );

        initials.textContent =
          notificationInitials(
            notification.otherUser
          );

        avatar.appendChild(
          initials
        );

        const photo =
          resolveMediaUrl(
            notification.otherUser
              .avatarUrl
          );

        if (photo) {
          const image =
            document.createElement(
              "img"
            );

          image.src =
            photo;

          image.alt =
            "";

          image.addEventListener(
            "load",
            () => {
              initials.hidden =
                true;
            },
            {
              once: true,
            }
          );

          image.addEventListener(
            "error",
            () => {
              image.remove();
              initials.hidden =
                false;
            },
            {
              once: true,
            }
          );

          avatar.appendChild(
            image
          );
        }

        const copy =
          document.createElement(
            "span"
          );

        copy.className =
          "ustaz-message-notification-copy";

        const title =
          document.createElement(
            "span"
          );

        title.className =
          "ustaz-message-notification-title";

        title.textContent =
          "New message";

        const name =
          document.createElement(
            "strong"
          );

        name.className =
          "ustaz-message-notification-name";

        name.textContent =
          fullName(
            notification.otherUser
          ) ||
          "BarakaLink User";

        const preview =
          document.createElement(
            "span"
          );

        preview.className =
          "ustaz-message-notification-preview";

        preview.textContent =
          notification.body ||
          "You have a new message.";

        copy.append(
          title,
          name,
          preview
        );

        const time =
          document.createElement(
            "span"
          );

        time.className =
          "ustaz-message-notification-time";

        time.textContent =
          formatNotificationTime(
            notification.createdAt
          );

        const dot =
          document.createElement(
            "span"
          );

        dot.className =
          "ustaz-message-notification-dot";

        dot.setAttribute(
          "aria-hidden",
          "true"
        );

        button.append(
          avatar,
          copy,
          time,
          dot
        );

        button.addEventListener(
          "click",
          () => {
            const conversationId =
              Number(
                button.dataset
                  .conversationId
              );

            if (
              !Number.isInteger(
                conversationId
              ) ||
              conversationId <=
                0
            ) {
              return;
            }

            window.location.href =
              `inbox.html?conversation=${encodeURIComponent(
                conversationId
              )}`;
          }
        );

        fragment.appendChild(
          button
        );
      }
    );

    list.appendChild(
      fragment
    );
  }



  async function loadUnreadMessageNotifications() {
    const payload =
      await requestMessageNotifications(
        "/conversations"
      );

    const data =
      payloadData(
        payload
      );

    const rows =
      Array.isArray(data)
        ? data
        : Array.isArray(
            data?.conversations
          )
          ? data.conversations
          : [];

    state.messageNotifications =
      rows
        .map(
          normalizeNotificationConversation
        )
        .filter(Boolean);

    if (
      state.notificationPanelOpen
    ) {
      renderNotifications();
    }

    return state.messageNotifications;
  }



  async function fetchUnreadMessageCount() {
    if (
      state.messageNotificationLoading ||
      document.hidden
    ) {
      return;
    }

    state.messageNotificationLoading =
      true;

    try {
      const payload =
        await requestMessageNotifications(
          "/conversations/unread-count"
        );

      const data =
        payloadData(
          payload
        );

      const count =
        Math.max(
          0,
          Number(
            data?.count ??
              payload?.count ??
              0
          )
        );

      state.unreadMessageCount =
        count;

      updateMessageBadges(
        count
      );

      if (
        state.notificationPanelOpen &&
        count === 0
      ) {
        state.messageNotifications =
          [];

        renderNotifications();
      }
    } catch (error) {
      if (
        error?.status ===
          401 ||
        error?.code ===
          "UNAUTHORIZED"
      ) {
        stopMessageNotificationPolling();
        redirectToLogin();
        return;
      }

      console.warn(
        "[BarakaLink][Ustaz Dashboard][message-notifications] Unread count failed.",
        error
      );
    } finally {
      state.messageNotificationLoading =
        false;
    }
  }



  function startMessageNotificationPolling() {
    stopMessageNotificationPolling();

    if (document.hidden) {
      return;
    }

    void fetchUnreadMessageCount();

    state.messageNotificationTimer =
      window.setInterval(
        () => {
          if (document.hidden) {
            return;
          }

          void fetchUnreadMessageCount();
        },
        CONFIG.MESSAGE_NOTIFICATION_POLL_MS
      );
  }



  function setupMessageNotificationPolling() {
    if (
      !state.messageNotificationVisibilityBound
    ) {
      state.messageNotificationVisibilityBound =
        true;

      document.addEventListener(
        "visibilitychange",
        () => {
          if (document.hidden) {
            stopMessageNotificationPolling();
          } else if (
            state.initialized
          ) {
            startMessageNotificationPolling();
          }
        }
      );
    }

    startMessageNotificationPolling();
  }



  async function openNotificationPanel() {
    const panel =
      $("ustazNotificationPanel");

    const button =
      $("ustazNotificationButton");

    if (!panel) {
      return;
    }

    closeProfileMenu();

    state.notificationPanelOpen =
      true;

    panel.hidden =
      false;

    if (button) {
      button.setAttribute(
        "aria-expanded",
        "true"
      );
    }

    try {
      await loadUnreadMessageNotifications();
    } catch (error) {
      console.warn(
        "[BarakaLink][Ustaz Dashboard][message-notifications] Could not load notification details.",
        error
      );

      state.messageNotifications =
        [];

      renderNotifications();
    }
  }



  function toggleNotificationPanel() {
    if (
      state.notificationPanelOpen
    ) {
      closeNotificationPanel();
    } else {
      void openNotificationPanel();
    }
  }



  function setupNotificationPanel() {
    const button =
      $("ustazNotificationButton");

    const panel =
      $("ustazNotificationPanel");

    updateMessageBadges(0);
    renderNotifications();

    if (
      button &&
      button.dataset
        .ustazNotificationBound !==
        "1"
    ) {
      button.dataset
        .ustazNotificationBound =
        "1";

      button.addEventListener(
        "click",
        (event) => {
          event.preventDefault();
          event.stopPropagation();

          toggleNotificationPanel();
        }
      );
    }

    if (
      panel &&
      panel.dataset
        .ustazNotificationPanelBound !==
        "1"
    ) {
      panel.dataset
        .ustazNotificationPanelBound =
        "1";

      panel.addEventListener(
        "click",
        (event) => {
          const target =
            event.target;

          if (
            target instanceof
              Element &&
            target.closest(
              ".ustaz-message-notification"
            )
          ) {
            return;
          }

          event.stopPropagation();
        }
      );
    }

    const clearButton =
      $("ustazNotificationClear");

    if (
      clearButton &&
      clearButton.dataset
        .ustazNotificationClearBound !==
        "1"
    ) {
      clearButton.dataset
        .ustazNotificationClearBound =
        "1";

      clearButton.addEventListener(
        "click",
        (event) => {
          event.preventDefault();

          closeNotificationPanel();
        }
      );
    }
  }



  function updateMessageBadges(
    count
  ) {
    const value =
      Math.max(
        0,
        Number(count) || 0
      );

    const label =
      formatUnreadBadge(
        value
      );

    [
      $("ustazMessagesBadge"),
      
    ].forEach(
      (badge) => {
        if (!badge) {
          return;
        }

        badge.hidden =
          value === 0;

        badge.textContent =
          label;

        badge.setAttribute(
          "aria-label",
          `${value} unread message${
            value === 1
              ? ""
              : "s"
          }`
        );
      }
    );
  }

export { normalizeNotificationConversation, formatNotificationTime, notificationInitials, appendNotificationEmpty, renderNotifications, loadUnreadMessageNotifications, fetchUnreadMessageCount, startMessageNotificationPolling, setupMessageNotificationPolling, openNotificationPanel, toggleNotificationPanel, setupNotificationPanel, updateMessageBadges };
