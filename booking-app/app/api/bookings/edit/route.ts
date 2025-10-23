import { sendHTMLEmail } from "@/app/lib/sendHTMLEmail";
import { toFirebaseTimestampFromString } from "@/components/src/client/utils/serverDate";
import { TableNames } from "@/components/src/policy";
import {
  firstApproverEmails,
  serverBookingContents,
  serverDeleteFieldsByCalendarEventId,
  serverSendBookingDetailEmail,
  serverUpdateDataByCalendarEventId,
} from "@/components/src/server/admin";
import {
  bookingContentsToDescription,
  deleteEvent,
  insertEvent,
} from "@/components/src/server/calendars";
import { getTenantEmailConfig } from "@/components/src/server/emails";
import {
  ApproverType,
  BookingFormDetails,
  BookingOrigin,
  BookingStatusLabel,
} from "@/components/src/types";
import { logServerBookingChange } from "@/lib/firebase/server/adminDb";
import { Timestamp } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import {
  buildBookingContents,
  extractTenantFromRequest,
  getTenantRooms,
} from "../shared";

/**
 * Send email notifications for edit
 */
async function sendEditNotificationEmails(
  calendarEventId: string,
  data: any,
  existingContents: any,
  selectedRoomIds: string,
  bookingCalendarInfo: any,
  email: string,
  tenant?: string,
) {
  console.log(`📧 EDIT EMAIL NOTIFICATIONS [${tenant?.toUpperCase()}]:`, {
    calendarEventId,
    department: data.department,
    email,
  });

  // Get tenant email configuration
  const emailConfig = await getTenantEmailConfig(tenant);

  // Get first approvers for the department
  const firstApprovers = await firstApproverEmails(data.department);
  console.log(`📧 FIRST APPROVERS [${tenant?.toUpperCase()}]:`, {
    department: data.department,
    firstApprovers,
    count: firstApprovers.length,
  });

  const userEventInputs: BookingFormDetails = {
    ...data,
    calendarEventId: calendarEventId,
    roomId: selectedRoomIds,
    email,
    startDate: bookingCalendarInfo?.startStr,
    endDate: bookingCalendarInfo?.endStr,
    headerMessage: emailConfig.emailMessages.firstApprovalRequest,
    requestNumber: existingContents.requestNumber,
    origin: BookingOrigin.USER,
  };

  // Send approval request emails to first approvers
  if (firstApprovers.length > 0) {
    console.log(`📧 SENDING TO FIRST APPROVERS [${tenant?.toUpperCase()}]:`, {
      recipients: firstApprovers,
      calendarEventId,
    });

    // Format dates properly
    const startDate = new Date(bookingCalendarInfo?.startStr);
    const endDate = new Date(bookingCalendarInfo?.endStr);

    // Remove equipmentCheckedOut field
    const { equipmentCheckedOut, ...otherContents } = userEventInputs as any;
    const otherContentsStrings = Object.fromEntries(
      Object.entries(otherContents).map(([key, value]) => [
        key,
        value instanceof Timestamp ? value.toDate().toISOString() : value,
      ]),
    );

    const emailPromises = firstApprovers.map(recipient => {
      return sendHTMLEmail({
        templateName: "booking_detail",
        contents: {
          ...otherContentsStrings,
          roomId: selectedRoomIds,
          startDate: startDate.toLocaleDateString(),
          endDate: endDate.toLocaleDateString(),
          startTime: startDate.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          }),
          endTime: endDate.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          }),
          requestNumber: existingContents.requestNumber + "",
        },
        targetEmail: recipient,
        status: BookingStatusLabel.REQUESTED,
        eventTitle: data.title,
        requestNumber: existingContents.requestNumber,
        body: "",
        approverType: ApproverType.LIAISON,
        replyTo: email,
        schemaName: emailConfig.schemaName,
      });
    });

    await Promise.all(emailPromises);

    console.log(`✅ APPROVAL EMAILS SENT [${tenant?.toUpperCase()}]`);
  } else {
    console.warn(`⚠️ NO FIRST APPROVERS FOUND [${tenant?.toUpperCase()}]:`, {
      department: data.department,
      calendarEventId,
    });
  }

  // Send confirmation email to user
  console.log(`📧 SENDING CONFIRMATION TO USER [${tenant?.toUpperCase()}]:`, {
    email,
    calendarEventId,
  });

  await serverSendBookingDetailEmail({
    calendarEventId,
    targetEmail: email,
    headerMessage: emailConfig.emailMessages.requestConfirmation,
    status: BookingStatusLabel.REQUESTED,
    replyTo: email,
    tenant,
  });

  console.log(`✅ USER CONFIRMATION SENT [${tenant?.toUpperCase()}]`);
}

/**
 * PUT /api/bookings/edit
 *
 * User editing their own non-approved booking.
 * This is for when a user wants to change details of their pending booking request.
 *
 * Characteristics:
 * - User can only edit their own non-approved bookings
 * - XState remains in "Requested" state (no state transition)
 * - Only booking data is updated
 * - Sends notification email to first approvers
 * - Calendar event is recreated with [REQUESTED] or [MODIFIED] status
 */
export async function PUT(request: NextRequest) {
  const {
    email,
    selectedRooms,
    allRooms,
    bookingCalendarInfo,
    data,
    calendarEventId,
    modifiedBy,
  } = await request.json();

  const tenant = extractTenantFromRequest(request);

  console.log(`✏️ USER EDIT REQUEST [${tenant?.toUpperCase() || "UNKNOWN"}]:`, {
    calendarEventId,
    email,
    tenant,
    modifiedBy,
  });

  // Validation
  if (!modifiedBy) {
    return NextResponse.json(
      { error: "modifiedBy field is required for edits" },
      { status: 400 },
    );
  }

  if (bookingCalendarInfo == null) {
    return NextResponse.json(
      { error: "missing bookingCalendarId" },
      { status: 500 },
    );
  }

  try {
    // Get existing booking
    const existingContents = await serverBookingContents(
      calendarEventId,
      tenant,
    );
    const oldRoomIds = existingContents.roomId.split(",").map(roomId => roomId.trim());

    // Get rooms
    const tenantRooms = await getTenantRooms(tenant);
    const oldRooms = tenantRooms.filter((room: any) =>
      oldRoomIds.includes(room.roomId + ""),
    );

    const selectedRoomIds = selectedRooms
      .map((r: { roomId: number }) => r.roomId)
      .join(", ");

    console.log(`✏️ EDIT: Deleting old calendar events`);
    // Delete old calendar events
    await Promise.all(
      oldRooms.map(async room => {
        await deleteEvent(room.calendarId, calendarEventId, room.roomId);
      }),
    );

    console.log(`✏️ EDIT: Creating new calendar event`);
    // Create new calendar event with REQUESTED/MODIFIED status
    const startDateObj = new Date(bookingCalendarInfo.startStr);
    const endDateObj = new Date(bookingCalendarInfo.endStr);

    const statusLabel = BookingStatusLabel.REQUESTED;
    const bookingContentsForDesc = buildBookingContents(
      data,
      selectedRoomIds,
      startDateObj,
      endDateObj,
      statusLabel,
      data.requestNumber ?? existingContents.requestNumber,
      "user",
    );

    const description =
      (await bookingContentsToDescription(bookingContentsForDesc, tenant)) +
      "<p>Your reservation is not yet confirmed. The coordinator will review and finalize your reservation within a few days.</p>" +
      '<p>To cancel reservations please return to the Booking Tool, visit My Bookings, and click "cancel" on the booking at least 24 hours before the date of the event. Failure to cancel an unused booking is considered a no-show and may result in restricted use of the space.</p>';

    // Create calendar event
    const [room, ...otherRooms] = selectedRooms;
    const calendarId = room.calendarId;

    if (calendarId == null) {
      throw Error("calendarId not found for room " + room.roomId);
    }

    const otherRoomEmails = otherRooms.map(
      (r: { calendarId: string }) => r.calendarId,
    );

    const truncatedTitle =
      data.title.length > 25 ? data.title.substring(0, 25) + "..." : data.title;

    const event = await insertEvent({
      calendarId,
      title: `[${statusLabel}] ${selectedRoomIds} ${truncatedTitle}`,
      description,
      startTime: bookingCalendarInfo.startStr,
      endTime: bookingCalendarInfo.endStr,
      roomEmails: otherRoomEmails,
    });

    const newCalendarEventId = event.id;
    console.log(
      `✏️ EDIT: Created new calendar event with ID: ${newCalendarEventId}`,
    );

    // Log the edit action
    await logServerBookingChange({
      bookingId: existingContents.id,
      status: BookingStatusLabel.REQUESTED,
      changedBy: modifiedBy,
      requestNumber: existingContents.requestNumber,
      calendarEventId: newCalendarEventId,
      note: "Booking edited by user: " + modifiedBy,
      tenant,
    });

    // Update booking data
    const { id, ...formData } = data;
    const updatedData = {
      ...formData,
      roomId: selectedRoomIds,
      startDate: toFirebaseTimestampFromString(bookingCalendarInfo.startStr),
      endDate: toFirebaseTimestampFromString(bookingCalendarInfo.endStr),
      calendarEventId: newCalendarEventId,
      equipmentCheckedOut: false,
      requestedAt: Timestamp.now(),
      origin: BookingOrigin.USER,
    };

    await serverUpdateDataByCalendarEventId(
      TableNames.BOOKING,
      calendarEventId,
      updatedData,
      tenant,
    );

    // For edit, we don't need to delete approval fields as they shouldn't exist
    // But do it anyway for safety
    await serverDeleteFieldsByCalendarEventId(
      TableNames.BOOKING,
      newCalendarEventId,
      [
        "finalApprovedAt",
        "finalApprovedBy",
        "firstApprovedAt",
        "firstApprovedBy",
      ],
      tenant,
    );

    // Send email notifications
    console.log(`📧 EDIT: Sending email notifications`);
    await sendEditNotificationEmails(
      newCalendarEventId,
      data,
      existingContents,
      selectedRoomIds,
      bookingCalendarInfo,
      email,
      tenant,
    );

    console.log(`✅ EDIT COMPLETED [${tenant?.toUpperCase()}]:`, {
      calendarEventId: newCalendarEventId,
      modifiedBy,
    });

    return NextResponse.json({
      result: "success",
      calendarEventId: newCalendarEventId,
      requestNumber: existingContents.requestNumber,
    });
  } catch (error) {
    console.error(`❌ EDIT FAILED:`, error);
    return NextResponse.json(
      { result: "error", message: "Failed to edit booking" },
      { status: 500 },
    );
  }
}
