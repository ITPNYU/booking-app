import { describe, expect, it } from "vitest";
import {
  isOwnCalendarEvent,
  isSameSlotAsBooking,
  isUnmatchedCopyOfBooking,
  normalizeCalendarEventId,
} from "@/components/src/client/routes/booking/utils/isOwnCalendarEvent";

describe("isOwnCalendarEvent", () => {
  const calendarEventId = "abc123xyz";

  it("matches a composite fetchCalendarEvents id that includes a timestamp with colons", () => {
    expect(
      isOwnCalendarEvent(
        {
          id: `${calendarEventId}:202:2026-09-18T14:00:00-04:00`,
          calendarEventId,
          resourceId: "202",
        },
        calendarEventId,
      ),
    ).toBe(true);
  });

  it("does not treat split(':')[0] of a timestamp as the event id", () => {
    expect(
      isOwnCalendarEvent(
        {
          id: `other-event:202:2026-09-18T14:00:00-04:00`,
          calendarEventId: "other-event",
          resourceId: "202",
        },
        calendarEventId,
      ),
    ).toBe(false);
  });

  it("matches Google recurring instance ids suffixed with _timestamp", () => {
    expect(
      isOwnCalendarEvent(
        {
          id: `${calendarEventId}_20260918T180000Z:202:start`,
          calendarEventId: `${calendarEventId}_20260918T180000Z`,
        },
        calendarEventId,
      ),
    ).toBe(true);
  });

  it("matches calendarEventId stored on extendedProps", () => {
    expect(
      isOwnCalendarEvent(
        {
          id: "fc-internal-id",
          extendedProps: { calendarEventId },
        },
        calendarEventId,
      ),
    ).toBe(true);
  });

  it("decodes URL-encoded ids", () => {
    expect(normalizeCalendarEventId("abc%5Fdef")).toBe("abc_def");
    expect(
      isOwnCalendarEvent({ id: "abc_def:202:start" }, "abc%5Fdef"),
    ).toBe(true);
  });
});

describe("isSameSlotAsBooking", () => {
  const start = new Date("2026-09-18T18:00:00.000Z");
  const end = new Date("2026-09-18T20:00:00.000Z");

  it("matches the same room and time as the booking being modified", () => {
    expect(
      isSameSlotAsBooking(
        {
          id: "google-copy-id:202:start",
          resourceId: "202",
          start: start.toISOString(),
          end: end.toISOString(),
        },
        {
          calendarEventId: "original-id",
          roomId: "202",
          startDate: { toDate: () => start },
          endDate: { toDate: () => end },
        },
      ),
    ).toBe(true);
  });

  it("does not match a different room or time", () => {
    expect(
      isSameSlotAsBooking(
        {
          id: "other",
          resourceId: "203",
          start: start.toISOString(),
          end: end.toISOString(),
        },
        {
          roomId: "202",
          startDate: { toDate: () => start },
          endDate: { toDate: () => end },
        },
      ),
    ).toBe(false);
  });
});

describe("isUnmatchedCopyOfBooking", () => {
  const start = new Date("2026-09-18T18:00:00.000Z");
  const end = new Date("2026-09-18T20:00:00.000Z");
  const originalBooking = {
    calendarEventId: "original-id",
    roomId: "202",
    startDate: { toDate: () => start },
    endDate: { toDate: () => end },
  };

  it("treats a same-slot Google copy with an unknown id as this booking", () => {
    expect(
      isUnmatchedCopyOfBooking(
        {
          id: "google-copy-id:202:start",
          resourceId: "202",
          start: start.toISOString(),
          end: end.toISOString(),
        },
        originalBooking,
        [originalBooking],
      ),
    ).toBe(true);
  });

  it("does not hide a different Firestore booking at the same slot", () => {
    expect(
      isUnmatchedCopyOfBooking(
        {
          id: "other-booking:202:start",
          calendarEventId: "other-booking",
          resourceId: "202",
          start: start.toISOString(),
          end: end.toISOString(),
        },
        originalBooking,
        [
          originalBooking,
          {
            calendarEventId: "other-booking",
            roomId: "202",
            startDate: { toDate: () => start },
            endDate: { toDate: () => end },
          },
        ],
      ),
    ).toBe(false);
  });
});
