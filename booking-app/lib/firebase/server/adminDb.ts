import {
  ApproverLevel,
  TableNames,
  getTenantCollectionName,
} from "@/components/src/policy";
import {
  CollectionReference,
  DocumentData,
  FieldValue,
  Query,
  QuerySnapshot,
  WhereFilterOp,
} from "firebase-admin/firestore";

import { BookingLog, BookingStatusLabel } from "@/components/src/types";
import { traceDatabase } from "@/lib/newrelic-utils";
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
    const docRef = await traceDatabase(
      "add",
      `Firestore/${tenantCollection}`,
      () => db.collection(tenantCollection).add(data),
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

export const serverGetDocumentById = async <T extends DocumentData>(
  collectionName: TableNames,
  docId: string,
  tenant?: string,
): Promise<T | null> => {
  try {
    const tenantCollection = getServerTenantCollection(collectionName, tenant);
    const docRef = db.collection(tenantCollection).doc(docId);
    const docSnap = await traceDatabase(
      "get",
      `Firestore/${tenantCollection}`,
      () => docRef.get(),
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
): Promise<string | null> => serverGetFinalApproverEmailFromDatabase(tenant);

/**
 * Returns all resource approver emails for a specific room by querying
 * user documents in ${tenant}-usersApprovers whose `resourceRoomIds`
 * array contains the given roomId.
 *
 * Falls back to the tenant-level final approver when no per-room approvers
 * are configured, or when roomId is not provided.
 *
 * @param tenant - The tenant identifier
 * @param roomId - The numeric (or string) roomId of the resource
 */
export const serverGetResourceApproverEmailsForResource = async (
  tenant?: string,
  roomId?: number | string,
): Promise<string[]> => {
  if (roomId !== undefined) {
    try {
      const numericRoomId =
        typeof roomId === "string" ? parseInt(roomId, 10) : roomId;
      if (Number.isFinite(numericRoomId)) {
        const tenantCollection = getServerTenantCollection(
          TableNames.APPROVERS,
          tenant,
        );
        const querySnapshot = await traceDatabase(
          "query",
          `Firestore/${tenantCollection}`,
          () =>
            db
              .collection(tenantCollection)
              .where("resourceRoomIds", "array-contains", numericRoomId)
              .get(),
        );
        if (!querySnapshot.empty) {
          const emails = querySnapshot.docs
            .map((d) => d.data().email as string | undefined)
            .filter((e): e is string => Boolean(e));
          if (emails.length > 0) return emails;
        }
      }
    } catch (error) {
      console.error("Error fetching resource-specific approvers:", error);
    }
  }
  // Fall back to the tenant-level final approver
  const fallback = await serverGetFinalApproverEmailFromDatabase(tenant);
  return fallback ? [fallback] : [];
};

/**
 * Adds a roomId to a user's `resourceRoomIds` array in the approvers collection.
 *
 * @param approverDocId - The Firestore document ID of the approver user
 * @param roomId        - The roomId to grant resource-approver privileges for
 * @param tenant        - The tenant identifier
 */
export const serverAddResourceRoomToApprover = async (
  approverDocId: string,
  roomId: number,
  tenant?: string,
): Promise<void> => {
  const tenantCollection = getServerTenantCollection(
    TableNames.APPROVERS,
    tenant,
  );
  const { FieldValue } = await import("firebase-admin/firestore");
  await traceDatabase("update", `Firestore/${tenantCollection}`, () =>
    db
      .collection(tenantCollection)
      .doc(approverDocId)
      .update({ resourceRoomIds: FieldValue.arrayUnion(roomId) }),
  );
};

/**
 * Removes a roomId from a user's `resourceRoomIds` array.
 *
 * @param approverDocId - The Firestore document ID of the approver user
 * @param roomId        - The roomId to revoke resource-approver privileges for
 * @param tenant        - The tenant identifier
 */
export const serverRemoveResourceRoomFromApprover = async (
  approverDocId: string,
  roomId: number,
  tenant?: string,
): Promise<void> => {
  const tenantCollection = getServerTenantCollection(
    TableNames.APPROVERS,
    tenant,
  );
  const { FieldValue } = await import("firebase-admin/firestore");
  await traceDatabase("update", `Firestore/${tenantCollection}`, () =>
    db
      .collection(tenantCollection)
      .doc(approverDocId)
      .update({ resourceRoomIds: FieldValue.arrayRemove(roomId) }),
  );
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
