import {
  BookingFormDetails,
  BookingStatus,
  BookingStatusLabel,
  PolicySettings,
} from "../types";
import {
  TableNames,
  getCancelCcEmail,
  getSecondApproverEmail,
} from "../policy";
import { approvalUrl, declineUrl, getBookingToolDeployUrl } from "./ui";
import {
  deleteDataFromFirestore,
  fetchAllDataFromCollection,
  getDataByCalendarEventId,
  updateDataInFirestore,
} from "@/lib/firebase/firebase";

import { Timestamp } from "@firebase/firestore";

export const bookingContents = (id: string) => {
  return getDataByCalendarEventId(TableNames.BOOKING, id)
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

export const updatePolicySettingData = async (updatedData: object) => {
  type PolicySettingsDoc = PolicySettings & { id: string };
  const policySettingsDocs =
    await fetchAllDataFromCollection<PolicySettingsDoc>(TableNames.POLICY);

  if (policySettingsDocs.length > 0) {
    const policySettings = policySettingsDocs[0]; // should only be 1 doc
    const docId = policySettings.id;
    await updateDataInFirestore(TableNames.POLICY, docId, updatedData);
  } else {
    console.log("No policy settings docs found");
  }
};

export const updateDataByCalendarEventId = async (
  collectionName: TableNames,
  calendarEventId: string,
  updatedData: object
) => {
  const data = await getDataByCalendarEventId(collectionName, calendarEventId);

  if (data) {
    const { id } = data;
    await updateDataInFirestore(collectionName, id, updatedData);
  } else {
    console.log("No document found with the given calendarEventId.");
  }
};

export const deleteDataByCalendarEventId = async (
  collectionName: TableNames,
  calendarEventId: string
) => {
  const data = await getDataByCalendarEventId(collectionName, calendarEventId);

  if (data) {
    const { id } = data;
    await deleteDataFromFirestore(collectionName, id);
  } else {
    console.log("No document found with the given calendarEventId.");
  }
};

const firstApprove = (id: string) => {
  updateDataByCalendarEventId(TableNames.BOOKING_STATUS, id, {
    firstApprovedAt: Timestamp.now(),
  });
};

const secondApprove = (id: string) => {
  updateDataByCalendarEventId(TableNames.BOOKING_STATUS, id, {
    secondApprovedAt: Timestamp.now(),
  });
};

export const approveInstantBooking = (id: string) => {
  firstApprove(id);
  secondApprove(id);
  approveEvent(id);
};

// both first approve and second approve flows hit here
export const approveBooking = async (id: string) => {
  const bookingStatus = await getDataByCalendarEventId<BookingStatus>(
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
    secondApprove(id);
    await approveEvent(id);
  } else {
    firstApprove(id);

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
    const contents = await bookingContents(id);

    const emailContents = {
      ...contents,
      headerMessage: "This is a request email for final approval.",
    };
    const recipient = await getSecondApproverEmail();
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

export const sendConfirmationEmail = async (
  calendarEventId: string,
  status: BookingStatusLabel,
  headerMessage: string
) => {
  const email = await getSecondApproverEmail();
  sendBookingDetailEmail(calendarEventId, email, headerMessage, status);
};

export const sendBookingDetailEmail = async (
  calendarEventId: string,
  email: string,
  headerMessage: string,
  status: BookingStatusLabel
) => {
  const contents = await bookingContents(calendarEventId);
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

export const approveEvent = async (id: string) => {
  const doc = await getDataByCalendarEventId(TableNames.BOOKING_STATUS, id);
  if (doc === undefined || doc === null) {
    console.error("Booking status not found for calendar event id: ", id);
    return;
  }
  //@ts-ignore
  const guestEmail = doc.email;

  // for user
  const headerMessage =
    "Your reservation request for Media Commons is approved.";
  console.log("sending booking detail email...");
  sendBookingDetailEmail(
    id,
    guestEmail,
    headerMessage,
    BookingStatusLabel.APPROVED
  );
  // for second approver
  sendConfirmationEmail(
    id,
    BookingStatusLabel.APPROVED,
    `This is a confirmation email.`
  );
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

  const contents = await bookingContents(id);
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

export const decline = async (id: string) => {
  updateDataByCalendarEventId(TableNames.BOOKING_STATUS, id, {
    declinedAt: Timestamp.now(),
  });

  const doc = await getDataByCalendarEventId(TableNames.BOOKING_STATUS, id);
  //@ts-ignore
  const guestEmail = doc ? doc.email : null;
  const headerMessage =
    "Your reservation request for Media Commons has been declined. For detailed reasons regarding this decision, please contact us at mediacommons.reservations@nyu.edu.";
  sendBookingDetailEmail(
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
        newPrefix: BookingStatusLabel.DECLINED,
      }),
    }
  );
};

export const cancel = async (id: string) => {
  updateDataByCalendarEventId(TableNames.BOOKING_STATUS, id, {
    canceledAt: Timestamp.now(),
  });
  const doc = await getDataByCalendarEventId(TableNames.BOOKING_STATUS, id);
  //@ts-ignore
  const guestEmail = doc ? doc.email : null;
  const headerMessage =
    "Your reservation request for Media Commons has been cancelled. For detailed reasons regarding this decision, please contact us at mediacommons.reservations@nyu.edu.";
  sendBookingDetailEmail(
    id,
    guestEmail,
    headerMessage,
    BookingStatusLabel.CANCELED
  );
  sendBookingDetailEmail(
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
        newPrefix: BookingStatusLabel.CANCELED,
      }),
    }
  );
};

export const checkin = async (id: string) => {
  updateDataByCalendarEventId(TableNames.BOOKING_STATUS, id, {
    checkedInAt: Timestamp.now(),
  });
  const doc = await getDataByCalendarEventId(TableNames.BOOKING_STATUS, id);
  //@ts-ignore
  const guestEmail = doc ? doc.email : null;

  const headerMessage =
    "Your reservation request for Media Commons has been checked in. Thank you for choosing Media Commons.";
  sendBookingDetailEmail(
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
        newPrefix: BookingStatusLabel.CHECKED_IN,
      }),
    }
  );
};

export const checkOut = async (id: string) => {
  updateDataByCalendarEventId(TableNames.BOOKING_STATUS, id, {
    checkedOutAt: Timestamp.now(),
  });
  const doc = await getDataByCalendarEventId(TableNames.BOOKING_STATUS, id);
  //@ts-ignore
  const guestEmail = doc ? doc.email : null;

  const headerMessage =
    "Your reservation request for Media Commons has been checked out. Thank you for choosing Media Commons.";
  sendBookingDetailEmail(
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
        newPrefix: BookingStatusLabel.CHECKED_OUT,
      }),
    }
  );
};

export const noShow = async (id: string) => {
  updateDataByCalendarEventId(TableNames.BOOKING_STATUS, id, {
    noShowedAt: Timestamp.now(),
  });
  const doc = await getDataByCalendarEventId(TableNames.BOOKING_STATUS, id);
  //@ts-ignore
  const guestEmail = doc ? doc.email : null;

  const headerMessage =
    "You did not check-in for your Media Commons Reservation and have been marked as a no-show.";
  sendBookingDetailEmail(
    id,
    guestEmail,
    headerMessage,
    BookingStatusLabel.NO_SHOW
  );
  sendConfirmationEmail(
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
        newPrefix: BookingStatusLabel.NO_SHOW,
      }),
    }
  );
};
