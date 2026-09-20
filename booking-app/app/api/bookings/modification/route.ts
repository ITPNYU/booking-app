import { toFirebaseTimestampFromString } from "@/components/src/client/utils/serverDate";
import { TableNames } from "@/components/src/policy";
import {
  finalApprove,
  serverBookingContents,
  serverSendBookingDetailEmail,
  serverUpdateDataByCalendarEventId,
} from "@/components/src/server/admin";
import {
  bookingContentsToDescription,
  deleteEvent,
  insertEvent,
} from "@/components/src/server/calendars";
import {
  Booking,
  BookingOrigin,
  BookingStatusLabel,
  Role,
} from "@/components/src/types";
import { resolveAnnexCalendarIds } from "@/components/src/utils/resourceServicesUtils";
import { getStatusFromXState } from "@/components/src/utils/statusFromXState";
import { getMediaCommonsServices } from "@/components/src/utils/tenantUtils";
import { serverGetTenantResources } from "@/lib/tenant/serverGetTenantResources";
import {
  logServerBookingChange,
  serverGetDataByCalendarEventId,
} from "@/lib/firebase/server/adminDb";
import { Timestamp } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { createActor } from "xstate";
import {
  buildBookingContents,
  extractTenantFromRequest,
  getTenantFlags,
  getTenantRooms,
} from "../shared";

type BookingWithId = Booking & { id?: string };

function getModificationTarget(existingBookingData: Booking): {
  isCheckedIn: boolean;
  isApproved: boolean;
  statusLabel: BookingStatusLabel;
  xstateValue: "Checked In" | "Approved";
} {
  const status = getStatusFromXState(existingBookingData);
  const isCheckedIn = status === BookingStatusLabel.CHECKED_IN;
  // Derive from live status only. finalApprovedAt is never cleared after
  // cancel/decline/checkout/close/no-show, so it cannot gate modifications.
  const isApproved = status === BookingStatusLabel.APPROVED;
  return {
    isCheckedIn,
    isApproved,
    statusLabel: isCheckedIn
      ? BookingStatusLabel.CHECKED_IN
      : BookingStatusLabel.APPROVED,
    xstateValue: isCheckedIn ? "Checked In" : "Approved",
  };
}

function buildPreservedXStateData(
  existingBookingData: Booking,
  newCalendarEventId: string,
  xstateValue: "Checked In" | "Approved",
  contextUpdates: Record<string, unknown> = {},
): Record<string, unknown> | null {
  const existing = existingBookingData.xstateData;
  if (!existing?.snapshot) return null;
  return {
    ...existing,
    lastTransition: new Date().toISOString(),
    snapshot: {
      ...existing.snapshot,
      value: xstateValue,
      context: {
        ...existing.snapshot.context,
        ...contextUpdates,
        calendarEventId: newCalendarEventId,
      },
    },
  };
}

/**
 * PUT /api/bookings/modification
 *
 * PA/Services/Admin modifying an approved or checked-in booking.
 *
 * Characteristics:
 * - Only PA/Services/Admin can do modifications
 * - Booking must be Approved or Checked In
 * - Approved bookings stay Approved (finalApprove + confirmation email)
 * - Checked In bookings stay Checked In (no re-approval or re-check-in)
 * - Preserves approval timestamps, check-in timestamps, and service approvals
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
    const existingBookingData = await serverGetDataByCalendarEventId<Booking>(
      TableNames.BOOKING,
      calendarEventId,
      tenant,
    );

    if (!existingBookingData) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    const { isCheckedIn, isApproved, statusLabel, xstateValue } =
      getModificationTarget(existingBookingData);

    if (!isCheckedIn && !isApproved) {
      console.warn(
        `⚠️ MODIFICATION rejected for non-approved booking [${tenant?.toUpperCase()}]:`,
        {
          calendarEventId,
          isCheckedIn,
          isApproved,
          hasApprovedTimestamp: !!existingBookingData.finalApprovedAt,
        },
      );
      // 422, not 409: the client treats 409 as a calendar slot conflict.
      return NextResponse.json(
        { error: "Booking must be Approved or Checked In to modify" },
        { status: 422 },
      );
    }

    const existingContents = await serverBookingContents(
      calendarEventId,
      tenant,
    );
    const oldRoomIds = existingContents.roomId
      .split(",")
      .map(roomId => roomId.trim());

    // Get rooms
    const tenantRooms = await getTenantRooms(tenant);
    const oldRooms = tenantRooms.filter((room: any) =>
      oldRoomIds.includes(`${room.roomId}`),
    );

    const selectedRoomIds = selectedRooms
      .map((r: { roomId: string }) => r.roomId)
      .join(", ");

    console.log("🔧 MODIFICATION: Deleting old calendar events");
    // Delete old calendar events
    await Promise.all(
      oldRooms.map(async room => {
        await deleteEvent(room.calendarId, calendarEventId, room.roomId);
      }),
    );

    console.log("🔧 MODIFICATION: Creating new calendar event");
    const startDateObj = new Date(bookingCalendarInfo.startStr);
    const endDateObj = new Date(bookingCalendarInfo.endStr);

    const bookingContentsForDesc = buildBookingContents(
      data,
      selectedRoomIds,
      startDateObj,
      endDateObj,
      statusLabel,
      data.requestNumber ?? existingContents.requestNumber,
      existingBookingData.origin || BookingOrigin.USER,
    );

    const statusNote = isCheckedIn
      ? "<p>Your reservation has been updated.</p>"
      : "<p>Your reservation has been confirmed and approved.</p>";
    const description =
      `${await bookingContentsToDescription(
        bookingContentsForDesc,
        tenant,
      )}${statusNote}` +
      '<p>To cancel reservations please return to the Booking Tool, visit My Bookings, and click "cancel" on the booking at least 24 hours before the date of the event. Failure to cancel an unused booking is considered a no-show and may result in restricted use of the space.</p>';

    // Create calendar event
    const [room, ...otherRooms] = selectedRooms;
    const { calendarId } = room;

    if (calendarId == null) {
      throw Error(`calendarId not found for room ${room.roomId}`);
    }

    const annexCalendarIds = resolveAnnexCalendarIds(
      data?.annexByRoom,
      await serverGetTenantResources(tenant),
    );
    const otherRoomEmails = [
      ...new Set([
        ...otherRooms.map((r: { calendarId: string }) => r.calendarId),
        ...annexCalendarIds,
      ]),
    ].filter((email) => email && email !== calendarId);

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
      equipmentCheckedOut: isCheckedIn
        ? (existingBookingData.equipmentCheckedOut ?? false)
        : false,
      origin: existingBookingData.origin || BookingOrigin.USER,
    };

    if (isCheckedIn && existingBookingData.requestedAt) {
      updatedData.requestedAt = existingBookingData.requestedAt;
    } else {
      updatedData.requestedAt = Timestamp.now();
    }

    console.log(
      `✅ PRESERVED ORIGIN FOR MODIFICATION [${tenant?.toUpperCase()}]:`,
      {
        calendarEventId: newCalendarEventId,
        originalOrigin: existingBookingData.origin,
        newOrigin: updatedData.origin,
      },
    );

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
    if (existingBookingData.checkedInAt) {
      updatedData.checkedInAt = existingBookingData.checkedInAt;
    }
    if (existingBookingData.checkedInBy) {
      updatedData.checkedInBy = existingBookingData.checkedInBy;
    }
    if (existingBookingData.walkedInAt) {
      updatedData.walkedInAt = existingBookingData.walkedInAt;
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
      if (existingBookingData.furnishingsServiceApproved !== undefined) {
        updatedData.furnishingsServiceApproved =
          existingBookingData.furnishingsServiceApproved;
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

    // Preserve existing XState when possible so checkout/service regions stay intact.
    const preservedOrigin = existingBookingData.origin || BookingOrigin.USER;
    const servicesRequested = isMediaCommons
      ? getMediaCommonsServices(data, await serverGetTenantResources(tenant))
      : undefined;
    const servicesApproved = isMediaCommons
      ? {
          staff: existingBookingData.staffServiceApproved || false,
          equipment: existingBookingData.equipmentServiceApproved || false,
          catering: existingBookingData.cateringServiceApproved || false,
          cleaning: existingBookingData.cleaningServiceApproved || false,
          security: existingBookingData.securityServiceApproved || false,
          setup: existingBookingData.setupServiceApproved || false,
          furnishings:
            existingBookingData.furnishingsServiceApproved || false,
        }
      : undefined;

    const preservedContextUpdates: Record<string, unknown> = {
      email,
      selectedRooms: selectedRooms || [],
      formData: data || {},
      bookingCalendarInfo: bookingCalendarInfo || {},
      role: data?.role as Role,
      origin: preservedOrigin,
    };
    if (servicesRequested !== undefined) {
      preservedContextUpdates.servicesRequested = servicesRequested;
    }
    if (servicesApproved !== undefined) {
      preservedContextUpdates.servicesApproved = servicesApproved;
    }

    let xstateData = buildPreservedXStateData(
      existingBookingData,
      newCalendarEventId,
      xstateValue,
      preservedContextUpdates,
    );

    if (!xstateData) {
      const machine = isMediaCommons
        ? (await import("@/lib/stateMachines/mcBookingMachine"))
            .mcBookingMachine
        : (await import("@/lib/stateMachines/itpBookingMachine"))
            .itpBookingMachine;
      const freshActor = createActor(machine, {
        input: {
          tenant,
          calendarEventId: newCalendarEventId,
          email,
          selectedRooms: selectedRooms || [],
          formData: data || {},
          bookingCalendarInfo: bookingCalendarInfo || {},
          role: data?.role as Role,
          origin: preservedOrigin,
          servicesRequested,
          servicesApproved,
        },
      });

      freshActor.start();
      const currentSnapshot = freshActor.getSnapshot();

      xstateData = {
        machineId: isMediaCommons
          ? "MC Booking Request"
          : "ITP Booking Request",
        lastTransition: new Date().toISOString(),
        snapshot: {
          status: currentSnapshot.status,
          value: xstateValue,
          historyValue: currentSnapshot.historyValue || {},
          context: {
            ...currentSnapshot.context,
            calendarEventId: newCalendarEventId,
            origin: preservedOrigin,
          },
          children: currentSnapshot.children || {},
        },
      };

      freshActor.stop();
    }

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
      `✅ NEW BOOKING INITIALIZED WITH ${xstateValue.toUpperCase()} STATE [${tenant?.toUpperCase()}]:`,
      {
        calendarEventId: newCalendarEventId,
        targetState: xstateValue,
        servicesRequested,
        servicesApproved,
      },
    );

    if (isCheckedIn) {
      // Calendar + Firestore writes already succeeded. Do not fail the request
      // if history logging throws — a 500 here would make retries 404.
      try {
        const bookingId =
          (existingBookingData as BookingWithId).id || existingContents.id;
        if (!bookingId) {
          throw new Error(
            "Cannot log checked-in modification without a booking id",
          );
        }
        await logServerBookingChange({
          bookingId,
          calendarEventId: newCalendarEventId,
          status: BookingStatusLabel.MODIFIED,
          changedBy: modifiedBy,
          requestNumber: existingContents.requestNumber,
          note: "Booking modified while checked in",
          tenant,
        });
      } catch (logError) {
        console.error(
          "Failed to log checked-in modification:",
          logError,
        );
      }

      const guestEmail = existingBookingData.email || email;
      if (guestEmail) {
        try {
          await serverSendBookingDetailEmail({
            calendarEventId: newCalendarEventId,
            targetEmail: guestEmail,
            headerMessage: "Your reservation has been updated.",
            status: BookingStatusLabel.CHECKED_IN,
            tenant,
          });
        } catch (emailError) {
          console.error(
            "Failed to send checked-in modification email:",
            emailError,
          );
        }
      }
    } else {
      // Run finalApprove to handle approval-related tasks:
      // - Log APPROVED status to booking history
      // - Update calendar event to [APPROVED]
      // - Send approval confirmation email
      console.log(
        `🎉 RUNNING FINAL APPROVE FOR MODIFICATION [${tenant?.toUpperCase()}]:`,
        {
          calendarEventId: newCalendarEventId,
          modifiedBy,
        },
      );

      await finalApprove(
        newCalendarEventId,
        modifiedBy,
        tenant,
        "Approved via booking modification",
      );
    }

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
    console.error("❌ MODIFICATION FAILED:", error);
    return NextResponse.json(
      { result: "error", message: "Failed to modify booking" },
      { status: 500 },
    );
  }
}
