import { BookingStatusLabel } from "../types";

type XStateSnapshot = {
  value?: string | Record<string, any>;
};

type BookingLike = {
  calendarEventId?: string;
  xstateData?: { snapshot?: XStateSnapshot };
  // Optional legacy fields
  status?: BookingStatusLabel | string;
  // Legacy timestamp fields for status detection
  noShowedAt?: any;
  checkedOutAt?: any;
  checkedInAt?: any;
  canceledAt?: any;
  canceledBy?: string;
  declinedAt?: any;
  finalApprovedAt?: any;
  firstApprovedAt?: any;
  requestedAt?: any;
  closedAt?: any;
  closedBy?: string;
  // Media Commons service flags may be present on some objects
  equipmentService?: string;
  cateringService?: string;
  cleaningService?: string;
  securityService?: string;
  setupService?: string;
};

export function getStatusFromXState(
  booking: BookingLike,
  tenant?: string
): BookingStatusLabel | string {
  try {
    if (shouldUseXState(tenant) && booking?.xstateData?.snapshot?.value) {
      const xvalue = booking.xstateData.snapshot.value;

      // Handle parallel states - check in priority order
      if (typeof xvalue === "object" && xvalue) {
        // Service Closeout has higher priority than Services Request
        if (xvalue["Service Closeout"]) {
          // Check if this booking was marked as no show
          if (booking?.noShowedAt) {
            return BookingStatusLabel.CANCELED;
          }
          return BookingStatusLabel.CHECKED_OUT;
        }
        if (xvalue["Services Request"]) {
          return BookingStatusLabel.PRE_APPROVED;
        }
      }

      // Handle string states
      if (typeof xvalue === "string") {
        switch (xvalue) {
          case "Requested":
            return BookingStatusLabel.REQUESTED;
          case "Pre-approved":
            return BookingStatusLabel.PRE_APPROVED;
          case "Approved":
            return BookingStatusLabel.APPROVED;
          case "Checked In":
            return BookingStatusLabel.CHECKED_IN;
          case "Checked Out":
            return BookingStatusLabel.CHECKED_OUT;
          case "Closed":
            return BookingStatusLabel.CLOSED;
          case "Canceled":
            return BookingStatusLabel.CANCELED;
          case "Declined":
            return BookingStatusLabel.DECLINED;
          case "No Show":
            return BookingStatusLabel.NO_SHOW;
          default:
            return xvalue.toUpperCase().replace(/\s+/g, "_");
        }
      }
    }
  } catch (err) {
    // Fall back below
  }

  // Fallback to existing status if present
  if (booking?.status) {
    return booking.status as BookingStatusLabel;
  }

  // Fallback to legacy timestamp-based status detection
  if (booking?.noShowedAt) return BookingStatusLabel.NO_SHOW;
  if (booking?.checkedOutAt) return BookingStatusLabel.CHECKED_OUT;
  if (booking?.checkedInAt) return BookingStatusLabel.CHECKED_IN;
  if (booking?.canceledAt) return BookingStatusLabel.CANCELED;
  if (booking?.declinedAt) return BookingStatusLabel.DECLINED;
  if (booking?.finalApprovedAt) return BookingStatusLabel.APPROVED;
  if (booking?.firstApprovedAt) return BookingStatusLabel.PRE_APPROVED;
  if (booking?.requestedAt) return BookingStatusLabel.REQUESTED;

  return BookingStatusLabel.REQUESTED;
}

function shouldUseXState(tenant?: string): boolean {
  return true; // All tenants use XState now
}
