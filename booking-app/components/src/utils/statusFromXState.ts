import { BookingStatusLabel } from "../types";
import { shouldUseXState } from "./tenantUtils";

type XStateSnapshot = {
  value?: string | Record<string, any>;
};

type BookingLike = {
  calendarEventId?: string;
  xstateData?: { snapshot?: XStateSnapshot };
  // Optional legacy fields
  status?: BookingStatusLabel | string;
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

      // Handle parallel states
      if (typeof xvalue === "object" && xvalue) {
        if (xvalue["Services Request"]) {
          return BookingStatusLabel.PRE_APPROVED;
        }
        if (xvalue["Service Closeout"]) {
          return BookingStatusLabel.CHECKED_OUT;
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
  return (
    (booking?.status as BookingStatusLabel) || BookingStatusLabel.REQUESTED
  );
}
