const express=require("express");
const router=express.Router();

const pool=require("../db");



/*
GET ALL ORDERS
*/

router.get("/",async(req,res)=>{

try{


const {
storeCode,
search=""
}=req.query;



if(!storeCode){

return res.status(400).json({

success:false,
message:"Store code required"

});

}



const result=await pool.query(

`
SELECT *

FROM optical_orders

WHERE store_code=$1

AND
(
order_no ILIKE $2
OR patient_name ILIKE $2
OR patient_id ILIKE $2
OR mobile ILIKE $2
)

ORDER BY id DESC

`,
[
storeCode,
`%${search}%`
]

);



res.json({

success:true,

count:result.rows.length,

orders:result.rows

});



}

catch(error){

console.log(error);


res.status(500).json({

success:false,
message:"Server error"

});


}

});







/*
CREATE NEW ORDER
*/


router.post("/add",async(req,res)=>{


try{


const {


storeCode,


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


status,

payment_status


}=req.body;



if(!storeCode){

return res.status(400).json({

success:false,
message:"Store code missing"

});

}



const balance =
Number(total_amount || 0)
-
Number(advance_paid || 0);




const result=await pool.query(

`

INSERT INTO optical_orders

(

store_code,

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

)


VALUES

(

$1,$2,$3,$4,

$5,$6,$7,$8,$9,

$10,$11,

$12,

$13,

$14,$15,$16,

$17,$18

)


RETURNING *

`,

[


storeCode,

order_no,


order_date,

expected_delivery,


patient_id,

patient_name,

mobile,

age || null,

gender,


frame_barcode,

frame_model,


lens_type,


prescription_notes,


total_amount || 0,

advance_paid || 0,

balance,


status || "Pending",

payment_status || "Due"


]

);




res.json({

success:true,

message:"Order created",

order:result.rows[0]


});



}

catch(error){


console.log(error);


res.status(500).json({

success:false,

message:"Error creating order",

error:error.message

});


}


});









/*
GET SINGLE ORDER
*/


router.get("/:id",async(req,res)=>{


try{


const result=await pool.query(

`

SELECT *

FROM optical_orders

WHERE id=$1

`,

[
req.params.id
]

);



res.json({

success:true,

order:result.rows[0]

});


}

catch(error){


console.log(error);


res.status(500).json({

success:false,
message:"Error fetching order"

});


}


});









/*
UPDATE ORDER STATUS
*/


router.put("/:id/status",async(req,res)=>{


try{


const {
status
}=req.body;



const result=await pool.query(

`

UPDATE optical_orders

SET status=$1

WHERE id=$2

RETURNING *

`,

[
status,
req.params.id
]


);



res.json({

success:true,

order:result.rows[0]

});


}

catch(error){

console.log(error);


res.status(500).json({

success:false,
message:"Error updating status"

});

}


});






module.exports=router;