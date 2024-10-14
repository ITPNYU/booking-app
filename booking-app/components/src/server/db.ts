import {
  clientFetchAllDataFromCollection,
  clientGetDataByCalendarEventId,
  clientUpdateDataInFirestore,
} from "@/lib/firebase/firebase";
import { Timestamp, where } from "@firebase/firestore";
import {
  TableNames,
  clientGetFinalApproverEmail,
  getCancelCcEmail,
} from "../policy";
import {
  BookingFormDetails,
  BookingStatusLabel,
  PolicySettings,
} from "../types";
import { reviewUrl, getBookingToolDeployUrl } from "./ui";

import { clientUpdateDataByCalendarEventId } from "@/lib/firebase/client/clientDb";
import { roundTimeUp } from "../client/utils/date";

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

export const fetchAllFutureBookingStatus = async <T>(
  collectionName: TableNames
): Promise<T[]> => {
  // const now = Timestamp.now();
  // const futureQueryConstraints = [where("requestedAt", ">", now)];
  return clientFetchAllDataFromCollection<T>(collectionName);
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
  clientUpdateDataByCalendarEventId(TableNames.BOOKING_STATUS, id, {
    declinedAt: Timestamp.now(),
    declinedBy: email,
    declineReason: reason || null,
  });

  const doc = await clientGetDataByCalendarEventId(
    TableNames.BOOKING_STATUS,
    id
  );
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
  clientUpdateDataByCalendarEventId(TableNames.BOOKING_STATUS, id, {
    canceledAt: Timestamp.now(),
    canceledBy: email,
  });
  const doc = await clientGetDataByCalendarEventId(
    TableNames.BOOKING_STATUS,
    id
  );
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

export const updatePolicySettingData = async (updatedData: object) => {
  type PolicySettingsDoc = PolicySettings & { id: string };
  const policySettingsDocs =
    await clientFetchAllDataFromCollection<PolicySettingsDoc>(
      TableNames.POLICY
    );

  if (policySettingsDocs.length > 0) {
    const policySettings = policySettingsDocs[0]; // should only be 1 doc
    const docId = policySettings.id;
    await clientUpdateDataInFirestore(TableNames.POLICY, docId, updatedData);
  } else {
    console.log("No policy settings docs found");
  }
};
export const checkin = async (id: string, email: string) => {
  clientUpdateDataByCalendarEventId(TableNames.BOOKING_STATUS, id, {
    checkedInAt: Timestamp.now(),
    checkedInBy: email,
  });
  const doc = await clientGetDataByCalendarEventId(
    TableNames.BOOKING_STATUS,
    id
  );
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
  clientUpdateDataByCalendarEventId(TableNames.BOOKING_STATUS, id, {
    checkedOutAt: Timestamp.now(),
    checkedOutBy: email,
  });
  clientUpdateDataByCalendarEventId(TableNames.BOOKING, id, {
    endDate: Timestamp.fromDate(checkoutDate),
  });
  const doc = await clientGetDataByCalendarEventId(
    TableNames.BOOKING_STATUS,
    id
  );
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
  clientUpdateDataByCalendarEventId(TableNames.BOOKING_STATUS, id, {
    noShowedAt: Timestamp.now(),
    noShowedBy: email,
  });
  const doc = await clientGetDataByCalendarEventId(
    TableNames.BOOKING_STATUS,
    id
  );
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
        reviewUrl: reviewUrl(id),
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
