import { beforeEach, describe, expect, it, vi } from "vitest";

// Track which collection name is passed to db.collection()
let capturedCollectionName: string | null = null;

const mockGet = vi.fn();

vi.mock("@/lib/firebase/server/firebaseAdmin", () => ({
  default: {
    firestore: () => ({
      collection: (name: string) => {
        capturedCollectionName = name;
        return {
          where: () => ({
            get: mockGet,
          }),
        };
      },
    }),
  },
}));

vi.mock("@/lib/newrelic-utils", () => ({
  traceDatabase: async (
    _op: string,
    _label: string,
    fn: () => Promise<any>,
  ) => fn(),
}));

vi.mock("@/components/src/policy", async () => {
  const actual = await vi.importActual("@/components/src/policy");
  return { ...actual };
});

vi.mock("@/components/src/types", async () => {
  const actual = await vi.importActual("@/components/src/types");
  return { ...actual };
});

describe("serverGetFinalApproverEmail – tenant-aware collection lookup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedCollectionName = null;
  });

  it("should query itp-usersApprovers when tenant is 'itp'", async () => {
    mockGet.mockResolvedValue({
      empty: false,
      docs: [{ data: () => ({ email: "itp-admin@nyu.edu", level: 3 }) }],
    });

    const { serverGetFinalApproverEmail } = await import(
      "@/lib/firebase/server/adminDb"
    );
    const email = await serverGetFinalApproverEmail("itp");

    expect(capturedCollectionName).toBe("itp-usersApprovers");
    expect(email).toBe("itp-admin@nyu.edu");
  });

  it("should query mc-usersApprovers when tenant is 'mc'", async () => {
    mockGet.mockResolvedValue({
      empty: false,
      docs: [{ data: () => ({ email: "mc-admin@nyu.edu", level: 3 }) }],
    });

    const { serverGetFinalApproverEmail } = await import(
      "@/lib/firebase/server/adminDb"
    );
    const email = await serverGetFinalApproverEmail("mc");

    expect(capturedCollectionName).toBe("mc-usersApprovers");
    expect(email).toBe("mc-admin@nyu.edu");
  });

  it("should return fallback email when no approver is found", async () => {
    mockGet.mockResolvedValue({ empty: true, docs: [] });

    const { serverGetFinalApproverEmail } = await import(
      "@/lib/firebase/server/adminDb"
    );
    const email = await serverGetFinalApproverEmail("itp");

    expect(capturedCollectionName).toBe("itp-usersApprovers");
    expect(email).toBeNull();
  });

  it("should return null when approver doc has no email field", async () => {
    mockGet.mockResolvedValue({
      empty: false,
      docs: [{ data: () => ({ level: 3 }) }],
    });

    const { serverGetFinalApproverEmail } = await import(
      "@/lib/firebase/server/adminDb"
    );
    const email = await serverGetFinalApproverEmail("itp");

    expect(email).toBeNull();
  });

  it("should NOT mix tenants: ITP must not read MC approver data", async () => {
    // This is the regression test for the original bug.
    // Before the fix, tenant was not passed, so the base "usersApprovers"
    // collection was queried regardless of tenant, returning MC data for ITP.
    mockGet.mockResolvedValue({
      empty: false,
      docs: [
        { data: () => ({ email: "mc-only-approver@nyu.edu", level: 3 }) },
      ],
    });

    const { serverGetFinalApproverEmail } = await import(
      "@/lib/firebase/server/adminDb"
    );
    await serverGetFinalApproverEmail("itp");

    // The collection queried MUST be itp-usersApprovers, not usersApprovers
    expect(capturedCollectionName).not.toBe("usersApprovers");
    expect(capturedCollectionName).toBe("itp-usersApprovers");
  });

  it("should query base usersApprovers when tenant is undefined (backward compat)", async () => {
    mockGet.mockResolvedValue({
      empty: false,
      docs: [{ data: () => ({ email: "default@nyu.edu", level: 3 }) }],
    });

    const { serverGetFinalApproverEmail } = await import(
      "@/lib/firebase/server/adminDb"
    );
    const email = await serverGetFinalApproverEmail();

    expect(capturedCollectionName).toBe("usersApprovers");
    expect(email).toBe("default@nyu.edu");
  });
});
