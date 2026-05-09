/**
 * Unit tests for resource approver client helpers that use
 * tenant-scoped usersResourceApprovers collection docs.
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
      collection: "usersResourceApprovers",
      tenant: "itp",
      where: [{ field: "resource", op: "==", value: 101 }],
    });
    expect(emails).toEqual(["alice@nyu.edu", "bob@nyu.edu"]);
  });

  it("clientGetAllResourceApprovers normalizes docs", async () => {
    global.fetch = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
      fetchCalls.push({ url: "/api/firestore/list", body });
      return makeResponse({
        docs: [
          { id: "a", email: "Alice@NYU.edu", resource: 101 },
          { id: "b", email: "", resource: 202 },
        ],
      });
    }) as typeof fetch;

    const { clientGetAllResourceApprovers } = await import(
      "@/lib/firebase/firebase"
    );

    const rows = await clientGetAllResourceApprovers("itp");

    expect(fetchCalls).toHaveLength(1);
    expect(fetchCalls[0].body).toMatchObject({
      collection: "usersResourceApprovers",
      tenant: "itp",
    });
    expect(rows).toEqual([
      expect.objectContaining({
        id: "a",
        email: "alice@nyu.edu",
        resource: 101,
      }),
    ]);
  });

  it("clientAddResourceApprover skips create when duplicate already exists", async () => {
    global.fetch = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
      fetchCalls.push({ url: String(url), body });
      if (String(url).includes("/api/firestore/list")) {
        return makeResponse({ docs: [{ id: "existing-1" }] });
      }
      return makeResponse({ ok: true });
    }) as typeof fetch;

    const { clientAddResourceApprover } = await import("@/lib/firebase/firebase");

    await clientAddResourceApprover(101, "alice@nyu.edu", "itp");

    expect(fetchCalls).toHaveLength(1);
    expect(fetchCalls[0].url).toContain("/api/firestore/list");
    expect(fetchCalls[0].body).toMatchObject({
      collection: "usersResourceApprovers",
      tenant: "itp",
      where: [
        { field: "email", op: "==", value: "alice@nyu.edu" },
        { field: "resource", op: "==", value: 101 },
      ],
    });
  });

  it("clientAddResourceApprover creates a new doc when no duplicate exists", async () => {
    global.fetch = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
      fetchCalls.push({ url: String(url), body });
      if (String(url).includes("/api/firestore/list")) {
        return makeResponse({ docs: [] });
      }
      return makeResponse({ ok: true });
    }) as typeof fetch;

    const { clientAddResourceApprover } = await import("@/lib/firebase/firebase");

    await clientAddResourceApprover(101, "Alice@NYU.edu", "itp");

    expect(fetchCalls).toHaveLength(2);
    expect(fetchCalls[1].url).toContain("/api/firestore/mutate");
    expect(fetchCalls[1].body).toMatchObject({
      op: "create",
      collection: "usersResourceApprovers",
      tenant: "itp",
      data: {
        email: "alice@nyu.edu",
        resource: 101,
      },
    });
    expect((fetchCalls[1].body.data as { createdAt?: unknown }).createdAt).toBeDefined();
  });

  it("clientRemoveResourceApprover posts mutate delete", async () => {
    global.fetch = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
      fetchCalls.push({ url: String(url), body });
      return makeResponse({ ok: true });
    }) as typeof fetch;

    const { clientRemoveResourceApprover } = await import("@/lib/firebase/firebase");

    await clientRemoveResourceApprover("doc-1", "itp");

    expect(fetchCalls).toHaveLength(1);
    expect(fetchCalls[0].url).toContain("/api/firestore/mutate");
    expect(fetchCalls[0].body).toMatchObject({
      op: "delete",
      collection: "usersResourceApprovers",
      tenant: "itp",
      docId: "doc-1",
    });
  });
});
