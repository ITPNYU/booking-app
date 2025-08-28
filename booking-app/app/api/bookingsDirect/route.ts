import { TableNames, getApprovalCcEmail } from "@/components/src/policy";
import {
  serverGetRoomCalendarId,
  serverSendBookingDetailEmail,
} from "@/components/src/server/admin";
import { BookingOrigin, BookingStatusLabel } from "@/components/src/types";
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

  const bookingStatus = BookingStatusLabel.APPROVED;

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
      ...data,
    },
    tenant,
  );

  // Log the walk-in/VIP booking creation
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

  return NextResponse.json(
    { result: "success", calendarEventId: calendarId },
    { status: 200 },
  );
}
