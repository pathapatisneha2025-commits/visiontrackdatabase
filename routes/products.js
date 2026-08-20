const express = require("express");
const router = express.Router();

const pool = require("../db");

const multer = require("multer");

const { Readable } = require("stream");

const cloudinary = require("../cloudinary");

// ======================================================
// MULTER MEMORY STORAGE
// ======================================================

const storage = multer.memoryStorage();

const upload = multer({
  storage,
});

// ======================================================
// CLOUDINARY UPLOAD FUNCTION
// ======================================================

const uploadToCloudinary = (buffer) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "master_products",
      },

      (error, result) => {
        if (result) {
          resolve(result);
        } else {
          reject(error);
        }
      }
    );

    const readable = new Readable();

    readable._read = () => {};

    readable.push(buffer);
    readable.push(null);

    readable.pipe(stream);
  });
};



// ============================================================
// ADD PRODUCT
// PRODUCT WILL ALWAYS GO TO SUPER ADMIN AS PENDING
// ============================================================

router.post(
  "/add",
  upload.any(),
  async (req, res) => {
    try {
      const {
        store_code,
        category_id,
        brand_id,
        product_name,
        description,
        variants,
      } = req.body;

      // ======================================================
      // VALIDATION
      // ======================================================

      if (!store_code || !String(store_code).trim()) {
        return res.status(400).json({
          success: false,
          message: "Store code is required",
        });
      }

      if (!category_id) {
        return res.status(400).json({
          success: false,
          message: "Category is required",
        });
      }

      if (!brand_id) {
        return res.status(400).json({
          success: false,
          message: "Brand is required",
        });
      }

      if (!product_name || !product_name.trim()) {
        return res.status(400).json({
          success: false,
          message: "Product name is required",
        });
      }

      // ======================================================
      // CHECK STORE USING STORE CODE
      // ======================================================

      const storeResult = await pool.query(
        `
        SELECT
          id,
          store_code,
          store_name
        FROM stores
        WHERE store_code = $1
        LIMIT 1
        `,
        [String(store_code).trim()]
      );

      if (storeResult.rows.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid store code",
        });
      }

      const store = storeResult.rows[0];

      // ======================================================
      // USE DATABASE STORE CODE
      // ======================================================

      const finalStoreCode =
        store.store_code;

      // ======================================================
      // UPLOAD VARIANT IMAGES
      // ======================================================

      let uploadedImages = {};

      if (
        req.files &&
        req.files.length > 0
      ) {
        for (const file of req.files) {
          try {
            const result =
              await uploadToCloudinary(
                file.buffer
              );

            uploadedImages[
              file.fieldname
            ] = result.secure_url;

          } catch (uploadError) {
            console.log(
              "CLOUDINARY UPLOAD ERROR",
              uploadError
            );

            return res.status(500).json({
              success: false,
              message:
                "Failed to upload product image",
            });
          }
        }
      }

      // ======================================================
      // CONVERT VARIANTS
      // ======================================================

      let finalVariants = [];

      if (variants) {
        try {
          const parsedVariants =
            typeof variants === "string"
              ? JSON.parse(variants)
              : variants;

          if (Array.isArray(parsedVariants)) {
            finalVariants =
              parsedVariants.map(
                (v, index) => ({
                  color:
                    v.color || "",

                  price:
                    v.price || "",

                  sku:
                    v.sku || "",

                  image:
                    uploadedImages[
                      `variant_images_${index}`
                    ] ||
                    v.existingImage ||
                    "",
                })
              );
          }
        } catch (variantError) {
          console.log(
            "VARIANTS PARSE ERROR",
            variantError
          );

          return res.status(400).json({
            success: false,
            message:
              "Invalid variants data",
          });
        }
      }

      // ======================================================
      // INSERT PRODUCT
      //
      // Store sends only store_code.
      // Backend gets store.id internally.
      //
      // ALWAYS PENDING
      // Store CANNOT APPROVE ITS OWN PRODUCT
      // ======================================================

      const data = await pool.query(
        `
        INSERT INTO master_products
        (
          store_id,
          store_code,

          category_id,
          brand_id,

          product_name,
          description,
          variants,

          approval_status,
          approved_by,
          approved_at,
          rejection_reason,

          created_at
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

          'pending',
          NULL,
          NULL,
          NULL,

          CURRENT_TIMESTAMP
        )

        RETURNING *
        `,
        [
          // Backend gets this internally
          store.id,

          // Frontend supplied store_code,
          // but we use the verified DB value
          finalStoreCode,

          category_id,
          brand_id,

          product_name.trim(),
          description || "",

          JSON.stringify(finalVariants),
        ]
      );

      // ======================================================
      // RESPONSE
      // ======================================================

      return res.status(201).json({
        success: true,

        message:
          "Product added successfully and sent to Super Admin for approval.",

        approval_status: "pending",

        store_code: finalStoreCode,

        data: data.rows[0],
      });

    } catch (error) {
      console.log(
        "ADD PRODUCT ERROR",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Server Error while adding product",

        error:
          process.env.NODE_ENV === "development"
            ? error.message
            : undefined,
      });
    }
  }
);
// ======================================================
// GET ALL PRODUCTS
// ======================================================
// This returns ALL products.
// Useful for Admin/Super Admin.
// ======================================================

router.get(
  "/all",
  async (req, res) => {
    try {
      const result =
        await pool.query(
          `
          SELECT
            mp.*,

            c.name AS category,

            b.name AS brand

          FROM master_products mp

          LEFT JOIN categories c
            ON c.id = mp.category_id

          LEFT JOIN brands b
            ON b.id = mp.brand_id

          ORDER BY mp.id DESC
          `
        );

      return res.json({
        success: true,
        data: result.rows,
      });
    } catch (error) {
      console.log(
        "GET ALL PRODUCTS ERROR",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to fetch products",
      });
    }
  }
);

// ======================================================
// GET PENDING PRODUCTS
// ======================================================
// Admin/Super Admin approval screen uses this.
// ======================================================

router.get(
  "/pending",
  async (req, res) => {
    try {
      const result =
        await pool.query(
          `
          SELECT
            mp.*,

            c.name AS category,

            b.name AS brand

          FROM master_products mp

          LEFT JOIN categories c
            ON c.id = mp.category_id

          LEFT JOIN brands b
            ON b.id = mp.brand_id

          WHERE mp.approval_status = 'pending'

          ORDER BY mp.id DESC
          `
        );

      return res.json({
        success: true,

        count: result.rows.length,

        data: result.rows,
      });
    } catch (error) {
      console.log(
        "GET PENDING PRODUCTS ERROR",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to fetch pending products",
      });
    }
  }
);

// ======================================================
// GET APPROVED PRODUCTS
// ======================================================
// Customer/store product listing should use this API.
// ======================================================

router.get(
  "/approved",
  async (req, res) => {
    try {
      const result =
        await pool.query(
          `
          SELECT
            mp.*,

            c.name AS category,

            b.name AS brand

          FROM master_products mp

          LEFT JOIN categories c
            ON c.id = mp.category_id

          LEFT JOIN brands b
            ON b.id = mp.brand_id

          WHERE mp.approval_status = 'approved'

          ORDER BY mp.id DESC
          `
        );

      return res.json({
        success: true,
        data: result.rows,
      });
    } catch (error) {
      console.log(
        "GET APPROVED PRODUCTS ERROR",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to fetch approved products",
      });
    }
  }
);

// ======================================================
// APPROVE / REJECT PRODUCT
// ======================================================
// ONE ROUTE FOR BOTH
//
// PUT /products/approval/:id
//
// Approve:
// {
//   "status": "approved",
//   "approved_by": 1
// }
//
// Reject:
// {
//   "status": "rejected",
//   "approved_by": 1,
//   "rejection_reason": "Invalid product details"
// }
// ======================================================

router.put(
  "/approval/:id",
  async (req, res) => {
    try {
      const productId =
        req.params.id;

      const {
        status,
        approved_by,
        rejection_reason,
      } = req.body;

      // ==================================================
      // VALID STATUS
      // ==================================================

      if (
        status !== "approved" &&
        status !== "rejected"
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Status must be approved or rejected",
        });
      }

      // ==================================================
      // CHECK PRODUCT
      // ==================================================

      const existing =
        await pool.query(
          `
          SELECT *
          FROM master_products
          WHERE id = $1
          `,
          [productId]
        );

      if (
        existing.rows.length === 0
      ) {
        return res.status(404).json({
          success: false,
          message:
            "Product not found",
        });
      }

      // ==================================================
      // APPROVE
      // ==================================================

      if (status === "approved") {
        const result =
          await pool.query(
            `
            UPDATE master_products

            SET
              approval_status = 'approved',

              approved_by = $1,

              approved_at =
                CURRENT_TIMESTAMP,

              rejection_reason = NULL

            WHERE id = $2

            RETURNING *
            `,
            [
              approved_by || null,
              productId,
            ]
          );

        return res.json({
          success: true,

          message:
            "Product approved successfully",

          approval_status:
            "approved",

          data: result.rows[0],
        });
      }

      // ==================================================
      // REJECT
      // ==================================================

      if (status === "rejected") {
        const result =
          await pool.query(
            `
            UPDATE master_products

            SET
              approval_status = 'rejected',

              approved_by = NULL,

              approved_at = NULL,

              rejection_reason = $1

            WHERE id = $2

            RETURNING *
            `,
            [
              rejection_reason ||
                "Rejected by Admin",
              productId,
            ]
          );

        return res.json({
          success: true,

          message:
            "Product rejected successfully",

          approval_status:
            "rejected",

          data: result.rows[0],
        });
      }
    } catch (error) {
      console.log(
        "PRODUCT APPROVAL ERROR",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to update product approval status",
      });
    }
  }
);

// ======================================================
// GET PRODUCT BY ID
// ======================================================

router.get(
  "/:id",
  async (req, res) => {
    try {
      const result =
        await pool.query(
          `
          SELECT

            mp.*,

            c.name AS category,

            b.name AS brand

          FROM master_products mp

          LEFT JOIN categories c
            ON c.id = mp.category_id

          LEFT JOIN brands b
            ON b.id = mp.brand_id

          WHERE mp.id = $1
          `,
          [req.params.id]
        );

      if (
        result.rows.length === 0
      ) {
        return res.status(404).json({
          success: false,
          message:
            "Product not found",
        });
      }

      return res.json({
        success: true,
        data: result.rows[0],
      });
    } catch (error) {
      console.log(
        "GET PRODUCT ERROR",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to fetch product",
      });
    }
  }
);

// ======================================================
// UPDATE PRODUCT WITH VARIANTS
// ======================================================
// IMPORTANT:
// If an approved product is edited,
// it goes back to PENDING.
// Admin must approve it again.
// ======================================================

router.put(
  "/update/:id",
  upload.any(),
  async (req, res) => {
    try {
      const id =
        req.params.id;

      const {
        category_id,
        brand_id,
        product_name,
        description,
        variants,
      } = req.body;

      // ==================================================
      // CHECK PRODUCT
      // ==================================================

      const oldProduct =
        await pool.query(
          `
          SELECT *
          FROM master_products
          WHERE id = $1
          `,
          [id]
        );

      if (
        oldProduct.rows.length === 0
      ) {
        return res.status(404).json({
          success: false,
          message:
            "Product not found",
        });
      }

      // ==================================================
      // VALIDATION
      // ==================================================

      if (!category_id) {
        return res.status(400).json({
          success: false,
          message:
            "Category is required",
        });
      }

      if (!brand_id) {
        return res.status(400).json({
          success: false,
          message:
            "Brand is required",
        });
      }

      if (
        !product_name ||
        !product_name.trim()
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Product name is required",
        });
      }

      // ==================================================
      // UPLOAD NEW VARIANT IMAGES
      // ==================================================

      let uploadedImages = {};

      if (
        req.files &&
        req.files.length > 0
      ) {
        for (const file of req.files) {
          try {
            const result =
              await uploadToCloudinary(
                file.buffer
              );

            uploadedImages[
              file.fieldname
            ] =
              result.secure_url;
          } catch (uploadError) {
            console.log(
              "CLOUDINARY UPDATE IMAGE ERROR",
              uploadError
            );

            return res.status(500).json({
              success: false,
              message:
                "Failed to upload product image",
            });
          }
        }
      }

      // ==================================================
      // PREPARE VARIANTS
      // ==================================================

      let finalVariants = [];

      if (variants) {
        try {
          const parsedVariants =
            typeof variants ===
            "string"
              ? JSON.parse(variants)
              : variants;

          if (Array.isArray(parsedVariants)) {
            finalVariants =
              parsedVariants.map(
                (v, index) => ({
                  color:
                    v.color || "",

                  price:
                    v.price || "",

                  sku:
                    v.sku || "",

                  image:
                    uploadedImages[
                      `variant_images_${index}`
                    ] ||
                    v.existingImage ||
                    "",
                })
              );
          }
        } catch (variantError) {
          console.log(
            "UPDATE VARIANTS PARSE ERROR",
            variantError
          );

          return res.status(400).json({
            success: false,
            message:
              "Invalid variants data",
          });
        }
      }

      // ==================================================
      // UPDATE PRODUCT
      // ==================================================
      //
      // IMPORTANT:
      // Editing always resets approval to pending.
      // ==================================================

      const updated =
        await pool.query(
          `
          UPDATE master_products

          SET

            category_id = $1,

            brand_id = $2,

            product_name = $3,

            description = $4,

            variants = $5,

            approval_status = 'pending',

            approved_by = NULL,

            approved_at = NULL,

            rejection_reason = NULL

          WHERE id = $6

          RETURNING *
          `,
          [
            category_id,
            brand_id,
            product_name.trim(),
            description || "",
            JSON.stringify(
              finalVariants
            ),
            id,
          ]
        );

      return res.json({
        success: true,

        message:
          "Product updated successfully and sent for Admin approval.",

        approval_status:
          "pending",

        data: updated.rows[0],
      });
    } catch (error) {
      console.log(
        "UPDATE PRODUCT ERROR",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Server Error while updating product",
      });
    }
  }
);

// ======================================================
// DELETE PRODUCT
// ======================================================

router.delete(
  "/delete/:id",
  async (req, res) => {
    try {
      const result =
        await pool.query(
          `
          DELETE FROM master_products

          WHERE id = $1

          RETURNING *
          `,
          [req.params.id]
        );

      if (
        result.rows.length === 0
      ) {
        return res.status(404).json({
          success: false,
          message:
            "Product not found",
        });
      }

      return res.json({
        success: true,
        message:
          "Product Deleted",
      });
    } catch (error) {
      console.log(
        "DELETE PRODUCT ERROR",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to delete product",
      });
    }
  }
);

// ======================================================
// ADD REVIEW
// ======================================================

router.post(
  "/addreview",
  async (req, res) => {
    try {
      const {
        product_id,
        customer_name,
        rating,
        review,
      } = req.body;

      if (
        !product_id ||
        !customer_name ||
        !rating ||
        !review
      ) {
        return res.status(400).json({
          success: false,
          message:
            "All fields required",
        });
      }

      const result =
        await pool.query(
          `
          INSERT INTO product_reviews
          (
            product_id,
            customer_name,
            rating,
            review
          )

          VALUES
          (
            $1,
            $2,
            $3,
            $4
          )

          RETURNING *
          `,
          [
            product_id,
            customer_name,
            rating,
            review,
          ]
        );

      return res.json({
        success: true,

        message:
          "Review added successfully",

        data: result.rows[0],
      });
    } catch (error) {
      console.log(
        "ADD REVIEW ERROR",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Server error",
      });
    }
  }
);

// ======================================================
// GET REVIEWS BY PRODUCT
// ======================================================

router.get(
  "/reviews/:productId",
  async (req, res) => {
    try {
      const {
        productId,
      } = req.params;

      const result =
        await pool.query(
          `
          SELECT

            id,

            product_id,

            customer_name,

            rating,

            review,

            created_at

          FROM product_reviews

          WHERE product_id = $1

          ORDER BY created_at DESC
          `,
          [productId]
        );

      return res.json({
        success: true,
        data: result.rows,
      });
    } catch (error) {
      console.log(
        "GET REVIEWS ERROR",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to fetch reviews",
      });
    }
  }
);

// ======================================================
// EXPORT
// ======================================================

module.exports = router;