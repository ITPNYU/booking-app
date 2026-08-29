import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

type WhereCall = { field: string; op: string; value: unknown };

const mocks = vi.hoisted(() => {
  const whereCalls: WhereCall[] = [];
  let limitValue: number | undefined;
  let orderByField: string | undefined;
  let orderByDirection: string | undefined;

  const makeQuery = () => {
    const q: any = {
      where: vi.fn((field: string, op: string, value: unknown) => {
        whereCalls.push({ field, op, value });
        return q;
      }),
      orderBy: vi.fn((field: string, direction?: string) => {
        orderByField = field;
        orderByDirection = direction;
        return q;
      }),
      startAfter: vi.fn(() => q),
      limit: vi.fn((n: number) => {
        limitValue = n;
        return q;
      }),
      get: vi.fn(async () => ({ docs: [] })),
    };
    return q;
  };

  const mockFirestoreFn = Object.assign(
    () => ({
      collection: vi.fn(() => makeQuery()),
    }),
    {
      Timestamp: {
        fromDate: (d: Date) => ({ __ts: d.getTime() }),
        fromMillis: (n: number) => ({ __ts: n }),
      },
    },
  );

  return {
    whereCalls,
    getLimit: () => limitValue,
    getOrderByField: () => orderByField,
    getOrderByDirection: () => orderByDirection,
    reset: () => {
      whereCalls.length = 0;
      limitValue = undefined;
      orderByField = undefined;
      orderByDirection = undefined;
    },
    mockRequireSession: vi.fn(),
    mockAuthorizeRead: vi.fn(),
    mockFirestoreFn,
  };
});

vi.mock("@/lib/api/requireSession", () => ({
  requireSession: () => mocks.mockRequireSession(),
}));

vi.mock("@/lib/api/authz", () => ({
  authorizeRead: (...args: unknown[]) => mocks.mockAuthorizeRead(...args),
  isAccessDenied: (d: { ok: boolean }) => d.ok === false,
}));

vi.mock("@/lib/firebase/server/firebaseAdmin", () => ({
  default: {
    firestore: mocks.mockFirestoreFn,
  },
}));

import { POST } from "@/app/api/firestore/paginated/route";

const request = (body: object) =>
  new NextRequest("http://localhost:3000/api/firestore/paginated", {
    method: "POST",
    headers: new Headers({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  });

describe("POST /api/firestore/paginated — userEmail filter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.reset();
    mocks.mockRequireSession.mockResolvedValue({
      email: "alice@nyu.edu",
      netId: "alice",
    });
    mocks.mockAuthorizeRead.mockResolvedValue({ ok: true, role: "BOOKING" });
  });

  it("applies where('email','==',session.email) when filters.userEmail is set", async () => {
    const res = await POST(
      request({
        collection: "bookings",
        tenant: "mc",
        filters: {
          dateRange: [new Date("2026-01-01").toISOString(), null],
          sortField: "startDate",
          userEmail: "alice@nyu.edu",
        },
        limit: 10,
      }),
    );

    expect(res.status).toBe(200);
    const emailFilter = mocks.whereCalls.find((w) => w.field === "email");
    expect(emailFilter).toEqual({
      field: "email",
      op: "==",
      value: "alice@nyu.edu",
    });
  });

  it("ignores client-supplied userEmail and uses session email instead", async () => {
    // The route is the trust boundary: a caller can opt into per-user scoping,
    // but the actual email used for the filter is taken from the verified
    // session, never the request body.
    const res = await POST(
      request({
        collection: "bookings",
        tenant: "mc",
        filters: {
          dateRange: [new Date("2026-01-01").toISOString(), null],
          sortField: "startDate",
          userEmail: "someone-else@nyu.edu",
        },
        limit: 10,
      }),
    );

    expect(res.status).toBe(200);
    const emailFilter = mocks.whereCalls.find((w) => w.field === "email");
    expect(emailFilter?.value).toBe("alice@nyu.edu");
  });

  it("does not apply email filter when filters.userEmail is absent", async () => {
    const res = await POST(
      request({
        collection: "bookings",
        tenant: "mc",
        filters: {
          dateRange: [new Date("2026-01-01").toISOString(), null],
          sortField: "startDate",
        },
        limit: 10,
      }),
    );

    expect(res.status).toBe(200);
    expect(mocks.whereCalls.find((w) => w.field === "email")).toBeUndefined();
  });

  it("trims whitespace and skips filter for empty userEmail", async () => {
    const res = await POST(
      request({
        collection: "bookings",
        tenant: "mc",
        filters: {
          dateRange: [new Date("2026-01-01").toISOString(), null],
          sortField: "startDate",
          userEmail: "   ",
        },
        limit: 10,
      }),
    );

    expect(res.status).toBe(200);
    expect(mocks.whereCalls.find((w) => w.field === "email")).toBeUndefined();
  });

  it("applies email filter on the search path as well, using session email", async () => {
    const res = await POST(
      request({
        collection: "bookings",
        tenant: "mc",
        filters: {
          dateRange: [new Date("2026-01-01").toISOString(), null],
          sortField: "startDate",
          searchQuery: "title",
          userEmail: "alice@nyu.edu",
        },
      }),
    );

    expect(res.status).toBe(200);
    const emailFilter = mocks.whereCalls.find((w) => w.field === "email");
    expect(emailFilter?.value).toBe("alice@nyu.edu");
  });

  it("returns 401 without session", async () => {
    mocks.mockRequireSession.mockResolvedValue(null);
    const res = await POST(
      request({
        collection: "bookings",
        tenant: "mc",
        filters: { sortField: "startDate", userEmail: "alice@nyu.edu" },
      }),
    );
    expect(res.status).toBe(401);
  });
});

describe("POST /api/firestore/paginated — sortDirection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.reset();
    mocks.mockRequireSession.mockResolvedValue({
      email: "alice@nyu.edu",
      netId: "alice",
    });
    mocks.mockAuthorizeRead.mockResolvedValue({ ok: true, role: "BOOKING" });
  });

  it("defaults to descending order when sortDirection is absent", async () => {
    const res = await POST(
      request({
        collection: "bookings",
        tenant: "mc",
        filters: {
          dateRange: [new Date("2026-01-01").toISOString(), null],
          sortField: "startDate",
        },
        limit: 10,
      }),
    );

    expect(res.status).toBe(200);
    expect(mocks.getOrderByField()).toBe("startDate");
    expect(mocks.getOrderByDirection()).toBe("desc");
  });

  it("orders ascending when sortDirection is 'asc'", async () => {
    // "All Future" views fetch ascending so the LIMIT-bounded window holds
    // the nearest upcoming bookings instead of the farthest-future ones.
    const res = await POST(
      request({
        collection: "bookings",
        tenant: "mc",
        filters: {
          dateRange: [new Date("2026-01-01").toISOString(), null],
          sortField: "startDate",
          sortDirection: "asc",
        },
        limit: 10,
      }),
    );

    expect(res.status).toBe(200);
    expect(mocks.getOrderByDirection()).toBe("asc");
  });

  it("coerces any value other than 'asc' to descending", async () => {
    const res = await POST(
      request({
        collection: "bookings",
        tenant: "mc",
        filters: {
          dateRange: [new Date("2026-01-01").toISOString(), null],
          sortField: "startDate",
          sortDirection: "ASC; drop table",
        },
        limit: 10,
      }),
    );

    expect(res.status).toBe(200);
    expect(mocks.getOrderByDirection()).toBe("desc");
  });

  it("applies sortDirection on the search path as well", async () => {
    const res = await POST(
      request({
        collection: "bookings",
        tenant: "mc",
        filters: {
          dateRange: [new Date("2026-01-01").toISOString(), null],
          sortField: "startDate",
          sortDirection: "asc",
          searchQuery: "title",
        },
      }),
    );

    expect(res.status).toBe(200);
    expect(mocks.getOrderByDirection()).toBe("asc");
  });
});
