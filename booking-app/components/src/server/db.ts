import {
  Approver,
  BookingFormDetails,
  BookingStatusLabel,
  Days,
  OperationHours,
} from "../types";

import {
  clientFetchAllDataFromCollection,
  clientGetDataByCalendarEventId,
  clientSaveDataToFirestore,
  clientUpdateDataInFirestore,
  getPaginatedData,
} from "@/lib/firebase/firebase";
import { Timestamp, where } from "@firebase/firestore";
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
  limit: number,
  last: any
): Promise<Booking[]> => {
  return getPaginatedData<Booking>(
    TableNames.BOOKING,
    limit,
    "requestedAt",
    last
  );
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

  const doc = await clientGetDataByCalendarEventId(TableNames.BOOKING, id);
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
export const cancel = async (id: string, email: string) => {
  clientUpdateDataByCalendarEventId(TableNames.BOOKING, id, {
    canceledAt: Timestamp.now(),
    canceledBy: email,
  });
  const doc = await clientGetDataByCalendarEventId(TableNames.BOOKING, id);
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
    getApprovalCcEmail(process.env.NEXT_PUBLIC_BRANCH_NAME),
    headerMessage,
    BookingStatusLabel.NO_SHOW
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
  const doc = await clientGetDataByCalendarEventId(TableNames.BOOKING, id);
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
  const doc = await clientGetDataByCalendarEventId(TableNames.BOOKING, id);
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

export const noShow = async (id: string, email: string) => {
  clientUpdateDataByCalendarEventId(TableNames.BOOKING, id, {
    noShowedAt: Timestamp.now(),
    noShowedBy: email,
  });
  const doc = await clientGetDataByCalendarEventId(TableNames.BOOKING, id);
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
export const clientBookingContents = (id: string) => {
  return clientGetDataByCalendarEventId(TableNames.BOOKING, id)
    .then((bookingObj) => {
      const updatedBookingObj = Object.assign({}, bookingObj, {
        headerMessage: "This is a request email for final approval.",
        bookingToolUrl: getBookingToolDeployUrl(),
      });

      return updatedBookingObj as unknown as BookingFormDetails;
    })
    .catch((error) => {
      console.error("Error fetching booking contents:", error);
      throw error;
    });
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
