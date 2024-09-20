import { google } from "googleapis";

let cachedOAuth2Client = null;

const createOAuth2Client = () => {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
};

const refreshAccessTokenIfNeeded = async (oauth2Client) => {
  const currentTime = Date.now();
  const tokenExpiryTime = oauth2Client.credentials.expiry_date;

  console.log("Current time:", new Date(currentTime));
  console.log("Token expiry:", new Date(tokenExpiryTime));

  if (!tokenExpiryTime || currentTime >= tokenExpiryTime - 60000) {
    // 1分前に更新
    try {
      const { credentials } = await oauth2Client.refreshAccessToken();
      oauth2Client.setCredentials(credentials);
      console.log("Access token refreshed successfully");
      console.log(
        "New token expiry:",
        new Date(oauth2Client.credentials.expiry_date)
      );
    } catch (error) {
      console.error("Error refreshing access token:", error);
      throw error;
    }
  } else {
    console.log("Using existing access token");
  }
};

const getAuthenticatedClient = async () => {
  if (!cachedOAuth2Client) {
    console.log("Creating new OAuth2 client");
    cachedOAuth2Client = createOAuth2Client();
    cachedOAuth2Client.setCredentials({
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
    });
  }

  await refreshAccessTokenIfNeeded(cachedOAuth2Client);
  return cachedOAuth2Client;
};

const getCalendarClient = async () => {
  const authClient = await getAuthenticatedClient();
  return google.calendar({ version: "v3", auth: authClient });
};

const getGmailClient = async () => {
  const authClient = await getAuthenticatedClient();
  return google.gmail({ version: "v1", auth: authClient });
};
const getGoogleSheet = async (spreadsheetId: string) => {
  const authClient = await getAuthenticatedClient();
  return google.sheets({ version: "v4", auth: authClient });
};
const getLoggingClient = async () => {
  const authClient = await getAuthenticatedClient();
  return google.logging({ version: "v2", auth: authClient });
};

const oauth2Client = createOAuth2Client();
export {
  getCalendarClient,
  getGmailClient,
  getGoogleSheet,
  getLoggingClient,
  oauth2Client,
};
