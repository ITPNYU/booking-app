import { fetchNYUIdentity } from "@/lib/server/nyuIdentity";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ uniqueId: string }> },
) {
  try {
    const { uniqueId } = await params;
    const record = await fetchNYUIdentity(uniqueId);

    if (!record) {
      return NextResponse.json(
        { error: "Failed to fetch identity data" },
        { status: 502 },
      );
    }

    const res = NextResponse.json(record);
    res.headers.set(
      "Cache-Control",
      "private, max-age=604800, stale-while-revalidate=2592000",
    );
    return res;
  } catch (error) {
    console.error("Identity API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch identity data" },
      { status: 500 },
    );
  }
}
