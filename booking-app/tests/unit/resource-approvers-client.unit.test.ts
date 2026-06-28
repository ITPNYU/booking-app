import {
  clientAddResourceApprover,
  clientListResourceApprovers,
  clientRemoveResourceApprover,
  clientResolveResourceApproverEmails,
} from "@/lib/firebase/firebase";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

function response(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => body,
  };
}

function bodyAt(index: number) {
  return JSON.parse(fetchMock.mock.calls[index][1].body as string);
}

describe("resource approver client helpers", () => {
  it("lists from the tenant resource approver collection", async () => {
    fetchMock.mockResolvedValue(response({ docs: [{ id: "one" }] }));

    await expect(clientListResourceApprovers("mc")).resolves.toEqual([
      { id: "one" },
    ]);
    expect(bodyAt(0)).toMatchObject({
      collection: "usersResourceApprovers",
      tenant: "mc",
      where: [],
    });
  });

  it("normalizes email and uses the same deterministic ID for add/remove", async () => {
    fetchMock.mockResolvedValue(response({ ok: true }));

    await clientAddResourceApprover(" room/a ", " Person@NYU.EDU ", "mc");
    await clientRemoveResourceApprover(" room/a ", " Person@NYU.EDU ", "mc");

    expect(bodyAt(0)).toMatchObject({
      op: "set",
      collection: "usersResourceApprovers",
      tenant: "mc",
      docId: bodyAt(1).docId,
      data: {
        email: "person@nyu.edu",
        resourceId: "room/a",
      },
    });
    expect(bodyAt(0).data.createdAt).toEqual({ __ts: expect.any(Number) });
    expect(bodyAt(1)).toMatchObject({
      op: "delete",
      collection: "usersResourceApprovers",
      tenant: "mc",
    });
  });

  it("falls back when no approver covers every requested resource", async () => {
    fetchMock
      .mockResolvedValueOnce(
        response({
          docs: [
            { resourceId: "a", email: "SAME@nyu.edu" },
            { resourceId: "a", email: "same@nyu.edu" },
            { resourceId: "unrequested", email: "other@nyu.edu" },
          ],
        }),
      )
      .mockResolvedValueOnce(response({ docs: [{ email: "FINAL@nyu.edu" }] }));

    await expect(
      clientResolveResourceApproverEmails(["a", "b", "b"], "mc"),
    ).resolves.toEqual(["final@nyu.edu"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(bodyAt(0)).toMatchObject({
      collection: "usersResourceApprovers",
      tenant: "mc",
      where: [{ field: "resourceId", op: "in", value: ["a", "b"] }],
    });
    expect(bodyAt(1)).toMatchObject({
      collection: "usersApprovers",
      tenant: "mc",
      where: [{ field: "level", op: "==", value: 2 }],
    });
  });

  it("does not query final approvers when every resource is covered", async () => {
    fetchMock.mockResolvedValue(
      response({
        docs: [
          { resourceId: "a", email: "ONE@nyu.edu" },
          { resourceId: "b", email: "one@nyu.edu" },
          { resourceId: "b", email: "two@nyu.edu" },
        ],
      }),
    );

    await expect(
      clientResolveResourceApproverEmails(["a", "b"], "mc"),
    ).resolves.toEqual(["one@nyu.edu"]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(bodyAt(0)).toMatchObject({
      collection: "usersResourceApprovers",
      tenant: "mc",
      where: [{ field: "resourceId", op: "in", value: ["a", "b"] }],
    });
  });

  it("throws instead of silently falling back after a resource query failure", async () => {
    fetchMock.mockResolvedValue(
      response({ error: "query failed" }, false, 500),
    );

    await expect(
      clientResolveResourceApproverEmails(["a"], "mc"),
    ).rejects.toThrow("query failed");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
