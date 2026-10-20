import { TableNames } from "@/components/src/policy";
import admin from "@/lib/firebase/server/firebaseAdmin";

/** Document ids in `tenantSchema`, including `_template` when it exists. */
export async function listTenantSchemaIds(): Promise<string[]> {
  const snapshot = await admin
    .firestore()
    .collection(TableNames.TENANT_SCHEMA)
    .select("tenantId")
    .get();
  return snapshot.docs.map((doc) => doc.id).sort((a, b) => a.localeCompare(b));
}
