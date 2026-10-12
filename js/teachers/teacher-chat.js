"use strict";
import { payloadData, requestMessageNotifications } from "./teacher-api.js";
import { firstName, formatUnreadBadge, fullName, resolveMediaUrl, text } from "./teacher-core.js";
import { $ } from "./teacher-dom.js";
import { formatNotificationTime, notificationInitials } from "./teacher-notifications.js";
import { state } from "./teacher-state.js";

function normalizeConversationRow(
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
        row.id ??
          row.conversationId ??
          row.conversation_id
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

    return {
      id,
      otherUser,

      lastMessage: text(
        row.lastMessage ??
          row.last_message ??
          row.lastMessageBody ??
          row.last_message_body
      ),

      updatedAt:
        row.updatedAt ??
        row.updated_at ??
        row.lastMessageCreatedAt ??
        row.last_message_created_at ??
        null,

      unreadCount:
        Math.max(
          0,
          Number(
            row.unreadCount ??
              row.unread_count ??
              0
          )
        ),
    };
  }



  function appendConversationEmpty(
    list
  ) {
    const empty =
      document.createElement(
        "div"
      );

    empty.className =
      "ustaz-conversation-state";

    const icon =
      document.createElement(
        "span"
      );

    icon.className =
      "ustaz-conversation-state-icon";

    icon.innerHTML =
      '<i class="fa-regular fa-comments" aria-hidden="true"></i>';

    const title =
      document.createElement(
        "strong"
      );

    title.textContent =
      "No conversations yet";

    const message =
      document.createElement(
        "p"
      );

    message.textContent =
      "Student conversations will appear here when a learner contacts you.";

    empty.append(
      icon,
      title,
      message
    );

    list.appendChild(
      empty
    );
  }



  function renderDashboardConversations() {
    const list =
      $("ustazConversationList");

    if (!list) {
      return;
    }

    list.replaceChildren();

    const conversations =
      Array.isArray(
        state.messageConversations
      )
        ? state.messageConversations
        : [];

    if (!conversations.length) {
      appendConversationEmpty(
        list
      );

      return;
    }

    const fragment =
      document.createDocumentFragment();

    conversations.forEach(
      (conversation) => {
        const button =
          document.createElement(
            "button"
          );

        button.type =
          "button";

        button.className =
          "ustaz-dashboard-conversation";

        button.dataset.conversationId =
          String(
            conversation.id
          );

        button.setAttribute(
          "aria-label",
          `Open conversation with ${fullName(
            conversation.otherUser
          )}`
        );

        const avatar =
          document.createElement(
            "span"
          );

        avatar.className =
          "ustaz-dashboard-conversation-avatar";

        const initials =
          document.createElement(
            "span"
          );

        initials.textContent =
          notificationInitials(
            conversation.otherUser
          );

        avatar.appendChild(
          initials
        );

        const photo =
          resolveMediaUrl(
            conversation.otherUser
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
          "ustaz-dashboard-conversation-copy";

        const name =
          document.createElement(
            "strong"
          );

        name.className =
          "ustaz-dashboard-conversation-name";

        name.textContent =
          fullName(
            conversation.otherUser
          ) ||
          "BarakaLink User";

        const preview =
          document.createElement(
            "span"
          );

        preview.className =
          "ustaz-dashboard-conversation-preview";

        preview.textContent =
          conversation.lastMessage ||
          "Open conversation";

        copy.append(
          name,
          preview
        );

        const meta =
          document.createElement(
            "span"
          );

        meta.className =
          "ustaz-dashboard-conversation-meta";

        const time =
          document.createElement(
            "time"
          );

        time.textContent =
          formatNotificationTime(
            conversation.updatedAt
          );

        meta.appendChild(
          time
        );

        if (
          conversation.unreadCount >
          0
        ) {
          const unread =
            document.createElement(
              "span"
            );

          unread.className =
            "ustaz-dashboard-conversation-unread";

          unread.textContent =
            formatUnreadBadge(
              conversation.unreadCount
            );

          unread.setAttribute(
            "aria-label",
            `${conversation.unreadCount} unread messages`
          );

          meta.appendChild(
            unread
          );

          button.classList.add(
            "has-unread"
          );
        }

        const arrow =
          document.createElement(
            "i"
          );

        arrow.className =
          "fa-solid fa-chevron-right ustaz-dashboard-conversation-arrow";

        arrow.setAttribute(
          "aria-hidden",
          "true"
        );

        button.append(
          avatar,
          copy,
          meta,
          arrow
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



  async function loadDashboardConversations() {
    const list =
      $("ustazConversationList");

    if (
      !list ||
      state.messageConversationsLoading
    ) {
      return;
    }

    state.messageConversationsLoading =
      true;

    try {
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

      state.messageConversations =
        rows
          .map(
            normalizeConversationRow
          )
          .filter(Boolean);

      renderDashboardConversations();
    } catch (error) {
      console.warn(
        "[BarakaLink][Ustaz Dashboard][messages] Conversation list failed.",
        error
      );

      list.replaceChildren();

      const empty =
        document.createElement(
          "div"
        );

      empty.className =
        "ustaz-conversation-state ustaz-conversation-state-error";

      const icon =
        document.createElement(
          "span"
        );

      icon.className =
        "ustaz-conversation-state-icon";

      icon.innerHTML =
        '<i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>';

      const title =
        document.createElement(
          "strong"
        );

      title.textContent =
        "Could not load conversations";

      const message =
        document.createElement(
          "p"
        );

      message.textContent =
        error?.message ||
        "Please try again.";

      empty.append(
        icon,
        title,
        message
      );

      list.appendChild(
        empty
      );
    } finally {
      state.messageConversationsLoading =
        false;
    }
  }



  function setupDashboardMessages() {
    const refresh =
      $("ustazMessagesRefreshButton");

    if (
      refresh &&
      refresh.dataset
        .ustazMessagesRefreshBound !==
        "1"
    ) {
      refresh.dataset
        .ustazMessagesRefreshBound =
        "1";

      refresh.addEventListener(
        "click",
        (event) => {
          event.preventDefault();

          void loadDashboardConversations();
        }
      );
    }
  }

export { normalizeConversationRow, appendConversationEmpty, renderDashboardConversations, loadDashboardConversations, setupDashboardMessages };
