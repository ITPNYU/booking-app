import { PageContextLevel } from "@/components/src/types";
import { Timestamp } from "firebase/firestore";

interface Params {
  pageContext: PageContextLevel;
  startDate: Timestamp;
  calendarEventId: string;
  allBookings?: any; // Kept for backward compatibility but not used
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
  // Otherwise, allow check-in.
  return now < oneHourBeforeStart;
}
