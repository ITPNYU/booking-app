import { NextRequest, NextResponse } from "next/server";
import { isValidTenant } from "@/components/src/constants/tenants";
import {
  getSchemaFromEnv,
  ENVIRONMENTS,
} from "@/lib/firebase/server/multiDb";
import { requireSuperAdmin } from "@/lib/api/requireSuperAdmin";

export async function GET(
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

    // Verify super admin permission from the NextAuth session.
    const auth = await requireSuperAdmin(tenant);
    if ("error" in auth) return auth.error;

    // Fetch schemas from all environments in parallel.
    // Catch per-env errors so one failing environment doesn't break the response.
    const results = await Promise.all(
      ENVIRONMENTS.map(async (env) => {
        try {
          const schema = await getSchemaFromEnv(env, tenant);
          return [env, schema] as const;
        } catch (error) {
          console.error(`Error fetching schema for ${env}/${tenant}:`, error);
          return [env, null] as const;
        }
      }),
    );

    const schemas: Record<string, Record<string, unknown> | null> = {};
    for (const [env, schema] of results) {
      schemas[env] = schema;
    }

    return NextResponse.json(schemas);
  } catch (error) {
    console.error("Error comparing tenant schemas:", error);
    return NextResponse.json(
      { error: "Failed to compare schemas" },
      { status: 500 },
    );
  }
}
