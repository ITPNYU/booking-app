import { NextRequest, NextResponse } from "next/server";

import { Booking } from "@/components/src/types";
import { TableNames } from "@/components/src/policy";
import { parse } from "json2csv";
import { serverFetchAllDataFromCollection } from "@/lib/firebase/server/adminDb";

export async function GET(request: NextRequest) {
  const bookings = (
    await serverFetchAllDataFromCollection<Booking>(TableNames.BOOKING)
  ).sort((a, b) => a.requestNumber - b.requestNumber);

  try {
    const csv = parse(bookings);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": 'attachment; filename="data.csv"',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch CSV data" },
      { status: 400 },
    );
  }
}
