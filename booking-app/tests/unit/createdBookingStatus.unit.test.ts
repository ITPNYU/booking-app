import { describe, expect, it } from "vitest";
import { BookingStatusLabel } from "@/components/src/types";
import {
  committedApprovalStatus,
  statusForCreatedBooking,
} from "@/lib/createdBookingStatus";

describe("committedApprovalStatus", () => {
  it("treats a final-approval write as approved even if a later step failed", () => {
    expect(
      committedApprovalStatus({
        finalApprovedAt: { seconds: 1 },
        firstApprovedAt: { seconds: 1 },
      }),
    ).toBe(BookingStatusLabel.APPROVED);
  });

  it("treats a first-approval write as pre-approved", () => {
    expect(
      committedApprovalStatus({ firstApprovedAt: { seconds: 1 } }),
    ).toBe(BookingStatusLabel.PRE_APPROVED);
  });

  it("reports nothing when the approval write never landed", () => {
    expect(committedApprovalStatus(null)).toBeNull();
    expect(committedApprovalStatus({})).toBeNull();
    expect(
      committedApprovalStatus({ finalApprovedAt: null, firstApprovedAt: null }),
    ).toBeNull();
  });
});

describe("statusForCreatedBooking", () => {
  it("uses the status the instant-approval call actually applied", () => {
    expect(
      statusForCreatedBooking({
        instantApprovalStatus: BookingStatusLabel.APPROVED,
        xstateStatus: BookingStatusLabel.REQUESTED,
      }),
    ).toBe(BookingStatusLabel.APPROVED);

    expect(
      statusForCreatedBooking({
        instantApprovalStatus: BookingStatusLabel.PRE_APPROVED,
      }),
    ).toBe(BookingStatusLabel.PRE_APPROVED);
  });

  it("reports REQUESTED when instant approval failed and review was requested instead", () => {
    expect(
      statusForCreatedBooking({
        instantApprovalStatus: BookingStatusLabel.REQUESTED,
        xstateStatus: BookingStatusLabel.APPROVED,
      }),
    ).toBe(BookingStatusLabel.REQUESTED);
  });

  it("does not report APPROVED when instant approval did not complete", () => {
    expect(
      statusForCreatedBooking({
        instantApprovalStatus: null,
        xstateStatus: BookingStatusLabel.REQUESTED,
      }),
    ).toBe(BookingStatusLabel.REQUESTED);

    expect(
      statusForCreatedBooking({
        instantApprovalStatus: null,
      }),
    ).toBe(BookingStatusLabel.REQUESTED);
  });
});
