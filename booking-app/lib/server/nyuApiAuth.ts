const NYU_AUTH_URL = "https://auth.nyu.edu/oauth2/token";
export const NYU_API_BASE = "https://api.nyu.edu/identity-v2-sys";

// Cache the OAuth token in memory. Refresh 60s before actual expiry.
let cachedToken: string | null = null;
let tokenExpiresAt = 0;
const EXPIRY_MARGIN_MS = 60_000;

export async function getNYUToken(): Promise<string | null> {
  if (cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken;
  }

  try {
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

    const response = await fetch(NYU_AUTH_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      cache: "no-store",
      body: params.toString(),
    });

    if (!response.ok) {
      console.log("Error response", response);
      throw new Error(`Token fetch failed: ${response.status}`);
    }

    const data = await response.json();
    cachedToken = data.access_token;
    // expires_in is in seconds; default to 3600 if absent
    const expiresInMs = ((data.expires_in as number) ?? 3600) * 1000;
    tokenExpiresAt = Date.now() + expiresInMs - EXPIRY_MARGIN_MS;
    return cachedToken;
  } catch (error) {
    console.error("Failed to get NYU token:", error);
    return null;
  }
}
