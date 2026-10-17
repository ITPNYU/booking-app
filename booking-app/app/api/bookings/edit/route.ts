import { sendHTMLEmail } from "@/app/lib/sendHTMLEmail";
import { toFirebaseTimestampFromString } from "@/components/src/client/utils/serverDate";
import { TableNames } from "@/components/src/policy";
import {
  ApprovalFollowUpError,
  finalApprove,
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
import { getSecondaryContactName } from "@/components/src/utils/formatters";
import { resolveAnnexCalendarIds } from "@/components/src/utils/resourceServicesUtils";
import {
  getChangedServiceKeys,
  getServiceDecisions,
  type MediaCommonsServiceKey,
  SERVICE_APPROVAL_FIELDS,
} from "@/components/src/utils/serviceDecisions";
import { serverGetTenantResources } from "@/lib/tenant/serverGetTenantResources";
import { getCachedTenantSchema } from "@/lib/tenant/getCachedTenantSchema";
import {
  getProductionScheduleRequiredErrorMessage,
  isProductionScheduleMissingWhenRequired,
} from "@/components/src/client/routes/booking/utils/productionSchedule";
import { DEFAULT_TENANT } from "@/components/src/constants/tenants";
import { callXStateTransitionAPI } from "@/components/src/server/db";
import { getStatusFromXState } from "@/components/src/utils/statusFromXState";
import {
  getMediaCommonsServices,
  isMediaCommons,
  shouldUseXState,
} from "@/components/src/utils/tenantUtils";
import { logServerBookingChange } from "@/lib/firebase/server/adminDb";
import {
  anyRequesterIsBanned,
  BANNED_FROM_BOOKING_MESSAGE,
} from "@/lib/bookingBan";
import { Timestamp } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { omitStaffOnlyBookingFieldWrites } from "@/lib/api/staffOnlyBookingFields";
import {
  buildBookingContents,
  extractTenantFromRequest,
  getTenantRooms,
} from "../shared";

/**
 * Media Commons services the edit turned on or off: their request fields
 * changed and they are requested on one side only. Only `changedServices`
 * are checked, because the saved booking and the edit form can spell the
 * same answer differently (the form fans a legacy flat setup answer out to a
 * per-room map), which getChangedServiceKeys already reconciles.
 */
function getToggledServices(
  changedServices: MediaCommonsServiceKey[],
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  resources: Awaited<ReturnType<typeof serverGetTenantResources>>,
): MediaCommonsServiceKey[] {
  const requestedBefore = getMediaCommonsServices(before, resources);
  const requestedAfter = getMediaCommonsServices(after, resources);
  return changedServices.filter(
    service => requestedBefore[service] !== requestedAfter[service],
  );
}

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
    calendarEventId,
    roomId: selectedRoomIds,
    email,
    startDate: bookingCalendarInfo?.startStr,
    endDate: bookingCalendarInfo?.endStr,
    headerMessage: emailConfig.emailNotifications.requestedNeedsApproval,
    requestNumber: existingContents.requestNumber,
    origin: existingContents.origin || BookingOrigin.USER,
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

    // Use buildBookingContents for consistent Eastern Time formatting
    const formattedContents = buildBookingContents(
      otherContentsStrings,
      [selectedRoomIds],
      startDate,
      endDate,
      BookingStatusLabel.REQUESTED,
      existingContents.requestNumber,
    );

    const emailPromises = firstApprovers.map(recipient =>
      sendHTMLEmail({
        templateName: "booking_detail",
        contents: {
          ...formattedContents,
          requestNumber: `${existingContents.requestNumber}`,
          secondaryContactName: getSecondaryContactName(userEventInputs as any),
        },
        targetEmail: recipient,
        status: BookingStatusLabel.REQUESTED,
        eventTitle: data.title,
        requestNumber: existingContents.requestNumber,
        body: "",
        approverType: ApproverType.LIAISON,
        replyTo: email,
        schemaName: emailConfig.schemaName,
        tenant,
      }),
    );

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
    headerMessage: emailConfig.emailNotifications.requestedUser,
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
 * - For DECLINED bookings: Triggers XState "edit" transition (DECLINED → REQUESTED)
 * - For REQUESTED bookings: XState is only told about the edit when a service
 *   decision had to be cleared or a service was turned on or off
 *   (REQUESTED → REQUESTED, context reconciled, auto-approval re-evaluated)
 * - If the machine auto-approves the edited booking, it is approved instead of
 *   being sent to approvers
 * - Service decisions are reset per service: only the services whose requests
 *   changed lose their decision (ADR-0001)
 * - Clears declinedAt timestamp when editing declined bookings
 * - Only booking data is updated
 * - Sends notification email to first approvers
 * - Calendar event is recreated with [REQUESTED] status
 */
export async function PUT(request: NextRequest) {
  const {
    email,
    selectedRooms,
    allRooms,
    bookingCalendarInfo,
    data: rawData,
    calendarEventId,
    modifiedBy,
  } = await request.json();
  // memo and the cart number are written only through their dedicated routes.
  const data = omitStaffOnlyBookingFieldWrites(rawData);

  const tenant = extractTenantFromRequest(request);

  console.log(`✏️ USER EDIT REQUEST [${tenant?.toUpperCase() || "UNKNOWN"}]:`, {
    calendarEventId,
    email,
    tenant,
    modifiedBy,
    endpoint: "/api/bookings/edit",
    method: "PUT",
  });

  // Validation
  if (!modifiedBy) {
    return NextResponse.json(
      { error: "modifiedBy field is required for edits" },
      { status: 400 },
    );
  }

  // Both fields are client-supplied. A ban on either address blocks the
  // resubmit, which deletes the old event and creates a new REQUESTED one.
  if (await anyRequesterIsBanned([email, modifiedBy])) {
    return NextResponse.json(
      { error: BANNED_FROM_BOOKING_MESSAGE },
      { status: 403 },
    );
  }

  if (bookingCalendarInfo == null) {
    return NextResponse.json(
      { error: "missing bookingCalendarId" },
      { status: 500 },
    );
  }

  const tenantSchema = await getCachedTenantSchema(tenant ?? DEFAULT_TENANT);
  const productionScheduleConfig = tenantSchema?.form?.productionSchedule;
  if (
    isProductionScheduleMissingWhenRequired({
      enabled: productionScheduleConfig?.enabled,
      requiredAboveHours: productionScheduleConfig?.requiredAboveHours,
      start: bookingCalendarInfo?.start ?? bookingCalendarInfo?.startStr,
      end: bookingCalendarInfo?.end ?? bookingCalendarInfo?.endStr,
      productionSchedule: data?.productionSchedule,
    })
  ) {
    return NextResponse.json(
      {
        error: getProductionScheduleRequiredErrorMessage(
          productionScheduleConfig?.requiredAboveHours,
        ),
      },
      { status: 400 },
    );
  }

  try {
    // Get existing booking
    const existingContents = await serverBookingContents(
      calendarEventId,
      tenant,
    );
    const oldRoomIds = existingContents.roomId
      .split(",")
      .map(roomId => roomId.trim());

    const currentStatus = getStatusFromXState(existingContents, tenant);
    const usesXState = shouldUseXState(tenant);

    // Only REQUESTED and DECLINED bookings may be edited; PRE_APPROVED and others may not
    if (
      currentStatus !== BookingStatusLabel.REQUESTED &&
      currentStatus !== BookingStatusLabel.DECLINED
    ) {
      return NextResponse.json(
        {
          error: "Booking cannot be edited in its current status",
          currentStatus,
        },
        { status: 403 },
      );
    }

    const wasDeclined = currentStatus === BookingStatusLabel.DECLINED;
    if (usesXState) {
      console.log(
        `🔍 EDIT: Current booking status [${tenant?.toUpperCase()}]:`,
        {
          calendarEventId,
          currentStatus,
          hasDeclinedAt: !!existingContents.declinedAt,
          wasDeclined,
        },
      );
    }

    // Get rooms
    const tenantRooms = await getTenantRooms(tenant);
    const oldRooms = tenantRooms.filter((room: any) =>
      oldRoomIds.includes(`${room.roomId}`),
    );

    const selectedRoomIds = selectedRooms
      .map((r: { roomId: string }) => r.roomId)
      .join(", ");

    console.log("✏️ EDIT: Deleting old calendar events");
    // Delete old calendar events
    await Promise.all(
      oldRooms.map(async room => {
        await deleteEvent(room.calendarId, calendarEventId, room.roomId);
      }),
    );

    console.log("✏️ EDIT: Creating new calendar event");
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
      existingContents.origin || BookingOrigin.USER,
    );

    const description =
      `${await bookingContentsToDescription(
        bookingContentsForDesc,
        tenant,
      )}<p>Your reservation is not yet confirmed. The coordinator will review and finalize your reservation within a few days.</p>` +
      '<p>To cancel reservations please return to the Booking Tool, visit My Bookings, and click "cancel" on the booking at least 24 hours before the date of the event. Failure to cancel an unused booking is considered a no-show and may result in restricted use of the space.</p>';

    // Create calendar event
    const [room, ...otherRooms] = selectedRooms;
    const { calendarId } = room;

    if (calendarId == null) {
      throw Error(`calendarId not found for room ${room.roomId}`);
    }

    const tenantResources = await serverGetTenantResources(tenant);
    const annexCalendarIds = resolveAnnexCalendarIds(
      data?.annexByRoom,
      tenantResources,
    );
    const otherRoomEmails = [
      ...new Set([
        ...otherRooms.map((r: { calendarId: string }) => r.calendarId),
        ...annexCalendarIds,
      ]),
    ].filter(email => email && email !== calendarId);

    const truncatedTitle =
      data.title.length > 25 ? `${data.title.substring(0, 25)}...` : data.title;

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
      note: `Booking edited by user: ${modifiedBy}`,
      tenant,
    });

    // Update booking data
    const { id, ...formData } = data;
    const updatedData: any = {
      ...formData,
      roomId: selectedRoomIds,
      startDate: toFirebaseTimestampFromString(bookingCalendarInfo.startStr),
      endDate: toFirebaseTimestampFromString(bookingCalendarInfo.endStr),
      calendarEventId: newCalendarEventId,
      equipmentCheckedOut: false,
      requestedAt: Timestamp.now(),
      origin: existingContents.origin || BookingOrigin.USER,
    };

    // A resubmission resets the decision of every service whose request
    // changed, and keeps the rest (ADR-0001). An unchanged declined service
    // therefore declines the booking again once it re-enters Services Request.
    //
    // Flags are deleted (not nulled) after the booking update so
    // restoreXStateFromFirestore rebuilds the machine's servicesApproved from
    // the remaining decisions only.
    const changedServices = getChangedServiceKeys(existingContents, data);
    const previousDecisions = getServiceDecisions(existingContents);
    const clearedDecisionFields = changedServices
      .filter(service => typeof previousDecisions[service] === "boolean")
      .map(service => SERVICE_APPROVAL_FIELDS[service]);
    // Services turned on or off. The machine context lists the requested
    // services, and the bookings table and Services page read it from there.
    const toggledServices = isMediaCommons(tenant)
      ? getToggledServices(
          changedServices,
          existingContents,
          data,
          tenantResources,
        )
      : [];
    console.log(
      `🧮 EDIT: Service request changes [${tenant?.toUpperCase()}]:`,
      {
        calendarEventId,
        changedServices,
        toggledServices,
        previousDecisions,
        clearedDecisionFields,
      },
    );

    // Tell the machine about the edit when its persisted context no longer
    // matches the booking. A declined booking moves DECLINED → REQUESTED. A
    // requested booking stays where it is unless a decision was cleared or a
    // service was turned on or off. Re-entering Requested re-runs the
    // auto-approval evaluation, so a booking whose services were all turned
    // off can now auto-approve; ordinary REQUESTED edits should not trigger it.
    const needsMachineEdit =
      usesXState &&
      (wasDeclined ||
        clearedDecisionFields.length > 0 ||
        toggledServices.length > 0);

    // That evaluation reads rooms and times from the persisted context, which
    // still holds the original request's. The rest of the context (isVip,
    // origin) is kept as created.
    if (needsMachineEdit && existingContents.xstateData?.snapshot?.context) {
      updatedData["xstateData.snapshot.context.selectedRooms"] = selectedRooms;
      updatedData["xstateData.snapshot.context.bookingCalendarInfo"] =
        bookingCalendarInfo;
      updatedData["xstateData.snapshot.context.formData"] = formData;
    }

    // If booking was declined, clear the declinedAt timestamp to ensure status shows as REQUESTED
    if (existingContents.declinedAt) {
      updatedData.declinedAt = null;
      updatedData.declinedBy = null;
      updatedData.declineReason = null;
      console.log(
        `🧹 EDIT: Cleared declinedAt timestamp [${tenant?.toUpperCase()}]:`,
        {
          calendarEventId: newCalendarEventId,
          reason: "Booking edited, moving back to REQUESTED status",
        },
      );
    }

    console.log(`✅ PRESERVED ORIGIN FOR EDIT [${tenant?.toUpperCase()}]:`, {
      calendarEventId: newCalendarEventId,
      originalOrigin: existingContents.origin,
      newOrigin: updatedData.origin,
    });

    // Update booking with new calendarEventId first
    await serverUpdateDataByCalendarEventId(
      TableNames.BOOKING,
      calendarEventId,
      updatedData,
      tenant,
    );

    if (clearedDecisionFields.length > 0) {
      await serverDeleteFieldsByCalendarEventId(
        TableNames.BOOKING,
        newCalendarEventId,
        clearedDecisionFields,
        tenant,
      );
    }

    // Send the edit on the NEW calendarEventId. Restoring the actor rebuilds
    // servicesRequested and servicesApproved from the booking just written.
    let autoApproved = false;
    if (needsMachineEdit) {
      console.log(
        `🔄 EDIT: Triggering XState edit transition [${tenant?.toUpperCase()}]:`,
        {
          oldCalendarEventId: calendarEventId,
          newCalendarEventId,
          fromStatus: currentStatus,
          toStatus: "Requested",
          changedServices,
        },
      );

      const xstateResult = await callXStateTransitionAPI(
        newCalendarEventId, // Use NEW calendarEventId since booking was just updated
        "edit",
        modifiedBy,
        tenant,
        undefined,
        undefined,
        changedServices,
      );

      if (xstateResult.success) {
        autoApproved = xstateResult.newState === "Approved";
        console.log(
          `✅ EDIT: XState transition successful [${tenant?.toUpperCase()}]:`,
          {
            newCalendarEventId,
            newState: xstateResult.newState,
          },
        );
      } else {
        console.error(
          `🚨 EDIT: XState transition failed [${tenant?.toUpperCase()}]:`,
          {
            newCalendarEventId,
            error: xstateResult.error,
          },
        );
        // Continue with edit even if XState transition fails
      }
    }

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

    let followUpWarning: string | undefined;
    if (autoApproved) {
      // Approve it like the create flow does instead of asking approvers.
      console.log(
        `🎉 EDIT: Edited booking was auto-approved [${tenant?.toUpperCase()}]:`,
        { newCalendarEventId },
      );
      try {
        await finalApprove(newCalendarEventId, "System", tenant);
      } catch (error) {
        // The new event and booking doc already exist, so a failed approval
        // write or later follow-up must not report the edit as failed: a
        // client retry could create a duplicate booking.
        if (!(error instanceof ApprovalFollowUpError)) throw error;
        console.error("🚨 EDIT FOLLOW-UP FAILED:", error);
        followUpWarning = error.message;
      }
    } else {
      console.log("📧 EDIT: Sending email notifications");
      await sendEditNotificationEmails(
        newCalendarEventId,
        data,
        existingContents,
        selectedRoomIds,
        bookingCalendarInfo,
        email,
        tenant,
      );
    }

    // Verify the final status after edit
    const { serverGetDataByCalendarEventId } =
      await import("@/lib/firebase/server/adminDb");
    const finalBooking = (await serverGetDataByCalendarEventId(
      TableNames.BOOKING,
      newCalendarEventId,
      tenant,
    )) as any;
    const finalStatus = finalBooking
      ? getStatusFromXState(finalBooking, tenant)
      : "UNKNOWN";

    console.log(`✅ EDIT COMPLETED [${tenant?.toUpperCase()}]:`, {
      oldCalendarEventId: calendarEventId,
      newCalendarEventId,
      modifiedBy,
      finalStatus,
      hasDeclinedAt: !!finalBooking?.declinedAt,
      xstateValue: finalBooking?.xstateData?.snapshot?.value,
    });

    return NextResponse.json({
      result: "success",
      calendarEventId: newCalendarEventId,
      requestNumber: existingContents.requestNumber,
      status: finalStatus, // Include status in response for debugging
      ...(followUpWarning ? { warning: followUpWarning } : {}),
    });
  } catch (error) {
    console.error("❌ EDIT FAILED:", error);
    return NextResponse.json(
      { result: "error", message: "Failed to edit booking" },
      { status: 500 },
    );
  }
}
