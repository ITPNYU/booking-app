import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PagePermission } from "@/components/src/types";

const mocks = vi.hoisted(() => {
  const mockUpdate = vi.fn();
  const mockSet = vi.fn();
  const mockAdd = vi.fn(async () => ({ id: "new" }));
  return {
    mockRequireSession: vi.fn(),
    mockAuthorizeWrite: vi.fn(),
    mockUpdate,
    mockSet,
    mockAdd,
    mockFirestoreFn: () => ({
      collection: () => ({
        add: (...args: unknown[]) => (mockAdd as any)(...args),
        doc: () => ({
          update: (...args: unknown[]) => mockUpdate(...args),
          set: (...args: unknown[]) => mockSet(...args),
          delete: vi.fn(),
        }),
      }),
    }),
  };
});

vi.mock("@/lib/api/requireSession", () => ({
  requireSession: () => mocks.mockRequireSession(),
}));

vi.mock("@/lib/api/authz", () => ({
  authorizeWrite: (...args: unknown[]) => mocks.mockAuthorizeWrite(...args),
  isAccessDenied: (d: { ok: boolean }) => d.ok === false,
}));

vi.mock("@/lib/firebase/server/firebaseAdmin", () => ({
  default: { firestore: mocks.mockFirestoreFn },
}));

import { POST } from "@/app/api/firestore/mutate/route";

const request = (body: object) =>
  new NextRequest("http://localhost:3000/api/firestore/mutate", {
    method: "POST",
    headers: new Headers({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  });

describe("POST /api/firestore/mutate — staff-only booking fields", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockRequireSession.mockResolvedValue({
      email: "pa@nyu.edu",
      netId: "pa",
    });
    mocks.mockAuthorizeWrite.mockResolvedValue({
      ok: true,
      role: PagePermission.PA,
    });
    mocks.mockUpdate.mockResolvedValue(undefined);
    mocks.mockSet.mockResolvedValue(undefined);
  });

  it.each(["update", "set"] as const)(
    "refuses a booking %s that writes memo even when the write policy allows the caller",
    async (op) => {
      const res = await POST(
        request({
          op,
          collection: "bookings",
          tenant: "mc",
          docId: "b1",
          data: { memo: "WO-1" },
        }),
      );
      expect(res.status).toBe(403);
      expect((await res.json()).error).toContain("memo");
      expect(mocks.mockUpdate).not.toHaveBeenCalled();
      expect(mocks.mockSet).not.toHaveBeenCalled();
    },
  );

  it("refuses a booking create that seeds memo", async () => {
    const res = await POST(
      request({
        op: "create",
        collection: "bookings",
        tenant: "mc",
        data: { title: "x", memo: "WO-1" },
      }),
    );
    expect(res.status).toBe(403);
    expect(mocks.mockAdd).not.toHaveBeenCalled();
  });

  it("refuses memo writes for admins too, so the dedicated route is the only path", async () => {
    mocks.mockAuthorizeWrite.mockResolvedValue({
      ok: true,
      role: PagePermission.ADMIN,
    });
    const res = await POST(
      request({
        op: "update",
        collection: "bookings",
        tenant: "mc",
        docId: "b1",
        data: { memo: "WO-1" },
      }),
    );
    expect(res.status).toBe(403);
    expect(mocks.mockUpdate).not.toHaveBeenCalled();
  });

  it("still allows other booking field writes", async () => {
    const res = await POST(
      request({
        op: "update",
        collection: "bookings",
        tenant: "mc",
        docId: "b1",
        data: { equipmentCheckedOut: true },
      }),
    );
    expect(res.status).toBe(200);
    expect(mocks.mockUpdate).toHaveBeenCalledWith({
      equipmentCheckedOut: true,
    });
  });

  it("does not apply the booking field rule to other collections", async () => {
    const res = await POST(
      request({
        op: "update",
        collection: "bookingLogs",
        tenant: "mc",
        docId: "l1",
        data: { memo: "fine here" },
      }),
    );
    expect(res.status).toBe(200);
    expect(mocks.mockUpdate).toHaveBeenCalledWith({ memo: "fine here" });
  });

  it("checks the write policy before the field rule", async () => {
    mocks.mockAuthorizeWrite.mockResolvedValue({
      ok: false,
      status: 403,
      reason: "write denied",
    });
    const res = await POST(
      request({
        op: "update",
        collection: "bookings",
        tenant: "mc",
        docId: "b1",
        data: { memo: "WO-1" },
      }),
    );
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("write denied");
  });
});
