const express=require("express");
const router=express.Router();

const pool=require("../db");



// ===============================
// GET ALL PLANS
// ===============================

router.get("/all",async(req,res)=>{

try{

const result=await pool.query(
`
SELECT *
FROM subscription_plans
ORDER BY id ASC
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

success:false,

message:"Failed to fetch plans"

});

}

});





// ===============================
// ADD PLAN
// ===============================


router.post("/add",async(req,res)=>{


try{


const {
plan_name,
price,
duration_days,
features,
status
}=req.body;



const result=await pool.query(

`
INSERT INTO subscription_plans
(
plan_name,
price,
duration_days,
features,
status
)

VALUES($1,$2,$3,$4,$5)

RETURNING *

`,

[

plan_name,

price,

duration_days,

JSON.stringify(features),

status || "ACTIVE"

]


);



res.json({

success:true,

data:result.rows[0]

});



}
catch(error){

console.log("ADD PLAN ERROR:",error);


res.status(500).json({

success:false,

message:"Failed to add plan"

});


}


});







// ===============================
// UPDATE PLAN
// ===============================


router.put("/:id",async(req,res)=>{


try{


const {

plan_name,

price,

duration_days,

features,

status

}=req.body;



const result=await pool.query(

`
UPDATE subscription_plans

SET

plan_name=$1,

price=$2,

duration_days=$3,

features=$4,

status=$5,

updated_at=NOW()


WHERE id=$6


RETURNING *

`,

[


plan_name,


price,


duration_days,


JSON.stringify(features),


status,


req.params.id


]


);





if(result.rows.length===0){


return res.json({

success:false,

message:"Plan not found"

});


}




res.json({

success:true,

data:result.rows[0]

});




}
catch(error){


console.log("UPDATE PLAN ERROR:",error);



res.status(500).json({

success:false,

message:"Failed to update plan"

});


}


});







// ===============================
// ACTIVATE / DEACTIVATE PLAN
// ===============================


router.put("/toggle/:id",async(req,res)=>{


try{


const result=await pool.query(

`

UPDATE subscription_plans

SET

status =

CASE

WHEN status='ACTIVE'

THEN 'INACTIVE'


ELSE 'ACTIVE'


END,


updated_at=NOW()


WHERE id=$1


RETURNING *

`

,

[

req.params.id

]

);





res.json({

success:true,

data:result.rows[0]

});



}
catch(error){


console.log("TOGGLE ERROR:",error);



res.status(500).json({

success:false,

message:"Failed to update status"

});


}



});







// ===============================
// DELETE PLAN
// ===============================


router.delete("/:id",async(req,res)=>{


try{


const result=await pool.query(

`

DELETE FROM subscription_plans

WHERE id=$1

RETURNING *

`

,

[

req.params.id

]

);




if(result.rows.length===0){


return res.json({

success:false,

message:"Plan not found"

});


}





res.json({

success:true,

message:"Plan deleted"

});



}
catch(error){


console.log("DELETE PLAN ERROR:",error);



res.status(500).json({

success:false,

message:"Failed to delete plan"

});


}



});





module.exports=router;