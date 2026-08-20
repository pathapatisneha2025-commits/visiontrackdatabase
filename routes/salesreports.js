const express = require("express");
const router = express.Router();

const pool = require("../db");

const PDFDocument = require("pdfkit");
const ExcelJS = require("exceljs");

/*
=========================================================
SALES REPORT
POST /reports/sales
=========================================================
*/

router.post("/sales", async (req, res) => {
  try {
    const {
      storeCode,
      fromDate,
      toDate,
      status,
    } = req.body;

    if (!storeCode) {
      return res.status(400).json({
        success: false,
        message: "Store code required",
      });
    }

    const result = await pool.query(
      `
      SELECT
        id,
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

      FROM optical_orders

      WHERE store_code = $1

      AND (
        $2 = ''
        OR order_date >= TO_DATE($2, 'DD-MM-YYYY')
      )

      AND (
        $3 = ''
        OR order_date <= TO_DATE($3, 'DD-MM-YYYY')
      )

      AND (
        $4 = ''
        OR status ILIKE '%' || $4 || '%'
      )

      ORDER BY order_date DESC
      `,
      [
        storeCode,
        fromDate || "",
        toDate || "",
        status || "",
      ]
    );

    res.json({
      success: true,
      count: result.rows.length,

      filters: {
        storeCode,
        fromDate: fromDate || "",
        toDate: toDate || "",
        status: status || "All",
      },

      data: result.rows,
    });
  } catch (error) {
    console.error("SALES REPORT ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Sales report error",
      error: error.message,
    });
  }
});



/*
=========================================================
SALES REPORT PDF
POST /reports/sales/pdf
=========================================================
*/

router.post("/sales/pdf", async (req, res) => {
  try {
    const {
      storeCode,
      fromDate,
      toDate,
      status,
    } = req.body;

    if (!storeCode) {
      return res.status(400).json({
        success: false,
        message: "Store code required",
      });
    }

    const result = await pool.query(
      `
      SELECT

        order_no,
        order_date,

        patient_id,
        patient_name,
        mobile,

        frame_model,
        lens_type,

        total_amount,
        advance_paid,
        balance_amount,

        status,
        payment_status

      FROM optical_orders

      WHERE store_code = $1

      AND (
        $2 = ''
        OR order_date >= TO_DATE($2, 'DD-MM-YYYY')
      )

      AND (
        $3 = ''
        OR order_date <= TO_DATE($3, 'DD-MM-YYYY')
      )

      AND (
        $4 = ''
        OR status ILIKE '%' || $4 || '%'
      )

      ORDER BY order_date DESC
      `,
      [
        storeCode,
        fromDate || "",
        toDate || "",
        status || "",
      ]
    );


    /*
    ================================================
    CALCULATE TOTALS
    ================================================
    */

    let totalSales = 0;
    let totalAdvance = 0;
    let totalBalance = 0;

    let completedCount = 0;
    let pendingCount = 0;

    result.rows.forEach((item) => {
      totalSales += Number(item.total_amount || 0);

      totalAdvance += Number(
        item.advance_paid || 0
      );

      totalBalance += Number(
        item.balance_amount || 0
      );

      const currentStatus = String(
        item.status || ""
      ).toLowerCase();

      if (currentStatus === "completed") {
        completedCount++;
      }

      if (currentStatus === "pending") {
        pendingCount++;
      }
    });


    /*
    ================================================
    PDF RESPONSE
    ================================================
    */

    res.setHeader(
      "Content-Type",
      "application/pdf"
    );

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="sales-report-${Date.now()}.pdf"`
    );


    const doc = new PDFDocument({
      margin: 40,
      size: "A4",
    });

    doc.pipe(res);


    /*
    ================================================
    HEADER
    ================================================
    */

    doc
      .fontSize(20)
      .font("Helvetica-Bold")
      .text(
        "VISION EYE CARE",
        {
          align: "center",
        }
      );

    doc.moveDown(0.5);

    doc
      .fontSize(16)
      .font("Helvetica-Bold")
      .text(
        "Sales Report",
        {
          align: "center",
        }
      );

    doc.moveDown();


    /*
    ================================================
    FILTER DETAILS
    ================================================
    */

    doc
      .fontSize(10)
      .font("Helvetica")
      .text(
        `Store Code : ${storeCode}`
      );

    doc.text(
      `Date Range : ${
        fromDate || "All"
      } - ${
        toDate || "All"
      }`
    );

    doc.text(
      `Status : ${
        status || "All"
      }`
    );

    doc.moveDown();


    /*
    ================================================
    SUMMARY
    ================================================
    */

    doc
      .fontSize(12)
      .font("Helvetica-Bold")
      .text("Summary");

    doc.moveDown(0.3);

    doc
      .fontSize(10)
      .font("Helvetica")
      .text(
        `Total Orders : ${result.rows.length}`
      );

    doc.text(
      `Completed Orders : ${completedCount}`
    );

    doc.text(
      `Pending Orders : ${pendingCount}`
    );

    doc.text(
      `Total Sales : ₹${totalSales.toFixed(2)}`
    );

    doc.text(
      `Total Advance : ₹${totalAdvance.toFixed(2)}`
    );

    doc.text(
      `Total Balance : ₹${totalBalance.toFixed(2)}`
    );

    doc.moveDown();


    /*
    ================================================
    SALES DETAILS
    ================================================
    */

    result.rows.forEach((item, index) => {

      /*
      PAGE BREAK
      */

      if (doc.y > 700) {
        doc.addPage();
      }


      doc
        .fontSize(12)
        .font("Helvetica-Bold")
        .text(
          `${index + 1}. Invoice : ${
            item.order_no || "-"
          }`
        );

      doc.moveDown(0.3);


      doc
        .fontSize(9)
        .font("Helvetica");


      const orderDate = item.order_date
        ? new Date(
            item.order_date
          ).toLocaleDateString("en-IN")
        : "-";


      doc.text(
        `Date : ${orderDate}`
      );

      doc.text(
        `Patient ID : ${
          item.patient_id || "-"
        }`
      );

      doc.text(
        `Customer : ${
          item.patient_name || "-"
        }`
      );

      doc.text(
        `Mobile : ${
          item.mobile || "-"
        }`
      );

      doc.text(
        `Frame : ${
          item.frame_model || "-"
        }`
      );

      doc.text(
        `Lens : ${
          item.lens_type || "-"
        }`
      );

      doc.text(
        `Amount : ₹${Number(
          item.total_amount || 0
        ).toFixed(2)}`
      );

      doc.text(
        `Advance : ₹${Number(
          item.advance_paid || 0
        ).toFixed(2)}`
      );

      doc.text(
        `Balance : ₹${Number(
          item.balance_amount || 0
        ).toFixed(2)}`
      );

      doc.text(
        `Status : ${
          item.status || "-"
        }`
      );

      doc.text(
        `Payment : ${
          item.payment_status || "-"
        }`
      );


      doc.moveDown(0.5);


      doc
        .moveTo(40, doc.y)
        .lineTo(555, doc.y)
        .stroke();


      doc.moveDown(0.7);
    });


    /*
    ================================================
    FINAL TOTAL
    ================================================
    */

    if (doc.y > 700) {
      doc.addPage();
    }

    doc.moveDown();

    doc
      .fontSize(14)
      .font("Helvetica-Bold")
      .text(
        `Total Sales : ₹${totalSales.toFixed(2)}`
      );

    doc.text(
      `Total Advance : ₹${totalAdvance.toFixed(2)}`
    );

    doc.text(
      `Total Balance : ₹${totalBalance.toFixed(2)}`
    );


    doc.end();

  } catch (error) {

    console.error(
      "SALES PDF ERROR:",
      error
    );

    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: "PDF generation failed",
        error: error.message,
      });
    }
  }
});



/*
=========================================================
SALES REPORT EXCEL
POST /reports/sales/excel
=========================================================
*/

router.post("/sales/excel", async (req, res) => {
  try {

    const {
      storeCode,
      fromDate,
      toDate,
      status,
    } = req.body;


    if (!storeCode) {
      return res.status(400).json({
        success: false,
        message: "Store code required",
      });
    }


    const result = await pool.query(
      `
      SELECT

        order_no,
        order_date,

        patient_id,
        patient_name,
        mobile,

        frame_model,
        lens_type,

        total_amount,
        advance_paid,
        balance_amount,

        status,
        payment_status

      FROM optical_orders

      WHERE store_code = $1

      AND (
        $2 = ''
        OR order_date >= TO_DATE($2, 'DD-MM-YYYY')
      )

      AND (
        $3 = ''
        OR order_date <= TO_DATE($3, 'DD-MM-YYYY')
      )

      AND (
        $4 = ''
        OR status ILIKE '%' || $4 || '%'
      )

      ORDER BY order_date DESC
      `,
      [
        storeCode,
        fromDate || "",
        toDate || "",
        status || "",
      ]
    );


    /*
    ================================================
    CREATE WORKBOOK
    ================================================
    */

    const workbook =
      new ExcelJS.Workbook();


    const sheet =
      workbook.addWorksheet(
        "Sales Report"
      );


    /*
    ================================================
    TITLE
    ================================================
    */

    sheet.mergeCells(
      "A1:K1"
    );

    sheet.getCell("A1").value =
      "VISION EYE CARE - SALES REPORT";

    sheet.getCell("A1").font = {
      bold: true,
      size: 18,
    };

    sheet.getCell("A1").alignment = {
      horizontal: "center",
      vertical: "middle",
    };


    /*
    ================================================
    FILTER INFORMATION
    ================================================
    */

    sheet.mergeCells(
      "A2:K2"
    );

    sheet.getCell("A2").value =
      `Store Code : ${storeCode}`;

    sheet.mergeCells(
      "A3:K3"
    );

    sheet.getCell("A3").value =
      `Date Range : ${
        fromDate || "All"
      } - ${
        toDate || "All"
      }`;

    sheet.mergeCells(
      "A4:K4"
    );

    sheet.getCell("A4").value =
      `Status : ${
        status || "All"
      }`;


    /*
    ================================================
    TOTALS
    ================================================
    */

    let totalSales = 0;
    let totalAdvance = 0;
    let totalBalance = 0;

    result.rows.forEach((item) => {

      totalSales += Number(
        item.total_amount || 0
      );

      totalAdvance += Number(
        item.advance_paid || 0
      );

      totalBalance += Number(
        item.balance_amount || 0
      );

    });


    sheet.addRow([]);

    sheet.addRow([
      "Total Orders",
      result.rows.length,
    ]);

    sheet.addRow([
      "Total Sales",
      totalSales,
    ]);

    sheet.addRow([
      "Total Advance",
      totalAdvance,
    ]);

    sheet.addRow([
      "Total Balance",
      totalBalance,
    ]);

    sheet.addRow([]);


    /*
    ================================================
    TABLE HEADERS
    ================================================
    */

    const header =
      sheet.addRow([
        "Invoice",
        "Date",
        "Patient ID",
        "Customer",
        "Mobile",
        "Frame",
        "Lens Type",
        "Amount",
        "Advance",
        "Balance",
        "Status",
        "Payment",
      ]);


    header.font = {
      bold: true,
    };

    header.alignment = {
      horizontal: "center",
      vertical: "middle",
    };


    /*
    ================================================
    DATA
    ================================================
    */

    result.rows.forEach((row) => {

      sheet.addRow([
        row.order_no || "",

        row.order_date
          ? new Date(row.order_date)
          : "",

        row.patient_id || "",

        row.patient_name || "",

        row.mobile || "",

        row.frame_model || "",

        row.lens_type || "",

        Number(
          row.total_amount || 0
        ),

        Number(
          row.advance_paid || 0
        ),

        Number(
          row.balance_amount || 0
        ),

        row.status || "",

        row.payment_status || "",
      ]);

    });


    /*
    ================================================
    COLUMN WIDTHS
    ================================================
    */

    sheet.columns = [

      {
        key: "order_no",
        width: 20,
      },

      {
        key: "order_date",
        width: 15,
      },

      {
        key: "patient_id",
        width: 18,
      },

      {
        key: "patient_name",
        width: 25,
      },

      {
        key: "mobile",
        width: 16,
      },

      {
        key: "frame_model",
        width: 20,
      },

      {
        key: "lens_type",
        width: 20,
      },

      {
        key: "total_amount",
        width: 15,
      },

      {
        key: "advance_paid",
        width: 15,
      },

      {
        key: "balance_amount",
        width: 15,
      },

      {
        key: "status",
        width: 15,
      },

      {
        key: "payment_status",
        width: 18,
      },

    ];


    /*
    ================================================
    NUMBER FORMATTING
    ================================================
    */

    sheet.eachRow(
      (row, rowNumber) => {

        if (rowNumber >= 13) {

          row.getCell(8).numFmt =
            '₹#,##0.00';

          row.getCell(9).numFmt =
            '₹#,##0.00';

          row.getCell(10).numFmt =
            '₹#,##0.00';

        }

      }
    );


    /*
    ================================================
    FREEZE HEADER
    ================================================
    */

    sheet.views = [
      {
        state: "frozen",
        ySplit: 12,
      },
    ];


    /*
    ================================================
    RESPONSE
    ================================================
    */

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="sales-report-${Date.now()}.xlsx"`
    );


    await workbook.xlsx.write(res);

    res.end();


  } catch (error) {

    console.error(
      "SALES EXCEL ERROR:",
      error
    );

    if (!res.headersSent) {

      res.status(500).json({
        success: false,
        message:
          "Excel generation failed",
        error: error.message,
      });

    }

  }
});

/*
=========================================================
CUSTOMER REPORT
=========================================================

POST /reports/customer

Filters:
- storeCode
- fromDate
- toDate
- customer
- patientId        -> mobile number
- customerCategory

Categories:
- All
- Eye Examination
- Optical Customer
- Follow-up Customer
=========================================================
*/

/*
=========================================================
CUSTOMER REPORT
POST /reports/customer
=========================================================
*/

router.post("/customer", async (req, res) => {
  try {
    const {
      storeCode,
      fromDate,
      toDate,
      customer,
      patientId,
      customerCategory,
    } = req.body;

    if (!storeCode) {
      return res.status(400).json({
        success: false,
        message: "Store code required",
      });
    }

    /*
    =====================================================
    NORMALIZE FILTERS
    =====================================================
    */

    const category =
      customerCategory &&
      customerCategory !== "All"
        ? customerCategory
        : "";

    const customerName = customer || "";
    const mobileNumber = patientId || "";

    /*
    =====================================================
    CUSTOMER REPORT DATA

    SOURCES:

    1. eye_exams
       -> Eye Examination

    2. eye_exams with next_review_date
       -> Follow-up Customer

    3. optical_orders
       -> Optical Customer

    IMPORTANT:

    There is NO follow_ups table.

    Follow-up customers are generated from
    eye_exams.next_review_date.
    =====================================================
    */

    const result = await pool.query(
      `
      WITH customer_data AS (

        /*
        =================================================
        EYE EXAMINATION CUSTOMERS
        =================================================
        */

        SELECT
          e.id,
          e.store_code,

          e.patient_id,
          e.patient_name,
          e.mobile_number AS mobile,

          e.created_at AS activity_date,

          'Eye Examination' AS customer_category,

          NULL::text AS order_no,
          NULL::numeric AS total_amount,
          NULL::numeric AS advance_paid,
          NULL::numeric AS balance_amount,
          NULL::text AS order_status,
          NULL::text AS payment_status,

          e.next_review_date AS next_review_date

        FROM eye_exams e

        WHERE e.store_code = $1


        UNION ALL


        /*
        =================================================
        FOLLOW-UP CUSTOMERS
        =================================================

        Follow-up is created from the eye examination
        when next_review_date exists.

        IMPORTANT:
        activity_date = next_review_date

        Therefore date filtering for Follow-up
        customers is based on the actual review date.
        =================================================
        */

        SELECT
          e.id,
          e.store_code,

          e.patient_id,
          e.patient_name,
          e.mobile_number AS mobile,

          e.next_review_date AS activity_date,

          'Follow-up Customer' AS customer_category,

          NULL::text AS order_no,
          NULL::numeric AS total_amount,
          NULL::numeric AS advance_paid,
          NULL::numeric AS balance_amount,
          NULL::text AS order_status,
          NULL::text AS payment_status,

          e.next_review_date AS next_review_date

        FROM eye_exams e

        WHERE
          e.store_code = $1
          AND e.next_review_date IS NOT NULL


        UNION ALL


        /*
        =================================================
        OPTICAL CUSTOMERS
        =================================================
        */

        SELECT
          o.id,
          o.store_code,

          o.patient_id,
          o.patient_name,
          o.mobile,

          o.order_date AS activity_date,

          'Optical Customer' AS customer_category,

          o.order_no,
          o.total_amount,
          o.advance_paid,
          o.balance_amount,
          o.status AS order_status,
          o.payment_status,

          NULL::timestamp AS next_review_date

        FROM optical_orders o

        WHERE o.store_code = $1
      )


      /*
      =====================================================
      APPLY FILTERS
      =====================================================
      */

      SELECT

        id,
        store_code,
        patient_id,
        patient_name,
        mobile,
        activity_date,
        customer_category,

        order_no,
        total_amount,
        advance_paid,
        balance_amount,
        order_status,
        payment_status,

        next_review_date

      FROM customer_data

      WHERE

        /*
        ===============================================
        FROM DATE
        ===============================================
        */

        (
          $2 = ''
          OR activity_date >= TO_DATE(
            $2,
            'DD-MM-YYYY'
          )
        )

        AND

        /*
        ===============================================
        TO DATE

        +1 day includes the entire ending date.
        ===============================================
        */

        (
          $3 = ''
          OR activity_date < (
            TO_DATE(
              $3,
              'DD-MM-YYYY'
            ) + INTERVAL '1 day'
          )
        )

        AND

        /*
        ===============================================
        CUSTOMER NAME
        ===============================================
        */

        (
          $4 = ''
          OR patient_name ILIKE
            '%' || $4 || '%'
        )

        AND

        /*
        ===============================================
        MOBILE NUMBER
        ===============================================
        */

        (
          $5 = ''
          OR mobile ILIKE
            '%' || $5 || '%'
        )

        AND

        /*
        ===============================================
        CATEGORY
        ===============================================
        */

        (
          $6 = ''
          OR customer_category = $6
        )

      ORDER BY activity_date DESC
      `,
      [
        storeCode,
        fromDate || "",
        toDate || "",
        customerName,
        mobileNumber,
        category,
      ]
    );

    /*
    =====================================================
    RESPONSE
    =====================================================
    */

    res.json({
      success: true,

      count: result.rows.length,

      filters: {
        storeCode,

        fromDate:
          fromDate || "",

        toDate:
          toDate || "",

        customer:
          customerName,

        patientId:
          mobileNumber,

        customerCategory:
          category || "All",
      },

      data: result.rows,
    });

  } catch (error) {
    console.error(
      "CUSTOMER REPORT ERROR:",
      error
    );

    res.status(500).json({
      success: false,
      message: "Customer report error",
      error: error.message,
    });
  }
});


/*
=========================================================
CUSTOMER REPORT PDF
POST /reports/customer/pdf
=========================================================
*/

router.post("/customer/pdf", async (req, res) => {
  try {
    const {
      storeCode,
      fromDate,
      toDate,
      customer,
      patientId,
      customerCategory,
    } = req.body;

    if (!storeCode) {
      return res.status(400).json({
        success: false,
        message: "Store code required",
      });
    }

    /*
    =====================================================
    NORMALIZE FILTERS
    =====================================================
    */

    const category =
      customerCategory &&
      customerCategory !== "All"
        ? customerCategory
        : "";

    /*
    =====================================================
    GET CUSTOMER DATA
    =====================================================
    */

    const result = await pool.query(
      `
      WITH customer_data AS (

        /*
        ===============================================
        EYE EXAMINATION
        ===============================================
        */

        SELECT
          e.id,
          e.store_code,
          e.patient_id,
          e.patient_name,
          e.mobile_number AS mobile,

          e.created_at AS activity_date,

          'Eye Examination'
            AS customer_category,

          NULL::text
            AS order_no,

          NULL::numeric
            AS total_amount,

          NULL::numeric
            AS advance_paid,

          NULL::numeric
            AS balance_amount,

          NULL::text
            AS order_status,

          NULL::text
            AS payment_status,

          e.next_review_date
            AS next_review_date

        FROM eye_exams e

        WHERE e.store_code = $1


        UNION ALL


        /*
        ===============================================
        FOLLOW-UP CUSTOMER
        ===============================================

        Follow-up comes directly from eye_exams.

        Only records with next_review_date are
        considered follow-ups.

        activity_date = next_review_date
        ===============================================
        */

        SELECT
          e.id,
          e.store_code,
          e.patient_id,
          e.patient_name,
          e.mobile_number AS mobile,

          e.next_review_date AS activity_date,

          'Follow-up Customer'
            AS customer_category,

          NULL::text
            AS order_no,

          NULL::numeric
            AS total_amount,

          NULL::numeric
            AS advance_paid,

          NULL::numeric
            AS balance_amount,

          NULL::text
            AS order_status,

          NULL::text
            AS payment_status,

          e.next_review_date
            AS next_review_date

        FROM eye_exams e

        WHERE
          e.store_code = $1
          AND e.next_review_date IS NOT NULL


        UNION ALL


        /*
        ===============================================
        OPTICAL CUSTOMER
        ===============================================
        */

        SELECT
          o.id,
          o.store_code,
          o.patient_id,
          o.patient_name,
          o.mobile,

          o.order_date AS activity_date,

          'Optical Customer'
            AS customer_category,

          o.order_no,
          o.total_amount,
          o.advance_paid,
          o.balance_amount,
          o.status AS order_status,
          o.payment_status,

          NULL::timestamp
            AS next_review_date

        FROM optical_orders o

        WHERE o.store_code = $1
      )


      SELECT *

      FROM customer_data

      WHERE

        /*
        ===============================================
        FROM DATE
        ===============================================
        */

        (
          $2 = ''
          OR activity_date >= TO_DATE(
            $2,
            'DD-MM-YYYY'
          )
        )

        AND

        /*
        ===============================================
        TO DATE
        ===============================================
        */

        (
          $3 = ''
          OR activity_date < (
            TO_DATE(
              $3,
              'DD-MM-YYYY'
            ) + INTERVAL '1 day'
          )
        )

        AND

        /*
        ===============================================
        CUSTOMER NAME
        ===============================================
        */

        (
          $4 = ''
          OR patient_name ILIKE
            '%' || $4 || '%'
        )

        AND

        /*
        ===============================================
        MOBILE
        ===============================================
        */

        (
          $5 = ''
          OR mobile ILIKE
            '%' || $5 || '%'
        )

        AND

        /*
        ===============================================
        CATEGORY
        ===============================================
        */

        (
          $6 = ''
          OR customer_category = $6
        )

      ORDER BY activity_date DESC
      `,
      [
        storeCode,
        fromDate || "",
        toDate || "",
        customer || "",
        patientId || "",
        category,
      ]
    );

    /*
    =====================================================
    COUNTS
    =====================================================
    */

    let eyeCount = 0;
    let opticalCount = 0;
    let followupCount = 0;

    result.rows.forEach((row) => {

      if (
        row.customer_category ===
        "Eye Examination"
      ) {
        eyeCount++;
      }

      if (
        row.customer_category ===
        "Optical Customer"
      ) {
        opticalCount++;
      }

      if (
        row.customer_category ===
        "Follow-up Customer"
      ) {
        followupCount++;
      }

    });

    /*
    =====================================================
    PDF HEADERS
    =====================================================
    */

    res.setHeader(
      "Content-Type",
      "application/pdf"
    );

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="customer-report-${Date.now()}.pdf"`
    );

    const doc = new PDFDocument({
      margin: 40,
      size: "A4",
    });

    doc.pipe(res);

    /*
    =====================================================
    TITLE
    =====================================================
    */

    doc
      .fontSize(20)
      .font("Helvetica-Bold")
      .text(
        "VISION EYE CARE",
        {
          align: "center",
        }
      );

    doc.moveDown(0.5);

    doc
      .fontSize(16)
      .text(
        "Customer Report",
        {
          align: "center",
        }
      );

    doc.moveDown();

    /*
    =====================================================
    FILTER DETAILS
    =====================================================
    */

    doc
      .fontSize(10)
      .font("Helvetica")
      .text(
        `Store Code : ${storeCode}`
      );

    doc.text(
      `Date Range : ${
        fromDate || "All"
      } - ${
        toDate || "All"
      }`
    );

    doc.text(
      `Customer : ${
        customer || "All"
      }`
    );

    doc.text(
      `Mobile : ${
        patientId || "All"
      }`
    );

    doc.text(
      `Category : ${
        customerCategory || "All"
      }`
    );

    doc.moveDown();

    /*
    =====================================================
    SUMMARY
    =====================================================
    */

    doc
      .fontSize(12)
      .font("Helvetica-Bold")
      .text("Summary");

    doc.moveDown(0.3);

    doc
      .fontSize(10)
      .font("Helvetica")
      .text(
        `Total Records : ${result.rows.length}`
      );

    doc.text(
      `Eye Examinations : ${eyeCount}`
    );

    doc.text(
      `Optical Customers : ${opticalCount}`
    );

    doc.text(
      `Follow-up Customers : ${followupCount}`
    );

    doc.moveDown();

    /*
    =====================================================
    CUSTOMER DETAILS
    =====================================================
    */

    result.rows.forEach(
      (item, index) => {

        if (doc.y > 700) {
          doc.addPage();
        }

        doc
          .fontSize(12)
          .font("Helvetica-Bold")
          .text(
            `${index + 1}. ${
              item.patient_name || "-"
            }`
          );

        doc.moveDown(0.3);

        doc
          .fontSize(9)
          .font("Helvetica");

        const activityDate =
          item.activity_date
            ? new Date(
                item.activity_date
              ).toLocaleDateString(
                "en-IN"
              )
            : "-";

        doc.text(
          `Date : ${activityDate}`
        );

        doc.text(
          `Patient ID : ${
            item.patient_id || "-"
          }`
        );

        doc.text(
          `Customer : ${
            item.patient_name || "-"
          }`
        );

        doc.text(
          `Mobile : ${
            item.mobile || "-"
          }`
        );

        doc.text(
          `Category : ${
            item.customer_category || "-"
          }`
        );

        /*
        ===============================================
        NEXT REVIEW DATE
        ===============================================
        */

        if (
          item.customer_category ===
            "Follow-up Customer" &&
          item.next_review_date
        ) {

          const nextReviewDate =
            new Date(
              item.next_review_date
            ).toLocaleDateString(
              "en-IN"
            );

          doc.text(
            `Next Review Date : ${
              nextReviewDate
            }`
          );

        }

        /*
        ===============================================
        OPTICAL ORDER DETAILS
        ===============================================
        */

        if (item.order_no) {

          doc.text(
            `Order No : ${
              item.order_no
            }`
          );

        }

        if (
          item.total_amount !== null
        ) {

          doc.text(
            `Amount : ₹${Number(
              item.total_amount || 0
            ).toFixed(2)}`
          );

        }

        if (
          item.advance_paid !== null
        ) {

          doc.text(
            `Advance : ₹${Number(
              item.advance_paid || 0
            ).toFixed(2)}`
          );

        }

        if (
          item.balance_amount !== null
        ) {

          doc.text(
            `Balance : ₹${Number(
              item.balance_amount || 0
            ).toFixed(2)}`
          );

        }

        if (item.order_status) {

          doc.text(
            `Status : ${
              item.order_status
            }`
          );

        }

        if (item.payment_status) {

          doc.text(
            `Payment : ${
              item.payment_status
            }`
          );

        }

        doc.moveDown(0.5);

        doc
          .moveTo(40, doc.y)
          .lineTo(555, doc.y)
          .stroke();

        doc.moveDown(0.7);

      }
    );

    /*
    =====================================================
    END PDF
    =====================================================
    */

    doc.end();

  } catch (error) {

    console.error(
      "CUSTOMER PDF ERROR:",
      error
    );

    if (!res.headersSent) {

      res.status(500).json({
        success: false,
        message:
          "Customer PDF generation failed",
        error: error.message,
      });

    }

  }
});


/*
=========================================================
CUSTOMER REPORT EXCEL
POST /reports/customer/excel
=========================================================
*/

router.post("/customer/excel", async (req, res) => {

  try {

    const {
      storeCode,
      fromDate,
      toDate,
      customer,
      patientId,
      customerCategory,
    } = req.body;

    if (!storeCode) {

      return res.status(400).json({
        success: false,
        message: "Store code required",
      });

    }

    const category =
      customerCategory &&
      customerCategory !== "All"
        ? customerCategory
        : "";

    /*
    =====================================================
    GET DATA
    =====================================================
    */

    const result = await pool.query(
      `
      WITH customer_data AS (

        /*
        ===============================================
        EYE EXAMINATION
        ===============================================
        */

        SELECT
          e.id,
          e.store_code,
          e.patient_id,
          e.patient_name,
          e.mobile_number AS mobile,

          e.created_at AS activity_date,

          'Eye Examination'
            AS customer_category,

          NULL::text
            AS order_no,

          NULL::numeric
            AS total_amount,

          NULL::numeric
            AS advance_paid,

          NULL::numeric
            AS balance_amount,

          NULL::text
            AS order_status,

          NULL::text
            AS payment_status,

          e.next_review_date
            AS next_review_date

        FROM eye_exams e

        WHERE e.store_code = $1


        UNION ALL


        /*
        ===============================================
        FOLLOW-UP CUSTOMER
        ===============================================

        Follow-up is generated from
        eye_exams.next_review_date.

        Only non-null next_review_date values
        become follow-up records.

        activity_date = next_review_date
        ===============================================
        */

        SELECT
          e.id,
          e.store_code,
          e.patient_id,
          e.patient_name,
          e.mobile_number AS mobile,

          e.next_review_date AS activity_date,

          'Follow-up Customer'
            AS customer_category,

          NULL::text
            AS order_no,

          NULL::numeric
            AS total_amount,

          NULL::numeric
            AS advance_paid,

          NULL::numeric
            AS balance_amount,

          NULL::text
            AS order_status,

          NULL::text
            AS payment_status,

          e.next_review_date
            AS next_review_date

        FROM eye_exams e

        WHERE
          e.store_code = $1
          AND e.next_review_date IS NOT NULL


        UNION ALL


        /*
        ===============================================
        OPTICAL CUSTOMER
        ===============================================
        */

        SELECT
          o.id,
          o.store_code,
          o.patient_id,
          o.patient_name,
          o.mobile,

          o.order_date AS activity_date,

          'Optical Customer'
            AS customer_category,

          o.order_no,
          o.total_amount,
          o.advance_paid,
          o.balance_amount,
          o.status AS order_status,
          o.payment_status,

          NULL::timestamp
            AS next_review_date

        FROM optical_orders o

        WHERE o.store_code = $1
      )


      SELECT *

      FROM customer_data

      WHERE

        /*
        ===============================================
        FROM DATE
        ===============================================
        */

        (
          $2 = ''
          OR activity_date >= TO_DATE(
            $2,
            'DD-MM-YYYY'
          )
        )

        AND

        /*
        ===============================================
        TO DATE
        ===============================================
        */

        (
          $3 = ''
          OR activity_date < (
            TO_DATE(
              $3,
              'DD-MM-YYYY'
            ) + INTERVAL '1 day'
          )
        )

        AND

        /*
        ===============================================
        CUSTOMER NAME
        ===============================================
        */

        (
          $4 = ''
          OR patient_name ILIKE
            '%' || $4 || '%'
        )

        AND

        /*
        ===============================================
        MOBILE
        ===============================================
        */

        (
          $5 = ''
          OR mobile ILIKE
            '%' || $5 || '%'
        )

        AND

        /*
        ===============================================
        CATEGORY
        ===============================================
        */

        (
          $6 = ''
          OR customer_category = $6
        )

      ORDER BY activity_date DESC
      `,
      [
        storeCode,
        fromDate || "",
        toDate || "",
        customer || "",
        patientId || "",
        category,
      ]
    );

    /*
    =====================================================
    CREATE WORKBOOK
    =====================================================
    */

    const workbook =
      new ExcelJS.Workbook();

    const sheet =
      workbook.addWorksheet(
        "Customer Report"
      );

    /*
    =====================================================
    TITLE
    =====================================================
    */

    sheet.mergeCells(
      "A1:L1"
    );

    sheet.getCell("A1").value =
      "VISION EYE CARE - CUSTOMER REPORT";

    sheet.getCell("A1").font = {
      bold: true,
      size: 18,
    };

    sheet.getCell("A1").alignment = {
      horizontal: "center",
      vertical: "middle",
    };

    /*
    =====================================================
    FILTERS
    =====================================================
    */

    sheet.mergeCells("A2:L2");

    sheet.getCell("A2").value =
      `Store Code : ${storeCode}`;

    sheet.mergeCells("A3:L3");

    sheet.getCell("A3").value =
      `Date Range : ${
        fromDate || "All"
      } - ${
        toDate || "All"
      }`;

    sheet.mergeCells("A4:L4");

    sheet.getCell("A4").value =
      `Customer : ${
        customer || "All"
      }`;

    sheet.mergeCells("A5:L5");

    sheet.getCell("A5").value =
      `Mobile : ${
        patientId || "All"
      }`;

    sheet.mergeCells("A6:L6");

    sheet.getCell("A6").value =
      `Category : ${
        customerCategory || "All"
      }`;

    /*
    =====================================================
    SUMMARY
    =====================================================
    */

    let eyeCount = 0;
    let opticalCount = 0;
    let followupCount = 0;

    result.rows.forEach((row) => {

      if (
        row.customer_category ===
        "Eye Examination"
      ) {
        eyeCount++;
      }

      if (
        row.customer_category ===
        "Optical Customer"
      ) {
        opticalCount++;
      }

      if (
        row.customer_category ===
        "Follow-up Customer"
      ) {
        followupCount++;
      }

    });

    sheet.addRow([]);

    sheet.addRow([
      "Total Records",
      result.rows.length,
    ]);

    sheet.addRow([
      "Eye Examinations",
      eyeCount,
    ]);

    sheet.addRow([
      "Optical Customers",
      opticalCount,
    ]);

    sheet.addRow([
      "Follow-up Customers",
      followupCount,
    ]);

    sheet.addRow([]);

    /*
    =====================================================
    TABLE HEADER
    =====================================================
    */

    const header =
      sheet.addRow([
        "Date",
        "Patient ID",
        "Customer",
        "Mobile",
        "Category",
        "Next Review Date",
        "Order No",
        "Amount",
        "Advance",
        "Balance",
        "Status",
        "Payment",
      ]);

    header.font = {
      bold: true,
    };

    header.alignment = {
      horizontal: "center",
      vertical: "middle",
    };

    /*
    =====================================================
    DATA
    =====================================================
    */

    result.rows.forEach((row) => {

      const excelRow =
        sheet.addRow([

          row.activity_date
            ? new Date(
                row.activity_date
              )
            : "",

          row.patient_id || "",

          row.patient_name || "",

          row.mobile || "",

          row.customer_category || "",

          row.next_review_date
            ? new Date(
                row.next_review_date
              )
            : "",

          row.order_no || "",

          row.total_amount !== null
            ? Number(
                row.total_amount
              )
            : "",

          row.advance_paid !== null
            ? Number(
                row.advance_paid
              )
            : "",

          row.balance_amount !== null
            ? Number(
                row.balance_amount
              )
            : "",

          row.order_status || "",

          row.payment_status || "",
        ]);

      /*
      ===============================================
      DATE FORMAT
      ===============================================
      */

      if (row.activity_date) {

        excelRow.getCell(1).numFmt =
          "dd-mm-yyyy";

      }

      if (row.next_review_date) {

        excelRow.getCell(6).numFmt =
          "dd-mm-yyyy";

      }

      /*
      ===============================================
      MONEY FORMAT

      H = Amount
      I = Advance
      J = Balance
      ===============================================
      */

      excelRow.getCell(8).numFmt =
        '₹#,##0.00';

      excelRow.getCell(9).numFmt =
        '₹#,##0.00';

      excelRow.getCell(10).numFmt =
        '₹#,##0.00';

    });

    /*
    =====================================================
    COLUMN WIDTHS
    =====================================================
    */

    sheet.columns = [

      {
        key: "activity_date",
        width: 15,
      },

      {
        key: "patient_id",
        width: 18,
      },

      {
        key: "patient_name",
        width: 25,
      },

      {
        key: "mobile",
        width: 16,
      },

      {
        key: "customer_category",
        width: 24,
      },

      {
        key: "next_review_date",
        width: 20,
      },

      {
        key: "order_no",
        width: 20,
      },

      {
        key: "total_amount",
        width: 15,
      },

      {
        key: "advance_paid",
        width: 15,
      },

      {
        key: "balance_amount",
        width: 15,
      },

      {
        key: "order_status",
        width: 15,
      },

      {
        key: "payment_status",
        width: 18,
      },

    ];

    /*
    =====================================================
    FREEZE TABLE HEADER
    =====================================================
    */

    sheet.views = [
      {
        state: "frozen",
        ySplit: 12,
      },
    ];

    /*
    =====================================================
    RESPONSE
    =====================================================
    */

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="customer-report-${Date.now()}.xlsx"`
    );

    await workbook.xlsx.write(res);

    res.end();

  } catch (error) {

    console.error(
      "CUSTOMER EXCEL ERROR:",
      error
    );

    if (!res.headersSent) {

      res.status(500).json({
        success: false,
        message:
          "Customer Excel generation failed",
        error: error.message,
      });

    }

  }

});



// ============================================================
// BUILD STOCK QUERY
// ============================================================

const buildStockQuery = (storeCode, queryParams = {}) => {

  const { category } = queryParams;

  let sql = `
    SELECT
      id,
      store_code,
      category,
      barcode,

      -- COMMON
      brand,
      purchase_price,
      selling_price,
      quantity,

      -- FRAMES
      frame_name,
      model,
      color,
      size,
      material,
      gender,

      -- LENSES
      lens_type,
      power_range,
      coating,
      lens_index,

      -- CONTACT LENSES
      contact_type,
      power,
      base_curve,
      diameter,
      expiry_date,

      -- ACCESSORIES
      accessory_name,

      created_at,
      updated_at

    FROM stock_inventory

    WHERE store_code = $1
  `;

  const values = [storeCode];

  let paramIndex = 2;


  // ==========================================================
  // CATEGORY FILTER
  // ==========================================================

  if (
    category &&
    category !== "All" &&
    category.trim() !== ""
  ) {

    sql += `
      AND LOWER(category) = LOWER($${paramIndex})
    `;

    values.push(category.trim());

    paramIndex++;

  }


  // ==========================================================
  // ORDER
  // ==========================================================

  sql += `
    ORDER BY created_at DESC, id DESC
  `;


  return {
    sql,
    values,
  };

};


// ============================================================
// CATEGORY NORMALIZER
// ============================================================

const normalizeCategory = (category) => {

  if (!category) {
    return "All";
  }

  const value =
    category
      .toString()
      .trim()
      .toLowerCase();

  if (value === "frames") {
    return "frames";
  }

  if (value === "lenses") {
    return "lenses";
  }

  if (
    value === "contact_lenses" ||
    value === "contact lenses" ||
    value === "contact-lenses"
  ) {
    return "contact_lenses";
  }

  if (value === "accessories") {
    return "accessories";
  }

  return "all";

};


// ============================================================
// GET REPORT COLUMNS
//
// These columns exactly match AddStockScreen fields.
// ============================================================

const getReportColumns = (category) => {

  const normalized =
    normalizeCategory(category);


  // ==========================================================
  // FRAMES
  // ==========================================================

  if (normalized === "frames") {

    return [

      {
        key: "brand",
        label: "Brand",
      },

      {
        key: "frame_name",
        label: "Frame Name",
      },

      {
        key: "gender",
        label: "Gender",
      },

      {
        key: "purchase_price",
        label: "Purchase Price",
        money: true,
      },

      {
        key: "selling_price",
        label: "Selling Price",
        money: true,
      },

      {
        key: "quantity",
        label: "Quantity",
      },

    ];

  }


  // ==========================================================
  // LENSES
  // ==========================================================

  if (normalized === "lenses") {

    return [

      {
        key: "brand",
        label: "Brand",
      },

      {
        key: "lens_type",
        label: "Lens Type",
      },

      {
        key: "power_range",
        label: "Power Range",
      },

      {
        key: "coating",
        label: "Coating",
      },

      {
        key: "lens_index",
        label: "Index",
      },

      {
        key: "quantity",
        label: "Quantity",
      },

      {
        key: "purchase_price",
        label: "Purchase Price",
        money: true,
      },

      {
        key: "selling_price",
        label: "Selling Price",
        money: true,
      },

    ];

  }


  // ==========================================================
  // CONTACT LENSES
  // ==========================================================

  if (normalized === "contact_lenses") {

    return [

      {
        key: "brand",
        label: "Brand",
      },

      {
        key: "contact_type",
        label: "Type",
      },

      {
        key: "quantity",
        label: "Quantity",
      },

      {
        key: "purchase_price",
        label: "Purchase Price",
        money: true,
      },

      {
        key: "selling_price",
        label: "Selling Price",
        money: true,
      },

    ];

  }


  // ==========================================================
  // ACCESSORIES
  // ==========================================================

  if (normalized === "accessories") {

    return [

      {
        key: "brand",
        label: "Brand",
      },

      {
        key: "accessory_name",
        label: "Accessory Name",
      },

      {
        key: "quantity",
        label: "Quantity",
      },

      {
        key: "purchase_price",
        label: "Purchase Price",
        money: true,
      },

      {
        key: "selling_price",
        label: "Selling Price",
        money: true,
      },

    ];

  }


  // ==========================================================
  // ALL CATEGORIES
  //
  // Since different categories have different fields,
  // show all possible category-specific fields.
  // ==========================================================

  return [

    {
      key: "brand",
      label: "Brand",
    },

    {
      key: "frame_name",
      label: "Frame Name",
    },

    {
      key: "lens_type",
      label: "Lens Type",
    },

    {
      key: "power_range",
      label: "Power Range",
    },

    {
      key: "coating",
      label: "Coating",
    },

    {
      key: "lens_index",
      label: "Index",
    },

    {
      key: "contact_type",
      label: "Contact Type",
    },

    {
      key: "accessory_name",
      label: "Accessory Name",
    },

    {
      key: "gender",
      label: "Gender",
    },

    {
      key: "quantity",
      label: "Quantity",
    },

    {
      key: "purchase_price",
      label: "Purchase Price",
      money: true,
    },

    {
      key: "selling_price",
      label: "Selling Price",
      money: true,
    },

  ];

};


// ============================================================
// DISPLAY VALUE HELPER
// ============================================================

const getDisplayValue = (row, column) => {

  const value = row[column.key];


  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {

    return "";

  }


  if (column.money) {

    return Number(value || 0).toFixed(2);

  }


  return String(value);

};


// ============================================================
// GET STOCK JSON
//
// GET /reports/stock/:storeCode
//
// Examples:
//
// /reports/stock/STORE001
// /reports/stock/STORE001?category=frames
// /reports/stock/STORE001?category=lenses
// /reports/stock/STORE001?category=contact_lenses
// /reports/stock/STORE001?category=accessories
// ============================================================

router.get(
  "/stock/:storeCode",
  async (req, res) => {
    try {
      const { storeCode } = req.params;
      const { category } = req.query;

      // =====================================================
      // VALIDATE STORE
      // =====================================================

      if (!storeCode) {
        return res.status(400).json({
          success: false,
          message: "Store code is required",
        });
      }

      // =====================================================
      // NORMALIZE CATEGORY
      // Same category handling as PDF
      // =====================================================

      const reportCategory =
        normalizeCategory(category);

      // =====================================================
      // BUILD STOCK QUERY
      // Same buildStockQuery used by PDF
      // =====================================================

      const {
        sql,
        values,
      } = buildStockQuery(
        storeCode,
        {
          category: reportCategory,
        }
      );

      console.log(
        "STOCK REPORT SQL:",
        sql
      );

      console.log(
        "STOCK REPORT VALUES:",
        values
      );

      // =====================================================
      // EXECUTE QUERY
      // =====================================================

      const result =
        await pool.query(
          sql,
          values
        );

      const rows =
        result.rows;

      // =====================================================
      // GET REPORT COLUMNS
      // Same category logic as PDF
      // =====================================================

      const columns =
        getReportColumns(
          reportCategory
        );

      // =====================================================
      // RESPONSE
      // =====================================================

      return res.status(200).json({
        success: true,

        count:
          rows.length,

        filters: {
          storeCode,

          category:
            reportCategory || "All",
        },

        columns,

        data:
          rows,
      });

    } catch (error) {

      console.error(
        "STOCK REPORT ERROR:",
        error
      );

      return res.status(500).json({
        success: false,

        message:
          "Failed to generate stock report",

        error:
          error.message,
      });
    }
  }
);

// ============================================================
// STOCK PDF
//
// GET /reports/stock/:storeCode/pdf
// ============================================================

router.get(
  "/stock/:storeCode/pdf",
  async (req, res) => {

    try {

      const { storeCode } =
        req.params;

      const { category } =
        req.query;


      if (!storeCode) {

        return res.status(400).json({

          success: false,

          message:
            "Store code is required",

        });

      }


      // ======================================================
      // QUERY
      // ======================================================

      const {
        sql,
        values,
      } = buildStockQuery(
        storeCode,
        {
          category,
        }
      );


      const result =
        await pool.query(
          sql,
          values
        );


      const rows =
        result.rows;


      // ======================================================
      // CATEGORY
      // ======================================================

      const reportCategory =
        normalizeCategory(category);


      const columns =
        getReportColumns(
          reportCategory
        );


      // ======================================================
      // PDF RESPONSE
      // ======================================================

      res.setHeader(
        "Content-Type",
        "application/pdf"
      );


      res.setHeader(
        "Content-Disposition",
        `attachment; filename="stock-report-${storeCode}.pdf"`
      );


      // ======================================================
      // CREATE PDF
      // ======================================================

      const doc =
        new PDFDocument({

          size: "A4",

          layout: "landscape",

          margin: 25,

          bufferPages: true,

        });


      doc.pipe(res);


      // ======================================================
      // TITLE
      // ======================================================

      doc
        .font("Helvetica-Bold")
        .fontSize(20)
        .fillColor("#0F172A")
        .text(
          "STOCK REPORT",
          {
            align: "center",
          }
        );


      doc.moveDown(0.5);


      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor("#334155")
        .text(
          `Store Code: ${storeCode}`,
          {
            align: "center",
          }
        );


      doc.text(
        `Category: ${
          category || "All"
        }`,
        {
          align: "center",
        }
      );


      doc.moveDown();


      // ======================================================
      // SUMMARY
      // ======================================================

      const totalQuantity =
        rows.reduce(
          (sum, row) =>
            sum +
            Number(
              row.quantity || 0
            ),
          0
        );


      const totalPurchase =
        rows.reduce(
          (sum, row) =>
            sum +
            Number(
              row.quantity || 0
            ) *
            Number(
              row.purchase_price || 0
            ),
          0
        );


      const totalSelling =
        rows.reduce(
          (sum, row) =>
            sum +
            Number(
              row.quantity || 0
            ) *
            Number(
              row.selling_price || 0
            ),
          0
        );


      doc
        .font("Helvetica-Bold")
        .fontSize(9)
        .fillColor("#0F172A")
        .text(
          `Products: ${rows.length}   |   Quantity: ${totalQuantity}   |   Purchase Value: ₹${totalPurchase.toFixed(
            2
          )}   |   Selling Value: ₹${totalSelling.toFixed(
            2
          )}`
        );


      doc.moveDown();


      // ======================================================
      // PDF TABLE COLUMNS
      // ======================================================

      const pdfColumns = [

        ["S.No", 40],

        ["Barcode", 70],

        ...columns.map(
          (column) => [
            column.label,
            80,
          ]
        ),

      ];


      // ======================================================
      // SCALE TABLE TO PAGE WIDTH
      // ======================================================

      const pageWidth = 792;

      const availableWidth =
        pageWidth - 50;


      const originalWidth =
        pdfColumns.reduce(
          (sum, [, width]) =>
            sum + width,
          0
        );


      const scale =
        Math.min(
          1,
          availableWidth /
            originalWidth
        );


      const scaledColumns =
        pdfColumns.map(
          ([title, width]) => [
            title,
            width * scale,
          ]
        );


      const startX = 25;

      const rowHeight = 25;


      // ======================================================
      // DRAW HEADER
      // ======================================================

      const drawHeader = () => {

        let x = startX;

        const y = doc.y;


        doc
          .font("Helvetica-Bold")
          .fontSize(7);


        scaledColumns.forEach(
          ([title, width]) => {

            doc
              .rect(
                x,
                y,
                width,
                rowHeight
              )
              .fillAndStroke(
                "#E2E8F0",
                "#94A3B8"
              );


            doc
              .fillColor("#0F172A")
              .text(
                title,
                x + 2,
                y + 8,
                {
                  width:
                    width - 4,

                  height:
                    rowHeight - 4,

                  align:
                    "center",

                  ellipsis:
                    true,
                }
              );


            x += width;

          }
        );


        doc.y =
          y + rowHeight;


        doc.fillColor("#000");

      };


      // ======================================================
      // DRAW ROW
      // ======================================================

      const drawRow = (
        row,
        index
      ) => {

        if (doc.y > 525) {

          doc.addPage();

          drawHeader();

        }


        let x = startX;

        const y = doc.y;


        const values = [

          index + 1,

          row.barcode || "",

          ...columns.map(
            (column) =>
              getDisplayValue(
                row,
                column
              )
          ),

        ];


        doc
          .font("Helvetica")
          .fontSize(6.5);


        scaledColumns.forEach(
          ([title, width], i) => {

            doc
              .rect(
                x,
                y,
                width,
                rowHeight
              )
              .stroke("#CBD5E1");


            const column =
              i >= 2
                ? columns[i - 2]
                : null;


            const isNumber =
              i === 0 ||
              i === 1 ||
              column?.key ===
                "quantity" ||
              column?.money;


            doc
              .fillColor("#334155")
              .text(
                String(
                  values[i] ?? ""
                ),
                x + 3,
                y + 7,
                {
                  width:
                    width - 6,

                  height:
                    rowHeight - 4,

                  ellipsis:
                    true,

                  align:
                    isNumber
                      ? "right"
                      : "left",
                }
              );


            x += width;

          }
        );


        doc.y =
          y + rowHeight;


        doc.fillColor("#000");

      };


      // ======================================================
      // DRAW TABLE
      // ======================================================

      drawHeader();


      rows.forEach(
        (row, index) => {

          drawRow(
            row,
            index
          );

        }
      );


      // ======================================================
      // NO DATA
      // ======================================================

      if (
        rows.length === 0
      ) {

        doc
          .font("Helvetica")
          .fontSize(12)
          .fillColor("#334155")
          .text(
            "No stock records found for the selected category.",
            {
              align: "center",
            }
          );

      }


      // ======================================================
      // FOOTER
      // ======================================================

      const pageRange =
        doc.bufferedPageRange();


      for (
        let i =
          pageRange.start;

        i <
          pageRange.start +
            pageRange.count;

        i++
      ) {

        doc.switchToPage(i);


        doc
          .font("Helvetica")
          .fontSize(7)
          .fillColor("#64748B")
          .text(
            `Generated: ${new Date().toLocaleString(
              "en-IN"
            )} | Page ${
              i + 1
            } of ${
              pageRange.count
            }`,
            25,
            560,
            {
              align:
                "center",

              width:
                742,
            }
          );

      }


      doc.end();

    } catch (error) {

      console.error(
        "STOCK PDF ERROR:",
        error
      );


      if (
        !res.headersSent
      ) {

        return res.status(
          500
        ).json({

          success: false,

          message:
            "Failed to generate stock PDF",

          error:
            error.message,

        });

      }

    }

  }
);


// ============================================================
// STOCK EXCEL
//
// GET /reports/stock/:storeCode/excel
// ============================================================

router.get(
  "/stock/:storeCode/excel",
  async (req, res) => {

    try {

      const { storeCode } =
        req.params;

      const { category } =
        req.query;


      if (!storeCode) {

        return res.status(400).json({

          success: false,

          message:
            "Store code is required",

        });

      }


      // ======================================================
      // QUERY
      // ======================================================

      const {
        sql,
        values,
      } = buildStockQuery(
        storeCode,
        {
          category,
        }
      );


      const result =
        await pool.query(
          sql,
          values
        );


      const rows =
        result.rows;


      // ======================================================
      // CATEGORY COLUMNS
      // ======================================================

      const reportCategory =
        normalizeCategory(category);


      const columns =
        getReportColumns(
          reportCategory
        );


      // ======================================================
      // WORKBOOK
      // ======================================================

      const workbook =
        new ExcelJS.Workbook();


      workbook.creator =
        "VisionTrack";


      workbook.created =
        new Date();


      const worksheet =
        workbook.addWorksheet(
          "Stock Report"
        );


      // ======================================================
      // TOTAL COLUMN COUNT
      // ======================================================

      const totalColumns =
        2 + columns.length;


      const lastColumn =
        worksheet.getColumn(
          totalColumns
        ).letter;


      // ======================================================
      // TITLE
      // ======================================================

      worksheet.mergeCells(
        `A1:${lastColumn}1`
      );


      worksheet.getCell(
        "A1"
      ).value =
        "STOCK REPORT";


      worksheet.getCell(
        "A1"
      ).font = {

        bold: true,

        size: 18,

      };


      worksheet.getCell(
        "A1"
      ).alignment = {

        horizontal:
          "center",

      };


      // ======================================================
      // STORE
      // ======================================================

      worksheet.mergeCells(
        `A2:${lastColumn}2`
      );


      worksheet.getCell(
        "A2"
      ).value =
        `Store Code: ${storeCode}`;


      // ======================================================
      // CATEGORY
      // ======================================================

      worksheet.mergeCells(
        `A3:${lastColumn}3`
      );


      worksheet.getCell(
        "A3"
      ).value =
        `Category: ${
          category || "All"
        }`;


      // ======================================================
      // SUMMARY
      // ======================================================

      const totalQuantity =
        rows.reduce(
          (sum, row) =>
            sum +
            Number(
              row.quantity || 0
            ),
          0
        );


      const totalPurchase =
        rows.reduce(
          (sum, row) =>
            sum +
            Number(
              row.quantity || 0
            ) *
            Number(
              row.purchase_price || 0
            ),
          0
        );


      const totalSelling =
        rows.reduce(
          (sum, row) =>
            sum +
            Number(
              row.quantity || 0
            ) *
            Number(
              row.selling_price || 0
            ),
          0
        );


      const summaryRow =
        worksheet.getRow(4);


      summaryRow.values = [

        "Products",

        rows.length,

        "Total Quantity",

        totalQuantity,

        "Purchase Value",

        totalPurchase,

        "Selling Value",

        totalSelling,

      ];


      summaryRow.font = {

        bold: true,

      };


      // ======================================================
      // HEADER
      // ======================================================

      const headerRow =
        6;


      const headers = [

        "S.No",

        "Barcode",

        ...columns.map(
          (column) =>
            column.label
        ),

      ];


      worksheet.getRow(
        headerRow
      ).values =
        headers;


      worksheet.getRow(
        headerRow
      ).font = {

        bold: true,

      };


      worksheet.getRow(
        headerRow
      ).alignment = {

        horizontal:
          "center",

        vertical:
          "middle",

      };


      worksheet.getRow(
        headerRow
      ).height = 25;


      // ======================================================
      // DATA
      // ======================================================

      rows.forEach(
        (row, index) => {

          const dataRow = [

            index + 1,

            row.barcode || "",

            ...columns.map(
              (column) => {

                if (
                  column.key ===
                  "quantity"
                ) {

                  return Number(
                    row.quantity || 0
                  );

                }


                if (
                  column.money
                ) {

                  return Number(
                    row[column.key] || 0
                  );

                }


                return (
                  row[column.key] ||
                  ""
                );

              }
            ),

          ];


          worksheet.addRow(
            dataRow
          );

        }
      );


      // ======================================================
      // COLUMN WIDTHS
      // ======================================================

      worksheet.columns = [

        {
          key: "sno",
          width: 8,
        },

        {
          key: "barcode",
          width: 18,
        },

        ...columns.map(
          (column) => {

            let width = 18;


            if (
              column.key ===
              "frame_name"
            ) {

              width = 25;

            }


            if (
              column.key ===
              "accessory_name"
            ) {

              width = 25;

            }


            if (
              column.key ===
              "power_range"
            ) {

              width = 20;

            }


            if (
              column.key ===
              "lens_type"
            ) {

              width = 20;

            }


            if (
              column.key ===
              "coating"
            ) {

              width = 20;

            }


            return {

              key:
                column.key,

              width,

            };

          }
        ),

      ];


      // ======================================================
      // CURRENCY FORMAT
      // ======================================================

      rows.forEach(
        (row, index) => {

          const excelRow =
            headerRow +
            1 +
            index;


          columns.forEach(
            (column, columnIndex) => {

              if (
                column.money
              ) {

                worksheet.getCell(
                  excelRow,
                  columnIndex + 3
                ).numFmt =
                  '₹#,##0.00';

              }

            }
          );

        }
      );


      // ======================================================
      // AUTO FILTER
      // ======================================================

      worksheet.autoFilter = {

        from:
          `A${headerRow}`,

        to:
          `${lastColumn}${headerRow}`,

      };


      // ======================================================
      // FREEZE HEADER
      // ======================================================

      worksheet.views = [

        {

          state:
            "frozen",

          ySplit:
            headerRow,

        },

      ];


      // ======================================================
      // BORDERS
      // ======================================================

      worksheet.eachRow(
        (row, rowNumber) => {

          if (
            rowNumber >=
            headerRow
          ) {

            row.eachCell(
              (cell) => {

                cell.border = {

                  top: {
                    style: "thin",
                  },

                  left: {
                    style: "thin",
                  },

                  bottom: {
                    style: "thin",
                  },

                  right: {
                    style: "thin",
                  },

                };

              }
            );

          }

        }
      );


      // ======================================================
      // HEADER ALIGNMENT
      // ======================================================

      worksheet.getRow(
        headerRow
      ).eachCell(
        (cell) => {

          cell.alignment = {

            horizontal:
              "center",

            vertical:
              "middle",

            wrapText:
              true,

          };

        }
      );


      // ======================================================
      // RESPONSE
      // ======================================================

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );


      res.setHeader(
        "Content-Disposition",
        `attachment; filename="stock-report-${storeCode}.xlsx"`
      );


      await workbook.xlsx.write(
        res
      );


      res.end();

    } catch (error) {

      console.error(
        "STOCK EXCEL ERROR:",
        error
      );


      if (
        !res.headersSent
      ) {

        return res.status(
          500
        ).json({

          success: false,

          message:
            "Failed to generate stock Excel",

          error:
            error.message,

        });

      }

    }

  }
);


// ============================================================
// EXPORT
// ============================================================

module.exports = router;