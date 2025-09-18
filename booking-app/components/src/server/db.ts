import {
  Approver,
  Booking,
  BookingFormDetails,
  BookingOrigin,
  BookingStatusLabel,
  Days,
  Filters,
  OperationHours,
  PagePermission,
} from "../types";

import {
  clientFetchAllDataFromCollection,
  clientGetDataByCalendarEventId,
  clientSaveDataToFirestore,
  clientUpdateDataInFirestore,
  getPaginatedData,
} from "@/lib/firebase/firebase";
import { Timestamp, where } from "firebase/firestore";
import {
  ApproverLevel,
  TableNames,
  clientGetFinalApproverEmail,
  getApprovalCcEmail,
  getCancelCcEmail,
} from "../policy";

import { clientUpdateDataByCalendarEventId } from "@/lib/firebase/client/clientDb";
import { roundTimeUp } from "../client/utils/date";
import { getBookingToolDeployUrl } from "./ui";

export const fetchAllFutureBooking = async <Booking>(): Promise<Booking[]> => {
  const now = Timestamp.now();
  const futureQueryConstraints = [where("endDate", ">", now)];
  return clientFetchAllDataFromCollection<Booking>(
    TableNames.BOOKING,
    futureQueryConstraints
  );
};

export const fetchAllBookings = async <Booking>(
  pagePermission: PagePermission,
  limit: number,
  filters: Filters,
  last: any
): Promise<Booking[]> => {
  if (
    pagePermission === PagePermission.ADMIN ||
    pagePermission === PagePermission.LIAISON ||
    pagePermission === PagePermission.PA
  ) {
    return getPaginatedData<Booking>(TableNames.BOOKING, limit, filters, last);
  } else {
    return getPaginatedData<Booking>(TableNames.BOOKING, limit, filters, last);
  }
};

export const getOldSafetyTrainingEmails = () => {
  //TODO: implement this
  return [];
  //const activeSpreadSheet = SpreadsheetApp.openById(
  //  OLD_SAFETY_TRAINING_SHEET_ID
  //);
  //const activeSheet = activeSpreadSheet.getSheetByName(
  //  OLD_SAFETY_TRAINING_SHEET_NAME
  //);
  //var lastRow = activeSheet.getLastRow();

  //// get all row3(email) data
  //var range = activeSheet.getRange(1, 5, lastRow);
  //var values = range.getValues();

  //const secondSpreadSheet = SpreadsheetApp.openById(
  //  SECOND_OLD_SAFETY_TRAINING_SHEET_ID
  //);
  //const secondSheet = secondSpreadSheet
  //  .getSheets()
  //  .find(
  //    (sheet) => sheet.getSheetId() === SECOND_OLD_SAFETY_TRAINING_SHEET_GID
  //  );
  //const secondLastRow = secondSheet.getLastRow();
  //const secondRange = secondSheet.getRange(1, 2, secondLastRow);
  //const secondValues = secondRange.getValues();

  //const combinedValues = [...values, ...secondValues];
  //return combinedValues;
};

export const decline = async (id: string, email: string, reason?: string) => {
  clientUpdateDataByCalendarEventId(TableNames.BOOKING, id, {
    declinedAt: Timestamp.now(),
    declinedBy: email,
    declineReason: reason || null,
  });

  const doc = await clientGetDataByCalendarEventId<{
    id: string;
    requestNumber: number;
  }>(TableNames.BOOKING, id);

  // Log the decline action
  if (doc) {
    await logClientBookingChange({
      bookingId: doc.id,
      calendarEventId: id,
      status: BookingStatusLabel.DECLINED,
      changedBy: email,
      requestNumber: doc.requestNumber,
      note: reason,
    });
  }
  //@ts-ignore
  const guestEmail = doc ? doc.email : null;
  let headerMessage =
    "Your reservation request for Media Commons has been declined.";

  if (reason) {
    headerMessage += ` Reason: ${reason}`;
  } else {
    headerMessage +=
      " For detailed reasons regarding this decision, please contact us at mediacommons.reservations@nyu.edu.";
  }
  clientSendBookingDetailEmail(
    id,
    guestEmail,
    headerMessage,
    BookingStatusLabel.DECLINED
  );
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_BASE_URL}/api/calendarEvents`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        calendarEventId: id,
        newValues: { statusPrefix: BookingStatusLabel.DECLINED },
      }),
    }
  );
};

// If cancel within 24 hours of event or o, add to pre-ban logs.
export function checkAndLogLateCancellation(
  doc: any,
  bookingId: string,
  netId: string
) {
  if (!doc) return;

  // Only apply late cancellation penalty to user-created bookings
  if (doc.origin !== BookingOrigin.USER) return;

  // Check if required fields exist
  if (!doc.startDate || !doc.requestedAt) return;

  const now = Timestamp.now();
  const eventDate = doc.startDate;
  const requestedAt = doc.requestedAt;

  // Calculate time differences
  const timeToEvent = eventDate.toDate().getTime() - now.toDate().getTime();
  const hoursToEvent = timeToEvent / (1000 * 60 * 60);

  // If event is 24 hours or more away, no penalty.
  if (hoursToEvent >= 24) return;

  // If within 1 hour grace period of creation, no penalty.
  const timeSinceCreation =
    now.toDate().getTime() - requestedAt.toDate().getTime();
  const hoursSinceCreation = timeSinceCreation / (1000 * 60 * 60);
  if (hoursSinceCreation <= 1) return;

  // Add to pre-ban logs if outside grace period.
  const log = { netId, bookingId, lateCancelDate: now };
  clientSaveDataToFirestore(TableNames.PRE_BAN_LOGS, log);
}

export const cancel = async (id: string, email: string, netId: string) => {
  clientUpdateDataByCalendarEventId(TableNames.BOOKING, id, {
    canceledAt: Timestamp.now(),
    canceledBy: email,
  });

  const doc = await clientGetDataByCalendarEventId<{
    id: string;
    requestNumber: number;
  }>(TableNames.BOOKING, id);
  checkAndLogLateCancellation(doc, id, netId);

  // Log the cancel action
  if (doc) {
    await logClientBookingChange({
      bookingId: doc.id,
      calendarEventId: id,
      status: BookingStatusLabel.CANCELED,
      changedBy: email,
      requestNumber: doc.requestNumber,
    });
  }

  //@ts-ignore
  const guestEmail = doc ? doc.email : null;
  const headerMessage =
    "Your reservation request for Media Commons has been cancelled. For detailed reasons regarding this decision, please contact us at mediacommons.reservations@nyu.edu.";
  clientSendBookingDetailEmail(
    id,
    guestEmail,
    headerMessage,
    BookingStatusLabel.CANCELED
  );
  clientSendBookingDetailEmail(
    id,
    getCancelCcEmail(),
    headerMessage,
    BookingStatusLabel.CANCELED
  );
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_BASE_URL}/api/calendarEvents`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        calendarEventId: id,
        newValues: { statusPrefix: BookingStatusLabel.CANCELED },
      }),
    }
  );
};

export const updateFinalApprover = async (updatedData: object) => {
  type ApproverDoc = Approver & { id: string };
  const approverDocs = await clientFetchAllDataFromCollection<ApproverDoc>(
    TableNames.APPROVERS
  );

  if (approverDocs.length > 0) {
    const finalApproverDoc = approverDocs.filter(
      (doc) => doc.level === ApproverLevel.FINAL
    )[0]; // assuming only 1 final approver
    const docId = finalApproverDoc.id;
    await clientUpdateDataInFirestore(TableNames.APPROVERS, docId, updatedData);
  } else {
    console.log("No policy settings docs found");
  }
};

export const updateOperationHours = async (
  day: Days,
  open: number,
  close: number,
  isClosed: boolean,
  roomId?: number
) => {
  const docs = await clientFetchAllDataFromCollection<
    OperationHours & { id: string }
  >(TableNames.OPERATION_HOURS);

  const match = docs.find((x) => {
    if (roomId) {
      return x.day === day && x.roomId === roomId;
    }
    return x.day === day;
  });

  if (match != null) {
    const { id, ...data } = match;
    clientUpdateDataInFirestore(TableNames.OPERATION_HOURS, match.id, {
      ...data,
      open,
      close,
      isClosed,
    });
  } else {
    const r = roomId ? { roomId } : {};
    clientSaveDataToFirestore(TableNames.OPERATION_HOURS, {
      day: day.toString(),
      open,
      close,
      isClosed,
      ...r,
    });
  }
};

export const checkin = async (id: string, email: string) => {
  clientUpdateDataByCalendarEventId(TableNames.BOOKING, id, {
    checkedInAt: Timestamp.now(),
    checkedInBy: email,
  });
  const doc = await clientGetDataByCalendarEventId<{
    id: string;
    requestNumber: number;
  }>(TableNames.BOOKING, id);

  console.log("check in doc", doc);
  // Log the check-in action
  if (doc) {
    await logClientBookingChange({
      bookingId: doc.id,
      calendarEventId: id,
      status: BookingStatusLabel.CHECKED_IN,
      changedBy: email,
      requestNumber: doc.requestNumber,
      note: "",
    });
  }
  //@ts-ignore
  const guestEmail = doc ? doc.email : null;

  const headerMessage =
    "Your reservation request for Media Commons has been checked in. Thank you for choosing Media Commons.";
  clientSendBookingDetailEmail(
    id,
    guestEmail,
    headerMessage,
    BookingStatusLabel.CHECKED_IN
  );
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_BASE_URL}/api/calendarEvents`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        calendarEventId: id,
        newValues: { statusPrefix: BookingStatusLabel.CHECKED_IN },
      }),
    }
  );
};

export const checkOut = async (id: string, email: string) => {
  const checkoutDate = roundTimeUp();
  clientUpdateDataByCalendarEventId(TableNames.BOOKING, id, {
    checkedOutAt: Timestamp.now(),
    checkedOutBy: email,
  });
  clientUpdateDataByCalendarEventId(TableNames.BOOKING, id, {
    endDate: Timestamp.fromDate(checkoutDate),
  });
  const doc = await clientGetDataByCalendarEventId<{
    id: string;
    requestNumber: number;
  }>(TableNames.BOOKING, id);
  console.log("check out doc", doc);

  // Log the check-out action
  if (doc) {
    await logClientBookingChange({
      bookingId: doc.id,
      calendarEventId: id,
      status: BookingStatusLabel.CHECKED_OUT,
      changedBy: email,
      requestNumber: doc.requestNumber,
    });
  }
  //@ts-ignore
  const guestEmail = doc ? doc.email : null;

  const headerMessage =
    "Your reservation request for Media Commons has been checked out. Thank you for choosing Media Commons.";
  clientSendBookingDetailEmail(
    id,
    guestEmail,
    headerMessage,
    BookingStatusLabel.CHECKED_OUT
  );

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
          statusPrefix: BookingStatusLabel.CHECKED_OUT,
          end: {
            dateTime: roundTimeUp().toISOString(),
          },
        },
      }),
    }
  );
};

export const noShow = async (id: string, email: string, netId: string) => {
  clientUpdateDataByCalendarEventId(TableNames.BOOKING, id, {
    noShowedAt: Timestamp.now(),
    noShowedBy: email,
  });

  const doc = await clientGetDataByCalendarEventId<{
    id: string;
    requestNumber: number;
  }>(TableNames.BOOKING, id);

  // Add to pre-ban logs
  const log = { netId, bookingId: id, noShowDate: Timestamp.now() };
  clientSaveDataToFirestore(TableNames.PRE_BAN_LOGS, log);

  // Log the no-show action
  if (doc) {
    await logClientBookingChange({
      bookingId: doc.id,
      calendarEventId: id,
      status: BookingStatusLabel.NO_SHOW,
      changedBy: email,
      requestNumber: doc.requestNumber,
    });
  }

  //@ts-ignore
  const guestEmail = doc ? doc.email : null;

  const headerMessage =
    "You did not check-in for your Media Commons Reservation and have been marked as a no-show.";
  clientSendBookingDetailEmail(
    id,
    guestEmail,
    headerMessage,
    BookingStatusLabel.NO_SHOW
  );
  clientSendBookingDetailEmail(
    id,
    getApprovalCcEmail(process.env.NEXT_PUBLIC_BRANCH_NAME),
    headerMessage,
    BookingStatusLabel.NO_SHOW
  );
  clientSendConfirmationEmail(
    id,
    BookingStatusLabel.NO_SHOW,
    `This is a no show email.`
  );
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_BASE_URL}/api/calendarEvents`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        calendarEventId: id,
        newValues: { statusPrefix: BookingStatusLabel.NO_SHOW },
      }),
    }
  );
};

const getBookingHistory = async (booking: Booking) => {
  const history = [];

  // Add initial request
  if (booking.requestedAt) {
    history.push({
      status: BookingStatusLabel.REQUESTED,
      user: booking.email,
      date: booking.requestedAt.toDate().toLocaleString(),
      note: "",
    });
  }

  // Add first approval
  if (booking.firstApprovedAt) {
    history.push({
      status: BookingStatusLabel.PENDING,
      user: booking.firstApprovedBy,
      date: booking.firstApprovedAt.toDate().toLocaleString(),
      note: "",
    });
  }

  // Add final approval
  if (booking.finalApprovedAt) {
    history.push({
      status: BookingStatusLabel.APPROVED,
      user: booking.finalApprovedBy,
      date: booking.finalApprovedAt.toDate().toLocaleString(),
      note: "",
    });
  }

  // Add decline
  if (booking.declinedAt) {
    history.push({
      status: BookingStatusLabel.DECLINED,
      user: booking.declinedBy,
      date: booking.declinedAt.toDate().toLocaleString(),
      note: booking.declineReason || "",
    });
  }

  // Add cancel
  if (booking.canceledAt) {
    history.push({
      status: BookingStatusLabel.CANCELED,
      user: booking.canceledBy,
      date: booking.canceledAt.toDate().toLocaleString(),
      note: "",
    });
  }

  // Add check in
  if (booking.checkedInAt) {
    history.push({
      status: BookingStatusLabel.CHECKED_IN,
      user: booking.checkedInBy,
      date: booking.checkedInAt.toDate().toLocaleString(),
      note: "",
    });
  }

  // Add check out
  if (booking.checkedOutAt) {
    history.push({
      status: BookingStatusLabel.CHECKED_OUT,
      user: booking.checkedOutBy,
      date: booking.checkedOutAt.toDate().toLocaleString(),
      note: "",
    });
  }

  // Add no show
  if (booking.noShowedAt) {
    history.push({
      status: BookingStatusLabel.NO_SHOW,
      user: booking.noShowedBy,
      date: booking.noShowedAt.toDate().toLocaleString(),
      note: "",
    });
  }

  // Add walk in
  if (booking.walkedInAt) {
    history.push({
      status: BookingStatusLabel.WALK_IN,
      user: "PA",
      date: booking.walkedInAt.toDate().toLocaleString(),
      note: "",
    });
  }

  // Sort by date
  return history.sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
};

export const clientBookingContents = async (id: string) => {
  const bookingObj = await clientGetDataByCalendarEventId<Booking>(
    TableNames.BOOKING,
    id
  );
  if (!bookingObj) {
    throw new Error("Booking not found");
  }
  const history = await getBookingHistory(bookingObj);

  const updatedBookingObj = Object.assign({}, bookingObj, {
    headerMessage: "This is a request email for final approval.",
    bookingToolUrl: getBookingToolDeployUrl(),
    history: history,
  });

  return updatedBookingObj as unknown as BookingFormDetails;
};

export const clientSendBookingDetailEmail = async (
  calendarEventId: string,
  email: string,
  headerMessage: string,
  status: BookingStatusLabel
) => {
  const contents = await clientBookingContents(calendarEventId);
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

export const clientSendConfirmationEmail = async (
  calendarEventId: string,
  status: BookingStatusLabel,
  headerMessage: string
) => {
  const email = await clientGetFinalApproverEmail();
  clientSendBookingDetailEmail(calendarEventId, email, headerMessage, status);
};

export const clientApproveBooking = async (id: string, email: string) => {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/approve`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ id: id, email: email }),
  });
};

export const clientEquipmentApprove = async (id: string, email: string) => {
  //const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/equipment`, {
  //  method: "POST",
  //  headers: {
  //    "Content-Type": "application/json",
  //  },
  //  body: JSON.stringify({
  //    id: id,
  //    email: email,
  //    action: "EQUIPMENT_APPROVE",
  //  }),
  //});
  //if (!res.ok) {
  //  throw new Error("Failed to approve equipment");
  //}
};

export const clientSendToEquipment = async (id: string, email: string) => {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/equipment`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      id: id,
      email: email,
      action: "SEND_TO_EQUIPMENT",
    }),
  });

  if (!res.ok) {
    throw new Error("Failed to send booking to equipment");
  }
};

export const clientGetBookingLogs = async (
  requestNumber: number
): Promise<{ status: BookingStatusLabel; changedAt: any }[]> => {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL}/api/booking-logs?requestNumber=${requestNumber}`
    );

    if (!response.ok) {
      return [];
    }

    const logs = await response.json();
    return logs.map((log: any) => ({
      status: log.status,
      changedAt: log.changedAt,
    }));
  } catch (error) {
    console.error("Error fetching booking logs:", error);
    return [];
  }
};

const logClientBookingChange = async ({
  bookingId,
  calendarEventId,
  status,
  changedBy,
  requestNumber,
  note,
}: {
  bookingId: string;
  calendarEventId: string;
  status: BookingStatusLabel;
  changedBy: string;
  requestNumber: number;
  note?: string;
}) => {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_BASE_URL}/api/booking-logs`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        bookingId,
        calendarEventId,
        status,
        changedBy,
        requestNumber,
        note: note ?? null,
      }),
    }
  );

  if (!response.ok) {
    console.error("Failed to log booking change:", await response.text());
  }
};
