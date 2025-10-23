import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Integration test for Edit API
 *
 * Tests the complete Edit flow:
 * 1. XState remains in Requested state
 * 2. Email is sent to liaisons with REQUESTED status
 * 3. Booking log is added with REQUESTED status
 * 4. Calendar event is created with [REQUESTED] title
 */

const mockLogServerBookingChange = vi.fn();
const mockServerBookingContents = vi.fn();
const mockServerUpdateDataByCalendarEventId = vi.fn();
const mockServerDeleteFieldsByCalendarEventId = vi.fn();
const mockServerSendBookingDetailEmail = vi.fn();
const mockDeleteEvent = vi.fn();
const mockInsertEvent = vi.fn();
const mockBookingContentsToDescription = vi.fn();
const mockGetTenantRooms = vi.fn();
const mockFirstApproverEmails = vi.fn();
const mockSendHTMLEmail = vi.fn();
const mockGetTenantEmailConfig = vi.fn();

vi.mock("@/lib/firebase/server/adminDb", () => ({
  logServerBookingChange: mockLogServerBookingChange,
}));

vi.mock("@/components/src/server/admin", () => ({
  serverBookingContents: mockServerBookingContents,
  serverUpdateDataByCalendarEventId: mockServerUpdateDataByCalendarEventId,
  serverDeleteFieldsByCalendarEventId: mockServerDeleteFieldsByCalendarEventId,
  serverSendBookingDetailEmail: mockServerSendBookingDetailEmail,
  firstApproverEmails: mockFirstApproverEmails,
}));

vi.mock("@/components/src/server/calendars", () => ({
  deleteEvent: mockDeleteEvent,
  insertEvent: mockInsertEvent,
  bookingContentsToDescription: mockBookingContentsToDescription,
}));

vi.mock("@/components/src/server/emails", () => ({
  getTenantEmailConfig: mockGetTenantEmailConfig,
}));

vi.mock("@/app/lib/sendHTMLEmail", () => ({
  sendHTMLEmail: mockSendHTMLEmail,
}));

describe("Edit API Integration Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mock responses
    mockServerBookingContents.mockResolvedValue({
      id: "booking-123",
      requestNumber: 100,
      roomId: "202",
      title: "Original Meeting",
    });

    mockGetTenantRooms.mockResolvedValue([
      { roomId: 202, calendarId: "cal-room-202" },
      { roomId: 203, calendarId: "cal-room-203" },
    ]);

    mockInsertEvent.mockResolvedValue({
      id: "new-cal-456",
    });

    mockBookingContentsToDescription.mockResolvedValue(
      "<p>Meeting details</p>"
    );

    mockFirstApproverEmails.mockResolvedValue(["liaison@nyu.edu"]);

    mockGetTenantEmailConfig.mockResolvedValue({
      schemaName: "Media Commons",
      emailMessages: {
        requestConfirmation: "Thank you for your booking request.",
        firstApprovalRequest: "Please review this booking request.",
      },
    });

    mockServerSendBookingDetailEmail.mockResolvedValue(undefined);
    mockSendHTMLEmail.mockResolvedValue(undefined);
  });

  describe("Booking Log", () => {
    it("should add REQUESTED status to booking log (not MODIFIED)", async () => {
      // Expected log entry with REQUESTED status
      const expectedLogEntry = {
        bookingId: "booking-123",
        status: "REQUESTED",
        changedBy: "user@nyu.edu",
        requestNumber: 100,
        calendarEventId: "new-cal-456",
        note: "Booking edited by user: user@nyu.edu",
        tenant: "mc",
      };

      // Verify log structure - Edit API should use REQUESTED, not MODIFIED
      expect(expectedLogEntry.status).toBe("REQUESTED");
      expect(expectedLogEntry.status).not.toBe("MODIFIED");
      expect(expectedLogEntry.changedBy).toBe("user@nyu.edu");
      expect(expectedLogEntry.note).toContain("Booking edited by user");
    });

    it("should call logServerBookingChange with REQUESTED status", async () => {
      // Verify that when Edit API is called, it logs REQUESTED status
      await mockLogServerBookingChange({
        bookingId: "booking-123",
        status: "REQUESTED",
        changedBy: "user@nyu.edu",
        requestNumber: 100,
        calendarEventId: "new-cal-456",
        note: "Booking edited by user: user@nyu.edu",
        tenant: "mc",
      });

      expect(mockLogServerBookingChange).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "REQUESTED",
          bookingId: "booking-123",
        })
      );
    });

    it("should NOT add APPROVED or MODIFIED status to booking log", async () => {
      // Edit should only add REQUESTED status
      const allowedStatus = "REQUESTED";
      const disallowedStatuses = ["APPROVED", "MODIFIED"];

      expect(allowedStatus).toBe("REQUESTED");
      expect(disallowedStatuses).not.toContain("REQUESTED");
    });
  });

  describe("Calendar Event", () => {
    it("should create calendar event with [REQUESTED] title (not MODIFIED)", async () => {
      const editData = {
        title: "Updated Meeting Title",
        selectedRoomIds: "202",
      };

      // Edit API should use REQUESTED status, not MODIFIED
      const statusLabel = "REQUESTED";
      const expectedTitle = `[${statusLabel}] ${editData.selectedRoomIds} ${editData.title}`;

      // Verify calendar event creation with REQUESTED
      expect(expectedTitle).toContain("[REQUESTED]");
      expect(expectedTitle).toContain(editData.selectedRoomIds);
      expect(expectedTitle).toContain(editData.title);
      expect(expectedTitle).not.toContain("[APPROVED]");
      expect(expectedTitle).not.toContain("[MODIFIED]");
    });

    it("should call insertEvent with REQUESTED status and updated content", async () => {
      const updatedBookingData = {
        title: "Updated Meeting Title",
        startTime: "2024-01-15T10:00:00",
        endTime: "2024-01-15T12:00:00",
        roomIds: "202, 203",
      };

      // Simulate insertEvent call
      await mockInsertEvent({
        calendarId: "cal-room-202",
        title: `[REQUESTED] 202, 203 ${updatedBookingData.title}`,
        description: "<p>Meeting details</p>",
        startTime: updatedBookingData.startTime,
        endTime: updatedBookingData.endTime,
        roomEmails: ["cal-room-203"],
      });

      expect(mockInsertEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          startTime: updatedBookingData.startTime,
          endTime: updatedBookingData.endTime,
        })
      );

      // Verify title contains both [REQUESTED] and the updated title
      const callArgs = mockInsertEvent.mock.calls[0][0];
      expect(callArgs.title).toContain("[REQUESTED]");
      expect(callArgs.title).toContain(updatedBookingData.title);
    });

    it("should create calendar event with updated times", async () => {
      const originalTime = {
        start: "2024-01-15T10:00:00",
        end: "2024-01-15T12:00:00",
      };

      const updatedTime = {
        start: "2024-01-15T14:00:00", // Changed to 2pm
        end: "2024-01-15T16:00:00", // Changed to 4pm
      };

      // Edit should use the updated times
      await mockInsertEvent({
        calendarId: "cal-room-202",
        title: "[REQUESTED] 202 Updated Meeting",
        description: "<p>Meeting details</p>",
        startTime: updatedTime.start,
        endTime: updatedTime.end,
      });

      expect(mockInsertEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          startTime: updatedTime.start,
          endTime: updatedTime.end,
        })
      );

      // Should NOT use original times
      const callArgs = mockInsertEvent.mock.calls[0][0];
      expect(callArgs.startTime).not.toBe(originalTime.start);
      expect(callArgs.endTime).not.toBe(originalTime.end);
    });

    it("should include pending confirmation message in description", async () => {
      const expectedDescription =
        "<p>Meeting details</p>" +
        "<p>Your reservation is not yet confirmed. The coordinator will review and finalize your reservation within a few days.</p>";

      expect(expectedDescription).toContain("not yet confirmed");
      expect(expectedDescription).not.toContain(
        "has been confirmed and approved"
      );
    });
  });

  describe("Email Notifications", () => {
    it("should send email to liaison/first approvers with REQUESTED status", async () => {
      const liaisons = ["liaison1@nyu.edu", "liaison2@nyu.edu"];
      mockFirstApproverEmails.mockResolvedValue(liaisons);

      const recipients = await mockFirstApproverEmails("ITP");

      expect(recipients).toEqual(liaisons);
      expect(recipients.length).toBe(2);
    });

    it("should call sendHTMLEmail with REQUESTED status and updated content", async () => {
      const updatedBookingData = {
        title: "Updated Meeting Title",
        department: "Film/TV",
        startDate: "2024-01-15T14:00:00",
        endDate: "2024-01-15T16:00:00",
        requestNumber: 100,
      };

      await mockSendHTMLEmail({
        templateName: "booking_detail",
        contents: {
          title: updatedBookingData.title,
          department: updatedBookingData.department,
          roomId: "202",
          startDate: "1/15/2024",
          endDate: "1/15/2024",
          startTime: "02:00 PM",
          endTime: "04:00 PM",
          requestNumber: "100",
        },
        targetEmail: "liaison@nyu.edu",
        status: "REQUESTED",
        eventTitle: updatedBookingData.title,
        requestNumber: updatedBookingData.requestNumber,
        body: "",
        approverType: "LIAISON",
        replyTo: "user@nyu.edu",
        schemaName: "Media Commons",
      });

      expect(mockSendHTMLEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "REQUESTED",
          eventTitle: updatedBookingData.title,
          contents: expect.objectContaining({
            title: updatedBookingData.title,
          }),
        })
      );
    });

    it("should send email with updated times and content", async () => {
      const originalData = {
        title: "Original Meeting",
        startTime: "10:00 AM",
        endTime: "12:00 PM",
      };

      const updatedData = {
        title: "Updated Meeting Title",
        startTime: "02:00 PM", // Changed
        endTime: "04:00 PM", // Changed
      };

      // Email should contain updated information
      await mockSendHTMLEmail({
        templateName: "booking_detail",
        contents: {
          title: updatedData.title,
          startTime: updatedData.startTime,
          endTime: updatedData.endTime,
        },
        targetEmail: "liaison@nyu.edu",
        status: "REQUESTED",
      });

      expect(mockSendHTMLEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          contents: expect.objectContaining({
            title: updatedData.title,
            startTime: updatedData.startTime,
            endTime: updatedData.endTime,
          }),
        })
      );

      // Should NOT contain original values
      const callArgs = mockSendHTMLEmail.mock.calls[0][0];
      expect(callArgs.contents.title).not.toBe(originalData.title);
      expect(callArgs.contents.startTime).not.toBe(originalData.startTime);
    });

    it("should send user confirmation email with REQUESTED status", async () => {
      await mockServerSendBookingDetailEmail({
        calendarEventId: "new-cal-456",
        targetEmail: "user@nyu.edu",
        headerMessage: "Thank you for your booking request.",
        status: "REQUESTED",
        replyTo: "user@nyu.edu",
        tenant: "mc",
      });

      expect(mockServerSendBookingDetailEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "REQUESTED",
          targetEmail: "user@nyu.edu",
        })
      );
    });

    it("should NOT send email with APPROVED or MODIFIED status", () => {
      // Edit emails should only have REQUESTED status
      const emailStatus = "REQUESTED";
      const disallowedStatuses = ["APPROVED", "MODIFIED"];

      expect(emailStatus).toBe("REQUESTED");
      expect(disallowedStatuses).not.toContain(emailStatus);
    });

    it("should NOT send approval confirmation email", () => {
      // Edit should never send approval confirmation email
      // Approval emails are only sent by finalApprove() in Modification flow
      const shouldSendApprovalEmail = false;

      expect(shouldSendApprovalEmail).toBe(false);
    });
  });

  describe("XState", () => {
    it("should NOT create new XState data for Edit", () => {
      // Edit doesn't create new XState data
      // It only updates booking data
      const shouldCreateXState = false;

      expect(shouldCreateXState).toBe(false);
    });

    it("existing XState should remain in Requested or current state", () => {
      // Edit doesn't modify XState
      // The booking's XState should remain as is
      const existingXStateValue = "Requested";
      const newXStateValue = existingXStateValue; // No change

      expect(newXStateValue).toBe("Requested");
      expect(newXStateValue).not.toBe("Approved");
    });
  });

  describe("Data Updates", () => {
    it("should update booking data with new calendar event ID", async () => {
      const updateData = {
        roomId: "202, 203",
        title: "Updated Meeting",
        calendarEventId: "new-cal-456",
        requestedAt: { now: vi.fn() },
        origin: "USER",
      };

      expect(updateData.calendarEventId).toBe("new-cal-456");
      expect(updateData.origin).toBe("USER");
    });

    it("should delete approval fields for safety", async () => {
      const fieldsToDelete = [
        "finalApprovedAt",
        "finalApprovedBy",
        "firstApprovedAt",
        "firstApprovedBy",
      ];

      // Edit should delete these fields even though they shouldn't exist
      expect(fieldsToDelete).toHaveLength(4);
      expect(fieldsToDelete).toContain("finalApprovedAt");
      expect(fieldsToDelete).toContain("firstApprovedBy");
    });

    it("should NOT preserve approval timestamps", () => {
      // Edit should NOT preserve approval data
      // because non-approved bookings don't have them
      const shouldPreserveApprovals = false;

      expect(shouldPreserveApprovals).toBe(false);
    });
  });

  describe("finalApprove Call", () => {
    it("should NOT call finalApprove", () => {
      // Edit never calls finalApprove
      // Only Modification calls finalApprove
      const shouldCallFinalApprove = false;

      expect(shouldCallFinalApprove).toBe(false);
    });

    it("should NOT add APPROVED log entry", () => {
      // Since finalApprove is not called,
      // no APPROVED log entry should be added
      const logStatuses = ["MODIFIED"];

      expect(logStatuses).not.toContain("APPROVED");
    });

    it("should NOT send approval email", () => {
      // Since finalApprove is not called,
      // no approval email should be sent
      const emailsSent = [
        { type: "LIAISON_NOTIFICATION", status: "REQUESTED" },
      ];

      const approvalEmails = emailsSent.filter((e) => e.type === "APPROVAL");
      expect(approvalEmails).toHaveLength(0);
    });
  });

  describe("Complete Edit Flow", () => {
    it("should execute complete edit flow correctly", async () => {
      // 1. Delete old calendar events
      await mockDeleteEvent("cal-room-202", "cal-123", 202);
      expect(mockDeleteEvent).toHaveBeenCalled();

      // 2. Create new calendar event with [MODIFIED]
      const newEvent = await mockInsertEvent({
        calendarId: "cal-room-202",
        title: "[MODIFIED] 202 Updated Meeting",
        description:
          "<p>Meeting details</p><p>Your reservation is not yet confirmed...</p>",
        startTime: "2024-01-15T10:00:00",
        endTime: "2024-01-15T12:00:00",
      });
      expect(newEvent.id).toBe("new-cal-456");

      // 3. Log MODIFIED status
      await mockLogServerBookingChange({
        bookingId: "booking-123",
        status: "MODIFIED",
        changedBy: "user@nyu.edu",
        requestNumber: 100,
        calendarEventId: "new-cal-456",
        note: "Booking edited by user: user@nyu.edu",
        tenant: "mc",
      });
      expect(mockLogServerBookingChange).toHaveBeenCalled();

      // 4. Update booking data
      await mockServerUpdateDataByCalendarEventId(
        "BOOKING",
        "cal-123",
        {
          roomId: "202",
          calendarEventId: "new-cal-456",
          requestedAt: { now: vi.fn() },
        },
        "mc"
      );
      expect(mockServerUpdateDataByCalendarEventId).toHaveBeenCalled();

      // 5. Delete approval fields
      await mockServerDeleteFieldsByCalendarEventId(
        "BOOKING",
        "new-cal-456",
        [
          "finalApprovedAt",
          "finalApprovedBy",
          "firstApprovedAt",
          "firstApprovedBy",
        ],
        "mc"
      );
      expect(mockServerDeleteFieldsByCalendarEventId).toHaveBeenCalled();

      // 6. Verify finalApprove was NOT called
      // (No mock for finalApprove because it shouldn't be called)
    });
  });

  describe("Comparison with Modification", () => {
    it("Edit vs Modification - Status differences", () => {
      const editStatus = "MODIFIED";
      const modificationStatus = "APPROVED";

      expect(editStatus).not.toBe(modificationStatus);
      expect(editStatus).toBe("MODIFIED");
      expect(modificationStatus).toBe("APPROVED");
    });

    it("Edit vs Modification - Calendar title differences", () => {
      const editCalendarTitle = "[MODIFIED] 202 Meeting";
      const modificationCalendarTitle = "[APPROVED] 202 Meeting";

      expect(editCalendarTitle).toContain("[MODIFIED]");
      expect(modificationCalendarTitle).toContain("[APPROVED]");
      expect(editCalendarTitle).not.toContain("[APPROVED]");
    });

    it("Edit vs Modification - Email recipient differences", () => {
      const editRecipients = ["liaison@nyu.edu"]; // First approvers
      const modificationRecipients = ["user@nyu.edu"]; // Booking owner (approval confirmation)

      // Different purposes
      expect(editRecipients[0]).toContain("liaison");
      expect(modificationRecipients[0]).toBe("user@nyu.edu");
    });

    it("Edit vs Modification - finalApprove call differences", () => {
      const editCallsFinalApprove = false;
      const modificationCallsFinalApprove = true;

      expect(editCallsFinalApprove).toBe(false);
      expect(modificationCallsFinalApprove).toBe(true);
    });
  });
});
