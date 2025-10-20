import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock serverGetDocumentById at the module level using a factory function
vi.mock("@/lib/firebase/server/adminDb", () => ({
  serverGetDocumentById: vi.fn(),
}));

import { getEmailBranchTag, getTenantEmailConfig } from "@/components/src/server/emails";
import { serverGetDocumentById } from "@/lib/firebase/server/adminDb";

// Get reference to the mocked function
const mockServerGetDocumentById = vi.mocked(serverGetDocumentById);

describe("Email Notification Feature", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clean up environment variables
    delete process.env.NEXT_PUBLIC_BRANCH_NAME;
  });

  describe("getEmailBranchTag", () => {
    it("should return '[DEV] ' tag for development branch", () => {
      process.env.NEXT_PUBLIC_BRANCH_NAME = "development";
      expect(getEmailBranchTag()).toBe("[DEV] ");
    });

    it("should return '[STAGING] ' tag for staging branch", () => {
      process.env.NEXT_PUBLIC_BRANCH_NAME = "staging";
      expect(getEmailBranchTag()).toBe("[STAGING] ");
    });

    it("should return empty string for production branch", () => {
      process.env.NEXT_PUBLIC_BRANCH_NAME = "production";
      expect(getEmailBranchTag()).toBe("");
    });

    it("should return empty string for undefined branch", () => {
      delete process.env.NEXT_PUBLIC_BRANCH_NAME;
      expect(getEmailBranchTag()).toBe("");
    });

    it("should return empty string for unknown branch name", () => {
      process.env.NEXT_PUBLIC_BRANCH_NAME = "unknown-branch";
      expect(getEmailBranchTag()).toBe("");
    });
  });

  describe("getTenantEmailConfig", () => {
    beforeEach(() => {
      mockServerGetDocumentById.mockClear();
    });

    it("should return default config when no tenant is provided", async () => {
      const result = await getTenantEmailConfig();

      expect(result).toEqual({
        schemaName: "Media Commons",
        emailMessages: {
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
        },
      });
      
      expect(mockServerGetDocumentById).not.toHaveBeenCalled();
    });

    it("should return default config when tenant schema is not found", async () => {
      mockServerGetDocumentById.mockResolvedValue(null);
      
      const result = await getTenantEmailConfig("test-tenant");

      expect(result).toEqual({
        schemaName: "Media Commons",
        emailMessages: {
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
        },
      });
    });

    it("should return tenant-specific schema name when found", async () => {
      const mockSchema = {
        name: "ITP Equipment",
      };
      mockServerGetDocumentById.mockResolvedValue(mockSchema);
      
      const result = await getTenantEmailConfig("itp-equipment");

      expect(result.schemaName).toBe("ITP Equipment");
      expect(mockServerGetDocumentById).toHaveBeenCalledWith(
        "tenantSchema",
        "itp-equipment"
      );
    });

    it("should return tenant-specific email messages when found", async () => {
      const mockSchema = {
        name: "Test Schema",
        emailMessages: {
          requestConfirmation: "Your request has been received.",
          firstApprovalRequest: "Please review this request.",
          secondApprovalRequest: "Final approval needed.",
          walkInConfirmation: "Walk-in confirmed.",
          vipConfirmation: "VIP booking confirmed.",
          checkoutConfirmation: "Checkout complete.",
          checkinConfirmation: "Check-in complete.",
          declined: "Request declined.",
          canceled: "Booking canceled.",
          lateCancel: "Late cancellation.",
          noShow: "No show recorded.",
          closed: "Booking closed.",
          approvalNotice: "Approval notice message.",
        },
      };
      mockServerGetDocumentById.mockResolvedValue(mockSchema);
      
      const result = await getTenantEmailConfig("test-tenant");

      expect(result).toEqual({
        schemaName: "Test Schema",
        emailMessages: mockSchema.emailMessages,
      });
    });

    it("should use empty strings for missing email message fields", async () => {
      const mockSchema = {
        name: "Partial Schema",
        emailMessages: {
          requestConfirmation: "Request received",
          firstApprovalRequest: "First approval",
          // Other fields are missing
        },
      };
      mockServerGetDocumentById.mockResolvedValue(mockSchema);
      
      const result = await getTenantEmailConfig("partial-tenant");

      expect(result.emailMessages.requestConfirmation).toBe("Request received");
      expect(result.emailMessages.firstApprovalRequest).toBe("First approval");
      expect(result.emailMessages.secondApprovalRequest).toBe("");
      expect(result.emailMessages.declined).toBe("");
      expect(result.emailMessages.approvalNotice).toBe("");
    });

    it("should handle schema without emailMessages field", async () => {
      const mockSchema = {
        name: "Simple Schema",
        // No emailMessages field
      };
      mockServerGetDocumentById.mockResolvedValue(mockSchema);
      
      const result = await getTenantEmailConfig("simple-tenant");

      expect(result.schemaName).toBe("Simple Schema");
      expect(result.emailMessages).toEqual({
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
      });
    });

    it("should handle error when fetching tenant schema", async () => {
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      mockServerGetDocumentById.mockRejectedValue(new Error("Database error"));
      
      const result = await getTenantEmailConfig("error-tenant");

      expect(result).toEqual({
        schemaName: "Media Commons",
        emailMessages: {
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
        },
      });
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error fetching tenant schema for email:",
        expect.any(Error)
      );
      
      consoleErrorSpy.mockRestore();
    });

    it("should use default schema name when name field is missing", async () => {
      const mockSchema = {
        // No name field
        emailMessages: {
          requestConfirmation: "Test message",
        },
      };
      mockServerGetDocumentById.mockResolvedValue(mockSchema);
      
      const result = await getTenantEmailConfig("no-name-tenant");

      expect(result.schemaName).toBe("Media Commons");
      expect(result.emailMessages.requestConfirmation).toBe("Test message");
    });
  });

  describe("getTenantEmailConfig - TenantEmailConfig interface", () => {
    it("should return object matching TenantEmailConfig interface", async () => {
      const result = await getTenantEmailConfig();

      // Verify structure matches TenantEmailConfig interface
      expect(result).toHaveProperty("schemaName");
      expect(result).toHaveProperty("emailMessages");
      expect(typeof result.schemaName).toBe("string");
      expect(typeof result.emailMessages).toBe("object");
      
      // Verify all required emailMessages properties exist
      const expectedKeys = [
        "requestConfirmation",
        "firstApprovalRequest",
        "secondApprovalRequest",
        "walkInConfirmation",
        "vipConfirmation",
        "checkoutConfirmation",
        "checkinConfirmation",
        "declined",
        "canceled",
        "lateCancel",
        "noShow",
        "closed",
        "approvalNotice",
      ];
      
      expectedKeys.forEach((key) => {
        expect(result.emailMessages).toHaveProperty(key);
        expect(typeof result.emailMessages[key]).toBe("string");
      });
    });
  });
});
