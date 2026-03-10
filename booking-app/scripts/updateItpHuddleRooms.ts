/**
 * Update ITP Huddle Room resources in Firestore
 *
 * Updates the ITP tenant schema to:
 * - Keep only Huddle Rooms (421, 422, 446, 447, 448) as initial resources
 * - Fix services from [""] to []
 * - Update calendarIdProd for room 448
 * - Set 24-hour availability (startHour "00:00:00" for all roles)
 *
 * Usage:
 *   npm run update:itp-huddle-rooms -- --dry-run
 *   npm run update:itp-huddle-rooms
 *   npm run update:itp-huddle-rooms -- --database staging
 */

require("dotenv").config({ path: ".env.local" });
import * as admin from "firebase-admin";
const { backupTenantSchemaDocument } = require("./tenantSchemaBackup");

const TENANT_SCHEMA_COLLECTION = "tenantSchema";
const ITP_TENANT = "itp";
const BACKUP_TYPE = "itp-huddle-rooms-update";

const DATABASES: Record<string, string> = {
  development: "default",
  staging: "booking-app-staging",
  production: "booking-app-prod",
};

// Huddle Room IDs to keep
const HUDDLE_ROOM_IDS = [421, 422, 446, 447, 448];

// Corrections from spreadsheet
const ROOM_FIXES: Record<number, { calendarIdProd?: string }> = {
  448: {
    calendarIdProd:
      "c_f6460209d95eb8d4ea0721d4e6f98ae5436924426a62bf9a001f863583f5aa28@group.calendar.google.com",
  },
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
    if (args[i] === "--database") options.database = args[++i] || "development";
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

  console.log(
    `\n📦 Updating ITP Huddle Rooms [${options.database}]${options.dryRun ? " (DRY RUN)" : ""}\n`,
  );

  const db = initializeDb(databaseName);
  const docRef = db.collection(TENANT_SCHEMA_COLLECTION).doc(ITP_TENANT);
  const docSnap = await docRef.get();

  if (!docSnap.exists) {
    console.error("❌ ITP tenant schema not found");
    process.exit(1);
  }

  const schema = docSnap.data()!;
  const resources = schema.resources as any[];

  console.log(`  Current resources: ${resources.length}`);
  resources.forEach((r: any) =>
    console.log(`    - ${r.name} (${r.roomId})${HUDDLE_ROOM_IDS.includes(r.roomId) ? " ✅ keep" : " ⏸️  remove"}`),
  );

  // Filter to Huddle Rooms only
  const huddleRooms = resources.filter((r: any) =>
    HUDDLE_ROOM_IDS.includes(r.roomId),
  );

  if (huddleRooms.length !== HUDDLE_ROOM_IDS.length) {
    const found = huddleRooms.map((r: any) => r.roomId);
    const missing = HUDDLE_ROOM_IDS.filter((id) => !found.includes(id));
    console.error(`❌ Missing Huddle Rooms: ${missing.join(", ")}`);
    process.exit(1);
  }

  // Apply fixes to each room
  const updatedRooms = huddleRooms.map((room: any) => {
    const fixes = ROOM_FIXES[room.roomId] || {};
    const updated = { ...room };

    // Fix services: [""] → []
    if (
      Array.isArray(updated.services) &&
      updated.services.length === 1 &&
      updated.services[0] === ""
    ) {
      console.log(`  🔧 ${room.name} (${room.roomId}): services [""] → []`);
      updated.services = [];
    }

    // Apply calendarIdProd fix
    if (fixes.calendarIdProd) {
      console.log(
        `  🔧 ${room.name} (${room.roomId}): calendarIdProd updated`,
      );
      updated.calendarIdProd = fixes.calendarIdProd;
    }

    return updated;
  });

  // Update calendarConfig for 24-hour availability
  const calendarConfig = { ...schema.calendarConfig };
  const startHour = { ...(calendarConfig.startHour || {}) };
  const allRoles = [
    "student",
    "studentVIP",
    "studentWalkIn",
    "faculty",
    "facultyVIP",
    "facultyWalkIn",
    "admin",
    "adminVIP",
    "adminWalkIn",
  ];

  let startHourChanged = false;
  for (const role of allRoles) {
    if (startHour[role] !== "00:00:00") {
      startHourChanged = true;
      startHour[role] = "00:00:00";
    }
  }
  calendarConfig.startHour = startHour;

  if (startHourChanged) {
    console.log(`  🔧 calendarConfig.startHour: all roles → "00:00:00" (24h)`);
  }

  // Summary
  console.log(`\n  📊 Summary:`);
  console.log(`    Resources: ${resources.length} → ${updatedRooms.length}`);
  console.log(`    24-hour availability: ${startHourChanged ? "updated" : "already set"}`);

  if (options.dryRun) {
    console.log(`\n  🔍 [DRY RUN] No changes written.`);
    console.log(`\n  Updated resources:`);
    updatedRooms.forEach((r: any) =>
      console.log(
        `    - ${r.name} (${r.roomId}): services=${JSON.stringify(r.services)}, calendarIdProd=${r.calendarIdProd ? "✅" : "❌"}`,
      ),
    );
  } else {
    // Backup before updating
    const { backupDocId } = await backupTenantSchemaDocument(
      db,
      ITP_TENANT,
      schema,
      BACKUP_TYPE,
    );
    console.log(`\n  💾 Backup created: tenantSchemaBackup/${backupDocId}`);

    await docRef.update({
      resources: updatedRooms,
      calendarConfig,
    });
    console.log(`  ✅ Firestore updated successfully.`);
  }

  console.log("");
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
