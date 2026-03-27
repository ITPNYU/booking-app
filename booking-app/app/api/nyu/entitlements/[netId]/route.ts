import { UserApiData } from "@/components/src/types";
import { TENANTS, TenantValue } from "@/components/src/constants/tenants";
import { ITP_DEPT_CODES } from "@/components/src/utils/tenantUtils";
import { shouldBypassAuth } from "@/lib/utils/testEnvironment";
import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";


function getEntitledTenants(userData: UserApiData): TenantValue[] {
  const tenants: TenantValue[] = [TENANTS.MC];

  if (userData.dept_code && ITP_DEPT_CODES.includes(userData.dept_code)) {
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

    // Verify the caller is authenticated and requesting their own entitlements.
    // Skipped in test environments (BYPASS_AUTH / E2E_TESTING / NODE_ENV=test).
    if (!shouldBypassAuth()) {
      const session = await auth();
      if (!session?.user?.email) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const callerNetId = session.user.email.split("@")[0];
      if (callerNetId !== netId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
    const identityRes = await fetch(`${baseUrl}/api/nyu/identity/${netId}`);

    if (!identityRes.ok) {
      console.error(`NYU Identity API error for netId ${netId}: ${identityRes.status}`);
      // On API failure, fall back to mc-only entitlement rather than blocking the user
      return NextResponse.json({ entitledTenants: [TENANTS.MC] });
    }

    const userData: UserApiData = await identityRes.json();

    const entitledTenants = getEntitledTenants(userData);

    return NextResponse.json({ entitledTenants });
  } catch (error) {
    console.error("Entitlements API error:", error);
    // On unexpected error, fall back to mc-only entitlement
    return NextResponse.json({ entitledTenants: [TENANTS.MC] });
  }
}
