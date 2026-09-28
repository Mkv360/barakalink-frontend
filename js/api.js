/**
 * BarakaLink
 * Frontend API client
 *
 * Environment behavior:
 * - Local frontend (localhost / 127.0.0.1) → local backend
 * - GitHub Pages / Telegram → public HTTPS backend
 *
 * Optional override:
 *   window.BARAKALINK_API_BASE
 */

"use strict";

(function () {

  /* =======================================================
     CONFIGURATION
  ======================================================= */

  const LOCAL_API_BASE =
    "http://localhost:5000/api";


  /*
    IMPORTANT:
    Replace this with your REAL public HTTPS backend.

    Example:
      https://api.example.com/api

    Do NOT put your Telegram bot token here.
  */

  const PUBLIC_API_BASE =
    "https://YOUR-PUBLIC-API-DOMAIN/api";


  /* =======================================================
     ENVIRONMENT DETECTION
  ======================================================= */

  const hostname =
    window.location.hostname;


  const isLocalFrontend =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1";


  /*
    Manual override takes priority.
    Useful later for special testing.
  */

  const API_BASE =
    window.BARAKALINK_API_BASE ||
    (
      isLocalFrontend
        ? LOCAL_API_BASE
        : PUBLIC_API_BASE
    );


  /* =======================================================
     DEBUG
  ======================================================= */

  console.info(
    "[BarakaLink API]",
    isLocalFrontend
      ? "LOCAL"
      : "PUBLIC",
    "→",
    API_BASE
  );


  /* =======================================================
     TOKEN
  ======================================================= */

  const TOKEN_KEY =
    "barakalink_token";


  function getToken() {

    return localStorage.getItem(
      TOKEN_KEY
    );

  }


  function setToken(
    token
  ) {

    if (!token) {
      return;
    }

    localStorage.setItem(
      TOKEN_KEY,
      token
    );

  }


  function clearToken() {

    localStorage.removeItem(
      TOKEN_KEY
    );

  }


  /* =======================================================
     REQUEST
  ======================================================= */

  async function request(
    path,
    options = {}
  ) {

    const headers = {
      Accept: "application/json",
      ...(options.headers || {})
    };


    /*
      JSON body
    */

    if (
      options.body &&
      !(options.body instanceof FormData)
    ) {

      headers["Content-Type"] =
        "application/json";

    }


    /*
      Authentication token
    */

    const token =
      getToken();


    if (token) {

      headers.Authorization =
        `Bearer ${token}`;

    }


    /*
      Normalize the path so:
        "/auth/login"
      works correctly.
    */

    const normalizedPath =
      path.startsWith("/")
        ? path
        : `/${path}`;


    const response =
      await fetch(
        `${API_BASE}${normalizedPath}`,
        {
          ...options,
          headers
        }
      );


    let data;


    try {

      data =
        await response.json();

    } catch {

      data = {
        success: false,
        message:
          "Invalid server response."
      };

    }


    /*
      Convert HTTP errors into
      normal JavaScript errors.
    */

    if (!response.ok) {

      const error =
        new Error(
          data.message ||
          "Request failed."
        );


      error.status =
        response.status;


      error.data =
        data;


      throw error;

    }


    return data;

  }


  /* =======================================================
     GET
  ======================================================= */

  function get(
    path
  ) {

    return request(
      path,
      {
        method: "GET"
      }
    );

  }


  /* =======================================================
     POST
  ======================================================= */

  function post(
    path,
    body
  ) {

    return request(
      path,
      {
        method: "POST",
        body:
          JSON.stringify(body)
      }
    );

  }


  /* =======================================================
     PUT
  ======================================================= */

  function put(
    path,
    body
  ) {

    return request(
      path,
      {
        method: "PUT",
        body:
          JSON.stringify(body)
      }
    );

  }


  /* =======================================================
     PATCH
  ======================================================= */

  function patch(
    path,
    body
  ) {

    return request(
      path,
      {
        method: "PATCH",
        body:
          JSON.stringify(body)
      }
    );

  }


  /* =======================================================
     DELETE
  ======================================================= */

  function remove(
    path
  ) {

    return request(
      path,
      {
        method: "DELETE"
      }
    );

  }


  /* =======================================================
     PUBLIC API
  ======================================================= */

  window.BarakaLinkAPI = {

    base:
      API_BASE,

    request,

    get,

    post,

    put,

    patch,

    delete:
      remove,

    getToken,

    setToken,

    clearToken

  };


})();
