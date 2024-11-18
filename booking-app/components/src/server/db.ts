import { Approver, BookingStatusLabel } from "../types";
import {
  ApproverLevel,
  TableNames,
  TableNamesRaw,
  Tenants,
  getCancelCcEmail,
  getTableName,
} from "../policy";
import { Timestamp, where } from "@firebase/firestore";
import {
  clientFetchAllDataFromCollection,
  clientGetDataByCalendarEventId,
  clientUpdateDataInFirestore,
} from "@/lib/firebase/firebase";
import {
  clientSendBookingDetailEmail,
  clientSendConfirmationEmail,
} from "./emails";

import { clientUpdateDataByCalendarEventId } from "@/lib/firebase/client/clientDb";
import { roundTimeUp } from "../client/utils/date";

// TODO should work for all tenants
const BOOKING = getTableName(TableNamesRaw.BOOKING, Tenants.MEDIA_COMMONS);

export const fetchAllFutureBooking = async <T>(
  collectionName: TableNames
): Promise<T[]> => {
  const now = Timestamp.now();
  const futureQueryConstraints = [where("endDate", ">", now)];
  return clientFetchAllDataFromCollection<T>(
    collectionName,
    futureQueryConstraints
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
  clientUpdateDataByCalendarEventId(BOOKING, id, {
    declinedAt: Timestamp.now(),
    declinedBy: email,
    declineReason: reason || null,
  });

  const doc = await clientGetDataByCalendarEventId(BOOKING, id);
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
    Tenants.MEDIA_COMMONS,
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
  clientUpdateDataByCalendarEventId(BOOKING, id, {
    canceledAt: Timestamp.now(),
    canceledBy: email,
  });
  const doc = await clientGetDataByCalendarEventId(BOOKING, id);
  //@ts-ignore
  const guestEmail = doc ? doc.email : null;
  const headerMessage =
    "Your reservation request for Media Commons has been cancelled. For detailed reasons regarding this decision, please contact us at mediacommons.reservations@nyu.edu.";
  clientSendBookingDetailEmail(
    Tenants.MEDIA_COMMONS,
    id,
    guestEmail,
    headerMessage,
    BookingStatusLabel.CANCELED
  );
  clientSendBookingDetailEmail(
    Tenants.MEDIA_COMMONS,
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
  const table = getTableName(TableNamesRaw.APPROVERS, Tenants.MEDIA_COMMONS);
  const approverDocs =
    await clientFetchAllDataFromCollection<ApproverDoc>(table);

  if (approverDocs.length > 0) {
    const finalApproverDoc = approverDocs.filter(
      (doc) => doc.level === ApproverLevel.FINAL
    )[0]; // assuming only 1 final approver
    const docId = finalApproverDoc.id;
    const table = getTableName(TableNamesRaw.APPROVERS, Tenants.MEDIA_COMMONS);
    await clientUpdateDataInFirestore(table, docId, updatedData);
  } else {
    console.log("No policy settings docs found");
  }
};

export const checkin = async (id: string, email: string) => {
  clientUpdateDataByCalendarEventId(BOOKING, id, {
    checkedInAt: Timestamp.now(),
    checkedInBy: email,
  });
  const doc = await clientGetDataByCalendarEventId(BOOKING, id);
  //@ts-ignore
  const guestEmail = doc ? doc.email : null;

  const headerMessage =
    "Your reservation request for Media Commons has been checked in. Thank you for choosing Media Commons.";
  clientSendBookingDetailEmail(
    Tenants.MEDIA_COMMONS,
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
  clientUpdateDataByCalendarEventId(BOOKING, id, {
    checkedOutAt: Timestamp.now(),
    checkedOutBy: email,
  });
  clientUpdateDataByCalendarEventId(BOOKING, id, {
    endDate: Timestamp.fromDate(checkoutDate),
  });
  const doc = await clientGetDataByCalendarEventId(BOOKING, id);
  //@ts-ignore
  const guestEmail = doc ? doc.email : null;

  const headerMessage =
    "Your reservation request for Media Commons has been checked out. Thank you for choosing Media Commons.";
  clientSendBookingDetailEmail(
    Tenants.MEDIA_COMMONS,
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
  clientUpdateDataByCalendarEventId(BOOKING, id, {
    noShowedAt: Timestamp.now(),
    noShowedBy: email,
  });
  const doc = await clientGetDataByCalendarEventId(BOOKING, id);
  //@ts-ignore
  const guestEmail = doc ? doc.email : null;

  const headerMessage =
    "You did not check-in for your Media Commons Reservation and have been marked as a no-show.";
  clientSendBookingDetailEmail(
    Tenants.MEDIA_COMMONS,
    id,
    guestEmail,
    headerMessage,
    BookingStatusLabel.NO_SHOW
  );
  clientSendConfirmationEmail(
    Tenants.MEDIA_COMMONS,
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

export const clientApproveBooking = async (id: string, email: string) => {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/approve`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ id: id, email: email }),
  });
};
