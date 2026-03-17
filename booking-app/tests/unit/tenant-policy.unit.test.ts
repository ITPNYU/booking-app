import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import {
  getTenantPolicy,
  getTenantPolicyFromSchema,
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

describe("getTenantPolicy (from schema)", () => {
  it("extracts policy fields from schema", () => {
    const schema = makeMockSchema({
      ccEmails: {
        approved: { development: "dev-approved@nyu.edu", staging: "stg@nyu.edu", production: "prod@nyu.edu" },
        canceled: { development: "dev-canceled@nyu.edu", staging: "stg@nyu.edu", production: "prod@nyu.edu" },
      },
      approvalLevels: 1,
      hasServiceRequests: false,
      autoCloseOnCheckout: true,
    });

    // Set environment to production for this test
    const orig = process.env.NEXT_PUBLIC_BRANCH_NAME;
    process.env.NEXT_PUBLIC_BRANCH_NAME = "production";

    const policy = getTenantPolicy(schema);
    expect(policy.approvedCcEmail).toBe("prod@nyu.edu");
    expect(policy.canceledCcEmail).toBe("prod@nyu.edu");
    expect(policy.approvalLevels).toBe(1);
    expect(policy.hasServiceRequests).toBe(false);
    expect(policy.autoCloseOnCheckout).toBe(true);

    process.env.NEXT_PUBLIC_BRANCH_NAME = orig;
  });

  it("resolves development email when branch is development", () => {
    const schema = makeMockSchema({
      ccEmails: {
        approved: { development: "dev@nyu.edu", staging: "stg@nyu.edu", production: "prod@nyu.edu" },
        canceled: { development: "dev-cancel@nyu.edu", staging: "stg@nyu.edu", production: "prod@nyu.edu" },
      },
    });

    const orig = process.env.NEXT_PUBLIC_BRANCH_NAME;
    process.env.NEXT_PUBLIC_BRANCH_NAME = "development";

    const policy = getTenantPolicy(schema);
    expect(policy.approvedCcEmail).toBe("dev@nyu.edu");
    expect(policy.canceledCcEmail).toBe("dev-cancel@nyu.edu");

    process.env.NEXT_PUBLIC_BRANCH_NAME = orig;
  });

  it("returns defaults when ccEmails is not configured", () => {
    const schema = makeMockSchema();
    const policy = getTenantPolicy(schema);
    expect(policy.approvedCcEmail).toBe("");
    expect(policy.canceledCcEmail).toBe("");
    expect(policy.approvalLevels).toBe(2);
    expect(policy.hasServiceRequests).toBe(true);
    expect(policy.autoCloseOnCheckout).toBe(false);
  });
});

describe("getTenantPolicyFromSchema (async)", () => {
  const originalEnv = process.env.NEXT_PUBLIC_BRANCH_NAME;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_BRANCH_NAME = "production";
    mockServerGetDocumentById.mockReset();
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_BRANCH_NAME = originalEnv;
  });

  it("fetches schema from Firestore and returns policy", async () => {
    mockServerGetDocumentById.mockResolvedValue(
      makeMockSchema({
        ccEmails: {
          approved: { development: "", staging: "", production: "ops@nyu.edu" },
          canceled: { development: "", staging: "", production: "cancel@nyu.edu" },
        },
        approvalLevels: 1,
      }),
    );

    const policy = await getTenantPolicyFromSchema("itp");
    expect(policy.approvedCcEmail).toBe("ops@nyu.edu");
    expect(policy.canceledCcEmail).toBe("cancel@nyu.edu");
    expect(policy.approvalLevels).toBe(1);
  });

  it("returns default policy when schema not found", async () => {
    mockServerGetDocumentById.mockResolvedValue(null);

    const policy = await getTenantPolicyFromSchema("unknown");
    expect(policy.approvedCcEmail).toBe("");
    expect(policy.canceledCcEmail).toBe("");
    expect(policy.approvalLevels).toBe(2);
  });

  it("returns default policy when Firestore fetch fails", async () => {
    mockServerGetDocumentById.mockRejectedValue(new Error("connection failed"));

    const policy = await getTenantPolicyFromSchema("mc");
    expect(policy.approvedCcEmail).toBe("");
    expect(policy.approvalLevels).toBe(2);
  });
});

describe("getApprovedCcEmail / getCanceledCcEmail", () => {
  const originalEnv = process.env.NEXT_PUBLIC_BRANCH_NAME;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_BRANCH_NAME = "production";
    mockServerGetDocumentById.mockReset();
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_BRANCH_NAME = originalEnv;
  });

  it("returns approved CC email for tenant", async () => {
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

  it("returns canceled CC email for tenant", async () => {
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
