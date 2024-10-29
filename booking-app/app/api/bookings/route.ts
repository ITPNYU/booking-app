import {
  serverFormatDate,
  toFirebaseTimestampFromString,
} from "@/components/src/client/utils/serverDate";
import {
  firstApproverEmails,
  serverApproveInstantBooking,
  serverBookingContents,
  serverDeleteFieldsByCalendarEventId,
  serverUpdateDataByCalendarEventId,
} from "@/components/src/server/admin";
import { deleteEvent, insertEvent } from "@/components/src/server/calendars";
import { getBookingToolDeployUrl } from "@/components/src/server/ui";
import {
  BookingFormDetails,
  BookingStatusLabel,
  RoomSetting,
} from "@/components/src/types";
import {
  serverGetNextSequentialId,
  serverSaveDataToFirestore,
} from "@/lib/firebase/server/adminDb";
import { NextRequest, NextResponse } from "next/server";

import { sendHTMLEmail } from "@/app/lib/sendHTMLEmail";
import { TableNames } from "@/components/src/policy";
import { Timestamp } from "firebase-admin/firestore";
import { DateSelectArg } from "fullcalendar";

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
    const { equipmentCheckedOut, ...otherContents } = contents;
    const otherContentsStrings = Object.fromEntries(
      Object.entries(otherContents).map(([key, value]) => [
        key,
        value instanceof Timestamp ? value.toDate().toISOString() : value,
      ]),
    );
    const emailPromises = recipients.map(recipient =>
      sendHTMLEmail({
        templateName: "booking_detail",
        contents: {
          ...otherContentsStrings,
          roomId: selectedRoomIds,
          startDate: serverFormatDate(bookingCalendarInfo?.startStr),
          endDate: serverFormatDate(bookingCalendarInfo?.endStr),
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

  console.log("approval email calendarEventId", calendarEventId);
  if (calendarEventId && shouldAutoApprove) {
    serverApproveInstantBooking(calendarEventId);
  } else {
    const userEventInputs: BookingFormDetails = {
      ...data,
      calendarEventId: calendarEventId,
      roomId: selectedRoomIds,
      email,
      startDate: bookingCalendarInfo?.startStr,
      endDate: bookingCalendarInfo?.endStr,
      bookingToolUrl: getBookingToolDeployUrl(),
      headerMessage: "This is a request email for first approval.",
      requestNumber: sequentialId,
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
  const sequentialId = await serverGetNextSequentialId("bookings");
  const selectedRoomIds = selectedRooms
    .map((r: { roomId: number }) => r.roomId)
    .join(", ");
  console.log(" Done serverGetNextSequentialId ");
  console.log("calendarEventId", calendarEventId);

  await serverSaveDataToFirestore(TableNames.BOOKING, {
    calendarEventId,
    roomId: selectedRoomIds,
    email,
    startDate: toFirebaseTimestampFromString(bookingCalendarInfo.startStr),
    endDate: toFirebaseTimestampFromString(bookingCalendarInfo.endStr),
    requestNumber: sequentialId,
    equipmentCheckedOut: false,
    requestedAt: Timestamp.now(),
    ...data,
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
  console.log(" Done handleBookingApprovalEmails");

  return NextResponse.json(
    { result: "success", calendarEventId },
    { status: 200 },
  );
}

export async function PUT(request: NextRequest) {
  const {
    email,
    selectedRooms,
    allRooms,
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

  const existingContents = await serverBookingContents(calendarEventId);
  const oldRoomIds = existingContents.roomId.split(",").map(x => x.trim());
  const oldRooms = allRooms.filter((room: RoomSetting) =>
    oldRoomIds.includes(room.roomId + ""),
  );

  const selectedRoomIds = selectedRooms
    .map((r: { roomId: number }) => r.roomId)
    .join(", ");

  // delete existing cal events
  await Promise.all(
    oldRooms.map(async room => {
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
  // but remove old approvals
  const { id, ...formData } = data;
  console.log("newCalendarEventId", newCalendarEventId);
  const updatedData = {
    ...formData,
    roomId: selectedRoomIds,
    startDate: toFirebaseTimestampFromString(bookingCalendarInfo.startStr),
    endDate: toFirebaseTimestampFromString(bookingCalendarInfo.endStr),
    calendarEventId: newCalendarEventId,
    equipmentCheckedOut: false,
    requestedAt: Timestamp.now(),
  };

  await serverUpdateDataByCalendarEventId(
    TableNames.BOOKING,
    calendarEventId,
    updatedData,
  );

  await serverDeleteFieldsByCalendarEventId(
    TableNames.BOOKING,
    newCalendarEventId,
    [
      "finalApprovedAt",
      "finalApprovedBy",
      "firstApprovedAt",
      "firstApprovedBy",
    ],
  );

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
