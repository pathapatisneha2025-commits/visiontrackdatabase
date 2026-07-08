const express=require("express");

const router=express.Router();

const pool=require("../db");



/*
GET ALL PATIENTS OF STORE
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




let query=`

SELECT *

FROM patients

WHERE store_code=$1

AND
(
name ILIKE $2
OR mobile ILIKE $2
OR patient_id ILIKE $2
)

ORDER BY id DESC

`;



const values=[

storeCode,

`%${search}%`

];



const result=
await pool.query(
query,
values
);



res.json({

success:true,

count:result.rows.length,

patients:result.rows


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
CREATE PATIENT
*/


router.post("/add",async(req,res)=>{


try{


const {


storeCode,

name,

mobile,

age,

gender,

address


}=req.body;




if(!storeCode){

return res.status(400).json({

success:false,

message:"Store code missing"

});

}



const patientId =
"PT"+Date.now();



const result =
await pool.query(

`

INSERT INTO patients

(
patient_id,
store_code,
name,
mobile,
age,
gender,
address
)

VALUES($1,$2,$3,$4,$5,$6,$7)

RETURNING *

`,

[

patientId,

storeCode,

name,

mobile,

age,

gender,

address

]


);



res.json({

success:true,

message:"Patient created",

patient:result.rows[0]

});


}

catch(error){

console.log(error);


res.status(500).json({

success:false,

message:"Error creating patient"

});


}



});





/*
GET SINGLE PATIENT
*/


router.get("/:id",async(req,res)=>{


try{


const result=
await pool.query(

`

SELECT *

FROM patients

WHERE id=$1

`,

[
req.params.id
]

);



res.json({

success:true,

patient:result.rows[0]

});


}

catch(error){

res.status(500).json({

success:false

});

}


});





module.exports=router;