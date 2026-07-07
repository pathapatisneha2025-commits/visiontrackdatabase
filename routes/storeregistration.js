const express = require("express");
const router = express.Router();

const pool = require("../db");



// ======================================
// PAYMENT SUCCESS + STORE CREATION API
// ======================================

router.post("/payment-success", async(req,res)=>{


try{


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

payment.razorpay_payment_id || payment.transaction_id

]


);



res.json({

success:true,

storeId:result.rows[0].id

});


}

catch(error){


console.log(error);


res.status(500).json({

success:false,

message:"Store creation failed"

});


}


});




// ======================================
// GET ALL STORES
// ======================================

router.get("/stores", async(req,res)=>{


try{


const result = await pool.query(

`
SELECT *
FROM stores
ORDER BY id DESC
`

);



res.json({

success:true,

data:result.rows

});


}

catch(error){


console.log(error);


res.status(500).json({

success:false,

message:"Failed to fetch stores"

});


}


});




module.exports = router;