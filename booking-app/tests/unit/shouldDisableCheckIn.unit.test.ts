import { Timestamp } from "firebase/firestore";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import shouldDisableCheckIn from "@/components/src/client/routes/admin/hooks/shouldDisableCheckIn";
import { PageContextLevel } from "@/components/src/types";

describe("shouldDisableCheckIn", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("keeps Check In enabled for non-admin/PA contexts regardless of timing", () => {
    const startDate = Timestamp.fromDate(new Date("2025-01-01T13:00:00Z"));
    vi.setSystemTime(new Date("2025-01-01T09:30:00Z")); // Over 3 hours early

    const shouldDisable = shouldDisableCheckIn({
      pageContext: PageContextLevel.USER,
      startDate,
      calendarEventId: "abc",
    });

    expect(shouldDisable).toBe(false);
  });

  it("disables Check In for PA/Admin more than one hour before start", () => {
    const startDate = Timestamp.fromDate(new Date("2025-02-01T15:00:00Z"));
    vi.setSystemTime(new Date("2025-02-01T13:15:00Z")); // 1h45m before start

    const shouldDisable = shouldDisableCheckIn({
      pageContext: PageContextLevel.ADMIN,
      startDate,
      calendarEventId: "def",
    });

    expect(shouldDisable).toBe(true);
  });

  it("allows Check In for PA/Admin within or exactly at the one hour window", () => {
    const startDate = Timestamp.fromDate(new Date("2025-03-10T10:00:00Z"));
    vi.setSystemTime(new Date("2025-03-10T09:15:00Z")); // 45 minutes before start

    const withinHour = shouldDisableCheckIn({
      pageContext: PageContextLevel.PA,
      startDate,
      calendarEventId: "ghi",
    });

    vi.setSystemTime(new Date("2025-03-10T09:00:00Z")); // Exactly one hour before start
    const atBoundary = shouldDisableCheckIn({
      pageContext: PageContextLevel.PA,
      startDate,
      calendarEventId: "ghi",
    });

    expect(withinHour).toBe(false);
    expect(atBoundary).toBe(false);
  });

  it("allows Check In after start time has passed", () => {
    const startDate = Timestamp.fromDate(new Date("2025-04-01T13:00:00Z"));
    const now = new Date("2025-04-01T13:30:00Z"); // 30 minutes after start
    vi.setSystemTime(now);

    const shouldDisable = shouldDisableCheckIn({
      pageContext: PageContextLevel.ADMIN,
      startDate,
      calendarEventId: "current",
    });

    expect(shouldDisable).toBe(false);
  });
});
