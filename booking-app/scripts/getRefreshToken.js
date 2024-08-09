//@ts-nocheck
const { google } = require("googleapis");
const readline = require("readline");

const CLIENT_ID = "";
const CLIENT_SECRET = "";
const REDIRECT_URI = "http://localhost:3000/api/auth/callback";
const SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/spreadsheets",
];

const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: "offline",
  prompt: "consent",
  scope: SCOPES,
});

console.log("Authorize this app by visiting this url:", authUrl);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question("Enter the code from that page here: ", (code) => {
  rl.close();
  oauth2Client.getToken(code, (err, token) => {
    if (err) {
      return console.error("Error retrieving access token", err);
    }
    oauth2Client.setCredentials(token);
    console.log("Access Token:", token.access_token);
    console.log("Refresh Token:", token.refresh_token);
  });
});
