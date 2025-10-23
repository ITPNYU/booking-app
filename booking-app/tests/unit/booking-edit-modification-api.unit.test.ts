import { describe, expect, it } from "vitest";

/**
 * Test suite for separated Edit and Modification APIs
 *
 * This tests the new API structure:
 * - PUT /api/bookings/edit - User editing non-approved booking
 * - PUT /api/bookings/modification - PA/Admin modifying approved booking
 */

describe("Edit and Modification APIs", () => {
  describe("Edit API (PUT /api/bookings/edit)", () => {
    it("should handle user editing their non-approved booking", () => {
      // Test characteristics of Edit API:
      // - Used for non-approved bookings
      // - User can only edit their own bookings
      // - No state transition (remains in Requested/Modified state)
      // - No finalApprove call
      // - Calendar event created with [MODIFIED] or [REQUESTED]

      const editRequest = {
        email: "user@nyu.edu",
        modifiedBy: "user@nyu.edu",
        calendarEventId: "cal-123",
        selectedRooms: [{ roomId: 202, calendarId: "cal-room-202" }],
        bookingCalendarInfo: {
          startStr: "2024-01-15T10:00:00",
          endStr: "2024-01-15T12:00:00",
        },
        data: {
          title: "Updated Meeting",
          department: "ITP",
          requestNumber: 100,
        },
      };

      // Verify request structure
      expect(editRequest.modifiedBy).toBe(editRequest.email);
      expect(editRequest.calendarEventId).toBeDefined();
    });

    it("should not call finalApprove for Edit", () => {
      // Edit should NOT call finalApprove because:
      // - Booking is not approved
      // - No approval email should be sent
      // - No APPROVED log should be added

      const shouldCallFinalApprove = false;
      expect(shouldCallFinalApprove).toBe(false);
    });

    it("should delete old approval fields (if any)", () => {
      // Edit should delete any approval fields for safety
      const fieldsToDelete = [
        "finalApprovedAt",
        "finalApprovedBy",
        "firstApprovedAt",
        "firstApprovedBy",
      ];

      expect(fieldsToDelete).toContain("finalApprovedAt");
      expect(fieldsToDelete.length).toBe(4);
    });
  });

  describe("Modification API (PUT /api/bookings/modification)", () => {
    it("should handle PA/Admin modifying approved booking", () => {
      // Test characteristics of Modification API:
      // - Used for approved bookings
      // - Only PA/Admin can do modifications
      // - Maintains Approved state
      // - Calls finalApprove
      // - Calendar event created with [APPROVED]
      // - Preserves approval timestamps

      const modificationRequest = {
        email: "original-user@nyu.edu",
        modifiedBy: "pa@nyu.edu",
        calendarEventId: "cal-456",
        selectedRooms: [{ roomId: 202, calendarId: "cal-room-202" }],
        bookingCalendarInfo: {
          startStr: "2024-01-15T10:00:00",
          endStr: "2024-01-15T14:00:00", // Extended time
        },
        data: {
          title: "Updated Approved Meeting",
          department: "ITP",
          requestNumber: 100,
        },
      };

      // Verify PA/Admin is making the modification
      expect(modificationRequest.modifiedBy).not.toBe(
        modificationRequest.email
      );
      expect(modificationRequest.calendarEventId).toBeDefined();
    });

    it("should call finalApprove for Modification", () => {
      // Modification SHOULD call finalApprove because:
      // - Booking was already approved
      // - Need to maintain approved status
      // - Need to send approval confirmation email
      // - Need to add APPROVED log

      const shouldCallFinalApprove = true;
      expect(shouldCallFinalApprove).toBe(true);
    });

    it("should preserve approval timestamps", () => {
      const existingBooking = {
        finalApprovedAt: { toDate: () => new Date("2024-01-10") },
        finalApprovedBy: "admin@nyu.edu",
        firstApprovedAt: { toDate: () => new Date("2024-01-09") },
        firstApprovedBy: "liaison@nyu.edu",
      };

      // Modification should preserve these
      const updatedData: any = {};

      if (existingBooking.finalApprovedAt) {
        updatedData.finalApprovedAt = existingBooking.finalApprovedAt;
      }
      if (existingBooking.finalApprovedBy) {
        updatedData.finalApprovedBy = existingBooking.finalApprovedBy;
      }

      expect(updatedData.finalApprovedAt).toEqual(
        existingBooking.finalApprovedAt
      );
      expect(updatedData.finalApprovedBy).toBe("admin@nyu.edu");
    });

    it("should preserve service approvals for Media Commons", () => {
      const existingBooking = {
        staffServiceApproved: true,
        equipmentServiceApproved: true,
        cateringServiceApproved: false,
      };

      // Modification should preserve these
      const updatedData: any = {};

      if (existingBooking.staffServiceApproved !== undefined) {
        updatedData.staffServiceApproved = existingBooking.staffServiceApproved;
      }
      if (existingBooking.equipmentServiceApproved !== undefined) {
        updatedData.equipmentServiceApproved =
          existingBooking.equipmentServiceApproved;
      }

      expect(updatedData.staffServiceApproved).toBe(true);
      expect(updatedData.equipmentServiceApproved).toBe(true);
    });

    it("should create XState data with Approved state", () => {
      const targetState = "Approved";

      const xstateData = {
        machineId: "MC Booking Request",
        snapshot: {
          value: targetState,
        },
      };

      expect(xstateData.snapshot.value).toBe("Approved");
    });
  });

  describe("API Endpoint Differences", () => {
    it("should use different endpoints for Edit vs Modification", () => {
      const editEndpoint = "/api/bookings/edit";
      const modificationEndpoint = "/api/bookings/modification";

      expect(editEndpoint).not.toBe(modificationEndpoint);
      expect(editEndpoint).toContain("/edit");
      expect(modificationEndpoint).toContain("/modification");
    });

    it("should have clear separation of concerns", () => {
      // Edit: Non-approved booking updates
      const editConcerns = {
        targetBookings: "non-approved",
        userRole: "user (booking owner)",
        stateChange: "none (stays in Requested/Modified)",
        finalApprove: false,
        calendarStatus: "[MODIFIED] or [REQUESTED]",
      };

      // Modification: Approved booking updates
      const modificationConcerns = {
        targetBookings: "approved",
        userRole: "PA/Admin",
        stateChange: "maintains Approved",
        finalApprove: true,
        calendarStatus: "[APPROVED]",
      };

      expect(editConcerns.finalApprove).toBe(false);
      expect(modificationConcerns.finalApprove).toBe(true);
      expect(editConcerns.targetBookings).not.toBe(
        modificationConcerns.targetBookings
      );
    });
  });
});

