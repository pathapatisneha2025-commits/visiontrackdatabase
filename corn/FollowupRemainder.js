const cron = require("node-cron");
const db = require("../db");

const sendPushNotification =
  require("../utils/sendNotifcation");


/*
============================================================
FOLLOW-UP NOTIFICATION CRON

Runs every minute.

RULES:

1. notification_date = TODAY
   AND status = pending
   -> SEND

2. notification_date = TODAY
   AND status = sent
   -> DO NOT SEND

3. notification_date < TODAY
   -> DO NOT SEND

4. notification_date > TODAY
   -> DO NOT SEND

5. If push fails
   -> status remains pending
   -> next minute it tries again

6. If push succeeds
   -> status becomes sent
   -> no more notifications
============================================================
*/


cron.schedule("* * * * *", async () => {

  try {

    console.log(
      "========================================"
    );

    console.log(
      "FOLLOW-UP NOTIFICATION CRON RUNNING"
    );


    /*
    ==========================================================
    GET ONLY:

    notification_date = TODAY
    status = pending
    ==========================================================
    */

    const result = await db.query(`

      SELECT *

      FROM notifications

      WHERE
        notification_date IS NOT NULL

        AND notification_date::date = CURRENT_DATE

        AND status = 'pending'

      ORDER BY notification_date ASC

    `);


    console.log(
      "Today's pending notifications:",
      result.rowCount
    );


    /*
    ==========================================================
    NOTHING TO SEND
    ==========================================================
    */

    if (result.rows.length === 0) {

      console.log(
        "No pending notifications for today."
      );

      console.log(
        "========================================"
      );

      return;

    }


    /*
    ==========================================================
    PROCESS NOTIFICATIONS
    ==========================================================
    */

    for (const item of result.rows) {

      try {

        console.log(
          "----------------------------------------"
        );

        console.log(
          "Notification ID:",
          item.id
        );

        console.log(
          "Patient:",
          item.patient_name
        );

        console.log(
          "Notification Date:",
          item.notification_date
        );

        console.log(
          "Status:",
          item.status
        );


        /*
        ========================================================
        EXTRA DATE SAFETY CHECK

        ONLY TODAY IS ALLOWED
        ========================================================
        */

        const dateCheck = await db.query(`

          SELECT
            id

          FROM notifications

          WHERE
            id = $1

            AND notification_date IS NOT NULL

            AND notification_date::date = CURRENT_DATE

            AND status = 'pending'

        `, [
          item.id
        ]);


        /*
        ========================================================
        IF DATE IS NOT TODAY OR STATUS CHANGED
        ========================================================
        */

        if (dateCheck.rows.length === 0) {

          console.log(
            "Skipped - notification is no longer eligible:",
            item.patient_name
          );

          continue;

        }


        /*
        ========================================================
        GET STORE EXPO TOKENS
        ========================================================
        */

        const tokenResult =
          await db.query(`

            SELECT expo_token

            FROM store_push_tokens

            WHERE store_code = $1

          `, [
            item.store_code
          ]);


        /*
        ========================================================
        NO TOKEN
        ========================================================
        */

        if (tokenResult.rows.length === 0) {

          console.log(
            "No Expo token found for store:",
            item.store_code
          );

          /*
          Keep status pending.
          Next minute cron will try again.
          */

          continue;

        }


        /*
        ========================================================
        TRACK WHETHER PUSH WAS SUCCESSFUL
        ========================================================
        */

        let notificationSent = false;


        /*
        ========================================================
        SEND TO ALL STORE TOKENS
        ========================================================
        */

        for (
          const tokenRow of tokenResult.rows
        ) {

          if (!tokenRow.expo_token) {

            continue;

          }


          try {

            await sendPushNotification(

              tokenRow.expo_token,

              item.title,

              `${item.patient_name} - ${item.message}`,

              {
                notificationId:
                  item.id,

                patientId:
                  item.patient_id
              }

            );


            notificationSent = true;


            console.log(
              "Push notification sent successfully:",
              item.patient_name
            );


          } catch (pushError) {

            console.log(
              "PUSH ERROR:",
              pushError
            );

          }

        }


        /*
        ========================================================
        IF PUSH SUCCESSFUL

        CHANGE:

        pending -> sent

        After this, cron will NOT send it again.
        ========================================================
        */

        if (notificationSent) {

          await db.query(`

            UPDATE notifications

            SET status = 'sent'

            WHERE
              id = $1

              AND status = 'pending'

              AND notification_date IS NOT NULL

              AND notification_date::date = CURRENT_DATE

          `, [
            item.id
          ]);


          console.log(
            "Notification marked as SENT:",
            item.patient_name
          );

        } else {

          /*
          ======================================================
          PUSH FAILED

          Keep status = pending.

          Next cron run will try again.
          ======================================================
          */

          console.log(
            "Push failed. Keeping status as pending:",
            item.patient_name
          );

        }


      } catch (notificationError) {

        console.log(
          "NOTIFICATION ERROR:",
          notificationError
        );

      }

    }


    console.log(
      "========================================"
    );


  } catch (error) {

    console.log(
      "CRON ERROR:",
      error
    );

  }

});