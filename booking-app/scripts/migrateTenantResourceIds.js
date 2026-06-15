//@ts-nocheck
require("dotenv").config({ path: ".env.local" });
const admin = require("firebase-admin");
const {
  TENANT_SCHEMA_COLLECTION,
  backupTenantSchemaDocument,
} = require("./tenantSchemaBackup");

const BACKUP_TYPE = "resource-id-string";
const DATABASES = {
  development: "default",
  staging: "booking-app-staging",
  production: "booking-app-prod",
};

const hasOwn = (value, key) =>
  Object.prototype.hasOwnProperty.call(value, key);

const validateId = (id, path) => {
  if (typeof id !== "string") {
    throw new Error(`${path} must be a string`);
  }
  if (id.trim().length === 0) {
    throw new Error(`${path} must be non-empty`);
  }
  if (id.includes(",")) {
    throw new Error(`${path} must not contain commas`);
  }
};

const migrateTenantSchemaData = (schema, tenantId = "unknown") => {
  if (schema === null || typeof schema !== "object" || Array.isArray(schema)) {
    throw new Error(`tenantSchema/${tenantId} must be an object`);
  }
  if (!hasOwn(schema, "resources")) {
    return { schema, changed: false };
  }
  if (!Array.isArray(schema.resources)) {
    throw new Error(`tenantSchema/${tenantId}.resources must be an array`);
  }

  let changed = false;
  const seenIds = new Set();
  const resources = schema.resources.map((resource, index) => {
    const path = `tenantSchema/${tenantId}.resources[${index}]`;
    if (resource === null || typeof resource !== "object" || Array.isArray(resource)) {
      throw new Error(`${path} must be an object`);
    }

    const hasResourceId = hasOwn(resource, "resourceId");
    const hasRoomId = hasOwn(resource, "roomId");
    let resourceId;

    if (hasResourceId) {
      resourceId = resource.resourceId;
      validateId(resourceId, `${path}.resourceId`);
    }

    if (hasRoomId) {
      const roomId = resource.roomId;
      if (
        (typeof roomId !== "string" && typeof roomId !== "number") ||
        (typeof roomId === "number" && !Number.isFinite(roomId))
      ) {
        throw new Error(`${path}.roomId must be a string or finite number`);
      }

      const legacyResourceId = String(roomId);
      validateId(legacyResourceId, `${path}.roomId`);
      if (hasResourceId && resourceId !== legacyResourceId) {
        throw new Error(
          `${path} has conflicting resourceId "${resourceId}" and roomId "${legacyResourceId}"`
        );
      }
      resourceId = legacyResourceId;
    }

    if (!hasResourceId && !hasRoomId) {
      throw new Error(`${path} must have resourceId or legacy roomId`);
    }
    if (seenIds.has(resourceId)) {
      throw new Error(
        `tenantSchema/${tenantId}.resources has duplicate resourceId "${resourceId}"`
      );
    }
    seenIds.add(resourceId);

    if (!hasRoomId) {
      return resource;
    }

    const { roomId: _legacyRoomId, ...withoutRoomId } = resource;
    changed = true;
    return { ...withoutRoomId, resourceId };
  });

  return {
    schema: changed ? { ...schema, resources } : schema,
    changed,
  };
};

const getTenantDocuments = async (db, tenant) => {
  if (tenant) {
    const snapshot = await db.collection(TENANT_SCHEMA_COLLECTION).doc(tenant).get();
    if (!snapshot.exists) {
      throw new Error(`No tenant schema found for "${tenant}"`);
    }
    return [{ id: tenant, data: () => snapshot.data() }];
  }

  const snapshot = await db.collection(TENANT_SCHEMA_COLLECTION).get();
  return snapshot.docs;
};

const migrateTenantResourceIds = async (
  db,
  { dryRun = false, tenant } = {}
) => {
  const documents = await getTenantDocuments(db, tenant);

  // Preflight every selected document so validation failures cannot cause a
  // partially applied migration.
  const migrations = documents.map((doc) => {
    const existingSchema = doc.data();
    return {
      tenantId: doc.id,
      existingSchema,
      ...migrateTenantSchemaData(existingSchema, doc.id),
    };
  });
  const changedMigrations = migrations.filter((migration) => migration.changed);

  if (!dryRun) {
    for (const migration of changedMigrations) {
      await backupTenantSchemaDocument(
        db,
        migration.tenantId,
        migration.existingSchema,
        BACKUP_TYPE
      );
      await db
        .collection(TENANT_SCHEMA_COLLECTION)
        .doc(migration.tenantId)
        .set(migration.schema, { merge: false });
    }
  }

  return {
    dryRun,
    scanned: migrations.length,
    changed: changedMigrations.length,
    unchanged: migrations.length - changedMigrations.length,
    tenants: changedMigrations.map((migration) => migration.tenantId),
  };
};

const parseArgs = (args = process.argv.slice(2)) => {
  const options = { dryRun: false, database: "development" };
  for (let index = 0; index < args.length; index++) {
    switch (args[index]) {
      case "--dry-run":
        options.dryRun = true;
        break;
      case "--database":
        options.database = args[++index];
        break;
      case "--tenant":
        options.tenant = args[++index];
        break;
      case "--help":
        options.help = true;
        break;
      default:
        throw new Error(`Unknown argument: ${args[index]}`);
    }
  }
  if (!DATABASES[options.database]) {
    throw new Error(
      `Invalid database "${options.database}". Expected one of: ${Object.keys(DATABASES).join(", ")}`
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

const main = async () => {
  const options = parseArgs();
  if (options.help) {
    console.log(`Usage: node scripts/migrateTenantResourceIds.js [options]

Options:
  --dry-run              Validate and report without writing
  --database <env>       development, staging, or production
  --tenant <tenant>      Migrate one tenant instead of the whole collection
  --help                 Show this help message`);
    return;
  }

  const result = await migrateTenantResourceIds(
    initializeDb(DATABASES[options.database]),
    options
  );
  console.log(
    `${options.dryRun ? "[DRY RUN] " : ""}Scanned ${result.scanned}; ` +
      `${result.changed} ${options.dryRun ? "would change" : "changed"}; ` +
      `${result.unchanged} unchanged.`
  );
  if (result.tenants.length > 0) {
    console.log(`Tenants: ${result.tenants.join(", ")}`);
  }
};

if (require.main === module) {
  main()
    .catch((error) => {
      console.error(`Migration failed: ${error.message}`);
      process.exitCode = 1;
    })
    .finally(async () => {
      for (const app of admin.apps) {
        if (app) {
          await app.delete();
        }
      }
    });
}

module.exports = {
  BACKUP_TYPE,
  DATABASES,
  migrateTenantSchemaData,
  migrateTenantResourceIds,
  parseArgs,
};
