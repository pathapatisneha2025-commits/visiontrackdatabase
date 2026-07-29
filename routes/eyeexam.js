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

      patient_name,
      patient_id,
      mobile_number,

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


    if (!storeCode) {
      return res.status(400).json({
        success:false,
        message:"Store code missing"
      });
    }



    // 1. SAVE EYE EXAM
    const result = await pool.query(

`
INSERT INTO eye_exams
(
store_code,

patient_name,
patient_id,
mobile_number,

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

NOW()
)

RETURNING *

`,

[

storeCode,

patient_name,
patient_id,
mobile_number,

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

next_review_date

]


);



    // 2. CREATE FOLLOW-UP NOTIFICATION
    if(next_review_date){


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

storeCode,

patient_id,

patient_name,

mobile_number,

"Eye Follow-up Reminder",

`${patient_name} has an eye review appointment. ${diagnosis || "Eye Checkup"}`,

next_review_date

]


);


    }



    res.json({

      success:true,

      message:"Eye examination saved successfully",

      exam:result.rows[0]

    });



  }

  catch(error){

    console.log(
      "SAVE EYE EXAM ERROR:",
      error
    );


    res.status(500).json({

      success:false,

      message:"Error saving eye exam"

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





module.exports = router;