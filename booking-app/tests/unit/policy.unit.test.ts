import { describe, expect, it } from "vitest";
import { CALENDAR_HIDE_STATUS } from "@/components/src/policy";
import { BookingStatusLabel } from "@/components/src/types";

describe("CALENDAR_HIDE_STATUS", () => {
  it("should not include DECLINED so declined events are shown on the calendar and prevent double bookings", () => {
    expect(CALENDAR_HIDE_STATUS).not.toContain(BookingStatusLabel.DECLINED);
  });

  it("should include NO_SHOW, CANCELED, and CHECKED_OUT so those events remain hidden", () => {
    expect(CALENDAR_HIDE_STATUS).toContain(BookingStatusLabel.NO_SHOW);
    expect(CALENDAR_HIDE_STATUS).toContain(BookingStatusLabel.CANCELED);
    expect(CALENDAR_HIDE_STATUS).toContain(BookingStatusLabel.CHECKED_OUT);
  });
});
