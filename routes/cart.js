const express = require("express");

const router = express.Router();

const pool = require("../db");




// ===============================
// ADD TO CART
// ===============================

router.post("/add", async (req, res) => {
  try {
    const {
      store_code,
      product_id,
      product_name,
      brand,
      category,
      image,
      price,
      color,
      sku,
      quantity
    } = req.body;

    // Make sure quantity is always at least 1
    const qty = Math.max(1, Number(quantity) || 1);

    const selectedColor = color || "";

    // Check same product + same color
    const check = await pool.query(
      `
      SELECT *
      FROM vcart_items
      WHERE store_code = $1
        AND product_id = $2
        AND COALESCE(color, '') = $3
      `,
      [
        store_code,
        product_id,
        selectedColor
      ]
    );

    if (check.rows.length > 0) {

      // Add requested quantity
      await pool.query(
        `
        UPDATE vcart_items
        SET quantity = quantity + $1
        WHERE store_code = $2
          AND product_id = $3
          AND COALESCE(color, '') = $4
        `,
        [
          qty,
          store_code,
          product_id,
          selectedColor
        ]
      );

    } else {

      // Create new cart item with requested quantity
      await pool.query(
        `
        INSERT INTO vcart_items
        (
          store_code,
          product_id,
          product_name,
          brand,
          category,
          image,
          price,
          color,
          sku,
          quantity
        )
        VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        `,
        [
          store_code,
          product_id,
          product_name,
          brand,
          category,
          image,
          price,
          selectedColor,
          sku || "",
          qty
        ]
      );
    }

    res.json({
      success: true,
      message: `Added ${qty} item(s) to cart`,
      quantity: qty,
      color: selectedColor
    });

  } catch (error) {

    console.log("ADD CART ERROR", error);

    res.status(500).json({
      success: false,
      message: "Failed to add product to cart"
    });
  }
});







// ===============================
// GET CART BY STORE
// ===============================


router.get("/:store_code",async(req,res)=>{


try{


const result = await pool.query(

`
SELECT *

FROM vcart_items

WHERE store_code=$1

ORDER BY id DESC

`,
[
req.params.store_code
]

);



res.json({

success:true,

data:result.rows

});


}
catch(error){


console.log(
"GET CART ERROR",
error
);


res.status(500).json({

success:false

});


}


});










// ===============================
// CART COUNT BY STORE
// ===============================


router.get("/count/:store_code",async(req,res)=>{


try{


const result = await pool.query(

`
SELECT COALESCE(SUM(quantity),0) AS count

FROM vcart_items

WHERE store_code=$1

`,
[
req.params.store_code
]

);



res.json({

success:true,

count:Number(
result.rows[0].count
)

});


}
catch(error){


console.log(
"CART COUNT ERROR",
error
);


res.status(500).json({

success:false

});


}


});









// ===============================
// UPDATE QUANTITY
// ===============================


router.put("/quantity/:id",async(req,res)=>{


try{


const {
quantity
}=req.body;



await pool.query(

`
UPDATE vcart_items

SET quantity=$1

WHERE id=$2

`,
[
quantity,
req.params.id
]

);



res.json({

success:true,

message:"Quantity updated"

});


}
catch(error){


console.log(error);


res.status(500).json({

success:false

});


}


});









// ===============================
// REMOVE ITEM
// ===============================


router.delete("/:id",async(req,res)=>{


try{


await pool.query(

`
DELETE FROM vcart_items

WHERE id=$1

`,
[
req.params.id
]

);



res.json({

success:true,

message:"Removed"

});


}
catch(error){


console.log(error);


res.status(500).json({

success:false

});


}


});




module.exports = router;