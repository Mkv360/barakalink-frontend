"use strict";
import { resolveMediaUrl, text } from "./teacher-core.js";
import { $, setText } from "./teacher-dom.js";
import { state } from "./teacher-state.js";

function formatAudioTime(
    seconds
  ) {
    const total =
      Math.max(
        0,
        Math.floor(
          Number(seconds) || 0
        )
      );

    const minutes =
      Math.floor(
        total / 60
      );

    const secondsPart =
      total % 60;

    return `${minutes}:${String(
      secondsPart
    ).padStart(2, "0")}`;
  }



  function resetAudioUi() {
    const progress =
      $("ustazAudioProgress");

    const current =
      $("ustazAudioTime");

    const duration =
      $("ustazAudioDuration");

    const play =
      $("ustazAudioPlay");

    if (progress) {
      progress.value =
        "0";

      progress.max =
        "0";
    }

    if (current) {
      current.textContent =
        "0:00";
    }

    if (duration) {
      duration.textContent =
        "0:00";
    }

    if (play) {
      play.setAttribute(
        "aria-label",
        "Play recitation"
      );

      const icon =
        play.querySelector(
          "i"
        );

      if (icon) {
        icon.className =
          "fa-solid fa-play";
      }
    }
  }



  function updateAudioButton() {
    const audio =
      $("ustazAudioPlayer");

    const button =
      $("ustazAudioPlay");

    if (
      !audio ||
      !button
    ) {
      return;
    }

    const icon =
      button.querySelector(
        "i"
      );

    if (icon) {
      icon.className =
        audio.paused
          ? "fa-solid fa-play"
          : "fa-solid fa-pause";
    }

    button.setAttribute(
      "aria-label",
      audio.paused
        ? "Play recitation"
        : "Pause recitation"
    );
  }



  function updateAudioUi() {
    const audio =
      $("ustazAudioPlayer");

    const progress =
      $("ustazAudioProgress");

    const current =
      $("ustazAudioTime");

    const duration =
      $("ustazAudioDuration");

    if (!audio) {
      return;
    }

    const durationValue =
      Number(
        audio.duration
      );

    if (progress) {
      progress.max =
        Number.isFinite(
          durationValue
        )
          ? String(
              durationValue
            )
          : "0";

      progress.value =
        String(
          Number(
            audio.currentTime
          ) || 0
        );
    }

    if (current) {
      current.textContent =
        formatAudioTime(
          audio.currentTime
        );
    }

    if (duration) {
      duration.textContent =
        formatAudioTime(
          audio.duration
        );
    }
  }



  function bindAudioEvents() {
    if (state.audioBound) {
      return;
    }

    const audio =
      $("ustazAudioPlayer");

    const play =
      $("ustazAudioPlay");

    const progress =
      $("ustazAudioProgress");

    if (!audio) {
      return;
    }

    state.audioBound =
      true;

    if (play) {
      play.addEventListener(
        "click",
        async () => {
          try {
            if (audio.paused) {
              await audio.play();
            } else {
              audio.pause();
            }
          } catch (error) {
            console.error(
              "[BarakaLink][Ustaz Dashboard] Unable to play recitation:",
              error
            );
          }

          updateAudioButton();
        }
      );
    }

    audio.addEventListener(
      "play",
      updateAudioButton
    );

    audio.addEventListener(
      "pause",
      updateAudioButton
    );

    audio.addEventListener(
      "ended",
      updateAudioButton
    );

    audio.addEventListener(
      "loadedmetadata",
      updateAudioUi
    );

    audio.addEventListener(
      "durationchange",
      updateAudioUi
    );

    audio.addEventListener(
      "timeupdate",
      updateAudioUi
    );

    if (progress) {
      progress.addEventListener(
        "input",
        () => {
          const value =
            Number(
              progress.value
            );

          if (
            Number.isFinite(
              value
            ) &&
            Number.isFinite(
              audio.duration
            )
          ) {
            audio.currentTime =
              value;
          }
        }
      );
    }

    audio.addEventListener(
      "error",
      () => {
        console.warn(
          "[BarakaLink][Ustaz Dashboard] Recitation audio could not be loaded.",
          audio.error
        );
      }
    );
  }



  function renderRecitation() {
    const teacher =
      state.teacher || {};

    const title =
      text(
        teacher.recitationTitle ??
          teacher.recitation_title,
        "Recitation Sample"
      );

    const description =
      text(
        teacher.recitationDescription ??
          teacher.recitation_description,
        "Add a recording from your profile page."
      );

    const url =
      text(
        teacher.recitationAudioUrl ??
          teacher.recitation_audio_url ??
          teacher.recitationUrl ??
          teacher.recitation_url ??
          teacher.sampleRecitationUrl ??
          teacher.sample_recitation_url
      );

    setText(
      "ustazRecitationTitle",
      title,
      "No sample loaded"
    );

    setText(
      "ustazRecitationDescription",
      description,
      "Add a recording from your profile page."
    );

    const mini =
      $("ustazAudioMini");

    const audio =
      $("ustazAudioPlayer");

    if (
      !mini ||
      !audio
    ) {
      return;
    }

    bindAudioEvents();

    if (!url) {
      audio.pause();

      audio.removeAttribute(
        "src"
      );

      audio.load();

      mini.hidden =
        true;

      resetAudioUi();

      return;
    }

    const resolvedUrl =
      resolveMediaUrl(
        url
      );

    if (!resolvedUrl) {
      mini.hidden =
        true;

      resetAudioUi();

      return;
    }

    audio.pause();

    audio.src =
      resolvedUrl;

    audio.load();

    mini.hidden =
      false;

    resetAudioUi();
  }



  function resetProfileAudioUi() {
    const progress =
      $("ustazProfileAudioProgress");

    const current =
      $("ustazProfileAudioTime");

    const duration =
      $("ustazProfileAudioDuration");

    const play =
      $("ustazProfileAudioPlay");

    if (progress) {
      progress.value = "0";
      progress.max = "0";
    }

    if (current) {
      current.textContent = "0:00";
    }

    if (duration) {
      duration.textContent = "0:00";
    }

    if (play) {
      play.setAttribute(
        "aria-label",
        "Play recitation"
      );

      const icon =
        play.querySelector("i");

      if (icon) {
        icon.className =
          "fa-solid fa-play";
      }
    }
  }



  function updateProfileAudioButton() {
    const audio =
      $("ustazProfileAudioPlayer");

    const button =
      $("ustazProfileAudioPlay");

    if (!audio || !button) {
      return;
    }

    const icon =
      button.querySelector("i");

    if (icon) {
      icon.className =
        audio.paused
          ? "fa-solid fa-play"
          : "fa-solid fa-pause";
    }

    button.setAttribute(
      "aria-label",
      audio.paused
        ? "Play recitation"
        : "Pause recitation"
    );
  }



  function updateProfileAudioUi() {
    const audio =
      $("ustazProfileAudioPlayer");

    const progress =
      $("ustazProfileAudioProgress");

    const current =
      $("ustazProfileAudioTime");

    const duration =
      $("ustazProfileAudioDuration");

    if (!audio) {
      return;
    }

    const durationValue =
      Number(audio.duration);

    if (progress) {
      progress.max =
        Number.isFinite(durationValue)
          ? String(durationValue)
          : "0";

      progress.value =
        String(
          Number(audio.currentTime) || 0
        );
    }

    if (current) {
      current.textContent =
        formatAudioTime(
          audio.currentTime
        );
    }

    if (duration) {
      duration.textContent =
        formatAudioTime(
          audio.duration
        );
    }
  }



  function bindProfileAudioEvents() {
    if (state.profileAudioBound) {
      return;
    }

    const audio =
      $("ustazProfileAudioPlayer");

    const play =
      $("ustazProfileAudioPlay");

    const progress =
      $("ustazProfileAudioProgress");

    if (!audio) {
      return;
    }

    state.profileAudioBound = true;

    if (play) {
      play.addEventListener(
        "click",
        async () => {
          try {
            if (audio.paused) {
              await audio.play();
            } else {
              audio.pause();
            }
          } catch (error) {
            console.error(
              "[BarakaLink][Ustaz Dashboard] Unable to play profile recitation:",
              error
            );
          }

          updateProfileAudioButton();
        }
      );
    }

    audio.addEventListener(
      "play",
      updateProfileAudioButton
    );

    audio.addEventListener(
      "pause",
      updateProfileAudioButton
    );

    audio.addEventListener(
      "ended",
      updateProfileAudioButton
    );

    audio.addEventListener(
      "loadedmetadata",
      updateProfileAudioUi
    );

    audio.addEventListener(
      "durationchange",
      updateProfileAudioUi
    );

    audio.addEventListener(
      "timeupdate",
      updateProfileAudioUi
    );

    if (progress) {
      progress.addEventListener(
        "input",
        () => {
          const value =
            Number(progress.value);

          if (
            Number.isFinite(value) &&
            Number.isFinite(audio.duration)
          ) {
            audio.currentTime =
              value;
          }
        }
      );
    }

    audio.addEventListener(
      "error",
      () => {
        console.warn(
          "[BarakaLink][Ustaz Dashboard] Profile recitation audio could not be loaded.",
          audio.error
        );
      }
    );
  }



  function renderProfileRecitation() {
    const teacher =
      state.teacher || {};

    /*
     * Use exactly the same recitation fields as the
     * Overview player so both areas always show the
     * same backend data.
     */

    const title =
      text(
        teacher.recitationTitle ??
          teacher.recitation_title,
        "No sample loaded"
      );

    const description =
      text(
        teacher.recitationDescription ??
          teacher.recitation_description,
        "Add a recording from your profile page."
      );

    const url =
      text(
        teacher.recitationAudioUrl ??
          teacher.recitation_audio_url ??
          teacher.recitationUrl ??
          teacher.recitation_url ??
          teacher.sampleRecitationUrl ??
          teacher.sample_recitation_url
      );

    setText(
      "ustazProfileRecitationTitle",
      title,
      "No sample loaded"
    );

    setText(
      "ustazProfileRecitationDescription",
      description,
      "Add a recording from your profile page."
    );

    const mini =
      $("ustazProfileAudioMini");

    const audio =
      $("ustazProfileAudioPlayer");

    if (!mini || !audio) {
      return;
    }

    bindProfileAudioEvents();

    if (!url) {
      audio.pause();

      audio.removeAttribute("src");

      audio.load();

      mini.hidden = true;

      resetProfileAudioUi();

      return;
    }

    const resolvedUrl =
      resolveMediaUrl(url);

    if (!resolvedUrl) {
      mini.hidden = true;

      resetProfileAudioUi();

      return;
    }

    audio.pause();

    audio.src =
      resolvedUrl;

    audio.load();

    mini.hidden = false;

    resetProfileAudioUi();

    updateProfileAudioButton();
  }

export { formatAudioTime, resetAudioUi, updateAudioButton, updateAudioUi, bindAudioEvents, renderRecitation, resetProfileAudioUi, updateProfileAudioButton, updateProfileAudioUi, bindProfileAudioEvents, renderProfileRecitation };
