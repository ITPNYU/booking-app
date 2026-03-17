/**
 * Validate Tenant Schemas Script
 *
 * Checks that all tenant schemas in Firestore have valid, non-empty values
 * for critical fields. Run after sync to catch missing configuration before deploy.
 *
 * Usage:
 *   npx ts-node scripts/validateTenantSchemas.ts [--database <env>] [--tenant <tenant>]
 *
 * Exit codes:
 *   0 = all schemas valid
 *   1 = validation errors found
 */

require("dotenv").config({ path: ".env.local" });
import * as admin from "firebase-admin";
import type { SchemaContextType } from "../components/src/client/routes/components/SchemaProvider";

const TENANTS = ["mc", "itp"] as const;
const TENANT_SCHEMA_COLLECTION = "tenantSchema";

const DATABASES: Record<string, string> = {
  development: "default",
  staging: "booking-app-staging",
  production: "booking-app-prod",
};

// ---------------------------------------------------------------------------
// Validation rules
// ---------------------------------------------------------------------------

type ValidationError = {
  field: string;
  message: string;
  severity: "error" | "warning";
};

type ValidationRule = {
  field: string;
  check: (schema: SchemaContextType, env: string) => string | null;
  severity: "error" | "warning";
};

/**
 * Define validation rules here. Each rule checks a single concern.
 * Return a string message if validation fails, null if it passes.
 *
 * Add new rules as more fields move to schema.
 */
const VALIDATION_RULES: ValidationRule[] = [
  // --- Identity ---
  {
    field: "name",
    severity: "error",
    check: (s) => (!s.name ? "Tenant name is empty" : null),
  },
  {
    field: "logo",
    severity: "warning",
    check: (s) => (!s.logo ? "Logo path is empty" : null),
  },
  {
    field: "nameForPolicy",
    severity: "warning",
    check: (s) => (!s.nameForPolicy ? "nameForPolicy is empty" : null),
  },

  // --- Roles & Mappings ---
  {
    field: "roles",
    severity: "error",
    check: (s) =>
      !s.roles || s.roles.length === 0 ? "No roles defined" : null,
  },
  {
    field: "roleMapping",
    severity: "error",
    check: (s) =>
      !s.roleMapping || Object.keys(s.roleMapping).length === 0
        ? "roleMapping is empty"
        : null,
  },
  {
    field: "schoolMapping",
    severity: "error",
    check: (s) =>
      !s.schoolMapping || Object.keys(s.schoolMapping).length === 0
        ? "schoolMapping is empty"
        : null,
  },

  // --- Resources ---
  {
    field: "resources",
    severity: "error",
    check: (s) =>
      !s.resources || s.resources.length === 0
        ? "No resources defined"
        : null,
  },
  {
    field: "resources[].calendarId",
    severity: "error",
    check: (s) => {
      if (!s.resources) return null;
      const missing = s.resources.filter((r) => !r.calendarId);
      return missing.length > 0
        ? `${missing.length} resource(s) missing calendarId: ${missing.map((r) => r.name || "(unnamed)").join(", ")}`
        : null;
    },
  },
  {
    field: "resources[].name",
    severity: "error",
    check: (s) => {
      if (!s.resources) return null;
      const missing = s.resources.filter((r) => !r.name);
      return missing.length > 0
        ? `${missing.length} resource(s) have no name`
        : null;
    },
  },

  // --- Agreements ---
  {
    field: "agreements",
    severity: "warning",
    check: (s) =>
      !s.agreements || s.agreements.length === 0
        ? "No agreements defined"
        : null,
  },

  // --- CC Emails (added by schema-driven-tenant-policy branch) ---
  {
    field: "ccEmails.approved",
    severity: "warning",
    check: (s, env) => {
      const ccEmails = (s as any).ccEmails;
      if (!ccEmails?.approved) return "ccEmails.approved is not configured";
      const email = ccEmails.approved[env];
      return !email
        ? `ccEmails.approved.${env} is empty — CC notifications will be skipped`
        : null;
    },
  },
  {
    field: "ccEmails.canceled",
    severity: "warning",
    check: (s, env) => {
      const ccEmails = (s as any).ccEmails;
      if (!ccEmails?.canceled) return "ccEmails.canceled is not configured";
      const email = ccEmails.canceled[env];
      return !email
        ? `ccEmails.canceled.${env} is empty — cancel CC notifications will be skipped`
        : null;
    },
  },

  // --- Email Messages ---
  {
    field: "emailMessages",
    severity: "warning",
    check: (s) => {
      if (!s.emailMessages) return "emailMessages is not configured";
      const empty = Object.entries(s.emailMessages).filter(
        ([, v]) => !v,
      );
      return empty.length > 0
        ? `${empty.length} email message(s) are empty: ${empty.map(([k]) => k).join(", ")}`
        : null;
    },
  },
];

// ---------------------------------------------------------------------------
// Script logic
// ---------------------------------------------------------------------------

function parseArgs(): { database: string; tenant?: string } {
  const args = process.argv.slice(2);
  const options: { database: string; tenant?: string } = {
    database: "development",
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--database") options.database = args[++i] || "development";
    if (args[i] === "--tenant") options.tenant = args[++i];
    if (args[i] === "--help") {
      console.log(`
Usage: npx ts-node scripts/validateTenantSchemas.ts [options]

Options:
  --database <env>    Database environment: development, staging, production (default: development)
  --tenant <tenant>   Validate only a specific tenant (default: all tenants)
  --help              Show this help message
`);
      process.exit(0);
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

function validateSchema(
  schema: SchemaContextType,
  env: string,
): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const rule of VALIDATION_RULES) {
    const message = rule.check(schema, env);
    if (message) {
      errors.push({
        field: rule.field,
        message,
        severity: rule.severity,
      });
    }
  }

  return errors;
}

async function main() {
  const options = parseArgs();

  if (!DATABASES[options.database]) {
    console.error(`Invalid database: ${options.database}`);
    process.exit(1);
  }

  const db = initializeDb(DATABASES[options.database]);
  const tenantsToValidate = options.tenant ? [options.tenant] : [...TENANTS];

  console.log(`\nValidating tenant schemas (${options.database})...\n`);

  let hasErrors = false;

  for (const tenant of tenantsToValidate) {
    const docSnap = await db
      .collection(TENANT_SCHEMA_COLLECTION)
      .doc(tenant)
      .get();

    if (!docSnap.exists) {
      console.log(`  ${tenant}: MISSING — no schema document found`);
      hasErrors = true;
      continue;
    }

    const schema = docSnap.data() as SchemaContextType;
    const errors = validateSchema(schema, options.database);

    const errorCount = errors.filter((e) => e.severity === "error").length;
    const warningCount = errors.filter((e) => e.severity === "warning").length;

    if (errors.length === 0) {
      console.log(`  ${tenant}: OK`);
    } else {
      console.log(
        `  ${tenant}: ${errorCount} error(s), ${warningCount} warning(s)`,
      );
      for (const err of errors) {
        const icon = err.severity === "error" ? "ERR" : "WARN";
        console.log(`    [${icon}] ${err.field}: ${err.message}`);
      }
      if (errorCount > 0) hasErrors = true;
    }
  }

  console.log("");

  // Clean up
  for (const app of admin.apps) {
    if (app) await app.delete();
  }

  if (hasErrors) {
    console.log("Validation FAILED — fix errors before deploying.\n");
    process.exit(1);
  } else {
    console.log("Validation passed.\n");
    process.exit(0);
  }
}

if (require.main === module) {
  main();
}

export { validateSchema, VALIDATION_RULES };
