"use strict";
import { CONFIG } from "./teacher-state.js";

function text(value, fallback = "") {
    if (value === null || value === undefined) return fallback;

    const result = String(value).trim();

    return result || fallback;
  }



  function firstName(user = {}) {
    return text(
      user.firstName ?? user.first_name,
      "Ustaz"
    );
  }



  function fullName(user = {}) {
    const first = text(
      user.firstName ?? user.first_name
    );

    const last = text(
      user.lastName ?? user.last_name
    );

    return (
      [first, last]
        .filter(Boolean)
        .join(" ") ||
      "BarakaLink User"
    );
  }



  function getRoleLabel(user = {}, teacher = {}) {
    const direct = text(
      user.roleLabel ??
        user.role_label ??
        teacher.roleLabel ??
        teacher.role_label
    );

    if (direct) return direct;

    const gender = text(
      user.gender ??
        teacher.gender
    ).toLowerCase();

    if (gender === "female") return "Ustaza";
    if (gender === "male") return "Ustaz";

    return "Ustaz / Ustaza";
  }



  function normalizeArray(value) {
    if (Array.isArray(value)) return value;

    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return [];
    }

    if (typeof value === "string") {
      return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }

    return [];
  }



  function itemValue(item, keys = []) {
    if (
      item === null ||
      item === undefined
    ) {
      return "";
    }

    if (typeof item !== "object") {
      return text(item);
    }

    for (const key of keys) {
      const value = text(item?.[key]);

      if (value) return value;
    }

    return "";
  }



  function labelize(value) {
    const input = text(value);

    if (!input) return "";

    return input
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\b\w/g, (letter) =>
        letter.toUpperCase()
      );
  }



  function resolveMediaUrl(value) {
    const raw =
      text(value);

    if (!raw) return "";

    if (
      /^(https?:|data:|blob:|filesystem:)/i.test(
        raw
      )
    ) {
      return raw;
    }

    if (raw.startsWith("//")) {
      return `${window.location.protocol}${raw}`;
    }

    const apiBase =
      String(CONFIG.API_BASE)
        .replace(/\/+$/, "");

    const serverBase =
      apiBase.replace(
        /\/api$/i,
        ""
      );

    if (
      raw.startsWith("/uploads/") ||
      raw.startsWith("/media/")
    ) {
      return `${serverBase}${raw}`;
    }

    if (
      raw.startsWith("uploads/") ||
      raw.startsWith("media/")
    ) {
      return `${serverBase}/${raw}`;
    }

    if (raw.startsWith("/")) {
      try {
        return new URL(
          raw,
          serverBase ||
            window.location.origin
        ).href;
      } catch (_) {
        return raw;
      }
    }

    return `${serverBase}/${raw.replace(
      /^\/+/,
      ""
    )}`;
  }



  function isObject(value) {
    return (
      value !== null &&
      typeof value === "object"
    );
  }



  function firstDefinedObjectValue(
    sources = [],
    keys = []
  ) {
    for (const source of sources) {
      if (!isObject(source)) {
        continue;
      }

      for (const key of keys) {
        const value =
          source?.[key];

        if (
          value !== null &&
          value !== undefined &&
          !(
            typeof value === "string" &&
            value.trim() === ""
          )
        ) {
          return value;
        }
      }
    }

    return undefined;
  }



  function unwrapApiPayload(
    payload
  ) {
    if (
      payload === null ||
      payload === undefined
    ) {
      return payload;
    }

    if (
      typeof payload === "string"
    ) {
      try {
        return JSON.parse(
          payload
        );
      } catch (_) {
        return payload;
      }
    }

    if (
      typeof payload.json ===
      "function"
    ) {
      return payload.json();
    }

    return payload;
  }



  function getInitials(
    user = {}
  ) {
    const first =
      text(
        user.firstName ??
          user.first_name
      );

    const last =
      text(
        user.lastName ??
          user.last_name
      );

    const initials =
      `${first.charAt(0)}${last.charAt(0)}`
        .toUpperCase();

    return initials || "BL";
  }



  function formatUnreadBadge(
    count
  ) {
    const value =
      Math.max(
        0,
        Number(count) || 0
      );

    return value > 99
      ? "99+"
      : String(value);
  }

export { text, firstName, fullName, getRoleLabel, normalizeArray, itemValue, labelize, resolveMediaUrl, isObject, firstDefinedObjectValue, unwrapApiPayload, getInitials, formatUnreadBadge };
