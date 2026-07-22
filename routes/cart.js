const express = require("express");

const router = express.Router();

const pool = require("../db");




// ===============================
// ADD TO CART
// ===============================

router.post("/add", async(req,res)=>{


try{


const {
customer_id,
product_id,
product_name,
brand,
category,
image,
price
}=req.body;



// CHECK EXISTING PRODUCT

const check = await pool.query(

`
SELECT *

FROM vcart_items

WHERE customer_id=$1

AND product_id=$2

`,
[
customer_id,
product_id
]

);





if(check.rows.length > 0){



// INCREASE QUANTITY

await pool.query(

`
UPDATE vcart_items

SET quantity = quantity + 1

WHERE customer_id=$1

AND product_id=$2

`,
[
customer_id,
product_id
]

);



}

else{



// INSERT NEW PRODUCT

await pool.query(

`
INSERT INTO vcart_items
(
customer_id,
product_id,
product_name,
brand,
category,
image,
price,
quantity
)

VALUES
($1,$2,$3,$4,$5,$6,$7,1)

`,
[
customer_id,
product_id,
product_name,
brand,
category,
image,
price
]

);



}




res.json({

success:true,

message:"Product added to cart"

});



}
catch(error){


console.log(
"ADD CART ERROR",
error
);


res.status(500).json({

success:false,

message:"Server error"

});


}


});









// ===============================
// GET CUSTOMER CART
// ===============================


router.get("/:customer_id",async(req,res)=>{


try{


const result = await pool.query(

`
SELECT *

FROM vcart_items

WHERE customer_id=$1

ORDER BY id DESC

`,
[
req.params.customer_id
]

);




res.json({

success:true,

data:result.rows

});



}
catch(error){


console.log(
"GET CART ERROR",
error
);



res.status(500).json({

success:false

});


}


});









// ===============================
// CART COUNT
// ===============================


router.get("/count/:customer_id",async(req,res)=>{


try{


const result = await pool.query(

`
SELECT COALESCE(SUM(quantity),0) AS count

FROM vcart_items

WHERE customer_id=$1

`,
[
req.params.customer_id
]

);




res.json({

success:true,

count:Number(
result.rows[0].count
)

});



}
catch(error){


console.log(
"CART COUNT ERROR",
error
);



res.status(500).json({

success:false

});


}


});









// ===============================
// UPDATE QUANTITY
// ===============================


router.put("/quantity/:id",async(req,res)=>{


try{


const {
quantity
}=req.body;



await pool.query(

`
UPDATE vcart_items

SET quantity=$1

WHERE id=$2

`,
[
quantity,
req.params.id
]

);



res.json({

success:true,

message:"Quantity updated"

});


}
catch(error){


console.log(error);


res.status(500).json({

success:false

});


}


});









// ===============================
// REMOVE CART ITEM
// ===============================


router.delete("/:id",async(req,res)=>{


try{


await pool.query(

`
DELETE FROM vcart_items

WHERE id=$1

`,
[
req.params.id
]

);



res.json({

success:true,

message:"Removed from cart"

});


}
catch(error){


console.log(error);


res.status(500).json({

success:false

});


}


});





module.exports = router;