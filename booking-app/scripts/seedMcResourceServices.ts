/**
 * Seed Media Commons resource service configs into a tenant schema.
 *
 * Firestore `tenantSchema/mc.resources[].services` is the runtime source of
 * truth for the MC booking form. This script writes the snapshot in
 * `components/src/testHelpers/mcResourceServicesFixture.ts` into one
 * environment's schema once, replacing each configured room's `services`
 * object. Rooms without an entry in the snapshot (annex spaces, new rooms)
 * are left untouched. After seeding, edit service text in the super admin
 * schema editor; do not re-run this script unless you mean to overwrite
 * editor changes.
 *
 * Usage:
 *   npm run seed:mc-services:dry-run -- --database development
 *   npm run seed:mc-services -- --database staging
 *
 * Options:
 *   --database <env>   development | staging | production (default: development)
 *   --dry-run          Print the per-room diff without writing
 *   --only <ids>       Comma-separated resourceIds to seed (default: all configured rooms)
 *   --help
 */

require("dotenv").config({ path: ".env.local" });
import * as admin from "firebase-admin";
import { MC_TEST_RESOURCE_SERVICES } from "../components/src/testHelpers/mcResourceServicesFixture";
const { backupTenantSchemaDocument } = require("./tenantSchemaBackup");

const TENANT = "mc";
const TENANT_SCHEMA_COLLECTION = "tenantSchema";
const BACKUP_TYPE = "seed-mc-services";

const DATABASES: Record<string, string> = {
  development: "default",
  staging: "booking-app-staging",
  production: "booking-app-prod",
};

interface SeedOptions {
  dryRun: boolean;
  database: string;
  only?: Set<string>;
}

function parseArgs(): SeedOptions {
  const args = process.argv.slice(2);
  const options: SeedOptions = { dryRun: false, database: "development" };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--dry-run":
        options.dryRun = true;
        break;
      case "--database":
        options.database = args[++i] || "development";
        break;
      case "--only":
        options.only = new Set(
          (args[++i] || "")
            .split(",")
            .map((id) => id.trim())
            .filter(Boolean),
        );
        break;
      case "--help":
        console.log(`
Usage: npx ts-node scripts/seedMcResourceServices.ts [options]

Options:
  --database <env>   development | staging | production (default: development)
  --dry-run          Print the per-room diff without writing
  --only <ids>       Comma-separated resourceIds to seed (default: all configured rooms)
  --help             Show this help message
        `);
        process.exit(0);
    }
  }

  if (!DATABASES[options.database]) {
    console.error(
      `❌ Unknown database "${options.database}". Use development, staging, or production.`,
    );
    process.exit(1);
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

/** Stable JSON (sorted keys) so equal configs compare equal regardless of key order. */
function stableJson(value: unknown): string {
  return JSON.stringify(value, (_key, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((k) => [k, (v as Record<string, unknown>)[k]]),
        )
      : v,
  );
}

function resourceIdOf(resource: Record<string, unknown>): string {
  return String(resource.resourceId ?? resource.roomId ?? "").trim();
}

function describeDiff(before: unknown, after: unknown): string {
  const b = (
    before && typeof before === "object" && !Array.isArray(before) ? before : {}
  ) as Record<string, unknown>;
  const a = after as Record<string, unknown>;
  const keys = Array.from(
    new Set([...Object.keys(b), ...Object.keys(a)]),
  ).sort();
  const parts: string[] = [];
  for (const key of keys) {
    if (!(key in b)) parts.push(`+${key}`);
    else if (!(key in a)) parts.push(`-${key}`);
    else if (stableJson(b[key]) !== stableJson(a[key])) parts.push(`~${key}`);
  }
  if (Array.isArray(before)) parts.unshift("(legacy string[] replaced)");
  return parts.join(" ");
}

async function main() {
  const options = parseArgs();
  const databaseName = DATABASES[options.database];
  console.log(
    `${options.dryRun ? "🔍 [DRY RUN] " : ""}Seeding MC resource services into ${options.database} (${databaseName})`,
  );

  const db = initializeDb(databaseName);
  const docRef = db.collection(TENANT_SCHEMA_COLLECTION).doc(TENANT);
  const snapshot = await docRef.get();
  if (!snapshot.exists) {
    console.error(
      `❌ ${TENANT_SCHEMA_COLLECTION}/${TENANT} does not exist in ${databaseName}`,
    );
    process.exit(1);
  }
  const existing = snapshot.data() as Record<string, unknown>;
  const resources = Array.isArray(existing.resources)
    ? (existing.resources as Record<string, unknown>[])
    : [];
  if (resources.length === 0) {
    console.error(
      `❌ ${TENANT_SCHEMA_COLLECTION}/${TENANT} has no resources[]`,
    );
    process.exit(1);
  }

  const seen = new Set<string>();
  let changed = 0;
  const nextResources = resources.map((resource) => {
    const id = resourceIdOf(resource);
    const config = MC_TEST_RESOURCE_SERVICES[id];
    if (!config || (options.only && !options.only.has(id))) {
      if (config) seen.add(id);
      console.log(
        `  ⏭  ${id || "(no id)"}: ${config ? "skipped (--only)" : "no snapshot entry, left as is"}`,
      );
      return resource;
    }
    seen.add(id);
    const next = JSON.parse(JSON.stringify(config));
    if (stableJson(resource.services) === stableJson(next)) {
      console.log(`  =  ${id}: unchanged`);
      return resource;
    }
    changed += 1;
    console.log(`  ✏️  ${id}: ${describeDiff(resource.services, next)}`);
    return { ...resource, services: next };
  });

  const missing = Object.keys(MC_TEST_RESOURCE_SERVICES).filter(
    (id) => !seen.has(id) && (!options.only || options.only.has(id)),
  );
  if (missing.length > 0) {
    console.log(
      `  ⚠️  Snapshot rooms not present in the schema: ${missing.join(", ")}`,
    );
  }

  if (changed === 0) {
    console.log("✅ Nothing to write; schema already matches the snapshot.");
    return;
  }
  if (options.dryRun) {
    console.log(
      `🔍 [DRY RUN] Would update ${changed} room(s). No changes written.`,
    );
    return;
  }

  const { backupDocId, backupCollection } = await backupTenantSchemaDocument(
    db,
    TENANT,
    existing,
    BACKUP_TYPE,
  );
  console.log(
    `  📦 Backed up existing schema to ${backupCollection}/${backupDocId}`,
  );

  await docRef.update({ resources: nextResources });
  console.log(`✅ Updated services for ${changed} room(s) in ${databaseName}.`);
}

main().catch((error) => {
  console.error("❌ Seed failed:", error);
  process.exit(1);
});
