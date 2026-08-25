const cron = require("node-cron");
const db = require("../db");

const sendPushNotification =
  require("../utils/sendNotifcation");


/*
============================================================
FOLLOW-UP NOTIFICATION CRON

Runs every minute.

RULE:

1. notification_date = TODAY
   AND status = pending
   -> SEND

2. notification_date < TODAY
   AND status = pending
   -> DO NOT SEND

3. notification_date > TODAY
   AND status = pending
   -> DO NOT SEND

4. After successful push
   -> status = sent
============================================================
*/

cron.schedule("* * * * *", async () => {

  try {

    /*
    ==========================================================
    GET TODAY FROM DATABASE
    ==========================================================
    */

    const dateResult = await db.query(`
      SELECT CURRENT_DATE AS today
    `);

    const today =
      dateResult.rows[0].today;

    console.log(
      "========================================"
    );

    console.log(
      "FOLLOW-UP CRON RUNNING"
    );

    console.log(
      "Today's database date:",
      today
    );


    /*
    ==========================================================
    GET ONLY TODAY'S PENDING NOTIFICATIONS

    IMPORTANT:

    notification_date::date = CURRENT_DATE

    This means:

    2026-08-25 -> SEND

    2026-08-24 -> DO NOT SEND

    2026-08-26 -> DO NOT SEND

    And status must be pending.
    ==========================================================
    */

    const result = await db.query(`

      SELECT
        id,
        store_code,
        patient_id,
        patient_name,
        title,
        message,
        notification_date,
        status

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
    IF NOTHING TO SEND
    ==========================================================
    */

    if (result.rows.length === 0) {

      console.log(
        "No notifications scheduled for today."
      );

      console.log(
        "========================================"
      );

      return;

    }


    /*
    ==========================================================
    PROCESS EACH NOTIFICATION
    ==========================================================
    */

    for (
      const item of result.rows
    ) {

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
          "Notification date:",
          item.notification_date
        );

        console.log(
          "Status:",
          item.status
        );


        /*
        ========================================================
        EXTRA SAFETY CHECK

        Even though SQL already checks the date,
        check it again before sending.

        This guarantees that an old notification
        can NEVER accidentally be sent.
        ========================================================
        */

        const notificationDate =
          new Date(item.notification_date);

        const currentDate =
          new Date(today);


        notificationDate.setHours(
          0,
          0,
          0,
          0
        );

        currentDate.setHours(
          0,
          0,
          0,
          0
        );


        /*
        ========================================================
        NOT TODAY

        DO NOT SEND
        ========================================================
        */

        if (
          notificationDate.getTime() !==
          currentDate.getTime()
        ) {

          console.log(
            "SKIPPED - Notification date is not today:",
            item.notification_date
          );

          continue;

        }


        /*
        ========================================================
        STATUS CHECK
        ========================================================
        */

        if (
          item.status !== "pending"
        ) {

          console.log(
            "SKIPPED - Notification already processed:",
            item.status
          );

          continue;

        }


        /*
        ========================================================
        GET STORE EXPO TOKENS
        ========================================================
        */

        const tokenResult =
          await db.query(

            `

            SELECT expo_token

            FROM store_push_tokens

            WHERE store_code = $1

            `,

            [
              item.store_code
            ]

          );


        /*
        ========================================================
        NO TOKEN
        ========================================================
        */

        if (
          tokenResult.rows.length === 0
        ) {

          console.log(
            "No Expo token found for store:",
            item.store_code
          );

          continue;

        }


        /*
        ========================================================
        SEND TO ALL STORE TOKENS
        ========================================================
        */

        let notificationSent =
          false;


        for (
          const tokenRow
          of tokenResult.rows
        ) {

          if (
            !tokenRow.expo_token
          ) {

            console.log(
              "Empty Expo token - skipped"
            );

            continue;

          }


          try {

            /*
            ====================================================
            SEND PUSH
            ====================================================
            */

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


            notificationSent =
              true;


            console.log(
              "Push notification sent:",
              item.patient_name
            );


          } catch (
            pushError
          ) {

            console.log(
              "PUSH ERROR:",
              pushError
            );

          }

        }


        /*
        ========================================================
        MARK AS SENT ONLY IF PUSH WAS SUCCESSFUL
        ========================================================
        */

        if (
          notificationSent
        ) {

          await db.query(

            `

            UPDATE notifications

            SET
              status = 'sent'

            WHERE
              id = $1

              AND status = 'pending'

              AND notification_date::date = CURRENT_DATE

            `,

            [
              item.id
            ]

          );


          console.log(
            "Notification marked as SENT:",
            item.patient_name
          );

        } else {

          console.log(
            "Notification was not sent. Keeping status as pending."
          );

        }

      } catch (
        notificationError
      ) {

        console.log(
          "NOTIFICATION ERROR:",
          notificationError
        );

      }

    }


    console.log(
      "========================================"
    );


  } catch (
    error
  ) {

    console.log(
      "CRON ERROR:",
      error
    );

  }

});