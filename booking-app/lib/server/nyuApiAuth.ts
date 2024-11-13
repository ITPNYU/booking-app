import { AuthResult } from "@/components/src/types";
import { NYUTokenManager } from "./nyuTokenCache";

export async function ensureNYUToken(): Promise<AuthResult> {
  try {
    const tokenManager = NYUTokenManager.getInstance();
    const tokenCache = await tokenManager.getToken();

    if (!tokenCache) {
      return {
        isAuthenticated: false,
        token: "",
        expiresAt: "",
        error: "Failed to get token",
      };
    }

    return {
      isAuthenticated: true,
      token: tokenCache.access_token,
      expiresAt: new Date(tokenCache.expires_at).toISOString(),
    };
  } catch (error) {
    console.error("NYU Auth error:", error);
    return {
      isAuthenticated: false,
      token: "",
      expiresAt: "",
      error: error instanceof Error ? error.message : "Internal error",
    };
  }
}
