/**
 * Wire format shared between the browser-side `lib/firebase/firebase.ts`
 * helpers and the `/api/firestore/*` routes that proxy them through the
 * Firebase Admin SDK.
 */

export type WhereOp =
  | "=="
  | "!="
  | "<"
  | "<="
  | ">"
  | ">="
  | "in"
  | "not-in"
  | "array-contains"
  | "array-contains-any";

export type WhereSpec = {
  field: string;
  op: WhereOp;
  /**
   * Plain JSON value, or `{ __ts: <epochMs> }` for Firestore Timestamp values.
   * Server reconstructs Timestamps via `admin.firestore.Timestamp.fromMillis`.
   */
  value: unknown;
};

export type OrderBySpec = {
  field: string;
  direction?: "asc" | "desc";
};

export type ListRequest = {
  collection: string;
  tenant?: string;
  where?: WhereSpec[];
  orderBy?: OrderBySpec;
  limit?: number;
};

export type GetDocRequest = {
  collection: string;
  tenant?: string;
  docId: string;
};

export type PaginatedRequest = {
  collection: string;
  tenant?: string;
  /**
   * Filters as defined in `components/src/types.ts`.
   * `dateRange` Date values come through as ISO strings via JSON.stringify.
   */
  filters: {
    dateRange?: Array<string | null> | string;
    sortField: string;
    searchQuery?: string;
  };
  limit?: number;
  /** lastVisible[sortField] value used for startAfter cursor. */
  lastVisible?: Record<string, unknown> | null;
};

export type MutateRequest =
  | {
      op: "create";
      collection: string;
      tenant?: string;
      data: Record<string, unknown>;
    }
  | {
      op: "update";
      collection: string;
      tenant?: string;
      docId: string;
      data: Record<string, unknown>;
    }
  | {
      op: "delete";
      collection: string;
      tenant?: string;
      docId: string;
    };

export type UserRightsRequest =
  | {
      action: "save";
      collection: string;
      tenant?: string;
      data: Record<string, unknown>;
    }
  | {
      action: "delete";
      collection: string;
      tenant?: string;
      docId: string;
    }
  | {
      action: "upsertFlag";
      email: string;
      flag: string;
      tenant?: string;
    }
  | {
      action: "clearFlag";
      docId: string;
      flag: string;
      tenant?: string;
    };

/** Wrap a Firestore Timestamp / Date / epoch ms for the wire. */
export function wrapTimestamp(value: Date | number | { toMillis(): number }): {
  __ts: number;
} {
  if (typeof value === "number") return { __ts: value };
  if (value instanceof Date) return { __ts: value.getTime() };
  return { __ts: value.toMillis() };
}
