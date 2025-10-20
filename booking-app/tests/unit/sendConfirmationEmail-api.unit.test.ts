import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock serverSendBookingDetailEmail
vi.mock("@/components/src/server/admin", () => ({
  serverSendBookingDetailEmail: vi.fn(),
}));

// Mock NextResponse and NextRequest
vi.mock("next/server", () => ({
  NextRequest: class {
    private body: any;
    private _headers: Map<string, string>;

    constructor(url: string, options?: any) {
      this.body = options?.body ? JSON.parse(options.body) : {};
      this._headers = new Map();
      if (options?.headers) {
        Object.entries(options.headers).forEach(([key, value]) => {
          this._headers.set(key.toLowerCase(), value as string);
        });
      }
    }

    async json() {
      return this.body;
    }

    headers = {
      get: (key: string) => this._headers.get(key.toLowerCase()) || null,
    };
  },
  NextResponse: {
    json: vi.fn((data: any, options?: any) => ({
      data,
      status: options?.status || 200,
    })),
  },
}));

import { POST } from "@/app/api/sendConfirmationEmail/route";
import { NextRequest, NextResponse } from "next/server";
import { serverSendBookingDetailEmail } from "@/components/src/server/admin";
import { BookingStatusLabel } from "@/components/src/types";

// Get references to the mocked functions
const mockServerSendBookingDetailEmail = vi.mocked(serverSendBookingDetailEmail);
const mockNextResponseJson = vi.mocked(NextResponse.json);

describe("sendConfirmationEmail API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST handler", () => {
    it("should send email successfully with required fields", async () => {
      const requestBody = {
        calendarEventId: "test-event-123",
        email: "test@example.com",
        headerMessage: "Test confirmation message",
        status: BookingStatusLabel.APPROVED,
      };

      const request = new NextRequest("http://localhost:3000/api/sendConfirmationEmail", {
        method: "POST",
        body: JSON.stringify(requestBody),
      });

      mockServerSendBookingDetailEmail.mockResolvedValue(undefined);

      const response = await POST(request);

      expect(mockServerSendBookingDetailEmail).toHaveBeenCalledWith({
        calendarEventId: "test-event-123",
        targetEmail: "test@example.com",
        headerMessage: "Test confirmation message",
        status: BookingStatusLabel.APPROVED,
        tenant: "mc",
      });

      expect(response.data).toEqual({ message: "Email sent successfully" });
      expect(response.status).toBe(200);
    });

    it("should use tenant from x-tenant header when provided", async () => {
      const requestBody = {
        calendarEventId: "test-event-456",
        email: "tenant@example.com",
        headerMessage: "Tenant-specific message",
        status: BookingStatusLabel.REQUESTED,
      };

      const request = new NextRequest("http://localhost:3000/api/sendConfirmationEmail", {
        method: "POST",
        headers: {
          "x-tenant": "media-commons",
        },
        body: JSON.stringify(requestBody),
      });

      mockServerSendBookingDetailEmail.mockResolvedValue(undefined);

      await POST(request);

      expect(mockServerSendBookingDetailEmail).toHaveBeenCalledWith({
        calendarEventId: "test-event-456",
        targetEmail: "tenant@example.com",
        headerMessage: "Tenant-specific message",
        status: BookingStatusLabel.REQUESTED,
        tenant: "media-commons",
      });
    });

    it("should use default tenant when x-tenant header is not provided", async () => {
      const requestBody = {
        calendarEventId: "test-event-789",
        email: "default@example.com",
        headerMessage: "Default tenant message",
        status: BookingStatusLabel.APPROVED,
      };

      const request = new NextRequest("http://localhost:3000/api/sendConfirmationEmail", {
        method: "POST",
        body: JSON.stringify(requestBody),
      });

      mockServerSendBookingDetailEmail.mockResolvedValue(undefined);

      await POST(request);

      expect(mockServerSendBookingDetailEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          tenant: "mc",
        })
      );
    });

    it("should call serverSendBookingDetailEmail without awaiting (fire-and-forget)", async () => {
      // This test documents the current behavior where serverSendBookingDetailEmail
      // is called without await, making it fire-and-forget
      const requestBody = {
        calendarEventId: "test-event-fire-forget",
        email: "fireforget@example.com",
        headerMessage: "Fire and forget message",
        status: BookingStatusLabel.APPROVED,
      };

      const request = new NextRequest("http://localhost:3000/api/sendConfirmationEmail", {
        method: "POST",
        body: JSON.stringify(requestBody),
      });

      mockServerSendBookingDetailEmail.mockResolvedValue(undefined);

      const response = await POST(request);

      // Should return success immediately without waiting for email to be sent
      expect(response.data).toEqual({ message: "Email sent successfully" });
      expect(response.status).toBe(200);
      
      // Email sending function should still be called
      expect(mockServerSendBookingDetailEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          calendarEventId: "test-event-fire-forget",
        })
      );
    });

    it("should handle different booking status types", async () => {
      const statuses = [
        BookingStatusLabel.APPROVED,
        BookingStatusLabel.REQUESTED,
        BookingStatusLabel.DECLINED,
        BookingStatusLabel.CANCELED,
        BookingStatusLabel.CHECKED_IN,
        BookingStatusLabel.CHECKED_OUT,
      ];

      for (const status of statuses) {
        vi.clearAllMocks();

        const requestBody = {
          calendarEventId: `event-${status}`,
          email: `${status}@example.com`,
          headerMessage: `Message for ${status}`,
          status: status,
        };

        const request = new NextRequest("http://localhost:3000/api/sendConfirmationEmail", {
          method: "POST",
          body: JSON.stringify(requestBody),
        });

        mockServerSendBookingDetailEmail.mockResolvedValue(undefined);

        await POST(request);

        expect(mockServerSendBookingDetailEmail).toHaveBeenCalledWith(
          expect.objectContaining({
            status: status,
          })
        );
      }
    });

    it("should pass all required parameters to serverSendBookingDetailEmail", async () => {
      const requestBody = {
        calendarEventId: "complete-test-event",
        email: "complete@example.com",
        headerMessage: "Complete test message with all parameters",
        status: BookingStatusLabel.APPROVED,
      };

      const request = new NextRequest("http://localhost:3000/api/sendConfirmationEmail", {
        method: "POST",
        headers: {
          "x-tenant": "test-tenant",
        },
        body: JSON.stringify(requestBody),
      });

      mockServerSendBookingDetailEmail.mockResolvedValue(undefined);

      await POST(request);

      // Verify all expected parameters are passed
      const callArgs = mockServerSendBookingDetailEmail.mock.calls[0][0];
      expect(callArgs).toHaveProperty("calendarEventId");
      expect(callArgs).toHaveProperty("targetEmail");
      expect(callArgs).toHaveProperty("headerMessage");
      expect(callArgs).toHaveProperty("status");
      expect(callArgs).toHaveProperty("tenant");
      
      expect(callArgs.calendarEventId).toBe("complete-test-event");
      expect(callArgs.targetEmail).toBe("complete@example.com");
      expect(callArgs.headerMessage).toBe("Complete test message with all parameters");
      expect(callArgs.status).toBe(BookingStatusLabel.APPROVED);
      expect(callArgs.tenant).toBe("test-tenant");
    });

    it("should handle empty header message", async () => {
      const requestBody = {
        calendarEventId: "empty-header-event",
        email: "empty@example.com",
        headerMessage: "",
        status: BookingStatusLabel.REQUESTED,
      };

      const request = new NextRequest("http://localhost:3000/api/sendConfirmationEmail", {
        method: "POST",
        body: JSON.stringify(requestBody),
      });

      mockServerSendBookingDetailEmail.mockResolvedValue(undefined);

      const response = await POST(request);

      expect(mockServerSendBookingDetailEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          headerMessage: "",
        })
      );
      expect(response.status).toBe(200);
    });
  });
});
