import { NextRequest, NextResponse } from "next/server";
import {
  serverFetchAllDataFromCollection,
} from "@/lib/firebase/server/adminDb";
import { TableNames } from "@/components/src/policy";
import {
  getSchemaFromEnv,
  ENVIRONMENTS,
} from "@/lib/firebase/server/multiDb";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenant: string }> },
) {
  try {
    const { tenant } = await params;

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

    // Fetch schemas from all environments in parallel
    const results = await Promise.all(
      ENVIRONMENTS.map(async (env) => {
        const schema = await getSchemaFromEnv(env, tenant);
        return [env, schema] as const;
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
