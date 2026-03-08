import { getNYUToken } from "@/lib/server/nyuApiAuth";
import { UserApiData } from "@/components/src/types";
import { TENANTS, TenantValue } from "@/components/src/constants/tenants";
import { NextRequest, NextResponse } from "next/server";

const NYU_API_BASE = "https://api.nyu.edu/identity-v2-sys";

// Keywords matched case-insensitively against reporting_dept_name to identify
// ITP / IMA / Low Res affiliated users. Mirrors the keyword approach in
// components/src/server/admin.ts (itpDeptKeywords).
const ITP_DEPT_NAME_KEYWORDS = [
  "interactive telecommunications", // ITP
  "interactive media arts",          // IMA (e.g. "Interactive Media Arts UG Program")
  "low res",                         // Low Residence program
  "low-res",
];

function getEntitledTenants(userData: UserApiData): TenantValue[] {
  const tenants: TenantValue[] = [TENANTS.MC];

  const deptName = (userData.reporting_dept_name ?? userData.dept_name ?? "").toLowerCase();
  const isITPAffiliated = ITP_DEPT_NAME_KEYWORDS.some((keyword) =>
    deptName.includes(keyword),
  );

  if (isITPAffiliated) {
    tenants.push(TENANTS.ITP);
  }

  return tenants;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ netId: string }> },
) {
  try {
    const { netId } = await params;
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
      `${NYU_API_BASE}/identity/unique-id/primary-affil/${netId}`,
    );
    url.searchParams.append("api_access_id", apiAccessId);

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      console.error(`NYU Identity API error for netId ${netId}: ${response.status}`);
      // On API failure, fall back to mc-only entitlement rather than blocking the user
      return NextResponse.json({ entitledTenants: [TENANTS.MC] });
    }

    const userData: UserApiData = await response.json();

    // console.log("[entitlements] NYU Identity API raw response for", netId, JSON.stringify(userData, null, 2));
    // console.log("[entitlements] Checking fields:", {
    //   reporting_dept_code: userData.reporting_dept_code,
    //   dept_code: userData.dept_code,
    //   dept_name: userData.dept_name,
    //   reporting_dept_name: userData.reporting_dept_name,
    //   school_abbr: userData.school_abbr,
    //   school_name: userData.school_name,
    //   affiliation: userData.affiliation,
    //   affiliation_sub_type: userData.affiliation_sub_type,
    //   primary_affiliation: userData.primary_affiliation,
    // });

    const entitledTenants = getEntitledTenants(userData);
    // console.log("[entitlements] Result for", netId, "->", entitledTenants);

    return NextResponse.json({ entitledTenants });
  } catch (error) {
    console.error("Entitlements API error:", error);
    // On unexpected error, fall back to mc-only entitlement
    return NextResponse.json({ entitledTenants: [TENANTS.MC] });
  }
}
