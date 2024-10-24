import { NextRequest, NextResponse } from "next/server";
import {
  serverFetchAllDataFromCollection,
  serverUpdateInFirestore,
} from "@/lib/firebase/server/adminDb";

import { TableNames } from "@/components/src/policy";

export async function POST(request: NextRequest) {
  const { source, destination } = await request.json();
  const sourceTable = source as TableNames;
  const destinationTable = destination as TableNames;

  try {
    const sourceRows = await serverFetchAllDataFromCollection(sourceTable);
    const destinationRows =
      await serverFetchAllDataFromCollection(destinationTable);

    // filter out ids
    const sourceRowsFiltered = sourceRows.map(row => {
      const { id, email, ...other } = row;
      return other;
    });

    const calIdToBookingStatus = {};
    for (let row of sourceRowsFiltered) {
      calIdToBookingStatus[row.calendarEventId] = row;
    }

    const docIdToCalId: { [key: string]: string } = {};
    for (let row of destinationRows) {
      docIdToCalId[row.id] = row.calendarEventId;
    }

    await Promise.all(
      Object.entries(docIdToCalId).map(([docId, calId]) => {
        const bookingStatus = calIdToBookingStatus[calId];
        return serverUpdateInFirestore(destinationTable, docId, bookingStatus);
      }),
    );

    return NextResponse.json({ status: 200 });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Failed to merge collections" },
      { status: 500 },
    );
  }
}
