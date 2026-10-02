import { describe, expect, it } from "vitest";
import {
  DEFAULT_APPROVED_FROM,
  DEFAULT_APPROVED_TO,
  guestEmailsForBooking,
  isAffectedBooking,
  isMissingEventError,
  isRateLimitError,
  missingGuests,
  orderOrganizerFirst,
  resolveRoomCalendarIds,
  splitRoomIds,
} from "@/scripts/lib/multiRoomInviteBackfill";

const window = {
  approvedFrom: new Date(DEFAULT_APPROVED_FROM),
  approvedTo: new Date(DEFAULT_APPROVED_TO),
};
const inWindow = new Date("2026-08-19T16:51:38Z");

describe("splitRoomIds", () => {
  it("splits a comma-joined roomId list", () => {
    expect(splitRoomIds("220, 221,222 ")).toEqual(["220", "221", "222"]);
  });

  it("handles single, numeric, and missing roomIds", () => {
    expect(splitRoomIds("220")).toEqual(["220"]);
    expect(splitRoomIds(220)).toEqual(["220"]);
    expect(splitRoomIds(undefined)).toEqual([]);
  });
});

describe("isAffectedBooking", () => {
  const booking = { roomId: "220, 221", finalApprovedAt: inWindow };

  it("matches a multi-room booking approved in the window", () => {
    expect(isAffectedBooking(booking, window)).toBe(true);
  });

  it("ignores single-room bookings", () => {
    expect(isAffectedBooking({ ...booking, roomId: "220" }, window)).toBe(
      false,
    );
  });

  it("ignores approvals outside the window", () => {
    for (const finalApprovedAt of [
      new Date("2026-04-17T18:08:00Z"),
      new Date(DEFAULT_APPROVED_TO),
      null,
    ]) {
      expect(isAffectedBooking({ ...booking, finalApprovedAt }, window)).toBe(
        false,
      );
    }
  });

  it("ignores bookings that are no longer live", () => {
    for (const field of [
      "canceledAt",
      "declinedAt",
      "noShowedAt",
      "checkedOutAt",
    ]) {
      expect(
        isAffectedBooking({ ...booking, [field]: new Date() }, window),
      ).toBe(false);
    }
  });
});

describe("guestEmailsForBooking", () => {
  it("returns the requester and secondary contact", () => {
    expect(
      guestEmailsForBooking({
        email: "abc123@nyu.edu",
        secondaryEmail: "xyz9@nyu.edu",
      }),
    ).toEqual(["abc123@nyu.edu", "xyz9@nyu.edu"]);
  });

  it("expands a bare net ID and drops blanks and duplicates", () => {
    expect(
      guestEmailsForBooking({ email: "abc123@nyu.edu", secondaryEmail: "" }),
    ).toEqual(["abc123@nyu.edu"]);
    expect(
      guestEmailsForBooking({
        email: "abc123@nyu.edu",
        secondaryEmail: "ABC123",
      }),
    ).toEqual(["abc123@nyu.edu"]);
  });
});

describe("missingGuests", () => {
  it("returns only guests not yet on the event, case-insensitively", () => {
    expect(
      missingGuests(
        [{ email: "room@group.calendar.google.com" }, { email: "A@nyu.edu" }],
        ["a@nyu.edu", "b@nyu.edu"],
      ),
    ).toEqual(["b@nyu.edu"]);
  });

  it("treats a missing attendee list as empty", () => {
    expect(missingGuests(undefined, ["a@nyu.edu"])).toEqual(["a@nyu.edu"]);
  });
});

describe("resolveRoomCalendarIds", () => {
  const resources = [
    { resourceId: "220", calendarId: "c220", calendarIdProd: "p220" },
    { roomId: 221, calendarId: "c221", calendarIdDev: "d221" },
  ];

  it("uses the production calendar in production", () => {
    expect(resolveRoomCalendarIds(resources, ["220", "221"], true)).toEqual({
      calendarIds: ["p220"],
      unresolvedRoomIds: ["221"],
    });
  });

  it("prefers the dev calendar elsewhere and reports unknown rooms", () => {
    expect(
      resolveRoomCalendarIds(resources, ["220", "221", "999"], false),
    ).toEqual({
      calendarIds: ["c220", "d221"],
      unresolvedRoomIds: ["999"],
    });
  });
});

describe("orderOrganizerFirst", () => {
  it("moves the organizer's calendar to the front", () => {
    expect(orderOrganizerFirst(["a", "b", "c"], "c")).toEqual(["c", "a", "b"]);
  });

  it("keeps the order when the organizer is not a room calendar", () => {
    expect(orderOrganizerFirst(["a", "b"], "someone@nyu.edu")).toEqual([
      "a",
      "b",
    ]);
    expect(orderOrganizerFirst(["a", "b"], undefined)).toEqual(["a", "b"]);
  });
});

describe("Google API error classification", () => {
  it("recognizes a missing event from numeric or string status fields", () => {
    expect(isMissingEventError({ code: 404 })).toBe(true);
    expect(isMissingEventError({ code: "404" })).toBe(true);
    expect(isMissingEventError({ status: 410 })).toBe(true);
    expect(isMissingEventError({ response: { status: 404 }, code: "x" })).toBe(
      true,
    );
    expect(isMissingEventError({ code: 403 })).toBe(false);
    expect(isMissingEventError(new Error("boom"))).toBe(false);
  });

  it("recognizes rate limits but not other 403s", () => {
    expect(isRateLimitError({ code: "429" })).toBe(true);
    expect(
      isRateLimitError({ code: 403, message: "Rate Limit Exceeded" }),
    ).toBe(true);
    expect(
      isRateLimitError({
        response: { status: 403 },
        errors: [{ reason: "userRateLimitExceeded" }],
      }),
    ).toBe(true);
    expect(isRateLimitError({ code: 403, message: "Forbidden" })).toBe(false);
    expect(isRateLimitError({ code: 404 })).toBe(false);
  });
});
