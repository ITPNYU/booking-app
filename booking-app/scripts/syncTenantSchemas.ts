/**
 * Sync Tenant Schemas Script
 *
 * This script:
 * 1. Loads authoritative default values from SchemaProvider.tsx (defaultScheme, etc.)
 * 2. Fetches all existing tenant schemas from Firestore
 * 3. Recursively merges new keys and default values into existing schemas (layer by layer)
 * 4. Writes updated schemas back to Firestore
 *
 * The merge process automatically handles:
 * - Arrays with __defaults__: merges each item using the __defaults__ value
 * - Arrays without __defaults__: uses existing value, skips merging
 * - Nested objects: recursively merges layer by layer
 * - Primitives: uses existing value (overrides default)
 *
 * Usage:
 *   npx ts-node scripts/syncTenantSchemas.ts [--dry-run] [--tenant <tenant>] [--database <env>]
 *
 * Options:
 *   --dry-run    Preview changes without writing to database
 *   --tenant     Sync only a specific tenant (default: all tenants)
 *   --database   Database environment: development, staging, production (default: development)
 */

require("dotenv").config({ path: ".env.local" });
import * as admin from "firebase-admin";
import * as fs from "fs";
import * as path from "path";
import { mergeSchemaDefaults } from "./schemaDefaults";
import type { SchemaContextType } from "../components/src/client/routes/components/SchemaProvider";

// Hardcoded tenant names
const TENANTS = ["mc", "itp"] as const;
const TENANT_SCHEMA_COLLECTION = "tenantSchema";

// Database names for different environments
const DATABASES = {
  development: "default",
  staging: "booking-app-staging",
  production: "booking-app-prod",
};

interface SyncOptions {
  dryRun: boolean;
  tenant?: string;
  database: string;
}

// Parse command line arguments
function parseArgs(): SyncOptions {
  const args = process.argv.slice(2);
  const options: SyncOptions = {
    dryRun: false,
    database: "development",
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--dry-run":
        options.dryRun = true;
        break;
      case "--tenant":
        options.tenant = args[++i];
        break;
      case "--database":
        options.database = args[++i] || "development";
        break;
      case "--help":
        console.log(`
Usage: npx ts-node scripts/syncTenantSchemas.ts [options]

Options:
  --dry-run              Preview changes without writing to database
  --tenant <tenant>      Sync only a specific tenant (default: all tenants)
  --database <env>       Database environment: development, staging, production (default: development)
  --help                 Show this help message

Examples:
  npx ts-node scripts/syncTenantSchemas.ts --dry-run
  npx ts-node scripts/syncTenantSchemas.ts --tenant mc
  npx ts-node scripts/syncTenantSchemas.ts --database production
        `);
        process.exit(0);
        break;
    }
  }

  return options;
}

// Initialize Firebase Admin
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

  // For the default database, don't set databaseId
  if (databaseName !== "default") {
    db.settings({
      databaseId: databaseName,
    });
  }

  return db;
}

// Fetch a tenant schema from Firestore
async function fetchTenantSchema(
  db: admin.firestore.Firestore,
  tenant: string
): Promise<Partial<SchemaContextType> | null> {
  try {
    const docRef = db.collection(TENANT_SCHEMA_COLLECTION).doc(tenant);
    const docSnap = await docRef.get();

    if (docSnap.exists) {
      return docSnap.data() as Partial<SchemaContextType>;
    }

    return null;
  } catch (error) {
    console.error(`❌ Error fetching schema for tenant ${tenant}:`, error);
    return null;
  }
}

// Write updated schema back to Firestore
async function writeTenantSchema(
  db: admin.firestore.Firestore,
  tenant: string,
  schema: SchemaContextType
): Promise<void> {
  try {
    const docRef = db.collection(TENANT_SCHEMA_COLLECTION).doc(tenant);
    await docRef.set(schema, { merge: false }); // Use set to replace entire document
    console.log(`  ✅ Updated schema for tenant: ${tenant}`);
  } catch (error) {
    console.error(`❌ Error writing schema for tenant ${tenant}:`, error);
    throw error;
  }
}

// Save updated schema to a local file (for dry-run mode)
function saveSchemaToFile(
  tenant: string,
  schema: SchemaContextType,
  database: string
): void {
  try {
    // Create output directory if it doesn't exist
    const outputDir = path.join(__dirname, "output");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Create filename with tenant and database (overwrite existing file)
    const filename = `${tenant}-${database}.json`;
    const filepath = path.join(outputDir, filename);

    // Write schema to file with pretty formatting
    fs.writeFileSync(filepath, JSON.stringify(schema, null, 2), "utf-8");
    console.log(`  💾 Saved updated schema to: ${filepath}`);
  } catch (error) {
    console.error(`  ⚠️  Error saving schema to file:`, error);
    // Don't throw - this is just a convenience feature
  }
}

// Compare two objects and return differences
function getDifferences(
  existing: Partial<SchemaContextType>,
  updated: SchemaContextType
): { added: string[]; modified: string[]; removed: string[] } {
  const added: string[] = [];
  const modified: string[] = [];
  const removed: string[] = [];

  function compareObjects(path: string, oldObj: any, newObj: any) {
    // Check for keys in newObj (template) that are missing in oldObj
    for (const key in newObj) {
      const currentPath = path ? `${path}.${key}` : key;

      if (!(key in oldObj)) {
        added.push(currentPath);
      } else if (Array.isArray(newObj[key])) {
        // Handle arrays - compare items if they're objects
        const oldArray = oldObj[key] || [];
        const newArray = newObj[key] || [];
        
        if (oldArray.length !== newArray.length) {
          modified.push(`${currentPath} (length: ${oldArray.length} → ${newArray.length})`);
        }
        
        // Compare array items if they're objects (like resources)
        if (newArray.length > 0 && typeof newArray[0] === "object" && newArray[0] !== null) {
          const maxLength = Math.max(oldArray.length, newArray.length);
          for (let i = 0; i < maxLength; i++) {
            if (i >= oldArray.length) {
              added.push(`${currentPath}[${i}] (new item)`);
            } else if (i >= newArray.length) {
              modified.push(`${currentPath}[${i}] (removed)`);
            } else {
              // Compare individual array items
              compareObjects(`${currentPath}[${i}]`, oldArray[i] || {}, newArray[i]);
            }
          }
        } else if (JSON.stringify(oldArray) !== JSON.stringify(newArray)) {
          modified.push(currentPath);
        }
      } else if (
        typeof newObj[key] === "object" &&
        newObj[key] !== null &&
        !Array.isArray(newObj[key])
      ) {
        compareObjects(currentPath, oldObj[key] || {}, newObj[key]);
      } else if (JSON.stringify(oldObj[key]) !== JSON.stringify(newObj[key])) {
        // Only mark as modified if it's not just a default being added
        if (oldObj[key] !== undefined) {
          modified.push(currentPath);
        }
      }
    }

    // Check for keys in oldObj that are not in newObj (removed keys)
    for (const key in oldObj) {
      if (!(key in newObj)) {
        const currentPath = path ? `${path}.${key}` : key;
        removed.push(currentPath);
      }
    }
  }

  compareObjects("", existing, updated);
  return { added, modified, removed };
}

// Sync a single tenant schema
async function syncTenantSchema(
  db: admin.firestore.Firestore,
  tenant: string,
  options: SyncOptions
): Promise<{
  success: boolean;
  changes: { added: string[]; modified: string[]; removed: string[] };
}> {
  console.log(`\n📋 Processing tenant: ${tenant}`);

  try {
    // Fetch existing schema
    const existingSchema = await fetchTenantSchema(db, tenant);

    if (!existingSchema) {
      console.log(`  ⚠️  No existing schema found for tenant: ${tenant}`);
      console.log(`  💡 Creating new schema with defaults...`);

      if (!options.dryRun) {
        const newSchema = mergeSchemaDefaults({ tenant }, tenant);
        await writeTenantSchema(db, tenant, newSchema);
        return {
          success: true,
          changes: { added: Object.keys(newSchema), modified: [], removed: [] },
        };
      } else {
        const newSchema = mergeSchemaDefaults({ tenant }, tenant);
        console.log(
          `  📝 Would create new schema with ${Object.keys(newSchema).length} fields`
        );
        // Save to file in dry-run mode
        saveSchemaToFile(tenant, newSchema, options.database);
        return {
          success: true,
          changes: { added: Object.keys(newSchema), modified: [], removed: [] },
        };
      }
    }

    // Merge with defaults
    const updatedSchema = mergeSchemaDefaults(existingSchema, tenant);

    // Compare to find changes
    const changes = getDifferences(existingSchema, updatedSchema);

    if (changes.added.length === 0 && changes.modified.length === 0 && changes.removed.length === 0) {
      console.log(`  ✓ Schema is up to date (no changes needed)`);
      return { success: true, changes: { added: [], modified: [], removed: [] } };
    }

    // Show what will change
    if (changes.added.length > 0) {
      console.log(`  ➕ New fields to add: ${changes.added.length}`);
      changes.added.forEach((field) => console.log(`     - ${field}`));
    }

    if (changes.modified.length > 0) {
      console.log(`  🔄 Fields to update: ${changes.modified.length}`);
      changes.modified.forEach((field) => console.log(`     - ${field}`));
    }

    if (changes.removed.length > 0) {
      console.log(`  🗑️  Extra fields to remove: ${changes.removed.length}`);
      changes.removed.forEach((field) => console.log(`     - ${field}`));
    }

    // Write back if not dry run
    if (!options.dryRun) {
      await writeTenantSchema(db, tenant, updatedSchema);
    } else {
      console.log(`  🔍 [DRY RUN] Would update schema for tenant: ${tenant}`);
      // Save to file in dry-run mode
      saveSchemaToFile(tenant, updatedSchema, options.database);
    }

    return { success: true, changes };
  } catch (error) {
    console.error(`  ❌ Error syncing tenant ${tenant}:`, error);
    return { success: false, changes: { added: [], modified: [], removed: [] } };
  }
}

// Main function
async function main() {
  try {
    const options = parseArgs();

    console.log("🚀 Starting tenant schema sync...");
    console.log(`📊 Options:`, {
      dryRun: options.dryRun,
      tenant: options.tenant || "all tenants",
      database: options.database,
    });

    // Validate database
    if (!DATABASES[options.database as keyof typeof DATABASES]) {
      console.error(`❌ Invalid database: ${options.database}`);
      console.error(`Valid databases: ${Object.keys(DATABASES).join(", ")}`);
      process.exit(1);
    }

    // Initialize database
    const db = initializeDb(
      DATABASES[options.database as keyof typeof DATABASES]
    );
    console.log(
      `📡 Connected to database: ${options.database} (${DATABASES[options.database as keyof typeof DATABASES]})`
    );

    // Determine which tenants to sync
    let tenantsToSync: string[];

    if (options.tenant) {
      // Validate tenant
      if (!TENANTS.includes(options.tenant as any)) {
        console.error(`❌ Invalid tenant: ${options.tenant}`);
        console.error(`Valid tenants: ${TENANTS.join(", ")}`);
        process.exit(1);
      }
      tenantsToSync = [options.tenant];
    } else {
      // Use hardcoded tenant list
      tenantsToSync = [...TENANTS];
      console.log(
        `📋 Found ${tenantsToSync.length} tenant(s) to sync: ${tenantsToSync.join(", ")}`
      );
    }

    if (options.dryRun) {
      console.log(
        "\n🔍 DRY RUN MODE - No changes will be written to database\n"
      );
    }

    // Sync each tenant
    const results = [];
    for (const tenant of tenantsToSync) {
      const result = await syncTenantSchema(db, tenant, options);
      results.push({ tenant, ...result });
    }

    // Summary
    console.log("\n📊 Sync Summary:");
    const successful = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);

    if (successful.length > 0) {
      console.log(`✅ Successfully processed: ${successful.length}`);
      successful.forEach((result) => {
        const totalChanges =
          result.changes.added.length + result.changes.modified.length + result.changes.removed.length;
        if (totalChanges > 0) {
          console.log(
            `  - ${result.tenant}: ${result.changes.added.length} added, ${result.changes.modified.length} modified, ${result.changes.removed.length} removed`
          );
        } else {
          console.log(`  - ${result.tenant}: up to date`);
        }
      });
    }

    if (failed.length > 0) {
      console.log(`❌ Failed: ${failed.length}`);
      failed.forEach((result) => {
        console.log(`  - ${result.tenant}: error occurred`);
      });
    }

    if (options.dryRun) {
      console.log("\n💡 Run without --dry-run to apply changes");
    } else if (successful.length > 0) {
      console.log(`\n🎉 Tenant schema sync completed!`);
    }
  } catch (error) {
    console.error("💥 Script failed:", error);
    process.exit(1);
  } finally {
    // Clean up Firebase app instances
    const apps = admin.apps;
    for (const app of apps) {
      if (app) {
        await app.delete();
      }
    }
  }
}

// Run the script
if (require.main === module) {
  main();
}

export { syncTenantSchema, mergeSchemaDefaults };
