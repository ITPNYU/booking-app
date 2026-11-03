import {
  DEFAULT_TENANT,
  isValidTenant,
} from "@/components/src/constants/tenants";
import { TableNames } from "@/components/src/policy";
import { BookingStatusLabel, PagePermission } from "@/components/src/types";
import { APPROVER_SERVICES } from "@/components/src/utils/approversResources";
import { normalizeActionNote } from "@/components/src/utils/bookingHistoryNotes";
import { resolveCallerRole } from "@/lib/api/authz";
import { requireSession } from "@/lib/api/requireSession";
import {
  logServerBookingChange,
  serverGetDataByCalendarEventId,
} from "@/lib/firebase/server/adminDb";
import { serverResolveServiceApproverEmails } from "@/lib/firebase/server/serviceApprovers";
import { NextRequest, NextResponse } from "next/server";

// Staff who act on any booking; requesters can read notes but not add them.
const STAFF_ROLES = new Set<PagePermission>([
  PagePermission.PA,
  PagePermission.LIAISON,
  PagePermission.SERVICES,
  PagePermission.ADMIN,
  PagePermission.SUPER_ADMIN,
]);

/**
 * Service approvers may add notes only to bookings for rooms where they
 * approve a service, like deciding services in `/api/services`.
 */
async function approvesServiceOnBooking(
  email: string,
  roomId: unknown,
  tenant: string,
): Promise<boolean> {
  for (const service of APPROVER_SERVICES) {
    const approvers = await serverResolveServiceApproverEmails(
      roomId,
      service,
      tenant,
      "act",
    );
    if (approvers.includes(email)) return true;
  }
  return false;
}

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
    const role = await resolveCallerRole(session, tenant);
    const booking = await serverGetDataByCalendarEventId<{
      id: string;
      requestNumber: number;
      roomId?: unknown;
    }>(TableNames.BOOKING, calendarEventId, tenant);
    // Checked before "not found", so only staff learn whether a booking exists.
    if (
      !STAFF_ROLES.has(role) &&
      !(
        booking &&
        (await approvesServiceOnBooking(session.email, booking.roomId, tenant))
      )
    ) {
      return NextResponse.json(
        { error: "Only staff can add notes to a booking" },
        { status: 403 },
      );
    }
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
