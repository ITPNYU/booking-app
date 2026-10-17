import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  calendarIdsFromRooms,
  calendarOverlapResponse,
  checkOverlapWithClient,
  findOwnICalUID,
  type OverlapCalendarClient,
  type OverlapEvent,
} from "@/app/api/bookings/checkOverlap";

const mocks = vi.hoisted(() => ({
  getCalendarClient: vi.fn(),
}));

vi.mock("@/lib/googleClient", () => ({
  getCalendarClient: mocks.getCalendarClient,
}));

const window = {
  startStr: "2026-05-05T14:00:00.000Z",
  endStr: "2026-05-05T16:00:00.000Z",
};

function event(overrides: Partial<OverlapEvent> = {}): OverlapEvent {
  return {
    id: "other-event",
    iCalUID: "other-uid",
    summary: "[APPROVED] 202 Meeting",
    start: { dateTime: "2026-05-05T15:00:00.000Z" },
    end: { dateTime: "2026-05-05T17:00:00.000Z" },
    ...overrides,
  };
}

function client(options?: {
  items?: OverlapEvent[];
  iCalUID?: string;
  getError?: unknown;
  listByCalendar?: Record<string, OverlapEvent[]>;
}): OverlapCalendarClient & {
  events: {
    list: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
  };
} {
  return {
    events: {
      list: vi.fn(async ({ calendarId }: { calendarId: string }) => ({
        data: {
          items:
            options?.listByCalendar?.[calendarId] ?? options?.items ?? [],
        },
      })),
      get: vi.fn(async () => {
        if (options?.getError) throw options.getError;
        return { data: { iCalUID: options?.iCalUID ?? "own-uid" } };
      }),
    },
  };
}

describe("checkOverlapWithClient", () => {
  it("returns false when the calendars have no events", async () => {
    const calendar = client();
    await expect(
      checkOverlapWithClient(calendar, ["room-cal"], window),
    ).resolves.toBe(false);
  });

  it("returns true when another event overlaps the requested slot", async () => {
    const calendar = client({ items: [event()] });
    await expect(
      checkOverlapWithClient(calendar, ["room-cal"], window),
    ).resolves.toBe(true);
  });

  it("ignores an event that only touches the slot boundary", async () => {
    const calendar = client({
      items: [
        event({
          start: { dateTime: "2026-05-05T12:00:00.000Z" },
          end: { dateTime: "2026-05-05T14:00:00.000Z" },
        }),
      ],
    });
    await expect(
      checkOverlapWithClient(calendar, ["room-cal"], window),
    ).resolves.toBe(false);
  });

  it("ignores canceled, no-show, and checked-out events", async () => {
    const calendar = client({
      items: [
        event({ summary: "[CANCELED] 202 Meeting" }),
        event({ id: "no-show", summary: "[NO-SHOW] 202 Meeting" }),
        event({ id: "out", summary: "[CHECKED-OUT] 202 Meeting" }),
      ],
    });
    await expect(
      checkOverlapWithClient(calendar, ["room-cal"], window),
    ).resolves.toBe(false);
  });

  it("does not treat the booking being edited as a conflict", async () => {
    const calendar = client({
      iCalUID: "own-uid",
      items: [event({ id: "primary-id", iCalUID: "own-uid" })],
    });
    await expect(
      checkOverlapWithClient(calendar, ["room-cal"], window, {
        excludeCalendarEventId: "primary-id",
      }),
    ).resolves.toBe(false);
    expect(calendar.events.get).toHaveBeenCalledWith({
      calendarId: "room-cal",
      eventId: "primary-id",
    });
  });

  it("does not treat a guest copy on another room calendar as a conflict", async () => {
    const calendar = client({
      iCalUID: "own-uid",
      listByCalendar: {
        "room-202": [],
        "room-203": [event({ id: "guest-copy", iCalUID: "own-uid" })],
      },
    });
    await expect(
      checkOverlapWithClient(calendar, ["room-202", "room-203"], window, {
        excludeCalendarEventId: "primary-id",
        sourceCalendarIds: ["old-room"],
      }),
    ).resolves.toBe(false);
    expect(calendar.events.get).toHaveBeenCalledWith({
      calendarId: "old-room",
      eventId: "primary-id",
    });
  });

  it("still conflicts with a different event on an annex calendar", async () => {
    const calendar = client({
      iCalUID: "own-uid",
      listByCalendar: {
        "room-202": [event({ id: "primary-id", iCalUID: "own-uid" })],
        "annex-cal": [event()],
      },
    });
    await expect(
      checkOverlapWithClient(calendar, ["room-202", "annex-cal"], window, {
        excludeCalendarEventId: "primary-id",
      }),
    ).resolves.toBe(true);
  });

  it("skips a recurring instance of the event being edited", async () => {
    const calendar = client({
      getError: { response: { status: 404 } },
      items: [event({ id: "primary-id_20260505T140000Z", iCalUID: "series" })],
    });
    await expect(
      checkOverlapWithClient(calendar, ["room-cal"], window, {
        excludeCalendarEventId: "primary-id",
      }),
    ).resolves.toBe(false);
  });

  it("checks annex calendars as well as selected rooms", async () => {
    const calendar = client({
      listByCalendar: {
        "room-cal": [],
        "annex-cal": [event()],
      },
    });
    await expect(
      checkOverlapWithClient(calendar, ["room-cal", "annex-cal"], window),
    ).resolves.toBe(true);
    expect(calendar.events.list).toHaveBeenCalledWith(
      expect.objectContaining({ calendarId: "annex-cal", singleEvents: true }),
    );
  });
});

describe("findOwnICalUID", () => {
  it("reads the iCalUID from the first calendar that still has the event", async () => {
    const calendar = client({ iCalUID: "own-uid" });
    calendar.events.get
      .mockRejectedValueOnce({ response: { status: 404 } })
      .mockResolvedValueOnce({ data: { iCalUID: "own-uid" } });

    await expect(
      findOwnICalUID(calendar, "primary-id", ["old-room", "new-room"]),
    ).resolves.toBe("own-uid");
  });

  it("rethrows errors that are not a missing event", async () => {
    const calendar = client({ getError: { response: { status: 500 } } });
    await expect(
      findOwnICalUID(calendar, "primary-id", ["room-cal"]),
    ).rejects.toEqual({ response: { status: 500 } });
  });
});

describe("calendarIdsFromRooms", () => {
  it("requires a calendar id for a room being booked", () => {
    expect(() =>
      calendarIdsFromRooms([{ roomId: 202, calendarId: "" }]),
    ).toThrow(/calendarId not found for room 202/);
  });

  it("skips rooms without a calendar id when the id is only a lookup hint", () => {
    expect(
      calendarIdsFromRooms([{ roomId: 202 }, { calendarId: "room-cal" }], {
        required: false,
      }),
    ).toEqual(["room-cal"]);
  });
});

describe("calendarOverlapResponse", () => {
  beforeEach(() => {
    mocks.getCalendarClient.mockReset();
  });

  it("returns null without calling Google when there is nothing to check", async () => {
    const response = await calendarOverlapResponse({
      tenant: "mc",
      rooms: [],
      bookingCalendarInfo: window,
    });
    expect(response).toBeNull();
    expect(mocks.getCalendarClient).not.toHaveBeenCalled();
  });

  it("returns 409 when the slot is taken", async () => {
    mocks.getCalendarClient.mockResolvedValue(
      client({ items: [event()] }),
    );
    const response = await calendarOverlapResponse({
      tenant: "mc",
      rooms: [{ roomId: 202, calendarId: "room-cal" }],
      bookingCalendarInfo: window,
    });
    expect(response?.status).toBe(409);
    await expect(response?.json()).resolves.toEqual({
      error: "Time slot no longer available",
    });
  });

  it("returns 500 when Google cannot be queried", async () => {
    mocks.getCalendarClient.mockRejectedValue(new Error("auth failed"));
    const response = await calendarOverlapResponse({
      tenant: "mc",
      rooms: [{ roomId: 202, calendarId: "room-cal" }],
      bookingCalendarInfo: window,
    });
    expect(response?.status).toBe(500);
    await expect(response?.json()).resolves.toEqual({
      error: "Unable to verify room availability. Please try again.",
    });
  });
});
