/**
 * Unit tests for per-resource approver server-side functions:
 *   - serverGetResourceApproverEmailsForResource
 *
 * And admin.ts approval routing:
 *   - serverFirstApproveOnly emails all resource approvers for the booking's roomId
 *   - serverFirstApproveOnly falls back to tenant-level approver
 *   - Auto-approved bookings skip resource approver emails
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

const clone = <T>(value: T): T => {
  if (Array.isArray(value)) return value.map((item) => clone(item)) as unknown as T;
  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    Object.entries(value as Record<string, unknown>).forEach(([k, v]) => {
      result[k] = clone(v);
    });
    return result as T;
  }
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

// ─── Mock: firebase-admin (in-memory Firestore) ──────────────────────────────
const mockTimestampNow = vi.fn(() => ({
  toDate: () => new Date("2024-01-01T00:00:00.000Z"),
  toMillis: () => Date.parse("2024-01-01T00:00:00.000Z"),
}));

type QueryFilter = { field: string; operator: string; value: unknown };

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
      if (operator === "array-contains")
        entries = entries.filter(
          ([, d]) => Array.isArray(d[field]) && d[field].includes(value),
        );
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
    const existing = store.get(docId);
    if (!existing) throw Object.assign(new Error("NOT_FOUND"), { code: 5 });
    const next: Record<string, any> = clone(existing);
    Object.entries(data).forEach(([key, value]) => {
      const isArrayUnion =
        value && typeof value === "object" && "__arrayUnion" in value;
      const isArrayRemove =
        value && typeof value === "object" && "__arrayRemove" in value;
      if (isArrayUnion) {
        next[key] = Array.isArray(next[key])
          ? [...new Set([...next[key], ...(value as any).__arrayUnion])]
          : [...(value as any).__arrayUnion];
      } else if (isArrayRemove) {
        next[key] = Array.isArray(next[key])
          ? next[key].filter(
              (v: unknown) => !(value as any).__arrayRemove.includes(v),
            )
          : [];
      } else {
        next[key] = clone(value);
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
  const FieldValue = {
    delete: () => ({ __delete: true }),
    arrayUnion: (...items: unknown[]) => ({ __arrayUnion: items }),
    arrayRemove: (...items: unknown[]) => ({ __arrayRemove: items }),
  };

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
  FieldValue: {
    delete: () => ({ __delete: true }),
    arrayUnion: (...items: unknown[]) => ({ __arrayUnion: items }),
    arrayRemove: (...items: unknown[]) => ({ __arrayRemove: items }),
  },
}));

vi.mock("@/lib/newrelic-utils", () => ({
  traceDatabase: async (_op: string, _label: string, fn: () => Promise<any>) =>
    fn(),
}));

vi.mock("@/newrelic.js", () => ({}));

vi.mock("@/components/src/policy", async () => {
  const actual = await vi.importActual<
    typeof import("@/components/src/policy")
  >("@/components/src/policy");
  return { ...actual, getApprovalCcEmail: vi.fn().mockReturnValue("") };
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

import { ApproverLevel } from "@/components/src/policy";
import { BookingStatusLabel } from "@/components/src/types";

const makeTs = (value: string) => ({
  toDate: () => new Date(value),
  toMillis: () => Date.parse(value),
});

// ─── Tests: serverGetResourceApproverEmailsForResource ───────────────────────
describe("serverGetResourceApproverEmailsForResource", () => {
  beforeEach(() => {
    vi.resetModules();
    resetFirestore();
  });

  it("returns emails of approvers whose resourceRoomIds contains the roomId", async () => {
    seedCollection("itp-usersApprovers", [
      {
        id: "approver-1",
        data: { email: "alice@nyu.edu", level: ApproverLevel.FIRST, resourceRoomIds: [101, 202] },
      },
      {
        id: "approver-2",
        data: { email: "bob@nyu.edu", level: ApproverLevel.FIRST, resourceRoomIds: [101] },
      },
      {
        id: "approver-3",
        data: { email: "carol@nyu.edu", level: ApproverLevel.FIRST, resourceRoomIds: [202] },
      },
    ]);
    const { serverGetResourceApproverEmailsForResource } = await import(
      "@/lib/firebase/server/adminDb"
    );
    const emails = await serverGetResourceApproverEmailsForResource("itp", 101);
    expect(emails).toHaveLength(2);
    expect(emails).toContain("alice@nyu.edu");
    expect(emails).toContain("bob@nyu.edu");
    expect(emails).not.toContain("carol@nyu.edu");
  });

  it("does not cross-contaminate between rooms", async () => {
    seedCollection("itp-usersApprovers", [
      {
        id: "approver-1",
        data: { email: "alice@nyu.edu", level: ApproverLevel.FIRST, resourceRoomIds: [101] },
      },
      {
        id: "approver-2",
        data: { email: "bob@nyu.edu", level: ApproverLevel.FIRST, resourceRoomIds: [202] },
      },
    ]);
    const { serverGetResourceApproverEmailsForResource } = await import(
      "@/lib/firebase/server/adminDb"
    );
    const emails101 = await serverGetResourceApproverEmailsForResource("itp", 101);
    expect(emails101).toEqual(["alice@nyu.edu"]);

    const emails202 = await serverGetResourceApproverEmailsForResource("itp", 202);
    expect(emails202).toEqual(["bob@nyu.edu"]);
  });

  it("falls back to tenant-level FINAL approver when no user has the roomId", async () => {
    seedCollection("itp-usersApprovers", [
      {
        id: "tenant-final",
        data: { email: "final@nyu.edu", level: ApproverLevel.FINAL },
      },
    ]);
    const { serverGetResourceApproverEmailsForResource } = await import(
      "@/lib/firebase/server/adminDb"
    );
    const emails = await serverGetResourceApproverEmailsForResource("itp", 101);
    expect(emails).toEqual(["final@nyu.edu"]);
  });

  it("returns [] when no resource approver and no tenant-level approver", async () => {
    const { serverGetResourceApproverEmailsForResource } = await import(
      "@/lib/firebase/server/adminDb"
    );
    const emails = await serverGetResourceApproverEmailsForResource("itp", 101);
    expect(emails).toEqual([]);
  });

  it("skips resource lookup and falls back when roomId is undefined", async () => {
    seedCollection("itp-usersApprovers", [
      {
        id: "tenant-final",
        data: { email: "final@nyu.edu", level: ApproverLevel.FINAL },
      },
    ]);
    const { serverGetResourceApproverEmailsForResource } = await import(
      "@/lib/firebase/server/adminDb"
    );
    const emails = await serverGetResourceApproverEmailsForResource("itp", undefined);
    expect(emails).toEqual(["final@nyu.edu"]);
  });

  it("does not cross-tenant leak (mc vs itp)", async () => {
    seedCollection("mc-usersApprovers", [
      {
        id: "mc-approver",
        data: { email: "mc-approver@nyu.edu", level: ApproverLevel.FIRST, resourceRoomIds: [5] },
      },
    ]);
    const { serverGetResourceApproverEmailsForResource } = await import(
      "@/lib/firebase/server/adminDb"
    );
    const itpResult = await serverGetResourceApproverEmailsForResource("itp", 5);
    expect(itpResult).toEqual([]);

    const mcResult = await serverGetResourceApproverEmailsForResource("mc", 5);
    expect(mcResult).toContain("mc-approver@nyu.edu");
  });

  it("accepts string roomId by parsing to numeric", async () => {
    seedCollection("itp-usersApprovers", [
      {
        id: "approver-1",
        data: { email: "alice@nyu.edu", level: ApproverLevel.FIRST, resourceRoomIds: [101] },
      },
    ]);
    const { serverGetResourceApproverEmailsForResource } = await import(
      "@/lib/firebase/server/adminDb"
    );
    const emails = await serverGetResourceApproverEmailsForResource("itp", "101");
    expect(emails).toContain("alice@nyu.edu");
  });
});

// ─── Tests: admin.ts — serverFirstApproveOnly routing ────────────────────────
describe("serverFirstApproveOnly – resource approver routing", () => {
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

  it("emails all resource approvers for the booking's roomId", async () => {
    seedCollection("tenant-r-bookings", [
      { id: "booking-r1", data: baseBooking({ roomId: "101" }) },
    ]);
    seedCollection("tenant-r-usersApprovers", [
      {
        id: "approver-a",
        data: { email: "alice@nyu.edu", level: ApproverLevel.FIRST, resourceRoomIds: [101] },
      },
      {
        id: "approver-b",
        data: { email: "bob@nyu.edu", level: ApproverLevel.FIRST, resourceRoomIds: [101] },
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
    const recipients = emailCalls.map(([, opts]: [string, { body: string }]) =>
      JSON.parse(opts.body).targetEmail,
    );
    expect(recipients).toContain("alice@nyu.edu");
    expect(recipients).toContain("bob@nyu.edu");
  });

  it("falls back to tenant-level approver when no user has the roomId", async () => {
    seedCollection("tenant-r-bookings", [
      { id: "booking-r2", data: baseBooking({ roomId: "202" }) },
    ]);
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
    expect(JSON.parse(opts.body).targetEmail).toBe("tenant-final@nyu.edu");
  });

  it("skips sending email when no approver configured at all", async () => {
    seedCollection("tenant-r-bookings", [
      { id: "booking-r3", data: baseBooking({ roomId: "303" }) },
    ]);
    mockFetch.mockResolvedValue({ ok: true } as any);

    const { serverFirstApproveOnly } = await import(
      "@/components/src/server/admin"
    );
    await serverFirstApproveOnly("cal-res-1", "first@nyu.edu", "tenant-r");

    const emailCalls = mockFetch.mock.calls.filter(
      ([url]: [string]) => url === "https://booking.test/api/sendEmail",
    );
    expect(emailCalls).toHaveLength(0);
  });

  it("uses the first roomId when booking has multiple rooms ('101, 202')", async () => {
    seedCollection("tenant-r-bookings", [
      { id: "booking-r4", data: baseBooking({ roomId: "101, 202" }) },
    ]);
    seedCollection("tenant-r-usersApprovers", [
      {
        id: "approver-a",
        data: { email: "primary-room@nyu.edu", level: ApproverLevel.FIRST, resourceRoomIds: [101] },
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
    expect(JSON.parse((emailCalls[0] as [string, { body: string }])[1].body).targetEmail).toBe(
      "primary-room@nyu.edu",
    );
  });

  it("marks booking as PRE_APPROVED and creates a log entry", async () => {
    seedCollection("tenant-r-bookings", [
      { id: "booking-r5", data: baseBooking({ roomId: "101" }) },
    ]);
    seedCollection("tenant-r-usersApprovers", [
      {
        id: "approver-a",
        data: { email: "approver@nyu.edu", level: ApproverLevel.FIRST, resourceRoomIds: [101] },
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
