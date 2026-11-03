/**
 * Copy per-resource approver assignments into `{tenant}-usersApproversResources`.
 *
 * Resource approvers used to live one per doc in `{tenant}-usersResourceApprovers`
 * ({ resourceId, email }) and service approvers in
 * `{tenant}-usersServiceApprovers` ({ resourceId, service, email }). The app
 * now reads one doc per resource (docId = resourceId) holding both. This
 * script merges the old docs into the new ones: it only adds emails, so it is
 * safe to re-run (e.g. once before the deploy and once right after, to pick
 * up edits made in between). The old collections are left untouched.
 *
 * Usage:
 *   npm run migrate:approvers-resources:dry-run -- --database development
 *   npm run migrate:approvers-resources -- --database production
 *
 * Options:
 *   --database <env>   development | staging | production (default: development)
 *   --tenant <id>      Only this tenant (default: every tenant)
 *   --dry-run          Print what would change without writing
 *   --help
 */

require("dotenv").config({ path: ".env.local" });
import * as admin from "firebase-admin";
import { ALLOWED_TENANTS } from "../components/src/constants/tenants";
import {
  type ApproverChange,
  type ApproversResource,
  applyApproverChange,
  getApproversResourceDocumentId,
  toApproverService,
  toApproversResource,
} from "../components/src/utils/approversResources";

const DATABASES: Record<string, string> = {
  development: "default",
  staging: "booking-app-staging",
  production: "booking-app-prod",
};

interface Options {
  dryRun: boolean;
  database: string;
  tenant?: string;
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
      case "--tenant":
        options.tenant = args[++i];
        break;
      case "--help":
        console.log(`
Usage: npx ts-node scripts/migrateApproversResources.ts [options]

Options:
  --database <env>   development | staging | production (default: development)
  --tenant <id>      Only this tenant (default: every tenant)
  --dry-run          Print what would change without writing
  --help             Show this help message
        `);
        process.exit(0);
    }
  }
  if (!DATABASES[options.database]) {
    console.error(`❌ Unknown --database ${options.database}`);
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

const countEmails = (doc: ApproversResource) => ({
  resource: doc.resourceApprovers.length,
  service: Object.values(doc.serviceApprovers).reduce(
    (total, emails) => total + (emails?.length ?? 0),
    0,
  ),
});

async function collectChanges(
  db: admin.firestore.Firestore,
  tenant: string,
): Promise<Map<string, ApproverChange[]>> {
  const changes = new Map<string, ApproverChange[]>();
  const push = (resourceId: unknown, change: ApproverChange) => {
    const id = String(resourceId ?? "").trim();
    if (!id) return;
    changes.set(id, [...(changes.get(id) ?? []), change]);
  };

  const resourceSnap = await db
    .collection(`${tenant}-usersResourceApprovers`)
    .get();
  resourceSnap.docs.forEach((doc) => {
    const { resourceId, email } = doc.data();
    if (typeof email !== "string" || !email.trim()) {
      console.log(`  ⚠️  usersResourceApprovers/${doc.id}: no email, skipped`);
      return;
    }
    push(resourceId, { action: "add", kind: "resource", email });
  });

  const serviceSnap = await db
    .collection(`${tenant}-usersServiceApprovers`)
    .get();
  serviceSnap.docs.forEach((doc) => {
    const { resourceId, service, email } = doc.data();
    const approverService = toApproverService(String(service ?? ""));
    if (!approverService || typeof email !== "string" || !email.trim()) {
      console.log(
        `  ⚠️  usersServiceApprovers/${doc.id}: service "${service}" or email unusable, skipped`,
      );
      return;
    }
    push(resourceId, {
      action: "add",
      kind: "service",
      service: approverService,
      email,
    });
  });

  console.log(
    `  read ${resourceSnap.size} resource and ${serviceSnap.size} service approver docs`,
  );
  return changes;
}

async function migrateTenant(
  db: admin.firestore.Firestore,
  tenant: string,
  dryRun: boolean,
) {
  console.log(`\n▶ ${tenant}`);
  const changes = await collectChanges(db, tenant);
  const target = db.collection(`${tenant}-usersApproversResources`);
  let written = 0;

  for (const [resourceId, resourceChanges] of changes) {
    const ref = target.doc(getApproversResourceDocumentId(resourceId));
    // Read, merge and write in one transaction, like /api/approversResources,
    // so an approver an admin adds or removes in Settings while this runs is
    // not overwritten by a stale copy of the doc.
    const { before, after } = await db.runTransaction(async (tx) => {
      const snapshot = await tx.get(ref);
      const current = toApproversResource(
        resourceId,
        snapshot.exists ? snapshot.data() : undefined,
      );
      const next = resourceChanges.reduce(applyApproverChange, current);
      const counts = { before: countEmails(current), after: countEmails(next) };
      const changed =
        counts.before.resource !== counts.after.resource ||
        counts.before.service !== counts.after.service;
      if (changed && !dryRun) {
        tx.set(ref, {
          ...next,
          updatedAt: admin.firestore.Timestamp.now(),
          updatedBy: "migrateApproversResources",
        });
      }
      return counts;
    });
    if (
      before.resource === after.resource &&
      before.service === after.service
    ) {
      console.log(`  =  ${resourceId}: already migrated`);
      continue;
    }
    console.log(
      `  ✏️  ${resourceId}: resource approvers ${before.resource} → ${after.resource}, service approvers ${before.service} → ${after.service}`,
    );
    written += 1;
  }

  console.log(
    `  ${dryRun ? "would write" : "wrote"} ${written} of ${changes.size} resource docs`,
  );
}

async function main() {
  const options = parseArgs();
  const databaseName = DATABASES[options.database];
  const tenants = options.tenant
    ? [options.tenant]
    : ALLOWED_TENANTS.filter((tenant) => tenant !== "mediaCommons");
  console.log(
    `${options.dryRun ? "🔍 [DRY RUN] " : ""}Migrating approvers into usersApproversResources on ${options.database} (${databaseName}) for ${tenants.join(", ")}`,
  );
  const db = initializeDb(databaseName);
  for (const tenant of tenants) {
    await migrateTenant(db, tenant, options.dryRun);
  }
  console.log("\n✅ Done");
}

main().catch((error) => {
  console.error("❌ Migration failed:", error);
  process.exit(1);
});
