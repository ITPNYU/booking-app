const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;

type DateLike = Date | { toDate: () => Date } | string | number | null;

const toDate = (value: DateLike | undefined): Date | null => {
  if (value == null) return null;
  if (value instanceof Date) return value;
  if (typeof value === "object" && typeof value.toDate === "function") {
    return value.toDate();
  }
  const parsed = new Date(value as string | number);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

/** Rounds up to the next :00, :15, :30 or :45 (a time already on one is kept). */
export const roundUpToQuarterHour = (date: Date): Date =>
  new Date(Math.ceil(date.getTime() / FIFTEEN_MINUTES_MS) * FIFTEEN_MINUTES_MS);

/**
 * The calendar end time to use when a booking is checked out early: the
 * checkout time rounded up to the nearest quarter hour, so the rest of the
 * slot is freed for other requests and walk-ins.
 *
 * Returns null when the booking should keep its scheduled end: checkout
 * (after rounding) is not before the scheduled end, or not after the start,
 * since Google Calendar rejects an event that ends at or before it starts.
 */
export const getEarlyCheckoutEndTime = ({
  checkedOutAt,
  startDate,
  endDate,
}: {
  checkedOutAt: DateLike | undefined;
  startDate: DateLike | undefined;
  endDate: DateLike | undefined;
}): Date | null => {
  const checkout = toDate(checkedOutAt);
  const start = toDate(startDate);
  const end = toDate(endDate);
  if (!checkout || !start || !end) return null;

  const roundedEnd = roundUpToQuarterHour(checkout);
  if (roundedEnd.getTime() >= end.getTime()) return null;
  if (roundedEnd.getTime() <= start.getTime()) return null;
  return roundedEnd;
};
