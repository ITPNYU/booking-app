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
    if (bookingStatusMatch.checkedInAt !== '') {
      return BookingStatusLabel.CHECKED_IN;
    } else if (bookingStatusMatch.noShowedAt !== '') {
      return BookingStatusLabel.NO_SHOW;
    } else if (bookingStatusMatch.canceledAt !== '') {
      return BookingStatusLabel.CANCELED;
    } else if (bookingStatusMatch.rejectedAt !== '') {
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
