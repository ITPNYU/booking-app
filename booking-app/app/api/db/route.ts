import { NextRequest, NextResponse } from "next/server";
import {
  serverFetchAllDataFromCollection,
  serverSaveDataToFirestore,
} from "@/lib/firebase/server/adminDb";

import { TableNames } from "@/components/src/policy";

export async function POST(request: NextRequest) {
  const { newCollection } = await request.json();
  console.log(newCollection);

  try {
    const rows = await serverFetchAllDataFromCollection(TableNames.APPROVERS);
    await Promise.all(
      rows.map(row => serverSaveDataToFirestore(newCollection, row)),
    );
    return NextResponse.json({ duplicatedRows: rows.length }, { status: 200 });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Failed to duplicate events to new collection" },
      { status: 500 },
    );
  }
}
