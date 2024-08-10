import {
  BookingFormDetails,
  BookingStatus,
  BookingStatusLabel,
} from "../types";
import { TableNames, getSecondApproverEmail } from "../policy";
import { approvalUrl, getBookingToolDeployUrl, rejectUrl } from "./ui";
import {
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
        rejectUrl: rejectUrl(id),
      });

      return updatedBookingObj as unknown as BookingFormDetails;
    })
    .catch((error) => {
      console.error("Error fetching booking contents:", error);
      throw error;
    });
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
    approveEvent(id);
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
          newPrefix: BookingStatusLabel.PRE_APPROVED,
        }),
      }
    );
    const contents = await bookingContents(id);

    const emailContents = {
      ...contents,
      headerMessage: "This is a request email for final approval.",
    };
    const recipient = getSecondApproverEmail(
      process.env.NEXT_PUBLIC_BRANCH_NAME || ""
    );
    const formData = {
      templateName: "approval_email",
      contents: emailContents,
      targetEmail: recipient,
      status: BookingStatusLabel.PRE_APPROVED,
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

export const sendConfirmationEmail = (
  calendarEventId: string,
  status: BookingStatusLabel,
  headerMessage: string
) => {
  const email = getSecondApproverEmail(process.env.BRANCH_NAME);
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
    requestNumber: contents.requestNumber,
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

export const reject = async (id: string) => {
  updateDataByCalendarEventId(TableNames.BOOKING_STATUS, id, {
    rejectedAt: Timestamp.now(),
  });

  const doc = await getDataByCalendarEventId(TableNames.BOOKING_STATUS, id);
  //@ts-ignore
  const guestEmail = doc ? doc.email : null;
  const headerMessage =
    "Your reservation request for Media Commons has been rejected. For detailed reasons regarding this decision, please contact us at mediacommons.reservations@nyu.edu.";
  sendBookingDetailEmail(
    id,
    guestEmail,
    headerMessage,
    BookingStatusLabel.REJECTED
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
        newPrefix: BookingStatusLabel.REJECTED,
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
  sendConfirmationEmail(
    id,
    BookingStatusLabel.CANCELED,
    `This is a cancelation email.`
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
