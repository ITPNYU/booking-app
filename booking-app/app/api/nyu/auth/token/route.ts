import { TokenResponse } from "@/components/src/types";
import { NYUTokenManager } from "@/lib/server/nyuTokenCache";
import { Buffer } from "buffer";
import { NextResponse } from "next/server";

const NYU_AUTH_URL = "https://auth.nyu.edu/oauth2/token";

function getBasicAuthHeader(): string {
  const clientId = process.env.NYU_API_CLIENT_ID;
  const clientSecret = process.env.NYU_API_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("NYU credentials not configured");
  }

  const credentials = `${clientId}:${clientSecret}`;
  return `Basic ${Buffer.from(credentials).toString("base64")}`;
}

export async function GET() {
  try {
    const tokenManager = NYUTokenManager.getInstance();
    let tokenCache = await tokenManager.getToken();
    if (!tokenCache) {
      const username = process.env.NYU_API_USER_NAME;
      const password = process.env.NYU_API_PASSWORD;

      const params = new URLSearchParams({
        grant_type: "password",
        username,
        password,
        scope: "openid",
      });

      const response = await fetch(NYU_AUTH_URL, {
        method: "POST",
        headers: {
          Authorization: getBasicAuthHeader(),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
        // @ts-ignore
        rejectUnauthorized: false,
      });

      const tokenResponse: TokenResponse = await response.json();

      tokenManager.setToken(
        tokenResponse.access_token,
        tokenResponse.expires_in,
        tokenResponse.token_type,
      );
      tokenCache = await tokenManager.getToken()!;
    }
    return NextResponse.json({
      isAuthenticated: true,
      expiresAt: new Date(tokenCache.expires_at).toISOString(),
    });
  } catch (error) {
    console.error("NYU Auth error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
