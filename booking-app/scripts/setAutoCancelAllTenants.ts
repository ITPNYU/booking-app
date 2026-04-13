/**
 * Bulk set autoCancel config on all tenant schemas.
 *
 * Usage:
 *   npx ts-node --transpile-only scripts/setAutoCancelAllTenants.ts --dry-run
 *   npx ts-node --transpile-only scripts/setAutoCancelAllTenants.ts
 *
 * Notes:
 * - Reads Firebase credentials from .env.local (same as other scripts).
 * - Writes are merge:true (non-destructive).
 */

import dotenv from "dotenv";
import admin from "firebase-admin";

dotenv.config({ path: ".env.local" });

type AutoCancelConfig =
  | false
  | {
      minutesPriorToStart: number;
      conditions: { requested: boolean; preApproved: boolean };
    };

const TENANT_SCHEMA_COLLECTION = "tenantSchema";

function parseArgs() {
  const argv = process.argv.slice(2);
  const args = new Set(argv);
  const tenantIdx = argv.findIndex((a) => a === "--tenant");
  const tenant = tenantIdx >= 0 ? argv[tenantIdx + 1] : undefined;
  return { dryRun: args.has("--dry-run"), tenant };
}

function initializeDb() {
  if (!admin.apps?.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      }),
    });
  }
  return admin.firestore();
}

function isEqualAutoCancel(a: unknown, b: AutoCancelConfig): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b);
}

async function main() {
  const { dryRun, tenant } = parseArgs();

  const desired: AutoCancelConfig = {
    minutesPriorToStart: 60,
    conditions: { requested: true, preApproved: true },
  };

  const db = initializeDb();

  const collectionRef = db.collection(TENANT_SCHEMA_COLLECTION);
  const snapshot = tenant
    ? await collectionRef.doc(tenant).get().then((doc) => ({
        empty: !doc.exists,
        docs: doc.exists ? [doc] : [],
      }))
    : await collectionRef.get();

  if ((snapshot as any).empty) {
    console.log(tenant ? `Tenant schema not found: ${tenant}` : "No tenant schemas found.");
    process.exit(0);
  }

  const changes: Array<{
    tenant: string;
    current: unknown;
    willChange: boolean;
  }> = [];

  for (const doc of (snapshot as any).docs) {
    const tenantId = doc.id;
    const data = doc.data() as Record<string, any>;
    const current = data.autoCancel;
    const willChange = !isEqualAutoCancel(current, desired);

    changes.push({ tenant: tenantId, current, willChange });
  }

  const toUpdate = changes.filter((c) => c.willChange);

  console.log(
    `${dryRun ? "[DRY RUN] " : ""}autoCancel bulk update plan: ${toUpdate.length}/${changes.length} tenant schema(s) would change.`,
  );

  toUpdate.forEach((c) => {
    console.log(`- ${c.tenant}: autoCancel ${JSON.stringify(c.current ?? null)} -> ${JSON.stringify(desired)}`);
  });

  if (dryRun) return;

  for (const c of toUpdate) {
    await db
      .collection(TENANT_SCHEMA_COLLECTION)
      .doc(c.tenant)
      .set({ autoCancel: desired }, { merge: true });
    console.log(`✅ Updated ${c.tenant}`);
  }
}

main().catch((err) => {
  console.error("Bulk autoCancel update failed:", err);
  process.exit(1);
});

