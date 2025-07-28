import { toFirebaseTimestampFromString } from "@/components/src/client/utils/serverDate";
import {
  firstApproverEmails,
  serverApproveInstantBooking,
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
import {
  ApproverType,
  BookingFormDetails,
  BookingOrigin,
  BookingStatusLabel,
  RoomSetting,
} from "@/components/src/types";
import {
  logServerBookingChange,
  serverGetNextSequentialId,
  serverSaveDataToFirestore,
} from "@/lib/firebase/server/adminDb";
import { NextRequest, NextResponse } from "next/server";

import { sendHTMLEmail } from "@/app/lib/sendHTMLEmail";
import { CALENDAR_HIDE_STATUS, TableNames } from "@/components/src/policy";
import { formatOrigin } from "@/components/src/utils/formatters";
import { getCalendarClient } from "@/lib/googleClient";
import { itpBookingMachine } from "@/lib/stateMachines/itpBookingMachine";
import { Timestamp } from "firebase-admin/firestore";
import { DateSelectArg } from "fullcalendar";
import { createActor } from "xstate";

// Helper to build booking contents object for calendar descriptions
const buildBookingContents = (
  data: any,
  selectedRoomIds: string[],
  startDateObj: Date,
  endDateObj: Date,
  status: BookingStatusLabel,
  requestNumber: number,
  origin?: string,
) => {
  return {
    ...data,
    roomId: selectedRoomIds,
    startDate: startDateObj.toLocaleDateString(),
    startTime: startDateObj.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }),
    endTime: endDateObj.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }),
    status,
    requestNumber,
    origin,
  } as unknown as BookingFormDetails;
};

async function createBookingCalendarEvent(
  selectedRooms: RoomSetting[],
  _department: string,
  title: string,
  bookingCalendarInfo: DateSelectArg,
  description: string,
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

  // Limit title to 25 characters
  const truncatedTitle =
    title.length > 25 ? title.substring(0, 25) + "..." : title;

  const event = await insertEvent({
    calendarId,
    title: `[${BookingStatusLabel.REQUESTED}] ${selectedRoomIds.join(", ")} ${truncatedTitle}`,
    description,
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

    // Format dates and times properly
    const startDate = new Date(bookingCalendarInfo?.startStr);
    const endDate = new Date(bookingCalendarInfo?.endStr);

    const emailPromises = recipients.map(recipient =>
      sendHTMLEmail({
        templateName: "booking_detail",
        contents: {
          ...otherContentsStrings,
          roomId: selectedRoomIds,
          startDate: startDate.toLocaleDateString(),
          endDate: endDate.toLocaleDateString(),
          startTime: startDate.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          }),
          endTime: endDate.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          }),
          requestNumber: contents.requestNumber + "",
        },
        targetEmail: recipient,
        status: BookingStatusLabel.REQUESTED,
        eventTitle: contents.title,
        requestNumber: contents.requestNumber ?? sequentialId,
        body: "",
        approverType: ApproverType.LIAISON,
        replyTo: email,
      }),
    );
    await Promise.all(emailPromises);
  };

  console.log("approval email calendarEventId", calendarEventId);
  console.log("shouldAutoApprove value:", shouldAutoApprove);
  console.log("calendarEventId exists:", !!calendarEventId);

  if (calendarEventId && shouldAutoApprove) {
    console.log("Calling serverApproveInstantBooking...");
    serverApproveInstantBooking(calendarEventId, email);
    console.log("serverApproveInstantBooking called successfully");
  } else {
    console.log("Not calling serverApproveInstantBooking - conditions not met");
    const userEventInputs: BookingFormDetails = {
      ...data,
      calendarEventId: calendarEventId,
      roomId: selectedRoomIds,
      email,
      startDate: bookingCalendarInfo?.startStr,
      endDate: bookingCalendarInfo?.endStr,
      headerMessage: "This is a request email for first approval.",
      requestNumber: sequentialId,
      origin: formatOrigin(data.origin) ?? BookingOrigin.USER,
    };
    console.log("userEventInputs", userEventInputs);
    await sendApprovalEmail(firstApprovers, userEventInputs);
    // Send confirmation to requester as well (use confirmation/booking detail email)
    await serverSendBookingDetailEmail({
      calendarEventId,
      targetEmail: email,
      headerMessage:
        "Your request has been received!<br />Please allow 3-5 days for review. If there are changes to your request or you would like to follow up, contact mediacommons.reservations@nyu.edu.<br />This email does not confirm your reservation. You will receive a confirmation email and Google Calendar invite once your request is completed.<br /> Thank you!",
      status: BookingStatusLabel.REQUESTED,
      replyTo: email,
    });
  }
}

async function checkOverlap(
  selectedRooms: RoomSetting[],
  bookingCalendarInfo: DateSelectArg,
  calendarEventId?: string,
) {
  const calendar = await getCalendarClient();

  // Check each selected room for overlaps
  for (const room of selectedRooms) {
    const events = await calendar.events.list({
      calendarId: room.calendarId,
      timeMin: bookingCalendarInfo.startStr,
      timeMax: bookingCalendarInfo.endStr,
      singleEvents: true,
    });

    const hasOverlap = events.data.items?.some(event => {
      // Skip the event being edited in case of modification
      if (
        calendarEventId &&
        (calendarEventId === event.id ||
          calendarEventId === event.id.split(":")[0])
      ) {
        console.log("calendarEventId", calendarEventId);
        console.log("event.id", event.id);
        return false;
      }

      // Skip events with CALENDAR_HIDE_STATUS
      const eventTitle = event.summary || "";
      if (CALENDAR_HIDE_STATUS.some(status => eventTitle.includes(status))) {
        return false;
      }

      const eventStart = new Date(event.start.dateTime || event.start.date);
      const eventEnd = new Date(event.end.dateTime || event.end.date);
      const requestStart = new Date(bookingCalendarInfo.startStr);
      const requestEnd = new Date(bookingCalendarInfo.endStr);
      //log the event that overlaps and then return
      if (
        (eventStart >= requestStart && eventStart < requestEnd) ||
        (eventEnd > requestStart && eventEnd <= requestEnd) ||
        (eventStart <= requestStart && eventEnd >= requestEnd)
      ) {
        console.log("event that overlaps", event);
      }
      return (
        (eventStart >= requestStart && eventStart < requestEnd) ||
        (eventEnd > requestStart && eventEnd <= requestEnd) ||
        (eventStart <= requestStart && eventEnd >= requestEnd)
      );
    });

    if (hasOverlap) return true;
  }

  return false;
}

// Helper function to determine if booking should use XState flow
function shouldUseXStateFlow(tenant: string): boolean {
  return tenant === "itp";
}

// Helper function to get initial XState machine state
function getInitialXStateStatus(data: any): BookingStatusLabel {
  console.log("getInitialXStateStatus called with data:", data);
  const actor = createActor(itpBookingMachine);
  actor.start();

  const finalSnapshot = actor.getSnapshot();
  console.log("Final XState snapshot value:", finalSnapshot.value);
  console.log("Final XState snapshot context:", finalSnapshot.context);

  // The machine starts in "Requested" and immediately evaluates the always transition
  // If shouldAutoApprove guard returns true, it transitions to "Approved"
  if (finalSnapshot.value === "Approved") {
    console.log("XState determined auto-approval - returning APPROVED");
    return BookingStatusLabel.APPROVED;
  }

  console.log("XState determined no auto-approval - returning REQUESTED");
  return BookingStatusLabel.REQUESTED;
}

export async function POST(request: NextRequest) {
  const {
    email,
    selectedRooms,
    bookingCalendarInfo,
    data,
    isAutoApproval,
    tenant,
  } = await request.json();
  const hasOverlap = await checkOverlap(selectedRooms, bookingCalendarInfo);
  if (hasOverlap) {
    return NextResponse.json(
      { error: "Time slot no longer available" },
      { status: 409 },
    );
  }

  console.log("data", data);
  console.log("tenant", tenant);

  // Generate Sequential ID early so it can be used in calendar description
  const sequentialId = await serverGetNextSequentialId("bookings");

  const selectedRoomIds = selectedRooms
    .map((r: { roomId: number }) => r.roomId)
    .join(", ");

  // Build booking contents for description
  const startDateObj = new Date(bookingCalendarInfo.startStr);
  const endDateObj = new Date(bookingCalendarInfo.endStr);

  const bookingContentsForDesc = buildBookingContents(
    data,
    selectedRoomIds,
    startDateObj,
    endDateObj,
    BookingStatusLabel.REQUESTED,
    sequentialId,
    BookingOrigin.USER,
  );

  const description =
    bookingContentsToDescription(bookingContentsForDesc) +
    "<p>Your reservation is not yet confirmed. The coordinator will review and finalize your reservation within a few days.</p>" +
    '<p>To cancel reservations please return to the Booking Tool, visit My Bookings, and click "cancel" on the booking at least 24 hours before the date of the event. Failure to cancel an unused booking is considered a no-show and may result in restricted use of the space.</p>';

  let calendarEventId: string;
  try {
    calendarEventId = await createBookingCalendarEvent(
      selectedRooms,
      data.department,
      data.title,
      bookingCalendarInfo,
      description,
    );
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { result: "error", message: "ROOM CALENDAR ID NOT FOUND" },
      { status: 500 },
    );
  }

  console.log(" Done serverGetNextSequentialId ");
  console.log("calendarEventId", calendarEventId);

  // Determine initial status based on tenant and XState flow
  let initialStatus = BookingStatusLabel.REQUESTED;
  let shouldAutoApprove = isAutoApproval === true;

  if (tenant && shouldUseXStateFlow(tenant)) {
    console.log("Using XState flow for ITP tenant");
    initialStatus = getInitialXStateStatus(data);

    // If XState determined auto-approval, override the shouldAutoApprove flag
    if (initialStatus === BookingStatusLabel.APPROVED) {
      shouldAutoApprove = true;
    }
  }

  let doc;
  try {
    const bookingData = {
      calendarEventId,
      roomId: selectedRoomIds,
      email,
      startDate: toFirebaseTimestampFromString(bookingCalendarInfo.startStr),
      endDate: toFirebaseTimestampFromString(bookingCalendarInfo.endStr),
      requestNumber: sequentialId,
      equipmentCheckedOut: false,
      requestedAt: Timestamp.now(),
      origin: BookingOrigin.USER,
      ...data,
    };

    // Add XState-specific fields for ITP tenant
    if (tenant && shouldUseXStateFlow(tenant)) {
      bookingData.xstateCurrentState =
        initialStatus === BookingStatusLabel.APPROVED
          ? "Approved"
          : "Requested";
      bookingData.tenant = tenant;

      // If auto-approved by XState, set approval timestamps
      if (initialStatus === BookingStatusLabel.APPROVED) {
        bookingData.firstApprovedAt = Timestamp.now();
        bookingData.firstApprovedBy = "Auto-Approval";
        bookingData.finalApprovedAt = Timestamp.now();
        bookingData.finalApprovedBy = "Auto-Approval";
      }
    }

    doc = await serverSaveDataToFirestore(TableNames.BOOKING, bookingData);

    if (!doc || !doc.id) {
      throw new Error("Failed to create booking document");
    }

    // Create initial booking log entry with appropriate status
    await logServerBookingChange({
      bookingId: doc.id,
      status: initialStatus,
      changedBy: email,
      requestNumber: sequentialId,
      calendarEventId: calendarEventId,
      note: "",
    });

    // Handle approval emails based on final status
    await handleBookingApprovalEmails(
      shouldAutoApprove,
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
  } catch (error) {
    console.error("Error creating booking:", error);
    return NextResponse.json(
      { result: "error", message: "Failed to create booking" },
      { status: 500 },
    );
  }
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
    modifiedBy,
  } = await request.json();
  // TODO verify that they actually changed something
  if (bookingCalendarInfo == null) {
    return NextResponse.json(
      { error: "missing bookingCalendarId" },
      { status: 500 },
    );
  }

  // Ensure modifiedBy is provided for modification tracking
  if (!modifiedBy) {
    return NextResponse.json(
      { error: "modifiedBy field is required for modifications" },
      { status: 400 },
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

  // Build description for modified event
  const startDateObj2 = new Date(bookingCalendarInfo.startStr);
  const endDateObj2 = new Date(bookingCalendarInfo.endStr);

  const bookingContentsForDescMod = buildBookingContents(
    data,
    selectedRoomIds,
    startDateObj2,
    endDateObj2,
    BookingStatusLabel.MODIFIED,
    data.requestNumber ?? existingContents.requestNumber,
    "user",
  );

  const descriptionMod =
    bookingContentsToDescription(bookingContentsForDescMod) +
    "<p>Your reservation is not yet confirmed. The coordinator will review and finalize your reservation within a few days.</p>" +
    '<p>To cancel reservations please return to the Booking Tool, visit My Bookings, and click "cancel" on the booking at least 24 hours before the date of the event. Failure to cancel an unused booking is considered a no-show and may result in restricted use of the space.</p>';

  let newCalendarEventId: string;
  try {
    newCalendarEventId = await createBookingCalendarEvent(
      selectedRooms,
      data.department,
      data.title,
      bookingCalendarInfo,
      descriptionMod,
    );
    // Add a new history entry for the modification
    await logServerBookingChange({
      bookingId: existingContents.id,
      status: BookingStatusLabel.MODIFIED,
      changedBy: modifiedBy,
      requestNumber: existingContents.requestNumber,
      calendarEventId: newCalendarEventId,
      note: "Modified by " + modifiedBy,
    });
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
    origin: BookingOrigin.USER,
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
