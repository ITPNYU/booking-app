import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// POST /api/tenantSchema/[tenant]/sync — API route tests
// ---------------------------------------------------------------------------

const mockSet = vi.fn();
const mockDocGet = vi.fn();
const mockDoc = vi.fn(() => ({
  get: mockDocGet,
  set: mockSet,
}));
const mockCollection = vi.fn(() => ({ doc: mockDoc }));
const mockFirestore = { collection: mockCollection };

vi.mock("@/lib/firebase/server/multiDb", () => ({
  getFirestoreForEnv: () => mockFirestore,
  ENVIRONMENTS: ["development", "staging", "production"],
}));

// Auth is now session-derived; mock the super-admin gate directly.
const mockRequireSuperAdmin = vi.fn();
vi.mock("@/lib/api/requireSuperAdmin", () => ({
  requireSuperAdmin: (...args: unknown[]) => mockRequireSuperAdmin(...args),
}));

import { POST } from "@/app/api/tenantSchema/[tenant]/sync/route";

function createRequest(body: object, email?: string) {
  return {
    json: async () => body,
    headers: new Headers(email ? { "x-user-email": email } : {}),
  } as any;
}

function createParams(tenant: string) {
  return { params: Promise.resolve({ tenant }) };
}

async function parseResponse(response: Response) {
  return { status: response.status, data: await response.json() };
}

describe("POST /api/tenantSchema/[tenant]/sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: authenticated super admin.
    mockRequireSuperAdmin.mockResolvedValue({
      session: { email: "admin@nyu.edu", netId: "admin" },
    });
  });

  it("returns 401 when unauthenticated", async () => {
    mockRequireSuperAdmin.mockResolvedValue({
      error: NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      ),
    });

    const res = await POST(
      createRequest({ sourceEnv: "development", targetEnv: "production" }),
      createParams("itp"),
    );
    const { status } = await parseResponse(res);
    expect(status).toBe(401);
  });

  it("returns 403 when user is not a super admin", async () => {
    mockRequireSuperAdmin.mockResolvedValue({
      error: NextResponse.json(
        { error: "Super admin permission required" },
        { status: 403 },
      ),
    });

    const res = await POST(
      createRequest(
        { sourceEnv: "development", targetEnv: "production" },
        "notadmin@nyu.edu",
      ),
      createParams("itp"),
    );
    const { status } = await parseResponse(res);
    expect(status).toBe(403);
  });

  it("returns 400 for invalid environment", async () => {
    const res = await POST(
      createRequest(
        { sourceEnv: "invalid", targetEnv: "production" },
        "admin@nyu.edu",
      ),
      createParams("itp"),
    );
    const { status, data } = await parseResponse(res);
    expect(status).toBe(400);
    expect(data.error).toContain("Invalid environment");
  });

  it("returns 400 when source and target are the same", async () => {
    const res = await POST(
      createRequest(
        { sourceEnv: "production", targetEnv: "production" },
        "admin@nyu.edu",
      ),
      createParams("itp"),
    );
    const { status } = await parseResponse(res);
    expect(status).toBe(400);
  });

  it("returns 404 when source schema does not exist", async () => {
    mockDocGet.mockResolvedValue({ exists: false });

    const res = await POST(
      createRequest(
        { sourceEnv: "development", targetEnv: "production" },
        "admin@nyu.edu",
      ),
      createParams("itp"),
    );
    const { status } = await parseResponse(res);
    expect(status).toBe(404);
  });

  it("dry run returns diff without writing data", async () => {
    // First call: source doc
    mockDocGet
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({ name: "ITP New", logo: "new.png" }),
      })
      // Second call: target doc
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({ name: "ITP Old", logo: "new.png" }),
      });

    const res = await POST(
      createRequest(
        { sourceEnv: "development", targetEnv: "production", dryRun: true },
        "admin@nyu.edu",
      ),
      createParams("itp"),
    );
    const { status, data } = await parseResponse(res);

    expect(status).toBe(200);
    expect(data.dryRun).toBe(true);
    // Same shape and orientation as the Schema Diff UI: old = target, new = source.
    expect(data.diff).toEqual([
      { path: "name", type: "changed", oldValue: "ITP Old", newValue: "ITP New" },
    ]);
    // Verify no writes happened
    expect(mockSet).not.toHaveBeenCalled();
  });

  it("actual sync creates backup and writes schema", async () => {
    mockDocGet
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({ name: "ITP New" }),
      })
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({ name: "ITP Old" }),
      });
    mockSet.mockResolvedValue(undefined);

    const res = await POST(
      createRequest(
        { sourceEnv: "development", targetEnv: "production" },
        "admin@nyu.edu",
      ),
      createParams("itp"),
    );
    const { status, data } = await parseResponse(res);

    expect(status).toBe(200);
    expect(data.dryRun).toBe(false);
    expect(data.backupId).toMatch(/^itp-backup-sync-/);
    expect(data.syncedBy).toBe("admin@nyu.edu");
    // Backup write + schema write = 2 set calls
    expect(mockSet).toHaveBeenCalledTimes(2);
  });

  it("actual sync without existing target skips backup", async () => {
    mockDocGet
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({ name: "ITP New" }),
      })
      .mockResolvedValueOnce({ exists: false, data: () => null });
    mockSet.mockResolvedValue(undefined);

    const res = await POST(
      createRequest(
        { sourceEnv: "development", targetEnv: "production" },
        "admin@nyu.edu",
      ),
      createParams("itp"),
    );
    const { status, data } = await parseResponse(res);

    expect(status).toBe(200);
    expect(data.backupId).toBeNull();
    // Only schema write, no backup
    expect(mockSet).toHaveBeenCalledTimes(1);
  });
});
