const express = require("express");
const router = express.Router();

const pool = require("../db");



/*
GET ALL EYE EXAMS BY STORE CODE
SEARCH BY PATIENT NAME OR PATIENT ID
*/

router.get("/", async (req, res) => {
  try {
    const {
      storeCode,
      search = ""
    } = req.query;

    if (!storeCode) {
      return res.status(400).json({
        success: false,
        message: "Store code required"
      });
    }

    const result = await pool.query(
      `
      SELECT
        e.*,
        s.store_name
      FROM eye_exams e
      LEFT JOIN stores s
        ON e.store_code = s.store_code
      WHERE e.store_code = $1
      AND (
        e.patient_name ILIKE $2
        OR e.patient_id ILIKE $2
      )
      ORDER BY e.id DESC
      `,
      [
        storeCode,
        `%${search}%`
      ]
    );

    res.json({
      success: true,
      count: result.rows.length,
      exams: result.rows
    });

  } catch (error) {
    console.log("GET EYE EXAMS ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});




/*
CREATE NEW EYE EXAM
*/
router.post("/add", async (req, res) => {
  try {
    const {
      storeCode,
      role,

      patient_name,
      patient_id,
      mobile_number,
      age,
      gender,

      complaint,
      history_notes,

      od_vision,
      od_ph,

      os_vision,
      os_ph,

      right_sph,
      right_cyl,
      right_axis,

      left_sph,
      left_cyl,
      left_axis,

      pd,

      od_iop,
      os_iop,

      diagnosis,

      rx,

      notes,

      next_review_date,
    } = req.body;

    // =====================================================
    // STORE CODE / ROLE VALIDATION
    // =====================================================

    const isSuperAdmin = role === "super_admin";

    // Normal users must have storeCode
    // Super Admin can continue without storeCode
    if (!storeCode && !isSuperAdmin) {
      return res.status(400).json({
        success: false,
        message: "Store code missing",
      });
    }

    // If Super Admin has no storeCode, save NULL
    const finalStoreCode = storeCode || null;

    // =====================================================
    // 1. SAVE EYE EXAM
    // =====================================================

    const result = await pool.query(
      `
      INSERT INTO eye_exams
      (
        store_code,

        patient_name,
        patient_id,
        mobile_number,
        age,
        gender,

        complaint,
        history_notes,

        od_vision,
        od_ph,

        os_vision,
        os_ph,

        right_sph,
        right_cyl,
        right_axis,

        left_sph,
        left_cyl,
        left_axis,

        pd,

        od_iop,
        os_iop,

        diagnosis,

        rx,

        notes,

        next_review_date,

        exam_date
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

        $24,

        $25,

        NOW()
      )

      RETURNING *
      `,

      [
        finalStoreCode,

        patient_name,
        patient_id,
        mobile_number,
        age || null,
        gender || null,

        complaint,
        history_notes,

        od_vision,
        od_ph,

        os_vision,
        os_ph,

        right_sph,
        right_cyl,
        right_axis,

        left_sph,
        left_cyl,
        left_axis,

        pd,

        od_iop,
        os_iop,

        diagnosis,

        rx,

        notes,

        next_review_date,
      ]
    );

    // =====================================================
    // 2. CREATE FOLLOW-UP NOTIFICATION
    // =====================================================

    if (next_review_date) {
      await pool.query(
        `
        INSERT INTO notifications
        (
          store_code,

          patient_id,
          patient_name,
          mobile_number,

          title,
          message,

          notification_date
        )

        VALUES
        (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7
        )
        `,

        [
          finalStoreCode,

          patient_id,
          patient_name,
          mobile_number,

          "Eye Follow-up Reminder",

          `${patient_name} has an eye review appointment. ${
            diagnosis || "Eye Checkup"
          }`,

          next_review_date,
        ]
      );
    }

    // =====================================================
    // 3. SUCCESS RESPONSE
    // =====================================================

    res.json({
      success: true,
      message: "Eye examination saved successfully",
      exam: result.rows[0],
    });

  } catch (error) {
    console.log("SAVE EYE EXAM ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Error saving eye exam",
      error: error.message,
    });
  }
});




// =====================================================
// GET ALL EYE EXAMS FOR SUPER ADMIN
// =====================================================

router.get("/super-admin", async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT *
      FROM eye_exams
      WHERE LOWER(role) = 'super_admin'
      ORDER BY exam_date DESC, id DESC
      `
    );

    res.status(200).json({
      success: true,
      count: result.rows.length,
      exams: result.rows,
    });

  } catch (error) {
    console.error(
      "GET SUPER ADMIN EYE EXAMS ERROR:",
      error
    );

    res.status(500).json({
      success: false,
      message: "Error fetching Super Admin eye examinations",
      error: error.message,
    });
  }
});
/*
GET PATIENT EYE EXAM HISTORY
*/

router.get("/patient/:patientId", async (req,res)=>{

  try {

    const {
      patientId
    } = req.params;

    const {
      storeCode
    } = req.query;


    if(!storeCode){
      return res.status(400).json({
        success:false,
        message:"Store code required"
      });
    }


    const result = await pool.query(
      `
      SELECT
        e.*,
        s.store_name

      FROM eye_exams e

      LEFT JOIN stores s
      ON e.store_code = s.store_code

      WHERE e.store_code = $1
      AND e.patient_id = $2

      ORDER BY e.id DESC

      `,
      [
        storeCode,
        patientId
      ]
    );


    res.json({

      success:true,

      count:result.rows.length,

      exams:result.rows

    });


  }
  catch(error){

    console.log(
      "GET PATIENT EXAM HISTORY ERROR:",
      error
    );


    res.status(500).json({

      success:false,

      message:"Server error"

    });

  }

});
/*
GET SINGLE EXAM
*/
router.get("/:id", async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        e.*,
        s.store_name,
        s.owner_name,
        s.address,
        s.mobile
      FROM eye_exams e
      LEFT JOIN stores s
        ON e.store_code = s.store_code
      WHERE e.id = $1
      `,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Exam not found",
      });
    }

    res.json({
      success: true,
      exam: result.rows[0],
    });
  } catch (error) {
    console.log("GET SINGLE EXAM ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});
/*
UPDATE COMPLETE EYE EXAM
*/
router.put("/update/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const {
      storeCode,

      patient_name,
      patient_id,
      mobile_number,
      age,
      gender,

      complaint,
      history_notes,

      od_vision,
      od_ph,

      os_vision,
      os_ph,

      right_sph,
      right_cyl,
      right_axis,

      left_sph,
      left_cyl,
      left_axis,

      pd,

      od_iop,
      os_iop,

      diagnosis,

      rx,

      notes,

      next_review_date,
    } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Exam ID required",
      });
    }

    if (!storeCode) {
      return res.status(400).json({
        success: false,
        message: "Store code required",
      });
    }

    // ==========================================
    // CHECK EXAM EXISTS
    // ==========================================

    const checkResult = await pool.query(
      `
      SELECT id
      FROM eye_exams
      WHERE id = $1
        AND store_code = $2
      `,
      [id, storeCode]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Eye examination not found",
      });
    }

    // ==========================================
    // UPDATE EXAM
    // ==========================================

    const result = await pool.query(
      `
      UPDATE eye_exams
      SET

        patient_name = $1,
        patient_id = $2,
        mobile_number = $3,
        age = $4,
        gender = $5,

        complaint = $6,
        history_notes = $7,

        od_vision = $8,
        od_ph = $9,

        os_vision = $10,
        os_ph = $11,

        right_sph = $12,
        right_cyl = $13,
        right_axis = $14,

        left_sph = $15,
        left_cyl = $16,
        left_axis = $17,

        pd = $18,

        od_iop = $19,
        os_iop = $20,

        diagnosis = $21,

        rx = $22,

        notes = $23,

        next_review_date = $24

      WHERE id = $25
        AND store_code = $26

      RETURNING *
      `,
      [

        patient_name,
        patient_id,
        mobile_number,
        age || null,
        gender || null,

        complaint,
        history_notes,

        od_vision,
        od_ph,

        os_vision,
        os_ph,

        right_sph,
        right_cyl,
        right_axis,

        left_sph,
        left_cyl,
        left_axis,

        pd,

        od_iop,
        os_iop,

        diagnosis,

        rx,

        notes,

        next_review_date,

        id,
        storeCode,
      ]
    );

    // ==========================================
    // OPTIONAL: UPDATE FOLLOW-UP NOTIFICATION
    // ==========================================

    if (next_review_date) {

      await pool.query(
        `
        UPDATE notifications
        SET
          patient_name = $1,
          mobile_number = $2,
          message = $3,
          notification_date = $4
        WHERE patient_id = $5
          AND store_code = $6
          AND title = 'Eye Follow-up Reminder'
        `,
        [
          patient_name,
          mobile_number,
          `${patient_name} has an eye review appointment. ${
            diagnosis || "Eye Checkup"
          }`,
          next_review_date,
          patient_id,
          storeCode,
        ]
      );
    }

    return res.json({
      success: true,
      message: "Eye examination updated successfully",
      exam: result.rows[0],
    });

  } catch (error) {

    console.error(
      "UPDATE EYE EXAM ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to update eye examination",
      error: error.message,
    });
  }
});

router.put("/update-review/:patientId", async(req,res)=>{

try{

const {
storeCode,
next_review_date,
notes
}=req.body;


const result = await pool.query(
`
UPDATE eye_exams
SET 
next_review_date=$1,
notes=$2
WHERE patient_id=$3
AND store_code=$4
RETURNING *
`,
[
next_review_date,
notes,
req.params.patientId,
storeCode
]
);


res.json({
success:true,
exam:result.rows[0]
});


}catch(error){

console.log(error);

res.status(500).json({
success:false,
message:"Update failed"
});

}

});
router.put("/followups/complete/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { storeCode } = req.query;

    if (!id || !storeCode) {
      return res.status(400).json({
        success: false,
        message: "Follow-up ID and storeCode are required",
      });
    }

    // ==========================================
    // CHECK FOLLOW-UP
    // ==========================================
    const checkResult = await pool.query(
      `
      SELECT
        id,
        patient_id,
        patient_name,
        mobile_number,
        next_review_date,
        followup_status
      FROM eye_exams
      WHERE id = $1
        AND store_code = $2
      `,
      [id, storeCode]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Follow-up not found",
      });
    }

    const followup = checkResult.rows[0];

    // Already completed
    if (followup.followup_status === "completed") {
      return res.json({
        success: true,
        message: "Follow-up is already completed",
        followup,
      });
    }

    // ==========================================
    // COMPLETE FOLLOW-UP
    // ==========================================
    const result = await pool.query(
      `
      UPDATE eye_exams
      SET
        followup_status = 'completed',
        next_review_date = NULL
      WHERE id = $1
        AND store_code = $2
      RETURNING
        id,
        patient_id,
        patient_name,
        mobile_number,
        next_review_date,
        followup_status
      `,
      [id, storeCode]
    );

    return res.json({
      success: true,
      message: "Follow-up completed successfully",
      followup: result.rows[0],
    });

  } catch (error) {
    console.error("COMPLETE FOLLOW-UP ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to complete follow-up",
      error: error.message,
    });
  }
});
/*
DELETE EYE EXAM
SAVE DELETE HISTORY BEFORE DELETING
*/
router.delete("/delete/:id", async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { storeCode, deletedBy } = req.body;

    // ==========================================
    // VALIDATION
    // ==========================================

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Exam ID is required",
      });
    }

    if (!storeCode) {
      return res.status(400).json({
        success: false,
        message: "Store code is required",
      });
    }

    await client.query("BEGIN");

    // ==========================================
    // GET EXAM BEFORE DELETE
    // ==========================================

    const examResult = await client.query(
      `
      SELECT
        id,
        patient_id,
        patient_name,
        mobile_number,
        store_code
      FROM eye_exams
      WHERE id = $1
        AND store_code = $2
      FOR UPDATE
      `,
      [id, storeCode]
    );

    if (examResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        success: false,
        message: "Eye examination not found",
      });
    }

    const exam = examResult.rows[0];

    // ==========================================
    // INSERT INTO DELETE HISTORY
    // ==========================================

    await client.query(
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
      VALUES
      (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6
      )
      `,
      [
        "eye_exam",
        exam.id,
        exam.patient_id || String(exam.id),
        exam.patient_name || "",
        deletedBy || "User",
        exam.store_code,
      ]
    );

    // ==========================================
    // DELETE EYE EXAM
    // ==========================================

    const deleteResult = await client.query(
      `
      DELETE FROM eye_exams
      WHERE id = $1
        AND store_code = $2
      RETURNING id
      `,
      [id, storeCode]
    );

    if (deleteResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        success: false,
        message: "Eye examination could not be deleted",
      });
    }

    // ==========================================
    // COMMIT
    // ==========================================

    await client.query("COMMIT");

    return res.json({
      success: true,
      message: "Eye examination deleted successfully",
      deletedExamId: deleteResult.rows[0].id,
    });

  } catch (error) {
    await client.query("ROLLBACK");

    console.error(
      "DELETE EYE EXAM ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to delete eye examination",
      error: error.message,
    });

  } finally {
    client.release();
  }
});
module.exports = router;