import {
  BookingFormDetails,
  BookingStatus,
  BookingStatusLabel,
  PolicySettings,
  RoomSetting,
} from "../types";

import { getApprovalCcEmail, TableNames } from "../policy";
import { approvalUrl, declineUrl, getBookingToolDeployUrl } from "./ui";

import { Timestamp } from "firebase-admin/firestore";
import {
  serverDeleteData,
  serverFetchAllDataFromCollection,
  serverGetDataByCalendarEventId,
  serverGetFinalApproverEmail,
  serverUpdateInFirestore,
} from "@/lib/firebase/server/adminDb";

export const serverBookingContents = (id: string) => {
  return serverGetDataByCalendarEventId(TableNames.BOOKING, id)
    .then((bookingObj) => {
      const updatedBookingObj = Object.assign({}, bookingObj, {
        headerMessage: "This is a request email for final approval.",
        approvalUrl: approvalUrl(id),
        bookingToolUrl: getBookingToolDeployUrl(),
        declineUrl: declineUrl(id),
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
const serverFirstApprove = (id: string) => {
  serverUpdateDataByCalendarEventId(TableNames.BOOKING_STATUS, id, {
    firstApprovedAt: Timestamp.now(),
  });
};

const serverFinalApprove = (id: string) => {
  serverUpdateDataByCalendarEventId(TableNames.BOOKING_STATUS, id, {
    finalApprovedAt: Timestamp.now(),
  });
};

//server
export const serverApproveInstantBooking = (id: string) => {
  serverFirstApprove(id);
  serverFinalApprove(id);
  serverApproveEvent(id);
};

// both first approve and second approve flows hit here
export const serverApproveBooking = async (id: string) => {
  const bookingStatus = await serverGetDataByCalendarEventId<BookingStatus>(
    TableNames.BOOKING_STATUS,
    id
  );
  const firstApproveDateRange =
    bookingStatus && bookingStatus.firstApprovedAt
      ? bookingStatus.firstApprovedAt.toDate()
      : null;

  console.log("first approve date", firstApproveDateRange);

  // if already first approved, then this is a second approve
  if (firstApproveDateRange !== null) {
    serverFinalApprove(id);
    await serverApproveEvent(id);
  } else {
    serverFirstApprove(id);

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL}/api/calendarEvents`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          calendarEventId: id,
          newPrefix: BookingStatusLabel.PENDING,
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
      templateName: "approval_email",
      contents: emailContents,
      targetEmail: recipient,
      status: BookingStatusLabel.PENDING,
      eventTitle: contents.title || "",
      requestNumber: contents.requestNumber,
      bodyMessage: "",
    };
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL}/api/sendEmail`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      }
    );
  }
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
  status: BookingStatusLabel
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
  const doc = await serverGetDataByCalendarEventId(
    TableNames.BOOKING_STATUS,
    id
  );
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
    newPrefix: BookingStatusLabel.APPROVED,
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

export const approvers = async () => {
  const fetchedData = await serverFetchAllDataFromCollection(
    TableNames.APPROVERS
  );
  const filtered = fetchedData.map((item: any) => ({
    id: item.id,
    email: item.email,
    department: item.department,
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
  const queryConstraints = [
    {
      field: "roomId",
      operator: "==",
      value: roomId,
    },
  ];
  const rooms = await serverFetchAllDataFromCollection(
    TableNames.RESOURCES,
    queryConstraints
  );
  console.log(`Rooms: ${rooms}`);
  return rooms.map((room: any) => room.calendarId);
};

export const serverGetRoomCalendarId = async (
  roomId: number
): Promise<string | null> => {
  const queryConstraints = [
    {
      field: "roomId",
      operator: "==",
      value: roomId,
    },
  ];
  const rooms = await serverFetchAllDataFromCollection(
    TableNames.RESOURCES,
    queryConstraints
  );
  if (rooms.length > 0) {
    const room = rooms[0] as RoomSetting;
    console.log(`Room: ${JSON.stringify(room)}`);
    return room.calendarId;
  } else {
    console.log("No matching room found.");
    return null;
  }
};
