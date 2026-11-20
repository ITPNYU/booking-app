// Route segments that decide where the booking providers do work. Kept in one
// place so the two lists cannot drift apart silently: every flow that renders
// the room calendar must also mount BookingProvider.

// Pages that render the room calendar (selectRoom) or check overlap against
// it. Only these fetch /api/calendarEvents.
export const CALENDAR_FLOW_SEGMENTS = [
  "book",
  "walk-in",
  "vip",
  "edit",
  "modification",
] as const;

// Pages that mount BookingProvider: the calendar flows above, plus the
// booking-table pages that call loadExistingBookingData before navigating to
// /edit or /modification (my-bookings EDIT, pa MODIFICATION) or mount
// useBookingActions against BookingContext.
export const BOOKING_FLOW_SEGMENTS = [
  ...CALENDAR_FLOW_SEGMENTS,
  "admin",
  "my-bookings",
  "pa",
  "liaison",
  "services",
] as const;

export const isFlowSegment = (
  segments: readonly string[],
  segment: string,
): boolean => (segments as readonly string[]).includes(segment);
