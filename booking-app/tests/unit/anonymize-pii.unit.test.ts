import { createRequire } from "module";
import { describe, expect, it } from "vitest";

const requireModule = createRequire(import.meta.url);
const {
  ANON_PREFIX,
  CACHE_COLLECTION,
  BACKUP_COLLECTION,
  makeHasher,
  computeBookingUpdate,
  computePreBanUpdate,
  preBanLogDateMillis,
  parseArgs,
  anonymize,
  restore,
} = requireModule("../../scripts/anonymizePII.js") as {
  ANON_PREFIX: string;
  CACHE_COLLECTION: string;
  BACKUP_COLLECTION: string;
  makeHasher: (pepper: string) => (value: unknown) => unknown;
  computeBookingUpdate: (
    data: Record<string, any>,
    hash: (v: unknown) => unknown,
  ) => { patch: Record<string, any>; backup: Record<string, any> } | null;
  computePreBanUpdate: (
    data: Record<string, any>,
    hash: (v: unknown) => unknown,
  ) => { patch: Record<string, any>; backup: Record<string, any> } | null;
  preBanLogDateMillis: (data: Record<string, any>) => number | null;
  parseArgs: (args: string[]) => any;
  anonymize: (db: any, options: any) => Promise<any>;
  restore: (db: any, options: any) => Promise<any>;
};

const ts = (ms: number) => ({ toMillis: () => ms });

describe("scripts/anonymizePII makeHasher", () => {
  const hash = makeHasher("pepper-value-1234567890");

  it("is deterministic and marks output with the ANON prefix", () => {
    const a = hash("abc123");
    expect(a).toBe(hash("abc123"));
    expect(String(a).startsWith(ANON_PREFIX)).toBe(true);
    expect(a).not.toContain("abc123");
  });

  it("is idempotent — already-hashed values pass through", () => {
    const once = hash("netid42") as string;
    expect(hash(once)).toBe(once);
  });

  it("passes through empty and non-string values", () => {
    expect(hash("")).toBe("");
    expect(hash(undefined)).toBe(undefined);
    expect(hash(null)).toBe(null);
    expect(hash(42)).toBe(42);
  });

  it("changes output when the pepper changes", () => {
    const other = makeHasher("a-different-pepper-000000");
    expect(hash("same")).not.toBe(other("same"));
  });
});

describe("scripts/anonymizePII computeBookingUpdate", () => {
  const hash = makeHasher("pepper-value-1234567890");

  it("hashes every present PII field and backs up the originals", () => {
    const data = {
      firstName: "Ada",
      lastName: "Lovelace",
      netId: "al123",
      walkInNetId: "wk456",
      nNumber: "N12345678",
      phoneNumber: "212-555-0100",
      sponsorFirstName: "Grace",
      sponsorLastName: "Hopper",
      title: "not-pii", // untouched
    };
    const result = computeBookingUpdate(data, hash)!;
    expect(result).not.toBeNull();
    expect(result.patch.title).toBeUndefined();
    expect(result.backup.firstName).toBe("Ada");
    expect(result.backup.phoneNumber).toBe("212-555-0100");
    for (const field of Object.keys(result.patch)) {
      expect(String(result.patch[field]).startsWith(ANON_PREFIX)).toBe(true);
    }
    // title must not be in the patch or backup
    expect("title" in result.backup).toBe(false);
  });

  it("skips empty/missing fields and already-anonymized fields", () => {
    const data = {
      firstName: "",
      lastName: `${ANON_PREFIX}deadbeef`,
      netId: "keep-me",
    };
    const result = computeBookingUpdate(data, hash)!;
    expect(Object.keys(result.patch)).toEqual(["netId"]);
  });

  it("returns null when there is nothing to anonymize", () => {
    const data = {
      title: "meeting",
      firstName: `${ANON_PREFIX}x`,
      lastName: "",
    };
    expect(computeBookingUpdate(data, hash)).toBeNull();
  });

  it("also hashes the duplicate PII nested in xstateData.snapshot.context.formData", () => {
    const data = {
      firstName: "Ada",
      xstateData: {
        snapshot: {
          context: {
            formData: {
              firstName: "Ada",
              netId: "al123",
              phoneNumber: "212-555-0100",
              department: "not-pii",
            },
          },
        },
      },
    };
    const result = computeBookingUpdate(data, hash)!;
    const key = "xstateData.snapshot.context.formData";
    expect(result.backup[`${key}.firstName`]).toBe("Ada");
    expect(result.backup[`${key}.netId`]).toBe("al123");
    expect(result.backup[`${key}.phoneNumber`]).toBe("212-555-0100");
    // non-PII nested field is untouched
    expect(`${key}.department` in result.patch).toBe(false);
    for (const field of Object.keys(result.patch)) {
      expect(String(result.patch[field]).startsWith(ANON_PREFIX)).toBe(true);
    }
  });

  it("skips already-hashed nested formData values (idempotent re-run)", () => {
    const data = {
      xstateData: {
        snapshot: {
          context: {
            formData: { netId: `${ANON_PREFIX}deadbeef`, firstName: "" },
          },
        },
      },
    };
    expect(computeBookingUpdate(data, hash)).toBeNull();
  });
});

describe("scripts/anonymizePII computePreBanUpdate", () => {
  const hash = makeHasher("pepper-value-1234567890");

  it("hashes netId only", () => {
    const result = computePreBanUpdate(
      { netId: "al123", bookingId: "b1", excused: false },
      hash,
    )!;
    expect(Object.keys(result.patch)).toEqual(["netId"]);
    expect(result.backup.netId).toBe("al123");
  });
});

describe("scripts/anonymizePII preBanLogDateMillis", () => {
  it("returns the latest of the two dates", () => {
    expect(
      preBanLogDateMillis({ lateCancelDate: ts(100), noShowDate: ts(200) }),
    ).toBe(200);
    expect(preBanLogDateMillis({ noShowDate: ts(50) })).toBe(50);
  });

  it("returns null when no date is present", () => {
    expect(preBanLogDateMillis({ netId: "x" })).toBeNull();
  });
});

describe("scripts/anonymizePII parseArgs", () => {
  it("requires --before", () => {
    expect(() => parseArgs(["--database", "development"])).toThrow(/--before/);
  });

  it("rejects an unknown database", () => {
    expect(() =>
      parseArgs(["--before", "2026-09-01", "--database", "nope"]),
    ).toThrow(/Invalid database/);
  });

  it("rejects an invalid --before date", () => {
    expect(() => parseArgs(["--before", "not-a-date"])).toThrow(
      /Invalid --before/,
    );
  });

  it("refuses to write to production without --confirm-production", () => {
    expect(() =>
      parseArgs(["--before", "2026-09-01", "--database", "production"]),
    ).toThrow(/confirm-production/);
  });

  it("allows a production dry-run without confirmation", () => {
    const opts = parseArgs([
      "--before",
      "2026-09-01",
      "--database",
      "production",
      "--dry-run",
    ]);
    expect(opts.dryRun).toBe(true);
    expect(opts.database).toBe("production");
  });

  it("requires --confirm-production for --backup-only on production (backups are DB writes)", () => {
    expect(() =>
      parseArgs([
        "--before",
        "2026-09-01",
        "--database",
        "production",
        "--backup-only",
      ]),
    ).toThrow(/confirm-production/);
  });

  it("does not require --before in restore mode", () => {
    const opts = parseArgs([
      "--restore",
      "anon-development-2026",
      "--database",
      "development",
    ]);
    expect(opts.restore).toBe("anon-development-2026");
  });

  it("rejects --backup-only combined with --restore", () => {
    expect(() =>
      parseArgs([
        "--restore",
        "anon-production-2026",
        "--backup-only",
        "--database",
        "production",
      ]),
    ).toThrow(/--backup-only cannot be combined with --restore/);
  });

  it("requires --confirm-production to restore to production", () => {
    expect(() =>
      parseArgs([
        "--restore",
        "anon-production-2026",
        "--database",
        "production",
      ]),
    ).toThrow(/confirm-production/);
  });

  it("rejects a non-positive --backup-retention-days", () => {
    expect(() =>
      parseArgs(["--before", "2026-09-01", "--backup-retention-days", "0"]),
    ).toThrow(/backup-retention-days/);
  });
});

describe("scripts/anonymizePII anonymize cache scoping", () => {
  // Minimal Firestore stub: listCollections + collection().where().get() /
  // collection().get() returning the given docs. Dry-run only, so no batch
  // commits or pepper are needed.
  const fakeDb = (collections: Record<string, Record<string, any>>) => {
    const docsOf = (name: string) =>
      Object.entries(collections[name] || {}).map(([id, data]) => ({
        id,
        ref: `${name}/${id}`,
        data: () => data,
      }));
    const snapOf = (name: string) => ({
      size: docsOf(name).length,
      docs: docsOf(name),
    });
    return {
      listCollections: async () =>
        Object.keys(collections).map((id) => ({ id })),
      collection: (name: string) => ({
        where: () => ({ get: async () => snapOf(name) }),
        get: async () => snapOf(name),
      }),
    };
  };

  const collections = {
    "mc-bookings": {},
    "itp-bookings": {},
    nyu_identity_cache: { al123: { university_id: "N1", name: "Ada" } },
  };
  const baseOpts = {
    database: "development",
    before: "2026-09-01",
    dryRun: true,
    cutoff: new Date("2026-09-01"),
  };

  it("clears the shared identity cache on a full (no --tenant) run", async () => {
    const report = await anonymize(fakeDb(collections), { ...baseOpts });
    expect(report.collections[CACHE_COLLECTION].docsDeleted).toBe(1);
    expect(report.totals.docsDeleted).toBe(1);
  });

  it("leaves the shared identity cache untouched on a --tenant run", async () => {
    const report = await anonymize(fakeDb(collections), {
      ...baseOpts,
      tenant: "mc",
    });
    expect(report.totals.docsDeleted).toBe(0);
    expect(report.collections[CACHE_COLLECTION].docsDeleted).toBe(0);
    expect(report.collections[CACHE_COLLECTION].skipped).toBeTruthy();
    // The tenant filter also scopes the booking collections it touches.
    expect(report.collections["itp-bookings"]).toBeUndefined();
  });
});

// Recording stub: captures every write (direct doc set/delete and committed
// batch ops) in order, so tests can assert the backup-before-mutation
// invariant and inspect what was written where.
const makeRecordingDb = (collections: Record<string, Record<string, any>>) => {
  const events: Array<{ type: string; path: string; data?: any }> = [];
  const makeDocRef = (path: string): any => ({
    path,
    set: async (data: any) => {
      events.push({ type: "set", path, data });
    },
    delete: async () => {
      events.push({ type: "delete", path });
    },
    collection: (name: string) => makeCollection(`${path}/${name}`),
  });
  const docsOf = (name: string) =>
    Object.entries(collections[name] || {}).map(([id, data]) => ({
      id,
      ref: makeDocRef(`${name}/${id}`),
      data: () => data,
    }));
  const snapOf = (name: string) => ({
    size: docsOf(name).length,
    docs: docsOf(name),
  });
  const makeCollection = (name: string): any => ({
    id: name,
    doc: (id: string) => makeDocRef(`${name}/${id}`),
    where: () => ({ get: async () => snapOf(name) }),
    get: async () => snapOf(name),
  });
  return {
    events,
    listCollections: async () => Object.keys(collections).map((id) => ({ id })),
    collection: (name: string) => makeCollection(name),
    batch: () => {
      const pending: Array<{ type: string; path: string; data?: any }> = [];
      return {
        update: (ref: any, patch: any) =>
          pending.push({ type: "update", path: ref.path, data: patch }),
        set: (ref: any, data: any) =>
          pending.push({ type: "set", path: ref.path, data }),
        delete: (ref: any) => pending.push({ type: "delete", path: ref.path }),
        commit: async () => {
          events.push(...pending);
          pending.length = 0;
        },
      };
    },
  };
};

describe("scripts/anonymizePII anonymize real run", () => {
  it("writes the Firestore backup fully before mutating any source doc", async () => {
    process.env.ANONYMIZATION_PEPPER = "unit-test-pepper-0123456789";
    const db = makeRecordingDb({
      "mc-bookings": {
        b1: { firstName: "Ada", netId: "al123", endDate: ts(1) },
      },
      nyu_identity_cache: { al123: { university_id: "N1", name: "Ada" } },
    });

    const report = await anonymize(db, {
      database: "development",
      before: "2026-09-01",
      dryRun: false,
      cutoff: new Date("2026-09-01"),
    });

    expect(report.backupId).toMatch(/^anon-development-/);
    expect(report.backupOnly).toBeFalsy();

    const backupWrites = db.events.filter((e) =>
      e.path.startsWith(`${BACKUP_COLLECTION}/`),
    );
    const mutations = db.events.filter(
      (e) => !e.path.startsWith(`${BACKUP_COLLECTION}/`),
    );
    // Run doc + one entry per touched source doc.
    expect(backupWrites.length).toBe(3);
    const entry = backupWrites.find((e) => e.path.includes("mc-bookings__b1"))!;
    expect(JSON.parse(entry.data.fieldsJson)).toEqual({
      firstName: "Ada",
      netId: "al123",
    });
    // Every backup write happens before the first mutation.
    const firstMutation = db.events.indexOf(mutations[0]);
    for (const write of backupWrites) {
      expect(db.events.indexOf(write)).toBeLessThan(firstMutation);
    }
    // The mutations hash the booking and delete the cache doc.
    const bookingUpdate = mutations.find((e) => e.path === "mc-bookings/b1")!;
    expect(bookingUpdate.type).toBe("update");
    expect(String(bookingUpdate.data.firstName).startsWith(ANON_PREFIX)).toBe(
      true,
    );
    expect(mutations).toContainEqual({
      type: "delete",
      path: "nyu_identity_cache/al123",
    });
  });

  it("writes the backup but no mutations in --backup-only mode", async () => {
    const db = makeRecordingDb({
      "mc-bookings": {
        b1: { firstName: "Ada", endDate: ts(1) },
      },
    });

    const report = await anonymize(db, {
      database: "development",
      before: "2026-09-01",
      dryRun: false,
      backupOnly: true,
      cutoff: new Date("2026-09-01"),
    });

    expect(report.backupId).toMatch(/^anon-development-/);
    expect(report.backupOnly).toBe(true);
    expect(
      db.events.every((e) => e.path.startsWith(`${BACKUP_COLLECTION}/`)),
    ).toBe(true);
  });
});

describe("scripts/anonymizePII restore", () => {
  const makeRestoreDb = (
    meta: Record<string, any> | null,
    entries: Array<{ collection: string; docId: string; fields: any }>,
  ) => ({
    collection: (name: string) => ({
      doc: (id: string) => {
        if (name === BACKUP_COLLECTION) {
          return {
            get: async () => ({ exists: meta != null, data: () => meta }),
            collection: () => ({
              get: async () => ({
                docs: entries.map((entry) => ({
                  data: () => ({
                    collection: entry.collection,
                    docId: entry.docId,
                    fieldsJson: JSON.stringify(entry.fields),
                  }),
                })),
              }),
            }),
          };
        }
        return { path: `${name}/${id}` };
      },
    }),
  });

  const entries = [
    {
      collection: "mc-bookings",
      docId: "b1",
      fields: { firstName: "Ada", netId: "al123" },
    },
    { collection: "mc-preBanLogs", docId: "p1", fields: { netId: "al123" } },
    {
      collection: CACHE_COLLECTION,
      docId: "al123",
      fields: { university_id: "N1", name: "Ada" },
    },
  ];

  it("restores bookings/preBanLogs but skips the identity cache", async () => {
    const db = makeRestoreDb({ database: "development" }, entries);
    const report = await restore(db, {
      database: "development",
      restore: "anon-development-x",
      dryRun: true,
    });
    expect(Object.keys(report.collections).sort()).toEqual([
      "mc-bookings",
      "mc-preBanLogs",
    ]);
    expect(report.collections[CACHE_COLLECTION]).toBeUndefined();
    expect(report.skipped[CACHE_COLLECTION]).toEqual({ docs: 1 });
    expect(report.totals.restoredDocs).toBe(2);
    expect(report.totals.restoredFields).toBe(3);
  });

  it("restores only the matching tenant's collections when --tenant is set", async () => {
    const db = makeRestoreDb({ database: "development" }, [
      { collection: "mc-bookings", docId: "b1", fields: { firstName: "Ada" } },
      { collection: "itp-bookings", docId: "b2", fields: { firstName: "Bob" } },
    ]);
    const report = await restore(db, {
      database: "development",
      restore: "anon-development-x",
      tenant: "mc",
      dryRun: true,
    });
    expect(Object.keys(report.collections)).toEqual(["mc-bookings"]);
    expect(report.skipped["itp-bookings"]).toMatchObject({ docs: 1 });
    expect(report.totals.restoredDocs).toBe(1);
  });

  it("throws when the backup id does not exist", async () => {
    const db = makeRestoreDb(null, []);
    await expect(
      restore(db, {
        database: "development",
        restore: "anon-development-missing",
        dryRun: true,
      }),
    ).rejects.toThrow(/not found/);
  });

  it("refuses to restore a backup taken from another database", async () => {
    const db = makeRestoreDb({ database: "staging" }, entries);
    await expect(
      restore(db, {
        database: "production",
        restore: "anon-staging-x",
        dryRun: true,
      }),
    ).rejects.toThrow(/taken from "staging"/);
  });
});
