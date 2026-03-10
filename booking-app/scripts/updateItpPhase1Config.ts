/**
 * Update ITP Phase 1 configuration in Firestore
 *
 * Updates:
 * - Auto-approval: Student max 1h, Faculty/Admin max 4h (all Huddle Rooms)
 * - Email messages: generic templates based on MC
 * - Role mapping: Student → STUDENT, Faculty → FACULTY, Admin/Staff → STAFF
 *
 * Usage:
 *   npx ts-node --transpile-only --compiler-options '{"module":"commonjs","jsx":"react"}' scripts/updateItpPhase1Config.ts --dry-run
 *   npx ts-node --transpile-only --compiler-options '{"module":"commonjs","jsx":"react"}' scripts/updateItpPhase1Config.ts
 */

require("dotenv").config({ path: ".env.local" });
import * as admin from "firebase-admin";
const { backupTenantSchemaDocument } = require("./tenantSchemaBackup");

const TENANT_SCHEMA_COLLECTION = "tenantSchema";
const ITP_TENANT = "itp";
const BACKUP_TYPE = "itp-phase1-config";

const DATABASES: Record<string, string> = {
  development: "default",
  staging: "booking-app-staging",
  production: "booking-app-prod",
};

// Auto-approval: Student max 1h, Faculty/Admin max 4h
const AUTO_APPROVAL_CONFIG = {
  minHour: {
    admin: 0,
    faculty: 0,
    student: 0,
  },
  maxHour: {
    admin: 4,
    faculty: 4,
    student: 1,
  },
};

const EMAIL_MESSAGES = {
  requestConfirmation:
    "Thank you for submitting your room booking request. You will receive a notification once it has been reviewed.",
  firstApprovalRequest:
    "A new room booking request has been submitted and requires your review.",
  secondApprovalRequest: "",
  approvalNotice:
    "Your room booking request has been approved. Please check in at the room at your scheduled time.",
  declined:
    "Your room booking request has been declined. You may edit and resubmit your request within 24 hours.",
  canceled: "Your room booking has been canceled.",
  lateCancel:
    "Your room booking has been canceled within 24 hours of the scheduled start time. Please try to cancel earlier in the future.",
  noShow:
    "You have been marked as a no-show for your scheduled room booking. Repeated no-shows may affect future booking eligibility.",
  checkinConfirmation:
    "You have successfully checked in. Enjoy your reserved space!",
  checkoutConfirmation:
    "You have successfully checked out. Thank you for using our booking system.",
  closed: "Your room booking has been closed. Thank you for using our spaces.",
  walkInConfirmation: "",
  vipConfirmation: "",
};

const ROLE_MAPPING = {
  Student: ["STUDENT"],
  Faculty: ["FACULTY"],
  "Admin/Staff": ["STAFF"],
};

interface Options {
  dryRun: boolean;
  database: string;
}

function parseArgs(): Options {
  const args = process.argv.slice(2);
  const options: Options = { dryRun: false, database: "development" };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--dry-run") options.dryRun = true;
    if (args[i] === "--database")
      options.database = args[++i] || "development";
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
  if (!databaseName) {
    console.error(`Unknown database: ${options.database}`);
    process.exit(1);
  }

  if (options.database !== "development") {
    console.error("This script is only for the development database.");
    process.exit(1);
  }

  console.log(
    `\n📦 Updating ITP Phase 1 Config [${options.database}]${options.dryRun ? " (DRY RUN)" : ""}\n`,
  );

  const db = initializeDb(databaseName);
  const docRef = db.collection(TENANT_SCHEMA_COLLECTION).doc(ITP_TENANT);
  const docSnap = await docRef.get();

  if (!docSnap.exists) {
    console.error("ITP tenant schema not found");
    process.exit(1);
  }

  const schema = docSnap.data()!;
  const resources = schema.resources as any[];

  // Update auto-approval for each room
  const updatedRooms = resources.map((room: any) => ({
    ...room,
    autoApproval: AUTO_APPROVAL_CONFIG,
  }));

  console.log("  Auto-approval config:");
  console.log(
    `    Student: max ${AUTO_APPROVAL_CONFIG.maxHour.student}h`,
  );
  console.log(
    `    Faculty: max ${AUTO_APPROVAL_CONFIG.maxHour.faculty}h`,
  );
  console.log(
    `    Admin:   max ${AUTO_APPROVAL_CONFIG.maxHour.admin}h`,
  );
  console.log(`    Applied to ${updatedRooms.length} rooms`);

  console.log("\n  Email messages:");
  for (const [key, value] of Object.entries(EMAIL_MESSAGES)) {
    if (value) {
      console.log(`    ${key}: "${value.substring(0, 60)}..."`);
    } else {
      console.log(`    ${key}: (empty — not used in Phase 1)`);
    }
  }

  console.log("\n  Role mapping:");
  for (const [role, affiliations] of Object.entries(ROLE_MAPPING)) {
    console.log(`    ${role} ← [${affiliations.join(", ")}]`);
  }

  if (options.dryRun) {
    console.log(`\n  [DRY RUN] No changes written.\n`);
  } else {
    const { backupDocId } = await backupTenantSchemaDocument(
      db,
      ITP_TENANT,
      schema,
      BACKUP_TYPE,
    );
    console.log(`\n  Backup created: tenantSchemaBackup/${backupDocId}`);

    await docRef.update({
      resources: updatedRooms,
      emailMessages: EMAIL_MESSAGES,
      roleMapping: ROLE_MAPPING,
    });
    console.log(`  Firestore updated successfully.\n`);
  }
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
