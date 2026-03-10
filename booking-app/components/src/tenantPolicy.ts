import { MEDIA_COMMONS_OPERATION_EMAIL } from "./mediaCommonsPolicy";
import { ITP_OPERATION_EMAIL } from "./itpPolicy";

type Environment = "development" | "staging" | "production";

interface TenantEmailConfig {
  operationEmail: {
    development: string;
    staging: string;
    production: string;
  };
}

interface TenantPolicy {
  emails: TenantEmailConfig;
  approvalLevels: 1 | 2;
  hasServiceRequests: boolean;
  autoCloseOnCheckout: boolean;
}

const TENANT_POLICIES: Record<string, TenantPolicy> = {
  mc: {
    emails: {
      operationEmail: {
        development: "booking-app-devs+operation@itp.nyu.edu",
        staging: MEDIA_COMMONS_OPERATION_EMAIL,
        production: MEDIA_COMMONS_OPERATION_EMAIL,
      },
    },
    approvalLevels: 2,
    hasServiceRequests: true,
    autoCloseOnCheckout: false,
  },
  itp: {
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
  },
};

const DEFAULT_TENANT = "mc";

function resolveEnvironment(branchName?: string): Environment {
  if (branchName === "development") return "development";
  if (branchName === "staging") return "staging";
  return "production";
}

export function getTenantPolicy(tenant?: string): TenantPolicy {
  const key = tenant?.toLowerCase() || DEFAULT_TENANT;
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
