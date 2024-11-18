import { Booking, BookingStatusLabel } from "../../../types";

import { Timestamp } from "@firebase/firestore";
import { typeGuard } from "../../utils/date";

export default function getBookingStatus(booking: Booking): BookingStatusLabel {
  const bookingStatusLabel = () => {
    const timeStringtoDate = (time: Timestamp) => {
      return time != undefined ? time.toDate() : new Date(0);
    };

    const checkedInTimestamp = timeStringtoDate(
      typeGuard(booking, "checkedInAt")
    );
    const checkedOutTimestamp = timeStringtoDate(
      typeGuard(booking, "checkedOutAt")
    );
    const noShowTimestamp = timeStringtoDate(typeGuard(booking, "noShowedAt"));
    const canceledTimestamp = timeStringtoDate(booking.canceledAt);

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
    } else if (booking.finalApprovedAt !== undefined) {
      return BookingStatusLabel.APPROVED;
    } else if (typeGuard(booking, "firstApprovedAt") !== undefined) {
      return BookingStatusLabel.PENDING;
    } else if (booking.requestedAt != undefined) {
      return BookingStatusLabel.REQUESTED;
    } else if (typeGuard(booking, "walkedInAt") != undefined) {
      return BookingStatusLabel.WALK_IN;
    } else {
      return BookingStatusLabel.UNKNOWN;
    }
  };

  return bookingStatusLabel();
}
