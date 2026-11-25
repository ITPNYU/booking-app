import { world } from "./world";

export const LIFECYCLE_STAMPS = [
  "requestedAt",
  "firstApprovedAt",
  "finalApprovedAt",
  "declinedAt",
  "canceledAt",
  "checkedInAt",
  "checkedOutAt",
  "noShowedAt",
  "closedAt",
] as const;

/** Top-level states in which the booking still holds its room. */
export const LIVE_STATES = [
  "Requested",
  "Pre-approved",
  "Services Request",
  "Approved",
  "Checked In",
];

export type Seeded = {
  tenant: "mc" | "itp";
  docId: string;
  calendarEventId: string;
  calendarId: string;
};

export type Observation = {
  /** The machine's persisted value, verbatim. */
  machine: unknown;
  /** Its top-level state name. */
  top: string;
  /** Which lifecycle timestamps the document carries. */
  stamps: string[];
  /** What staff see in the bookings table. */
  display: string;
  /** The calendar event's [PREFIX], or null when the event is gone. */
  calendarPrefix: string | null;
  emails: number;
};

const prefixOf = (summary: unknown) =>
  /^\[([^\]]+)\]/.exec(String(summary ?? ""))?.[1] ?? "";

/** Read the copies of a booking's state as they currently stand. */
export async function observe(booking: Seeded): Promise<Observation> {
  const doc = world.db.peek(`${booking.tenant}-bookings`, booking.docId) ?? {};
  const machine = (doc.xstateData as { snapshot?: { value?: unknown } })
    ?.snapshot?.value;
  const event = world.calendar.peek(
    booking.calendarId,
    booking.calendarEventId,
  );
  const { getStatusFromXState } =
    await import("@/components/src/utils/statusFromXState");
  return {
    machine,
    top:
      typeof machine === "string"
        ? machine
        : (Object.keys((machine as object) ?? {})[0] ?? "(none)"),
    stamps: LIFECYCLE_STAMPS.filter((stamp) => doc[stamp] != null),
    display: String(getStatusFromXState(doc as never, booking.tenant)),
    calendarPrefix: event ? prefixOf(event.summary) : null,
    emails: world.emails.length + world.gmail.sent.length,
  };
}
