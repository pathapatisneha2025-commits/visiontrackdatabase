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



// Calculate Expiry Date

const expiryDate = new Date();

expiryDate.setDate(
  expiryDate.getDate() + (plan.durationDays || 30)
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
razorpay_payment_id,
expiry_date
)

VALUES
($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)

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

"PENDING",

payment.razorpay_payment_id || payment.transaction_id,

expiryDate

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







// ===============================
// INSERT PAYMENT HISTORY
// ===============================


await pool.query(

`
INSERT INTO subscription_payments
(
store_code,
invoice_no,
transaction_id,
payment_method,
amount,
plan_name,
payment_status
)

VALUES
($1,$2,$3,$4,$5,$6,$7)

`,

[


storeCode,


"INV-"+Date.now(),


payment.razorpay_payment_id || payment.transaction_id,


payment.method || "UPI",


plan.price,


plan.name,


"SUCCESS"


]

);







res.json({

success:true,

storeId:storeId,

storeCode:storeCode,

expiryDate:expiryDate,

message:"Store created successfully"

});






}

catch(error){


console.log("Payment Success Error:",error);



res.status(500).json({

success:false,

message:"Store creation failed"

});


}


});

router.post("/login", async(req,res)=>{

try{


const {
email,
password
}=req.body;



// FIND STORE BY EMAIL

const result = await pool.query(

`
SELECT *
FROM stores
WHERE email=$1
AND subscription_status='ACTIVE'
`,

[
email
]

);



if(result.rows.length===0){

return res.status(401).json({

success:false,
message:"Email not registered"

});

}



const store = result.rows[0];




// CHECK PASSWORD

const passwordMatch = await bcrypt.compare(

password,

store.password

);



if(!passwordMatch){

return res.status(401).json({

success:false,
message:"Invalid password"

});

}




// LOGIN SUCCESS RESPONSE

res.json({

success:true,

message:"Login successful",


store:{

id:store.id,

storeCode:store.store_code,

storeName:store.store_name,

ownerName:store.owner_name,

email:store.email

}


});



}

catch(error){

console.log("Login Error:",error);


res.status(500).json({

success:false,

message:"Login failed"

});


}


});


// ======================================
// GET ALL STORES
// ======================================

router.get("/stores", async(req,res)=>{

try{

const {storeCode}=req.query;


let result;


if(storeCode){

result = await pool.query(
`
SELECT *
FROM stores
WHERE store_code=$1
`,
[
storeCode
]
);


}else{


result = await pool.query(
`
SELECT *
FROM stores
ORDER BY id DESC
`
);


}



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


// ======================================
// GET PAYMENT HISTORY BY STORE CODE
// ======================================

router.get("/payment-history", async(req,res)=>{

try{


const {storeCode}=req.query;



if(!storeCode){

return res.status(400).json({

success:false,

message:"Store code required"

});

}




const result = await pool.query(

`
SELECT
id,
store_code,
invoice_no,
transaction_id,
payment_method,
amount,
plan_name,
payment_status,
created_at

FROM subscription_payments

WHERE store_code=$1

ORDER BY created_at DESC

`,

[

storeCode

]

);





res.json({

success:true,

data:result.rows

});



}

catch(error){


console.log("Payment History Error:",error);



res.status(500).json({

success:false,

message:"Failed to fetch payment history"

});


}


});


// ======================================
// SIMPLE SUBSCRIPTION RENEWAL
// ======================================

router.post("/renew-subscription", async(req,res)=>{

try{

const {
storeCode
}=req.body;


// Find store

const storeResult = await pool.query(
`
SELECT *
FROM stores
WHERE store_code=$1
`,
[
storeCode
]
);



if(storeResult.rows.length===0){

return res.json({

success:false,

message:"Store not found"

});

}



const store = storeResult.rows[0];



// Calculate new expiry

let expiryDate = new Date(store.expiry_date);


// If expired, start from today

if(expiryDate < new Date()){

expiryDate = new Date();

}


// Add 30 days

expiryDate.setDate(
expiryDate.getDate()+30
);




// Update store

await pool.query(

`
UPDATE stores

SET
subscription_status='ACTIVE',
expiry_date=$1

WHERE store_code=$2

`,

[
expiryDate,
storeCode
]

);




// Insert payment history

await pool.query(

`
INSERT INTO subscription_payments
(
store_code,
invoice_no,
transaction_id,
payment_method,
amount,
plan_name,
payment_status
)

VALUES
($1,$2,$3,$4,$5,$6,$7)

`,

[

storeCode,

"INV-"+Date.now(),

"MANUAL_RENEW",

"OFFLINE",

store.amount,

store.plan_name,

"SUCCESS"

]

);



res.json({

success:true,

message:"Subscription renewed successfully",

expiryDate

});


}

catch(error){

console.log("Renew Error:",error);


res.status(500).json({

success:false,

message:"Renewal failed"

});


}


});
// ======================================
// APPROVE SUBSCRIPTION
// ======================================

router.put("/approve-subscription/:id", async(req,res)=>{

try{


const {id}=req.params;



const result = await pool.query(

`
UPDATE stores

SET
subscription_status='ACTIVE',
updated_at=NOW()

WHERE id=$1

RETURNING *

`,

[
id
]

);



if(result.rows.length===0){

return res.status(404).json({

success:false,

message:"Store not found"

});

}




res.json({

success:true,

message:"Subscription approved successfully",

data:result.rows[0]

});



}

catch(error){

console.log("Approve Subscription Error:",error);


res.status(500).json({

success:false,

message:"Approval failed"

});


}

});
// ======================================
// REJECT SUBSCRIPTION
// ======================================

router.put("/reject-subscription/:id", async(req,res)=>{

try{


const {id}=req.params;



const result = await pool.query(

`
UPDATE stores

SET
subscription_status='REJECTED',
updated_at=NOW()

WHERE id=$1

RETURNING *

`,

[
id
]

);



if(result.rows.length===0){

return res.status(404).json({

success:false,

message:"Store not found"

});

}




res.json({

success:true,

message:"Subscription rejected",

data:result.rows[0]

});



}

catch(error){


console.log("Reject Subscription Error:",error);


res.status(500).json({

success:false,

message:"Rejection failed"

});


}

});
module.exports = router;