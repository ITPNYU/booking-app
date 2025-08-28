import {
  ApproverLevel,
  TableNames,
  getTenantCollectionName,
} from "@/components/src/policy";
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
} from "firebase/firestore";

import { getDb } from "./firebaseClient";
import { Filters } from "@/components/src/types";
import { SchemaContextType } from "@/components/src/client/routes/components/SchemaProvider";

// Utility function to get current tenant from URL
export const getCurrentTenant = (): string | undefined => {
  if (typeof window !== "undefined") {
    const pathname = window.location.pathname;
    const tenantMatch = pathname.match(/^\/([^\/]+)/);
    return tenantMatch ? tenantMatch[1] : undefined;
  }
  return undefined;
};

// Helper function to get tenant-specific collection name
export const getTenantCollection = (
  baseCollection: TableNames,
  tenant?: string
): string => {
  const tenantToUse = tenant || getCurrentTenant();
  return getTenantCollectionName(baseCollection, tenantToUse);
};

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

// Special function for handling user rights deletion
export const clientDeleteUserRightsData = async (
  collectionName: TableNames,
  docId: string,
  tenant?: string
) => {
  try {
    const db = getDb();

    // Check if this is one of the user collections that should use usersRights
    const userCollections = [
      TableNames.ADMINS,
      TableNames.PAS,
    ];

    if (userCollections.includes(collectionName)) {
      // For user collections, we work directly with the usersRights collection
      // The docId passed is from the usersRights collection
      const usersRightsCollection = getTenantCollection(
        TableNames.USERS_RIGHTS,
        tenant
      );

      // Get the document from usersRights collection
      const userDoc = await getDoc(doc(db, usersRightsCollection, docId));

      if (!userDoc.exists()) {
        throw new Error("User document not found in usersRights collection");
      }

      const userData = userDoc.data();
      const email = userData.email;

      if (!email) {
        throw new Error("Email not found in user document");
      }

      // Set the appropriate flag to false
      let updateData: any = {};

      if (collectionName === TableNames.ADMINS) {
        updateData = { isAdmin: false };
      } else if (collectionName === TableNames.PAS) {
        updateData = { isLiaison: false };
      }

      // Check if all flags are false, if so, remove the document
      const updatedFlags = {
        isAdmin:
          collectionName === TableNames.ADMINS ? false : userData.isAdmin,
        isLiaison:
          collectionName === TableNames.PAS ? false : userData.isLiaison,
      };

      if (
        !updatedFlags.isAdmin &&
        !updatedFlags.isLiaison
      ) {
        // All flags are false, remove the document
        await deleteDoc(doc(db, usersRightsCollection, docId));
        console.log("Removed user from usersRights as all flags are false");
      } else {
        // Update the flag
        await updateDoc(doc(db, usersRightsCollection, docId), updateData);
        console.log("Updated user flag in usersRights");
      }
    } else {
      // Use original logic for non-user collections
      const tenantCollection = getTenantCollection(
        collectionName as TableNames,
        tenant
      );
      await deleteDoc(doc(db, tenantCollection, docId));
    }

    console.log("Document successfully deleted with ID:", docId);
  } catch (error) {
    console.error("Error deleting document: ", error);
    throw error;
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

// Special function for handling user rights operations
export const clientSaveUserRightsData = async (
  collectionName: TableNames,
  data: object,
  tenant?: string
) => {
  try {
    const db = getDb();

    // Check if this is one of the user collections that should use usersRights
    const userCollections = [
      TableNames.ADMINS,
      TableNames.PAS,
    ];

    if (userCollections.includes(collectionName)) {
      // Use usersRights collection instead
      const usersRightsCollection = getTenantCollection(
        TableNames.USERS_RIGHTS,
        tenant
      );
      const email = (data as any).email;

      if (!email) {
        throw new Error("Email is required for user rights operations");
      }

      // Check if user already exists in usersRights
      const existingUserQuery = query(
        collection(db, usersRightsCollection),
        where("email", "==", email)
      );
      const existingUserSnapshot = await getDocs(existingUserQuery);

      if (!existingUserSnapshot.empty) {
        // User exists, update the appropriate flag
        const existingUserDoc = existingUserSnapshot.docs[0];
        const existingData = existingUserDoc.data();

        let updateData: any = {};

        if (collectionName === TableNames.ADMINS) {
          updateData = { isAdmin: true };
        } else if (collectionName === TableNames.PAS) {
          updateData = { isLiaison: true };
        }

        await updateDoc(
          doc(db, usersRightsCollection, existingUserDoc.id),
          updateData
        );
        console.log(
          "Updated existing user in usersRights with ID:",
          existingUserDoc.id
        );
      } else {
        // User doesn't exist, create new entry
        const newUserData = {
          email: email,
          createdAt: (data as any).createdAt || Timestamp.now(),
          isAdmin: collectionName === TableNames.ADMINS,
          isLiaison: collectionName === TableNames.PAS,
          isEquipment: false,
          isStaffing: false,
          isWorker: false,
          isSetup: false,
          isCatering: false,
          isCleaning: false,
          isSecurity: false,
          ...(data as any),
        };

        const docRef = await addDoc(
          collection(db, usersRightsCollection),
          newUserData
        );
        console.log("Created new user in usersRights with ID:", docRef.id);
      }
    } else {
      // Use original logic for non-user collections
      const tenantCollection = getTenantCollection(collectionName, tenant);
      const docRef = await addDoc(collection(db, tenantCollection), data);
      console.log("Document successfully written with ID:", docRef.id);
    }
  } catch (error) {
    console.error("Error writing document: ", error);
    throw error;
  }
};

export const clientFetchAllDataFromCollection = async <T>(
  collectionName: TableNames,
  queryConstraints: QueryConstraint[] = [],
  tenant?: string
): Promise<T[]> => {
  const db = getDb();
  const tenantCollection = getTenantCollection(collectionName, tenant);
  const colRef = collection(db, tenantCollection);
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
  offset: number,
  tenant?: string
): Promise<T[]> => {
  const db = getDb();
  const tenantCollection = getTenantCollection(collectionName, tenant);
  const colRef = collection(db, tenantCollection);
  const q = query(colRef, limit(limitNumber), where("offset", ">=", offset));
  const snapshot = await getDocs(q);
  const data = snapshot.docs.map((document) => ({
    id: document.id,
    ...(document.data() as unknown as T),
  }));
  return data;
};

export const getPaginatedData = async <T>(
  collectionName,
  itemsPerPage = 10,
  filters: Filters,
  lastVisible = null,
  tenant?: string
): Promise<T[]> => {
  try {
    const db = getDb();
    const tenantCollection = getTenantCollection(collectionName, tenant);
    const colRef = collection(db, tenantCollection);
    const queryParams = [];

    // Add date range filters
    if (filters.dateRange && filters.dateRange.length === 2) {
      if (filters.dateRange[0]) {
        queryParams.push(where("startDate", ">=", filters.dateRange[0]));
      }
      if (filters.dateRange[1]) {
        queryParams.push(where("startDate", "<=", filters.dateRange[1]));
      }
    }

    // If there's a search query, fetch data and filter client-side
    if (filters.searchQuery && filters.searchQuery.trim() !== "") {
      const searchTerm = filters.searchQuery.trim().toLowerCase();

      // Define the fields we want to search
      const searchableFields = [
        "requestNumber",
        "department",
        "netId",
        "email",
        "title",
        "description",
        "firstName",
        "lastName",
        "roomId",
      ];

      // Fetch data with just date filters
      const baseQuery = query(
        colRef,
        ...queryParams,
        orderBy(filters.sortField, "desc")
      );

      const snapshot = await getDocs(baseQuery);

      // Filter documents that match the search term in any field
      const matchingDocs = snapshot.docs.filter((doc) => {
        const data = doc.data();

        // Check for matches in combined firstName + lastName
        if (data.firstName && data.lastName) {
          const fullName = `${data.firstName} ${data.lastName}`.toLowerCase();
          if (fullName.includes(searchTerm)) return true;
        }

        // Continue with existing field-by-field check
        return searchableFields.some((field) => {
          const fieldValue = data[field];
          // Handle different types of fields
          if (fieldValue === null || fieldValue === undefined) return false;
          const stringValue = String(fieldValue).toLowerCase();
          // Check if the field contains the search term anywhere
          return stringValue.includes(searchTerm);
        });
      });

      // Return all matching docs without pagination
      return matchingDocs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as unknown as T),
      }));
    }

    // If no search query, use standard query with date filters
    let q = query(colRef, ...queryParams, orderBy(filters.sortField, "desc"));

    if (lastVisible) {
      q = query(
        colRef,
        ...queryParams,
        orderBy(filters.sortField, "desc"),
        startAfter(lastVisible[filters.sortField])
      );
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as unknown as T),
    }));
  } catch (error) {
    console.error("Error getting paginated data:", error);
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
  calendarEventId: string,
  tenant?: string
): Promise<(T & { id: string }) | null> => {
  try {
    const db = getDb();
    const tenantCollection = getTenantCollection(collectionName, tenant);
    const colRef = collection(db, tenantCollection);
    const q = query(colRef, where("calendarEventId", "==", calendarEventId));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return null;
    }

    const doc = snapshot.docs[0];
    return {
      id: doc.id,
      ...(doc.data() as unknown as T),
    };
  } catch (error) {
    console.error("Error getting data by calendar event ID:", error);
    return null;
  }
};
export const clientUpdateDataInFirestore = async (
  collectionName: string,
  docId: string,
  updatedData: object,
  tenant?: string
) => {
  try {
    const db = getDb();
    const tenantCollection = getTenantCollection(
      collectionName as TableNames,
      tenant
    );
    const docRef = doc(db, tenantCollection, docId);
    await updateDoc(docRef, updatedData);
    console.log("Document successfully updated with ID:", docId);
  } catch (error) {
    console.error("Error updating document: ", error);
  }
};

export const clientGetTenantSchema = async (
  tenant: string
): Promise<SchemaContextType | null> => {
  try {
    const db = getDb();
    const docRef = doc(db, "tenantSchema", tenant);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return docSnap.data() as SchemaContextType;
    }
    console.log(`No schema found for tenant: ${tenant}`);
    return null;
  } catch (error) {
    console.error("Error fetching tenant schema:", error);
    return null;
  }
};
