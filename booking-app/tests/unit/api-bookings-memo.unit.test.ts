import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PagePermission } from "@/components/src/types";

const mocks = vi.hoisted(() => {
  const mockUpdate = vi.fn();
  const mockGet = vi.fn();
  const mockLimit = vi.fn(() => ({ get: () => mockGet() }));
  const mockWhere = vi.fn(() => ({ limit: (n: number) => mockLimit(n) }));
  const mockCollection = vi.fn(() => ({
    where: (...args: unknown[]) => (mockWhere as any)(...args),
  }));
  return {
    mockRequireSession: vi.fn(),
    mockResolveCallerRole: vi.fn(),
    mockGetCachedTenantSchema: vi.fn(),
    mockUpdate,
    mockGet,
    mockWhere,
    mockCollection,
    mockFirestoreFn: () => ({
      collection: (...args: unknown[]) => (mockCollection as any)(...args),
    }),
  };
});

vi.mock("@/lib/api/requireSession", () => ({
  requireSession: () => mocks.mockRequireSession(),
}));

vi.mock("@/lib/api/authz", () => ({
  resolveCallerRole: (...args: unknown[]) =>
    mocks.mockResolveCallerRole(...args),
}));

vi.mock("@/lib/tenant/getCachedTenantSchema", () => ({
  getCachedTenantSchema: (...args: unknown[]) =>
    mocks.mockGetCachedTenantSchema(...args),
}));

vi.mock("@/lib/firebase/server/firebaseAdmin", () => ({
  default: {
    firestore: mocks.mockFirestoreFn,
  },
}));

import { PUT } from "@/app/api/bookings/memo/route";
import { BOOKING_MEMO_MAX_LEN } from "@/components/src/constants/bookingMemo";
import { generateDefaultSchema } from "@/components/src/client/routes/components/schemaTypes";

const schemaWith = (
  detail: Partial<ReturnType<typeof generateDefaultSchema>["detail"]>,
) => {
  const base = generateDefaultSchema("mc");
  return { ...base, detail: { ...base.detail, showMemo: true, ...detail } };
};

const createRequest = (body: unknown, tenant?: string) =>
  new NextRequest("http://localhost:3000/api/bookings/memo", {
    method: "PUT",
    headers: new Headers({
      "Content-Type": "application/json",
      ...(tenant ? { "x-tenant": tenant } : {}),
    }),
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

describe("PUT /api/bookings/memo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockRequireSession.mockResolvedValue({
      email: "admin@nyu.edu",
      netId: "admin",
    });
    mocks.mockResolveCallerRole.mockResolvedValue(PagePermission.ADMIN);
    mocks.mockGetCachedTenantSchema.mockResolvedValue(schemaWith({}));
    mocks.mockUpdate.mockResolvedValue(undefined);
    mocks.mockGet.mockResolvedValue({
      empty: false,
      docs: [
        { ref: { update: (...args: unknown[]) => mocks.mockUpdate(...args) } },
      ],
    });
  });

  it("returns 401 without a session", async () => {
    mocks.mockRequireSession.mockResolvedValue(null);
    const res = await PUT(
      createRequest({ calendarEventId: "evt-1", memo: "WO-123" }, "mc"),
    );
    expect(res.status).toBe(401);
    expect(mocks.mockUpdate).not.toHaveBeenCalled();
  });

  it("returns 400 on invalid JSON", async () => {
    const res = await PUT(createRequest("{not json", "mc"));
    expect(res.status).toBe(400);
  });

  it("returns 400 when calendarEventId is missing", async () => {
    const res = await PUT(createRequest({ memo: "WO-123" }, "mc"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("calendarEventId required");
  });

  it("returns 400 when memo is not a string", async () => {
    const res = await PUT(
      createRequest({ calendarEventId: "evt-1", memo: 42 }, "mc"),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("memo must be a string");
  });

  it("returns 400 when memo exceeds the max length", async () => {
    const res = await PUT(
      createRequest(
        {
          calendarEventId: "evt-1",
          memo: "x".repeat(BOOKING_MEMO_MAX_LEN + 1),
        },
        "mc",
      ),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for an unknown tenant", async () => {
    const res = await PUT(
      createRequest({ calendarEventId: "evt-1", memo: "WO-123" }, "nope"),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Invalid tenant");
  });

  it.each([PagePermission.BOOKING, PagePermission.PA, PagePermission.LIAISON])(
    "returns 403 for %s callers",
    async (role) => {
      mocks.mockResolveCallerRole.mockResolvedValue(role);
      const res = await PUT(
        createRequest({ calendarEventId: "evt-1", memo: "WO-123" }, "mc"),
      );
      expect(res.status).toBe(403);
      expect(mocks.mockUpdate).not.toHaveBeenCalled();
    },
  );

  it.each([
    PagePermission.SERVICES,
    PagePermission.ADMIN,
    PagePermission.SUPER_ADMIN,
  ])("writes the trimmed memo for %s callers", async (role) => {
    mocks.mockResolveCallerRole.mockResolvedValue(role);
    const res = await PUT(
      createRequest({ calendarEventId: "evt-1", memo: "  WO-123  " }, "mc"),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, memo: "WO-123" });
    expect(mocks.mockResolveCallerRole).toHaveBeenCalledWith(
      { email: "admin@nyu.edu", netId: "admin" },
      "mc",
    );
    expect(mocks.mockCollection).toHaveBeenCalledWith("mc-bookings");
    expect(mocks.mockWhere).toHaveBeenCalledWith(
      "calendarEventId",
      "==",
      "evt-1",
    );
    expect(mocks.mockUpdate).toHaveBeenCalledWith({ memo: "WO-123" });
  });

  it("returns 403 when the tenant has memo disabled", async () => {
    mocks.mockGetCachedTenantSchema.mockResolvedValue(
      schemaWith({ showMemo: false }),
    );
    const res = await PUT(
      createRequest({ calendarEventId: "evt-1", memo: "WO-123" }, "mc"),
    );
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe(
      "Memo is not enabled for this tenant",
    );
    expect(mocks.mockUpdate).not.toHaveBeenCalled();
  });

  it("returns 403 when the tenant has no schema document", async () => {
    mocks.mockGetCachedTenantSchema.mockResolvedValue(null);
    const res = await PUT(
      createRequest({ calendarEventId: "evt-1", memo: "WO-123" }, "mc"),
    );
    expect(res.status).toBe(403);
  });

  it("honors a tenant memoRoles list that includes PA", async () => {
    mocks.mockGetCachedTenantSchema.mockResolvedValue(
      schemaWith({ memoRoles: ["PA", "ADMIN"] }),
    );
    mocks.mockResolveCallerRole.mockResolvedValue(PagePermission.PA);
    const res = await PUT(
      createRequest({ calendarEventId: "evt-1", memo: "WO-123" }, "mc"),
    );
    expect(res.status).toBe(200);
    expect(mocks.mockUpdate).toHaveBeenCalledWith({ memo: "WO-123" });
  });

  it("rejects a Services caller when memoRoles is ADMIN only", async () => {
    mocks.mockGetCachedTenantSchema.mockResolvedValue(
      schemaWith({ memoRoles: ["ADMIN"] }),
    );
    mocks.mockResolveCallerRole.mockResolvedValue(PagePermission.SERVICES);
    const res = await PUT(
      createRequest({ calendarEventId: "evt-1", memo: "WO-123" }, "mc"),
    );
    expect(res.status).toBe(403);
    expect(mocks.mockUpdate).not.toHaveBeenCalled();
  });

  it("clears the memo when an empty string is sent", async () => {
    const res = await PUT(
      createRequest({ calendarEventId: "evt-1", memo: "   " }, "mc"),
    );
    expect(res.status).toBe(200);
    expect(mocks.mockUpdate).toHaveBeenCalledWith({ memo: null });
  });

  it("falls back to the body tenant when the header is absent", async () => {
    const res = await PUT(
      createRequest({ calendarEventId: "evt-1", memo: "WO-1", tenant: "itp" }),
    );
    expect(res.status).toBe(200);
    expect(mocks.mockResolveCallerRole).toHaveBeenCalledWith(
      expect.anything(),
      "itp",
    );
  });

  it("returns 404 when the booking does not exist", async () => {
    mocks.mockGet.mockResolvedValue({ empty: true, docs: [] });
    const res = await PUT(
      createRequest({ calendarEventId: "evt-missing", memo: "WO-1" }, "mc"),
    );
    expect(res.status).toBe(404);
  });

  it("returns 500 when the Firestore update fails, so the client never marks the memo saved", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.mockUpdate.mockRejectedValue(new Error("boom"));
    const res = await PUT(
      createRequest({ calendarEventId: "evt-1", memo: "WO-1" }, "mc"),
    );
    expect(res.status).toBe(500);
    expect((await res.json()).success).toBeUndefined();
  });

  it("returns 404 without writing when no booking matches", async () => {
    mocks.mockGet.mockResolvedValue({ empty: true, docs: [] });
    const res = await PUT(
      createRequest({ calendarEventId: "evt-missing", memo: "WO-1" }, "mc"),
    );
    expect(res.status).toBe(404);
    expect(mocks.mockUpdate).not.toHaveBeenCalled();
  });
});
