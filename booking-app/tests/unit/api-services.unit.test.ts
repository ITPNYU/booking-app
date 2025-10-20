import { beforeEach, describe, expect, it, vi } from "vitest";

vi.stubEnv("NEXT_PUBLIC_BASE_URL", "https://booking.test");

const mockFetch = vi.fn();
global.fetch = mockFetch as unknown as typeof fetch;

vi.mock("@/lib/stateMachines/xstateUtilsV5", () => ({
  executeXStateTransition: vi.fn(),
}));

vi.mock("@/components/src/server/admin", () => ({
  finalApprove: vi.fn(),
}));

vi.mock("@/lib/firebase/server/adminDb", () => ({
  serverGetDataByCalendarEventId: vi.fn(),
}));

vi.mock("@/components/src/utils/tenantUtils", () => ({
  shouldUseXState: vi.fn(),
}));

import { POST } from "@/app/api/services/route";
import { DEFAULT_TENANT } from "@/components/src/constants/tenants";
import { finalApprove } from "@/components/src/server/admin";
import { shouldUseXState } from "@/components/src/utils/tenantUtils";
import { executeXStateTransition } from "@/lib/stateMachines/xstateUtilsV5";
import { serverGetDataByCalendarEventId } from "@/lib/firebase/server/adminDb";

type MockRequestBody = {
  calendarEventId: string;
  serviceType: string;
  action: string;
  email: string;
};

const createRequest = (
  body: MockRequestBody,
  headers: Record<string, string> = {},
) => ({
  json: async () => body,
  headers: new Headers(headers),
});

const mockExecute = vi.mocked(executeXStateTransition);
const mockFinalApprove = vi.mocked(finalApprove);
const mockServerGetDataByCalendarEventId = vi.mocked(
  serverGetDataByCalendarEventId,
);
const mockShouldUseXState = vi.mocked(shouldUseXState);

const calendarEventId = "calendar-event-123";
const email = "liaison@nyu.edu";
const bookingId = "booking-db-id";
const requestNumber = 42;

const parseJson = async (response: Response) => {
  const data = await response.json();
  return { data, status: response.status };
};

describe("POST /api/services", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockServerGetDataByCalendarEventId.mockResolvedValue({
      id: bookingId,
      requestNumber: requestNumber,
    } as any);
    mockFetch.mockResolvedValue({ ok: true });
  });

  describe("Input Validation", () => {
    it("returns 400 when calendarEventId is missing", async () => {
      const response = await POST(
        createRequest({
          calendarEventId: "",
          serviceType: "staff",
          action: "approve",
          email,
        }) as any,
      );

      await expect(parseJson(response)).resolves.toEqual({
        status: 400,
        data: {
          error:
            "Missing required fields: calendarEventId, serviceType, action, email",
        },
      });
    });

    it("returns 400 when serviceType is missing", async () => {
      const response = await POST(
        createRequest({
          calendarEventId,
          serviceType: "",
          action: "approve",
          email,
        }) as any,
      );

      await expect(parseJson(response)).resolves.toEqual({
        status: 400,
        data: {
          error:
            "Missing required fields: calendarEventId, serviceType, action, email",
        },
      });
    });

    it("returns 400 when action is missing", async () => {
      const response = await POST(
        createRequest({
          calendarEventId,
          serviceType: "staff",
          action: "",
          email,
        }) as any,
      );

      await expect(parseJson(response)).resolves.toEqual({
        status: 400,
        data: {
          error:
            "Missing required fields: calendarEventId, serviceType, action, email",
        },
      });
    });

    it("returns 400 when email is missing", async () => {
      const response = await POST(
        createRequest({
          calendarEventId,
          serviceType: "staff",
          action: "approve",
          email: "",
        }) as any,
      );

      await expect(parseJson(response)).resolves.toEqual({
        status: 400,
        data: {
          error:
            "Missing required fields: calendarEventId, serviceType, action, email",
        },
      });
    });

    it("returns 400 for invalid serviceType", async () => {
      const response = await POST(
        createRequest({
          calendarEventId,
          serviceType: "invalid-service",
          action: "approve",
          email,
        }) as any,
      );

      await expect(parseJson(response)).resolves.toEqual({
        status: 400,
        data: {
          error:
            "Invalid serviceType. Must be one of: staff, equipment, catering, cleaning, security, setup",
        },
      });
    });

    it("returns 400 for invalid action", async () => {
      const response = await POST(
        createRequest({
          calendarEventId,
          serviceType: "staff",
          action: "invalid-action",
          email,
        }) as any,
      );

      await expect(parseJson(response)).resolves.toEqual({
        status: 400,
        data: {
          error: "Invalid action. Must be 'approve', 'decline', or 'closeout'",
        },
      });
    });
  });

  describe("Valid Service Types", () => {
    const validServices = [
      "staff",
      "equipment",
      "catering",
      "cleaning",
      "security",
      "setup",
    ];

    validServices.forEach((serviceType) => {
      it(`accepts '${serviceType}' as a valid service type`, async () => {
        mockShouldUseXState.mockReturnValue(true);
        mockExecute.mockResolvedValue({
          success: true,
          newState: "Services Request",
        });

        const response = await POST(
          createRequest({
            calendarEventId,
            serviceType,
            action: "approve",
            email,
          }) as any,
        );

        const result = await parseJson(response);
        expect(result.status).toBe(200);
        expect(mockExecute).toHaveBeenCalled();
      });
    });
  });

  describe("Valid Actions", () => {
    const validActions = ["approve", "decline", "closeout"];

    validActions.forEach((action) => {
      it(`accepts '${action}' as a valid action`, async () => {
        mockShouldUseXState.mockReturnValue(true);
        mockExecute.mockResolvedValue({
          success: true,
          newState: "Services Request",
        });

        const response = await POST(
          createRequest({
            calendarEventId,
            serviceType: "staff",
            action,
            email,
          }) as any,
        );

        const result = await parseJson(response);
        expect(result.status).toBe(200);
        expect(mockExecute).toHaveBeenCalled();
      });
    });
  });

  describe("XState Integration", () => {
    it("executes XState transition for Media Commons tenant", async () => {
      mockShouldUseXState.mockReturnValue(true);
      mockExecute.mockResolvedValue({
        success: true,
        newState: "Services Request",
      });

      const response = await POST(
        createRequest(
          {
            calendarEventId,
            serviceType: "staff",
            action: "approve",
            email,
          },
          { "x-tenant": "media-commons" },
        ) as any,
      );

      expect(mockShouldUseXState).toHaveBeenCalledWith("media-commons");
      expect(mockExecute).toHaveBeenCalledWith(
        calendarEventId,
        "approveStaff",
        "media-commons",
        email,
      );

      await expect(parseJson(response)).resolves.toEqual({
        status: 200,
        data: expect.objectContaining({
          message: "staff service approved successfully",
          serviceType: "staff",
          action: "approve",
        }),
      });
    });

    it("creates correct XState event type for equipment decline", async () => {
      mockShouldUseXState.mockReturnValue(true);
      mockExecute.mockResolvedValue({
        success: true,
        newState: "Services Request",
      });

      await POST(
        createRequest({
          calendarEventId,
          serviceType: "equipment",
          action: "decline",
          email,
        }) as any,
      );

      expect(mockExecute).toHaveBeenCalledWith(
        calendarEventId,
        "declineEquipment",
        DEFAULT_TENANT,
        email,
      );
    });

    it("creates correct XState event type for catering closeout", async () => {
      mockShouldUseXState.mockReturnValue(true);
      mockExecute.mockResolvedValue({
        success: true,
        newState: "Services Request",
      });

      await POST(
        createRequest({
          calendarEventId,
          serviceType: "catering",
          action: "closeout",
          email,
        }) as any,
      );

      expect(mockExecute).toHaveBeenCalledWith(
        calendarEventId,
        "closeoutCatering",
        DEFAULT_TENANT,
        email,
      );
    });

    it("returns 500 when XState transition fails", async () => {
      mockShouldUseXState.mockReturnValue(true);
      mockExecute.mockResolvedValue({
        success: false,
        error: "Invalid state transition",
      });

      const response = await POST(
        createRequest({
          calendarEventId,
          serviceType: "staff",
          action: "approve",
          email,
        }) as any,
      );

      await expect(parseJson(response)).resolves.toEqual({
        status: 500,
        data: {
          error: "XState service approve failed: Invalid state transition",
        },
      });
    });
  });

  describe("Service Approval Flow", () => {
    it("logs service approval in history", async () => {
      mockShouldUseXState.mockReturnValue(true);
      mockExecute.mockResolvedValue({
        success: true,
        newState: "Services Request",
      });

      await POST(
        createRequest({
          calendarEventId,
          serviceType: "staff",
          action: "approve",
          email,
        }) as any,
      );

      expect(mockFetch).toHaveBeenCalledWith(
        "https://booking.test/api/booking-logs",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
          }),
          body: expect.stringContaining("Staff Service Approved"),
        }),
      );
    });

    it("triggers finalApprove when all services are approved", async () => {
      mockShouldUseXState.mockReturnValue(true);
      mockExecute.mockResolvedValue({
        success: true,
        newState: "Approved",
      });

      const response = await POST(
        createRequest({
          calendarEventId,
          serviceType: "staff",
          action: "approve",
          email,
        }) as any,
      );

      expect(mockFinalApprove).toHaveBeenCalledWith(
        calendarEventId,
        "System",
        DEFAULT_TENANT,
      );

      await expect(parseJson(response)).resolves.toEqual({
        status: 200,
        data: expect.objectContaining({
          transitionedToApproved: true,
        }),
      });
    });
  });

  describe("Service Decline Flow", () => {
    it("logs service decline in history", async () => {
      mockShouldUseXState.mockReturnValue(true);
      mockExecute.mockResolvedValue({
        success: true,
        newState: "Services Request",
      });

      await POST(
        createRequest({
          calendarEventId,
          serviceType: "equipment",
          action: "decline",
          email,
        }) as any,
      );

      expect(mockFetch).toHaveBeenCalledWith(
        "https://booking.test/api/booking-logs",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("Equipment Service Declined"),
        }),
      );
    });

    it("logs overall decline and attributes to System when service declined", async () => {
      mockShouldUseXState.mockReturnValue(true);
      mockExecute.mockResolvedValue({
        success: true,
        newState: "Declined",
      });

      const response = await POST(
        createRequest({
          calendarEventId,
          serviceType: "staff",
          action: "decline",
          email,
        }) as any,
      );

      // Should log both service decline and overall decline
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://booking.test/api/booking-logs",
        expect.objectContaining({
          body: expect.stringContaining("Service request declined"),
        }),
      );

      await expect(parseJson(response)).resolves.toEqual({
        status: 200,
        data: expect.objectContaining({
          transitionedToDeclined: true,
        }),
      });
    });
  });

  describe("Service Closeout Flow", () => {
    it("logs service closeout with CHECKED_OUT status", async () => {
      mockShouldUseXState.mockReturnValue(true);
      mockExecute.mockResolvedValue({
        success: true,
        newState: "Services Request",
      });

      await POST(
        createRequest({
          calendarEventId,
          serviceType: "cleaning",
          action: "closeout",
          email,
        }) as any,
      );

      expect(mockFetch).toHaveBeenCalledWith(
        "https://booking.test/api/booking-logs",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("Cleaning Service Closed Out"),
        }),
      );
    });

    it("handles transition to CLOSED state without duplicate logging", async () => {
      mockShouldUseXState.mockReturnValue(true);
      mockExecute.mockResolvedValue({
        success: true,
        newState: "Closed",
      });

      await POST(
        createRequest({
          calendarEventId,
          serviceType: "security",
          action: "closeout",
          email,
        }) as any,
      );

      // Should only log service closeout, not overall CLOSED
      // (CLOSED is handled by XState action)
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://booking.test/api/booking-logs",
        expect.objectContaining({
          body: expect.stringContaining("Security Service Closed Out"),
        }),
      );
    });
  });

  describe("Non-XState Tenants", () => {
    it("returns error for non-XState tenants", async () => {
      mockShouldUseXState.mockReturnValue(false);

      const response = await POST(
        createRequest(
          {
            calendarEventId,
            serviceType: "staff",
            action: "approve",
            email,
          },
          { "x-tenant": "itp" },
        ) as any,
      );

      await expect(parseJson(response)).resolves.toEqual({
        status: 400,
        data: {
          error:
            "Service-level approval is only available for Media Commons tenants",
        },
      });

      expect(mockExecute).not.toHaveBeenCalled();
    });
  });

  describe("Tenant Header Handling", () => {
    it("uses tenant from x-tenant header", async () => {
      mockShouldUseXState.mockReturnValue(true);
      mockExecute.mockResolvedValue({
        success: true,
        newState: "Services Request",
      });

      await POST(
        createRequest(
          {
            calendarEventId,
            serviceType: "staff",
            action: "approve",
            email,
          },
          { "x-tenant": "custom-tenant" },
        ) as any,
      );

      expect(mockShouldUseXState).toHaveBeenCalledWith("custom-tenant");
      expect(mockExecute).toHaveBeenCalledWith(
        calendarEventId,
        "approveStaff",
        "custom-tenant",
        email,
      );
    });

    it("falls back to default tenant when no header", async () => {
      mockShouldUseXState.mockReturnValue(true);
      mockExecute.mockResolvedValue({
        success: true,
        newState: "Services Request",
      });

      await POST(
        createRequest({
          calendarEventId,
          serviceType: "staff",
          action: "approve",
          email,
        }) as any,
      );

      expect(mockShouldUseXState).toHaveBeenCalledWith(DEFAULT_TENANT);
      expect(mockExecute).toHaveBeenCalledWith(
        calendarEventId,
        "approveStaff",
        DEFAULT_TENANT,
        email,
      );
    });
  });

  describe("Error Handling", () => {
    it("returns 500 for unexpected errors", async () => {
      mockShouldUseXState.mockReturnValue(true);
      mockExecute.mockRejectedValue(new Error("Unexpected error"));

      const response = await POST(
        createRequest({
          calendarEventId,
          serviceType: "staff",
          action: "approve",
          email,
        }) as any,
      );

      await expect(parseJson(response)).resolves.toEqual({
        status: 500,
        data: { error: "Unexpected error" },
      });
    });

    it("handles booking lookup failure gracefully", async () => {
      mockShouldUseXState.mockReturnValue(true);
      mockExecute.mockResolvedValue({
        success: true,
        newState: "Services Request",
      });
      mockServerGetDataByCalendarEventId.mockResolvedValue(null);

      const response = await POST(
        createRequest({
          calendarEventId,
          serviceType: "staff",
          action: "approve",
          email,
        }) as any,
      );

      // Should not crash when booking lookup fails
      const result = await parseJson(response);
      expect(result.status).toBe(200);
    });
  });
});
