//@ts-nocheck
require("dotenv").config();
const { google } = require("googleapis");
const readline = require("readline");

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const scopes = ["https://www.googleapis.com/auth/calendar"];

const url = oauth2Client.generateAuthUrl({
  access_type: "offline",
  scope: scopes,
});

console.log("Authorize this app by visiting this url:", url);

rl.question("Enter the code from that page here: ", async (code) => {
  rl.close();
  const { tokens } = await oauth2Client.getToken(code);
  console.log("Access Token:", tokens.access_token);
  console.log("Refresh Token:", tokens.refresh_token);
});
