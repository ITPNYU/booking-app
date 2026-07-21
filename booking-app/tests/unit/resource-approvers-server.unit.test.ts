import { beforeEach, describe, expect, it, vi } from "vitest";

type Doc = { id: string; data: Record<string, unknown> };
type QueryFilter = { field: string; op: string; value: unknown };

const collections = new Map<string, Doc[]>();
const getFailures = new Map<string, Error>();
const setMock = vi.fn();
const deleteMock = vi.fn();
const queryGetMock = vi.fn();

function queryFor(name: string, filters: QueryFilter[] = []) {
  return {
    where(field: string, _op: string, value: unknown) {
      return queryFor(name, [...filters, { field, op: _op, value }]);
    },
    limit() {
      return this;
    },
    async get() {
      queryGetMock(name, filters);
      const failure = getFailures.get(name);
      if (failure) throw failure;
      const docs = (collections.get(name) ?? []).filter(({ data }) =>
        filters.every(({ field, op, value }) => {
          if (op === "in" && Array.isArray(value)) {
            return value.includes(data[field]);
          }
          return data[field] === value;
        }),
      );
      return {
        empty: docs.length === 0,
        docs: docs.map((doc) => ({ id: doc.id, data: () => doc.data })),
      };
    },
  };
}

vi.mock("@/lib/firebase/server/firebaseAdmin", () => ({
  default: {
    firestore: Object.assign(
      () => ({
        collection: (name: string) => ({
          ...queryFor(name),
          doc: (id: string) => ({
            set: (data: unknown) => setMock(name, id, data),
            delete: () => deleteMock(name, id),
          }),
        }),
      }),
      { Timestamp: { now: () => "timestamp" } },
    ),
  },
}));

vi.mock("@/lib/newrelic-utils", () => ({
  traceDatabase: async (
    _op: string,
    _label: string,
    fn: () => Promise<unknown>,
  ) => fn(),
}));

describe("resource approver server helpers", () => {
  beforeEach(() => {
    collections.clear();
    getFailures.clear();
    setMock.mockReset();
    deleteMock.mockReset();
    queryGetMock.mockReset();
  });

  it("uses tenant collection, normalized email, and deterministic IDs", async () => {
    setMock.mockResolvedValue(undefined);
    deleteMock.mockResolvedValue(undefined);
    const { serverAddResourceApprover, serverRemoveResourceApprover } =
      await import("@/lib/firebase/server/adminDb");

    await serverAddResourceApprover(" room/a ", " Person@NYU.EDU ", "mc");
    await serverRemoveResourceApprover(" room/a ", " Person@NYU.EDU ", "mc");

    expect(setMock).toHaveBeenCalledWith(
      "mc-usersResourceApprovers",
      deleteMock.mock.calls[0][1],
      {
        email: "person@nyu.edu",
        resourceId: "room/a",
        createdAt: "timestamp",
      },
    );
    expect(deleteMock).toHaveBeenCalledWith(
      "mc-usersResourceApprovers",
      expect.any(String),
    );
  });

  it("uses final fallback when no approver is assigned to every resource", async () => {
    collections.set("mc-usersResourceApprovers", [
      { id: "1", data: { resourceId: "a", email: "SAME@nyu.edu" } },
      { id: "2", data: { resourceId: "a", email: "same@nyu.edu" } },
    ]);
    collections.set("mc-usersApprovers", [
      { id: "final", data: { level: 2, email: "FINAL@nyu.edu" } },
    ]);
    const { serverResolveResourceApproverEmails } =
      await import("@/lib/firebase/server/adminDb");

    await expect(
      serverResolveResourceApproverEmails(["a", "b", "b"], "mc"),
    ).resolves.toEqual(["final@nyu.edu"]);
  });

  it("returns approvers assigned to every requested resource", async () => {
    collections.set("mc-usersResourceApprovers", [
      { id: "1", data: { resourceId: "a", email: "one@nyu.edu" } },
      { id: "2", data: { resourceId: "b", email: "one@nyu.edu" } },
      { id: "3", data: { resourceId: "b", email: "other@nyu.edu" } },
    ]);
    getFailures.set("mc-usersApprovers", new Error("must not query fallback"));
    const { serverResolveResourceApproverEmails } =
      await import("@/lib/firebase/server/adminDb");

    await expect(
      serverResolveResourceApproverEmails(["a", "b"], "mc"),
    ).resolves.toEqual(["one@nyu.edu"]);
    expect(queryGetMock).toHaveBeenCalledWith("mc-usersResourceApprovers", [
      { field: "resourceId", op: "in", value: ["a", "b"] },
    ]);
  });

  it("lists resource approvers by normalized email", async () => {
    collections.set("mc-usersResourceApprovers", [
      { id: "1", data: { resourceId: "a", email: "one@nyu.edu" } },
      { id: "2", data: { resourceId: "b", email: "two@nyu.edu" } },
    ]);
    const { serverListResourceApproversByEmail } =
      await import("@/lib/firebase/server/adminDb");

    await expect(
      serverListResourceApproversByEmail(" ONE@NYU.EDU ", "mc"),
    ).resolves.toEqual([{ id: "1", resourceId: "a", email: "one@nyu.edu" }]);
    expect(queryGetMock).toHaveBeenCalledWith("mc-usersResourceApprovers", [
      { field: "email", op: "==", value: "one@nyu.edu" },
    ]);
  });

  it("falls back when resources are only covered by different approvers", async () => {
    collections.set("mc-usersResourceApprovers", [
      { id: "1", data: { resourceId: "a", email: "one@nyu.edu" } },
      { id: "2", data: { resourceId: "b", email: "two@nyu.edu" } },
    ]);
    collections.set("mc-usersApprovers", [
      { id: "final", data: { level: 2, email: "FINAL@nyu.edu" } },
    ]);
    const { serverResolveResourceApproverEmails } =
      await import("@/lib/firebase/server/adminDb");

    await expect(
      serverResolveResourceApproverEmails(["a", "b"], "mc"),
    ).resolves.toEqual(["final@nyu.edu"]);
  });

  it("throws resource and final-approver query failures", async () => {
    const { serverResolveResourceApproverEmails } =
      await import("@/lib/firebase/server/adminDb");

    getFailures.set("mc-usersResourceApprovers", new Error("resource failure"));
    await expect(
      serverResolveResourceApproverEmails(["a"], "mc"),
    ).rejects.toThrow("resource failure");

    getFailures.clear();
    getFailures.set("mc-usersApprovers", new Error("final failure"));
    await expect(
      serverResolveResourceApproverEmails(["a"], "mc"),
    ).rejects.toThrow("final failure");
  });
});
