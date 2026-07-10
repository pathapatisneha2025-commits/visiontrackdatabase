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
CUSTOMER REPORT PDF
POST /reports/customer/pdf
================================================
*/

router.post("/customer/pdf", async(req,res)=>{

try{


const {

storeCode,

customer

}=req.body;



const result = await pool.query(

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





res.setHeader(
"Content-Type",
"application/pdf"
);


res.setHeader(
"Content-Disposition",
"attachment; filename=customer-report.pdf"
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
"Customer Report",
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



let totalPurchase=0;

let pendingTotal=0;





result.rows.forEach((item,index)=>{


doc.moveDown();


doc.fontSize(12)
.font("Helvetica-Bold")
.text(
`${index+1}. ${item.patient_name}`
);



doc.fontSize(10)
.font("Helvetica")
.text(

`

Mobile : ${item.mobile}

Total Orders : ${item.total_orders}

Total Purchase : ₹${item.total_purchase}

Pending Amount : ₹${item.pending_amount}

------------------------------------

`

);



totalPurchase += Number(
item.total_purchase || 0
);


pendingTotal += Number(
item.pending_amount || 0
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

Total Purchase : ₹${totalPurchase}

Total Pending : ₹${pendingTotal}

`

);




doc.end();



}


catch(error){


console.log(
"CUSTOMER PDF ERROR",
error
);



res.status(500).json({

success:false,

message:"Customer PDF generation failed",

error:error.message

});


}


});

/*
================================================
CUSTOMER REPORT EXCEL
POST /reports/customer/excel
================================================
*/

router.post("/customer/excel", async(req,res)=>{

try{


const {

storeCode,

customer

}=req.body;



const result = await pool.query(

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





const workbook = new ExcelJS.Workbook();



const sheet =
workbook.addWorksheet(
"Customer Report"
);





sheet.columns=[


{
header:"Customer Name",
key:"patient_name",
width:25
},


{
header:"Mobile",
key:"mobile",
width:15
},


{
header:"Total Orders",
key:"total_orders",
width:15
},


{
header:"Total Purchase",
key:"total_purchase",
width:18
},


{
header:"Pending Amount",
key:"pending_amount",
width:18
}



];





let totalPurchase=0;

let totalPending=0;



result.rows.forEach(row=>{


sheet.addRow({

patient_name:row.patient_name,

mobile:row.mobile,

total_orders:row.total_orders,

total_purchase:Number(row.total_purchase),

pending_amount:Number(row.pending_amount)

});



totalPurchase += Number(
row.total_purchase || 0
);


totalPending += Number(
row.pending_amount || 0
);


});





sheet.addRow({});


sheet.addRow({

patient_name:"TOTAL",

total_purchase:totalPurchase,

pending_amount:totalPending

});





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



}


catch(error){


console.log(
"CUSTOMER EXCEL ERROR",
error
);



res.status(500).json({

success:false,

message:"Customer Excel generation failed",

error:error.message

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
STOCK REPORT PDF
GET /reports/stock/:storeCode/pdf
================================================
*/

router.get("/stock/:storeCode/pdf", async(req,res)=>{

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



let totalQuantity=0;



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

Purchase Price : ₹${item.purchase_price}

Selling Price : ₹${item.selling_price}

Supplier : ${item.supplier}

Quantity : ${item.quantity}

Rack : ${item.rack_location}

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
header:"Supplier",
key:"supplier",
width:20
},


{
header:"Quantity",
key:"quantity",
width:15
},


{
header:"Rack Location",
key:"rack_location",
width:18
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
/*
================================================
EYE EXAM REPORT PDF
POST /reports/eye-exam/pdf
================================================
*/

router.post("/eye-exam/pdf", async(req,res)=>{

try{


const {

storeCode,
fromDate,
toDate,
customer

}=req.body;



const result = await pool.query(

`

SELECT

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



res.setHeader(
"Content-Type",
"application/pdf"
);


res.setHeader(
"Content-Disposition",
"attachment; filename=eye-exam-report.pdf"
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
"Eye Examination Report",
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



result.rows.forEach((item,index)=>{


doc.fontSize(12)
.text(
`${index+1}. Patient : ${item.patient_name}`
);



doc.fontSize(10)
.text(

`
Patient ID : ${item.patient_id || ""}

Exam Date : ${item.exam_date}

Right Eye
SPH : ${item.right_sph}
CYL : ${item.right_cyl}
AXIS : ${item.right_axis}


Left Eye
SPH : ${item.left_sph}
CYL : ${item.left_cyl}
AXIS : ${item.left_axis}


Add Power : ${item.add_power}

PD : ${item.pd}

Notes : ${item.notes}


----------------------------------------
`

);


});



doc.end();



}


catch(error){


console.log(error);


res.status(500).json({

success:false,

message:"Eye exam PDF generation failed",

error:error.message

});


}


});







/*
================================================
EYE EXAM REPORT EXCEL
POST /reports/eye-exam/excel
================================================
*/


router.post("/eye-exam/excel", async(req,res)=>{


try{


const {

storeCode,
fromDate,
toDate,
customer

}=req.body;



const result = await pool.query(

`

SELECT


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





const workbook = new ExcelJS.Workbook();


const sheet = workbook.addWorksheet(
"Eye Examination"
);



sheet.columns=[


{
header:"Patient ID",
key:"patient_id",
width:15
},


{
header:"Patient Name",
key:"patient_name",
width:25
},


{
header:"Right SPH",
key:"right_sph",
width:12
},


{
header:"Right CYL",
key:"right_cyl",
width:12
},


{
header:"Right AXIS",
key:"right_axis",
width:12
},


{
header:"Left SPH",
key:"left_sph",
width:12
},


{
header:"Left CYL",
key:"left_cyl",
width:12
},


{
header:"Left AXIS",
key:"left_axis",
width:12
},


{
header:"Add Power",
key:"add_power",
width:15
},


{
header:"PD",
key:"pd",
width:10
},


{
header:"Notes",
key:"notes",
width:30
},


{
header:"Exam Date",
key:"exam_date",
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

"attachment; filename=eye-exam-report.xlsx"

);



await workbook.xlsx.write(res);


res.end();



}


catch(error){


console.log(error);


res.status(500).json({

success:false,

message:"Eye exam Excel generation failed",

error:error.message

});


}


});


module.exports = router;