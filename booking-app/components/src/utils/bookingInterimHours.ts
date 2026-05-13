import { BookingStatusLabel } from "../types";
import { getStatusFromXState } from "./statusFromXState";

export type BookingLikeForInterim = Parameters<typeof getStatusFromXState>[0];

function timestampToMillis(ts: unknown): number | null {
  if (ts == null || ts === undefined) return null;
  if (typeof (ts as { toDate?: () => Date }).toDate === "function") {
    return (ts as { toDate: () => Date }).toDate().getTime();
  }
  if (ts instanceof Date) return ts.getTime();
  if (typeof ts === "number" && !Number.isNaN(ts)) return ts;
  const sec = (ts as { seconds?: number; _seconds?: number }).seconds;
  const secAlt = (ts as { seconds?: number; _seconds?: number })._seconds;
  const nanos = (ts as { nanoseconds?: number; _nanoseconds?: number })
    .nanoseconds;
  const nanosAlt = (ts as { nanoseconds?: number; _nanoseconds?: number })
    ._nanoseconds;
  const s = sec ?? secAlt;
  if (typeof s === "number") {
    const n = nanos ?? nanosAlt ?? 0;
    return s * 1000 + (typeof n === "number" ? Math.floor(n / 1e6) : 0);
  }
  return null;
}

/** Statuses where time-in-queue (interim) still accumulates before final approval */
export function isAwaitingApprovalStatus(status: BookingStatusLabel): boolean {
  return (
    status === BookingStatusLabel.REQUESTED ||
    status === BookingStatusLabel.PRE_APPROVED ||
    status === BookingStatusLabel.PENDING ||
    status === BookingStatusLabel.MODIFIED
  );
}

/** Fallback when booking logs are unavailable for the current status. */
function getStatusEntryTimestamp(
  booking: BookingLikeForInterim,
  status: BookingStatusLabel,
): unknown {
  if (status === BookingStatusLabel.PRE_APPROVED) {
    return booking.firstApprovedAt ?? booking.requestedAt;
  }
  return booking.requestedAt;
}

/**
 * Hours since the booking entered its current awaiting-approval status.
 *
 * Prefer `latestStatusChangedAt` from BOOKING_LOGS when available. Falls back to
 * per-status timestamps already on the booking document:
 *   REQUESTED    -> since requestedAt
 *   PRE_APPROVED -> since firstApprovedAt (second-approval wait clock)
 *   MODIFIED / PENDING -> since requestedAt (no modifiedAt field on document)
 *
 * Returns 0 once the booking is approved (or checked in/out / closed).
 * Returns null when not applicable (declined, canceled, unknown, missing timestamp).
 */
export function getBookingInterimHours(
  booking: BookingLikeForInterim,
  tenant?: string,
  latestStatusChangedAt?: unknown,
): number | null {
  const status = getStatusFromXState(booking, tenant) as BookingStatusLabel;

  if (
    status === BookingStatusLabel.APPROVED ||
    status === BookingStatusLabel.CHECKED_IN ||
    status === BookingStatusLabel.CHECKED_OUT ||
    status === BookingStatusLabel.CLOSED
  ) {
    return 0;
  }

  if (!isAwaitingApprovalStatus(status)) {
    return null;
  }

  const ms = timestampToMillis(
    latestStatusChangedAt ?? getStatusEntryTimestamp(booking, status),
  );
  if (ms == null) return null;

  const hours = (Date.now() - ms) / (1000 * 60 * 60);
  return Math.max(0, hours);
}

export function shouldHighlightBookingInterim(
  booking: BookingLikeForInterim,
  tenant: string | undefined,
  thresholdHours: number,
): boolean {
  const interim = getBookingInterimHours(booking, tenant);
  if (interim == null) return false;
  return interim >= thresholdHours;
}

export function formatBookingInterimHours(interim: number | null): string {
  if (interim == null) return "—";
  return interim.toFixed(1);
}
