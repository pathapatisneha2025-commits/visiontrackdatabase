const cron = require("node-cron");
const db = require("../db"); // your postgres connection


// Runs every day at 12:00 AM
cron.schedule("0 0 * * *", async()=>{


try{


console.log("Checking expired subscriptions...");



const result = await db.query(`

UPDATE stores

SET 
subscription_status = 'INACTIVE'

WHERE 
expiry_date < NOW()

AND
subscription_status = 'ACTIVE'

`);




console.log(
`Expired subscriptions deactivated: ${result.rowCount}`
);



}
catch(error){

console.log(
"Subscription Cron Error:",
error
);


}



});