import { BookingFormDetails, BookingStatusLabel } from "@/components/src/types";
import { NextRequest, NextResponse } from "next/server";
import {
  TableNames,
  getApprovalCcEmail,
  getSecondApproverEmail,
} from "@/components/src/policy";
import {
  approveInstantBooking,
  sendBookingDetailEmail,
} from "@/components/src/server/admin";
import {
  formatDate,
  toFirebaseTimestampFromString,
} from "@/components/src/client/utils/date";
import {
  getRoomCalendarId,
  insertEvent,
} from "@/components/src/server/calendars";

import { Timestamp } from "@firebase/firestore";
import { firstApproverEmails } from "@/components/src/server/db";
import { getBookingToolDeployUrl } from "@/components/src/server/ui";
import { saveDataToFirestore } from "@/lib/firebase/firebase";
import { sendHTMLEmail } from "@/app/lib/sendHTMLEmail";

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

  const calendarId = await getRoomCalendarId(room.roomId);
  if (calendarId == null) {
    return NextResponse.json(
      { result: "error", message: "ROOM CALENDAR ID NOT FOUND" },
      { status: 500 },
    );
  }

  const event = await insertEvent({
    calendarId,
    title: `[${BookingStatusLabel.WALK_IN}] ${selectedRoomIds.join(", ")} ${department} ${data.title}`,
    description: "This reservation was made as a walk-in.",
    startTime: bookingCalendarInfo.startStr,
    endTime: bookingCalendarInfo.endStr,
    roomEmails: otherRoomIds,
  });
  const calendarEventId = event.id;

  await saveDataToFirestore(TableNames.BOOKING, {
    calendarEventId,
    roomId: selectedRoomIds.join(", "),
    email,
    startDate: toFirebaseTimestampFromString(bookingCalendarInfo.startStr),
    endDate: toFirebaseTimestampFromString(bookingCalendarInfo.endStr),
    ...data,
  });
  await saveDataToFirestore(TableNames.BOOKING_STATUS, {
    calendarEventId,
    email,
    walkedInAt: Timestamp.now(),
  });

  const sendWalkInNofificationEmail = async (
    recipients: string[],
    // contents: BookingFormDetails,
  ) => {
    const emailPromises = recipients.map(recipient =>
      sendBookingDetailEmail(
        calendarEventId,
        recipient,
        "A walk-in reservation for Media Commons has been confirmed.",
        BookingStatusLabel.WALK_IN,
      ),
    );
    // const emailPromises = recipients.map(recipient =>
    //   sendHTMLEmail({
    //     templateName: "booking_detail",
    //     contents: {
    //       ...contents,
    //       roomId: contents.roomId.toString(),
    //       startDate: formatDate(contents.startDate),
    //       endDate: formatDate(contents.endDate),
    //     },
    //     targetEmail: recipient,
    //     status: BookingStatusLabel.WALK_IN,
    //     eventTitle: contents.title,
    //     body: "",
    //   }),
    // );
    await Promise.all(emailPromises);
  };

  sendBookingDetailEmail(
    calendarEventId,
    email,
    "Your walk-in reservation for Media Commons is confirmed.",
    BookingStatusLabel.WALK_IN,
  );

  // const userEventInputs: BookingFormDetails = {
  //   calendarEventId,
  //   roomId: selectedRoomIds.join(", "),
  //   email,
  //   startDate: bookingCalendarInfo?.startStr,
  //   endDate: bookingCalendarInfo?.endStr,
  //   bookingToolUrl: getBookingToolDeployUrl(),
  //   headerMessage: "This is a request email for first approval.",
  //   ...data,
  // };

  const notifyEmails = [
    data.sponsorEmail ?? null,
    await getSecondApproverEmail(),
    getApprovalCcEmail(process.env.NEXT_PUBLIC_BRANCH_NAME),
  ].filter(x => x != null);
  await sendWalkInNofificationEmail(notifyEmails);

  return NextResponse.json(
    { result: "success", calendarEventId: calendarId },
    { status: 200 },
  );
}
