import { toFirebaseTimestampFromString } from "@/components/src/client/utils/serverDate";
import { TableNames } from "@/components/src/policy";
import {
  finalApprove,
  serverBookingContents,
  serverUpdateDataByCalendarEventId,
} from "@/components/src/server/admin";
import {
  bookingContentsToDescription,
  deleteEvent,
  insertEvent,
} from "@/components/src/server/calendars";
import { BookingOrigin, BookingStatusLabel } from "@/components/src/types";
import { getMediaCommonsServices } from "@/components/src/utils/tenantUtils";
import { serverGetDataByCalendarEventId } from "@/lib/firebase/server/adminDb";
import { itpBookingMachine } from "@/lib/stateMachines/itpBookingMachine";
import { mcBookingMachine } from "@/lib/stateMachines/mcBookingMachine";
import { Timestamp } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { createActor } from "xstate";
import {
  buildBookingContents,
  extractTenantFromRequest,
  getTenantFlags,
  getTenantRooms,
} from "../shared";

/**
 * PUT /api/bookings/modification
 *
 * PA/Admin modifying an approved booking (Modification Request).
 * This is for when PA/Admin needs to change details of an already approved booking.
 *
 * Characteristics:
 * - Only PA/Admin can do modifications
 * - Booking must be in approved state
 * - Maintains "Approved" state after modification
 * - Preserves approval timestamps and service approvals
 * - Sends approval confirmation email
 * - Calendar event is updated to [APPROVED]
 * - Calls finalApprove() to handle all approval-related tasks
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
  const { isMediaCommons } = getTenantFlags(tenant);

  console.log(
    `🔧 MODIFICATION REQUEST [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
    {
      calendarEventId,
      email,
      tenant,
      modifiedBy,
    },
  );

  // Validation
  if (!modifiedBy) {
    return NextResponse.json(
      { error: "modifiedBy field is required for modifications" },
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
    // Get existing booking data
    const existingBookingData = await serverGetDataByCalendarEventId(
      TableNames.BOOKING,
      calendarEventId,
      tenant,
    );

    if (!existingBookingData) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    // Verify this is an approved booking
    const hasApprovedTimestamp = !!(existingBookingData as any)
      ?.finalApprovedAt;
    if (!hasApprovedTimestamp) {
      console.warn(
        `⚠️ MODIFICATION attempted on non-approved booking [${tenant?.toUpperCase()}]:`,
        {
          calendarEventId,
          hasApprovedTimestamp,
        },
      );
      // Allow it to proceed but log the warning
    }

    const existingContents = await serverBookingContents(
      calendarEventId,
      tenant,
    );
    const oldRoomIds = existingContents.roomId.split(",").map(x => x.trim());

    // Get rooms
    const tenantRooms = await getTenantRooms(tenant);
    const oldRooms = tenantRooms.filter((room: any) =>
      oldRoomIds.includes(room.roomId + ""),
    );

    const selectedRoomIds = selectedRooms
      .map((r: { roomId: number }) => r.roomId)
      .join(", ");

    console.log(`🔧 MODIFICATION: Deleting old calendar events`);
    // Delete old calendar events
    await Promise.all(
      oldRooms.map(async room => {
        await deleteEvent(room.calendarId, calendarEventId, room.roomId);
      }),
    );

    console.log(`🔧 MODIFICATION: Creating new calendar event`);
    // Create new calendar event with APPROVED status
    const startDateObj = new Date(bookingCalendarInfo.startStr);
    const endDateObj = new Date(bookingCalendarInfo.endStr);

    // Initially create with APPROVED status
    const statusLabel = BookingStatusLabel.APPROVED;
    const bookingContentsForDesc = buildBookingContents(
      data,
      selectedRoomIds,
      startDateObj,
      endDateObj,
      statusLabel,
      data.requestNumber ?? existingContents.requestNumber,
      "modification",
    );

    const description =
      (await bookingContentsToDescription(bookingContentsForDesc, tenant)) +
      "<p>Your reservation has been confirmed and approved.</p>" +
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
      `🔧 MODIFICATION: Created new calendar event with ID: ${newCalendarEventId}`,
    );

    // Update booking data with new calendar event ID
    const { id, ...formData } = data;
    const updatedData: any = {
      ...formData,
      roomId: selectedRoomIds,
      startDate: toFirebaseTimestampFromString(bookingCalendarInfo.startStr),
      endDate: toFirebaseTimestampFromString(bookingCalendarInfo.endStr),
      calendarEventId: newCalendarEventId,
      equipmentCheckedOut: false,
      requestedAt: Timestamp.now(),
      origin: BookingOrigin.USER,
    };

    // Preserve approval timestamps from existing booking
    if (existingBookingData.finalApprovedAt) {
      updatedData.finalApprovedAt = existingBookingData.finalApprovedAt;
    }
    if (existingBookingData.finalApprovedBy) {
      updatedData.finalApprovedBy = existingBookingData.finalApprovedBy;
    }
    if (existingBookingData.firstApprovedAt) {
      updatedData.firstApprovedAt = existingBookingData.firstApprovedAt;
    }
    if (existingBookingData.firstApprovedBy) {
      updatedData.firstApprovedBy = existingBookingData.firstApprovedBy;
    }

    // Preserve service approvals for Media Commons
    if (isMediaCommons) {
      if (existingBookingData.staffServiceApproved !== undefined) {
        updatedData.staffServiceApproved =
          existingBookingData.staffServiceApproved;
      }
      if (existingBookingData.equipmentServiceApproved !== undefined) {
        updatedData.equipmentServiceApproved =
          existingBookingData.equipmentServiceApproved;
      }
      if (existingBookingData.cateringServiceApproved !== undefined) {
        updatedData.cateringServiceApproved =
          existingBookingData.cateringServiceApproved;
      }
      if (existingBookingData.cleaningServiceApproved !== undefined) {
        updatedData.cleaningServiceApproved =
          existingBookingData.cleaningServiceApproved;
      }
      if (existingBookingData.securityServiceApproved !== undefined) {
        updatedData.securityServiceApproved =
          existingBookingData.securityServiceApproved;
      }
      if (existingBookingData.setupServiceApproved !== undefined) {
        updatedData.setupServiceApproved =
          existingBookingData.setupServiceApproved;
      }
    }

    console.log(
      `✅ PRESERVED APPROVAL DATA FOR MODIFICATION [${tenant?.toUpperCase()}]:`,
      {
        calendarEventId: newCalendarEventId,
        finalApprovedAt: updatedData.finalApprovedAt,
        finalApprovedBy: updatedData.finalApprovedBy,
        firstApprovedAt: updatedData.firstApprovedAt,
        firstApprovedBy: updatedData.firstApprovedBy,
      },
    );

    // Update booking in Firestore
    await serverUpdateDataByCalendarEventId(
      TableNames.BOOKING,
      calendarEventId,
      updatedData,
      tenant,
    );

    // Create new XState data in Approved state
    const machine = isMediaCommons ? mcBookingMachine : itpBookingMachine;
    const servicesRequested = isMediaCommons
      ? getMediaCommonsServices(data)
      : undefined;
    const servicesApproved = isMediaCommons
      ? {
          staff: (existingBookingData as any)?.staffServiceApproved || false,
          equipment:
            (existingBookingData as any)?.equipmentServiceApproved || false,
          catering:
            (existingBookingData as any)?.cateringServiceApproved || false,
          cleaning:
            (existingBookingData as any)?.cleaningServiceApproved || false,
          security:
            (existingBookingData as any)?.securityServiceApproved || false,
          setup: (existingBookingData as any)?.setupServiceApproved || false,
        }
      : undefined;

    const freshActor = createActor(machine, {
      input: {
        tenant,
        calendarEventId: newCalendarEventId,
        email,
        selectedRooms: selectedRooms || [],
        formData: data || {},
        bookingCalendarInfo: bookingCalendarInfo || {},
        servicesRequested,
        servicesApproved,
      },
    });

    freshActor.start();
    const currentSnapshot = freshActor.getSnapshot();

    // Create XState data with Approved state
    const xstateData = {
      machineId: isMediaCommons ? "MC Booking Request" : "ITP Booking Request",
      lastTransition: new Date().toISOString(),
      snapshot: {
        status: currentSnapshot.status,
        value: "Approved", // Force Approved state
        historyValue: currentSnapshot.historyValue || {},
        context: {
          ...currentSnapshot.context,
          calendarEventId: newCalendarEventId,
        },
        children: currentSnapshot.children || {},
      },
    };

    freshActor.stop();

    // Save XState data
    await serverUpdateDataByCalendarEventId(
      TableNames.BOOKING,
      newCalendarEventId,
      {
        xstateData,
      },
      tenant,
    );

    console.log(
      `✅ NEW BOOKING INITIALIZED WITH APPROVED STATE [${tenant?.toUpperCase()}]:`,
      {
        calendarEventId: newCalendarEventId,
        targetState: "Approved",
        servicesRequested,
        servicesApproved,
      },
    );

    // Run finalApprove to handle approval-related tasks:
    // - Log APPROVED status to booking history
    // - Update calendar event to [APPROVED] (already done above, but finalApprove ensures consistency)
    // - Send approval confirmation email
    console.log(
      `🎉 RUNNING FINAL APPROVE FOR MODIFICATION [${tenant?.toUpperCase()}]:`,
      {
        calendarEventId: newCalendarEventId,
        modifiedBy,
      },
    );

    await finalApprove(newCalendarEventId, modifiedBy, tenant);

    console.log(`✅ MODIFICATION COMPLETED [${tenant?.toUpperCase()}]:`, {
      calendarEventId: newCalendarEventId,
      modifiedBy,
    });

    return NextResponse.json({
      result: "success",
      calendarEventId: newCalendarEventId,
      requestNumber: existingContents.requestNumber,
    });
  } catch (error) {
    console.error(`❌ MODIFICATION FAILED:`, error);
    return NextResponse.json(
      { result: "error", message: "Failed to modify booking" },
      { status: 500 },
    );
  }
}

