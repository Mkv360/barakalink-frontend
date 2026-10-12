'use strict';

/* =========================================================
   BARAKALINK STUDENT DASHBOARD ISLAMIC CONTENT
========================================================= */

import { $$ } from './student-core.js';
import { safeString } from './student-utils.js';
import { showSection } from './student-navigation.js';
import { state } from './student-state.js';

export function setupContentCards() {

  $$('.student-content-card')
    .forEach(
      card => {

        card.addEventListener(
          'click',
          () => {

            const topic =
              safeString(
                card.dataset.topic
              );


            /*
             * There is no content API contract supplied yet.
             * Keep the topic selectable without inventing
             * a content URL.
            */

            console.info(
              '[student.js] Islamic content topic selected:',
              topic
            );

          }
        );

      }
    );

}
