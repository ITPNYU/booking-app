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

  it("uses tenant collection, normalized email, service, and deterministic IDs", async () => {
    setMock.mockResolvedValue(undefined);
    deleteMock.mockResolvedValue(undefined);
    const { serverAddServiceApprover, serverRemoveServiceApprover } =
      await import("@/lib/firebase/server/adminDb");

    await serverAddServiceApprover(" equipment ", " Person@NYU.EDU ", "mc");
    await serverRemoveServiceApprover(
      "equipment",
      "person@nyu.edu",
      "mc",
    );

    expect(setMock).toHaveBeenCalledWith(
      "mc-usersServiceApprovers",
      deleteMock.mock.calls[0][1],
      {
        email: "person@nyu.edu",
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

  it("resolves approvers assigned to the requested service", async () => {
    collections.set("mc-usersServiceApprovers", [
      { id: "1", data: { service: "setup", email: "one@nyu.edu" } },
      { id: "2", data: { service: "setup", email: "ONE@nyu.edu" } },
      { id: "3", data: { service: "setup", email: "two@nyu.edu" } },
      { id: "4", data: { service: "equipment", email: "other@nyu.edu" } },
    ]);
    const { serverResolveServiceApproverEmails } =
      await import("@/lib/firebase/server/adminDb");

    await expect(
      serverResolveServiceApproverEmails("setup", "mc"),
    ).resolves.toEqual(["one@nyu.edu", "two@nyu.edu"]);
  });

  it("returns empty when no approvers are assigned to the service", async () => {
    collections.set("mc-usersServiceApprovers", [
      { id: "1", data: { service: "equipment", email: "one@nyu.edu" } },
    ]);
    const { serverResolveServiceApproverEmails } =
      await import("@/lib/firebase/server/adminDb");

    await expect(
      serverResolveServiceApproverEmails("setup", "mc"),
    ).resolves.toEqual([]);
  });

  it("checks whether a caller is assigned to the service", async () => {
    collections.set("mc-usersServiceApprovers", [
      { id: "1", data: { service: "setup", email: "one@nyu.edu" } },
      { id: "2", data: { service: "equipment", email: "two@nyu.edu" } },
    ]);
    const { serverIsServiceApprover } =
      await import("@/lib/firebase/server/adminDb");

    await expect(
      serverIsServiceApprover(
        "ONE@nyu.edu",
        "setup",
        "mc",
      ),
    ).resolves.toBe(true);
    await expect(
      serverIsServiceApprover(
        "ONE@nyu.edu",
        "equipment",
        "mc",
      ),
    ).resolves.toBe(false);
  });
});
