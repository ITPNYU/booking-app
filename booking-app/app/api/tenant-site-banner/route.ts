import { NextRequest, NextResponse } from "next/server";
import admin from "@/lib/firebase/server/firebaseAdmin";
import { TableNames } from "@/components/src/policy";
import { isValidTenant } from "@/components/src/constants/tenants";
import { requireSession } from "@/lib/api/requireSession";
import { resolveCallerRole } from "@/lib/api/authz";
import { PagePermission } from "@/components/src/types";

const MAX_MESSAGE_LEN = 4000;

type SiteBannerBody = {
  tenant?: string;
  siteBanner?: { enabled?: unknown; message?: unknown };
};

/**
 * Upserts `settings/{tenant}` with `siteBanner` only for callers who are
 * admin or super-admin for that tenant. Doc id always matches tenant slug.
 */
export async function PUT(req: NextRequest) {
  const session = await requireSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: SiteBannerBody;
  try {
    body = (await req.json()) as SiteBannerBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const tenant = body.tenant?.trim();
  if (!tenant || !isValidTenant(tenant)) {
    return NextResponse.json({ error: "Invalid tenant" }, { status: 400 });
  }

  const role = await resolveCallerRole(session, tenant);
  if (
    role !== PagePermission.ADMIN &&
    role !== PagePermission.SUPER_ADMIN
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const raw = body.siteBanner;
  if (!raw || typeof raw !== "object") {
    return NextResponse.json({ error: "siteBanner required" }, { status: 400 });
  }

  const enabled = Boolean(raw.enabled);
  const message =
    typeof raw.message === "string" ? raw.message.slice(0, MAX_MESSAGE_LEN) : "";

  const db = admin.firestore();
  const ref = db.collection(TableNames.SETTINGS).doc(tenant);
  await ref.set(
    {
      siteBanner: { enabled, message },
      siteBannerUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  return NextResponse.json({ ok: true });
}
