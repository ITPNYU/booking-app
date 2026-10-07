import { describe, expect, it } from "vitest";
import {
  buildBookingMatchIndex,
  findBookingForCalendarEvent,
  roomIdsByCalendarId,
} from "@/lib/utils/matchCalendarEventToBooking";

describe("findBookingForCalendarEvent", () => {
  const start = "2026-09-18T18:00:00.000Z";
  const end = "2026-09-18T20:00:00.000Z";

  const originalBooking = {
    calendarEventId: "primary-id",
    roomId: "202, 203",
    startDate: { toDate: () => new Date(start) },
    endDate: { toDate: () => new Date(end) },
  };

  const find = (
    event: Parameters<typeof findBookingForCalendarEvent>[0],
    bookings: typeof originalBooking[],
    roomIds: string[],
  ) => findBookingForCalendarEvent(event, buildBookingMatchIndex(bookings), roomIds);

  it("matches by Google event id first", () => {
    expect(
      find(
        {
          id: "primary-id",
          start: { dateTime: start },
          end: { dateTime: end },
        },
        [originalBooking],
        ["203"],
      ),
    ).toBe(originalBooking);
  });

  it("matches a guest copy on another room calendar by unique room+time", () => {
    expect(
      find(
        {
          id: "google-guest-copy",
          start: { dateTime: start },
          end: { dateTime: end },
        },
        [originalBooking],
        ["203"],
      ),
    ).toBe(originalBooking);
  });

  it("matches a guest copy whose time falls in an adjacent 60s bucket", () => {
    const eventStart = new Date("2026-09-18T17:59:30.000Z").toISOString();
    const eventEnd = new Date("2026-09-18T19:59:30.000Z").toISOString();
    expect(
      find(
        {
          id: "google-guest-copy",
          start: { dateTime: eventStart },
          end: { dateTime: eventEnd },
        },
        [originalBooking],
        ["203"],
      ),
    ).toBe(originalBooking);
  });

  it("does not match a guest copy when another booking occupies the same slot", () => {
    const otherBooking = {
      calendarEventId: "other-id",
      roomId: "203",
      startDate: { toDate: () => new Date(start) },
      endDate: { toDate: () => new Date(end) },
    };

    expect(
      find(
        {
          id: "google-guest-copy",
          start: { dateTime: start },
          end: { dateTime: end },
        },
        [originalBooking, otherBooking],
        ["203"],
      ),
    ).toBeUndefined();
  });

  it("does not match a booking for a different room", () => {
    expect(
      find(
        {
          id: "google-guest-copy",
          start: { dateTime: start },
          end: { dateTime: end },
        },
        [originalBooking],
        ["999"],
      ),
    ).toBeUndefined();
  });
});

describe("roomIdsByCalendarId", () => {
  it("groups room ids by calendar id", () => {
    expect(
      roomIdsByCalendarId([
        { roomId: 202, calendarId: "cal-a" },
        { roomId: "203", calendarId: "cal-b" },
        { roomId: 204, calendarId: "cal-a" },
      ]),
    ).toEqual(
      new Map([
        ["cal-a", ["202", "204"]],
        ["cal-b", ["203"]],
      ]),
    );
  });
});
