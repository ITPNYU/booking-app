// saveData.ts
import {
  QueryConstraint,
  QuerySnapshot,
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  setDoc,
  updateDoc,
  where,
} from "@firebase/firestore";

import { TableNames } from "@/components/src/policy";
import { db } from "./firebaseClient";

export type AdminUserData = {
  email: string;
  createdAt: Timestamp;
};

export const deleteDataFromFirestore = async (
  collectionName: string,
  docId: string
) => {
  try {
    await deleteDoc(doc(db, collectionName, docId));
    console.log("Document successfully deleted with ID:", docId);
  } catch (error) {
    console.error("Error deleting document: ", error);
  }
};

export const getNextSequentialId = async (collectionName) => {
  const counterDocRef = doc(db, "counters", collectionName);

  const counterDoc = await getDoc(counterDocRef);
  let currentCount = 1;

  if (counterDoc.exists()) {
    currentCount = counterDoc.data().count + 1;
  }

  await setDoc(counterDocRef, { count: currentCount }, { merge: true });

  return currentCount;
};

export const saveDataToFirestore = async (
  collectionName: string,
  data: object
) => {
  try {
    const docRef = await addDoc(collection(db, collectionName), data);

    console.log("Document successfully written with ID:", docRef.id);
  } catch (error) {
    console.error("Error writing document: ", error);
  }
};

export const fetchAllDataFromCollection = async <T>(
  collectionName: TableNames,
  queryConstraints: QueryConstraint[] = []
): Promise<T[]> => {
  const colRef = collection(db, collectionName);
  const q = query(colRef, ...queryConstraints);
  const snapshot = await getDocs(q);
  const data = snapshot.docs.map((document) => ({
    id: document.id,
    ...(document.data() as unknown as T),
  }));
  return data;
};

export const getDataByCalendarEventId = async <T>(
  collectionName: TableNames,
  calendarEventId: string
) => {
  try {
    const colRef = collection(db, collectionName);
    const q = query(colRef, where("calendarEventId", "==", calendarEventId));
    const querySnapshot: QuerySnapshot = await getDocs(q);

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

export const getFinalApproverEmailFromDatabase = async (): Promise<
  string | null
> => {
  try {
    const policyCollection = collection(db, TableNames.POLICY);
    const q = query(policyCollection, limit(1));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      const finalApproverEmail = doc.data().finalApproverEmail;
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

export const updateDataInFirestore = async (
  collectionName: string,
  docId: string,
  updatedData: object
) => {
  try {
    const docRef = doc(db, collectionName, docId);
    await updateDoc(docRef, updatedData);
    console.log("Document successfully updated with ID:", docId);
  } catch (error) {
    console.error("Error updating document: ", error);
  }
};
