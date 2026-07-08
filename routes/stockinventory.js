const express=require("express");
const router=express.Router();

const pool=require("../db");



/*
GET STOCK
*/

router.get("/",async(req,res)=>{

try{

const {
storeCode
}=req.query;


const result=await pool.query(

`
SELECT *

FROM optical_stock

WHERE store_code=$1

ORDER BY id DESC

`,
[
storeCode
]

);


res.json({

success:true,

stocks:result.rows

});


}
catch(error){

console.log(error);

res.status(500).json({

success:false

});

}


});







/*
ADD STOCK
*/


router.post("/add",async(req,res)=>{


try{


const {

storeCode,

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


}=req.body;



const result=await pool.query(

`

INSERT INTO optical_stock

(

store_code,

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

)


VALUES

(

$1,$2,$3,$4,$5,$6,

$7,$8,$9,$10,$11,$12

)


RETURNING *

`,

[

storeCode,

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

]


);



res.json({

success:true,

stock:result.rows[0]

});


}

catch(error){

console.log(error);


res.status(500).json({

success:false

});


}


});




module.exports=router;