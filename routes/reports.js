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


router.post("/customer",async(req,res)=>{


try{


const {

storeCode,

customer

}=req.body;



const result=await pool.query(

`

SELECT


patient_name,


mobile,


COUNT(*) AS total_orders,


COALESCE(
SUM(total_amount),
0
) AS total_purchase,


COALESCE(
SUM(balance_amount),
0
) AS pending_amount



FROM optical_orders



WHERE store_code=$1



AND

(

$2=''

OR

patient_name ILIKE '%'||$2||'%'

)



GROUP BY

patient_name,

mobile



ORDER BY total_purchase DESC



`,

[

storeCode,

customer || ""

]


);



res.json({

success:true,

data:result.rows

});


}


catch(error){

console.log(error);


res.status(500).json({

success:false,

message:"Customer report error"

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
STOCK REPORT
GET /reports/stock/:storeCode
================================================
*/


router.get("/stock/:storeCode",async(req,res)=>{


try{


const {

storeCode

}=req.params;



const result=await pool.query(

`

SELECT


id,

barcode,

brand,

frame_name,

model,

color,

size,

purchase_price,

selling_price,

supplier,

quantity,

rack_location



FROM optical_stock



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

console.log(error);


res.status(500).json({

success:false,

message:"Stock report error"

});


}


});









/*
================================================
MONTHLY SALES REPORT
GET /reports/monthly/:storeCode
================================================
*/


router.get("/monthly/:storeCode",async(req,res)=>{


try{


const {

storeCode

}=req.params;



const result=await pool.query(

`

SELECT


TO_CHAR(
order_date,
'Mon YYYY'
)
AS month,



COUNT(*) AS total_orders,



COALESCE(
SUM(total_amount),
0
)
AS total_sales,



COALESCE(
SUM(advance_paid),
0
)
AS received,



COALESCE(
SUM(balance_amount),
0
)
AS pending



FROM optical_orders



WHERE store_code=$1



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
)
DESC



`,

[storeCode]


);



res.json({

success:true,

data:result.rows

});


}


catch(error){

console.log(error);


res.status(500).json({

success:false,

message:"Monthly report error"

});


}


});


/*
================================================
MONTHLY SALES REPORT PDF
GET /reports/monthly/:storeCode/pdf
================================================
*/

router.get("/monthly/:storeCode/pdf", async(req,res)=>{

try{


const {
storeCode
}=req.params;



const result = await pool.query(

`

SELECT


TO_CHAR(
order_date,
'Mon YYYY'
)
AS month,


COUNT(*) AS total_orders,


COALESCE(
SUM(total_amount),
0
)
AS total_sales,


COALESCE(
SUM(advance_paid),
0
)
AS received,


COALESCE(
SUM(balance_amount),
0
)
AS pending



FROM optical_orders



WHERE store_code=$1



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
)
DESC


`,

[storeCode]


);





res.setHeader(
"Content-Type",
"application/pdf"
);


res.setHeader(
"Content-Disposition",
"attachment; filename=monthly-sales-report.pdf"
);




const doc = new PDFDocument({
margin:40
});



doc.pipe(res);




// HEADER

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
"Monthly Sales Report",
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





let grandTotal=0;

let totalOrders=0;





result.rows.forEach((item,index)=>{



doc.moveDown();



doc.fontSize(12)
.font("Helvetica-Bold")
.text(
`${index+1}. ${item.month}`
);



doc.fontSize(10)
.font("Helvetica")
.text(

`
Total Orders : ${item.total_orders}

Total Sales  : ₹${item.total_sales}

Received     : ₹${item.received}

Pending      : ₹${item.pending}

-------------------------------------
`

);



grandTotal += Number(
item.total_sales || 0
);


totalOrders += Number(
item.total_orders || 0
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

Total Orders : ${totalOrders}

Total Sales  : ₹${grandTotal}

`

);




doc.end();



}


catch(error){


console.log(
"MONTHLY PDF ERROR",
error
);



res.status(500).json({

success:false,

message:"Monthly PDF generation failed",

error:error.message

});


}



});
/*
================================================
MONTHLY SALES REPORT EXCEL
GET /reports/monthly/:storeCode/excel
================================================
*/

router.get("/monthly/:storeCode/excel", async(req,res)=>{

try{


const {
storeCode
}=req.params;



const result = await pool.query(

`

SELECT


TO_CHAR(
order_date,
'Mon YYYY'
)
AS month,


COUNT(*) AS total_orders,


COALESCE(
SUM(total_amount),
0
)
AS total_sales,


COALESCE(
SUM(advance_paid),
0
)
AS received,


COALESCE(
SUM(balance_amount),
0
)
AS pending



FROM optical_orders



WHERE store_code=$1



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
)
DESC


`,

[storeCode]


);





const workbook = new ExcelJS.Workbook();


const sheet =
workbook.addWorksheet(
"Monthly Sales"
);





sheet.columns=[

{
header:"Month",
key:"month",
width:20
},

{
header:"Total Orders",
key:"total_orders",
width:15
},

{
header:"Total Sales",
key:"total_sales",
width:18
},

{
header:"Received",
key:"received",
width:18
},

{
header:"Pending",
key:"pending",
width:18
}

];





let grandTotal=0;

let totalOrders=0;



result.rows.forEach(row=>{


sheet.addRow({

month:row.month,

total_orders:row.total_orders,

total_sales:Number(row.total_sales),

received:Number(row.received),

pending:Number(row.pending)

});


grandTotal += Number(row.total_sales || 0);

totalOrders += Number(row.total_orders || 0);


});





// SUMMARY ROW

sheet.addRow({});

sheet.addRow({

month:"TOTAL",

total_orders:totalOrders,

total_sales:grandTotal


});





res.setHeader(

"Content-Type",

"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

);



res.setHeader(

"Content-Disposition",

"attachment; filename=monthly-sales-report.xlsx"

);





await workbook.xlsx.write(res);


res.end();



}


catch(error){


console.log(
"MONTHLY EXCEL ERROR",
error
);



res.status(500).json({

success:false,

message:"Monthly Excel generation failed",

error:error.message

});


}


});
/*
================================================
EYE EXAMINATION REPORT
POST /reports/eye-exam
================================================
*/

router.post("/eye-exam", async(req,res)=>{


try{


const {

storeCode,

fromDate,

toDate,

customer

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


patient_id,

patient_name,


right_sph,

right_cyl,

right_axis,


left_sph,

left_cyl,

left_axis,


add_power,


pd,


notes,


exam_date



FROM eye_exams



WHERE store_code=$1



AND

(

$2=''

OR

exam_date >= TO_DATE($2,'DD-MM-YYYY')

)



AND

(

$3=''

OR

exam_date <= TO_DATE($3,'DD-MM-YYYY')

)



AND

(

$4=''

OR

patient_name ILIKE '%'||$4||'%'

)



ORDER BY exam_date DESC



`,

[

storeCode,

fromDate || "",

toDate || "",

customer || ""

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

message:"Eye examination report error",

error:error.message

});


}


});


module.exports = router;