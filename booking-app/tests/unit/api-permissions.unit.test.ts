import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

type Doc = { id: string; data: Record<string, unknown> };

const mocks = vi.hoisted(() => ({
  requireSession: vi.fn(),
  collections: new Map<string, Doc[]>(),
  collectionGets: [] as Array<{
    name: string;
    filters: Array<[string, unknown]>;
  }>,
}));

function makeSnap(docs: Doc[]) {
  return {
    empty: docs.length === 0,
    docs: docs.map((doc) => ({
      id: doc.id,
      data: () => doc.data,
    })),
  };
}

function queryFor(name: string, filters: Array<[string, unknown]> = []) {
  return {
    where(field: string, _op: string, value: unknown) {
      return queryFor(name, [...filters, [field, value]]);
    },
    limit() {
      return this;
    },
    async get() {
      mocks.collectionGets.push({ name, filters });
      return makeSnap(
        (mocks.collections.get(name) ?? []).filter(({ data }) =>
          filters.every(([field, value]) => data[field] === value),
        ),
      );
    },
    doc(id: string) {
      return {
        async get() {
          const doc = (mocks.collections.get(name) ?? []).find(
            (item) => item.id === id,
          );
          return {
            exists: doc != null,
            data: () => doc?.data,
          };
        },
      };
    },
  };
}

vi.mock("@/lib/api/requireSession", () => ({
  requireSession: () => mocks.requireSession(),
}));

vi.mock("@/lib/firebase/server/firebaseAdmin", () => ({
  default: {
    firestore: () => ({
      collection: (name: string) => queryFor(name),
    }),
  },
}));

import { GET } from "@/app/api/permissions/route";

const request = () =>
  new NextRequest("http://localhost:3000/api/permissions?tenant=mc");

describe("GET /api/permissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.collections.clear();
    mocks.collectionGets.length = 0;
    mocks.requireSession.mockResolvedValue({
      email: "service@nyu.edu",
      netId: "service",
    });
  });

  it("computes service permission without returning service approvers as equipment users", async () => {
    mocks.collections.set("mc-usersApprovers", [
      {
        id: "equipment-doc",
        data: {
          email: "equipment@nyu.edu",
          department: "",
          level: 3,
        },
      },
    ]);
    mocks.collections.set("mc-usersServiceApprovers", [
      {
        id: "service-doc",
        data: {
          email: "service@nyu.edu",
          resourceId: "room-1",
          service: "setup",
        },
      },
    ]);

    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.pagePermission).toBe("SERVICES");
    expect(body.equipmentUsers).toEqual([
      expect.objectContaining({
        id: "equipment-doc",
        email: "equipment@nyu.edu",
      }),
    ]);
    expect(JSON.stringify(body)).not.toContain("service-doc");
    expect(mocks.collectionGets).not.toContainEqual({
      name: "mc-usersServiceApprovers",
      filters: [],
    });
    expect(mocks.collectionGets).toContainEqual({
      name: "mc-usersServiceApprovers",
      filters: [["email", "service@nyu.edu"]],
    });
  });

  it("keeps liaison page permission when the caller is also a service approver", async () => {
    mocks.collections.set("mc-usersApprovers", [
      {
        id: "liaison-doc",
        data: {
          email: "service@nyu.edu",
          department: "ITP",
          level: 1,
        },
      },
    ]);
    mocks.collections.set("mc-usersServiceApprovers", [
      {
        id: "service-doc",
        data: {
          email: "service@nyu.edu",
          resourceId: "room-1",
          service: "setup",
        },
      },
    ]);

    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.pagePermission).toBe("LIAISON");
    expect(mocks.collectionGets).not.toContainEqual({
      name: "mc-usersServiceApprovers",
      filters: [["email", "service@nyu.edu"]],
    });
  });
});
