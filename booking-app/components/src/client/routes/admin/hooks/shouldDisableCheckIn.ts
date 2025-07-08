import {
  Booking,
  BookingRow,
  BookingStatusLabel,
  PageContextLevel,
} from "@/components/src/types";
import { Timestamp } from "firebase/firestore";
import getBookingStatus from "../../hooks/getBookingStatus";

interface Params {
  pageContext: PageContextLevel;
  startDate: Timestamp;
  calendarEventId: string;
  allBookings?: (BookingRow | Booking)[];
}

/**
 * Centralised logic for determining whether the Check-In action should be disabled.
 */
export default function shouldDisableCheckIn({
  pageContext,
  startDate,
  calendarEventId,
  allBookings,
}: Params): boolean {
  // Only PA & ADMIN trigger early check-in rules
  const isPaOrAdmin =
    pageContext === PageContextLevel.ADMIN ||
    pageContext === PageContextLevel.PA;
  if (!isPaOrAdmin) return false;

  const ONE_HOUR_MS = 60 * 60 * 1000;
  const now = Date.now();
  const bookingStart = startDate.toMillis();
  const oneHourBeforeStart = bookingStart - ONE_HOUR_MS;

  // If we are earlier than one hour before start time, disable.
  if (now < oneHourBeforeStart) return true;

  // Need booking data to evaluate conflicts.
  if (!allBookings || allBookings.length === 0) return false;

  const currentBooking = allBookings.find(
    (b) => b.calendarEventId === calendarEventId
  );
  if (!currentBooking) return false;

  const roomId = currentBooking.roomId;
  const precedingWindowStart = bookingStart - ONE_HOUR_MS;

  const ALLOWED_STATUSES = [
    BookingStatusLabel.CANCELED,
    BookingStatusLabel.DECLINED,
    BookingStatusLabel.NO_SHOW,
    BookingStatusLabel.CHECKED_OUT,
  ];

  const hasBlockingBooking = allBookings.some((b) => {
    if (b.calendarEventId === calendarEventId) return false;
    if (b.roomId !== roomId) return false;

    const bStart = b.startDate.toDate().getTime();
    const bEnd = b.endDate.toDate().getTime();

    // Overlap with the hour immediately preceding current booking
    const overlaps = bStart < bookingStart && bEnd > precedingWindowStart;
    if (!overlaps) return false;

    const status = getBookingStatus(b as any);
    return !ALLOWED_STATUSES.includes(status);
  });

  return hasBlockingBooking;
}
