/**
 * BarakaLink
 * Frontend API client
 *
 * Environment behavior:
 *
 * 1. Local PC
 *    http://localhost:5500
 *    http://127.0.0.1:5500
 *    → http://localhost:5000/api
 *
 * 2. Phone / LAN
 *    http://YOUR-PC-IP:5500
 *    → http://YOUR-PC-IP:5000/api
 *
 *    Example:
 *      Frontend:
 *        http://10.136.76.51:5500
 *
 *      API:
 *        http://10.136.76.51:5000/api
 *
 * 3. GitHub Pages / Telegram
 *    https://mkv360.github.io/barakalink-frontend/
 *    → public HTTPS backend
 *
 * Optional manual override:
 *   window.BARAKALINK_API_BASE
 *
 * Optional public API:
 *   window.BARAKALINK_PUBLIC_API_BASE
 *
 * IMPORTANT:
 *   Never put Telegram bot tokens or private credentials in this file.
 */

"use strict";

(function () {

  /* =======================================================
     CONFIGURATION
  ======================================================= */

  const LOCAL_API_BASE =
    "http://localhost:5000/api";


  /*
    Replace this only when you have a real public HTTPS API.

    Example:
      https://api.example.com/api

    Cloudflare Tunnel example:
      https://example.trycloudflare.com/api
  */
const PUBLIC_API_BASE =
  window.BARAKALINK_PUBLIC_API_BASE ||
  "https://recently-reg-conditioning-instances.trycloudflare.com/api";
  /* =======================================================
     HELPERS
  ======================================================= */

  function normalizeBaseUrl(value) {

    return String(
      value || ""
    )
      .trim()
      .replace(
        /\/+$/,
        ""
      );

  }


  function isPrivateIPv4(value) {

    const hostname =
      String(
        value || ""
      ).trim();


    /*
      10.0.0.0/8
    */

    if (
      /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(
        hostname
      )
    ) {

      return true;

    }


    /*
      192.168.0.0/16
    */

    if (
      /^192\.168\.\d{1,3}\.\d{1,3}$/.test(
        hostname
      )
    ) {

      return true;

    }


    /*
      172.16.0.0/12
      = 172.16.x.x through 172.31.x.x
    */

    const match =
      /^172\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/.exec(
        hostname
      );


    if (match) {

      const secondOctet =
        Number(
          match[1]
        );


      return (
        secondOctet >= 16 &&
        secondOctet <= 31
      );

    }


    return false;

  }


  function isFormDataBody(body) {

    return (
      typeof FormData !== "undefined" &&
      body instanceof FormData
    );

  }


  function isBlobBody(body) {

    return (
      typeof Blob !== "undefined" &&
      body instanceof Blob
    );

  }


  function isArrayBufferBody(body) {

    return (
      typeof ArrayBuffer !== "undefined" &&
      body instanceof ArrayBuffer
    );

  }


  function shouldSendAsRawBody(body) {

    return (
      typeof body === "string" ||
      isFormDataBody(body) ||
      isBlobBody(body) ||
      isArrayBufferBody(body)
    );

  }


  function prepareBody(body) {

    if (
      body === undefined ||
      body === null
    ) {

      return undefined;

    }


    /*
      FormData / Blob / ArrayBuffer / string
      must be passed through unchanged.
    */

    if (
      shouldSendAsRawBody(body)
    ) {

      return body;

    }


    /*
      Plain objects / arrays / numbers / booleans
      become JSON.
    */

    return JSON.stringify(
      body
    );

  }


  /* =======================================================
     ENVIRONMENT DETECTION
  ======================================================= */

  const hostname =
    window.location.hostname || "";


  /*
    Localhost / loopback
  */

  const isLocalhost =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1";


  /*
    Private LAN IPv4
  */

  const isLanFrontend =
    isPrivateIPv4(
      hostname
    );


  /* =======================================================
     API BASE RESOLUTION
  ======================================================= */

  let API_BASE =
    "";


  /*
    1. Explicit manual override
       Highest priority.
  */

  if (
    window.BARAKALINK_API_BASE
  ) {

    API_BASE =
      normalizeBaseUrl(
        window.BARAKALINK_API_BASE
      );

  }


  /*
    2. Local PC
  */

  else if (
    isLocalhost
  ) {

    API_BASE =
      LOCAL_API_BASE;

  }


  /*
    3. Phone / LAN device

    Example:

      Frontend:
        http://10.136.76.51:5500

      API:
        http://10.136.76.51:5000/api
  */

  else if (
    isLanFrontend
  ) {

    API_BASE =
      `http://${hostname}:5000/api`;

  }


  /*
    4. Public frontend

    GitHub Pages / Telegram / production
  */

  else {

    API_BASE =
      normalizeBaseUrl(
        PUBLIC_API_BASE
      );

  }


  /* =======================================================
     ENVIRONMENT LABEL
  ======================================================= */

  let environment =
    "PUBLIC";


  if (
    isLocalhost
  ) {

    environment =
      "LOCAL";

  }

  else if (
    isLanFrontend
  ) {

    environment =
      "LAN";

  }
/* Share the resolved API URL with pages that use direct fetch(). */
window.BARAKALINK_API_BASE = API_BASE;

  /* =======================================================
     DEBUG
  ======================================================= */

  console.info(
    "[BarakaLink API]",
    environment,
    "→",
    API_BASE
  );


  /* =======================================================
     TOKEN
  ======================================================= */

  const TOKEN_KEY =
    "barakalink_token";


  /*
    Compatibility with older token names.
  */

  const LEGACY_TOKEN_KEYS = [
    "token",
    "access_token"
  ];


  function getToken() {

    try {

      const primaryToken =
        localStorage.getItem(
          TOKEN_KEY
        );


      if (
        primaryToken
      ) {

        return primaryToken;

      }


      for (
        const key of LEGACY_TOKEN_KEYS
      ) {

        const legacyToken =
          localStorage.getItem(
            key
          );


        if (
          legacyToken
        ) {

          return legacyToken;

        }

      }


      return "";

    }

    catch (error) {

      console.warn(
        "[BarakaLink API] Unable to read token:",
        error
      );


      return "";

    }

  }


  function setToken(
    token
  ) {

    if (
      token === undefined ||
      token === null ||
      token === ""
    ) {

      return;

    }


    try {

      const normalizedToken =
        String(
          token
        ).trim();


      if (
        !normalizedToken
      ) {

        return;

      }


      localStorage.setItem(
        TOKEN_KEY,
        normalizedToken
      );

    }

    catch (error) {

      console.error(
        "[BarakaLink API] Unable to store token:",
        error
      );

    }

  }


  function clearToken() {

    try {

      localStorage.removeItem(
        TOKEN_KEY
      );


      for (
        const key of LEGACY_TOKEN_KEYS
      ) {

        localStorage.removeItem(
          key
        );

      }

    }

    catch (error) {

      console.warn(
        "[BarakaLink API] Unable to clear token:",
        error
      );

    }

  }


  /* =======================================================
     REQUEST
  ======================================================= */

  async function request(
    path,
    options = {}
  ) {

    /*
      Start with the standard JSON response header.
    */

    const headers = {
      Accept:
        "application/json"
    };


    /* =====================================================
       MERGE CUSTOM HEADERS
    ====================================================== */

    if (
      options.headers
    ) {

      if (
        typeof Headers !== "undefined" &&
        options.headers instanceof Headers
      ) {

        options.headers.forEach(
          function (
            value,
            key
          ) {

            headers[key] =
              value;

          }
        );

      }

      else {

        Object.assign(
          headers,
          options.headers
        );

      }

    }


    /* =====================================================
       BODY / CONTENT TYPE
    ====================================================== */

    const hasBody =
      Object.prototype.hasOwnProperty.call(
        options,
        "body"
      ) &&
      options.body !== undefined &&
      options.body !== null;


    /*
      JSON object/array/etc.
    */

    if (
      hasBody &&
      !shouldSendAsRawBody(
        options.body
      )
    ) {

      headers[
        "Content-Type"
      ] =
        "application/json";

    }


    /*
      Important:
      Do NOT set Content-Type manually for FormData.
      The browser supplies the multipart boundary.
    */


    /* =====================================================
       AUTHENTICATION
    ====================================================== */

    const token =
      getToken();


    if (
      token
    ) {

      headers.Authorization =
        token.startsWith(
          "Bearer "
        )
          ? token
          : `Bearer ${token}`;

    }


    /* =====================================================
       NORMALIZE PATH
    ====================================================== */

    const rawPath =
      String(
        path || ""
      );


    const normalizedPath =
      rawPath.startsWith("/")
        ? rawPath
        : `/${rawPath}`;


    const url =
      `${API_BASE}${normalizedPath}`;


    console.info(
      "[BarakaLink API] Request:",
      options.method || "GET",
      url
    );


    /* =====================================================
       FETCH OPTIONS
    ====================================================== */

    const fetchOptions = {
      ...options,
      headers
    };


    /*
      IMPORTANT FIX:
      Request receives the original body and serializes
      JSON objects itself.

      This ensures Content-Type is set correctly.
    */

    if (
      hasBody
    ) {

      fetchOptions.body =
        prepareBody(
          options.body
        );

    }


    /* =====================================================
       FETCH
    ====================================================== */

    let response;


    try {

      response =
        await fetch(
          url,
          fetchOptions
        );

    }

    catch (error) {

      console.error(
        "[BarakaLink API] Network error:",
        {
          url,
          error
        }
      );


      const networkError =
        new Error(
          "Unable to connect to the BarakaLink server."
        );


      networkError.code =
        "NETWORK_ERROR";


      networkError.originalError =
        error;


      networkError.url =
        url;


      throw networkError;

    }


    /* =====================================================
       RESPONSE
    ====================================================== */

    const raw =
      await response.text();


    let data =
      {};


    if (
      raw
    ) {

      try {

        data =
          JSON.parse(
            raw
          );

      }

      catch (_) {

        data = {
          success:
            response.ok,

          message:
            raw
        };

      }

    }


    /* =====================================================
       HTTP ERROR
    ====================================================== */

    if (
      !response.ok
    ) {

      const errorMessage =
        data?.message ||
        data?.error ||
        data?.details ||
        `Request failed with HTTP ${response.status}.`;


      const error =
        new Error(
          errorMessage
        );


      error.status =
        response.status;


      error.data =
        data;


      error.url =
        url;


      throw error;

    }


    /* =====================================================
       SUCCESS
    ====================================================== */

    return data;

  }


  /* =======================================================
     GET
  ======================================================= */

  function get(
    path,
    options = {}
  ) {

    return request(
      path,
      {
        ...options,

        method:
          "GET"
      }
    );

  }


  /* =======================================================
     POST
  ======================================================= */

  function post(
    path,
    body,
    options = {}
  ) {

    /*
      IMPORTANT:
      Do NOT JSON.stringify here.

      request() handles serialization and
      Content-Type correctly.
    */

    return request(
      path,
      {
        ...options,

        method:
          "POST",

        body
      }
    );

  }


  /* =======================================================
     PUT
  ======================================================= */

  function put(
    path,
    body,
    options = {}
  ) {

    /*
      Do NOT JSON.stringify here.
    */

    return request(
      path,
      {
        ...options,

        method:
          "PUT",

        body
      }
    );

  }


  /* =======================================================
     PATCH
  ======================================================= */

  function patch(
    path,
    body,
    options = {}
  ) {

    /*
      Do NOT JSON.stringify here.
    */

    return request(
      path,
      {
        ...options,

        method:
          "PATCH",

        body
      }
    );

  }


  /* =======================================================
     DELETE
  ======================================================= */

  function remove(
    path,
    options = {}
  ) {

    return request(
      path,
      {
        ...options,

        method:
          "DELETE"
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


  /* =======================================================
     READY MESSAGE
  ======================================================= */

  console.info(
    "[BarakaLink API] Client initialized.",
    {
      environment,
      hostname,
      base:
        API_BASE
    }
  );

})();