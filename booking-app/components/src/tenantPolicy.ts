import type { BookingProfile } from "./client/routes/components/schemaTypes";
import {
  DEFAULT_TENANT,
  TENANTS,
  isMediaCommonsTenant,
} from "./constants/tenants";

export interface TenantPolicy {
  approvalLevels: 1 | 2;
  hasServiceRequests: boolean;
  autoCloseOnCheckout: boolean;
}

const MC_POLICY: TenantPolicy = {
  approvalLevels: 2,
  hasServiceRequests: true,
  autoCloseOnCheckout: false,
};

const ITP_POLICY: TenantPolicy = {
  approvalLevels: 1,
  hasServiceRequests: false,
  autoCloseOnCheckout: true,
};

const TENANT_POLICIES: Record<string, TenantPolicy> = {
  [TENANTS.MC]: MC_POLICY,
  [TENANTS.ITP]: ITP_POLICY,
};

function normalizeTenant(tenant?: string): string {
  if (!tenant) return DEFAULT_TENANT;
  if (isMediaCommonsTenant(tenant)) return TENANTS.MC;
  return tenant.toLowerCase();
}

/**
 * Get hardcoded tenant policy (approvalLevels, hasServiceRequests, etc.).
 * mc and itp keep their own policies. Other tenants follow bookingProfile,
 * and still fall back to Media Commons when no profile is provided.
 */
export function getTenantPolicy(
  tenant?: string,
  bookingProfile?: BookingProfile,
): TenantPolicy {
  const key = normalizeTenant(tenant);
  if (key === TENANTS.MC || key === TENANTS.ITP) {
    return TENANT_POLICIES[key] || TENANT_POLICIES[DEFAULT_TENANT];
  }
  if (bookingProfile === "itp") return ITP_POLICY;
  if (bookingProfile === "mc") return MC_POLICY;
  return TENANT_POLICIES[DEFAULT_TENANT];
}
