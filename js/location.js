"use strict";


/* =========================================================
   BARAKALINK — BROWSER LOCATION
   Parent + Ustaz

   LOCATION POLICY
   ---------------

   Browser accuracy:

   <= 500 m
       precise

   <= 5,000 m
       approximate
       reliable enough for distance ranking

   <= 50,000 m
       coarse
       save it, but DO NOT trust it for exact GPS distance

   > 50,000 m
       unusable

   IMPORTANT:

   A coarse 10 km location is NOT a failure anymore.

   It can be saved for the user, while Find Ustaz falls
   back to area/subcity proximity until better GPS exists.

   Privacy:

   - exact coordinates are sent only to authenticated
     PATCH /api/location
   - exact coordinates are never rendered in the UI
   - exact teacher coordinates must never be returned
     by teacher discovery APIs
========================================================= */


/* =========================================================
   ENDPOINTS / STORAGE
========================================================= */

const LOCATION_ENDPOINT =
  "/location";


const LOCATION_CACHE_KEY =
  "barakalink_current_location_v2";


/* =========================================================
   ACCURACY TIERS
========================================================= */

const MIN_ACCEPTABLE_ACCURACY_METERS =
  0;


/*
 * Location may be saved up to 50 km accuracy.
 *
 * This MUST match backend:
 *
 * MAX_ACCURACY_METERS = 50000
 */
const MAX_ACCEPTABLE_ACCURACY_METERS =
  50000;


/*
 * Distance ranking should only use reasonably accurate
 * coordinates.
 *
 * This MUST match backend:
 *
 * DISTANCE_MAX_ACCURACY_METERS = 5000
 */
const RELIABLE_ACCURACY_METERS =
  5000;


/*
 * <= 500 m is considered precise.
 */
const TARGET_ACCURACY_METERS =
  500;


/* =========================================================
   TIMING
========================================================= */


/*
 * Hard maximum time for the high-accuracy browser request.
 */
const HIGH_ACCURACY_WINDOW_MS =
  15000;


/*
 * Once a usable but coarse fix arrives, give the browser
 * a smaller additional window to improve it.
 *
 * This prevents the dashboard from waiting forever.
 */
const STALL_AFTER_FIX_MS =
  7000;


/*
 * Low-accuracy fallback.
 *
 * Used only when the high-accuracy request returns no usable
 * position.
 */
const FALLBACK_TIMEOUT_MS =
  8000;


/*
 * Reuse recent browser/network location where appropriate.
 */
const FALLBACK_MAX_AGE_MS =
  5 * 60 * 1000;


/* =========================================================
   REUSE / RETRY
========================================================= */

const GOOD_RESULT_REUSE_MS =
  10 * 60 * 1000;


const COARSE_RETRY_COOLDOWN_MS =
  60 * 1000;


const MAX_COARSE_ATTEMPTS =
  3;


const FAILURE_RETRY_COOLDOWN_MS =
  30 * 1000;


/* =========================================================
   TERMINAL ERRORS
========================================================= */

const TERMINAL_ERROR_CODES =
  new Set([
    "PERMISSION_DENIED",
    "GEOLOCATION_UNAVAILABLE",
    "INSECURE_CONTEXT",
  ]);


/* =========================================================
   INTERNAL STATE
========================================================= */

let locationRequestInFlight =
  null;


let lastResult =
  null;


let coarseAttempts =
  0;


/* =========================================================
   ERRORS
========================================================= */

function makeLocationError(
  message,
  code,
  originalError = null
) {

  const error =
    new Error(
      message
    );


  error.code =
    code;


  if (
    originalError
  ) {

    error.originalError =
      originalError;

  }


  return error;

}


function mapGeolocationError(
  error
) {

  switch (
    error?.code
  ) {

    case 1:

      return makeLocationError(
        "Location permission was denied.",
        "PERMISSION_DENIED",
        error
      );


    case 2:

      return makeLocationError(
        "Your location is currently unavailable.",
        "POSITION_UNAVAILABLE",
        error
      );


    case 3:

      return makeLocationError(
        "The location request timed out.",
        "TIMEOUT",
        error
      );


    default:

      return makeLocationError(
        "We could not determine your location.",
        "GEOLOCATION_ERROR",
        error
      );

  }

}


/* =========================================================
   GEOLOCATION AVAILABILITY
========================================================= */

function isGeolocationAvailable() {

  return (
    typeof navigator !==
      "undefined" &&
    "geolocation" in
      navigator
  );

}


/* =========================================================
   COORDINATE VALIDATION
========================================================= */

function validateCoordinate(
  latitude,
  longitude
) {

  return (

    Number.isFinite(
      latitude
    ) &&

    Number.isFinite(
      longitude
    ) &&

    latitude >= -90 &&

    latitude <= 90 &&

    longitude >= -180 &&

    longitude <= 180

  );

}


/* =========================================================
   ACCURACY VALIDATION
========================================================= */

function validateAccuracy(
  accuracy
) {

  return (

    Number.isFinite(
      accuracy
    ) &&

    accuracy >
      MIN_ACCEPTABLE_ACCURACY_METERS &&

    accuracy <=
      MAX_ACCEPTABLE_ACCURACY_METERS

  );

}


/* =========================================================
   ACCURACY QUALITY
========================================================= */

function getAccuracyQuality(
  accuracy
) {

  if (
    !validateAccuracy(
      accuracy
    )
  ) {

    return "unusable";

  }


  if (
    accuracy <=
    TARGET_ACCURACY_METERS
  ) {

    return "precise";

  }


  if (
    accuracy <=
    RELIABLE_ACCURACY_METERS
  ) {

    return "approximate";

  }


  return "coarse";

}


/* =========================================================
   BROWSER POSITION NORMALIZATION
========================================================= */

function normalizeBrowserPosition(
  position
) {

  const latitude =
    Number(
      position?.coords?.latitude
    );


  const longitude =
    Number(
      position?.coords?.longitude
    );


  const accuracy =
    Number(
      position?.coords?.accuracy
    );


  /* -------------------------------------------------------
     Coordinates
  ------------------------------------------------------- */

  if (
    !validateCoordinate(
      latitude,
      longitude
    )
  ) {

    throw makeLocationError(
      "The browser returned an invalid location.",
      "INVALID_COORDINATES"
    );

  }


  /* -------------------------------------------------------
     Accuracy
  ------------------------------------------------------- */

  if (
    !Number.isFinite(
      accuracy
    ) ||
    accuracy <=
      MIN_ACCEPTABLE_ACCURACY_METERS
  ) {

    throw makeLocationError(
      "The browser returned a location without a usable accuracy value.",
      "INVALID_ACCURACY"
    );

  }


  /* -------------------------------------------------------
     Extremely poor location
  ------------------------------------------------------- */

  if (
    accuracy >
    MAX_ACCEPTABLE_ACCURACY_METERS
  ) {

    throw makeLocationError(
      `The browser could only provide a very rough location (about ${Math.round(
        accuracy / 1000
      )} km accuracy).`,
      "ACCURACY_TOO_LOW"
    );

  }


  return {

    latitude,

    longitude,

    accuracy,

    quality:
      getAccuracyQuality(
        accuracy
      ),

    capturedAt:
      new Date().toISOString(),

  };

}


/* =========================================================
   LOCATION USABILITY
========================================================= */

function isLocationUsable(
  location
) {

  return Boolean(

    location &&

    validateCoordinate(
      Number(
        location.latitude
      ),
      Number(
        location.longitude
      )
    ) &&

    validateAccuracy(
      Number(
        location.accuracy
      )
    )

  );

}


/* =========================================================
   LOCAL CACHE
========================================================= */

function readCachedLocation() {

  try {

    const raw =
      localStorage.getItem(
        LOCATION_CACHE_KEY
      );


    if (
      !raw
    ) {

      return null;

    }


    const parsed =
      JSON.parse(
        raw
      );


    const latitude =
      Number(
        parsed?.latitude
      );


    const longitude =
      Number(
        parsed?.longitude
      );


    const accuracy =
      Number(
        parsed?.accuracy
      );


    const capturedAt =
      String(
        parsed?.capturedAt ||
        ""
      );


    if (

      !validateCoordinate(
        latitude,
        longitude
      ) ||

      !validateAccuracy(
        accuracy
      ) ||

      !capturedAt

    ) {

      return null;

    }


    return {

      latitude,

      longitude,

      accuracy,

      quality:
        getAccuracyQuality(
          accuracy
        ),

      capturedAt,

    };

  } catch (
    _
  ) {

    return null;

  }

}


function cacheLocation(
  location
) {

  try {

    localStorage.setItem(
      LOCATION_CACHE_KEY,

      JSON.stringify({

        latitude:
          location.latitude,

        longitude:
          location.longitude,

        accuracy:
          location.accuracy,

        capturedAt:
          location.capturedAt,

      })
    );

  } catch (
    _
  ) {

    /*
     * Browser storage is optional.
     */

  }

}


function clearCachedLocation() {

  try {

    localStorage.removeItem(
      LOCATION_CACHE_KEY
    );

  } catch (
    _
  ) {

    /*
     * Browser storage is optional.
     */

  }

}


/* =========================================================
   HIGH-ACCURACY BROWSER ACQUISITION
========================================================= */

/*
 * Performs ONE bounded high-accuracy watch.
 *
 * It:
 *
 * - requests enableHighAccuracy
 * - keeps the best position received
 * - immediately succeeds for a <=500 m fix
 * - allows a short improvement period after a coarse fix
 * - has an absolute deadline
 * - ALWAYS clears watch/timers
 *
 * It does NOT run forever.
 */

function acquireHighAccuracyPosition() {

  return new Promise(
    (
      resolve,
      reject
    ) => {

      let watchId =
        null;


      let hardTimer =
        null;


      let stallTimer =
        null;


      let settled =
        false;


      let best =
        null;


      let bestAccuracy =
        Infinity;


      function cleanup() {

        if (
          watchId !== null
        ) {

          try {

            navigator.geolocation.clearWatch(
              watchId
            );

          } catch (
            _
          ) {

            /*
             * Nothing else required.
             */

          }


          watchId =
            null;

        }


        if (
          hardTimer !== null
        ) {

          clearTimeout(
            hardTimer
          );

          hardTimer =
            null;

        }


        if (
          stallTimer !== null
        ) {

          clearTimeout(
            stallTimer
          );

          stallTimer =
            null;

        }

      }


      function succeed(
        position
      ) {

        if (
          settled
        ) {

          return;

        }


        settled =
          true;


        cleanup();


        resolve(
          position
        );

      }


      function fail(
        error
      ) {

        if (
          settled
        ) {

          return;

        }


        settled =
          true;


        cleanup();


        reject(
          error
        );

      }


      function finishWithBestOrFail(
        error
      ) {

        if (
          best
        ) {

          succeed(
            best
          );

        } else {

          fail(
            error
          );

        }

      }


      function onFix(
        position
      ) {

        if (
          settled
        ) {

          return;

        }


        const accuracy =
          Number(
            position?.coords?.accuracy
          );


        /*
         * Ignore impossible accuracy values.
         */
        if (
          !Number.isFinite(
            accuracy
          ) ||
          accuracy <=
            MIN_ACCEPTABLE_ACCURACY_METERS
        ) {

          return;

        }


        /*
         * Only retain improvements.
         *
         * This avoids repeatedly processing the same coarse
         * Wi-Fi/IP location.
         */
        if (
          accuracy >=
          bestAccuracy
        ) {

          return;

        }


        best =
          position;


        bestAccuracy =
          accuracy;


        /*
         * Excellent fix.
         *
         * Finish immediately.
         */
        if (
          accuracy <=
          TARGET_ACCURACY_METERS
        ) {

          succeed(
            position
          );

          return;

        }


        /*
         * Usable but not yet precise.
         *
         * Give the browser a limited opportunity to improve.
         */
        if (
          stallTimer !== null
        ) {

          clearTimeout(
            stallTimer
          );

        }


        stallTimer =
          setTimeout(
            () => {

              if (
                best
              ) {

                succeed(
                  best
                );

              }

            },
            STALL_AFTER_FIX_MS
          );

      }


      function onError(
        error
      ) {

        /*
         * Permission denied will not be fixed by trying
         * another browser request.
         */
        if (
          error?.code === 1
        ) {

          fail(
            mapGeolocationError(
              error
            )
          );

          return;

        }


        /*
         * If we already have a usable position, keep it.
         */
        finishWithBestOrFail(
          mapGeolocationError(
            error
          )
        );

      }


      /*
       * Absolute deadline.
       *
       * This prevents browser geolocation from keeping the
       * dashboard blocked indefinitely.
       */
      hardTimer =
        setTimeout(
          () => {

            finishWithBestOrFail(
              makeLocationError(
                "The location request timed out.",
                "TIMEOUT"
              )
            );

          },
          HIGH_ACCURACY_WINDOW_MS
        );


      try {

        watchId =
          navigator.geolocation.watchPosition(

            onFix,

            onError,

            {

              enableHighAccuracy:
                true,

              maximumAge:
                0,

              /*
               * Browser timeout slightly exceeds our own
               * deadline. Our timer remains authoritative.
               */
              timeout:
                HIGH_ACCURACY_WINDOW_MS +
                2000,

            }

          );

      } catch (
        error
      ) {

        fail(
          makeLocationError(
            "We could not determine your location.",
            "GEOLOCATION_ERROR",
            error
          )
        );

        return;

      }


      /*
       * Defensive cleanup in case the synchronous browser
       * implementation settles immediately.
       */
      if (
        settled
      ) {

        cleanup();

      }

    }
  );

}


/* =========================================================
   LOW-ACCURACY FALLBACK
========================================================= */

/*
 * Used ONLY when high-accuracy acquisition produced
 * no position.
 *
 * It may return a Wi-Fi/network-based location such as
 * 10,000 m accuracy.
 *
 * That is accepted by normalizeBrowserPosition() up to
 * 50,000 m.
 */

function acquireLowAccuracyPosition() {

  return new Promise(
    (
      resolve,
      reject
    ) => {

      try {

        navigator.geolocation.getCurrentPosition(

          resolve,

          (
            error
          ) => {

            reject(
              mapGeolocationError(
                error
              )
            );

          },

          {

            enableHighAccuracy:
              false,

            maximumAge:
              FALLBACK_MAX_AGE_MS,

            timeout:
              FALLBACK_TIMEOUT_MS,

          }

        );

      } catch (
        error
      ) {

        reject(
          makeLocationError(
            "We could not determine your location.",
            "GEOLOCATION_ERROR",
            error
          )
        );

      }

    }
  );

}


/* =========================================================
   GET CURRENT BROWSER LOCATION
========================================================= */

async function getCurrentBrowserLocation() {

  if (
    !isGeolocationAvailable()
  ) {

    throw makeLocationError(
      "This browser does not provide geolocation.",
      "GEOLOCATION_UNAVAILABLE"
    );

  }


  /*
   * localhost is a secure context in normal browsers.
   */
  if (
    typeof window !==
      "undefined" &&
    !window.isSecureContext
  ) {

    throw makeLocationError(
      "Browser location requires a secure connection or localhost.",
      "INSECURE_CONTEXT"
    );

  }


  try {

    /*
     * First try the best location the browser can provide.
     */
    return await acquireHighAccuracyPosition();

  } catch (
    error
  ) {

    /*
     * Do not retry when the user denied permission or
     * geolocation is fundamentally unavailable.
     */
    if (
      TERMINAL_ERROR_CODES.has(
        error?.code
      )
    ) {

      throw error;

    }


    /*
     * If high accuracy produced no fix, try the network/
     * low-accuracy provider once.
     */
    return await acquireLowAccuracyPosition();

  }

}


/* =========================================================
   SERVER
========================================================= */

async function sendLocationToServer(
  location
) {

  const api =
    window.BarakaLinkAPI;


  if (
    !api ||
    typeof api.patch !==
      "function"
  ) {

    throw makeLocationError(
      "BarakaLink API is not available.",
      "API_UNAVAILABLE"
    );

  }


  let response;


  try {

    response =
      await api.patch(
        LOCATION_ENDPOINT,
        {

          latitude:
            location.latitude,

          longitude:
            location.longitude,

          accuracy:
            location.accuracy,

        }
      );

  } catch (
    error
  ) {

    const normalized =
      error instanceof Error

        ? error

        : makeLocationError(
            "Unable to update your location on the BarakaLink server.",
            "LOCATION_UPDATE_FAILED",
            error
          );


    if (
      normalized.status ===
        401 ||
      normalized.code ===
        "UNAUTHORIZED"
    ) {

      normalized.code =
        "UNAUTHORIZED";

    }


    throw normalized;

  }


  if (
    response?.success ===
      false
  ) {

    throw makeLocationError(
      response?.message ||
        "The BarakaLink server rejected the location update.",
      "LOCATION_UPDATE_FAILED"
    );

  }


  return response;

}


/* =========================================================
   ACQUIRE + SAVE ONE LOCATION
========================================================= */

/*
 * Returns an object instead of throwing for normal location
 * failures.
 *
 * Success:
 *
 * {
 *   ok: true,
 *   location,
 *   quality,
 *   serverSaved
 * }
 *
 * Failure:
 *
 * {
 *   ok: false,
 *   error,
 *   location?
 * }
 */

async function runLocationUpdate() {

  let location;


  /* -------------------------------------------------------
     Browser acquisition
  ------------------------------------------------------- */

  try {

    const browserPosition =
      await getCurrentBrowserLocation();


    location =
      normalizeBrowserPosition(
        browserPosition
      );

  } catch (
    error
  ) {

    return {

      ok:
        false,

      error,

    };

  }


  /* -------------------------------------------------------
     Backend save
  ------------------------------------------------------- */

  try {

    const response =
      await sendLocationToServer(
        location
      );


    /*
     * Only cache a location that the server accepted.
     */
    cacheLocation(
      location
    );


    return {

      ok:
        true,

      location,

      quality:
        location.quality,

      serverSaved:
        response?.data?.saved !==
        false,

    };

  } catch (
    error
  ) {

    return {

      ok:
        false,

      error,

      location,

    };

  }

}


/* =========================================================
   SIMPLE UPDATE API
========================================================= */

async function updateCurrentUserLocation() {

  const result =
    await runLocationUpdate();


  if (
    !result.ok
  ) {

    throw result.error;

  }


  return result.location;

}


/* =========================================================
   RESULT REUSE
========================================================= */

function getReusableResult(
  now
) {

  if (
    !lastResult
  ) {

    return null;

  }


  const age =
    now -
    lastResult.finishedAt;


  /* -------------------------------------------------------
     Successful result
  ------------------------------------------------------- */

  if (
    lastResult.ok
  ) {

    /*
     * Precise / approximate result:
     * reuse for 10 minutes.
     */
    if (
      lastResult.quality !==
        "coarse"
    ) {

      return (
        age <
          GOOD_RESULT_REUSE_MS

          ? lastResult

          : null
      );

    }


    /*
     * Coarse result:
     *
     * Do not hammer browser geolocation.
     */
    if (
      age <
        COARSE_RETRY_COOLDOWN_MS
    ) {

      return lastResult;

    }


    /*
     * Limited number of coarse retries.
     */
    if (
      coarseAttempts <
        MAX_COARSE_ATTEMPTS
    ) {

      return null;

    }


    return (
      age <
        GOOD_RESULT_REUSE_MS

        ? lastResult

        : null
    );

  }


  /* -------------------------------------------------------
     Terminal error
  ------------------------------------------------------- */

  if (
    TERMINAL_ERROR_CODES.has(
      lastResult.error?.code
    )
  ) {

    return lastResult;

  }


  /* -------------------------------------------------------
     Temporary failure
  ------------------------------------------------------- */

  return (
    age <
      FAILURE_RETRY_COOLDOWN_MS

      ? lastResult

      : null
  );

}


/* =========================================================
   LOCATION REQUEST
========================================================= */

function requestLocation() {

  /*
   * Never run two geolocation requests at the same time.
   */
  if (
    locationRequestInFlight
  ) {

    return locationRequestInFlight;

  }


  /*
   * Reuse a recent result when possible.
   */
  const reusable =
    getReusableResult(
      Date.now()
    );


  if (
    reusable
  ) {

    return Promise.resolve(
      reusable
    );

  }


  locationRequestInFlight =
    runLocationUpdate()

      .then(
        (
          result
        ) => {

          const finished = {

            ...result,

            finishedAt:
              Date.now(),

          };


          /*
           * Track coarse attempts.
           */
          if (
            finished.ok &&
            finished.quality ===
              "coarse"
          ) {

            coarseAttempts +=
              1;

          } else {

            coarseAttempts =
              0;

          }


          lastResult =
            finished;


          return finished;

        }
      )

      .catch(
        (
          error
        ) => {

          /*
           * Defensive fallback.
           */
          const finished = {

            ok:
              false,

            error,

            finishedAt:
              Date.now(),

          };


          coarseAttempts =
            0;


          lastResult =
            finished;


          return finished;

        }
      )

      .finally(
        () => {

          locationRequestInFlight =
            null;

        }
      );


  return locationRequestInFlight;

}


/* =========================================================
   PUBLIC API
========================================================= */

/*
 * Called during dashboard initialization.
 *
 * Important:
 * The caller should NOT make the entire dashboard depend
 * on this result.
 */
async function initializeCurrentUserLocation() {

  return requestLocation();

}


/*
 * Called when Find Ustaz needs a fresh location.
 */
async function refreshCurrentUserLocation() {

  return requestLocation();

}


/*
 * Last location result for UI / debugging logic.
 */
function getLastLocationResult() {

  return lastResult;

}


/* =========================================================
   EXPORTS
========================================================= */

export {

  LOCATION_ENDPOINT,

  LOCATION_CACHE_KEY,

  MAX_ACCEPTABLE_ACCURACY_METERS,

  RELIABLE_ACCURACY_METERS,

  TARGET_ACCURACY_METERS,

  validateCoordinate,

  validateAccuracy,

  getAccuracyQuality,

  normalizeBrowserPosition,

  readCachedLocation,

  cacheLocation,

  clearCachedLocation,

  getCurrentBrowserLocation,

  sendLocationToServer,

  updateCurrentUserLocation,

  initializeCurrentUserLocation,

  refreshCurrentUserLocation,

  getLastLocationResult,

  isLocationUsable,

};