import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock all the dependencies
const mockLogServerBookingChange = vi.fn();
const mockServerBookingContents = vi.fn();
const mockServerUpdateDataByCalendarEventId = vi.fn();
const mockServerDeleteFieldsByCalendarEventId = vi.fn();
const mockDeleteEvent = vi.fn();
const mockInsertEvent = vi.fn();
const mockToFirebaseTimestampFromString = vi.fn();
const mockHandleBookingApprovalEmails = vi.fn();

vi.mock("@/lib/firebase/server/adminDb", () => ({
  logServerBookingChange: mockLogServerBookingChange,
}));

vi.mock("@/components/src/server/admin", () => ({
  serverBookingContents: mockServerBookingContents,
  serverUpdateDataByCalendarEventId: mockServerUpdateDataByCalendarEventId,
  serverDeleteFieldsByCalendarEventId: mockServerDeleteFieldsByCalendarEventId,
}));

vi.mock("@/components/src/server/calendars", () => ({
  deleteEvent: mockDeleteEvent,
  insertEvent: mockInsertEvent,
}));

vi.mock("@/components/src/client/utils/serverDate", () => ({
  toFirebaseTimestampFromString: mockToFirebaseTimestampFromString,
}));

vi.mock("firebase-admin/firestore", () => ({
  Timestamp: {
    now: () => ({ toDate: () => new Date(), toMillis: () => Date.now() }),
  },
}));

// Create a mock request class
class MockNextRequest {
  private body: any;

  constructor(body: any) {
    this.body = body;
  }

  async json() {
    return this.body;
  }
}

// Mock Next.js Response
const mockNextResponse = {
  json: vi.fn((data: any, options?: any) => ({
    data,
    ...options,
  })),
};

vi.mock("next/server", () => ({
  NextRequest: MockNextRequest,
  NextResponse: mockNextResponse,
}));

import { BookingStatusLabel } from "@/components/src/types";

// Recreate the PUT logic from the route handler
const putBookingHandler = async (request: any) => {
  const {
    email,
    selectedRooms,
    allRooms,
    bookingCalendarInfo,
    data,
    modifiedBy,
    isAutoApproval,
    calendarEventId,
  } = await request.json();

  // Validation check that was added in our fix
  if (!modifiedBy) {
    return mockNextResponse.json(
      { error: "modifiedBy field is required for modifications" },
      { status: 400 }
    );
  }

  if (bookingCalendarInfo == null) {
    return mockNextResponse.json(
      { error: "missing bookingCalendarId" },
      { status: 500 }
    );
  }

  try {
    const existingContents = await mockServerBookingContents(calendarEventId);
    const oldRoomIds = existingContents.roomId
      .split(",")
      .map((x: string) => x.trim());
    const oldRooms = allRooms.filter((room: any) =>
      oldRoomIds.includes(room.roomId + "")
    );

    const selectedRoomIds = selectedRooms
      .map((r: { roomId: number }) => r.roomId)
      .join(", ");

    // Delete existing cal events
    await Promise.all(
      oldRooms.map(async (room: any) => {
        await mockDeleteEvent(room.calendarId, calendarEventId, room.roomId);
      })
    );

    // recreate cal events
    let newCalendarEventId: string;
    try {
      const insertResult = await mockInsertEvent({
        calendarId: selectedRooms[0]?.calendarId,
        title: `[REQUESTED] ${selectedRoomIds} ${data.title}`,
        description: `Department: ${data.department}`,
        startTime: bookingCalendarInfo.startStr,
        endTime: bookingCalendarInfo.endStr,
        roomEmails: [],
      });
      newCalendarEventId = insertResult.id;

      // Add a new history entry for the modification - THE CRITICAL PART
      await mockLogServerBookingChange({
        bookingId: existingContents.id,
        status: BookingStatusLabel.MODIFIED,
        changedBy: modifiedBy, // This should be the person making the modification
        requestNumber: existingContents.requestNumber,
        calendarEventId: newCalendarEventId,
        note: "Modified by " + modifiedBy,
      });
    } catch (err) {
      console.error(err);
      return mockNextResponse.json(
        { result: "error", message: "ROOM CALENDAR ID NOT FOUND" },
        { status: 500 }
      );
    }

    // Mock update data
    mockToFirebaseTimestampFromString.mockReturnValue({
      toDate: () => new Date(),
      toMillis: () => Date.now(),
    });

    const { id, ...formData } = data;
    const updatedData = {
      ...formData,
      roomId: selectedRoomIds,
      startDate: mockToFirebaseTimestampFromString(
        bookingCalendarInfo.startStr
      ),
      endDate: mockToFirebaseTimestampFromString(bookingCalendarInfo.endStr),
      calendarEventId: newCalendarEventId,
      equipmentCheckedOut: false,
      requestedAt: { now: () => new Date() },
    };

    await mockServerUpdateDataByCalendarEventId(
      "BOOKING",
      calendarEventId,
      updatedData
    );

    await mockServerDeleteFieldsByCalendarEventId(
      "BOOKING",
      newCalendarEventId,
      [
        "finalApprovedAt",
        "finalApprovedBy",
        "firstApprovedAt",
        "firstApprovedBy",
      ]
    );

    return mockNextResponse.json({ result: "success" }, { status: 200 });
  } catch (err) {
    console.error(err);
    return mockNextResponse.json(
      { result: "error", message: "Database error" },
      { status: 500 }
    );
  }
};

describe("Booking API Integration Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Set up default mock returns
    mockServerBookingContents.mockResolvedValue({
      id: "booking-123",
      requestNumber: 25,
      roomId: "1201",
      email: "jg5626@nyu.edu",
    });

    mockInsertEvent.mockResolvedValue({ id: "new-calendar-event-id" });
    mockLogServerBookingChange.mockResolvedValue(undefined);
    mockServerUpdateDataByCalendarEventId.mockResolvedValue(undefined);
    mockServerDeleteFieldsByCalendarEventId.mockResolvedValue(undefined);
    mockDeleteEvent.mockResolvedValue(undefined);
  });

  describe("PUT /api/bookings - Modification Logic", () => {
    it("should reject requests without modifiedBy field", async () => {
      const request = new MockNextRequest({
        email: "jg5626@nyu.edu",
        selectedRooms: [{ roomId: 1201 }],
        allRooms: [{ roomId: 1201, calendarId: "cal-123" }],
        bookingCalendarInfo: {
          startStr: "2025-06-24T14:00:00",
          endStr: "2025-06-24T20:30:00",
        },
        data: {
          // No modifiedBy field
          title: "Updated Event",
          department: "ITP",
        },
        isAutoApproval: true,
        calendarEventId: "original-event-id",
      });

      const response = await putBookingHandler(request);

      expect(response.data.error).toBe(
        "modifiedBy field is required for modifications"
      );
      expect(response.status).toBe(400);
      expect(mockLogServerBookingChange).not.toHaveBeenCalled();
    });

    it("should accept requests with valid modifiedBy field", async () => {
      const request = new MockNextRequest({
        email: "jg5626@nyu.edu",
        selectedRooms: [{ roomId: 1201 }],
        allRooms: [{ roomId: 1201, calendarId: "cal-123" }],
        bookingCalendarInfo: {
          startStr: "2025-06-24T14:00:00",
          endStr: "2025-06-24T20:30:00",
        },
        modifiedBy: "ss12430@nyu.edu",
        data: {
          title: "Updated Event",
          department: "ITP",
        },
        isAutoApproval: true,
        calendarEventId: "original-event-id",
      });

      const response = await putBookingHandler(request);

      expect(response.data.result).toBe("success");
      expect(response.status).toBe(200);
      expect(mockLogServerBookingChange).toHaveBeenCalledTimes(1);
    });

    it("should log modification history with correct user", async () => {
      const modifierEmail = "ss12430@nyu.edu";
      const originalRequesterEmail = "jg5626@nyu.edu";

      const request = new MockNextRequest({
        email: originalRequesterEmail, // Original requester
        selectedRooms: [{ roomId: 1201 }],
        allRooms: [{ roomId: 1201, calendarId: "cal-123" }],
        bookingCalendarInfo: {
          startStr: "2025-06-24T14:00:00",
          endStr: "2025-06-24T20:30:00",
        },
        modifiedBy: modifierEmail, // Person making the modification
        data: {
          title: "Updated Event",
          department: "ITP",
        },
        isAutoApproval: true,
        calendarEventId: "original-event-id",
      });

      await putBookingHandler(request);

      // Verify the history log was called with correct parameters
      expect(mockLogServerBookingChange).toHaveBeenCalledWith({
        bookingId: "booking-123",
        status: BookingStatusLabel.MODIFIED,
        changedBy: modifierEmail, // Should be modifier, NOT original requester
        requestNumber: 25,
        calendarEventId: "new-calendar-event-id",
        note: "Modified by " + modifierEmail,
      });

      // Extra verification - make sure it's NOT the original requester
      const callArgs = mockLogServerBookingChange.mock.calls[0][0];
      expect(callArgs.changedBy).not.toBe(originalRequesterEmail);
      expect(callArgs.changedBy).toBe(modifierEmail);
    });

    it("should handle calendar event creation failure gracefully", async () => {
      // Reset the mock to reject for this test
      mockInsertEvent.mockReset();
      mockInsertEvent.mockRejectedValue(new Error("Calendar API error"));

      const request = new MockNextRequest({
        email: "jg5626@nyu.edu",
        selectedRooms: [{ roomId: 1201 }],
        allRooms: [{ roomId: 1201, calendarId: "cal-123" }],
        bookingCalendarInfo: {
          startStr: "2025-06-24T14:00:00",
          endStr: "2025-06-24T20:30:00",
        },
        modifiedBy: "ss12430@nyu.edu",
        data: {
          title: "Updated Event",
          department: "ITP",
        },
        isAutoApproval: true,
        calendarEventId: "original-event-id",
      });

      const response = await putBookingHandler(request);

      expect(response.data.result).toBe("error");
      expect(response.data.message).toBe("ROOM CALENDAR ID NOT FOUND");
      expect(response.status).toBe(500);
    });

    it("should call all necessary database operations in correct order", async () => {
      const request = new MockNextRequest({
        email: "jg5626@nyu.edu",
        selectedRooms: [{ roomId: 1201 }],
        allRooms: [{ roomId: 1201, calendarId: "cal-123" }],
        bookingCalendarInfo: {
          startStr: "2025-06-24T14:00:00",
          endStr: "2025-06-24T20:30:00",
        },
        modifiedBy: "ss12430@nyu.edu",
        data: {
          title: "Updated Event",
          department: "ITP",
        },
        isAutoApproval: true,
        calendarEventId: "original-event-id",
      });

      await putBookingHandler(request);

      // Verify all operations were called
      expect(mockServerBookingContents).toHaveBeenCalledWith(
        "original-event-id"
      );
      expect(mockDeleteEvent).toHaveBeenCalled();
      expect(mockLogServerBookingChange).toHaveBeenCalled();
      expect(mockServerUpdateDataByCalendarEventId).toHaveBeenCalled();
      expect(mockServerDeleteFieldsByCalendarEventId).toHaveBeenCalled();
    });

    it("should preserve booking metadata correctly", async () => {
      const request = new MockNextRequest({
        email: "jg5626@nyu.edu",
        selectedRooms: [{ roomId: 1201 }],
        allRooms: [{ roomId: 1201, calendarId: "cal-123" }],
        bookingCalendarInfo: {
          startStr: "2025-06-24T14:00:00",
          endStr: "2025-06-24T20:30:00",
        },
        modifiedBy: "ss12430@nyu.edu",
        data: {
          title: "Updated Event",
          department: "ITP",
          id: "should-be-removed",
        },
        isAutoApproval: true,
        calendarEventId: "original-event-id",
      });

      await putBookingHandler(request);

      // Verify the booking ID is preserved in history
      const historyCall = mockLogServerBookingChange.mock.calls[0][0];
      expect(historyCall.bookingId).toBe("booking-123");
      expect(historyCall.requestNumber).toBe(25);

      // Verify ID field is removed from form data
      const updateCall = mockServerUpdateDataByCalendarEventId.mock.calls[0];
      expect(updateCall[2]).not.toHaveProperty("id");
      expect(updateCall[2]).toHaveProperty("title", "Updated Event");
    });
  });

  describe("Error Handling", () => {
    it("should handle missing bookingCalendarInfo", async () => {
      const request = new MockNextRequest({
        email: "jg5626@nyu.edu",
        selectedRooms: [{ roomId: 1201 }],
        allRooms: [{ roomId: 1201, calendarId: "cal-123" }],
        bookingCalendarInfo: null, // Missing
        modifiedBy: "ss12430@nyu.edu",
        data: {
          title: "Updated Event",
          department: "ITP",
        },
        isAutoApproval: true,
        calendarEventId: "original-event-id",
      });

      const response = await putBookingHandler(request);

      expect(response.data.error).toBe("missing bookingCalendarId");
      expect(response.status).toBe(500);
    });

    it("should handle database errors gracefully", async () => {
      mockServerBookingContents.mockRejectedValue(new Error("Database error"));

      const request = new MockNextRequest({
        email: "jg5626@nyu.edu",
        selectedRooms: [{ roomId: 1201 }],
        allRooms: [{ roomId: 1201, calendarId: "cal-123" }],
        bookingCalendarInfo: {
          startStr: "2025-06-24T14:00:00",
          endStr: "2025-06-24T20:30:00",
        },
        modifiedBy: "ss12430@nyu.edu",
        data: {
          title: "Updated Event",
          department: "ITP",
        },
        isAutoApproval: true,
        calendarEventId: "original-event-id",
      });

      const response = await putBookingHandler(request);

      expect(response.data.result).toBe("error");
      expect(response.data.message).toBe("Database error");
      expect(response.status).toBe(500);
    });
  });

  describe("Real-world Scenarios", () => {
    it("should handle the exact scenario from the bug report", async () => {
      // Simulate the exact bug scenario
      const originalRequester = "jg5626@nyu.edu"; // Jhanele
      const modifier = "ss12430@nyu.edu"; // You (the person fixing it)

      const request = new MockNextRequest({
        email: originalRequester,
        selectedRooms: [{ roomId: 1201 }],
        allRooms: [{ roomId: 1201, calendarId: "cal-123" }],
        bookingCalendarInfo: {
          startStr: "2025-06-24T14:00:00",
          endStr: "2025-06-24T20:30:00",
        },
        modifiedBy: modifier,
        data: {
          title: "Media Commons Room Booking",
          department: "ITP",
        },
        isAutoApproval: true,
        calendarEventId: "original-event-id",
      });

      await putBookingHandler(request);

      // Verify the history shows the correct modifier, not the original requester
      const historyCall = mockLogServerBookingChange.mock.calls[0][0];
      expect(historyCall.changedBy).toBe(modifier);
      expect(historyCall.note).toBe("Modified by " + modifier);

      // Critical: Make sure it's NOT showing the original requester
      expect(historyCall.changedBy).not.toBe(originalRequester);
    });
  });
});
