const express = require("express");
const cors = require("cors");
const Registration = require("./routes/storeregistration.js");
const Patient = require("./routes/Patient.js");
const EyeExam = require("./routes/eyeexam.js");
const OpticalOrders = require("./routes/opticalorders.js");
const StockInventory = require("./routes/stockinventory.js");
const FollowUps = require("./routes/followups.js");
const SubscriptionPlans = require("./routes/subscriptionplans.js");
const Reports = require("./routes/reports.js");







require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

app.use("/registration",Registration );
app.use("/patient",Patient );
app.use("/eyeexam",EyeExam );
app.use("/opticalorders",OpticalOrders );
app.use("/stockinventory",StockInventory );
app.use("/followups",FollowUps );
app.use("/subscriptionplans",SubscriptionPlans );
app.use("/reports",Reports);



app.listen(5000, () => {
  console.log("Server running on port 5000");
});
