import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

type WhereCall = { field: string; op: string; value: unknown };

const mocks = vi.hoisted(() => {
  const whereCalls: WhereCall[] = [];
  let limitValue: number | undefined;
  let orderByField: string | undefined;

  const makeQuery = () => {
    const q: any = {
      where: vi.fn((field: string, op: string, value: unknown) => {
        whereCalls.push({ field, op, value });
        return q;
      }),
      orderBy: vi.fn((field: string) => {
        orderByField = field;
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
    reset: () => {
      whereCalls.length = 0;
      limitValue = undefined;
      orderByField = undefined;
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

  it("applies where('email','==',userEmail) when filters.userEmail is set", async () => {
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

  it("applies email filter on the search path as well", async () => {
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
