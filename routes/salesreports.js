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
module.exports = router;