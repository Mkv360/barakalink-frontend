'use strict';

/* =========================================================
   BARAKALINK STUDENT DASHBOARD API

   Shared authenticated request infrastructure only.
   Endpoint-specific operations live in feature modules.
========================================================= */

import { STUDENT_CONFIG } from './student-core.js';
import { getAuthToken } from './student-auth.js';

export async function apiRequest(
  path,
  options = {}
) {

  const token = getAuthToken();

  if (!token) {

    const error = new Error(
      'Authentication token is missing.'
    );

    error.code = 'NO_TOKEN';

    throw error;

  }


  const cleanPath =
    String(path || '').startsWith('/')
      ? String(path)
      : `/${String(path)}`;


  const url =
    `${STUDENT_CONFIG.API_BASE}${cleanPath}`;


  const headers = {
    Accept: 'application/json',
    ...(options.headers || {}),
    Authorization: `Bearer ${token}`,
  };


  /*
   * Only add JSON Content-Type when a body exists.
   */
  if (
    options.body &&
    !headers['Content-Type']
  ) {

    headers['Content-Type'] =
      'application/json';

  }


  let response;

  try {

    response = await fetch(
      url,
      {
        ...options,
        headers,
      }
    );

  } catch (error) {

    const networkError =
      new Error(
        'Unable to connect to the BarakaLink server.'
      );

    networkError.code = 'NETWORK_ERROR';
    networkError.originalError = error;

    throw networkError;

  }


  let payload = null;

  try {
    payload = await response.json();
  } catch {
    payload = null;
  }


  if (response.status === 401) {

    const error = new Error(
      payload?.message ||
      'Your session has expired.'
    );

    error.code = 'UNAUTHORIZED';
    error.status = 401;

    throw error;

  }


  if (!response.ok) {

    const error = new Error(
      payload?.message ||
      payload?.error ||
      `Request failed with status ${response.status}.`
    );

    error.status = response.status;
    error.payload = payload;

    throw error;

  }


  return payload;

}
