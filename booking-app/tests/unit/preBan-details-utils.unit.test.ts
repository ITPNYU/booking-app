import { describe, expect, it, vi } from "vitest";

// setup.ts mocks firebase/firestore with a non-construct Timestamp; use the real module here.
vi.unmock("firebase/firestore");

import { Timestamp } from "firebase/firestore";
import {
  comparePreBanDetails,
  PreBanDetails,
  preBanEventMillis,
} from "@/components/src/client/routes/admin/components/preBanDetailsUtils";
import { PreBanLog } from "@/components/src/types";

function baseLog(overrides: Partial<PreBanLog> = {}): PreBanLog {
  return {
    id: "log-1",
    bookingId: "booking-1",
    netId: "abc123",
    ...overrides,
  };
}

function detail(
  overrides: Partial<PreBanDetails> &
    Pick<PreBanDetails, "id" | "bookingId">,
): PreBanDetails {
  return {
    date: "1/1/2024",
    eventTimeMs: 0,
    status: "No Show",
    excused: false,
    ...overrides,
  };
}

describe("preBanEventMillis", () => {
  it("returns 0 when no late cancel or no-show date", () => {
    expect(preBanEventMillis(baseLog())).toBe(0);
  });

  it("reads millis from lateCancelDate when it is a Timestamp", () => {
    const ts = Timestamp.fromMillis(1_700_000_000_000);
    expect(
      preBanEventMillis(
        baseLog({ lateCancelDate: ts, noShowDate: Timestamp.fromMillis(1) }),
      ),
    ).toBe(ts.toMillis());
  });

  it("uses noShowDate when lateCancelDate is absent", () => {
    const ts = Timestamp.fromMillis(1_800_000_000_000);
    expect(preBanEventMillis(baseLog({ noShowDate: ts }))).toBe(ts.toMillis());
  });

  it("prefers lateCancelDate over noShowDate when both are set", () => {
    const late = Timestamp.fromMillis(100);
    const noshow = Timestamp.fromMillis(200);
    expect(
      preBanEventMillis(baseLog({ lateCancelDate: late, noShowDate: noshow })),
    ).toBe(late.toMillis());
  });

  it("normalizes plain { seconds, nanoseconds } to the same millis as Timestamp", () => {
    const seconds = 1_700_000_000;
    const nanoseconds = 500_000_000;
    const log = baseLog({
      lateCancelDate: { seconds, nanoseconds } as unknown as PreBanLog["lateCancelDate"],
    });
    expect(preBanEventMillis(log)).toBe(
      new Timestamp(seconds, nanoseconds).toMillis(),
    );
  });

  it("treats omitted nanoseconds on plain objects as 0", () => {
    const seconds = 1_700_000_000;
    const log = baseLog({
      noShowDate: { seconds } as unknown as PreBanLog["noShowDate"],
    });
    expect(preBanEventMillis(log)).toBe(new Timestamp(seconds, 0).toMillis());
  });
});

describe("comparePreBanDetails", () => {
  const emptyMap: Record<string, number | undefined> = {};

  describe("date column", () => {
    it("returns 0 for equal eventTimeMs", () => {
      const a = detail({ id: "a", bookingId: "b1", eventTimeMs: 100 });
      const b = detail({ id: "b", bookingId: "b2", eventTimeMs: 100 });
      expect(comparePreBanDetails(a, b, "date", "asc", emptyMap)).toBe(0);
      expect(comparePreBanDetails(a, b, "date", "desc", emptyMap)).toBe(0);
    });

    it("sorts by eventTimeMs ascending", () => {
      const earlier = detail({ id: "a", bookingId: "b1", eventTimeMs: 10 });
      const later = detail({ id: "b", bookingId: "b2", eventTimeMs: 20 });
      expect(comparePreBanDetails(earlier, later, "date", "asc", emptyMap)).toBeLessThan(0);
      expect(comparePreBanDetails(later, earlier, "date", "asc", emptyMap)).toBeGreaterThan(0);
    });

    it("reverses date order for desc", () => {
      const earlier = detail({ id: "a", bookingId: "b1", eventTimeMs: 10 });
      const later = detail({ id: "b", bookingId: "b2", eventTimeMs: 20 });
      expect(comparePreBanDetails(earlier, later, "date", "desc", emptyMap)).toBeGreaterThan(0);
      expect(comparePreBanDetails(earlier, later, "date", "desc", emptyMap)).toBe(
        -comparePreBanDetails(earlier, later, "date", "asc", emptyMap),
      );
    });
  });

  describe("status column", () => {
    it("is antisymmetric for asc (same locale)", () => {
      const late = detail({
        id: "a",
        bookingId: "b1",
        status: "Late Cancel",
      });
      const noShow = detail({ id: "b", bookingId: "b2", status: "No Show" });
      const forward = comparePreBanDetails(late, noShow, "status", "asc", emptyMap);
      const backward = comparePreBanDetails(noShow, late, "status", "asc", emptyMap);
      expect(forward).toBe(-backward);
    });

    it("reverses status comparison for desc", () => {
      const late = detail({
        id: "a",
        bookingId: "b1",
        status: "Late Cancel",
      });
      const noShow = detail({ id: "b", bookingId: "b2", status: "No Show" });
      expect(comparePreBanDetails(late, noShow, "status", "desc", emptyMap)).toBe(
        -comparePreBanDetails(late, noShow, "status", "asc", emptyMap),
      );
    });
  });

  describe("requestNumber column", () => {
    it("sorts by numeric request number when both are in the map", () => {
      const low = detail({ id: "a", bookingId: "b-low" });
      const high = detail({ id: "b", bookingId: "b-high" });
      const map = { "b-low": 1, "b-high": 10 };
      expect(comparePreBanDetails(low, high, "requestNumber", "asc", map)).toBeLessThan(0);
      expect(comparePreBanDetails(low, high, "requestNumber", "desc", map)).toBeGreaterThan(0);
    });

    it("places missing request numbers last in ascending order", () => {
      const missing = detail({ id: "a", bookingId: "b-miss" });
      const present = detail({ id: "b", bookingId: "b-ok" });
      const map: Record<string, number | undefined> = { "b-ok": 1 };
      expect(
        comparePreBanDetails(missing, present, "requestNumber", "asc", map),
      ).toBeGreaterThan(0);
    });

    it("treats two missing request numbers as equal", () => {
      const a = detail({ id: "a", bookingId: "x" });
      const b = detail({ id: "b", bookingId: "y" });
      expect(comparePreBanDetails(a, b, "requestNumber", "asc", {})).toBe(0);
    });
  });

  describe("excused column", () => {
    it("sorts false before true ascending", () => {
      const notExcused = detail({ id: "a", bookingId: "b1", excused: false });
      const excused = detail({ id: "b", bookingId: "b2", excused: true });
      expect(
        comparePreBanDetails(notExcused, excused, "excused", "asc", emptyMap),
      ).toBeLessThan(0);
    });

    it("sorts true before false descending", () => {
      const notExcused = detail({ id: "a", bookingId: "b1", excused: false });
      const excused = detail({ id: "b", bookingId: "b2", excused: true });
      expect(
        comparePreBanDetails(notExcused, excused, "excused", "desc", emptyMap),
      ).toBeGreaterThan(0);
    });
  });
});
