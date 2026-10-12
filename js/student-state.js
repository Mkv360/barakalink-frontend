'use strict';

/* =========================================================
   BARAKALINK STUDENT DASHBOARD STATE

   Shared application state lives in one place.
   Feature-local implementation details remain inside their
   feature modules.
========================================================= */

export const state = {
  user: null,
  profile: null,

  preferences: {
    bio: '',
    preferredTeacherGender: 'no-preference',
    studyInterests: [],
    contentInterests: [],
  },

  teachers: [],
  filteredTeachers: [],
  savedTeachers: [],
  notifications: [],

  currentSection: 'home',
  currentTeacherFilter: 'all',
  searchTerm: '',
  sortMode: 'nearest',

  profileMenuOpen: false,
  notificationPanelOpen: false,

  conversations: [],
  activeConversationId: null,
  conversationMessages: [],
  messagesLoading: false,
  messageSending: false,
};

export function getStateSnapshot() {
  return {
    ...state,

    preferences: {
      ...state.preferences,

      studyInterests: [
        ...state.preferences.studyInterests,
      ],

      contentInterests: [
        ...state.preferences.contentInterests,
      ],
    },

    teachers: [
      ...state.teachers,
    ],

    filteredTeachers: [
      ...state.filteredTeachers,
    ],

    savedTeachers: [
      ...state.savedTeachers,
    ],

    notifications: [
      ...state.notifications,
    ],
  };
}