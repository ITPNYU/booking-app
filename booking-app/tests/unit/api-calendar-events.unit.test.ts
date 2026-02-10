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
  _resetBookingsCacheForTesting,
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

// Helper: build a minimal GET request for a given calendarId + tenant
function makeGETRequest(calendarId: string, tenant: string) {
  return {
    url: `https://example.com/api/calendarEvents?calendarId=${calendarId}`,
    headers: new Headers({ "x-tenant": tenant }),
  } as any;
}

// Helper: stub the Google Calendar client to return the given events
function stubCalendarClient(events: any[] = []) {
  const listMock = vi.fn().mockResolvedValue({
    data: { items: events, nextPageToken: null },
  });
  mockGetCalendarClient.mockResolvedValue({
    events: { list: listMock },
  } as any);
  return listMock;
}

describe("/api/calendarEvents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetBookingsCacheForTesting();
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

  // ── Bookings cache / coalescing tests ──────────────────────────────
  describe("bookings cache (getCachedBookings)", () => {
    const tenantA = "tenant-a";
    const tenantB = "tenant-b";

    const bookingsA = [
      { calendarEventId: "ev-1", requestNumber: 1, email: "a@nyu.edu", department: "ITP" },
    ] as any[];

    const bookingsB = [
      { calendarEventId: "ev-2", requestNumber: 2, email: "b@nyu.edu", department: "Tisch" },
    ] as any[];

    it("returns cached bookings on a second call within TTL (same tenant)", async () => {
      stubCalendarClient([
        { id: "ev-1", summary: "Event 1", start: { dateTime: "2024-01-01T10:00:00Z" }, end: { dateTime: "2024-01-01T11:00:00Z" } },
      ]);
      mockServerFetchAllDataFromCollection.mockResolvedValue(bookingsA);
      mockGetBookingStatus.mockReturnValue("approved");

      // First call – populates the cache
      const res1 = await GET(makeGETRequest("cal-1", tenantA));
      expect(res1.status).toBe(200);
      expect(mockServerFetchAllDataFromCollection).toHaveBeenCalledTimes(1);

      // Re-stub the calendar client for the second call (it is NOT cached)
      stubCalendarClient([
        { id: "ev-1", summary: "Event 1", start: { dateTime: "2024-01-01T10:00:00Z" }, end: { dateTime: "2024-01-01T11:00:00Z" } },
      ]);

      // Second call – should use cached bookings, not fetch again
      const res2 = await GET(makeGETRequest("cal-2", tenantA));
      expect(res2.status).toBe(200);
      // Firestore fetch still only called once (cache hit)
      expect(mockServerFetchAllDataFromCollection).toHaveBeenCalledTimes(1);
    });

    it("does NOT share cached bookings across different tenants", async () => {
      stubCalendarClient([
        { id: "ev-1", summary: "Event 1", start: { dateTime: "2024-01-01T10:00:00Z" }, end: { dateTime: "2024-01-01T11:00:00Z" } },
      ]);
      mockServerFetchAllDataFromCollection.mockResolvedValueOnce(bookingsA);
      mockGetBookingStatus.mockReturnValue("approved");

      // First call with tenant A – populates the cache
      const res1 = await GET(makeGETRequest("cal-1", tenantA));
      expect(res1.status).toBe(200);
      expect(mockServerFetchAllDataFromCollection).toHaveBeenCalledTimes(1);
      expect(mockServerFetchAllDataFromCollection).toHaveBeenCalledWith(
        TableNames.BOOKING,
        [],
        tenantA,
      );

      // Re-stub for tenant B
      stubCalendarClient([
        { id: "ev-2", summary: "Event 2", start: { dateTime: "2024-02-01T10:00:00Z" }, end: { dateTime: "2024-02-01T11:00:00Z" } },
      ]);
      mockServerFetchAllDataFromCollection.mockResolvedValueOnce(bookingsB);

      // Second call with tenant B – cache MUST be invalidated
      const res2 = await GET(makeGETRequest("cal-1", tenantB));
      expect(res2.status).toBe(200);
      // Firestore was called again with tenant B
      expect(mockServerFetchAllDataFromCollection).toHaveBeenCalledTimes(2);
      expect(mockServerFetchAllDataFromCollection).toHaveBeenLastCalledWith(
        TableNames.BOOKING,
        [],
        tenantB,
      );

      // Verify the response actually contains tenant B's booking data
      const payload2 = await res2.json();
      expect(payload2[0].booking).toEqual(
        expect.objectContaining({
          requestNumber: 2,
          email: "b@nyu.edu",
          department: "Tisch",
        }),
      );
    });

    it("coalesces concurrent inflight requests for the same tenant", async () => {
      // Use a deferred promise so we can control when the Firestore fetch resolves
      let resolveBookings!: (value: any[]) => void;
      const deferredBookings = new Promise<any[]>((resolve) => {
        resolveBookings = resolve;
      });
      mockServerFetchAllDataFromCollection.mockReturnValue(deferredBookings);

      // Stub calendar client to allow two concurrent GET calls
      const calEvents = [
        { id: "ev-1", summary: "E1", start: { dateTime: "2024-01-01T10:00:00Z" }, end: { dateTime: "2024-01-01T11:00:00Z" } },
      ];
      // Each GET call needs its own calendar client stub
      mockGetCalendarClient
        .mockResolvedValueOnce({ events: { list: vi.fn().mockResolvedValue({ data: { items: calEvents, nextPageToken: null } }) } } as any)
        .mockResolvedValueOnce({ events: { list: vi.fn().mockResolvedValue({ data: { items: calEvents, nextPageToken: null } }) } } as any);
      mockGetBookingStatus.mockReturnValue("approved");

      // Fire two concurrent GET calls for different rooms but SAME tenant
      const p1 = GET(makeGETRequest("room-cal-1", tenantA));
      const p2 = GET(makeGETRequest("room-cal-2", tenantA));

      // Resolve the single Firestore fetch
      resolveBookings(bookingsA);

      const [res1, res2] = await Promise.all([p1, p2]);
      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);

      // Firestore was called only ONCE despite two concurrent requests
      expect(mockServerFetchAllDataFromCollection).toHaveBeenCalledTimes(1);
    });

    it("does NOT coalesce inflight requests across different tenants", async () => {
      // First tenant: use a deferred promise that stays pending
      let resolveA!: (value: any[]) => void;
      const deferredA = new Promise<any[]>((resolve) => {
        resolveA = resolve;
      });
      mockServerFetchAllDataFromCollection.mockReturnValueOnce(deferredA);

      const calEventsA = [
        { id: "ev-1", summary: "E1", start: { dateTime: "2024-01-01T10:00:00Z" }, end: { dateTime: "2024-01-01T11:00:00Z" } },
      ];
      // Calendar event for tenant B uses ev-2 so it matches bookingsB
      const calEventsB = [
        { id: "ev-2", summary: "E2", start: { dateTime: "2024-02-01T10:00:00Z" }, end: { dateTime: "2024-02-01T11:00:00Z" } },
      ];
      mockGetCalendarClient
        .mockResolvedValueOnce({ events: { list: vi.fn().mockResolvedValue({ data: { items: calEventsA, nextPageToken: null } }) } } as any);
      mockGetBookingStatus.mockReturnValue("approved");

      // Fire first request for tenant A (stays inflight)
      const p1 = GET(makeGETRequest("cal-1", tenantA));

      // Resolve tenant A so the inflight promise completes, then cache is for tenant A
      resolveA(bookingsA);
      await p1;

      // Now set up tenant B mock
      mockServerFetchAllDataFromCollection.mockReturnValueOnce(
        Promise.resolve(bookingsB),
      );
      stubCalendarClient(calEventsB);

      // Fire request for tenant B – must NOT reuse tenant A's cache
      const res2 = await GET(makeGETRequest("cal-1", tenantB));
      expect(res2.status).toBe(200);

      // Verify Firestore was called separately for each tenant
      expect(mockServerFetchAllDataFromCollection).toHaveBeenCalledTimes(2);
      expect(mockServerFetchAllDataFromCollection).toHaveBeenNthCalledWith(
        1,
        TableNames.BOOKING,
        [],
        tenantA,
      );
      expect(mockServerFetchAllDataFromCollection).toHaveBeenNthCalledWith(
        2,
        TableNames.BOOKING,
        [],
        tenantB,
      );

      // Verify tenant B got its own data
      const payload2 = await res2.json();
      expect(payload2[0].booking).toEqual(
        expect.objectContaining({ email: "b@nyu.edu" }),
      );
    });

    it("clears inflight promise on Firestore error so next call retries", async () => {
      stubCalendarClient([
        { id: "ev-1", summary: "E1", start: { dateTime: "2024-01-01T10:00:00Z" }, end: { dateTime: "2024-01-01T11:00:00Z" } },
      ]);
      mockGetBookingStatus.mockReturnValue("approved");

      // First call – Firestore rejects
      mockServerFetchAllDataFromCollection.mockRejectedValueOnce(
        new Error("Firestore unavailable"),
      );

      const res1 = await GET(makeGETRequest("cal-1", tenantA));
      // The GET handler catches the error and returns events without bookings
      expect(res1.status).toBe(200);
      const payload1 = await res1.json();
      expect(payload1[0].booking).toBeUndefined();

      // Re-stub calendar client for second call
      stubCalendarClient([
        { id: "ev-1", summary: "E1", start: { dateTime: "2024-01-01T10:00:00Z" }, end: { dateTime: "2024-01-01T11:00:00Z" } },
      ]);

      // Second call – Firestore succeeds this time
      mockServerFetchAllDataFromCollection.mockResolvedValueOnce(bookingsA);

      const res2 = await GET(makeGETRequest("cal-1", tenantA));
      expect(res2.status).toBe(200);
      const payload2 = await res2.json();
      expect(payload2[0].booking).toEqual(
        expect.objectContaining({ email: "a@nyu.edu" }),
      );

      // Firestore was called twice (error cleared the inflight, so second call retried)
      expect(mockServerFetchAllDataFromCollection).toHaveBeenCalledTimes(2);
    });

    it("refetches after TTL expires", async () => {
      const realNow = Date.now();
      const dateNowSpy = vi.spyOn(Date, "now");

      // First call at t=0
      dateNowSpy.mockReturnValue(realNow);
      stubCalendarClient([
        { id: "ev-1", summary: "E1", start: { dateTime: "2024-01-01T10:00:00Z" }, end: { dateTime: "2024-01-01T11:00:00Z" } },
      ]);
      mockServerFetchAllDataFromCollection.mockResolvedValueOnce(bookingsA);
      mockGetBookingStatus.mockReturnValue("approved");

      await GET(makeGETRequest("cal-1", tenantA));
      expect(mockServerFetchAllDataFromCollection).toHaveBeenCalledTimes(1);

      // Advance Date.now() beyond the 30s TTL
      dateNowSpy.mockReturnValue(realNow + 31_000);

      // Re-stub for the next call
      stubCalendarClient([
        { id: "ev-1", summary: "E1", start: { dateTime: "2024-01-01T10:00:00Z" }, end: { dateTime: "2024-01-01T11:00:00Z" } },
      ]);
      mockServerFetchAllDataFromCollection.mockResolvedValueOnce(bookingsA);

      // Second call – cache expired, must refetch
      await GET(makeGETRequest("cal-1", tenantA));
      expect(mockServerFetchAllDataFromCollection).toHaveBeenCalledTimes(2);

      dateNowSpy.mockRestore();
    });
  });
});
