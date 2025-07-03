import { NextRequest } from "next/server";
import { GET } from "../../app/api/webcheckout/cart/[cartNumber]/route";

// Mock environment variables
const mockEnvVars = {
  WEBCHECKOUT_USERNAME: "testuser",
  WEBCHECKOUT_PASSWORD: "testpass",
  WEBCHECKOUT_API_BASE_URL: "https://test.webcheckout.net/api",
};

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock process.env
const originalEnv = process.env;

describe("WebCheckout API Route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv, ...mockEnvVars };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  const createMockRequest = (cartNumber: string) => {
    return new NextRequest(
      `http://localhost/api/webcheckout/cart/${cartNumber}`
    );
  };

  const createMockParams = (cartNumber: string) => ({
    params: { cartNumber },
  });

  describe("Input Validation", () => {
    it("should return 400 if cart number is missing", async () => {
      const request = createMockRequest("");
      const params = createMockParams("");

      const response = await GET(request, params);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Cart number is required");
    });

    it("should return 500 if environment variables are missing", async () => {
      process.env = {};
      const request = createMockRequest("CART123");
      const params = createMockParams("CART123");

      const response = await GET(request, params);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("WebCheckout credentials not configured");
    });
  });

  describe("WebCheckout Authentication", () => {
    it("should return 401 if WebCheckout authentication fails", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: () => Promise.resolve("Unauthorized"),
      });

      const request = createMockRequest("CART123");
      const params = createMockParams("CART123");

      const response = await GET(request, params);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toContain("WebCheckout authentication failed");
    });

    it("should return 401 if WebCheckout returns non-ok status", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({ status: "error", message: "Invalid credentials" }),
      });

      const request = createMockRequest("CART123");
      const params = createMockParams("CART123");

      const response = await GET(request, params);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toContain("WebCheckout authentication failed");
    });

    it("should return 401 if no session token is received", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: "ok" }),
      });

      const request = createMockRequest("CART123");
      const params = createMockParams("CART123");

      const response = await GET(request, params);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe(
        "WebCheckout authentication failed - no session token"
      );
    });
  });

  describe("Allocation Search", () => {
    const mockAuthResponse = {
      ok: true,
      json: () =>
        Promise.resolve({
          status: "ok",
          sessionToken: "mock-session-token",
        }),
    };

    it("should return 404 if cart is not found", async () => {
      mockFetch.mockResolvedValueOnce(mockAuthResponse).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            status: "ok",
            payload: [],
          }),
      });

      const request = createMockRequest("CART123");
      const params = createMockParams("CART123");

      const response = await GET(request, params);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Cart not found");
    });

    it("should return 500 if allocation data is missing OID", async () => {
      mockFetch.mockResolvedValueOnce(mockAuthResponse).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            status: "ok",
            payload: [
              {
                result: [{ name: "CART123" }], // Missing oid
              },
            ],
          }),
      });

      const request = createMockRequest("CART123");
      const params = createMockParams("CART123");

      const response = await GET(request, params);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Invalid allocation data - missing OID");
    });
  });

  describe("Successful Response", () => {
    const mockAuthResponse = {
      ok: true,
      json: () =>
        Promise.resolve({
          status: "ok",
          sessionToken: "mock-session-token",
        }),
    };

    const mockSearchResponse = {
      ok: true,
      json: () =>
        Promise.resolve({
          status: "ok",
          payload: [
            {
              result: [
                {
                  oid: 12345,
                  name: "CART123",
                },
              ],
            },
          ],
        }),
    };

    const mockDetailResponse = {
      ok: true,
      json: () =>
        Promise.resolve({
          status: "ok",
          payload: {
            name: "CART123",
            state: "CHECKOUT",
            pickupTime: "2024-01-01T10:00:00Z",
            returnTime: "2024-01-01T18:00:00Z",
            allocationContentsSummary: {
              groups: [
                {
                  label: "Checked out",
                  items: [
                    {
                      label: "Camera",
                      subitems: [
                        { label: "Canon EOS R5 - Serial 001", due: null },
                      ],
                    },
                  ],
                },
              ],
            },
          },
        }),
    };

    it("should return complete cart data successfully", async () => {
      mockFetch
        .mockResolvedValueOnce(mockAuthResponse)
        .mockResolvedValueOnce(mockSearchResponse)
        .mockResolvedValueOnce(mockDetailResponse);

      const request = createMockRequest("CART123");
      const params = createMockParams("CART123");

      const response = await GET(request, params);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toMatchObject({
        cartNumber: "CART123",
        status: "CHECKOUT",
        totalItems: 1,
        webCheckoutUrl:
          "https://engineering-nyu.webcheckout.net/sso/wco?method=show-entity&type=allocation&oid=12345",
        equipmentGroups: [
          {
            label: "Checked out",
            items: [
              {
                name: "Camera",
                subitems: [{ label: "Canon EOS R5 - Serial 001", due: null }],
              },
            ],
          },
        ],
      });
    });

    it("should calculate total items correctly", async () => {
      const mockDetailResponseMultipleItems = {
        ok: true,
        json: () =>
          Promise.resolve({
            status: "ok",
            payload: {
              name: "CART123",
              state: "CHECKOUT",
              allocationContentsSummary: {
                groups: [
                  {
                    label: "Checked out",
                    items: [
                      {
                        label: "Cameras",
                        subitems: [
                          { label: "Canon EOS R5 - Serial 001", due: null },
                          { label: "Canon EOS R5 - Serial 002", due: null },
                        ],
                      },
                      {
                        label: "Lenses",
                        subitems: [{ label: "24-70mm f/2.8", due: null }],
                      },
                    ],
                  },
                  {
                    label: "Returned",
                    items: [
                      {
                        label: "Tripods",
                        subitems: [{ label: "Manfrotto Tripod", due: null }],
                      },
                    ],
                  },
                ],
              },
            },
          }),
      };

      mockFetch
        .mockResolvedValueOnce(mockAuthResponse)
        .mockResolvedValueOnce(mockSearchResponse)
        .mockResolvedValueOnce(mockDetailResponseMultipleItems);

      const request = createMockRequest("CART123");
      const params = createMockParams("CART123");

      const response = await GET(request, params);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.totalItems).toBe(4); // 2 cameras + 1 lens + 1 tripod
    });
  });

  describe("Error Handling", () => {
    it("should handle fetch errors gracefully", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const request = createMockRequest("CART123");
      const params = createMockParams("CART123");

      const response = await GET(request, params);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Internal server error");
      expect(data.details).toBe("Network error");
    });

    it("should handle unauthenticated response from allocation search", async () => {
      const mockAuthResponse = {
        ok: true,
        json: () =>
          Promise.resolve({
            status: "ok",
            sessionToken: "mock-session-token",
          }),
      };

      mockFetch.mockResolvedValueOnce(mockAuthResponse).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            status: "unauthenticated",
          }),
      });

      const request = createMockRequest("CART123");
      const params = createMockParams("CART123");

      const response = await GET(request, params);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("WebCheckout session is invalid or expired");
    });
  });
});
