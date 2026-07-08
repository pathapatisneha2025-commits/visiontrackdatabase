const express = require("express");
const cors = require("cors");
const Registration = require("./routes/storeregistration.js");
const Patient = require("./routes/Patient.js");






require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

app.use("/registration",Registration );
app.use("/patient",Patient );



app.listen(5000, () => {
  console.log("Server running on port 5000");
});
