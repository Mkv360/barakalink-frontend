'use strict';

/* =========================================================
   BARAKALINK — TELEGRAM MINI APP BRIDGE
========================================================= */

(function () {

  const telegram =
    window.Telegram?.WebApp || null;


  const state = {
    isTelegram: Boolean(
      telegram &&
      telegram.initData
    ),

    initData:
      telegram?.initData || '',

    user:
      telegram?.initDataUnsafe?.user || null,

  };


  function init() {

    if (!telegram) {

      console.info(
        '[BarakaLink][Telegram] Running in normal browser mode.'
      );

      return;

    }


    /*
     * Tell Telegram that the Mini App is ready.
     */
    telegram.ready();


    /*
     * Ask Telegram for the available viewport.
     */
    if (
      typeof telegram.expand === 'function'
    ) {

      telegram.expand();

    }


    console.info(
      '[BarakaLink][Telegram] Mini App detected.'
    );


    console.info(
      '[BarakaLink][Telegram] Platform:',
      telegram.platform
    );


    console.info(
      '[BarakaLink][Telegram] Version:',
      telegram.version
    );


    if (state.user) {

      console.info(
        '[BarakaLink][Telegram] Telegram user:',
        {
          id: state.user.id,
          firstName: state.user.first_name,
          lastName: state.user.last_name,
          username: state.user.username,
        }
      );

    }

  }


  window.BarakaLinkTelegram = {

    isTelegram:
      state.isTelegram,

    initData:
      state.initData,

    user:
      state.user,

    webApp:
      telegram,

    init,

  };


  init();

})();