import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import {
  getTenantPolicy,
  getApprovedCcEmail,
  getCanceledCcEmail,
} from "@/components/src/tenantPolicy";
import { getApprovalCcEmail, getCancelCcEmail } from "@/components/src/policy";
import { SchemaContextType } from "@/components/src/client/routes/components/SchemaProvider";

vi.mock("@/lib/firebase/firebase", () => ({
  clientGetFinalApproverEmailFromDatabase: vi.fn(),
}));

// Mock adminDb for async functions
const mockServerGetDocumentById = vi.fn();
vi.mock("@/lib/firebase/server/adminDb", () => ({
  serverGetDocumentById: (...args: any[]) => mockServerGetDocumentById(...args),
}));

function makeMockSchema(overrides: Partial<SchemaContextType> = {}): SchemaContextType {
  return {
    tenant: "test",
    name: "Test",
    logo: "",
    nameForPolicy: "",
    policy: "",
    programMapping: {},
    roles: [],
    roleMapping: {},
    schoolMapping: {},
    showNNumber: false,
    showSponsor: false,
    showSetup: false,
    showEquipment: false,
    showStaffing: false,
    showCatering: false,
    showHireSecurity: false,
    showBookingTypes: false,
    agreements: [],
    resources: [],
    supportVIP: false,
    supportWalkIn: false,
    resourceName: "",
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
    ...overrides,
  } as SchemaContextType;
}

describe("getTenantPolicy (hardcoded)", () => {
  it("returns MC policy by default", () => {
    const policy = getTenantPolicy();
    expect(policy.approvalLevels).toBe(2);
    expect(policy.hasServiceRequests).toBe(true);
    expect(policy.autoCloseOnCheckout).toBe(false);
  });

  it("returns MC policy for 'mc' tenant", () => {
    const policy = getTenantPolicy("mc");
    expect(policy.approvalLevels).toBe(2);
    expect(policy.hasServiceRequests).toBe(true);
    expect(policy.autoCloseOnCheckout).toBe(false);
  });

  it("returns ITP policy for 'itp' tenant", () => {
    const policy = getTenantPolicy("itp");
    expect(policy.approvalLevels).toBe(1);
    expect(policy.hasServiceRequests).toBe(false);
    expect(policy.autoCloseOnCheckout).toBe(true);
  });

  it("falls back to MC policy for unknown tenant", () => {
    const policy = getTenantPolicy("unknown");
    expect(policy.approvalLevels).toBe(2);
  });
});

describe("getApprovedCcEmail / getCanceledCcEmail (schema-driven)", () => {
  const originalEnv = process.env.NEXT_PUBLIC_BRANCH_NAME;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_BRANCH_NAME = "production";
    mockServerGetDocumentById.mockReset();
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_BRANCH_NAME = originalEnv;
  });

  it("returns approved CC email from schema", async () => {
    mockServerGetDocumentById.mockResolvedValue(
      makeMockSchema({
        ccEmails: {
          approved: { development: "", staging: "", production: "approved@nyu.edu" },
          canceled: { development: "", staging: "", production: "" },
        },
      }),
    );

    expect(await getApprovedCcEmail("mc")).toBe("approved@nyu.edu");
  });

  it("returns canceled CC email from schema", async () => {
    mockServerGetDocumentById.mockResolvedValue(
      makeMockSchema({
        ccEmails: {
          approved: { development: "", staging: "", production: "" },
          canceled: { development: "", staging: "", production: "cancel@nyu.edu" },
        },
      }),
    );

    expect(await getCanceledCcEmail("mc")).toBe("cancel@nyu.edu");
  });

  it("resolves development email when branch is development", async () => {
    process.env.NEXT_PUBLIC_BRANCH_NAME = "development";
    mockServerGetDocumentById.mockResolvedValue(
      makeMockSchema({
        ccEmails: {
          approved: { development: "dev@nyu.edu", staging: "stg@nyu.edu", production: "prod@nyu.edu" },
          canceled: { development: "dev-cancel@nyu.edu", staging: "stg@nyu.edu", production: "prod@nyu.edu" },
        },
      }),
    );

    expect(await getApprovedCcEmail("mc")).toBe("dev@nyu.edu");
    expect(await getCanceledCcEmail("mc")).toBe("dev-cancel@nyu.edu");
  });

  it("returns empty string when schema not found", async () => {
    mockServerGetDocumentById.mockResolvedValue(null);

    expect(await getApprovedCcEmail("unknown")).toBe("");
    expect(await getCanceledCcEmail("unknown")).toBe("");
  });

  it("returns empty string when Firestore fetch fails", async () => {
    mockServerGetDocumentById.mockRejectedValue(new Error("connection failed"));

    expect(await getApprovedCcEmail("mc")).toBe("");
    expect(await getCanceledCcEmail("mc")).toBe("");
  });

  it("returns empty string when ccEmails is not configured", async () => {
    mockServerGetDocumentById.mockResolvedValue(makeMockSchema());

    expect(await getApprovedCcEmail("mc")).toBe("");
    expect(await getCanceledCcEmail("mc")).toBe("");
  });
});

describe("getApprovalCcEmail (policy.ts wrapper)", () => {
  const originalEnv = process.env.NEXT_PUBLIC_BRANCH_NAME;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_BRANCH_NAME = "production";
    mockServerGetDocumentById.mockReset();
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_BRANCH_NAME = originalEnv;
  });

  it("returns empty string when tenant is undefined", async () => {
    expect(await getApprovalCcEmail("production")).toBe("");
  });

  it("fetches approved CC email for tenant", async () => {
    mockServerGetDocumentById.mockResolvedValue(
      makeMockSchema({
        ccEmails: {
          approved: { development: "", staging: "", production: "ops@nyu.edu" },
          canceled: { development: "", staging: "", production: "" },
        },
      }),
    );

    expect(await getApprovalCcEmail("production", "mc")).toBe("ops@nyu.edu");
  });
});

describe("getCancelCcEmail (policy.ts wrapper)", () => {
  const originalEnv = process.env.NEXT_PUBLIC_BRANCH_NAME;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_BRANCH_NAME = "production";
    mockServerGetDocumentById.mockReset();
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_BRANCH_NAME = originalEnv;
  });

  it("returns empty string when tenant is undefined", async () => {
    expect(await getCancelCcEmail()).toBe("");
  });

  it("fetches canceled CC email for tenant", async () => {
    mockServerGetDocumentById.mockResolvedValue(
      makeMockSchema({
        ccEmails: {
          approved: { development: "", staging: "", production: "" },
          canceled: { development: "", staging: "", production: "cancel@nyu.edu" },
        },
      }),
    );

    expect(await getCancelCcEmail("mc")).toBe("cancel@nyu.edu");
  });
});
