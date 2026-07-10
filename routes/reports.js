const express = require("express");
const router = express.Router();

const pool = require("../db");



/*
================================================
SALES REPORT
POST /reports/sales
================================================
*/

router.post("/sales", async(req,res)=>{

try{


const {

storeCode,
fromDate,
toDate,
customer,
lensType,
status

}=req.body;



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

order_no,

order_date,

expected_delivery,


patient_id,

patient_name,

mobile,

age,

gender,


frame_barcode,

frame_model,


lens_type,


prescription_notes,


total_amount,

advance_paid,

balance_amount,


status,

payment_status


FROM optical_orders


WHERE store_code=$1



AND

(

$2=''

OR

order_date >= TO_DATE($2,'DD-MM-YYYY')

)



AND

(

$3=''

OR

order_date <= TO_DATE($3,'DD-MM-YYYY')

)



AND

(

$4=''

OR

patient_name ILIKE '%'||$4||'%'

)



AND

(

$5=''

OR

lens_type ILIKE '%'||$5||'%'

)



AND

(

$6=''

OR

status ILIKE '%'||$6||'%'

)



ORDER BY order_date DESC


`,

[

storeCode,

fromDate || "",

toDate || "",

customer || "",

lensType || "",

status || ""

]


);



res.json({

success:true,

count:result.rows.length,

data:result.rows

});


}


catch(error){

console.log(error);


res.status(500).json({

success:false,

message:"Sales report error",

error:error.message

});


}


});









/*
================================================
DAILY SALES SUMMARY
GET /reports/summary/:storeCode
================================================
*/


router.get("/summary/:storeCode",async(req,res)=>{


try{


const {storeCode}=req.params;



const result=await pool.query(

`

SELECT


COUNT(*) AS total_orders,


COALESCE(
SUM(total_amount),
0
) AS total_sales,


COALESCE(
SUM(advance_paid),
0
) AS total_received,


COALESCE(
SUM(balance_amount),
0
) AS balance_due,


COUNT(*) FILTER
(
WHERE status='Pending'
)
AS pending_orders



FROM optical_orders


WHERE store_code=$1


AND DATE(order_date)=CURRENT_DATE



`,

[storeCode]


);



res.json({

success:true,

data:result.rows[0]

});


}

catch(error){

console.log(error);


res.status(500).json({

success:false,

message:"Summary error"

});


}


});









/*
================================================
CUSTOMER REPORT
POST /reports/customer
================================================
*/


router.post("/customer",async(req,res)=>{


try{


const {

storeCode,

customer

}=req.body;



const result=await pool.query(

`

SELECT


patient_name,


mobile,


COUNT(*) AS total_orders,


COALESCE(
SUM(total_amount),
0
) AS total_purchase,


COALESCE(
SUM(balance_amount),
0
) AS pending_amount



FROM optical_orders



WHERE store_code=$1



AND

(

$2=''

OR

patient_name ILIKE '%'||$2||'%'

)



GROUP BY

patient_name,

mobile



ORDER BY total_purchase DESC



`,

[

storeCode,

customer || ""

]


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

message:"Customer report error"

});


}


});









/*
================================================
PENDING ORDERS
GET /reports/pending/:storeCode
================================================
*/


router.get("/pending/:storeCode",async(req,res)=>{


try{


const {

storeCode

}=req.params;



const result=await pool.query(

`

SELECT


id,

order_no,

order_date,


patient_name,

mobile,


lens_type,


total_amount,


advance_paid,


balance_amount,


expected_delivery,


status,


payment_status



FROM optical_orders



WHERE store_code=$1



AND status='Pending'



ORDER BY order_date DESC


`,

[storeCode]


);



res.json({

success:true,

count:result.rows.length,

data:result.rows

});


}


catch(error){

console.log(error);


res.status(500).json({

success:false,

message:"Pending orders error"

});


}


});









/*
================================================
STOCK REPORT
GET /reports/stock/:storeCode
================================================
*/


router.get("/stock/:storeCode",async(req,res)=>{


try{


const {

storeCode

}=req.params;



const result=await pool.query(

`

SELECT


id,

barcode,

brand,

frame_name,

model,

color,

size,

purchase_price,

selling_price,

supplier,

quantity,

rack_location



FROM optical_stock



WHERE store_code=$1



ORDER BY id DESC


`,

[storeCode]


);



res.json({

success:true,

count:result.rows.length,

data:result.rows

});


}


catch(error){

console.log(error);


res.status(500).json({

success:false,

message:"Stock report error"

});


}


});









/*
================================================
MONTHLY SALES REPORT
GET /reports/monthly/:storeCode
================================================
*/


router.get("/monthly/:storeCode",async(req,res)=>{


try{


const {

storeCode

}=req.params;



const result=await pool.query(

`

SELECT


TO_CHAR(
order_date,
'Mon YYYY'
)
AS month,



COUNT(*) AS total_orders,



COALESCE(
SUM(total_amount),
0
)
AS total_sales,



COALESCE(
SUM(advance_paid),
0
)
AS received,



COALESCE(
SUM(balance_amount),
0
)
AS pending



FROM optical_orders



WHERE store_code=$1



GROUP BY


TO_CHAR(
order_date,
'Mon YYYY'
),


DATE_TRUNC(
'month',
order_date
)



ORDER BY


DATE_TRUNC(
'month',
order_date
)
DESC



`,

[storeCode]


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

message:"Monthly report error"

});


}


});



/*
================================================
EYE EXAMINATION REPORT
POST /reports/eye-exam
================================================
*/

router.post("/eye-exam", async(req,res)=>{


try{


const {

storeCode,

fromDate,

toDate,

customer

}=req.body;



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


patient_id,

patient_name,


right_sph,

right_cyl,

right_axis,


left_sph,

left_cyl,

left_axis,


add_power,


pd,


notes,


exam_date



FROM eye_exams



WHERE store_code=$1



AND

(

$2=''

OR

exam_date >= TO_DATE($2,'DD-MM-YYYY')

)



AND

(

$3=''

OR

exam_date <= TO_DATE($3,'DD-MM-YYYY')

)



AND

(

$4=''

OR

patient_name ILIKE '%'||$4||'%'

)



ORDER BY exam_date DESC



`,

[

storeCode,

fromDate || "",

toDate || "",

customer || ""

]


);



res.json({

success:true,

count:result.rows.length,

data:result.rows

});


}


catch(error){


console.log(error);



res.status(500).json({

success:false,

message:"Eye examination report error",

error:error.message

});


}


});


module.exports = router;