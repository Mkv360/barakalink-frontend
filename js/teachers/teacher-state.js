"use strict";


const CONFIG = Object.freeze({
  PROFILE_ENDPOINT: "/profile",

  API_BASE:
    window.BarakaLinkAPI?.base ||
    window.BARAKALINK_API_BASE ||
    (
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1" ||
      window.location.hostname === "::1"
        ? "http://localhost:5000/api"
        : `http://${window.location.hostname}:5000/api`
    ),

  THEME_KEY: "barakalink_theme",

  TOKEN_KEYS: [
    "barakalink_token",
    "token",
    "access_token"
  ],

  MESSAGE_NOTIFICATION_POLL_MS: 15000,

  LOGIN_PATH: "../login.html",

  PROFILE_PATH: "../ustaz-profile.html",
});


/* =========================================================
   SUPPORT BARAKA — OFFICIAL BANK ACCOUNTS
=========================================================

   Only enabled accounts with a bank name, account name,
   and account number are displayed.

   Add your real BarakaLink account details here.
========================================================= */

const SUPPORT_BANK_ACCOUNTS = [

  {
    bank: "Commercial Bank of Ethiopia (CBE)",
    accountName: "Danakil Labs",
    accountNumber: "546378291-20938476",
    enabled: true,
  },

  {
    bank: "Awash Bank",
    accountName: "",
    accountNumber: "",
    enabled: false,
  },

  {
    bank: "Dashen Bank",
    accountName: "",
    accountNumber: "",
    enabled: false,
  },

  {
    bank: "Bank of Abyssinia",
    accountName: "",
    accountNumber: "",
    enabled: false,
  },

  {
    bank: "Wegagen Bank",
    accountName: "",
    accountNumber: "",
    enabled: false,
  },

  {
    bank: "PRIME Bank",
    accountName: "",
    accountNumber: "",
    enabled: false,
  },

  {
    bank: "Cooperative Bank of Oromia (CBO)",
    accountName: "",
    accountNumber: "",
    enabled: false,
  },

];

/* =========================================================
   SUPPORT FLOAT SETTINGS
========================================================= */

const SUPPORT_FLOAT_KEY =
  "barakalink_ustaz_support_float_dismissed_v1";

const SUPPORT_FLOAT_COOLDOWN =
  7 * 24 * 60 * 60 * 1000;

const SUPPORT_FLOAT_DELAY =
  2500;

const state = {

  user: null,

  teacher: null,

  studyFields: [],

  languages: [],

  availability: [],

  qualifications: [],

  trust: {
    qualificationSubmitted: false,
    identityVerified: false,
    subscriptionActive: false,
  },

  section: "home",

  loading: false,

  initialized: false,

  audioBound: false,

  profileAudioBound: false,

  notificationPanelOpen: false,

  sidebarOpen: false,

  messageNotificationTimer: null,

  messageNotificationLoading: false,

  messageNotificationVisibilityBound: false,

  unreadMessageCount: 0,

  messageNotifications: [],

  messageConversations: [],

  messageConversationsLoading: false,

};

export { CONFIG, SUPPORT_BANK_ACCOUNTS, SUPPORT_FLOAT_KEY, SUPPORT_FLOAT_COOLDOWN, SUPPORT_FLOAT_DELAY, state };
