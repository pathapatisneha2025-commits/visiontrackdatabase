const express = require("express");
const router = express.Router();

const pool = require("../db");

const multer = require("multer");

const { Readable } = require("stream");

const cloudinary = require("../cloudinary");


// Multer memory storage

const storage = multer.memoryStorage();

const upload = multer({
    storage
});



// Cloudinary upload helper

const uploadToCloudinary = (buffer, folder="brands") => {

    return new Promise((resolve,reject)=>{


        const stream = cloudinary.uploader.upload_stream(

            {
                folder:folder
            },

            (error,result)=>{

                if(result){

                    resolve(result);

                }
                else{

                    reject(error);

                }

            }

        );


        const readable = new Readable();

        readable._read = ()=>{};


        readable.push(buffer);

        readable.push(null);


        readable.pipe(stream);


    });


};





// ================================
// ADD BRAND
// ================================


router.post(
"/add",
upload.single("logo"),

async(req,res)=>{


try{


const {

name

}=req.body;



if(!name){

return res.status(400).json({

success:false,

message:"Brand name required"

});

}



let logo="";



// Upload logo to cloudinary

if(req.file){


const result = await uploadToCloudinary(

req.file.buffer,

"brands"

);


logo=result.secure_url;


}




const brand = await pool.query(

`

INSERT INTO brands

(
name,
logo
)

VALUES

($1,$2)

RETURNING *

`,

[

name,

logo

]


);



res.json({

success:true,

message:"Brand added successfully",

data:brand.rows[0]

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







// ================================
// UPDATE BRAND
// ================================


router.put(

"/update/:id",

upload.single("logo"),

async(req,res)=>{


try{


const {

name

}=req.body;



const existing = await pool.query(

`
SELECT *

FROM brands

WHERE id=$1

`,

[req.params.id]

);



if(existing.rows.length===0){


return res.status(404).json({

success:false,

message:"Brand not found"

});


}




let logo = existing.rows[0].logo;



// New logo uploaded

if(req.file){


const result = await uploadToCloudinary(

req.file.buffer,

"brands"

);


logo=result.secure_url;


}






const updated = await pool.query(

`

UPDATE brands

SET

name=$1,

logo=$2


WHERE id=$3


RETURNING *

`,

[

name,

logo,

req.params.id

]


);



res.json({

success:true,

message:"Brand updated",

data:updated.rows[0]

});


}


catch(error){


console.log(error);


res.status(500).json({

success:false

});


}


});







// ================================
// GET ALL BRANDS
// ================================


router.get(

"/all",

async(req,res)=>{


try{


const result = await pool.query(

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


}

catch(error){


res.status(500).json({

success:false

});


}


});







// ================================
// DELETE BRAND
// ================================


router.delete(

"/delete/:id",

async(req,res)=>{


try{


await pool.query(

`

DELETE FROM brands

WHERE id=$1

`,

[req.params.id]

);



res.json({

success:true,

message:"Brand deleted"

});


}

catch(error){


res.status(500).json({

success:false

});


}



});





module.exports = router;