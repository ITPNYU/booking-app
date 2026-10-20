import { NextRequest, NextResponse } from "next/server";
import { TableNames } from "@/components/src/policy";
import { requireSuperAdmin } from "@/lib/api/requireSuperAdmin";
import admin from "@/lib/firebase/server/firebaseAdmin";
import { coerceTenantSchema } from "@/lib/tenant/coerceTenantSchema";
import { listTenantSchemaIds } from "@/lib/tenant/listTenantSchemaIds";
import { isCreatableTenantSlug } from "@/lib/tenant/tenantSlug";

function alreadyExists(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: unknown }).code;
  return code === 6 || code === "already-exists" || code === "ALREADY_EXISTS";
}

/**
 * GET /api/tenantSchema
 * Super-only list of schema document ids, including `_template` when present.
 */
export async function GET() {
  const auth = await requireSuperAdmin();
  if ("error" in auth) return auth.error;

  try {
    const ids = await listTenantSchemaIds();
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
 * Creates one tenant schema document from the reviewed JSON.
 * Does not update an existing document and does not write `_template`.
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

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json(
      { error: "Schema must be a JSON object" },
      { status: 400 },
    );
  }

  const schema = body as Record<string, unknown>;
  const tenantId =
    typeof schema.tenantId === "string" ? schema.tenantId.trim() : "";
  if (!isCreatableTenantSlug(tenantId)) {
    return NextResponse.json(
      { error: `Invalid tenant slug: ${tenantId || "(empty)"}` },
      { status: 400 },
    );
  }

  try {
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

    try {
      await admin
        .firestore()
        .collection(TableNames.TENANT_SCHEMA)
        .doc(tenantId)
        .create(schema);
    } catch (error) {
      if (alreadyExists(error)) {
        return NextResponse.json(
          { error: `Tenant schema already exists: ${tenantId}` },
          { status: 409 },
        );
      }
      throw error;
    }
    return NextResponse.json({ success: true, tenantId });
  } catch (error) {
    console.error("Error creating tenant schema:", error);
    return NextResponse.json(
      { error: "Failed to create tenant schema" },
      { status: 500 },
    );
  }
}
