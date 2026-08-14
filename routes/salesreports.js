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

/*
=========================================================
STOCK REPORT HELPER
=========================================================
*/

const buildStockQuery = (storeCode, queryParams = {}) => {
  const {
    category,
    fromDate,
    toDate,
  } = queryParams;

  let query = `
    SELECT
      id,
      barcode,
      category,

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
      quantity,
      created_at

    FROM stock_inventory

    WHERE store_code = $1
  `;

  const params = [storeCode];
  let paramIndex = 2;


  /*
  ========================================================
  CATEGORY FILTER

  Examples:

  Frames          -> frames
  Lenses          -> lenses
  Contact Lenses  -> contact_lenses
  Accessories     -> accessories
  Goggles         -> goggles

  Case insensitive.
  Space and underscore are treated the same.
  ========================================================
  */

  if (
    category &&
    category.trim() !== "" &&
    category.trim().toLowerCase() !== "all"
  ) {
    query += `
      AND LOWER(
        REPLACE(
          TRIM(category),
          ' ',
          '_'
        )
      ) =
      LOWER(
        REPLACE(
          TRIM($${paramIndex}),
          ' ',
          '_'
        )
      )
    `;

    params.push(category.trim());
    paramIndex++;
  }


  /*
  ========================================================
  FROM DATE
  Frontend format:
  DD-MM-YYYY
  ========================================================
  */

  if (
    fromDate &&
    fromDate.trim() !== ""
  ) {
    query += `
      AND DATE(created_at) >=
      TO_DATE($${paramIndex}, 'DD-MM-YYYY')
    `;

    params.push(fromDate.trim());
    paramIndex++;
  }


  /*
  ========================================================
  TO DATE
  Frontend format:
  DD-MM-YYYY
  ========================================================
  */

  if (
    toDate &&
    toDate.trim() !== ""
  ) {
    query += `
      AND DATE(created_at) <=
      TO_DATE($${paramIndex}, 'DD-MM-YYYY')
    `;

    params.push(toDate.trim());
    paramIndex++;
  }


  /*
  ========================================================
  ORDER
  ========================================================
  */

  query += `
    ORDER BY id DESC
  `;


  return {
    query,
    params,
  };
};



/*
=========================================================
STOCK REPORT
GET /reports/stock/:storeCode

Examples:

/reports/stock/STORE001

/reports/stock/STORE001?category=Frames

/reports/stock/STORE001?category=Lenses

/reports/stock/STORE001?category=Contact%20Lenses

/reports/stock/STORE001?category=Accessories

/reports/stock/STORE001?category=Goggles

/reports/stock/STORE001?category=Frames&fromDate=01-08-2026&toDate=14-08-2026
=========================================================
*/

router.get(
  "/stock/:storeCode",
  async (req, res) => {
    try {
      const { storeCode } = req.params;

      const {
        category,
        fromDate,
        toDate,
      } = req.query;


      const {
        query,
        params,
      } = buildStockQuery(
        storeCode,
        {
          category,
          fromDate,
          toDate,
        }
      );


      const result =
        await pool.query(
          query,
          params
        );


      res.json({
        success: true,

        count:
          result.rows.length,

        filters: {
          category:
            category &&
            category.trim() !== ""
              ? category
              : "All",

          fromDate:
            fromDate || "",

          toDate:
            toDate || "",
        },

        data:
          result.rows,
      });

    } catch (error) {

      console.log(
        "STOCK REPORT ERROR",
        error
      );

      res.status(500).json({
        success: false,
        message: "Stock report error",
        error: error.message,
      });
    }
  }
);



/*
=========================================================
STOCK REPORT PDF
GET /reports/stock/:storeCode/pdf
=========================================================
*/

router.get(
  "/stock/:storeCode/pdf",
  async (req, res) => {
    try {
      const { storeCode } = req.params;

      const {
        category,
        fromDate,
        toDate,
      } = req.query;


      /*
      ================================================
      BUILD QUERY
      ================================================
      */

      const {
        query,
        params,
      } = buildStockQuery(
        storeCode,
        {
          category,
          fromDate,
          toDate,
        }
      );


      const result =
        await pool.query(
          query,
          params
        );


      /*
      ================================================
      PDF HEADERS
      ================================================
      */

      res.setHeader(
        "Content-Type",
        "application/pdf"
      );

      res.setHeader(
        "Content-Disposition",
        "attachment; filename=stock-report.pdf"
      );


      const doc =
        new PDFDocument({
          margin: 40,
        });


      doc.pipe(res);


      /*
      ================================================
      TITLE
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


      doc.moveDown();


      doc
        .fontSize(16)
        .text(
          "Stock Report",
          {
            align: "center",
          }
        );


      doc.moveDown(2);


      /*
      ================================================
      REPORT INFORMATION
      ================================================
      */

      doc
        .fontSize(11)
        .font("Helvetica")
        .text(
          `Store Code : ${storeCode}`
        );


      doc.text(
        `Category : ${
          category &&
          category.trim() !== ""
            ? category
            : "All Categories"
        }`
      );


      doc.text(
        `From Date : ${
          fromDate || "All"
        }`
      );


      doc.text(
        `To Date : ${
          toDate || "All"
        }`
      );


      doc.moveDown();


      /*
      ================================================
      TOTAL QUANTITY
      ================================================
      */

      let totalQuantity = 0;


      /*
      ================================================
      STOCK RECORDS
      ================================================
      */

      result.rows.forEach(
        (item, index) => {

          doc.moveDown();


          /*
          ============================================
          NORMALIZE CATEGORY
          ============================================
          */

          const normalizedCategory =
            String(
              item.category || ""
            )
              .trim()
              .toLowerCase()
              .replace(/\s+/g, "_");


          /*
          ============================================
          PRODUCT NAME
          ============================================
          */

          let productName = "";


          if (
            normalizedCategory === "frames"
          ) {

            productName =
              `${item.brand || ""} ${
                item.frame_name ||
                item.model ||
                ""
              }`;

          } else if (
            normalizedCategory === "lenses"
          ) {

            productName =
              `${item.brand || ""} ${
                item.lens_type ||
                ""
              }`;

          } else if (
            normalizedCategory ===
            "contact_lenses"
          ) {

            productName =
              `${item.brand || ""} ${
                item.contact_type ||
                ""
              }`;

          } else if (
            normalizedCategory ===
            "accessories"
          ) {

            productName =
              `${item.brand || ""} ${
                item.accessory_name ||
                ""
              }`;

          } else if (
            normalizedCategory ===
            "goggles"
          ) {

            productName =
              `${item.brand || ""} ${
                item.accessory_name ||
                item.model ||
                item.frame_name ||
                ""
              }`;

          } else {

            productName =
              `${item.brand || ""} ${
                item.accessory_name ||
                item.frame_name ||
                item.model ||
                item.lens_type ||
                item.contact_type ||
                ""
              }`;
          }


          /*
          ============================================
          PRODUCT TITLE
          ============================================
          */

          doc
            .fontSize(12)
            .font("Helvetica-Bold")
            .text(
              `${index + 1}. ${
                productName.trim() ||
                "Stock Item"
              }`
            );


          /*
          ============================================
          PRODUCT DETAILS
          ============================================
          */

          doc
            .fontSize(10)
            .font("Helvetica")
            .text(`

Category : ${
              item.category || "-"
            }

Barcode : ${
              item.barcode || "-"
            }

Brand : ${
              item.brand || "-"
            }

Frame Name : ${
              item.frame_name || "-"
            }

Model : ${
              item.model || "-"
            }

Color : ${
              item.color || "-"
            }

Size : ${
              item.size || "-"
            }

Material : ${
              item.material || "-"
            }

Gender : ${
              item.gender || "-"
            }

Lens Type : ${
              item.lens_type || "-"
            }

Power Range : ${
              item.power_range || "-"
            }

Coating : ${
              item.coating || "-"
            }

Lens Index : ${
              item.lens_index || "-"
            }

Contact Type : ${
              item.contact_type || "-"
            }

Power : ${
              item.power || "-"
            }

Base Curve : ${
              item.base_curve || "-"
            }

Diameter : ${
              item.diameter || "-"
            }

Expiry Date : ${
              item.expiry_date
                ? new Date(
                    item.expiry_date
                  ).toLocaleDateString(
                    "en-IN"
                  )
                : "-"
            }

Accessory : ${
              item.accessory_name || "-"
            }

Purchase Price : ₹${
              Number(
                item.purchase_price || 0
              ).toFixed(2)
            }

Selling Price : ₹${
              Number(
                item.selling_price || 0
              ).toFixed(2)
            }

Quantity : ${
              Number(
                item.quantity || 0
              )
            }

Created Date : ${
              item.created_at
                ? new Date(
                    item.created_at
                  ).toLocaleDateString(
                    "en-IN"
                  )
                : "-"
            }

--------------------------------------------------
`
            );


          totalQuantity +=
            Number(
              item.quantity || 0
            );
        }
      );


      /*
      ================================================
      SUMMARY
      ================================================
      */

      doc.moveDown();


      doc
        .fontSize(14)
        .font("Helvetica-Bold")
        .text(
          `Total Records : ${
            result.rows.length
          }`
        );


      doc
        .fontSize(14)
        .font("Helvetica-Bold")
        .text(
          `Total Stock Quantity : ${
            totalQuantity
          }`
        );


      doc.end();

    } catch (error) {

      console.log(
        "STOCK PDF ERROR",
        error
      );

      res.status(500).json({
        success: false,
        message:
          "Stock PDF generation failed",
        error:
          error.message,
      });
    }
  }
);



/*
=========================================================
STOCK REPORT EXCEL
GET /reports/stock/:storeCode/excel
=========================================================
*/

router.get(
  "/stock/:storeCode/excel",
  async (req, res) => {

    try {

      const { storeCode } =
        req.params;

      const {
        category,
        fromDate,
        toDate,
      } = req.query;


      /*
      ================================================
      BUILD QUERY
      ================================================
      */

      const {
        query,
        params,
      } = buildStockQuery(
        storeCode,
        {
          category,
          fromDate,
          toDate,
        }
      );


      const result =
        await pool.query(
          query,
          params
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
          "Stock Report"
        );


      /*
      ================================================
      REPORT INFORMATION
      ================================================
      */

      sheet.mergeCells(
        "A1:W1"
      );


      sheet.getCell("A1").value =
        "VISION EYE CARE - STOCK REPORT";


      sheet.getCell("A1").font = {
        bold: true,
        size: 16,
      };


      sheet.getCell("A1").alignment = {
        horizontal: "center",
        vertical: "middle",
      };


      sheet.mergeCells(
        "A2:W2"
      );


      sheet.getCell("A2").value =
        `Store Code: ${storeCode}`;


      sheet.mergeCells(
        "A3:W3"
      );


      sheet.getCell("A3").value =
        `Category: ${
          category &&
          category.trim() !== ""
            ? category
            : "All Categories"
        }`;


      sheet.mergeCells(
        "A4:W4"
      );


      sheet.getCell("A4").value =
        `From Date: ${
          fromDate || "All"
        }`;


      sheet.mergeCells(
        "A5:W5"
      );


      sheet.getCell("A5").value =
        `To Date: ${
          toDate || "All"
        }`;


      /*
      ================================================
      TABLE HEADER
      ================================================
      */

      const headers = [

        "Barcode",
        "Category",
        "Brand",

        "Frame Name",
        "Model",
        "Color",
        "Size",
        "Material",
        "Gender",

        "Lens Type",
        "Power Range",
        "Coating",
        "Lens Index",

        "Contact Type",
        "Power",
        "Base Curve",
        "Diameter",
        "Expiry Date",

        "Accessory Name",

        "Purchase Price",
        "Selling Price",
        "Quantity",
        "Created Date",

      ];


      const headerRow =
        sheet.getRow(7);


      headers.forEach(
        (header, index) => {

          const cell =
            headerRow.getCell(
              index + 1
            );

          cell.value =
            header;

          cell.font = {
            bold: true,
          };

          cell.alignment = {
            horizontal: "center",
            vertical: "middle",
          };

        }
      );


      /*
      ================================================
      COLUMN WIDTHS
      ================================================
      */

      const widths = [

        20,
        20,
        20,

        25,
        20,
        15,
        12,
        15,
        15,

        18,
        18,
        18,
        15,

        18,
        12,
        15,
        15,
        18,

        20,

        18,
        18,
        15,
        20,

      ];


      widths.forEach(
        (width, index) => {

          sheet.getColumn(
            index + 1
          ).width = width;

        }
      );


      /*
      ================================================
      ADD DATA
      ================================================
      */

      let totalQuantity = 0;


      result.rows.forEach(
        (row) => {

          sheet.addRow([

            row.barcode || "",

            row.category || "",

            row.brand || "",

            row.frame_name || "",

            row.model || "",

            row.color || "",

            row.size || "",

            row.material || "",

            row.gender || "",

            row.lens_type || "",

            row.power_range || "",

            row.coating || "",

            row.lens_index || "",

            row.contact_type || "",

            row.power || "",

            row.base_curve || "",

            row.diameter || "",

            row.expiry_date
              ? new Date(
                  row.expiry_date
                ).toLocaleDateString(
                  "en-IN"
                )
              : "",

            row.accessory_name || "",

            Number(
              row.purchase_price || 0
            ),

            Number(
              row.selling_price || 0
            ),

            Number(
              row.quantity || 0
            ),

            row.created_at
              ? new Date(
                  row.created_at
                ).toLocaleDateString(
                  "en-IN"
                )
              : "",

          ]);


          totalQuantity +=
            Number(
              row.quantity || 0
            );

        }
      );


      /*
      ================================================
      TOTAL
      ================================================
      */

      sheet.addRow([]);


      const totalRow =
        sheet.addRow({

          barcode: "TOTAL",

          quantity:
            totalQuantity,

        });


      totalRow.font = {
        bold: true,
      };


      /*
      ================================================
      FREEZE HEADER
      ================================================
      */

      sheet.views = [

        {
          state: "frozen",
          ySplit: 7,
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
        "attachment; filename=stock-report.xlsx"
      );


      await workbook.xlsx.write(
        res
      );


      res.end();

    } catch (error) {

      console.log(
        "STOCK EXCEL ERROR",
        error
      );

      res.status(500).json({

        success: false,

        message:
          "Stock Excel generation failed",

        error:
          error.message,

      });
    }
  }
);
module.exports = router;