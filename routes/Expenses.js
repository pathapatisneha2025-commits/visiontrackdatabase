const express = require("express");
const router = express.Router();

const pool = require("../db");

/* ============================================================
   HELPERS
============================================================ */

const VALID_TYPES = ["IN", "OUT"];

const VALID_STATUS = [
  "Completed",
  "Pending",
];

const VALID_PAYMENT_MODES = [
  "Cash",
  "UPI",
  "Bank",
];


const cleanString = (value) => {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value).trim();
};


const isValidDate = (value) => {
  if (!value) return false;

  const date = new Date(value);

  return !Number.isNaN(date.getTime());
};


const normalizeDate = (value) => {
  if (!value) return null;

  const dateString = String(value).trim();

  /*
   * Accept:
   * YYYY-MM-DD
   */
  if (
    /^\d{4}-\d{2}-\d{2}$/.test(
      dateString
    )
  ) {
    return dateString;
  }

  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const year =
    date.getFullYear();

  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    date.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
};


const validateAmount = (amount) => {
  const value = Number(amount);

  if (
    !Number.isFinite(value) ||
    value <= 0
  ) {
    return null;
  }

  return value;
};


/* ============================================================
   CREATE TABLE
   ============================================================
   Optional safety function.
   The actual table should preferably be created manually
   using the SQL supplied above.
============================================================ */

const ensureTable = async () => {

  await pool.query(`
    CREATE TABLE IF NOT EXISTS expenses (
      id BIGSERIAL PRIMARY KEY,

      transaction_type VARCHAR(10) NOT NULL
        CHECK (
          transaction_type IN ('IN', 'OUT')
        ),

      transaction_date DATE NOT NULL
        DEFAULT CURRENT_DATE,

      amount NUMERIC(12, 2) NOT NULL
        CHECK (amount > 0),

      person_name VARCHAR(255) NOT NULL,

      description TEXT,

      expense_category VARCHAR(100),

      payment_mode VARCHAR(20) NOT NULL
        DEFAULT 'Cash'
        CHECK (
          payment_mode IN ('Cash', 'UPI', 'Bank')
        ),

      reference_number VARCHAR(255),

      notes TEXT,

      status VARCHAR(20) NOT NULL
        DEFAULT 'Completed'
        CHECK (
          status IN ('Completed', 'Pending')
        ),

      added_by VARCHAR(255) NOT NULL
        DEFAULT 'Admin',

      created_at TIMESTAMP NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

      updated_at TIMESTAMP NOT NULL
        DEFAULT CURRENT_TIMESTAMP
    );
  `);


  await pool.query(`
    CREATE INDEX IF NOT EXISTS
    idx_expenses_transaction_date
    ON expenses(transaction_date);
  `);


  await pool.query(`
    CREATE INDEX IF NOT EXISTS
    idx_expenses_transaction_type
    ON expenses(transaction_type);
  `);


  await pool.query(`
    CREATE INDEX IF NOT EXISTS
    idx_expenses_status
    ON expenses(status);
  `);


  await pool.query(`
    CREATE INDEX IF NOT EXISTS
    idx_expenses_payment_mode
    ON expenses(payment_mode);
  `);


  await pool.query(`
    CREATE INDEX IF NOT EXISTS
    idx_expenses_person_name
    ON expenses(person_name);
  `);


  await pool.query(`
    CREATE INDEX IF NOT EXISTS
    idx_expenses_created_at
    ON expenses(created_at DESC);
  `);
};


/* ============================================================
   UPDATE TIMESTAMP TRIGGER
============================================================ */

const ensureTrigger = async () => {

  await pool.query(`
    CREATE OR REPLACE FUNCTION
    update_expenses_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = CURRENT_TIMESTAMP;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);


  await pool.query(`
    DROP TRIGGER IF EXISTS
    expenses_updated_at_trigger
    ON expenses;
  `);


  await pool.query(`
    CREATE TRIGGER
    expenses_updated_at_trigger

    BEFORE UPDATE
    ON expenses

    FOR EACH ROW

    EXECUTE FUNCTION
    update_expenses_updated_at();
  `);
};


/* ============================================================
   INITIALIZE TABLE
============================================================ */

(async () => {

  try {

    await ensureTable();

    await ensureTrigger();

    console.log(
      "Expenses table initialized successfully"
    );

  } catch (error) {

    console.error(
      "Expenses table initialization error:",
      error
    );

  }

})();


/* ============================================================
   POST
   ADD EXPENSE / MONEY IN
============================================================ */

router.post(
  "/add",
  async (req, res) => {

    try {

      const {
        transaction_type,
        transaction_date,
        amount,
        person_name,
        description,
        expense_category,
        payment_mode,
        reference_number,
        notes,
        status,
        added_by,
      } = req.body;


      /* -----------------------------------------
         TYPE
      ----------------------------------------- */

      const type =
        cleanString(
          transaction_type
        ).toUpperCase();


      if (!VALID_TYPES.includes(type)) {

        return res.status(400).json({
          success: false,
          message:
            "transaction_type must be IN or OUT",
        });

      }


      /* -----------------------------------------
         DATE
      ----------------------------------------- */

      const date =
        normalizeDate(
          transaction_date
        );


      if (!date) {

        return res.status(400).json({
          success: false,
          message:
            "Valid transaction date is required",
        });

      }


      /* -----------------------------------------
         AMOUNT
      ----------------------------------------- */

      const validAmount =
        validateAmount(amount);


      if (!validAmount) {

        return res.status(400).json({
          success: false,
          message:
            "Amount must be greater than 0",
        });

      }


      /* -----------------------------------------
         PERSON
      ----------------------------------------- */

      const person =
        cleanString(
          person_name
        );


      if (!person) {

        return res.status(400).json({
          success: false,
          message:
            type === "IN"
              ? "Received From is required"
              : "Given To is required",
        });

      }


      /* -----------------------------------------
         PAYMENT MODE
      ----------------------------------------- */

      const payment =
        cleanString(
          payment_mode || "Cash"
        );


      if (
        !VALID_PAYMENT_MODES.includes(
          payment
        )
      ) {

        return res.status(400).json({
          success: false,
          message:
            "Payment mode must be Cash, UPI or Bank",
        });

      }


      /* -----------------------------------------
         STATUS
      ----------------------------------------- */

      const transactionStatus =
        cleanString(
          status || "Completed"
        );


      if (
        !VALID_STATUS.includes(
          transactionStatus
        )
      ) {

        return res.status(400).json({
          success: false,
          message:
            "Status must be Completed or Pending",
        });

      }


      /* -----------------------------------------
         INSERT
      ----------------------------------------- */

      const result =
        await pool.query(
          `
          INSERT INTO expenses (
            transaction_type,
            transaction_date,
            amount,
            person_name,
            description,
            expense_category,
            payment_mode,
            reference_number,
            notes,
            status,
            added_by
          )

          VALUES (
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
            $11
          )

          RETURNING
            id,
            transaction_type,
            transaction_date,
            amount,
            person_name,
            description,
            expense_category,
            payment_mode,
            reference_number,
            notes,
            status,
            added_by,
            created_at,
            updated_at
          `,
          [
            type,
            date,
            validAmount,
            person,
            cleanString(description) ||
              null,
            cleanString(
              expense_category
            ) || null,
            payment,
            cleanString(
              reference_number
            ) || null,
            cleanString(notes) || null,
            transactionStatus,
            cleanString(
              added_by || "Admin"
            ) || "Admin",
          ]
        );


      return res.status(201).json({
        success: true,
        message:
          "Transaction added successfully",
        transaction:
          result.rows[0],
      });

    } catch (error) {

      console.error(
        "POST /expenses error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to add transaction",
        error:
          process.env.NODE_ENV ===
          "development"
            ? error.message
            : undefined,
      });

    }

  }
);


/* ============================================================
   GET
   ALL EXPENSES / FILTERS
============================================================ */

router.get(
  "/all",
  async (req, res) => {

    try {

      const {
        type,
        status,
        payment_mode,
        from_date,
        to_date,
        search,
      } = req.query;


      const conditions = [];

      const values = [];

      let parameterIndex = 1;


      /* -----------------------------------------
         TYPE FILTER
      ----------------------------------------- */

      if (
        type &&
        type !== "All"
      ) {

        const normalizedType =
          String(type)
            .trim()
            .toUpperCase();


        if (
          !VALID_TYPES.includes(
            normalizedType
          )
        ) {

          return res.status(400).json({
            success: false,
            message:
              "Invalid transaction type",
          });

        }


        conditions.push(
          `transaction_type = $${parameterIndex}`
        );

        values.push(
          normalizedType
        );

        parameterIndex++;

      }


      /* -----------------------------------------
         STATUS FILTER
      ----------------------------------------- */

      if (
        status &&
        status !== "All"
      ) {

        const cleanStatus =
          String(status).trim();


        if (
          !VALID_STATUS.includes(
            cleanStatus
          )
        ) {

          return res.status(400).json({
            success: false,
            message:
              "Invalid status",
          });

        }


        conditions.push(
          `status = $${parameterIndex}`
        );

        values.push(
          cleanStatus
        );

        parameterIndex++;

      }


      /* -----------------------------------------
         PAYMENT FILTER
      ----------------------------------------- */

      if (
        payment_mode &&
        payment_mode !== "All"
      ) {

        const cleanPayment =
          String(
            payment_mode
          ).trim();


        if (
          !VALID_PAYMENT_MODES.includes(
            cleanPayment
          )
        ) {

          return res.status(400).json({
            success: false,
            message:
              "Invalid payment mode",
          });

        }


        conditions.push(
          `payment_mode = $${parameterIndex}`
        );

        values.push(
          cleanPayment
        );

        parameterIndex++;

      }


      /* -----------------------------------------
         FROM DATE
      ----------------------------------------- */

      if (from_date) {

        const date =
          normalizeDate(
            from_date
          );


        if (!date) {

          return res.status(400).json({
            success: false,
            message:
              "Invalid from_date",
          });

        }


        conditions.push(
          `transaction_date >= $${parameterIndex}`
        );

        values.push(date);

        parameterIndex++;

      }


      /* -----------------------------------------
         TO DATE
      ----------------------------------------- */

      if (to_date) {

        const date =
          normalizeDate(
            to_date
          );


        if (!date) {

          return res.status(400).json({
            success: false,
            message:
              "Invalid to_date",
          });

        }


        conditions.push(
          `transaction_date <= $${parameterIndex}`
        );

        values.push(date);

        parameterIndex++;

      }


      /* -----------------------------------------
         SEARCH
      ----------------------------------------- */

      if (
        search &&
        String(search).trim()
      ) {

        const searchValue =
          `%${String(search).trim()}%`;


        conditions.push(`
          (
            person_name ILIKE $${parameterIndex}
            OR description ILIKE $${parameterIndex}
            OR reference_number ILIKE $${parameterIndex}
            OR notes ILIKE $${parameterIndex}
            OR expense_category ILIKE $${parameterIndex}
            OR added_by ILIKE $${parameterIndex}
          )
        `);


        values.push(
          searchValue
        );

        parameterIndex++;

      }


      /* -----------------------------------------
         WHERE
      ----------------------------------------- */

      const whereClause =
        conditions.length > 0
          ? `WHERE ${conditions.join(
              " AND "
            )}`
          : "";


      /* -----------------------------------------
         QUERY
      ----------------------------------------- */

      const result =
        await pool.query(
          `
          SELECT
            id,
            transaction_type,
            transaction_date,
            amount,
            person_name,
            description,
            expense_category,
            payment_mode,
            reference_number,
            notes,
            status,
            added_by,
            created_at,
            updated_at

          FROM expenses

          ${whereClause}

          ORDER BY
            transaction_date DESC,
            id DESC
          `,
          values
        );


      return res.json({
        success: true,
        count:
          result.rows.length,
        transactions:
          result.rows,
      });

    } catch (error) {

      console.error(
        "GET /expenses error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to load transactions",
      });

    }

  }
);


/* ============================================================
   GET SUMMARY
============================================================ */

router.get(
  "/summary",
  async (req, res) => {

    try {

      /*
       * Completed Money In
       */
      const result =
        await pool.query(`
          SELECT

            COALESCE(
              SUM(
                CASE
                  WHEN transaction_type = 'IN'
                  AND status = 'Completed'
                  THEN amount
                  ELSE 0
                END
              ),
              0
            ) AS total_money_in,


            COALESCE(
              SUM(
                CASE
                  WHEN transaction_type = 'OUT'
                  AND status = 'Completed'
                  THEN amount
                  ELSE 0
                END
              ),
              0
            ) AS total_money_out,


            COALESCE(
              SUM(
                CASE
                  WHEN transaction_type = 'IN'
                  AND status = 'Pending'
                  THEN amount
                  ELSE 0
                END
              ),
              0
            ) AS pending_to_collect,


            COALESCE(
              SUM(
                CASE
                  WHEN transaction_type = 'OUT'
                  AND status = 'Pending'
                  THEN amount
                  ELSE 0
                END
              ),
              0
            ) AS pending_to_pay

          FROM expenses
        `);


      const row =
        result.rows[0];


      const totalMoneyIn =
        Number(
          row.total_money_in || 0
        );


      const totalMoneyOut =
        Number(
          row.total_money_out || 0
        );


      const pendingToCollect =
        Number(
          row.pending_to_collect || 0
        );


      const pendingToPay =
        Number(
          row.pending_to_pay || 0
        );


      /*
       * Current balance only includes
       * completed transactions.
       */
      const currentBalance =
        totalMoneyIn -
        totalMoneyOut;


      return res.json({

        success: true,

        summary: {

          total_money_in:
            totalMoneyIn,

          total_money_out:
            totalMoneyOut,

          current_balance:
            currentBalance,

          pending_to_collect:
            pendingToCollect,

          pending_to_pay:
            pendingToPay,

        },

      });

    } catch (error) {

      console.error(
        "GET /expenses/summary error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to load expense summary",
      });

    }

  }
);


/* ============================================================
   GET SINGLE TRANSACTION
============================================================ */

router.get(
  "/:id",
  async (req, res) => {

    try {

      const {
        id,
      } = req.params;


      if (
        !id ||
        !/^\d+$/.test(id)
      ) {

        return res.status(400).json({
          success: false,
          message:
            "Valid transaction ID is required",
        });

      }


      const result =
        await pool.query(
          `
          SELECT
            id,
            transaction_type,
            transaction_date,
            amount,
            person_name,
            description,
            expense_category,
            payment_mode,
            reference_number,
            notes,
            status,
            added_by,
            created_at,
            updated_at

          FROM expenses

          WHERE id = $1

          LIMIT 1
          `,
          [id]
        );


      if (
        result.rows.length === 0
      ) {

        return res.status(404).json({
          success: false,
          message:
            "Transaction not found",
        });

      }


      return res.json({
        success: true,
        transaction:
          result.rows[0],
      });

    } catch (error) {

      console.error(
        "GET /expenses/:id error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to load transaction",
      });

    }

  }
);


/* ============================================================
   PUT
   UPDATE TRANSACTION
============================================================ */

router.put(
  "/update/:id",
  async (req, res) => {

    try {

      const {
        id,
      } = req.params;


      if (
        !id ||
        !/^\d+$/.test(id)
      ) {

        return res.status(400).json({
          success: false,
          message:
            "Valid transaction ID is required",
        });

      }


      const {
        transaction_type,
        transaction_date,
        amount,
        person_name,
        description,
        expense_category,
        payment_mode,
        reference_number,
        notes,
        status,
        added_by,
      } = req.body;


      /* -----------------------------------------
         TYPE
      ----------------------------------------- */

      const type =
        cleanString(
          transaction_type
        ).toUpperCase();


      if (
        !VALID_TYPES.includes(type)
      ) {

        return res.status(400).json({
          success: false,
          message:
            "transaction_type must be IN or OUT",
        });

      }


      /* -----------------------------------------
         DATE
      ----------------------------------------- */

      const date =
        normalizeDate(
          transaction_date
        );


      if (!date) {

        return res.status(400).json({
          success: false,
          message:
            "Valid transaction date is required",
        });

      }


      /* -----------------------------------------
         AMOUNT
      ----------------------------------------- */

      const validAmount =
        validateAmount(amount);


      if (!validAmount) {

        return res.status(400).json({
          success: false,
          message:
            "Amount must be greater than 0",
        });

      }


      /* -----------------------------------------
         PERSON
      ----------------------------------------- */

      const person =
        cleanString(
          person_name
        );


      if (!person) {

        return res.status(400).json({
          success: false,
          message:
            type === "IN"
              ? "Received From is required"
              : "Given To is required",
        });

      }


      /* -----------------------------------------
         PAYMENT
      ----------------------------------------- */

      const payment =
        cleanString(
          payment_mode || "Cash"
        );


      if (
        !VALID_PAYMENT_MODES.includes(
          payment
        )
      ) {

        return res.status(400).json({
          success: false,
          message:
            "Payment mode must be Cash, UPI or Bank",
        });

      }


      /* -----------------------------------------
         STATUS
      ----------------------------------------- */

      const transactionStatus =
        cleanString(
          status || "Completed"
        );


      if (
        !VALID_STATUS.includes(
          transactionStatus
        )
      ) {

        return res.status(400).json({
          success: false,
          message:
            "Status must be Completed or Pending",
        });

      }


      /* -----------------------------------------
         UPDATE
      ----------------------------------------- */

      const result =
        await pool.query(
          `
          UPDATE expenses

          SET
            transaction_type = $1,
            transaction_date = $2,
            amount = $3,
            person_name = $4,
            description = $5,
            expense_category = $6,
            payment_mode = $7,
            reference_number = $8,
            notes = $9,
            status = $10,
            added_by = $11

          WHERE id = $12

          RETURNING
            id,
            transaction_type,
            transaction_date,
            amount,
            person_name,
            description,
            expense_category,
            payment_mode,
            reference_number,
            notes,
            status,
            added_by,
            created_at,
            updated_at
          `,
          [
            type,
            date,
            validAmount,
            person,
            cleanString(description) ||
              null,
            cleanString(
              expense_category
            ) || null,
            payment,
            cleanString(
              reference_number
            ) || null,
            cleanString(notes) || null,
            transactionStatus,
            cleanString(
              added_by || "Admin"
            ) || "Admin",
            id,
          ]
        );


      if (
        result.rows.length === 0
      ) {

        return res.status(404).json({
          success: false,
          message:
            "Transaction not found",
        });

      }


      return res.json({
        success: true,
        message:
          "Transaction updated successfully",
        transaction:
          result.rows[0],
      });

    } catch (error) {

      console.error(
        "PUT /expenses/:id error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to update transaction",
      });

    }

  }
);


/* ============================================================
   DELETE
============================================================ */

router.delete(
  "/delete/:id",
  async (req, res) => {

    try {

      const {
        id,
      } = req.params;


      if (
        !id ||
        !/^\d+$/.test(id)
      ) {

        return res.status(400).json({
          success: false,
          message:
            "Valid transaction ID is required",
        });

      }


      const result =
        await pool.query(
          `
          DELETE FROM expenses

          WHERE id = $1

          RETURNING
            id,
            transaction_type,
            amount,
            person_name
          `,
          [id]
        );


      if (
        result.rows.length === 0
      ) {

        return res.status(404).json({
          success: false,
          message:
            "Transaction not found",
        });

      }


      return res.json({
        success: true,
        message:
          "Transaction deleted successfully",
        transaction:
          result.rows[0],
      });

    } catch (error) {

      console.error(
        "DELETE /expenses/:id error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to delete transaction",
      });

    }

  }
);


/* ============================================================
   EXPORT
============================================================ */

module.exports = router;