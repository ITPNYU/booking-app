import admin from "@/lib/firebase/server/firebaseAdmin";
import {
  ApproverLevel,
  TableNames,
  getTenantCollectionName,
} from "@/components/src/policy";
import { PagePermission } from "@/components/src/types";
import { hasLegacyServiceApproverFlag } from "@/components/src/utils/approversResources";
import type { SessionContext } from "@/lib/api/requireSession";
import { MAINTENANCE_MODE_SETTINGS_DOC_ID } from "@/lib/utils/maintenanceMode";

/** Whether `email` approves a service on some resource of the tenant. */
export async function isAssignedServiceApprover(
  email: string,
  tenant: string,
): Promise<boolean> {
  const snapshot = await admin
    .firestore()
    .collection(getTenantCollectionName(TableNames.APPROVERS_RESOURCES, tenant))
    .where("serviceApproverEmails", "array-contains", email)
    .limit(1)
    .get();
  return !snapshot.empty;
}

/**
 * Whether the caller approves at least one service in the tenant: by a
 * tenant-wide `usersRights` flag or by an assignment on some resource. Both
 * reach the Services page; `/api/permissions` uses this to compute it.
 */
export async function isServiceApprover(
  email: string,
  tenant: string,
  userRights: Record<string, unknown> | null | undefined,
): Promise<boolean> {
  return (
    hasLegacyServiceApproverFlag(userRights) ||
    isAssignedServiceApprover(email, tenant)
  );
}

export type ResolveCallerRoleOptions = {
  /**
   * Count service approvers (a `usersRights` service flag or an assignment
   * on some resource) as SERVICES. Off by default: being a service approver
   * gets you the Services page (from `/api/permissions`) and the right to
   * decide that service on bookings for your rooms (checked per booking in
   * `/api/services`), not the SERVICES role's tenant-wide powers such as
   * modifying bookings, editing WebCheckout carts or reading memos. Pass it
   * only where SERVICES gates data any approver may see. It can cost one
   * more query.
   */
  includeServiceApprovers?: boolean;
};

/**
 * Resolve the caller's role for a given tenant by reading the same
 * permission-source collections that `Provider.tsx` consults client-side.
 * Performed via firebase-admin so it bypasses Firestore rules — these reads
 * are the trusted server-side equivalent of the security model that NYU SSO
 * removed when Firebase Auth went away.
 */
export async function resolveCallerRole(
  session: SessionContext,
  tenant: string | undefined,
  { includeServiceApprovers = false }: ResolveCallerRoleOptions = {},
): Promise<PagePermission> {
  const email = session.email;
  const db = admin.firestore();

  // SUPER_ADMIN is global (not tenant-scoped).
  const superSnap = await db
    .collection(TableNames.SUPER_ADMINS)
    .where("email", "==", email)
    .limit(1)
    .get();
  if (!superSnap.empty) return PagePermission.SUPER_ADMIN;

  if (!tenant) return PagePermission.BOOKING;

  const usersRightsCollection = getTenantCollectionName(
    TableNames.USERS_RIGHTS,
    tenant,
  );
  const usersRightsSnap = await db
    .collection(usersRightsCollection)
    .where("email", "==", email)
    .limit(1)
    .get();
  const userRights = usersRightsSnap.empty
    ? null
    : (usersRightsSnap.docs[0].data() as Record<string, unknown>);
  if (userRights?.isAdmin === true) return PagePermission.ADMIN;

  const approversCollection = getTenantCollectionName(
    TableNames.APPROVERS,
    tenant,
  );
  const approverSnap = await db
    .collection(approversCollection)
    .where("email", "==", email)
    .limit(1)
    .get();
  if (!approverSnap.empty) {
    const data = approverSnap.docs[0].data() as Record<string, unknown>;
    const level = Number(data.level);
    if (level === ApproverLevel.EQUIPMENT) return PagePermission.SERVICES;
    return PagePermission.LIAISON;
  }

  if (userRights?.isWorker === true) return PagePermission.PA;

  // Last, so SERVICES is only ever added for someone who would otherwise
  // just book; nobody loses the role they have today.
  if (
    includeServiceApprovers &&
    (await isServiceApprover(email, tenant, userRights))
  ) {
    return PagePermission.SERVICES;
  }

  return PagePermission.BOOKING;
}

/**
 * Per-collection access policy enforced by `/api/firestore/*`.
 *
 * `read`/`write` describe the minimum role required. The previous
 * Firestore security rules were the trust boundary; once the admin SDK
 * bypasses them, this table is the boundary.
 */
type Role = "anyNYU" | "paOrAbove" | "adminOrSuper" | "superOnly" | "deny";

type Policy = { read: Role; write: Role };

// Collection name (without tenant prefix) → policy.
// Unknown collections fall through to `DEFAULT_POLICY` (deny).
const POLICY: Record<string, Policy> = {
  // Permission-source collections — readable by any NYU user because the
  // browser needs them to compute its own role; writable by admins.
  [TableNames.SUPER_ADMINS]: { read: "anyNYU", write: "superOnly" },
  [TableNames.USERS_RIGHTS]: { read: "anyNYU", write: "adminOrSuper" },
  [TableNames.APPROVERS]: { read: "anyNYU", write: "adminOrSuper" },
  // Approver assignments: admins read them in Settings; writes go through
  // /api/approversResources, which validates and keeps serviceApproverEmails
  // in step.
  [TableNames.APPROVERS_RESOURCES]: { read: "adminOrSuper", write: "deny" },
  [TableNames.ADMINS]: { read: "anyNYU", write: "adminOrSuper" },
  [TableNames.PAS]: { read: "anyNYU", write: "adminOrSuper" },

  // Tenant config — readable by all, writes go through dedicated routes.
  [TableNames.TENANT_SCHEMA]: { read: "anyNYU", write: "deny" },

  // Public-ish reference data — anyone signed in can read; admins curate.
  [TableNames.BOOKING_TYPES]: { read: "anyNYU", write: "adminOrSuper" },
  [TableNames.DEPARTMENTS]: { read: "anyNYU", write: "adminOrSuper" },
  [TableNames.OPERATION_HOURS]: { read: "anyNYU", write: "adminOrSuper" },
  [TableNames.BLACKOUT_PERIODS]: { read: "anyNYU", write: "adminOrSuper" },
  [TableNames.SAFETY_TRAINING]: { read: "anyNYU", write: "adminOrSuper" },
  [TableNames.RESOURCES]: { read: "anyNYU", write: "adminOrSuper" },
  [TableNames.SETTINGS]: { read: "anyNYU", write: "adminOrSuper" },
  [TableNames.POLICY_SETTINGS]: { read: "anyNYU", write: "adminOrSuper" },

  // Pre-ban audit log — only the admin "PreBan" page reads it.
  [TableNames.PRE_BAN_LOGS]: { read: "adminOrSuper", write: "adminOrSuper" },

  // Banned-users list is consulted in the regular booking flow
  // (`bookingProvider.tsx` blocks banned users from booking), so any
  // authenticated NYU user needs read access. Writes stay admin-only.
  // Server-side "am I banned?" filtering is a defense-in-depth followup.
  [TableNames.BANNED]: { read: "anyNYU", write: "adminOrSuper" },

  // Bookings / logs — any authenticated NYU user can read because regular
  // users see their own bookings on `/[tenant]/my-bookings` and the
  // current implementation filters client-side (`filterPageContext` in
  // `useBookingFilters.ts`). Tightening this to server-side filtering is
  // the right next step but out of scope for the SSO regression fix.
  //
  // Writes go through dedicated `/api/bookings/*` routes for the XState
  // lifecycle, but a few staff UI controls (e.g. `EquipmentCheckoutToggle`
  // calling `clientUpdateDataByCalendarEventId`) still flip booking fields
  // directly. Allow PA and above so those controls keep working; further
  // tightening belongs in a followup that routes those mutations through
  // dedicated endpoints.
  [TableNames.BOOKING]: { read: "anyNYU", write: "paOrAbove" },
  [TableNames.BOOKING_LOGS]: { read: "anyNYU", write: "paOrAbove" },
};

const DEFAULT_POLICY: Policy = { read: "deny", write: "deny" };

function getPolicy(collection: string): Policy {
  return POLICY[collection] ?? DEFAULT_POLICY;
}

function roleSatisfies(actual: PagePermission, required: Role): boolean {
  switch (required) {
    case "deny":
      return false;
    case "anyNYU":
      return true;
    case "paOrAbove":
      return (
        actual === PagePermission.PA ||
        actual === PagePermission.LIAISON ||
        actual === PagePermission.SERVICES ||
        actual === PagePermission.ADMIN ||
        actual === PagePermission.SUPER_ADMIN
      );
    case "adminOrSuper":
      return (
        actual === PagePermission.ADMIN || actual === PagePermission.SUPER_ADMIN
      );
    case "superOnly":
      return actual === PagePermission.SUPER_ADMIN;
  }
}

export type AccessGranted = { ok: true; role: PagePermission };
export type AccessDenied = {
  ok: false;
  status: 401 | 403;
  reason: string;
};
export type AccessDecision = AccessGranted | AccessDenied;

export function isAccessDenied(d: AccessDecision): d is AccessDenied {
  return d.ok === false;
}

/**
 * Authorize a read against the policy table for the given collection.
 * Caller is responsible for ensuring `session` is non-null beforehand.
 */
export async function authorizeRead(
  session: SessionContext,
  tenant: string | undefined,
  collection: string,
): Promise<AccessDecision> {
  const policy = getPolicy(collection);
  if (policy.read === "deny") {
    return { ok: false, status: 403, reason: `read denied for ${collection}` };
  }
  if (policy.read === "anyNYU") {
    // No role lookup needed — saves a Firestore round-trip on the hot path.
    return { ok: true, role: PagePermission.BOOKING };
  }
  const role = await resolveCallerRole(session, tenant);
  if (!roleSatisfies(role, policy.read)) {
    return {
      ok: false,
      status: 403,
      reason: `read denied for ${collection} (role=${role}, requires=${policy.read})`,
    };
  }
  return { ok: true, role };
}

export async function authorizeWrite(
  session: SessionContext,
  tenant: string | undefined,
  collection: string,
  docId?: string,
): Promise<AccessDecision> {
  const policy =
    collection === TableNames.SETTINGS &&
    docId === MAINTENANCE_MODE_SETTINGS_DOC_ID
      ? { ...getPolicy(collection), write: "superOnly" as const }
      : getPolicy(collection);
  if (policy.write === "deny") {
    return { ok: false, status: 403, reason: `write denied for ${collection}` };
  }
  if (policy.write === "anyNYU") {
    return { ok: true, role: PagePermission.BOOKING };
  }
  const role = await resolveCallerRole(session, tenant);
  if (!roleSatisfies(role, policy.write)) {
    return {
      ok: false,
      status: 403,
      reason: `write denied for ${collection} (role=${role}, requires=${policy.write})`,
    };
  }
  return { ok: true, role };
}
