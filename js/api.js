/**
 * BarakaLink
 * Frontend API client
 */

"use strict";


(function () {

  /* =======================================================
     CONFIGURATION
  ======================================================= */

  const API_BASE =
    window.BARAKALINK_API_BASE ||
    "http://localhost:5000/api";


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
      ...(options.headers || {})
    };


    if (
      options.body &&
      !(options.body instanceof FormData)
    ) {

      headers["Content-Type"] =
        "application/json";

    }


    const token =
      getToken();


    if (token) {

      headers.Authorization =
        `Bearer ${token}`;

    }


    const response =
      await fetch(
        `${API_BASE}${path}`,
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
        message: "Invalid server response."
      };

    }


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
        body: JSON.stringify(body)
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
        body: JSON.stringify(body)
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
        body: JSON.stringify(body)
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