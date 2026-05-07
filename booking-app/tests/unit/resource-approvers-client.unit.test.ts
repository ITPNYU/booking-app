/**
 * Unit tests for resource approver client helpers that now use
 * the server Firestore proxy endpoints.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

type FetchCall = { url: string; body: Record<string, unknown> };

function makeResponse(data: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => data,
  } as Response;
}

describe("resource approver client helpers (proxy mode)", () => {
  let fetchCalls: FetchCall[];

  beforeEach(() => {
    vi.resetModules();
    fetchCalls = [];
    Object.defineProperty(window, "location", {
      value: { pathname: "/itp/admin" },
      writable: true,
    });
  });

  it("clientGetResourceApproverEmailsForRoom posts list query and returns emails", async () => {
    global.fetch = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
      fetchCalls.push({ url: String(url), body });
      return makeResponse({
        docs: [{ email: "alice@nyu.edu" }, { email: "bob@nyu.edu" }],
      });
    }) as typeof fetch;

    const { clientGetResourceApproverEmailsForRoom } = await import(
      "@/lib/firebase/firebase"
    );

    const emails = await clientGetResourceApproverEmailsForRoom(101, "itp");

    expect(fetchCalls).toHaveLength(1);
    expect(fetchCalls[0].url).toContain("/api/firestore/list");
    expect(fetchCalls[0].body).toMatchObject({
      collection: "usersApprovers",
      tenant: "itp",
      where: [{ field: "resourceRoomIds", op: "array-contains", value: 101 }],
    });
    expect(emails).toEqual(["alice@nyu.edu", "bob@nyu.edu"]);
  });

  it("clientGetAllApproversWithRooms normalizes docs and excludes legacy resourceApprovers singleton", async () => {
    global.fetch = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
      fetchCalls.push({ url: "/api/firestore/list", body });
      return makeResponse({
        docs: [
          {
            id: "resourceApprovers",
            resources: { "101": { approvers: ["old@nyu.edu"] } },
          },
          {
            id: "a",
            email: "alice@nyu.edu",
            scope: "resource",
            resourceRoomIds: [101],
          },
          {
            id: "b",
            email: "bob@nyu.edu",
            scope: "tenant",
            resourceRoomIds: [],
          },
        ],
      });
    }) as typeof fetch;

    const { clientGetAllApproversWithRooms } = await import(
      "@/lib/firebase/firebase"
    );

    const rows = await clientGetAllApproversWithRooms("itp");

    expect(fetchCalls).toHaveLength(1);
    expect(fetchCalls[0].body).toMatchObject({
      collection: "usersApprovers",
      tenant: "itp",
    });
    expect(rows).toHaveLength(2);
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "a",
          email: "alice@nyu.edu",
          scope: "resource",
          resourceRoomIds: [101],
          allResources: true,
        }),
        expect.objectContaining({
          id: "b",
          email: "bob@nyu.edu",
          scope: "tenant",
          resourceRoomIds: [],
          allResources: false,
        }),
      ]),
    );
  });

  it("clientAddResourceRoomToApprover posts mutate op:set with arrayUnion payload", async () => {
    global.fetch = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
      fetchCalls.push({ url: String(url), body });
      return makeResponse({ ok: true });
    }) as typeof fetch;

    const { clientAddResourceRoomToApprover } = await import(
      "@/lib/firebase/firebase"
    );

    await clientAddResourceRoomToApprover("doc-1", 101, "itp");

    expect(fetchCalls).toHaveLength(1);
    expect(fetchCalls[0].url).toContain("/api/firestore/mutate");
    expect(fetchCalls[0].body).toMatchObject({
      op: "set",
      collection: "usersApprovers",
      tenant: "itp",
      docId: "doc-1",
      data: {
        resourceRoomIds: { __arrayUnion: [101] },
        scope: "resource",
      },
    });
  });

  it("clientRemoveResourceRoomFromApprover posts mutate op:update with arrayRemove payload", async () => {
    global.fetch = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
      fetchCalls.push({ url: String(url), body });
      return makeResponse({ ok: true });
    }) as typeof fetch;

    const { clientRemoveResourceRoomFromApprover } = await import(
      "@/lib/firebase/firebase"
    );

    await clientRemoveResourceRoomFromApprover("doc-1", 101, "itp");

    expect(fetchCalls).toHaveLength(1);
    expect(fetchCalls[0].url).toContain("/api/firestore/mutate");
    expect(fetchCalls[0].body).toMatchObject({
      op: "update",
      collection: "usersApprovers",
      tenant: "itp",
      docId: "doc-1",
      data: {
        resourceRoomIds: { __arrayRemove: [101] },
      },
    });
  });
});
