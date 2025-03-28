import { NextRequest, NextResponse } from "next/server";

import { TableNames } from "@/components/src/policy";
import { serverFetchAllDataFromCollection } from "@/lib/firebase/server/adminDb";

export async function GET(req: NextRequest) {
  try {
    const fetchedData = await serverFetchAllDataFromCollection(
      TableNames.APPROVERS,
    );
    const filtered = fetchedData.map((item: any) => ({
      id: item.id,
      email: item.email,
      department: item.department,
      createdAt: item.createdAt,
    }));
    return NextResponse.json(filtered);
  } catch (error) {
    console.error("Error fetching data:", error);
    return NextResponse.json(
      { error: "Failed to fetch data" },
      { status: 500 },
    );
  }
}
