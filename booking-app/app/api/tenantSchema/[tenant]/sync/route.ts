import { NextRequest, NextResponse } from "next/server";
import { serverFetchAllDataFromCollection } from "@/lib/firebase/server/adminDb";
import { TableNames } from "@/components/src/policy";
import { getFirestore } from "firebase-admin/firestore";

const DATABASES: Record<string, string> = {
  development: "(default)",
  staging: "booking-app-staging",
  production: "booking-app-prod",
};

const BACKUP_COLLECTION = "tenantSchemaBackup";

/**
 * POST /api/tenantSchema/[tenant]/sync
 * Copy a tenant schema from one environment to another with automatic backup.
 *
 * Body: { sourceEnv: string, targetEnv: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string }> },
) {
  try {
    const { tenant } = await params;
    const { sourceEnv, targetEnv } = await request.json();

    // Validate environments
    if (!DATABASES[sourceEnv] || !DATABASES[targetEnv]) {
      return NextResponse.json(
        {
          error: `Invalid environment. Valid: ${Object.keys(DATABASES).join(", ")}`,
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

    // Verify super admin permission
    const userEmail = request.headers.get("x-user-email");
    if (!userEmail) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    const superAdmins = await serverFetchAllDataFromCollection<{
      id: string;
      email: string;
    }>(TableNames.SUPER_ADMINS);
    const isSuperAdmin = superAdmins.some(
      (sa) => sa.email.toLowerCase() === userEmail.toLowerCase(),
    );
    if (!isSuperAdmin) {
      return NextResponse.json(
        { error: "Super admin permission required" },
        { status: 403 },
      );
    }

    // Fetch source schema
    const sourceDb = getFirestore(DATABASES[sourceEnv]);
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
    const targetDb = getFirestore(DATABASES[targetEnv]);

    // Backup existing target schema before overwriting
    const targetDoc = await targetDb
      .collection(TableNames.TENANT_SCHEMA)
      .doc(tenant)
      .get();

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

    // Write source schema to target
    await targetDb
      .collection(TableNames.TENANT_SCHEMA)
      .doc(tenant)
      .set(sourceSchema, { merge: false });

    return NextResponse.json({
      success: true,
      tenant,
      sourceEnv,
      targetEnv,
      backupId,
      syncedBy: userEmail,
    });
  } catch (error) {
    console.error("Error syncing tenant schema:", error);
    return NextResponse.json(
      { error: "Failed to sync schema" },
      { status: 500 },
    );
  }
}
