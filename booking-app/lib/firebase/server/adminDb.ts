import {
  ApproverLevel,
  TableNames,
  TableNamesRaw,
  Tenants,
  getTableName,
} from "@/components/src/policy";
import {
  CollectionReference,
  DocumentData,
  FieldValue,
  Query,
  QuerySnapshot,
  WhereFilterOp,
} from "firebase-admin/firestore";

import admin from "./firebaseAdmin";

const db = admin.firestore();

export type AdminUserData = {
  email: string;
  createdAt: admin.firestore.Timestamp;
};

export const serverDeleteData = async (
  collectionName: TableNames,
  docId: string
) => {
  try {
    await db
      .collection(collectionName as string)
      .doc(docId)
      .delete();
    console.log("Document successfully deleted with ID:", docId);
  } catch (error) {
    console.error("Error deleting document: ", error);
  }
};

export const serverDeleteDocumentFields = async (
  collectionName: TableNames,
  docId: string,
  fields: string[]
) => {
  try {
    const updateData = fields.reduce((acc, field) => {
      acc[field] = FieldValue.delete();
      return acc;
    }, {});

    await db
      .collection(collectionName as string)
      .doc(docId)
      .update(updateData);
    console.log("Fields successfully deleted from document:", docId);
  } catch (error) {
    console.error("Error deleting fields from document:", error);
  }
};

export const serverGetNextSequentialId = async (collectionName: TableNames) => {
  const counterDocRef = db.collection(collectionName as string).doc("bookings");
  const counterDoc = await counterDocRef.get();
  let currentCount = 1;
  if (counterDoc.exists) {
    currentCount = (counterDoc.data()?.count || 0) + 1;
  }
  await counterDocRef.set({ count: currentCount }, { merge: true });
  return currentCount;
};

export const serverSaveDataToFirestore = async (
  collectionName: TableNames,
  data: object
) => {
  try {
    const docRef = await db.collection(collectionName as string).add(data);
    console.log("Document successfully written with ID:", docRef.id);
  } catch (error) {
    console.error("Error writing document: ", error);
  }
};

export type Constraint = {
  field: string;
  operator: WhereFilterOp;
  value: any;
};
export const serverFetchAllDataFromCollection = async <T extends DocumentData>(
  collectionName: TableNames,
  queryConstraints: Constraint[] = []
): Promise<T[]> => {
  const collectionRef: CollectionReference<T> = db.collection(
    collectionName as string
  ) as CollectionReference<T>;

  let query: Query<T> = collectionRef;

  queryConstraints.forEach((constraint) => {
    query = query.where(
      constraint.field,
      constraint.operator,
      constraint.value
    );
  });

  const snapshot: QuerySnapshot<T> = await query.get();

  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};

export const serverGetDataByCalendarEventId = async <T>(
  collectionName: TableNames,
  calendarEventId: string
) => {
  try {
    const snapshot = await db
      .collection(collectionName as string)
      .where("calendarEventId", "==", calendarEventId)
      .limit(1)
      .get();
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
  collectionName: TableNames,
  docId: string,
  updatedData: object
) => {
  try {
    await db
      .collection(collectionName as string)
      .doc(docId)
      .update(updatedData);
    console.log("Document successfully updated with ID:", docId);
  } catch (error) {
    console.error("Error updating document: ", error);
  }
};
export const serverGetFinalApproverEmailFromDatabase = async (): Promise<
  string | null
> => {
  try {
    const table = getTableName(TableNamesRaw.APPROVERS, Tenants.MEDIA_COMMONS);
    const policyCollection = db.collection(table as string);
    const querySnapshot = await policyCollection
      .where("level", "==", ApproverLevel.FINAL)
      .get();
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

export const serverGetFinalApproverEmail = async (): Promise<string> => {
  const finalApproverEmail = await serverGetFinalApproverEmailFromDatabase();
  return (
    finalApproverEmail || "booking-app-devs+notFoundFinalApprover@itp.nyu.edu"
  );
};
