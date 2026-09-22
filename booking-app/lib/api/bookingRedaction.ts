import { TableNames } from "@/components/src/policy";
import type { PagePermission } from "@/components/src/types";
import type { BookingDetailConfig } from "@/components/src/client/routes/components/schemaTypes";
import { generateDefaultSchema } from "@/components/src/client/routes/components/schemaTypes";
import { canAccessMemo } from "@/components/src/utils/bookingMemoAccess";
import { resolveCallerRole } from "@/lib/api/authz";
import type { SessionContext } from "@/lib/api/requireSession";
import { getCachedTenantSchema } from "@/lib/tenant/getCachedTenantSchema";

/**
 * Booking fields that only the roles in the tenant schema's
 * `detail.memoRoles` may read (and only while `detail.showMemo` is on).
 * The `/api/firestore/*` read routes strip them from `{tenant}-bookings`
 * documents for everyone else, so hiding them in the UI is not the only line
 * of defense.
 */
export const STAFF_ONLY_BOOKING_FIELDS = ["memo"] as const;

/**
 * Load the tenant's booking detail config, falling back to the defaults
 * (memo hidden) when the tenant has no schema.
 */
export async function getBookingDetailConfig(
  tenant: string | undefined,
): Promise<BookingDetailConfig> {
  const schema = tenant ? await getCachedTenantSchema(tenant) : null;
  return schema?.detail ?? generateDefaultSchema(tenant ?? "").detail;
}

/** Whether `role` may read or write staff-only booking fields for `tenant`. */
export async function canReadStaffOnlyBookingFields(
  tenant: string | undefined,
  role: PagePermission,
): Promise<boolean> {
  const detail = await getBookingDetailConfig(tenant);
  return canAccessMemo(detail, role);
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
 * Return the first staff-only booking field that `data` would write, or null.
 * Matches a top-level key or a dotted field path rooted at it (`memo.x`).
 * The generic `/api/firestore/mutate` route refuses such writes to
 * `{tenant}-bookings` regardless of role, so the dedicated
 * `PUT /api/bookings/memo` route is the only path that can set them and its
 * role, trimming, and length rules cannot be skipped.
 */
export function findStaffOnlyBookingFieldWrite(
  collection: string,
  data: Record<string, unknown> | undefined | null,
): string | null {
  if (collection !== TableNames.BOOKING || !data || typeof data !== "object") {
    return null;
  }
  for (const key of Object.keys(data)) {
    for (const field of STAFF_ONLY_BOOKING_FIELDS) {
      if (key === field || key.startsWith(`${field}.`)) {
        return field;
      }
    }
  }
  return null;
}

/**
 * Redact staff-only fields from documents read out of `collection` unless the
 * caller's resolved role is allowed by the tenant schema. Non-booking
 * collections pass through untouched, and the role and schema lookups only
 * run for the bookings collection so the other read paths keep their single
 * Firestore round-trip.
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
  if (await canReadStaffOnlyBookingFields(tenant, role)) {
    return docs;
  }
  return docs.map(stripStaffOnlyBookingFields);
}
