const { Expo } = require("expo-server-sdk");
const webpush = require("web-push");


const expo = new Expo();



// ===============================
// WEB PUSH CONFIG
// ===============================

webpush.setVapidDetails(

"mailto:admin@visiontrack.com",

process.env.VAPID_PUBLIC_KEY,

process.env.VAPID_PRIVATE_KEY

);





// ===============================
// ANDROID PUSH
// ===============================

async function sendAndroidNotification(
token,
title,
body,
data={}
){

try{


if(!Expo.isExpoPushToken(token)){

console.log(
"Invalid Expo Token",
token
);

return;

}



const message={


to:token,

sound:"default",

title:title,

body:body,

data:data


};



const response =
await expo.sendPushNotificationsAsync(
[
message
]
);



console.log(
"ANDROID PUSH:",
response
);



}
catch(error){

console.log(
"ANDROID PUSH ERROR:",
error
);

}


}





// ===============================
// WEB PUSH
// ===============================

async function sendWebNotification(

subscription,

title,

body,

data={}

){


try{


await webpush.sendNotification(

subscription,

JSON.stringify({

title,

body,

data

})

);



console.log(
"WEB PUSH SENT"
);



}
catch(error){


console.log(
"WEB PUSH ERROR",
error
);


}


}





// ===============================
// MAIN FUNCTION
// ===============================

async function sendNotification({

type,

token,

subscription,

title,

body,

data

}){


if(type==="android"){


await sendAndroidNotification(

token,

title,

body,

data

);


}



if(type==="web"){


await sendWebNotification(

subscription,

title,

body,

data

);


}


}




module.exports = sendNotification;