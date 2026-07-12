import { beforeEach, describe, expect, it, vi } from "vitest";

type Doc = { id: string; data: Record<string, unknown> };

const collections = new Map<string, Doc[]>();
const setMock = vi.fn();
const deleteMock = vi.fn();

function queryFor(name: string, filters: Array<[string, unknown]> = []) {
  return {
    where(field: string, _op: string, value: unknown) {
      return queryFor(name, [...filters, [field, value]]);
    },
    limit() {
      return this;
    },
    async get() {
      const docs = (collections.get(name) ?? []).filter(({ data }) =>
        filters.every(([field, value]) => data[field] === value),
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
            set: (data: unknown, options?: unknown) =>
              setMock(name, id, data, options),
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

describe("service approver server helpers", () => {
  beforeEach(() => {
    collections.clear();
    setMock.mockReset();
    deleteMock.mockReset();
  });

  it("uses tenant collection, normalized email, resource, service, and deterministic IDs", async () => {
    setMock.mockResolvedValue(undefined);
    deleteMock.mockResolvedValue(undefined);
    const { serverAddServiceApprover, serverRemoveServiceApprover } =
      await import("@/lib/firebase/server/adminDb");

    await serverAddServiceApprover(
      " room/a ",
      " equipment ",
      " Person@NYU.EDU ",
      "mc",
    );
    await serverRemoveServiceApprover(
      "room/a",
      "equipment",
      "person@nyu.edu",
      "mc",
    );

    expect(setMock).toHaveBeenCalledWith(
      "mc-usersServiceApprovers",
      deleteMock.mock.calls[0][1],
      {
        email: "person@nyu.edu",
        resourceId: "room/a",
        service: "equipment",
        createdAt: "timestamp",
      },
      { merge: true },
    );
    expect(deleteMock).toHaveBeenCalledWith(
      "mc-usersServiceApprovers",
      expect.any(String),
    );
  });

  it("resolves approvers assigned to every requested resource for the service", async () => {
    collections.set("mc-usersServiceApprovers", [
      {
        id: "1",
        data: { resourceId: "a", service: "setup", email: "one@nyu.edu" },
      },
      {
        id: "2",
        data: { resourceId: "b", service: "setup", email: "ONE@nyu.edu" },
      },
      {
        id: "3",
        data: { resourceId: "b", service: "setup", email: "two@nyu.edu" },
      },
      {
        id: "4",
        data: {
          resourceId: "a",
          service: "equipment",
          email: "other@nyu.edu",
        },
      },
    ]);
    const { serverResolveServiceApproverEmails } =
      await import("@/lib/firebase/server/adminDb");

    await expect(
      serverResolveServiceApproverEmails(["a", "b"], "setup", "mc"),
    ).resolves.toEqual(["one@nyu.edu"]);
  });

  it("falls back to legacy service approvers when no resource assignments exist", async () => {
    collections.set("mc-usersServiceApprovers", [
      {
        id: "1",
        data: { resourceId: "other", service: "setup", email: "one@nyu.edu" },
      },
    ]);
    collections.set("mc-usersRights", [
      { id: "legacy", data: { email: "LEGACY@nyu.edu", isSetup: true } },
    ]);
    const { serverResolveServiceApproverEmails } =
      await import("@/lib/firebase/server/adminDb");

    await expect(
      serverResolveServiceApproverEmails(["a", "b"], "setup", "mc"),
    ).resolves.toEqual(["legacy@nyu.edu"]);
  });

  it("falls back to legacy service approvers when only some requested resources are assigned", async () => {
    collections.set("mc-usersServiceApprovers", [
      {
        id: "1",
        data: {
          resourceId: "a",
          service: "setup",
          email: "assigned@nyu.edu",
        },
      },
    ]);
    collections.set("mc-usersRights", [
      { id: "legacy", data: { email: "LEGACY@nyu.edu", isSetup: true } },
    ]);
    const { serverResolveServiceApproverEmails } =
      await import("@/lib/firebase/server/adminDb");

    await expect(
      serverResolveServiceApproverEmails(["a", "b"], "setup", "mc"),
    ).resolves.toEqual(["legacy@nyu.edu"]);
  });

  it("checks whether a caller is assigned to every resource", async () => {
    collections.set("mc-usersServiceApprovers", [
      {
        id: "1",
        data: { resourceId: "a", service: "setup", email: "one@nyu.edu" },
      },
      {
        id: "2",
        data: { resourceId: "b", service: "setup", email: "one@nyu.edu" },
      },
      {
        id: "3",
        data: {
          resourceId: "a",
          service: "equipment",
          email: "one@nyu.edu",
        },
      },
    ]);
    const { serverIsServiceApproverForAllResources } =
      await import("@/lib/firebase/server/adminDb");

    await expect(
      serverIsServiceApproverForAllResources(
        "ONE@nyu.edu",
        ["a", "b"],
        "setup",
        "mc",
      ),
    ).resolves.toBe(true);
    await expect(
      serverIsServiceApproverForAllResources(
        "ONE@nyu.edu",
        ["a", "b"],
        "equipment",
        "mc",
      ),
    ).resolves.toBe(false);
  });

  it("does not fall back to legacy rights when resource service assignments exist for another approver", async () => {
    collections.set("mc-usersServiceApprovers", [
      {
        id: "1",
        data: {
          resourceId: "a",
          service: "setup",
          email: "assigned@nyu.edu",
        },
      },
    ]);
    collections.set("mc-usersRights", [
      { id: "legacy", data: { email: "legacy@nyu.edu", isSetup: true } },
    ]);
    const { serverIsServiceApproverForAllResources } =
      await import("@/lib/firebase/server/adminDb");

    await expect(
      serverIsServiceApproverForAllResources(
        "legacy@nyu.edu",
        ["a"],
        "setup",
        "mc",
      ),
    ).resolves.toBe(false);
  });

  it("allows legacy service approvers when no resource assignments exist", async () => {
    collections.set("mc-usersRights", [
      { id: "legacy", data: { email: "legacy@nyu.edu", isSetup: true } },
    ]);
    const { serverIsServiceApproverForAllResources } =
      await import("@/lib/firebase/server/adminDb");

    await expect(
      serverIsServiceApproverForAllResources(
        "LEGACY@nyu.edu",
        ["a"],
        "setup",
        "mc",
      ),
    ).resolves.toBe(true);
  });

  it("allows legacy service approvers when only some requested resources are assigned", async () => {
    collections.set("mc-usersServiceApprovers", [
      {
        id: "1",
        data: {
          resourceId: "a",
          service: "setup",
          email: "assigned@nyu.edu",
        },
      },
    ]);
    collections.set("mc-usersRights", [
      { id: "legacy", data: { email: "legacy@nyu.edu", isSetup: true } },
    ]);
    const { serverIsServiceApproverForAllResources } =
      await import("@/lib/firebase/server/adminDb");

    await expect(
      serverIsServiceApproverForAllResources(
        "LEGACY@nyu.edu",
        ["a", "b"],
        "setup",
        "mc",
      ),
    ).resolves.toBe(true);
  });
});
