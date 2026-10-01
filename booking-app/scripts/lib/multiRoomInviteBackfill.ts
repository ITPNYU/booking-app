/**
 * Pure helpers for scripts/backfillMultiRoomCalendarInvites.ts.
 *
 * Kept free of firebase-admin / googleapis / dotenv so they can be unit tested.
 */

export interface BackfillWindow {
  approvedFrom: Date;
  approvedTo: Date;
}

export interface BackfillBooking {
  roomId?: unknown;
  email?: unknown;
  secondaryEmail?: unknown;
  finalApprovedAt?: Date | null;
  canceledAt?: unknown;
  declinedAt?: unknown;
  noShowedAt?: unknown;
  checkedOutAt?: unknown;
}

export interface CalendarResource {
  resourceId?: string | number;
  roomId?: string | number;
  calendarId?: string;
  calendarIdDev?: string;
  calendarIdProd?: string;
}

/**
 * Production deploys that bound the bug: 2026-07-08 shipped the string
 * resource ID migration (#1501) that stopped the invite route from matching
 * comma-joined roomId lists; 2026-09-16 shipped the fix (#1563).
 */
export const DEFAULT_APPROVED_FROM = "2026-07-08T00:09:34Z";
export const DEFAULT_APPROVED_TO = "2026-09-16T00:26:00Z";

/** Multi-room bookings store roomId as a comma-joined list ("202, 1201"). */
export const splitRoomIds = (roomId: unknown): string[] =>
  String(roomId ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

/** Mirrors serverApproveEvent: bare net IDs are NYU addresses. */
const toEmailAddress = (value: unknown): string => {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return "";
  return trimmed.includes("@") ? trimmed : `${trimmed}@nyu.edu`;
};

/** Requester first, then secondary contact; deduped case-insensitively. */
export const guestEmailsForBooking = (booking: BackfillBooking): string[] => {
  const seen = new Set<string>();
  const guests: string[] = [];
  for (const raw of [booking.email, booking.secondaryEmail]) {
    const email = toEmailAddress(raw);
    const key = email.toLowerCase();
    if (!email || seen.has(key)) continue;
    seen.add(key);
    guests.push(email);
  }
  return guests;
};

export const missingGuests = (
  attendees: Array<{ email?: string | null }> | null | undefined,
  guests: string[],
): string[] => {
  const present = new Set(
    (attendees ?? []).map((attendee) => (attendee.email ?? "").toLowerCase()),
  );
  return guests.filter((guest) => !present.has(guest.toLowerCase()));
};

/**
 * A booking needs the backfill when it is still live, spans several rooms,
 * and was final-approved while production ran the broken invite lookup.
 */
export const isAffectedBooking = (
  booking: BackfillBooking,
  window: BackfillWindow,
): boolean => {
  if (splitRoomIds(booking.roomId).length < 2) return false;
  if (
    booking.canceledAt ||
    booking.declinedAt ||
    booking.noShowedAt ||
    booking.checkedOutAt
  ) {
    return false;
  }
  const approvedAt = booking.finalApprovedAt;
  if (!approvedAt) return false;
  return approvedAt >= window.approvedFrom && approvedAt < window.approvedTo;
};

/** Same selection as lib/utils/calendarEnvironment, driven by --database. */
export const resolveRoomCalendarIds = (
  resources: CalendarResource[],
  roomIds: string[],
  isProduction: boolean,
): { calendarIds: string[]; unresolvedRoomIds: string[] } => {
  const calendarIds: string[] = [];
  const unresolvedRoomIds: string[] = [];
  for (const roomId of roomIds) {
    const resource = resources.find(
      (candidate) =>
        String(candidate.resourceId ?? candidate.roomId) === roomId,
    );
    const calendarId = isProduction
      ? resource?.calendarIdProd
      : resource?.calendarIdDev || resource?.calendarId;
    if (calendarId) {
      calendarIds.push(calendarId);
    } else {
      unresolvedRoomIds.push(roomId);
    }
  }
  return { calendarIds, unresolvedRoomIds };
};

/**
 * Patch the organizer's copy first: its guest list is authoritative and
 * propagates to the other rooms, so they usually need no write afterwards.
 */
export const orderOrganizerFirst = (
  calendarIds: string[],
  organizerEmail: string | null | undefined,
): string[] => {
  if (!organizerEmail || !calendarIds.includes(organizerEmail)) {
    return calendarIds;
  }
  return [
    organizerEmail,
    ...calendarIds.filter((calendarId) => calendarId !== organizerEmail),
  ];
};
