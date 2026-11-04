import {
  BOOKING_FLOW_SEGMENTS,
  CALENDAR_FLOW_SEGMENTS,
  isFlowSegment,
} from "@/components/src/constants/flowSegments";
import { describe, expect, it } from "vitest";

describe("flow segments", () => {
  it("every calendar flow also mounts BookingProvider", () => {
    // BookingProvider gates the calendar fetch on CALENDAR_FLOW_SEGMENTS and
    // ClientProvider mounts it on BOOKING_FLOW_SEGMENTS. A calendar flow that
    // is not a booking flow would silently render an empty room calendar.
    for (const segment of CALENDAR_FLOW_SEGMENTS) {
      expect(isFlowSegment(BOOKING_FLOW_SEGMENTS, segment)).toBe(true);
    }
  });

  it("booking-table pages mount the provider without fetching the calendar", () => {
    for (const segment of [
      "admin",
      "my-bookings",
      "pa",
      "liaison",
      "services",
    ]) {
      expect(isFlowSegment(BOOKING_FLOW_SEGMENTS, segment)).toBe(true);
      expect(isFlowSegment(CALENDAR_FLOW_SEGMENTS, segment)).toBe(false);
    }
  });
});
