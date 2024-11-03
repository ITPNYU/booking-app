import { NextRequest, NextResponse } from "next/server";
import { TableNamesRaw, Tenants, getTableName } from "@/components/src/policy";

import { Booking } from "@/components/src/types";
import { parse } from "json2csv";
import { serverFetchAllDataFromCollection } from "@/lib/firebase/server/adminDb";

export async function GET(request: NextRequest) {
  const table = getTableName(TableNamesRaw.BOOKING, Tenants.MEDIA_COMMONS);
  const bookings = (
    await serverFetchAllDataFromCollection<Booking>(table)
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
