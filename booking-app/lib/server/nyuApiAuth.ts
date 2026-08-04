// NYU API OAuth token acquisition.
//
// NYU IT is migrating API auth from WSO2 to Microsoft Entra ID (WSO2 retires
// July 31). Only the token endpoint changes; API base URLs stay the same.
// Until our API's migration window, keep using WSO2. At cutover, set
// NYU_API_AUTH_PROVIDER=entra (plus NYU_ENTRA_CLIENT_ID / NYU_ENTRA_CLIENT_SECRET)
// and redeploy — no code change needed.

const WSO2_AUTH_URL = "https://auth.nyu.edu/oauth2/token";
// NYU's Entra tenant ID — constant. Verified against a live token request;
// the value in the migration PDF (3eda674c-…) is a placeholder that returns
// AADSTS700016. Overridable via env in case NYU IT publishes a different one.
const ENTRA_TENANT_ID =
  process.env.NYU_ENTRA_TENANT_ID || "665be5ef-3fc6-401b-b6c4-401a9d9c7b72";
const ENTRA_AUTH_URL = `https://login.microsoftonline.com/${ENTRA_TENANT_ID}/oauth2/v2.0/token`;
const ENTRA_SCOPE =
  process.env.NYU_ENTRA_SCOPE || "https://graph.microsoft.com/.default";

export const NYU_API_BASE = "https://api.nyu.edu/identity-v2-sys";

// Cache the OAuth token in memory. Refresh 60s before actual expiry.
let cachedToken: string | null = null;
let tokenExpiresAt = 0;
let refreshPromise: Promise<string | null> | null = null;
const EXPIRY_MARGIN_MS = 60_000;

export async function getNYUToken(): Promise<string | null> {
  if (cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken;
  }

  // Deduplicate concurrent refresh requests
  if (refreshPromise) return refreshPromise;
  refreshPromise = refreshNYUToken();
  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

function buildEntraTokenRequest(): { url: string; init: RequestInit } {
  const clientId = process.env.NYU_ENTRA_CLIENT_ID;
  const clientSecret = process.env.NYU_ENTRA_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("NYU Entra ID credentials not configured");
  }

  const params = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
    scope: ENTRA_SCOPE,
  });

  return {
    url: ENTRA_AUTH_URL,
    init: {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      cache: "no-store",
      body: params.toString(),
    },
  };
}

function buildWso2TokenRequest(): { url: string; init: RequestInit } {
  const clientId = process.env.NYU_API_CLIENT_ID;
  const clientSecret = process.env.NYU_API_CLIENT_SECRET;
  const username = process.env.NYU_API_USER_NAME;
  const password = process.env.NYU_API_PASSWORD;

  if (!clientId || !clientSecret || !username || !password) {
    throw new Error("NYU credentials not configured");
  }

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString(
    "base64",
  );

  const params = new URLSearchParams({
    grant_type: "password",
    username,
    password,
    scope: "openid",
  });

  return {
    url: WSO2_AUTH_URL,
    init: {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      cache: "no-store",
      body: params.toString(),
    },
  };
}

async function refreshNYUToken(): Promise<string | null> {
  try {
    const { url, init } =
      process.env.NYU_API_AUTH_PROVIDER === "entra"
        ? buildEntraTokenRequest()
        : buildWso2TokenRequest();

    const response = await fetch(url, init);

    if (!response.ok) {
      console.log("Error response", response);
      throw new Error(`Token fetch failed: ${response.status}`);
    }

    const data = await response.json();
    cachedToken = data.access_token;
    const expiresIn = Number(data.expires_in) || 3600;
    tokenExpiresAt = Date.now() + expiresIn * 1000 - EXPIRY_MARGIN_MS;
    return cachedToken;
  } catch (error) {
    console.error("Failed to get NYU token:", error);
    return null;
  }
}
