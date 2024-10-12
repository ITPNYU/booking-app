import { NextRequest, NextResponse } from "next/server";
import {
  serverFetchAllDataFromCollection,
  serverUpdateInFirestore,
} from "@/lib/firebase/server/adminDb";

export async function POST(request: NextRequest) {
  const { collection } = await request.json();

  try {
    const rows = await serverFetchAllDataFromCollection(collection);

    // await serverUpdateInFirestore(collection, rows[0].id, { level: 1 });
    await Promise.all(
      rows.map(row =>
        serverUpdateInFirestore(collection, row.id, { level: 1 }),
      ),
    );

    return NextResponse.json({ modifiedRows: rows.length }, { status: 200 });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Failed to add fields to documents" },
      { status: 500 },
    );
  }
}
