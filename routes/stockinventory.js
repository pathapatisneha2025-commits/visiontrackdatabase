const express = require("express");
const router = express.Router();

const pool = require("../db");
const bwipjs = require("bwip-js");



/*
 Generate Barcode
*/

const generateBarcode = async (storeCode, category) => {

    let prefix = "STK";


    if(category === "frames"){
        prefix = "FRM";
    }
    else if(category === "lenses"){
        prefix = "LEN";
    }
    else if(category === "contact_lenses"){
        prefix = "CL";
    }
    else if(category === "accessories"){
        prefix = "ACC";
    }



    const countResult = await pool.query(

        `
        SELECT COUNT(*) 
        FROM stock_inventory
        WHERE store_code=$1
        `,
        [
            storeCode
        ]

    );


    const count =
    Number(countResult.rows[0].count) + 1;



    const barcode =
    `${prefix}-${storeCode}-${String(count).padStart(5,"0")}`;



    return barcode;

};





/*
GET ALL STOCK
*/

router.get("/all", async(req,res)=>{


try{


const {
storeCode
}=req.query;



const result = await pool.query(

`
SELECT *

FROM stock_inventory

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

success:false,
message:"Failed to fetch stock"

});


}



});








/*
ADD STOCK
*/

router.post("/add", async(req,res)=>{


try{


const body=req.body;



const {

storeCode,

category,

barcode,

brand,

frame_name,

model,

color,

size,

material,

gender,


lens_type,

power_range,

coating,

index: lens_index,


type: contact_type,

power,

base_curve,

diameter,

expiry_date,


accessory_name,


purchase_price,

selling_price,

quantity


}=body;





// Generate barcode automatically

let finalBarcode = barcode;



if(!finalBarcode){

finalBarcode =
await generateBarcode(
storeCode,
category
);

}






/*
 Generate Barcode Image
*/

let barcodeImage = null;


try{


const png = await bwipjs.toBuffer({

bcid:"code128",

text:finalBarcode,

scale:3,

height:12,

includetext:true,

textxalign:"center"

});



barcodeImage =
`data:image/png;base64,${png.toString("base64")}`;


}

catch(err){

console.log(
"Barcode image generation error",
err
);

}








const result = await pool.query(

`

INSERT INTO stock_inventory

(

store_code,

category,

barcode,

brand,


frame_name,

model,

color,

size,

material,

gender,


lens_type,

power_range,

coating,

lens_index,


contact_type,

power,

base_curve,

diameter,

expiry_date,


accessory_name,


purchase_price,

selling_price,

quantity


)


VALUES


(

$1,$2,$3,$4,

$5,$6,$7,$8,$9,$10,

$11,$12,$13,$14,

$15,$16,$17,$18,$19,

$20,

$21,$22,$23

)


RETURNING *

`,

[


storeCode,

category,

finalBarcode,

brand,


frame_name,

model,

color,

size,

material,

gender,


lens_type,

power_range,

coating,

lens_index,


contact_type,

power,

base_curve,

diameter,

expiry_date,


accessory_name,


purchase_price || 0,

selling_price || 0,

quantity || 0


]


);






res.json({

success:true,

message:"Stock added successfully",


barcode:finalBarcode,


barcodeImage,


stock:result.rows[0]


});



}


catch(error){


console.log(error);



res.status(500).json({

success:false,

message:"Stock adding failed"

});


}



});










/*
SCAN BARCODE
*/

router.get("/scan/:barcode", async(req,res)=>{


try{


const {
barcode
}=req.params;



const result = await pool.query(

`
SELECT *

FROM stock_inventory

WHERE barcode=$1
`,
[
barcode
]

);





if(result.rows.length===0){


return res.status(404).json({

success:false,

message:"Barcode not found"

});


}






res.json({

success:true,

stock:result.rows[0]

});




}

catch(error){


console.log(error);



res.status(500).json({

success:false,

message:"Barcode scan failed"

});


}



});






module.exports = router;