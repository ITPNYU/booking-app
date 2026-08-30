/**
 * Patch missing service `toggle` locks into the stored MC tenant schema.
 *
 * `applyMcResourceServices` only fills in `lib/tenant/mcResourceServices.ts`
 * defaults for resources that have no object `services` config. Every MC room
 * already has one in Firestore, so a `toggle` added to the file never reaches
 * the booking form. This script copies just the `toggle` values from the file
 * onto the stored resources — nothing else in the document is touched.
 *
 * A section whose stored `toggle` is absent behaves as "optional", so only
 * sections whose effective lock actually differs are patched.
 *
 * Usage:
 *   npm run patch:mc-toggles -- --dry-run
 *   npm run patch:mc-toggles -- --database development
 *
 * Options:
 *   --dry-run          Print the planned changes and write nothing
 *   --database <env>   development | staging | production (default: development)
 *   --tenant <id>      tenantSchema document id (default: mc)
 *
 * Applying writes a backup of the document to `tenantSchemaBackup` first.
 */

require("dotenv").config({ path: ".env.local" });
import * as admin from "firebase-admin";
import { getMcResourceServices } from "../lib/tenant/mcResourceServices";
const {
  TENANT_SCHEMA_COLLECTION,
  backupTenantSchemaDocument,
} = require("./tenantSchemaBackup");

/** Backup type in document ids; distinct from cli-backup / sync-defaults. */
const BACKUP_TYPE_PATCH = "patch-mc-toggles";

const DATABASES = {
  development: "default",
  staging: "booking-app-staging",
  production: "booking-app-prod",
} as const;

type DatabaseEnv = keyof typeof DATABASES;

interface PatchOptions {
  database: DatabaseEnv;
  tenant: string;
  dryRun: boolean;
}

/** Section keys that carry a `toggle`, plus staffing (toggle lives at its root). */
const SECTION_KEYS = [
  "setup",
  "furnishings",
  "equipment",
  "catering",
  "cleaning",
  "security",
  "annex",
  "staffing",
] as const;

const DEFAULT_TOGGLE = "optional";

interface PlannedChange {
  resourceId: string;
  section: string;
  from: string;
  to: string;
}

function parseArgs(): PatchOptions {
  const args = process.argv.slice(2);
  const options: PatchOptions = {
    database: "development",
    tenant: "mc",
    dryRun: false,
  };

  for (let i = 0; i < args.length; i += 1) {
    switch (args[i]) {
      case "--dry-run":
        options.dryRun = true;
        break;
      case "--database":
        options.database = (args[++i] || "development") as DatabaseEnv;
        break;
      case "--tenant":
        options.tenant = args[++i] || "mc";
        break;
      case "--help":
      case "-h":
        console.log(
          [
            "Patch MC service toggle locks into the stored tenant schema.",
            "",
            "  --dry-run          Print planned changes, write nothing",
            "  --database <env>   development | staging | production (default: development)",
            "  --tenant <id>      tenantSchema document id (default: mc)",
          ].join("\n"),
        );
        process.exit(0);
        break;
      default:
        console.error(`Unknown argument: ${args[i]}`);
        process.exit(1);
    }
  }

  if (!(options.database in DATABASES)) {
    console.error(
      `Invalid --database "${options.database}". Use: ${Object.keys(DATABASES).join(", ")}`,
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

/**
 * Copy file toggles onto a stored resource. Returns the changes made; the
 * resource is only cloned (and mutated) when something actually differs.
 */
function patchResource(resource: Record<string, unknown>): {
  resource: Record<string, unknown>;
  changes: PlannedChange[];
} {
  const resourceId = String(resource.resourceId ?? resource.roomId ?? "");
  const stored = resource.services;
  const changes: PlannedChange[] = [];

  // Rooms with no object config still get the file defaults at read time.
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) {
    return { resource, changes };
  }

  const fileServices = getMcResourceServices(resourceId) as
    | Record<string, { toggle?: string } | undefined>
    | undefined;
  if (!fileServices) return { resource, changes };

  const storedServices = stored as Record<string, unknown>;
  const nextServices: Record<string, unknown> = { ...storedServices };

  for (const key of SECTION_KEYS) {
    const fileToggle = fileServices[key]?.toggle;
    if (!fileToggle) continue;

    const storedSection = storedServices[key];
    // Never invent a section the stored schema does not have.
    if (
      !storedSection ||
      typeof storedSection !== "object" ||
      Array.isArray(storedSection)
    ) {
      continue;
    }

    const current =
      (storedSection as { toggle?: string }).toggle ?? DEFAULT_TOGGLE;
    if (current === fileToggle) continue;

    nextServices[key] = { ...(storedSection as object), toggle: fileToggle };
    changes.push({
      resourceId,
      section: key,
      from: current,
      to: fileToggle,
    });
  }

  if (changes.length === 0) return { resource, changes };
  return { resource: { ...resource, services: nextServices }, changes };
}

async function main(): Promise<void> {
  const options = parseArgs();
  const databaseName = DATABASES[options.database];
  const db = initializeDb(databaseName);

  console.log(
    `Environment: ${options.database} (Firestore databaseId: ${
      databaseName === "default" ? "(default)" : databaseName
    })`,
  );

  const docRef = db.collection(TENANT_SCHEMA_COLLECTION).doc(options.tenant);
  const snapshot = await docRef.get();
  if (!snapshot.exists) {
    console.error(
      `No document "${options.tenant}" in ${TENANT_SCHEMA_COLLECTION}`,
    );
    process.exit(1);
  }

  const data = snapshot.data();
  const resources = data?.resources;
  if (!Array.isArray(resources)) {
    console.error(`Document "${options.tenant}" has no resources array`);
    process.exit(1);
  }

  const allChanges: PlannedChange[] = [];
  const nextResources = resources.map((resource) => {
    const { resource: patched, changes } = patchResource(
      resource as Record<string, unknown>,
    );
    allChanges.push(...changes);
    return patched;
  });

  if (allChanges.length === 0) {
    console.log("No toggle differences; stored schema already matches the file.");
    return;
  }

  const prefix = options.dryRun ? "[dry-run] " : "";
  console.log(`${prefix}${allChanges.length} toggle(s) to patch:`);
  for (const change of allChanges) {
    console.log(
      `  ${change.resourceId.padEnd(6)} ${change.section.padEnd(13)} ${change.from} → ${change.to}`,
    );
  }

  if (options.dryRun) {
    console.log("[dry-run] No documents written.");
    return;
  }

  const { backupDocId, backupCollection } = await backupTenantSchemaDocument(
    db,
    options.tenant,
    data,
    BACKUP_TYPE_PATCH,
  );
  console.log(`Backed up ${options.tenant} → ${backupCollection}/${backupDocId}`);

  await docRef.update({ resources: nextResources });
  console.log(
    `Updated ${TENANT_SCHEMA_COLLECTION}/${options.tenant} (${allChanges.length} toggle(s)).`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Patch failed:", error);
    process.exit(1);
  });
