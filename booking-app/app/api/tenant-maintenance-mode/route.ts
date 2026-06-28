import { NextRequest, NextResponse } from "next/server";
import { isValidTenant } from "@/components/src/constants/tenants";
import { TableNames, getTenantCollectionName } from "@/components/src/policy";
import { PagePermission } from "@/components/src/types";
import { resolveCallerRole } from "@/lib/api/authz";
import { requireSession } from "@/lib/api/requireSession";
import admin from "@/lib/firebase/server/firebaseAdmin";
import {
  DEFAULT_MAINTENANCE_MODE_MESSAGE,
  MAINTENANCE_MODE_MESSAGE_MAX_LEN,
  MAINTENANCE_MODE_SETTINGS_DOC_ID,
} from "@/lib/utils/maintenanceMode";

type MaintenanceModeBody = {
  tenant?: string;
  maintenanceMode?: unknown;
};

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

export async function PUT(req: NextRequest) {
  const session = await requireSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: MaintenanceModeBody;
  try {
    body = (await req.json()) as MaintenanceModeBody;
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

  const raw = body.maintenanceMode;
  if (raw === undefined) {
    return NextResponse.json(
      { error: "maintenanceMode required" },
      { status: 400 },
    );
  }
  if (!isPlainRecord(raw)) {
    return NextResponse.json(
      { error: "maintenanceMode must be a plain object" },
      { status: 400 },
    );
  }
  if (!("enabled" in raw) || typeof raw.enabled !== "boolean") {
    return NextResponse.json(
      { error: "maintenanceMode.enabled must be a boolean" },
      { status: 400 },
    );
  }
  if (!("message" in raw) || typeof raw.message !== "string") {
    return NextResponse.json(
      { error: "maintenanceMode.message must be a string" },
      { status: 400 },
    );
  }

  const message =
    raw.message.trim().slice(0, MAINTENANCE_MODE_MESSAGE_MAX_LEN) ||
    DEFAULT_MAINTENANCE_MODE_MESSAGE;

  const db = admin.firestore();
  const ref = db
    .collection(getTenantCollectionName(TableNames.SETTINGS, tenant))
    .doc(MAINTENANCE_MODE_SETTINGS_DOC_ID);
  try {
    await ref.set(
      {
        maintenanceMode: { enabled: raw.enabled, message },
        maintenanceModeUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  } catch (error) {
    console.error(
      "[/api/tenant-maintenance-mode][PUT] Firestore write failed:",
      error,
    );
    return NextResponse.json(
      { error: "Failed to save maintenance mode" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
