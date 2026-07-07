const express = require("express");
const router = express.Router();

const crypto = require("crypto");
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



        // ==============================
        // VALIDATION
        // ==============================

        if (!storeData || !plan || !payment) {

            return res.status(400).json({

                success: false,
                message: "Missing payment data"

            });

        }



        // ==============================
        // VERIFY RAZORPAY SIGNATURE
        // ==============================

        const generatedSignature =
            crypto
            .createHmac(
                "sha256",
                process.env.RAZORPAY_KEY_SECRET
            )
            .update(
                payment.razorpay_order_id +
                "|" +
                payment.razorpay_payment_id
            )
            .digest("hex");



        if (generatedSignature !== payment.razorpay_signature) {

            return res.status(400).json({

                success: false,
                message: "Payment verification failed"

            });

        }




        // ==============================
        // INSERT STORE + SUBSCRIPTION
        // ==============================


        const result = await pool.query(

            `
            INSERT INTO stores
            (
                store_name,
                owner_name,
                email,
                mobile,

                address,
                city,
                state,
                pincode,
                gst_number,

                plan_name,
                amount,

                subscription_status,

                razorpay_payment_id,
                razorpay_order_id,
                razorpay_signature
            )


            VALUES
            (
                $1,$2,$3,$4,
                $5,$6,$7,$8,$9,
                $10,$11,
                $12,
                $13,$14,$15
            )


            RETURNING id
            `,


            [

                storeData.storeName,

                storeData.ownerName,

                storeData.email,

                storeData.mobile,


                storeData.address || "",

                storeData.city || "",

                storeData.state || "",

                storeData.pincode || "",

                storeData.gstNumber || "",



                plan.name,

                plan.price,


                "ACTIVE",



                payment.razorpay_payment_id,

                payment.razorpay_order_id,

                payment.razorpay_signature

            ]

        );




        return res.status(200).json({

            success: true,

            storeId: result.rows[0].id,

            message: "Payment successful"

        });



    }

    catch(error) {


        console.error(
            "PAYMENT ERROR:",
            error
        );


        return res.status(500).json({

            success:false,

            message:"Internal server error"

        });


    }


});



module.exports = router;