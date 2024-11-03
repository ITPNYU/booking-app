import {
  ApproverLevel,
  TableNames,
  TableNamesRaw,
  Tenants,
  getTableName,
} from "@/components/src/policy";
// saveData.ts
import {
  QueryConstraint,
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  updateDoc,
  where,
} from "@firebase/firestore";

import { getDb } from "./firebaseClient";

export type AdminUserData = {
  email: string;
  createdAt: Timestamp;
};

export const clientDeleteDataFromFirestore = async (
  collectionName: TableNames,
  docId: string
) => {
  try {
    const db = getDb();
    await deleteDoc(doc(db, collectionName as string, docId));
    console.log("Document successfully deleted with ID:", docId);
  } catch (error) {
    console.error("Error deleting document: ", error);
  }
};

export const clientSaveDataToFirestore = async (
  collectionName: TableNames,
  data: object
) => {
  try {
    const db = getDb();
    const docRef = await addDoc(collection(db, collectionName as string), data);

    console.log("Document successfully written with ID:", docRef.id);
  } catch (error) {
    console.error("Error writing document: ", error);
  }
};

export const clientFetchAllDataFromCollection = async <T>(
  collectionName: TableNames,
  queryConstraints: QueryConstraint[] = []
): Promise<T[]> => {
  const db = getDb();
  const colRef = collection(db, collectionName as string);
  const q = query(colRef, ...queryConstraints);
  const snapshot = await getDocs(q);
  const data = snapshot.docs.map((document) => ({
    id: document.id,
    ...(document.data() as unknown as T),
  }));
  return data;
};

export const clientGetFinalApproverEmailFromDatabase = async (): Promise<
  string | null
> => {
  try {
    const db = getDb();
    const table = getTableName(TableNamesRaw.APPROVERS, Tenants.MEDIA_COMMONS);
    const approversCollection = collection(db, table as string);
    const q = query(
      approversCollection,
      where("level", "==", ApproverLevel.FINAL)
    );
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0]; // assuming only one final approver
      const finalApproverEmail = doc.data().email;
      if (finalApproverEmail) {
        console.log("HERE", finalApproverEmail);
        return finalApproverEmail;
      }
    }
    return null;
  } catch (error) {
    console.error("Error fetching finalApproverEmail:", error);
    return null;
  }
};
export const clientGetDataByCalendarEventId = async <T>(
  collectionName: TableNames,
  calendarEventId: string
): Promise<(T & { id: string }) | null> => {
  try {
    const db = getDb();
    const colRef = collection(db, collectionName as string);
    const q = query(colRef, where("calendarEventId", "==", calendarEventId));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      const docSnap = querySnapshot.docs[0];
      const data = docSnap.data() as T;
      return { id: docSnap.id, ...data };
    }
    console.log("No such document!");
    return null;
  } catch (error) {
    console.error("Error fetching document: ", error);
    return null;
  }
};
export const clientUpdateDataInFirestore = async (
  collectionName: TableNames,
  docId: string,
  updatedData: object
) => {
  try {
    const db = getDb();
    const docRef = doc(db, collectionName as string, docId);
    await updateDoc(docRef, updatedData);
    console.log("Document successfully updated with ID:", docId);
  } catch (error) {
    console.error("Error updating document: ", error);
  }
};
