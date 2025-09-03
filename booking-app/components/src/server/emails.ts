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

export interface TenantEmailConfig {
  schemaName: string;
  emailHeaderMessage: string;
  approvalNotice: string;
}

/**
 * Helper function to get tenant email configuration (schema name, header message, and approval notice)
 * @param tenant - The tenant identifier
 * @returns Promise<TenantEmailConfig> - The email configuration with fallbacks
 */
export const getTenantEmailConfig = async (tenant?: string): Promise<TenantEmailConfig> => {
  let schemaName = "Media Commons"; // fallback
  let emailHeaderMessage = "";
  let approvalNotice = "";
  
  if (tenant) {
    try {
      const schema = await serverGetDocumentById(
        TableNames.TENANT_SCHEMA,
        tenant
      );
      if (schema?.name) {
        schemaName = schema.name;
      }
      if (schema?.emailHeaderMessage) {
        emailHeaderMessage = schema.emailHeaderMessage;
      }
      if (schema?.approvalNotice) {
        approvalNotice = "\n" + schema.approvalNotice + "\n";
      }
    } catch (error) {
      console.error("Error fetching tenant schema for email:", error);
    }
  }
  
  return { schemaName, emailHeaderMessage, approvalNotice };
};

/**
 * Helper function to get tenant schema name for email subjects
 * @param tenant - The tenant identifier
 * @returns Promise<string> - The schema name or "Media Commons" as fallback
 */
export const getTenantSchemaName = async (tenant?: string): Promise<string> => {
  const config = await getTenantEmailConfig(tenant);
  return config.schemaName;
};
