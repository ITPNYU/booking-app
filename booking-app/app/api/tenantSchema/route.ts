import { NextRequest, NextResponse } from "next/server";
import { generateDefaultSchema } from "@/components/src/client/routes/components/schemaTypes";
import { TableNames } from "@/components/src/policy";
import { requireSuperAdmin } from "@/lib/api/requireSuperAdmin";
import {
  serverGetDocumentById,
  serverSaveDataToFirestoreWithId,
} from "@/lib/firebase/server/adminDb";
import { coerceTenantSchema } from "@/lib/tenant/coerceTenantSchema";
import { listTenantSchemaDocuments } from "@/lib/tenant/listTenantSchemas";
import { identityFieldError } from "@/lib/tenant/tenantIdentity";
import {
  TEMPLATE_SCHEMA_ID,
  isCreatableTenantSlug,
  isTemplateSchemaId,
} from "@/lib/tenant/tenantSlug";

/**
 * GET /api/tenantSchema
 * Super-only list of schema document ids, including `_template` when present.
 */
export async function GET() {
  const auth = await requireSuperAdmin();
  if ("error" in auth) return auth.error;

  try {
    const docs = await listTenantSchemaDocuments();
    const ids = docs.map((doc) => doc.id);
    return NextResponse.json({ ids });
  } catch (error) {
    console.error("Error listing tenant schemas:", error);
    return NextResponse.json(
      { error: "Failed to list tenant schemas" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/tenantSchema
 * `{ action: "initialize-template" }` writes `_template` from code defaults
 * only when that document is absent.
 * Any other body is a new tenant schema, validated and written after the
 * client has already confirmed it.
 */
export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin();
  if ("error" in auth) return auth.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (
    body &&
    typeof body === "object" &&
    !Array.isArray(body) &&
    (body as { action?: unknown }).action === "initialize-template"
  ) {
    return initializeTemplate();
  }

  return createTenantSchema(body);
}

async function initializeTemplate() {
  const existing = await serverGetDocumentById(
    TableNames.TENANT_SCHEMA,
    TEMPLATE_SCHEMA_ID,
  );
  if (existing) {
    return NextResponse.json(
      { error: "Template schema already exists" },
      { status: 409 },
    );
  }

  const schema = JSON.parse(
    JSON.stringify(generateDefaultSchema(TEMPLATE_SCHEMA_ID)),
  ) as ReturnType<typeof generateDefaultSchema>;
  await serverSaveDataToFirestoreWithId(
    TableNames.TENANT_SCHEMA,
    TEMPLATE_SCHEMA_ID,
    schema,
  );
  return NextResponse.json({ success: true, tenantId: TEMPLATE_SCHEMA_ID });
}

async function createTenantSchema(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json(
      { error: "Schema must be a JSON object" },
      { status: 400 },
    );
  }

  const schema = body as Record<string, unknown>;
  const tenantId = typeof schema.tenantId === "string" ? schema.tenantId.trim() : "";
  if (!isCreatableTenantSlug(tenantId) || isTemplateSchemaId(tenantId)) {
    return NextResponse.json(
      { error: `Invalid tenant slug: ${tenantId || "(empty)"}` },
      { status: 400 },
    );
  }

  const identityError = identityFieldError(schema);
  if (identityError) {
    return NextResponse.json({ error: identityError }, { status: 400 });
  }

  const existing = await serverGetDocumentById(TableNames.TENANT_SCHEMA, tenantId);
  if (existing) {
    return NextResponse.json(
      { error: `Tenant schema already exists: ${tenantId}` },
      { status: 409 },
    );
  }

  schema.tenantId = tenantId;
  try {
    coerceTenantSchema(schema, tenantId);
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

  await serverSaveDataToFirestoreWithId(
    TableNames.TENANT_SCHEMA,
    tenantId,
    schema,
  );
  return NextResponse.json({ success: true, tenantId });
}
