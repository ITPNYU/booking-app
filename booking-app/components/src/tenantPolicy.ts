import { SchemaContextType } from "./client/routes/components/SchemaProvider";
import { TableNames } from "./policy";

type Environment = "development" | "staging" | "production";

export interface TenantPolicy {
  approvedCcEmail: string;
  canceledCcEmail: string;
  approvalLevels: 1 | 2;
  hasServiceRequests: boolean;
  autoCloseOnCheckout: boolean;
}

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

function policyFromSchema(schema: SchemaContextType): TenantPolicy {
  return {
    approvedCcEmail: resolveEmail(schema.ccEmails?.approved),
    canceledCcEmail: resolveEmail(schema.ccEmails?.canceled),
    approvalLevels: schema.approvalLevels ?? 2,
    hasServiceRequests: schema.hasServiceRequests ?? true,
    autoCloseOnCheckout: schema.autoCloseOnCheckout ?? false,
  };
}

/**
 * Fetch tenant policy from Firestore schema.
 * Use this on the server side where React context is not available.
 */
export async function getTenantPolicyFromSchema(
  tenant: string,
): Promise<TenantPolicy> {
  try {
    const { serverGetDocumentById } = await import(
      "@/lib/firebase/server/adminDb"
    );
    const schema = await serverGetDocumentById<SchemaContextType>(
      TableNames.TENANT_SCHEMA,
      tenant,
    );
    if (schema) {
      return policyFromSchema(schema);
    }
  } catch (error) {
    console.error("Failed to fetch tenant schema for policy:", error);
  }
  return {
    approvedCcEmail: "",
    canceledCcEmail: "",
    approvalLevels: 2,
    hasServiceRequests: true,
    autoCloseOnCheckout: false,
  };
}

/**
 * Build tenant policy from an already-loaded schema.
 * Use this on the client side where schema is available via context.
 */
export function getTenantPolicy(schema: SchemaContextType): TenantPolicy {
  return policyFromSchema(schema);
}

/**
 * Get approved CC email from schema. Returns empty string if not configured.
 */
export async function getApprovedCcEmail(tenant: string): Promise<string> {
  const policy = await getTenantPolicyFromSchema(tenant);
  return policy.approvedCcEmail;
}

/**
 * Get canceled CC email from schema. Returns empty string if not configured.
 */
export async function getCanceledCcEmail(tenant: string): Promise<string> {
  const policy = await getTenantPolicyFromSchema(tenant);
  return policy.canceledCcEmail;
}
