import { createRequire } from "module";
import { describe, expect, it } from "vitest";

type DocumentData = Record<string, any>;

class MockFirestoreDb {
  private collections = new Map<string, Map<string, DocumentData>>();
  readonly writes: Array<{
    collection: string;
    id: string;
    options: Record<string, any> | undefined;
  }> = [];

  constructor(seed: Record<string, Array<{ id: string; data: DocumentData }>>) {
    for (const [name, documents] of Object.entries(seed)) {
      this.collections.set(
        name,
        new Map(
          documents.map(({ id, data }) => [id, structuredClone(data)]),
        ),
      );
    }
  }

  private getCollection(name: string) {
    if (!this.collections.has(name)) {
      this.collections.set(name, new Map());
    }
    return this.collections.get(name)!;
  }

  collection(name: string) {
    return {
      get: async () => ({
        docs: Array.from(this.getCollection(name), ([id, data]) => ({
          id,
          data: () => structuredClone(data),
        })),
      }),
      doc: (id: string) => ({
        get: async () => {
          const data = this.getCollection(name).get(id);
          return {
            exists: data !== undefined,
            data: () => structuredClone(data),
          };
        },
        set: async (data: DocumentData, options?: Record<string, any>) => {
          this.writes.push({ collection: name, id, options });
          this.getCollection(name).set(id, structuredClone(data));
        },
      }),
    };
  }

  read(name: string, id: string) {
    return structuredClone(this.getCollection(name).get(id));
  }

  readCollection(name: string) {
    return Array.from(this.getCollection(name), ([id, data]) => ({
      id,
      data: structuredClone(data),
    }));
  }
}

const requireModule = createRequire(import.meta.url);
const { migrateTenantSchemaData, migrateTenantResourceIds } = requireModule(
  "../../scripts/migrateTenantResourceIds.js",
) as {
  migrateTenantSchemaData: (
    schema: DocumentData,
    tenantId?: string,
  ) => { schema: DocumentData; changed: boolean };
  migrateTenantResourceIds: (
    db: MockFirestoreDb,
    options?: { dryRun?: boolean; tenant?: string },
  ) => Promise<any>;
};

describe("scripts/migrateTenantResourceIds", () => {
  it("converts legacy numeric/string roomIds, removes roomId, and is idempotent", () => {
    const existing = {
      tenant: "mc",
      resources: [
        { roomId: 101, name: "One" },
        { roomId: "room-two", name: "Two" },
        { resourceId: "canonical", name: "Three" },
        { resourceId: "same", roomId: "same", name: "Four" },
      ],
    };

    const first = migrateTenantSchemaData(existing, "mc");
    expect(first.changed).toBe(true);
    expect(first.schema.resources).toEqual([
      { resourceId: "101", name: "One" },
      { resourceId: "room-two", name: "Two" },
      { resourceId: "canonical", name: "Three" },
      { resourceId: "same", name: "Four" },
    ]);

    const second = migrateTenantSchemaData(first.schema, "mc");
    expect(second).toEqual({ schema: first.schema, changed: false });
  });

  it.each([
    [
      "conflicting IDs",
      [{ resourceId: "new", roomId: "old" }],
      /conflicting resourceId/,
    ],
    ["empty IDs", [{ roomId: " " }], /must be non-empty/],
    ["comma-containing IDs", [{ resourceId: "one,two" }], /must not contain commas/],
    [
      "duplicate canonical IDs",
      [{ roomId: 1 }, { resourceId: "1" }],
      /duplicate resourceId "1"/,
    ],
  ])("rejects %s", (_label, resources, message) => {
    expect(() =>
      migrateTenantSchemaData({ resources }, "mc"),
    ).toThrow(message);
  });

  it("backs up and replacement-writes only changed schemas", async () => {
    const db = new MockFirestoreDb({
      tenantSchema: [
        { id: "mc", data: { resources: [{ roomId: 1, name: "One" }] } },
        { id: "itp", data: { resources: [{ resourceId: "existing" }] } },
      ],
    });

    const result = await migrateTenantResourceIds(db);

    expect(result).toMatchObject({ scanned: 2, changed: 1, unchanged: 1 });
    expect(db.read("tenantSchema", "mc")).toEqual({
      resources: [{ resourceId: "1", name: "One" }],
    });
    expect(db.readCollection("tenantSchemaBackup")).toHaveLength(1);
    expect(db.readCollection("tenantSchemaBackup")[0].data).toEqual({
      resources: [{ roomId: 1, name: "One" }],
    });
    expect(
      db.writes.find(
        (write) => write.collection === "tenantSchema" && write.id === "mc",
      )?.options,
    ).toEqual({ merge: false });
    expect(
      db.writes.some(
        (write) => write.collection === "tenantSchema" && write.id === "itp",
      ),
    ).toBe(false);
  });

  it("performs no writes in dry-run mode or when preflight validation fails", async () => {
    const dryRunDb = new MockFirestoreDb({
      tenantSchema: [{ id: "mc", data: { resources: [{ roomId: 1 }] } }],
    });
    const result = await migrateTenantResourceIds(dryRunDb, { dryRun: true });
    expect(result).toMatchObject({ dryRun: true, changed: 1 });
    expect(dryRunDb.writes).toHaveLength(0);

    const invalidDb = new MockFirestoreDb({
      tenantSchema: [
        { id: "mc", data: { resources: [{ roomId: 1 }] } },
        { id: "itp", data: { resources: [{ roomId: "bad,id" }] } },
      ],
    });
    await expect(migrateTenantResourceIds(invalidDb)).rejects.toThrow(
      /must not contain commas/,
    );
    expect(invalidDb.writes).toHaveLength(0);
  });
});
