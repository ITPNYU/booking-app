import { BookingStatusLabel } from "@/components/src/types";

/**
 * Status already written by instant approval. finalApprovedAt wins because a
 * finished approval is not a first-approval request. Null means the approval
 * write never landed, so a later failure can still ask for manual review.
 */
export function committedApprovalStatus(
  booking:
    | {
        finalApprovedAt?: unknown;
        firstApprovedAt?: unknown;
      }
    | null
    | undefined,
): BookingStatusLabel | null {
  if (booking?.finalApprovedAt) return BookingStatusLabel.APPROVED;
  if (booking?.firstApprovedAt) return BookingStatusLabel.PRE_APPROVED;
  return null;
}

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
