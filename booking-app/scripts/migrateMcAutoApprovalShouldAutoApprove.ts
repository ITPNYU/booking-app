/**
 * Migrate MC tenant schema resources:
 * - Move legacy top-level `resource.shouldAutoApprove` into `resource.autoApproval.shouldAutoApprove`
 * - Remove the top-level field
 *
 * Usage:
 *   npx ts-node scripts/migrateMcAutoApprovalShouldAutoApprove.ts [--dry-run] [--database <env>]
 *
 * Examples:
 *   npx ts-node scripts/migrateMcAutoApprovalShouldAutoApprove.ts --dry-run
 *   npx ts-node scripts/migrateMcAutoApprovalShouldAutoApprove.ts --database production
 */

import admin from "firebase-admin";
import dotenv from "dotenv";
import { createRequire } from "module";
import type { SchemaContextType } from "../components/src/client/routes/components/SchemaProvider";

dotenv.config({ path: ".env.local" });

// This repo runs ts-node in ESM mode; use createRequire for CommonJS helpers.
const require = createRequire(import.meta.url);
const { backupTenantSchemaDocument } = require("./tenantSchemaBackup");

const TENANT_SCHEMA_COLLECTION = "tenantSchema";
const TENANT = "mc";
const BACKUP_TYPE = "migrate-mc-autoApproval-shouldAutoApprove";

// Database names for different environments
const DATABASES: Record<string, string> = {
  development: "default",
  staging: "booking-app-staging",
  production: "booking-app-prod",
};

interface Options {
  dryRun: boolean;
  database: string;
}

function parseArgs(): Options {
  const args = process.argv.slice(2);
  const options: Options = { dryRun: false, database: "development" };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--dry-run":
        options.dryRun = true;
        break;
      case "--database":
        options.database = args[++i] || "development";
        break;
      case "--help":
        console.log(`
Usage: npx ts-node scripts/migrateMcAutoApprovalShouldAutoApprove.ts [options]

Options:
  --dry-run              Preview changes without writing to database
  --database <env>       Database environment: development, staging, production (default: development)
  --help                 Show this help message
        `);
        process.exit(0);
        break;
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

function migrateSchema(schema: SchemaContextType): {
  updated: SchemaContextType;
  changedCount: number;
} {
  const resources = Array.isArray((schema as any).resources)
    ? ((schema as any).resources as any[])
    : [];

  let changedCount = 0;

  const updatedResources = resources.map((r) => {
    if (!r || typeof r !== "object") return r;
    if (!Object.prototype.hasOwnProperty.call(r, "shouldAutoApprove")) return r;

    const shouldAutoApprove = (r as any).shouldAutoApprove;
    const existingAutoApproval =
      r.autoApproval && typeof r.autoApproval === "object" ? r.autoApproval : {};

    const next = { ...r };
    delete (next as any).shouldAutoApprove;
    next.autoApproval = {
      ...existingAutoApproval,
      shouldAutoApprove,
    };

    changedCount++;
    return next;
  });

  return {
    updated: { ...(schema as any), resources: updatedResources } as SchemaContextType,
    changedCount,
  };
}

/**
 * Firestore rejects values that aren't plain objects. This makes the output
 * JSON-safe by stripping `undefined` and normalizing prototypes.
 * Tenant schema documents should not contain special Firestore types.
 */
function toPlainJsonObject<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

async function main() {
  const options = parseArgs();
  const databaseId = DATABASES[options.database] ?? DATABASES.development;

  console.log(
    `🔧 Migrating tenant schema '${TENANT}' (db env=${options.database}, databaseId=${databaseId})`,
  );

  const db = initializeDb(databaseId);
  const docRef = db.collection(TENANT_SCHEMA_COLLECTION).doc(TENANT);

  const snap = await docRef.get();
  if (!snap.exists) {
    console.error(`❌ No tenant schema found for '${TENANT}'. Nothing to do.`);
    process.exit(1);
  }

  const schema = snap.data() as SchemaContextType;
  const { updated, changedCount } = migrateSchema(schema);

  console.log(`✅ Resources updated: ${changedCount}`);
  if (changedCount === 0) {
    console.log("ℹ️ No legacy shouldAutoApprove fields found. Exiting.");
    return;
  }

  if (options.dryRun) {
    console.log("🔍 [DRY RUN] Not writing changes.");
    return;
  }

  // Safety first: backup current schema before writing
  await backupTenantSchemaDocument(db, TENANT, schema, BACKUP_TYPE);

  // Write the full document back so the legacy top-level field is removed.
  await docRef.set(toPlainJsonObject(updated));
  console.log("🎉 Migration complete.");
}

main().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});

