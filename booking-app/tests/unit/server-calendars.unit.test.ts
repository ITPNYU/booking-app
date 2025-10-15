import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/googleClient", () => ({
  getCalendarClient: vi.fn(),
}));

vi.mock("@/components/src/server/admin", () => ({
  serverGetRoomCalendarIds: vi.fn(),
}));

import {
  patchCalendarEvent,
  inviteUserToCalendarEvent,
  bookingContentsToDescription,
} from "@/components/src/server/calendars";
import { getCalendarClient } from "@/lib/googleClient";
import { serverGetRoomCalendarIds } from "@/components/src/server/admin";
import { BookingStatusLabel } from "@/components/src/types";
import { Timestamp } from "firebase-admin/firestore";

const mockGetCalendarClient = vi.mocked(getCalendarClient);
const mockServerGetRoomCalendarIds = vi.mocked(serverGetRoomCalendarIds);

describe("Server Calendar Functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("patchCalendarEvent", () => {
    it("patches calendar event with updated data", async () => {
      const mockPatch = vi.fn().mockResolvedValue({});
      mockGetCalendarClient.mockResolvedValue({
        events: {
          patch: mockPatch,
        },
      } as any);

      const event = {
        start: { dateTime: "2024-01-15T10:00:00" },
        end: { dateTime: "2024-01-15T12:00:00" },
      };

      await patchCalendarEvent(
        event,
        "calendar-123",
        "event-123",
        { summary: "Updated Title" },
      );

      expect(mockPatch).toHaveBeenCalledWith({
        calendarId: "calendar-123",
        eventId: "event-123",
        requestBody: {
          start: event.start,
          end: event.end,
          summary: "Updated Title",
        },
      });
    });

    it("preserves event start and end times", async () => {
      const mockPatch = vi.fn().mockResolvedValue({});
      mockGetCalendarClient.mockResolvedValue({
        events: {
          patch: mockPatch,
        },
      } as any);

      const event = {
        start: { dateTime: "2024-01-15T14:00:00" },
        end: { dateTime: "2024-01-15T16:00:00" },
      };

      await patchCalendarEvent(event, "cal-id", "evt-id", {});

      const callArgs = mockPatch.mock.calls[0][0];
      expect(callArgs.requestBody.start).toEqual(event.start);
      expect(callArgs.requestBody.end).toEqual(event.end);
    });
  });

  describe("inviteUserToCalendarEvent", () => {
    it("invites user to calendar event across all room calendars", async () => {
      const mockGet = vi.fn().mockResolvedValue({
        data: {
          attendees: [{ email: "existing@nyu.edu" }],
        },
      });
      const mockPatch = vi.fn().mockResolvedValue({});

      mockGetCalendarClient.mockResolvedValue({
        events: {
          get: mockGet,
          patch: mockPatch,
        },
      } as any);

      mockServerGetRoomCalendarIds.mockResolvedValue([
        "calendar-101",
        "calendar-102",
      ]);

      await inviteUserToCalendarEvent("event-123", "guest@nyu.edu", 101);

      expect(mockServerGetRoomCalendarIds).toHaveBeenCalledWith(101);
      expect(mockGet).toHaveBeenCalledTimes(2);
      expect(mockPatch).toHaveBeenCalledTimes(2);

      // Check that guest was added to attendees
      const firstPatchCall = mockPatch.mock.calls[0][0];
      expect(firstPatchCall.requestBody.attendees).toContainEqual({
        email: "guest@nyu.edu",
      });
    });

    it("handles errors gracefully when inviting to a calendar fails", async () => {
      const mockGet = vi
        .fn()
        .mockResolvedValueOnce({
          data: { attendees: [] },
        })
        .mockRejectedValueOnce(new Error("Calendar not found"));

      const mockPatch = vi.fn().mockResolvedValue({});

      mockGetCalendarClient.mockResolvedValue({
        events: {
          get: mockGet,
          patch: mockPatch,
        },
      } as any);

      mockServerGetRoomCalendarIds.mockResolvedValue([
        "calendar-101",
        "calendar-102",
      ]);

      // Should not throw even if one calendar fails
      await expect(
        inviteUserToCalendarEvent("event-123", "guest@nyu.edu", 101),
      ).resolves.not.toThrow();

      expect(mockPatch).toHaveBeenCalledTimes(1); // Only succeeds for first calendar
    });

    it("handles empty attendees list", async () => {
      const mockGet = vi.fn().mockResolvedValue({
        data: {
          attendees: undefined,
        },
      });
      const mockPatch = vi.fn().mockResolvedValue({});

      mockGetCalendarClient.mockResolvedValue({
        events: {
          get: mockGet,
          patch: mockPatch,
        },
      } as any);

      mockServerGetRoomCalendarIds.mockResolvedValue(["calendar-101"]);

      await inviteUserToCalendarEvent("event-123", "guest@nyu.edu", 101);

      const patchCall = mockPatch.mock.calls[0][0];
      expect(patchCall.requestBody.attendees).toEqual([
        { email: "guest@nyu.edu" },
      ]);
    });
  });

  describe("bookingContentsToDescription", () => {
    it("generates HTML description from booking contents", async () => {
      const bookingContents = {
        calendarEventId: "event-123",
        requestNumber: 12345,
        roomId: "101",
        startDate: "1/15/2024",
        endDate: "1/15/2024",
        startTime: "10:00 AM",
        endTime: "12:00 PM",
        email: "requester@nyu.edu",
        netId: "req123",
        firstName: "John",
        lastName: "Doe",
        secondaryName: "",
        nNumber: "N12345678",
        phoneNumber: "212-555-0100",
        department: "ITP",
        role: "Student",
        sponsorFirstName: "Jane",
        sponsorLastName: "Smith",
        sponsorEmail: "jane.smith@nyu.edu",
        title: "Workshop",
        description: "A workshop on animation",
        expectedAttendance: 20,
        attendeeAffiliation: "NYU",
        roomSetup: "Classroom",
        setupDetails: "Tables and chairs",
        mediaServices: "Projector",
        mediaServicesDetails: "HDMI connection",
        catering: "No",
        cateringService: "",
        hireSecurity: "No",
        chartFieldForCatering: "",
        chartFieldForSecurity: "",
        chartFieldForRoomSetup: "",
        equipmentCheckedOut: false,
        requestedAt: Timestamp.now(),
        firstApprovedAt: Timestamp.now(),
        firstApprovedBy: "",
        finalApprovedAt: Timestamp.now(),
        finalApprovedBy: "",
        declinedAt: Timestamp.now(),
        declinedBy: "",
        canceledAt: Timestamp.now(),
        canceledBy: "",
        checkedInAt: Timestamp.now(),
        checkedInBy: "",
        checkedOutAt: Timestamp.now(),
        checkedOutBy: "",
        noShowedAt: Timestamp.now(),
        noShowedBy: "",
        walkedInAt: Timestamp.now(),
        equipmentAt: Timestamp.now(),
        equipmentBy: "",
      } as any;

      const result = await bookingContentsToDescription(bookingContents);

      expect(result).toContain("<h3>Request</h3>");
      expect(result).toContain("<strong>Request #:</strong> 12345");
      expect(result).toContain("<strong>Room(s):</strong> 101");
      expect(result).toContain("<strong>Date:</strong> 1/15/2024");
      expect(result).toContain("10:00 AM - 12:00 PM");
    });

    it("includes requester information", async () => {
      const bookingContents = {
        calendarEventId: "event-123",
        requestNumber: 12345,
        roomId: "101",
        startDate: "1/15/2024",
        endDate: "1/15/2024",
        startTime: "10:00 AM",
        endTime: "12:00 PM",
        email: "requester@nyu.edu",
        netId: "req123",
        firstName: "John",
        lastName: "Doe",
        department: "ITP",
        role: "Faculty",
        equipmentCheckedOut: false,
        requestedAt: Timestamp.now(),
        firstApprovedAt: Timestamp.now(),
        firstApprovedBy: "",
        finalApprovedAt: Timestamp.now(),
        finalApprovedBy: "",
        declinedAt: Timestamp.now(),
        declinedBy: "",
        canceledAt: Timestamp.now(),
        canceledBy: "",
        checkedInAt: Timestamp.now(),
        checkedInBy: "",
        checkedOutAt: Timestamp.now(),
        checkedOutBy: "",
        noShowedAt: Timestamp.now(),
        noShowedBy: "",
        walkedInAt: Timestamp.now(),
        equipmentAt: Timestamp.now(),
        equipmentBy: "",
      } as any;

      const result = await bookingContentsToDescription(bookingContents);

      expect(result).toContain("<h3>Requester</h3>");
      expect(result).toContain("<strong>NetID:</strong> req123");
      expect(result).toContain("<strong>Name:</strong> John Doe");
      expect(result).toContain("<strong>Department:</strong> ITP");
      expect(result).toContain("<strong>Role:</strong> Faculty");
    });

    it("includes event details section", async () => {
      const bookingContents = {
        calendarEventId: "event-123",
        requestNumber: 12345,
        roomId: "101",
        startDate: "1/15/2024",
        endDate: "1/15/2024",
        startTime: "10:00 AM",
        endTime: "12:00 PM",
        title: "Animation Workshop",
        description: "Learning animation basics",
        expectedAttendance: 15,
        attendeeAffiliation: "NYU Students",
        equipmentCheckedOut: false,
        requestedAt: Timestamp.now(),
        firstApprovedAt: Timestamp.now(),
        firstApprovedBy: "",
        finalApprovedAt: Timestamp.now(),
        finalApprovedBy: "",
        declinedAt: Timestamp.now(),
        declinedBy: "",
        canceledAt: Timestamp.now(),
        canceledBy: "",
        checkedInAt: Timestamp.now(),
        checkedInBy: "",
        checkedOutAt: Timestamp.now(),
        checkedOutBy: "",
        noShowedAt: Timestamp.now(),
        noShowedBy: "",
        walkedInAt: Timestamp.now(),
        equipmentAt: Timestamp.now(),
        equipmentBy: "",
      } as any;

      const result = await bookingContentsToDescription(bookingContents);

      // The actual implementation uses "Details" instead of "Event Details"
      expect(result).toContain("<h3>Details</h3>");
      expect(result).toContain("<strong>Title:</strong> Animation Workshop");
      expect(result).toContain(
        "<strong>Description:</strong> Learning animation basics",
      );
      expect(result).toContain("<strong>Expected Attendance:</strong> 15");
      expect(result).toContain(
        "<strong>Attendee Affiliation:</strong> NYU Students",
      );
    });

    it("handles missing values by displaying 'none'", async () => {
      const bookingContents = {
        calendarEventId: "event-123",
        requestNumber: 12345,
        roomId: "101",
        startDate: "1/15/2024",
        endDate: "1/15/2024",
        startTime: "10:00 AM",
        endTime: "12:00 PM",
        catering: undefined,
        hireSecurity: undefined,
        equipmentCheckedOut: false,
        requestedAt: Timestamp.now(),
        firstApprovedAt: Timestamp.now(),
        firstApprovedBy: "",
        finalApprovedAt: Timestamp.now(),
        finalApprovedBy: "",
        declinedAt: Timestamp.now(),
        declinedBy: "",
        canceledAt: Timestamp.now(),
        canceledBy: "",
        checkedInAt: Timestamp.now(),
        checkedInBy: "",
        checkedOutAt: Timestamp.now(),
        checkedOutBy: "",
        noShowedAt: Timestamp.now(),
        noShowedBy: "",
        walkedInAt: Timestamp.now(),
        equipmentAt: Timestamp.now(),
        equipmentBy: "",
      } as any;

      const result = await bookingContentsToDescription(bookingContents);

      // Check that undefined values are shown as "none" in the Requester section
      expect(result).toContain("<strong>NetID:</strong> none");
      expect(result).toContain("<strong>Name:</strong> none");
      expect(result).toContain("<strong>Department:</strong> none");

    });
  });
});
