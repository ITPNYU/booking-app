import {
  formatBookingInterimHours,
  getBookingInterimHours,
  shouldHighlightBookingInterim,
} from "@/components/src/utils/bookingInterimHours";
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

describe("getBookingInterimHours", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-20T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns null when awaiting approval but requestedAt is missing", () => {
    const row = makeRow({ status: BookingStatusLabel.REQUESTED });
    expect(getBookingInterimHours(row)).toBeNull();
  });

  it("returns hours since requestedAt while status is REQUESTED", () => {
    const twoHoursAgo = new Date("2024-06-20T10:00:00Z");
    const row = makeRow({
      status: BookingStatusLabel.REQUESTED,
      requestedAt: Timestamp.fromDate(twoHoursAgo),
    });
    expect(getBookingInterimHours(row)).toBeCloseTo(2.0, 1);
  });

  it("returns 0 when status is APPROVED", () => {
    const row = makeRow({
      status: BookingStatusLabel.APPROVED,
      requestedAt: Timestamp.fromDate(new Date("2024-06-01T10:00:00Z")),
    });
    expect(getBookingInterimHours(row)).toBe(0);
  });

  it("returns null when status is DECLINED", () => {
    const row = makeRow({
      status: BookingStatusLabel.DECLINED,
      requestedAt: Timestamp.fromDate(new Date("2024-06-20T10:00:00Z")),
    });
    expect(getBookingInterimHours(row)).toBeNull();
  });

  it("uses fractional hours", () => {
    const ninetyMinutesAgo = new Date("2024-06-20T10:30:00Z");
    const row = makeRow({
      status: BookingStatusLabel.REQUESTED,
      requestedAt: Timestamp.fromDate(ninetyMinutesAgo),
    });
    expect(getBookingInterimHours(row)).toBeCloseTo(1.5, 1);
  });
});

describe("shouldHighlightBookingInterim", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-20T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns true when interim meets threshold", () => {
    const row = makeRow({
      status: BookingStatusLabel.REQUESTED,
      requestedAt: Timestamp.fromDate(new Date("2024-06-19T12:00:00Z")),
    });
    expect(shouldHighlightBookingInterim(row, undefined, 18)).toBe(true);
  });

  it("returns false when below threshold", () => {
    const row = makeRow({
      status: BookingStatusLabel.REQUESTED,
      requestedAt: Timestamp.fromDate(new Date("2024-06-20T10:00:00Z")),
    });
    expect(shouldHighlightBookingInterim(row, undefined, 18)).toBe(false);
  });
});

describe("formatBookingInterimHours", () => {
  it("formats null as em dash", () => {
    expect(formatBookingInterimHours(null)).toBe("—");
  });

  it("formats numbers with one decimal", () => {
    expect(formatBookingInterimHours(18.25)).toBe("18.3");
  });
});
