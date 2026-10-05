import { describe, expect, it } from "vitest";
import {
  isOwnCalendarEvent,
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

  it("matches a guest copy stamped with the Firestore booking id", () => {
    expect(
      isOwnCalendarEvent(
        {
          id: "google-guest-copy:203:2026-09-18T14:00:00-04:00",
          calendarEventId,
          resourceId: "203",
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
