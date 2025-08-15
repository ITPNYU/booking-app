import { NextRequest, NextResponse } from "next/server";

import { TableNames } from "@/components/src/policy";
import { serverFetchAllDataFromCollection } from "@/lib/firebase/server/adminDb";

export async function GET(req: NextRequest) {
  // Get tenant from x-tenant header, fallback to 'mc' as default
  const tenant = req.headers.get("x-tenant") || "mc";

  try {
    const fetchedData = await serverFetchAllDataFromCollection(
      TableNames.APPROVERS,
      [],
      tenant,
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
