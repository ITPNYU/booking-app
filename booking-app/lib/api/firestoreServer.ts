import admin from "@/lib/firebase/server/firebaseAdmin";
import { getTenantCollectionName } from "@/components/src/policy";
import type { OrderBySpec, WhereSpec } from "@/lib/api/firestoreShared";
import { reviveSerializedTimestamps } from "@/lib/utils/timestampWire";

/** Resolve the tenant-prefixed collection name (mirrors getTenantCollectionName). */
export function resolveCollectionName(
  baseCollection: string,
  tenant?: string,
): string {
  return getTenantCollectionName(baseCollection, tenant);
}

/**
 * Convert a wire-format value back into the Firestore-native form by
 * replacing any serialized Timestamp shape with a real admin SDK `Timestamp`.
 * Recognised shapes are documented on `reviveSerializedTimestamps` in
 * `@/lib/utils/timestampWire`.
 */
export function reviveValue(value: unknown): unknown {
  return reviveSerializedTimestamps(
    value,
    (s, n) => new admin.firestore.Timestamp(s, n),
  );
}

/** Apply the where/orderBy/limit clauses described by the wire request. */
export function applyQuery(
  base: FirebaseFirestore.Query,
  spec: { where?: WhereSpec[]; orderBy?: OrderBySpec; limit?: number },
): FirebaseFirestore.Query {
  let q = base;
  if (spec.where) {
    for (const clause of spec.where) {
      q = q.where(clause.field, clause.op, reviveValue(clause.value));
    }
  }
  if (spec.orderBy) {
    q = q.orderBy(spec.orderBy.field, spec.orderBy.direction ?? "asc");
  }
  if (typeof spec.limit === "number") {
    q = q.limit(spec.limit);
  }
  return q;
}

/** Fetch all documents matching a query, returning `{id, ...data}` shape. */
export async function listDocs(
  baseCollection: string,
  tenant: string | undefined,
  spec: { where?: WhereSpec[]; orderBy?: OrderBySpec; limit?: number },
): Promise<Array<Record<string, unknown> & { id: string }>> {
  const collectionName = resolveCollectionName(baseCollection, tenant);
  const colRef = admin.firestore().collection(collectionName);
  const q = applyQuery(colRef, spec);
  const snapshot = await q.get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}
