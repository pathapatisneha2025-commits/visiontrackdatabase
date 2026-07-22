const express=require("express");

const router=express.Router();

const pool=require("../db");



// ADD BRAND


router.post("/",async(req,res)=>{


const {

name,

logo

}=req.body;



const result=await pool.query(

`
INSERT INTO brands

(name,logo)

VALUES($1,$2)

RETURNING *

`,

[
name,
logo
]

);



res.json({

success:true,

data:result.rows[0]

});


});





// GET BRANDS


router.get("/",async(req,res)=>{


const result=await pool.query(

`
SELECT *

FROM brands

ORDER BY id DESC

`

);


res.json({

success:true,

data:result.rows

});


});



module.exports=router;