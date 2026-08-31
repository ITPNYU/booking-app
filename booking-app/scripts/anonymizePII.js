//@ts-nocheck
/**
 * Anonymize personally identifiable information (PII) in the Firestore
 * databases via an irreversible keyed hash (issue #1218).
 *
 * PII fields (from the ticket): name, netId, n-number (university id), phone.
 * Email is intentionally OUT OF SCOPE (it is a document key / join key across
 * the users* collections and needs a separate design).
 *
 * What it touches:
 *   - `${tenant}-bookings`   name/netId/nNumber/phone fields, only for bookings
 *                            whose `endDate` is before the --before cutoff
 *                            (concluded bookings — active/future are never touched).
 *                            XState tenants also duplicate this PII inside
 *                            xstateData.snapshot.context.formData on the same
 *                            doc, so those nested copies are hashed as well.
 *   - `${tenant}-preBanLogs` `netId`, only for logs whose latest date
 *                            (lateCancelDate/noShowDate) is before the cutoff
 *   - `nyu_identity_cache`   shared, doc id IS a netId and the doc holds
 *                            name + university_id; it is a 7-day TTL cache, so
 *                            it is backed up and DELETED (regenerates on demand).
 *                            It is NOT tenant-scoped, so a --tenant run leaves
 *                            it untouched (run without --tenant to clear it).
 *
 * Safety:
 *   - Always backs up every original value BEFORE mutating. The backup lives
 *     in Firestore itself (`piiAnonymizationBackups`, same database as the
 *     data), so raw PII never leaves the access-controlled database — no
 *     local files, no CI artifacts. Backups carry an `expiresAt` and are
 *     pruned automatically on the next real run (default 30 days).
 *   - --dry-run reports the change set and writes no backup and no changes.
 *   - Hashing is idempotent (already-hashed `ANON:` values are skipped), so
 *     re-running is safe.
 *   - Writing to production (including the backup docs) requires
 *     --confirm-production.
 *
 * Usage:
 *   node scripts/anonymizePII.js --before 2026-09-01 --database development --dry-run
 *   node scripts/anonymizePII.js --before 2026-09-01 --database staging
 *   node scripts/anonymizePII.js --before 2026-09-01 --database production --confirm-production
 *   node scripts/anonymizePII.js --restore <backup-id> --database staging
 */
require("dotenv").config({ path: ".env.local" });
const admin = require("firebase-admin");
const crypto = require("crypto");
const fs = require("fs");

const DATABASES = {
  development: "default",
  staging: "booking-app-staging",
  production: "booking-app-prod",
};

const CACHE_COLLECTION = "nyu_identity_cache";
// Backups of the original values live in Firestore, in the same database as
// the data being anonymized: one run doc + an `entries` subcollection with one
// doc per backed-up source doc. Raw PII therefore never leaves the
// access-controlled database. Runs expire via `expiresAt` and are pruned by
// the next real run.
const BACKUP_COLLECTION = "piiAnonymizationBackups";
const BACKUP_RETENTION_DAYS_DEFAULT = 30;
const BATCH_SIZE = 450;
const ANON_PREFIX = "ANON:";

// Fields to hash on a booking document.
const BOOKING_PII_FIELDS = [
  "firstName",
  "lastName",
  "secondaryFirstName",
  "secondaryLastName",
  "secondaryName", // legacy combined name
  "sponsorFirstName",
  "sponsorLastName",
  "netId",
  "walkInNetId",
  "nNumber",
  "phoneNumber",
];

const PREBAN_PII_FIELDS = ["netId"];

/**
 * Irreversible keyed hash. Same input + same pepper => same output (so
 * aggregate counts / joins survive), but the input cannot be recovered without
 * the pepper. Non-string / empty values pass through unchanged, and values that
 * are already hashed are left as-is (idempotent re-runs).
 */
const makeHasher = (pepper) => (value) => {
  if (typeof value !== "string" || value.length === 0) return value;
  if (value.startsWith(ANON_PREFIX)) return value;
  const digest = crypto
    .createHmac("sha256", pepper)
    .update(value)
    .digest("hex");
  return `${ANON_PREFIX}${digest}`;
};

/**
 * Compute the hashed field patch for one booking doc. Returns { patch, backup }
 * where `patch` contains only the fields that actually change and `backup`
 * holds their original values. Returns null when nothing changes.
 */
// XState tenants (e.g. Media Commons) persist a full booking snapshot on the
// same doc, and its context.formData duplicates the top-level PII as plain
// strings. Hash those too via a Firestore dotted field path, or a plaintext
// copy of every subject's PII survives anonymization inside the doc.
const XSTATE_FORMDATA_PATH = "xstateData.snapshot.context.formData";

const computeBookingUpdate = (data, hash) => {
  const patch = {};
  const backup = {};
  const hashField = (original, key) => {
    if (typeof original !== "string" || original.length === 0) return;
    if (original.startsWith(ANON_PREFIX)) return;
    patch[key] = hash(original);
    backup[key] = original;
  };
  for (const field of BOOKING_PII_FIELDS) {
    hashField(data[field], field);
  }
  const formData = data.xstateData?.snapshot?.context?.formData;
  if (formData && typeof formData === "object") {
    for (const field of BOOKING_PII_FIELDS) {
      hashField(formData[field], `${XSTATE_FORMDATA_PATH}.${field}`);
    }
  }
  return Object.keys(patch).length > 0 ? { patch, backup } : null;
};

const computePreBanUpdate = (data, hash) => {
  const patch = {};
  const backup = {};
  for (const field of PREBAN_PII_FIELDS) {
    const original = data[field];
    if (typeof original !== "string" || original.length === 0) continue;
    if (original.startsWith(ANON_PREFIX)) continue;
    patch[field] = hash(original);
    backup[field] = original;
  }
  return Object.keys(patch).length > 0 ? { patch, backup } : null;
};

const toMillis = (ts) =>
  ts && typeof ts.toMillis === "function" ? ts.toMillis() : null;

/** Latest relevant date on a preBanLog, or null if none present. */
const preBanLogDateMillis = (data) => {
  const dates = [
    toMillis(data.lateCancelDate),
    toMillis(data.noShowDate),
  ].filter((n) => n !== null);
  return dates.length > 0 ? Math.max(...dates) : null;
};

const parseArgs = (args = process.argv.slice(2)) => {
  const options = {
    dryRun: false,
    database: "development",
    skipCache: false,
    confirmProduction: false,
    backupOnly: false,
  };
  for (let index = 0; index < args.length; index++) {
    switch (args[index]) {
      case "--dry-run":
        options.dryRun = true;
        break;
      case "--database":
        options.database = args[++index];
        break;
      case "--before":
        options.before = args[++index];
        break;
      case "--tenant":
        options.tenant = args[++index];
        break;
      case "--backup-retention-days":
        options.backupRetentionDays = Number(args[++index]);
        break;
      case "--report-file":
        options.reportFile = args[++index];
        break;
      case "--skip-cache":
        options.skipCache = true;
        break;
      case "--confirm-production":
        options.confirmProduction = true;
        break;
      case "--backup-only":
        options.backupOnly = true;
        break;
      case "--restore":
        options.restore = args[++index];
        break;
      case "--help":
        options.help = true;
        break;
      default:
        throw new Error(`Unknown argument: ${args[index]}`);
    }
  }
  if (options.help) return options;

  if (!DATABASES[options.database]) {
    throw new Error(
      `Invalid database "${options.database}". Expected one of: ${Object.keys(
        DATABASES,
      ).join(", ")}`,
    );
  }

  // --backup-only is an anonymize-mode flag (write the backup, change
  // nothing else). Combined with --restore it is meaningless; reject it so it
  // cannot be mistaken for a "preview restore" (that's --dry-run).
  if (options.restore && options.backupOnly) {
    throw new Error("--backup-only cannot be combined with --restore");
  }

  if (
    options.backupRetentionDays !== undefined &&
    (!Number.isInteger(options.backupRetentionDays) ||
      options.backupRetentionDays < 1)
  ) {
    throw new Error("--backup-retention-days must be a positive integer");
  }

  // Restore mode reads a Firestore backup and writes originals back; it needs
  // no cutoff. Anonymize / backup-only mode needs the cutoff.
  if (!options.restore) {
    if (!options.before) {
      throw new Error(
        "--before <YYYY-MM-DD> is required (the academic-year cutoff)",
      );
    }
    const cutoff = new Date(options.before);
    if (Number.isNaN(cutoff.getTime())) {
      throw new Error(`Invalid --before date: "${options.before}"`);
    }
    options.cutoff = cutoff;
  }

  // Production writes need explicit confirmation. Backups are written INTO
  // Firestore, so even --backup-only writes to the database — only --dry-run
  // is exempt.
  const willWrite = !options.dryRun;
  if (
    options.database === "production" &&
    willWrite &&
    !options.confirmProduction
  ) {
    throw new Error(
      "Refusing to write to production without --confirm-production",
    );
  }
  return options;
};

const initializeDb = (databaseId) => {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      }),
    });
  }
  const db = admin.firestore();
  if (databaseId !== "default") {
    db.settings({ databaseId });
  }
  return db;
};

/** Discover the tenant-prefixed collections that hold PII. */
const discoverCollections = async (db, tenantFilter) => {
  const all = await db.listCollections();
  const bookings = [];
  const preBanLogs = [];
  for (const ref of all) {
    const name = ref.id;
    if (/-bookings$/.test(name)) bookings.push(name);
    else if (/-preBanLogs$/.test(name)) preBanLogs.push(name);
  }
  const matchesTenant = (name) =>
    !tenantFilter || name.startsWith(`${tenantFilter}-`);
  return {
    bookings: bookings.filter(matchesTenant),
    preBanLogs: preBanLogs.filter(matchesTenant),
  };
};

/**
 * Commit a set of writes in ≤500-op batches. `ops` is an array of
 * { ref, patch } for updates, { ref, set } for creates/overwrites, or
 * { ref, delete: true } for deletes.
 */
const commitInBatches = async (db, ops) => {
  for (let i = 0; i < ops.length; i += BATCH_SIZE) {
    const slice = ops.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    for (const op of slice) {
      if (op.delete) batch.delete(op.ref);
      else if (op.set) batch.set(op.ref, op.set);
      else batch.update(op.ref, op.patch);
    }
    await batch.commit();
  }
};

/**
 * Persist the backup into Firestore BEFORE any mutation: a run doc in
 * `piiAnonymizationBackups` plus one `entries` subcollection doc per source
 * doc. Field paths may contain dots (nested xstate fields), so the original
 * values are stored as a JSON string rather than as Firestore fields.
 * Returns the backup id.
 */
const writeBackupToFirestore = async (db, backup, options) => {
  const createdAt = new Date();
  const backupId = `anon-${options.database}-${createdAt
    .toISOString()
    .replace(/[:.]/g, "-")}`;
  const runRef = db.collection(BACKUP_COLLECTION).doc(backupId);
  const retentionDays =
    options.backupRetentionDays ?? BACKUP_RETENTION_DAYS_DEFAULT;
  const entryOps = [];
  for (const [collection, docs] of Object.entries(backup.collections)) {
    for (const [docId, fields] of Object.entries(docs)) {
      entryOps.push({
        ref: runRef.collection("entries").doc(`${collection}__${docId}`),
        set: {
          collection,
          docId,
          fieldsJson: JSON.stringify(fields),
        },
      });
    }
  }
  await runRef.set({
    database: options.database,
    before: options.before ?? null,
    tenant: options.tenant ?? null,
    createdAt: admin.firestore.Timestamp.fromDate(createdAt),
    expiresAt: admin.firestore.Timestamp.fromDate(
      new Date(createdAt.getTime() + retentionDays * 24 * 60 * 60 * 1000),
    ),
    entryCount: entryOps.length,
  });
  await commitInBatches(db, entryOps);
  return backupId;
};

/** Delete backup runs whose `expiresAt` has passed (entries first, then the run doc). */
const pruneExpiredBackups = async (db) => {
  const expired = await db
    .collection(BACKUP_COLLECTION)
    .where("expiresAt", "<", admin.firestore.Timestamp.now())
    .get();
  for (const runDoc of expired.docs) {
    const entries = await runDoc.ref.collection("entries").get();
    await commitInBatches(
      db,
      entries.docs.map((doc) => ({ ref: doc.ref, delete: true })),
    );
    await runDoc.ref.delete();
  }
  if (expired.size > 0) {
    console.log(`Pruned ${expired.size} expired backup run(s).`);
  }
};

const anonymize = async (db, options) => {
  const hash =
    options.dryRun || options.backupOnly ? (v) => v : makeHasher(getPepper());
  const cutoffTs = admin.firestore.Timestamp.fromDate(options.cutoff);
  const backup = {
    database: options.database,
    before: options.before,
    collections: {},
  };
  const report = {
    database: options.database,
    before: options.before,
    dryRun: options.dryRun,
    backupOnly: !!options.backupOnly,
    backupId: null,
    collections: {},
    totals: { docsChanged: 0, fieldsHashed: 0, docsDeleted: 0 },
  };
  const ops = [];

  // Real runs (and backup-only runs) also clean up expired backup runs, so
  // retention does not depend on anyone remembering to delete them.
  if (!options.dryRun) {
    await pruneExpiredBackups(db);
  }

  const { bookings, preBanLogs } = await discoverCollections(
    db,
    options.tenant,
  );

  // --- bookings: concluded only (endDate < cutoff) ---
  for (const name of bookings) {
    const snap = await db
      .collection(name)
      .where("endDate", "<", cutoffTs)
      .get();
    let docsChanged = 0;
    let fieldsHashed = 0;
    const colBackup = {};
    for (const doc of snap.docs) {
      const result = computeBookingUpdate(doc.data(), hash);
      if (!result) continue;
      docsChanged += 1;
      fieldsHashed += Object.keys(result.patch).length;
      colBackup[doc.id] = result.backup;
      if (!options.dryRun) ops.push({ ref: doc.ref, patch: result.patch });
    }
    report.collections[name] = {
      scanned: snap.size,
      docsChanged,
      fieldsHashed,
    };
    report.totals.docsChanged += docsChanged;
    report.totals.fieldsHashed += fieldsHashed;
    if (Object.keys(colBackup).length > 0) backup.collections[name] = colBackup;
  }

  // --- preBanLogs: netId, latest date < cutoff ---
  for (const name of preBanLogs) {
    const snap = await db.collection(name).get();
    let scanned = 0;
    let docsChanged = 0;
    let fieldsHashed = 0;
    const colBackup = {};
    for (const doc of snap.docs) {
      const data = doc.data();
      const dateMs = preBanLogDateMillis(data);
      if (dateMs === null || dateMs >= options.cutoff.getTime()) continue;
      scanned += 1;
      const result = computePreBanUpdate(data, hash);
      if (!result) continue;
      docsChanged += 1;
      fieldsHashed += Object.keys(result.patch).length;
      colBackup[doc.id] = result.backup;
      if (!options.dryRun) ops.push({ ref: doc.ref, patch: result.patch });
    }
    report.collections[name] = { scanned, docsChanged, fieldsHashed };
    report.totals.docsChanged += docsChanged;
    report.totals.fieldsHashed += fieldsHashed;
    if (Object.keys(colBackup).length > 0) backup.collections[name] = colBackup;
  }

  // --- nyu_identity_cache: doc id is a netId; back up + delete (regenerable) ---
  // The cache is a SHARED collection: its doc ids are bare netIds, not
  // tenant-prefixed, so it cannot be scoped to one tenant. --tenant exists to
  // limit blast radius, so a tenant-scoped run must NOT wipe every tenant's
  // cache entries — skip the cache pass whenever a tenant filter is set.
  if (options.skipCache) {
    // Cache pass explicitly disabled; nothing to do.
  } else if (options.tenant) {
    console.log(
      `Skipping ${CACHE_COLLECTION}: it is a shared, non-tenant-scoped cache ` +
        `and --tenant ${options.tenant} was given. Run without --tenant to clear it.`,
    );
    report.collections[CACHE_COLLECTION] = {
      scanned: 0,
      docsDeleted: 0,
      skipped: "not cleared on a --tenant run (shared cache)",
    };
  } else {
    const snap = await db.collection(CACHE_COLLECTION).get();
    const colBackup = {};
    for (const doc of snap.docs) {
      colBackup[doc.id] = doc.data();
      if (!options.dryRun) ops.push({ ref: doc.ref, delete: true });
    }
    report.collections[CACHE_COLLECTION] = {
      scanned: snap.size,
      docsDeleted: snap.size,
    };
    report.totals.docsDeleted += snap.size;
    if (Object.keys(colBackup).length > 0)
      backup.collections[CACHE_COLLECTION] = colBackup;
  }

  // Write the backup fully BEFORE mutating anything.
  if (!options.dryRun && ops.length > 0) {
    const backupId = await writeBackupToFirestore(db, backup, options);
    report.backupId = backupId;
    console.log(
      `Backup written: ${BACKUP_COLLECTION}/${backupId} ` +
        `(expires after ${options.backupRetentionDays ?? BACKUP_RETENTION_DAYS_DEFAULT} days; ` +
        `restore with --restore ${backupId})`,
    );
    if (!options.backupOnly) await commitInBatches(db, ops);
  }

  if (options.reportFile) {
    fs.writeFileSync(options.reportFile, JSON.stringify(report, null, 2));
  }
  return report;
};

/**
 * Restore original values from a Firestore backup produced by an earlier run
 * (`--restore <backup-id>`). bookings / preBanLogs are patched back
 * field-by-field.
 *
 * nyu_identity_cache is intentionally NOT restored: it is a regenerable 7-day
 * TTL cache that self-populates on the next lookup, and its Timestamp fields
 * do not survive the JSON round-trip. It is still captured in the backup for
 * reference.
 */
const restore = async (db, options) => {
  const runRef = db.collection(BACKUP_COLLECTION).doc(options.restore);
  const runSnap = await runRef.get();
  if (!runSnap.exists) {
    throw new Error(
      `Backup "${options.restore}" not found in ${BACKUP_COLLECTION} ` +
        `(database ${options.database}). Note: backups expire and are pruned automatically.`,
    );
  }
  // Backups live in the same database they were taken from, so a mismatch
  // here means the run doc was written by a different-environment run with
  // the same id — refuse rather than patch the wrong docs.
  const meta = runSnap.data() || {};
  if (meta.database && meta.database !== options.database) {
    throw new Error(
      `Backup "${options.restore}" was taken from "${meta.database}", ` +
        `refusing to restore into "${options.database}"`,
    );
  }

  const report = {
    database: options.database,
    from: options.restore,
    dryRun: options.dryRun,
    collections: {},
    skipped: {},
    totals: { restoredDocs: 0, restoredFields: 0 },
  };
  const ops = [];
  const entriesSnap = await runRef.collection("entries").get();
  for (const entryDoc of entriesSnap.docs) {
    const entry = entryDoc.data();
    const name = entry.collection;
    const bump = (bucket, extra) => {
      bucket[name] = bucket[name] || { docs: 0, ...extra };
      bucket[name].docs += 1;
    };
    if (name === CACHE_COLLECTION) {
      bump(report.skipped, {});
      continue;
    }
    // --tenant is a hard scope boundary everywhere else in this script, so
    // honor it here too: restoring from a full backup with --tenant mc must
    // write back only mc-* collections, not every tenant's PII in the backup.
    if (options.tenant && !name.startsWith(`${options.tenant}-`)) {
      bump(report.skipped, { reason: `outside --tenant ${options.tenant}` });
      continue;
    }
    const data = JSON.parse(entry.fieldsJson);
    const ref = db.collection(name).doc(entry.docId);
    // Patch the original PII fields back onto the existing doc.
    if (!options.dryRun) ops.push({ ref, patch: data });
    report.collections[name] = report.collections[name] || {
      restoredDocs: 0,
      restoredFields: 0,
    };
    report.collections[name].restoredDocs += 1;
    report.collections[name].restoredFields += Object.keys(data).length;
    report.totals.restoredDocs += 1;
    report.totals.restoredFields += Object.keys(data).length;
  }
  if (!options.dryRun && ops.length > 0) {
    await commitInBatches(db, ops);
  }
  if (options.reportFile) {
    fs.writeFileSync(options.reportFile, JSON.stringify(report, null, 2));
  }
  return report;
};

const getPepper = () => {
  const pepper = process.env.ANONYMIZATION_PEPPER;
  if (!pepper || pepper.length < 16) {
    throw new Error(
      "ANONYMIZATION_PEPPER env var is required (>=16 chars) for hashing",
    );
  }
  return pepper;
};

const main = async () => {
  const options = parseArgs();
  if (options.help) {
    console.log(`Usage: node scripts/anonymizePII.js [options]

Anonymize PII (name/netId/nNumber/phone) in concluded bookings, preBanLogs,
and the NYU identity cache. Originals are always backed up first, into the
Firestore collection "${BACKUP_COLLECTION}" in the same database (never to a
local file or CI artifact); backups expire and are pruned automatically.

Options:
  --before <YYYY-MM-DD>    Academic-year cutoff; only records before this are
                           anonymized (required unless --restore)
  --database <env>         development (default), staging, or production
  --tenant <tenant>        Limit to one tenant prefix (e.g. mc, itp); the
                           shared identity cache is left untouched on a
                           tenant-scoped run
  --dry-run                Report the change set; write nothing, no backup
  --backup-only            Write the Firestore backup of the eligible records
                           but change nothing (no hashing, no deletes, no pepper)
  --restore <backup-id>    Restore original values from a Firestore backup run
                           (bookings and preBanLogs only; the regenerable
                           identity cache is not restored). Supports --dry-run.
  --backup-retention-days <n>
                           How long the backup run is kept before the next
                           real run prunes it (default ${BACKUP_RETENTION_DAYS_DEFAULT})
  --report-file <path>     Write a JSON summary report (counts only, no PII)
  --skip-cache             Do not touch nyu_identity_cache
  --confirm-production     Required to write when --database production
                           (backups count as writes; only --dry-run is exempt)
  --help                   Show this help

Env: ANONYMIZATION_PEPPER (>=16 chars, real runs only), FIREBASE_* (.env.local)`);
    return;
  }

  const db = initializeDb(DATABASES[options.database]);

  if (options.restore) {
    const report = await restore(db, options);
    console.log(
      `${options.dryRun ? "[DRY RUN] " : ""}restore ${options.database} from ${options.restore}: ` +
        `${report.totals.restoredDocs} docs, ${report.totals.restoredFields} fields ` +
        `${options.dryRun ? "would be restored" : "restored"}.`,
    );
    for (const [name, stats] of Object.entries(report.collections)) {
      console.log(`  ${name}: ${JSON.stringify(stats)}`);
    }
    return;
  }

  const report = await anonymize(db, options);
  const willChange = options.dryRun || options.backupOnly;
  const prefix = options.dryRun
    ? "[DRY RUN] "
    : options.backupOnly
      ? "[BACKUP ONLY] "
      : "";
  console.log(
    `${prefix}${options.database} (before ${options.before}): ` +
      `${report.totals.docsChanged} docs ${willChange ? "would change" : "changed"}, ` +
      `${report.totals.fieldsHashed} fields ${willChange ? "would be hashed" : "hashed"}, ` +
      `${report.totals.docsDeleted} cache docs ${willChange ? "would be deleted" : "deleted"}.`,
  );
  for (const [name, stats] of Object.entries(report.collections)) {
    console.log(`  ${name}: ${JSON.stringify(stats)}`);
  }
};

if (require.main === module) {
  main()
    .catch((error) => {
      console.error(`Anonymization failed: ${error.message}`);
      process.exitCode = 1;
    })
    .finally(async () => {
      for (const app of admin.apps) {
        if (app) await app.delete();
      }
    });
}

module.exports = {
  DATABASES,
  ANON_PREFIX,
  CACHE_COLLECTION,
  BACKUP_COLLECTION,
  BACKUP_RETENTION_DAYS_DEFAULT,
  BOOKING_PII_FIELDS,
  PREBAN_PII_FIELDS,
  makeHasher,
  computeBookingUpdate,
  computePreBanUpdate,
  preBanLogDateMillis,
  parseArgs,
  anonymize,
  restore,
  pruneExpiredBackups,
};
