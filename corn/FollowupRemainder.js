const cron = require("node-cron");
const db = require("../db");

const sendPushNotification =
  require("../utils/sendNotifcation");


/*
============================================================
FOLLOW-UP NOTIFICATION CRON
============================================================

ONLY SEND WHEN:

notification_date = CURRENT_DATE
AND
status = pending

Example:

Today = 2026-08-25

2026-08-25 + pending -> SEND
2026-08-24 + pending -> DO NOT SEND
2026-08-26 + pending -> DO NOT SEND
2026-09-15 + pending -> DO NOT SEND
2027-08-10 + pending -> DO NOT SEND
2026-08-09 + sent    -> DO NOT SEND

============================================================
*/


cron.schedule("* * * * *", async () => {

  console.log(
    "=========================================="
  );

  console.log(
    "FOLLOW-UP CRON STARTED"
  );

  try {

    /*
    ==========================================================
    GET DATABASE CURRENT DATE
    ==========================================================
    */

    const dateResult = await db.query(`
      SELECT
        CURRENT_DATE AS today,
        CURRENT_TIMESTAMP AS current_time
    `);

    const today =
      dateResult.rows[0].today;

    const currentTime =
      dateResult.rows[0].current_time;


    console.log(
      "DATABASE TODAY:",
      today
    );

    console.log(
      "DATABASE TIME:",
      currentTime
    );


    /*
    ==========================================================
    VERY IMPORTANT

    ONLY FETCH:

    notification_date = TODAY
    status = pending

    Nothing else can enter this result.
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

      ORDER BY id ASC

    `);


    console.log(
      "TODAY'S NOTIFICATIONS FOUND:",
      result.rows.length
    );


    /*
    ==========================================================
    SHOW EXACTLY WHAT WILL BE SENT
    ==========================================================
    */

    for (
      const item of result.rows
    ) {

      console.log(
        "WILL SEND:",
        {
          id: item.id,
          patient: item.patient_name,
          notification_date: item.notification_date,
          status: item.status
        }
      );

    }


    /*
    ==========================================================
    NOTHING TO SEND
    ==========================================================
    */

    if (
      result.rows.length === 0
    ) {

      console.log(
        "NO FOLLOW-UP NOTIFICATIONS FOR TODAY"
      );

      return;

    }


    /*
    ==========================================================
    SEND TODAY'S NOTIFICATIONS
    ==========================================================
    */

    for (
      const item of result.rows
    ) {

      console.log(
        "------------------------------------------"
      );

      console.log(
        "PROCESSING ID:",
        item.id
      );

      console.log(
        "PATIENT:",
        item.patient_name
      );

      console.log(
        "DATE:",
        item.notification_date
      );

      console.log(
        "STATUS:",
        item.status
      );


      /*
      ========================================================
      EXTRA DATABASE-SIDE SAFETY CHECK

      This notification MUST still be:

      TODAY
      AND
      PENDING
      ========================================================
      */

      const verifyResult = await db.query(

        `

        SELECT id

        FROM notifications

        WHERE
          id = $1

          AND notification_date IS NOT NULL

          AND notification_date::date = CURRENT_DATE

          AND status = 'pending'

        `,

        [
          item.id
        ]

      );


      /*
      ========================================================
      IF VERIFICATION FAILS

      DO NOT SEND
      ========================================================
      */

      if (
        verifyResult.rows.length === 0
      ) {

        console.log(
          "SAFETY CHECK FAILED - NOT SENDING:",
          item.id
        );

        continue;

      }


      /*
      ========================================================
      GET STORE TOKENS
      ========================================================
      */

      const tokenResult =
        await db.query(

          `

          SELECT expo_token

          FROM store_push_tokens

          WHERE
            store_code = $1

          `,

          [
            item.store_code
          ]

        );


      if (
        tokenResult.rows.length === 0
      ) {

        console.log(
          "NO EXPO TOKEN:",
          item.store_code
        );

        continue;

      }


      let notificationSent =
        false;


      /*
      ========================================================
      SEND PUSH
      ========================================================
      */

      for (
        const tokenRow
        of tokenResult.rows
      ) {

        if (
          !tokenRow.expo_token
        ) {

          continue;

        }


        try {

          console.log(
            "SENDING PUSH:",
            item.id,
            item.patient_name
          );


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
            "PUSH SUCCESS:",
            item.id
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
      MARK SENT

      AGAIN CHECK:

      ID
      TODAY
      PENDING

      ========================================================
      */

      if (
        notificationSent
      ) {

        const updateResult =
          await db.query(

            `

            UPDATE notifications

            SET
              status = 'sent'

            WHERE
              id = $1

              AND notification_date IS NOT NULL

              AND notification_date::date = CURRENT_DATE

              AND status = 'pending'

            RETURNING id, status

            `,

            [
              item.id
            ]

          );


        if (
          updateResult.rows.length > 0
        ) {

          console.log(
            "MARKED SENT:",
            item.id
          );

        } else {

          console.log(
            "NOT MARKED - SAFETY CONDITION FAILED:",
            item.id
          );

        }

      }

    }


  } catch (
    error
  ) {

    console.log(
      "FOLLOW-UP CRON ERROR:",
      error
    );

  }


  console.log(
    "FOLLOW-UP CRON FINISHED"
  );

  console.log(
    "=========================================="
  );

});