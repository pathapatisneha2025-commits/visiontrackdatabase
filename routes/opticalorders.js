const express=require("express");
const router=express.Router();

const pool=require("../db");



/*
GET ALL ORDERS
*/

router.get("/", async(req,res)=>{

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



const result = await pool.query(

`
SELECT *

FROM optical_orders

WHERE store_code=$1

AND is_deleted=false

AND
(
    order_no ILIKE $2
    OR patient_name ILIKE $2
    OR patient_id ILIKE $2
    OR mobile ILIKE $2
)

ORDER BY id DESC

`,
[
storeCode,
`%${search}%`
]

);



res.json({

success:true,

count:result.rows.length,

orders:result.rows

});



}

catch(error){

console.log(error);


res.status(500).json({

success:false,

message:"Server error",

error:error.message

});


}

});







/*
CREATE NEW ORDER
*/

router.post("/add", async (req, res) => {
  try {
    const {
      storeCode,
      role,

      bill_number,
      order_no,
      order_date,
      expected_delivery,

      patient_id,
      patient_name,
      mobile,
      age,
      gender,

      frame_barcode,
      frame_model,

      lens_type,

      prescription_notes,

      total_amount,
      advance_paid,

      status,
      payment_status
    } = req.body;

    // ============================================
    // ROLE
    // ============================================

    const userRole = role || "store";

    // ============================================
    // STORE CODE LOGIC
    // ============================================

    // Superadmin does NOT require storeCode
    if (
      userRole !== "superadmin" &&
      !storeCode
    ) {
      return res.status(400).json({
        success: false,
        message: "Store code missing"
      });
    }

    // Superadmin => NULL
    // Other roles => actual storeCode
    const finalStoreCode =
      userRole === "superadmin"
        ? null
        : storeCode;

    console.log(
      "OPTICAL ORDER ROLE:",
      userRole
    );

    console.log(
      "OPTICAL ORDER STORE CODE:",
      finalStoreCode
    );

    // ============================================
    // BALANCE
    // ============================================

    const balance =
      Number(total_amount || 0) -
      Number(advance_paid || 0);

    // ============================================
    // CREATE ORDER
    // ============================================

    const result = await pool.query(
      `
      INSERT INTO optical_orders
      (
        store_code,
        bill_number,
        order_no,
        order_date,
        expected_delivery,

        patient_id,
        patient_name,
        mobile,
        age,
        gender,

        frame_barcode,
        frame_model,

        lens_type,

        prescription_notes,

        total_amount,
        advance_paid,
        balance_amount,

        status,
        payment_status
      )

      VALUES
      (
        $1,$2,$3,$4,$5,

        $6,$7,$8,$9,$10,

        $11,$12,

        $13,

        $14,

        $15,$16,$17,

        $18,$19
      )

      RETURNING *
      `,
      [
        // ========================================
        // STORE CODE
        // ========================================

        finalStoreCode,

        bill_number || null,

        order_no || null,

        order_date || null,

        expected_delivery || null,

        // ========================================
        // PATIENT
        // ========================================

        patient_id || null,

        patient_name || null,

        mobile || null,

        age || null,

        gender || null,

        // ========================================
        // PRODUCT
        // ========================================

        frame_barcode || null,

        frame_model || null,

        lens_type || null,

        // ========================================
        // PRESCRIPTION
        // ========================================

        prescription_notes || null,

        // ========================================
        // PAYMENT
        // ========================================

        Number(total_amount || 0),

        Number(advance_paid || 0),

        balance,

        // ========================================
        // STATUS
        // ========================================

        status || "Pending",

        payment_status || "Due"
      ]
    );

    // ============================================
    // REDUCE FRAME STOCK
    // ============================================

    if (frame_barcode) {

      let stockResult;

      // ==========================================
      // SUPERADMIN
      // No store_code filtering
      // ==========================================

      if (userRole === "superadmin") {

        stockResult = await pool.query(
          `
          SELECT
            id,
            quantity,
            store_code
          FROM stock_inventory
          WHERE barcode = $1
          LIMIT 1
          `,
          [
            frame_barcode
          ]
        );

      }

      // ==========================================
      // NORMAL STORE USER
      // Filter by store_code
      // ==========================================

      else {

        stockResult = await pool.query(
          `
          SELECT
            id,
            quantity,
            store_code
          FROM stock_inventory
          WHERE barcode = $1
          AND store_code = $2
          LIMIT 1
          `,
          [
            frame_barcode,
            storeCode
          ]
        );

      }

      // ==========================================
      // STOCK FOUND
      // ==========================================

      if (
        stockResult.rows.length > 0
      ) {

        const stockItem =
          stockResult.rows[0];

        const availableQty =
          Number(
            stockItem.quantity
          );

        if (
          availableQty > 0
        ) {

          // ======================================
          // SUPERADMIN
          // Update using inventory ID
          // ======================================

          if (
            userRole === "superadmin"
          ) {

            await pool.query(
              `
              UPDATE stock_inventory
              SET quantity = quantity - 1
              WHERE id = $1
              AND quantity > 0
              `,
              [
                stockItem.id
              ]
            );

          }

          // ======================================
          // NORMAL STORE
          // ======================================

          else {

            await pool.query(
              `
              UPDATE stock_inventory
              SET quantity = quantity - 1
              WHERE barcode = $1
              AND store_code = $2
              AND quantity > 0
              `,
              [
                frame_barcode,
                storeCode
              ]
            );

          }

        } else {

          console.log(
            "Stock already zero:",
            frame_barcode
          );

        }

      } else {

        console.log(
          "Frame stock not found:",
          frame_barcode
        );

      }
    }

    // ============================================
    // RESPONSE
    // ============================================

    return res.json({
      success: true,

      message:
        "Order created and stock updated",

      order:
        result.rows[0],

      role:
        userRole,

      storeCode:
        finalStoreCode
    });

  } catch (error) {

    console.log(
      "OPTICAL ORDER CREATE ERROR:",
      error
    );

    return res.status(500).json({

      success: false,

      message:
        "Error creating order",

      error:
        error.message

    });
  }
});

router.get("/delete-history", async(req,res)=>{

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



const result = await pool.query(

`
SELECT *

FROM delete_history

WHERE store_code=$1

AND is_restored=false

AND
(
record_no ILIKE $2
OR customer_name ILIKE $2
OR module ILIKE $2
)

ORDER BY deleted_at DESC

`,
[
storeCode,
`%${search}%`
]

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

error:error.message

});

}

});


// ============================================================
// GET NEXT OPTICAL BILL NUMBER
// GET /opticalorders/next-bill-number?storeCode=STORE001
// ============================================================

router.get("/next-bill-number", async (req, res) => {
  try {
    const { storeCode } = req.query;

    if (!storeCode) {
      return res.status(400).json({
        success: false,
        message: "storeCode is required",
      });
    }

    const result = await pool.query(
      `
      SELECT MAX(
        CASE
          WHEN bill_number ~ '^[0-9]+$'
          THEN CAST(bill_number AS INTEGER)
          ELSE NULL
        END
      ) AS max_bill_number
      FROM optical_orders
      WHERE store_code = $1
      `,
      [storeCode]
    );

    const maxBillNumber = result.rows[0].max_bill_number;

    // No previous bill exists
    if (maxBillNumber === null) {
      return res.json({
        success: true,
        previousBillNumber: null,
        nextBillNumber: null,
        message: "No previous bill found. Enter first bill number manually.",
      });
    }

    const nextBillNumber = Number(maxBillNumber) + 1;

    return res.json({
      success: true,
      previousBillNumber: Number(maxBillNumber),
      nextBillNumber,
    });

  } catch (error) {
    console.error("NEXT BILL NUMBER ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to get next bill number",
      error: error.message,
    });
  }
});

/*
GET SINGLE ORDER
*/


router.get("/:id",async(req,res)=>{


try{


const result=await pool.query(

`

SELECT *

FROM optical_orders

WHERE id=$1

`,

[
req.params.id
]

);



res.json({

success:true,

order:result.rows[0]

});


}

catch(error){


console.log(error);


res.status(500).json({

success:false,
message:"Error fetching order"

});


}


});

router.put("/payment/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const {
      advance_paid,
      balance_paid_date
    } = req.body;

    // Get order total amount
    const orderResult = await pool.query(
      `
      SELECT total_amount
      FROM optical_orders
      WHERE id = $1
      `,
      [id]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    const totalAmount = Number(
      orderResult.rows[0].total_amount || 0
    );

    const paidAmount = Number(
      advance_paid || 0
    );

    // Calculate balance
    const balanceAmount = Math.max(
      totalAmount - paidAmount,
      0
    );

    // Payment status
    const paymentStatus =
      paidAmount >= totalAmount
        ? "Paid"
        : "Due";

    // Order status
    const orderStatus =
      paidAmount >= totalAmount
        ? "Completed"
        : "Pending";

    // Save balance paid date ONLY when fully paid
    const paidDate =
      paidAmount >= totalAmount
        ? (balance_paid_date || new Date())
        : null;

    await pool.query(
      `
      UPDATE optical_orders
      SET
        advance_paid = $1,
        balance_amount = $2,
        payment_status = $3,
        status = $4,
        balance_paid_date = $5
      WHERE id = $6
      `,
      [
        paidAmount,
        balanceAmount,
        paymentStatus,
        orderStatus,
        paidDate,
        id,
      ]
    );

    res.json({
      success: true,

      payment_status: paymentStatus,

      status: orderStatus,

      advance_paid: paidAmount,

      balance_amount: balanceAmount,

      balance_paid_date: paidDate,
    });

  } catch (err) {

    console.log(
      "Payment update error:",
      err
    );

    res.status(500).json({
      success: false,
      message: "Payment update failed",
    });
  }
});
/*
UPDATE ORDER STATUS
*/


router.put("/:id/status",async(req,res)=>{


try{


const {
status
}=req.body;



const result=await pool.query(

`

UPDATE optical_orders

SET status=$1

WHERE id=$2

RETURNING *

`,

[
status,
req.params.id
]


);



res.json({

success:true,

order:result.rows[0]

});


}

catch(error){

console.log(error);


res.status(500).json({

success:false,
message:"Error updating status"

});

}


});




router.put("/orders/delete/:id", async(req,res)=>{

try{

const { id } = req.params;

const { deleted_by, storeCode } = req.body;


if(!storeCode){
  return res.status(400).json({
    success:false,
    message:"Store code missing"
  });
}


// Soft delete order

await pool.query(
`
UPDATE optical_orders

SET
is_deleted=true,
deleted_at=NOW(),
deleted_by=$1

WHERE id=$2
AND store_code=$3

`,
[
deleted_by,
id,
storeCode
]
);



// Save into delete history

await pool.query(
`
INSERT INTO delete_history
(
module,
record_id,
record_no,
customer_name,
deleted_by,
store_code
)

SELECT

'Optical Sales',
id,
order_no,
patient_name,
$1,
store_code

FROM optical_orders

WHERE id=$2
AND store_code=$3

`,
[
deleted_by,
id,
storeCode
]
);



res.json({

success:true,

message:"Order moved to delete history"

});


}

catch(error){

console.log("DELETE ERROR:",error);

res.status(500).json({

success:false,
error:error.message

});

}

});
// =====================================
// GET DELETE HISTORY BY STORE
// =====================================


// =====================================
// RESTORE OPTICAL ORDER
// =====================================

router.put("/orders/restore/:id", async(req,res)=>{


try{


const {id}=req.params;


const {
storeCode
}=req.body;



if(!storeCode){

return res.status(400).json({

success:false,

message:"Store code required"

});

}




// Restore order

await pool.query(

`
UPDATE optical_orders

SET

is_deleted=false,

deleted_at=NULL,

deleted_by=NULL

WHERE id=$1

AND store_code=$2

`,
[
id,
storeCode
]

);




// Update history

await pool.query(

`
UPDATE delete_history

SET

is_restored=true

WHERE record_id=$1

AND store_code=$2

`,
[
id,
storeCode
]

);



res.json({

success:true,

message:"Order restored successfully"

});


}


catch(error){

console.log(error);


res.status(500).json({

success:false,

error:error.message

});

}


});

module.exports=router;