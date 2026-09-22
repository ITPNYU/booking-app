import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PagePermission } from "@/components/src/types";

const mocks = vi.hoisted(() => {
  const bookingDocs = [
    {
      id: "a",
      data: () => ({ title: "One", memo: "WO-1", email: "alice@nyu.edu" }),
    },
    { id: "b", data: () => ({ title: "Two", email: "alice@nyu.edu" }) },
  ];
  const makeQuery = () => {
    const q: any = {
      where: vi.fn(() => q),
      orderBy: vi.fn(() => q),
      startAfter: vi.fn(() => q),
      limit: vi.fn(() => q),
      get: vi.fn(async () => ({ docs: bookingDocs })),
      doc: vi.fn(() => ({
        get: async () => ({
          exists: true,
          id: "a",
          data: () => ({ title: "One", memo: "WO-1" }),
        }),
      })),
    };
    return q;
  };
  return {
    mockRequireSession: vi.fn(),
    mockAuthorizeRead: vi.fn(),
    mockResolveCallerRole: vi.fn(),
    mockFirestoreFn: Object.assign(
      () => ({ collection: vi.fn(() => makeQuery()) }),
      {
        Timestamp: {
          fromDate: (d: Date) => ({ __ts: d.getTime() }),
          fromMillis: (n: number) => ({ __ts: n }),
        },
      },
    ),
  };
});

vi.mock("@/lib/api/requireSession", () => ({
  requireSession: () => mocks.mockRequireSession(),
}));

vi.mock("@/lib/api/authz", () => ({
  authorizeRead: (...args: unknown[]) => mocks.mockAuthorizeRead(...args),
  isAccessDenied: (d: { ok: boolean }) => d.ok === false,
  resolveCallerRole: (...args: unknown[]) =>
    mocks.mockResolveCallerRole(...args),
}));

vi.mock("@/lib/firebase/server/firebaseAdmin", () => ({
  default: { firestore: mocks.mockFirestoreFn },
}));

import { POST as paginated } from "@/app/api/firestore/paginated/route";
import { POST as list } from "@/app/api/firestore/list/route";
import { POST as getDoc } from "@/app/api/firestore/getDoc/route";

const request = (path: string, body: object) =>
  new NextRequest(`http://localhost:3000/api/firestore/${path}`, {
    method: "POST",
    headers: new Headers({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  });

describe("/api/firestore read routes redact staff-only booking fields", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockRequireSession.mockResolvedValue({
      email: "alice@nyu.edu",
      netId: "alice",
    });
    mocks.mockAuthorizeRead.mockResolvedValue({
      ok: true,
      role: PagePermission.BOOKING,
    });
  });

  describe("paginated", () => {
    const body = {
      collection: "bookings",
      tenant: "mc",
      filters: { sortField: "startDate", userEmail: "alice@nyu.edu" },
      limit: 10,
    };

    it("strips memo for a regular user reading their own bookings", async () => {
      mocks.mockResolveCallerRole.mockResolvedValue(PagePermission.BOOKING);
      const res = await paginated(request("paginated", body));
      const { docs } = await res.json();
      expect(docs).toEqual([
        { id: "a", title: "One", email: "alice@nyu.edu" },
        { id: "b", title: "Two", email: "alice@nyu.edu" },
      ]);
    });

    it("strips memo on the search path too", async () => {
      mocks.mockResolveCallerRole.mockResolvedValue(PagePermission.PA);
      const res = await paginated(
        request("paginated", {
          ...body,
          filters: { ...body.filters, searchQuery: "one" },
        }),
      );
      const { docs } = await res.json();
      expect(docs.some((d: any) => "memo" in d)).toBe(false);
    });

    it("keeps memo for admins", async () => {
      mocks.mockResolveCallerRole.mockResolvedValue(PagePermission.ADMIN);
      const res = await paginated(request("paginated", body));
      const { docs } = await res.json();
      expect(docs[0].memo).toBe("WO-1");
    });
  });

  describe("list", () => {
    it("strips memo for non-staff callers", async () => {
      mocks.mockResolveCallerRole.mockResolvedValue(PagePermission.LIAISON);
      const res = await list(
        request("list", { collection: "bookings", tenant: "mc" }),
      );
      const { docs } = await res.json();
      expect(docs.some((d: any) => "memo" in d)).toBe(false);
    });

    it("keeps memo for services callers", async () => {
      mocks.mockResolveCallerRole.mockResolvedValue(PagePermission.SERVICES);
      const res = await list(
        request("list", { collection: "bookings", tenant: "mc" }),
      );
      const { docs } = await res.json();
      expect(docs[0].memo).toBe("WO-1");
    });

    it("does not resolve the role for other collections", async () => {
      const res = await list(
        request("list", { collection: "bookingLogs", tenant: "mc" }),
      );
      expect(res.status).toBe(200);
      expect(mocks.mockResolveCallerRole).not.toHaveBeenCalled();
    });
  });

  describe("getDoc", () => {
    it("strips memo for non-staff callers", async () => {
      mocks.mockResolveCallerRole.mockResolvedValue(PagePermission.BOOKING);
      const res = await getDoc(
        request("getDoc", { collection: "bookings", tenant: "mc", docId: "a" }),
      );
      const { doc } = await res.json();
      expect(doc).toEqual({ id: "a", title: "One" });
    });

    it("keeps memo for super admins", async () => {
      mocks.mockResolveCallerRole.mockResolvedValue(PagePermission.SUPER_ADMIN);
      const res = await getDoc(
        request("getDoc", { collection: "bookings", tenant: "mc", docId: "a" }),
      );
      const { doc } = await res.json();
      expect(doc.memo).toBe("WO-1");
    });
  });
});
