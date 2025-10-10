import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/src/server/calendars", () => ({
  deleteEvent: vi.fn(),
  insertEvent: vi.fn(),
  updateCalendarEvent: vi.fn(),
}));

vi.mock("@/components/src/server/admin", () => ({
  serverBookingContents: vi.fn(),
}));

vi.mock("@/lib/firebase/server/adminDb", () => ({
  serverFetchAllDataFromCollection: vi.fn(),
}));

vi.mock("@/lib/googleClient", () => ({
  getCalendarClient: vi.fn(),
}));

vi.mock("@/components/src/client/routes/hooks/getBookingStatus", () => ({
  __esModule: true,
  default: vi.fn(),
}));

import {
  DELETE,
  GET,
  POST,
  PUT,
} from "@/app/api/calendarEvents/route";
import {
  deleteEvent,
  insertEvent,
  updateCalendarEvent,
} from "@/components/src/server/calendars";
import { serverBookingContents } from "@/components/src/server/admin";
import { TableNames } from "@/components/src/policy";
import getBookingStatus from "@/components/src/client/routes/hooks/getBookingStatus";
import { serverFetchAllDataFromCollection } from "@/lib/firebase/server/adminDb";
import { getCalendarClient } from "@/lib/googleClient";

const mockInsertEvent = vi.mocked(insertEvent);
const mockDeleteEvent = vi.mocked(deleteEvent);
const mockUpdateCalendarEvent = vi.mocked(updateCalendarEvent);
const mockServerBookingContents = vi.mocked(serverBookingContents);
const mockServerFetchAllDataFromCollection = vi.mocked(
  serverFetchAllDataFromCollection,
);
const mockGetCalendarClient = vi.mocked(getCalendarClient);
const mockGetBookingStatus = vi.mocked(getBookingStatus);

describe("/api/calendarEvents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET", () => {
    it("returns enriched calendar events when data is available", async () => {
      const listMock = vi
        .fn()
        .mockResolvedValueOnce({
          data: {
            items: [
              {
                id: "cal-event-1",
                summary: "Orientation",
                start: { dateTime: "2024-09-01T10:00:00.000Z" },
                end: { dateTime: "2024-09-01T12:00:00.000Z" },
              },
            ],
            nextPageToken: null,
          },
        });

      mockGetCalendarClient.mockResolvedValueOnce({
        events: { list: listMock },
      } as any);

      mockServerFetchAllDataFromCollection.mockResolvedValueOnce([
        {
          calendarEventId: "cal-event-1",
          requestNumber: 99,
          email: "student@nyu.edu",
          department: "ITP",
        } as any,
      ]);

      mockGetBookingStatus.mockReturnValue("approved");

      const request = {
        url: "https://example.com/api/calendarEvents?calendarId=gmail-calendar",
        headers: new Headers({ "x-tenant": "tenant-one" }),
      } as any;

      const response = await GET(request);

      expect(response.status).toBe(200);

      const payload = await response.json();
      expect(payload).toEqual([
        {
          title: "Orientation",
          start: "2024-09-01T10:00:00.000Z",
          end: "2024-09-01T12:00:00.000Z",
          calendarEventId: "cal-event-1",
          booking: {
            status: "approved",
            requestNumber: 99,
            email: "student@nyu.edu",
            department: "ITP",
          },
        },
      ]);

      expect(listMock).toHaveBeenCalledWith({
        calendarId: "gmail-calendar",
        timeMin: expect.any(String),
        timeMax: expect.any(String),
        singleEvents: true,
        orderBy: "startTime",
        maxResults: 1000,
        pageToken: undefined,
      });

      expect(mockServerFetchAllDataFromCollection).toHaveBeenCalledWith(
        TableNames.BOOKING,
        [],
        "tenant-one",
      );
    });

    it("validates calendarId", async () => {
      const request = {
        url: "https://example.com/api/calendarEvents",
        headers: new Headers(),
      } as any;

      const response = await GET(request);

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        error: "Invalid calendarId",
      });
      expect(mockGetCalendarClient).not.toHaveBeenCalled();
    });
  });

  describe("POST", () => {
    const basePayload = {
      calendarId: "gmail-calendar",
      title: "Guest Lecture",
      description: "Lecture in room 101",
      startTime: "2024-09-15T14:00:00.000Z",
      endTime: "2024-09-15T15:00:00.000Z",
      roomEmails: ["room101@nyu.edu"],
    } as const;

    it("creates a calendar event", async () => {
      mockInsertEvent.mockResolvedValueOnce({ id: "created-event" });

      const request = {
        json: async () => basePayload,
      } as any;

      const response = await POST(request);

      expect(mockInsertEvent).toHaveBeenCalledWith({ ...basePayload });
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        calendarEventId: "created-event",
      });
    });

    it("requires all fields", async () => {
      const request = {
        json: async () => ({ ...basePayload, calendarId: undefined }),
      } as any;

      const response = await POST(request);

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        error: "Missing required fields",
      });
      expect(mockInsertEvent).not.toHaveBeenCalled();
    });

    it("handles insertion errors", async () => {
      mockInsertEvent.mockRejectedValueOnce(new Error("Calendar offline"));

      const request = {
        json: async () => basePayload,
      } as any;

      const response = await POST(request);

      expect(response.status).toBe(500);
      await expect(response.json()).resolves.toEqual({
        error: "Failed to add event to calendar",
      });
    });
  });

  describe("PUT", () => {
    const payload = {
      calendarEventId: "cal-event-1",
      newValues: { summary: "Updated title" },
    } as const;

    it("updates a calendar event using the tenant context", async () => {
      mockServerBookingContents.mockResolvedValueOnce({ id: "booking-1" } as any);

      const request = {
        json: async () => payload,
        headers: new Headers({ "x-tenant": "tenant-two" }),
      } as any;

      const response = await PUT(request);

      expect(mockServerBookingContents).toHaveBeenCalledWith(
        payload.calendarEventId,
        "tenant-two",
      );
      expect(mockUpdateCalendarEvent).toHaveBeenCalledWith(
        payload.calendarEventId,
        payload.newValues,
        { id: "booking-1" },
        "tenant-two",
      );
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        message: "Event updated successfully",
      });
    });

    it("validates input", async () => {
      const request = {
        json: async () => ({}) as any,
        headers: new Headers(),
      } as any;

      const response = await PUT(request);

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        error: "Missing required fields",
      });
      expect(mockUpdateCalendarEvent).not.toHaveBeenCalled();
    });

    it("surfaces update failures", async () => {
      mockServerBookingContents.mockResolvedValueOnce({ id: "booking-1" } as any);
      mockUpdateCalendarEvent.mockRejectedValueOnce(new Error("Calendar API"));

      const request = {
        json: async () => payload,
        headers: new Headers(),
      } as any;

      const response = await PUT(request);

      expect(response.status).toBe(500);
      await expect(response.json()).resolves.toEqual({
        error: "Failed to update event",
      });
    });
  });

  describe("DELETE", () => {
    it("requires both calendarId and calendarEventId", async () => {
      const request = {
        json: async () => ({ calendarId: "gmail-calendar" }),
      } as any;

      const response = await DELETE(request);

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        error: "Missing required fields",
      });
      expect(mockDeleteEvent).not.toHaveBeenCalled();
    });

    it("deletes the requested event", async () => {
      const request = {
        json: async () => ({
          calendarId: "gmail-calendar",
          calendarEventId: "cal-event-1",
        }),
      } as any;

      const response = await DELETE(request);

      expect(mockDeleteEvent).toHaveBeenCalledWith(
        "gmail-calendar",
        "cal-event-1",
      );
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        message: "Event deleted successfully",
      });
    });
  });
});
