import { Timestamp } from "firebase/firestore";
import { Booking, BookingOrigin, BookingStatusLabel } from "../../../types";
import { isMediaCommons, shouldUseXState } from "../../../utils/tenantUtils";

export default function getBookingStatus(
  booking: Booking,
  tenant?: string
): BookingStatusLabel {
  // For tenants using XState, prioritize XState status over timestamp-based logic
  // Only use XState if both the tenant uses XState AND XState data exists
  if (shouldUseXState(tenant) && booking.xstateData?.snapshot?.value) {
    const xstateValue = booking.xstateData.snapshot.value;

    console.log(`🎯 USING XSTATE STATUS [${tenant?.toUpperCase()}]:`, {
      calendarEventId: booking.calendarEventId,
      xstateValue,
      xstateValueType: typeof xstateValue,
      xstateValueKeys:
        typeof xstateValue === "object" && xstateValue
          ? Object.keys(xstateValue)
          : null,
    });

    // Handle parallel states (like Services Request)
    if (typeof xstateValue === "object" && xstateValue) {
      if (xstateValue["Services Request"]) {
        console.log(
          `🎯 DETECTED SERVICES REQUEST STATE [${tenant?.toUpperCase()}]:`,
          {
            calendarEventId: booking.calendarEventId,
            servicesRequestState: xstateValue["Services Request"],
          }
        );
        return BookingStatusLabel.PRE_APPROVED; // Display as Pre-approved while in Services Request
      }
      if (xstateValue["Service Closeout"]) {
        return BookingStatusLabel.CHECKED_OUT; // Display as Checked Out during Service Closeout
      }
    }

    // Handle string states
    if (typeof xstateValue === "string") {
      switch (xstateValue) {
        case "Requested":
          return BookingStatusLabel.REQUESTED;
        case "Pre-approved":
          return BookingStatusLabel.PRE_APPROVED;
        case "Approved":
          return BookingStatusLabel.APPROVED;
        case "Declined":
          return BookingStatusLabel.DECLINED;
        case "Canceled":
          return BookingStatusLabel.CANCELED;
        case "Checked In":
          return BookingStatusLabel.CHECKED_IN;
        case "Checked Out":
          return BookingStatusLabel.CHECKED_OUT;
        case "No Show":
          return BookingStatusLabel.NO_SHOW;
        case "Closed":
          return BookingStatusLabel.CLOSED;
        case "Equipment":
          return BookingStatusLabel.EQUIPMENT;
        default:
          console.warn(
            `🚨 UNKNOWN XSTATE STRING VALUE [${tenant?.toUpperCase()}]:`,
            {
              calendarEventId: booking.calendarEventId,
              xstateValue,
              fallbackToTimestampLogic: true,
            }
          );
          // Fall through to timestamp-based logic if XState value is unknown
          break;
      }
    }

    console.warn(
      `🚨 UNHANDLED XSTATE VALUE FORMAT [${tenant?.toUpperCase()}]:`,
      {
        calendarEventId: booking.calendarEventId,
        xstateValue,
        xstateValueType: typeof xstateValue,
        fallbackToTimestampLogic: true,
      }
    );
  } else if (shouldUseXState(tenant)) {
    // Tenant uses XState but no XState data found - this is expected for older bookings
    console.log(`📜 USING LEGACY STATUS LOGIC [${tenant?.toUpperCase()}]:`, {
      calendarEventId: booking.calendarEventId,
      reason:
        "No XState data found - using timestamp-based logic for older booking",
      hasXStateData: !!booking.xstateData,
      xstateSnapshot: booking.xstateData?.snapshot
        ? "exists but no value"
        : "missing",
    });
  } else {
    // Tenant doesn't use XState at all
    console.log(
      `🏛️ USING TRADITIONAL STATUS LOGIC [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
      {
        calendarEventId: booking.calendarEventId,
        reason: "Tenant does not use XState",
      }
    );
  }

  const bookingStatusLabel = () => {
    const timeStringtoDate = (time: Timestamp) => {
      //for some reason there are some timestamps that are throwing an error when toDate is called only on dev, for now adding a check to avoid the error, will probably need to investigate further
      return time != undefined
        ? typeof time.toDate === "function"
          ? time.toDate()
          : new Date(time.seconds * 1000)
        : new Date(0);
    };

    const checkedInTimestamp = timeStringtoDate(booking.checkedInAt);
    const checkedOutTimestamp = timeStringtoDate(booking.checkedOutAt);
    const noShowTimestamp = timeStringtoDate(booking.noShowedAt);
    const canceledTimestamp = timeStringtoDate(booking.canceledAt);
    const closedTimestamp = booking.closedAt
      ? timeStringtoDate(booking.closedAt)
      : new Date(0);

    // Handle equipment fields that might be undefined for existing bookings
    const equipmentTimestamp = booking.equipmentAt
      ? timeStringtoDate(booking.equipmentAt)
      : new Date(0);
    const equipmentApprovedTimestamp = booking.equipmentApprovedAt
      ? timeStringtoDate(booking.equipmentApprovedAt)
      : new Date(0);

    // if any of checkedInAt, checkedOutAt, noShowedAt, canceledAt, closedAt have a date, return the most recent
    if (
      checkedInTimestamp.getTime() !== 0 ||
      checkedOutTimestamp.getTime() !== 0 ||
      noShowTimestamp.getTime() !== 0 ||
      canceledTimestamp.getTime() !== 0 ||
      closedTimestamp.getTime() !== 0
    ) {
      let mostRecentTimestamp: Date = checkedInTimestamp;
      let label = BookingStatusLabel.CHECKED_IN;

      if (noShowTimestamp > mostRecentTimestamp) {
        mostRecentTimestamp = noShowTimestamp;
        label = BookingStatusLabel.NO_SHOW;
      }

      if (canceledTimestamp > mostRecentTimestamp) {
        mostRecentTimestamp = canceledTimestamp;
        label = BookingStatusLabel.CANCELED;
      }

      if (checkedOutTimestamp > mostRecentTimestamp) {
        mostRecentTimestamp = checkedOutTimestamp;
        label = BookingStatusLabel.CHECKED_OUT;
      }

      if (closedTimestamp > mostRecentTimestamp) {
        mostRecentTimestamp = closedTimestamp;
        label = BookingStatusLabel.CLOSED;
      }
      return label;
    }

    if (booking.declinedAt != undefined) {
      return BookingStatusLabel.DECLINED;
    } else if (
      booking.equipmentApprovedAt &&
      equipmentApprovedTimestamp.getTime() !== 0
    ) {
      return BookingStatusLabel.APPROVED;
    } else if (booking.equipmentAt && equipmentTimestamp.getTime() !== 0) {
      return BookingStatusLabel.EQUIPMENT;
    } else if (booking.finalApprovedAt !== undefined) {
      return BookingStatusLabel.APPROVED;
    } else if (booking.firstApprovedAt !== undefined) {
      return BookingStatusLabel.PRE_APPROVED;
    } else if (
      booking.origin === BookingOrigin.WALK_IN ||
      booking.walkedInAt != undefined
    ) {
      return BookingStatusLabel.APPROVED;
    } else if (booking.requestedAt != undefined) {
      return BookingStatusLabel.REQUESTED;
    } else if (booking.origin === BookingOrigin.VIP) {
      // For Media Commons VIP bookings, follow the normal approval flow
      // This allows VIP bookings with service requests to go through Pre-approved -> Services Request
      if (isMediaCommons(tenant)) {
        // If firstApprovedAt is set but finalApprovedAt is not, it should be PRE_APPROVED
        if (
          booking.firstApprovedAt !== undefined &&
          booking.finalApprovedAt === undefined
        ) {
          return BookingStatusLabel.PRE_APPROVED;
        }
        // If finalApprovedAt is set, it should be APPROVED
        if (booking.finalApprovedAt !== undefined) {
          return BookingStatusLabel.APPROVED;
        }
        // If neither is set, it should be REQUESTED (though this shouldn't happen for VIP)
        return BookingStatusLabel.REQUESTED;
      }
      // For non-Media Commons tenants, VIP bookings are immediately approved
      return BookingStatusLabel.APPROVED;
    } else {
      return BookingStatusLabel.UNKNOWN;
    }
  };

  return bookingStatusLabel();
}
