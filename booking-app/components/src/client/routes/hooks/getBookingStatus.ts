import { Booking, BookingStatusLabel } from "../../../types";
import { getStatusFromXState } from "../../../utils/statusFromXState";

export default function getBookingStatus(
  booking: Booking,
  tenant?: string
): BookingStatusLabel {
  return getStatusFromXState(booking as any, tenant) as BookingStatusLabel;
}
