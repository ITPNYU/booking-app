import { NextRequest, NextResponse } from "next/server";
import admin from "@/lib/firebase/server/firebaseAdmin";
import { TableNames } from "@/components/src/policy";
import { PagePermission } from "@/components/src/types";
import {
  DEFAULT_TENANT,
  isValidTenant,
} from "@/components/src/constants/tenants";
import { requireSession } from "@/lib/api/requireSession";
import { resolveCallerRole } from "@/lib/api/authz";
import { resolveCollectionName } from "@/lib/api/firestoreServer";
import { BOOKING_MEMO_MAX_LEN } from "@/components/src/constants/bookingMemo";

const MEMO_ROLES = new Set<PagePermission>([
  PagePermission.SERVICES,
  PagePermission.ADMIN,
  PagePermission.SUPER_ADMIN,
]);

type MemoBody = {
  calendarEventId?: unknown;
  memo?: unknown;
  tenant?: unknown;
};

/**
 * Sets the staff-only `memo` on a booking (`{tenant}-bookings`), looked up by
 * calendarEventId. Only Services, Admin, and Super Admin callers may write it.
 * An empty memo clears the field. The memo never reaches the calendar event
 * description or any email.
 *
 * Writes go straight to firebase-admin rather than through
 * `serverUpdateInFirestore`, which swallows update errors; a failed write must
 * surface as a 500 so the client does not mark the memo as saved.
 */
export async function PUT(req: NextRequest) {
  const session = await requireSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: MemoBody;
  try {
    body = (await req.json()) as MemoBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const tenant =
    req.headers.get("x-tenant")?.trim() ||
    (typeof body.tenant === "string" ? body.tenant.trim() : "") ||
    DEFAULT_TENANT;
  if (!isValidTenant(tenant)) {
    return NextResponse.json({ error: "Invalid tenant" }, { status: 400 });
  }

  const calendarEventId =
    typeof body.calendarEventId === "string" ? body.calendarEventId.trim() : "";
  if (!calendarEventId) {
    return NextResponse.json(
      { error: "calendarEventId required" },
      { status: 400 },
    );
  }

  if (typeof body.memo !== "string") {
    return NextResponse.json(
      { error: "memo must be a string" },
      { status: 400 },
    );
  }
  const memo = body.memo.trim();
  if (memo.length > BOOKING_MEMO_MAX_LEN) {
    return NextResponse.json(
      { error: `memo must be at most ${BOOKING_MEMO_MAX_LEN} characters` },
      { status: 400 },
    );
  }

  const role = await resolveCallerRole(session, tenant);
  if (!MEMO_ROLES.has(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const collectionName = resolveCollectionName(TableNames.BOOKING, tenant);
    const snapshot = await admin
      .firestore()
      .collection(collectionName)
      .where("calendarEventId", "==", calendarEventId)
      .limit(1)
      .get();
    if (snapshot.empty) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }
    await snapshot.docs[0].ref.update({ memo: memo || null });
  } catch (error) {
    console.error("Error updating booking memo:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, memo });
}
