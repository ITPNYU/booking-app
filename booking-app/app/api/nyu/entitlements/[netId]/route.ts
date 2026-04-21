import { UserApiData } from "@/components/src/types";
import { TENANTS, TenantValue } from "@/components/src/constants/tenants";
import { ITP_DEPT_CODES } from "@/components/src/utils/tenantUtils";
import { shouldBypassAuth } from "@/lib/utils/testEnvironment";
import { auth } from "@/lib/auth";
import { fetchNYUIdentity } from "@/lib/server/nyuIdentity";
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
      const email = session?.user?.email?.trim().toLowerCase();
      if (!email || !email.endsWith("@nyu.edu")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const callerNetId = email.split("@")[0];
      if (callerNetId !== netId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const userData = await fetchNYUIdentity(netId);

    if (!userData) {
      console.error(`NYU Identity API error for netId ${netId}`);
      const fallback = NextResponse.json({ entitledTenants: [TENANTS.MC] });
      fallback.headers.set("Cache-Control", "private, no-store");
      return fallback;
    }

    const entitledTenants = getEntitledTenants(userData as UserApiData);

    const res = NextResponse.json({ entitledTenants });
    res.headers.set(
      "Cache-Control",
      "private, max-age=604800, stale-while-revalidate=604800",
    );
    return res;
  } catch (error) {
    console.error("Entitlements API error:", error);
    const fallback = NextResponse.json({ entitledTenants: [TENANTS.MC] });
    fallback.headers.set("Cache-Control", "private, no-store");
    return fallback;
  }
}
