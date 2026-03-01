import { beforeEach, describe, expect, it, vi } from "vitest";
import { mergeSchemaDefaults } from "../../scripts/schemaDefaults";
import { syncTenantSchema } from "../../scripts/syncTenantSchemas";

vi.mock("../../scripts/schemaDefaults", () => ({
  mergeSchemaDefaults: vi.fn(),
}));

class MockFirestoreDb {
  private collections = new Map<string, Map<string, Record<string, any>>>();

  constructor(seed: Record<string, Array<{ id: string; data: Record<string, any> }>>) {
    Object.entries(seed).forEach(([collectionName, docs]) => {
      const collection = new Map<string, Record<string, any>>();
      docs.forEach((doc) => collection.set(doc.id, structuredClone(doc.data)));
      this.collections.set(collectionName, collection);
    });
  }

  private getCollection(name: string): Map<string, Record<string, any>> {
    if (!this.collections.has(name)) {
      this.collections.set(name, new Map());
    }
    return this.collections.get(name)!;
  }

  collection(name: string) {
    return {
      doc: (id: string) => ({
        get: async () => {
          const data = this.getCollection(name).get(id);
          return {
            exists: data !== undefined,
            data: () => structuredClone(data),
          };
        },
        set: async (data: Record<string, any>) => {
          this.getCollection(name).set(id, structuredClone(data));
        },
      }),
    };
  }

  readCollection(name: string): Array<{ id: string; data: Record<string, any> }> {
    return Array.from(this.getCollection(name).entries()).map(([id, data]) => ({
      id,
      data: structuredClone(data),
    }));
  }
}

describe("scripts/syncTenantSchemas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("backs up existing schema as backup document before applying updates", async () => {
    const db = new MockFirestoreDb({
      tenantSchema: [
        {
          id: "mc",
          data: {
            tenant: "mc",
            settings: { oldValue: true },
          },
        },
      ],
    });

    vi
      .mocked(mergeSchemaDefaults)
      .mockReturnValue({
        tenant: "mc",
        settings: { oldValue: true, newValue: "added" },
      } as any);

    const result = await syncTenantSchema(db as any, "mc", {
      dryRun: false,
      database: "development",
    });

    expect(result.success).toBe(true);
    expect(result.changes.added).toContain("settings.newValue");

    const docs = db.readCollection("tenantSchema");
    const currentDoc = docs.find((doc) => doc.id === "mc");
    expect(currentDoc?.data).toEqual({
      tenant: "mc",
      settings: { oldValue: true, newValue: "added" },
    });

    const backupDoc = docs.find((doc) =>
      /^mc-backup-sync-defaults-\d{4}-\d{2}-\d{2}_.+$/.test(doc.id),
    );
    expect(backupDoc).toBeDefined();
    expect(backupDoc?.data).toEqual({
      tenant: "mc",
      settings: { oldValue: true },
    });
  });

  it("does not write backup/update documents in dry-run mode", async () => {
    const db = new MockFirestoreDb({
      tenantSchema: [
        {
          id: "itp",
          data: {
            tenant: "itp",
            settings: { version: 1 },
          },
        },
      ],
    });

    // Keep schema unchanged to avoid saveSchemaToFile side effects in this unit test.
    vi
      .mocked(mergeSchemaDefaults)
      .mockReturnValue({
        tenant: "itp",
        settings: { version: 1 },
      } as any);

    const result = await syncTenantSchema(db as any, "itp", {
      dryRun: true,
      database: "development",
    });

    expect(result.success).toBe(true);
    expect(result.changes).toEqual({ added: [], modified: [], removed: [] });

    const docs = db.readCollection("tenantSchema");
    expect(docs).toHaveLength(1);
    expect(docs[0]).toEqual({
      id: "itp",
      data: {
        tenant: "itp",
        settings: { version: 1 },
      },
    });
    expect(docs.some((doc) => doc.id.includes("-backup-sync-defaults-"))).toBe(
      false,
    );
  });
});
