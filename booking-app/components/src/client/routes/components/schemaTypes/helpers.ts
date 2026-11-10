// Runtime helpers and public defaults. Values come from parsing the Zod
// schemas so the default literals live in one place.

import { isMediaCommonsTenant } from "@/components/src/constants/tenants";

import {
  attestationSchema,
  bookingDetailRoleSchema,
  contextLabelsSchema,
  detailsModalSchema,
  formConfigSchema,
  productionScheduleSchema,
  resourceSchema,
  staffingSectionSchema,
  tenantSchema,
} from "./schemas";
import type {
  ApprovalFlow,
  BookingDetailRole,
  ContextLabels,
  SchemaContextType,
} from "./types";

export const BOOKING_DETAIL_ROLES = bookingDetailRoleSchema.options;

const detailsModalDefaults = detailsModalSchema.parse({});

export const DEFAULT_MEMO_ROLES: readonly BookingDetailRole[] =
  detailsModalDefaults.memoViewRoles;

/**
 * Roles that see and edit the WebCheckout cart by default, matching the
 * PA/Admin/Super Admin access WebCheckout had before it was configurable.
 */
export const DEFAULT_WEBCHECKOUT_ROLES: readonly BookingDetailRole[] =
  detailsModalDefaults.webCheckoutViewRoles;

/**
 * Normalize a stored booking detail role list, failing closed. Only an unset
 * list (undefined or null) gets `defaults`; unknown entries and duplicates are
 * dropped, so an explicit `[]` or a list of only unknown roles grants nobody,
 * and a malformed non-array value grants nobody too.
 */
function normalizeDetailRoles(
  raw: unknown,
  defaults: readonly BookingDetailRole[],
): BookingDetailRole[] {
  if (raw === undefined || raw === null) return [...defaults];
  if (!Array.isArray(raw)) return [];
  const allowed = new Set<string>(BOOKING_DETAIL_ROLES);
  const roles = raw.filter(
    (role): role is BookingDetailRole =>
      typeof role === "string" && allowed.has(role),
  );
  return Array.from(new Set(roles));
}

/** Normalize a stored memo role list; see `normalizeDetailRoles`. */
export function normalizeMemoRoles(raw: unknown): BookingDetailRole[] {
  return normalizeDetailRoles(raw, DEFAULT_MEMO_ROLES);
}

/** Normalize a stored WebCheckout role list; see `normalizeDetailRoles`. */
export function normalizeWebCheckoutRoles(raw: unknown): BookingDetailRole[] {
  return normalizeDetailRoles(raw, DEFAULT_WEBCHECKOUT_ROLES);
}

export const defaultStaffingSection = staffingSectionSchema.parse({});

export const defaultResource = resourceSchema.parse({});

export const defaultAttestation = attestationSchema.parse({});

export const defaultProductionSchedule = productionScheduleSchema.parse({});

export const defaultFormAlerts = formConfigSchema.parse({}).alerts;

/**
 * Shown in the schema editor when a tenant has no `approvalFlow`. Key order
 * matches the editor's sorted JSON so an unchanged section stays unwritten.
 * This is not a Zod default.
 */
export const approvalFlowEditorStarter: ApprovalFlow = {
  initial: "Requested",
  states: {
    Approved: {},
    Requested: {
      on: {
        approve: { target: "Approved" },
      },
    },
  },
  version: 1,
};

export const defaultScheme: Omit<SchemaContextType, "tenantId"> = tenantSchema
  .omit({ tenantId: true })
  .parse({});

const defaultContextLabelsByTenantId = (tenantId?: string): ContextLabels => {
  const normalized = (tenantId || "").toLowerCase();
  if (normalized === "itp") {
    return contextLabelsSchema.parse({
      user: "User",
      worker: "ER",
      reviewer: "1st Approver",
      services: "Services",
      admin: "Admin",
    });
  }
  return contextLabelsSchema.parse({});
};

export function generateDefaultSchema(tenantId: string): SchemaContextType {
  const schema = tenantSchema.parse({ tenantId });
  return {
    ...schema,
    tenant: {
      ...schema.tenant,
      contextLabels: defaultContextLabelsByTenantId(tenantId),
    },
    form: {
      ...schema.form,
      services: { ...schema.form.services },
      // MC requires production schedules for long reservations (#1126).
      productionSchedule: {
        ...defaultProductionSchedule,
        enabled: isMediaCommonsTenant(tenantId),
      },
    },
  };
}
