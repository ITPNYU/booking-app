import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.stubEnv("NYU_API_ACCESS_ID", "test-access-id");

const mockFetch = vi.fn();
global.fetch = mockFetch as unknown as typeof fetch;

vi.mock("@/lib/server/nyuApiAuth", () => ({
  getNYUToken: vi.fn(),
}));

vi.mock("@/lib/utils/testEnvironment", () => ({
  shouldBypassAuth: vi.fn().mockReturnValue(true),
}));

vi.mock("@/lib/firebase/server/firebaseAdmin", () => ({
  default: {
    auth: vi.fn().mockReturnValue({
      verifyIdToken: vi.fn(),
    }),
  },
}));

import { GET } from "@/app/api/nyu/entitlements/[netId]/route";
import { getNYUToken } from "@/lib/server/nyuApiAuth";
import { shouldBypassAuth } from "@/lib/utils/testEnvironment";
import admin from "@/lib/firebase/server/firebaseAdmin";

const mockGetNYUToken = vi.mocked(getNYUToken);
const mockShouldBypassAuth = vi.mocked(shouldBypassAuth);
const mockVerifyIdToken = vi.mocked(admin.auth().verifyIdToken);

const createRequest = (headers: Record<string, string> = {}) =>
  ({ headers: new Headers(headers) }) as any;

const createParams = (netId: string) =>
  Promise.resolve({ netId });

const parseJson = async (response: Response) => {
  const data = await response.json();
  return { data, status: response.status };
};

const makeNYUApiResponse = (userData: object, ok = true) =>
  ({
    ok,
    status: ok ? 200 : 500,
    json: async () => userData,
  }) as Response;

describe("GET /api/nyu/entitlements/[netId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetNYUToken.mockResolvedValue("mock-token");
    // Most tests run with auth bypassed (mirrors NODE_ENV=test behaviour)
    mockShouldBypassAuth.mockReturnValue(true);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("authorization checks (bypass disabled)", () => {
    beforeEach(() => {
      mockShouldBypassAuth.mockReturnValue(false);
    });

    it("returns 401 when Authorization header is missing", async () => {
      const response = await GET(createRequest(), { params: createParams("hz1234") });
      const result = await parseJson(response);

      expect(result.status).toBe(401);
      expect(result.data).toEqual({ error: "Unauthorized" });
    });

    it("returns 401 when the Firebase ID token is invalid", async () => {
      mockVerifyIdToken.mockRejectedValue(new Error("invalid token"));

      const response = await GET(
        createRequest({ authorization: "Bearer bad-token" }),
        { params: createParams("hz1234") },
      );
      const result = await parseJson(response);

      expect(result.status).toBe(401);
      expect(result.data).toEqual({ error: "Unauthorized" });
    });

    it("returns 403 when the token belongs to a different user", async () => {
      mockVerifyIdToken.mockResolvedValue({ email: "other@nyu.edu" } as any);

      const response = await GET(
        createRequest({ authorization: "Bearer valid-token" }),
        { params: createParams("hz1234") },
      );
      const result = await parseJson(response);

      expect(result.status).toBe(403);
      expect(result.data).toEqual({ error: "Forbidden" });
    });

    it("returns 401 when the token email is not an @nyu.edu address", async () => {
      mockVerifyIdToken.mockResolvedValue({ email: "user@gmail.com" } as any);

      const response = await GET(
        createRequest({ authorization: "Bearer valid-token" }),
        { params: createParams("hz1234") },
      );
      const result = await parseJson(response);

      expect(result.status).toBe(401);
      expect(result.data).toEqual({ error: "Unauthorized" });
    });

    it("proceeds normally when the token matches the requested netId", async () => {
      mockVerifyIdToken.mockResolvedValue({ email: "hz1234@nyu.edu" } as any);
      mockFetch.mockResolvedValue(
        makeNYUApiResponse({ dept_code: "UTIMNY" }),
      );

      const response = await GET(
        createRequest({ authorization: "Bearer valid-token" }),
        { params: createParams("hz1234") },
      );
      const result = await parseJson(response);

      expect(result.status).toBe(200);
      expect(result.data.entitledTenants).toContain("itp");
    });
  });

  describe("authentication and configuration errors", () => {
    it("uses NEXT_PUBLIC_BASE_URL to construct the identity API URL", async () => {
      vi.stubEnv("NEXT_PUBLIC_BASE_URL", "https://custom-base.example.com");
      mockFetch.mockResolvedValue(makeNYUApiResponse({ reporting_dept_name: "" }));

      await GET(createRequest(), { params: createParams("hz1234") });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("https://custom-base.example.com"),
      );
    });

    it("uses relative URL when NEXT_PUBLIC_BASE_URL is not set", async () => {
      vi.stubEnv("NEXT_PUBLIC_BASE_URL", "");
      mockFetch.mockResolvedValue(makeNYUApiResponse({ reporting_dept_name: "" }));

      await GET(createRequest(), { params: createParams("hz1234") });

      expect(mockFetch).toHaveBeenCalledWith("/api/nyu/identity/hz1234");
    });
  });

  describe("NYU Identity API failures", () => {
    it("falls back to mc-only when the NYU API returns a non-ok response", async () => {
      mockFetch.mockResolvedValue(makeNYUApiResponse({}, false));

      const response = await GET(createRequest(), { params: createParams("hz1234") });
      const result = await parseJson(response);

      expect(result.status).toBe(200);
      expect(result.data.entitledTenants).toEqual(["mc"]);
    });

    it("falls back to mc-only when fetch throws an unexpected error", async () => {
      mockFetch.mockRejectedValue(new Error("network error"));

      const response = await GET(createRequest(), { params: createParams("hz1234") });
      const result = await parseJson(response);

      expect(result.status).toBe(200);
      expect(result.data.entitledTenants).toEqual(["mc"]);
    });
  });

  describe("ITP affiliation detection via dept_code", () => {
    it("grants itp for an ITP user (dept_code: GTITPG)", async () => {
      mockFetch.mockResolvedValue(
        makeNYUApiResponse({ dept_code: "GTITPG" }),
      );

      const result = await parseJson(
        await GET(createRequest(), { params: createParams("ab1234") }),
      );

      expect(result.data.entitledTenants).toContain("mc");
      expect(result.data.entitledTenants).toContain("itp");
    });

    it("grants itp for an IMA user (dept_code: UTIMNY)", async () => {
      mockFetch.mockResolvedValue(
        makeNYUApiResponse({ dept_code: "UTIMNY" }),
      );

      const result = await parseJson(
        await GET(createRequest(), { params: createParams("hz3942") }),
      );

      expect(result.data.entitledTenants).toContain("mc");
      expect(result.data.entitledTenants).toContain("itp");
    });

    it("grants itp for a Low Res user (dept_code: TIIMA)", async () => {
      mockFetch.mockResolvedValue(
        makeNYUApiResponse({ dept_code: "TIIMA" }),
      );

      const result = await parseJson(
        await GET(createRequest(), { params: createParams("cd5678") }),
      );

      expect(result.data.entitledTenants).toContain("mc");
      expect(result.data.entitledTenants).toContain("itp");
    });

    it("returns only mc when dept_code is absent", async () => {
      mockFetch.mockResolvedValue(
        makeNYUApiResponse({ dept_code: null }),
      );

      const result = await parseJson(
        await GET(createRequest(), { params: createParams("mn5678") }),
      );

      expect(result.data.entitledTenants).toEqual(["mc"]);
    });

    it("returns only mc when dept_code does not match a known ITP code", async () => {
      mockFetch.mockResolvedValue(
        makeNYUApiResponse({ dept_code: "STERN_FINANCE" }),
      );

      const result = await parseJson(
        await GET(createRequest(), { params: createParams("kl1234") }),
      );

      expect(result.data.entitledTenants).toEqual(["mc"]);
    });
  });

  describe("non-ITP users", () => {
    it("returns only mc for a Stern business student", async () => {
      mockFetch.mockResolvedValue(
        makeNYUApiResponse({
          reporting_dept_name: "Undergraduate Finance",
          school_abbr: "STERN",
        }),
      );

      const result = await parseJson(
        await GET(createRequest(), { params: createParams("kl1234") }),
      );

      expect(result.data.entitledTenants).toEqual(["mc"]);
    });

    it("returns only mc when dept names are null/missing", async () => {
      mockFetch.mockResolvedValue(
        makeNYUApiResponse({
          reporting_dept_name: null,
          dept_name: null,
        }),
      );

      const result = await parseJson(
        await GET(createRequest(), { params: createParams("mn5678") }),
      );

      expect(result.data.entitledTenants).toEqual(["mc"]);
    });

    it("returns only mc for a Tandon engineering student", async () => {
      mockFetch.mockResolvedValue(
        makeNYUApiResponse({
          reporting_dept_name: "Computer Science and Engineering",
          school_abbr: "TANDON",
        }),
      );

      const result = await parseJson(
        await GET(createRequest(), { params: createParams("op9012") }),
      );

      expect(result.data.entitledTenants).toEqual(["mc"]);
    });
  });

  describe("response structure", () => {
    it("always includes mc as the first entitled tenant", async () => {
      mockFetch.mockResolvedValue(
        makeNYUApiResponse({ dept_code: "UTIMNY" }),
      );

      const result = await parseJson(
        await GET(createRequest(), { params: createParams("hz3942") }),
      );

      expect(result.data.entitledTenants[0]).toBe("mc");
    });

    it("passes the netId to the NYU Identity API URL", async () => {
      mockFetch.mockResolvedValue(makeNYUApiResponse({ reporting_dept_name: "" }));

      await GET(createRequest(), { params: createParams("abc123") });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("abc123"),
      );
    });
  });
});
