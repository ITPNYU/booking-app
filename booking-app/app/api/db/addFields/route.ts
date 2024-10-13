import { NextRequest, NextResponse } from "next/server";
import {
  serverFetchAllDataFromCollection,
  serverUpdateInFirestore,
} from "@/lib/firebase/server/adminDb";

import { ApproverLevel } from "@/components/src/policy";

export async function POST(request: NextRequest) {
  const { collection } = await request.json();

  try {
    const rows = await serverFetchAllDataFromCollection(collection);

    await Promise.all(
      rows.map(row =>
        serverUpdateInFirestore(collection, row.id, {
          level: ApproverLevel.FIRST,
        }),
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
