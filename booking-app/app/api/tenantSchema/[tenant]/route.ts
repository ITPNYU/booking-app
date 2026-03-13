import { NextRequest, NextResponse } from "next/server";
import {
  serverGetDocumentById,
  serverSaveDataToFirestoreWithId,
  serverFetchAllDataFromCollection,
} from "@/lib/firebase/server/adminDb";
import { TableNames } from "@/components/src/policy";
import { applyEnvironmentCalendarIds } from "@/lib/utils/calendarEnvironment";
import { isValidTenant } from "@/components/src/constants/tenants";
import admin from "@/lib/firebase/server/firebaseAdmin";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string }> },
) {
  try {
    const { tenant } = await params;

    // Fetch the specific schema document using tenant as document ID
    const schema = await serverGetDocumentById(
      TableNames.TENANT_SCHEMA,
      tenant,
    );

    if (!schema) {
      return NextResponse.json(
        { error: `Schema not found for tenant: ${tenant}` },
        { status: 404 },
      );
    }

    // Skip environment calendar ID rewriting when raw=1 is requested
    // (used by schema editor to avoid data corruption on round-trip)
    const raw = request.nextUrl.searchParams.get("raw") === "1";
    if (!raw && schema.resources && Array.isArray(schema.resources)) {
      schema.resources = applyEnvironmentCalendarIds(schema.resources);
    }

    return NextResponse.json(schema);
  } catch (error) {
    console.error("Error fetching tenant schema:", error);
    return NextResponse.json(
      { error: "Failed to fetch tenant schema" },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string }> },
) {
  try {
    const { tenant } = await params;

    // Validate tenant
    if (!isValidTenant(tenant)) {
      return NextResponse.json(
        { error: `Invalid tenant: ${tenant}` },
        { status: 400 },
      );
    }

    // Verify super admin permission via email header
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

    const newSchema = await request.json();

    // Enforce tenant field consistency with URL param
    newSchema.tenant = tenant;

    // Backup current schema before overwriting
    const existingSchema = await serverGetDocumentById(
      TableNames.TENANT_SCHEMA,
      tenant,
    );

    let backupCreated = false;
    if (existingSchema) {
      const db = admin.firestore();
      const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, "-")
        .replace("T", "_")
        .replace("Z", "");
      const backupDocId = `${tenant}-backup-ui-edit-${timestamp}`;
      await db
        .collection("tenantSchemaBackup")
        .doc(backupDocId)
        .set(existingSchema, { merge: false });
      backupCreated = true;
    }

    // Write the updated schema
    await serverSaveDataToFirestoreWithId(
      TableNames.TENANT_SCHEMA,
      tenant,
      newSchema,
    );

    return NextResponse.json({ success: true, backupCreated });
  } catch (error) {
    console.error("Error updating tenant schema:", error);
    return NextResponse.json(
      { error: "Failed to update tenant schema" },
      { status: 500 },
    );
  }
}
