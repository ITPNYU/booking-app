import { getNYUToken } from "@/lib/server/nyuApiAuth";
import { UserApiData } from "@/components/src/types";
import { TENANTS, TenantValue } from "@/components/src/constants/tenants";
import { shouldBypassAuth } from "@/lib/utils/testEnvironment";
import admin from "@/lib/firebase/server/firebaseAdmin";
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

/**
 * Verify the Firebase ID token from the Authorization header and return the
 * caller's netId (the part of their @nyu.edu email before the @).
 * Returns null if the token is missing, invalid, or the email is not @nyu.edu.
 */
async function getVerifiedNetId(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const idToken = authHeader.slice(7);
  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    const email = decoded.email ?? "";
    if (!email.endsWith("@nyu.edu")) return null;
    return email.split("@")[0];
  } catch {
    return null;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ netId: string }> },
) {
  try {
    const { netId } = await params;

    // Verify the caller is authenticated and requesting their own entitlements.
    // Skipped in test environments (BYPASS_AUTH / E2E_TESTING / NODE_ENV=test).
    if (!shouldBypassAuth()) {
      const callerNetId = await getVerifiedNetId(request);
      if (!callerNetId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      if (callerNetId !== netId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

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

    const entitledTenants = getEntitledTenants(userData);

    return NextResponse.json({ entitledTenants });
  } catch (error) {
    console.error("Entitlements API error:", error);
    // On unexpected error, fall back to mc-only entitlement
    return NextResponse.json({ entitledTenants: [TENANTS.MC] });
  }
}
