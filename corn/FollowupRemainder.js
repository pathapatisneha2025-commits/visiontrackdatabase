const cron = require("node-cron");
const db = require("../db");

const sendPushNotification =
require("../utils/sendNotifcation");



cron.schedule("* * * * *", async()=>{


try{


console.log(
"Checking today's followups..."
);



const result = await db.query(`

SELECT *

FROM notifications

WHERE

notification_date::date = CURRENT_DATE

AND

status='pending'

`);




console.log(
"FOLLOWUPS FOUND:",
result.rowCount
);



for(const item of result.rows){



// get store token

const tokenResult =
await db.query(

`

SELECT expo_token

FROM store_push_tokens

WHERE store_code=$1

`,

[
item.store_code
]

);



for(const tokenRow of tokenResult.rows){



await sendPushNotification(

tokenRow.expo_token,


item.title,


`${item.patient_name} - ${item.message}`,

{
notificationId:item.id,
patientId:item.patient_id
}

);


}



// update status

await db.query(

`

UPDATE notifications

SET status='sent'

WHERE id=$1

`,

[
item.id
]

);



console.log(
"Notification completed:",
item.patient_name
);



}



}
catch(error){

console.log(
"CRON ERROR:",
error
);


}


});