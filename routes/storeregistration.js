const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");

const pool = require("../db");



// ======================================
// PAYMENT SUCCESS + STORE CREATION API
// ======================================
router.post("/payment-success", async (req, res) => {

try {


const {
  storeData,
  plan,
  payment
} = req.body;



// Encrypt password

const hashedPassword = await bcrypt.hash(
  storeData.password,
  10
);



// Insert Store

const result = await pool.query(

`
INSERT INTO stores
(
store_name,
owner_name,
email,
mobile,
password,
plan_name,
amount,
subscription_status,
razorpay_payment_id
)

VALUES
($1,$2,$3,$4,$5,$6,$7,$8,$9)

RETURNING id

`,

[


storeData.storeName,

storeData.ownerName,

storeData.email,

storeData.mobile,

hashedPassword,

plan.name,

plan.price,

"ACTIVE",

payment.razorpay_payment_id || payment.transaction_id


]


);





// Generate Store Code

const storeId = result.rows[0].id;


const storeCode = 
"STORE" + String(storeId).padStart(3,"0");





// Update Store Code

await pool.query(

`
UPDATE stores
SET store_code=$1
WHERE id=$2
`,

[

storeCode,

storeId

]


);






res.json({

success:true,

storeId:storeId,

storeCode:storeCode,

message:"Store created successfully"

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