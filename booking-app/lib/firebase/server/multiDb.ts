import admin from "./firebaseAdmin";

const DATABASE_IDS: Record<string, string> = {
  development: "default",
  staging: "booking-app-staging",
  production: "booking-app-prod",
};

export type Environment = keyof typeof DATABASE_IDS;

export const ENVIRONMENTS = Object.keys(DATABASE_IDS) as Environment[];

/**
 * Get a Firestore instance for a specific environment.
 * Creates a named Firebase app per environment so multiple databases
 * can be accessed concurrently within the same request.
 */
export function getFirestoreForEnv(
  env: Environment,
): admin.firestore.Firestore {
  const databaseId = DATABASE_IDS[env];
  if (!databaseId) {
    throw new Error(`Unknown environment: ${env}`);
  }

  const appName = `multi-db-${env}`;
  let app: admin.app.App;

  try {
    app = admin.app(appName);
  } catch {
    const defaultApp = admin.app();
    app = admin.initializeApp(defaultApp.options, appName);
  }

  const db = app.firestore();
  if (databaseId !== "default") {
    try {
      db.settings({ databaseId });
    } catch {
      // settings already applied
    }
  }
  return db;
}

/**
 * Get a tenant schema document from a specific environment's database.
 */
export async function getSchemaFromEnv(
  env: Environment,
  tenant: string,
): Promise<Record<string, unknown> | null> {
  const db = getFirestoreForEnv(env);
  const doc = await db.collection("tenantSchema").doc(tenant).get();
  return doc.exists ? (doc.data() as Record<string, unknown>) : null;
}
