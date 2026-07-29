const cron = require("node-cron");
const db = require("../db");


// Runs every day at 9 AM
// TEST: "*/1 * * * *"
cron.schedule("0 9 * * *", async()=>{


try{


console.log("Checking follow-up reminders...");



const result = await db.query(`

SELECT *

FROM notifications

WHERE 
notification_date = CURRENT_DATE

AND
status = 'pending'

`);




console.log(
`Today's Follow-ups Found: ${result.rowCount}`
);



for(const item of result.rows){


console.log(
"Follow-up Patient:",
item.patient_name
);


// Here we will add:
// 1. Android push notification
// 2. Web push notification



await db.query(

`

UPDATE notifications

SET 
status = 'sent'

WHERE id=$1

`,

[
item.id
]

);



}



}
catch(error){

console.log(
"Follow-up Reminder Cron Error:",
error
);


}


});