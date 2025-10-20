import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetCalendarClient = vi.fn();
const mockServerGetRoomCalendarIds = vi.fn();
const mockGetStatusFromXState = vi.fn();

vi.mock("@/lib/googleClient", () => ({
  getCalendarClient: mockGetCalendarClient,
}));

vi.mock("@/components/src/server/admin", () => ({
  serverGetRoomCalendarIds: mockServerGetRoomCalendarIds,
}));

vi.mock("@/components/src/utils/statusFromXState", () => ({
  getStatusFromXState: mockGetStatusFromXState,
}));

vi.mock("@/components/src/types", () => ({
  BookingStatusLabel: {
    APPROVED: "APPROVED",
    PRE_APPROVED: "PRE_APPROVED",
  },
  BookingFormDetails: {}
}));

vi.mock("@/components/src/utils/formatters", async () => {
  const actual = await vi.importActual<
    typeof import("@/components/src/utils/formatters")
  >("@/components/src/utils/formatters");
  return actual;
});

describe("server/calendars", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetStatusFromXState.mockReturnValue("APPROVED");
  });

  it("patchCalendarEvent forwards merged payload to Google Calendar", async () => {
    const patchMock = vi.fn();
    mockGetCalendarClient.mockResolvedValue({
      events: {
        patch: patchMock,
      },
    });

    const { patchCalendarEvent } = await import(
      "@/components/src/server/calendars"
    );

    const existingEvent = {
      start: { dateTime: "2024-05-01T10:00:00.000Z" },
      end: { dateTime: "2024-05-01T11:00:00.000Z" },
    };

    await patchCalendarEvent(existingEvent, "cal-1", "evt-1", {
      summary: "Updated",
    });

    expect(patchMock).toHaveBeenCalledWith({
      calendarId: "cal-1",
      eventId: "evt-1",
      requestBody: {
        start: existingEvent.start,
        end: existingEvent.end,
        summary: "Updated",
      },
    });
  });

  it("inviteUserToCalendarEvent appends guest to attendees", async () => {
    const existingEvent = {
      start: { dateTime: "2024-05-01T10:00:00.000Z" },
      end: { dateTime: "2024-05-01T11:00:00.000Z" },
      data: {
        attendees: [{ email: "existing@nyu.edu" }],
      },
    };

    const patchMock = vi.fn();
    const getMock = vi.fn().mockResolvedValue(existingEvent);

    mockGetCalendarClient.mockResolvedValue({
      events: {
        get: getMock,
        patch: patchMock,
      },
    });
    mockServerGetRoomCalendarIds.mockResolvedValue(["room-cal-1"]);

    const { inviteUserToCalendarEvent } = await import(
      "@/components/src/server/calendars"
    );

    await inviteUserToCalendarEvent("evt-1", "guest@nyu.edu", 123);

    expect(patchMock).toHaveBeenCalledWith({
      calendarId: "room-cal-1",
      eventId: "evt-1",
      requestBody: expect.objectContaining({
        attendees: expect.arrayContaining([
          { email: "existing@nyu.edu" },
          { email: "guest@nyu.edu" },
        ]),
      }),
    });
  });

  it("bookingContentsToDescription formats booking details", async () => {
    const bookingContents = {
      requestNumber: "42",
      roomId: "101",
      startDate: "2024-05-01",
      startTime: "10:00 AM",
      endTime: "11:00 AM",
      origin: "user",
      netId: "abc123",
      firstName: "Test",
      lastName: "User",
      department: "ITP",
      role: "Student",
      email: "test@nyu.edu",
      phoneNumber: "555-0000",
      nNumber: "N123",
      secondaryName: "Helper",
      sponsorFirstName: "Prof",
      sponsorLastName: "Advisor",
      sponsorEmail: "advisor@nyu.edu",
      title: "Demo",
      description: "Demo event",
      bookingType: "Workshop",
      expectedAttendance: "10",
      attendeeAffiliation: "NYU",
      roomSetup: "no",
      setupDetails: "",
      equipmentServices: "",
      staffingServices: "",
      cateringService: "no",
      cleaningService: "no",
      hireSecurity: "no",
    } as any;

    const { bookingContentsToDescription } = await import(
      "@/components/src/server/calendars"
    );

    const description = await bookingContentsToDescription(
      bookingContents,
      "tenant-a",
    );

    expect(description).toContain("<h3>Request</h3>");
    expect(description).toContain("<strong>Request #:</strong> 42");
    expect(description).toContain("<strong>Status:</strong> APPROVED");
    expect(description).toContain("<strong>Origin:</strong> User");
  });

  it("updateCalendarEvent patches title prefix and description", async () => {
    const calendar = {
      events: {
        get: vi.fn().mockResolvedValue({
          data: {
            summary: "[REQUESTED] Demo Event",
            start: { dateTime: "2024-05-01T10:00:00.000Z" },
            end: { dateTime: "2024-05-01T11:00:00.000Z" },
          },
          start: { dateTime: "2024-05-01T10:00:00.000Z" },
          end: { dateTime: "2024-05-01T11:00:00.000Z" },
        }),
        patch: vi.fn(),
      },
    };

    mockGetCalendarClient.mockResolvedValue(calendar);
    mockServerGetRoomCalendarIds.mockResolvedValue(["room-cal-1"]);

    const { updateCalendarEvent } = await import(
      "@/components/src/server/calendars"
    );

    const bookingContents = {
      roomId: "101",
      requestNumber: "42",
      startDate: "2024-05-01",
      endDate: "2024-05-01",
      startTime: "10:00 AM",
      endTime: "11:00 AM",
      origin: "user",
      netId: "abc123",
      firstName: "Test",
      lastName: "User",
      department: "ITP",
      role: "Student",
      email: "test@nyu.edu",
      phoneNumber: "555-0000",
      nNumber: "N123",
      secondaryName: "Helper",
      sponsorFirstName: "Prof",
      sponsorLastName: "Advisor",
      sponsorEmail: "advisor@nyu.edu",
      title: "Demo Event",
      description: "",
      bookingType: "Workshop",
      expectedAttendance: "10",
      attendeeAffiliation: "NYU",
      roomSetup: "",
      setupDetails: "",
      equipmentServices: "",
      staffingServices: "",
      cateringService: "no",
      cleaningService: "no",
      hireSecurity: "no",
    } as any;

    await updateCalendarEvent(
      "evt-1",
      { statusPrefix: "APPROVED" },
      bookingContents,
      "tenant-a",
    );

    expect(calendar.events.patch).toHaveBeenCalledWith({
      calendarId: "room-cal-1",
      eventId: "evt-1",
      requestBody: expect.objectContaining({
        summary: "[APPROVED] Demo Event",
        description: expect.stringContaining("Request #"),
      }),
    });
  });
});
