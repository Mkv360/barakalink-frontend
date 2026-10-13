'use strict';

/* =========================================================
   BARAKALINK SHARED NOTIFICATION API

   Shared by:
   - Parent / Student dashboard
   - Ustaz / Teacher dashboard

   Responsibilities:
   - Read notifications
   - Read unread count
   - Mark notifications as read
   - Mark all notifications as read
   - Read BarakaLink system messages
   - Mark system messages as read

   IMPORTANT:
   - Uses the existing BarakaLink JWT authentication.
   - Does not create notifications.
   - Does not change chat/conversation APIs.
   - Does not contain UI logic.
========================================================= */

const DEFAULT_API_BASE =
  'http://localhost:5000/api';

const NOTIFICATION_ENDPOINTS =
  Object.freeze({
    NOTIFICATIONS:
      '/notifications',

    UNREAD_COUNT:
      '/notifications/unread-count',

    READ_ALL:
      '/notifications/read-all',

    SYSTEM_MESSAGES:
      '/notifications/system-messages',
  });


/* =========================================================
   API BASE
========================================================= */

/* =========================================================
   API BASE — LOCAL COMPUTER + PUBLIC PHONE ACCESS
========================================================= */

const LOCAL_API_BASE = 'http://localhost:5000/api';

/*
 * Fallback for GitHub Pages / Telegram when the shared
 * API client has not configured a base URL.
 *
 * Update this if your Cloudflare quick-tunnel hostname changes.
 */
const PUBLIC_API_FALLBACK =
  'https://recently-reg-conditioning-instances.trycloudflare.com/api';

function getApiBase() {
  const configured =
    window.BarakaLinkAPI?.base ||
    window.BARAKALINK_API_BASE;

  if (configured) {
    return String(configured)
      .trim()
      .replace(/\/+$/, '');
  }

  const hostname = window.location.hostname;

  const isLocalComputer = [
    'localhost',
    '127.0.0.1',
    '::1',
  ].includes(hostname);

  return isLocalComputer
    ? LOCAL_API_BASE
    : PUBLIC_API_FALLBACK;
}


/* =========================================================
   TOKEN
========================================================= */

function getToken() {

  try {

    if (
      window.BarakaLinkAPI &&
      typeof window.BarakaLinkAPI.getToken ===
        'function'
    ) {

      const token =
        window.BarakaLinkAPI.getToken();

      if (token) {
        return token;
      }

    }

  } catch (error) {

    console.warn(
      '[BarakaLink][Notifications] Unable to read API token:',
      error
    );

  }


  const tokenKeys = [
    'barakalink_token',
    'access_token',
    'token',
    'jwt',
  ];


  for (
    const key of tokenKeys
  ) {

    try {

      const localToken =
        localStorage.getItem(key);

      if (localToken) {
        return localToken;
      }

    } catch (_) {}


    try {

      const sessionToken =
        sessionStorage.getItem(key);

      if (sessionToken) {
        return sessionToken;
      }

    } catch (_) {}

  }


  return '';

}


/* =========================================================
   AUTH HEADER
========================================================= */

function buildAuthorizationHeader(
  token
) {

  if (!token) {
    return '';
  }


  return token.startsWith('Bearer ')
    ? token
    : `Bearer ${token}`;

}


/* =========================================================
   RESPONSE ERROR
========================================================= */

function createApiError(
  message,
  status,
  code = ''
) {

  const error =
    new Error(
      message ||
      `Notification request failed with HTTP ${status}.`
    );


  error.status =
    status;


  error.code =
    code ||
    (
      status === 401
        ? 'UNAUTHORIZED'
        : 'NOTIFICATION_API_ERROR'
    );


  return error;

}


/* =========================================================
   REQUEST
========================================================= */

async function notificationRequest(
  endpoint,
  options = {}
) {

  const token =
    getToken();


  if (!token) {

    throw createApiError(
      'Authentication token is missing.',
      401,
      'UNAUTHORIZED'
    );

  }


  const normalizedEndpoint =
    String(endpoint || '').startsWith('/')
      ? String(endpoint || '')
      : `/${String(endpoint || '')}`;


  const response =
    await fetch(
      `${getApiBase()}${normalizedEndpoint}`,
      {
        method:
          options.method ||
          'GET',

        headers: {
          Accept:
            'application/json',

          Authorization:
            buildAuthorizationHeader(
              token
            ),

          ...(options.headers || {}),
        },

        credentials:
          'include',

        cache:
          'no-store',

        body:
          options.body ??
          undefined,
      }
    );


  const raw =
    await response.text();


  let payload =
    {};


  if (raw) {

    try {

      payload =
        JSON.parse(raw);

    } catch (_) {

      payload = {
        message:
          raw,
      };

    }

  }


  if (
    response.status ===
    401
  ) {

    throw createApiError(
      payload?.message ||
        'Your session has expired.',
      401,
      'UNAUTHORIZED'
    );

  }


  if (
    !response.ok ||
    payload?.success === false
  ) {

    throw createApiError(
      payload?.message ||
        payload?.error ||
        `Notification request failed with HTTP ${response.status}.`,
      response.status,
      'NOTIFICATION_API_ERROR'
    );

  }


  return payload;

}


/* =========================================================
   PAYLOAD HELPERS
========================================================= */

function getPayloadData(
  payload
) {

  if (
    payload &&
    typeof payload === 'object' &&
    payload.data !== undefined
  ) {

    return payload.data;

  }


  return payload || {};

}


function normalizeNotificationList(
  payload
) {

  const data =
    getPayloadData(
      payload
    );


  if (
    Array.isArray(data)
  ) {

    return data;

  }


  if (
    Array.isArray(
      data.notifications
    )
  ) {

    return data.notifications;

  }


  return [];

}


function normalizeSystemMessageList(
  payload
) {

  const data =
    getPayloadData(
      payload
    );


  if (
    Array.isArray(data)
  ) {

    return data;

  }


  if (
    Array.isArray(
      data.systemMessages
    )
  ) {

    return data.systemMessages;

  }


  if (
    Array.isArray(
      data.system_messages
    )
  ) {

    return data.system_messages;

  }


  return [];

}


/* =========================================================
   GET NOTIFICATIONS
========================================================= */

export async function getNotifications(
  limit = 50
) {

  const numericLimit =
    Math.min(
      100,
      Math.max(
        1,
        Number(limit) || 50
      )
    );


  const query =
    `?limit=${encodeURIComponent(
      numericLimit
    )}`;


  const payload =
    await notificationRequest(
      `${NOTIFICATION_ENDPOINTS.NOTIFICATIONS}${query}`
    );


  return {
    payload,
    notifications:
      normalizeNotificationList(
        payload
      ),
  };

}


/* =========================================================
   GET UNREAD COUNT
========================================================= */

export async function getUnreadNotificationCount() {

  const payload =
    await notificationRequest(
      NOTIFICATION_ENDPOINTS.UNREAD_COUNT
    );


  const data =
    getPayloadData(
      payload
    );


const count = Math.max(
  0,
  Number(
    data?.count ??
    data?.unreadCount ??
    payload?.count ??
    payload?.unreadCount ??
    0
  ) || 0
);



  return {
    payload,
    count,
  };

}


/* =========================================================
   MARK ONE NOTIFICATION READ
========================================================= */

export async function markNotificationRead(
  notificationId
) {

  const id =
    Number(
      notificationId
    );


  if (
    !Number.isInteger(id) ||
    id <= 0
  ) {

    throw new Error(
      'Invalid notification ID.'
    );

  }


  return notificationRequest(
    `${NOTIFICATION_ENDPOINTS.NOTIFICATIONS}/${encodeURIComponent(
      id
    )}/read`,
    {
      method:
        'PATCH',
    }
  );

}


/* =========================================================
   MARK ALL NOTIFICATIONS READ
========================================================= */

export async function markAllNotificationsRead() {

  return notificationRequest(
    NOTIFICATION_ENDPOINTS.READ_ALL,
    {
      method:
        'PATCH',
    }
  );

}


/* =========================================================
   GET SYSTEM MESSAGES
========================================================= */

export async function getSystemMessages(
  limit = 50
) {

  const numericLimit =
    Math.min(
      100,
      Math.max(
        1,
        Number(limit) || 50
      )
    );


  const query =
    `?limit=${encodeURIComponent(
      numericLimit
    )}`;


  const payload =
    await notificationRequest(
      `${NOTIFICATION_ENDPOINTS.SYSTEM_MESSAGES}${query}`
    );


  return {
    payload,
    systemMessages:
      normalizeSystemMessageList(
        payload
      ),
  };

}


/* =========================================================
   MARK ONE SYSTEM MESSAGE READ
========================================================= */

export async function markSystemMessageRead(
  messageId
) {

  const id =
    Number(
      messageId
    );


  if (
    !Number.isInteger(id) ||
    id <= 0
  ) {

    throw new Error(
      'Invalid system message ID.'
    );

  }


  return notificationRequest(
    `${NOTIFICATION_ENDPOINTS.SYSTEM_MESSAGES}/${encodeURIComponent(
      id
    )}/read`,
    {
      method:
        'PATCH',
    }
  );

}


/* =========================================================
   PUBLIC API
========================================================= */

export {
  NOTIFICATION_ENDPOINTS,
  getToken,
  notificationRequest,
  getPayloadData,
  normalizeNotificationList,
  normalizeSystemMessageList,
};
