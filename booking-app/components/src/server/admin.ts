import {
  Constraint,
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
  BookingFormDetails,
  BookingStatus,
  BookingStatusLabel,
  RoomSetting,
} from "../types";

import { Timestamp } from "firebase-admin/firestore";

export const serverBookingContents = (id: string) => {
  return serverGetDataByCalendarEventId(TableNames.BOOKING, id)
    .then((bookingObj) => {
      const updatedBookingObj = Object.assign({}, bookingObj, {
        headerMessage: "This is a request email for final approval.",
      });

      return updatedBookingObj as unknown as BookingFormDetails;
    })
    .catch((error) => {
      console.error("Error fetching booking contents:", error);
      throw error;
    });
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
export const serverApproveInstantBooking = (id: string) => {
  serverFirstApprove(id, "");
  serverFinalApprove(id, "");
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

const firstApprove = async (id, email) => {
  serverFirstApprove(id, email);

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
  };
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/sendEmail`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(formData),
  });
};
const finalApprove = async (id, email) => {
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
  await serverApproveEvent(id);
};

export const serverSendConfirmationEmail = async (
  calendarEventId: string,
  status: BookingStatusLabel,
  headerMessage: string
) => {
  const email = await serverGetFinalApproverEmail();
  serverSendBookingDetailEmail(calendarEventId, email, headerMessage, status);
};
export const serverSendBookingDetailEmail = async (
  calendarEventId: string,
  email: string,
  headerMessage: string,
  status: BookingStatusLabel,
  approverType?: ApproverType
) => {
  const contents = await serverBookingContents(calendarEventId);
  contents.headerMessage = headerMessage;
  const formData = {
    templateName: "booking_detail",
    contents: contents,
    targetEmail: email,
    status: status,
    eventTitle: contents.title,
    requestNumber: contents.requestNumber ?? "--",
    bodyMessage: "",
    approverType: approverType,
  };
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/sendEmail`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(formData),
  });
};

//server
export const serverApproveEvent = async (id: string) => {
  const doc = await serverGetDataByCalendarEventId(TableNames.BOOKING, id);
  if (doc === undefined || doc === null) {
    console.error("Booking status not found for calendar event id: ", id);
    return;
  }

  //@ts-ignore
  const guestEmail = doc.email;

  // for client
  const headerMessage =
    "Your reservation request for Media Commons is approved.";
  console.log("sending booking detail email...");
  serverSendBookingDetailEmail(
    id,
    guestEmail,
    headerMessage,
    BookingStatusLabel.APPROVED
  );

  // for second approver
  serverSendConfirmationEmail(
    id,
    BookingStatusLabel.APPROVED,
    `This is a confirmation email.`
  );

  // for Samantha
  serverSendBookingDetailEmail(
    id,
    getApprovalCcEmail(process.env.NEXT_PUBLIC_BRANCH_NAME),
    `This is a confirmation email.`,
    BookingStatusLabel.APPROVED
  );

  // for sponsor, if we have one
  const contents = await serverBookingContents(id);
  if (contents.role === "Student" && contents.sponsorEmail?.length > 0) {
    serverSendBookingDetailEmail(
      id,
      contents.sponsorEmail,
      `A reservation that you are the Sponsor of has been approved.`,
      BookingStatusLabel.APPROVED
    );
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
