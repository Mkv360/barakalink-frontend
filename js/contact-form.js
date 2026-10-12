"use strict";

(function () {
  const API_BASE = String(
    window.BARAKALINK_API_BASE || "http://localhost:5000/api"
  ).replace(/\/+$/, "");

  const form = document.getElementById("contactForm");
  const status = document.getElementById("contactStatus");
  if (!form || !status) return;

  const submitButton = form.querySelector('button[type="submit"]');
  const firstNameInput = document.getElementById("contactFirstName");
  const lastNameInput = document.getElementById("contactLastName");
  const phoneInput = document.getElementById("contactPhone");
  const messageInput = document.getElementById("contactMessage");

  function showStatus(message, kind) {
    status.textContent = message;
    status.dataset.state = kind || "";
    status.style.color = kind === "error"
      ? "var(--danger, #a65353)"
      : kind === "success"
        ? "var(--success, #2f7b43)"
        : "";
  }

  function validate() {
    const firstName = firstNameInput.value.trim();
    const lastName = lastNameInput.value.trim();
    const phone = phoneInput.value.trim();
    const message = messageInput.value.trim();

    if (!firstName || firstName.length > 80) {
      firstNameInput.focus();
      showStatus("Enter your first name (up to 80 characters).", "error");
      return false;
    }
    if (!lastName || lastName.length > 80) {
      lastNameInput.focus();
      showStatus("Enter your last name (up to 80 characters).", "error");
      return false;
    }
    if (!phone || !/^[+\d\s().-]+$/.test(phone)) {
      phoneInput.focus();
      showStatus("Enter a valid Ethiopian mobile number, such as 912 345 678.", "error");
      return false;
    }
    if (message.length < 5 || message.length > 5000) {
      messageInput.focus();
      showStatus("Your message must contain at least 5 characters and no more than 5,000.", "error");
      return false;
    }
    return true;
  }

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    showStatus("", "");

    if (!validate()) return;

    const oldButtonText = submitButton ? submitButton.innerHTML : "";
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.setAttribute("aria-busy", "true");
      submitButton.innerHTML = 'Sending message <i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i>';
    }

    try {
      const response = await fetch(`${API_BASE}/contact`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify({
          firstName: firstNameInput.value.trim(),
          lastName: lastNameInput.value.trim(),
          phone: phoneInput.value.trim(),
          message: messageInput.value.trim(),
        }),
      });

      const raw = await response.text();
      let payload = {};
      try {
        payload = raw ? JSON.parse(raw) : {};
      } catch (_) {
        payload = { message: raw };
      }

      if (!response.ok || payload?.success === false) {
        throw new Error(payload?.message || `Your message could not be sent (HTTP ${response.status}).`);
      }

      form.reset();
      showStatus(payload?.message || "Your message has been sent to BarakaLink Support. Thank you.", "success");
    } catch (error) {
      console.error("[BarakaLink][Contact] Message submission failed:", error);
      showStatus(error?.message || "We could not send your message. Please try again.", "error");
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.removeAttribute("aria-busy");
        submitButton.innerHTML = oldButtonText;
      }
    }
  });
})();
