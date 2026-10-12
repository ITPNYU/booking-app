import { UserApiData } from "@/components/src/types";
import { TENANTS } from "@/components/src/constants/tenants";
import { ITP_DEPT_CODES } from "@/components/src/utils/tenantUtils";
import { listTenantSchemaDocuments } from "@/lib/tenant/listTenantSchemas";
import { TEMPLATE_SCHEMA_ID } from "@/lib/tenant/tenantSlug";
import { shouldBypassAuth } from "@/lib/utils/testEnvironment";
import { auth } from "@/lib/auth";
import { fetchNYUIdentity } from "@/lib/server/nyuIdentity";
import { NextRequest, NextResponse } from "next/server";

export type EntitlementCard = {
  id: string;
  label: string;
  description: string;
};

const MC_CARD: EntitlementCard = {
  id: TENANTS.MC,
  label: "Media Commons",
  description: "Book spaces and equipment at the Media Commons.",
};

const ITP_CARD: EntitlementCard = {
  id: TENANTS.ITP,
  label: "ITP / IMA / Low Res",
  description: "Book spaces and equipment at ITP, IMA, and Low Res.",
};

function legacyCards(userData: UserApiData): EntitlementCard[] {
  const cards = [MC_CARD];
  if (userData.dept_code && ITP_DEPT_CODES.includes(userData.dept_code)) {
    cards.push(ITP_CARD);
  }
  return cards;
}

async function entitlementCards(userData: UserApiData): Promise<EntitlementCard[]> {
  const cards = legacyCards(userData);
  const seen = new Set(cards.map((card) => card.id));

  let docs: Awaited<ReturnType<typeof listTenantSchemaDocuments>> = [];
  try {
    docs = await listTenantSchemaDocuments();
  } catch (error) {
    console.error("Failed to list tenant schemas for entitlements:", error);
    return cards;
  }

  for (const doc of docs) {
    if (
      seen.has(doc.id) ||
      doc.id === TEMPLATE_SCHEMA_ID ||
      doc.id === TENANTS.MEDIA_COMMONS ||
      doc.id === TENANTS.MC ||
      doc.id === TENANTS.ITP
    ) {
      continue;
    }
    const access = doc.access;
    if (!access || typeof access !== "object") continue;
    const deptCodes = Array.isArray(access.deptCodes) ? access.deptCodes : [];
    const allowed =
      access.allNyu === true ||
      (!!userData.dept_code && deptCodes.includes(userData.dept_code));
    if (!allowed) continue;

    const name =
      typeof doc.tenant?.name === "string" && doc.tenant.name.trim()
        ? doc.tenant.name.trim()
        : doc.id;
    const policyName = doc.tenant?.nameForPolicy?.trim();
    cards.push({
      id: doc.id,
      label: name,
      description: policyName || `Book spaces at ${name}.`,
    });
    seen.add(doc.id);
  }

  return cards;
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

    const cards = await entitlementCards(userData as UserApiData);

    const res = NextResponse.json({
      entitledTenants: cards.map((card) => card.id),
      tenantCards: cards,
    });
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
