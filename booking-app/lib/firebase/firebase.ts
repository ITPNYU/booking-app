import {
  ApproverLevel,
  TableNames,
  getTenantCollectionName,
} from "@/components/src/policy";
import { Timestamp } from "firebase/firestore";

import { Filters } from "@/components/src/types";
import { SchemaContextType } from "@/components/src/client/routes/components/SchemaProvider";
import {
  USER_RIGHT_FLAG_FIELDS,
  type UserRightFlagField,
} from "@/lib/firebase/userRightsConstants";
import type {
  GetDocRequest,
  ListRequest,
  MutateRequest,
  PaginatedRequest,
  UserRightsRequest,
  WhereSpec,
} from "@/lib/api/firestoreShared";

export { USER_RIGHT_FLAG_FIELDS };
export type { UserRightFlagField };

// Utility function to get current tenant from URL
export const getCurrentTenant = (): string | undefined => {
  if (typeof window !== "undefined") {
    const { pathname } = window.location;
    const tenantMatch = pathname.match(/^\/([^\/]+)/);
    return tenantMatch ? tenantMatch[1] : undefined;
  }
  return undefined;
};

// Helper function to get tenant-specific collection name
export const getTenantCollection = (
  baseCollection: string,
  tenant?: string,
): string => {
  const tenantToUse = tenant || getCurrentTenant();
  return getTenantCollectionName(baseCollection, tenantToUse);
};

export type AdminUserData = {
  email: string;
  createdAt: Timestamp;
};

/**
 * Walk the parsed JSON tree and convert serialized Firestore Timestamps
 * back into `Timestamp` instances. The admin SDK serializes Timestamp as
 * `{ _seconds, _nanoseconds }`; the client SDK's Timestamp class restores
 * `.toDate()` / `.toMillis()` semantics.
 */
function reviveTimestamps(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(reviveTimestamps);
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (
      typeof obj._seconds === "number" &&
      typeof obj._nanoseconds === "number" &&
      Object.keys(obj).length === 2
    ) {
      return new Timestamp(obj._seconds, obj._nanoseconds);
    }
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      out[k] = reviveTimestamps(v);
    }
    return out;
  }
  return value;
}

/**
 * The old client-SDK helpers fell back to `getCurrentTenant()` when an
 * explicit `tenant` arg was omitted. Preserve that contract so call sites
 * inside a tenant subtree still hit the right collection without changes.
 */
function resolveTenantArg(tenant?: string): string | undefined {
  return tenant ?? getCurrentTenant();
}

async function postJson<TBody, TResp = unknown>(
  url: string,
  body: TBody,
): Promise<TResp> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let detail = "";
    try {
      detail = (await res.json()).error ?? "";
    } catch {}
    throw new Error(
      `Firestore proxy ${url} failed: ${res.status}${detail ? ` ${detail}` : ""}`,
    );
  }
  const parsed = await res.json();
  return reviveTimestamps(parsed) as TResp;
}

export const clientDeleteDataFromFirestore = async (
  collectionName: string,
  docId: string,
  tenant?: string,
) => {
  try {
    await postJson<MutateRequest>("/api/firestore/mutate", {
      op: "delete",
      collection: collectionName,
      tenant: resolveTenantArg(tenant),
      docId,
    });
    console.log("Document successfully deleted with ID:", docId);
  } catch (error) {
    console.error("Error deleting document: ", error);
  }
};

export const clientDeleteUserRightsData = async (
  collectionName: TableNames,
  docId: string,
  tenant?: string,
) => {
  try {
    await postJson<UserRightsRequest>("/api/firestore/userRights", {
      action: "delete",
      collection: collectionName,
      docId,
      tenant: resolveTenantArg(tenant),
    });
    console.log("Document successfully deleted with ID:", docId);
  } catch (error) {
    console.error("Error deleting document: ", error);
    throw error;
  }
};

export const clientSaveDataToFirestore = async (
  collectionName: string,
  data: object,
  tenant?: string,
) => {
  try {
    const { id } = await postJson<MutateRequest, { id: string }>(
      "/api/firestore/mutate",
      {
        op: "create",
        collection: collectionName,
        tenant: resolveTenantArg(tenant),
        data: data as Record<string, unknown>,
      },
    );
    console.log("Document successfully written with ID:", id);
  } catch (error) {
    console.error("Error writing document: ", error);
  }
};

export const clientSaveUserRightsData = async (
  collectionName: TableNames,
  data: object,
  tenant?: string,
) => {
  try {
    await postJson<UserRightsRequest>("/api/firestore/userRights", {
      action: "save",
      collection: collectionName,
      tenant: resolveTenantArg(tenant),
      data: data as Record<string, unknown>,
    });
  } catch (error) {
    console.error("Error writing document: ", error);
    throw error;
  }
};

export const clientUpsertUserRightFlag = async (
  email: string,
  flag: UserRightFlagField,
  tenant?: string,
) => {
  const trimmedEmail = email.trim();
  if (!trimmedEmail) {
    throw new Error("Email is required");
  }
  await postJson<UserRightsRequest>("/api/firestore/userRights", {
    action: "upsertFlag",
    email: trimmedEmail,
    flag,
    tenant: resolveTenantArg(tenant),
  });
};

export const clientClearUserRightFlag = async (
  docId: string,
  flag: UserRightFlagField,
  tenant?: string,
) => {
  await postJson<UserRightsRequest>("/api/firestore/userRights", {
    action: "clearFlag",
    docId,
    flag,
    tenant: resolveTenantArg(tenant),
  });
};

export const clientFetchAllDataFromCollection = async <T>(
  collectionName: TableNames,
  whereSpecs: WhereSpec[] = [],
  tenant?: string,
): Promise<T[]> => {
  const { docs } = await postJson<
    ListRequest,
    { docs: Array<Record<string, unknown> & { id: string }> }
  >("/api/firestore/list", {
    collection: collectionName,
    tenant: resolveTenantArg(tenant),
    where: whereSpecs,
  });
  return docs as unknown as T[];
};

export const clientFetchAllDataFromCollectionWithLimitAndOffset = async <T>(
  collectionName: TableNames,
  limitNumber: number,
  offset: number,
  tenant?: string,
): Promise<T[]> => {
  const { docs } = await postJson<
    ListRequest,
    { docs: Array<Record<string, unknown> & { id: string }> }
  >("/api/firestore/list", {
    collection: collectionName,
    tenant: resolveTenantArg(tenant),
    where: [{ field: "offset", op: ">=", value: offset }],
    limit: limitNumber,
  });
  return docs as unknown as T[];
};

export const getPaginatedData = async <T>(
  collectionName: string,
  itemsPerPage: number = 10,
  filters: Filters,
  lastVisible: Record<string, unknown> | null = null,
  tenant?: string,
): Promise<T[]> => {
  // Convert Date values in filters.dateRange to ISO strings for the wire.
  const dateRange = Array.isArray(filters.dateRange)
    ? filters.dateRange.map((d: any) =>
        d instanceof Date ? d.toISOString() : d == null ? null : String(d),
      )
    : (filters.dateRange as unknown as string | undefined);

  // Convert Timestamp on the cursor to {__ts}.
  let serializedLast: Record<string, unknown> | null = null;
  if (lastVisible) {
    const cursorValue = lastVisible[filters.sortField];
    if (cursorValue && typeof (cursorValue as any).toMillis === "function") {
      serializedLast = {
        [filters.sortField]: { __ts: (cursorValue as Timestamp).toMillis() },
      };
    } else if (cursorValue instanceof Date) {
      serializedLast = {
        [filters.sortField]: { __ts: cursorValue.getTime() },
      };
    } else {
      serializedLast = { [filters.sortField]: cursorValue };
    }
  }

  try {
    const { docs } = await postJson<
      PaginatedRequest,
      { docs: Array<Record<string, unknown> & { id: string }> }
    >("/api/firestore/paginated", {
      collection: collectionName,
      tenant: resolveTenantArg(tenant),
      filters: {
        dateRange: dateRange as any,
        sortField: filters.sortField,
        searchQuery: (filters as any).searchQuery,
      },
      limit: itemsPerPage,
      lastVisible: serializedLast,
    });
    return docs as unknown as T[];
  } catch (error) {
    console.error("Error getting paginated data:", error);
    throw error;
  }
};

export const clientGetFinalApproverEmailFromDatabase = async (): Promise<
  string | null
> => {
  try {
    const { docs } = await postJson<
      ListRequest,
      { docs: Array<{ email?: string }> }
    >("/api/firestore/list", {
      collection: TableNames.APPROVERS,
      where: [{ field: "level", op: "==", value: ApproverLevel.FINAL }],
    });
    if (docs.length > 0 && docs[0].email) return docs[0].email;
    return null;
  } catch (error) {
    console.error("Error fetching finalApproverEmail:", error);
    return null;
  }
};

export const clientGetDataByCalendarEventId = async <T>(
  collectionName: TableNames,
  calendarEventId: string,
  tenant?: string,
): Promise<(T & { id: string }) | null> => {
  try {
    const { docs } = await postJson<
      ListRequest,
      { docs: Array<Record<string, unknown> & { id: string }> }
    >("/api/firestore/list", {
      collection: collectionName,
      tenant: resolveTenantArg(tenant),
      where: [
        { field: "calendarEventId", op: "==", value: calendarEventId },
      ],
      limit: 1,
    });
    if (docs.length === 0) return null;
    return docs[0] as unknown as T & { id: string };
  } catch (error) {
    console.error("Error getting data by calendar event ID:", error);
    return null;
  }
};

export const clientUpdateDataInFirestore = async (
  collectionName: string,
  docId: string,
  updatedData: object,
  tenant?: string,
) => {
  try {
    await postJson<MutateRequest>("/api/firestore/mutate", {
      op: "update",
      collection: collectionName,
      tenant: resolveTenantArg(tenant),
      docId,
      data: updatedData as Record<string, unknown>,
    });
    console.log("Document successfully updated with ID:", docId);
  } catch (error) {
    console.error("Error updating document: ", error);
  }
};

export const clientGetTenantSchema = async (
  tenant: string,
): Promise<SchemaContextType | null> => {
  try {
    const { doc } = await postJson<
      GetDocRequest,
      { doc: (Record<string, unknown> & { id: string }) | null }
    >("/api/firestore/getDoc", {
      collection: "tenantSchema",
      docId: tenant,
    });
    if (!doc) {
      console.log(`No schema found for tenant: ${tenant}`);
      return null;
    }
    return doc as unknown as SchemaContextType;
  } catch (error) {
    console.error("Error fetching tenant schema:", error);
    return null;
  }
};
