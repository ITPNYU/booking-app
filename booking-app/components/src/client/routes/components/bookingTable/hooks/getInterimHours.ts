/** Re-exports — interim is derived from booking status + requestedAt (see bookingInterimHours). */
export {
  formatBookingInterimHours,
  getBookingInterimHours,
  getBookingInterimHours as getInterimHours,
  isAwaitingApprovalStatus,
  shouldHighlightBookingInterim,
} from "@/components/src/utils/bookingInterimHours";
