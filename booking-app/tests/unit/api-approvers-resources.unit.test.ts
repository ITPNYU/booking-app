import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const stored = new Map<string, Record<string, unknown>>();
  const txSet = vi.fn((ref: { path: string }, data: Record<string, unknown>) =>
    stored.set(ref.path, data),
  );
  return {
    stored,
    txSet,
    mockRequireSession: vi.fn(),
    mockResolveCallerRole: vi.fn(),
    mockServerGetTenantResources: vi.fn(),
  };
});

vi.mock("@/lib/api/requireSession", () => ({
  requireSession: () => mocks.mockRequireSession(),
}));
vi.mock("@/lib/api/authz", () => ({
  resolveCallerRole: (...args: unknown[]) =>
    mocks.mockResolveCallerRole(...args),
}));
vi.mock("@/lib/tenant/serverGetTenantResources", () => ({
  serverGetTenantResources: (...args: unknown[]) =>
    mocks.mockServerGetTenantResources(...args),
}));
vi.mock("@/lib/firebase/server/firebaseAdmin", () => ({
  default: {
    firestore: Object.assign(
      () => ({
        collection: (name: string) => ({
          doc: (id: string) => ({ path: `${name}/${id}` }),
        }),
        runTransaction: async (
          fn: (tx: unknown) => Promise<unknown>,
        ): Promise<unknown> =>
          fn({
            get: async (ref: { path: string }) => {
              const data = mocks.stored.get(ref.path);
              return { exists: !!data, data: () => data };
            },
            set: mocks.txSet,
          }),
      }),
      { Timestamp: { now: () => "now" } },
    ),
  },
}));

import { POST } from "@/app/api/approversResources/route";
import { PagePermission } from "@/components/src/types";

const request = (body: Record<string, unknown>, tenant = "mc") =>
  ({
    json: async () => body,
    headers: new Headers({ "x-tenant": tenant }),
  }) as any;

describe("POST /api/approversResources", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.stored.clear();
    mocks.mockRequireSession.mockResolvedValue({
      email: "admin@nyu.edu",
      netId: "admin",
    });
    mocks.mockResolveCallerRole.mockResolvedValue(PagePermission.ADMIN);
    mocks.mockServerGetTenantResources.mockResolvedValue([
      { resourceId: "202", services: { equipment: {} } },
      {
        resourceId: "202A",
        parentResourceId: "202",
        services: { catering: {} },
      },
    ]);
  });

  it("adds a service approver to the resource's doc and lists them for the role query", async () => {
    const res = await POST(
      request({
        resourceId: "202",
        action: "add",
        kind: "service",
        service: "equipment",
        email: " Carol@NYU.edu ",
      }),
    );

    expect(res.status).toBe(200);
    expect(mocks.stored.get("mc-usersApproversResources/202")).toEqual({
      resourceId: "202",
      resourceApprovers: [],
      serviceApprovers: { equipment: ["carol@nyu.edu"] },
      serviceApproverEmails: ["carol@nyu.edu"],
      updatedAt: "now",
      updatedBy: "admin@nyu.edu",
    });
  });

  it("removes a resource approver and keeps the rest of the doc", async () => {
    mocks.stored.set("mc-usersApproversResources/202", {
      resourceId: "202",
      resourceApprovers: ["alice@nyu.edu", "bob@nyu.edu"],
      serviceApprovers: { equipment: ["carol@nyu.edu"] },
    });

    const res = await POST(
      request({
        resourceId: "202",
        action: "remove",
        kind: "resource",
        email: "alice@nyu.edu",
      }),
    );

    expect(res.status).toBe(200);
    expect(mocks.stored.get("mc-usersApproversResources/202")).toMatchObject({
      resourceApprovers: ["bob@nyu.edu"],
      serviceApprovers: { equipment: ["carol@nyu.edu"] },
      serviceApproverEmails: ["carol@nyu.edu"],
    });
  });

  it("accepts a service the room offers only through its annex space", async () => {
    const res = await POST(
      request({
        resourceId: "202",
        action: "add",
        kind: "service",
        service: "catering",
        email: "cater@nyu.edu",
      }),
    );
    expect(res.status).toBe(200);
  });

  it.each([
    [
      "a service the room doesn't offer",
      { kind: "service", service: "security" },
      400,
    ],
    ["an unknown service", { kind: "service", service: "parking" }, 400],
    ["a non-NYU email", { kind: "resource", email: "a@gmail.com" }, 400],
    ["an annex space", { kind: "resource", resourceId: "202A" }, 404],
    ["an unknown resource", { kind: "resource", resourceId: "999" }, 404],
  ])("rejects %s", async (_label, overrides, status) => {
    const res = await POST(
      request({
        resourceId: "202",
        action: "add",
        email: "x@nyu.edu",
        ...overrides,
      }),
    );
    expect(res.status).toBe(status);
    expect(mocks.txSet).not.toHaveBeenCalled();
  });

  it("is admin-only", async () => {
    mocks.mockResolveCallerRole.mockResolvedValue(PagePermission.SERVICES);
    const res = await POST(
      request({
        resourceId: "202",
        action: "add",
        kind: "resource",
        email: "x@nyu.edu",
      }),
    );
    expect(res.status).toBe(403);
    expect(mocks.txSet).not.toHaveBeenCalled();
  });

  it("requires a session", async () => {
    mocks.mockRequireSession.mockResolvedValue(null);
    const res = await POST(request({}));
    expect(res.status).toBe(401);
  });
});
