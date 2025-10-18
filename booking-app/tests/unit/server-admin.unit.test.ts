import { beforeEach, describe, expect, it, vi } from "vitest";

vi.stubEnv("NEXT_PUBLIC_BASE_URL", "https://booking.test");

const mockFetch = vi.fn();
global.fetch = mockFetch as unknown as typeof fetch;

const mockIsMediaCommons = vi.fn();
const mockTimestampNow = vi.fn(() => ({
  toDate: () => new Date("2024-01-01T00:00:00.000Z"),
  toMillis: () => Date.parse("2024-01-01T00:00:00.000Z"),
}));

type TimestampLike = {
  toDate: () => Date;
  toMillis: () => number;
};

const makeTimestamp = (value: string): TimestampLike => ({
  toDate: () => new Date(value),
  toMillis: () => Date.parse(value),
});

type QueryFilter = {
  field: string;
  operator: string;
  value: unknown;
};

type FirestoreStore = Record<string, Map<string, Record<string, any>>>;

const firestoreStore: FirestoreStore = {};
let autoId = 0;

const clone = <T>(value: T): T => {
  if (Array.isArray(value)) {
    return value.map(item => clone(item)) as unknown as T;
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    const result: Record<string, unknown> = {};
    entries.forEach(([key, entryValue]) => {
      result[key] = clone(entryValue);
    });
    return result as T;
  }

  return value;
};

const ensureCollectionStore = (collectionName: string) => {
  if (!firestoreStore[collectionName]) {
    firestoreStore[collectionName] = new Map();
  }
  return firestoreStore[collectionName];
};

const createSnapshot = (id: string, data?: Record<string, any>) => ({
  id,
  data: () => clone(data ?? {}),
  exists: () => data !== undefined,
});

const createQuery = (
  collectionName: string,
  filters: QueryFilter[] = [],
  limitValue?: number,
) => ({
  where(field: string, operator: string, value: unknown) {
    return createQuery(collectionName, [...filters, { field, operator, value }], limitValue);
  },
  limit(nextLimit: number) {
    return createQuery(collectionName, filters, nextLimit);
  },
  async get() {
    const store = ensureCollectionStore(collectionName);
    let entries = Array.from(store.entries());

    filters.forEach(({ field, operator, value }) => {
      if (operator === "==") {
        entries = entries.filter(([, data]) => data[field] === value);
      }
    });

    if (typeof limitValue === "number") {
      entries = entries.slice(0, limitValue);
    }

    return {
      docs: entries.map(([id, data]) => createSnapshot(id, data)),
      empty: entries.length === 0,
    };
  },
});

const createDocRef = (collectionName: string, docId: string) => ({
  async get() {
    const store = ensureCollectionStore(collectionName);
    const data = store.get(docId);
    return createSnapshot(docId, data);
  },
  async set(data: Record<string, any>) {
    const store = ensureCollectionStore(collectionName);
    store.set(docId, clone(data));
  },
  async update(data: Record<string, any>) {
    const store = ensureCollectionStore(collectionName);
    const existing = store.get(docId) ?? {};
    const next: Record<string, any> = { ...existing };
    Object.entries(data).forEach(([key, value]) => {
      if (value && typeof value === "object" && "__delete" in (value as any)) {
        delete next[key];
      } else {
        next[key] = clone(value);
      }
    });
    store.set(docId, next);
  },
  async delete() {
    const store = ensureCollectionStore(collectionName);
    store.delete(docId);
  },
});

const createCollectionRef = (collectionName: string) => ({
  doc(docId: string) {
    return createDocRef(collectionName, docId);
  },
  async add(data: Record<string, any>) {
    const store = ensureCollectionStore(collectionName);
    const id = `auto-${++autoId}`;
    store.set(id, clone(data));
    return { id };
  },
  where(field: string, operator: string, value: unknown) {
    return createQuery(collectionName).where(field, operator, value);
  },
  limit(limitValue: number) {
    return createQuery(collectionName, [], limitValue);
  },
  async get() {
    return createQuery(collectionName).get();
  },
});

const resetFirestore = () => {
  Object.values(firestoreStore).forEach(store => store.clear());
  autoId = 0;
};

const seedCollection = (
  collectionName: string,
  docs: Array<{ id: string; data: Record<string, any> }>,
) => {
  const store = ensureCollectionStore(collectionName);
  store.clear();
  docs.forEach(({ id, data }) => {
    store.set(id, clone(data));
  });
};

const readCollection = (collectionName: string) => {
  const store = ensureCollectionStore(collectionName);
  return Array.from(store.entries()).map(([id, data]) => ({ id, ...clone(data) }));
};

vi.mock("firebase-admin", () => {
  const Timestamp = { now: mockTimestampNow };
  const FieldValue = { delete: () => ({ __delete: true }) };

  const firestoreInstance = {
    settings: vi.fn(),
    collection: (name: string) => createCollectionRef(name),
    Timestamp,
    FieldValue,
  };

  const adminMock = {
    apps: [] as unknown[],
    initializeApp: vi.fn(() => {
      adminMock.apps.push({});
      return {};
    }),
    credential: {
      cert: vi.fn(() => ({})),
    },
    firestore: vi.fn(() => firestoreInstance),
    firestoreInstance,
  } as any;

  adminMock.firestore.Timestamp = Timestamp;
  adminMock.firestore.FieldValue = FieldValue;

  return {
    default: adminMock,
  };
});

vi.mock("firebase-admin/firestore", () => ({
  Timestamp: { now: mockTimestampNow },
  FieldValue: {
    delete: () => ({ __delete: true }),
  },
}));

vi.mock("@/components/src/utils/tenantUtils", async () => {
  const actual = await vi.importActual<
    typeof import("@/components/src/utils/tenantUtils")
  >("@/components/src/utils/tenantUtils");
  return {
    ...actual,
    isMediaCommons: mockIsMediaCommons,
  };
});

vi.mock("@/components/src/policy", async () => {
  const actual = await vi.importActual<
    typeof import("@/components/src/policy")
  >("@/components/src/policy");
  return {
    ...actual,
    getApprovalCcEmail: vi.fn(() => "cc@nyu.edu"),
  };
});

import { ApproverLevel, TableNames } from "@/components/src/policy";
import { BookingStatusLabel } from "@/components/src/types";

describe("components/src/server/admin", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv("NEXT_PUBLIC_BASE_URL", "https://booking.test");
    vi.resetModules();
    mockFetch.mockReset();
    resetFirestore();
    mockIsMediaCommons.mockReturnValue(false);
  });

  it("formats booking contents with fallback history when logs absent", async () => {
    seedCollection("tenant-z-bookings", [
      {
        id: "booking-1",
        data: {
          calendarEventId: "cal-1",
          requestNumber: 77,
          title: "Animation Workshop",
          email: "requester@nyu.edu",
          startDate: makeTimestamp("2024-03-01T15:00:00.000Z"),
          endDate: makeTimestamp("2024-03-01T17:00:00.000Z"),
          requestedAt: makeTimestamp("2024-02-25T10:00:00.000Z"),
          firstApprovedAt: null,
          finalApprovedAt: null,
          declinedAt: null,
          canceledAt: null,
          checkedInAt: null,
          checkedOutAt: null,
          noShowedAt: null,
          walkedInAt: null,
          status: BookingStatusLabel.REQUESTED,
        },
      },
    ]);

    const { serverBookingContents } = await import(
      "@/components/src/server/admin"
    );

    const result = await serverBookingContents("cal-1", "tenant-z");

    expect(result.headerMessage).toBe(
      "This is a request email for 2nd approval.",
    );
    expect(result.startDate).toBe("3/1/2024");
    expect(result.endTime).toBeDefined();
    expect(result.history.map((h: any) => h.status)).toContain(
      BookingStatusLabel.REQUESTED,
    );
  });

  it("performs first approval flow and notifies final approver", async () => {
    seedCollection("tenant-y-bookings", [
      {
        id: "booking-2",
        data: {
          calendarEventId: "cal-2",
          requestNumber: 88,
          title: "Workshop",
          email: "requester@nyu.edu",
          startDate: makeTimestamp("2024-03-04T10:00:00.000Z"),
          endDate: makeTimestamp("2024-03-04T12:00:00.000Z"),
          requestedAt: makeTimestamp("2024-03-01T08:00:00.000Z"),
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
        },
      },
    ]);

    seedCollection("usersApprovers", [
      {
        id: "approver-final",
        data: {
          email: "final@nyu.edu",
          department: "ITP",
          level: ApproverLevel.FINAL,
        },
      },
    ]);

    mockFetch.mockResolvedValue({ ok: true } as any);

    const { serverFirstApproveOnly } = await import(
      "@/components/src/server/admin"
    );

    await serverFirstApproveOnly("cal-2", "approver@nyu.edu", "tenant-y");

    const bookings = readCollection("tenant-y-bookings");
    expect(bookings[0]).toMatchObject({
      id: "booking-2",
      status: BookingStatusLabel.PRE_APPROVED,
      firstApprovedBy: "approver@nyu.edu",
    });

    const logs = readCollection("tenant-y-bookingLogs");
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      bookingId: "booking-2",
      status: BookingStatusLabel.PRE_APPROVED,
      changedBy: "approver@nyu.edu",
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "https://booking.test/api/sendEmail",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "Content-Type": "application/json" }),
      }),
    );
    const [, fetchOptions] = mockFetch.mock.calls[0] as [string, { body: string }];
    const body = JSON.parse(fetchOptions.body);
    expect(body.targetEmail).toBe("final@nyu.edu");
  });

  it("returns admin records with limited fields", async () => {
    seedCollection("usersAdmin", [
      {
        id: "admin-1",
        data: {
          email: "admin@nyu.edu",
          createdAt: "ts",
          extra: true,
        },
      },
    ]);

    const { admins } = await import("@/components/src/server/admin");

    const result = await admins();

    expect(result).toEqual([
      { id: "admin-1", email: "admin@nyu.edu", createdAt: "ts" },
    ]);
  });
});
