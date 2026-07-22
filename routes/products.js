const express=require("express");

const router=express.Router();

const pool=require("../db");



// ADD PRODUCT


router.post("/add",async(req,res)=>{


const {

category_id,

brand_id,

product_name,

description,

image,

mrp,

sku


}=req.body;



const result=await pool.query(

`

INSERT INTO master_products

(
category_id,
brand_id,
product_name,
description,
image,
mrp,
sku
)

VALUES

($1,$2,$3,$4,$5,$6,$7)


RETURNING *

`,

[
category_id,
brand_id,
product_name,
description,
image,
mrp,
sku
]

);



res.json({

success:true,

data:result.rows[0]

});


});






// GET PRODUCTS


router.get("/all",async(req,res)=>{


const result=await pool.query(

`

SELECT

mp.*,

c.name category,

b.name brand


FROM master_products mp


LEFT JOIN categories c

ON c.id=mp.category_id


LEFT JOIN brands b

ON b.id=mp.brand_id


ORDER BY mp.id DESC

`

);



res.json({

success:true,

data:result.rows

});


});



module.exports=router;