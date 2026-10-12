'use strict';

/* =========================================================
   BARAKALINK PARENT / STUDENT MESSAGING

   Conversations, unread state, chat loading/rendering,
   sending, refresh/polling, and messaging styles live here.
========================================================= */

import { STUDENT_CONFIG, $, $$, setText } from './student-core.js';
import { state } from './student-state.js';
import { safeString, escapeHtml, formatRelativeDate } from './student-utils.js';
import { apiRequest } from './student-api.js';

const MESSAGE_CONFIG = Object.freeze({
  CONVERSATIONS_ENDPOINT: '/conversations',
  POLL_INTERVAL: 15000,
  MAX_PREVIEW_LENGTH: 90,
});

let messagingInitialized = false;
let messagePollingInterval = null;

export function getCurrentUserId() {

  return Number(
    state.profile?.id ??
    state.profile?.userId ??
    state.user?.id ??
    0
  );

}


export function getConversationName(conversation) {

  const user =
    conversation?.otherUser || {};

  const name =
    [
      safeString(
        user.firstName ??
        user.first_name
      ),

      safeString(
        user.lastName ??
        user.last_name
      ),

    ]
      .filter(Boolean)
      .join(' ')
      .trim();

  return name || 'Ustaz';

}


export function getConversationRole(conversation) {

  const role =
    safeString(
      conversation?.otherUser?.role
    ).toLowerCase();

  if (role === 'ustaz') {
    return 'Ustaz / Ustaza';
  }

  return 'Teacher';

}


export function getConversationInitials(conversation) {

  const name =
    getConversationName(
      conversation
    );

  const parts =
    name
      .split(/\s+/)
      .filter(Boolean);

  return (
    parts
      .slice(0, 2)
      .map(
        part =>
          part.charAt(0)
      )
      .join('')
      .toUpperCase()
    || 'U'
  );

}

export function resolveMessageAvatar(value) {
  const raw = safeString(value).trim();
  if (!raw) return '';

  if (/^(https?:|data:|blob:)/i.test(raw)) {
    return raw;
  }

  const configuredApiBase = String(
    STUDENT_CONFIG.API_BASE ||
    window.BarakaLinkAPI?.base ||
    window.BARAKALINK_API_BASE ||
    'http://localhost:5000/api'
  ).replace(/\/+$/, '');

  // Profile-photo uploads are served from the backend root, not /api/.
  const serverBase = configuredApiBase.replace(/\/api$/i, '');

  try {
    if (/^(?:\/)?(?:uploads|media)\//i.test(raw) || raw.startsWith('/')) {
      return new URL(raw, `${serverBase}/`).href;
    }

    return new URL(raw, `${serverBase}/`).href;
  } catch {
    return raw;
  }
}

export function getConversationAvatar(conversation) {
  const user =
    conversation?.otherUser ??
    conversation?.other_user ??
    conversation?.user ??
    conversation?.participant ??
    {};

  const value =
    user.avatarUrl ??
    user.avatar_url ??
    user.profilePhotoUrl ??
    user.profile_photo_url ??
    user.photoUrl ??
    user.photo_url ??
    user.pictureUrl ??
    user.picture_url ??
    user.imageUrl ??
    user.image_url ??
    conversation?.otherAvatarUrl ??
    conversation?.other_avatar_url ??
    conversation?.otherProfilePhotoUrl ??
    conversation?.other_profile_photo_url ??
    conversation?.otherPhotoUrl ??
    conversation?.other_photo_url ??
    conversation?.avatarUrl ??
    conversation?.avatar_url ??
    '';

  return resolveMessageAvatar(value);
}



export function formatMessageTime(value) {

  if (!value) {
    return '';
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return safeString(value);
  }

  return date.toLocaleString(
    'en-US',
    {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }
  );

}


export function sortConversations() {

  state.conversations.sort(
    (a, b) => {

      const dateA =
        new Date(
          a?.updatedAt ??
          a?.lastMessage?.createdAt ??
          0
        ).getTime();

      const dateB =
        new Date(
          b?.updatedAt ??
          b?.lastMessage?.createdAt ??
          0
        ).getTime();

      return dateB - dateA;

    }
  );

}


export function renderStudentMessageBadge() {

  const badge =
    $('studentMessagesBadge');

  if (!badge) {
    return;
  }

  const count =
    state.conversations.reduce(
      (total, conversation) =>
        total +
        Number(
          conversation?.unreadCount || 0
        ),
      0
    );

  if (count <= 0) {

    badge.hidden =
      true;

    badge.textContent =
      '0';

    return;

  }

  badge.hidden =
    false;

  badge.textContent =
    count > 99
      ? '99+'
      : String(count);

}


export function showEmptyChat() {

  const empty =
    $('studentChatEmpty');

  const chat =
    $('studentChat');

  if (empty) {
    empty.hidden =
      false;
  }

  if (chat) {
    chat.hidden =
      true;
  }

}


export function renderStudentConversations() {

  const container =
    $('studentConversationList');

  if (!container) {
    return;
  }


  /*
   * Only conversations that already have an actual
   * message should appear in the recent-message list.
   */

  const conversations =
    state.conversations.filter(
      conversation =>
        conversation?.lastMessage &&
        safeString(
          conversation.lastMessage.body
        )
    );


  if (!conversations.length) {

    container.innerHTML =
      `
        <div class="student-conversation-state">

          <span class="student-conversation-state-icon">
            <i
              class="fa-regular fa-message"
              aria-hidden="true"
            ></i>
          </span>

          <strong>
            No messages yet
          </strong>

          <p>
            Messages from your Ustaz or Ustaza will appear here when a conversation starts.
          </p>

        </div>
      `;

    renderStudentMessageBadge();
    showEmptyChat();

    return;

  }


  container.innerHTML =
    '';


  const fragment =
    document.createDocumentFragment();


  conversations.forEach(
    conversation => {

      const button =
        document.createElement(
          'button'
        );


      button.type =
        'button';

      button.className =
        'student-conversation-item';


      if (
        String(
          state.activeConversationId
        ) ===
        String(
          conversation.id
        )
      ) {

        button.classList.add(
          'active'
        );

      }


      const name =
        getConversationName(
          conversation
        );

      const role =
        getConversationRole(
          conversation
        );

      const preview =
        safeString(
          conversation?.lastMessage?.body,
          ''
        );


      const shortenedPreview =
        preview.length >
        MESSAGE_CONFIG.MAX_PREVIEW_LENGTH

          ? (
              preview.slice(
                0,
                MESSAGE_CONFIG.MAX_PREVIEW_LENGTH
              ) +
              '…'
            )

          : preview;


      const time =
        formatRelativeDate(
          conversation?.lastMessage?.createdAt ??
          conversation?.updatedAt
        );


      const unreadCount =
        Number(
          conversation?.unreadCount || 0
        );


      const initials =
        getConversationInitials(
          conversation
        );


      const avatarUrl =
        getConversationAvatar(
          conversation
        );


      button.innerHTML =
        `
          <span class="student-conversation-avatar">

            <span class="student-conversation-avatar-initials">
              ${escapeHtml(
                initials
              )}
            </span>

            ${
              avatarUrl
                ? `
                  <img
                    src="${escapeHtml(
                      avatarUrl
                    )}"
                    alt=""
                    loading="lazy"
                    hidden
                  >
                `
                : ''
            }

          </span>


          <span class="student-conversation-copy">

            <span class="student-conversation-topline">

              <strong>
                ${escapeHtml(
                  name
                )}
              </strong>

              <small>
                ${escapeHtml(
                  time
                )}
              </small>

            </span>


            <span class="student-conversation-role">
              ${escapeHtml(
                role
              )}
            </span>


            <span class="student-conversation-preview">
              ${escapeHtml(
                shortenedPreview
              )}
            </span>

          </span>


          ${
            unreadCount > 0
              ? `
                <span
                  class="student-conversation-unread"
                  aria-label="${unreadCount} unread messages"
                >
                  ${
                    unreadCount > 99
                      ? '99+'
                      : String(unreadCount)
                  }
                </span>
              `
              : ''
          }
        `;


      const image =
        button.querySelector(
          '.student-conversation-avatar img'
        );

      const initialsElement =
        button.querySelector(
          '.student-conversation-avatar-initials'
        );


      if (
        image &&
        initialsElement
      ) {

        image.addEventListener(
          'load',
          () => {

            image.hidden =
              false;

            initialsElement.hidden =
              true;

          }
        );


        image.addEventListener(
          'error',
          () => {

            image.hidden =
              true;

            initialsElement.hidden =
              false;

          }
        );

      }
  button.addEventListener(
        'click',
        () => {
          const conversationId = Number(conversation.id);

          if (!Number.isInteger(conversationId) || conversationId <= 0) {
            return;
          }

          // Match the Ustaz dashboard on mobile: open the standalone inbox
          // page rather than rendering the chat underneath the conversation list.
          if (window.matchMedia('(max-width: 900px)').matches) {
            window.location.href =
              `inbox.html?conversation=${encodeURIComponent(conversationId)}`;
            return;
          }

          // Preserve current desktop split-panel behavior.
          openStudentConversation(conversationId);
        }
      );


      fragment.appendChild(
        button
      );

    }
  );


  container.appendChild(
    fragment
  );


  renderStudentMessageBadge();

}


export async function loadStudentConversations() {

  if (
    state.messagesLoading
  ) {
    return;
  }


  const container =
    $('studentConversationList');

  if (!container) {
    return;
  }


  state.messagesLoading =
    true;


  container.innerHTML =
    `
      <div class="student-conversation-state">

        <span class="student-conversation-state-icon">
          <i
            class="fa-solid fa-circle-notch fa-spin"
            aria-hidden="true"
          ></i>
        </span>

        <strong>
          Loading conversations...
        </strong>

      </div>
    `;


  try {

    const payload =
      await apiRequest(
        MESSAGE_CONFIG.CONVERSATIONS_ENDPOINT
      );


    const data =
      payload?.data ??
      payload ??
      [];


    state.conversations =
      Array.isArray(data)
        ? data
        : Array.isArray(
            data?.conversations
          )
            ? data.conversations
            : [];


    sortConversations();


    renderStudentConversations();


    /*
     * Keep the currently selected conversation visible
     * after a refresh.
     */

    if (
      state.activeConversationId
    ) {

      const active =
        state.conversations.find(
          conversation =>
            String(
              conversation.id
            ) ===
            String(
              state.activeConversationId
            )
        );


      if (active) {

        renderStudentChatHeader(
          active
        );

      } else {

        state.activeConversationId =
          null;

        state.conversationMessages =
          [];

        showEmptyChat();

      }

    }

  } catch (error) {

    console.error(
      '[student messaging] Failed to load conversations:',
      error
    );


    container.innerHTML =
      `
        <div class="student-conversation-state">

          <span class="student-conversation-state-icon">
            <i
              class="fa-solid fa-triangle-exclamation"
              aria-hidden="true"
            ></i>
          </span>

          <strong>
            We couldn't load your messages
          </strong>

          <p>
            ${escapeHtml(
              safeString(
                error?.message,
                'Please try again.'
              )
            )}
          </p>

          <button
            type="button"
            class="btn btn-outline"
            id="studentMessagesRetry"
          >
            Try Again
          </button>

        </div>
      `;


    const retry =
      $('studentMessagesRetry');

    if (retry) {

      retry.addEventListener(
        'click',
        loadStudentConversations
      );

    }


    renderStudentMessageBadge();

  } finally {

    state.messagesLoading =
      false;

  }

}


export function renderStudentChatHeader(
  conversation
) {

  setText(
    'studentChatName',
    getConversationName(
      conversation
    )
  );


  setText(
    'studentChatRole',
    getConversationRole(
      conversation
    )
  );


  const initials =
    $('studentChatAvatarInitials');

  const image =
    $('studentChatAvatarImage');


  if (initials) {

    initials.textContent =
      getConversationInitials(
        conversation
      );

    initials.hidden =
      false;

  }


  if (!image) {
    return;
  }


  const avatarUrl =
    getConversationAvatar(
      conversation
    );


  image.hidden =
    true;

  image.removeAttribute(
    'src'
  );


  if (!avatarUrl) {
    return;
  }


  image.alt =
    `${getConversationName(
      conversation
    )} profile photo`;


  image.onload =
    () => {

      image.hidden =
        false;

      if (initials) {
        initials.hidden =
          true;
      }

    };


  image.onerror =
    () => {

      image.hidden =
        true;

      if (initials) {
        initials.hidden =
          false;
      }

      image.removeAttribute(
        'src'
      );

    };


  image.src =
    avatarUrl;

}


export async function loadStudentConversationMessages(
  conversationId
) {

  const container =
    $('studentChatMessages');

  if (!container) {
    return;
  }


  container.innerHTML =
    `
      <div class="student-chat-loading">

        <i
          class="fa-solid fa-circle-notch fa-spin"
          aria-hidden="true"
        ></i>

        <span>
          Loading messages...
        </span>

      </div>
    `;


  try {

    const payload =
      await apiRequest(
        `${MESSAGE_CONFIG.CONVERSATIONS_ENDPOINT}/${encodeURIComponent(
          conversationId
        )}/messages`
      );


    const data =
      payload?.data ??
      payload ??
      [];


    state.conversationMessages =
      Array.isArray(data)
        ? data
        : Array.isArray(
            data?.messages
          )
            ? data.messages
            : [];


    renderStudentChatMessages();


  } catch (error) {

    console.error(
      '[student messaging] Failed to load conversation:',
      error
    );


    container.innerHTML =
      `
        <div class="student-chat-loading">

          <i
            class="fa-solid fa-triangle-exclamation"
            aria-hidden="true"
          ></i>

          <span>
            ${escapeHtml(
              safeString(
                error?.message,
                'Unable to load this conversation.'
              )
            )}
          </span>

          <button
            type="button"
            class="btn btn-outline"
            id="studentChatRetry"
          >
            Retry
          </button>

        </div>
      `;


    const retry =
      $('studentChatRetry');

    if (retry) {

      retry.addEventListener(
        'click',
        () =>
          loadStudentConversationMessages(
            conversationId
          )
      );

    }

  }

}


export function renderStudentChatMessages() {

  const container =
    $('studentChatMessages');

  if (!container) {
    return;
  }


  container.innerHTML =
    '';


  const messages =
    Array.isArray(
      state.conversationMessages
    )
      ? state.conversationMessages
      : [];


  if (!messages.length) {

    container.innerHTML =
      `
        <div class="student-chat-no-messages">

          <i
            class="fa-regular fa-comment-dots"
            aria-hidden="true"
          ></i>

          <span>
            No messages in this conversation yet.
          </span>

        </div>
      `;

    return;

  }


  const currentUserId =
    getCurrentUserId();


  messages.forEach(
    message => {

      const senderId =
        Number(
          message?.senderUserId ??
          message?.sender_user_id ??
          0
        );


      const isMine =
        currentUserId > 0 &&
        senderId ===
        currentUserId;


      const row =
        document.createElement(
          'div'
        );


      row.className =
        isMine
          ? 'student-chat-row student-chat-row-own'
          : 'student-chat-row student-chat-row-other';


      const bubble =
        document.createElement(
          'div'
        );


      bubble.className =
        isMine
          ? 'student-chat-bubble student-chat-bubble-own'
          : 'student-chat-bubble student-chat-bubble-other';


      const body =
        document.createElement(
          'div'
        );


      body.className =
        'student-chat-message-body';


      body.textContent =
        safeString(
          message?.body
        );


      const time =
        document.createElement(
          'time'
        );


      time.className =
        'student-chat-message-time';


      time.dateTime =
        safeString(
          message?.createdAt
        );


      time.textContent =
        formatMessageTime(
          message?.createdAt
        );


      bubble.appendChild(
        body
      );

      bubble.appendChild(
        time
      );

      row.appendChild(
        bubble
      );

      container.appendChild(
        row
      );

    }
  );


  requestAnimationFrame(
    () => {

      container.scrollTop =
        container.scrollHeight;

    }
  );

}


export async function openStudentConversation(
  conversationId
) {

  const conversation =
    state.conversations.find(
      item =>
        String(
          item.id
        ) ===
        String(
          conversationId
        )
    );


  if (!conversation) {
    return;
  }


  state.activeConversationId =
    Number(
      conversationId
    );


  const empty =
    $('studentChatEmpty');

  const chat =
    $('studentChat');


  if (empty) {
    empty.hidden =
      true;
  }


  if (chat) {
    chat.hidden =
      false;
  }


  renderStudentChatHeader(
    conversation
  );


  renderStudentConversations();


  await loadStudentConversationMessages(
    conversationId
  );


  /*
   * Mark incoming messages as read.
   */

  if (
    Number(
      conversation.unreadCount || 0
    ) > 0
  ) {

    try {

      await apiRequest(
        `${MESSAGE_CONFIG.CONVERSATIONS_ENDPOINT}/${encodeURIComponent(
          conversationId
        )}/read`,
        {
          method:
            'PATCH',
        }
      );


      conversation.unreadCount =
        0;


      renderStudentMessageBadge();

      renderStudentConversations();

    } catch (error) {

      console.warn(
        '[student messaging] Failed to mark messages as read:',
        error
      );

    }

  }

}


export async function sendStudentMessage(
  event
) {

  event.preventDefault();


  if (
    state.messageSending ||
    !state.activeConversationId
  ) {
    return;
  }


  const input =
    $('studentMessageInput');

  const button =
    $('studentMessageSend');

  const status =
    $('studentMessageStatus');


  if (!input) {
    return;
  }


  const body =
    safeString(
      input.value
    );


  if (!body) {

    input.focus();

    return;

  }


  state.messageSending =
    true;


  if (button) {
    button.disabled =
      true;
  }


  if (status) {

    status.textContent =
      'Sending...';

    status.hidden =
      false;

  }


  try {

    const payload =
      await apiRequest(
        `${MESSAGE_CONFIG.CONVERSATIONS_ENDPOINT}/${encodeURIComponent(
          state.activeConversationId
        )}/messages`,
        {
          method:
            'POST',

          body:
            JSON.stringify({
              body,
            }),
        }
      );


    const message =
      payload?.data ??
      null;


    if (message) {

      state.conversationMessages.push(
        message
      );

    } else {

      /*
       * Backend should return the new message.
       * If it doesn't, reload the conversation so the
       * UI remains synchronized with the database.
       */

      await loadStudentConversationMessages(
        state.activeConversationId
      );

    }


    input.value =
      '';


    renderStudentChatMessages();


    const conversation =
      state.conversations.find(
        item =>
          String(
            item.id
          ) ===
          String(
            state.activeConversationId
          )
      );


    if (
      conversation &&
      message
    ) {

      conversation.lastMessage =
        {
          body:
            safeString(
              message.body
            ),

          senderUserId:
            Number(
              message.senderUserId ??
              getCurrentUserId()
            ),

          createdAt:
            message.createdAt ??
            new Date().toISOString(),
        };


      conversation.updatedAt =
        conversation.lastMessage.createdAt;

    }


    sortConversations();


    renderStudentConversations();


    if (status) {

      status.textContent =
        '';

      status.hidden =
        true;

    }

  } catch (error) {

    console.error(
      '[student messaging] Failed to send message:',
      error
    );


    if (status) {

      status.textContent =
        safeString(
          error?.message,
          'Unable to send your message.'
        );

      status.hidden =
        false;

    }

  } finally {

    state.messageSending =
      false;


    if (button) {
      button.disabled =
        false;
    }

  }

}


export function setupStudentMessagingEvents() {

  const refresh =
    $('studentMessagesRefresh');


  if (refresh) {

    refresh.addEventListener(
      'click',
      loadStudentConversations
    );

  }


  const form =
    $('studentMessageForm');


  if (form) {

    form.addEventListener(
      'submit',
      sendStudentMessage
    );

  }


  const input =
    $('studentMessageInput');


  if (input) {

    input.addEventListener(
      'keydown',
      event => {

        if (
          event.key === 'Enter' &&
          !event.shiftKey
        ) {

          event.preventDefault();

          form?.requestSubmit();

        }

      }
    );

  }


  $(
    'studentMessagesBadge'
  );


  /*
   * Load when the Messages section is opened.
   */

  $$('.student-nav-link[data-section="messages"]')
    .forEach(
      link => {

        link.addEventListener(
          'click',
          () => {

            setTimeout(
              loadStudentConversations,
              50
            );

          }
        );

      }
    );


  /*
   * Also support other dashboard links that open
   * #messages.
   */

  $$('[data-section-link="messages"]')
    .forEach(
      link => {

        link.addEventListener(
          'click',
          () => {

            setTimeout(
              loadStudentConversations,
              50
            );

          }
        );

      }
    );


  /*
   * Refresh conversations while Messages is open.
   */

  setInterval(
    () => {

      if (
        state.currentSection !==
        'messages'
      ) {
        return;
      }


      loadStudentConversations();


      if (
        state.activeConversationId
      ) {

        loadStudentConversationMessages(
          state.activeConversationId
        );

      }

    },
    MESSAGE_CONFIG.POLL_INTERVAL
  );


  /*
   * Load immediately so the unread badge and
   * conversation state are available.
   */

  loadStudentConversations();

}


export function injectStudentMessagingStyles() {

  if (
    document.querySelector(
      'style[data-barakalink-student-messaging]'
    )
  ) {
    return;
  }


  const style =
    document.createElement(
      'style'
    );


  style.setAttribute(
    'data-barakalink-student-messaging',
    'true'
  );


  style.textContent =
    `
      .student-messages-layout {
        display: grid;
        grid-template-columns: minmax(280px, 360px) minmax(0, 1fr);
        gap: 18px;
        align-items: stretch;
      }

      .student-conversation-list {
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-height: 420px;
      }

      .student-conversation-item {
        width: 100%;
        display: grid;
        grid-template-columns: 42px minmax(0, 1fr) auto;
        gap: 11px;
        align-items: center;
        padding: 11px;
        border: 0;
        border-radius: 13px;
        background: transparent;
        color: inherit;
        text-align: left;
        cursor: pointer;
        font: inherit;
      }

      .student-conversation-item:hover {
        background: rgba(154, 116, 32, 0.075);
      }

      .student-conversation-item.active {
        background: rgba(212, 175, 55, 0.13);
      }

      .student-conversation-avatar,
      .student-chat-avatar {
        position: relative;
        overflow: hidden;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex: 0 0 auto;
        border-radius: 50%;
        background: rgba(154, 116, 32, 0.12);
        font-weight: 800;
      }

      .student-conversation-avatar {
        width: 42px;
        height: 42px;
      }

      .student-conversation-avatar img,
      .student-chat-avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .student-conversation-avatar-initials {
        font-size: 0.78rem;
      }

      .student-conversation-copy {
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .student-conversation-topline {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }

      .student-conversation-topline strong {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 0.81rem;
      }

      .student-conversation-topline small {
        flex: 0 0 auto;
        font-size: 0.65rem;
        opacity: 0.58;
      }

      .student-conversation-role {
        font-size: 0.65rem;
        opacity: 0.58;
      }

      .student-conversation-preview {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 0.72rem;
        opacity: 0.72;
      }

      .student-conversation-unread,
      .student-nav-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 21px;
        height: 21px;
        padding: 0 6px;
        border-radius: 999px;
        background: #9a7420;
        color: #fff;
        font-size: 0.62rem;
        font-weight: 800;
        line-height: 1;
      }

      .student-conversation-state {
        min-height: 280px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 28px 18px;
        text-align: center;
      }

      .student-conversation-state-icon {
        width: 48px;
        height: 48px;
        margin-bottom: 12px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        background: rgba(154, 116, 32, 0.10);
        font-size: 1.05rem;
      }

      .student-conversation-state strong {
        font-size: 0.88rem;
      }

      .student-conversation-state p {
        max-width: 330px;
        margin: 7px auto 0;
        font-size: 0.75rem;
        line-height: 1.55;
        opacity: 0.67;
      }

      .student-chat-panel {
        min-height: 560px;
        overflow: hidden;
      }

      .student-chat-empty {
        min-height: 520px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 30px;
        text-align: center;
      }

      .student-chat-empty-icon {
        width: 62px;
        height: 62px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 14px;
        border-radius: 50%;
        background: rgba(154, 116, 32, 0.10);
        font-size: 1.35rem;
      }

      .student-chat-empty h3 {
        margin: 0;
      }

      .student-chat-empty p {
        max-width: 360px;
        margin: 8px 0 0;
        font-size: 0.78rem;
        line-height: 1.55;
        opacity: 0.67;
      }

      .student-chat {
        display: flex;
        flex-direction: column;
        min-height: 560px;
        height: 100%;
      }

      .student-chat-header {
        display: flex;
        align-items: center;
        gap: 11px;
        padding: 15px 17px;
        border-bottom: 1px solid rgba(0, 0, 0, 0.08);
      }

      .student-chat-messages {
        flex: 1;
        min-height: 380px;
        max-height: 470px;
        overflow-y: auto;
        padding: 18px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        background: rgba(127, 127, 127, 0.025);
      }

      .student-chat-row {
        display: flex;
        width: 100%;
      }

      .student-chat-row-own {
        justify-content: flex-end;
      }

      .student-chat-row-other {
        justify-content: flex-start;
      }

      .student-chat-bubble {
        max-width: min(78%, 560px);
        padding: 9px 11px;
        border-radius: 13px;
      }

      .student-chat-bubble-own {
        border-bottom-right-radius: 4px;
        background: rgba(212, 175, 55, 0.18);
      }

      .student-chat-bubble-other {
        border-bottom-left-radius: 4px;
        background: rgba(127, 127, 127, 0.10);
      }

      .student-chat-message-body {
        white-space: pre-wrap;
        overflow-wrap: anywhere;
        font-size: 0.77rem;
        line-height: 1.55;
      }

      .student-chat-message-time {
        display: block;
        margin-top: 4px;
        font-size: 0.6rem;
        opacity: 0.52;
      }

      .student-chat-row-own .student-chat-message-time {
        text-align: right;
      }

      .student-chat-loading,
      .student-chat-no-messages {
        min-height: 200px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-direction: column;
        gap: 8px;
        text-align: center;
        font-size: 0.76rem;
        opacity: 0.68;
      }

      .student-chat-composer {
        display: flex;
        align-items: flex-end;
        gap: 9px;
        padding: 12px;
        border-top: 1px solid rgba(0, 0, 0, 0.08);
      }

      .student-chat-input-wrap {
        flex: 1;
      }

      .student-chat-input-wrap textarea {
        width: 100%;
        min-height: 42px;
        max-height: 130px;
        resize: vertical;
        box-sizing: border-box;
      }

      .student-chat-status {
        padding: 0 13px 10px;
        font-size: 0.68rem;
        color: #a33;
      }

      @media (max-width: 900px) {

        .student-messages-layout {
          grid-template-columns: 1fr;
        }

        .student-conversation-list {
          min-height: 0;
          max-height: 390px;
          overflow-y: auto;
        }

        .student-chat-panel {
          min-height: 500px;
        }

      }

      @media (max-width: 600px) {

        .student-chat-messages {
          min-height: 300px;
          max-height: 55vh;
          padding: 13px;
        }

        .student-chat-bubble {
          max-width: 88%;
        }

        .student-chat-composer {
          align-items: stretch;
          flex-direction: column;
        }

        .student-chat-composer .btn {
          width: 100%;
        }

      }

      /* Fixed-size, consistent avatars for conversation list and active chat. */
      .student-conversation-avatar,
      .student-chat-avatar {
        position: relative;
        width: 42px;
        height: 42px;
        min-width: 42px;
        min-height: 42px;
        max-width: 42px;
        max-height: 42px;
        flex: 0 0 42px;
        overflow: hidden;
        border-radius: 50%;
      }

      .student-conversation-avatar img,
      .student-chat-avatar img {
        position: absolute;
        inset: 0;
        display: block;
        width: 100%;
        height: 100%;
        max-width: 100%;
        max-height: 100%;
        object-fit: cover;
        border-radius: inherit;
      }

      .student-conversation-avatar img[hidden],
      .student-chat-avatar img[hidden] {
        display: none !important;
      }

    `;


  document.head.appendChild(
    style
  );

}


export function initializeStudentMessaging() {
  if (messagingInitialized) {
    return;
  }

  messagingInitialized = true;

  injectStudentMessagingStyles();
  setupStudentMessagingEvents();
}
