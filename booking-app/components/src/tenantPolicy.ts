import type { SchemaContextType } from "./client/routes/components/SchemaProvider";
import {
  DEFAULT_TENANT,
  TENANTS,
  isMediaCommonsTenant,
} from "./constants/tenants";
// Inlined to avoid circular dependency with policy.ts
const TENANT_SCHEMA_COLLECTION = "tenantSchema";

type Environment = "development" | "staging" | "production";

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

// --- CC Emails (schema-driven) ---

function resolveEnvironment(): Environment {
  const branchName = process.env.NEXT_PUBLIC_BRANCH_NAME;
  if (branchName === "development") return "development";
  if (branchName === "staging") return "staging";
  return "production";
}

function resolveEmail(
  emailConfig?: { development: string; staging: string; production: string },
): string {
  if (!emailConfig) return "";
  return emailConfig[resolveEnvironment()] || "";
}

/**
 * Get approved CC email from tenant schema in Firestore.
 * Returns empty string if not configured.
 */
export async function getApprovedCcEmail(tenant: string): Promise<string> {
  try {
    const { serverGetDocumentById } = await import(
      "@/lib/firebase/server/adminDb"
    );
    const schema = await serverGetDocumentById<SchemaContextType>(
      TENANT_SCHEMA_COLLECTION,
      tenant,
    );
    if (schema) {
      return resolveEmail(schema.ccEmails?.approved);
    }
  } catch (error) {
    console.error("Failed to fetch tenant schema for approved CC email:", error);
  }
  return "";
}

/**
 * Get canceled CC email from tenant schema in Firestore.
 * Returns empty string if not configured.
 */
export async function getCanceledCcEmail(tenant: string): Promise<string> {
  try {
    const { serverGetDocumentById } = await import(
      "@/lib/firebase/server/adminDb"
    );
    const schema = await serverGetDocumentById<SchemaContextType>(
      TENANT_SCHEMA_COLLECTION,
      tenant,
    );
    if (schema) {
      return resolveEmail(schema.ccEmails?.canceled);
    }
  } catch (error) {
    console.error("Failed to fetch tenant schema for canceled CC email:", error);
  }
  return "";
}
