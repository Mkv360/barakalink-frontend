'use strict';

/* =========================================================
   BARAKALINK SHARED NOTIFICATION CENTER

   Shared by:
   - Parent / Student dashboard
   - Ustaz / Teacher dashboard

   Preserves the old chat-notification behavior:
   - /conversations/unread-count for the Messages badge
   - /conversations for unread conversation cards
   - avatar -> initials fallback
   - sender name + latest unread preview + time
   - click -> inbox.html?conversation=ID

   Adds the new notification system:
   - notifications table
   - system_messages table
   - BarakaLink welcome / approval / rejection / review notices

   Badge rules:
   - Messages side-menu badge = unread chat messages only
   - Notification bell badge = unread chat messages + unread
     official notifications
   - new_message notification rows are not double-counted
========================================================= */

import {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
  getSystemMessages,
  markSystemMessageRead,
  notificationRequest,
  getPayloadData,
} from './notification-api.js';


/* =========================================================
   DEFAULT SETTINGS
========================================================= */

const DEFAULT_OPTIONS = Object.freeze({
  notificationLimit: 50,
  systemMessageLimit: 50,
  pollInterval: 30000,
  selectors: {},
  closeTriggers: [],
  emptyTitle: 'No new notifications',
  emptyBody: 'New BarakaLink updates will appear here.',
  onNotificationClick: null,
  onSystemMessageClick: null,
  closeOtherPanel: null,
});


/* =========================================================
   VALUE HELPERS
========================================================= */

function safeString(value, fallback = '') {
  if (value === null || value === undefined) {
    return fallback;
  }

  const result = String(value).trim();
  return result || fallback;
}


function normalizeBoolean(value) {
  return (
    value === true ||
    value === 1 ||
    value === '1' ||
    value === 'true'
  );
}


function toPositiveInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0
    ? number
    : null;
}


function extractArray(result, keys) {
  if (Array.isArray(result)) {
    return result;
  }

  if (!result || typeof result !== 'object') {
    return [];
  }

  for (const key of keys) {
    if (Array.isArray(result[key])) {
      return result[key];
    }
  }

  return [];
}


function normalizeNotification(notification) {
  if (!notification || typeof notification !== 'object') {
    return null;
  }

  const id = toPositiveInteger(notification.id);
  if (!id) {
    return null;
  }

  return {
    ...notification,
    id,
    title: safeString(notification.title, 'Notification'),
    body: safeString(
      notification.body ?? notification.message,
      ''
    ),
    type: safeString(notification.type, '').toLowerCase(),
    entityType: safeString(
      notification.entityType ?? notification.entity_type,
      ''
    ),
    entityId:
      notification.entityId ??
      notification.entity_id ??
      null,
    isRead: normalizeBoolean(
      notification.isRead ?? notification.is_read
    ),
    createdAt:
      notification.createdAt ??
      notification.created_at ??
      null,
  };
}


function normalizeSystemMessage(message) {
  if (!message || typeof message !== 'object') {
    return null;
  }

  const id = toPositiveInteger(message.id);
  if (!id) {
    return null;
  }

  return {
    ...message,
    id,
    title: safeString(message.title, 'BarakaLink'),
    body: safeString(message.body, ''),
    type: safeString(message.type, 'system').toLowerCase(),
    badgeLabel: safeString(
      message.badgeLabel ?? message.badge_label,
      'BarakaLink'
    ),
    replyAllowed: normalizeBoolean(
      message.replyAllowed ?? message.reply_allowed
    ),
    isRead: normalizeBoolean(
      message.isRead ?? message.is_read
    ),
    createdAt:
      message.createdAt ??
      message.created_at ??
      null,
  };
}


function normalizeNotificationConversation(row) {
  if (!row || typeof row !== 'object') {
    return null;
  }

  const id = toPositiveInteger(row.id);
  if (!id) {
    return null;
  }

  const other = row.otherUser ?? row.other_user ?? {};

  const otherUser = {
    id: toPositiveInteger(
      other.id ?? row.otherUserId ?? row.other_user_id
    ),
    firstName: safeString(
      other.firstName ??
      other.first_name ??
      row.otherFirstName ??
      row.other_first_name,
      ''
    ),
    lastName: safeString(
      other.lastName ??
      other.last_name ??
      row.otherLastName ??
      row.other_last_name,
      ''
    ),
    avatarUrl: safeString(
      other.avatarUrl ??
      other.avatar_url ??
      row.otherAvatarUrl ??
      row.other_avatar_url,
      ''
    ),
  };

  if (!otherUser.id) {
    return null;
  }

  const unreadCount = Math.max(
    0,
    Number(
      row.unreadCount ?? row.unread_count ?? 0
    ) || 0
  );

  if (unreadCount === 0) {
    return null;
  }

  const unreadMessage =
    row.unreadMessage ??
    row.unread_message ??
    null;

  const body = safeString(
    unreadMessage?.body ??
    row.unreadMessageBody ??
    row.unread_message_body,
    'You have a new message.'
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


function isNewMessageNotification(notification) {
  return safeString(notification?.type)
    .toLowerCase() === 'new_message';
}


function isSameSystemMessage(notification, systemMessage) {
  if (!notification || !systemMessage) {
    return false;
  }

  return (
    safeString(notification.type).toLowerCase() ===
      safeString(systemMessage.type).toLowerCase() &&
    safeString(notification.title) ===
      safeString(systemMessage.title) &&
    safeString(notification.body) ===
      safeString(systemMessage.body)
  );
}


function createdAtTimestamp(value) {
  if (!value) {
    return 0;
  }

  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}


function getUserFullName(user = {}) {
  const first = safeString(
    user.firstName ?? user.first_name,
    ''
  );
  const last = safeString(
    user.lastName ?? user.last_name,
    ''
  );

  return [first, last].filter(Boolean).join(' ') ||
    'BarakaLink User';
}


function getUserInitials(user = {}) {
  const first = safeString(
    user.firstName ?? user.first_name,
    ''
  );
  const last = safeString(
    user.lastName ?? user.last_name,
    ''
  );

  return (
    `${first.charAt(0)}${last.charAt(0)}`.toUpperCase() ||
    'BL'
  );
}


function resolveMediaUrl(value) {
  const raw = safeString(value, '');
  if (!raw) {
    return '';
  }

  if (/^(https?:|data:|blob:|filesystem:)/i.test(raw)) {
    return raw;
  }

  if (raw.startsWith('//')) {
    return `${window.location.protocol}${raw}`;
  }

  const apiBase = String(
    window.BarakaLinkAPI?.base ||
    window.BARAKALINK_API_BASE ||
    (
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname === '::1'
        ? 'http://localhost:5000/api'
        : `http://${window.location.hostname}:5000/api`
    )
  ).replace(/\/+$/, '');

  const serverBase = apiBase.replace(/\/api$/i, '');

  if (
    raw.startsWith('/uploads/') ||
    raw.startsWith('/media/')
  ) {
    return `${serverBase}${raw}`;
  }

  if (
    raw.startsWith('uploads/') ||
    raw.startsWith('media/')
  ) {
    return `${serverBase}/${raw}`;
  }

  if (raw.startsWith('/')) {
    try {
      return new URL(
        raw,
        serverBase || window.location.origin
      ).href;
    } catch (_) {
      return raw;
    }
  }

  return `${serverBase}/${raw.replace(/^\/+/, '')}`;
}


function formatNotificationTime(value) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const seconds = Math.max(
    0,
    Math.floor((Date.now() - date.getTime()) / 1000)
  );

  if (seconds < 10) return 'Just now';
  if (seconds < 60) return `${seconds} seconds ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  }

  const days = Math.floor(hours / 24);
  if (days < 7) {
    return `${days} day${days === 1 ? '' : 's'} ago`;
  }

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}


function getNotificationIcon(type) {
  const normalized = safeString(type).toLowerCase();

  if (normalized === 'welcome') {
    return 'fa-solid fa-hand-sparkles';
  }

  if (normalized === 'new_message') {
    return 'fa-regular fa-message';
  }

  if (normalized.includes('review')) {
    return 'fa-solid fa-star';
  }

  if (normalized.includes('verification')) {
    return 'fa-solid fa-shield-halved';
  }

  if (normalized.includes('approved')) {
    return 'fa-solid fa-circle-check';
  }

  if (normalized.includes('rejected') || normalized.includes('declined')) {
    return 'fa-solid fa-circle-xmark';
  }

  return 'fa-regular fa-bell';
}


function resolveElement(value) {
  if (!value) {
    return null;
  }

  if (
    typeof Element !== 'undefined' &&
    value instanceof Element
  ) {
    return value;
  }

  if (typeof value !== 'string') {
    return null;
  }

  if (
    value.startsWith('#') ||
    value.includes('.') ||
    value.includes('[')
  ) {
    return document.querySelector(value);
  }

  return document.getElementById(value);
}


/* =========================================================
   NOTIFICATION CENTER
========================================================= */

export class NotificationCenter {
  constructor(options = {}) {
    this.options = {
      ...DEFAULT_OPTIONS,
      ...options,
      selectors: {
        ...DEFAULT_OPTIONS.selectors,
        ...(options.selectors || {}),
      },
      closeTriggers: Array.isArray(options.closeTriggers)
        ? options.closeTriggers
        : DEFAULT_OPTIONS.closeTriggers,
    };

    this.notifications = [];
    this.systemMessages = [];
    this.messageNotifications = [];

    this.unreadMessageCount = 0;
    this.unreadOfficialCount = 0;
    this.unreadCount = 0;

    this.panelOpen = false;
    this.loading = false;
    this.initialized = false;

    this.pollTimer = null;
    this.visibilityBound = false;
    this.buttonBound = false;
    this.panelBound = false;
    this.clearButtonBound = false;
    this.closeTriggerBound = false;
    this.documentClickBound = false;

    this.button = resolveElement(
      this.options.selectors.button
    );
    this.panel = resolveElement(
      this.options.selectors.panel
    );
    this.list = resolveElement(
      this.options.selectors.list
    );
    this.badge = resolveElement(
      this.options.selectors.badge
    );
    this.messageBadge = resolveElement(
      this.options.selectors.messageBadge
    );
    this.clearButton = resolveElement(
      this.options.selectors.clearButton
    );
  }


  /* =======================================================
     INITIALIZE
  ======================================================= */

  setup() {
    if (this.initialized) {
      return this;
    }

    this.initialized = true;

    this.bindButton();
    this.bindPanel();
    this.bindClearButton();
    this.bindCloseTriggers();
    this.bindDocumentClick();
    this.bindVisibility();

    this.render();
    return this;
  }


  /* =======================================================
     BUTTON / PANEL
  ======================================================= */

  bindButton() {
    if (this.buttonBound || !this.button) {
      return;
    }

    this.buttonBound = true;

    this.button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      void this.toggle();
    });
  }


  bindPanel() {
    if (this.panelBound || !this.panel) {
      return;
    }

    this.panelBound = true;

    this.panel.addEventListener('click', event => {
      event.stopPropagation();
    });
  }


  bindClearButton() {
    if (this.clearButtonBound || !this.clearButton) {
      return;
    }

    this.clearButtonBound = true;

    this.clearButton.addEventListener('click', async event => {
      event.preventDefault();
      event.stopPropagation();
      await this.markAllRead();
    });
  }


  bindCloseTriggers() {
    if (this.closeTriggerBound) {
      return;
    }

    this.closeTriggerBound = true;

    this.options.closeTriggers
      .map(resolveElement)
      .filter(Boolean)
      .forEach(trigger => {
        trigger.addEventListener('click', () => {
          this.close();
        });
      });
  }


  bindDocumentClick() {
    if (this.documentClickBound) {
      return;
    }

    this.documentClickBound = true;

    document.addEventListener('click', () => {
      this.close();
    });
  }


  /* =======================================================
     VISIBILITY / POLLING
  ======================================================= */

  bindVisibility() {
    if (this.visibilityBound) {
      return;
    }

    this.visibilityBound = true;

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.stopPolling();
        return;
      }

      if (this.initialized) {
        void this.refresh();
        this.startPolling();
      }
    });
  }


  startPolling(interval = this.options.pollInterval) {
    this.stopPolling();

    if (document.hidden) {
      return;
    }

    /* Old behavior: fetch the unread count immediately. */
    void this.refresh();

    this.pollTimer = window.setInterval(() => {
      if (document.hidden) {
        return;
      }

      void this.refresh();
    }, Math.max(5000, Number(interval) || 30000));
  }


  stopPolling() {
    if (this.pollTimer !== null) {
      window.clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }


  /* =======================================================
     OPEN / CLOSE / TOGGLE
  ======================================================= */

  open() {
    if (!this.panel) {
      return;
    }

    this.options.closeOtherPanel?.();

    this.panelOpen = true;
    this.panel.hidden = false;

    if (this.button) {
      this.button.setAttribute('aria-expanded', 'true');
    }

    void this.load();
  }


  close() {
    this.panelOpen = false;

    if (this.panel) {
      this.panel.hidden = true;
    }

    if (this.button) {
      this.button.setAttribute('aria-expanded', 'false');
    }
  }


  async toggle() {
    if (this.panelOpen) {
      this.close();
      return;
    }

    this.open();
  }


  /* =======================================================
     DATA LOADERS
  ======================================================= */

  async loadNotificationsData() {
    try {
      const result = await getNotifications(
        this.options.notificationLimit
      );

      this.notifications = extractArray(
        result,
        ['notifications']
      )
        .map(normalizeNotification)
        .filter(Boolean);

      return this.notifications;
    } catch (error) {
      this.handleApiError(error);
      this.notifications = [];
      return [];
    }
  }


  async loadNotificationCount() {
    try {
      const result = await getUnreadNotificationCount();
      return Math.max(0, Number(result?.count) || 0);
    } catch (error) {
      this.handleApiError(error);
      return 0;
    }
  }


  async loadSystemMessages() {
    try {
      const result = await getSystemMessages(
        this.options.systemMessageLimit
      );

      this.systemMessages = extractArray(
        result,
        ['systemMessages', 'system_messages']
      )
        .map(normalizeSystemMessage)
        .filter(Boolean);

      return this.systemMessages;
    } catch (error) {
      this.handleApiError(error);
      this.systemMessages = [];
      return [];
    }
  }


  async loadUnreadMessageNotifications() {
    try {
      const payload = await notificationRequest(
        '/conversations'
      );

      const data = getPayloadData(payload);

      const rows = Array.isArray(data)
        ? data
        : Array.isArray(data?.conversations)
          ? data.conversations
          : [];

      this.messageNotifications = rows
        .map(normalizeNotificationConversation)
        .filter(Boolean);

      return this.messageNotifications;
    } catch (error) {
      this.handleApiError(error);
      this.messageNotifications = [];
      return [];
    }
  }


  async loadUnreadMessageCount() {
    try {
      const payload = await notificationRequest(
        '/conversations/unread-count'
      );

      const data = getPayloadData(payload);

      this.unreadMessageCount = Math.max(
        0,
        Number(
          data?.count ??
          payload?.count ??
          0
        ) || 0
      );

      return this.unreadMessageCount;
    } catch (error) {
      this.handleApiError(error);
      this.unreadMessageCount = 0;
      return 0;
    }
  }


  /* =======================================================
     COMPLETE LOAD
  ======================================================= */

  async load() {
    if (this.loading) {
      return this.notifications;
    }

    this.loading = true;

    try {
      const [
        notifications,
        notificationCount,
        systemMessages,
        messageNotifications,
        messageCount,
      ] = await Promise.all([
        this.loadNotificationsData(),
        this.loadNotificationCount(),
        this.loadSystemMessages(),
        this.loadUnreadMessageNotifications(),
        this.loadUnreadMessageCount(),
      ]);

      this.notifications = notifications;
      this.systemMessages = systemMessages;
      this.messageNotifications = messageNotifications;
      this.unreadMessageCount = messageCount;

      this.recalculateCounts(notificationCount);
      this.render();

      return this.notifications;
    } catch (error) {
      this.handleApiError(error);
      return this.notifications;
    } finally {
      this.loading = false;
    }
  }


  recalculateCounts(notificationCount = null) {
    const totalUnreadNotifications =
      notificationCount === null
        ? this.notifications.filter(
            notification => !notification.isRead
          ).length
        : Math.max(0, Number(notificationCount) || 0);

    /*
     * Each chat message also creates a new_message notification row.
     * We count the unread chat from /conversations/unread-count, so
     * exclude those rows here to avoid counting the same chat twice.
     */
    const unreadNewMessageNotifications =
      this.notifications.filter(
        notification =>
          !notification.isRead &&
          isNewMessageNotification(notification)
      ).length;

    /*
     * Some BarakaLink service notices are stored only in system_messages;
     * others are mirrored in notifications as well. Count system-only
     * unread notices separately, but never count a mirrored notice twice.
     */
    const unreadSystemOnlyMessages =
      this.systemMessages.filter(
        systemMessage =>
          !systemMessage.isRead &&
          !this.notifications.some(notification =>
            !notification.isRead &&
            !isNewMessageNotification(notification) &&
            isSameSystemMessage(notification, systemMessage)
          )
      ).length;

    this.unreadOfficialCount =
      Math.max(
        0,
        totalUnreadNotifications - unreadNewMessageNotifications
      ) + unreadSystemOnlyMessages;

    this.unreadCount =
      this.unreadOfficialCount +
      this.unreadMessageCount;
  }


  /* =======================================================
     REFRESH
  ======================================================= */

  async refresh() {
    try {
      /*
       * When the panel is open, refresh the complete notification
       * list. This updates message previews without adding extra
       * conversation requests to the closed-panel poll.
       */
      if (this.panelOpen) {
        await this.load();
        return this.unreadCount;
      }

      const [
        notifications,
        notificationCount,
        systemMessages,
        messageCount,
      ] = await Promise.all([
        this.loadNotificationsData(),
        this.loadNotificationCount(),
        this.loadSystemMessages(),
        this.loadUnreadMessageCount(),
      ]);

      this.notifications = notifications;
      this.systemMessages = systemMessages;
      this.unreadMessageCount = messageCount;

      this.recalculateCounts(notificationCount);
      this.renderBadge();
      this.renderMessageBadge();

      return this.unreadCount;
    } catch (error) {
      this.handleApiError(error);
      return this.unreadCount;
    }
  }


  /* =======================================================
     RENDER
  ======================================================= */

  render() {
    this.renderList();
    this.renderBadge();
    this.renderMessageBadge();
  }


  /* =======================================================
     RENDER LIST
  ======================================================= */

  renderList() {
    if (!this.list) {
      return;
    }

    this.list.replaceChildren();

    const notifications = Array.isArray(this.notifications)
      ? this.notifications
      : [];

    const systemMessages = Array.isArray(this.systemMessages)
      ? this.systemMessages
      : [];

    const messageNotifications =
      Array.isArray(this.messageNotifications)
        ? this.messageNotifications
        : [];

    /*
     * Hide generic new_message rows because they are represented
     * below by the richer old-style conversation cards.
     */
    const normalNotifications = notifications.filter(
      notification => {
        if (isNewMessageNotification(notification)) {
          return false;
        }

        /*
         * Official service messages exist in both tables. Show the
         * polished system-message card once instead of two cards.
         */
        if (
          systemMessages.some(systemMessage =>
            isSameSystemMessage(notification, systemMessage)
          )
        ) {
          return false;
        }

        return true;
      }
    );

    const entries = [];

    systemMessages.forEach(systemMessage => {
      entries.push({
        kind: 'system',
        data: systemMessage,
        createdAt: systemMessage.createdAt,
      });
    });

    messageNotifications.forEach(messageNotification => {
      entries.push({
        kind: 'message',
        data: messageNotification,
        createdAt: messageNotification.createdAt,
      });
    });

    normalNotifications.forEach(notification => {
      entries.push({
        kind: 'notification',
        data: notification,
        createdAt: notification.createdAt,
      });
    });

    entries.sort(
      (first, second) =>
        createdAtTimestamp(second.createdAt) -
        createdAtTimestamp(first.createdAt)
    );

    if (!entries.length) {
      this.appendEmptyState();
      return;
    }

    const fragment = document.createDocumentFragment();

    entries.forEach(entry => {
      let element = null;

      if (entry.kind === 'system') {
        element = this.createSystemMessageElement(entry.data);
      } else if (entry.kind === 'message') {
        element = this.createMessageNotificationElement(entry.data);
      } else {
        element = this.createNotificationElement(entry.data);
      }

      if (element) {
        fragment.appendChild(element);
      }
    });

    this.list.appendChild(fragment);
  }


  /* =======================================================
     EMPTY STATE
  ======================================================= */

  appendEmptyState() {
    const wrapper = document.createElement('div');
    wrapper.className = 'student-notification-empty';

    const icon = document.createElement('div');
    icon.className = 'student-notification-empty-icon';

    const iconElement = document.createElement('i');
    iconElement.className = 'fa-regular fa-bell';
    iconElement.setAttribute('aria-hidden', 'true');
    icon.appendChild(iconElement);

    const title = document.createElement('strong');
    title.textContent = this.options.emptyTitle;

    const body = document.createElement('p');
    body.textContent = this.options.emptyBody;

    wrapper.append(icon, title, body);
    this.list.appendChild(wrapper);
  }


  /* =======================================================
     CREATE NORMAL NOTIFICATION
  ======================================================= */

  createNotificationElement(notification) {
    const item = document.createElement('article');
    item.className = 'student-notification-item';

    if (notification.isRead) {
      item.classList.add('is-read');
    } else {
      item.classList.add('is-unread');
    }

    item.dataset.notificationId = String(notification.id);

    const iconWrapper = document.createElement('div');
    iconWrapper.className = 'student-notification-item-icon';

    const icon = document.createElement('i');
    icon.className = getNotificationIcon(notification.type);
    icon.setAttribute('aria-hidden', 'true');
    iconWrapper.appendChild(icon);

    const copy = document.createElement('div');
    copy.className = 'student-notification-item-copy';

    const title = document.createElement('strong');
    title.textContent = notification.title;

    const body = document.createElement('p');
    body.textContent = notification.body;

    const time = document.createElement('small');
    time.textContent = formatNotificationTime(notification.createdAt);

    copy.append(title, body, time);
    item.append(iconWrapper, copy);

    if (!notification.isRead) {
      item.setAttribute('role', 'button');
      item.setAttribute('tabindex', '0');

      item.addEventListener('click', () => {
        void this.handleNotificationClick(notification, item);
      });

      item.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          void this.handleNotificationClick(notification, item);
        }
      });
    }

    return item;
  }


  /* =======================================================
     CREATE CHAT MESSAGE NOTIFICATION

     Preserves old Ustaz notification behavior and gives Parent
     the same behavior.
  ======================================================= */

  createMessageNotificationElement(notification) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className =
      'barakalink-message-notification student-notification-item is-unread';

    button.dataset.conversationId = String(notification.id);

    const senderName = getUserFullName(notification.otherUser);

    button.setAttribute(
      'aria-label',
      `Open new message from ${senderName}`
    );

    const avatar = document.createElement('span');
    avatar.className = 'barakalink-message-notification-avatar';

    const initials = document.createElement('span');
    initials.className = 'barakalink-message-notification-initials';
    initials.textContent = getUserInitials(notification.otherUser);
    avatar.appendChild(initials);

    const photo = resolveMediaUrl(
      notification.otherUser.avatarUrl
    );

    if (photo) {
      const image = document.createElement('img');
      image.src = photo;
      image.alt = '';
      image.loading = 'lazy';

      image.addEventListener(
        'load',
        () => {
          initials.hidden = true;
        },
        { once: true }
      );

      image.addEventListener(
        'error',
        () => {
          image.remove();
          initials.hidden = false;
        },
        { once: true }
      );

      avatar.appendChild(image);
    }

    const copy = document.createElement('span');
    copy.className = 'barakalink-message-notification-copy';

    const title = document.createElement('span');
    title.className = 'barakalink-message-notification-title';
    title.textContent = 'New message';

    const name = document.createElement('strong');
    name.className = 'barakalink-message-notification-name';
    name.textContent = senderName;

    const preview = document.createElement('span');
    preview.className = 'barakalink-message-notification-preview';
    preview.textContent =
      notification.body || 'You have a new message.';

    copy.append(title, name, preview);

    const time = document.createElement('time');
    time.className = 'barakalink-message-notification-time';
    time.textContent = formatNotificationTime(notification.createdAt);

    const dot = document.createElement('span');
    dot.className = 'barakalink-message-notification-dot';
    dot.setAttribute('aria-hidden', 'true');

    button.append(avatar, copy, time, dot);

    button.addEventListener('click', () => {
      const conversationId = Number(
        button.dataset.conversationId
      );

      if (!Number.isInteger(conversationId) || conversationId <= 0) {
        return;
      }

      /* Preserve the exact old navigation behavior. */
      window.location.href =
        `inbox.html?conversation=${encodeURIComponent(conversationId)}`;
    });

    return button;
  }


  /* =======================================================
     CREATE OFFICIAL BARAKALINK SYSTEM MESSAGE
  ======================================================= */

  createSystemMessageElement(systemMessage) {
    const item = document.createElement('article');
    item.className = 'barakalink-system-message';
    item.dataset.systemMessageId = String(systemMessage.id);

    item.classList.toggle('is-read', systemMessage.isRead);
    item.classList.toggle('is-unread', !systemMessage.isRead);

    item.innerHTML = `
      <div class="barakalink-system-message-icon" aria-hidden="true">
        <i class="fa-solid fa-shield-heart"></i>
      </div>
      <div class="barakalink-system-message-copy">
        <span class="barakalink-system-message-brand"></span>
        <strong class="barakalink-system-message-title"></strong>
        <p class="barakalink-system-message-body"></p>
        <time class="barakalink-system-message-time"></time>
      </div>
    `;

    const brand = item.querySelector(
      '.barakalink-system-message-brand'
    );
    const title = item.querySelector(
      '.barakalink-system-message-title'
    );
    const body = item.querySelector(
      '.barakalink-system-message-body'
    );
    const time = item.querySelector(
      '.barakalink-system-message-time'
    );

    if (brand) {
      brand.textContent = systemMessage.badgeLabel || 'BarakaLink';
    }
    if (title) {
      title.textContent = systemMessage.title;
    }
    if (body) {
      body.textContent = systemMessage.body;
    }
    if (time) {
      time.textContent = formatNotificationTime(systemMessage.createdAt);
    }

    if (!systemMessage.isRead) {
      item.setAttribute('role', 'button');
      item.setAttribute('tabindex', '0');

      item.addEventListener('click', () => {
        void this.handleSystemMessageClick(systemMessage, item);
      });

      item.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          void this.handleSystemMessageClick(systemMessage, item);
        }
      });
    }

    return item;
  }


  /* =======================================================
     OFFICIAL NOTIFICATION CLICK
  ======================================================= */

  async handleNotificationClick(notification, element) {
    if (!notification || notification.isRead) {
      if (notification) {
        await this.runNotificationCallback(notification);
      }
      return;
    }

    /* new_message cards never reach this method. */
    if (isNewMessageNotification(notification)) {
      return;
    }

    try {
      await markNotificationRead(notification.id);

      notification.isRead = true;
      this.unreadOfficialCount = Math.max(
        0,
        this.unreadOfficialCount - 1
      );
      this.recalculateFromLocalState();

      if (element) {
        element.classList.remove('is-unread');
        element.classList.add('is-read');
        element.removeAttribute('role');
        element.removeAttribute('tabindex');
      }

      this.renderBadge();
    } catch (error) {
      this.handleApiError(error);
    }

    await this.runNotificationCallback(notification);
  }


  async runNotificationCallback(notification) {
    try {
      await this.options.onNotificationClick?.(notification);
    } catch (error) {
      console.error(
        '[BarakaLink][Notifications] Notification click callback failed:',
        error
      );
    }
  }


  /* =======================================================
     SYSTEM MESSAGE CLICK
  ======================================================= */

  async handleSystemMessageClick(systemMessage, element) {
    if (!systemMessage) {
      return;
    }

    if (!systemMessage.isRead) {
      try {
        await markSystemMessageRead(systemMessage.id);

        systemMessage.isRead = true;

        const matchingNotifications = this.notifications.filter(
          notification =>
            !notification.isRead &&
            isSameSystemMessage(notification, systemMessage)
        );

        for (const notification of matchingNotifications) {
          try {
            await markNotificationRead(notification.id);
            notification.isRead = true;
          } catch (error) {
            console.warn(
              '[BarakaLink][Notifications] Could not synchronize system notification read state:',
              error
            );
          }
        }

        this.recalculateFromLocalState();

        if (element) {
          element.classList.remove('is-unread');
          element.classList.add('is-read');
          element.removeAttribute('role');
          element.removeAttribute('tabindex');
        }

        this.renderBadge();
      } catch (error) {
        this.handleApiError(error);
      }
    }

    try {
      await this.options.onSystemMessageClick?.(systemMessage);
    } catch (error) {
      console.error(
        '[BarakaLink][Notifications] System message click callback failed:',
        error
      );
    }
  }


  /* =======================================================
     MARK ALL READ
  ======================================================= */

  async markAllRead() {
    try {
      /*
       * This is the old "Clear" action for the official
       * notification center. It does not mark the actual chat
       * messages read. The inbox remains responsible for that.
       */
      await markAllNotificationsRead();

      const unreadSystemMessages = this.systemMessages.filter(
        message => !message.isRead
      );

      await Promise.all(
        unreadSystemMessages.map(async message => {
          try {
            await markSystemMessageRead(message.id);
            message.isRead = true;
          } catch (error) {
            console.warn(
              '[BarakaLink][Notifications] Could not mark system message as read:',
              error
            );
          }
        })
      );

      this.notifications = this.notifications.map(notification => ({
        ...notification,
        isRead: true,
      }));

      this.systemMessages = this.systemMessages.map(message => ({
        ...message,
        isRead: true,
      }));

      this.unreadOfficialCount = 0;
      this.unreadCount = this.unreadMessageCount;

      this.render();
    } catch (error) {
      this.handleApiError(error);
    }
  }


  /* =======================================================
     LOCAL COUNT RECALCULATION
  ======================================================= */

  recalculateFromLocalState() {
    /* Count all unread official notification rows, excluding chat rows. */
    const unreadOfficialNotifications = this.notifications.filter(
      notification =>
        !notification.isRead &&
        !isNewMessageNotification(notification)
    ).length;

    /*
     * Some BarakaLink system notices exist only in system_messages.
     * Add only those without a matching notification row so mirrored
     * notices are represented exactly once.
     */
    const unreadSystemOnlyMessages = this.systemMessages.filter(
      systemMessage =>
        !systemMessage.isRead &&
        !this.notifications.some(notification =>
          !notification.isRead &&
          !isNewMessageNotification(notification) &&
          isSameSystemMessage(notification, systemMessage)
        )
    ).length;

    this.unreadOfficialCount =
      unreadOfficialNotifications + unreadSystemOnlyMessages;

    this.unreadCount =
      this.unreadOfficialCount +
      this.unreadMessageCount;
  }


  /* =======================================================
     SIDE-MENU MESSAGES BADGE
  ======================================================= */

  renderMessageBadge() {
    if (!this.messageBadge) {
      return;
    }

    const count = Math.max(
      0,
      Number(this.unreadMessageCount) || 0
    );

    this.messageBadge.hidden = count === 0;
    this.messageBadge.textContent = count > 99
      ? '99+'
      : String(count);

    this.messageBadge.setAttribute(
      'aria-label',
      `${count} unread message${count === 1 ? '' : 's'}`
    );
  }


  /* =======================================================
     BELL BADGE
  ======================================================= */

  renderBadge() {
    if (!this.badge) {
      return;
    }

    const count = Math.max(
      0,
      Number(this.unreadCount) || 0
    );

    this.badge.hidden = count === 0;
    this.badge.textContent = count > 99
      ? '99+'
      : String(count);

    this.badge.setAttribute(
      'aria-label',
      `${count} unread notification${count === 1 ? '' : 's'}`
    );
  }


  /* =======================================================
     API ERROR
  ======================================================= */

  handleApiError(error) {
    if (
      error?.status === 401 ||
      error?.code === 'UNAUTHORIZED'
    ) {
      console.warn(
        '[BarakaLink][Notifications] Session is not authenticated.'
      );
      return;
    }

    console.warn(
      '[BarakaLink][Notifications] Notification request failed:',
      error
    );
  }


  /* =======================================================
     DESTROY
  ======================================================= */

  destroy() {
    this.stopPolling();
    this.close();

    this.initialized = false;
    this.buttonBound = false;
    this.panelBound = false;
    this.clearButtonBound = false;
    this.closeTriggerBound = false;
    this.documentClickBound = false;
    this.visibilityBound = false;
  }
}


/* =========================================================
   FACTORY
========================================================= */

export function createNotificationCenter(options = {}) {
  const center = new NotificationCenter(options);
  center.setup();
  return center;
}


/* =========================================================
   PRECONFIGURED PARENT CENTER
========================================================= */

export function createStudentNotificationCenter(options = {}) {
  return createNotificationCenter({
    ...options,
    selectors: {
      button: 'studentNotificationButton',
      panel: 'studentNotificationPanel',
      list: 'studentNotificationList',
      badge: 'studentNotificationBadge',
      messageBadge: 'studentMessagesBadge',
      clearButton: 'studentNotificationClear',
      ...(options.selectors || {}),
    },
    closeTriggers: [
      'studentAvatarButton',
      'studentSidebarProfileButton',
      'studentMenuToggle',
    ],
    emptyTitle: 'No new notifications',
    emptyBody: 'New BarakaLink updates will appear here.',
  });
}


/* =========================================================
   PRECONFIGURED USTAZ CENTER
========================================================= */

export function createUstazNotificationCenter(options = {}) {
  return createNotificationCenter({
    ...options,
    selectors: {
      button: 'ustazNotificationButton',
      panel: 'ustazNotificationPanel',
      list: 'ustazNotificationList',
      badge: 'ustazNotificationBadge',
      messageBadge: 'ustazMessagesBadge',
      clearButton: 'ustazNotificationClear',
      ...(options.selectors || {}),
    },
    closeTriggers: [
      'ustazAvatarButton',
      'ustazSidebarProfileButton',
      'ustazMenuToggle',
    ],
    emptyTitle: 'No new notifications',
    emptyBody: 'New BarakaLink updates will appear here.',
  });
}
