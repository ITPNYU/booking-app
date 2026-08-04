let cachedOAuth2Client: Awaited<
  ReturnType<typeof createOAuth2Client>
> | null = null;
let googleapisModule: typeof import("googleapis") | null = null;

const loadGoogleApis = async () => {
  if (!googleapisModule) {
    googleapisModule = await import("googleapis");
  }
  return googleapisModule.google;
};

const createOAuth2Client = async () => {
  const googleApi = await loadGoogleApis();
  return new googleApi.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  );
};

const refreshAccessTokenIfNeeded = async (
  oauth2Client: Awaited<ReturnType<typeof createOAuth2Client>>,
) => {
  const currentTime = Date.now();
  const tokenExpiryTime = oauth2Client.credentials.expiry_date;

  if (!tokenExpiryTime || currentTime >= tokenExpiryTime - 60000) {
    try {
      const { credentials } = await oauth2Client.refreshAccessToken();
      oauth2Client.setCredentials(credentials);
    } catch (error) {
      console.error("Error refreshing access token:", error);
      throw error;
    }
  }
};

const getAuthenticatedClient = async () => {
  if (!cachedOAuth2Client) {
    cachedOAuth2Client = await createOAuth2Client();
    cachedOAuth2Client.setCredentials({
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
    });
  }

  await refreshAccessTokenIfNeeded(cachedOAuth2Client);
  return cachedOAuth2Client;
};

const getCalendarClient = async () => {
  const googleApi = await loadGoogleApis();
  const authClient = await getAuthenticatedClient();
  return googleApi.calendar({ version: "v3", auth: authClient });
};

const getGmailClient = async () => {
  const googleApi = await loadGoogleApis();
  const authClient = await getAuthenticatedClient();
  return googleApi.gmail({ version: "v1", auth: authClient });
};

const getGoogleSheet = async (_spreadsheetId: string) => {
  const googleApi = await loadGoogleApis();
  const authClient = await getAuthenticatedClient();
  return googleApi.sheets({ version: "v4", auth: authClient });
};

const getLoggingClient = async () => {
  const googleApi = await loadGoogleApis();
  const authClient = await getAuthenticatedClient();
  return googleApi.logging({ version: "v2", auth: authClient });
};

const getFormsClient = async () => {
  const googleApi = await loadGoogleApis();
  const authClient = await getAuthenticatedClient();
  return googleApi.forms({ version: "v1", auth: authClient });
};

let cachedOAuth2ClientForAuth: Awaited<
  ReturnType<typeof createOAuth2Client>
> | null = null;

export const getOAuth2Client = async () => {
  if (!cachedOAuth2ClientForAuth) {
    cachedOAuth2ClientForAuth = await createOAuth2Client();
  }
  return cachedOAuth2ClientForAuth;
};

export {
  getCalendarClient,
  getGmailClient,
  getGoogleSheet,
  getFormsClient,
  getLoggingClient,
};
