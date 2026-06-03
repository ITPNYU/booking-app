import { TableNames } from "@/components/src/policy";
import { serverGetDocumentById } from "@/lib/firebase/server/adminDb";
import { coerceTenantSchema } from "@/lib/tenant/coerceTenantSchema";
import type { EmailNotifications } from "../client/routes/components/schemaTypes";
import { DevBranch } from "../types";

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
  emailNotifications: EmailNotifications;
}

const emptyEmailNotifications = (): EmailNotifications => ({
  requestedUser: "",
  requestedNeedsApproval: "",
  reviewedNeedsApproval: "",
  approvedWalkIn: "",
  approvedVIP: "",
  checkedOut: "",
  checkedIn: "",
  declined: "",
  canceled: "",
  canceledLate: "",
  noShow: "",
  closed: "",
  approvedUser: "",
});

/**
 * Helper function to get tenant email configuration (schema name, header messages)
 * @param tenant - The tenant identifier
 */
export const getTenantEmailConfig = async (
  tenant?: string,
): Promise<TenantEmailConfig> => {
  let schemaName = "Media Commons";
  let emailNotifications = emptyEmailNotifications();

  if (tenant) {
    try {
      const raw = await serverGetDocumentById<Record<string, unknown>>(
        TableNames.TENANT_SCHEMA,
        tenant,
      );
      const schema = raw ? coerceTenantSchema(raw, tenant) : null;
      if (schema?.tenant?.name) {
        schemaName = schema.tenant.name;
      }
      if (schema?.emailNotifications) {
        emailNotifications = {
          ...emptyEmailNotifications(),
          ...schema.emailNotifications,
        };
      }
    } catch (error) {
      console.error("Error fetching tenant schema for email:", error);
    }
  }

  return {
    schemaName,
    emailNotifications,
  };
};
