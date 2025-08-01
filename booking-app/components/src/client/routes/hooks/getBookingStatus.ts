import { Booking, BookingOrigin, BookingStatusLabel } from "../../../types";

import { Timestamp } from "firebase/firestore";

export default function getBookingStatus(booking: Booking): BookingStatusLabel {
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

    // Handle equipment fields that might be undefined for existing bookings
    const equipmentTimestamp = booking.equipmentAt
      ? timeStringtoDate(booking.equipmentAt)
      : new Date(0);
    const equipmentApprovedTimestamp = booking.equipmentApprovedAt
      ? timeStringtoDate(booking.equipmentApprovedAt)
      : new Date(0);

    // if any of checkedInAt, noShowedAt, canceledAt have a date, return the most recent
    if (
      checkedInTimestamp.getTime() !== 0 ||
      checkedOutTimestamp.getTime() !== 0 ||
      noShowTimestamp.getTime() !== 0 ||
      canceledTimestamp.getTime() !== 0
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
      return BookingStatusLabel.PENDING;
    } else if (booking.requestedAt != undefined) {
      return BookingStatusLabel.REQUESTED;
    } else if (
      booking.origin === BookingOrigin.WALK_IN ||
      booking.walkedInAt != undefined
    ) {
      return BookingStatusLabel.APPROVED;
    } else if (booking.origin === BookingOrigin.VIP) {
      return BookingStatusLabel.APPROVED;
    } else {
      return BookingStatusLabel.UNKNOWN;
    }
  };

  return bookingStatusLabel();
}
