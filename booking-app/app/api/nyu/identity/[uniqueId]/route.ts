import { getNYUToken } from "@/lib/server/nyuApiAuth";
import { NextRequest, NextResponse } from "next/server";

const NYU_API_BASE = "https://api.nyu.edu/identity-v2-sys";

export function selectIdentityRecord(
  data: unknown,
): Record<string, unknown> | null {
  if (!Array.isArray(data)) return (data as Record<string, unknown>) ?? null;
  return (
    data.find((r: Record<string, unknown>) => r.affiliation === "employee") ??
    data[0] ??
    null
  );
}

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

    const apiAccessId = process.env.NYU_API_ACCESS_ID;
    if (!apiAccessId) {
      return NextResponse.json(
        { error: "API access ID not configured" },
        { status: 500 },
      );
    }

    const url = new URL(
      `${NYU_API_BASE}/identity/unique-id/${uniqueId}?partially_approved_dataset=true`,
    );
    url.searchParams.append("api_access_id", apiAccessId);

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });
    console.log("response", response);

    if (!response.ok) {
      return NextResponse.json(
        { error: `NYU API call failed: ${response.status}` },
        { status: response.status },
      );
    }

    const userData = await response.json();
    console.log("userData", userData);
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
