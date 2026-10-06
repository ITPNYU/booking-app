import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as UpdateCartPost } from "../../app/api/updateWebcheckoutCart/route";
import { GET } from "../../app/api/webcheckout/cart/[cartNumber]/route";

// Mock server admin functions
vi.mock("@/components/src/server/admin", () => ({
  serverUpdateDataByCalendarEventId: vi.fn(),
}));

// The cart route authorizes the session's role against the tenant schema.
const authMocks = vi.hoisted(() => ({
  requireSession: vi.fn(),
  resolveCallerRole: vi.fn(),
  getCachedTenantSchema: vi.fn(),
}));

vi.mock("@/lib/api/requireSession", () => ({
  requireSession: () => authMocks.requireSession(),
}));

vi.mock("@/lib/api/authz", () => ({
  resolveCallerRole: (...args: unknown[]) =>
    authMocks.resolveCallerRole(...args),
}));

vi.mock("@/lib/tenant/getCachedTenantSchema", () => ({
  getCachedTenantSchema: (...args: unknown[]) =>
    authMocks.getCachedTenantSchema(...args),
}));

// Import the mocked modules
import { serverUpdateDataByCalendarEventId } from "@/components/src/server/admin";
import { generateDefaultSchema } from "@/components/src/client/routes/components/schemaTypes";
import { PagePermission } from "@/components/src/types";

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
      process.env = { NODE_ENV: "test" } as any;
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
  });

  describe("Session Re-authentication", () => {
    const mockAuthResponse = {
      ok: true,
      json: () =>
        Promise.resolve({
          status: "ok",
          sessionToken: "mock-session-token",
        }),
    };

    const mockReAuthResponse = {
      ok: true,
      json: () =>
        Promise.resolve({
          status: "ok",
          sessionToken: "mock-new-session-token",
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

    it("should re-authenticate and retry when allocation search returns unauthenticated", async () => {
      // First auth succeeds, search returns unauthenticated, re-auth succeeds, retry search succeeds, detail succeeds
      mockFetch
        .mockResolvedValueOnce(mockAuthResponse) // Initial auth
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ status: "unauthenticated" }),
        }) // Search returns unauthenticated
        .mockResolvedValueOnce(mockReAuthResponse) // Re-auth
        .mockResolvedValueOnce(mockSearchResponse) // Retry search
        .mockResolvedValueOnce(mockDetailResponse); // Detail

      const request = createMockRequest("CART123");
      const params = createMockParams("CART123");

      const response = await GET(request, params);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.cartNumber).toBe("CART123");
      expect(mockFetch).toHaveBeenCalledTimes(5); // auth + search + re-auth + retry search + detail
    });

    it("should return 401 when re-authentication fails after unauthenticated response", async () => {
      mockFetch
        .mockResolvedValueOnce(mockAuthResponse) // Initial auth
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ status: "unauthenticated" }),
        }) // Search returns unauthenticated
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          text: () => Promise.resolve("Re-auth failed"),
        }); // Re-auth fails

      const request = createMockRequest("CART123");
      const params = createMockParams("CART123");

      const response = await GET(request, params);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toContain("WebCheckout authentication failed");
    });

    it("should return 401 when retry still returns unauthenticated", async () => {
      mockFetch
        .mockResolvedValueOnce(mockAuthResponse) // Initial auth
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ status: "unauthenticated" }),
        }) // Search returns unauthenticated
        .mockResolvedValueOnce(mockReAuthResponse) // Re-auth succeeds
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ status: "unauthenticated" }),
        }); // Retry search still unauthenticated

      const request = createMockRequest("CART123");
      const params = createMockParams("CART123");

      const response = await GET(request, params);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe(
        "WebCheckout session is invalid or expired even after re-authentication"
      );
    });

    it("should re-authenticate and retry when allocation/get returns unauthenticated", async () => {
      // Auth succeeds, search succeeds, detail returns unauthenticated, re-auth succeeds, retry detail succeeds
      mockFetch
        .mockResolvedValueOnce(mockAuthResponse) // Initial auth
        .mockResolvedValueOnce(mockSearchResponse) // Search succeeds
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ status: "unauthenticated" }),
        }) // Detail returns unauthenticated
        .mockResolvedValueOnce(mockReAuthResponse) // Re-auth
        .mockResolvedValueOnce(mockDetailResponse); // Retry detail

      const request = createMockRequest("CART123");
      const params = createMockParams("CART123");

      const response = await GET(request, params);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.cartNumber).toBe("CART123");
      expect(mockFetch).toHaveBeenCalledTimes(5); // auth + search + detail + re-auth + retry detail
    });

    it("should return 401 when allocation/get retry still returns unauthenticated", async () => {
      mockFetch
        .mockResolvedValueOnce(mockAuthResponse) // Initial auth
        .mockResolvedValueOnce(mockSearchResponse) // Search succeeds
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ status: "unauthenticated" }),
        }) // Detail returns unauthenticated
        .mockResolvedValueOnce(mockReAuthResponse) // Re-auth succeeds
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ status: "unauthenticated" }),
        }); // Retry detail still unauthenticated

      const request = createMockRequest("CART123");
      const params = createMockParams("CART123");

      const response = await GET(request, params);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe(
        "WebCheckout session is invalid or expired even after re-authentication"
      );
    });
  });
});

describe("UpdateWebcheckoutCart API Route", () => {
  const schemaWith = (
    detailsModal: Partial<
      ReturnType<typeof generateDefaultSchema>["detailsModal"]
    >,
  ) => {
    const base = generateDefaultSchema("mc");
    return {
      ...base,
      detailsModal: { ...base.detailsModal, ...detailsModal },
    };
  };

  const createMockUpdateRequest = (body: any) => {
    return new NextRequest("http://localhost/api/updateWebcheckoutCart", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-tenant": "mc",
      },
      body: JSON.stringify(body),
    });
  };

  const okCalendarUpdate = () =>
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ message: "Event updated successfully" }),
    });

  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.requireSession.mockResolvedValue({
      email: "admin@nyu.edu",
      netId: "admin",
    });
    authMocks.resolveCallerRole.mockResolvedValue(PagePermission.ADMIN);
    authMocks.getCachedTenantSchema.mockResolvedValue(schemaWith({}));
    vi.mocked(serverUpdateDataByCalendarEventId).mockResolvedValue(undefined);
  });

  describe("Input Validation", () => {
    it("should return 401 without a session", async () => {
      authMocks.requireSession.mockResolvedValue(null);
      const response = await UpdateCartPost(
        createMockUpdateRequest({
          calendarEventId: "test-event-id",
          cartNumber: "CK-2614",
        }),
      );
      expect(response.status).toBe(401);
      expect(serverUpdateDataByCalendarEventId).not.toHaveBeenCalled();
    });

    it("should return 400 if calendarEventId is missing", async () => {
      const request = createMockUpdateRequest({
        cartNumber: "CK-2614",
      });

      const response = await UpdateCartPost(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Missing required fields");
    });

    it("ignores a client-supplied userEmail and authorizes the session", async () => {
      okCalendarUpdate();
      const response = await UpdateCartPost(
        createMockUpdateRequest({
          calendarEventId: "test-event-id",
          cartNumber: "CK-2614",
          userEmail: "someone-else@nyu.edu",
        }),
      );
      expect(response.status).toBe(200);
      expect(authMocks.resolveCallerRole).toHaveBeenCalledWith(
        { email: "admin@nyu.edu", netId: "admin" },
        "mc",
      );
    });
  });

  describe("Authorization", () => {
    it("should return 403 for a role outside webCheckoutEditRoles", async () => {
      authMocks.resolveCallerRole.mockResolvedValue(PagePermission.BOOKING);
      const request = createMockUpdateRequest({
        calendarEventId: "test-event-id",
        cartNumber: "CK-2614",
      });

      const response = await UpdateCartPost(request);

      expect(response.status).toBe(403);
      expect(serverUpdateDataByCalendarEventId).not.toHaveBeenCalled();
    });

    it("rejects Liaison and Services callers under the default roles", async () => {
      for (const role of [PagePermission.LIAISON, PagePermission.SERVICES]) {
        authMocks.resolveCallerRole.mockResolvedValue(role);
        const response = await UpdateCartPost(
          createMockUpdateRequest({
            calendarEventId: "test-event-id",
            cartNumber: "CK-2614",
          }),
        );
        expect(response.status).toBe(403);
      }
      expect(serverUpdateDataByCalendarEventId).not.toHaveBeenCalled();
    });

    it.each([
      PagePermission.PA,
      PagePermission.ADMIN,
      PagePermission.SUPER_ADMIN,
    ])("should allow %s callers under the default roles", async (role) => {
      authMocks.resolveCallerRole.mockResolvedValue(role);
      okCalendarUpdate();

      const response = await UpdateCartPost(
        createMockUpdateRequest({
          calendarEventId: "test-event-id",
          cartNumber: "CK-2614",
        }),
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe("Cart number updated successfully");
    });

    it("honors a tenant webCheckoutEditRoles list that includes SERVICES", async () => {
      authMocks.getCachedTenantSchema.mockResolvedValue(
        schemaWith({ webCheckoutEditRoles: ["SERVICES", "ADMIN"] }),
      );
      authMocks.resolveCallerRole.mockResolvedValue(PagePermission.SERVICES);
      okCalendarUpdate();

      const response = await UpdateCartPost(
        createMockUpdateRequest({
          calendarEventId: "test-event-id",
          cartNumber: "CK-2614",
        }),
      );
      expect(response.status).toBe(200);
    });

    it("rejects a PA caller when webCheckoutEditRoles is ADMIN only, even if PA can view", async () => {
      authMocks.getCachedTenantSchema.mockResolvedValue(
        schemaWith({
          webCheckoutViewRoles: ["PA"],
          webCheckoutEditRoles: ["ADMIN"],
        }),
      );
      authMocks.resolveCallerRole.mockResolvedValue(PagePermission.PA);

      const response = await UpdateCartPost(
        createMockUpdateRequest({
          calendarEventId: "test-event-id",
          cartNumber: "CK-2614",
        }),
      );
      expect(response.status).toBe(403);
      expect(serverUpdateDataByCalendarEventId).not.toHaveBeenCalled();
    });

    it("rejects everyone when showWebCheckout is off", async () => {
      authMocks.getCachedTenantSchema.mockResolvedValue(
        schemaWith({ showWebCheckout: false }),
      );

      const response = await UpdateCartPost(
        createMockUpdateRequest({
          calendarEventId: "test-event-id",
          cartNumber: "CK-2614",
        }),
      );
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe("WebCheckout is not enabled for this tenant");
      expect(serverUpdateDataByCalendarEventId).not.toHaveBeenCalled();
    });
  });

  describe("Database and Calendar Updates", () => {
    it("should update database with cart number", async () => {
      okCalendarUpdate();

      const request = createMockUpdateRequest({
        calendarEventId: "test-event-id",
        cartNumber: "CK-2614",
      });

      await UpdateCartPost(request);

      expect(vi.mocked(serverUpdateDataByCalendarEventId)).toHaveBeenCalledWith(
        "bookings",
        "test-event-id",
        { webcheckoutCartNumber: "CK-2614" },
        "mc",
      );
    });

    it("should update calendar event description with cart number", async () => {
      okCalendarUpdate();

      const request = createMockUpdateRequest({
        calendarEventId: "test-event-id",
        cartNumber: "CK-2614",
      });

      await UpdateCartPost(request);

      // Check that calendar API was called
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3000/api/calendarEvents",
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "x-tenant": "mc",
          },
          body: JSON.stringify({
            calendarEventId: "test-event-id",
            newValues: {},
          }),
        },
      );
    });

    it("should handle cart number removal (null value)", async () => {
      okCalendarUpdate();

      const request = createMockUpdateRequest({
        calendarEventId: "test-event-id",
        cartNumber: null,
      });

      const response = await UpdateCartPost(request);

      expect(response.status).toBe(200);
      expect(vi.mocked(serverUpdateDataByCalendarEventId)).toHaveBeenCalledWith(
        "bookings",
        "test-event-id",
        { webcheckoutCartNumber: null },
        "mc",
      );
    });

    it("should continue if calendar update fails", async () => {
      // Mock failed calendar update
      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: () => Promise.resolve("Calendar update failed"),
      });

      const request = createMockUpdateRequest({
        calendarEventId: "test-event-id",
        cartNumber: "CK-2614",
      });

      const response = await UpdateCartPost(request);
      const data = await response.json();

      // Should still return success even if calendar update fails
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe("Cart number updated successfully");
    });
  });

  describe("Error Handling", () => {
    it("should return 500 if database update fails", async () => {
      vi.mocked(serverUpdateDataByCalendarEventId).mockRejectedValue(
        new Error("Database error"),
      );

      const request = createMockUpdateRequest({
        calendarEventId: "test-event-id",
        cartNumber: "CK-2614",
      });

      const response = await UpdateCartPost(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Internal server error");
    });
  });
});
