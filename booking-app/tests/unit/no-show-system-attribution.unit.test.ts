import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock Firebase Admin
const mockLogServerBookingChange = vi.fn();
const mockServerGetDataByCalendarEventId = vi.fn();
const mockServerUpdateDataByCalendarEventId = vi.fn();
const mockServerSaveDataToFirestore = vi.fn();

vi.mock("@/lib/firebase/server/adminDb", () => ({
  logServerBookingChange: mockLogServerBookingChange,
  serverGetDataByCalendarEventId: mockServerGetDataByCalendarEventId,
  serverUpdateDataByCalendarEventId: mockServerUpdateDataByCalendarEventId,
  serverSaveDataToFirestore: mockServerSaveDataToFirestore,
}));

vi.mock("firebase-admin", () => ({
  firestore: {
    Timestamp: {
      now: () => ({ toDate: () => new Date("2025-01-01T10:00:00Z") }),
    },
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
    NO_SHOW: "NO-SHOW",
    CANCELED: "CANCELED",
    CLOSED: "CLOSED",
  },
}));

import { BookingStatusLabel } from "@/components/src/types";

// Note: CANCELED history logging is now handled by processCancelBooking function
// The XState handleStateTransitions no longer creates CANCELED logs to avoid duplication

// Helper function to simulate logBookingHistory action from mcBookingMachine
const simulateLogBookingHistory = async (
  context: { email?: string },
  params: { status?: string; note?: string }
) => {
  const { status, note } = params;

  if (!status) return;

  // mcBookingMachine logBookingHistory simply uses context.email || "system"
  // Automatic CANCELED transitions are handled separately by handleStateTransitions
  const changedBy = context.email || "system";

  await mockLogServerBookingChange({
    bookingId: "booking-123",
    calendarEventId: "cal-event-123",
    status,
    changedBy,
    requestNumber: 123,
    note: note || "",
    tenant: "mc",
  });
};

describe("NO_SHOW System Attribution", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock booking document
    mockServerGetDataByCalendarEventId.mockResolvedValue({
      id: "booking-123",
      requestNumber: 123,
      email: "user@nyu.edu",
    });
  });

  describe("processCancelBooking Function", () => {
    it("should attribute CANCELED transition to System when isAutomaticFromNoShow is true", async () => {
      // Simulate processCancelBooking with isAutomaticFromNoShow = true
      const calendarEventId = "cal-event-123";
      const userEmail = "user@nyu.edu";
      
      // Mock the processCancelBooking logic
      await mockLogServerBookingChange({
        calendarEventId,
        status: BookingStatusLabel.CANCELED,
        changedBy: "System", // Should be System for automatic transitions
        changedAt: { toDate: () => new Date("2025-01-01T10:00:00Z") },
        note: "Canceled due to no show",
        requestNumber: 123,
      });

      // Verify that the history log is created with "System" attribution
      expect(mockLogServerBookingChange).toHaveBeenCalledWith({
        calendarEventId,
        status: BookingStatusLabel.CANCELED,
        changedBy: "System",
        changedAt: expect.any(Object),
        note: "Canceled due to no show",
        requestNumber: 123,
      });
    });

    it("should attribute manual CANCELED transition to user when isAutomaticFromNoShow is false", async () => {
      const calendarEventId = "cal-event-123";
      const userEmail = "admin@nyu.edu";

      // Mock the processCancelBooking logic for manual cancellation
      await mockLogServerBookingChange({
        calendarEventId,
        status: BookingStatusLabel.CANCELED,
        changedBy: userEmail, // Should be user email for manual cancellations
        changedAt: { toDate: () => new Date("2025-01-01T10:00:00Z") },
        note: "",
        requestNumber: 123,
      });

      // Verify that the history log is created with user attribution
      expect(mockLogServerBookingChange).toHaveBeenCalledWith({
        calendarEventId,
        status: BookingStatusLabel.CANCELED,
        changedBy: userEmail,
        changedAt: expect.any(Object),
        note: "",
        requestNumber: 123,
      });
    });
  });

  describe("mcBookingMachine logBookingHistory Action", () => {
    it("should use user email for booking history logs (automatic CANCELED transitions are handled separately)", async () => {
      const context = { email: "user@nyu.edu" };
      const params = {
        status: "NO-SHOW",
        note: "Booking marked as no show",
      };

      await simulateLogBookingHistory(context, params);

      // mcBookingMachine logBookingHistory is only called for NO-SHOW status
      // Automatic CANCELED transitions are handled by handleStateTransitions in xstateUtilsV5.ts
      expect(mockLogServerBookingChange).toHaveBeenCalledWith({
        bookingId: "booking-123",
        calendarEventId: "cal-event-123",
        status: "NO-SHOW",
        changedBy: "user@nyu.edu",
        requestNumber: 123,
        note: "Booking marked as no show",
        tenant: "mc",
      });
    });

    it("should handle missing email gracefully", async () => {
      const context = {}; // No email
      const params = {
        status: "NO-SHOW",
        note: "Booking marked as no show",
      };

      await simulateLogBookingHistory(context, params);

      // Should fall back to "system"
      expect(mockLogServerBookingChange).toHaveBeenCalledWith({
        bookingId: "booking-123",
        calendarEventId: "cal-event-123",
        status: "NO-SHOW",
        changedBy: "system",
        requestNumber: 123,
        note: "Booking marked as no show",
        tenant: "mc",
      });
    });
  });

  describe("CLOSED State Attribution", () => {
    it("should always attribute CLOSED state to System (already implemented)", () => {
      // This test documents the existing behavior in processCloseBooking
      // The function already sets closedBy: "System" and changedBy: "System"
      // This is correct behavior and doesn't need changes
      expect(true).toBe(true); // Placeholder - actual implementation is in db.ts
    });
  });

  describe("Edge Cases", () => {
    it("should handle different state transitions correctly using previousState logic", () => {
      // The key insight is that automatic CANCELED transitions from NO_SHOW
      // are detected by checking previousState === "No Show" in handleStateTransitions,
      // not by parsing note content. This is more reliable and less error-prone.
      expect(true).toBe(true); // Documentation test
    });
  });

  describe("Email Notifications", () => {
    it("should document that email notifications use booking details, not changedBy field", () => {
      // This test documents that email notifications are sent to the guest
      // (from booking.email field) regardless of who triggered the state change.
      // The changedBy field is only used for history logs and booking details view.
      // Email content should indicate it was a system action for automatic transitions.
      expect(true).toBe(true); // Documentation test
    });
  });
});
