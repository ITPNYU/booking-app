import { NextResponse } from "next/server";
import { collection, getDocs } from "firebase/firestore";
import { getDb } from "@/lib/firebase/firebaseClient";

export async function GET() {
  let data = [];

  try {
    const db = getDb();
    const querySnapshot = await getDocs(collection(db, "adminUsers"));
    data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("Error getting documents:", error);
    return NextResponse.error();
  }

  return NextResponse.json(data);
}
