import { beforeEach, describe, expect, it, vi } from "vitest";
import { createActor } from "xstate";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock environment variables
process.env.NEXT_PUBLIC_BASE_URL = "http://localhost:3000";
process.env.NEXT_PUBLIC_BRANCH_NAME = "test";

// Mock Firebase functions
const mockLogServerBookingChange = vi.fn();
const mockServerGetDataByCalendarEventId = vi.fn();

vi.mock("@/lib/firebase/server/adminDb", () => ({
  logServerBookingChange: mockLogServerBookingChange,
  serverGetDataByCalendarEventId: mockServerGetDataByCalendarEventId,
}));

describe("XState Approval Real Integration Tests", () => {
  const testCalendarEventId = "test-calendar-event-123";
  const testEmail = "test@nyu.edu";
  const testTenant = "mc";

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup fetch mock
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
      text: () => Promise.resolve("OK"),
    });

    // Setup Firebase mocks
    mockServerGetDataByCalendarEventId.mockResolvedValue({
      id: "booking-123",
      requestNumber: 12345,
      email: testEmail,
      title: "Test Booking",
      role: "Student",
      sponsorEmail: "sponsor@nyu.edu",
      roomId: "224",
    });
    mockLogServerBookingChange.mockResolvedValue(undefined);
  });

  describe("1. XState Machine Transitions", () => {
    it("should auto-approve when conditions are met", async () => {
      const { mcBookingMachine } = await import(
        "@/lib/stateMachines/mcBookingMachine"
      );

      // Context for auto-approval
      const context = {
        tenant: testTenant,
        selectedRooms: [{ roomId: "224", shouldAutoApprove: true }],
        servicesRequested: {}, // No services = auto-approve
        email: testEmail,
        calendarEventId: testCalendarEventId,
        isWalkIn: false,
        isVip: false,
      };

      const actor = createActor(mcBookingMachine, { input: context });
      actor.start();

      // Should auto-approve to Approved state
      expect(actor.getSnapshot().value).toBe("Approved");
      expect(actor.getSnapshot().context.tenant).toBe(testTenant);
      expect(actor.getSnapshot().context.email).toBe(testEmail);
    });

    it("should require manual approval when auto-approval conditions are not met", async () => {
      const { mcBookingMachine } = await import(
        "@/lib/stateMachines/mcBookingMachine"
      );

      // Context that prevents auto-approval
      const context = {
        tenant: testTenant,
        selectedRooms: [{ roomId: "224", shouldAutoApprove: false }],
        servicesRequested: {},
        email: testEmail,
        calendarEventId: testCalendarEventId,
        isWalkIn: false,
        isVip: false,
        _restoredFromStatus: true, // Prevents auto-approval
      };

      const actor = createActor(mcBookingMachine, { input: context });
      actor.start();

      // Should start in Requested state
      expect(actor.getSnapshot().value).toBe("Requested");

      // Manual approve should go to Pre-approved
      actor.send({ type: "approve" });
      expect(actor.getSnapshot().value).toBe("Pre-approved");

      // Second approve should go to Approved
      actor.send({ type: "approve" });
      expect(actor.getSnapshot().value).toBe("Approved");
    });

    it("should handle VIP booking with services", async () => {
      const { mcBookingMachine } = await import(
        "@/lib/stateMachines/mcBookingMachine"
      );

      // VIP booking with services
      const context = {
        tenant: testTenant,
        selectedRooms: [{ roomId: "224", shouldAutoApprove: true }],
        servicesRequested: {
          cleaning: true,
          setup: true,
        },
        email: testEmail,
        calendarEventId: testCalendarEventId,
        isWalkIn: false,
        isVip: true,
      };

      const actor = createActor(mcBookingMachine, { input: context });
      actor.start();

      // Should go to Services Request state
      const snapshot = actor.getSnapshot();
      expect(snapshot.value).toEqual(
        expect.objectContaining({
          "Services Request": expect.any(Object),
        })
      );

      // Approve services
      actor.send({ type: "approveCleaning" });
      actor.send({ type: "approveSetup" });

      // Check that services are approved in context
      const finalSnapshot = actor.getSnapshot();
      expect(finalSnapshot.context.servicesApproved?.cleaning).toBe(true);
      expect(finalSnapshot.context.servicesApproved?.setup).toBe(true);
    });
  });

  describe("2. Email Sending Verification", () => {
    it("should call correct email APIs when serverApproveEvent is executed", async () => {
      // Create a spy on fetch to monitor email API calls
      const fetchSpy = vi.spyOn(global, "fetch");

      // Mock serverBookingContents to return test data
      const mockBookingContents = vi.fn().mockResolvedValue({
        email: testEmail,
        title: "Test Booking",
        role: "Student",
        sponsorEmail: "sponsor@nyu.edu",
        roomId: "224",
      });

      // Mock other dependencies
      const mockGetFinalApproverEmail = vi
        .fn()
        .mockResolvedValue("finalapprover@nyu.edu");
      const mockGetApprovalCcEmail = vi
        .fn()
        .mockReturnValue("samantha@nyu.edu");

      // Temporarily mock the admin module
      vi.doMock("@/components/src/server/admin", async () => {
        const actual = await vi.importActual("@/components/src/server/admin");
        return {
          ...actual,
          serverBookingContents: mockBookingContents,
          serverGetFinalApproverEmail: mockGetFinalApproverEmail,
          getApprovalCcEmail: mockGetApprovalCcEmail,
        };
      });

      // Re-import to get mocked version
      vi.resetModules();
      const { serverApproveEvent } = await import(
        "@/components/src/server/admin"
      );

      // Execute the function
      await serverApproveEvent(testCalendarEventId, testTenant);

      // Verify booking contents was called
      expect(mockBookingContents).toHaveBeenCalledWith(
        testCalendarEventId,
        testTenant
      );

      // Verify email API was called (serverSendBookingDetailEmail calls /api/sendEmail)
      expect(fetchSpy).toHaveBeenCalledWith(
        "http://localhost:3000/api/sendEmail",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: expect.stringContaining(testEmail),
        })
      );

      // Verify calendar update API was called
      expect(fetchSpy).toHaveBeenCalledWith(
        "http://localhost:3000/api/calendarEvents",
        expect.objectContaining({
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "x-tenant": testTenant,
          },
          body: expect.stringContaining("APPROVED"),
        })
      );

      // Verify user invitation API was called
      expect(fetchSpy).toHaveBeenCalledWith(
        "http://localhost:3000/api/inviteUser",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: expect.stringContaining(testEmail),
        })
      );
    });
  });

  describe("3. Calendar Update Verification", () => {
    it("should update calendar with APPROVED status", async () => {
      const fetchSpy = vi.spyOn(global, "fetch");

      // Mock dependencies
      vi.doMock("@/components/src/server/admin", async () => {
        const actual = await vi.importActual("@/components/src/server/admin");
        return {
          ...actual,
          serverBookingContents: vi.fn().mockResolvedValue({
            email: testEmail,
            roomId: "224",
          }),
        };
      });

      vi.resetModules();
      const { serverApproveEvent } = await import(
        "@/components/src/server/admin"
      );

      await serverApproveEvent(testCalendarEventId, testTenant);

      // Verify calendar event update with APPROVED status
      expect(fetchSpy).toHaveBeenCalledWith(
        "http://localhost:3000/api/calendarEvents",
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "x-tenant": testTenant,
          },
          body: JSON.stringify({
            calendarEventId: testCalendarEventId,
            newValues: { statusPrefix: "APPROVED" },
          }),
        }
      );
    });
  });

  describe("4. BookingLog Verification", () => {
    it("should write APPROVED status to BookingLog", async () => {
      // Mock dependencies
      vi.doMock("@/components/src/server/admin", async () => {
        const actual = await vi.importActual("@/components/src/server/admin");
        return {
          ...actual,
          serverFinalApprove: vi.fn().mockResolvedValue(undefined),
          serverApproveEvent: vi.fn().mockResolvedValue(undefined),
        };
      });

      vi.resetModules();
      const { finalApprove } = await import("@/components/src/server/admin");

      // Execute finalApprove
      await finalApprove(testCalendarEventId, testEmail, testTenant);

      // Verify booking data was retrieved
      expect(mockServerGetDataByCalendarEventId).toHaveBeenCalledWith(
        "bookings",
        testCalendarEventId,
        testTenant
      );

      // Verify BookingLog was written with APPROVED status
      expect(mockLogServerBookingChange).toHaveBeenCalledWith({
        bookingId: "booking-123",
        status: "APPROVED",
        changedBy: testEmail,
        requestNumber: 12345,
        calendarEventId: testCalendarEventId,
        note: "",
        tenant: testTenant,
      });
    });

    it("should handle missing booking data gracefully", async () => {
      // Mock missing booking data
      mockServerGetDataByCalendarEventId.mockResolvedValue(null);

      vi.doMock("@/components/src/server/admin", async () => {
        const actual = await vi.importActual("@/components/src/server/admin");
        return {
          ...actual,
          serverFinalApprove: vi.fn().mockResolvedValue(undefined),
          serverApproveEvent: vi.fn().mockResolvedValue(undefined),
        };
      });

      vi.resetModules();
      const { finalApprove } = await import("@/components/src/server/admin");

      await finalApprove(testCalendarEventId, testEmail, testTenant);

      // Should not write to BookingLog when booking data is missing
      expect(mockLogServerBookingChange).not.toHaveBeenCalled();
    });
  });

  describe("5. Integration: XState Actions Trigger Real Side Effects", () => {
    it("should verify XState logBookingHistory action calls real function", async () => {
      const { mcBookingMachine } = await import(
        "@/lib/stateMachines/mcBookingMachine"
      );

      // Create context that will trigger logBookingHistory action
      const context = {
        tenant: testTenant,
        selectedRooms: [{ roomId: "224", shouldAutoApprove: true }],
        servicesRequested: {},
        email: testEmail,
        calendarEventId: testCalendarEventId,
        isWalkIn: false,
        isVip: false,
      };

      const actor = createActor(mcBookingMachine, { input: context });
      actor.start();

      // The machine should auto-approve and trigger logBookingHistory action
      expect(actor.getSnapshot().value).toBe("Approved");

      // Wait a bit for async actions to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify that the logBookingHistory action was triggered
      // (This is called from within the XState machine's entry action)
      expect(mockLogServerBookingChange).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "APPROVED",
          note: "Booking approved automatically",
          changedBy: "system",
        })
      );
    });
  });
});
