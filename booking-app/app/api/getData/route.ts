import { getDb } from "@/lib/firebase/firebaseClient";
import { collection, getDocs } from "firebase/firestore";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  // Get tenant from x-tenant header, fallback to 'mc' as default
  const tenant = req.headers.get("x-tenant") || "mc";

  let data = [];

  try {
    const db = getDb();
    // Use tenant-specific collection name for admin users
    const collectionName = `${tenant}-adminUsers`;
    console.log(
      `Fetching data from collection: ${collectionName} for tenant: ${tenant}`,
    );

    const querySnapshot = await getDocs(collection(db, collectionName));
    data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error(`Error getting documents for tenant: ${tenant}:`, error);
    return NextResponse.error();
  }

  return NextResponse.json(data);
}
