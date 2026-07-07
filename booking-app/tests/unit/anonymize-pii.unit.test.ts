import { createRequire } from "module";
import { describe, expect, it } from "vitest";

import fs from "fs";
import os from "os";
import path from "path";

const requireModule = createRequire(import.meta.url);
const {
  ANON_PREFIX,
  CACHE_COLLECTION,
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
    const data = { title: "meeting", firstName: `${ANON_PREFIX}x`, lastName: "" };
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
    expect(preBanLogDateMillis({ lateCancelDate: ts(100), noShowDate: ts(200) })).toBe(200);
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
    expect(() => parseArgs(["--before", "2026-09-01", "--database", "nope"])).toThrow(
      /Invalid database/,
    );
  });

  it("rejects an invalid --before date", () => {
    expect(() => parseArgs(["--before", "not-a-date"])).toThrow(/Invalid --before/);
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

  it("allows --backup-only on production without confirmation (no DB writes)", () => {
    const opts = parseArgs([
      "--before",
      "2026-09-01",
      "--database",
      "production",
      "--backup-only",
    ]);
    expect(opts.backupOnly).toBe(true);
  });

  it("does not require --before in restore mode", () => {
    const opts = parseArgs(["--restore", "backup.json", "--database", "development"]);
    expect(opts.restore).toBe("backup.json");
  });

  it("requires --confirm-production to restore to production", () => {
    expect(() =>
      parseArgs(["--restore", "backup.json", "--database", "production"]),
    ).toThrow(/confirm-production/);
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

describe("scripts/anonymizePII restore", () => {
  const stubDb = {
    collection: (name: string) => ({ doc: (id: string) => ({ ref: `${name}/${id}` }) }),
  };

  it("restores bookings/preBanLogs but skips the identity cache", async () => {
    const backup = {
      database: "development",
      collections: {
        "mc-bookings": { b1: { firstName: "Ada", netId: "al123" } },
        "mc-preBanLogs": { p1: { netId: "al123" } },
        nyu_identity_cache: {
          al123: { data: {}, cachedAt: { _seconds: 1 }, expiresAt: { _seconds: 2 } },
        },
      },
    };
    const file = path.join(os.tmpdir(), `anon-restore-test-${process.pid}.json`);
    fs.writeFileSync(file, JSON.stringify(backup));
    try {
      const report = await restore(stubDb, {
        database: "development",
        restore: file,
        dryRun: true,
      });
      expect(Object.keys(report.collections).sort()).toEqual([
        "mc-bookings",
        "mc-preBanLogs",
      ]);
      expect(report.collections.nyu_identity_cache).toBeUndefined();
      expect(report.skipped.nyu_identity_cache).toEqual({ docs: 1 });
      expect(report.totals.restoredDocs).toBe(2);
      expect(report.totals.restoredFields).toBe(3);
    } finally {
      fs.unlinkSync(file);
    }
  });

  it("restores only the matching tenant's collections when --tenant is set", async () => {
    const backup = {
      database: "development",
      collections: {
        "mc-bookings": { b1: { firstName: "Ada" } },
        "itp-bookings": { b2: { firstName: "Bob" } },
      },
    };
    const file = path.join(os.tmpdir(), `anon-restore-tenant-${process.pid}.json`);
    fs.writeFileSync(file, JSON.stringify(backup));
    try {
      const report = await restore(stubDb, {
        database: "development",
        restore: file,
        tenant: "mc",
        dryRun: true,
      });
      expect(Object.keys(report.collections)).toEqual(["mc-bookings"]);
      expect(report.skipped["itp-bookings"]).toMatchObject({ docs: 1 });
      expect(report.totals.restoredDocs).toBe(1);
    } finally {
      fs.unlinkSync(file);
    }
  });
});
