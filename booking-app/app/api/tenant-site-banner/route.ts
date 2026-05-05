import { NextRequest, NextResponse } from "next/server";
import admin from "@/lib/firebase/server/firebaseAdmin";
import { TableNames, getTenantCollectionName } from "@/components/src/policy";
import { isValidTenant } from "@/components/src/constants/tenants";
import { requireSession } from "@/lib/api/requireSession";
import { resolveCallerRole } from "@/lib/api/authz";
import { PagePermission } from "@/components/src/types";
import {
  DEFAULT_SITE_BANNER_COLOR_HEX,
  SITE_BANNER_SETTINGS_DOC_ID,
  normalizeSiteBannerColorHex,
  SITE_BANNER_MESSAGE_MAX_LEN,
} from "@/lib/utils/siteBannerHex";

type SiteBannerBody = {
  tenant?: string;
  siteBanner?: unknown;
};

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

/**
 * Upserts `{tenant}-settings/siteBanner` with `siteBanner` only for callers who are
 * admin or super-admin for that tenant.
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
  if (role !== PagePermission.ADMIN && role !== PagePermission.SUPER_ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const raw = body.siteBanner;
  if (raw === undefined) {
    return NextResponse.json({ error: "siteBanner required" }, { status: 400 });
  }
  if (!isPlainRecord(raw)) {
    return NextResponse.json(
      { error: "siteBanner must be a plain object" },
      { status: 400 },
    );
  }
  if (!("enabled" in raw) || typeof raw.enabled !== "boolean") {
    return NextResponse.json(
      { error: "siteBanner.enabled must be a boolean" },
      { status: 400 },
    );
  }
  if (!("message" in raw) || typeof raw.message !== "string") {
    return NextResponse.json(
      { error: "siteBanner.message must be a string" },
      { status: 400 },
    );
  }

  const enabled = raw.enabled;
  const message = raw.message.slice(0, SITE_BANNER_MESSAGE_MAX_LEN);

  if (!("colorHex" in raw) || typeof raw.colorHex !== "string") {
    return NextResponse.json(
      { error: "siteBanner.colorHex must be a string" },
      { status: 400 },
    );
  }
  const colorTrimmed = raw.colorHex.trim();
  const colorHex =
    colorTrimmed.length === 0
      ? DEFAULT_SITE_BANNER_COLOR_HEX
      : normalizeSiteBannerColorHex(colorTrimmed);
  if (!colorHex) {
    return NextResponse.json(
      { error: "siteBanner.colorHex must be #RGB or #RRGGBB hex" },
      { status: 400 },
    );
  }

  const db = admin.firestore();
  const ref = db
    .collection(getTenantCollectionName(TableNames.SETTINGS, tenant))
    .doc(SITE_BANNER_SETTINGS_DOC_ID);
  try {
    await ref.set(
      {
        siteBanner: { enabled, message, colorHex },
        siteBannerUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  } catch (error) {
    console.error(
      "[/api/tenant-site-banner][PUT] Firestore write failed:",
      error,
    );
    return NextResponse.json(
      { error: "Failed to save site banner" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
