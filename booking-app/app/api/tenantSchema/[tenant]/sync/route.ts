import { NextRequest, NextResponse } from "next/server";
import { TableNames } from "@/components/src/policy";
import { isValidTenant } from "@/components/src/constants/tenants";
import { computeDiffSummary } from "@/lib/utils/schemaDiff";
import { getFirestoreForEnv, ENVIRONMENTS, type Environment } from "@/lib/firebase/server/multiDb";
import { requireSuperAdmin } from "@/lib/api/requireSuperAdmin";

const BACKUP_COLLECTION = "tenantSchemaBackup";

/**
 * POST /api/tenantSchema/[tenant]/sync
 * Copy a tenant schema from one environment to another with automatic backup.
 *
 * Body: { sourceEnv: string, targetEnv: string, dryRun?: boolean }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string }> },
) {
  try {
    const { tenant } = await params;

    if (!isValidTenant(tenant)) {
      return NextResponse.json(
        { error: `Invalid tenant: ${tenant}` },
        { status: 400 },
      );
    }

    const { sourceEnv, targetEnv, dryRun = false } = await request.json();

    // Validate environments
    const isValidEnv = (v: unknown): v is Environment =>
      typeof v === "string" && ENVIRONMENTS.includes(v as Environment);
    if (!isValidEnv(sourceEnv) || !isValidEnv(targetEnv)) {
      return NextResponse.json(
        {
          error: `Invalid environment. Valid: ${ENVIRONMENTS.join(", ")}`,
        },
        { status: 400 },
      );
    }
    if (sourceEnv === targetEnv) {
      return NextResponse.json(
        { error: "Source and target environments must be different" },
        { status: 400 },
      );
    }

    // Verify super admin permission from the NextAuth session.
    const auth = await requireSuperAdmin(tenant);
    if ("error" in auth) return auth.error;
    const userEmail = auth.session.email;

    // Fetch source schema
    const sourceDb = getFirestoreForEnv(sourceEnv);
    const sourceDoc = await sourceDb
      .collection(TableNames.TENANT_SCHEMA)
      .doc(tenant)
      .get();

    if (!sourceDoc.exists) {
      return NextResponse.json(
        { error: `Schema not found in ${sourceEnv} for tenant: ${tenant}` },
        { status: 404 },
      );
    }

    const sourceSchema = sourceDoc.data()!;
    const targetDb = getFirestoreForEnv(targetEnv);

    // Backup existing target schema before overwriting
    const targetDoc = await targetDb
      .collection(TableNames.TENANT_SCHEMA)
      .doc(tenant)
      .get();

    // Compute diff for dry-run report
    const sourceData = sourceSchema as Record<string, unknown>;
    const targetData = (targetDoc.exists ? targetDoc.data() : null) as Record<
      string,
      unknown
    > | null;
    const diffSummary = computeDiffSummary(sourceData, targetData);

    if (dryRun) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        tenant,
        sourceEnv,
        targetEnv,
        targetExists: targetDoc.exists,
        diff: diffSummary,
      });
    }

    let backupId: string | null = null;
    if (targetDoc.exists) {
      const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, "-")
        .replace("T", "_")
        .replace("Z", "");
      backupId = `${tenant}-backup-sync-${timestamp}`;

      await targetDb
        .collection(BACKUP_COLLECTION)
        .doc(backupId)
        .set(
          {
            ...targetDoc.data(),
            _backupMeta: {
              syncedBy: userEmail,
              syncedAt: new Date().toISOString(),
              sourceEnv,
              targetEnv,
            },
          },
          { merge: false },
        );
    }

    // Write source schema to target, enforcing tenant consistency. Use the
    // `tenantId` field the rest of the app reads (coerceTenantSchema reads
    // `raw.tenantId`); writing a stray top-level `tenant` string would clobber
    // the structured `tenant` branding object on the next read.
    await targetDb
      .collection(TableNames.TENANT_SCHEMA)
      .doc(tenant)
      .set({ ...sourceSchema, tenantId: tenant }, { merge: false });

    return NextResponse.json({
      success: true,
      dryRun: false,
      tenant,
      sourceEnv,
      targetEnv,
      backupId,
      syncedBy: userEmail,
      diff: diffSummary,
    });
  } catch (error) {
    console.error("Error syncing tenant schema:", error);
    return NextResponse.json(
      { error: "Failed to sync schema" },
      { status: 500 },
    );
  }
}
