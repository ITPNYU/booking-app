/**
 * Write the Media Commons policy modal and email copy onto tenantSchema/mc.
 *
 * Updates policy (#1418), the Requested email sent to the requestor (#1267),
 * the Approved email check-in paragraph (#1439), and the No Show email
 * opening (#1439). Other email notification fields are left as they are.
 * Re-running after a successful update is a no-op.
 *
 * Usage:
 *   npm run update:mc-booking-language:dry-run -- --database development
 *   npm run update:mc-booking-language -- --database staging
 *
 * Options:
 *   --database <env>   development | staging | production (default: development)
 *   --dry-run          Print the fields that would change without writing
 *   --help
 */

require("dotenv").config({ path: ".env.local" });
import * as admin from "firebase-admin";
import { applyMcBookingLanguage } from "../lib/tenant/mcBookingLanguage";
const { backupTenantSchemaDocument } = require("./tenantSchemaBackup");

const TENANT = "mc";
const TENANT_SCHEMA_COLLECTION = "tenantSchema";
const BACKUP_TYPE = "mc-booking-language";

const DATABASES: Record<string, string> = {
  development: "default",
  staging: "booking-app-staging",
  production: "booking-app-prod",
};

interface UpdateOptions {
  dryRun: boolean;
  database: string;
}

function parseArgs(): UpdateOptions {
  const args = process.argv.slice(2);
  const options: UpdateOptions = { dryRun: false, database: "development" };

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
Usage: npx ts-node scripts/updateMcBookingLanguage.ts [options]

Options:
  --database <env>   development | staging | production (default: development)
  --dry-run          Print the fields that would change without writing
  --help             Show this help message
        `);
        process.exit(0);
      default:
        console.error(`❌ Unknown argument "${args[i]}"`);
        process.exit(1);
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

async function main() {
  const options = parseArgs();
  const databaseName = DATABASES[options.database];
  console.log(
    `${options.dryRun ? "🔍 [DRY RUN] " : ""}Updating Media Commons booking language in ${options.database} (${databaseName})`,
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
  const emails =
    existing.emailNotifications &&
    typeof existing.emailNotifications === "object"
      ? (existing.emailNotifications as Record<string, string>)
      : null;
  const result = applyMcBookingLanguage({
    policy: typeof existing.policy === "string" ? existing.policy : "",
    emailNotifications: emails,
  });

  if (result.errors.length > 0) {
    console.error("❌ Refusing to write. The stored copy does not match:");
    for (const error of result.errors) console.error(`  - ${error}`);
    process.exit(1);
  }
  if (result.changes.length === 0) {
    console.log("✅ Nothing to write; schema already has this copy.");
    return;
  }

  console.log(`Fields to update: ${result.changes.join(", ")}`);
  if (options.dryRun) {
    console.log("🔍 [DRY RUN] No changes written.");
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

  await docRef.update({
    policy: result.policy,
    emailNotifications: result.emailNotifications,
  });
  console.log(`✅ Updated ${result.changes.join(", ")} in ${databaseName}.`);
}

main().catch((error) => {
  console.error("❌ Update failed:", error);
  process.exit(1);
});
