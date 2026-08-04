import { coerceTenantSchema } from "@/lib/tenant/coerceTenantSchema";
import { serverGetDocumentById } from "@/lib/firebase/server/adminDb";

const TENANT_SCHEMA_COLLECTION = "tenantSchema";

type Environment = "development" | "staging" | "production";

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
    const raw = await serverGetDocumentById<Record<string, unknown>>(
      TENANT_SCHEMA_COLLECTION as any,
      tenant,
    );
    const schema = raw ? coerceTenantSchema(raw, tenant) : null;
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
    const raw = await serverGetDocumentById<Record<string, unknown>>(
      TENANT_SCHEMA_COLLECTION as any,
      tenant,
    );
    const schema = raw ? coerceTenantSchema(raw, tenant) : null;
    if (schema) {
      return resolveEmail(schema.ccEmails?.canceled);
    }
  } catch (error) {
    console.error("Failed to fetch tenant schema for canceled CC email:", error);
  }
  return "";
}

/** @deprecated branchName is ignored; environment comes from NEXT_PUBLIC_BRANCH_NAME */
export const getApprovalCcEmail = async (
  _branchName: string,
  tenant?: string,
): Promise<string> => {
  if (!tenant) return "";
  return getApprovedCcEmail(tenant);
};

export const getCancelCcEmail = async (tenant?: string): Promise<string> => {
  if (!tenant) return "";
  return getCanceledCcEmail(tenant);
};
