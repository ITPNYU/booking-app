import { TableNames } from "@/components/src/policy";
import type { PagePermission } from "@/components/src/types";
import type { DetailsModalConfig } from "@/components/src/client/routes/components/schemaTypes";
import { generateDefaultSchema } from "@/components/src/client/routes/components/schemaTypes";
import { canAccessMemo } from "@/components/src/utils/bookingMemoAccess";
import { resolveCallerRole } from "@/lib/api/authz";
import type { SessionContext } from "@/lib/api/requireSession";
import { getCachedTenantSchema } from "@/lib/tenant/getCachedTenantSchema";
import { STAFF_ONLY_BOOKING_FIELDS } from "@/lib/api/staffOnlyBookingFields";

export {
  STAFF_ONLY_BOOKING_FIELDS,
  findStaffOnlyBookingFieldWrite,
  omitStaffOnlyBookingFieldWrites,
} from "@/lib/api/staffOnlyBookingFields";

/**
 * Load the tenant's booking detail modal config, falling back to the defaults
 * (memo hidden) when the tenant has no schema.
 */
export async function getDetailsModalConfig(
  tenant: string | undefined,
): Promise<DetailsModalConfig> {
  const schema = tenant ? await getCachedTenantSchema(tenant) : null;
  return (
    schema?.detailsModal ?? generateDefaultSchema(tenant ?? "").detailsModal
  );
}

/** Whether `role` may read staff-only booking fields for `tenant`. */
export async function canReadStaffOnlyBookingFields(
  tenant: string | undefined,
  role: PagePermission,
): Promise<boolean> {
  const detailsModal = await getDetailsModalConfig(tenant);
  return canAccessMemo(detailsModal, role, "view");
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
