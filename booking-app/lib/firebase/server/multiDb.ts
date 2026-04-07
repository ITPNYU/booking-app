import admin from "./firebaseAdmin";
import { DATABASES } from "./databases";
import { TableNames } from "@/components/src/policy";

export type Environment = keyof typeof DATABASES;

export const ENVIRONMENTS = Object.keys(DATABASES) as Environment[];

/**
 * Get a Firestore instance for a specific environment.
 * Creates a named Firebase app per environment so multiple databases
 * can be accessed concurrently within the same request.
 */
export function getFirestoreForEnv(
  env: Environment,
): admin.firestore.Firestore {
  const databaseId = DATABASES[env];
  if (!databaseId) {
    throw new Error(`Unknown environment: ${env}`);
  }

  const appName = `multi-db-${env}`;
  let app: admin.app.App;

  try {
    app = admin.app(appName);
  } catch {
    try {
      const defaultApp = admin.app();
      app = admin.initializeApp(defaultApp.options, appName);
    } catch (initError) {
      // Handle race condition: another request may have initialized it
      // between the first admin.app() check and initializeApp().
      if (
        initError instanceof Error &&
        initError.message.includes("already exists")
      ) {
        app = admin.app(appName);
      } else {
        throw initError;
      }
    }
  }

  const db = app.firestore();
  if (databaseId !== "(default)") {
    try {
      db.settings({ databaseId });
    } catch (err) {
      // Only suppress "already called settings" errors
      if (
        !(err instanceof Error) ||
        !err.message.includes("has already been called")
      ) {
        throw err;
      }
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
  const doc = await db.collection(TableNames.TENANT_SCHEMA).doc(tenant).get();
  return doc.exists ? (doc.data() as Record<string, unknown>) : null;
}
