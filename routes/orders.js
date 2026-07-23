const express = require("express");

const router = express.Router();

const pool = require("../db");



// ===============================
// PLACE ORDER
// ===============================

router.post("/place", async (req,res)=>{


const client = await pool.connect();


try{


const {

storeCode,

customer,

items,

totalAmount,

paymentMethod


}=req.body;



if(
!storeCode ||
!customer ||
!items ||
items.length===0 ||
!paymentMethod
){


return res.json({

success:false,

message:"Invalid order data"

});


}



await client.query("BEGIN");



// Generate Order Number
// Generate Order Number

const orderCount = await client.query(
`
SELECT COUNT(DISTINCT order_id) AS count
FROM vorder
`
);


const nextOrderNumber =
Number(orderCount.rows[0].count) + 1;


const orderId =
"ORD" + String(nextOrderNumber).padStart(3,"0");




for(const item of items){



await client.query(

`

INSERT INTO vorder

(

order_id,

store_code,

customer_name,

mobile,

address,

product_id,

product_name,

brand,

image,

price,

quantity,

total_amount,

payment_method,

status

)


VALUES

($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)

`

,


[


orderId,

storeCode,


customer.customerName,

customer.mobile,

customer.address,


item.product_id || item.id,

item.product_name,

item.brand,

item.image,


Number(item.price),

Number(item.quantity),


Number(totalAmount),


paymentMethod,


"Pending"


]


);



}





// Commit order

await client.query("COMMIT");




// ================================
// CLEAR CART AFTER ORDER SUCCESS
// ================================


await pool.query(

`

DELETE FROM vcart_items

WHERE store_code=$1

`,

[storeCode]


);





res.json({

success:true,

message:"Order placed successfully",

orderId


});



}

catch(error){


await client.query("ROLLBACK");


console.log(
"PLACE ORDER ERROR",
error
);



res.status(500).json({

success:false,

message:"Server error"

});


}

finally{


client.release();


}



});







// ===============================
// GET ORDERS BY STORE CODE
// ===============================


router.get("/:storeCode", async(req,res)=>{


try{


const {
storeCode
}=req.params;



if(!storeCode){


return res.json({

success:false,

message:"Store code required"

});


}





const result = await pool.query(

`

SELECT


order_id,

store_code,


customer_name,

mobile,

address,


total_amount,

payment_method,

status,

created_at,



json_agg(


json_build_object(


'id',
id,


'product_id',
product_id,


'product_name',
product_name,


'brand',
brand,


'image',
image,


'price',
price,


'quantity',
quantity


)


) AS items



FROM vorder



WHERE store_code=$1




GROUP BY


order_id,

store_code,

customer_name,

mobile,

address,

total_amount,

payment_method,

status,

created_at




ORDER BY created_at DESC



`


,


[storeCode]


);






res.json({

success:true,

data:result.rows


});



}

catch(error){


console.log(

"GET ORDERS ERROR",

error

);



res.status(500).json({

success:false,

message:"Server error"

});


}



});

// =====================================
// SUPER ADMIN - GET ALL SHOP ORDERS
// =====================================

router.get("/admin/all", async(req,res)=>{

try{


const result = await pool.query(`

SELECT

order_id,

store_code,

customer_name,

mobile,

SUM(quantity) AS total_products,

total_amount,

status,

created_at


FROM vorder


GROUP BY

order_id,
store_code,
customer_name,
mobile,
total_amount,
status,
created_at


ORDER BY created_at DESC


`);



res.json({

success:true,

data:result.rows

});


}

catch(error){

console.log(
"ADMIN ALL ORDERS ERROR",
error
);


res.status(500).json({

success:false,

message:"Server error"

});


}


});
router.get("/admin/summary",async(req,res)=>{


try{


const result =
await pool.query(`


SELECT


COUNT(DISTINCT order_id)
AS total,


COUNT(DISTINCT order_id)
FILTER(
WHERE status='Pending'
)
AS pending,


COUNT(DISTINCT order_id)
FILTER(
WHERE status='Approved'
)
AS approved,


COUNT(DISTINCT order_id)
FILTER(
WHERE status='Shipped'
)
AS shipped,


COUNT(DISTINCT order_id)
FILTER(
WHERE status='Completed'
)
AS completed



FROM vorder



`);



res.json({

success:true,

data:result.rows[0]

});


}

catch(error){


res.status(500).json({

success:false

});


}


});



module.exports = router;