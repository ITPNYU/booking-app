import { describe, expect, it } from "vitest";
import { createRequire } from "module";

type SnapshotDoc = { id: string; data: () => Record<string, any> };

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
    const getSnapshotDocs = (): SnapshotDoc[] => {
      const collection = this.getCollection(name);
      return Array.from(collection.entries()).map(([id, data]) => ({
        id,
        data: () => structuredClone(data),
      }));
    };

    return {
      get: async () => {
        const docs = getSnapshotDocs();
        return {
          docs,
          size: docs.length,
          empty: docs.length === 0,
        };
      },
      limit: (_value: number) => ({
        get: async () => ({
          docs: [],
          size: 0,
          empty: true,
        }),
      }),
      doc: (id: string) => ({
        collectionName: name,
        id,
      }),
    };
  }

  batch() {
    const operations: Array<{ collectionName: string; id: string; data: Record<string, any> }> = [];
    return {
      set: (
        docRef: { collectionName: string; id: string },
        data: Record<string, any>,
      ) => {
        operations.push({
          collectionName: docRef.collectionName,
          id: docRef.id,
          data: structuredClone(data),
        });
      },
      commit: async () => {
        operations.forEach((operation) => {
          const collection = this.getCollection(operation.collectionName);
          collection.set(operation.id, structuredClone(operation.data));
        });
      },
    };
  }

  readCollection(name: string): Array<{ id: string; data: Record<string, any> }> {
    return Array.from(this.getCollection(name).entries()).map(([id, data]) => ({
      id,
      data: structuredClone(data),
    }));
  }
}

const requireModule = createRequire(import.meta.url);
const { copyCollection, backupTenantSchemaAsDocuments, createBackupDocId } =
  requireModule(
  "../../scripts/copyCollection.js",
) as {
  copyCollection: (
    sourceDb: MockFirestoreDb,
    targetDb: MockFirestoreDb,
    sourceCollection: string,
    targetCollection: string,
    databaseName: string,
    dryRun?: boolean,
  ) => Promise<any>;
  backupTenantSchemaAsDocuments: (
    targetDb: MockFirestoreDb,
    databaseName: string,
    dryRun?: boolean,
  ) => Promise<any>;
  createBackupDocId: (tenantId: string, backupType: string) => string;
};

describe("scripts/copyCollection", () => {
  it("returns detailed key diffs in dry-run mode", async () => {
    const sourceDb = new MockFirestoreDb({
      tenantSchema: [
        {
          id: "mc",
          data: { a: 1, b: 2, c: { x: 1 }, arr: [1] },
        },
        {
          id: "itp",
          data: { z: 1 },
        },
      ],
    });

    const targetDb = new MockFirestoreDb({
      tenantSchema: [
        {
          id: "mc",
          data: { a: 1, b: 3, c: { y: 2 }, old: true, arr: [2] },
        },
      ],
    });

    const result = await copyCollection(
      sourceDb,
      targetDb,
      "tenantSchema",
      "tenantSchema",
      "booking-app-staging",
      true,
    );

    expect(result.success).toBe(true);
    expect(result.summary).toMatchObject({
      sourceDocuments: 2,
      targetDocuments: 1,
      changedDocuments: 2,
      unchangedDocuments: 0,
      addedKeys: 2,
      deletedKeys: 2,
      updatedKeys: 2,
    });

    const mcResult = result.documents.find((doc: any) => doc.id === "mc");
    expect(mcResult.changeType).toBe("update");
    expect(mcResult.diff.addedKeys).toContain("c.x");
    expect(mcResult.diff.deletedKeys).toEqual(
      expect.arrayContaining(["c.y", "old"]),
    );
    expect(mcResult.diff.updatedKeys).toEqual(
      expect.arrayContaining(["b", "arr"]),
    );

    const itpResult = result.documents.find((doc: any) => doc.id === "itp");
    expect(itpResult.changeType).toBe("create");
    expect(itpResult.diff.addedKeys).toEqual(["z"]);
  });

  it("copies documents in non-dry-run mode", async () => {
    const sourceDb = new MockFirestoreDb({
      tenantSchema: [
        { id: "mc", data: { version: 1 } },
        { id: "itp", data: { version: 2 } },
      ],
    });
    const targetDb = new MockFirestoreDb({
      tenantSchema: [],
    });

    const result = await copyCollection(
      sourceDb,
      targetDb,
      "tenantSchema",
      "tenantSchema",
      "booking-app-staging",
      false,
    );

    expect(result).toMatchObject({
      success: true,
      copied: 2,
      errors: [],
    });

    const copiedDocs = targetDb.readCollection("tenantSchema");
    expect(copiedDocs).toHaveLength(2);
    expect(copiedDocs.find((doc) => doc.id === "mc")?.data).toEqual({
      version: 1,
    });
  });

  it("backs up tenantSchema documents into tenantSchemaBackup collection", async () => {
    const targetDb = new MockFirestoreDb({
      tenantSchema: [
        { id: "mc", data: { version: 1 } },
        { id: "itp", data: { version: 2 } },
      ],
    });

    const result = await backupTenantSchemaAsDocuments(
      targetDb,
      "booking-app-staging",
      false,
    );

    expect(result).toMatchObject({
      success: true,
      copied: 2,
      errors: [],
    });

    const tenantDocs = targetDb.readCollection("tenantSchema");
    expect(tenantDocs).toHaveLength(2);
    expect(
      tenantDocs.some((doc) => doc.id.includes("-backup-copy-")),
    ).toBe(false);

    const backupDocs = targetDb.readCollection("tenantSchemaBackup");
    expect(backupDocs).toHaveLength(2);
    expect(
      backupDocs.find((doc) => doc.id.startsWith("mc-backup-copy-"))?.data,
    ).toEqual({ version: 1 });
    expect(
      backupDocs.find((doc) => doc.id.startsWith("itp-backup-copy-"))?.data,
    ).toEqual({ version: 2 });
  });

  it("generates backup document ids with tenant and type", () => {
    const backupDocId = createBackupDocId("mc", "copy");
    expect(backupDocId).toMatch(/^mc-backup-copy-\d{4}-\d{2}-\d{2}_.+$/);
  });
});
