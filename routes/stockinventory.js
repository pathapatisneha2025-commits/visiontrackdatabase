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
const generateBarcode = async (storeCode = null) => {
  try {
    let result;

    /* =========================================================
       SUPER ADMIN
       storeCode = NULL
       
       Generate barcode from Super Admin stock only
       where store_code IS NULL
    ========================================================= */

    if (
      storeCode === null ||
      storeCode === undefined ||
      String(storeCode).trim() === ""
    ) {
      result = await pool.query(`
        SELECT barcode
        FROM stock_inventory
        WHERE store_code IS NULL
          AND barcode ~ '^[0-9]{3}$'
          AND CAST(barcode AS INTEGER) >= 101
        ORDER BY CAST(barcode AS INTEGER) DESC
        LIMIT 1
      `);
    }

    /* =========================================================
       NORMAL STORE
       
       Generate barcode from that store only
    ========================================================= */

    else {
      result = await pool.query(
        `
        SELECT barcode
        FROM stock_inventory
        WHERE store_code = $1
          AND barcode ~ '^[0-9]{3}$'
          AND CAST(barcode AS INTEGER) >= 101
        ORDER BY CAST(barcode AS INTEGER) DESC
        LIMIT 1
        `,
        [String(storeCode).trim()]
      );
    }

    /* =========================================================
       START BARCODE
    ========================================================= */

    let nextNumber = 101;

    if (result.rows.length > 0) {
      const lastBarcode = parseInt(
        result.rows[0].barcode,
        10
      );

      if (!isNaN(lastBarcode)) {
        nextNumber = lastBarcode + 1;
      }
    }

    /* =========================================================
       MAXIMUM
    ========================================================= */

    if (nextNumber > 999) {
      throw new Error(
        "Maximum 3-digit barcode limit reached"
      );
    }

    return String(nextNumber);

  } catch (error) {
    console.error(
      "Barcode generation error:",
      error
    );

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
    const body = req.body || {};

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

    const requestRole = String(
      role || req.user?.role || ""
    )
      .trim()
      .toLowerCase()
      .replace(/[\s_-]/g, "");

    const isSuperAdmin =
      requestRole === "superadmin";

    const finalRole = isSuperAdmin
      ? "superadmin"
      : requestRole || "admin";

    /* =========================================================
       STORE CODE
       
       SUPER ADMIN:
         store_code = NULL

       NORMAL USER:
         use provided storeCode
    ========================================================= */

    let finalStoreCode = null;

    if (!isSuperAdmin) {
      if (
        storeCode !== undefined &&
        storeCode !== null &&
        String(storeCode).trim() !== ""
      ) {
        finalStoreCode = String(storeCode).trim();
      }
    }

    /* =========================================================
       DEBUG
    ========================================================= */

    console.log("====================================");
    console.log("ADD STOCK");
    console.log("====================================");

    console.log("REQUEST BODY:", body);

    console.log("REQUEST ROLE:", role);
    console.log(
      "AUTH ROLE:",
      req.user?.role || null
    );

    console.log(
      "NORMALIZED ROLE:",
      requestRole
    );

    console.log(
      "FINAL ROLE:",
      finalRole
    );

    console.log(
      "IS SUPER ADMIN:",
      isSuperAdmin
    );

    console.log(
      "REQUEST STORE CODE:",
      storeCode
    );

    console.log(
      "FINAL STORE CODE:",
      finalStoreCode
    );

    console.log("====================================");

    /* =========================================================
       CATEGORY VALIDATION
    ========================================================= */

    if (
      !category ||
      !String(category).trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Category is required"
      });
    }

    /* =========================================================
       BRAND VALIDATION
    ========================================================= */

    if (
      !brand ||
      !String(brand).trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Brand is required"
      });
    }

    /* =========================================================
       QUANTITY VALIDATION
    ========================================================= */

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
        message:
          "Quantity must be a whole number greater than 0"
      });
    }

    /* =========================================================
       PRICE VALUES
    ========================================================= */

    const purchasePriceNumber =
      purchase_price === "" ||
      purchase_price === undefined ||
      purchase_price === null
        ? 0
        : Number(purchase_price);

    const sellingPriceNumber =
      selling_price === "" ||
      selling_price === undefined ||
      selling_price === null
        ? 0
        : Number(selling_price);

    /* =========================================================
       BARCODE
       
       SUPER ADMIN:
         generate barcode independently

       NORMAL STORE:
         generate barcode for that store
    ========================================================= */

    let finalBarcode = barcode;

    if (
      !finalBarcode ||
      !String(finalBarcode).trim()
    ) {
      finalBarcode =
        await generateBarcode(finalStoreCode);
    }

    /* =========================================================
       BARCODE VALIDATION
    ========================================================= */

    if (
      !finalBarcode ||
      !String(finalBarcode).trim()
    ) {
      return res.status(500).json({
        success: false,
        message: "Unable to generate barcode"
      });
    }

    finalBarcode =
      String(finalBarcode).trim();

    /* =========================================================
       GENERATE BARCODE IMAGE
    ========================================================= */

    let barcodeImage = null;

    try {
      const png =
        await bwipjs.toBuffer({
          bcid: "code128",

          text: String(finalBarcode),

          scale: 3,

          height: 12,

          includetext: true,

          textxalign: "center"
        });

      barcodeImage =
        `data:image/png;base64,${png.toString(
          "base64"
        )}`;

    } catch (barcodeImageError) {
      console.error(
        "BARCODE IMAGE ERROR:",
        barcodeImageError
      );
    }

    /* =========================================================
       INSERT STOCK
       
       IMPORTANT:
       rack_for_lenses REMOVED because that column
       does not exist in stock_inventory.
    ========================================================= */

    
const result = await pool.query(
  `
  INSERT INTO stock_inventory
  (
    role,
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
    $1,
    $2,
    $3,
    $4,
    $5,

    $6,
    $7,
    $8,
    $9,
    $10,
    $11,

    $12,
    $13,
    $14,
    $15,

    $16,
    $17,
    $18,
    $19,
    $20,

    $21,

    $22,
    $23,
    $24
  )

  RETURNING *
  `,
  [
    /* =====================================================
       1 - ROLE
    ===================================================== */

    finalRole,

    /* =====================================================
       2 - STORE CODE
    ===================================================== */

    finalStoreCode,

    /* =====================================================
       3 - CATEGORY
    ===================================================== */

    String(category).trim(),

    /* =====================================================
       4 - BARCODE
    ===================================================== */

    finalBarcode,

    /* =====================================================
       5 - BRAND
    ===================================================== */

    String(brand).trim(),

    /* =====================================================
       6 - 11
       FRAME
    ===================================================== */

    frame_name
      ? String(frame_name).trim()
      : null,

    model
      ? String(model).trim()
      : null,

    color
      ? String(color).trim()
      : null,

    size
      ? String(size).trim()
      : null,

    material
      ? String(material).trim()
      : null,

    gender
      ? String(gender).trim()
      : null,

    /* =====================================================
       12 - 15
       LENS
    ===================================================== */

    lens_type
      ? String(lens_type).trim()
      : null,

    power_range
      ? String(power_range).trim()
      : null,

    coating
      ? String(coating).trim()
      : null,

    lens_index
      ? String(lens_index).trim()
      : null,

    /* =====================================================
       16 - 20
       CONTACT LENS
    ===================================================== */

    contact_type
      ? String(contact_type).trim()
      : null,

    power
      ? String(power).trim()
      : null,

    base_curve
      ? String(base_curve).trim()
      : null,

    diameter
      ? String(diameter).trim()
      : null,

    expiry_date || null,

    /* =====================================================
       21 - ACCESSORY
    ===================================================== */

    accessory_name
      ? String(accessory_name).trim()
      : null,

    /* =====================================================
       22 - 24
       PRICE + QUANTITY
    ===================================================== */

    Number.isFinite(purchasePriceNumber)
      ? purchasePriceNumber
      : 0,

    Number.isFinite(sellingPriceNumber)
      ? sellingPriceNumber
      : 0,

    quantityNumber
  ]
);


    /* =========================================================
       SUCCESS
    ========================================================= */

    console.log("====================================");
    console.log("STOCK INSERT SUCCESS");
    console.log("ROLE:", finalRole);
    console.log(
      "STORE CODE:",
      finalStoreCode
    );
    console.log(
      "BARCODE:",
      finalBarcode
    );
    console.log("====================================");

    return res.status(201).json({
      success: true,

      message: isSuperAdmin
        ? "Stock added successfully by Super Admin"
        : "Stock added successfully",

      role: finalRole,

      isSuperAdmin,

      storeCode: finalStoreCode,

      barcode: finalBarcode,

      barcodeImage,

      stock: result.rows[0]
    });

  } catch (error) {

    console.error(
      "===================================="
    );

    console.error(
      "ADD STOCK ERROR:",
      error
    );

    console.error(
      "====================================");

    /* =========================================================
       DUPLICATE BARCODE
    ========================================================= */

    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message:
          "Barcode already exists. Please try again.",
        error:
          process.env.NODE_ENV === "development"
            ? error.detail
            : undefined
      });
    }

    /* =========================================================
       OTHER DATABASE ERROR
    ========================================================= */

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
      WHERE LOWER(role) = 'superadmin'
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