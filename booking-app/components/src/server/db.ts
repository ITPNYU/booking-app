import { DEFAULT_TENANT } from "../constants/tenants";
import {
  Approver,
  Booking,
  BookingFormDetails,
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

import { shouldUseXState } from "@/components/src/utils/tenantUtils";
import { clientUpdateDataByCalendarEventId } from "@/lib/firebase/client/clientDb";
import { getBookingToolDeployUrl } from "./ui";

// Helper function to call XState transition API
async function callXStateTransitionAPI(
  calendarEventId: string,
  eventType: string,
  email: string,
  tenant?: string,
  reason?: string
): Promise<{ success: boolean; newState?: string; error?: string }> {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL}/api/xstate-transition`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant": tenant || DEFAULT_TENANT,
        },
        body: JSON.stringify({
          calendarEventId,
          eventType,
          email,
          reason,
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      return {
        success: false,
        error: errorData.error,
      };
    }

    const result = await response.json();
    return {
      success: true,
      newState: result.newState,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

export const fetchAllFutureBooking = async <Booking>(
  tenant?: string
): Promise<Booking[]> => {
  const now = Timestamp.now();
  const futureQueryConstraints = [where("endDate", ">", now)];
  return clientFetchAllDataFromCollection<Booking>(
    TableNames.BOOKING,
    futureQueryConstraints,
    tenant
  );
};

export const fetchAllBookings = async <Booking>(
  pagePermission: PagePermission,
  limit: number,
  filters: Filters,
  last: any,
  tenant?: string
): Promise<Booking[]> => {
  if (
    pagePermission === PagePermission.ADMIN ||
    pagePermission === PagePermission.LIAISON ||
    pagePermission === PagePermission.PA
  ) {
    return getPaginatedData<Booking>(
      TableNames.BOOKING,
      limit,
      filters,
      last,
      tenant
    );
  } else {
    return getPaginatedData<Booking>(
      TableNames.BOOKING,
      limit,
      filters,
      last,
      tenant
    );
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

export const decline = async (
  id: string,
  email: string,
  reason?: string,
  tenant?: string
) => {
  console.log(`🎯 DECLINE REQUEST [${tenant?.toUpperCase() || "UNKNOWN"}]:`, {
    calendarEventId: id,
    email,
    tenant,
    reason,
    usingXState: shouldUseXState(tenant),
  });

  // For ITP and Media Commons tenants, use XState transition via API
  if (shouldUseXState(tenant)) {
    console.log(`🎭 USING XSTATE API FOR DECLINE [${tenant?.toUpperCase()}]:`, {
      calendarEventId: id,
    });

    const xstateResult = await callXStateTransitionAPI(
      id,
      "decline",
      email,
      tenant,
      reason
    );

    if (!xstateResult.success) {
      console.error(
        `🚨 XSTATE DECLINE API FAILED [${tenant?.toUpperCase()}]:`,
        {
          calendarEventId: id,
          error: xstateResult.error,
        }
      );

      // Fallback to traditional decline if XState API fails
      console.log(
        `🔄 FALLING BACK TO TRADITIONAL DECLINE [${tenant?.toUpperCase()}]:`,
        {
          calendarEventId: id,
        }
      );
    } else {
      console.log(`✅ XSTATE DECLINE API SUCCESS [${tenant?.toUpperCase()}]:`, {
        calendarEventId: id,
        newState: xstateResult.newState,
      });

      // XState handled the decline successfully, now add history logging
      const doc = await clientGetDataByCalendarEventId<{
        id: string;
        requestNumber: number;
      }>(TableNames.BOOKING, id, tenant);

      if (doc) {
        await logClientBookingChange({
          bookingId: doc.id,
          calendarEventId: id,
          status: BookingStatusLabel.DECLINED,
          changedBy: email,
          requestNumber: doc.requestNumber,
          note: reason,
          tenant,
        });

        console.log(
          `📋 XSTATE DECLINE HISTORY LOGGED [${tenant?.toUpperCase()}]:`,
          {
            calendarEventId: id,
            bookingId: doc.id,
            requestNumber: doc.requestNumber,
            reason,
          }
        );
      }

      // Skip the traditional processing below
      return;
    }
  } else {
    console.log(
      `📝 USING TRADITIONAL DECLINE [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
      { calendarEventId: id }
    );
  }

  clientUpdateDataByCalendarEventId(
    TableNames.BOOKING,
    id,
    {
      declinedAt: Timestamp.now(),
      declinedBy: email,
      declineReason: reason || null,
    },
    tenant
  );

  const doc = await clientGetDataByCalendarEventId<{
    id: string;
    requestNumber: number;
  }>(TableNames.BOOKING, id, tenant);

  // Log the decline action
  if (doc) {
    await logClientBookingChange({
      bookingId: doc.id,
      calendarEventId: id,
      status: BookingStatusLabel.DECLINED,
      changedBy: email,
      requestNumber: doc.requestNumber,
      note: reason,
      tenant,
    });
  }
  //@ts-ignore
  const guestEmail = doc ? doc.email : null;
  let headerMessage =
    "Your reservation request for Media Commons has been declined.";

  if (reason) {
    headerMessage += ` Reason: ${reason}. <br /><br />If you have any questions or need further assistance, please don't hesitate to reach out.`;
  } else {
    headerMessage +=
      "<br />If you have any questions or need further assistance, please don't hesitate to reach out.";
  }
  clientSendBookingDetailEmail(
    id,
    guestEmail,
    headerMessage,
    BookingStatusLabel.DECLINED,
    tenant
  );
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_BASE_URL}/api/calendarEvents`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "x-tenant": tenant || DEFAULT_TENANT,
      },
      body: JSON.stringify({
        calendarEventId: id,
        newValues: { statusPrefix: BookingStatusLabel.DECLINED },
      }),
    }
  );
};

function isPolicyViolation(doc: any): boolean {
  // Exclude vip and walk-in
  if (!doc || !doc.startDate || !doc.requestedAt) return false;
  return true;
}

function isLateCancel(doc: any): boolean {
  if (!isPolicyViolation(doc)) return false;
  const now = Timestamp.now();
  const eventDate = doc.startDate;
  const requestedAt = doc.requestedAt;
  const timeToEvent = eventDate.toDate().getTime() - now.toDate().getTime();
  const hoursToEvent = timeToEvent / (1000 * 60 * 60);
  const timeSinceCreation =
    now.toDate().getTime() - requestedAt.toDate().getTime();
  const hoursSinceCreation = timeSinceCreation / (1000 * 60 * 60);
  return hoursToEvent <= 24 && hoursSinceCreation > 1;
}

function checkAndLogLateCancellation(
  doc: any,
  bookingId: string,
  netId: string
) {
  if (!isLateCancel(doc)) return;
  const now = Timestamp.now();
  const log = { netId, bookingId, lateCancelDate: now };
  clientSaveDataToFirestore(TableNames.PRE_BAN_LOGS, log);
}

async function getViolationCount(netId: string): Promise<number> {
  const preBanLogs = await clientFetchAllDataFromCollection(
    TableNames.PRE_BAN_LOGS,
    [where("netId", "==", netId)]
  );
  return preBanLogs.length;
}
export const cancel = async (
  id: string,
  email: string,
  netId: string,
  tenant?: string
) => {
  console.log(`🎯 CANCEL REQUEST [${tenant?.toUpperCase() || "UNKNOWN"}]:`, {
    calendarEventId: id,
    email,
    tenant,
    netId,
    usingXState: shouldUseXState(tenant),
  });

  // For ITP and Media Commons tenants, use XState transition via API
  if (shouldUseXState(tenant)) {
    console.log(`🎭 USING XSTATE API FOR CANCEL [${tenant?.toUpperCase()}]:`, {
      calendarEventId: id,
    });

    const xstateResult = await callXStateTransitionAPI(
      id,
      "cancel",
      email,
      tenant
    );

    if (!xstateResult.success) {
      console.error(`🚨 XSTATE CANCEL API FAILED [${tenant?.toUpperCase()}]:`, {
        calendarEventId: id,
        error: xstateResult.error,
      });

      // Fallback to traditional cancel if XState API fails
      console.log(
        `🔄 FALLING BACK TO TRADITIONAL CANCEL [${tenant?.toUpperCase()}]:`,
        {
          calendarEventId: id,
        }
      );
    } else {
      console.log(`✅ XSTATE CANCEL API SUCCESS [${tenant?.toUpperCase()}]:`, {
        calendarEventId: id,
        newState: xstateResult.newState,
      });

      // XState handled the cancel successfully, now add history logging
      const doc = await clientGetDataByCalendarEventId<{
        id: string;
        requestNumber: number;
      }>(TableNames.BOOKING, id, tenant);

      if (doc) {
        await logClientBookingChange({
          bookingId: doc.id,
          calendarEventId: id,
          status: BookingStatusLabel.CANCELED,
          changedBy: email,
          requestNumber: doc.requestNumber,
          tenant,
        });

        console.log(
          `📋 XSTATE CANCEL HISTORY LOGGED [${tenant?.toUpperCase()}]:`,
          {
            calendarEventId: id,
            bookingId: doc.id,
            requestNumber: doc.requestNumber,
          }
        );
      }

      // Skip the traditional processing below
      return;
    }
  } else {
    console.log(
      `📝 USING TRADITIONAL CANCEL [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
      { calendarEventId: id }
    );
  }

  clientUpdateDataByCalendarEventId(
    TableNames.BOOKING,
    id,
    {
      canceledAt: Timestamp.now(),
      canceledBy: email,
    },
    tenant
  );

  const doc = await clientGetDataByCalendarEventId<Booking>(
    TableNames.BOOKING,
    id,
    tenant
  );
  // Always call for pre-ban logging
  checkAndLogLateCancellation(doc, id, netId);

  // Log the cancel action (only for traditional processing)
  if (doc) {
    await logClientBookingChange({
      bookingId: doc.id,
      calendarEventId: id,
      status: BookingStatusLabel.CANCELED,
      changedBy: email,
      requestNumber: doc.requestNumber,
      tenant,
    });
  }

  //@ts-ignore
  const guestEmail = doc ? doc.email : null;

  let headerMessage =
    "The request has been canceled.<br /><br />Thank you!<br />";
  let ccHeaderMessage = headerMessage;

  if (isLateCancel(doc)) {
    const violationCount = await getViolationCount(netId);
    headerMessage = `Your reservation has been canceled and recorded as a "late cancellation," as it was canceled within 24 hours of the scheduled time.<br /><br />
We want to remind you that the Media Commons has a revocation policy regarding Late Cancellations and No Shows (<a href="https://sites.google.com/nyu.edu/370jmediacommons/about/our-policy" target="_blank">IV. Cancellation / V. 'No Show'</a>). Currently, you have <b>${violationCount}</b> on your account. After the third violation, a member of our team will reach out to discuss the next steps. Our aim with this policy is to promote accountability and a culture of sharing equitably within our community.<br /><br />
We understand that unexpected situations come up, and we ask you to cancel reservations at least 24 hours in advance whenever possible to help maintain a fair system for everyone. You can easily cancel through the <a href="https://sites.google.com/nyu.edu/370jmediacommons/reservations/booking-tool" target="_blank">booking tool on our website</a> or by emailing us at mediacommons.reservations@nyu.edu.<br /><br />
If you have any questions or need further assistance, please don't hesitate to reach out. We're here to support you!`;
    // ccHeaderMessage remains the original cancel message
  }

  clientSendBookingDetailEmail(
    id,
    guestEmail,
    headerMessage,
    BookingStatusLabel.CANCELED,
    tenant
  );
  clientSendBookingDetailEmail(
    id,
    getCancelCcEmail(),
    ccHeaderMessage,
    BookingStatusLabel.CANCELED,
    tenant
  );
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_BASE_URL}/api/calendarEvents`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "x-tenant": tenant || DEFAULT_TENANT,
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

export const checkin = async (id: string, email: string, tenant?: string) => {
  console.log(`🎯 CHECKIN REQUEST [${tenant?.toUpperCase() || "UNKNOWN"}]:`, {
    calendarEventId: id,
    email,
    tenant,
  });

  console.log(`🎭 USING XSTATE API FOR CHECKIN [${tenant?.toUpperCase()}]:`, {
    calendarEventId: id,
  });

  const xstateResult = await callXStateTransitionAPI(
    id,
    "checkIn",
    email,
    tenant
  );

  if (!xstateResult.success) {
    console.error(`🚨 XSTATE CHECKIN API FAILED [${tenant?.toUpperCase()}]:`, {
      calendarEventId: id,
      error: xstateResult.error,
    });
    throw new Error(`XState checkin failed: ${xstateResult.error}`);
  }

  console.log(`✅ XSTATE CHECKIN API SUCCESS [${tenant?.toUpperCase()}]:`, {
    calendarEventId: id,
    newState: xstateResult.newState,
  });

  // XState handled the checkin successfully, now add history logging and send email
  // Add history logging here since XState doesn't handle history
  const doc = await clientGetDataByCalendarEventId<{
    id: string;
    requestNumber: number;
  }>(TableNames.BOOKING, id, tenant);

  if (doc) {
    await logClientBookingChange({
      bookingId: doc.id,
      calendarEventId: id,
      status: BookingStatusLabel.CHECKED_IN,
      changedBy: email,
      requestNumber: doc.requestNumber,
      note: "",
      tenant,
    });

    console.log(
      `📋 XSTATE CHECKIN HISTORY LOGGED [${tenant?.toUpperCase()}]:`,
      {
        calendarEventId: id,
        bookingId: doc.id,
        requestNumber: doc.requestNumber,
      }
    );
  }

  // Send check-in email after history logging
  //@ts-ignore
  const guestEmail = doc ? doc.email : null;

  const headerMessage =
    "Your reservation request for Media Commons has been checked in. Thank you for choosing Media Commons.";
  clientSendBookingDetailEmail(
    id,
    guestEmail,
    headerMessage,
    BookingStatusLabel.CHECKED_IN,
    tenant
  );

  console.log(`📧 XSTATE CHECKIN EMAIL SENT [${tenant?.toUpperCase()}]:`, {
    calendarEventId: id,
    guestEmail,
  });
};

export const checkOut = async (id: string, email: string, tenant?: string) => {
  console.log(`🎯 CHECKOUT REQUEST [${tenant?.toUpperCase() || "UNKNOWN"}]:`, {
    calendarEventId: id,
    email,
    tenant,
  });

  console.log(`🎭 USING XSTATE API FOR CHECKOUT [${tenant?.toUpperCase()}]:`, {
    calendarEventId: id,
  });

  const xstateResult = await callXStateTransitionAPI(
    id,
    "checkOut",
    email,
    tenant
  );

  if (!xstateResult.success) {
    console.error(`🚨 XSTATE CHECKOUT API FAILED [${tenant?.toUpperCase()}]:`, {
      calendarEventId: id,
      error: xstateResult.error,
    });
    throw new Error(`XState checkout failed: ${xstateResult.error}`);
  }

  console.log(`✅ XSTATE CHECKOUT API SUCCESS [${tenant?.toUpperCase()}]:`, {
    calendarEventId: id,
    newState: xstateResult.newState,
  });

  // XState handled the checkout successfully, now add history logging
  const doc = await clientGetDataByCalendarEventId<{
    id: string;
    requestNumber: number;
  }>(TableNames.BOOKING, id, tenant);

  if (doc) {
    await logClientBookingChange({
      bookingId: doc.id,
      calendarEventId: id,
      status: BookingStatusLabel.CHECKED_OUT,
      changedBy: email,
      requestNumber: doc.requestNumber,
      tenant,
    });

    console.log(
      `📋 XSTATE CHECKOUT HISTORY LOGGED [${tenant?.toUpperCase()}]:`,
      {
        calendarEventId: id,
        bookingId: doc.id,
        requestNumber: doc.requestNumber,
      }
    );
  }
};

export const noShow = async (
  id: string,
  email: string,
  netId: string,
  tenant?: string
) => {
  console.log(`🎯 NO SHOW REQUEST [${tenant?.toUpperCase() || "UNKNOWN"}]:`, {
    calendarEventId: id,
    email,
    tenant,
    netId,
    usingXState: shouldUseXState(tenant),
  });

  // For ITP and Media Commons tenants, use XState transition via API
  if (shouldUseXState(tenant)) {
    console.log(`🎭 USING XSTATE API FOR NO SHOW [${tenant?.toUpperCase()}]:`, {
      calendarEventId: id,
    });

    const xstateResult = await callXStateTransitionAPI(
      id,
      "noShow",
      email,
      tenant
    );

    if (!xstateResult.success) {
      console.error(
        `🚨 XSTATE NO SHOW API FAILED [${tenant?.toUpperCase()}]:`,
        {
          calendarEventId: id,
          error: xstateResult.error,
        }
      );

      // Fallback to traditional no show if XState API fails
      console.log(
        `🔄 FALLING BACK TO TRADITIONAL NO SHOW [${tenant?.toUpperCase()}]:`,
        {
          calendarEventId: id,
        }
      );
    } else {
      console.log(`✅ XSTATE NO SHOW API SUCCESS [${tenant?.toUpperCase()}]:`, {
        calendarEventId: id,
        newState: xstateResult.newState,
      });

      // Check if XState reached 'No Show' state - only then execute traditional no show for side effects
      if (xstateResult.newState === "No Show") {
        console.log(
          `🎉 XSTATE REACHED NO SHOW STATE - EXECUTING NO SHOW SIDE EFFECTS [${tenant?.toUpperCase()}]:`,
          {
            calendarEventId: id,
            newState: xstateResult.newState,
          }
        );

        // Execute traditional no show processing (database updates, emails, etc.)
        await executeTraditionalNoShow(id, email, netId, tenant);
      } else {
        console.log(
          `🚫 XSTATE DID NOT REACH NO SHOW STATE - SKIPPING NO SHOW SIDE EFFECTS [${tenant?.toUpperCase()}]:`,
          {
            calendarEventId: id,
            newState: xstateResult.newState,
            expectedState: "No Show",
          }
        );
      }

      return; // Exit early since XState handled the transition
    }
  } else {
    console.log(
      `📝 USING TRADITIONAL NO SHOW [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
      { calendarEventId: id }
    );
  }

  // Execute traditional no show processing for non-XState tenants or XState failures
  await executeTraditionalNoShow(id, email, netId, tenant);
};

// Helper function to execute traditional no show processing
export const executeTraditionalNoShow = async (
  id: string,
  email: string,
  netId: string,
  tenant?: string
) => {
  clientUpdateDataByCalendarEventId(
    TableNames.BOOKING,
    id,
    {
      noShowedAt: Timestamp.now(),
      noShowedBy: email,
    },
    tenant
  );

  const doc = await clientGetDataByCalendarEventId<Booking>(
    TableNames.BOOKING,
    id,
    tenant
  );

  // Add to pre-ban logs only if policy violation
  if (isPolicyViolation(doc)) {
    const log = { netId, bookingId: id, noShowDate: Timestamp.now() };
    clientSaveDataToFirestore(TableNames.PRE_BAN_LOGS, log);
  }

  // Log the no-show action
  if (doc) {
    await logClientBookingChange({
      bookingId: doc.id,
      calendarEventId: id,
      status: BookingStatusLabel.NO_SHOW,
      changedBy: email,
      requestNumber: doc.requestNumber,
      tenant,
    });
  }

  //@ts-ignore
  const guestEmail = doc ? doc.email : null;

  const violationCount = await getViolationCount(netId);
  const headerMessage = `You have been marked as a 'No Show' and your reservation has been canceled due to not checking in within the first 30 minutes of your reservation.<br /><br />
We want to remind you that the Media Commons has a revocation policy regarding Late Cancellations and No Shows (<a href="https://sites.google.com/nyu.edu/370jmediacommons/about/our-policy" target="_blank">IV. Cancellation / V. 'No Show'</a>). Currently, you have <b>${violationCount}</b> on your account. After the third violation, a member of our team will reach out to discuss the next steps. Our aim with this policy is to promote accountability and a culture of sharing equitably within our community.<br /><br />
We understand that unexpected situations come up, and we encourage you to cancel reservations at least 24 hours in advance whenever possible to help maintain a fair system for everyone. You can easily cancel through the <a href="https://sites.google.com/nyu.edu/370jmediacommons/reservations/booking-tool" target="_blank">booking tool on our website</a> or by emailing us at mediacommons.reservations@nyu.edu.<br /><br />
If you have any questions or need further assistance, please don't hesitate to reach out. We're here to support you!`;
  clientSendBookingDetailEmail(
    id,
    guestEmail,
    headerMessage,
    BookingStatusLabel.NO_SHOW,
    tenant
  );
  clientSendBookingDetailEmail(
    id,
    getApprovalCcEmail(process.env.NEXT_PUBLIC_BRANCH_NAME),
    headerMessage,
    BookingStatusLabel.NO_SHOW,
    tenant
  );
  clientSendConfirmationEmail(
    id,
    BookingStatusLabel.NO_SHOW,
    `This is a no show email.`,
    tenant
  );
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_BASE_URL}/api/calendarEvents`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "x-tenant": tenant || DEFAULT_TENANT,
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

export const clientBookingContents = async (id: string, tenant?: string) => {
  const bookingObj = await clientGetDataByCalendarEventId<Booking>(
    TableNames.BOOKING,
    id,
    tenant
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
  status: BookingStatusLabel,
  tenant?: string
) => {
  const contents = await clientBookingContents(calendarEventId, tenant);
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
  headerMessage: string,
  tenant?: string
) => {
  const email = await clientGetFinalApproverEmail();
  clientSendBookingDetailEmail(
    calendarEventId,
    email,
    headerMessage,
    status,
    tenant
  );
};

export const clientApproveBooking = async (
  id: string,
  email: string,
  tenant?: string
) => {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/approve`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-tenant": tenant || DEFAULT_TENANT,
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
  tenant,
}: {
  bookingId: string;
  calendarEventId: string;
  status: BookingStatusLabel;
  changedBy: string;
  requestNumber: number;
  note?: string;
  tenant?: string;
}) => {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_BASE_URL}/api/booking-logs`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-tenant": tenant || DEFAULT_TENANT,
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
