const express=require("express");
const router=express.Router();

const pool=require("../db");


// GET FOLLOWUPS

router.get("/",async(req,res)=>{

try{

const {storeCode}=req.query;


const result=await pool.query(

`
SELECT *
FROM followups
WHERE store_code=$1
ORDER BY followup_date ASC
`,
[
storeCode
]

);


res.json({

success:true,
followups:result.rows

});


}
catch(error){

console.log(error);

res.status(500).json({
success:false
});

}

});




// ADD FOLLOWUP

router.post("/add",async(req,res)=>{


try{


const {

storeCode,
patient_id,
patient_name,
mobile,
followup_date,
reason

}=req.body;



const result=await pool.query(

`
INSERT INTO followups

(
store_code,
patient_id,
patient_name,
mobile,
followup_date,
reason
)

VALUES

($1,$2,$3,$4,$5,$6)

RETURNING *

`,
[
storeCode,
patient_id,
patient_name,
mobile,
followup_date,
reason
]


);



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


module.exports=router;