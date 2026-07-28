const cron = require("node-cron");
const db = require("../db"); // your postgres connection


// TEST: Runs every minute
// Production: change to "0 0 * * *"
cron.schedule("0 0 * * *", async()=>{


try{


console.log("Checking expired subscriptions...");



const result = await db.query(`

UPDATE stores

SET 
subscription_status = 'DEACTIVATED'

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