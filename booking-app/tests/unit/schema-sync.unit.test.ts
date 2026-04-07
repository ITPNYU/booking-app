import { computeDiffSummary } from "@/lib/utils/schemaDiff";
import { describe, expect, it, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// computeDiffSummary — pure function tests
// ---------------------------------------------------------------------------
describe("computeDiffSummary", () => {
  it("returns all keys as added with values when target is null", () => {
    const source = { name: "ITP", logo: "logo.png" };
    const result = computeDiffSummary(source, null);

    expect(result.added).toEqual([
      { key: "name", sourceValue: "ITP" },
      { key: "logo", sourceValue: "logo.png" },
    ]);
    expect(result.removed).toEqual([]);
    expect(result.changed).toEqual([]);
    expect(result.unchangedCount).toBe(0);
  });

  it("detects unchanged keys when schemas are identical", () => {
    const schema = { name: "ITP", logo: "logo.png" };
    const result = computeDiffSummary(schema, { ...schema });

    expect(result.added).toEqual([]);
    expect(result.removed).toEqual([]);
    expect(result.changed).toEqual([]);
    expect(result.unchangedCount).toBe(2);
  });

  it("detects changed keys with both values", () => {
    const source = { name: "ITP Updated", logo: "logo.png" };
    const target = { name: "ITP", logo: "logo.png" };
    const result = computeDiffSummary(source, target);

    expect(result.changed).toEqual([
      { key: "name", sourceValue: "ITP Updated", targetValue: "ITP" },
    ]);
    expect(result.unchangedCount).toBe(1);
  });

  it("detects added keys with source value", () => {
    const source = { name: "ITP", newField: "value" };
    const target = { name: "ITP" };
    const result = computeDiffSummary(source, target);

    expect(result.added).toEqual([{ key: "newField", sourceValue: "value" }]);
    expect(result.unchangedCount).toBe(1);
  });

  it("detects removed keys with target value", () => {
    const source = { name: "ITP" };
    const target = { name: "ITP", oldField: "value" };
    const result = computeDiffSummary(source, target);

    expect(result.removed).toEqual([{ key: "oldField", targetValue: "value" }]);
    expect(result.unchangedCount).toBe(1);
  });

  it("handles all change types simultaneously", () => {
    const source = { same: "ok", changed: "new", added: "yes" };
    const target = { same: "ok", changed: "old", removed: "bye" };
    const result = computeDiffSummary(source, target);

    expect(result.unchangedCount).toBe(1);
    expect(result.changed).toEqual([
      { key: "changed", sourceValue: "new", targetValue: "old" },
    ]);
    expect(result.added).toEqual([{ key: "added", sourceValue: "yes" }]);
    expect(result.removed).toEqual([{ key: "removed", targetValue: "bye" }]);
  });

  it("detects changes in nested objects via JSON comparison", () => {
    const source = { resources: [{ id: 1, name: "Room A" }] };
    const target = { resources: [{ id: 1, name: "Room B" }] };
    const result = computeDiffSummary(source, target);

    expect(result.changed).toHaveLength(1);
    expect(result.changed[0].key).toBe("resources");
    expect(result.changed[0].sourceValue).toEqual([{ id: 1, name: "Room A" }]);
    expect(result.changed[0].targetValue).toEqual([{ id: 1, name: "Room B" }]);
  });

  it("handles empty source with null target", () => {
    const result = computeDiffSummary({}, null);

    expect(result.added).toEqual([]);
    expect(result.removed).toEqual([]);
    expect(result.changed).toEqual([]);
    expect(result.unchangedCount).toBe(0);
  });

  it("handles empty source and empty target", () => {
    const result = computeDiffSummary({}, {});

    expect(result.added).toEqual([]);
    expect(result.removed).toEqual([]);
    expect(result.changed).toEqual([]);
    expect(result.unchangedCount).toBe(0);
  });
});

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

const mockServerFetch = vi.fn();
vi.mock("@/lib/firebase/server/adminDb", () => ({
  serverFetchAllDataFromCollection: (...args: unknown[]) =>
    mockServerFetch(...args),
}));

vi.mock("@/lib/firebase/server/firebaseAdmin", () => ({
  default: {},
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
    mockServerFetch.mockResolvedValue([
      { id: "1", email: "admin@nyu.edu" },
    ]);
  });

  it("returns 401 when x-user-email header is missing", async () => {
    const res = await POST(
      createRequest({ sourceEnv: "development", targetEnv: "production" }),
      createParams("itp"),
    );
    const { status } = await parseResponse(res);
    expect(status).toBe(401);
  });

  it("returns 403 when user is not a super admin", async () => {
    mockServerFetch.mockResolvedValue([{ id: "1", email: "other@nyu.edu" }]);

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
    expect(data.diff.changed).toEqual([
      { key: "name", sourceValue: "ITP New", targetValue: "ITP Old" },
    ]);
    expect(data.diff.unchangedCount).toBe(1);
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
