const express = require("express");
const router = express.Router();

const crypto = require("crypto");
const pool = require("../db");



// ======================================
// PAYMENT SUCCESS + STORE CREATION API
// ======================================

router.post("/payment-success",async(req,res)=>{


const {
storeData,
plan,
payment
}=req.body;



const result=await pool.query(

`
INSERT INTO stores
(
store_name,
owner_name,
email,
mobile,
plan_name,
amount,
subscription_status,
razorpay_payment_id
)

VALUES
($1,$2,$3,$4,$5,$6,$7,$8)

RETURNING id
`,

[

storeData.storeName,

storeData.ownerName,

storeData.email,

storeData.mobile,

plan.name,

plan.price,

"ACTIVE",

payment.razorpay_payment_id

]


);



res.json({

success:true,

storeId:result.rows[0].id

});


});



module.exports = router;