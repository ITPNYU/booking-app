/**
 * Unit tests for per-resource final-approver server-side functions:
 *   - serverGetResourceApprovers
 *   - serverGetFinalApproverEmailForResource
 *   - serverSetResourceFinalApprover
 *
 * And admin.ts approval routing:
 *   - serverFirstApproveOnly uses the resource-specific approver
 *   - serverFirstApproveOnly falls back to tenant-level approver
 *   - serverApproveEvent routes roomId into serverSendConfirmationEmail
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Fetch mock ──────────────────────────────────────────────────────────────
vi.stubEnv("NEXT_PUBLIC_BASE_URL", "https://booking.test");
const mockFetch = vi.fn();
global.fetch = mockFetch as unknown as typeof fetch;

// ─── In-memory Firestore helpers ─────────────────────────────────────────────
type FirestoreStore = Record<string, Map<string, Record<string, any>>>;
const firestoreStore: FirestoreStore = {};
let autoId = 0;

/**
 * Recursive clone that preserves function values (e.g. Timestamp.toDate).
 * JSON.parse/JSON.stringify would strip functions, breaking Timestamp mocks.
 */
const clone = <T>(value: T): T => {
  if (Array.isArray(value)) {
    return value.map((item) => clone(item)) as unknown as T;
  }
  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    Object.entries(value as Record<string, unknown>).forEach(([k, v]) => {
      result[k] = clone(v);
    });
    return result as T;
  }
  // primitives and functions returned as-is
  return value;
};

const deepMerge = (
  target: Record<string, any>,
  source: Record<string, any>,
): Record<string, any> => {
  const result = clone(target) as Record<string, any>;
  for (const [k, v] of Object.entries(source)) {
    if (
      v &&
      typeof v === "object" &&
      typeof v !== "function" &&
      !Array.isArray(v) &&
      result[k] &&
      typeof result[k] === "object"
    ) {
      result[k] = deepMerge(result[k], v);
    } else {
      result[k] = clone(v);
    }
  }
  return result;
};

// Dot-notation helpers for update()
const setNestedValue = (obj: Record<string, any>, path: string, value: any) => {
  const parts = path.split(".");
  let cursor = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!cursor[parts[i]] || typeof cursor[parts[i]] !== "object") {
      cursor[parts[i]] = {};
    }
    cursor = cursor[parts[i]];
  }
  cursor[parts[parts.length - 1]] = value;
};

const deleteNestedValue = (obj: Record<string, any>, path: string) => {
  const parts = path.split(".");
  let cursor = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!cursor[parts[i]]) return;
    cursor = cursor[parts[i]];
  }
  delete cursor[parts[parts.length - 1]];
};

const ensureCollection = (name: string) => {
  if (!firestoreStore[name]) firestoreStore[name] = new Map();
  return firestoreStore[name];
};

const resetFirestore = () => {
  Object.values(firestoreStore).forEach((m) => m.clear());
  autoId = 0;
};

const seedCollection = (
  name: string,
  docs: Array<{ id: string; data: Record<string, any> }>,
) => {
  const col = ensureCollection(name);
  col.clear();
  docs.forEach(({ id, data }) => col.set(id, clone(data)));
};

const readDoc = (collection: string, docId: string) => {
  return firestoreStore[collection]?.get(docId);
};

// ─── Mock: firebase-admin (in-memory Firestore) ───────────────────────────────
const mockTimestampNow = vi.fn(() => ({
  toDate: () => new Date("2024-01-01T00:00:00.000Z"),
  toMillis: () => Date.parse("2024-01-01T00:00:00.000Z"),
}));

type QueryFilter = { field: string; operator: string; value: unknown };

// Firebase Admin SDK: `exists` is a boolean property (not a function)
const createSnapshot = (id: string, data?: Record<string, any>) => ({
  id,
  data: () => clone(data ?? {}),
  exists: data !== undefined,
});

const createQuery = (
  collectionName: string,
  filters: QueryFilter[] = [],
  limitValue?: number,
) => ({
  where(field: string, operator: string, value: unknown) {
    return createQuery(
      collectionName,
      [...filters, { field, operator, value }],
      limitValue,
    );
  },
  limit(n: number) {
    return createQuery(collectionName, filters, n);
  },
  async get() {
    const store = ensureCollection(collectionName);
    let entries = Array.from(store.entries());
    filters.forEach(({ field, operator, value }) => {
      if (operator === "==")
        entries = entries.filter(([, d]) => d[field] === value);
    });
    if (typeof limitValue === "number") entries = entries.slice(0, limitValue);
    return {
      docs: entries.map(([id, d]) => createSnapshot(id, d)),
      empty: entries.length === 0,
    };
  },
});

const createDocRef = (collectionName: string, docId: string) => ({
  async get() {
    const store = ensureCollection(collectionName);
    const data = store.get(docId);
    return createSnapshot(docId, data);
  },
  async set(data: Record<string, any>, options?: { merge?: boolean }) {
    const store = ensureCollection(collectionName);
    if (options?.merge) {
      const existing = store.get(docId) ?? {};
      store.set(docId, deepMerge(clone(existing), clone(data)));
    } else {
      store.set(docId, clone(data));
    }
  },
  async update(data: Record<string, any>) {
    const store = ensureCollection(collectionName);
    const existing = store.get(docId) ?? {};
    const next: Record<string, any> = clone(existing);
    Object.entries(data).forEach(([key, value]) => {
      const isDel =
        value && typeof value === "object" && "__delete" in (value as any);
      if (key.includes(".")) {
        isDel
          ? deleteNestedValue(next, key)
          : setNestedValue(next, key, clone(value));
      } else {
        isDel ? delete next[key] : (next[key] = clone(value));
      }
    });
    store.set(docId, next);
  },
  async delete() {
    ensureCollection(collectionName).delete(docId);
  },
});

const createCollectionRef = (collectionName: string) => ({
  doc: (docId: string) => createDocRef(collectionName, docId),
  async add(data: Record<string, any>) {
    const store = ensureCollection(collectionName);
    const id = `auto-${++autoId}`;
    store.set(id, clone(data));
    return { id };
  },
  where(field: string, operator: string, value: unknown) {
    return createQuery(collectionName).where(field, operator, value);
  },
  limit(n: number) {
    return createQuery(collectionName, [], n);
  },
  async get() {
    return createQuery(collectionName).get();
  },
});

vi.mock("firebase-admin", () => {
  const Timestamp = { now: mockTimestampNow };
  const FieldValue = { delete: () => ({ __delete: true }) };

  const firestoreInstance = {
    settings: vi.fn(),
    collection: (name: string) => createCollectionRef(name),
    Timestamp,
    FieldValue,
  };

  const adminMock: any = {
    apps: [] as unknown[],
    initializeApp: vi.fn(() => {
      adminMock.apps.push({});
      return {};
    }),
    credential: { cert: vi.fn(() => ({})) },
    firestore: vi.fn(() => firestoreInstance),
    firestoreInstance,
  };
  adminMock.firestore.Timestamp = Timestamp;
  adminMock.firestore.FieldValue = FieldValue;

  return { default: adminMock };
});

vi.mock("firebase-admin/firestore", () => ({
  Timestamp: { now: mockTimestampNow },
  FieldValue: { delete: () => ({ __delete: true }) },
}));

// ─── Mock: newrelic (pass-through) ───────────────────────────────────────────
vi.mock("@/lib/newrelic-utils", () => ({
  traceDatabase: async (_op: string, _label: string, fn: () => Promise<any>) =>
    fn(),
}));

// ─── Mock: newrelic.js ────────────────────────────────────────────────────────
vi.mock("@/newrelic.js", () => ({}));

// ─── Use real policy values ───────────────────────────────────────────────────
vi.mock("@/components/src/policy", async () => {
  const actual = await vi.importActual<
    typeof import("@/components/src/policy")
  >("@/components/src/policy");
  return { ...actual };
});

vi.mock("@/components/src/types", async () => {
  const actual = await vi.importActual<
    typeof import("@/components/src/types")
  >("@/components/src/types");
  return { ...actual };
});

vi.mock("@/components/src/utils/tenantUtils", async () => {
  const actual = await vi.importActual<
    typeof import("@/components/src/utils/tenantUtils")
  >("@/components/src/utils/tenantUtils");
  return { ...actual, isMediaCommons: vi.fn().mockReturnValue(false) };
});

vi.mock("@/components/src/policy", async () => {
  const actual = await vi.importActual<
    typeof import("@/components/src/policy")
  >("@/components/src/policy");
  return { ...actual, getApprovalCcEmail: vi.fn().mockReturnValue("") };
});

import { ApproverLevel } from "@/components/src/policy";
import { BookingStatusLabel } from "@/components/src/types";

const makeTs = (value: string) => ({
  toDate: () => new Date(value),
  toMillis: () => Date.parse(value),
});

// ─── Tests: serverGetResourceApprovers ───────────────────────────────────────
describe("serverGetResourceApprovers", () => {
  beforeEach(() => {
    vi.resetModules();
    resetFirestore();
  });

  it("returns null when the resourceApprovers document does not exist", async () => {
    // Collection is empty
    const { serverGetResourceApprovers } = await import(
      "@/lib/firebase/server/adminDb"
    );
    const result = await serverGetResourceApprovers("itp");
    expect(result).toBeNull();
  });

  it("returns the full document when it exists", async () => {
    seedCollection("itp-usersApprovers", [
      {
        id: "resourceApprovers",
        data: {
          resources: {
            "101": { approvers: { finalApprover: "room101@nyu.edu" } },
          },
        },
      },
    ]);
    const { serverGetResourceApprovers } = await import(
      "@/lib/firebase/server/adminDb"
    );
    const result = await serverGetResourceApprovers("itp");
    expect(result).toMatchObject({
      resources: { "101": { approvers: { finalApprover: "room101@nyu.edu" } } },
    });
  });

  it("reads from the correct tenant-prefixed collection", async () => {
    seedCollection("mc-usersApprovers", [
      {
        id: "resourceApprovers",
        data: { resources: { "50": { approvers: { finalApprover: "mc-room50@nyu.edu" } } } },
      },
    ]);
    // itp collection is empty
    const { serverGetResourceApprovers } = await import(
      "@/lib/firebase/server/adminDb"
    );
    const itpResult = await serverGetResourceApprovers("itp");
    expect(itpResult).toBeNull();

    const mcResult = await serverGetResourceApprovers("mc");
    expect(mcResult?.resources["50"].approvers.finalApprover).toBe(
      "mc-room50@nyu.edu",
    );
  });

  it("returns null when tenant is undefined (base collection, no doc)", async () => {
    const { serverGetResourceApprovers } = await import(
      "@/lib/firebase/server/adminDb"
    );
    const result = await serverGetResourceApprovers(undefined);
    expect(result).toBeNull();
  });
});

// ─── Tests: serverGetFinalApproverEmailForResource ───────────────────────────
describe("serverGetFinalApproverEmailForResource", () => {
  beforeEach(() => {
    vi.resetModules();
    resetFirestore();
  });

  it("returns the resource-specific email when set for the given roomId", async () => {
    seedCollection("itp-usersApprovers", [
      {
        id: "resourceApprovers",
        data: {
          resources: {
            "101": { approvers: { finalApprover: "specific@nyu.edu" } },
            "202": { approvers: { finalApprover: "other@nyu.edu" } },
          },
        },
      },
    ]);
    const { serverGetFinalApproverEmailForResource } = await import(
      "@/lib/firebase/server/adminDb"
    );
    const email = await serverGetFinalApproverEmailForResource("itp", 101);
    expect(email).toBe("specific@nyu.edu");
  });

  it("does not cross-contaminate between resources", async () => {
    seedCollection("itp-usersApprovers", [
      {
        id: "resourceApprovers",
        data: {
          resources: {
            "101": { approvers: { finalApprover: "room101@nyu.edu" } },
            "202": { approvers: { finalApprover: "room202@nyu.edu" } },
          },
        },
      },
    ]);
    const { serverGetFinalApproverEmailForResource } = await import(
      "@/lib/firebase/server/adminDb"
    );
    const email202 = await serverGetFinalApproverEmailForResource("itp", 202);
    expect(email202).toBe("room202@nyu.edu");
    const email101 = await serverGetFinalApproverEmailForResource("itp", 101);
    expect(email101).toBe("room101@nyu.edu");
  });

  it("falls back to tenant-level FINAL approver when no resource-specific entry exists", async () => {
    // No resourceApprovers doc — only the legacy FINAL-level approver
    seedCollection("itp-usersApprovers", [
      {
        id: "tenant-final",
        data: { email: "tenant-final@nyu.edu", level: ApproverLevel.FINAL },
      },
    ]);
    const { serverGetFinalApproverEmailForResource } = await import(
      "@/lib/firebase/server/adminDb"
    );
    const email = await serverGetFinalApproverEmailForResource("itp", 101);
    expect(email).toBe("tenant-final@nyu.edu");
  });

  it("falls back to tenant-level approver when roomId is present but has no approver configured", async () => {
    seedCollection("itp-usersApprovers", [
      {
        id: "resourceApprovers",
        data: {
          resources: {
            "999": { approvers: { finalApprover: "room999@nyu.edu" } },
          },
        },
      },
      {
        id: "tenant-final",
        data: { email: "tenant-final@nyu.edu", level: ApproverLevel.FINAL },
      },
    ]);
    const { serverGetFinalApproverEmailForResource } = await import(
      "@/lib/firebase/server/adminDb"
    );
    // Room 101 is not in the resourceApprovers map → fall back
    const email = await serverGetFinalApproverEmailForResource("itp", 101);
    expect(email).toBe("tenant-final@nyu.edu");
  });

  it("returns null when neither resource-specific nor tenant-level approver exists", async () => {
    const { serverGetFinalApproverEmailForResource } = await import(
      "@/lib/firebase/server/adminDb"
    );
    const email = await serverGetFinalApproverEmailForResource("itp", 101);
    expect(email).toBeNull();
  });

  it("skips resource lookup and falls back immediately when roomId is undefined", async () => {
    seedCollection("itp-usersApprovers", [
      {
        id: "tenant-final",
        data: { email: "tenant-final@nyu.edu", level: ApproverLevel.FINAL },
      },
    ]);
    const { serverGetFinalApproverEmailForResource } = await import(
      "@/lib/firebase/server/adminDb"
    );
    const email = await serverGetFinalApproverEmailForResource("itp", undefined);
    expect(email).toBe("tenant-final@nyu.edu");
  });

  it("uses the correct tenant-prefixed collection (no cross-tenant leakage)", async () => {
    seedCollection("mc-usersApprovers", [
      {
        id: "resourceApprovers",
        data: {
          resources: { "5": { approvers: { finalApprover: "mc-room5@nyu.edu" } } },
        },
      },
    ]);
    const { serverGetFinalApproverEmailForResource } = await import(
      "@/lib/firebase/server/adminDb"
    );
    // ITP tenant should not find MC's resource approver
    const itpResult = await serverGetFinalApproverEmailForResource("itp", 5);
    expect(itpResult).toBeNull();

    const mcResult = await serverGetFinalApproverEmailForResource("mc", 5);
    expect(mcResult).toBe("mc-room5@nyu.edu");
  });
});

// ─── Tests: serverSetResourceFinalApprover ────────────────────────────────────
describe("serverSetResourceFinalApprover", () => {
  beforeEach(() => {
    vi.resetModules();
    resetFirestore();
  });

  it("creates the resourceApprovers document and sets the email", async () => {
    const { serverSetResourceFinalApprover, serverGetResourceApprovers } =
      await import("@/lib/firebase/server/adminDb");

    await serverSetResourceFinalApprover(101, "room101@nyu.edu", "itp");

    const doc = await serverGetResourceApprovers("itp");
    expect(doc?.resources["101"].approvers.finalApprover).toBe(
      "room101@nyu.edu",
    );
  });

  it("merges multiple resources without overwriting existing ones", async () => {
    const { serverSetResourceFinalApprover, serverGetResourceApprovers } =
      await import("@/lib/firebase/server/adminDb");

    await serverSetResourceFinalApprover(101, "room101@nyu.edu", "itp");
    await serverSetResourceFinalApprover(202, "room202@nyu.edu", "itp");

    const doc = await serverGetResourceApprovers("itp");
    expect(doc?.resources["101"].approvers.finalApprover).toBe(
      "room101@nyu.edu",
    );
    expect(doc?.resources["202"].approvers.finalApprover).toBe(
      "room202@nyu.edu",
    );
  });

  it("writes to the correct tenant-prefixed collection", async () => {
    const { serverSetResourceFinalApprover, serverGetResourceApprovers } =
      await import("@/lib/firebase/server/adminDb");

    await serverSetResourceFinalApprover(50, "mc-room50@nyu.edu", "mc");

    const itpDoc = await serverGetResourceApprovers("itp");
    expect(itpDoc).toBeNull();

    const mcDoc = await serverGetResourceApprovers("mc");
    expect(mcDoc?.resources["50"].approvers.finalApprover).toBe(
      "mc-room50@nyu.edu",
    );
  });

  it("clears the email when null is passed (dot-notation delete)", async () => {
    const { serverSetResourceFinalApprover, serverGetFinalApproverEmailForResource } =
      await import("@/lib/firebase/server/adminDb");

    // First set
    await serverSetResourceFinalApprover(101, "room101@nyu.edu", "itp");
    const before = await serverGetFinalApproverEmailForResource("itp", 101);
    expect(before).toBe("room101@nyu.edu");

    // Then clear
    await serverSetResourceFinalApprover(101, null, "itp");
    const after = await serverGetFinalApproverEmailForResource("itp", 101);
    // After clearing, should fall back to tenant-level (none seeded → null)
    expect(after).toBeNull();
  });

  it("accepts string roomId as well as number", async () => {
    const { serverSetResourceFinalApprover, serverGetFinalApproverEmailForResource } =
      await import("@/lib/firebase/server/adminDb");

    await serverSetResourceFinalApprover("101", "str-room@nyu.edu", "itp");

    const email = await serverGetFinalApproverEmailForResource("itp", 101);
    expect(email).toBe("str-room@nyu.edu");
  });
});

// ─── Tests: admin.ts — serverFirstApproveOnly routing ────────────────────────
describe("serverFirstApproveOnly – resource-specific approver routing", () => {
  beforeEach(() => {
    vi.resetModules();
    resetFirestore();
    mockFetch.mockReset();
  });

  const baseBooking = (extra: Record<string, any> = {}) => ({
    calendarEventId: "cal-res-1",
    requestNumber: 10,
    title: "Test Event",
    email: "requester@nyu.edu",
    startDate: makeTs("2024-03-04T10:00:00.000Z"),
    endDate: makeTs("2024-03-04T12:00:00.000Z"),
    requestedAt: makeTs("2024-03-01T08:00:00.000Z"),
    firstApprovedAt: null,
    finalApprovedAt: null,
    declinedAt: null,
    canceledAt: null,
    checkedInAt: null,
    checkedOutAt: null,
    noShowedAt: null,
    walkedInAt: null,
    role: "Faculty",
    status: BookingStatusLabel.REQUESTED,
    ...extra,
  });

  it("emails the resource-specific final approver when configured for the booking's roomId", async () => {
    seedCollection("tenant-r-bookings", [
      { id: "booking-r1", data: baseBooking({ roomId: "101" }) },
    ]);
    seedCollection("tenant-r-usersApprovers", [
      {
        id: "resourceApprovers",
        data: {
          resources: {
            "101": { approvers: { finalApprover: "resource-approver@nyu.edu" } },
          },
        },
      },
    ]);

    mockFetch.mockResolvedValue({ ok: true } as any);

    const { serverFirstApproveOnly } = await import(
      "@/components/src/server/admin"
    );
    await serverFirstApproveOnly("cal-res-1", "first@nyu.edu", "tenant-r");

    const emailCalls = mockFetch.mock.calls.filter(
      ([url]: [string]) => url === "https://booking.test/api/sendEmail",
    );
    expect(emailCalls.length).toBeGreaterThanOrEqual(1);
    const [, opts] = emailCalls[0] as [string, { body: string }];
    const body = JSON.parse(opts.body);
    expect(body.targetEmail).toBe("resource-approver@nyu.edu");
  });

  it("falls back to tenant-level approver when no resource-specific approver is configured", async () => {
    seedCollection("tenant-r-bookings", [
      { id: "booking-r2", data: baseBooking({ roomId: "202" }) },
    ]);
    // No resourceApprovers doc — only tenant-level FINAL
    seedCollection("tenant-r-usersApprovers", [
      {
        id: "tenant-final",
        data: { email: "tenant-final@nyu.edu", level: ApproverLevel.FINAL },
      },
    ]);

    mockFetch.mockResolvedValue({ ok: true } as any);

    const { serverFirstApproveOnly } = await import(
      "@/components/src/server/admin"
    );
    await serverFirstApproveOnly("cal-res-1", "first@nyu.edu", "tenant-r");

    const emailCalls = mockFetch.mock.calls.filter(
      ([url]: [string]) => url === "https://booking.test/api/sendEmail",
    );
    expect(emailCalls.length).toBeGreaterThanOrEqual(1);
    const [, opts] = emailCalls[0] as [string, { body: string }];
    const body = JSON.parse(opts.body);
    expect(body.targetEmail).toBe("tenant-final@nyu.edu");
  });

  it("skips sending email (no recipient) when no approver is configured at all", async () => {
    seedCollection("tenant-r-bookings", [
      { id: "booking-r3", data: baseBooking({ roomId: "303" }) },
    ]);
    // No approvers at all

    mockFetch.mockResolvedValue({ ok: true } as any);

    const { serverFirstApproveOnly } = await import(
      "@/components/src/server/admin"
    );
    await serverFirstApproveOnly("cal-res-1", "first@nyu.edu", "tenant-r");

    // No /api/sendEmail call since there's no recipient
    const emailCalls = mockFetch.mock.calls.filter(
      ([url]: [string]) => url === "https://booking.test/api/sendEmail",
    );
    expect(emailCalls).toHaveLength(0);
  });

  it("uses the first roomId when booking has multiple rooms (e.g. '101, 202')", async () => {
    seedCollection("tenant-r-bookings", [
      {
        id: "booking-r4",
        data: baseBooking({ roomId: "101, 202" }),
      },
    ]);
    seedCollection("tenant-r-usersApprovers", [
      {
        id: "resourceApprovers",
        data: {
          resources: {
            "101": { approvers: { finalApprover: "primary-room@nyu.edu" } },
            "202": { approvers: { finalApprover: "secondary-room@nyu.edu" } },
          },
        },
      },
    ]);

    mockFetch.mockResolvedValue({ ok: true } as any);

    const { serverFirstApproveOnly } = await import(
      "@/components/src/server/admin"
    );
    await serverFirstApproveOnly("cal-res-1", "first@nyu.edu", "tenant-r");

    const emailCalls = mockFetch.mock.calls.filter(
      ([url]: [string]) => url === "https://booking.test/api/sendEmail",
    );
    expect(emailCalls.length).toBeGreaterThanOrEqual(1);
    const [, opts] = emailCalls[0] as [string, { body: string }];
    const body = JSON.parse(opts.body);
    // Should use the primary (first) roomId
    expect(body.targetEmail).toBe("primary-room@nyu.edu");
  });

  it("marks booking as PRE_APPROVED and creates a log entry", async () => {
    seedCollection("tenant-r-bookings", [
      { id: "booking-r5", data: baseBooking({ roomId: "101" }) },
    ]);
    seedCollection("tenant-r-usersApprovers", [
      {
        id: "resourceApprovers",
        data: {
          resources: {
            "101": { approvers: { finalApprover: "approver@nyu.edu" } },
          },
        },
      },
    ]);

    mockFetch.mockResolvedValue({ ok: true } as any);

    const { serverFirstApproveOnly } = await import(
      "@/components/src/server/admin"
    );
    await serverFirstApproveOnly("cal-res-1", "first-approver@nyu.edu", "tenant-r");

    const booking = firestoreStore["tenant-r-bookings"]?.get("booking-r5");
    expect(booking?.status).toBe(BookingStatusLabel.PRE_APPROVED);
    expect(booking?.firstApprovedBy).toBe("first-approver@nyu.edu");

    const logs = Array.from(
      (firestoreStore["tenant-r-bookingLogs"] ?? new Map()).values(),
    );
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      status: BookingStatusLabel.PRE_APPROVED,
      changedBy: "first-approver@nyu.edu",
    });
  });
});

// ─── Tests: RESOURCE_APPROVERS_DOC_ID constant ───────────────────────────────
describe("RESOURCE_APPROVERS_DOC_ID", () => {
  it("has the value 'resourceApprovers'", async () => {
    const { RESOURCE_APPROVERS_DOC_ID } = await import(
      "@/lib/firebase/server/adminDb"
    );
    expect(RESOURCE_APPROVERS_DOC_ID).toBe("resourceApprovers");
  });
});
