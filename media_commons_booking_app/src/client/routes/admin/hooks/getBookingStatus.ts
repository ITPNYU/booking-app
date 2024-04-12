import { Booking, BookingStatus, BookingStatusLabel } from '../../../../types';

export default function getBookingStatus(
  booking: Booking,
  bookingStatuses: BookingStatus[]
): BookingStatusLabel {
  const bookingStatusLabel = () => {
    const bookingStatusMatch = bookingStatuses.filter(
      (row) => row.calendarEventId === booking.calendarEventId
    )[0];

    if (bookingStatusMatch === undefined) return BookingStatusLabel.UNKNOWN;

    const timeStringtoDate = (time: string) =>
      time.length > 0 ? new Date(time) : new Date(0);

    const checkedInTimestamp = timeStringtoDate(bookingStatusMatch.checkedInAt);
    const noShowTimestamp = timeStringtoDate(bookingStatusMatch.noShowedAt);
    const canceledTimestamp = timeStringtoDate(bookingStatusMatch.canceledAt);

    // if any of checkedInAt, noShowedAt, canceledAt have a date, return the most recent
    if (
      checkedInTimestamp.getTime() !== 0 ||
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
      return label;
    }

    if (bookingStatusMatch.rejectedAt !== '') {
      return BookingStatusLabel.REJECTED;
    } else if (bookingStatusMatch.secondApprovedAt !== '') {
      return BookingStatusLabel.APPROVED;
    } else if (bookingStatusMatch.firstApprovedAt !== '') {
      return BookingStatusLabel.PRE_APPROVED;
    } else if (bookingStatusMatch.requestedAt !== '') {
      return BookingStatusLabel.REQUESTED;
    } else {
      return BookingStatusLabel.UNKNOWN;
    }
  };

  return bookingStatusLabel();
}
