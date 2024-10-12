import { NextRequest, NextResponse } from "next/server";
import {
  serverFetchAllDataFromCollection,
  serverSaveDataToFirestore,
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
    const destinationRowsFiltered = destinationRows.map(row => {
      const { id, ...other } = row;
      return other;
    });

    const calIdToBookingStatus = {};
    for (let row of sourceRowsFiltered) {
      calIdToBookingStatus[row.calendarEventId] = row;
    }

    const merged = destinationRowsFiltered.map(booking => {
      const matchingStatus = calIdToBookingStatus[booking.calendarEventId];
      return { ...booking, ...matchingStatus };
    });

    await Promise.all(
      merged.map(row => serverSaveDataToFirestore(destinationTable, row)),
    );

    return NextResponse.json(
      { duplicatedRows: merged.length },
      { status: 200 },
    );
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Failed to merge collections" },
      { status: 500 },
    );
  }
}
