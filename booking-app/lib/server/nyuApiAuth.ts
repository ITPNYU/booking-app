const NYU_AUTH_URL = "https://auth.nyu.edu/oauth2/token";

export async function getNYUToken(): Promise<string | null> {
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
    console.log("token", data.access_token);
    return data.access_token;
  } catch (error) {
    console.error("Failed to get NYU token:", error);
    return null;
  }
}
