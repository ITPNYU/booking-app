import admin from "@/lib/firebase/server/firebaseAdmin";
import { getTenantCollectionName } from "@/components/src/policy";
import type { OrderBySpec, WhereSpec } from "@/lib/api/firestoreShared";

/** Resolve the tenant-prefixed collection name (mirrors getTenantCollectionName). */
export function resolveCollectionName(
  baseCollection: string,
  tenant?: string,
): string {
  return getTenantCollectionName(baseCollection, tenant);
}

/**
 * Convert a wire-format value back into the Firestore-native form.
 *
 * Recognises three serialized Timestamp shapes:
 *  - `{ __ts: <epochMs> }` — the explicit wrapper produced by `wrapTimestamp`
 *  - `{ seconds, nanoseconds }` — what the client SDK's Timestamp.toJSON() emits
 *  - `{ _seconds, _nanoseconds }` — what admin SDK's Timestamp serializes as
 *
 * Also recurses into objects/arrays so nested fields in write payloads are
 * normalised.
 */
export function reviveValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(reviveValue);
  if (typeof value !== "object") return value;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj);

  if (keys.length === 1 && "__ts" in obj) {
    return admin.firestore.Timestamp.fromMillis(obj.__ts as number);
  }
  if (
    keys.length === 2 &&
    typeof obj.seconds === "number" &&
    typeof obj.nanoseconds === "number"
  ) {
    return new admin.firestore.Timestamp(
      obj.seconds as number,
      obj.nanoseconds as number,
    );
  }
  if (
    keys.length === 2 &&
    typeof obj._seconds === "number" &&
    typeof obj._nanoseconds === "number"
  ) {
    return new admin.firestore.Timestamp(
      obj._seconds as number,
      obj._nanoseconds as number,
    );
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = reviveValue(v);
  }
  return out;
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
