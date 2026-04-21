import admin from "./firebaseAdmin";
import { getFirestore } from "firebase-admin/firestore";
import { DATABASES } from "./databases";
import { TableNames } from "@/components/src/policy";

export type Environment = keyof typeof DATABASES;

export const ENVIRONMENTS = Object.keys(DATABASES) as Environment[];

/**
 * Get a Firestore instance for a specific environment's database.
 * Uses getFirestore(app, databaseId) so no named apps or settings() calls are needed.
 */
export function getFirestoreForEnv(
  env: Environment,
): admin.firestore.Firestore {
  const databaseId = DATABASES[env];
  if (!databaseId) {
    throw new Error(`Unknown environment: ${env}`);
  }

  return getFirestore(admin.app(), databaseId);
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
