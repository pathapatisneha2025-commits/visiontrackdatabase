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


// ==========================
// ADD PRODUCT WITH VARIANTS
// ==========================

router.post(
"/add",
upload.any(),
async(req,res)=>{


try{


const {

category_id,

brand_id,

product_name,

description,

variants


}=req.body;



// ==========================
// UPLOAD VARIANT IMAGES
// ==========================


let uploadedImages={};



if(req.files && req.files.length>0){


for(const file of req.files){


const result =
await uploadToCloudinary(
file.buffer
);



uploadedImages[file.fieldname]=
result.secure_url;


}


}




// ==========================
// CONVERT VARIANTS
// ==========================


let finalVariants=[];


if(variants){


const parsedVariants =
JSON.parse(variants);



finalVariants =
parsedVariants.map((v,index)=>({


color:v.color,

price:v.price,

sku:v.sku,


image:
uploadedImages[`variant_images_${index}`]
||
v.existingImage
||
""



}));


}





// ==========================
// INSERT PRODUCT
// ==========================


const data = await pool.query(

`
INSERT INTO master_products
(
category_id,
brand_id,
product_name,
description,
variants
)

VALUES
($1,$2,$3,$4,$5)

RETURNING *

`,

[

category_id,

brand_id,

product_name,

description,

JSON.stringify(finalVariants)

]


);



res.json({

success:true,

message:"Product Added Successfully",

data:data.rows[0]

});



}

catch(error){


console.log("ADD PRODUCT ERROR",error);


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


// ==========================
// UPDATE PRODUCT WITH VARIANTS
// ==========================

router.put(
"/update/:id",
upload.any(),
async(req,res)=>{


try{


const id=req.params.id;


const {

category_id,

brand_id,

product_name,

description,

variants


}=req.body;



// ==========================
// CHECK PRODUCT
// ==========================


const oldProduct = await pool.query(

`
SELECT *
FROM master_products
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



// ==========================
// UPLOAD NEW VARIANT IMAGES
// ==========================


let uploadedImages={};



if(req.files && req.files.length>0){


for(const file of req.files){


const result =
await uploadToCloudinary(
file.buffer
);



uploadedImages[file.fieldname]=
result.secure_url;


}


}



// ==========================
// PREPARE VARIANTS
// ==========================


let finalVariants=[];


if(variants){


const parsedVariants =
JSON.parse(variants);



finalVariants =
parsedVariants.map((v,index)=>{


return {

color:v.color,

price:v.price,

sku:v.sku,


// new image OR old image

image:
uploadedImages[`variant_images_${index}`]
||
v.existingImage
||
""

};


});


}




// ==========================
// UPDATE PRODUCT
// ==========================


const updated =
await pool.query(

`
UPDATE master_products

SET

category_id=$1,

brand_id=$2,

product_name=$3,

description=$4,

variants=$5


WHERE id=$6


RETURNING *

`,

[


category_id,

brand_id,

product_name,

description,

JSON.stringify(finalVariants),

id


]

);




res.json({

success:true,

message:"Product Updated Successfully",

data:updated.rows[0]

});



}


catch(error){


console.log(
"UPDATE PRODUCT ERROR",
error
);



res.status(500).json({

success:false,

message:"Server Error"

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