import { describe, expect, it } from "vitest";
import { BookingStatusLabel } from "@/components/src/types";
import { statusForCreatedBooking } from "@/lib/createdBookingStatus";

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
