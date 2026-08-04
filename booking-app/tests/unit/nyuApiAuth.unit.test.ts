import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalFetch = globalThis.fetch;
const mockFetch = vi.fn();

function tokenResponse(token = "test-token", expiresIn = 3600) {
  return {
    ok: true,
    json: async () => ({ access_token: token, expires_in: expiresIn }),
  };
}

// nyuApiAuth caches the token and reads env at module scope, so each test
// re-imports a fresh module instance.
async function importFreshModule() {
  vi.resetModules();
  return import("@/lib/server/nyuApiAuth");
}

beforeEach(() => {
  vi.clearAllMocks();
  globalThis.fetch = mockFetch as unknown as typeof fetch;

  vi.stubEnv("NYU_API_CLIENT_ID", "wso2-client");
  vi.stubEnv("NYU_API_CLIENT_SECRET", "wso2-secret");
  vi.stubEnv("NYU_API_USER_NAME", "wso2-user");
  vi.stubEnv("NYU_API_PASSWORD", "wso2-pass");
  vi.stubEnv("NYU_API_AUTH_PROVIDER", "");
  vi.stubEnv("NYU_ENTRA_CLIENT_ID", "");
  vi.stubEnv("NYU_ENTRA_CLIENT_SECRET", "");
  vi.stubEnv("NYU_ENTRA_TENANT_ID", "");
  vi.stubEnv("NYU_ENTRA_SCOPE", "");
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.unstubAllEnvs();
});

describe("getNYUToken — WSO2 (default provider)", () => {
  it("posts a password grant with Basic auth to auth.nyu.edu", async () => {
    mockFetch.mockResolvedValueOnce(tokenResponse("wso2-token"));
    const { getNYUToken } = await importFreshModule();

    const token = await getNYUToken();

    expect(token).toBe("wso2-token");
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("https://auth.nyu.edu/oauth2/token");
    expect(init.headers.Authorization).toBe(
      `Basic ${Buffer.from("wso2-client:wso2-secret").toString("base64")}`,
    );
    const body = new URLSearchParams(init.body);
    expect(body.get("grant_type")).toBe("password");
    expect(body.get("username")).toBe("wso2-user");
    expect(body.get("password")).toBe("wso2-pass");
    expect(body.get("scope")).toBe("openid");
  });

  it("returns null when WSO2 credentials are missing", async () => {
    vi.stubEnv("NYU_API_PASSWORD", "");
    const { getNYUToken } = await importFreshModule();

    expect(await getNYUToken()).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe("getNYUToken — Entra ID provider", () => {
  beforeEach(() => {
    vi.stubEnv("NYU_API_AUTH_PROVIDER", "entra");
    vi.stubEnv("NYU_ENTRA_CLIENT_ID", "entra-client");
    vi.stubEnv("NYU_ENTRA_CLIENT_SECRET", "entra-secret");
  });

  it("posts a client_credentials grant to the Entra token endpoint", async () => {
    mockFetch.mockResolvedValueOnce(tokenResponse("entra-token"));
    const { getNYUToken } = await importFreshModule();

    const token = await getNYUToken();

    expect(token).toBe("entra-token");
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe(
      "https://login.microsoftonline.com/665be5ef-3fc6-401b-b6c4-401a9d9c7b72/oauth2/v2.0/token",
    );
    // Entra uses credentials in the body, not Basic auth
    expect(init.headers.Authorization).toBeUndefined();
    const body = new URLSearchParams(init.body);
    expect(body.get("grant_type")).toBe("client_credentials");
    expect(body.get("client_id")).toBe("entra-client");
    expect(body.get("client_secret")).toBe("entra-secret");
    expect(body.get("scope")).toBe("https://graph.microsoft.com/.default");
    expect(body.get("username")).toBeNull();
    expect(body.get("password")).toBeNull();
  });

  it("honors NYU_ENTRA_TENANT_ID and NYU_ENTRA_SCOPE overrides", async () => {
    vi.stubEnv("NYU_ENTRA_TENANT_ID", "custom-tenant");
    vi.stubEnv("NYU_ENTRA_SCOPE", "api://custom/.default");
    mockFetch.mockResolvedValueOnce(tokenResponse());
    const { getNYUToken } = await importFreshModule();

    await getNYUToken();

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe(
      "https://login.microsoftonline.com/custom-tenant/oauth2/v2.0/token",
    );
    expect(new URLSearchParams(init.body).get("scope")).toBe(
      "api://custom/.default",
    );
  });

  it("returns null when Entra credentials are missing", async () => {
    vi.stubEnv("NYU_ENTRA_CLIENT_SECRET", "");
    const { getNYUToken } = await importFreshModule();

    expect(await getNYUToken()).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns null on a non-OK token response", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });
    const { getNYUToken } = await importFreshModule();

    expect(await getNYUToken()).toBeNull();
  });
});

describe("getNYUToken — caching", () => {
  it("reuses the cached token until expiry", async () => {
    mockFetch.mockResolvedValue(tokenResponse("cached-token"));
    const { getNYUToken } = await importFreshModule();

    expect(await getNYUToken()).toBe("cached-token");
    expect(await getNYUToken()).toBe("cached-token");
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("deduplicates concurrent refreshes", async () => {
    mockFetch.mockResolvedValue(tokenResponse());
    const { getNYUToken } = await importFreshModule();

    await Promise.all([getNYUToken(), getNYUToken(), getNYUToken()]);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
