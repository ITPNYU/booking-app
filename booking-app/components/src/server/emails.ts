import { DevBranch } from "../types";
import { TableNames } from "@/components/src/policy";
import { serverGetDocumentById } from "@/lib/firebase/server/adminDb";

export const getEmailBranchTag = () => {
  switch (process.env.NEXT_PUBLIC_BRANCH_NAME as DevBranch) {
    case "development":
      return "[DEV] ";
    case "staging":
      return "[STAGING] ";
    default:
      return "";
  }
};

/**
 * Helper function to get tenant schema name for email subjects
 * @param tenant - The tenant identifier
 * @returns Promise<string> - The schema name or "Media Commons" as fallback
 */
export const getTenantSchemaName = async (tenant?: string): Promise<string> => {
  let schemaName = "Media Commons"; // fallback
  if (tenant) {
    try {
      const schema = await serverGetDocumentById(
        TableNames.TENANT_SCHEMA,
        tenant
      );
      if (schema?.name) {
        schemaName = schema.name;
      }
    } catch (error) {
      console.error("Error fetching tenant schema for email:", error);
    }
  }
  return schemaName;
};
