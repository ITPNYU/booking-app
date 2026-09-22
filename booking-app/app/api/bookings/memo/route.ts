import { NextRequest, NextResponse } from "next/server";
import { TableNames } from "@/components/src/policy";
import { PagePermission } from "@/components/src/types";
import {
  DEFAULT_TENANT,
  isValidTenant,
} from "@/components/src/constants/tenants";
import { serverUpdateDataByCalendarEventId } from "@/components/src/server/admin";
import { requireSession } from "@/lib/api/requireSession";
import { resolveCallerRole } from "@/lib/api/authz";

export const BOOKING_MEMO_MAX_LEN = 2000;

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
    await serverUpdateDataByCalendarEventId(
      TableNames.BOOKING,
      calendarEventId,
      { memo: memo || null },
      tenant,
    );
  } catch (error) {
    if (error instanceof Error && error.message === "Booking not found") {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }
    console.error("Error updating booking memo:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true, memo });
}
