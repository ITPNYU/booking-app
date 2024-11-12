import { NYUAuthTokens } from "../../types";

export class NYUAuthClient {
  private static async fetchWithAuth(body: object) {
    const response = await fetch("/api/nyu/auth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "NYU Authentication failed");
    }

    return response.json();
  }

  static async getAccessToken(
    username: string,
    password: string
  ): Promise<NYUAuthTokens> {
    return this.fetchWithAuth({
      grant_type: "password",
      username,
      password,
    });
  }

  static async refreshToken(refreshToken: string): Promise<NYUAuthTokens> {
    return this.fetchWithAuth({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    });
  }
}
