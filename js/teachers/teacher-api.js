"use strict";
import { getToken } from "./teacher-auth.js";
import { text, unwrapApiPayload } from "./teacher-core.js";
import { extractProfile } from "./teacher-profile.js";
import { CONFIG, state } from "./teacher-state.js";

function payloadData(
    payload
  ) {
    if (
      payload &&
      typeof payload ===
        "object" &&
      payload.data !==
        undefined
    ) {
      return payload.data;
    }

    return payload || {};
  }



  async function requestProfileWithApiHelper() {
    if (
      !window.BarakaLinkAPI ||
      typeof window.BarakaLinkAPI.get !==
        "function"
    ) {
      return null;
    }

    /*
     * The shared API helper may participate in browser/service-worker
     * caching. A cache-busting query keeps this fallback from reusing
     * a stale /api/profile response.
     */
    const separator =
      CONFIG.PROFILE_ENDPOINT.includes("?")
        ? "&"
        : "?";

    const endpoint =
      `${CONFIG.PROFILE_ENDPOINT}${separator}__bl_profile=${Date.now()}`;

    return window.BarakaLinkAPI.get(
      endpoint
    );
  }



  async function requestProfileWithFetch() {
    const base =
      String(CONFIG.API_BASE)
        .replace(/\/+$/, "");

    const token =
      getToken();

    const headers = {
      Accept:
        "application/json",
    };

    if (token) {
      headers.Authorization =
        token.startsWith(
          "Bearer "
        )
          ? token
          : `Bearer ${token}`;
    }

    let response;

    try {
      const separator =
        CONFIG.PROFILE_ENDPOINT.includes("?")
          ? "&"
          : "?";

      const endpoint =
        `${base}${CONFIG.PROFILE_ENDPOINT}${separator}__bl_profile=${Date.now()}`;

      response =
        await fetch(
          endpoint,
          {
            method: "GET",
            headers,
            credentials: "include",
            cache: "no-store",
          }
        );
    } catch (
      networkError
    ) {
      const error =
        new Error(
          "Unable to connect to the BarakaLink server."
        );

      error.code =
        "NETWORK_ERROR";

      error.stage =
        "profile-request";

      error.originalError =
        networkError;

      throw error;
    }

    const raw =
      await response.text();

    let payload = {};

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
      const error =
        new Error(
          text(
            payload?.message ??
              payload?.error,
            "Your session has expired."
          )
        );

      error.status = 401;
      error.code =
        "UNAUTHORIZED";

      error.stage =
        "profile-request";

      error.payload =
        payload;

      throw error;
    }

    if (!response.ok) {
      const error =
        new Error(
          text(
            payload?.message ??
              payload?.error,
            `Request failed with HTTP ${response.status}.`
          )
        );

      error.status =
        response.status;

      error.stage =
        "profile-request";

      error.payload =
        payload;

      throw error;
    }

    return payload;
  }



    async function loadProfile() {
      if (state.loading) {
        return null;
      }

      state.loading =
        true;

      try {
        console.info(
          "[BarakaLink][Ustaz Dashboard][profile-request] Starting GET /api/profile"
        );

        let payload =
          null;

        let fetchError =
          null;

        /*
         * Prefer the direct no-store request for the profile. This is
         * the authoritative fresh path and avoids a stale response from
         * a shared helper that previously returned HTTP 304/cached data.
         * The existing API helper remains as a compatibility fallback.
         */
        try {
          payload =
            await requestProfileWithFetch();
        } catch (
          error
        ) {
          if (
            error?.status === 401 ||
            error?.code ===
              "UNAUTHORIZED"
          ) {
            throw error;
          }

          fetchError =
            error;

          console.warn(
            "[BarakaLink][Ustaz Dashboard][profile-request] Direct /api/profile fetch failed; using API helper fallback.",
            error
          );
        }

        if (!payload) {
          try {
            payload =
              await requestProfileWithApiHelper();
          } catch (
            helperError
          ) {
            if (
              helperError?.status ===
                401 ||
              helperError?.code ===
                "UNAUTHORIZED" ||
              (
                helperError?.status &&
                helperError.status >=
                  400
              )
            ) {
              throw helperError;
            }

            if (
              fetchError
            ) {
              throw fetchError;
            }

            throw helperError;
          }
        }

        if (!payload) {
          throw (
            fetchError ||
            new Error(
              "Your BarakaLink profile could not be loaded."
            )
          );
        }

        console.info(
          "[BarakaLink][Ustaz Dashboard][profile-request] /api/profile response received."
        );

        const unwrapped =
          await unwrapApiPayload(
            payload
          );

        const profile =
          extractProfile(
            unwrapped
          );

        state.user =
          profile.user;

        state.teacher =
          profile.teacher;

        state.studyFields =
          profile.studyFields;

        state.languages =
          profile.languages;

        state.availability =
          profile.availability;

        state.qualifications =
          profile.qualifications;
  state.trust = profile.trust;
        console.info(
          "[BarakaLink][Ustaz Dashboard][profile-normalization] Profile normalized.",
          {
            userId:
              state.user?.id,
            teacherProfileId:
              state.teacher?.id,
            role:
              state.user?.role,
            profileCompleted:
              state.user?.profileCompleted,
            studyFieldCount:
              state.studyFields.length,
            languageCount:
              state.languages.length,
            availabilityCount:
              state.availability.length,
            qualificationCount:
              state.qualifications.length,
          }
        );

        return profile;
      } finally {
        state.loading =
          false;
      }
    }



  async function requestUstazConnectionsWithApiHelper() {
    if (
      !window.BarakaLinkAPI ||
      typeof window.BarakaLinkAPI.get !== "function"
    ) {
      return null;
    }

    return window.BarakaLinkAPI.get(
      "/learning/connections/ustaz"
    );
  }




  async function requestUstazConnectionsWithFetch() {

    const base =
      String(
        CONFIG.API_BASE
      ).replace(
        /\/+$/,
        ""
      );


    const token =
      getToken();


    const headers = {
      Accept: "application/json",
    };


    if (token) {

      headers.Authorization =
        token.startsWith("Bearer ")
          ? token
          : `Bearer ${token}`;

    }


    let response;


    try {

      response =
        await fetch(
          `${base}/learning/connections/ustaz`,
          {
            method: "GET",
            headers,
            credentials: "include",
            cache: "no-store",
          }
        );

    } catch (networkError) {

      const error =
        new Error(
          "Unable to connect to the BarakaLink server."
        );

      error.code =
        "NETWORK_ERROR";

      error.stage =
        "active-learning-request";

      error.originalError =
        networkError;

      throw error;

    }


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

      const error =
        new Error(
          text(
            payload?.message ??
              payload?.error,
            "Your session has expired."
          )
        );

      error.status =
        401;

      error.code =
        "UNAUTHORIZED";

      error.stage =
        "active-learning-request";

      throw error;

    }


    if (!response.ok) {

      const error =
        new Error(
          text(
            payload?.message ??
              payload?.error,
            `Request failed with HTTP ${response.status}.`
          )
        );

      error.status =
        response.status;

      error.stage =
        "active-learning-request";

      throw error;

    }


    return payload;
  }


  async function requestIncomingLearningWithApiHelper() {

    if (
      !window.BarakaLinkAPI ||
      typeof window.BarakaLinkAPI.get !== "function"
    ) {
      return null;
    }

    return window.BarakaLinkAPI.get(
      "/learning/requests/incoming"
    );
  }




  async function requestIncomingLearningWithFetch() {

    const base =
      String(
        CONFIG.API_BASE
      ).replace(/\/+$/, "");

    const token =
      getToken();

    const headers = {
      Accept: "application/json",
    };

    if (token) {
      headers.Authorization =
        token.startsWith("Bearer ")
          ? token
          : `Bearer ${token}`;
    }

    const response =
      await fetch(
        `${base}/learning/requests/incoming`,
        {
          method: "GET",
          headers,
          credentials: "include",
          cache: "no-store",
        }
      );

    const payload =
      await response.json().catch(
        () => ({})
      );

    if (response.status === 401) {

      const error =
        new Error(
          payload?.message ||
          "Your session has expired."
        );

      error.status = 401;
      error.code = "UNAUTHORIZED";

      throw error;
    }

    if (!response.ok) {

      const error =
        new Error(
          payload?.message ||
          `Request failed with HTTP ${response.status}.`
        );

      error.status =
        response.status;

      throw error;
    }

    return payload;
  }




  async function respondToIncomingLearningRequest(
    requestId,
    action
  ) {

    const normalizedAction =
      text(action)
        .toLowerCase();

    if (
      !requestId ||
      (
        normalizedAction !== "accept" &&
        normalizedAction !== "decline"
      )
    ) {
      return;
    }

    const token =
      getToken();

    if (!token) {
      const error =
        new Error(
          "Authentication token is missing."
        );

      error.status = 401;
      error.code = "UNAUTHORIZED";
      throw error;
    }

    const base =
      String(
        CONFIG.API_BASE
      ).replace(/\/+$/, "");

    let response;

    try {

      response =
        await fetch(
          `${base}/learning/requests/${encodeURIComponent(requestId)}/respond`,
          {
            method: "PATCH",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
              Authorization:
                token.startsWith("Bearer ")
                  ? token
                  : `Bearer ${token}`,
            },
            credentials: "include",
            cache: "no-store",
            body: JSON.stringify({
              action:
                normalizedAction,
            }),
          }
        );

    } catch (networkError) {

      const error =
        new Error(
          "Unable to connect to the BarakaLink server."
        );

      error.code =
        "NETWORK_ERROR";

      error.originalError =
        networkError;

      throw error;

    }

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

      const error =
        new Error(
          text(
            payload?.message ??
              payload?.error,
            "Your session has expired."
          )
        );

      error.status =
        401;

      error.code =
        "UNAUTHORIZED";

      throw error;
    }

    if (
      !response.ok ||
      payload?.success === false
    ) {

      const error =
        new Error(
          text(
            payload?.message ??
              payload?.error,
            `Request failed with HTTP ${response.status}.`
          )
        );

      error.status =
        response.status;

      error.payload =
        payload;

      throw error;
    }

    return payload;

  }



  async function requestMessageNotifications(
    endpoint
  ) {
    if (
      window.BarakaLinkAPI &&
      typeof window.BarakaLinkAPI.get ===
        "function"
    ) {
      return window.BarakaLinkAPI.get(
        endpoint
      );
    }

    const token =
      getToken();

    if (!token) {
      const error =
        new Error(
          "Authentication token is missing."
        );

      error.status =
        401;

      throw error;
    }

    const base =
      String(CONFIG.API_BASE)
        .replace(/\/+$/, "");

    const response =
      await fetch(
        `${base}${endpoint}`,
        {
          method: "GET",
          headers: {
            Accept:
              "application/json",
            Authorization:
              token.startsWith(
                "Bearer "
              )
                ? token
                : `Bearer ${token}`,
          },
          credentials:
            "include",
          cache:
            "no-store",
        }
      );

    const raw =
      await response.text();

    let payload = {};

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
      response.status ===
      401
    ) {
      const error =
        new Error(
          text(
            payload?.message ??
              payload?.error,
            "Your session has expired."
          )
        );

      error.status =
        401;

      error.code =
        "UNAUTHORIZED";

      throw error;
    }

    if (
      !response.ok ||
      payload?.success ===
        false
    ) {
      const error =
        new Error(
          text(
            payload?.message ??
              payload?.error,
            `Request failed with HTTP ${response.status}.`
          )
        );

      error.status =
        response.status;

      error.payload =
        payload;

      throw error;
    }

    return payload;
  }

export { payloadData, requestProfileWithApiHelper, requestProfileWithFetch, loadProfile, requestUstazConnectionsWithApiHelper, requestUstazConnectionsWithFetch, requestIncomingLearningWithApiHelper, requestIncomingLearningWithFetch, respondToIncomingLearningRequest, requestMessageNotifications };
