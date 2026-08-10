const express = require("express");
const router = express.Router();

const pool = require("../db");

const PDFDocument = require("pdfkit");
const ExcelJS = require("exceljs");

/*
================================================
SALES REPORT
POST /reports/sales
================================================
*/

router.post("/sales", async(req,res)=>{

try{


const {

storeCode,
fromDate,
toDate,
customer,
lensType,
status

}=req.body;



if(!storeCode){

return res.status(400).json({

success:false,
message:"Store code required"

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


WHERE store_code=$1



AND

(

$2=''

OR

order_date >= TO_DATE($2,'DD-MM-YYYY')

)



AND

(

$3=''

OR

order_date <= TO_DATE($3,'DD-MM-YYYY')

)



AND

(

$4=''

OR

patient_name ILIKE '%'||$4||'%'

)



AND

(

$5=''

OR

lens_type ILIKE '%'||$5||'%'

)



AND

(

$6=''

OR

status ILIKE '%'||$6||'%'

)



ORDER BY order_date DESC


`,

[

storeCode,

fromDate || "",

toDate || "",

customer || "",

lensType || "",

status || ""

]


);



res.json({

success:true,

count:result.rows.length,

data:result.rows

});


}


catch(error){

console.log(error);


res.status(500).json({

success:false,

message:"Sales report error",

error:error.message

});


}


});





/*
================================================
SALES REPORT PDF
POST /reports/sales/pdf
================================================
*/


router.post("/sales/pdf", async(req,res)=>{


try{


const {

storeCode,
fromDate,
toDate,
customer,
lensType,
status

}=req.body;



const result = await pool.query(

`

SELECT

order_no,
order_date,
patient_name,
mobile,
lens_type,
total_amount,
advance_paid,
balance_amount,
status,
payment_status


FROM optical_orders


WHERE store_code=$1


AND
(
$2=''
OR
order_date >= TO_DATE($2,'DD-MM-YYYY')
)


AND
(
$3=''
OR
order_date <= TO_DATE($3,'DD-MM-YYYY')
)


AND
(
$4=''
OR
patient_name ILIKE '%'||$4||'%'
)


AND
(
$5=''
OR
lens_type ILIKE '%'||$5||'%'
)


AND
(
$6=''
OR
status ILIKE '%'||$6||'%'
)


ORDER BY order_date DESC


`,

[

storeCode,
fromDate || "",
toDate || "",
customer || "",
lensType || "",
status || ""

]


);





res.setHeader(
"Content-Type",
"application/pdf"
);


res.setHeader(
"Content-Disposition",
"attachment; filename=sales-report.pdf"
);



const doc = new PDFDocument({
margin:40
});



doc.pipe(res);



doc.fontSize(20)
.text(
"VISION EYE CARE",
{
align:"center"
}
);



doc.moveDown();



doc.fontSize(16)
.text(
"Sales Report",
{
align:"center"
}
);



doc.moveDown();



doc.fontSize(10)
.text(
`Date Range : ${fromDate || "All"} - ${toDate || "All"}`
);



doc.moveDown();



let total=0;



result.rows.forEach((item,index)=>{


doc.moveDown();


doc.fontSize(12)
.text(
`${index+1}. Invoice : ${item.order_no}`
);


doc.fontSize(10)
.text(
`
Customer : ${item.patient_name}

Mobile : ${item.mobile}

Lens : ${item.lens_type}

Amount : ₹${item.total_amount}

Advance : ₹${item.advance_paid}

Balance : ₹${item.balance_amount}

Status : ${item.status}

Payment : ${item.payment_status}

------------------------------------
`
);


total += Number(item.total_amount || 0);


});



doc.moveDown();


doc.fontSize(14)
.text(
`Total Sales : ₹${total}`
);



doc.end();



}


catch(error){


console.log(error);


res.status(500).json({

success:false,

message:"PDF generation failed",

error:error.message

});


}



});
/*
================================================
SALES REPORT EXCEL
POST /reports/sales/excel
================================================
*/


router.post("/sales/excel", async(req,res)=>{


try{


const {

storeCode,
fromDate,
toDate,
customer,
lensType,
status

}=req.body;



const result = await pool.query(

`

SELECT

order_no,

order_date,

patient_name,

mobile,

lens_type,

total_amount,

advance_paid,

balance_amount,

status,

payment_status


FROM optical_orders


WHERE store_code=$1


AND
(
$2=''
OR
order_date >= TO_DATE($2,'DD-MM-YYYY')
)


AND
(
$3=''
OR
order_date <= TO_DATE($3,'DD-MM-YYYY')
)


AND
(
$4=''
OR
patient_name ILIKE '%'||$4||'%'
)


AND
(
$5=''
OR
lens_type ILIKE '%'||$5||'%'
)


AND
(
$6=''
OR
status ILIKE '%'||$6||'%'
)


ORDER BY order_date DESC


`,

[

storeCode,
fromDate || "",
toDate || "",
customer || "",
lensType || "",
status || ""

]


);





const workbook = new ExcelJS.Workbook();


const sheet =
workbook.addWorksheet(
"Sales Report"
);



sheet.columns=[


{
header:"Invoice",
key:"order_no",
width:20
},


{
header:"Date",
key:"order_date",
width:15
},


{
header:"Customer",
key:"patient_name",
width:25
},


{
header:"Mobile",
key:"mobile",
width:15
},


{
header:"Lens Type",
key:"lens_type",
width:20
},


{
header:"Amount",
key:"total_amount",
width:15
},


{
header:"Advance",
key:"advance_paid",
width:15
},


{
header:"Balance",
key:"balance_amount",
width:15
},


{
header:"Status",
key:"status",
width:15
},


{
header:"Payment",
key:"payment_status",
width:15
}


];




result.rows.forEach(row=>{


sheet.addRow(row);


});




res.setHeader(

"Content-Type",

"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

);



res.setHeader(

"Content-Disposition",

"attachment; filename=sales-report.xlsx"

);




await workbook.xlsx.write(res);


res.end();



}


catch(error){


console.log(error);


res.status(500).json({

success:false,

message:"Excel generation failed",

error:error.message

});


}



});



/*
================================================
DAILY SALES SUMMARY
GET /reports/summary/:storeCode
================================================
*/


router.get("/summary/:storeCode",async(req,res)=>{


try{


const {storeCode}=req.params;



const result=await pool.query(

`

SELECT


COUNT(*) AS total_orders,


COALESCE(
SUM(total_amount),
0
) AS total_sales,


COALESCE(
SUM(advance_paid),
0
) AS total_received,


COALESCE(
SUM(balance_amount),
0
) AS balance_due,


COUNT(*) FILTER
(
WHERE status='Pending'
)
AS pending_orders



FROM optical_orders


WHERE store_code=$1


AND DATE(order_date)=CURRENT_DATE



`,

[storeCode]


);



res.json({

success:true,

data:result.rows[0]

});


}

catch(error){

console.log(error);


res.status(500).json({

success:false,

message:"Summary error"

});


}


});









/*
================================================
CUSTOMER REPORT
POST /reports/customer
================================================
*/


router.post("/customer", async (req, res) => {
  try {

    const {
      storeCode,
      customer,
      patientId,
      age,
    } = req.body;

    const result = await pool.query(
      `
      SELECT

        p.patient_id,
        p.name,
        p.age,
        p.mobile,

        COUNT(o.id) AS total_orders,

        COALESCE(
          SUM(o.total_amount),
          0
        ) AS total_purchase,

        COALESCE(
          SUM(o.balance_amount),
          0
        ) AS pending_amount

      FROM patients p

      LEFT JOIN optical_orders o
        ON o.patient_id = p.patient_id
        AND o.store_code = p.store_code

      WHERE p.store_code = $1

      AND (
        $2 = ''
        OR p.name ILIKE '%' || $2 || '%'
      )

      AND (
        $3 = ''
        OR p.patient_id::TEXT ILIKE '%' || $3 || '%'
      )

      AND (
        $4 = ''
        OR p.age::TEXT = $4
      )

      GROUP BY
        p.patient_id,
        p.name,
        p.age,
        p.mobile

      ORDER BY
        total_purchase DESC
      `,
      [
        storeCode,
        customer || "",
        patientId || "",
        age || "",
      ]
    );

    res.json({
      success: true,
      data: result.rows,
    });

  } catch (error) {

    console.log(
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
================================================
CUSTOMER REPORT PDF
POST /reports/customer/pdf
================================================
*/

router.post("/customer/pdf", async (req, res) => {
  try {
    const {
      storeCode,
      customer,
      patientId,
      age,
    } = req.body;

    // ==========================================
    // GET CUSTOMERS FROM PATIENTS TABLE
    // AND THEIR ORDER SUMMARY
    // ==========================================

    const result = await pool.query(
      `
      SELECT

        p.patient_id,
        p.name,
        p.age,
        p.mobile,

        COUNT(o.id) AS total_orders,

        COALESCE(
          SUM(o.total_amount),
          0
        ) AS total_purchase,

        COALESCE(
          SUM(o.balance_amount),
          0
        ) AS pending_amount

      FROM patients p

      LEFT JOIN optical_orders o
        ON o.patient_id = p.patient_id
        AND o.store_code = p.store_code

      WHERE p.store_code = $1

      AND (
        $2 = ''
        OR p.name ILIKE '%' || $2 || '%'
      )

      AND (
        $3 = ''
        OR p.patient_id::TEXT ILIKE '%' || $3 || '%'
      )

      AND (
        $4 = ''
        OR p.age::TEXT = $4
      )

      GROUP BY
        p.patient_id,
        p.name,
        p.age,
        p.mobile

      ORDER BY
        total_purchase DESC
      `,
      [
        storeCode,
        customer || "",
        patientId || "",
        age || "",
      ]
    );

    // ==========================================
    // PDF RESPONSE
    // ==========================================

    res.setHeader(
      "Content-Type",
      "application/pdf"
    );

    res.setHeader(
      "Content-Disposition",
      "attachment; filename=customer-report.pdf"
    );

    const doc = new PDFDocument({
      margin: 40,
    });

    doc.pipe(res);

    // ==========================================
    // HEADER
    // ==========================================

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
      .font("Helvetica-Bold")
      .text(
        "Customer Report",
        {
          align: "center",
        }
      );

    doc.moveDown(2);

    // ==========================================
    // REPORT FILTER DETAILS
    // ==========================================

    doc
      .fontSize(11)
      .font("Helvetica")
      .text(
        `Store Code : ${storeCode}`
      );

    if (customer) {
      doc.text(
        `Customer : ${customer}`
      );
    }

    if (patientId) {
      doc.text(
        `Patient ID : ${patientId}`
      );
    }

    if (age) {
      doc.text(
        `Age : ${age}`
      );
    }

    doc.moveDown();

    // ==========================================
    // TOTALS
    // ==========================================

    let totalPurchase = 0;
    let pendingTotal = 0;

    // ==========================================
    // CUSTOMER DATA
    // ==========================================

    result.rows.forEach((item, index) => {

      // Create new page if needed
      if (doc.y > 700) {
        doc.addPage();
      }

      doc.moveDown();

      // Customer name
      doc
        .fontSize(12)
        .font("Helvetica-Bold")
        .text(
          `${index + 1}. ${
            item.patient_name || "-"
          }`
        );

      // Patient ID
      doc
        .fontSize(10)
        .font("Helvetica")
        .text(
          `Patient ID : ${
            item.patient_id || "-"
          }`
        );

      // Age
      doc
        .fontSize(10)
        .font("Helvetica")
        .text(
          `Age : ${
            item.age ?? "-"
          }`
        );

      // Mobile
      doc
        .fontSize(10)
        .font("Helvetica")
        .text(
          `Mobile : ${
            item.mobile || "-"
          }`
        );

      // Total Orders
      doc
        .fontSize(10)
        .font("Helvetica")
        .text(
          `Total Orders : ${
            item.total_orders || 0
          }`
        );

      // Total Purchase
      doc
        .fontSize(10)
        .font("Helvetica")
        .text(
          `Total Purchase : ₹${Number(
            item.total_purchase || 0
          ).toFixed(2)}`
        );

      // Pending Amount
      doc
        .fontSize(10)
        .font("Helvetica")
        .text(
          `Pending Amount : ₹${Number(
            item.pending_amount || 0
          ).toFixed(2)}`
        );

      doc.moveDown();

      // Separator
      doc
        .moveTo(40, doc.y)
        .lineTo(555, doc.y)
        .stroke();

      // Add totals
      totalPurchase += Number(
        item.total_purchase || 0
      );

      pendingTotal += Number(
        item.pending_amount || 0
      );
    });

    // ==========================================
    // SUMMARY
    // ==========================================

    if (doc.y > 680) {
      doc.addPage();
    }

    doc.moveDown(2);

    doc
      .fontSize(14)
      .font("Helvetica-Bold")
      .text("Summary");

    doc.moveDown();

    doc
      .fontSize(11)
      .font("Helvetica")
      .text(
        `Total Customers : ${
          result.rows.length
        }`
      );

    doc.text(
      `Total Purchase : ₹${totalPurchase.toFixed(
        2
      )}`
    );

    doc.text(
      `Total Pending : ₹${pendingTotal.toFixed(
        2
      )}`
    );

    doc.end();

  } catch (error) {

    console.log(
      "CUSTOMER PDF ERROR",
      error
    );

    res.status(500).json({
      success: false,
      message:
        "Customer PDF generation failed",
      error: error.message,
    });
  }
});
/*
================================================
CUSTOMER REPORT EXCEL
POST /reports/customer/excel
================================================
*/

router.post("/customer/excel", async (req, res) => {
  try {
    const {
      storeCode,
      customer,
      patientId,
      age,
    } = req.body;

    // ==========================================
    // GET CUSTOMERS FROM PATIENTS TABLE
    // AND ORDER SUMMARY FROM OPTICAL_ORDERS
    // ==========================================

    const result = await pool.query(
      `
      SELECT

        p.patient_id,
        p.name,
        p.age,
        p.mobile,

        COUNT(o.id) AS total_orders,

        COALESCE(
          SUM(o.total_amount),
          0
        ) AS total_purchase,

        COALESCE(
          SUM(o.balance_amount),
          0
        ) AS pending_amount

      FROM patients p

      LEFT JOIN optical_orders o
        ON o.patient_id = p.patient_id
        AND o.store_code = p.store_code

      WHERE p.store_code = $1

      AND (
        $2 = ''
        OR p.name ILIKE '%' || $2 || '%'
      )

      AND (
        $3 = ''
        OR p.patient_id::TEXT ILIKE '%' || $3 || '%'
      )

      AND (
        $4 = ''
        OR p.age::TEXT = $4
      )

      GROUP BY
        p.patient_id,
        p.name,
        p.age,
        p.mobile

      ORDER BY
        total_purchase DESC
      `,
      [
        storeCode,
        customer || "",
        patientId || "",
        age || "",
      ]
    );

    // ==========================================
    // CREATE WORKBOOK
    // ==========================================

    const workbook = new ExcelJS.Workbook();

    const sheet = workbook.addWorksheet(
      "Customer Report"
    );

    // ==========================================
    // REPORT FILTER DETAILS
    // ==========================================

    sheet.addRow([
      "VISION EYE CARE",
    ]);

    sheet.addRow([
      "Customer Report",
    ]);

    sheet.addRow([]);

    sheet.addRow([
      "Store Code",
      storeCode,
    ]);

    sheet.addRow([
      "Customer",
      customer || "All",
    ]);

    sheet.addRow([
      "Patient ID",
      patientId || "All",
    ]);

    sheet.addRow([
      "Age",
      age || "All",
    ]);

    sheet.addRow([]);

    // ==========================================
    // TABLE HEADER
    // ==========================================

    const headerRow = sheet.addRow([
      "Patient ID",
      "Customer Name",
      "Age",
      "Mobile",
      "Total Orders",
      "Total Purchase",
      "Pending Amount",
    ]);

    headerRow.font = {
      bold: true,
    };

    headerRow.alignment = {
      vertical: "middle",
      horizontal: "center",
    };

    // ==========================================
    // TOTALS
    // ==========================================

    let totalPurchase = 0;
    let totalPending = 0;

    // ==========================================
    // CUSTOMER DATA
    // ==========================================

    result.rows.forEach((row) => {

      const totalOrders = Number(
        row.total_orders || 0
      );

      const totalPurchaseAmount = Number(
        row.total_purchase || 0
      );

      const pendingAmount = Number(
        row.pending_amount || 0
      );

      sheet.addRow([
        row.patient_id || "",
        row.patient_name || "",
        row.age ?? "",
        row.mobile || "",
        totalOrders,
        totalPurchaseAmount,
        pendingAmount,
      ]);

      totalPurchase +=
        totalPurchaseAmount;

      totalPending +=
        pendingAmount;
    });

    // ==========================================
    // TOTAL ROW
    // ==========================================

    sheet.addRow([]);

    const totalRow = sheet.addRow([
      "",
      "TOTAL",
      "",
      "",
      "",
      totalPurchase,
      totalPending,
    ]);

    totalRow.font = {
      bold: true,
    };

    // ==========================================
    // CURRENCY FORMAT
    // ==========================================

    // Table starts at row 9
    // Column 6 = Total Purchase
    // Column 7 = Pending Amount

    for (
      let rowNumber = 10;
      rowNumber <= sheet.rowCount;
      rowNumber++
    ) {
      sheet.getRow(rowNumber)
        .getCell(6)
        .numFmt = '₹#,##0.00';

      sheet.getRow(rowNumber)
        .getCell(7)
        .numFmt = '₹#,##0.00';
    }

    // ==========================================
    // COLUMN WIDTHS
    // ==========================================

    sheet.getColumn(1).width = 18;
    sheet.getColumn(2).width = 25;
    sheet.getColumn(3).width = 10;
    sheet.getColumn(4).width = 16;
    sheet.getColumn(5).width = 15;
    sheet.getColumn(6).width = 18;
    sheet.getColumn(7).width = 18;

    // ==========================================
    // RESPONSE
    // ==========================================

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    res.setHeader(
      "Content-Disposition",
      "attachment; filename=customer-report.xlsx"
    );

    await workbook.xlsx.write(res);

    res.end();

  } catch (error) {

    console.log(
      "CUSTOMER EXCEL ERROR",
      error
    );

    res.status(500).json({
      success: false,
      message:
        "Customer Excel generation failed",
      error: error.message,
    });
  }
});

/*
================================================
PENDING ORDERS
GET /reports/pending/:storeCode
================================================
*/


router.get("/pending/:storeCode",async(req,res)=>{


try{


const {

storeCode

}=req.params;



const result=await pool.query(

`

SELECT


id,

order_no,

order_date,


patient_name,

mobile,


lens_type,


total_amount,


advance_paid,


balance_amount,


expected_delivery,


status,


payment_status



FROM optical_orders



WHERE store_code=$1



AND status='Pending'



ORDER BY order_date DESC


`,

[storeCode]


);



res.json({

success:true,

count:result.rows.length,

data:result.rows

});


}


catch(error){

console.log(error);


res.status(500).json({

success:false,

message:"Pending orders error"

});


}


});





/*
================================================
PENDING ORDERS PDF
GET /reports/pending/:storeCode/pdf
================================================
*/

router.get("/pending/:storeCode/pdf", async(req,res)=>{

try{


const {
storeCode
}=req.params;



const result = await pool.query(

`

SELECT


order_no,

order_date,

patient_name,

mobile,

lens_type,

total_amount,

advance_paid,

balance_amount,

expected_delivery,

status,

payment_status



FROM optical_orders



WHERE store_code=$1



AND status='Pending'



ORDER BY order_date DESC



`,

[storeCode]


);





res.setHeader(
"Content-Type",
"application/pdf"
);



res.setHeader(
"Content-Disposition",
"attachment; filename=pending-orders.pdf"
);





const doc = new PDFDocument({
margin:40
});



doc.pipe(res);





doc.fontSize(20)
.font("Helvetica-Bold")
.text(
"VISION EYE CARE",
{
align:"center"
}
);



doc.moveDown();



doc.fontSize(16)
.text(
"Pending Orders Report",
{
align:"center"
}
);



doc.moveDown(2);



doc.fontSize(11)
.text(
`Store Code : ${storeCode}`
);



doc.moveDown();



let totalAmount=0;

let totalPending=0;




result.rows.forEach((item,index)=>{


doc.moveDown();


doc.fontSize(12)
.font("Helvetica-Bold")
.text(

`${index+1}. Order No : ${item.order_no}`

);



doc.fontSize(10)
.font("Helvetica")
.text(

`

Customer : ${item.patient_name}

Mobile : ${item.mobile}

Lens Type : ${item.lens_type}

Amount : ₹${item.total_amount}

Advance : ₹${item.advance_paid}

Balance : ₹${item.balance_amount}

Expected Delivery : ${item.expected_delivery}

Payment Status : ${item.payment_status}

-------------------------------------

`

);



totalAmount += Number(
item.total_amount || 0
);


totalPending += Number(
item.balance_amount || 0
);



});





doc.moveDown();



doc.fontSize(14)
.font("Helvetica-Bold")
.text(
"Summary"
);



doc.fontSize(11)
.font("Helvetica")
.text(

`

Total Pending Orders : ${result.rows.length}

Total Amount : ₹${totalAmount}

Total Pending Balance : ₹${totalPending}

`

);





doc.end();



}


catch(error){


console.log(
"PENDING PDF ERROR",
error
);



res.status(500).json({

success:false,

message:"Pending PDF generation failed",

error:error.message

});


}


});

/*
================================================
PENDING ORDERS EXCEL
GET /reports/pending/:storeCode/excel
================================================
*/

router.get("/pending/:storeCode/excel", async(req,res)=>{

try{


const {
storeCode
}=req.params;



const result = await pool.query(

`

SELECT


order_no,

order_date,

patient_name,

mobile,

lens_type,

total_amount,

advance_paid,

balance_amount,

expected_delivery,

status,

payment_status



FROM optical_orders



WHERE store_code=$1



AND status='Pending'



ORDER BY order_date DESC



`,

[storeCode]


);





const workbook = new ExcelJS.Workbook();



const sheet =
workbook.addWorksheet(
"Pending Orders"
);





sheet.columns=[


{
header:"Order No",
key:"order_no",
width:20
},


{
header:"Order Date",
key:"order_date",
width:15
},


{
header:"Customer",
key:"patient_name",
width:25
},


{
header:"Mobile",
key:"mobile",
width:15
},


{
header:"Lens Type",
key:"lens_type",
width:20
},


{
header:"Amount",
key:"total_amount",
width:15
},


{
header:"Advance",
key:"advance_paid",
width:15
},


{
header:"Balance",
key:"balance_amount",
width:15
},


{
header:"Expected Delivery",
key:"expected_delivery",
width:20
},


{
header:"Status",
key:"status",
width:15
},


{
header:"Payment Status",
key:"payment_status",
width:18
}


];





let totalAmount=0;

let totalBalance=0;



result.rows.forEach(row=>{


sheet.addRow(row);



totalAmount += Number(
row.total_amount || 0
);


totalBalance += Number(
row.balance_amount || 0
);


});





sheet.addRow({});


sheet.addRow({

order_no:"TOTAL",

total_amount:totalAmount,

balance_amount:totalBalance

});





res.setHeader(

"Content-Type",

"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

);



res.setHeader(

"Content-Disposition",

"attachment; filename=pending-orders.xlsx"

);





await workbook.xlsx.write(res);


res.end();



}


catch(error){


console.log(
"PENDING EXCEL ERROR",
error
);



res.status(500).json({

success:false,

message:"Pending Excel generation failed",

error:error.message

});


}


});

/*
================================================
STOCK REPORT
GET /reports/stock/:storeCode
================================================
*/


router.get("/stock/:storeCode", async(req,res)=>{


try{


const {
storeCode
}=req.params;



const result = await pool.query(

`

SELECT


id,

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



FROM stock_inventory



WHERE store_code=$1



ORDER BY id DESC


`,

[storeCode]


);



res.json({

success:true,

count:result.rows.length,

data:result.rows

});


}


catch(error){


console.log(
"STOCK REPORT ERROR",
error
);



res.status(500).json({

success:false,

message:"Stock report error",

error:error.message

});


}


});



/*
================================================
STOCK REPORT PDF
GET /reports/stock/:storeCode/pdf
================================================
*/

router.get("/stock/:storeCode/pdf", async(req,res)=>{

try{


const { storeCode } = req.params;


const result = await pool.query(

`

SELECT

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


FROM stock_inventory


WHERE store_code=$1


ORDER BY id DESC

`,

[storeCode]

);




res.setHeader(
"Content-Type",
"application/pdf"
);


res.setHeader(
"Content-Disposition",
"attachment; filename=stock-report.pdf"
);




const doc = new PDFDocument({
margin:40
});


doc.pipe(res);




doc.fontSize(20)
.font("Helvetica-Bold")
.text(
"VISION EYE CARE",
{
align:"center"
}
);



doc.moveDown();



doc.fontSize(16)
.text(
"Stock Report",
{
align:"center"
}
);



doc.moveDown(2);



doc.fontSize(11)
.text(
`Store Code : ${storeCode}`
);



doc.moveDown();



let totalQuantity = 0;



result.rows.forEach((item,index)=>{


doc.moveDown();



doc.fontSize(12)
.font("Helvetica-Bold")
.text(

`${index+1}. ${item.brand || ""} ${item.frame_name || ""}`

);




doc.fontSize(10)
.font("Helvetica")
.text(

`

Barcode : ${item.barcode}

Model : ${item.model}

Color : ${item.color}

Size : ${item.size}

Material : ${item.material}

Gender : ${item.gender}

Lens Type : ${item.lens_type}

Power Range : ${item.power_range}

Coating : ${item.coating}

Lens Index : ${item.lens_index}

Contact Type : ${item.contact_type}

Power : ${item.power}

Base Curve : ${item.base_curve}

Diameter : ${item.diameter}

Expiry Date : ${item.expiry_date}

Accessory : ${item.accessory_name}

Purchase Price : ₹${item.purchase_price}

Selling Price : ₹${item.selling_price}

Quantity : ${item.quantity}

-------------------------------------

`

);



totalQuantity += Number(
item.quantity || 0
);


});





doc.moveDown();



doc.fontSize(14)
.font("Helvetica-Bold")
.text(

`Total Stock Quantity : ${totalQuantity}`

);




doc.end();


}

catch(error){


console.log(
"STOCK PDF ERROR",
error
);



res.status(500).json({

success:false,

message:"Stock PDF generation failed",

error:error.message

});


}


});
/*
================================================
STOCK REPORT EXCEL
GET /reports/stock/:storeCode/excel
================================================
*/

router.get("/stock/:storeCode/excel", async(req,res)=>{

try{


const {
storeCode
}=req.params;



const result = await pool.query(

`

SELECT


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



FROM stock_inventory



WHERE store_code=$1



ORDER BY id DESC


`,

[storeCode]


);




const workbook = new ExcelJS.Workbook();



const sheet =
workbook.addWorksheet(
"Stock Report"
);




sheet.columns=[


{
header:"Barcode",
key:"barcode",
width:20
},


{
header:"Brand",
key:"brand",
width:20
},


{
header:"Frame Name",
key:"frame_name",
width:25
},


{
header:"Model",
key:"model",
width:20
},


{
header:"Color",
key:"color",
width:15
},


{
header:"Size",
key:"size",
width:12
},


{
header:"Material",
key:"material",
width:15
},


{
header:"Gender",
key:"gender",
width:15
},


{
header:"Lens Type",
key:"lens_type",
width:18
},


{
header:"Power Range",
key:"power_range",
width:18
},


{
header:"Coating",
key:"coating",
width:18
},


{
header:"Lens Index",
key:"lens_index",
width:15
},


{
header:"Contact Type",
key:"contact_type",
width:18
},


{
header:"Power",
key:"power",
width:12
},


{
header:"Base Curve",
key:"base_curve",
width:15
},


{
header:"Diameter",
key:"diameter",
width:15
},


{
header:"Expiry Date",
key:"expiry_date",
width:18
},


{
header:"Accessory Name",
key:"accessory_name",
width:20
},


{
header:"Purchase Price",
key:"purchase_price",
width:18
},


{
header:"Selling Price",
key:"selling_price",
width:18
},


{
header:"Quantity",
key:"quantity",
width:15
}


];





let totalQuantity=0;



result.rows.forEach(row=>{


sheet.addRow(row);


totalQuantity += Number(
row.quantity || 0
);


});





sheet.addRow({});


sheet.addRow({

barcode:"TOTAL",

quantity:totalQuantity

});





res.setHeader(

"Content-Type",

"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

);



res.setHeader(

"Content-Disposition",

"attachment; filename=stock-report.xlsx"

);





await workbook.xlsx.write(res);


res.end();



}


catch(error){


console.log(
"STOCK EXCEL ERROR",
error
);



res.status(500).json({

success:false,

message:"Stock Excel generation failed",

error:error.message

});


}


});



/*
================================================
MONTHLY SALES REPORT
GET /reports/monthly/:storeCode
================================================
*/

router.get("/monthly/:storeCode", async (req, res) => {
  try {
    const { storeCode } = req.params;
    const { status = "" } = req.query;

    const result = await pool.query(
      `
      SELECT

        TO_CHAR(
          order_date,
          'Mon YYYY'
        ) AS month,

        COUNT(*) AS total_orders,

        COALESCE(
          SUM(total_amount),
          0
        ) AS total_sales,

        COALESCE(
          SUM(advance_paid),
          0
        ) AS received,

        COALESCE(
          SUM(balance_amount),
          0
        ) AS pending

      FROM optical_orders

      WHERE store_code = $1

      AND (
        $2 = ''
        OR status ILIKE '%' || $2 || '%'
      )

      GROUP BY

        TO_CHAR(
          order_date,
          'Mon YYYY'
        ),

        DATE_TRUNC(
          'month',
          order_date
        )

      ORDER BY

        DATE_TRUNC(
          'month',
          order_date
        ) DESC
      `,
      [
        storeCode,
        status || ""
      ]
    );

    res.json({
      success: true,
      status: status || "All",
      data: result.rows
    });

  } catch (error) {

    console.log("MONTHLY REPORT ERROR", error);

    res.status(500).json({
      success: false,
      message: "Monthly report error",
      error: error.message
    });

  }
});

/*
================================================
MONTHLY SALES REPORT PDF
GET /reports/monthly/:storeCode/pdf
================================================
*/

router.get("/monthly/:storeCode/pdf", async (req, res) => {

  try {

    const { storeCode } = req.params;
    const { status = "" } = req.query;

    const result = await pool.query(
      `
      SELECT

        TO_CHAR(
          order_date,
          'Mon YYYY'
        ) AS month,

        COUNT(*) AS total_orders,

        COALESCE(
          SUM(total_amount),
          0
        ) AS total_sales,

        COALESCE(
          SUM(advance_paid),
          0
        ) AS received,

        COALESCE(
          SUM(balance_amount),
          0
        ) AS pending

      FROM optical_orders

      WHERE store_code = $1

      AND (
        $2 = ''
        OR status ILIKE '%' || $2 || '%'
      )

      GROUP BY

        TO_CHAR(
          order_date,
          'Mon YYYY'
        ),

        DATE_TRUNC(
          'month',
          order_date
        )

      ORDER BY

        DATE_TRUNC(
          'month',
          order_date
        ) DESC
      `,
      [
        storeCode,
        status || ""
      ]
    );

    res.setHeader(
      "Content-Type",
      "application/pdf"
    );

    res.setHeader(
      "Content-Disposition",
      `attachment; filename=monthly-sales-report-${status || "all"}.pdf`
    );

    const doc = new PDFDocument({
      margin: 40
    });

    doc.pipe(res);

    doc
      .fontSize(20)
      .font("Helvetica-Bold")
      .text(
        "VISION EYE CARE",
        {
          align: "center"
        }
      );

    doc.moveDown();

    doc
      .fontSize(16)
      .text(
        "Monthly Sales Report",
        {
          align: "center"
        }
      );

    doc.moveDown(2);

    doc
      .fontSize(11)
      .font("Helvetica")
      .text(
        `Store Code : ${storeCode}`
      );

    doc.text(
      `Status     : ${status || "All"}`
    );

    doc.moveDown();

    let grandTotal = 0;
    let totalReceived = 0;
    let totalPending = 0;
    let totalOrders = 0;

    result.rows.forEach((item, index) => {

      doc.moveDown();

      doc
        .fontSize(12)
        .font("Helvetica-Bold")
        .text(
          `${index + 1}. ${item.month}`
        );

      doc
        .fontSize(10)
        .font("Helvetica")
        .text(
          `
Total Orders : ${item.total_orders}

Total Sales  : ₹${item.total_sales}

Received     : ₹${item.received}

Pending      : ₹${item.pending}

--------------------------------
`
        );

      grandTotal += Number(
        item.total_sales || 0
      );

      totalReceived += Number(
        item.received || 0
      );

      totalPending += Number(
        item.pending || 0
      );

      totalOrders += Number(
        item.total_orders || 0
      );

    });

    doc.moveDown();

    doc
      .fontSize(14)
      .font("Helvetica-Bold")
      .text("Summary");

    doc
      .fontSize(11)
      .font("Helvetica")
      .text(
        `
Status       : ${status || "All"}

Total Orders : ${totalOrders}

Total Sales  : ₹${grandTotal}

Received     : ₹${totalReceived}

Pending      : ₹${totalPending}
`
      );

    doc.end();

  } catch (error) {

    console.log(
      "MONTHLY PDF ERROR",
      error
    );

    res.status(500).json({
      success: false,
      message: "Monthly PDF generation failed",
      error: error.message
    });

  }

});
/*
================================================
MONTHLY SALES REPORT EXCEL
GET /reports/monthly/:storeCode/excel
================================================
*/

router.get("/monthly/:storeCode/excel", async (req, res) => {

  try {

    const { storeCode } = req.params;
    const { status = "" } = req.query;

    const result = await pool.query(
      `
      SELECT

        TO_CHAR(
          order_date,
          'Mon YYYY'
        ) AS month,

        COUNT(*) AS total_orders,

        COALESCE(
          SUM(total_amount),
          0
        ) AS total_sales,

        COALESCE(
          SUM(advance_paid),
          0
        ) AS received,

        COALESCE(
          SUM(balance_amount),
          0
        ) AS pending

      FROM optical_orders

      WHERE store_code = $1

      AND (
        $2 = ''
        OR status ILIKE '%' || $2 || '%'
      )

      GROUP BY

        TO_CHAR(
          order_date,
          'Mon YYYY'
        ),

        DATE_TRUNC(
          'month',
          order_date
        )

      ORDER BY

        DATE_TRUNC(
          'month',
          order_date
        ) DESC
      `,
      [
        storeCode,
        status || ""
      ]
    );

    const workbook =
      new ExcelJS.Workbook();

    const sheet =
      workbook.addWorksheet(
        "Monthly Sales"
      );

    sheet.columns = [

      {
        header: "Month",
        key: "month",
        width: 20
      },

      {
        header: "Status",
        key: "status",
        width: 15
      },

      {
        header: "Total Orders",
        key: "total_orders",
        width: 15
      },

      {
        header: "Total Sales",
        key: "total_sales",
        width: 18
      },

      {
        header: "Received",
        key: "received",
        width: 18
      },

      {
        header: "Pending",
        key: "pending",
        width: 18
      }

    ];

    let grandTotal = 0;
    let totalReceived = 0;
    let totalPending = 0;
    let totalOrders = 0;

    result.rows.forEach(row => {

      sheet.addRow({

        month: row.month,

        status:
          status || "All",

        total_orders:
          Number(row.total_orders || 0),

        total_sales:
          Number(row.total_sales || 0),

        received:
          Number(row.received || 0),

        pending:
          Number(row.pending || 0)

      });

      grandTotal +=
        Number(row.total_sales || 0);

      totalReceived +=
        Number(row.received || 0);

      totalPending +=
        Number(row.pending || 0);

      totalOrders +=
        Number(row.total_orders || 0);

    });

    sheet.addRow({});

    sheet.addRow({

      month: "TOTAL",

      status: status || "All",

      total_orders: totalOrders,

      total_sales: grandTotal,

      received: totalReceived,

      pending: totalPending

    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    res.setHeader(
      "Content-Disposition",
      `attachment; filename=monthly-sales-report-${status || "all"}.xlsx`
    );

    await workbook.xlsx.write(res);

    res.end();

  } catch (error) {

    console.log(
      "MONTHLY EXCEL ERROR",
      error
    );

    res.status(500).json({

      success: false,

      message:
        "Monthly Excel generation failed",

      error:
        error.message

    });

  }

});
/*
================================================
EYE EXAMINATION REPORT
POST /reports/eye-exam
================================================
*/

router.post("/eye-exam", async (req, res) => {
  try {

    const {
      storeCode,
      fromDate,
      toDate,
      customer,
      patientId,
      age,
      diagnosis,
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

        e.id,

        e.patient_id,

        e.patient_name,

        p.age,

        p.mobile,

        e.diagnosis,

        e.right_sph,
        e.right_cyl,
        e.right_axis,

        e.left_sph,
        e.left_cyl,
        e.left_axis,

        e.add_power,

        e.pd,

        e.notes,

        e.exam_date

      FROM eye_exams e

      LEFT JOIN patients p
        ON p.patient_id = e.patient_id
        AND p.store_code = e.store_code

      WHERE e.store_code = $1

      -- FROM DATE
      AND (
        NULLIF(TRIM($2), '') IS NULL
        OR e.exam_date >= TO_DATE(
          TRIM($2),
          'DD-MM-YYYY'
        )
      )

      -- TO DATE
      AND (
        NULLIF(TRIM($3), '') IS NULL
        OR e.exam_date <= TO_DATE(
          TRIM($3),
          'DD-MM-YYYY'
        )
      )

      -- CUSTOMER NAME
      AND (
        NULLIF(TRIM($4), '') IS NULL
        OR e.patient_name ILIKE '%' || TRIM($4) || '%'
      )

      -- PATIENT ID
      AND (
        NULLIF(TRIM($5), '') IS NULL
        OR e.patient_id ILIKE '%' || TRIM($5) || '%'
      )

      -- AGE
      AND (
        NULLIF(TRIM($6), '') IS NULL
        OR p.age::TEXT = TRIM($6)
      )

      -- DIAGNOSIS
      AND (
        NULLIF(TRIM($7), '') IS NULL
        OR e.diagnosis ILIKE '%' || TRIM($7) || '%'
      )

      ORDER BY e.exam_date DESC
      `,
      [
        storeCode || "",
        fromDate || "",
        toDate || "",
        customer || "",
        patientId || "",
        age || "",
        diagnosis || "",
      ]
    );

    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows,
    });

  } catch (error) {

    console.log(
      "EYE EXAM REPORT ERROR:",
      error
    );

    res.status(500).json({
      success: false,
      message: "Eye examination report error",
      error: error.message,
    });

  }
});
/*
================================================
EYE EXAM REPORT PDF
POST /reports/eye-exam/pdf
================================================
*/
router.post("/eye-exam/pdf", async (req, res) => {
  try {

    const {
      storeCode,
      fromDate,
      toDate,
      customer,
      patientId,
      age,
      diagnosis,
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

        e.patient_id,

        e.patient_name,

        p.age,

        p.mobile,

        e.diagnosis,

        e.right_sph,
        e.right_cyl,
        e.right_axis,

        e.left_sph,
        e.left_cyl,
        e.left_axis,

        e.add_power,

        e.pd,

        e.notes,

        e.exam_date

      FROM eye_exams e

      LEFT JOIN patients p
        ON p.patient_id = e.patient_id
        AND p.store_code = e.store_code

      WHERE e.store_code = $1

      -- FROM DATE
      AND (
        NULLIF(TRIM($2), '') IS NULL
        OR e.exam_date >= TO_DATE(
          TRIM($2),
          'DD-MM-YYYY'
        )
      )

      -- TO DATE
      AND (
        NULLIF(TRIM($3), '') IS NULL
        OR e.exam_date <= TO_DATE(
          TRIM($3),
          'DD-MM-YYYY'
        )
      )

      -- CUSTOMER NAME
      AND (
        NULLIF(TRIM($4), '') IS NULL
        OR e.patient_name ILIKE '%' || TRIM($4) || '%'
      )

      -- PATIENT ID
      AND (
        NULLIF(TRIM($5), '') IS NULL
        OR e.patient_id ILIKE '%' || TRIM($5) || '%'
      )

      -- AGE
      AND (
        NULLIF(TRIM($6), '') IS NULL
        OR p.age::TEXT = TRIM($6)
      )

      -- DIAGNOSIS
      AND (
        NULLIF(TRIM($7), '') IS NULL
        OR e.diagnosis ILIKE '%' || TRIM($7) || '%'
      )

      ORDER BY e.exam_date DESC
      `,
      [
        storeCode || "",
        fromDate || "",
        toDate || "",
        customer || "",
        patientId || "",
        age || "",
        diagnosis || "",
      ]
    );

    // =========================
    // PDF RESPONSE
    // =========================

    res.setHeader(
      "Content-Type",
      "application/pdf"
    );

    res.setHeader(
      "Content-Disposition",
      "attachment; filename=eye-exam-report.pdf"
    );

    const doc = new PDFDocument({
      margin: 40,
    });

    doc.pipe(res);

    // =========================
    // HEADER
    // =========================

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
      .font("Helvetica-Bold")
      .text(
        "Eye Examination Report",
        {
          align: "center",
        }
      );

    doc.moveDown(2);

    // =========================
    // FILTER DETAILS
    // =========================

    doc
      .fontSize(10)
      .font("Helvetica")
      .text(
        `Store Code : ${storeCode}`
      );

    doc.text(
      `Date Range : ${fromDate || "All"} - ${
        toDate || "All"
      }`
    );

    doc.text(
      `Customer : ${customer || "All"}`
    );

    doc.text(
      `Patient ID : ${patientId || "All"}`
    );

    doc.text(
      `Age : ${age || "All"}`
    );

    doc.text(
      `Diagnosis : ${diagnosis || "All"}`
    );

    doc.moveDown();

    // =========================
    // TOTAL
    // =========================

    doc
      .fontSize(11)
      .font("Helvetica-Bold")
      .text(
        `Total Examinations : ${result.rows.length}`
      );

    doc.moveDown();

    // =========================
    // EXAMINATION DATA
    // =========================

    result.rows.forEach((item, index) => {

      // Prevent content from going outside page
      if (doc.y > 680) {
        doc.addPage();
      }

      doc.moveDown();

      // =========================
      // PATIENT
      // =========================

      doc
        .fontSize(12)
        .font("Helvetica-Bold")
        .text(
          `${index + 1}. Patient : ${
            item.patient_name || "-"
          }`
        );

      doc
        .fontSize(10)
        .font("Helvetica")
        .text(
          `Patient ID : ${
            item.patient_id || "-"
          }`
        );

      doc.text(
        `Age : ${item.age ?? "-"}`
      );

      doc.text(
        `Mobile : ${item.mobile || "-"}`
      );

      doc.text(
        `Diagnosis : ${
          item.diagnosis || "-"
        }`
      );

      doc.text(
        `Exam Date : ${
          item.exam_date || "-"
        }`
      );

      doc.moveDown(0.5);

      // =========================
      // RIGHT EYE
      // =========================

      doc
        .fontSize(10)
        .font("Helvetica-Bold")
        .text("Right Eye");

      doc
        .fontSize(10)
        .font("Helvetica")
        .text(
          `SPH : ${
            item.right_sph ?? "-"
          }`
        );

      doc.text(
        `CYL : ${
          item.right_cyl ?? "-"
        }`
      );

      doc.text(
        `AXIS : ${
          item.right_axis ?? "-"
        }`
      );

      doc.moveDown(0.5);

      // =========================
      // LEFT EYE
      // =========================

      doc
        .fontSize(10)
        .font("Helvetica-Bold")
        .text("Left Eye");

      doc
        .fontSize(10)
        .font("Helvetica")
        .text(
          `SPH : ${
            item.left_sph ?? "-"
          }`
        );

      doc.text(
        `CYL : ${
          item.left_cyl ?? "-"
        }`
      );

      doc.text(
        `AXIS : ${
          item.left_axis ?? "-"
        }`
      );

      doc.moveDown(0.5);

      // =========================
      // OTHER DETAILS
      // =========================

      doc.text(
        `Add Power : ${
          item.add_power ?? "-"
        }`
      );

      doc.text(
        `PD : ${
          item.pd ?? "-"
        }`
      );

      doc.text(
        `Notes : ${
          item.notes || "-"
        }`
      );

      doc.moveDown();

      // =========================
      // DIVIDER
      // =========================

      doc
        .moveTo(40, doc.y)
        .lineTo(555, doc.y)
        .stroke();

    });

    // =========================
    // NO DATA
    // =========================

    if (result.rows.length === 0) {

      doc.moveDown(2);

      doc
        .fontSize(12)
        .font("Helvetica")
        .text(
          "No eye examination records found.",
          {
            align: "center",
          }
        );
    }

    doc.end();

  } catch (error) {

    console.log(
      "EYE EXAM PDF ERROR:",
      error
    );

    res.status(500).json({
      success: false,
      message:
        "Eye exam PDF generation failed",
      error: error.message,
    });

  }
});



/*
================================================
EYE EXAM REPORT EXCEL
POST /reports/eye-exam/excel
================================================
*/


router.post("/eye-exam/excel", async (req, res) => {
  try {
    const {
      storeCode,
      fromDate,
      toDate,
      customer,
      patientId,
      age,
      diagnosis,
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

        e.patient_id,

        e.patient_name,

        p.age,

        p.mobile,

        e.diagnosis,

        e.right_sph,
        e.right_cyl,
        e.right_axis,

        e.left_sph,
        e.left_cyl,
        e.left_axis,

        e.add_power,

        e.pd,

        e.notes,

        e.exam_date

      FROM eye_exams e

      LEFT JOIN patients p
        ON p.patient_id = e.patient_id
        AND p.store_code = e.store_code

      WHERE e.store_code = $1

      -- FROM DATE
      AND (
        NULLIF(TRIM($2), '') IS NULL
        OR e.exam_date >= TO_DATE(
          TRIM($2),
          'DD-MM-YYYY'
        )
      )

      -- TO DATE
      AND (
        NULLIF(TRIM($3), '') IS NULL
        OR e.exam_date <= TO_DATE(
          TRIM($3),
          'DD-MM-YYYY'
        )
      )

      -- CUSTOMER NAME
      AND (
        NULLIF(TRIM($4), '') IS NULL
        OR e.patient_name ILIKE '%' || TRIM($4) || '%'
      )

      -- PATIENT ID
      AND (
        NULLIF(TRIM($5), '') IS NULL
        OR e.patient_id ILIKE '%' || TRIM($5) || '%'
      )

      -- AGE
      AND (
        NULLIF(TRIM($6), '') IS NULL
        OR p.age::TEXT = TRIM($6)
      )

      -- DIAGNOSIS
      AND (
        NULLIF(TRIM($7), '') IS NULL
        OR e.diagnosis ILIKE '%' || TRIM($7) || '%'
      )

      ORDER BY e.exam_date DESC
      `,
      [
        storeCode || "",
        fromDate || "",
        toDate || "",
        customer || "",
        patientId || "",
        age || "",
        diagnosis || "",
      ]
    );

    // =========================
    // CREATE WORKBOOK
    // =========================

    const workbook = new ExcelJS.Workbook();

    const sheet = workbook.addWorksheet(
      "Eye Examination"
    );

    // =========================
    // REPORT FILTER DETAILS
    // =========================

    sheet.addRow([
      "VISION EYE CARE",
    ]);

    sheet.addRow([
      "Eye Examination Report",
    ]);

    sheet.addRow([
      "Store Code",
      storeCode,
    ]);

    sheet.addRow([
      "From Date",
      fromDate || "All",
    ]);

    sheet.addRow([
      "To Date",
      toDate || "All",
    ]);

    sheet.addRow([
      "Customer",
      customer || "All",
    ]);

    sheet.addRow([
      "Patient ID",
      patientId || "All",
    ]);

    sheet.addRow([
      "Age",
      age || "All",
    ]);

    sheet.addRow([
      "Diagnosis",
      diagnosis || "All",
    ]);

    sheet.addRow([]);

    // =========================
    // TABLE HEADER
    // =========================

    const headerRow = sheet.addRow([
      "Patient ID",
      "Patient Name",
      "Age",
      "Mobile",
      "Diagnosis",

      "Right SPH",
      "Right CYL",
      "Right AXIS",

      "Left SPH",
      "Left CYL",
      "Left AXIS",

      "Add Power",
      "PD",
      "Notes",
      "Exam Date",
    ]);

    headerRow.font = {
      bold: true,
    };

    headerRow.alignment = {
      vertical: "middle",
      horizontal: "center",
    };

    // =========================
    // ADD DATA
    // =========================

    result.rows.forEach((row) => {

      sheet.addRow([
        row.patient_id || "",
        row.patient_name || "",
        row.age ?? "",
        row.mobile || "",

        row.diagnosis || "",

        row.right_sph ?? "",
        row.right_cyl ?? "",
        row.right_axis ?? "",

        row.left_sph ?? "",
        row.left_cyl ?? "",
        row.left_axis ?? "",

        row.add_power ?? "",

        row.pd ?? "",

        row.notes || "",

        row.exam_date || "",
      ]);

    });

    // =========================
    // COLUMN WIDTHS
    // =========================

    sheet.getColumn(1).width = 15;  // Patient ID
    sheet.getColumn(2).width = 25;  // Patient Name
    sheet.getColumn(3).width = 10;  // Age
    sheet.getColumn(4).width = 15;  // Mobile
    sheet.getColumn(5).width = 25;  // Diagnosis

    sheet.getColumn(6).width = 12;  // Right SPH
    sheet.getColumn(7).width = 12;  // Right CYL
    sheet.getColumn(8).width = 12;  // Right AXIS

    sheet.getColumn(9).width = 12;  // Left SPH
    sheet.getColumn(10).width = 12; // Left CYL
    sheet.getColumn(11).width = 12; // Left AXIS

    sheet.getColumn(12).width = 15; // Add Power
    sheet.getColumn(13).width = 10; // PD
    sheet.getColumn(14).width = 35; // Notes
    sheet.getColumn(15).width = 18; // Exam Date

    // =========================
    // FILTER SUMMARY STYLING
    // =========================

    sheet.getRow(1).font = {
      bold: true,
      size: 16,
    };

    sheet.getRow(2).font = {
      bold: true,
      size: 14,
    };

    // Rows 3-9 contain filters
    for (let i = 3; i <= 9; i++) {
      sheet.getCell(i, 1).font = {
        bold: true,
      };
    }

    // =========================
    // RESPONSE
    // =========================

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    res.setHeader(
      "Content-Disposition",
      "attachment; filename=eye-exam-report.xlsx"
    );

    await workbook.xlsx.write(res);

    res.end();

  } catch (error) {

    console.log(
      "EYE EXAM EXCEL ERROR:",
      error
    );

    res.status(500).json({
      success: false,
      message: "Eye exam Excel generation failed",
      error: error.message,
    });

  }
});

module.exports = router;