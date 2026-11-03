import {
  DEFAULT_TENANT,
  isValidTenant,
} from "@/components/src/constants/tenants";
import { TableNames } from "@/components/src/policy";
import { BookingStatusLabel, PagePermission } from "@/components/src/types";
import { normalizeActionNote } from "@/components/src/utils/bookingHistoryNotes";
import { resolveCallerRole } from "@/lib/api/authz";
import { requireSession } from "@/lib/api/requireSession";
import {
  logServerBookingChange,
  serverGetDataByCalendarEventId,
} from "@/lib/firebase/server/adminDb";
import { NextRequest, NextResponse } from "next/server";

// Staff who act on bookings; requesters can read notes but not add them.
const STAFF_ROLES = new Set<PagePermission>([
  PagePermission.PA,
  PagePermission.LIAISON,
  PagePermission.SERVICES,
  PagePermission.ADMIN,
  PagePermission.SUPER_ADMIN,
]);

/**
 * Add a note to a booking's history without changing its status (#1409).
 * POST /api/booking-notes  Body: { calendarEventId: string, note: string }
 *
 * The note is recorded under the signed-in user, as a NOTE history entry.
 */
export async function POST(req: NextRequest) {
  const session = await requireSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { calendarEventId?: unknown; note?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { calendarEventId } = body;
  const note = normalizeActionNote(body.note);
  if (typeof calendarEventId !== "string" || !calendarEventId.trim()) {
    return NextResponse.json(
      { error: "calendarEventId required" },
      { status: 400 },
    );
  }
  if (!note) {
    return NextResponse.json({ error: "note required" }, { status: 400 });
  }

  const tenant = req.headers.get("x-tenant") || DEFAULT_TENANT;
  if (!isValidTenant(tenant)) {
    return NextResponse.json({ error: "Invalid tenant" }, { status: 400 });
  }

  try {
    const role = await resolveCallerRole(session, tenant, {
      includeServiceApprovers: true,
    });
    if (!STAFF_ROLES.has(role)) {
      return NextResponse.json(
        { error: "Only staff can add notes to a booking" },
        { status: 403 },
      );
    }

    const booking = await serverGetDataByCalendarEventId<{
      id: string;
      requestNumber: number;
    }>(TableNames.BOOKING, calendarEventId, tenant);
    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    await logServerBookingChange({
      bookingId: booking.id,
      calendarEventId,
      status: BookingStatusLabel.NOTE,
      changedBy: session.email,
      requestNumber: booking.requestNumber,
      note,
      tenant,
    });

    return NextResponse.json({ message: "Note added" }, { status: 201 });
  } catch (error) {
    console.error("Error adding booking note:", error);
    return NextResponse.json({ error: "Failed to add note" }, { status: 500 });
  }
}
