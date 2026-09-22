import { TableNames } from "@/components/src/policy";
import { PagePermission } from "@/components/src/types";
import { resolveCallerRole } from "@/lib/api/authz";
import type { SessionContext } from "@/lib/api/requireSession";

/**
 * Booking fields that only Services, Admin, and Super Admin callers may read.
 * The `/api/firestore/*` read routes strip them from `{tenant}-bookings`
 * documents for everyone else, so hiding them in the UI is not the only line
 * of defense.
 */
export const STAFF_ONLY_BOOKING_FIELDS = ["memo"] as const;

const STAFF_ROLES = new Set<PagePermission>([
  PagePermission.SERVICES,
  PagePermission.ADMIN,
  PagePermission.SUPER_ADMIN,
]);

export function canReadStaffOnlyBookingFields(role: PagePermission): boolean {
  return STAFF_ROLES.has(role);
}

export function stripStaffOnlyBookingFields<T extends Record<string, unknown>>(
  doc: T,
): T {
  let hasAny = false;
  for (const field of STAFF_ONLY_BOOKING_FIELDS) {
    if (field in doc) {
      hasAny = true;
      break;
    }
  }
  if (!hasAny) return doc;
  const copy: Record<string, unknown> = { ...doc };
  for (const field of STAFF_ONLY_BOOKING_FIELDS) {
    delete copy[field];
  }
  return copy as T;
}

/**
 * Redact staff-only fields from documents read out of `collection` unless the
 * caller's resolved role may see them. Non-booking collections pass through
 * untouched, and the role lookup only runs for the bookings collection so the
 * other read paths keep their single Firestore round-trip.
 */
export async function redactBookingDocsForCaller<
  T extends Record<string, unknown>,
>(
  session: SessionContext,
  tenant: string | undefined,
  collection: string,
  docs: T[],
): Promise<T[]> {
  if (collection !== TableNames.BOOKING || docs.length === 0) {
    return docs;
  }
  const role = await resolveCallerRole(session, tenant);
  if (canReadStaffOnlyBookingFields(role)) {
    return docs;
  }
  return docs.map(stripStaffOnlyBookingFields);
}
