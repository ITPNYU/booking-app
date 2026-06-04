/**
 * Migrate Firestore tenantSchema documents to the canonical nested shape.
 *
 * Uses the same coercion rules as runtime (lib/tenant/coerceTenantSchema.ts):
 * flat legacy fields become tenant, mappings, form, origins, emailNotifications, etc.
 *
 * Writes the full document with merge: false so legacy top-level keys are removed.
 * By default only documents that need migration are touched; use --force-all to
 * rewrite every document through coercion (for example after tweaking coerce logic).
 */

require("dotenv").config({ path: ".env.local" });
import * as admin from "firebase-admin";
import * as fs from "fs";
import * as path from "path";
import {
  coerceTenantSchema,
  tenantSchemaFirestoreDocNeedsShapeMigration,
} from "../lib/tenant/coerceTenantSchema";

const { backupTenantSchemaDocument } = require("./tenantSchemaBackup");

const TENANT_SCHEMA_COLLECTION = "tenantSchema";
const BACKUP_TYPE = "shape-migration";

const DATABASES = {
  development: "default",
  staging: "booking-app-staging",
  production: "booking-app-prod",
} as const;

type DatabaseEnv = keyof typeof DATABASES;

interface MigrateOptions {
  dryRun: boolean;
  tenant?: string;
  database: DatabaseEnv;
  /** Rewrite every document even if it already looks nested and has no stale keys */
  forceAll: boolean;
  /** Do not write to tenantSchemaBackup before replacing (not recommended) */
  skipBackup: boolean;
}

function serializeForFirestore<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function sortKeysDeep(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  const o = value as Record<string, unknown>;
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(o).sort()) {
    sorted[key] = sortKeysDeep(o[key]);
  }
  return sorted;
}

function stableStringify(obj: unknown): string {
  return JSON.stringify(sortKeysDeep(obj));
}

function parseArgs(): MigrateOptions {
  const args = process.argv.slice(2);
  const options: MigrateOptions = {
    dryRun: false,
    database: "development",
    forceAll: false,
    skipBackup: false,
  };

  // Consume the value following a flag, failing fast if it is missing or is
  // actually another flag (e.g. `--tenant --database staging`).
  const takeValue = (flag: string, i: number): string => {
    const value = args[i + 1];
    if (value === undefined || value.startsWith("--")) {
      console.error(`Missing value for ${flag}`);
      process.exit(1);
    }
    return value;
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--dry-run":
        options.dryRun = true;
        break;
      case "--tenant":
        options.tenant = takeValue("--tenant", i);
        i++;
        break;
      case "--database":
        options.database = takeValue("--database", i) as DatabaseEnv;
        i++;
        break;
      case "--force-all":
        options.forceAll = true;
        break;
      case "--skip-backup":
        options.skipBackup = true;
        break;
      case "--help":
        console.log(`
Usage: npm run migrate:tenant-schema -- [options]
   (or: npx ts-node -r tsconfig-paths/register ... scripts/migrateTenantSchemaFirestore.ts)

Rewrites tenantSchema/{tenantId} to the nested canonical shape (coerceTenantSchema).
Backs up the previous document to tenantSchemaBackup unless --dry-run or --skip-backup.

Options:
  --dry-run              Preview only; writes JSON under scripts/output/
  --tenant <id>          Migrate a single document id (default: all docs in collection)
  --database <env>       development | staging | production (default: development)
  --force-all            Rewrite every document even if no stale legacy keys remain
  --skip-backup          Do not copy current doc to tenantSchemaBackup before replace
  --help                 Show this message

Examples:
  npm run migrate:tenant-schema:dry-run
  npm run migrate:tenant-schema -- --tenant mc --database staging
  npm run migrate:tenant-schema -- --database production --force-all
`);
        process.exit(0);
        break;
      default:
        console.error(`Unknown argument: ${args[i]}`);
        process.exit(1);
    }
  }

  return options;
}

function initializeDb(databaseName: string) {
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
  if (databaseName !== "default") {
    db.settings({ databaseId: databaseName });
  }
  return db;
}

function saveMigratedPreview(
  tenantId: string,
  database: string,
  payload: Record<string, unknown>,
): void {
  const outputDir = path.join(__dirname, "output");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  const filepath = path.join(
    outputDir,
    `migrate-tenant-schema-${tenantId}-${database}.json`,
  );
  fs.writeFileSync(filepath, JSON.stringify(payload, null, 2), "utf-8");
  console.log(`  💾 Wrote preview: ${filepath}`);
}

async function migrateOne(
  db: admin.firestore.Firestore,
  tenantId: string,
  raw: Record<string, unknown>,
  options: MigrateOptions,
): Promise<"skipped" | "would" | "written"> {
  const eligible =
    options.forceAll || tenantSchemaFirestoreDocNeedsShapeMigration(raw);
  if (!eligible) {
    console.log(`  ⏭️  Skip ${tenantId}: already canonical nested shape`);
    return "skipped";
  }

  const migrated = coerceTenantSchema(raw, tenantId);
  const payload = serializeForFirestore(migrated) as Record<string, unknown>;
  const unchanged = stableStringify(raw) === stableStringify(payload);

  if (unchanged) {
    console.log(
      `  ⏭️  Skip ${tenantId}: coerced JSON matches stored data (nothing to rewrite)`,
    );
    return "skipped";
  }

  if (options.dryRun) {
    console.log(
      `  🔍 [DRY RUN] Would replace ${tenantId} with coerced nested schema`,
    );
    saveMigratedPreview(tenantId, options.database, payload);
    return "would";
  }

  if (!options.skipBackup) {
    const { backupDocId, backupCollection } = await backupTenantSchemaDocument(
      db,
      tenantId,
      raw,
      BACKUP_TYPE,
    );
    console.log(`  📦 Backup ${backupCollection}/${backupDocId}`);
  }

  await db
    .collection(TENANT_SCHEMA_COLLECTION)
    .doc(tenantId)
    .set(payload, { merge: false });
  console.log(`  ✅ Replaced ${tenantId} (merge: false)`);
  return "written";
}

async function main() {
  const options = parseArgs();

  if (!DATABASES[options.database]) {
    console.error(`Invalid --database: ${options.database}`);
    console.error(`Valid: ${Object.keys(DATABASES).join(", ")}`);
    process.exit(1);
  }

  const dbName = DATABASES[options.database];
  const db = initializeDb(dbName);

  console.log("🚀 Tenant schema shape migration");
  console.log({
    dryRun: options.dryRun,
    database: options.database,
    firestoreDatabaseId: dbName,
    tenant: options.tenant ?? "(all documents in tenantSchema)",
    forceAll: options.forceAll,
    skipBackup: options.skipBackup,
  });

  let docEntries: { id: string; raw: Record<string, unknown> }[];
  if (options.tenant) {
    const snap = await db
      .collection(TENANT_SCHEMA_COLLECTION)
      .doc(options.tenant)
      .get();
    if (!snap.exists) {
      console.error(`No document tenantSchema/${options.tenant}`);
      process.exit(1);
    }
    docEntries = [
      { id: snap.id, raw: snap.data() as Record<string, unknown> },
    ];
  } else {
    const snap = await db.collection(TENANT_SCHEMA_COLLECTION).get();
    docEntries = snap.docs.map((d) => ({
      id: d.id,
      raw: d.data() as Record<string, unknown>,
    }));
  }

  const counts = { skipped: 0, would: 0, written: 0 };

  for (const { id, raw } of docEntries) {
    console.log(`\n📄 ${id}`);
    const result = await migrateOne(db, id, raw, options);
    counts[result]++;
  }

  console.log("\n📊 Summary:", counts);
  if (options.dryRun) {
    console.log("\n💡 Run without --dry-run to apply (after reviewing scripts/output/).");
  }
}

if (require.main === module) {
  main()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      for (const app of admin.apps) {
        if (app) await app.delete();
      }
    });
}
