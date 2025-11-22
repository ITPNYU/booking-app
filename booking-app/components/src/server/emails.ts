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
  emailMessages: {
    requestConfirmation: string;
    firstApprovalRequest: string;
    secondApprovalRequest: string;
    walkInConfirmation: string;
    vipConfirmation: string;
    checkoutConfirmation: string;
    checkinConfirmation: string;
    declined: string;
    canceled: string;
    lateCancel: string;
    noShow: string;
    closed: string;
    approvalNotice: string;
  };
}

/**
 * Helper function to get tenant email configuration (schema name, header messages, and approval notice)
 * @param tenant - The tenant identifier
 * @returns Promise<TenantEmailConfig> - The email configuration with fallbacks
 */
export const getTenantEmailConfig = async (tenant?: string): Promise<TenantEmailConfig> => {
  let schemaName = "Media Commons"; // fallback
  let emailMessages = {
    requestConfirmation: "",
    firstApprovalRequest: "",
    secondApprovalRequest: "",
    walkInConfirmation: "",
    vipConfirmation: "",
    checkoutConfirmation: "",
    checkinConfirmation: "",
    declined: "",
    canceled: "",
    lateCancel: "",
    noShow: "",
    closed: "",
    approvalNotice: "",
  };
  
  if (tenant) {
    try {
      const schema = await serverGetDocumentById(
        TableNames.TENANT_SCHEMA,
        tenant
      );
      if (schema?.name) {
        schemaName = schema.name;
      }
      if (schema?.emailMessages) {
        // Use the nested emailMessages object from schema
        emailMessages = {
          requestConfirmation: schema.emailMessages.requestConfirmation || "",
          firstApprovalRequest: schema.emailMessages.firstApprovalRequest || "",
          secondApprovalRequest: schema.emailMessages.secondApprovalRequest || "",
          walkInConfirmation: schema.emailMessages.walkInConfirmation || "",
          vipConfirmation: schema.emailMessages.vipConfirmation || "",
          checkoutConfirmation: schema.emailMessages.checkoutConfirmation || "",
          checkinConfirmation: schema.emailMessages.checkinConfirmation || "",
          declined: schema.emailMessages.declined || "",
          canceled: schema.emailMessages.canceled || "",
          lateCancel: schema.emailMessages.lateCancel || "",
          noShow: schema.emailMessages.noShow || "",
          closed: schema.emailMessages.closed || "",
          approvalNotice: schema.emailMessages.approvalNotice || "",
        };
      }
    } catch (error) {
      console.error("Error fetching tenant schema for email:", error);
    }
  }
  
  return { 
    schemaName, 
    emailMessages
  };
};


