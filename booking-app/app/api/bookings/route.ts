import {
  BookingFormDetails,
  BookingStatusLabel,
  RoomSetting,
} from "@/components/src/types";
import { NextRequest, NextResponse } from "next/server";
import {
  approvalUrl,
  declineUrl,
  getBookingToolDeployUrl,
} from "@/components/src/server/ui";
import {
  approveInstantBooking,
  deleteDataByCalendarEventId,
  updateDataByCalendarEventId,
} from "@/components/src/server/admin";
import { deleteEvent, insertEvent } from "@/components/src/server/calendars";
import {
  formatDate,
  toFirebaseTimestampFromString,
} from "@/components/src/client/utils/date";
import {
  getNextSequentialId,
  saveDataToFirestore,
} from "@/lib/firebase/firebase";

import { DateSelectArg } from "fullcalendar";
import { TableNames } from "@/components/src/policy";
import { Timestamp } from "@firebase/firestore";
import { firstApproverEmails } from "@/components/src/server/db";
import { sendHTMLEmail } from "@/app/lib/sendHTMLEmail";

async function createBookingCalendarEvent(
  selectedRooms: RoomSetting[],
  department: string,
  title: string,
  bookingCalendarInfo: DateSelectArg,
) {
  const [room, ...otherRooms] = selectedRooms;
  const calendarId = room.calendarId;

  if (calendarId == null) {
    throw Error("calendarId not found for room " + room.roomId);
  }

  const selectedRoomIds = selectedRooms.map(
    (r: { roomId: number }) => r.roomId,
  );
  const otherRoomEmails = otherRooms.map(
    (r: { calendarId: string }) => r.calendarId,
  );

  const event = await insertEvent({
    calendarId,
    title: `[${BookingStatusLabel.REQUESTED}] ${selectedRoomIds.join(", ")} ${department} ${title}`,
    description:
      "Your reservation is not yet confirmed. The coordinator will review and finalize your reservation within a few days.",
    startTime: bookingCalendarInfo.startStr,
    endTime: bookingCalendarInfo.endStr,
    roomEmails: otherRoomEmails,
  });
  return event.id;
}

async function handleBookingApprovalEmails(
  isAutoApproval: boolean,
  calendarEventId: string,
  sequentialId: number,
  data: any,
  selectedRoomIds: string,
  bookingCalendarInfo: DateSelectArg,
  email: string,
) {
  const shouldAutoApprove = isAutoApproval === true;
  const firstApprovers = await firstApproverEmails(data.department);

  const sendApprovalEmail = async (
    recipients: string[],
    contents: BookingFormDetails,
  ) => {
    const emailPromises = recipients.map(recipient =>
      sendHTMLEmail({
        templateName: "approval_email",
        contents: {
          ...contents,
          roomId: selectedRoomIds,
          startDate: formatDate(bookingCalendarInfo?.startStr),
          endDate: formatDate(bookingCalendarInfo?.endStr),
          requestNumber: contents.requestNumber + "",
        },
        targetEmail: recipient,
        status: BookingStatusLabel.REQUESTED,
        eventTitle: contents.title,
        requestNumber: contents.requestNumber ?? sequentialId,
        body: "",
      }),
    );
    await Promise.all(emailPromises);
  };

  if (calendarEventId && shouldAutoApprove) {
    approveInstantBooking(calendarEventId);
  } else {
    const userEventInputs: BookingFormDetails = {
      calendarEventId,
      roomId: selectedRoomIds,
      email,
      startDate: bookingCalendarInfo?.startStr,
      endDate: bookingCalendarInfo?.endStr,
      approvalUrl,
      declineUrl,
      bookingToolUrl: getBookingToolDeployUrl(),
      headerMessage: "This is a request email for first approval.",
      requestNumber: sequentialId,
      ...data,
    };
    console.log("userEventInputs", userEventInputs);
    await sendApprovalEmail(firstApprovers, userEventInputs);
  }
}

export async function POST(request: NextRequest) {
  const { email, selectedRooms, bookingCalendarInfo, data, isAutoApproval } =
    await request.json();

  console.log("data", data);

  let calendarEventId: string;
  try {
    calendarEventId = await createBookingCalendarEvent(
      selectedRooms,
      data.department,
      data.title,
      bookingCalendarInfo,
    );
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { result: "error", message: "ROOM CALENDAR ID NOT FOUND" },
      { status: 500 },
    );
  }

  //For putting sequentialId in bookings
  const sequentialId = await getNextSequentialId("bookings");
  const selectedRoomIds = selectedRooms
    .map((r: { roomId: number }) => r.roomId)
    .join(", ");

  await saveDataToFirestore(TableNames.BOOKING, {
    calendarEventId,
    roomId: selectedRoomIds,
    email,
    startDate: toFirebaseTimestampFromString(bookingCalendarInfo.startStr),
    endDate: toFirebaseTimestampFromString(bookingCalendarInfo.endStr),
    requestNumber: sequentialId,
    ...data,
  });
  await saveDataToFirestore(TableNames.BOOKING_STATUS, {
    calendarEventId,
    email,
    requestedAt: Timestamp.now(),
  });

  await handleBookingApprovalEmails(
    isAutoApproval,
    calendarEventId,
    sequentialId,
    data,
    selectedRoomIds,
    bookingCalendarInfo,
    email,
  );

  return NextResponse.json(
    { result: "success", calendarEventId },
    { status: 200 },
  );
}

export async function PUT(request: NextRequest) {
  const {
    email,
    selectedRooms,
    bookingCalendarInfo,
    data,
    isAutoApproval,
    calendarEventId,
  } = await request.json();
  // TODO verify that they actually changed something
  if (bookingCalendarInfo == null) {
    return NextResponse.json(
      { error: "missing bookingCalendarId" },
      { status: 500 },
    );
  }
  const selectedRoomIds = selectedRooms
    .map((r: { roomId: number }) => r.roomId)
    .join(", ");

  // delete existing cal events
  await Promise.all(
    selectedRooms.map(async room => {
      await deleteEvent(room.calendarId, calendarEventId, room.roomId);
    }),
  );

  // recreate cal events
  let newCalendarEventId: string;
  try {
    newCalendarEventId = await createBookingCalendarEvent(
      selectedRooms,
      data.department,
      data.title,
      bookingCalendarInfo,
    );
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { result: "error", message: "ROOM CALENDAR ID NOT FOUND" },
      { status: 500 },
    );
  }

  // update booking contents WITH new calendarEventId
  const { id, ...formData } = data;
  const updatedData = {
    ...formData,
    roomId: selectedRoomIds,
    startDate: toFirebaseTimestampFromString(bookingCalendarInfo.startStr),
    endDate: toFirebaseTimestampFromString(bookingCalendarInfo.endStr),
    calendarEventId: newCalendarEventId,
  };

  await updateDataByCalendarEventId(
    TableNames.BOOKING,
    calendarEventId,
    updatedData,
  );

  // update statuses
  await deleteDataByCalendarEventId(TableNames.BOOKING_STATUS, calendarEventId);
  await saveDataToFirestore(TableNames.BOOKING_STATUS, {
    calendarEventId: newCalendarEventId,
    email,
    requestedAt: Timestamp.now(),
  });

  // handle auto-approval + send emails
  await handleBookingApprovalEmails(
    isAutoApproval,
    newCalendarEventId,
    data.requestNumber,
    data,
    selectedRoomIds,
    bookingCalendarInfo,
    email,
  );

  return NextResponse.json({ result: "success" }, { status: 200 });
}
