import { ApproverLevel, TableNames } from "@/components/src/policy";
// saveData.ts
import {
  QueryConstraint,
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  startAfter,
  updateDoc,
  where,
} from "@firebase/firestore";

import { getDb } from "./firebaseClient";
import { Filters } from "@/components/src/types";

export type AdminUserData = {
  email: string;
  createdAt: Timestamp;
};

export const clientDeleteDataFromFirestore = async (
  collectionName: string,
  docId: string
) => {
  try {
    const db = getDb();
    await deleteDoc(doc(db, collectionName, docId));
    console.log("Document successfully deleted with ID:", docId);
  } catch (error) {
    console.error("Error deleting document: ", error);
  }
};

export const clientSaveDataToFirestore = async (
  collectionName: string,
  data: object
) => {
  try {
    const db = getDb();
    const docRef = await addDoc(collection(db, collectionName), data);

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
  const colRef = collection(db, collectionName);
  const q = query(colRef, ...queryConstraints);
  const snapshot = await getDocs(q);
  const data = snapshot.docs.map((document) => ({
    id: document.id,
    ...(document.data() as unknown as T),
  }));
  return data;
};

export const clientFetchAllDataFromCollectionWithLimitAndOffset = async <T>(
  collectionName: TableNames,
  limitNumber: number,
  offset: number
): Promise<T[]> => {
  const db = getDb();
  const colRef = collection(db, collectionName);
  const q = query(colRef, limit(limitNumber), where("offset", ">=", offset));
  const snapshot = await getDocs(q);
  const data = snapshot.docs.map((document) => ({
    id: document.id,
    ...(document.data() as unknown as T),
  }));
  return data;
}

export const getPaginatedData = async<T> (
  collectionName,
  itemsPerPage = 10,
  filters: Filters,
  lastVisible = null,
 ) : Promise<T[]> => {
  try {
    const db = getDb();

    // Create reference to collection
    const colRef = collection(db, collectionName);
    console.log(filters)
    const queryParams = [];
    
    if (filters.dateRange && filters.dateRange.length === 2) {
      if(filters.dateRange[0]){
        queryParams.push(where("startDate", ">=", filters.dateRange[0]));
      }

      if(filters.dateRange[1]){
        queryParams.push(where("startDate", "<=", filters.dateRange[1]));
      }
    }
    console.log(queryParams)
    // Build query
    let q = query(
      colRef,
      ...queryParams,
      orderBy(filters.sortField, 'desc'),
      orderBy("__name__", 'desc'),
      limit(itemsPerPage)
    );
    
    // If we have a last visible item, start after it
    console.log(lastVisible)
    if (lastVisible) {
      q = query(
        colRef,
        ...queryParams,
        orderBy(filters.sortField, 'desc'),
        orderBy("__name__", 'desc'),
        startAfter(lastVisible[filters.sortField], lastVisible.id),
        limit(itemsPerPage)
      );
    }
    
    // Execute query
    const snapshot = await getDocs(q);
    
    // Convert snapshot to data array
    const items = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data() as unknown as T
    }));
    console.log(items)
    return items;
  } catch (error) {
    console.error('Error getting paginated data:', error);
    throw error;
  }
};

export const clientGetFinalApproverEmailFromDatabase = async (): Promise<
  string | null
> => {
  try {
    const db = getDb();
    const approversCollection = collection(db, TableNames.APPROVERS);
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
    const colRef = collection(db, collectionName);
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
  collectionName: string,
  docId: string,
  updatedData: object
) => {
  try {
    const db = getDb();
    const docRef = doc(db, collectionName, docId);
    await updateDoc(docRef, updatedData);
    console.log("Document successfully updated with ID:", docId);
  } catch (error) {
    console.error("Error updating document: ", error);
  }
};
