import { NextRequest, NextResponse } from "next/server";
import {
  serverGetDocumentById,
  serverSaveDataToFirestoreWithId,
} from "@/lib/firebase/server/adminDb";
import { TableNames } from "@/components/src/policy";
import { applyEnvironmentCalendarIds } from "@/lib/utils/calendarEnvironment";
import { coerceTenantSchema } from "@/lib/tenant/coerceTenantSchema";
import { isValidTenant } from "@/components/src/constants/tenants";
import admin from "@/lib/firebase/server/firebaseAdmin";
import { requireSession } from "@/lib/api/requireSession";
import { requireSuperAdmin } from "@/lib/api/requireSuperAdmin";
import {
  isTemplateSchemaId,
  plainResource,
  plainResourceDefault,
  TEMPLATE_SCHEMA_ID,
} from "@/lib/tenant/resourceDefault";

async function writeSchemaDocument(
  tenant: string,
  document: Record<string, unknown>,
): Promise<boolean> {
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

  await serverSaveDataToFirestoreWithId(
    TableNames.TENANT_SCHEMA,
    tenant,
    document,
  );

  return backupCreated;
}

async function getTemplateDocument(): Promise<NextResponse> {
  const auth = await requireSuperAdmin(TEMPLATE_SCHEMA_ID);
  if ("error" in auth) return auth.error;

  const rawDoc = await serverGetDocumentById<Record<string, unknown>>(
    TableNames.TENANT_SCHEMA,
    TEMPLATE_SCHEMA_ID,
  );
  if (!rawDoc) {
    return NextResponse.json(
      { error: "Resource default not found" },
      { status: 404 },
    );
  }

  return NextResponse.json(rawDoc);
}

async function putTemplateDocument(request: NextRequest): Promise<NextResponse> {
  const auth = await requireSuperAdmin(TEMPLATE_SCHEMA_ID);
  if ("error" in auth) return auth.error;

  const body = await request.json();
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json(
      { error: "Resource default document must be a JSON object" },
      { status: 400 },
    );
  }

  const resourceDefault = plainResource(
    (body as { resourceDefault?: unknown }).resourceDefault,
  );
  if (!resourceDefault) {
    return NextResponse.json(
      { error: "resourceDefault must be an object" },
      { status: 400 },
    );
  }

  const backupCreated = await writeSchemaDocument(TEMPLATE_SCHEMA_ID, {
    ...(body as Record<string, unknown>),
    resourceDefault,
  });
  return NextResponse.json({ success: true, backupCreated });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string }> },
) {
  try {
    const { tenant } = await params;
    if (isTemplateSchemaId(tenant)) {
      return getTemplateDocument();
    }

    // The schema exposes calendar IDs, email templates, and org mappings, so it
    // requires an authenticated NYU session (the collection is `anyNYU`-read).
    const session = await requireSession();
    if (!session) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    // Fetch the specific schema document using tenant as document ID
    const rawDoc = await serverGetDocumentById<Record<string, unknown>>(
      TableNames.TENANT_SCHEMA,
      tenant,
    );

    if (!rawDoc) {
      return NextResponse.json(
        { error: `Schema not found for tenant: ${tenant}` },
        { status: 404 },
      );
    }

    // Always coerce to the canonical (nested) shape. The schema editor needs
    // the nested shape to render its fields, so it consumes this coerced
    // payload and persists it on save — which is the intended lazy migration of
    // a legacy document to the canonical shape (no data is lost; coercion maps
    // every legacy field across). It is NOT a way to fetch the un-coerced
    // document.
    const schema = coerceTenantSchema(rawDoc, tenant);

    // `raw=1` only skips environment-specific calendar ID rewriting, so the
    // editor saves back the stored calendar IDs rather than env-substituted
    // ones. It does not bypass coercion.
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
    if (isTemplateSchemaId(tenant)) {
      return putTemplateDocument(request);
    }

    // Validate tenant
    if (!isValidTenant(tenant)) {
      return NextResponse.json(
        { error: `Invalid tenant: ${tenant}` },
        { status: 400 },
      );
    }

    // Verify super admin permission from the NextAuth session (server-derived,
    // not a client-supplied header).
    const auth = await requireSuperAdmin(tenant);
    if ("error" in auth) return auth.error;

    const newSchema = await request.json();

    // Enforce tenant id consistency with URL param
    newSchema.tenantId = tenant;

    // Validate before writing. `set()` is a destructive full overwrite and the
    // stored document is re-coerced on every read, so a document that cannot be
    // coerced would 500 every subsequent read and lock the tenant out. Reject it
    // here (400) instead of persisting a tenant-bricking payload.
    try {
      coerceTenantSchema(newSchema, tenant);
    } catch (validationError) {
      return NextResponse.json(
        {
          error: `Invalid schema: ${
            validationError instanceof Error
              ? validationError.message
              : String(validationError)
          }`,
        },
        { status: 400 },
      );
    }

    const backupCreated = await writeSchemaDocument(tenant, newSchema);

    return NextResponse.json({ success: true, backupCreated });
  } catch (error) {
    console.error("Error updating tenant schema:", error);
    return NextResponse.json(
      { error: "Failed to update tenant schema" },
      { status: 500 },
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string }> },
) {
  try {
    const { tenant } = await params;
    if (!isTemplateSchemaId(tenant)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const auth = await requireSuperAdmin(TEMPLATE_SCHEMA_ID);
    if ("error" in auth) return auth.error;

    const body = await request.json().catch(() => null);
    if (
      !body ||
      typeof body !== "object" ||
      (body as { action?: unknown }).action !== "initialize-resource-default"
    ) {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    const existing = await serverGetDocumentById<Record<string, unknown>>(
      TableNames.TENANT_SCHEMA,
      TEMPLATE_SCHEMA_ID,
    );
    if (plainResource(existing?.resourceDefault)) {
      return NextResponse.json(
        { error: "Resource default already exists" },
        { status: 409 },
      );
    }

    const backupCreated = await writeSchemaDocument(TEMPLATE_SCHEMA_ID, {
      ...(existing ?? {}),
      resourceDefault: plainResourceDefault(),
    });
    return NextResponse.json({ success: true, backupCreated });
  } catch (error) {
    console.error("Error initializing resource default:", error);
    return NextResponse.json(
      { error: "Failed to initialize resource default" },
      { status: 500 },
    );
  }
}
