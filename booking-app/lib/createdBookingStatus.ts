import { BookingStatusLabel } from "@/components/src/types";

export function statusForCreatedBooking(input: {
  instantApprovalStatus: BookingStatusLabel | null;
  xstateStatus?: string;
}): string {
  if (input.instantApprovalStatus) {
    return input.instantApprovalStatus;
  }
  if (input.xstateStatus) {
    return input.xstateStatus;
  }
  return BookingStatusLabel.REQUESTED;
}
