import { MEDIA_COMMONS_OPERATION_EMAIL } from "./mediaCommonsPolicy";
import { ITP_OPERATION_EMAIL } from "./itpPolicy";
import {
  DEFAULT_TENANT,
  TENANTS,
  isMediaCommonsTenant,
} from "./constants/tenants";

type Environment = "development" | "staging" | "production";

interface TenantEmailConfig {
  operationEmail: {
    development: string;
    staging: string;
    production: string;
  };
  cancelCcEmail?: {
    development: string;
    staging: string;
    production: string;
  };
}

export interface TenantPolicy {
  emails: TenantEmailConfig;
  approvalLevels: 1 | 2;
  hasServiceRequests: boolean;
  autoCloseOnCheckout: boolean;
}

const MC_POLICY: TenantPolicy = {
  emails: {
    operationEmail: {
      development: "booking-app-devs+operation@itp.nyu.edu",
      staging: MEDIA_COMMONS_OPERATION_EMAIL,
      production: MEDIA_COMMONS_OPERATION_EMAIL,
    },
    cancelCcEmail: {
      development: "booking-app-devs+cancelcc@itp.nyu.edu",
      staging: MEDIA_COMMONS_OPERATION_EMAIL,
      production: MEDIA_COMMONS_OPERATION_EMAIL,
    },
  },
  approvalLevels: 2,
  hasServiceRequests: true,
  autoCloseOnCheckout: false,
};

const ITP_POLICY: TenantPolicy = {
  emails: {
    operationEmail: {
      development: "booking-app-devs+operation@itp.nyu.edu",
      staging: ITP_OPERATION_EMAIL,
      production: ITP_OPERATION_EMAIL,
    },
  },
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

function resolveEnvironment(branchName?: string): Environment {
  if (branchName === "development") return "development";
  if (branchName === "staging") return "staging";
  return "production";
}

export function getTenantPolicy(tenant?: string): TenantPolicy {
  const key = normalizeTenant(tenant);
  return TENANT_POLICIES[key] || TENANT_POLICIES[DEFAULT_TENANT];
}

export function getOperationEmail(
  tenant?: string,
  branchName?: string,
): string {
  const policy = getTenantPolicy(tenant);
  const env = resolveEnvironment(branchName);
  return policy.emails.operationEmail[env];
}

export function getCancelCcEmailForTenant(
  tenant?: string,
  branchName?: string,
): string {
  const policy = getTenantPolicy(tenant);
  const env = resolveEnvironment(branchName);
  return (policy.emails.cancelCcEmail || policy.emails.operationEmail)[env];
}
