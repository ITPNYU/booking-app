import { NextRequest, NextResponse } from "next/server";
import admin from "@/lib/firebase/server/firebaseAdmin";
import { TableNames } from "@/components/src/policy";
import { isValidTenant } from "@/components/src/constants/tenants";
import { BookingStatusLabel, PagePermission } from "@/components/src/types";
import {
  serverBookingContents,
  serverSendBookingDetailEmail,
} from "@/components/src/server/admin";
import {
  replaceCalendarAttendee,
  updateCalendarEvent,
} from "@/components/src/server/calendars";
import { getTenantEmailConfig } from "@/components/src/server/emails";
import { getStatusFromXState } from "@/components/src/utils/statusFromXState";
import {
  buildRequesterUpdates,
  canReassignRequester,
  newRequesterHeaderMessage,
  previousRequesterHeaderMessage,
  REASSIGNED_EMAIL_SUBJECT_STATUS,
  reassignmentHistoryNote,
  requesterEmailForNetId,
  validateReassignRequesterInput,
} from "@/components/src/utils/reassignRequester";
import { resolveCallerRole } from "@/lib/api/authz";
import { resolveCollectionName } from "@/lib/api/firestoreServer";
import { requireSession } from "@/lib/api/requireSession";
import { requesterIsBanned } from "@/lib/bookingBan";
import { logServerBookingChange } from "@/lib/firebase/server/adminDb";
import { extractTenantFromRequest } from "../shared";

type TransactionOutcome =
  | { error: string; status: number }
  | {
      booking: Record<string, any>;
      bookingStatus: BookingStatusLabel;
      previousEmail: string;
    };

const normalizeEmail = (value: unknown): string => {
  if (typeof value !== "string") return "";
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return "";
  return trimmed.includes("@") ? trimmed : `${trimmed}@nyu.edu`;
};

/**
 * PUT /api/bookings/reassign
 *
 * An admin hands an existing booking to a different requester (#1447).
 *
 * The booking keeps its status, request number, calendar event, role,
 * department and sponsor; only the requester fields change. The booking then
 * shows in the new requester's My Bookings, and every later email and the
 * approval invitation go to them, because those all read the booking's
 * `email`. No state machine event is involved: the booking does not change
 * state, and the machines re-read `email` from the booking on restore.
 *
 * After the write, the route logs a MODIFIED history row, refreshes the
 * calendar event's details, moves the calendar invitation if the old
 * requester was already invited, and emails both requesters. Those follow-up
 * steps never fail the request; they come back as `warning`.
 */
export async function PUT(request: NextRequest) {
  const session = await requireSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenant = extractTenantFromRequest(request);
  if (!isValidTenant(tenant)) {
    return NextResponse.json({ error: "Invalid tenant" }, { status: 400 });
  }

  const role = await resolveCallerRole(session, tenant);
  if (role !== PagePermission.ADMIN && role !== PagePermission.SUPER_ADMIN) {
    return NextResponse.json(
      { error: "Only admins can reassign a booking" },
      { status: 403 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const validation = validateReassignRequesterInput(body);
  if (validation.ok === false) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }
  const input = validation.value;
  const { calendarEventId } = input;
  const newEmail = requesterEmailForNetId(input.netId);

  if (await requesterIsBanned(newEmail, tenant)) {
    return NextResponse.json(
      { error: `${newEmail} is banned from booking` },
      { status: 403 },
    );
  }

  const db = admin.firestore();
  const collectionName = resolveCollectionName(TableNames.BOOKING, tenant);

  let bookingId: string;
  let outcome: TransactionOutcome;
  try {
    const snapshot = await db
      .collection(collectionName)
      .where("calendarEventId", "==", calendarEventId)
      .limit(1)
      .get();
    if (snapshot.empty) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }
    const ref = snapshot.docs[0].ref;
    bookingId = ref.id;

    // Re-read inside the transaction so a status change or another
    // reassignment between the lookup and the write is not overwritten.
    outcome = await db.runTransaction(async transaction => {
      const doc = await transaction.get(ref);
      const booking = doc.data() as Record<string, any> | undefined;
      if (!booking) {
        return { error: "Booking not found", status: 404 };
      }
      const bookingStatus = getStatusFromXState(
        booking as any,
        tenant,
      ) as BookingStatusLabel;
      if (!canReassignRequester(bookingStatus)) {
        // 422, not 409: the client treats 409 as a calendar slot conflict.
        return {
          error: `A ${bookingStatus} booking cannot be reassigned`,
          status: 422,
        };
      }
      const previousEmail = normalizeEmail(booking.email);
      if (previousEmail === newEmail) {
        return {
          error: `${newEmail} is already the requester`,
          status: 400,
        };
      }
      transaction.update(ref, buildRequesterUpdates(booking, input));
      return { booking, bookingStatus, previousEmail };
    });
  } catch (error) {
    console.error("Error reassigning booking requester:", error);
    return NextResponse.json(
      { error: "Failed to reassign the booking" },
      { status: 500 },
    );
  }

  if ("error" in outcome) {
    return NextResponse.json(
      { error: outcome.error },
      { status: outcome.status },
    );
  }
  const { booking, bookingStatus, previousEmail } = outcome;
  const newName = `${input.firstName} ${input.lastName}`;
  const warnings: string[] = [];

  // Write history first so the emails below include this row.
  try {
    await logServerBookingChange({
      bookingId,
      calendarEventId,
      status: BookingStatusLabel.MODIFIED,
      changedBy: session.email,
      requestNumber: booking.requestNumber ?? 0,
      note: reassignmentHistoryNote(previousEmail || "unknown", newEmail),
      tenant,
    });
  } catch (error) {
    console.error("Failed to log requester change:", error);
    warnings.push("the booking history was not updated");
  }

  try {
    const contents = await serverBookingContents(calendarEventId, tenant);
    await updateCalendarEvent(calendarEventId, {}, contents, tenant);
  } catch (error) {
    console.error("Failed to refresh calendar event details:", error);
    warnings.push("the Google Calendar event details were not updated");
  }

  if (previousEmail) {
    try {
      await replaceCalendarAttendee({
        calendarEventId,
        roomId: String(booking.roomId ?? ""),
        previousEmail,
        newEmail,
        keepPreviousAttendee:
          normalizeEmail(booking.secondaryEmail) === previousEmail,
        tenant,
      });
    } catch (error) {
      console.error("Failed to move the calendar invitation:", error);
      warnings.push(
        "the Google Calendar invitation was not moved to the new requester",
      );
    }
  }

  const emailConfig = await getTenantEmailConfig(tenant);
  const sendEmail = async (
    targetEmail: string,
    headerMessage: string,
    failure: string,
  ) => {
    try {
      const response = await serverSendBookingDetailEmail({
        calendarEventId,
        targetEmail,
        headerMessage,
        status: bookingStatus,
        tenant,
        subjectStatusOverride: REASSIGNED_EMAIL_SUBJECT_STATUS,
      });
      if (!response.ok) {
        throw new Error(`sendEmail returned ${response.status}`);
      }
    } catch (error) {
      console.error(`Failed to email ${targetEmail}:`, error);
      warnings.push(failure);
    }
  };

  if (input.notifyNewRequester) {
    await sendEmail(
      newEmail,
      newRequesterHeaderMessage(
        bookingStatus,
        booking.origin,
        emailConfig.emailNotifications,
      ),
      "the email to the new requester was not sent",
    );
  }
  if (input.notifyPreviousRequester && previousEmail) {
    await sendEmail(
      previousEmail,
      previousRequesterHeaderMessage(newName, newEmail),
      "the email to the previous requester was not sent",
    );
  }

  return NextResponse.json({
    success: true,
    email: newEmail,
    previousEmail,
    ...(warnings.length > 0
      ? {
          warning: `The booking was reassigned to ${newName}, but ${warnings.join(
            ", and ",
          )}.`,
        }
      : {}),
  });
}
