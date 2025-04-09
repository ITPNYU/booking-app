import { TableNames, getApprovalCcEmail } from "@/components/src/policy";
import {
  serverGetRoomCalendarId,
  serverSendBookingDetailEmail,
} from "@/components/src/server/admin";
import { BookingStatusLabel } from "@/components/src/types";
import {
  serverGetFinalApproverEmail,
  serverGetNextSequentialId,
  serverSaveDataToFirestore,
} from "@/lib/firebase/server/adminDb";
import { NextRequest, NextResponse } from "next/server";

import { toFirebaseTimestampFromString } from "@/components/src/client/utils/serverDate";
import { insertEvent } from "@/components/src/server/calendars";
import { Timestamp } from "firebase-admin/firestore";

export async function POST(request: NextRequest) {
  const { email, selectedRooms, bookingCalendarInfo, data } =
    await request.json();
  console.log("data", data);
  const { department } = data;
  const [room, ...otherRooms] = selectedRooms;
  const selectedRoomIds = selectedRooms.map(
    (r: { roomId: number }) => r.roomId,
  );
  const otherRoomIds = otherRooms.map(
    (r: { calendarId: string }) => r.calendarId,
  );

  const calendarId = await serverGetRoomCalendarId(room.roomId);
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
    title: `[${BookingStatusLabel.WALK_IN}] ${selectedRoomIds.join(", ")} ${truncatedTitle}`,
    description: `Department: ${department}\n\nThis reservation was made as a walk-in.`,
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

  const sequentialId = await serverGetNextSequentialId("bookings");
  await serverSaveDataToFirestore(TableNames.BOOKING, {
    calendarEventId,
    roomId: selectedRoomIds.join(", "),
    email,
    startDate: toFirebaseTimestampFromString(bookingCalendarInfo.startStr),
    endDate: toFirebaseTimestampFromString(bookingCalendarInfo.endStr),
    requestNumber: sequentialId,
    walkedInAt: Timestamp.now(),
    ...data,
  });

  const sendWalkInNofificationEmail = async (recipients: string[]) => {
    const emailPromises = recipients.map(recipient =>
      serverSendBookingDetailEmail({
        calendarEventId,
        targetEmail: recipient,
        headerMessage:
          "A walk-in reservation for Media Commons has been confirmed.",
        status: BookingStatusLabel.WALK_IN,
      }),
    );

    await Promise.all(emailPromises);
  };

  serverSendBookingDetailEmail({
    calendarEventId,
    targetEmail: email,
    headerMessage: "Your walk-in reservation for Media Commons is confirmed.",
    status: BookingStatusLabel.WALK_IN,
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
