import { TableNames, getApprovalCcEmail } from "@/components/src/policy";
import {
  serverGetRoomCalendarId,
  serverSendBookingDetailEmail,
} from "@/components/src/server/admin";
import { BookingOrigin, BookingStatusLabel } from "@/components/src/types";
import {
  getMediaCommonsServices,
  isMediaCommons,
} from "@/components/src/utils/tenantUtils";
import {
  logServerBookingChange,
  serverGetFinalApproverEmail,
  serverGetNextSequentialId,
  serverSaveDataToFirestore,
} from "@/lib/firebase/server/adminDb";
import { NextRequest, NextResponse } from "next/server";

import { toFirebaseTimestampFromString } from "@/components/src/client/utils/serverDate";
import { insertEvent } from "@/components/src/server/calendars";
import { Timestamp } from "firebase-admin/firestore";

// Helper function to extract tenant from request
const extractTenantFromRequest = (request: NextRequest): string | undefined => {
  // Try to get tenant from referer header
  const referer = request.headers.get("referer");
  if (referer) {
    const url = new URL(referer);
    const tenantMatch = url.pathname.match(/^\/([^\/]+)/);
    if (tenantMatch && tenantMatch[1] !== "api") {
      return tenantMatch[1];
    }
  }

  // Try to get tenant from query parameter
  const { searchParams } = new URL(request.url);
  const tenant = searchParams.get("tenant");
  if (tenant) {
    return tenant;
  }

  return undefined;
};

export async function POST(request: NextRequest) {
  const {
    email,
    requestedBy,
    selectedRooms,
    bookingCalendarInfo,
    data,
    origin = BookingOrigin.WALK_IN,
    type = "walk-in",
  } = await request.json();

  // Extract tenant from URL
  const tenant = extractTenantFromRequest(request);

  console.log("data", data);
  console.log("tenant", tenant);

  const { department } = data;
  const [room, ...otherRooms] = selectedRooms;
  const selectedRoomIds = selectedRooms.map(
    (r: { roomId: number }) => r.roomId,
  );
  const otherRoomIds = otherRooms.map(
    (r: { calendarId: string }) => r.calendarId,
  );

  // Determine booking status based on tenant and service requests
  let bookingStatus = BookingStatusLabel.APPROVED;
  let shouldInitializeXState = false;

  // Check if this tenant uses XState
  const { shouldUseXState } = await import(
    "@/components/src/utils/tenantUtils"
  );
  if (shouldUseXState(tenant)) {
    shouldInitializeXState = true;
    console.log(`🎯 BOOKING WILL USE XSTATE [${tenant?.toUpperCase()}]:`, {
      origin,
      type,
      tenant,
    });

    // For Media Commons bookings with services, check service requirements
    if (isMediaCommons(tenant)) {
      const servicesRequested = getMediaCommonsServices(data);
      const hasServices = Object.values(servicesRequested).some(Boolean);

      if (hasServices && origin !== BookingOrigin.WALK_IN) {
        console.log(
          `🎯 VIP BOOKING WITH SERVICES [${tenant?.toUpperCase()}]:`,
          {
            servicesRequested,
            hasServices,
            origin,
            type,
          },
        );
        bookingStatus = BookingStatusLabel.PRE_APPROVED; // Will be updated by XState
      } else if (hasServices && origin === BookingOrigin.WALK_IN) {
        console.log(
          `🎯 WALK-IN BOOKING WITH SERVICES [${tenant?.toUpperCase()}]:`,
          {
            servicesRequested,
            hasServices,
            origin,
            type,
            note: "Walk-in will be auto-approved despite services",
          },
        );
        // Keep bookingStatus as APPROVED for walk-ins
      }
    }
  }

  const calendarId = await serverGetRoomCalendarId(room.roomId, tenant);
  if (calendarId == null) {
    return NextResponse.json(
      { result: "error", message: "ROOM CALENDAR ID NOT FOUND" },
      { status: 500 },
    );
  }

  const truncatedTitle =
    data.title.length > 25 ? data.title.substring(0, 25) + "..." : data.title;

  const event = await insertEvent({
    calendarId,
    title: `[${bookingStatus}] ${selectedRoomIds.join(", ")} ${truncatedTitle}`,
    description: `Department: ${department === "Other" && data.otherDepartment ? data.otherDepartment : department}\n\nThis reservation was made as a ${type}.`,
    startTime: bookingCalendarInfo.startStr,
    endTime: bookingCalendarInfo.endStr,
    roomEmails: otherRoomIds,
  });
  const calendarEventId = event.id;
  // Calendar invitation will be handled after XState initialization
  // to ensure proper status determination

  const sequentialId = await serverGetNextSequentialId("bookings", tenant);
  const doc = await serverSaveDataToFirestore(
    TableNames.BOOKING,
    {
      calendarEventId,
      roomId: selectedRoomIds.join(", "),
      email,
      startDate: toFirebaseTimestampFromString(bookingCalendarInfo.startStr),
      endDate: toFirebaseTimestampFromString(bookingCalendarInfo.endStr),
      requestNumber: sequentialId,
      walkedInAt: Timestamp.now(),
      origin,
      isVip: origin === BookingOrigin.VIP, // Explicitly set isVip for XState
      ...data,
    },
    tenant,
  );

  // Initialize XState for tenants that use XState
  if (shouldInitializeXState && calendarEventId) {
    try {
      const { executeXStateTransition } = await import(
        "@/lib/stateMachines/xstateUtilsV5"
      );

      // First log the booking creation as REQUESTED
      await logServerBookingChange({
        bookingId: doc.id,
        status: BookingStatusLabel.REQUESTED,
        changedBy: requestedBy,
        requestNumber: sequentialId,
        calendarEventId: calendarEventId,
        note: `${requestedBy} for ${email} as ${type} booking`,
        tenant,
      });

      // Initialize XState for booking using machine evaluation (like regular bookings)
      // This will properly handle auto-approval logic for walk-ins
      const { createActor } = await import("xstate");
      const { mcBookingMachine } = await import(
        "@/lib/stateMachines/mcBookingMachine"
      );
      const { itpBookingMachine } = await import(
        "@/lib/stateMachines/itpBookingMachine"
      );

      // Get the updated booking data (with isVip and walkedInAt set)
      const { serverGetDataByCalendarEventId } = await import(
        "@/lib/firebase/server/adminDb"
      );
      const bookingData = await serverGetDataByCalendarEventId(
        TableNames.BOOKING,
        calendarEventId,
        tenant,
      );

      // Get the appropriate machine for the tenant
      const machine = isMediaCommons(tenant)
        ? mcBookingMachine
        : itpBookingMachine;

      // Get services requested for Media Commons
      const servicesRequested = isMediaCommons(tenant)
        ? getMediaCommonsServices(data)
        : undefined;

      // Create XState actor with proper context
      const bookingActor = createActor(machine, {
        input: {
          tenant,
          selectedRooms,
          formData: data,
          bookingCalendarInfo,
          isWalkIn: origin === BookingOrigin.WALK_IN,
          calendarEventId,
          email,
          isVip: origin === BookingOrigin.VIP,
          servicesRequested,
        },
      });

      // Start the actor to trigger initial state evaluation
      bookingActor.start();
      const currentState = bookingActor.getSnapshot();

      // Clean context by removing undefined values for Firestore compatibility
      const cleanContext = Object.fromEntries(
        Object.entries(currentState.context).filter(
          ([_, value]) => value !== undefined,
        ),
      );

      // Import common function to create XState data
      const { createXStateData } = await import("@/app/api/bookings/route");

      // Prepare XState data for persistence using common function
      const xstateData = createXStateData(machine.id, {
        ...currentState,
        context: cleanContext,
      });

      const initialState = xstateData.snapshot?.value;

      console.log(`🎭 XSTATE INITIALIZATION [${tenant?.toUpperCase()}]:`, {
        calendarEventId,
        initialState,
        isVip: origin === BookingOrigin.VIP,
        isWalkIn: origin === BookingOrigin.WALK_IN,
        origin,
        type,
        servicesRequested,
        autoApproved: initialState === "Approved",
      });

      // Update bookingStatus based on actual XState initial state
      if (
        typeof initialState === "object" &&
        initialState &&
        initialState["Services Request"]
      ) {
        bookingStatus = BookingStatusLabel.PRE_APPROVED;
        console.log(
          `🎯 BOOKING: XState in Services Request - Status set to PRE_APPROVED`,
        );
      } else if (initialState === "Approved") {
        bookingStatus = BookingStatusLabel.APPROVED;
        console.log(`🎯 BOOKING: XState in Approved - Status set to APPROVED`);

        // Log APPROVED status for walk-ins that were auto-approved by XState
        await logServerBookingChange({
          bookingId: doc.id,
          calendarEventId,
          status: BookingStatusLabel.APPROVED,
          changedBy: "System",
          requestNumber: sequentialId,
          note: ``,
          tenant,
        });

        console.log(`📋 APPROVED HISTORY LOGGED [${tenant?.toUpperCase()}]:`, {
          calendarEventId,
          bookingId: doc.id,
          requestNumber: sequentialId,
          changedBy: requestedBy,
          reason: "XState auto-approval",
        });
      } else if (initialState === "Pre-approved") {
        bookingStatus = BookingStatusLabel.PRE_APPROVED;
        console.log(
          `🎯 BOOKING: XState in Pre-approved - Status set to PRE_APPROVED`,
        );
      }

      // Save XState data to Firestore and set approval timestamps
      const { serverUpdateDataByCalendarEventId } = await import(
        "@/components/src/server/admin"
      );

      // For bookings in Services Request, set first approval timestamps
      // This indicates that 1st approve is already done
      const updateData: any = { xstateData };
      if (
        typeof initialState === "object" &&
        initialState &&
        initialState["Services Request"]
      ) {
        updateData.firstApprovedAt = Timestamp.now();
        updateData.firstApprovedBy = requestedBy;
        console.log(
          `🎯 SERVICES REQUEST: Setting firstApprovedAt for booking [${tenant?.toUpperCase()}]:`,
          {
            calendarEventId,
            firstApprovedBy: requestedBy,
            origin,
            type,
          },
        );
      }

      await serverUpdateDataByCalendarEventId(
        TableNames.BOOKING,
        calendarEventId,
        updateData,
        tenant,
      );

      // Log PRE_APPROVED status change for bookings with services
      // This is done outside XState processing as requested
      if (bookingStatus === BookingStatusLabel.PRE_APPROVED) {
        await logServerBookingChange({
          bookingId: doc.id,
          calendarEventId,
          status: BookingStatusLabel.PRE_APPROVED,
          changedBy: "System",
          requestNumber: sequentialId,
          tenant,
        });

        console.log(
          `📋 VIP PRE-APPROVED HISTORY LOGGED [${tenant?.toUpperCase()}]:`,
          {
            calendarEventId,
            bookingId: doc.id,
            requestNumber: sequentialId,
            changedBy: requestedBy,
          },
        );
      }

      // Update calendar event status if needed
      if (bookingStatus !== BookingStatusLabel.APPROVED) {
        try {
          const calendarResponse = await fetch(
            `${process.env.NEXT_PUBLIC_BASE_URL}/api/calendarEvents`,
            {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
                "x-tenant": tenant || "mc",
              },
              body: JSON.stringify({
                calendarEventId,
                newValues: { statusPrefix: bookingStatus },
              }),
            },
          );

          if (calendarResponse.ok) {
            console.log(
              `📅 CALENDAR STATUS UPDATED [${tenant?.toUpperCase()}]:`,
              {
                calendarEventId,
                from: BookingStatusLabel.APPROVED,
                to: bookingStatus,
                reason: "XState determined different status",
              },
            );
          } else {
            console.error(
              `🚨 CALENDAR UPDATE FAILED [${tenant?.toUpperCase()}]:`,
              {
                calendarEventId,
                status: calendarResponse.status,
              },
            );
          }
        } catch (calendarError) {
          console.error(
            `🚨 CALENDAR UPDATE ERROR [${tenant?.toUpperCase()}]:`,
            {
              calendarEventId,
              error: calendarError.message,
            },
          );
        }
      }
    } catch (error) {
      console.error(
        `🚨 VIP XSTATE INITIALIZATION FAILED [${tenant?.toUpperCase()}]:`,
        {
          calendarEventId,
          error: error.message,
        },
      );
      // Fallback to traditional logging
      await logServerBookingChange({
        bookingId: doc.id,
        status: BookingStatusLabel.REQUESTED,
        changedBy: requestedBy,
        requestNumber: sequentialId,
        calendarEventId: calendarEventId,
        note: `${requestedBy} for ${email} as ${type} booking`,
        tenant,
      });
      await logServerBookingChange({
        bookingId: doc.id,
        status: BookingStatusLabel.APPROVED,
        changedBy: requestedBy,
        requestNumber: sequentialId,
        calendarEventId: calendarEventId,
        note: `${requestedBy} for ${email} as ${type} booking`,
        tenant,
      });
    }
  } else {
    // Traditional logging for non-XState bookings
    if (calendarEventId) {
      await logServerBookingChange({
        bookingId: doc.id,
        status: BookingStatusLabel.REQUESTED,
        changedBy: requestedBy,
        requestNumber: sequentialId,
        calendarEventId: calendarEventId,
        note: `${requestedBy} for ${email} as ${type} booking`,
        tenant,
      });
      await logServerBookingChange({
        bookingId: doc.id,
        status: BookingStatusLabel.APPROVED,
        changedBy: requestedBy,
        requestNumber: sequentialId,
        calendarEventId: calendarEventId,
        note: `${requestedBy} for ${email} as ${type} booking`,
        tenant,
      });
    }
  }

  // Handle calendar invitation based on final XState status
  // Only invite user to calendar event if booking is fully approved (XState status is "Approved")
  if (bookingStatus === BookingStatusLabel.APPROVED) {
    const formData = {
      guestEmail: email,
      calendarEventId: calendarEventId,
      roomId: room.roomId,
    };
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL}/api/inviteUser`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      },
    );

    console.log(`📧 USER INVITED TO CALENDAR [${tenant?.toUpperCase()}]:`, {
      calendarEventId,
      guestEmail: email,
      bookingStatus,
      xstateStatus: bookingStatus,
      reason: "XState determined booking is fully approved",
    });
  } else {
    console.log(`⏸️ USER INVITATION DEFERRED [${tenant?.toUpperCase()}]:`, {
      calendarEventId,
      guestEmail: email,
      bookingStatus,
      xstateStatus: bookingStatus,
      reason: "XState determined booking needs further approval",
    });
  }

  // Only send confirmation emails if the booking is fully approved
  // For VIP bookings with service requests, emails should be sent when XState reaches "Approved"
  const shouldSendEmails = bookingStatus === BookingStatusLabel.APPROVED;

  console.log(`📧 EMAIL SENDING DECISION [${tenant?.toUpperCase()}]:`, {
    calendarEventId,
    bookingStatus,
    shouldSendEmails,
    isVip: origin === BookingOrigin.VIP,
    hasServices: shouldInitializeXState,
  });

  if (shouldSendEmails) {
    const sendWalkInNofificationEmail = async (recipients: string[]) => {
      const emailPromises = recipients.map(recipient =>
        serverSendBookingDetailEmail({
          calendarEventId,
          targetEmail: recipient,
          headerMessage: `Your ${type} reservation has been confirmed!`,
          status: bookingStatus,
          tenant,
        }),
      );

      await Promise.all(emailPromises);
    };

    serverSendBookingDetailEmail({
      calendarEventId,
      targetEmail: email,
      headerMessage: `Your ${type} reservation for Media Commons is confirmed.`,
      status: bookingStatus,
      tenant,
    });

    const notifyEmails = [
      data.sponsorEmail ?? null,
      await serverGetFinalApproverEmail(),
      getApprovalCcEmail(process.env.NEXT_PUBLIC_BRANCH_NAME),
    ].filter(x => x != null);
    await sendWalkInNofificationEmail(notifyEmails);
  } else {
    console.log(`⏳ EMAIL SENDING DEFERRED [${tenant?.toUpperCase()}]:`, {
      calendarEventId,
      reason:
        "Booking is in PRE_APPROVED state, emails will be sent when fully approved",
    });
  }

  return NextResponse.json(
    { result: "success", calendarEventId: calendarId },
    { status: 200 },
  );
}
