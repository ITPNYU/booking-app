import { committedApprovalStatus } from "@/lib/createdBookingStatus";
import { formatFurnishingsLines } from "@/components/src/utils/furnishingsDisplay";
import { resolveCallerRole } from "@/lib/api/authz";
import {
  logServerBookingChange,
  serverDeleteData,
  serverDeleteDocumentFields,
  serverFetchAllDataFromCollection,
  serverGetDataByCalendarEventId,
  serverGetDataByCalendarEventIdStrict,
  serverGetDocumentById,
  serverGetFinalApproverEmail,
  serverResolveResourceApproverEmails,
  serverUpdateInFirestore,
} from "@/lib/firebase/server/adminDb";
import { Timestamp } from "firebase-admin/firestore";
import { applyEnvironmentCalendarIds } from "@/lib/utils/calendarEnvironment";
import {
  compareTimestampsAscending,
  timestampToDate,
} from "@/lib/utils/timestampWire";
import { DEFAULT_TENANT } from "../constants/tenants";
import {
  ITP_DEPT_NAME_KEYWORDS,
  ITP_GROUP_SHORT_NAMES,
  isMediaCommons,
} from "../utils/tenantUtils";
import { TableNames } from "../policy";
import { getApprovalCcEmail } from "../tenantPolicyServer";
import {
  AdminUser,
  Approver,
  ApproverType,
  Booking,
  BookingFormDetails,
  BookingLog,
  BookingStatus,
  BookingStatusLabel,
} from "../types";
import {
  firstApprovalHistoryNote,
  isSystemHistoryActor,
  resolvePreApprovedHistoryNotes,
} from "../utils/bookingHistoryNotes";
import { formatHistoryDateTime } from "../client/utils/date";
import { getSecondaryContactName } from "../utils/formatters";
import { getTenantEmailConfig } from "./emails";

interface HistoryItem {
  status: BookingStatusLabel;
  user: string;
  date: string;
  note?: string;
}

const historyDateLabel = (value: unknown) => {
  const instant = timestampToDate(value);
  return instant ? formatHistoryDateTime(instant) : "";
};

const parseBookingResourceIds = (roomId: unknown): string[] =>
  String(roomId ?? "")
    .split(",")
    .map((resourceId) => resourceId.trim())
    .filter(Boolean);

const resolveBookingResourceApproverEmails = async (
  roomId: unknown,
  tenant?: string,
): Promise<string[]> => {
  const resourceIds = parseBookingResourceIds(roomId);
  if (resourceIds.length > 0) {
    return serverResolveResourceApproverEmails(resourceIds, tenant);
  }
  const fallback = await serverGetFinalApproverEmail(tenant);
  return fallback ? [fallback] : [];
};

const logEmailSendFailure = (context: string, error: unknown) => {
  console.error(`[${context}] Failed to send email:`, error);
};

const sendEmailFanout = async (
  context: string,
  senders: Array<() => Promise<Response>>,
): Promise<Array<PromiseSettledResult<Response>>> => {
  const results = await Promise.allSettled(senders.map((send) => send()));
  results.forEach((result) => {
    if (result.status === "rejected") {
      logEmailSendFailure(context, result.reason);
    } else if (!result.value.ok) {
      logEmailSendFailure(
        context,
        `Email API returned ${result.value.status} ${result.value.statusText}`,
      );
    }
  });
  return results;
};

const wasAnyEmailSent = (
  results: Array<PromiseSettledResult<Response>>,
): boolean =>
  results.some((result) => result.status === "fulfilled" && result.value.ok);

const sendEmailInBackground = (context: string, promise: Promise<unknown>) => {
  void promise.catch((error) => logEmailSendFailure(context, error));
};

const getBookingHistory = async (
  booking: Booking,
  tenant?: string,
): Promise<HistoryItem[]> => {
  // Fetch logs from BOOKING_LOGS table
  const logs = await serverFetchAllDataFromCollection<BookingLog>(
    TableNames.BOOKING_LOGS,
    [
      {
        field: "calendarEventId",
        operator: "==",
        value: booking.calendarEventId,
      },
    ],
    tenant,
  );

  if (logs.length > 0) {
    // Use bookingLogs data if available. Sort by the raw timestamp so
    // same-minute automated transitions stay in millisecond order.
    const sortedLogs = [...logs].sort((a, b) =>
      compareTimestampsAscending(a.changedAt, b.changedAt),
    );
    const resolvedNotes = resolvePreApprovedHistoryNotes(sortedLogs);
    return sortedLogs.map((log, index) => ({
      status: log.status,
      user: log.changedBy,
      date: historyDateLabel(log.changedAt),
      note: resolvedNotes[index],
    }));
  }

  // Fallback to original implementation if no logs found.
  // Keep the source timestamp and sort that, not a minute-truncated label.
  const fallback: Array<HistoryItem & { at: unknown }> = [];
  if (booking.requestedAt) {
    fallback.push({
      status: BookingStatusLabel.REQUESTED,
      user: booking.email,
      date: "",
      at: booking.requestedAt,
    });
  }

  if (booking.firstApprovedAt) {
    fallback.push({
      status: BookingStatusLabel.PRE_APPROVED,
      user: booking.firstApprovedBy,
      date: "",
      at: booking.firstApprovedAt,
    });
  }

  if (booking.finalApprovedAt) {
    fallback.push({
      status: BookingStatusLabel.APPROVED,
      user: booking.finalApprovedBy,
      date: "",
      at: booking.finalApprovedAt,
    });
  }

  if (booking.declinedAt) {
    fallback.push({
      status: BookingStatusLabel.DECLINED,
      user: booking.declinedBy,
      date: "",
      note: booking.declineReason,
      at: booking.declinedAt,
    });
  }

  if (booking.canceledAt) {
    fallback.push({
      status: BookingStatusLabel.CANCELED,
      user: booking.canceledBy,
      date: "",
      at: booking.canceledAt,
    });
  }

  if (booking.checkedInAt) {
    fallback.push({
      status: BookingStatusLabel.CHECKED_IN,
      user: booking.checkedInBy,
      date: "",
      at: booking.checkedInAt,
    });
  }

  if (booking.checkedOutAt) {
    fallback.push({
      status: BookingStatusLabel.CHECKED_OUT,
      user: booking.checkedOutBy,
      date: "",
      at: booking.checkedOutAt,
    });
  }

  if (booking.noShowedAt) {
    fallback.push({
      status: BookingStatusLabel.NO_SHOW,
      user: booking.noShowedBy,
      date: "",
      at: booking.noShowedAt,
    });
  }

  if (booking.walkedInAt) {
    fallback.push({
      status: BookingStatusLabel.WALK_IN,
      user: "PA",
      date: "",
      at: booking.walkedInAt,
    });
  }

  return fallback
    .sort((a, b) => compareTimestampsAscending(a.at, b.at))
    .map(({ at, ...item }) => ({
      ...item,
      date: historyDateLabel(at),
    }));
};

export const serverBookingContents = async (id: string, tenant?: string) => {
  const booking = await serverGetDataByCalendarEventId<Booking>(
    TableNames.BOOKING,
    id,
    tenant,
  );
  if (!booking) {
    throw new Error("Booking not found");
  }

  const history = await getBookingHistory(booking, tenant);

  // Format date and time
  const startDate = booking.startDate.toDate();
  const endDate = booking.endDate.toDate();

  const defaultHeaderMessage = "";
  const currentHeaderMessage = (booking as BookingFormDetails).headerMessage;

  const updatedBookingObj = {
    ...booking,
    headerMessage:
      typeof currentHeaderMessage === "string" &&
      currentHeaderMessage.trim().length > 0
        ? currentHeaderMessage
        : defaultHeaderMessage,
    history,
    startDate: startDate.toLocaleDateString("en-US"),
    endDate: endDate.toLocaleDateString("en-US"),
    startTime: startDate.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }),
    endTime: endDate.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }),
    secondaryContactName: getSecondaryContactName(booking),
    // Flattened for the email template; object maps cannot be rendered there.
    furnishingsLines: formatFurnishingsLines(booking),
  };

  return updatedBookingObj as unknown as BookingFormDetails;
};

export const serverUpdateDataByCalendarEventId = async (
  collectionName: TableNames,
  calendarEventId: string,
  updatedData: object,
  tenant?: string,
) => {
  const booking = await serverGetDataByCalendarEventId<Booking>(
    collectionName,
    calendarEventId,
    tenant,
  );
  if (!booking) {
    throw new Error("Booking not found");
  }
  await serverUpdateInFirestore(
    collectionName,
    booking.id,
    updatedData,
    tenant,
  );
};

export const serverDeleteFieldsByCalendarEventId = async (
  collectionName: TableNames,
  calendarEventId: string,
  fields: string[],
  tenant?: string,
) => {
  const booking = await serverGetDataByCalendarEventId<Booking>(
    collectionName,
    calendarEventId,
    tenant,
  );
  if (!booking) {
    throw new Error("Booking not found");
  }
  await serverDeleteDocumentFields(collectionName, booking.id, fields, tenant);
};

export const serverDeleteDataByCalendarEventId = async (
  collectionName: TableNames,
  calendarEventId: string,
  tenant?: string,
) => {
  const booking = await serverGetDataByCalendarEventId<Booking>(
    collectionName,
    calendarEventId,
    tenant,
  );
  if (!booking) {
    throw new Error("Booking not found");
  }
  await serverDeleteData(collectionName, booking.id, tenant);
};

export async function resolveFirstApprovalHistoryNote(
  email?: string,
  tenant?: string,
): Promise<string | undefined> {
  if (isSystemHistoryActor(email) || !email) {
    return undefined;
  }
  try {
    const role = await resolveCallerRole(
      { email, netId: email.split("@")[0] },
      tenant,
    );
    return firstApprovalHistoryNote(email, role);
  } catch (error) {
    console.error(
      "Failed to resolve first-approval history note from caller role:",
      error,
    );
    return undefined;
  }
}

// from server
const serverFirstApprove = async (
  id: string,
  email?: string,
  tenant?: string,
) => {
  await serverUpdateDataByCalendarEventId(
    TableNames.BOOKING,
    id,
    {
      firstApprovedAt: Timestamp.now(),
      firstApprovedBy: email,
    },
    tenant,
  );
};

// Export version for external use (for XState integration)
export const serverFirstApproveOnly = async (
  id: string,
  email?: string,
  tenant?: string,
) => {
  console.log(
    `🎯 SERVER FIRST APPROVE ONLY [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
    {
      calendarEventId: id,
      email,
      tenant,
    },
  );

  // Update booking with first approval fields and status
  await serverUpdateDataByCalendarEventId(
    TableNames.BOOKING,
    id,
    {
      firstApprovedAt: Timestamp.now(),
      firstApprovedBy: email,
      status: BookingStatusLabel.PRE_APPROVED,
    },
    tenant,
  );

  // Log the first approval action
  const doc = await serverGetDataByCalendarEventId<{
    id: string;
    requestNumber: number;
    roomId?: string;
  }>(TableNames.BOOKING, id, tenant);

  if (!doc) {
    console.error("Booking document not found for calendar event id:", id);
    throw new Error("Booking document not found");
  }

  if (id) {
    await logServerBookingChange({
      bookingId: doc.id,
      status: BookingStatusLabel.PRE_APPROVED,
      changedBy: email,
      requestNumber: doc.requestNumber,
      calendarEventId: id,
      note: await resolveFirstApprovalHistoryNote(email, tenant),
      tenant,
    });
  }

  // Send first approval email to final approver
  const contents = await serverBookingContents(id, tenant);
  const emailConfig = await getTenantEmailConfig(tenant);
  const emailContents = {
    ...contents,
    headerMessage: emailConfig.emailNotifications.reviewedNeedsApproval,
  };
  const recipients = await resolveBookingResourceApproverEmails(
    doc.roomId,
    tenant,
  );
  if (recipients.length === 0) {
    return;
  }
  const results = await sendEmailFanout(
    "first approval",
    recipients.map(
      (recipient) => () =>
        fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/sendEmail`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-tenant": tenant || DEFAULT_TENANT,
          },
          body: JSON.stringify({
            templateName: "booking_detail",
            contents: emailContents,
            targetEmail: recipient,
            status: BookingStatusLabel.PRE_APPROVED,
            eventTitle: contents.title || "",
            requestNumber: contents.requestNumber,
            bodyMessage: "",
            approverType: ApproverType.FINAL_APPROVER,
            replyTo: contents.email,
          }),
        }),
    ),
  );

  console.log(
    `✅ FIRST APPROVAL COMPLETED [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
    {
      calendarEventId: id,
      emailSent: wasAnyEmailSent(results),
      status: BookingStatusLabel.PRE_APPROVED,
    },
  );
};

export const serverFinalApprove = async (
  id: string,
  email?: string,
  tenant?: string,
) => {
  // Get the booking data to check for services
  const bookingData = await serverGetDataByCalendarEventId(
    TableNames.BOOKING,
    id,
    tenant,
  );
  // A missing document has nothing to approve. Callers such as finalApprove
  // then skip the history log instead of failing the request.
  if (!bookingData) {
    return;
  }

  const updateData: any = {
    finalApprovedAt: Timestamp.now(),
    finalApprovedBy: email,
  };

  await serverUpdateDataByCalendarEventId(
    TableNames.BOOKING,
    id,
    updateData,
    tenant,
  );
};

// server
export type CommittedApprovalRead = {
  known: boolean;
  status: BookingStatusLabel | null;
  error?: unknown;
};

/**
 * Re-reads the booking after instant approval threw. `known: false` means the
 * read kept failing (or the just-created booking was missing), so the caller
 * cannot tell whether the approval write landed.
 */
export async function serverCommittedInstantApprovalStatus(
  id: string,
  tenant?: string,
  { attempts = 3, delayMs = 250 }: { attempts?: number; delayMs?: number } = {},
): Promise<CommittedApprovalRead> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const booking = await serverGetDataByCalendarEventIdStrict<{
        finalApprovedAt?: unknown;
        firstApprovedAt?: unknown;
      }>(TableNames.BOOKING, id, tenant);
      if (!booking) {
        throw new Error(`Booking not found for calendar event id ${id}`);
      }
      return { known: true, status: committedApprovalStatus(booking) };
    } catch (error) {
      lastError = error;
      if (attempt < attempts && delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
      }
    }
  }
  return { known: false, status: null, error: lastError };
}

/**
 * Records which non-idempotent approval side effects already ran, so a retry
 * after a partial failure does not send the same emails or invites twice.
 */
export interface ApprovalProgress {
  approvalNotices?: Partial<
    Record<"requester" | "resourceApprovers" | "cc" | "sponsor", true>
  >;
  secondaryContactEmailed?: boolean;
  secondaryContactInvited?: boolean;
  calendarStatusUpdated?: boolean;
  guestInvited?: boolean;
  preApprovedEmailsSent?: boolean;
}

export const serverApproveInstantBooking = async (
  id: string,
  email: string,
  tenant?: string,
  progress: ApprovalProgress = {},
): Promise<BookingStatusLabel> => {
  // For Media Commons VIP bookings, check if services are requested
  // If so, only do first approval to allow service request flow
  const bookingData = await serverGetDataByCalendarEventId(
    TableNames.BOOKING,
    id,
    tenant,
  );

  let shouldDoFinalApproval = true;

  if (isMediaCommons(tenant) && bookingData) {
    const { getMediaCommonsServices } =
      await import("@/components/src/utils/tenantUtils");
    const { serverGetTenantResources } =
      await import("@/lib/tenant/serverGetTenantResources");
    const servicesRequested = getMediaCommonsServices(
      bookingData,
      await serverGetTenantResources(tenant),
    );
    const hasServices = Object.values(servicesRequested).some(Boolean);

    if (hasServices) {
      console.log(
        `🎯 VIP BOOKING WITH SERVICES - STOPPING AT PRE-APPROVED [${tenant?.toUpperCase()}]:`,
        {
          calendarEventId: id,
          servicesRequested,
        },
      );
      shouldDoFinalApproval = false;
    }
  }

  if (shouldDoFinalApproval) {
    // For instant booking with no services, use finalApprove for consistent processing
    await finalApprove(id, "System", tenant, undefined, progress);
    return BookingStatusLabel.APPROVED;
  }

  // For VIP bookings with services, use firstApprove for consistent processing
  await firstApprove(id, "System", tenant, progress);
  return BookingStatusLabel.PRE_APPROVED;
};

// both first approve and second approve flows hit here
export const serverApproveBooking = async (
  id: string,
  email: string,
  tenant?: string,
) => {
  try {
    const bookingStatus = await serverGetDataByCalendarEventId<BookingStatus>(
      TableNames.BOOKING,
      id,
      tenant,
    );
    const isFinalApproval = bookingStatus?.firstApprovedAt?.toDate() ?? null;

    if (isFinalApproval) {
      await finalApprove(id, email, tenant);
    } else {
      await firstApprove(id, email, tenant);
    }
  } catch (error) {
    throw error.status ? error : { status: 500, message: error.message };
  }
};

/** Resource-approver notice sent once a booking is pre-approved. */
async function sendPreApprovedApproverEmails(
  id: string,
  tenant?: string,
  progress: ApprovalProgress = {},
) {
  if (progress.preApprovedEmailsSent) {
    return;
  }
  const doc = await serverGetDataByCalendarEventId<{
    roomId?: string;
  }>(TableNames.BOOKING, id, tenant);
  if (!doc) {
    throw new Error("Booking document not found");
  }

  const contents = await serverBookingContents(id, tenant);
  const emailConfig = await getTenantEmailConfig(tenant);
  const emailContents = {
    ...contents,
    headerMessage: emailConfig.emailNotifications.reviewedNeedsApproval,
  };
  const recipients = await resolveBookingResourceApproverEmails(
    doc.roomId,
    tenant,
  );
  if (recipients.length === 0) {
    return;
  }

  progress.preApprovedEmailsSent = true;
  await sendEmailFanout(
    "booking modification first approval",
    recipients.map(
      (recipient) => () =>
        fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/sendEmail`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-tenant": tenant || DEFAULT_TENANT,
          },
          body: JSON.stringify({
            templateName: "booking_detail",
            contents: emailContents,
            targetEmail: recipient,
            status: BookingStatusLabel.PRE_APPROVED,
            eventTitle: contents.title || "",
            requestNumber: contents.requestNumber,
            bodyMessage: "",
            approverType: ApproverType.FINAL_APPROVER,
            replyTo: contents.email,
            schemaName: emailConfig.schemaName,
          }),
        }),
    ),
  );
}

async function updateCalendarStatusPrefix(
  calendarEventId: string,
  statusPrefix: BookingStatusLabel,
  tenant?: string,
) {
  await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/calendarEvents`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "x-tenant": tenant || DEFAULT_TENANT,
    },
    body: JSON.stringify({
      calendarEventId,
      newValues: { statusPrefix },
    }),
  });
}

async function approvalHistoryExists(
  calendarEventId: string,
  status: BookingStatusLabel,
  tenant?: string,
): Promise<boolean> {
  const logs = await serverFetchAllDataFromCollection<BookingLog>(
    TableNames.BOOKING_LOGS,
    [
      {
        field: "calendarEventId",
        operator: "==",
        value: calendarEventId,
      },
    ],
    tenant,
  );
  return logs.some((log) => log.status === status);
}

/**
 * Finish an instant approval whose Firestore write committed but a later step
 * threw. Writes the history entry and calendar status prefix the normal
 * approve path writes, then sends the approval emails. Pass the progress
 * object from the failed attempt so emails it already sent are not repeated.
 */
export async function notifyCommittedInstantApproval(
  calendarEventId: string,
  status: BookingStatusLabel,
  tenant?: string,
  progress: ApprovalProgress = {},
) {
  if (
    status !== BookingStatusLabel.APPROVED &&
    status !== BookingStatusLabel.PRE_APPROVED
  ) {
    return;
  }

  const doc = await serverGetDataByCalendarEventId<{
    id: string;
    requestNumber: number;
    finalApprovedBy?: string;
    firstApprovedBy?: string;
  }>(TableNames.BOOKING, calendarEventId, tenant);
  if (!doc) {
    throw new Error("Booking document not found");
  }

  const changedBy =
    (status === BookingStatusLabel.APPROVED
      ? doc.finalApprovedBy
      : doc.firstApprovedBy) || "System";

  if (!(await approvalHistoryExists(calendarEventId, status, tenant))) {
    await logServerBookingChange({
      bookingId: doc.id,
      status,
      changedBy,
      requestNumber: doc.requestNumber,
      calendarEventId,
      note:
        status === BookingStatusLabel.PRE_APPROVED
          ? await resolveFirstApprovalHistoryNote(changedBy, tenant)
          : "",
      tenant,
    });
  }

  if (status === BookingStatusLabel.APPROVED) {
    await serverApproveEvent(calendarEventId, tenant, progress);
    return;
  }
  await updateCalendarStatusPrefix(calendarEventId, status, tenant);
  await sendPreApprovedApproverEmails(calendarEventId, tenant, progress);
}

const firstApprove = async (
  id: string,
  email: string,
  tenant?: string,
  progress?: ApprovalProgress,
) => {
  await serverFirstApprove(id, email, tenant);

  // Log the first approval action
  const doc = await serverGetDataByCalendarEventId<{
    id: string;
    requestNumber: number;
    roomId?: string;
  }>(TableNames.BOOKING, id, tenant);
  if (!doc) {
    console.error("Booking document not found for calendar event id:", id);
    throw new Error("Booking document not found");
  }

  if (id) {
    await logServerBookingChange({
      bookingId: doc.id,
      status: BookingStatusLabel.PRE_APPROVED,
      changedBy: email,
      requestNumber: doc.requestNumber,
      calendarEventId: id,
      note: await resolveFirstApprovalHistoryNote(email, tenant),
      tenant,
    });
  }

  await updateCalendarStatusPrefix(id, BookingStatusLabel.PRE_APPROVED, tenant);
  await sendPreApprovedApproverEmails(id, tenant, progress);
};

export const finalApprove = async (
  id: string,
  email: string,
  tenant?: string,
  note?: string,
  progress?: ApprovalProgress,
) => {
  await serverFinalApprove(id, email, tenant);

  // Log the final approval action
  const doc = await serverGetDataByCalendarEventId<{
    id: string;
    requestNumber: number;
  }>(TableNames.BOOKING, id, tenant);
  if (doc && id) {
    await logServerBookingChange({
      bookingId: doc.id,
      status: BookingStatusLabel.APPROVED,
      changedBy: email,
      requestNumber: doc.requestNumber,
      calendarEventId: id,
      note: note || "",
      tenant,
    });
  }

  await serverApproveEvent(id, tenant, progress);
};

interface SendBookingEmailOptions {
  calendarEventId: string;
  targetEmail: string;
  headerMessage: string;
  status: BookingStatusLabel;
  approverType?: ApproverType;
  replyTo?: string;
  tenant?: string;
}

interface SendConfirmationEmailOptions {
  calendarEventId: string;
  status: BookingStatusLabel;
  headerMessage: string;
  guestEmail: string;
  tenant?: string;
  roomId?: unknown;
}

export const serverSendBookingDetailEmail = async ({
  calendarEventId,
  targetEmail,
  headerMessage,
  status,
  approverType,
  replyTo,
  tenant,
}: SendBookingEmailOptions) => {
  const contents = await serverBookingContents(calendarEventId, tenant);
  contents.headerMessage = headerMessage;

  // Get tenant email configuration
  const emailConfig = await getTenantEmailConfig(tenant);

  const formData = {
    templateName: "booking_detail",
    contents,
    targetEmail,
    status,
    eventTitle: contents.title,
    requestNumber: contents.requestNumber ?? "--",
    bodyMessage: "",
    approverType,
    replyTo,
    tenant,
    schemaName: emailConfig.schemaName,
  };
  return fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/sendEmail`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-tenant": tenant || DEFAULT_TENANT,
    },
    body: JSON.stringify(formData),
  });
};

export const serverSendConfirmationEmail = async ({
  calendarEventId,
  status,
  headerMessage,
  guestEmail,
  tenant,
  roomId,
}: SendConfirmationEmailOptions) => {
  const emails = await resolveBookingResourceApproverEmails(roomId, tenant);
  if (emails.length === 0) {
    return;
  }
  await sendEmailFanout(
    "approval confirmation",
    emails.map(
      (email) => () =>
        serverSendBookingDetailEmail({
          calendarEventId,
          targetEmail: email,
          headerMessage,
          status,
          replyTo: guestEmail,
          tenant,
        }),
    ),
  );
};

// Requester, resource approver, cc, and sponsor notices. All fire-and-forget.
// Each notice is marked in `progress` as it is dispatched, so a retry after a
// later throw skips the ones that already went out.
async function sendApprovalNotificationEmails(
  id: string,
  guestEmail: string,
  bookingRoomId: unknown,
  contents: Awaited<ReturnType<typeof serverBookingContents>>,
  tenant: string | undefined,
  progress: ApprovalProgress,
) {
  progress.approvalNotices ??= {};
  const sent = progress.approvalNotices;

  // Get tenant email configuration for approval notice
  const emailConfig = await getTenantEmailConfig(tenant);

  const userHeaderMessage = `Your request has been approved! Please see below for next steps.<br /><br />${emailConfig.emailNotifications.approvedUser}`;

  const otherHeaderMessage = `This is a confirmation email.<br /><br />${emailConfig.emailNotifications.approvedUser}`;

  // for client
  if (!sent.requester) {
    sent.requester = true;
    sendEmailInBackground(
      "approval requester notification",
      serverSendBookingDetailEmail({
        calendarEventId: id,
        targetEmail: guestEmail,
        headerMessage: userHeaderMessage,
        status: BookingStatusLabel.APPROVED,
        tenant,
      }),
    );
  }

  // for second approver
  if (!sent.resourceApprovers) {
    sent.resourceApprovers = true;
    sendEmailInBackground(
      "approval resource approver confirmation",
      serverSendConfirmationEmail({
        calendarEventId: id,
        status: BookingStatusLabel.APPROVED,
        headerMessage: otherHeaderMessage,
        guestEmail,
        tenant,
        roomId: bookingRoomId,
      }),
    );
  }

  // for Samantha
  if (!sent.cc) {
    const approvedCcEmail = await getApprovalCcEmail(
      process.env.NEXT_PUBLIC_BRANCH_NAME,
      tenant,
    );
    sent.cc = true;
    if (approvedCcEmail) {
      sendEmailInBackground(
        "approval cc notification",
        serverSendBookingDetailEmail({
          calendarEventId: id,
          targetEmail: approvedCcEmail,
          headerMessage: otherHeaderMessage,
          status: BookingStatusLabel.APPROVED,
          replyTo: guestEmail,
          tenant,
        }),
      );
    }
  }

  // for sponsor, if we have one
  if (
    !sent.sponsor &&
    contents.role === "Student" &&
    contents.sponsorEmail?.length > 0
  ) {
    sent.sponsor = true;
    // Handle both legacy full email format and new Net ID format
    const sponsorEmailAddress = contents.sponsorEmail.includes("@")
      ? contents.sponsorEmail
      : `${contents.sponsorEmail}@nyu.edu`;

    sendEmailInBackground(
      "approval sponsor notification",
      serverSendBookingDetailEmail({
        calendarEventId: id,
        targetEmail: sponsorEmailAddress,
        headerMessage: `A reservation that you are the Sponsor of has been approved.<br /><br />${emailConfig.emailNotifications.approvedUser}`,
        status: BookingStatusLabel.APPROVED,
        replyTo: guestEmail,
        tenant,
      }),
    );
  }
}

// server
export const serverApproveEvent = async (
  id: string,
  tenant?: string,
  progress: ApprovalProgress = {},
) => {
  const doc = await serverGetDataByCalendarEventId(
    TableNames.BOOKING,
    id,
    tenant,
  );
  if (!doc) {
    console.error("Booking status not found for calendar event id: ", id);
    return;
  }

  // @ts-ignore
  const guestEmail = doc.email;
  // @ts-ignore
  const bookingRoomId = doc.roomId;

  const contents = await serverBookingContents(id, tenant);

  await sendApprovalNotificationEmails(
    id,
    guestEmail,
    bookingRoomId,
    contents,
    tenant,
    progress,
  );

  // for secondary contact, if we have one
  // secondaryEmail now stores full NYU email (e.g., abc123@nyu.edu)
  // Keep these side effects sequential so a calendar/guest failure cannot
  // skip secondary contact email/invite (and so invites run after calendar update).
  if (contents.secondaryEmail && contents.secondaryEmail.length > 0) {
    // Handle both legacy net ID format and new full email format
    const secondaryEmailAddress = contents.secondaryEmail.includes("@")
      ? contents.secondaryEmail
      : `${contents.secondaryEmail}@nyu.edu`;

    if (!progress.secondaryContactEmailed) {
      const emailConfig = await getTenantEmailConfig(tenant);
      // Await the email to ensure it's sent before proceeding
      await serverSendBookingDetailEmail({
        calendarEventId: id,
        targetEmail: secondaryEmailAddress,
        headerMessage: `A reservation where you are listed as a Secondary Point of Contact has been approved.<br /><br />${
          emailConfig.emailNotifications.approvedUser
        }`,
        status: BookingStatusLabel.APPROVED,
        replyTo: guestEmail,
        tenant,
      });
      progress.secondaryContactEmailed = true;
    }

    if (!progress.secondaryContactInvited) {
      const secondaryFormData = {
        guestEmail: secondaryEmailAddress,
        calendarEventId: id,
        roomId: contents.roomId,
      };
      // Intentionally awaiting without try-catch: if email delivery fails,
      // we want the approval process to fail with the API error message.
      const inviteSecondaryResponse = await fetch(
        `${process.env.NEXT_PUBLIC_BASE_URL}/api/inviteUser`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-tenant": tenant || DEFAULT_TENANT,
          },
          body: JSON.stringify(secondaryFormData),
        },
      );
      if (!inviteSecondaryResponse.ok) {
        let errorBody = "";
        try {
          errorBody = await inviteSecondaryResponse.text();
        } catch {
          // ignore body read errors
        }
        throw new Error(
          `Failed to invite secondary contact (status ${inviteSecondaryResponse.status} ${inviteSecondaryResponse.statusText})${
            errorBody ? `: ${errorBody}` : ""
          }`,
        );
      }
      progress.secondaryContactInvited = true;
    }
  }

  if (!progress.calendarStatusUpdated) {
    await updateCalendarStatusPrefix(id, BookingStatusLabel.APPROVED, tenant);
    progress.calendarStatusUpdated = true;
  }

  if (!progress.guestInvited) {
    const formData = {
      guestEmail,
      calendarEventId: id,
      roomId: contents.roomId,
    };
    await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/inviteUser`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-tenant": tenant || DEFAULT_TENANT,
      },
      body: JSON.stringify(formData),
    });
    progress.guestInvited = true;
  }
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
    TableNames.APPROVERS,
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

  const { normalizeDepartment } =
    await import("@/components/src/utils/departmentUtils");

  const normalizedUserDepartment = normalizeDepartment(department, {
    toLowerCase: true,
  });

  // Returns true if a normalized department string belongs to the ITP/IMA/Low Res group.
  // Checks short-form abbreviations (exact match) first to avoid false positives from
  // substring matching (e.g. "ima" inside "imaging sciences"), then falls back to the
  // long-form keyword list for full NYU API department names.
  const isItpGroupMember = (normalizedDept: string) =>
    ITP_GROUP_SHORT_NAMES.some((name) => normalizedDept === name) ||
    ITP_DEPT_NAME_KEYWORDS.some((keyword) => normalizedDept.includes(keyword));

  const filteredApprovers = approversData.filter((approver) => {
    if (!approver.department) return false;

    const normalizedApproverDepartment = normalizeDepartment(
      approver.department,
      { toLowerCase: true },
    );

    // ITP/IMA/Low Res departments should match with each other
    const itpGroupMatches =
      isItpGroupMember(normalizedUserDepartment) &&
      isItpGroupMember(normalizedApproverDepartment);

    // For other departments, check exact match of normalized department names
    const exactMatch =
      normalizedUserDepartment === normalizedApproverDepartment;

    const matches = itpGroupMatches || exactMatch;

    return matches;
  });

  const result = filteredApprovers.map((approver) => approver.email);

  console.log("📧 FIRST APPROVER EMAILS RESULT:", {
    department,
    normalizedDepartment: normalizedUserDepartment,
    result,
    resultCount: result.length,
  });

  return result;
};

export const serverGetRoomCalendarIds = async (
  roomId: string | number,
  tenant?: string,
): Promise<string[]> => {
  try {
    // Get tenant schema
    const schema = await serverGetDocumentById(
      TableNames.TENANT_SCHEMA,
      tenant || DEFAULT_TENANT,
    );
    if (!schema || !schema.resources) {
      console.log("No schema or resources found");
      return [];
    }

    const { applyEnvironmentCalendarIds } =
      await import("@/lib/utils/calendarEnvironment");
    const resourcesWithCorrectCalendarIds = applyEnvironmentCalendarIds(
      schema.resources,
    );

    // Multi-room bookings store roomId as a comma-joined list ("202, 1201"),
    // so match each listed room rather than the raw string.
    const requestedRoomIds = String(roomId)
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
    const rooms = resourcesWithCorrectCalendarIds.filter((resource: any) =>
      requestedRoomIds.includes(String(resource.resourceId ?? resource.roomId)),
    );

    console.log(`Rooms: ${JSON.stringify(rooms)}`);

    return rooms
      .map((room: any) => room.calendarId)
      .filter(
        (calendarId): calendarId is string =>
          calendarId !== undefined && calendarId !== null,
      );
  } catch (error) {
    console.error("Error fetching room calendar IDs from schema:", error);
    return [];
  }
};

export const serverGetRoomCalendarId = async (
  roomId: string | number,
  tenant?: string,
): Promise<string | null> => {
  try {
    // Get tenant schema
    const schema = await serverGetDocumentById(
      TableNames.TENANT_SCHEMA,
      tenant || DEFAULT_TENANT,
    );
    if (!schema || !schema.resources) {
      console.log("No schema or resources found");
      return null;
    }

    const { applyEnvironmentCalendarIds } =
      await import("@/lib/utils/calendarEnvironment");
    const resourcesWithCorrectCalendarIds = applyEnvironmentCalendarIds(
      schema.resources,
    );

    const rooms = resourcesWithCorrectCalendarIds.filter(
      (resource: any) =>
        String(resource.resourceId ?? resource.roomId) === String(roomId),
    );

    if (rooms.length > 0) {
      const room = rooms[0];
      console.log(`Room: ${JSON.stringify(room)}`);
      return room.calendarId;
    }
    console.log("No matching room found.");
    return null;
  } catch (error) {
    console.error("Error fetching room calendar ID from schema:", error);
    return null;
  }
};
