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
      const err = NextResponse.json(
        { error: "Failed to fetch identity data" },
        { status: 502 },
      );
      err.headers.set("Cache-Control", "private, no-store");
      return err;
    }

    const res = NextResponse.json(record);
    res.headers.set(
      "Cache-Control",
      "private, max-age=604800, stale-while-revalidate=604800",
    );
    return res;
  } catch (error) {
    console.error("Identity API error:", error);
    const err = NextResponse.json(
      { error: "Failed to fetch identity data" },
      { status: 500 },
    );
    err.headers.set("Cache-Control", "private, no-store");
    return err;
  }
}
