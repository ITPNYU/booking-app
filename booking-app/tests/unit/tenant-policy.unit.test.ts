import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import {
  getTenantPolicy,
} from "@/components/src/tenantPolicy";
import {
  getApprovedCcEmail,
  getCanceledCcEmail,
  getDeclineCcEmails,
  getDeclinedCcEmail,
  parseEmailList,
} from "@/components/src/tenantPolicyServer";
import { getApprovalCcEmail, getCancelCcEmail } from "@/components/src/tenantPolicyServer";
import type { SchemaContextType } from "@/components/src/client/routes/components/SchemaProvider";
import { generateDefaultSchema } from "@/components/src/client/routes/components/SchemaProvider";

vi.mock("@/lib/firebase/firebase", () => ({
  clientGetFinalApproverEmailFromDatabase: vi.fn(),
}));

// Mock adminDb for async functions
const mockServerGetDocumentById = vi.fn();
vi.mock("@/lib/firebase/server/adminDb", () => ({
  serverGetDocumentById: (...args: any[]) => mockServerGetDocumentById(...args),
}));

function makeMockSchema(overrides: Partial<SchemaContextType> = {}): SchemaContextType {
  return { ...generateDefaultSchema("test"), ...overrides };
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
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_BRANCH_NAME", "production");
    mockServerGetDocumentById.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
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
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_BRANCH_NAME", "production");
    mockServerGetDocumentById.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
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
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_BRANCH_NAME", "production");
    mockServerGetDocumentById.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
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

describe("getDeclinedCcEmail / getDeclineCcEmails", () => {
  const schemaWithDeclinedCc = (declined: {
    development: string;
    staging: string;
    production: string;
  }) =>
    makeMockSchema({
      ccEmails: {
        approved: {
          development: "",
          staging: "",
          production: "approved@nyu.edu",
        },
        canceled: {
          development: "",
          staging: "",
          production: "cancel@nyu.edu",
        },
        declined,
      },
    });

  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_BRANCH_NAME", "production");
    mockServerGetDocumentById.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns the declined CC email for the current environment", async () => {
    mockServerGetDocumentById.mockResolvedValue(
      schemaWithDeclinedCc({
        development: "dev-ops@nyu.edu",
        staging: "stg-ops@nyu.edu",
        production: "ops@nyu.edu",
      }),
    );

    expect(await getDeclinedCcEmail("mc")).toBe("ops@nyu.edu");

    vi.stubEnv("NEXT_PUBLIC_BRANCH_NAME", "development");
    expect(await getDeclinedCcEmail("mc")).toBe("dev-ops@nyu.edu");
  });

  it("returns empty string for the default schema, a missing key, or a failed fetch", async () => {
    mockServerGetDocumentById.mockResolvedValue(makeMockSchema());
    expect(await getDeclinedCcEmail("mc")).toBe("");

    // Stored schemas written before ccEmails.declined existed
    mockServerGetDocumentById.mockResolvedValue(
      makeMockSchema({
        ccEmails: {
          approved: {
            development: "",
            staging: "",
            production: "approved@nyu.edu",
          },
          canceled: {
            development: "",
            staging: "",
            production: "cancel@nyu.edu",
          },
        },
      }),
    );
    expect(await getDeclinedCcEmail("mc")).toBe("");

    mockServerGetDocumentById.mockRejectedValue(new Error("connection failed"));
    expect(await getDeclinedCcEmail("mc")).toBe("");
  });

  it("does not fall back to the approved or canceled CC addresses", async () => {
    mockServerGetDocumentById.mockResolvedValue(
      schemaWithDeclinedCc({ development: "", staging: "", production: "" }),
    );

    expect(await getDeclineCcEmails("mc", "guest@nyu.edu")).toEqual([]);
  });

  it("returns the configured address for another requester", async () => {
    mockServerGetDocumentById.mockResolvedValue(
      schemaWithDeclinedCc({
        development: "",
        staging: "",
        production: " ops@nyu.edu ",
      }),
    );

    expect(await getDeclineCcEmails("mc", "guest@nyu.edu")).toEqual([
      "ops@nyu.edu",
    ]);
    expect(await getDeclineCcEmails("mc")).toEqual(["ops@nyu.edu"]);
  });

  it("returns every address in a configured list, minus the requester", async () => {
    mockServerGetDocumentById.mockResolvedValue(
      schemaWithDeclinedCc({
        development: "",
        staging: "",
        production:
          "mediacommons.operations@nyu.edu, jhanele@nyu.edu; Guest@NYU.edu",
      }),
    );

    expect(await getDeclineCcEmails("mc", "guest@nyu.edu")).toEqual([
      "mediacommons.operations@nyu.edu",
      "jhanele@nyu.edu",
    ]);
  });

  it("returns nothing when the requester is the only CC address", async () => {
    mockServerGetDocumentById.mockResolvedValue(
      schemaWithDeclinedCc({
        development: "",
        staging: "",
        production: "Ops@NYU.edu",
      }),
    );

    expect(await getDeclineCcEmails("mc", "ops@nyu.edu")).toEqual([]);
  });

  it("returns nothing without reading the schema when tenant is undefined", async () => {
    expect(await getDeclineCcEmails(undefined, "guest@nyu.edu")).toEqual([]);
    expect(mockServerGetDocumentById).not.toHaveBeenCalled();
  });
});

describe("parseEmailList", () => {
  it("splits on commas", () => {
    expect(parseEmailList("a@nyu.edu,b@nyu.edu")).toEqual([
      "a@nyu.edu",
      "b@nyu.edu",
    ]);
  });

  it("splits on semicolons and mixed separators", () => {
    expect(parseEmailList("a@nyu.edu;b@nyu.edu, c@nyu.edu ;d@nyu.edu")).toEqual(
      ["a@nyu.edu", "b@nyu.edu", "c@nyu.edu", "d@nyu.edu"],
    );
  });

  it("trims spaces and drops blank entries", () => {
    expect(parseEmailList("  a@nyu.edu ,, ; b@nyu.edu ;  ")).toEqual([
      "a@nyu.edu",
      "b@nyu.edu",
    ]);
  });

  it("drops case-insensitive duplicates and keeps the first spelling", () => {
    expect(parseEmailList("Ops@NYU.edu, ops@nyu.edu; OPS@nyu.edu")).toEqual([
      "Ops@NYU.edu",
    ]);
  });

  it("excludes the given address regardless of case or spaces", () => {
    expect(
      parseEmailList("ops@nyu.edu, guest@nyu.edu", "  GUEST@nyu.edu "),
    ).toEqual(["ops@nyu.edu"]);
  });

  it("returns an empty list for an empty or blank value", () => {
    expect(parseEmailList("")).toEqual([]);
    expect(parseEmailList(" ; , ")).toEqual([]);
  });
});
