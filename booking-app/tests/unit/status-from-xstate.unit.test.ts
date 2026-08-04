import { BookingStatusLabel } from "@/components/src/types";
import { getStatusFromXState } from "@/components/src/utils/statusFromXState";
import { describe, expect, it } from "vitest";

const servicesRequestState = {
  "Services Request": {
    "Staff Request": "Staff Approved",
    "Equipment Request": "Equipment Approved",
  },
};

describe("getStatusFromXState", () => {
  it("shows final-approved service bookings as approved when the snapshot is stale", () => {
    const booking = {
      finalApprovedAt: { seconds: 1_722_744_000 },
      xstateData: {
        snapshot: {
          value: servicesRequestState,
        },
      },
    };

    expect(getStatusFromXState(booking)).toBe(BookingStatusLabel.APPROVED);
  });

  it("keeps an unfinished services request pre-approved", () => {
    const booking = {
      xstateData: {
        snapshot: {
          value: {
            "Services Request": {
              "Staff Request": "Staff Approved",
              "Equipment Request": "Equipment Requested",
            },
          },
        },
      },
    };

    expect(getStatusFromXState(booking)).toBe(BookingStatusLabel.PRE_APPROVED);
  });
});
