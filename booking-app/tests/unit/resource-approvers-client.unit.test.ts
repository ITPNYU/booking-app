/**
 * Unit tests for per-resource final-approver client-side functions:
 *   - clientGetResourceApprovers
 *   - clientSetResourceFinalApprover
 *   - clientClearResourceFinalApprover
 *   - RESOURCE_APPROVERS_DOC_ID (constant)
 *   - ResourceApproversData (type — usage verified via inference)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ─── Firestore mock ───────────────────────────────────────────────────────────
const mockGetDoc = vi.fn();
const mockSetDoc = vi.fn().mockResolvedValue(undefined);
const mockUpdateDoc = vi.fn().mockResolvedValue(undefined);
const mockDeleteField = vi.fn(() => ({ __deleteField: true }));
const mockDoc = vi.fn((_db: unknown, collectionName: string, docId: string) => ({
  _collection: collectionName,
  _id: docId,
}));
const mockCollection = vi.fn((_db: unknown, collectionName: string) => ({
  _collection: collectionName,
}));

vi.mock("firebase/firestore", () => ({
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  deleteField: () => mockDeleteField(),
  doc: (...args: unknown[]) => mockDoc(...(args as [unknown, string, string])),
  collection: (...args: unknown[]) => mockCollection(...(args as [unknown, string])),
  getDocs: vi.fn().mockResolvedValue({ docs: [] }),
  addDoc: vi.fn().mockResolvedValue({ id: "auto-id" }),
  deleteDoc: vi.fn().mockResolvedValue(undefined),
  query: vi.fn((ref: unknown) => ref),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  startAfter: vi.fn(),
  Timestamp: {
    now: vi.fn(() => ({ toDate: () => new Date() })),
    fromDate: vi.fn((d: Date) => ({ toDate: () => d })),
  },
}));

vi.mock("@/lib/firebase/firebaseClient", () => ({
  getDb: vi.fn().mockReturnValue({}),
  initializeDb: vi.fn(),
}));

vi.mock("@/components/src/types", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual };
});

vi.mock("@/components/src/client/routes/components/SchemaProvider", () => ({}));

// ─── Imports under test ───────────────────────────────────────────────────────
import {
  RESOURCE_APPROVERS_DOC_ID,
  clientClearResourceFinalApprover,
  clientGetResourceApprovers,
  clientSetResourceFinalApprover,
} from "@/lib/firebase/firebase";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const makeDocSnap = (exists: boolean, data: Record<string, any> = {}) => ({
  exists: () => exists,
  data: () => data,
});

// ─── RESOURCE_APPROVERS_DOC_ID ────────────────────────────────────────────────
describe("RESOURCE_APPROVERS_DOC_ID", () => {
  it("equals 'resourceApprovers'", () => {
    expect(RESOURCE_APPROVERS_DOC_ID).toBe("resourceApprovers");
  });
});

// ─── clientGetResourceApprovers ───────────────────────────────────────────────
describe("clientGetResourceApprovers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns null when the document does not exist", async () => {
    mockGetDoc.mockResolvedValue(makeDocSnap(false));
    vi.stubGlobal("location", { pathname: "/mc/admin" });

    const result = await clientGetResourceApprovers("mc");
    expect(result).toBeNull();
  });

  it("returns ResourceApproversData when the document exists", async () => {
    const data = {
      resources: {
        "101": { approvers: { finalApprover: "room101@nyu.edu" } },
      },
    };
    mockGetDoc.mockResolvedValue(makeDocSnap(true, data));
    vi.stubGlobal("location", { pathname: "/mc/admin" });

    const result = await clientGetResourceApprovers("mc");
    expect(result).toEqual(data);
  });

  it("reads from the correct tenant-prefixed collection when tenant is provided", async () => {
    mockGetDoc.mockResolvedValue(makeDocSnap(false));
    vi.stubGlobal("location", { pathname: "/" });

    await clientGetResourceApprovers("itp");

    expect(mockDoc).toHaveBeenCalledWith(
      expect.anything(),
      "itp-usersApprovers",
      RESOURCE_APPROVERS_DOC_ID,
    );
  });

  it("reads from 'mc-usersApprovers' when tenant is 'mc'", async () => {
    mockGetDoc.mockResolvedValue(makeDocSnap(false));
    vi.stubGlobal("location", { pathname: "/" });

    await clientGetResourceApprovers("mc");

    expect(mockDoc).toHaveBeenCalledWith(
      expect.anything(),
      "mc-usersApprovers",
      RESOURCE_APPROVERS_DOC_ID,
    );
  });

  it("derives tenant from URL when no tenant argument is passed", async () => {
    mockGetDoc.mockResolvedValue(makeDocSnap(false));
    vi.stubGlobal("location", { pathname: "/itp/admin/approvers" });

    await clientGetResourceApprovers();

    expect(mockDoc).toHaveBeenCalledWith(
      expect.anything(),
      "itp-usersApprovers",
      RESOURCE_APPROVERS_DOC_ID,
    );
  });

  it("explicit tenant overrides URL-derived tenant", async () => {
    mockGetDoc.mockResolvedValue(makeDocSnap(false));
    vi.stubGlobal("location", { pathname: "/mc/admin" });

    await clientGetResourceApprovers("itp");

    expect(mockDoc).toHaveBeenCalledWith(
      expect.anything(),
      "itp-usersApprovers",
      RESOURCE_APPROVERS_DOC_ID,
    );
    // NOT 'mc-usersApprovers'
    expect(mockDoc).not.toHaveBeenCalledWith(
      expect.anything(),
      "mc-usersApprovers",
      expect.anything(),
    );
  });

  it("returns null on error (graceful failure)", async () => {
    mockGetDoc.mockRejectedValue(new Error("Firestore unreachable"));
    vi.stubGlobal("location", { pathname: "/mc/admin" });

    const result = await clientGetResourceApprovers("mc");
    expect(result).toBeNull();
  });
});

// ─── clientSetResourceFinalApprover ───────────────────────────────────────────
describe("clientSetResourceFinalApprover", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("calls setDoc with merge:true and the correct nested structure", async () => {
    vi.stubGlobal("location", { pathname: "/mc/admin" });

    await clientSetResourceFinalApprover(101, "room101@nyu.edu", "mc");

    expect(mockSetDoc).toHaveBeenCalledTimes(1);
    const [, data, options] = mockSetDoc.mock.calls[0];
    expect(data).toEqual({
      resources: {
        "101": { approvers: { finalApprover: "room101@nyu.edu" } },
      },
    });
    expect(options).toEqual({ merge: true });
  });

  it("targets the correct tenant-prefixed collection", async () => {
    vi.stubGlobal("location", { pathname: "/" });

    await clientSetResourceFinalApprover(202, "room202@nyu.edu", "itp");

    expect(mockDoc).toHaveBeenCalledWith(
      expect.anything(),
      "itp-usersApprovers",
      RESOURCE_APPROVERS_DOC_ID,
    );
  });

  it("stringifies a numeric roomId as the map key", async () => {
    vi.stubGlobal("location", { pathname: "/" });

    await clientSetResourceFinalApprover(42, "approver@nyu.edu", "mc");

    const [, data] = mockSetDoc.mock.calls[0];
    expect(data.resources).toHaveProperty("42");
    expect(data.resources["42"].approvers.finalApprover).toBe(
      "approver@nyu.edu",
    );
  });

  it("accepts a string roomId and uses it as-is", async () => {
    vi.stubGlobal("location", { pathname: "/" });

    await clientSetResourceFinalApprover("303", "str-room@nyu.edu", "mc");

    const [, data] = mockSetDoc.mock.calls[0];
    expect(data.resources).toHaveProperty("303");
  });

  it("derives tenant from URL when no tenant argument is passed", async () => {
    vi.stubGlobal("location", { pathname: "/itp/admin/approvers" });

    await clientSetResourceFinalApprover(5, "approver@nyu.edu");

    expect(mockDoc).toHaveBeenCalledWith(
      expect.anything(),
      "itp-usersApprovers",
      RESOURCE_APPROVERS_DOC_ID,
    );
  });

  it("writes the RESOURCE_APPROVERS_DOC_ID document", async () => {
    vi.stubGlobal("location", { pathname: "/" });

    await clientSetResourceFinalApprover(10, "a@nyu.edu", "mc");

    expect(mockDoc).toHaveBeenCalledWith(
      expect.anything(),
      "mc-usersApprovers",
      "resourceApprovers",
    );
  });
});

// ─── clientClearResourceFinalApprover ─────────────────────────────────────────
describe("clientClearResourceFinalApprover", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("calls setDoc with merge:true and a deleteField sentinel on the dotted path", async () => {
    vi.stubGlobal("location", { pathname: "/mc/admin" });

    await clientClearResourceFinalApprover(101, "mc");

    expect(mockSetDoc).toHaveBeenCalledTimes(1);
    const [, data, options] = mockSetDoc.mock.calls[0];
    expect(options).toEqual({ merge: true });
    expect(data).toHaveProperty(
      "resources.101.approvers.finalApprover",
      { __deleteField: true },
    );
  });

  it("targets the correct tenant-prefixed collection", async () => {
    vi.stubGlobal("location", { pathname: "/" });

    await clientClearResourceFinalApprover(202, "itp");

    expect(mockDoc).toHaveBeenCalledWith(
      expect.anything(),
      "itp-usersApprovers",
      RESOURCE_APPROVERS_DOC_ID,
    );
  });

  it("uses string roomId in the dotted path key", async () => {
    vi.stubGlobal("location", { pathname: "/" });

    await clientClearResourceFinalApprover(42, "mc");

    const [, data] = mockSetDoc.mock.calls[0];
    expect(Object.keys(data)).toContain("resources.42.approvers.finalApprover");
  });

  it("accepts a string roomId and forms the correct dotted path", async () => {
    vi.stubGlobal("location", { pathname: "/" });

    await clientClearResourceFinalApprover("303", "mc");

    const [, data] = mockSetDoc.mock.calls[0];
    expect(Object.keys(data)).toContain(
      "resources.303.approvers.finalApprover",
    );
  });

  it("derives tenant from URL when no tenant argument is passed", async () => {
    vi.stubGlobal("location", { pathname: "/itp/admin/approvers" });

    await clientClearResourceFinalApprover(5);

    expect(mockDoc).toHaveBeenCalledWith(
      expect.anything(),
      "itp-usersApprovers",
      RESOURCE_APPROVERS_DOC_ID,
    );
  });

  it("writes to the RESOURCE_APPROVERS_DOC_ID document", async () => {
    vi.stubGlobal("location", { pathname: "/" });

    await clientClearResourceFinalApprover(10, "mc");

    expect(mockDoc).toHaveBeenCalledWith(
      expect.anything(),
      "mc-usersApprovers",
      "resourceApprovers",
    );
  });
});
