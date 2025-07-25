import {
  Constraint,
  logServerBookingChange,
  serverDeleteData,
  serverDeleteDocumentFields,
  serverFetchAllDataFromCollection,
  serverGetDataByCalendarEventId,
  serverGetFinalApproverEmail,
  serverUpdateInFirestore,
} from "@/lib/firebase/server/adminDb";
import { ApproverLevel, TableNames, getApprovalCcEmail } from "../policy";
import {
  AdminUser,
  Approver,
  ApproverType,
  Booking,
  BookingFormDetails,
  BookingLog,
  BookingStatus,
  BookingStatusLabel,
  RoomSetting,
} from "../types";

import { Timestamp } from "firebase-admin/firestore";

interface HistoryItem {
  status: BookingStatusLabel;
  user: string;
  date: string;
  note?: string;
}

const getBookingHistory = async (booking: Booking): Promise<HistoryItem[]> => {
  const history: HistoryItem[] = [];

  // Fetch logs from BOOKING_LOGS table
  const logs = await serverFetchAllDataFromCollection<BookingLog>(
    TableNames.BOOKING_LOGS,
    [
      {
        field: "calendarEventId",
        operator: "==",
        value: booking.calendarEventId,
      },
    ]
  );

  if (logs.length > 0) {
    // Use bookingLogs data if available
    return logs
      .sort((a, b) => a.changedAt.toMillis() - b.changedAt.toMillis())
      .map((log) => ({
        status: log.status,
        user: log.changedBy,
        date: log.changedAt.toDate().toLocaleString(),
        note: log.note ?? undefined,
      }));
  }

  // Fallback to original implementation if no logs found
  if (booking.requestedAt) {
    history.push({
      status: BookingStatusLabel.REQUESTED,
      user: booking.email,
      date: booking.requestedAt.toDate().toLocaleString(),
    });
  }

  if (booking.firstApprovedAt) {
    history.push({
      status: BookingStatusLabel.PENDING,
      user: booking.firstApprovedBy,
      date: booking.firstApprovedAt.toDate().toLocaleString(),
    });
  }

  if (booking.finalApprovedAt) {
    history.push({
      status: BookingStatusLabel.APPROVED,
      user: booking.finalApprovedBy,
      date: booking.finalApprovedAt.toDate().toLocaleString(),
    });
  }

  if (booking.declinedAt) {
    history.push({
      status: BookingStatusLabel.DECLINED,
      user: booking.declinedBy,
      date: booking.declinedAt.toDate().toLocaleString(),
      note: booking.declineReason,
    });
  }

  if (booking.canceledAt) {
    history.push({
      status: BookingStatusLabel.CANCELED,
      user: booking.canceledBy,
      date: booking.canceledAt.toDate().toLocaleString(),
    });
  }

  if (booking.checkedInAt) {
    history.push({
      status: BookingStatusLabel.CHECKED_IN,
      user: booking.checkedInBy,
      date: booking.checkedInAt.toDate().toLocaleString(),
    });
  }

  if (booking.checkedOutAt) {
    history.push({
      status: BookingStatusLabel.CHECKED_OUT,
      user: booking.checkedOutBy,
      date: booking.checkedOutAt.toDate().toLocaleString(),
    });
  }

  if (booking.noShowedAt) {
    history.push({
      status: BookingStatusLabel.NO_SHOW,
      user: booking.noShowedBy,
      date: booking.noShowedAt.toDate().toLocaleString(),
    });
  }

  if (booking.walkedInAt) {
    history.push({
      status: BookingStatusLabel.WALK_IN,
      user: "PA",
      date: booking.walkedInAt.toDate().toLocaleString(),
    });
  }

  return history.sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
};

export const serverBookingContents = async (id: string) => {
  const bookingObj = await serverGetDataByCalendarEventId<Booking>(
    TableNames.BOOKING,
    id
  );
  if (!bookingObj) {
    throw new Error("Booking not found");
  }
  const history = await getBookingHistory(bookingObj);

  // Format date and time
  const startDate = bookingObj.startDate.toDate();
  const endDate = bookingObj.endDate.toDate();

  const updatedBookingObj = Object.assign({}, bookingObj, {
    headerMessage: "This is a request email for final approval.",
    history: history,
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
    status:
      history.length > 0
        ? history[history.length - 1].status
        : BookingStatusLabel.REQUESTED,
  });

  return updatedBookingObj as unknown as BookingFormDetails;
};

export const serverUpdateDataByCalendarEventId = async (
  collectionName: TableNames,
  calendarEventId: string,
  updatedData: object
) => {
  const data = await serverGetDataByCalendarEventId(
    collectionName,
    calendarEventId
  );

  if (data) {
    const { id } = data;
    await serverUpdateInFirestore(collectionName, id, updatedData);
  } else {
    console.log("No document found with the given calendarEventId.");
  }
};

export const serverDeleteFieldsByCalendarEventId = async (
  collectionName: TableNames,
  calendarEventId: string,
  fields: string[]
) => {
  const data = await serverGetDataByCalendarEventId(
    collectionName,
    calendarEventId
  );

  if (data) {
    const { id } = data;
    await serverDeleteDocumentFields(collectionName, id, fields);
  } else {
    console.log("No document found with the given calendarEventId.");
  }
};

export const serverDeleteDataByCalendarEventId = async (
  collectionName: TableNames,
  calendarEventId: string
) => {
  const data = await serverGetDataByCalendarEventId(
    collectionName,
    calendarEventId
  );

  if (data) {
    const { id } = data;
    await serverDeleteData(collectionName, id);
  } else {
    console.log("No document found with the given calendarEventId.");
  }
};

// from server
const serverFirstApprove = (id: string, email?: string) => {
  serverUpdateDataByCalendarEventId(TableNames.BOOKING, id, {
    firstApprovedAt: Timestamp.now(),
    firstApprovedBy: email,
  });
};

const serverFinalApprove = (id: string, email?: string) => {
  serverUpdateDataByCalendarEventId(TableNames.BOOKING, id, {
    finalApprovedAt: Timestamp.now(),
    finalApprovedBy: email,
  });
};

//server
export const serverApproveInstantBooking = async (
  id: string,
  email: string
) => {
  serverFirstApprove(id, "System");
  const doc = await serverGetDataByCalendarEventId<{
    id: string;
    requestNumber: number;
  }>(TableNames.BOOKING, id);
  if (doc && id) {
    await logServerBookingChange({
      bookingId: doc.id,
      status: BookingStatusLabel.APPROVED,
      changedBy: "System",
      requestNumber: doc.requestNumber,
      calendarEventId: id,
      note: "",
    });
  }
  serverFinalApprove(id, "System");
  serverApproveEvent(id);
};

// both first approve and second approve flows hit here
export const serverApproveBooking = async (id: string, email: string) => {
  try {
    const bookingStatus = await serverGetDataByCalendarEventId<BookingStatus>(
      TableNames.BOOKING,
      id
    );
    const isFinalApproval = bookingStatus?.firstApprovedAt?.toDate() ?? null;

    if (isFinalApproval) {
      await finalApprove(id, email);
    } else {
      await firstApprove(id, email);
    }
  } catch (error) {
    throw error.status ? error : { status: 500, message: error.message };
  }
};

const firstApprove = async (id: string, email: string) => {
  await serverFirstApprove(id, email);

  // Log the first approval action
  const doc = await serverGetDataByCalendarEventId<{
    id: string;
    requestNumber: number;
  }>(TableNames.BOOKING, id);
  if (!doc) {
    console.error("Booking document not found for calendar event id:", id);
    throw new Error("Booking document not found");
  }

  if (id) {
    await logServerBookingChange({
      bookingId: doc.id,
      status: BookingStatusLabel.PENDING,
      changedBy: email,
      requestNumber: doc.requestNumber,
      calendarEventId: id,
    });
  }

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_BASE_URL}/api/calendarEvents`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        calendarEventId: id,
        newValues: {
          statusPrefix: BookingStatusLabel.PENDING,
        },
      }),
    }
  );
  const contents = await serverBookingContents(id);

  const emailContents = {
    ...contents,
    headerMessage: "This is a request email for final approval.",
  };
  const recipient = await serverGetFinalApproverEmail();
  const formData = {
    templateName: "booking_detail",
    contents: emailContents,
    targetEmail: recipient,
    status: BookingStatusLabel.PENDING,
    eventTitle: contents.title || "",
    requestNumber: contents.requestNumber,
    bodyMessage: "",
    approverType: ApproverType.FINAL_APPROVER,
    replyTo: contents.email,
  };
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/sendEmail`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(formData),
  });
};
const finalApprove = async (id: string, email: string) => {
  const finalApprovers = (await approvers()).filter(
    (a) => a.level === ApproverLevel.FINAL
  );
  const finalApproverEmails = [...(await admins()), ...finalApprovers].map(
    (a) => a.email
  );

  const canPerformSecondApproval = finalApproverEmails.includes(email);
  if (!canPerformSecondApproval) {
    throw {
      success: false,
      message:
        "Unauthorized: Only final approvers or admin users can perform second approval",
      status: 403,
    };
  }
  serverFinalApprove(id, email);

  // Log the final approval action
  const doc = await serverGetDataByCalendarEventId<{
    id: string;
    requestNumber: number;
  }>(TableNames.BOOKING, id);
  if (doc && id) {
    await logServerBookingChange({
      bookingId: doc.id,
      status: BookingStatusLabel.APPROVED,
      changedBy: email,
      requestNumber: doc.requestNumber,
      calendarEventId: id,
      note: "",
    });
  }

  await serverApproveEvent(id);
};

interface SendBookingEmailOptions {
  calendarEventId: string;
  targetEmail: string;
  headerMessage: string;
  status: BookingStatusLabel;
  approverType?: ApproverType;
  replyTo?: string;
}

interface SendConfirmationEmailOptions {
  calendarEventId: string;
  status: BookingStatusLabel;
  headerMessage: string;
  guestEmail: string;
}

export const serverSendBookingDetailEmail = async ({
  calendarEventId,
  targetEmail,
  headerMessage,
  status,
  approverType,
  replyTo,
}: SendBookingEmailOptions) => {
  const contents = await serverBookingContents(calendarEventId);
  contents.headerMessage = headerMessage;
  const formData = {
    templateName: "booking_detail",
    contents: contents,
    targetEmail,
    status,
    eventTitle: contents.title,
    requestNumber: contents.requestNumber ?? "--",
    bodyMessage: "",
    approverType,
    replyTo,
  };
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/sendEmail`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(formData),
  });
};

export const serverSendConfirmationEmail = async ({
  calendarEventId,
  status,
  headerMessage,
  guestEmail,
}: SendConfirmationEmailOptions) => {
  const email = await serverGetFinalApproverEmail();
  serverSendBookingDetailEmail({
    calendarEventId,
    targetEmail: email,
    headerMessage,
    status,
    replyTo: guestEmail,
  });
};

//server
export const serverApproveEvent = async (id: string) => {
  const doc = await serverGetDataByCalendarEventId(TableNames.BOOKING, id);
  if (!doc) {
    console.error("Booking status not found for calendar event id: ", id);
    return;
  }

  // @ts-ignore
  const guestEmail = doc.email;

  const approvalNoticeHtml = `
<b>Reservation Check in</b><br />
Please plan to check in at the Media Commons Front Desk at the time of your reservation. If you are more than 30 minutes late for your reservation, it will be canceled and you will be marked as a “No-Show.” For reservations in room 1201, you can go straight to the 12th floor without checking in. You can reply to this email to adjust your reservation time if plans change and you will be arriving later. 
<br /><br />
<b>Equipment Check out</b><br />
If you requested equipment, you will receive a separate email which will confirm your equipment for your reservation. If you wish to request to reserve any additional equipment, please <a href="https://sites.google.com/nyu.edu/370jmediacommons/rental-inventory">take a look at our equipment inventory</a> and reply to this email with your request or any questions you may have ahead of your reservation. Otherwise our Production Assistants can help you during check in.
<br /><br />
<b>Front Desk Location</b><br />
The Media Commons Front Desk is located on the 2nd floor of 370 Jay Street, around the corner from Cafe 370.
<br /><br />
<b>Event Services Information</b><br />
If your reservation is for an event, take a look at the <a href="https://docs.google.com/document/d/1TIOl8f8-7o2BdjHxHYIYELSb4oc8QZMj1aSfaENWjR8/edit?usp=sharing">Event Service Rates and  Set Up Information document</a> to learn how to set up services for your reservation.
<br /><br />
<b>Cancellation Policy</b><br />
To cancel reservations please return to the Booking Tool, visit My Bookings, and click "cancel" on the booking at least 24 hours before the date of the event. Failure to cancel may result in restricted use of Media Commons spaces.
`;

  const userHeaderMessage = `Your request has been approved! Please see below for next steps.<br /><br />${approvalNoticeHtml}`;

  const otherHeaderMessage = `This is a confirmation email.<br /><br />${approvalNoticeHtml}`;

  // for client
  serverSendBookingDetailEmail({
    calendarEventId: id,
    targetEmail: guestEmail,
    headerMessage: userHeaderMessage,
    status: BookingStatusLabel.APPROVED,
  });

  // for second approver
  serverSendConfirmationEmail({
    calendarEventId: id,
    status: BookingStatusLabel.APPROVED,
    headerMessage: otherHeaderMessage,
    guestEmail: guestEmail,
  });

  // for Samantha
  serverSendBookingDetailEmail({
    calendarEventId: id,
    targetEmail: getApprovalCcEmail(process.env.NEXT_PUBLIC_BRANCH_NAME),
    headerMessage: otherHeaderMessage,
    status: BookingStatusLabel.APPROVED,
    replyTo: guestEmail,
  });

  // for sponsor, if we have one
  const contents = await serverBookingContents(id);
  if (contents.role === "Student" && contents.sponsorEmail?.length > 0) {
    serverSendBookingDetailEmail({
      calendarEventId: id,
      targetEmail: contents.sponsorEmail,
      headerMessage:
        "A reservation that you are the Sponsor of has been approved.<br /><br />" +
        approvalNoticeHtml,
      status: BookingStatusLabel.APPROVED,
      replyTo: guestEmail,
    });
  }

  const formDataForCalendarEvents = {
    calendarEventId: id,
    newValues: { statusPrefix: BookingStatusLabel.APPROVED },
  };
  await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/calendarEvents`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(formDataForCalendarEvents),
  });

  const formData = {
    guestEmail: guestEmail,
    calendarEventId: id,
    roomId: contents.roomId,
  };
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_BASE_URL}/api/inviteUser`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(formData),
    }
  );
};

export const admins = async (): Promise<AdminUser[]> => {
  const fetchedData = await serverFetchAllDataFromCollection(TableNames.ADMINS);
  const filtered = fetchedData.map((item: any) => ({
    id: item.id,
    email: item.email,
    createdAt: item.createdAt,
  }));
  return filtered;
};

export const approvers = async (): Promise<Approver[]> => {
  const fetchedData = await serverFetchAllDataFromCollection(
    TableNames.APPROVERS
  );
  const filtered = fetchedData.map((item: any) => ({
    id: item.id,
    email: item.email,
    department: item.department,
    level: item.level,
    createdAt: item.createdAt,
  }));
  return filtered;
};

export const firstApproverEmails = async (department: string) => {
  const approversData = await approvers();
  return approversData
    .filter((approver) => approver.department === department)
    .map((approver) => approver.email);
};

export const serverGetRoomCalendarIds = async (
  roomId: number
): Promise<string[]> => {
  const queryConstraints: Constraint[] = [
    {
      field: "roomId",
      operator: "==",
      value: roomId,
    },
  ];

  const rooms = await serverFetchAllDataFromCollection<RoomSetting>(
    TableNames.RESOURCES,
    queryConstraints
  );

  console.log(`Rooms: ${JSON.stringify(rooms)}`);

  return rooms
    .map((room) => room.calendarId)
    .filter(
      (calendarId): calendarId is string =>
        calendarId !== undefined && calendarId !== null
    );
};

export const serverGetRoomCalendarId = async (
  roomId: number
): Promise<string | null> => {
  const queryConstraints: Constraint[] = [
    {
      field: "roomId",
      operator: "==",
      value: roomId,
    },
  ];

  const rooms = await serverFetchAllDataFromCollection<RoomSetting>(
    TableNames.RESOURCES,
    queryConstraints
  );

  if (rooms.length > 0) {
    const room = rooms[0];
    console.log(`Room: ${JSON.stringify(room)}`);
    return room.calendarId;
  } else {
    console.log("No matching room found.");
    return null;
  }
};
