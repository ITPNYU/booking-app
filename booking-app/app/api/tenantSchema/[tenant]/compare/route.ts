import { NextRequest, NextResponse } from "next/server";
import {
  serverFetchAllDataFromCollection,
} from "@/lib/firebase/server/adminDb";
import { TableNames } from "@/components/src/policy";
import admin from "@/lib/firebase/server/firebaseAdmin";

const DATABASES: Record<string, string> = {
  development: "(default)",
  staging: "booking-app-staging",
  production: "booking-app-prod",
};

/**
 * Get a Firestore instance for a specific named database.
 *
 * We create a dedicated named Firebase App per database so that we bypass
 * the default app's `.settings({ databaseId })` override applied in
 * firebaseAdmin.ts.  Without this, `getFirestore("(default)")` on a prod
 * server returns the cached instance that was already redirected to
 * "booking-app-prod", making dev vs prod comparisons show no differences.
 */
function getFirestoreForDatabase(databaseId: string) {
  const appName = `schema-compare-${databaseId}`;
  let app;
  try {
    app = admin.app(appName);
  } catch {
    app = admin.initializeApp(admin.app().options, appName);
  }
  const db = app.firestore();
  if (databaseId !== "(default)") {
    try {
      db.settings({ databaseId });
    } catch {
      // settings() can only be called once per instance — ignore if already set
    }
  }
  return db;
}

async function getSchemaFromDatabase(
  databaseId: string,
  tenant: string,
): Promise<Record<string, any> | null> {
  try {
    const db = getFirestoreForDatabase(databaseId);
    const docRef = db.collection(TableNames.TENANT_SCHEMA).doc(tenant);
    const docSnap = await docRef.get();
    return docSnap.exists ? (docSnap.data() as Record<string, any>) : null;
  } catch (error) {
    console.error(
      `Error fetching schema from ${databaseId} for ${tenant}:`,
      error,
    );
    return null;
  }
}

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
      Object.entries(DATABASES).map(async ([env, dbId]) => {
        const schema = await getSchemaFromDatabase(dbId, tenant);
        return [env, schema] as const;
      }),
    );

    const schemas: Record<string, Record<string, any> | null> = {};
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
