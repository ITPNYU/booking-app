import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getTenantPolicy,
  getOperationEmail,
} from "@/components/src/tenantPolicy";
import { getApprovalCcEmail, getCancelCcEmail } from "@/components/src/policy";
import { MEDIA_COMMONS_OPERATION_EMAIL } from "@/components/src/mediaCommonsPolicy";
import { ITP_OPERATION_EMAIL } from "@/components/src/itpPolicy";

vi.mock("@/lib/firebase/firebase", () => ({
  clientGetFinalApproverEmailFromDatabase: vi.fn(),
}));

describe("getTenantPolicy", () => {
  it("returns MC policy by default when no tenant", () => {
    const policy = getTenantPolicy();
    expect(policy.approvalLevels).toBe(2);
    expect(policy.hasServiceRequests).toBe(true);
    expect(policy.autoCloseOnCheckout).toBe(false);
  });

  it("returns MC policy for 'mc'", () => {
    const policy = getTenantPolicy("mc");
    expect(policy.approvalLevels).toBe(2);
    expect(policy.hasServiceRequests).toBe(true);
  });

  it("returns ITP policy for 'itp'", () => {
    const policy = getTenantPolicy("itp");
    expect(policy.approvalLevels).toBe(1);
    expect(policy.hasServiceRequests).toBe(false);
    expect(policy.autoCloseOnCheckout).toBe(true);
  });

  it("falls back to MC for unknown tenant", () => {
    const policy = getTenantPolicy("unknown");
    expect(policy.approvalLevels).toBe(2);
  });

  it("handles case-insensitive tenant", () => {
    const policy = getTenantPolicy("ITP");
    expect(policy.approvalLevels).toBe(1);
  });
});

describe("getOperationEmail", () => {
  describe("MC tenant", () => {
    it("returns dev email for development", () => {
      expect(getOperationEmail("mc", "development")).toBe(
        "booking-app-devs+operation@itp.nyu.edu",
      );
    });

    it("returns MC operation email for staging", () => {
      expect(getOperationEmail("mc", "staging")).toBe(
        MEDIA_COMMONS_OPERATION_EMAIL,
      );
    });

    it("returns MC operation email for production", () => {
      expect(getOperationEmail("mc", "production")).toBe(
        MEDIA_COMMONS_OPERATION_EMAIL,
      );
    });

    it("returns MC operation email for unknown branch (defaults to production)", () => {
      expect(getOperationEmail("mc", "some-feature-branch")).toBe(
        MEDIA_COMMONS_OPERATION_EMAIL,
      );
    });
  });

  describe("ITP tenant", () => {
    it("returns dev email for development", () => {
      expect(getOperationEmail("itp", "development")).toBe(
        "booking-app-devs+operation@itp.nyu.edu",
      );
    });

    it("returns ITP operation email for staging", () => {
      expect(getOperationEmail("itp", "staging")).toBe(ITP_OPERATION_EMAIL);
    });

    it("returns ITP operation email for production", () => {
      expect(getOperationEmail("itp", "production")).toBe(ITP_OPERATION_EMAIL);
    });
  });

  describe("fallback behavior", () => {
    it("returns MC email when tenant is undefined", () => {
      expect(getOperationEmail(undefined, "production")).toBe(
        MEDIA_COMMONS_OPERATION_EMAIL,
      );
    });

    it("returns MC email when both params are undefined", () => {
      // undefined branch resolves to "production"
      expect(getOperationEmail(undefined, undefined)).toBe(
        MEDIA_COMMONS_OPERATION_EMAIL,
      );
    });
  });
});

describe("getApprovalCcEmail", () => {
  it("delegates to getOperationEmail with correct param order", () => {
    expect(getApprovalCcEmail("development", "itp")).toBe(
      getOperationEmail("itp", "development"),
    );
  });

  it("works without tenant (backward compatible)", () => {
    expect(getApprovalCcEmail("production")).toBe(
      MEDIA_COMMONS_OPERATION_EMAIL,
    );
  });

  it("routes MC production correctly", () => {
    expect(getApprovalCcEmail("production", "mc")).toBe(
      MEDIA_COMMONS_OPERATION_EMAIL,
    );
  });

  it("routes ITP production correctly", () => {
    expect(getApprovalCcEmail("production", "itp")).toBe(ITP_OPERATION_EMAIL);
  });
});

describe("getCancelCcEmail", () => {
  const originalEnv = process.env.NEXT_PUBLIC_BRANCH_NAME;

  afterEach(() => {
    process.env.NEXT_PUBLIC_BRANCH_NAME = originalEnv;
  });

  it("uses NEXT_PUBLIC_BRANCH_NAME for environment resolution", () => {
    process.env.NEXT_PUBLIC_BRANCH_NAME = "development";
    expect(getCancelCcEmail("mc")).toBe(
      "booking-app-devs+operation@itp.nyu.edu",
    );
  });

  it("returns MC production email when branch is production", () => {
    process.env.NEXT_PUBLIC_BRANCH_NAME = "production";
    expect(getCancelCcEmail("mc")).toBe(MEDIA_COMMONS_OPERATION_EMAIL);
  });

  it("returns ITP email for ITP tenant", () => {
    process.env.NEXT_PUBLIC_BRANCH_NAME = "production";
    expect(getCancelCcEmail("itp")).toBe(ITP_OPERATION_EMAIL);
  });

  it("falls back to MC when no tenant (backward compatible)", () => {
    process.env.NEXT_PUBLIC_BRANCH_NAME = "production";
    expect(getCancelCcEmail()).toBe(MEDIA_COMMONS_OPERATION_EMAIL);
  });
});
