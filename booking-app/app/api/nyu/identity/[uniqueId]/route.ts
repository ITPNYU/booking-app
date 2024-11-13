import { ensureNYUToken } from "@/lib/server/nyuApiAuth";
import { NYUTokenManager } from "@/lib/server/nyuTokenCache";
import { NextRequest, NextResponse } from "next/server";

const NYU_API_BASE = "https://api.nyu.edu/identity-v2-sys";

export async function GET(
  request: NextRequest,
  { params }: { params: { uniqueId: string } },
) {
  try {
    const authResult = await ensureNYUToken();
    if (!authResult.isAuthenticated || !authResult.token) {
      return NextResponse.json(
        { error: authResult.error || "Authentication required" },
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
      `${NYU_API_BASE}/identity/unique-id/primary-affil/${params.uniqueId}`,
    );
    url.searchParams.append("api_access_id", apiAccessId);

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${authResult.token}`,
        Accept: "application/json",
      },
    });
    console.log("response", response);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("NYU Identity API Error:", {
        status: response.status,
        body: errorText,
        uniqueId: params.uniqueId,
      });

      if (response.status === 401) {
        NYUTokenManager.getInstance().clearToken();
      }

      return NextResponse.json(
        { error: `NYU API call failed: ${response.status}` },
        { status: response.status },
      );
    }

    const userData = await response.json();

    return NextResponse.json(userData);
  } catch (error) {
    console.error("Identity API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch identity data" },
      { status: 500 },
    );
  }
}
