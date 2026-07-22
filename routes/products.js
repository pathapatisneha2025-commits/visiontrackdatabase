const express=require("express");
const router=express.Router();

const pool=require("../db");

const multer=require("multer");

const {Readable}=require("stream");

const cloudinary=require("../cloudinary");



// MEMORY STORAGE

const storage=multer.memoryStorage();

const upload=multer({
storage
});




// CLOUDINARY UPLOAD FUNCTION

const uploadToCloudinary=(buffer)=>{


return new Promise((resolve,reject)=>{


const stream=cloudinary.uploader.upload_stream(

{
folder:"master_products"
},

(error,result)=>{


if(result)

resolve(result);

else

reject(error);


}


);



const readable=new Readable();

readable._read=()=>{};


readable.push(buffer);

readable.push(null);


readable.pipe(stream);



});


};





// ==========================
// ADD PRODUCT
// ==========================


router.post(
"/add",
upload.single("image"),
async(req,res)=>{


try{


const {

category_id,

brand_id,

product_name,

description,

mrp,

sku


}=req.body;



let image="";



// UPLOAD IMAGE

if(req.file){


const result =
await uploadToCloudinary(
req.file.buffer
);


image=result.secure_url;


}




const data=await pool.query(

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

data:data.rows[0]

});



}

catch(error){

console.log(error);


res.status(500).json({

success:false,

message:"Server Error"

});


}


});







// ==========================
// GET PRODUCTS
// ==========================


router.get("/all",async(req,res)=>{


try{


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



}

catch(error){

console.log(error);

res.status(500).json({

success:false

});


}


});

// ==========================
// GET PRODUCT BY ID
// ==========================

router.get("/:id", async(req,res)=>{


try{


const result = await pool.query(

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


WHERE mp.id=$1

`,

[req.params.id]

);



if(result.rows.length===0){

return res.json({

success:false,

message:"Product not found"

});

}



res.json({

success:true,

data:result.rows[0]

});


}

catch(error){

console.log(error);

res.status(500).json({

success:false

});


}


});
// ==========================
// UPDATE PRODUCT
// ==========================


router.put(

"/update/:id",

upload.single("image"),

async(req,res)=>{


try{


const id=req.params.id;



const {

category_id,

brand_id,

product_name,

description,

mrp,

sku


}=req.body;




// GET OLD PRODUCT

const oldProduct = await pool.query(

`
SELECT * FROM master_products
WHERE id=$1
`,

[id]

);



if(oldProduct.rows.length===0){


return res.json({

success:false,

message:"Product not found"

});


}




let image =
oldProduct.rows[0].image;




// NEW IMAGE UPLOAD

if(req.file){


const result =
await uploadToCloudinary(
req.file.buffer
);


image=result.secure_url;


}




const updated =
await pool.query(

`

UPDATE master_products

SET

category_id=$1,

brand_id=$2,

product_name=$3,

description=$4,

image=$5,

mrp=$6,

sku=$7


WHERE id=$8


RETURNING *

`,

[

category_id,

brand_id,

product_name,

description,

image,

mrp,

sku,

id

]


);




res.json({

success:true,

data:updated.rows[0],

message:"Product Updated"

});



}

catch(error){

console.log(error);


res.status(500).json({

success:false

});


}



}

);
// ==========================
// DELETE PRODUCT
// ==========================


router.delete(

"/delete/:id",

async(req,res)=>{


try{


const result =
await pool.query(

`

DELETE FROM master_products

WHERE id=$1

RETURNING *

`,

[req.params.id]

);



if(result.rows.length===0){

return res.json({

success:false,

message:"Product not found"

});

}



res.json({

success:true,

message:"Product Deleted"

});


}


catch(error){

console.log(error);


res.status(500).json({

success:false

});


}


}

);

router.post("/addreview", async(req,res)=>{


try{


const {
product_id,
customer_name,
rating,
review
}=req.body;



if(
!product_id ||
!customer_name ||
!rating ||
!review
){

return res.json({

success:false,

message:"All fields required"

});

}




const result = await pool.query(

`
INSERT INTO product_reviews
(
product_id,
customer_name,
rating,
review
)

VALUES($1,$2,$3,$4)

RETURNING *

`,
[
product_id,
customer_name,
rating,
review
]


);



res.json({

success:true,

message:"Review added successfully",

data:result.rows[0]

});



}
catch(error){


console.log(
"ADD REVIEW ERROR",
error
);


res.status(500).json({

success:false,

message:"Server error"

});


}


});







// ===============================
// GET REVIEWS BY PRODUCT
// ===============================

router.get("/reviews/:productId", async(req,res)=>{

try{

const {productId}=req.params;


const result = await pool.query(
`
SELECT 
id,
product_id,
customer_name,
rating,
review,
created_at

FROM product_reviews

WHERE product_id=$1

ORDER BY created_at DESC

`,
[productId]
);



res.json({

success:true,

data:result.rows

});


}
catch(error){

console.log("GET REVIEWS ERROR",error);


res.status(500).json({

success:false,
message:"Failed to fetch reviews"

});


}


});




module.exports=router;