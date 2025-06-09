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

export const serverBookingContents = async (id: string, collection: string) => {
  const bookingObj = await serverGetDataByCalendarEventId<Booking>(
    collection,
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
  email: string,
  collection: string
) => {
  serverFirstApprove(id, "");
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
  serverFinalApprove(id, "");
  serverApproveEvent(id, collection);
};

// both first approve and second approve flows hit here
export const serverApproveBooking = async (id: string, email: string, collection: string) => {
  try {
    const bookingStatus = await serverGetDataByCalendarEventId<BookingStatus>(
      TableNames.BOOKING,
      id
    );
    const isFinalApproval = bookingStatus?.firstApprovedAt?.toDate() ?? null;

    if (isFinalApproval) {
      await finalApprove(id, email, collection);
    } else {
      await firstApprove(id, email, collection);
    }
  } catch (error) {
    throw error.status ? error : { status: 500, message: error.message };
  }
};

const firstApprove = async (id: string, email: string, collection: string) => {
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
  const contents = await serverBookingContents(id, collection);

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
const finalApprove = async (id: string, email: string, collection: string) => {
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

  await serverApproveEvent(id, collection);
};

interface SendBookingEmailOptions {
  calendarEventId: string;
  targetEmail: string;
  headerMessage: string;
  status: BookingStatusLabel;
  approverType?: ApproverType;
  replyTo?: string;
  collection: string;
}

interface SendConfirmationEmailOptions {
  calendarEventId: string;
  status: BookingStatusLabel;
  headerMessage: string;
  guestEmail: string;
  collection: string;
}

export const serverSendBookingDetailEmail = async ({
  calendarEventId,
  targetEmail,
  headerMessage,
  status,
  approverType,
  replyTo,
  collection,
}: SendBookingEmailOptions) => {
  const contents = await serverBookingContents(calendarEventId, collection);
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
  collection,
}: SendConfirmationEmailOptions) => {
  const email = await serverGetFinalApproverEmail();
  serverSendBookingDetailEmail({
    calendarEventId,
    targetEmail: email,
    headerMessage,
    status,
    replyTo: guestEmail,
    collection,
  });
};

//server
export const serverApproveEvent = async (id: string, collection: string) => {
  const doc = await serverGetDataByCalendarEventId(TableNames.BOOKING, id);
  if (!doc) {
    console.error("Booking status not found for calendar event id: ", id);
    return;
  }

  // @ts-ignore
  const guestEmail = doc.email;

  // for client
  const headerMessage =
    "Your reservation request for Media Commons is approved.";
  console.log("sending booking detail email...");

  serverSendBookingDetailEmail({
    calendarEventId: id,
    targetEmail: guestEmail,
    headerMessage: headerMessage,
    status: BookingStatusLabel.APPROVED,
    collection,
  });

  // for second approver
  serverSendConfirmationEmail({
    calendarEventId: id,
    status: BookingStatusLabel.APPROVED,
    headerMessage: "This is a confirmation email.",
    guestEmail: guestEmail,
    collection,
  });

  // for Samantha
  serverSendBookingDetailEmail({
    calendarEventId: id,
    targetEmail: getApprovalCcEmail(process.env.NEXT_PUBLIC_BRANCH_NAME),
    headerMessage: "This is a confirmation email.",
    status: BookingStatusLabel.APPROVED,
    replyTo: guestEmail,
    collection,
  });

  // for sponsor, if we have one
  const contents = await serverBookingContents(id, collection);
  if (contents.role === "Student" && contents.sponsorEmail?.length > 0) {
    serverSendBookingDetailEmail({
      calendarEventId: id,
      targetEmail: contents.sponsorEmail,
      headerMessage:
        "A reservation that you are the Sponsor of has been approved.",
      status: BookingStatusLabel.APPROVED,
      replyTo: guestEmail,
      collection,
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
