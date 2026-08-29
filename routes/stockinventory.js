const express = require("express");
const router = express.Router();

const pool = require("../db");
const bwipjs = require("bwip-js");



/*

/*
===========================================================
GENERATE BARCODE
===========================================================

Sequence:

101
102
103
104
105
...
109
110
111
112
...
999

Always exactly 3 digits.
Starts from 101.
No 001, 002, 003...
===========================================================
*/

const generateBarcode = async (storeCode) => {
  try {
    const result = await pool.query(
      `
      SELECT barcode
      FROM stock_inventory
      WHERE store_code = $1
        AND barcode ~ '^[0-9]{3}$'
        AND CAST(barcode AS INTEGER) >= 101
      ORDER BY CAST(barcode AS INTEGER) DESC
      LIMIT 1
      `,
      [storeCode]
    );

    let nextNumber = 101;

    if (result.rows.length > 0) {
      const lastBarcode = parseInt(result.rows[0].barcode, 10);

      if (!isNaN(lastBarcode)) {
        nextNumber = lastBarcode + 1;
      }
    }

    // Maximum barcode is 999
    if (nextNumber > 999) {
      throw new Error("Maximum 3-digit barcode limit reached");
    }

    return String(nextNumber);

  } catch (error) {
    console.error("Barcode generation error:", error);
    throw error;
  }
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
router.post("/add", async (req, res) => {
  try {
    const body = req.body;

    const {
      storeCode,
      role,

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
    } = body;

    /* =========================================================
       ROLE
    ========================================================= */

    // If you have authentication middleware, prefer:
    // const userRole = req.user?.role || role;

    const userRole = req.user?.role || role;

    const isSuperAdmin =
      String(userRole || "").toLowerCase().replace(/[\s_-]/g, "") ===
      "superadmin";

    /* =========================================================
       VALIDATION
    ========================================================= */

    if (!category) {
      return res.status(400).json({
        success: false,
        message: "Category is required"
      });
    }

    if (!brand || !String(brand).trim()) {
      return res.status(400).json({
        success: false,
        message: "Brand is required"
      });
    }

    if (
      quantity === undefined ||
      quantity === null ||
      quantity === ""
    ) {
      return res.status(400).json({
        success: false,
        message: "Quantity is required"
      });
    }

    const quantityNumber = Number(quantity);

    if (
      !Number.isInteger(quantityNumber) ||
      quantityNumber <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Quantity must be a whole number greater than 0"
      });
    }

    /* =========================================================
       STORE CODE LOGIC
    ========================================================= */

    let finalStoreCode = storeCode || null;

    /*
      SUPER ADMIN
      ------------
      Super Admin can add stock without selecting a store.

      Example:
      storeCode = null
      role = "super_admin"

      Database:
      store_code = NULL
    */

    if (isSuperAdmin) {
      finalStoreCode = storeCode || null;
    }

    /*
      OTHER ROLES
      -----------
      Store-specific users must provide storeCode.
    */

    else {
      if (!storeCode || !String(storeCode).trim()) {
        return res.status(400).json({
          success: false,
          message: "Store code is required"
        });
      }

      finalStoreCode = String(storeCode).trim();
    }

    /* =========================================================
       GENERATE BARCODE
    ========================================================= */

    let finalBarcode = barcode;

    if (!finalBarcode) {
      /*
        Important:
        If Super Admin has no storeCode, don't pass undefined
        into generateBarcode().
      */

      finalBarcode = await generateBarcode(
        finalStoreCode || null
      );
    }

    if (!finalBarcode) {
      return res.status(500).json({
        success: false,
        message: "Unable to generate barcode"
      });
    }

    /* =========================================================
       GENERATE BARCODE IMAGE
    ========================================================= */

    let barcodeImage = null;

    try {
      const png = await bwipjs.toBuffer({
        bcid: "code128",
        text: String(finalBarcode),
        scale: 3,
        height: 12,
        includetext: true,
        textxalign: "center"
      });

      barcodeImage =
        `data:image/png;base64,${png.toString("base64")}`;

    } catch (err) {
      console.log(
        "Barcode image generation error:",
        err
      );
    }

    /* =========================================================
       INSERT STOCK
    ========================================================= */

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
        finalStoreCode,
        category,
        finalBarcode,
        String(brand).trim(),

        frame_name || null,
        model || null,
        color || null,
        size || null,
        material || null,
        gender || null,

        lens_type || null,
        power_range || null,
        coating || null,
        lens_index || null,

        contact_type || null,
        power || null,
        base_curve || null,
        diameter || null,
        expiry_date || null,

        accessory_name || null,

        Number(purchase_price) || 0,
        Number(selling_price) || 0,
        quantityNumber
      ]
    );

    /* =========================================================
       SUCCESS
    ========================================================= */

    return res.status(201).json({
      success: true,
      message: isSuperAdmin
        ? "Stock added successfully by Super Admin"
        : "Stock added successfully",

      role: userRole || null,

      storeCode: finalStoreCode,

      barcode: finalBarcode,

      barcodeImage,

      stock: result.rows[0]
    });

  } catch (error) {
    console.error(
      "ADD STOCK ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Stock adding failed",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : undefined
    });
  }
});
/* =========================================================
   GET ALL SUPER ADMIN STOCK
   ========================================================= */

router.get("/super-admin/all", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT *
      FROM stock_inventory
      WHERE LOWER(role) = 'super_admin'
      ORDER BY id DESC
    `);

    return res.status(200).json({
      success: true,
      count: result.rows.length,
      stocks: result.rows
    });

  } catch (error) {
    console.error(
      "GET SUPER ADMIN STOCK ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to fetch Super Admin stock"
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


/*
GET STOCK BY BARCODE WITH STORE CHECK
*/

router.get("/barcode/:barcode", async(req,res)=>{

try{

const {
    barcode
}=req.params;


const {
    storeCode
}=req.query;



const result = await pool.query(

`
SELECT *

FROM stock_inventory

WHERE barcode=$1

AND store_code=$2
`,

[
    barcode,
    storeCode
]

);



if(result.rows.length === 0){

return res.json({

    success:false,

    message:"Barcode not found"

});

}




res.json({

success:true,

item:result.rows[0]

});


}


catch(error){

console.log("Barcode lookup error:",error);


res.status(500).json({

success:false,

message:"Failed to get inventory item"

});


}


});



module.exports = router;