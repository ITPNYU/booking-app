import { TableNames } from "@/components/src/policy";

/**
 * Booking fields that only the roles in the tenant schema's
 * `detailsModal.memoViewRoles` / `memoEditRoles` may read (and only while
 * `detailsModal.showMemo` is on). The `/api/firestore/*` read routes strip
 * them from `{tenant}-bookings` documents for everyone else, so hiding them in
 * the UI is not the only line of defense.
 */
export const STAFF_ONLY_BOOKING_FIELDS = ["memo"] as const;

/**
 * Booking fields that only their dedicated route may write, because that
 * route enforces the tenant schema's `detailsModal` edit roles: the staff-only
 * fields above (`PUT /api/bookings/memo`) plus the WebCheckout cart number
 * (`POST /api/updateWebcheckoutCart`, `detailsModal.webCheckoutEditRoles`).
 * Unlike the staff-only fields, the cart number is not redacted from reads.
 */
const DEDICATED_ROUTE_BOOKING_FIELDS = [
  ...STAFF_ONLY_BOOKING_FIELDS,
  "webcheckoutCartNumber",
] as const;

/** The dedicated-route field that write key `key` touches, or null. Matches a top-level key or a dotted field path rooted at it (`memo.x`). */
function staffOnlyFieldForKey(key: string): string | null {
  for (const field of DEDICATED_ROUTE_BOOKING_FIELDS) {
    if (key === field || key.startsWith(`${field}.`)) {
      return field;
    }
  }
  return null;
}

/**
 * Return the first staff-only or other dedicated-route booking field that
 * `data` would write to `collection`, or null. The generic `/api/firestore/mutate` route refuses
 * such writes to `{tenant}-bookings` regardless of role.
 */
export function findStaffOnlyBookingFieldWrite(
  collection: string,
  data: Record<string, unknown> | undefined | null,
): string | null {
  if (collection !== TableNames.BOOKING || !data || typeof data !== "object") {
    return null;
  }
  for (const key of Object.keys(data)) {
    const field = staffOnlyFieldForKey(key);
    if (field) return field;
  }
  return null;
}

/**
 * Drop staff-only and other dedicated-route fields from a client-supplied
 * booking payload before the booking create/edit routes persist it. Those
 * routes only `add` or `update` the booking document, so an existing memo or
 * cart number survives an edit untouched. Together with the mutate route's
 * refusal, this leaves `PUT /api/bookings/memo` as the only path that writes
 * the memo and `POST /api/updateWebcheckoutCart` the only path that writes the
 * cart number, so their role checks cannot be skipped.
 */
export function omitStaffOnlyBookingFieldWrites<T>(data: T): T {
  if (!data || typeof data !== "object" || Array.isArray(data)) return data;
  const keys = Object.keys(data);
  if (!keys.some((key) => staffOnlyFieldForKey(key))) return data;
  const copy: Record<string, unknown> = {};
  for (const key of keys) {
    if (!staffOnlyFieldForKey(key)) {
      copy[key] = (data as Record<string, unknown>)[key];
    }
  }
  return copy as T;
}
