import { NextRequest, NextResponse } from "next/server";
import {
  serverDeleteData,
  serverFetchAllDataFromCollection,
  serverSaveDataToFirestore,
} from "@/lib/firebase/server/adminDb";

import { TableNames } from "@/components/src/policy";

export async function POST(request: NextRequest) {
  const { newCollection } = await request.json();

  try {
    const rows = await serverFetchAllDataFromCollection(
      TableNames.SAFETY_TRAINING,
    );
    const rowsWithoutIds = rows.map(row => {
      const { id, ...other } = row;
      return other;
    });
    await Promise.all(
      rowsWithoutIds.map(row => serverSaveDataToFirestore(newCollection, row)),
    );
    return NextResponse.json(
      { duplicatedRows: rowsWithoutIds.length },
      { status: 200 },
    );
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Failed to duplicate events to new collection" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  const rows = await serverFetchAllDataFromCollection(TableNames.BOOKING);

  const ids = {};

  for (let row of rows) {
    if (!ids[row.calendarEventId]) {
      ids[row.calendarEventId] = [];
    }
    ids[row.calendarEventId].push(row);
  }

  const deleteDocIds = [];

  for (let key in ids) {
    const dups = ids[key];
    if (dups[0].requestedAt) {
      deleteDocIds.push(dups[1].id);
    } else {
      deleteDocIds.push(dups[0].id);
    }
  }

  await Promise.all(
    deleteDocIds.map(id => serverDeleteData(TableNames.BOOKING, id)),
  );

  return NextResponse.json({ status: 200 });
}
