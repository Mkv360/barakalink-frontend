'use strict';

/* =========================================================
   BARAKALINK STUDENT DASHBOARD UTILITIES

   Only reusable, feature-neutral helpers belong here.
========================================================= */

export function safeString(value, fallback = '') {

  if (
    value === null ||
    value === undefined
  ) {
    return fallback;
  }

  const stringValue = String(value).trim();

  return stringValue || fallback;
}


export function normalizeArray(value) {

  if (!Array.isArray(value)) {
    return [];
  }

  return [
    ...new Set(
      value
        .filter(
          item =>
            typeof item === 'string' ||
            typeof item === 'number'
        )
        .map(
          item => String(item).trim()
        )
        .filter(Boolean)
    ),
  ];

}


export function capitalizeWords(value) {

  const text = safeString(value);

  if (!text) {
    return '';
  }

  return text
    .split(/\s+/)
    .map(
      word =>
        word.charAt(0).toUpperCase() +
        word.slice(1).toLowerCase()
    )
    .join(' ');

}

export function formatRelativeDate(
  value
) {

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

    return safeString(
      value
    );

  }


  const diff =
    Date.now() -
    date.getTime();


  const seconds =
    Math.floor(
      diff / 1000
    );


  if (seconds < 60) {
    return 'Just now';
  }


  const minutes =
    Math.floor(
      seconds / 60
    );


  if (minutes < 60) {

    return (
      `${minutes} minute` +
      `${minutes === 1 ? '' : 's'} ago`
    );

  }


  const hours =
    Math.floor(
      minutes / 60
    );


  if (hours < 24) {

    return (
      `${hours} hour` +
      `${hours === 1 ? '' : 's'} ago`
    );

  }


  const days =
    Math.floor(
      hours / 24
    );


  if (days < 7) {

    return (
      `${days} day` +
      `${days === 1 ? '' : 's'} ago`
    );

  }


  return date.toLocaleDateString(
    'en-US',
    {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }
  );

}

export function escapeHtml(
  value
) {

  return String(
    value ?? ''
  )
    .replaceAll(
      '&',
      '&amp;'
    )
    .replaceAll(
      '<',
      '&lt;'
    )
    .replaceAll(
      '>',
      '&gt;'
    )
    .replaceAll(
      '"',
      '&quot;'
    )
    .replaceAll(
      "'",
      '&#039;'
    );

}


/*
 * Compatibility helper required by the existing My Learning renderer.
 * The supplied source calls getInitialsFromName() but does not define it.
 */
export function getInitialsFromName(value) {
  const parts = safeString(value)
    .split(/\s+/)
    .filter(Boolean);

  return (
    parts
      .slice(0, 2)
      .map(part => part.charAt(0))
      .join('')
      .toUpperCase() ||
    'U'
  );
}
