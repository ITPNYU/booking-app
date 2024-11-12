import { Buffer } from "buffer";

const NYU_AUTH_URL = "https://auth.nyu.edu/oauth2/token";

export class NYUTokenManager {
  private static instance: NYUTokenManager;
  private tokenCache: NYUTokenCache | null = null;
  private tokenRefreshPromise: Promise<NYUTokenCache | null> | null = null;

  private constructor() {}

  static getInstance(): NYUTokenManager {
    if (!NYUTokenManager.instance) {
      NYUTokenManager.instance = new NYUTokenManager();
    }
    return NYUTokenManager.instance;
  }

  private getBasicAuthHeader(): string {
    const clientId = process.env.NYU_API_CLIENT_ID;
    const clientSecret = process.env.NYU_API_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error("NYU credentials not configured");
    }

    const credentials = `${clientId}:${clientSecret}`;
    return `Basic ${Buffer.from(credentials).toString("base64")}`;
  }

  private async fetchNewToken(): Promise<TokenResponse> {
    const username = process.env.NYU_API_USER_NAME;
    const password = process.env.NYU_API_PASSWORD;

    if (!username || !password) {
      throw new Error("NYU API credentials not configured");
    }

    const params = new URLSearchParams({
      grant_type: "password",
      username,
      password,
      scope: "openid",
    });

    const response = await fetch(NYU_AUTH_URL, {
      method: "POST",
      headers: {
        Authorization: this.getBasicAuthHeader(),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
      // @ts-ignore
      rejectUnauthorized: false,
    });

    if (!response.ok) {
      throw new Error(`Token fetch failed: ${response.status}`);
    }

    return response.json();
  }

  private async refreshExistingToken(
    refresh_token: string
  ): Promise<TokenResponse> {
    const params = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token,
      scope: "openid",
    });

    const response = await fetch(NYU_AUTH_URL, {
      method: "POST",
      headers: {
        Authorization: this.getBasicAuthHeader(),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.status}`);
    }

    return response.json();
  }

  async getToken(): Promise<NYUTokenCache | null> {
    if (this.tokenCache) {
      const now = Date.now();
      if (this.tokenCache.expires_at > now + 5 * 60 * 1000) {
        console.log("Token cache hit");
        return this.tokenCache;
      }
    }

    if (this.tokenRefreshPromise) {
      console.log("Waiting for ongoing token refresh");
      return this.tokenRefreshPromise;
    }

    console.log("Starting token refresh");
    this.tokenRefreshPromise = this.refreshToken();

    try {
      const result = await this.tokenRefreshPromise;
      return result;
    } finally {
      this.tokenRefreshPromise = null;
    }
  }

  private async refreshToken(): Promise<NYUTokenCache | null> {
    try {
      let tokenResponse: TokenResponse;

      if (this.tokenCache?.refresh_token) {
        try {
          console.log("Attempting to refresh token");
          tokenResponse = await this.refreshExistingToken(
            this.tokenCache.refresh_token
          );
        } catch (error) {
          console.log("Refresh token failed, fetching new token");
          tokenResponse = await this.fetchNewToken();
        }
      } else {
        console.log("No refresh token, fetching new token");
        tokenResponse = await this.fetchNewToken();
      }

      const now = Date.now();
      this.tokenCache = {
        access_token: tokenResponse.access_token,
        token_type: tokenResponse.token_type,
        expires_at: now + tokenResponse.expires_in * 1000,
        lastUpdated: now,
        refresh_token: tokenResponse.refresh_token,
      };

      console.log("Token successfully updated");
      return this.tokenCache;
    } catch (error) {
      console.error("Failed to refresh token:", error);
      this.clearToken();
      return null;
    }
  }

  setToken(
    access_token: string,
    expires_in: number,
    token_type: string = "Bearer",
    refresh_token?: string
  ) {
    const now = Date.now();
    this.tokenCache = {
      access_token,
      token_type,
      expires_at: now + expires_in * 1000,
      lastUpdated: now,
      refresh_token,
    };
    console.log("Token manually set");
  }

  clearToken() {
    this.tokenCache = null;
    console.log("Token cleared");
  }
}
