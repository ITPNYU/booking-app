import type { Seeded } from "./observe";

const STAFF = { email: "admin@nyu.edu", netId: "admin" };

const client = () => import("@/components/src/client/bookingActionClient");

/**
 * The booking actions as the admin UI performs them: the same client
 * functions the buttons call, so client-side fallbacks are exercised too.
 */
export const OPERATIONS = {
  approve: async (b: Seeded) =>
    (await client()).clientApproveBooking(
      b.calendarEventId,
      STAFF.email,
      b.tenant,
    ),
  decline: async (b: Seeded) =>
    (await client()).decline(
      b.calendarEventId,
      STAFF.email,
      "Not available",
      b.tenant,
    ),
  cancel: async (b: Seeded) =>
    (await client()).cancel(
      b.calendarEventId,
      STAFF.email,
      STAFF.netId,
      b.tenant,
    ),
  checkIn: async (b: Seeded) =>
    (await client()).checkin(b.calendarEventId, STAFF.email, b.tenant),
  checkOut: async (b: Seeded) =>
    (await client()).checkOut(b.calendarEventId, STAFF.email, b.tenant),
  noShow: async (b: Seeded) =>
    (await client()).noShow(
      b.calendarEventId,
      STAFF.email,
      STAFF.netId,
      b.tenant,
    ),
} as const;

export type Operation = keyof typeof OPERATIONS;

/** Run an operation; a thrown error is how the UI learns it was refused. */
export async function attempt(op: Operation, booking: Seeded) {
  try {
    await OPERATIONS[op](booking);
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: (error as Error).message };
  }
}
