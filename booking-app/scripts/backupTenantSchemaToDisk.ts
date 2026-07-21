/**
 * Back up Firestore `tenantSchema` to `tenantSchemaBackup` (same as sync/copy).
 *
 * Default: writes via tenantSchemaBackup.js (Firestore).
 * With --dry-run: writes JSON under scripts/output/ only (no Firestore writes).
 *
 * Documentation: docs/TENANT_SCHEMA_BACKUP.md
 */

require("dotenv").config({ path: ".env.local" });
import * as admin from "firebase-admin";
import * as fs from "fs";
import * as path from "path";

const {
  TENANT_SCHEMA_COLLECTION,
  TENANT_SCHEMA_BACKUP_COLLECTION,
  formatBackupTimestamp,
  createBackupDocId,
  backupTenantSchemaDocument,
  backupTenantSchemaCollection,
} = require("./tenantSchemaBackup");

/** Backup type in document ids; distinct from sync-defaults / copy. */
const BACKUP_TYPE_CLI = "cli-backup";

const DATABASES = {
  development: "default",
  staging: "booking-app-staging",
  production: "booking-app-prod",
} as const;

type DatabaseEnv = keyof typeof DATABASES;

interface BackupOptions {
  database: DatabaseEnv;
  tenant?: string;
  outputDir?: string;
  dryRun: boolean;
}

function serializeValue(val: unknown): unknown {
  if (val === null || val === undefined) {
    return val;
  }
  if (typeof val === "bigint") {
    return val.toString();
  }
  if (val instanceof admin.firestore.Timestamp) {
    return {
      __firestoreTimestamp: true,
      iso: val.toDate().toISOString(),
    };
  }
  if (val instanceof admin.firestore.GeoPoint) {
    return {
      __firestoreGeoPoint: true,
      latitude: val.latitude,
      longitude: val.longitude,
    };
  }
  if (val instanceof admin.firestore.DocumentReference) {
    return { __firestoreDocumentReference: true, path: val.path };
  }
  if (Array.isArray(val)) {
    return val.map(serializeValue);
  }
  if (typeof val === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      out[k] = serializeValue(v);
    }
    return out;
  }
  return val;
}

function parseArgs(): BackupOptions {
  const args = process.argv.slice(2);
  const options: BackupOptions = {
    database: "development",
    dryRun: false,
  };

  for (let i = 0; i < args.length; i += 1) {
    switch (args[i]) {
      case "--dry-run":
        options.dryRun = true;
        break;
      case "--tenant":
        options.tenant = args[++i];
        break;
      case "--database":
        options.database = (args[++i] || "development") as DatabaseEnv;
        break;
      case "--output-dir":
        options.outputDir = args[++i];
        break;
      case "--help":
        console.log(`
Back up tenantSchema → tenantSchemaBackup (Firestore), or preview to disk.

Usage:
  npm run backup:tenant-schema -- [options]

Options:
  --database <env>   development | staging | production (default: development)
  --tenant <id>      Back up only this document id (default: all documents)
  --dry-run          Do not write Firestore; export JSON under scripts/output/…
  --output-dir <dir> With --dry-run only: output folder (default: scripts/output/tenant-schema-backup/<timestamp>)
  --help             Show this message

Examples:
  npm run backup:tenant-schema
  npm run backup:tenant-schema -- --dry-run
  npm run backup:tenant-schema -- --database staging --tenant mc
`);
        process.exit(0);
        break;
      default:
        break;
    }
  }

  if (!DATABASES[options.database]) {
    console.error(
      `Invalid --database "${options.database}". Use: ${Object.keys(DATABASES).join(", ")}`
    );
    process.exit(1);
  }

  return options;
}

function initializeDb(databaseName: string): admin.firestore.Firestore {
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

function defaultOutputRoot(runStamp: string): string {
  return path.join(__dirname, "output", "tenant-schema-backup", runStamp);
}

async function backupToFirestore(
  db: admin.firestore.Firestore,
  col: admin.firestore.CollectionReference,
  options: BackupOptions
): Promise<void> {
  if (options.tenant) {
    const doc = await col.doc(options.tenant).get();
    if (!doc.exists) {
      console.error(`No document "${options.tenant}" in ${TENANT_SCHEMA_COLLECTION}`);
      process.exit(1);
    }
    const data = doc.data();
    if (!data) {
      console.error(`Document "${options.tenant}" has no data`);
      process.exit(1);
    }
    const { backupDocId, backupCollection } = await backupTenantSchemaDocument(
      db,
      options.tenant,
      data,
      BACKUP_TYPE_CLI
    );
    console.log(`Backed up ${options.tenant} → ${backupCollection}/${backupDocId}`);
    return;
  }

  const result = await backupTenantSchemaCollection(
    db,
    options.database,
    BACKUP_TYPE_CLI,
    false
  );
  if (!result.success) {
    process.exit(1);
  }
}

async function backupToDiskDryRun(
  db: admin.firestore.Firestore,
  col: admin.firestore.CollectionReference,
  options: BackupOptions,
  firestoreDbId: string
): Promise<void> {
  let docs: admin.firestore.DocumentSnapshot[];
  if (options.tenant) {
    const doc = await col.doc(options.tenant).get();
    if (!doc.exists) {
      console.error(`No document "${options.tenant}" in ${TENANT_SCHEMA_COLLECTION}`);
      process.exit(1);
    }
    docs = [doc];
  } else {
    const snapshot = await col.get();
    if (snapshot.empty) {
      console.log(`No documents in ${TENANT_SCHEMA_COLLECTION} (${options.database})`);
      process.exit(0);
    }
    docs = snapshot.docs;
  }

  const runStamp = formatBackupTimestamp();
  const outDir = options.outputDir
    ? path.resolve(process.cwd(), options.outputDir)
    : defaultOutputRoot(runStamp);

  console.log(
    `[dry-run] Environment: ${options.database} (Firestore databaseId: ${firestoreDbId === "default" ? "(default)" : firestoreDbId})`
  );
  console.log(`[dry-run] Would NOT write to ${TENANT_SCHEMA_BACKUP_COLLECTION}; writing local files under:`);
  console.log(`  ${outDir}`);
  console.log(`[dry-run] Documents: ${docs.length}`);

  const manifest = {
    mode: "dry-run-local-export" as const,
    exportedAt: new Date().toISOString(),
    environment: options.database,
    firestoreDatabaseId: firestoreDbId,
    collection: TENANT_SCHEMA_COLLECTION,
    backupType: BACKUP_TYPE_CLI,
    backupTimestamp: runStamp,
    documents: [] as { tenantId: string; backupDocId: string; file: string }[],
  };

  fs.mkdirSync(outDir, { recursive: true });

  for (const doc of docs) {
    const backupDocId = createBackupDocId(doc.id, BACKUP_TYPE_CLI, runStamp);
    const fileName = `${backupDocId}.json`;
    manifest.documents.push({
      tenantId: doc.id,
      backupDocId,
      file: fileName,
    });
    const payload = serializeValue(doc.data());
    const filePath = path.join(outDir, fileName);
    fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    console.log(`  wrote ${filePath}`);
  }

  fs.writeFileSync(
    path.join(outDir, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8"
  );
  console.log(`  manifest: ${path.join(outDir, "manifest.json")}`);
}

async function main() {
  const options = parseArgs();
  const firestoreDbId = DATABASES[options.database];
  const db = initializeDb(firestoreDbId);
  const col = db.collection(TENANT_SCHEMA_COLLECTION);

  console.log(
    `Environment: ${options.database} (Firestore databaseId: ${firestoreDbId === "default" ? "(default)" : firestoreDbId})`
  );

  if (!options.dryRun && options.outputDir) {
    console.log("Note: --output-dir is ignored unless --dry-run is set.");
  }

  if (options.dryRun) {
    await backupToDiskDryRun(db, col, options, firestoreDbId);
  } else {
    console.log(`Writing backups to Firestore collection: ${TENANT_SCHEMA_BACKUP_COLLECTION}`);
    await backupToFirestore(db, col, options);
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
