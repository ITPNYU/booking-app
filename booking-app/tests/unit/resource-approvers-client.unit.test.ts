/**
 * Unit tests for per-resource approver client-side functions:
 *   - clientGetResourceApproverEmailsForRoom
 *   - clientGetAllApproversWithRooms
 *   - clientAddResourceRoomToApprover
 *   - clientRemoveResourceRoomFromApprover
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── In-memory Firestore store ────────────────────────────────────────────────
type Store = Record<string, Map<string, Record<string, any>>>;
const firestoreStore: Store = {};

const ensureCollection = (name: string) => {
  if (!firestoreStore[name]) firestoreStore[name] = new Map();
  return firestoreStore[name];
};

const resetStore = () => {
  Object.values(firestoreStore).forEach((m) => m.clear());
};

const seedCollection = (
  name: string,
  docs: Array<{ id: string; data: Record<string, any> }>,
) => {
  const col = ensureCollection(name);
  col.clear();
  docs.forEach(({ id, data }) => col.set(id, structuredClone(data)));
};

// ─── Track updateDoc calls ────────────────────────────────────────────────────
const updateDocCalls: Array<{ path: string; data: Record<string, any> }> = [];

// ─── Firebase/Firestore mock ──────────────────────────────────────────────────
vi.mock("firebase/firestore", () => {
  const makeDocRef = (collectionPath: string, docId: string) => ({
    __type: "docRef",
    collectionPath,
    docId,
    path: `${collectionPath}/${docId}`,
  });

  const makeCollectionRef = (path: string) => ({
    __type: "collectionRef",
    path,
  });

  return {
    getFirestore: vi.fn(() => ({})),
    collection: vi.fn((_db: any, path: string) => makeCollectionRef(path)),
    doc: vi.fn((_db: any, path: string, id?: string) => {
      if (id) return makeDocRef(path, id);
      const parts = path.split("/");
      const docId = parts.pop()!;
      return makeDocRef(parts.join("/"), docId);
    }),
    query: vi.fn((...args: any[]) => ({ __type: "query", args })),
    where: vi.fn((field: string, op: string, value: unknown) => ({
      __type: "where",
      field,
      op,
      value,
    })),
    getDocs: vi.fn(async (q: any) => {
      // Handle plain collection ref (no filters) or a query object
      let colPath: string;
      let whereArgs: any[] = [];
      if (q.__type === "collectionRef") {
        colPath = q.path;
      } else if (q.__type === "query") {
        const [colRef, ...wArgs] = q.args;
        colPath = colRef.path;
        whereArgs = wArgs;
      } else {
        return { docs: [], empty: true };
      }
      const store = ensureCollection(colPath);
      let entries = Array.from(store.entries());
      for (const w of whereArgs) {
        if (w.__type !== "where") continue;
        if (w.op === "==")
          entries = entries.filter(([, d]) => d[w.field] === w.value);
        if (w.op === "array-contains")
          entries = entries.filter(
            ([, d]) =>
              Array.isArray(d[w.field]) && d[w.field].includes(w.value),
          );
      }
      return {
        docs: entries.map(([id, data]) => ({
          id,
          data: () => structuredClone(data),
        })),
        empty: entries.length === 0,
      };
    }),
    getDoc: vi.fn(async (docRef: any) => {
      const store = ensureCollection(docRef.collectionPath);
      const data = store.get(docRef.docId);
      return {
        id: docRef.docId,
        data: () => (data ? structuredClone(data) : undefined),
        exists: () => data !== undefined,
      };
    }),
    updateDoc: vi.fn(async (docRef: any, data: Record<string, any>) => {
      updateDocCalls.push({ path: docRef.path, data: structuredClone(data) });
      const store = ensureCollection(docRef.collectionPath);
      const existing = store.get(docRef.docId);
      if (!existing) throw new Error(`Document ${docRef.docId} not found`);
      // Apply arrayUnion / arrayRemove sentinel values
      const next = structuredClone(existing);
      for (const [key, value] of Object.entries(data)) {
        if (value && typeof value === "object" && "__sentinel" in value) {
          const sentinel = value as any;
          if (sentinel.__sentinel === "arrayUnion") {
            next[key] = Array.isArray(next[key])
              ? [...new Set([...next[key], ...sentinel.elements])]
              : [...sentinel.elements];
          } else if (sentinel.__sentinel === "arrayRemove") {
            next[key] = Array.isArray(next[key])
              ? next[key].filter((v: unknown) => !sentinel.elements.includes(v))
              : [];
          }
        } else {
          next[key] = value;
        }
      }
      store.set(docRef.docId, next);
    }),
    arrayUnion: vi.fn((...elements: unknown[]) => ({
      __sentinel: "arrayUnion",
      elements,
    })),
    arrayRemove: vi.fn((...elements: unknown[]) => ({
      __sentinel: "arrayRemove",
      elements,
    })),
    deleteField: vi.fn(() => ({ __sentinel: "deleteField" })),
    initializeFirestore: vi.fn(() => ({})),
    connectFirestoreEmulator: vi.fn(),
  };
});

vi.mock("@/lib/firebase/firebase", async () => {
  const actual = await vi.importActual<typeof import("@/lib/firebase/firebase")>(
    "@/lib/firebase/firebase",
  );
  return {
    ...actual,
    db: {},
    getTenantCollection: vi.fn((colName: string, tenant?: string) => {
      const t = tenant ?? "itp";
      return `${t}-${colName}`;
    }),
  };
});

// ─── Window location mock for tenant detection ────────────────────────────────
Object.defineProperty(window, "location", {
  value: { pathname: "/itp/admin" },
  writable: true,
});

// ─── Helpers ─────────────────────────────────────────────────────────────────
const APPROVERS_COL = "usersApprovers";

// ─── Tests: clientGetResourceApproverEmailsForRoom ────────────────────────────
describe("clientGetResourceApproverEmailsForRoom", () => {
  beforeEach(() => {
    vi.resetModules();
    resetStore();
    updateDocCalls.length = 0;
  });

  it("returns emails for users whose resourceRoomIds contains roomId", async () => {
    seedCollection(`itp-${APPROVERS_COL}`, [
      {
        id: "user-a",
        data: { email: "alice@nyu.edu", resourceRoomIds: [101, 202] },
      },
      {
        id: "user-b",
        data: { email: "bob@nyu.edu", resourceRoomIds: [101] },
      },
      {
        id: "user-c",
        data: { email: "carol@nyu.edu", resourceRoomIds: [202] },
      },
    ]);
    const { clientGetResourceApproverEmailsForRoom } = await import(
      "@/lib/firebase/firebase"
    );
    const emails = await clientGetResourceApproverEmailsForRoom(101, "itp");
    expect(emails).toHaveLength(2);
    expect(emails).toContain("alice@nyu.edu");
    expect(emails).toContain("bob@nyu.edu");
    expect(emails).not.toContain("carol@nyu.edu");
  });

  it("returns [] when no user is assigned to the room", async () => {
    const { clientGetResourceApproverEmailsForRoom } = await import(
      "@/lib/firebase/firebase"
    );
    const emails = await clientGetResourceApproverEmailsForRoom(999, "itp");
    expect(emails).toEqual([]);
  });
});

// ─── Tests: clientGetAllApproversWithRooms ────────────────────────────────────
describe("clientGetAllApproversWithRooms", () => {
  beforeEach(() => {
    vi.resetModules();
    resetStore();
    updateDocCalls.length = 0;
  });

  it("returns all approver docs with id, email, and resourceRoomIds", async () => {
    seedCollection(`itp-${APPROVERS_COL}`, [
      {
        id: "user-a",
        data: { email: "alice@nyu.edu", level: 1, resourceRoomIds: [101] },
      },
      {
        id: "user-b",
        data: { email: "bob@nyu.edu", level: 2, resourceRoomIds: [] },
      },
    ]);
    const { clientGetAllApproversWithRooms } = await import(
      "@/lib/firebase/firebase"
    );
    const result = await clientGetAllApproversWithRooms("itp");
    expect(result).toHaveLength(2);
    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "user-a", email: "alice@nyu.edu", resourceRoomIds: [101] }),
        expect.objectContaining({ id: "user-b", email: "bob@nyu.edu", resourceRoomIds: [] }),
      ]),
    );
  });

  it("excludes the legacy 'resourceApprovers' singleton doc if present", async () => {
    seedCollection(`itp-${APPROVERS_COL}`, [
      {
        id: "resourceApprovers",
        data: { resources: { "101": { approvers: ["old@nyu.edu"] } } },
      },
      {
        id: "user-a",
        data: { email: "alice@nyu.edu", level: 1, resourceRoomIds: [] },
      },
    ]);
    const { clientGetAllApproversWithRooms } = await import(
      "@/lib/firebase/firebase"
    );
    const result = await clientGetAllApproversWithRooms("itp");
    expect(result.map((r) => r.id)).not.toContain("resourceApprovers");
    expect(result).toHaveLength(1);
  });

  it("returns [] when no approver documents exist", async () => {
    const { clientGetAllApproversWithRooms } = await import(
      "@/lib/firebase/firebase"
    );
    const result = await clientGetAllApproversWithRooms("itp");
    expect(result).toEqual([]);
  });
});

// ─── Tests: clientAddResourceRoomToApprover ───────────────────────────────────
describe("clientAddResourceRoomToApprover", () => {
  beforeEach(() => {
    vi.resetModules();
    resetStore();
    updateDocCalls.length = 0;
  });

  it("calls updateDoc with arrayUnion sentinel", async () => {
    seedCollection(`itp-${APPROVERS_COL}`, [
      {
        id: "user-a",
        data: { email: "alice@nyu.edu", resourceRoomIds: [] },
      },
    ]);
    const { clientAddResourceRoomToApprover } = await import(
      "@/lib/firebase/firebase"
    );
    await clientAddResourceRoomToApprover("user-a", 101, "itp");

    expect(updateDocCalls).toHaveLength(1);
    const call = updateDocCalls[0];
    expect(call.path).toContain("user-a");
    expect(call.data.resourceRoomIds.__sentinel).toBe("arrayUnion");
    expect(call.data.resourceRoomIds.elements).toContain(101);
  });

  it("persists the roomId to the in-memory store", async () => {
    seedCollection(`itp-${APPROVERS_COL}`, [
      {
        id: "user-a",
        data: { email: "alice@nyu.edu", resourceRoomIds: [] },
      },
    ]);
    const { clientAddResourceRoomToApprover } = await import(
      "@/lib/firebase/firebase"
    );
    await clientAddResourceRoomToApprover("user-a", 101, "itp");

    const doc = firestoreStore[`itp-${APPROVERS_COL}`]?.get("user-a");
    expect(doc?.resourceRoomIds).toContain(101);
  });
});

// ─── Tests: clientRemoveResourceRoomFromApprover ──────────────────────────────
describe("clientRemoveResourceRoomFromApprover", () => {
  beforeEach(() => {
    vi.resetModules();
    resetStore();
    updateDocCalls.length = 0;
  });

  it("calls updateDoc with arrayRemove sentinel", async () => {
    seedCollection(`itp-${APPROVERS_COL}`, [
      {
        id: "user-a",
        data: { email: "alice@nyu.edu", resourceRoomIds: [101, 202] },
      },
    ]);
    const { clientRemoveResourceRoomFromApprover } = await import(
      "@/lib/firebase/firebase"
    );
    await clientRemoveResourceRoomFromApprover("user-a", 101, "itp");

    expect(updateDocCalls).toHaveLength(1);
    const call = updateDocCalls[0];
    expect(call.data.resourceRoomIds.__sentinel).toBe("arrayRemove");
    expect(call.data.resourceRoomIds.elements).toContain(101);
  });

  it("removes the roomId from the in-memory store", async () => {
    seedCollection(`itp-${APPROVERS_COL}`, [
      {
        id: "user-a",
        data: { email: "alice@nyu.edu", resourceRoomIds: [101, 202] },
      },
    ]);
    const { clientRemoveResourceRoomFromApprover } = await import(
      "@/lib/firebase/firebase"
    );
    await clientRemoveResourceRoomFromApprover("user-a", 101, "itp");

    const doc = firestoreStore[`itp-${APPROVERS_COL}`]?.get("user-a");
    expect(doc?.resourceRoomIds).not.toContain(101);
    expect(doc?.resourceRoomIds).toContain(202);
  });
});
