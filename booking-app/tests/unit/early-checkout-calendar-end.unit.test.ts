import { beforeEach, describe, expect, it, vi } from "vitest";

import { BookingStatusLabel } from "@/components/src/types";
import {
  getEarlyCheckoutEndTime,
  roundUpToQuarterHour,
} from "@/components/src/utils/earlyCheckoutEnd";

const mockServerGetDataByCalendarEventId = vi.fn();
const mockServerUpdateDataByCalendarEventId = vi.fn();
const mockUpdateCalendarEvent = vi.fn();
const mockServerBookingContents = vi.fn();
let mockNow = new Date("2025-01-15T15:07:00Z");

vi.mock("@/lib/firebase/server/adminDb", () => ({
  logServerBookingChange: vi.fn(),
  serverGetDataByCalendarEventId: (...args: unknown[]) =>
    mockServerGetDataByCalendarEventId(...args),
}));

vi.mock("@/components/src/server/calendars", () => ({
  updateCalendarEvent: (...args: unknown[]) => mockUpdateCalendarEvent(...args),
}));

vi.mock("@/components/src/server/admin", () => ({
  serverBookingContents: (...args: unknown[]) =>
    mockServerBookingContents(...args),
  serverSendBookingDetailEmail: vi.fn(),
  serverUpdateDataByCalendarEventId: (...args: unknown[]) =>
    mockServerUpdateDataByCalendarEventId(...args),
}));

vi.mock("@/components/src/server/emails", () => ({
  getTenantEmailConfig: vi.fn().mockResolvedValue({
    emailNotifications: { checkedOut: "Checked out" },
  }),
}));

vi.mock("firebase-admin/firestore", () => ({
  Timestamp: {
    now: () => ({ toDate: () => mockNow }),
  },
}));

const ts = (iso: string) => ({ toDate: () => new Date(iso) });

describe("roundUpToQuarterHour", () => {
  it.each([
    ["2025-01-15T15:00:00.000Z", "2025-01-15T15:00:00.000Z"],
    ["2025-01-15T15:00:01.000Z", "2025-01-15T15:15:00.000Z"],
    ["2025-01-15T15:07:00.000Z", "2025-01-15T15:15:00.000Z"],
    ["2025-01-15T15:15:00.000Z", "2025-01-15T15:15:00.000Z"],
    ["2025-01-15T15:31:00.000Z", "2025-01-15T15:45:00.000Z"],
    ["2025-01-15T15:46:00.000Z", "2025-01-15T16:00:00.000Z"],
  ])("rounds %s up to %s", (input, expected) => {
    expect(roundUpToQuarterHour(new Date(input)).toISOString()).toBe(expected);
  });
});

describe("getEarlyCheckoutEndTime", () => {
  const startDate = ts("2025-01-15T14:00:00Z");
  const endDate = ts("2025-01-15T17:00:00Z");

  it("returns the rounded-up checkout time for an early checkout", () => {
    expect(
      getEarlyCheckoutEndTime({
        checkedOutAt: new Date("2025-01-15T15:07:00Z"),
        startDate,
        endDate,
      })?.toISOString(),
    ).toBe("2025-01-15T15:15:00.000Z");
  });

  it("returns null when rounding reaches the scheduled end", () => {
    expect(
      getEarlyCheckoutEndTime({
        checkedOutAt: new Date("2025-01-15T16:50:00Z"),
        startDate,
        endDate,
      }),
    ).toBeNull();
  });

  it("returns null when checked out after the scheduled end", () => {
    expect(
      getEarlyCheckoutEndTime({
        checkedOutAt: new Date("2025-01-15T17:20:00Z"),
        startDate,
        endDate,
      }),
    ).toBeNull();
  });

  it("returns null when the rounded end would not be after the start", () => {
    expect(
      getEarlyCheckoutEndTime({
        checkedOutAt: new Date("2025-01-15T13:50:00Z"),
        startDate,
        endDate,
      }),
    ).toBeNull();
  });

  it("returns null when booking dates are missing", () => {
    expect(
      getEarlyCheckoutEndTime({
        checkedOutAt: new Date("2025-01-15T15:07:00Z"),
        startDate: undefined,
        endDate,
      }),
    ).toBeNull();
  });
});

describe("POST /api/checkout-processing calendar end time", () => {
  const callRoute = async () => {
    const { POST } = await import("@/app/api/checkout-processing/route");
    return POST({
      json: async () => ({
        calendarEventId: "cal-1",
        email: "admin@nyu.edu",
        tenant: "mc",
      }),
    } as any);
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockServerGetDataByCalendarEventId.mockResolvedValue({
      id: "booking-1",
      requestNumber: 1,
      email: "student@nyu.edu",
      startDate: ts("2025-01-15T14:00:00Z"),
      endDate: ts("2025-01-15T17:00:00Z"),
    });
    mockServerBookingContents.mockResolvedValue({ roomId: "room-1" });
  });

  it("shortens the calendar event on an early checkout", async () => {
    mockNow = new Date("2025-01-15T15:07:00Z");
    await callRoute();

    expect(mockUpdateCalendarEvent).toHaveBeenCalledWith(
      "cal-1",
      {
        statusPrefix: BookingStatusLabel.CHECKED_OUT,
        end: { dateTime: "2025-01-15T15:15:00.000Z" },
      },
      { roomId: "room-1" },
      "mc",
    );
  });

  it("keeps the scheduled end when checked out at or after it", async () => {
    mockNow = new Date("2025-01-15T17:05:00Z");
    await callRoute();

    expect(mockUpdateCalendarEvent).toHaveBeenCalledWith(
      "cal-1",
      { statusPrefix: BookingStatusLabel.CHECKED_OUT },
      { roomId: "room-1" },
      "mc",
    );
  });
});
