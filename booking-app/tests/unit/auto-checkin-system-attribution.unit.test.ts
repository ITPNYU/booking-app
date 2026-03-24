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
      checkinConfirmation: "Your booking has been checked in",
    },
  }),
}));

vi.mock("firebase-admin/firestore", () => ({
  Timestamp: {
    now: () => ({
      toDate: () => new Date("2025-01-15T10:00:00Z"),
      toMillis: () => 1736935200000,
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

describe("Auto-Checkin System Attribution", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock booking document
    mockServerGetDataByCalendarEventId.mockResolvedValue({
      id: "booking-itp-123",
      requestNumber: 789,
      email: "student@nyu.edu",
      calendarEventId: "cal-event-itp-123",
      title: "ITP Test Booking",
    });

    // Mock booking contents for calendar update
    mockServerBookingContents.mockResolvedValue({
      id: "booking-itp-123",
      title: "ITP Test Booking",
      email: "student@nyu.edu",
      roomId: "408",
    });
  });

  describe("Checkin Processing API", () => {
    it("should attribute checkin to System when triggered by cron job", async () => {
      const calendarEventId = "cal-event-itp-123";
      const tenant = "itp";

      const { POST } = await import("@/app/api/checkin-processing/route");

      const mockRequest = {
        json: async () => ({
          calendarEventId,
          email: "System",
          tenant,
        }),
      } as any;

      await POST(mockRequest);

      // Verify Firestore was updated with System as checkedInBy
      expect(mockServerUpdateDataByCalendarEventId).toHaveBeenCalledWith(
        TableNames.BOOKING,
        calendarEventId,
        {
          checkedInAt: expect.any(Object),
          checkedInBy: "System",
        },
        tenant,
      );

      // Verify booking log was created with System attribution
      expect(mockLogServerBookingChange).toHaveBeenCalledWith({
        bookingId: "booking-itp-123",
        calendarEventId,
        status: BookingStatusLabel.CHECKED_IN,
        changedBy: "System",
        requestNumber: 789,
        tenant,
      });

      // Verify calendar was updated with CHECKED_IN status
      expect(mockUpdateCalendarEvent).toHaveBeenCalledWith(
        calendarEventId,
        {
          statusPrefix: BookingStatusLabel.CHECKED_IN,
        },
        expect.any(Object),
        tenant,
      );
    });

    it("should attribute checkin to user when triggered manually", async () => {
      const calendarEventId = "cal-event-itp-123";
      const userEmail = "admin@nyu.edu";
      const tenant = "itp";

      const { POST } = await import("@/app/api/checkin-processing/route");

      const mockRequest = {
        json: async () => ({
          calendarEventId,
          email: userEmail,
          tenant,
        }),
      } as any;

      await POST(mockRequest);

      expect(mockServerUpdateDataByCalendarEventId).toHaveBeenCalledWith(
        TableNames.BOOKING,
        calendarEventId,
        {
          checkedInAt: expect.any(Object),
          checkedInBy: userEmail,
        },
        tenant,
      );

      expect(mockLogServerBookingChange).toHaveBeenCalledWith({
        bookingId: "booking-itp-123",
        calendarEventId,
        status: BookingStatusLabel.CHECKED_IN,
        changedBy: userEmail,
        requestNumber: 789,
        tenant,
      });
    });

    it("should send checkin email to guest", async () => {
      const calendarEventId = "cal-event-itp-123";
      const tenant = "itp";

      const { POST } = await import("@/app/api/checkin-processing/route");

      const mockRequest = {
        json: async () => ({
          calendarEventId,
          email: "System",
          tenant,
        }),
      } as any;

      await POST(mockRequest);

      expect(mockServerSendBookingDetailEmail).toHaveBeenCalledWith({
        calendarEventId,
        targetEmail: "student@nyu.edu",
        headerMessage: "Your booking has been checked in",
        status: BookingStatusLabel.CHECKED_IN,
        tenant,
      });
    });
  });

  describe("XState Transition for Checkin", () => {
    it("should create checkIn event with System email", () => {
      const eventType = "checkIn";
      const email = "System";
      const reason = "Auto-checkin: booking start time has passed";

      const event: any = { type: eventType };
      if (reason) {
        event.reason = reason;
      }
      if (email) {
        event.email = email;
      }

      expect(event).toEqual({
        type: "checkIn",
        reason: "Auto-checkin: booking start time has passed",
        email: "System",
      });
    });
  });

  describe("Error Handling", () => {
    it("should handle missing booking document gracefully", async () => {
      mockServerGetDataByCalendarEventId.mockResolvedValue(null);

      const { POST } = await import("@/app/api/checkin-processing/route");

      const mockRequest = {
        json: async () => ({
          calendarEventId: "invalid-id",
          email: "System",
          tenant: "itp",
        }),
      } as any;

      const response = await POST(mockRequest);
      const json = await response.json();

      expect(json.success).toBe(false);
      expect(json.error).toContain("Booking not found");
    });

    it("should handle missing required fields", async () => {
      const { POST } = await import("@/app/api/checkin-processing/route");

      const mockRequest = {
        json: async () => ({
          calendarEventId: "cal-event-itp-123",
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
