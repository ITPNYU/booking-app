import { beforeEach, describe, expect, it, vi } from "vitest";

type Doc = { id: string; data: Record<string, unknown> };

const collections = new Map<string, Doc[]>();

const findDoc = (name: string, id: string) =>
  (collections.get(name) ?? []).find((doc) => doc.id === id);

function queryFor(
  name: string,
  filters: Array<{ field: string; op: string; value: unknown }> = [],
) {
  return {
    where(field: string, op: string, value: unknown) {
      return queryFor(name, [...filters, { field, op, value }]);
    },
    limit() {
      return this;
    },
    async get() {
      const docs = (collections.get(name) ?? []).filter(({ data }) =>
        filters.every(({ field, op, value }) =>
          op === "array-contains"
            ? Array.isArray(data[field]) &&
              (data[field] as unknown[]).includes(value)
            : data[field] === value,
        ),
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
          doc: (id: string) => ({ collectionName: name, id }),
        }),
        getAll: async (
          ...refs: Array<{ collectionName: string; id: string }>
        ) =>
          refs.map(({ collectionName, id }) => {
            const doc = findDoc(collectionName, id);
            return { exists: !!doc, data: () => doc?.data };
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

const mockServerGetTenantResources = vi.fn();
vi.mock("@/lib/tenant/serverGetTenantResources", () => ({
  serverGetTenantResources: (...args: unknown[]) =>
    mockServerGetTenantResources(...args),
}));

import {
  serverGetApproversResources,
  serverResolveResourceApproverEmails,
} from "@/lib/firebase/server/adminDb";
import {
  serverListLegacyServiceApproverEmails,
  serverResolveServiceApproverEmails,
} from "@/lib/firebase/server/serviceApprovers";

const setDocs = (name: string, docs: Doc[]) => collections.set(name, docs);

describe("approvers resources server helpers", () => {
  beforeEach(() => {
    collections.clear();
    mockServerGetTenantResources.mockResolvedValue([
      { resourceId: "202", services: { equipment: {}, setup: {} } },
      { resourceId: "1201", services: { equipment: {}, setup: {} } },
      { resourceId: "103", services: { catering: {} } },
    ]);
    setDocs("mc-usersApprovers", [
      { id: "final", data: { email: " Final@NYU.edu ", level: 2 } },
      { id: "equip", data: { email: "equip-user@nyu.edu", level: 3 } },
    ]);
    setDocs("mc-usersApproversResources", [
      {
        id: "202",
        data: {
          resourceId: "202",
          resourceApprovers: ["alice@nyu.edu"],
          serviceApprovers: { equipment: ["carol@nyu.edu"] },
          serviceApproverEmails: ["carol@nyu.edu"],
        },
      },
      {
        id: "1201",
        data: {
          resourceId: "1201",
          resourceApprovers: ["bob@nyu.edu"],
          serviceApprovers: { equipment: ["dan@nyu.edu"] },
          serviceApproverEmails: ["dan@nyu.edu"],
        },
      },
    ]);
    setDocs("mc-usersRights", [
      { id: "u1", data: { email: "legacy-equip@nyu.edu", isEquipment: true } },
      { id: "u2", data: { email: "legacy-setup@nyu.edu", isSetup: true } },
    ]);
  });

  it("reads one doc per resource, with an empty entry for an unconfigured one", async () => {
    const docs = await serverGetApproversResources(["202", " 103 "], "mc");
    expect(docs.get("202")?.resourceApprovers).toEqual(["alice@nyu.edu"]);
    expect(docs.get("103")).toEqual({
      resourceId: "103",
      resourceApprovers: [],
      serviceApprovers: {},
      serviceApproverEmails: [],
    });
  });

  describe("serverResolveResourceApproverEmails", () => {
    it("notifies each booked room's approvers, not only someone assigned to all", async () => {
      await expect(
        serverResolveResourceApproverEmails(["202", "1201"], "mc"),
      ).resolves.toEqual(["alice@nyu.edu", "bob@nyu.edu"]);
    });

    it("adds the tenant final approver for a room with no approvers", async () => {
      await expect(
        serverResolveResourceApproverEmails(["202", "103"], "mc"),
      ).resolves.toEqual(["alice@nyu.edu", "final@nyu.edu"]);
    });
  });

  describe("serverResolveServiceApproverEmails", () => {
    it("uses each booked room's own service approvers", async () => {
      await expect(
        serverResolveServiceApproverEmails(
          "202,1201",
          "equipment",
          "mc",
          "notify",
        ),
      ).resolves.toEqual(["carol@nyu.edu", "dan@nyu.edu"]);
    });

    it("never lets a tenant-wide approver act on a room that has its own", async () => {
      const approvers = await serverResolveServiceApproverEmails(
        "202",
        "equipment",
        "mc",
        "act",
      );
      expect(approvers).toEqual(["carol@nyu.edu"]);
    });

    it("keeps today's tenant-wide approvers for an unconfigured room only", async () => {
      await expect(
        serverResolveServiceApproverEmails("202,1201", "setup", "mc", "notify"),
      ).resolves.toEqual(["legacy-setup@nyu.edu"]);
      await expect(
        serverResolveServiceApproverEmails(
          "202,999",
          "equipment",
          "mc",
          "notify",
        ),
      ).resolves.toEqual(["carol@nyu.edu", "legacy-equip@nyu.edu"]);
    });

    it("lets Equipment Users act, but not be emailed, for an unconfigured room", async () => {
      await expect(
        serverResolveServiceApproverEmails("103", "catering", "mc", "notify"),
      ).resolves.toEqual([]);
      await expect(
        serverResolveServiceApproverEmails("103", "catering", "mc", "act"),
      ).resolves.toEqual(["equip-user@nyu.edu"]);
    });
  });

  it("routes furnishings to setup approvers until a tenant has a furnishings approver", async () => {
    await expect(
      serverListLegacyServiceApproverEmails("furnishings", "mc"),
    ).resolves.toEqual(["legacy-setup@nyu.edu"]);
    setDocs("mc-usersRights", [
      { id: "u2", data: { email: "legacy-setup@nyu.edu", isSetup: true } },
      { id: "u3", data: { email: "furniture@nyu.edu", isFurnishings: true } },
    ]);
    await expect(
      serverListLegacyServiceApproverEmails("furnishings", "mc"),
    ).resolves.toEqual(["furniture@nyu.edu"]);
  });
});
