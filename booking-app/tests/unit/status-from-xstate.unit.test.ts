import { BookingStatusLabel } from "@/components/src/types";
import { getStatusFromXState } from "@/components/src/utils/statusFromXState";
import { describe, expect, it } from "vitest";

const servicesRequestState = {
  "Services Request": {
    "Staff Request": "Staff Approved",
    "Equipment Request": "Equipment Approved",
    "Catering Request": "Catering Approved",
    "Cleaning Request": "Cleaning Approved",
    "Security Request": "Security Approved",
    "Setup Request": "Setup Approved",
  },
};

describe("getStatusFromXState", () => {
  it("shows completed service bookings as approved when the snapshot is stale", () => {
    const booking = {
      xstateData: {
        snapshot: {
          value: servicesRequestState,
        },
      },
    };

    expect(getStatusFromXState(booking)).toBe(BookingStatusLabel.APPROVED);
  });

  it("keeps an unfinished services request pre-approved despite a final approval timestamp", () => {
    const booking = {
      finalApprovedAt: { seconds: 0 },
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
