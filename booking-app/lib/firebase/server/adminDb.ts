import {
  ApproverLevel,
  TableNames,
  getServiceApproverDocumentId,
  normalizeApproverEmail,
  getTenantCollectionName,
} from "@/components/src/policy";
import {
  CollectionReference,
  DocumentData,
  FieldValue,
  Query,
  QueryDocumentSnapshot,
  QuerySnapshot,
  WhereFilterOp,
} from "firebase-admin/firestore";

import { BookingLog, BookingStatusLabel } from "@/components/src/types";
import { traceDatabase } from "@/lib/newrelic-utils";
import { serializedTimestampToMillis } from "@/lib/utils/timestampWire";
import admin from "./firebaseAdmin";

const db = admin.firestore();

// Helper function to get tenant-specific collection name for server-side
export const getServerTenantCollection = (
  baseCollection: TableNames,
  tenant?: string,
): string => getTenantCollectionName(baseCollection, tenant);

export type AdminUserData = {
  email: string;
  createdAt: admin.firestore.Timestamp;
};

export type ServiceApproverData = {
  id?: string;
  resourceId: string;
  serviceType: string;
  email: string;
  createdAt?: admin.firestore.Timestamp;
};

export const serverDeleteData = async (
  collectionName: string,
  docId: string,
  tenant?: string,
) => {
  try {
    const tenantCollection = getServerTenantCollection(
      collectionName as TableNames,
      tenant,
    );
    await traceDatabase("delete", `Firestore/${tenantCollection}`, () =>
      db.collection(tenantCollection).doc(docId).delete(),
    );
    console.log("Document successfully deleted with ID:", docId);
  } catch (error) {
    console.error("Error deleting document: ", error);
  }
};

export const serverDeleteDocumentFields = async (
  collectionName: string,
  docId: string,
  fields: string[],
  tenant?: string,
) => {
  try {
    const tenantCollection = getServerTenantCollection(
      collectionName as TableNames,
      tenant,
    );
    const updateData = fields.reduce((acc, field) => {
      acc[field] = FieldValue.delete();
      return acc;
    }, {});

    await traceDatabase("deleteFields", `Firestore/${tenantCollection}`, () =>
      db.collection(tenantCollection).doc(docId).update(updateData),
    );
    console.log("Fields successfully deleted from document:", docId);
  } catch (error) {
    console.error("Error deleting fields from document:", error);
  }
};

export const serverGetNextSequentialId = async (
  collectionName: string,
  tenant?: string,
) => {
  // For counters, we need to use the counters collection, not the target collection
  const counterCollection = getServerTenantCollection(
    "counters" as TableNames,
    tenant,
  );
  const counterDocRef = db.collection(counterCollection).doc(collectionName);
  const counterDoc = await traceDatabase("get", "Firestore/counters", () =>
    counterDocRef.get(),
  );
  let currentCount = 1;
  if (counterDoc.exists) {
    currentCount = (counterDoc.data()?.count || 0) + 1;
  }
  await traceDatabase("set", "Firestore/counters", () =>
    counterDocRef.set({ count: currentCount }, { merge: true }),
  );
  return currentCount;
};

export const serverSaveDataToFirestore = async (
  collectionName: string,
  data: object,
  tenant?: string,
) => {
  try {
    const tenantCollection = getServerTenantCollection(
      collectionName as TableNames,
      tenant,
    );
    const docRef = await traceDatabase("add", `Firestore/${tenantCollection}`, () =>
      db.collection(tenantCollection).add(data),
    );
    console.log("Document successfully written with ID:", docRef.id);
    return docRef;
  } catch (error) {
    console.error("Error writing document: ", error);
    throw error;
  }
};

export const serverSaveDataToFirestoreWithId = async (
  collectionName: string,
  docId: string,
  data: object,
) => {
  try {
    const docRef = db.collection(collectionName).doc(docId);
    await traceDatabase("set", `Firestore/${collectionName}`, () =>
      docRef.set(data),
    );
    console.log("Document successfully written with ID:", docId);
    return docRef;
  } catch (error) {
    console.error("Error writing document: ", error);
    throw error;
  }
};

export const serverListServiceApprovers = async (
  tenant?: string,
): Promise<ServiceApproverData[]> =>
  serverFetchAllDataFromCollection<ServiceApproverData>(
    TableNames.SERVICE_APPROVERS,
    [],
    tenant,
  );

export const serverAddServiceApprover = async (
  resourceId: string,
  serviceType: string,
  email: string,
  tenant?: string,
) => {
  const normalizedResourceId = resourceId.trim();
  const normalizedServiceType = serviceType.trim();
  const normalizedEmail = normalizeApproverEmail(email);
  if (!normalizedResourceId || !normalizedServiceType || !normalizedEmail) {
    throw new Error("Resource, service type, and email are required");
  }
  const tenantCollection = getServerTenantCollection(
    TableNames.SERVICE_APPROVERS,
    tenant,
  );
  const docId = getServiceApproverDocumentId(
    normalizedResourceId,
    normalizedServiceType,
    normalizedEmail,
  );
  await traceDatabase("set", `Firestore/${tenantCollection}`, () =>
    db.collection(tenantCollection).doc(docId).set(
      {
        resourceId: normalizedResourceId,
        serviceType: normalizedServiceType,
        email: normalizedEmail,
        createdAt: admin.firestore.Timestamp.now(),
      },
      { merge: true },
    ),
  );
};

export const serverRemoveServiceApprover = async (
  resourceId: string,
  serviceType: string,
  email: string,
  tenant?: string,
) => {
  const tenantCollection = getServerTenantCollection(
    TableNames.SERVICE_APPROVERS,
    tenant,
  );
  const docId = getServiceApproverDocumentId(resourceId, serviceType, email);
  await traceDatabase("delete", `Firestore/${tenantCollection}`, () =>
    db.collection(tenantCollection).doc(docId).delete(),
  );
};

const dedupeStrings = (values: string[]): string[] =>
  Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));

export const serverResolveServiceApproverEmails = async (
  resourceIds: string[],
  serviceType: string,
  tenant?: string,
): Promise<string[]> => {
  const normalizedResourceIds = dedupeStrings(resourceIds);
  const normalizedServiceType = serviceType.trim();
  if (normalizedResourceIds.length === 0 || !normalizedServiceType) {
    return [];
  }

  const records = await serverFetchAllDataFromCollection<ServiceApproverData>(
    TableNames.SERVICE_APPROVERS,
    [{ field: "serviceType", operator: "==", value: normalizedServiceType }],
    tenant,
  );
  const requestedResourceIds = new Set(normalizedResourceIds);
  const resourceIdsByEmail = new Map<string, Set<string>>();
  records.forEach((record) => {
    if (!requestedResourceIds.has(String(record.resourceId))) return;
    const email = normalizeApproverEmail(record.email);
    const approverResourceIds = resourceIdsByEmail.get(email) ?? new Set<string>();
    approverResourceIds.add(String(record.resourceId));
    resourceIdsByEmail.set(email, approverResourceIds);
  });
  return [...resourceIdsByEmail.entries()]
    .filter(([, approverResourceIds]) =>
      normalizedResourceIds.every((resourceId) =>
        approverResourceIds.has(resourceId),
      ),
    )
    .map(([email]) => email);
};

export const serverIsServiceApproverForAllResources = async (
  email: string,
  resourceIds: string[],
  serviceType: string,
  tenant?: string,
): Promise<boolean> => {
  const normalizedEmail = normalizeApproverEmail(email);
  const normalizedResourceIds = dedupeStrings(resourceIds);
  const normalizedServiceType = serviceType.trim();
  if (
    !normalizedEmail ||
    normalizedResourceIds.length === 0 ||
    !normalizedServiceType
  ) {
    return false;
  }
  const records = await serverFetchAllDataFromCollection<ServiceApproverData>(
    TableNames.SERVICE_APPROVERS,
    [
      { field: "serviceType", operator: "==", value: normalizedServiceType },
      { field: "email", operator: "==", value: normalizedEmail },
    ],
    tenant,
  );
  const approvedResourceIds = new Set(
    records.map((record) => String(record.resourceId)),
  );
  return normalizedResourceIds.every((resourceId) =>
    approvedResourceIds.has(resourceId),
  );
};

export const serverGetDocumentById = async <T extends DocumentData>(
  collectionName: TableNames,
  docId: string,
  tenant?: string,
): Promise<T | null> => {
  try {
    const tenantCollection = getServerTenantCollection(collectionName, tenant);
    const docRef = db.collection(tenantCollection).doc(docId);
    const docSnap = await traceDatabase("get", `Firestore/${tenantCollection}`, () =>
      docRef.get(),
    );

    if (docSnap.exists) {
      return docSnap.data() as T;
    }
    return null;
  } catch (error) {
    console.error("Error fetching document by ID:", error);
    return null;
  }
};

export type Constraint = {
  field: string;
  operator: WhereFilterOp;
  value: any;
};

export const serverFetchAllDataFromCollection = async <T extends DocumentData>(
  collectionName: TableNames,
  queryConstraints: Constraint[] = [],
  tenant?: string,
  maxDocs?: number,
): Promise<T[]> => {
  const tenantCollection = getServerTenantCollection(collectionName, tenant);
  const collectionRef: CollectionReference<T> = db.collection(
    tenantCollection,
  ) as CollectionReference<T>;

  let query: Query<T> = collectionRef;

  queryConstraints.forEach((constraint) => {
    query = query.where(
      constraint.field,
      constraint.operator,
      constraint.value,
    );
  });

  if (maxDocs !== undefined) {
    if (
      typeof maxDocs !== "number" ||
      !Number.isFinite(maxDocs) ||
      !Number.isInteger(maxDocs) ||
      maxDocs < 0
    ) {
      throw new RangeError("maxDocs must be a finite non-negative integer");
    }
    if (maxDocs === 0) {
      return [];
    }
    query = query.limit(maxDocs);
  }

  const snapshot: QuerySnapshot<T> = await traceDatabase(
    "query",
    `Firestore/${tenantCollection}`,
    () => query.get(),
  );

  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};

export const serverGetDataByCalendarEventId = async <T>(
  collectionName: TableNames,
  calendarEventId: string,
  tenant?: string,
) => {
  try {
    const tenantCollection = getServerTenantCollection(collectionName, tenant);
    const snapshot = await traceDatabase(
      "query",
      `Firestore/${tenantCollection}`,
      () =>
        db
          .collection(tenantCollection)
          .where("calendarEventId", "==", calendarEventId)
          .limit(1)
          .get(),
    );
    if (!snapshot.empty) {
      const doc = snapshot.docs[0];
      return { id: doc.id, ...(doc.data() as T) };
    }
    console.log("No such document!");
    return null;
  } catch (error) {
    console.error("Error fetching document: ", error);
    return null;
  }
};

export const serverUpdateInFirestore = async (
  collectionName: string,
  docId: string,
  updatedData: object,
  tenant?: string,
) => {
  try {
    const tenantCollection = getServerTenantCollection(
      collectionName as TableNames,
      tenant,
    );
    await traceDatabase("update", `Firestore/${tenantCollection}`, () =>
      db.collection(tenantCollection).doc(docId).update(updatedData),
    );
    console.log("Document successfully updated with ID:", docId);
  } catch (error) {
    console.error("Error updating document: ", error);
  }
};
export const serverGetFinalApproverEmailFromDatabase = async (
  tenant?: string,
): Promise<string | null> => {
  try {
    const tenantCollection = getServerTenantCollection(
      TableNames.APPROVERS,
      tenant,
    );
    const policyCollection = db.collection(tenantCollection);
    const querySnapshot = await traceDatabase(
      "query",
      `Firestore/${tenantCollection}`,
      () => policyCollection.where("level", "==", ApproverLevel.FINAL).get(),
    );
    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      const finalApproverEmail = doc.data().email;
      if (finalApproverEmail) {
        return finalApproverEmail;
      }
    }
    return null;
  } catch (error) {
    console.error("Error fetching finalApproverEmail:", error);
    return null;
  }
};

export const serverGetFinalApproverEmail = async (
  tenant?: string,
): Promise<string | null> => {
  return serverGetFinalApproverEmailFromDatabase(tenant);
};

export const logServerBookingChange = async ({
  bookingId,
  status,
  changedBy,
  requestNumber,
  calendarEventId,
  note,
  tenant,
}: {
  bookingId: string;
  status: BookingStatusLabel;
  changedBy: string;
  requestNumber: number;
  calendarEventId?: string;
  note?: string;
  tenant?: string;
}) => {
  const logData: Omit<BookingLog, "id"> = {
    bookingId,
    calendarEventId,
    status,
    changedBy,
    changedAt: admin.firestore.Timestamp.now(),
    note: note ?? null,
    requestNumber,
  };

  await serverSaveDataToFirestore(TableNames.BOOKING_LOGS, logData, tenant);
};

export const getBookingLogs = async (
  requestNumber: number,
  tenant?: string,
): Promise<BookingLog[]> => {
  try {
    const tenantCollection = getServerTenantCollection(
      TableNames.BOOKING_LOGS,
      tenant,
    );
    const logsRef = db.collection(tenantCollection);
    const q = logsRef.where("requestNumber", "==", requestNumber);

    const querySnapshot = await traceDatabase(
      "query",
      "Firestore/bookingLogs",
      () => q.get(),
    );

    const results = querySnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        bookingId: data.bookingId,
        calendarEventId: data.calendarEventId,
        status: data.status as BookingStatusLabel,
        changedBy: data.changedBy,
        changedAt: data.changedAt,
        note: data.note || null,
        requestNumber: data.requestNumber,
      } as BookingLog;
    });

    // Sort by changedAt on the application side
    results.sort((a, b) => {
      if (!a.changedAt || !b.changedAt) return 0;
      return a.changedAt.toMillis() - b.changedAt.toMillis();
    });

    return results;
  } catch (error) {
    console.error("Error fetching booking logs:", error);
    throw error;
  }
};

export type LatestBookingStatusLogRequest = {
  calendarEventId: string;
  status: BookingStatusLabel;
};

export type LatestBookingStatusLog = {
  calendarEventId: string;
  status: BookingStatusLabel;
  changedAt: number;
};

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function timestampToMillis(value: any): number | null {
  if (value == null) return null;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.toDate === "function") return value.toDate().getTime();
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return serializedTimestampToMillis(value);
}

export const getLatestBookingStatusLogs = async (
  bookings: LatestBookingStatusLogRequest[],
  tenant?: string,
): Promise<Record<string, LatestBookingStatusLog>> => {
  if (bookings.length === 0) return {};

  const calendarEventIdsByStatus = new Map<BookingStatusLabel, string[]>();
  for (const { calendarEventId, status } of bookings) {
    const list = calendarEventIdsByStatus.get(status) ?? [];
    list.push(calendarEventId);
    calendarEventIdsByStatus.set(status, list);
  }

  const tenantCollection = getServerTenantCollection(
    TableNames.BOOKING_LOGS,
    tenant,
  );
  const logsRef = db.collection(tenantCollection);
  const latestByCalendarEventId: Record<string, LatestBookingStatusLog> = {};

  const mergeDocsForStatus = (
    status: BookingStatusLabel,
    docs: QueryDocumentSnapshot[],
  ) => {
    docs.forEach((docSnap) => {
      const data = docSnap.data();
      const calendarEventId = data.calendarEventId;
      const docStatus = data.status as BookingStatusLabel;
      if (typeof calendarEventId !== "string" || docStatus !== status) {
        return;
      }

      const changedAt = timestampToMillis(data.changedAt);
      if (changedAt == null) return;

      const existing = latestByCalendarEventId[calendarEventId];
      if (!existing || changedAt > existing.changedAt) {
        latestByCalendarEventId[calendarEventId] = {
          calendarEventId,
          status,
          changedAt,
        };
      }
    });
  };

  await Promise.all(
    [...calendarEventIdsByStatus.entries()].flatMap(([status, ids]) =>
      chunkArray(ids, 30).map(async (calendarEventIdChunk) => {
        const querySnapshot = await traceDatabase(
          "query",
          "Firestore/bookingLogs/latestBatchByStatus",
          () =>
            logsRef
              .where("calendarEventId", "in", calendarEventIdChunk)
              .where("status", "==", status)
              .get(),
        );
        mergeDocsForStatus(status, querySnapshot.docs);
      }),
    ),
  );

  return latestByCalendarEventId;
};
