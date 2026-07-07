const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");

const pool = require("../db");



// ======================================
// PAYMENT SUCCESS + STORE CREATION API
// ======================================
router.post("/payment-success", async (req, res) => {

try {


const {
  storeData,
  plan,
  payment
} = req.body;



// Encrypt password

const hashedPassword = await bcrypt.hash(
  storeData.password,
  10
);



// Insert Store

const result = await pool.query(

`
INSERT INTO stores
(
store_name,
owner_name,
email,
mobile,
password,
plan_name,
amount,
subscription_status,
razorpay_payment_id
)

VALUES
($1,$2,$3,$4,$5,$6,$7,$8,$9)

RETURNING id

`,

[


storeData.storeName,

storeData.ownerName,

storeData.email,

storeData.mobile,

hashedPassword,

plan.name,

plan.price,

"ACTIVE",

payment.razorpay_payment_id || payment.transaction_id


]


);





// Generate Store Code

const storeId = result.rows[0].id;


const storeCode = 
"STORE" + String(storeId).padStart(3,"0");





// Update Store Code

await pool.query(

`
UPDATE stores
SET store_code=$1
WHERE id=$2
`,

[

storeCode,

storeId

]


);






res.json({

success:true,

storeId:storeId,

storeCode:storeCode,

message:"Store created successfully"

});




}

catch(error){


console.log(error);



res.status(500).json({

success:false,

message:"Store creation failed"

});


}


});

router.post("/login", async (req, res) => {

    try {


        const {
            storeCode,
            email,
            password
        } = req.body;



        // ==============================
        // FIND STORE
        // ==============================

        const result = await pool.query(

            `
            SELECT *
            FROM stores
            WHERE store_code=$1
            AND email=$2
            AND subscription_status='ACTIVE'
            `,

            [
                storeCode,
                email
            ]

        );



        // ==============================
        // CHECK STORE EXISTS
        // ==============================

        if (result.rows.length === 0) {

            return res.status(401).json({

                success:false,

                message:"Invalid store code or email"

            });

        }




        const store = result.rows[0];



        // ==============================
        // VERIFY PASSWORD
        // ==============================

        const passwordMatch = await bcrypt.compare(

            password,

            store.password

        );



        if (!passwordMatch) {

            return res.status(401).json({

                success:false,

                message:"Invalid password"

            });

        }





        // ==============================
        // CREATE JWT TOKEN
        // ==============================

        const token = jwt.sign(

            {

                storeId: store.id,

                storeCode: store.store_code,

                email: store.email

            },

            process.env.JWT_SECRET,

            {

                expiresIn:"7d"

            }

        );





        // ==============================
        // LOGIN SUCCESS RESPONSE
        // ==============================

        res.json({

            success:true,

            message:"Login successful",

            token:token,


            store:{

                id:store.id,

                storeCode:store.store_code,

                storeName:store.store_name,

                ownerName:store.owner_name,

                email:store.email

            }

        });



    }


    catch(error){


        console.log("Login Error:", error);



        res.status(500).json({

            success:false,

            message:"Login failed"

        });


    }


});


// ======================================
// GET ALL STORES
// ======================================

router.get("/stores", async(req,res)=>{


try{


const result = await pool.query(

`
SELECT *
FROM stores
ORDER BY id DESC
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

message:"Failed to fetch stores"

});


}


});




module.exports = router;