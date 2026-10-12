'use strict';

/* =========================================================
   BARAKALINK — INBOX / PARENT ↔ USTAZ CHAT

   Uses the existing BarakaLink JWT/session and API helper.
   No Telegram integration. No WebSockets.
========================================================= */

(() => {
  const CONFIG = Object.freeze({
   API_BASE: String(
  window.BarakaLinkAPI?.base ||
  window.BARAKALINK_API_BASE ||
  'http://localhost:5000/api'
).replace(/\/+$/, ''),
    LOGIN_URL: '../login.html',

    CONVERSATIONS_ENDPOINT: '/conversations',

    POLL_MESSAGES_MS: 10000,

    POLL_CONVERSATIONS_MS: 20000,
  });


  const state = {
    currentUserId: null,

    currentUserRole: '',

    conversations: [],

    selectedConversationId: null,

    selectedOtherUser: null,

    messages: [],

    messagePollTimer: null,

    conversationPollTimer: null,

    initialized: false,

    loadingMessages: false,

    sending: false,

    lastRenderedMessageSignature: '',
  };


  const $ = (id) =>
    document.getElementById(id);


  const shell =
    $('inboxShell');

  const list =
    $('inboxConversationList');

  const listEmpty =
    $('inboxConversationEmpty');

  const messages =
    $('inboxMessages');

  const errorBox =
    $('inboxError');

  const chatName =
    $('inboxChatName');

  const chatRole =
    $('inboxChatRole');

  const chatAvatar =
    $('inboxChatAvatar');

  const form =
    $('inboxMessageForm');

  const input =
    $('inboxMessageInput');

  const sendButton =
    $('inboxSendButton');

  const mobileBack =
    $('inboxMobileBack');

  const backButton =
    $('inboxBackButton');


  /* =========================================================
     TOKEN / SESSION
  ========================================================== */

  function getToken() {

    if (
      window.BarakaLinkAPI &&
      typeof window.BarakaLinkAPI.getToken === 'function'
    ) {

      const token =
        window.BarakaLinkAPI.getToken();

      if (token) {
        return token;
      }

    }


    return (
      localStorage.getItem('barakalink_token') ||
      localStorage.getItem('token') ||
      ''
    );

  }


  function clearSession() {

    try {

      if (
        window.BarakaLinkAPI &&
        typeof window.BarakaLinkAPI.clearToken === 'function'
      ) {

        window.BarakaLinkAPI.clearToken();

      }

    } catch (_) {

      // Continue with direct cleanup.

    }


    localStorage.removeItem(
      'barakalink_token'
    );

    localStorage.removeItem(
      'token'
    );

    localStorage.removeItem(
      'barakalink_user'
    );

  }


  function redirectToLogin() {

    clearSession();

    window.location.replace(
      CONFIG.LOGIN_URL
    );

  }


  /* =========================================================
     ERROR UI
  ========================================================== */

  function showError(
    message
  ) {

    if (!errorBox) {
      return;
    }

    errorBox.hidden =
      false;

    errorBox.textContent =
      String(
        message ||
        'Something went wrong.'
      );

  }


  function hideError() {

    if (!errorBox) {
      return;
    }

    errorBox.hidden =
      true;

    errorBox.textContent =
      '';

  }


  /* =========================================================
     RESPONSE HELPERS
  ========================================================== */

  function payloadData(
    payload
  ) {

    return (
      payload?.data ??
      payload ??
      {}
    );

  }


  /*
   * The current backend normally returns the conversation
   * collection through `data`, but this helper also safely
   * accepts common wrapper shapes without inventing data.
   *
   * Supported:
   *
   *   [...]
   *   { data: [...] }
   *   { conversations: [...] }
   *   { data: { conversations: [...] } }
   *   { data: { items: [...] } }
   *   { data: { results: [...] } }
   */
  function extractConversationRows(
    payload
  ) {

    if (
      Array.isArray(payload)
    ) {

      return payload;

    }


    if (
      Array.isArray(payload?.data)
    ) {

      return payload.data;

    }


    const containers = [
      payload,
      payload?.data,
      payload?.data?.data,
    ];


    const collectionKeys = [
      'conversations',
      'items',
      'rows',
      'results',
    ];


    for (
      const container of containers
    ) {

      if (
        !container ||
        typeof container !== 'object'
      ) {

        continue;

      }


      for (
        const key of collectionKeys
      ) {

        if (
          Array.isArray(
            container[key]
          )
        ) {

          return container[key];

        }

      }

    }


    return [];

  }


  function extractMessageRows(
    payload
  ) {

    if (
      Array.isArray(payload)
    ) {

      return payload;

    }


    if (
      Array.isArray(payload?.data)
    ) {

      return payload.data;

    }


    const containers = [
      payload,
      payload?.data,
      payload?.data?.data,
    ];


    const collectionKeys = [
      'messages',
      'items',
      'rows',
      'results',
    ];


    for (
      const container of containers
    ) {

      if (
        !container ||
        typeof container !== 'object'
      ) {

        continue;

      }


      for (
        const key of collectionKeys
      ) {

        if (
          Array.isArray(
            container[key]
          )
        ) {

          return container[key];

        }

      }

    }


    return [];

  }


  /* =========================================================
     USER NORMALIZATION
  ========================================================== */

  function normalizeUser(
    user
  ) {

    if (
      !user ||
      typeof user !== 'object'
    ) {

      return null;

    }


    const id =
      Number(
        user.id ??
        user.userId ??
        user.user_id
      );


    if (
      !Number.isInteger(id) ||
      id <= 0
    ) {

      return null;

    }


    return {

      id,

      firstName:
        String(
          user.firstName ??
          user.first_name ??
          ''
        ).trim(),

      lastName:
        String(
          user.lastName ??
          user.last_name ??
          ''
        ).trim(),

      role:
        String(
          user.role ??
          ''
        ).trim().toLowerCase(),

      avatarUrl:
        String(
          user.avatarUrl ??
          user.avatar_url ??
          ''
        ).trim(),

    };

  }


  /* =========================================================
     API REQUEST
  ========================================================== */

  async function request(
    endpoint,
    options = {}
  ) {

    const token =
      getToken();


    if (!token) {

      const error =
        new Error(
          'Authentication token is missing.'
        );

      error.status =
        401;

      throw error;

    }


    const headers = {

      Accept:
        'application/json',

      Authorization:
        token.startsWith('Bearer ')
          ? token
          : `Bearer ${token}`,

    };


    let requestBody;


    if (
      options.body !== undefined &&
      options.body !== null
    ) {

      if (
        options.body instanceof FormData
      ) {

        requestBody =
          options.body;

      } else {

        headers['Content-Type'] =
          'application/json';

        requestBody =
          typeof options.body === 'string'
            ? options.body
            : JSON.stringify(
                options.body
              );

      }

    }


    const response =
      await fetch(
        `${CONFIG.API_BASE}${endpoint}`,
        {

          method:
            options.method || 'GET',

          headers,

          credentials:
            'include',

          body:
            requestBody,

          cache:
            'no-store',

        }
      );


    const raw =
      await response.text();


    let payload =
      {};


    try {

      payload =
        raw
          ? JSON.parse(raw)
          : {};

    } catch (_) {

      payload = {

        message:
          raw ||
          `Request failed with HTTP ${response.status}.`,

      };

    }


    if (
      response.status === 401
    ) {

      try {

        localStorage.removeItem(
          'barakalink_token'
        );

      } catch (_) {}


      const error =
        new Error(
          payload?.message ||
          'Your session has expired. Please log in again.'
        );


      error.status =
        401;

      error.code =
        'UNAUTHORIZED';

      error.payload =
        payload;


      window.location.href =
        '../login.html';


      throw error;

    }


    if (
      !response.ok ||
      payload?.success === false
    ) {

      const message =
        typeof payload?.message === 'string'
          ? payload.message
          : typeof payload?.error === 'string'
            ? payload.error
            : `Request failed with HTTP ${response.status}.`;


      const error =
        new Error(
          message
        );


      error.status =
        response.status;

      error.payload =
        payload;


      throw error;

    }


    return payload;

  }


  /* =========================================================
     CURRENT USER
  ========================================================== */

  async function loadCurrentUser() {

    const payload =
      await request(
        '/profile'
      );


    const data =
      payloadData(
        payload
      );


    const user =
      normalizeUser(
        data?.user
      );


    if (!user) {

      throw new Error(
        'Your BarakaLink account could not be loaded.'
      );

    }


    if (
      !['parent', 'ustaz'].includes(
        user.role
      )
    ) {

      throw new Error(
        'Only parent and Ustaz accounts can use chat.'
      );

    }


    state.currentUserId =
      user.id;

    state.currentUserRole =
      user.role;


    return user;

  }


  /* =========================================================
     CONVERSATION HELPERS
  ========================================================== */

  function conversationOtherUserId(
    conversation
  ) {

    return Number(

      conversation?.otherUser?.id ??
      conversation?.other_user?.id ??
      conversation?.otherUserId ??
      conversation?.other_user_id

    );

  }


  function normalizeConversation(
    row
  ) {

    const otherUser =
      normalizeUser(

        row?.otherUser ??
        row?.other_user ??
        {

          id:
            row?.otherUserId ??
            row?.other_user_id,

          firstName:
            row?.otherFirstName ??
            row?.other_first_name,

          lastName:
            row?.otherLastName ??
            row?.other_last_name,

          role:
            row?.otherRole ??
            row?.other_role,

          avatarUrl:
            row?.otherAvatarUrl ??
            row?.other_avatar_url,

        }

      );


    const id =
      Number(
        row?.id
      );


    if (
      !Number.isInteger(id) ||
      id <= 0 ||
      !otherUser
    ) {

      return null;

    }


    const lastMessage =
      row?.lastMessage ??
      row?.last_message;


    return {

      id,

      otherUser,

      lastMessage:
        lastMessage
          ? {

              body:
                String(
                  lastMessage.body ??
                  ''
                ),

              senderUserId:
                Number(
                  lastMessage.senderUserId ??
                  lastMessage.sender_user_id
                ),

              createdAt:
                lastMessage.createdAt ??
                lastMessage.created_at ??
                null,

            }
          : null,

      unreadCount:
        Number(
          row?.unreadCount ??
          row?.unread_count ??
          0
        ),

      updatedAt:
        row?.updatedAt ??
        row?.updated_at ??
        null,

    };

  }


  /* =========================================================
     LOAD CONVERSATIONS
  ========================================================== */

  async function loadConversations() {

    const payload =
      await request(
        CONFIG.CONVERSATIONS_ENDPOINT
      );


    const rows =
      extractConversationRows(
        payload
      );

const normalizedConversations =
  rows
    .map(normalizeConversation)
    .filter(Boolean);

/*
 * Ustazs should see only conversations that contain
 * at least one actual message.
 *
 * Opening a chat without sending a message must not
 * create a visible conversation on the Ustaz side.
 *
 * Parents/students can still see their own drafts.
 */
if (state.currentUserRole === 'ustaz') {
  state.conversations =
    normalizedConversations.filter(
      conversation =>
        conversation.lastMessage &&
        String(
          conversation.lastMessage.body ?? ''
        ).trim().length > 0
    );
} else {
  state.conversations =
    normalizedConversations;
}

    renderConversationList();


    /*
     * If a conversation is currently selected, keep the
     * active chat state intact while refreshing the list.
     */
    if (
      state.selectedConversationId
    ) {

      const selected =
        state.conversations.find(
          conversation =>
            conversation.id ===
            state.selectedConversationId
        );


      if (
        selected
      ) {

        state.selectedOtherUser =
          selected.otherUser;

        setChatHeader(
          selected.otherUser
        );

      }

    }


    console.info(
      '[BarakaLink][Inbox] Conversations loaded:',
      state.conversations.length
    );


    return state.conversations;

  }


  /* =========================================================
     OPEN CONVERSATION FROM USER
  ========================================================== */

  async function openConversation(
    withUserId
  ) {

    const id =
      Number(
        withUserId
      );


    if (
      !Number.isInteger(id) ||
      id <= 0
    ) {

      throw new Error(
        'The Ustaz user ID in the URL is invalid.'
      );

    }


    const payload =
      await request(
        '/conversations/open',
        {

          method:
            'POST',

          body:
            {
              withUserId:
                id,
            },

        }
      );


    const data =
      payloadData(
        payload
      );


    const conversation = {

      id:
        Number(
          data?.id
        ),

      otherUser:
        normalizeUser(
          data?.otherUser ??
          data?.other_user
        ),

      updatedAt:
        data?.updatedAt ??
        data?.updated_at ??
        null,

      lastMessage:
        null,

      unreadCount:
        0,

    };


    if (
      !conversation.id ||
      !conversation.otherUser
    ) {

      throw new Error(
        'The conversation could not be opened.'
      );

    }


    state.selectedConversationId =
      conversation.id;

    state.selectedOtherUser =
      conversation.otherUser;

    shell?.classList.add(
      'is-chat-open'
    );


    syncBackButtons();


    return conversation;

  }


  /* =========================================================
     DISPLAY HELPERS
  ========================================================== */

  function initials(
    user
  ) {

    const source =
      [
        user?.firstName,
        user?.lastName,
      ]
        .filter(Boolean)
        .map(
          value =>
            value.trim()
        )
        .filter(Boolean);


    if (
      !source.length
    ) {

      return 'BL';

    }


    if (
      source.length === 1
    ) {

      return source[0]
        .slice(0, 2)
        .toUpperCase();

    }


    return `${source[0][0]}${source[1][0]}`
      .toUpperCase();

  }


  function roleLabel(
    role
  ) {

    return String(
      role || ''
    ).toLowerCase() === 'parent'

      ? 'Parent / Student'

      : 'Ustaz / Ustaza';

  }


  function formatConversationTime(
    value
  ) {

    if (!value) {
      return '';
    }


    const date =
      new Date(
        value
      );


    if (
      Number.isNaN(
        date.getTime()
      )
    ) {

      return '';

    }


    const now =
      new Date();


    const sameDay =
      date.toDateString() ===
      now.toDateString();


    if (
      sameDay
    ) {

      return date.toLocaleTimeString(
        [],
        {

          hour:
            'numeric',

          minute:
            '2-digit',

        }
      );

    }


    return date.toLocaleDateString(
      [],
      {

        month:
          'short',

        day:
          'numeric',

      }
    );

  }


  function formatMessageTime(
    value
  ) {

    if (!value) {
      return '';
    }


    const date =
      new Date(
        value
      );


    if (
      Number.isNaN(
        date.getTime()
      )
    ) {

      return '';

    }


    return date.toLocaleString(
      [],
      {

        month:
          'short',

        day:
          'numeric',

        hour:
          'numeric',

        minute:
          '2-digit',

      }
    );

  }


  /* =========================================================
     MEDIA / AVATAR
  ========================================================== */

  function resolveMediaUrl(
    value
  ) {

    const raw =
      String(
        value ?? ''
      ).trim();


    if (!raw) {
      return '';
    }


    if (
      /^(https?:|data:|blob:|filesystem:)/i.test(
        raw
      )
    ) {

      return raw;

    }


    const apiBase =
      String(

        window.BARAKALINK_API_BASE ||
        CONFIG.API_BASE ||
        'http://localhost:5000/api'

      ).replace(
        /\/+$/,
        ''
      );


    const serverBase =
      apiBase.replace(
        /\/api$/i,
        ''
      );


    if (
      raw.startsWith(
        '/uploads/'
      ) ||
      raw.startsWith(
        '/media/'
      )
    ) {

      return `${serverBase}${raw}`;

    }


    if (
      raw.startsWith(
        'uploads/'
      ) ||
      raw.startsWith(
        'media/'
      )
    ) {

      return `${serverBase}/${raw}`;

    }


    if (
      raw.startsWith('/')
    ) {

      try {

        return new URL(
          raw,
          serverBase
        ).href;

      } catch (_) {

        return raw;

      }

    }


    return `${serverBase}/${raw.replace(/^\/+/, '')}`;

  }


  function createAvatarElement(
    user,
    id = '',
    extraClass = ''
  ) {

    const wrapper =
      document.createElement(
        'span'
      );


    wrapper.className =
      `inbox-avatar${extraClass ? ` ${extraClass}` : ''}`;


    if (id) {
      wrapper.id = id;
    }


    wrapper.setAttribute(
      'aria-hidden',
      'true'
    );


    const avatarUrl =
      resolveMediaUrl(

        user?.avatarUrl ??
        user?.avatar_url

      );


    if (avatarUrl) {

      const image =
        document.createElement(
          'img'
        );


      image.src =
        avatarUrl;

      image.alt =
        '';

      image.loading =
        'lazy';

      image.decoding =
        'async';


      image.addEventListener(
        'error',
        () => {

          image.remove();

          wrapper.textContent =
            initials(
              user
            );

        },
        {
          once:
            true,
        }
      );


      wrapper.appendChild(
        image
      );

    } else {

      wrapper.textContent =
        initials(
          user
        );

    }


    return wrapper;

  }


  /* =========================================================
     CONVERSATION LIST
  ========================================================== */

  function renderConversationList() {

    if (!list) {
      return;
    }


    list.innerHTML =
      '';


    const hasConversations =
      state.conversations.length >
      0;


    if (listEmpty) {

      listEmpty.hidden =
        hasConversations;

    }


    if (!hasConversations) {

      return;

    }


    const fragment =
      document.createDocumentFragment();


    state.conversations.forEach(
      (
        conversation
      ) => {

        const button =
          document.createElement(
            'button'
          );


        button.type =
          'button';


        button.className =
          'inbox-conversation';


        if (
          conversation.id ===
          state.selectedConversationId
        ) {

          button.classList.add(
            'is-selected'
          );

        }


        button.dataset.conversationId =
          String(
            conversation.id
          );


        const avatar =
          createAvatarElement(
            conversation.otherUser
          );


        const main =
          document.createElement(
            'span'
          );


        main.className =
          'inbox-conversation-main';


        const name =
          document.createElement(
            'span'
          );


        name.className =
          'inbox-conversation-name';


        name.textContent =
          [

            conversation.otherUser.firstName,

            conversation.otherUser.lastName,

          ]
            .filter(Boolean)
            .join(' ') ||
          'BarakaLink User';


        const preview =
          document.createElement(
            'span'
          );


        preview.className =
          'inbox-conversation-preview';


        preview.textContent =
          conversation.lastMessage?.body ||
          'No messages yet.';


        main.append(
          name,
          preview
        );


        const meta =
          document.createElement(
            'span'
          );


        meta.className =
          'inbox-conversation-meta';


        const time =
          document.createElement(
            'span'
          );


        time.className =
          'inbox-conversation-time';


        time.textContent =
          formatConversationTime(

            conversation.lastMessage?.createdAt ||
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
              'span'
            );


          unread.className =
            'inbox-unread';


          unread.textContent =
            conversation.unreadCount >
            99
              ? '99+'
              : String(
                  conversation.unreadCount
                );


          unread.setAttribute(
            'aria-label',
            `${conversation.unreadCount} unread messages`
          );


          meta.appendChild(
            unread
          );

        }


        button.append(
          avatar,
          main,
          meta
        );


        button.addEventListener(
          'click',
          () => {

            selectConversation(
              conversation
            );

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


  /* =========================================================
     CHAT HEADER
  ========================================================== */

  function setChatHeader(
    user
  ) {

    if (chatName) {

      chatName.textContent =
        [

          user?.firstName,

          user?.lastName,

        ]
          .filter(Boolean)
          .join(' ') ||
        'BarakaLink User';

    }


    if (chatRole) {

      chatRole.textContent =
        roleLabel(
          user?.role
        );

    }


    if (chatAvatar) {

      chatAvatar.innerHTML =
        '';


      const avatar =
        createAvatarElement(
          user
        );


      while (
        avatar.firstChild
      ) {

        chatAvatar.appendChild(
          avatar.firstChild
        );

      }


      if (
        !chatAvatar.childNodes.length
      ) {

        chatAvatar.textContent =
          initials(
            user
          );

      }

    }

  }


  /* =========================================================
     MESSAGES DISPLAY
  ========================================================== */

  function scrollMessagesToBottom() {

    if (!messages) {
      return;
    }


    messages.scrollTop =
      messages.scrollHeight;

  }


  function clearMessageArea() {

    if (!messages) {
      return;
    }


    messages.innerHTML =
      '';

  }


  function renderEmptyMessages() {

    clearMessageArea();


    const wrapper =
      document.createElement(
        'div'
      );


    wrapper.className =
      'inbox-empty-state';


    const inner =
      document.createElement(
        'div'
      );


    const title =
      document.createElement(
        'strong'
      );


    title.textContent =
      'Start the conversation';


    const body =
      document.createElement(
        'span'
      );


    body.textContent =
      'Send a message to introduce yourself and ask about Quran lessons.';


    inner.append(
      title,
      body
    );


    wrapper.appendChild(
      inner
    );


    messages?.appendChild(
      wrapper
    );

  }


  function renderMessages(
    items,
    preserveScroll = false
  ) {

    if (!messages) {
      return;
    }


    const wasNearBottom =
      messages.scrollHeight -
      messages.scrollTop -
      messages.clientHeight <
      120;


    const normalized =
      Array.isArray(items)
        ? items
        : [];


    const signature =
      normalized
        .map(
          item =>
            `${item?.id}:${item?.senderUserId}:${item?.createdAt}:${item?.body}`
        )
        .join('|');


    if (
      signature ===
      state.lastRenderedMessageSignature &&
      preserveScroll
    ) {

      return;

    }


    state.lastRenderedMessageSignature =
      signature;


    state.messages =
      normalized;


    clearMessageArea();


    if (
      !normalized.length
    ) {

      renderEmptyMessages();

      return;

    }


    const fragment =
      document.createDocumentFragment();


    normalized.forEach(
      message => {

        const row =
          document.createElement(
            'div'
          );


        row.className =
          'inbox-message-row';


        const own =
          Number(
            message.senderUserId
          ) ===
          Number(
            state.currentUserId
          );


        row.classList.add(
          own
            ? 'is-me'
            : 'is-them'
        );


        const bubble =
          document.createElement(
            'div'
          );


        bubble.className =
          'inbox-message-bubble';


        const body =
          document.createElement(
            'div'
          );


        body.className =
          'inbox-message-body';


        body.textContent =
          String(
            message.body ??
            ''
          );


        const time =
          document.createElement(
            'div'
          );


        time.className =
          'inbox-message-time';


        time.textContent =
          formatMessageTime(

            message.createdAt ??
            message.created_at

          );


        bubble.append(
          body,
          time
        );


        row.appendChild(
          bubble
        );


        fragment.appendChild(
          row
        );

      }
    );


    messages.appendChild(
      fragment
    );


    if (
      !preserveScroll ||
      wasNearBottom
    ) {

      scrollMessagesToBottom();

    }

  }


  /* =========================================================
     MESSAGE NORMALIZATION
  ========================================================== */

  function normalizeMessage(
    row
  ) {

    const id =
      Number(
        row?.id
      );


    const senderUserId =
      Number(
        row?.senderUserId ??
        row?.sender_user_id
      );


    if (
      !Number.isInteger(id) ||
      !Number.isInteger(senderUserId)
    ) {

      return null;

    }


    return {

      id,

      conversationId:
        Number(
          row?.conversationId ??
          row?.conversation_id
        ),

      senderUserId,

      body:
        String(
          row?.body ??
          ''
        ),

      createdAt:
        row?.createdAt ??
        row?.created_at ??
        null,

      readAt:
        row?.readAt ??
        row?.read_at ??
        null,

    };

  }


  /* =========================================================
     LOAD MESSAGES
  ========================================================== */

  async function loadMessages(
    {
      preserveScroll = false
    } = {}
  ) {

    if (
      !state.selectedConversationId ||
      state.loadingMessages
    ) {

      return [];

    }


    state.loadingMessages =
      true;


    try {

      const payload =
        await request(

          `/conversations/${encodeURIComponent(
            state.selectedConversationId
          )}/messages`

        );


      const rows =
        extractMessageRows(
          payload
        );


      const normalized =
        rows
          .map(
            normalizeMessage
          )
          .filter(
            Boolean
          );


      renderMessages(
        normalized,
        preserveScroll
      );


      return normalized;

    } finally {

      state.loadingMessages =
        false;

    }

  }


  /* =========================================================
     MARK READ
  ========================================================== */

  async function markSelectedRead() {

    if (
      !state.selectedConversationId
    ) {

      return;

    }


    try {

      await request(

        `/conversations/${encodeURIComponent(
          state.selectedConversationId
        )}/read`,

        {
          method:
            'PATCH',
        }

      );


      const selected =
        state.conversations.find(

          item =>
            item.id ===
            state.selectedConversationId

        );


      if (
        selected
      ) {

        selected.unreadCount =
          0;

      }


      renderConversationList();

    } catch (error) {

      if (
        error?.status ===
        401
      ) {

        throw error;

      }


      console.warn(
        '[BarakaLink][Inbox] Mark read failed:',
        error
      );

    }

  }


  /* =========================================================
     SELECT CONVERSATION
  ========================================================== */

  async function selectConversation(
    conversation,
    options = {}
  ) {

    const normalized =
      normalizeConversation(
        conversation
      );


    if (!normalized) {
      return;
    }


    state.selectedConversationId =
      normalized.id;


    state.selectedOtherUser =
      normalized.otherUser;


    state.lastRenderedMessageSignature =
      '';


    shell?.classList.add(
      'is-chat-open'
    );


    syncBackButtons();


    setChatHeader(
      normalized.otherUser
    );


    renderConversationList();


    hideError();


    await loadMessages(
      {
        preserveScroll:
          Boolean(
            options.preserveScroll
          ),
      }
    );


    await markSelectedRead();


    scrollMessagesToBottom();


    const url =
      new URL(
        window.location.href
      );


    url.searchParams.set(
      'conversation',
      String(
        normalized.id
      )
    );


    url.searchParams.set(
      'with',
      String(
        normalized.otherUser.id
      )
    );


    window.history.replaceState(
      {},
      '',
      url
    );

  }


  /* =========================================================
     QUERY / INITIAL CONVERSATION
  ========================================================== */

  async function selectConversationFromQuery() {

    const params =
      new URLSearchParams(
        window.location.search
      );


    const withUserId =
      Number(

        params.get('with') ||
        params.get('ustazUserId') ||
        params.get('ustaz_user_id') ||
        0

      );


    if (
      withUserId >
      0
    ) {

      const opened =
        await openConversation(
          withUserId
        );


      const existing =
        state.conversations.find(

          item =>
            item.id ===
            opened.id

        );


      const conversation =
        existing ||
        normalizeConversation(
          opened
        );


      if (
        conversation
      ) {

        await selectConversation(
          conversation
        );

      }


      return true;

    }


    const conversationId =
      Number(

        params.get(
          'conversation'
        ) ||
        0

      );


    if (
      conversationId >
      0
    ) {

      const existing =
        state.conversations.find(

          item =>
            item.id ===
            conversationId

        );


      if (
        existing
      ) {

        await selectConversation(
          existing
        );


        return true;

      }

    }

/*
 * No conversation was explicitly selected.
 *
 * Keep the inbox on the conversation list.
 * A specific conversation is opened only when
 * the URL contains ?with=USER_ID or ?conversation=ID.
 */

shell?.classList.remove(
  'is-chat-open'
);

state.selectedConversationId =
  null;

state.selectedOtherUser =
  null;

state.lastRenderedMessageSignature =
  '';

syncBackButtons();

return false;

    shell?.classList.remove(
      'is-chat-open'
    );


    state.selectedConversationId =
      null;


    state.selectedOtherUser =
      null;


    syncBackButtons();


    return false;

  }


  /* =========================================================
     SEND MESSAGE
  ========================================================== */

  async function sendMessage() {

    if (
      state.sending ||
      !state.selectedConversationId ||
      !input
    ) {

      return;

    }


    const body =
      input.value.trim();


    if (!body) {
      return;
    }


    state.sending =
      true;


    if (sendButton) {

      sendButton.disabled =
        true;

      sendButton.textContent =
        'Sending…';

    }


    hideError();


    try {

      const payload =
        await request(

          `/conversations/${encodeURIComponent(
            state.selectedConversationId
          )}/messages`,

          {

            method:
              'POST',

            body:
              {
                body,
              },

          }

        );


      const data =
        payloadData(
          payload
        );


      const message =
        normalizeMessage(
          data
        );


      if (
        message
      ) {

        const existing =
          state.messages.some(

            item =>
              item.id ===
              message.id

          );


        if (
          !existing
        ) {

          state.messages = [
            ...state.messages,
            message,
          ];


          renderMessages(
            state.messages,
            false
          );

        }

      } else {

        /*
         * Do NOT invent a fake server message.
         * The real saved message will be retrieved from
         * the backend immediately below.
         */
        await loadMessages(
          {
            preserveScroll:
              false,
          }
        );

      }


      input.value =
        '';


      input.style.height =
        '';


      await loadConversations();


      await markSelectedRead();


      scrollMessagesToBottom();

    } catch (error) {

      if (
        error?.status ===
        401
      ) {

        redirectToLogin();

        return;

      }


      showError(
        error?.message ||
        'Unable to send your message.'
      );

    } finally {

      state.sending =
        false;


      if (sendButton) {

        sendButton.disabled =
          false;

        sendButton.textContent =
          'Send';

      }

    }

  }


  /* =========================================================
     POLLING
  ========================================================== */

  async function pollMessages() {

    if (
      !state.selectedConversationId ||
      state.loadingMessages
    ) {

      return;

    }


    try {

      await loadMessages(
        {
          preserveScroll:
            true,
        }
      );

    } catch (error) {

      if (
        error?.status ===
        401
      ) {

        redirectToLogin();

        return;

      }


      if (
        error?.status ===
        429
      ) {

        console.warn(
          '[BarakaLink][Inbox] Message polling rate-limited. Polling will continue.'
        );

        return;

      }


      console.warn(
        '[BarakaLink][Inbox] Message polling failed:',
        error
      );

    }

  }


  async function pollConversations() {

    try {

      await loadConversations();

    } catch (error) {

      if (
        error?.status ===
        401
      ) {

        redirectToLogin();

      } else {

        console.warn(
          '[BarakaLink][Inbox] Conversation polling failed:',
          error
        );

      }

    }

  }


  function startPolling() {

    stopPolling();


    if (
      document.hidden
    ) {

      return;

    }


    state.messagePollTimer =
      window.setInterval(

        pollMessages,

        CONFIG.POLL_MESSAGES_MS

      );


    state.conversationPollTimer =
      window.setInterval(

        pollConversations,

        CONFIG.POLL_CONVERSATIONS_MS

      );

  }


  function stopPolling() {

    if (
      state.messagePollTimer
    ) {

      window.clearInterval(
        state.messagePollTimer
      );

      state.messagePollTimer =
        null;

    }


    if (
      state.conversationPollTimer
    ) {

      window.clearInterval(
        state.conversationPollTimer
      );

      state.conversationPollTimer =
        null;

    }

  }


  document.addEventListener(
    'visibilitychange',
    () => {

      if (
        document.hidden
      ) {

        stopPolling();

      } else {

        startPolling();

        pollConversations();


        if (
          state.selectedConversationId
        ) {

          pollMessages();

        }

      }

    }
  );


  /* =========================================================
     MOBILE BACK BUTTON STATE
  ========================================================== */

  function isMobileViewport() {

    return window.matchMedia(
      '(max-width: 820px)'
    ).matches;

  }


  function syncBackButtons() {

    const chatIsOpen =
      Boolean(
        shell?.classList.contains(
          'is-chat-open'
        )
      );


    const mobile =
      isMobileViewport();


    /*
     * Desktop:
     * - Dashboard back button remains available.
     * - Mobile conversation back remains hidden.
     *
     * Mobile list view:
     * - Show Back to Dashboard.
     * - Hide Back to Conversations.
     *
     * Mobile chat view:
     * - Hide Back to Dashboard.
     * - Show Back to Conversations.
     */

    if (backButton) {

      backButton.hidden =
        mobile &&
        chatIsOpen;

      backButton.setAttribute(
        'aria-hidden',
        String(
          mobile &&
          chatIsOpen
        )
      );

    }


    if (mobileBack) {

      mobileBack.hidden =
        !mobile ||
        !chatIsOpen;

      mobileBack.setAttribute(
        'aria-hidden',
        String(
          !mobile ||
          !chatIsOpen
        )
      );

    }

  }


  /* =========================================================
     COMPOSER
  ========================================================== */

  function setupComposer() {

    if (
      !form ||
      !input
    ) {

      return;

    }


    form.addEventListener(
      'submit',
      event => {

        event.preventDefault();

        sendMessage();

      }
    );


    input.addEventListener(
      'keydown',
      event => {

        if (
          event.key === 'Enter' &&
          !event.shiftKey
        ) {

          event.preventDefault();

          sendMessage();

        }

      }
    );


    input.addEventListener(
      'input',
      () => {

        input.style.height =
          'auto';


        input.style.height =
          `${Math.min(
            input.scrollHeight,
            150
          )}px`;

      }
    );

  }


  /* =========================================================
     BACK TO DASHBOARD
  ========================================================== */

  function setupBackButton() {

    backButton?.addEventListener(
      'click',
      () => {

        if (
          state.currentUserRole ===
          'ustaz'
        ) {

          window.location.href =
            'teacher.html';

        } else {

          window.location.href =
            'student.html';

        }

      }
    );

  }


  /* =========================================================
     MOBILE BACK TO CONVERSATIONS
  ========================================================== */

  function setupMobileBack() {

    mobileBack?.addEventListener(
      'click',
      () => {

        shell?.classList.remove(
          'is-chat-open'
        );


        state.selectedConversationId =
          null;


        state.selectedOtherUser =
          null;


        state.lastRenderedMessageSignature =
          '';


        syncBackButtons();


        /*
         * Keep the existing polling system running.
         * Message polling will simply stop acting because
         * there is no active conversation.
         */

      }
    );

  }


  /* =========================================================
     RESIZE
  ========================================================== */

  function setupResizeHandling() {

    window.addEventListener(
      'resize',
      syncBackButtons
    );

  }


  /* =========================================================
     INITIALIZE
  ========================================================== */

  async function initialize() {

    if (
      state.initialized
    ) {

      return;

    }


    state.initialized =
      true;


    const token =
      getToken();


    if (!token) {

      redirectToLogin();

      return;

    }


    setupComposer();

    setupBackButton();

    setupMobileBack();

    setupResizeHandling();


    /*
     * Set the correct initial back-button state before
     * the first async requests finish.
     */
    syncBackButtons();


    try {

      hideError();


      await loadCurrentUser();


      await loadConversations();


      await selectConversationFromQuery();


      syncBackButtons();


      startPolling();

    } catch (error) {

      console.error(
        '[BarakaLink][Inbox] Initialization failed:',
        error
      );


      if (
        error?.status ===
        401
      ) {

        redirectToLogin();

        return;

      }


      showError(
        error?.message ||
        'We could not load your messages.'
      );


      /*
       * An API failure is NOT an empty state.
       * Keep the conversation empty message hidden when
       * loading itself failed.
       */
      if (listEmpty) {

        listEmpty.hidden =
          true;

      }

    }

  }


  window.addEventListener(
    'beforeunload',
    stopPolling
  );


  if (
    document.readyState ===
    'loading'
  ) {

    document.addEventListener(
      'DOMContentLoaded',
      initialize,
      {
        once:
          true,
      }
    );

  } else {

    initialize();

  }

})();