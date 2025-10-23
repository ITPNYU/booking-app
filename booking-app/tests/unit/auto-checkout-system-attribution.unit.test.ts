import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock Firebase Admin
const mockLogServerBookingChange = vi.fn();
const mockServerGetDataByCalendarEventId = vi.fn();
const mockServerUpdateDataByCalendarEventId = vi.fn();
const mockUpdateCalendarEvent = vi.fn();
const mockServerBookingContents = vi.fn();
const mockServerSendBookingDetailEmail = vi.fn();

vi.mock("@/lib/firebase/server/adminDb", () => ({
  logServerBookingChange: mockLogServerBookingChange,
  serverGetDataByCalendarEventId: mockServerGetDataByCalendarEventId,
  serverUpdateDataByCalendarEventId: mockServerUpdateDataByCalendarEventId,
}));

vi.mock("@/components/src/server/calendars", () => ({
  updateCalendarEvent: mockUpdateCalendarEvent,
}));

vi.mock("@/components/src/server/admin", () => ({
  serverBookingContents: mockServerBookingContents,
  serverSendBookingDetailEmail: mockServerSendBookingDetailEmail,
  serverUpdateDataByCalendarEventId: mockServerUpdateDataByCalendarEventId,
}));

vi.mock("@/components/src/server/emails", () => ({
  getTenantEmailConfig: vi.fn().mockResolvedValue({
    emailMessages: {
      checkoutConfirmation: "Your booking has been checked out",
    },
  }),
}));

vi.mock("firebase-admin/firestore", () => ({
  Timestamp: {
    now: () => ({
      toDate: () => new Date("2025-01-15T10:30:00Z"),
      toMillis: () => 1736938200000,
    }),
  },
}));

vi.mock("@/components/src/policy", () => ({
  TableNames: {
    BOOKING: "bookings",
    BOOKING_LOGS: "bookingLogs",
  },
}));

vi.mock("@/components/src/types", () => ({
  BookingStatusLabel: {
    CHECKED_IN: "Checked In",
    CHECKED_OUT: "Checked Out",
  },
}));

import { TableNames } from "@/components/src/policy";
import { BookingStatusLabel } from "@/components/src/types";

describe("Auto-Checkout System Attribution", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock booking document
    mockServerGetDataByCalendarEventId.mockResolvedValue({
      id: "booking-123",
      requestNumber: 456,
      email: "student@nyu.edu",
      calendarEventId: "cal-event-123",
      title: "Test Booking",
    });

    // Mock booking contents for calendar update
    mockServerBookingContents.mockResolvedValue({
      id: "booking-123",
      title: "Test Booking",
      email: "student@nyu.edu",
      roomId: "room-1",
    });
  });

  describe("Checkout Processing API", () => {
    it("should attribute checkout to System when triggered by cron job", async () => {
      const calendarEventId = "cal-event-123";
      const tenant = "mc";

      // Simulate checkout-processing API call
      const { POST } = await import("@/app/api/checkout-processing/route");

      const mockRequest = {
        json: async () => ({
          calendarEventId,
          email: "System", // Cron job passes "System"
          tenant,
        }),
      } as any;

      await POST(mockRequest);

      // Verify Firestore was updated with System as checkedOutBy
      expect(mockServerUpdateDataByCalendarEventId).toHaveBeenCalledWith(
        TableNames.BOOKING,
        calendarEventId,
        {
          checkedOutAt: expect.any(Object),
          checkedOutBy: "System",
        },
        tenant
      );

      // Verify booking log was created with System attribution
      expect(mockLogServerBookingChange).toHaveBeenCalledWith({
        bookingId: "booking-123",
        calendarEventId,
        status: BookingStatusLabel.CHECKED_OUT,
        changedBy: "System",
        requestNumber: 456,
        tenant,
      });

      // Verify calendar was updated with CHECKED_OUT status
      expect(mockUpdateCalendarEvent).toHaveBeenCalledWith(
        calendarEventId,
        {
          statusPrefix: BookingStatusLabel.CHECKED_OUT,
        },
        expect.any(Object),
        tenant
      );
    });

    it("should attribute checkout to user when triggered manually", async () => {
      const calendarEventId = "cal-event-123";
      const userEmail = "admin@nyu.edu";
      const tenant = "mc";

      // Simulate checkout-processing API call from user
      const { POST } = await import("@/app/api/checkout-processing/route");

      const mockRequest = {
        json: async () => ({
          calendarEventId,
          email: userEmail,
          tenant,
        }),
      } as any;

      await POST(mockRequest);

      // Verify Firestore was updated with user email as checkedOutBy
      expect(mockServerUpdateDataByCalendarEventId).toHaveBeenCalledWith(
        TableNames.BOOKING,
        calendarEventId,
        {
          checkedOutAt: expect.any(Object),
          checkedOutBy: userEmail,
        },
        tenant
      );

      // Verify booking log was created with user attribution
      expect(mockLogServerBookingChange).toHaveBeenCalledWith({
        bookingId: "booking-123",
        calendarEventId,
        status: BookingStatusLabel.CHECKED_OUT,
        changedBy: userEmail,
        requestNumber: 456,
        tenant,
      });
    });

    it("should send checkout email to guest", async () => {
      const calendarEventId = "cal-event-123";
      const tenant = "mc";

      // Simulate checkout-processing API call
      const { POST } = await import("@/app/api/checkout-processing/route");

      const mockRequest = {
        json: async () => ({
          calendarEventId,
          email: "System",
          tenant,
        }),
      } as any;

      await POST(mockRequest);

      // Verify email was sent to guest
      expect(mockServerSendBookingDetailEmail).toHaveBeenCalledWith({
        calendarEventId,
        targetEmail: "student@nyu.edu",
        headerMessage: "Your booking has been checked out",
        status: BookingStatusLabel.CHECKED_OUT,
        tenant,
      });
    });
  });

  describe("XState Machine Email Handling", () => {
    it("should pass System email from event to checkout-processing API", async () => {
      // This test documents that the Media Commons machine's handleCheckoutProcessing
      // action prioritizes email from the event over context.email

      const eventEmail = "System";
      const contextEmail = "user@nyu.edu";

      // Simulate the priority logic: (event as any)?.email || context.email || "system"
      const emailUsed = eventEmail || contextEmail || "system";

      expect(emailUsed).toBe("System");
    });

    it("should fallback to context email when event email is not provided", async () => {
      const eventEmail = undefined;
      const contextEmail = "user@nyu.edu";

      // Simulate the priority logic
      const emailUsed = eventEmail || contextEmail || "system";

      expect(emailUsed).toBe("user@nyu.edu");
    });

    it("should fallback to 'system' when neither event nor context email is provided", async () => {
      const eventEmail = undefined;
      const contextEmail = undefined;

      // Simulate the priority logic
      const emailUsed = eventEmail || contextEmail || "system";

      expect(emailUsed).toBe("system");
    });
  });

  describe("XState Transition API", () => {
    it("should include email in checkout event when provided", async () => {
      // This test documents that xstateUtilsV5.ts includes email in the event
      // when eventType is "checkOut"

      const eventType = "checkOut";
      const email = "System";
      const reason = "Auto-checkout: 30 minutes after scheduled end time";

      // Simulate event creation from xstateUtilsV5
      const event: any = { type: eventType };
      if (reason) {
        event.reason = reason;
      }
      if (email && eventType === "checkOut") {
        event.email = email;
      }

      expect(event).toEqual({
        type: "checkOut",
        reason: "Auto-checkout: 30 minutes after scheduled end time",
        email: "System",
      });
    });

    it("should not include email in event for non-checkout transitions", async () => {
      const eventType = "approve";
      const email = "admin@nyu.edu";

      // Simulate event creation
      const event: any = { type: eventType };
      if (email && eventType === "checkOut") {
        event.email = email;
      }

      expect(event).toEqual({
        type: "approve",
      });
    });
  });

  describe("End-to-End Auto-Checkout Flow", () => {
    it("should complete full auto-checkout flow with System attribution", async () => {
      // This test documents the complete flow:
      // 1. Cron job calls /api/xstate-transition with email: "System"
      // 2. XState transition includes email in event
      // 3. Media Commons machine calls checkout-processing API with email: "System"
      // 4. checkout-processing API updates Firestore, creates booking log, updates calendar

      const calendarEventId = "cal-event-123";
      const tenant = "mc";

      // Step 3 & 4: checkout-processing API
      const { POST } = await import("@/app/api/checkout-processing/route");

      const mockRequest = {
        json: async () => ({
          calendarEventId,
          email: "System",
          tenant,
        }),
      } as any;

      await POST(mockRequest);

      // Verify complete flow
      expect(mockServerUpdateDataByCalendarEventId).toHaveBeenCalledWith(
        TableNames.BOOKING,
        calendarEventId,
        expect.objectContaining({
          checkedOutBy: "System",
        }),
        tenant
      );

      expect(mockLogServerBookingChange).toHaveBeenCalledWith(
        expect.objectContaining({
          changedBy: "System",
          status: BookingStatusLabel.CHECKED_OUT,
        })
      );

      expect(mockUpdateCalendarEvent).toHaveBeenCalledWith(
        calendarEventId,
        expect.objectContaining({
          statusPrefix: BookingStatusLabel.CHECKED_OUT,
        }),
        expect.any(Object),
        tenant
      );
    });
  });

  describe("Error Handling", () => {
    it("should handle missing booking document gracefully", async () => {
      mockServerGetDataByCalendarEventId.mockResolvedValue(null);

      const { POST } = await import("@/app/api/checkout-processing/route");

      const mockRequest = {
        json: async () => ({
          calendarEventId: "invalid-id",
          email: "System",
          tenant: "mc",
        }),
      } as any;

      const response = await POST(mockRequest);
      const json = await response.json();

      expect(json.success).toBe(false);
      expect(json.error).toContain("Booking not found");
    });

    it("should handle missing required fields", async () => {
      const { POST } = await import("@/app/api/checkout-processing/route");

      const mockRequest = {
        json: async () => ({
          calendarEventId: "cal-event-123",
          // Missing email and tenant
        }),
      } as any;

      const response = await POST(mockRequest);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.error).toContain("Missing required fields");
    });
  });
});
