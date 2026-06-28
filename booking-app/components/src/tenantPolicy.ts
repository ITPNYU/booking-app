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
 * Accepts a tenant string (for server-side) or falls back to MC.
 */
export function getTenantPolicy(tenant?: string): TenantPolicy {
  const key = normalizeTenant(tenant);
  return TENANT_POLICIES[key] || TENANT_POLICIES[DEFAULT_TENANT];
}
