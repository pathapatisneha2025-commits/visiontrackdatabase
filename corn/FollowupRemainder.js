const cron = require("node-cron");
const db = require("../db");


cron.schedule("* * * * *", async()=>{

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
"Today's Follow-ups:",
result.rowCount
);


// ❌ Do not update sent here
// Phone app will handle notification


for(const item of result.rows){

console.log(
"Pending Followup:",
item.patient_name
);


}


}
catch(error){

console.log(
"Follow-up Cron Error:",
error
);

}

});