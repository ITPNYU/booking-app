import {
  getInterimHours,
  getLatestStatusChangeMs,
} from "@/components/src/client/routes/components/bookingTable/hooks/getInterimHours";
import { BookingRow, BookingStatusLabel } from "@/components/src/types";
import { Timestamp } from "firebase/firestore";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function makeRow(overrides: Partial<BookingRow> = {}): BookingRow {
  return {
    calendarEventId: "evt-1",
    email: "test@nyu.edu",
    startDate: Timestamp.fromDate(new Date("2024-01-01T00:00:00Z")),
    endDate: Timestamp.fromDate(new Date("2024-01-01T01:00:00Z")),
    roomId: "101",
    requestNumber: 1,
    equipmentCheckedOut: false,
    status: BookingStatusLabel.REQUESTED,
    id: "evt-1",
    ...overrides,
  } as BookingRow;
}

describe("getLatestStatusChangeMs", () => {
  it("returns 0 when no status timestamps are set", () => {
    const row = makeRow();
    expect(getLatestStatusChangeMs(row)).toBe(0);
  });

  it("returns the timestamp when only requestedAt is set", () => {
    const date = new Date("2024-06-15T12:00:00Z");
    const row = makeRow({ requestedAt: Timestamp.fromDate(date) });
    expect(getLatestStatusChangeMs(row)).toBe(date.getTime());
  });

  it("returns the most recent timestamp among multiple status fields", () => {
    const earlier = new Date("2024-06-10T10:00:00Z");
    const later = new Date("2024-06-15T14:00:00Z");
    const latest = new Date("2024-06-20T09:00:00Z");

    const row = makeRow({
      requestedAt: Timestamp.fromDate(earlier),
      firstApprovedAt: Timestamp.fromDate(latest),
      finalApprovedAt: Timestamp.fromDate(later),
    });

    expect(getLatestStatusChangeMs(row)).toBe(latest.getTime());
  });

  it("ignores null and undefined timestamp fields", () => {
    const date = new Date("2024-06-15T12:00:00Z");
    const row = makeRow({
      requestedAt: Timestamp.fromDate(date),
      firstApprovedAt: null as any,
      declinedAt: undefined as any,
    });

    expect(getLatestStatusChangeMs(row)).toBe(date.getTime());
  });

  it("ignores values that lack a toDate method", () => {
    const date = new Date("2024-06-15T12:00:00Z");
    const row = makeRow({
      requestedAt: Timestamp.fromDate(date),
      canceledAt: "not-a-timestamp" as any,
    });

    expect(getLatestStatusChangeMs(row)).toBe(date.getTime());
  });

  it("handles plain Date objects (e.g. from fake/test data)", () => {
    const date = new Date("2024-06-15T12:00:00Z");
    const row = makeRow({ requestedAt: date as any });
    expect(getLatestStatusChangeMs(row)).toBe(date.getTime());
  });

  it("picks the latest across mixed Timestamp and plain Date values", () => {
    const earlier = new Date("2024-06-10T10:00:00Z");
    const later = new Date("2024-06-15T14:00:00Z");
    const row = makeRow({
      requestedAt: Timestamp.fromDate(earlier),
      firstApprovedAt: later as any,
    });
    expect(getLatestStatusChangeMs(row)).toBe(later.getTime());
  });

  it("handles all status timestamp fields correctly", () => {
    const base = new Date("2024-01-01T00:00:00Z");
    const fields = [
      "requestedAt",
      "firstApprovedAt",
      "finalApprovedAt",
      "equipmentAt",
      "equipmentApprovedAt",
      "declinedAt",
      "canceledAt",
      "checkedInAt",
      "checkedOutAt",
      "noShowedAt",
      "closedAt",
      "walkedInAt",
    ] as const;

    for (const field of fields) {
      const date = new Date(base.getTime() + 1000);
      const row = makeRow({ [field]: Timestamp.fromDate(date) });
      expect(getLatestStatusChangeMs(row)).toBe(date.getTime());
    }
  });
});

describe("getInterimHours", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-20T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns null when no status timestamps are set", () => {
    const row = makeRow();
    expect(getInterimHours(row)).toBeNull();
  });

  it("returns correct hours since last status change", () => {
    const twoHoursAgo = new Date("2024-06-20T10:00:00Z");
    const row = makeRow({ requestedAt: Timestamp.fromDate(twoHoursAgo) });

    expect(getInterimHours(row)).toBeCloseTo(2.0, 1);
  });

  it("uses the most recent timestamp for the calculation", () => {
    const tenHoursAgo = new Date("2024-06-20T02:00:00Z");
    const threeHoursAgo = new Date("2024-06-20T09:00:00Z");

    const row = makeRow({
      requestedAt: Timestamp.fromDate(tenHoursAgo),
      firstApprovedAt: Timestamp.fromDate(threeHoursAgo),
    });

    expect(getInterimHours(row)).toBeCloseTo(3.0, 1);
  });

  it("returns fractional hours", () => {
    const ninetyMinutesAgo = new Date("2024-06-20T10:30:00Z");
    const row = makeRow({ requestedAt: Timestamp.fromDate(ninetyMinutesAgo) });

    expect(getInterimHours(row)).toBeCloseTo(1.5, 1);
  });

  it("returns 0 when the status just changed", () => {
    const now = new Date("2024-06-20T12:00:00Z");
    const row = makeRow({ requestedAt: Timestamp.fromDate(now) });

    expect(getInterimHours(row)).toBeCloseTo(0, 1);
  });

  it("clamps to 0 when the latest timestamp is in the future (clock skew)", () => {
    const future = new Date("2024-06-20T14:00:00Z");
    const row = makeRow({ requestedAt: Timestamp.fromDate(future) });

    expect(getInterimHours(row)).toBe(0);
  });

  it("works correctly with a plain Date object (fake/test data)", () => {
    const twoHoursAgo = new Date("2024-06-20T10:00:00Z");
    const row = makeRow({ requestedAt: twoHoursAgo as any });

    expect(getInterimHours(row)).toBeCloseTo(2.0, 1);
  });
});
