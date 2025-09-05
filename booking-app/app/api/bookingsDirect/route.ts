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

  // For Media Commons VIP bookings, check if services are requested
  if (isMediaCommons(tenant) && origin === BookingOrigin.VIP) {
    const servicesRequested = getMediaCommonsServices(data);
    const hasServices = Object.values(servicesRequested).some(Boolean);

    if (hasServices) {
      console.log(
        `🎯 VIP BOOKING WITH SERVICES - WILL USE XSTATE [${tenant?.toUpperCase()}]:`,
        {
          servicesRequested,
          hasServices,
        },
      );
      shouldInitializeXState = true;
      bookingStatus = BookingStatusLabel.PRE_APPROVED; // Will be updated by XState
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

  // Initialize XState for Media Commons VIP bookings with services
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

      // Initialize XState for VIP booking
      // This will create the initial state and let always transitions handle the flow
      const { createXStateDataFromBookingStatus } = await import(
        "@/lib/stateMachines/xstateUtilsV5"
      );

      // Get the updated booking data (with isVip set)
      const { serverGetDataByCalendarEventId } = await import(
        "@/lib/firebase/server/adminDb"
      );
      const bookingData = await serverGetDataByCalendarEventId(
        TableNames.BOOKING,
        calendarEventId,
        tenant,
      );

      const xstateData = await createXStateDataFromBookingStatus(
        calendarEventId,
        bookingData,
        tenant,
      );

      const initialState = xstateData.snapshot?.value;

      console.log(`🎭 VIP XSTATE INITIALIZATION [${tenant?.toUpperCase()}]:`, {
        calendarEventId,
        initialState,
        isVip: (bookingData as any)?.isVip,
        servicesRequested: bookingData
          ? Object.keys(bookingData).filter(
              k => k.includes("Service") && (bookingData as any)[k],
            )
          : [],
      });

      // Update bookingStatus based on actual XState initial state
      if (
        typeof initialState === "object" &&
        initialState &&
        initialState["Services Request"]
      ) {
        bookingStatus = BookingStatusLabel.PRE_APPROVED;
        console.log(
          `🎯 VIP BOOKING: XState in Services Request - Status set to PRE_APPROVED`,
        );
      } else if (initialState === "Approved") {
        bookingStatus = BookingStatusLabel.APPROVED;
        console.log(
          `🎯 VIP BOOKING: XState in Approved - Status set to APPROVED`,
        );
      } else if (initialState === "Pre-approved") {
        bookingStatus = BookingStatusLabel.PRE_APPROVED;
        console.log(
          `🎯 VIP BOOKING: XState in Pre-approved - Status set to PRE_APPROVED`,
        );
      }

      // Save XState data to Firestore and set approval timestamps for VIP bookings
      const { serverUpdateDataByCalendarEventId } = await import(
        "@/components/src/server/admin"
      );

      // For VIP bookings in Services Request, set first approval timestamps
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
          `🎯 VIP SERVICES REQUEST: Setting firstApprovedAt for VIP booking [${tenant?.toUpperCase()}]:`,
          {
            calendarEventId,
            firstApprovedBy: requestedBy,
          },
        );
      }

      await serverUpdateDataByCalendarEventId(
        TableNames.BOOKING,
        calendarEventId,
        updateData,
        tenant,
      );
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
