import { getNYUToken, NYU_API_BASE } from "@/lib/server/nyuApiAuth";
import { selectIdentityRecord } from "@/lib/utils/identityRecord";
import { NextRequest, NextResponse } from "next/server";

/** Public API access ID — not a secret, safe to hardcode. */
const NYU_API_ACCESS_ID = "20201957";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ uniqueId: string }> },
) {
  try {
    const { uniqueId } = await params;
    const token = await getNYUToken();
    if (!token) {
      return NextResponse.json(
        { error: "Authentication failed" },
        { status: 401 },
      );
    }

    const url = new URL(
      `${NYU_API_BASE}/identity/unique-id/${uniqueId}`,
    );
    url.searchParams.append("api_access_id", NYU_API_ACCESS_ID);

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });
    if (!response.ok) {
      return NextResponse.json(
        { error: `NYU API call failed: ${response.status}` },
        { status: response.status },
      );
    }

    const userData = await response.json();
    const record = selectIdentityRecord(userData);
    return NextResponse.json(record);
  } catch (error) {
    console.error("Identity API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch identity data" },
      { status: 500 },
    );
  }
}
