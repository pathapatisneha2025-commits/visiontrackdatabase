const express=require("express");

const router=express.Router();

const pool=require("../db");



// ADD CATEGORY

router.post("/",async(req,res)=>{


try{


const {name}=req.body;


const result=await pool.query(

`
INSERT INTO categories(name)

VALUES($1)

RETURNING *

`,
[name]

);



res.json({

success:true,

data:result.rows[0]

});


}

catch(error){

res.status(500).json({

success:false,

message:error.message

});

}


});




// GET ALL


router.get("/",async(req,res)=>{


const result=await pool.query(

`
SELECT *

FROM categories

ORDER BY id DESC

`

);


res.json({

success:true,

data:result.rows

});


});




module.exports=router;