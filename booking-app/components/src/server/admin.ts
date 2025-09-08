import {
  logServerBookingChange,
  serverDeleteData,
  serverDeleteDocumentFields,
  serverFetchAllDataFromCollection,
  serverGetDataByCalendarEventId,
  serverGetDocumentById,
  serverGetFinalApproverEmail,
  serverUpdateInFirestore,
} from "@/lib/firebase/server/adminDb";
import { DEFAULT_TENANT, TENANTS } from "../constants/tenants";
import { ApproverLevel, TableNames, getApprovalCcEmail } from "../policy";
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
import { getMediaCommonsServices, isMediaCommons } from "../utils/tenantUtils";

import { Timestamp } from "firebase-admin/firestore";

interface HistoryItem {
  status: BookingStatusLabel;
  user: string;
  date: string;
  note?: string;
}

const getBookingHistory = async (
  booking: Booking,
  tenant?: string
): Promise<HistoryItem[]> => {
  const history: HistoryItem[] = [];

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
    tenant
  );

  if (logs.length > 0) {
    // Use bookingLogs data if available
    return logs
      .sort((a, b) => a.changedAt.toMillis() - b.changedAt.toMillis())
      .map((log) => ({
        status: log.status,
        user: log.changedBy,
        date: log.changedAt.toDate().toLocaleString(),
        note: log.note ?? undefined,
      }));
  }

  // Fallback to original implementation if no logs found
  if (booking.requestedAt) {
    history.push({
      status: BookingStatusLabel.REQUESTED,
      user: booking.email,
      date: booking.requestedAt.toDate().toLocaleString(),
    });
  }

  if (booking.firstApprovedAt) {
    history.push({
      status: BookingStatusLabel.PRE_APPROVED,
      user: booking.firstApprovedBy,
      date: booking.firstApprovedAt.toDate().toLocaleString(),
    });
  }

  if (booking.finalApprovedAt) {
    history.push({
      status: BookingStatusLabel.APPROVED,
      user: booking.finalApprovedBy,
      date: booking.finalApprovedAt.toDate().toLocaleString(),
    });
  }

  if (booking.declinedAt) {
    history.push({
      status: BookingStatusLabel.DECLINED,
      user: booking.declinedBy,
      date: booking.declinedAt.toDate().toLocaleString(),
      note: booking.declineReason,
    });
  }

  if (booking.canceledAt) {
    history.push({
      status: BookingStatusLabel.CANCELED,
      user: booking.canceledBy,
      date: booking.canceledAt.toDate().toLocaleString(),
    });
  }

  if (booking.checkedInAt) {
    history.push({
      status: BookingStatusLabel.CHECKED_IN,
      user: booking.checkedInBy,
      date: booking.checkedInAt.toDate().toLocaleString(),
    });
  }

  if (booking.checkedOutAt) {
    history.push({
      status: BookingStatusLabel.CHECKED_OUT,
      user: booking.checkedOutBy,
      date: booking.checkedOutAt.toDate().toLocaleString(),
    });
  }

  if (booking.noShowedAt) {
    history.push({
      status: BookingStatusLabel.NO_SHOW,
      user: booking.noShowedBy,
      date: booking.noShowedAt.toDate().toLocaleString(),
    });
  }

  if (booking.walkedInAt) {
    history.push({
      status: BookingStatusLabel.WALK_IN,
      user: "PA",
      date: booking.walkedInAt.toDate().toLocaleString(),
    });
  }

  return history.sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
};

export const serverBookingContents = async (id: string, tenant?: string) => {
  const booking = await serverGetDataByCalendarEventId<Booking>(
    TableNames.BOOKING,
    id,
    tenant
  );
  if (!booking) {
    throw new Error("Booking not found");
  }

  const history = await getBookingHistory(booking, tenant);

  // Format date and time
  const startDate = booking.startDate.toDate();
  const endDate = booking.endDate.toDate();

  const updatedBookingObj = Object.assign({}, booking, {
    headerMessage: "This is a request email for 2nd approval.",
    history: history,
    startDate: startDate.toLocaleDateString(),
    endDate: endDate.toLocaleDateString(),
    startTime: startDate.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }),
    endTime: endDate.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }),
    status:
      history.length > 0
        ? history[history.length - 1].status
        : BookingStatusLabel.REQUESTED,
  });

  return updatedBookingObj as unknown as BookingFormDetails;
};

export const serverUpdateDataByCalendarEventId = async (
  collectionName: TableNames,
  calendarEventId: string,
  updatedData: object,
  tenant?: string
) => {
  const booking = await serverGetDataByCalendarEventId<Booking>(
    collectionName,
    calendarEventId,
    tenant
  );
  if (!booking) {
    throw new Error("Booking not found");
  }
  await serverUpdateInFirestore(
    collectionName,
    booking.id,
    updatedData,
    tenant
  );
};

export const serverDeleteFieldsByCalendarEventId = async (
  collectionName: TableNames,
  calendarEventId: string,
  fields: string[],
  tenant?: string
) => {
  const booking = await serverGetDataByCalendarEventId<Booking>(
    collectionName,
    calendarEventId,
    tenant
  );
  if (!booking) {
    throw new Error("Booking not found");
  }
  await serverDeleteDocumentFields(collectionName, booking.id, fields, tenant);
};

export const serverDeleteDataByCalendarEventId = async (
  collectionName: TableNames,
  calendarEventId: string,
  tenant?: string
) => {
  const booking = await serverGetDataByCalendarEventId<Booking>(
    collectionName,
    calendarEventId,
    tenant
  );
  if (!booking) {
    throw new Error("Booking not found");
  }
  await serverDeleteData(collectionName, booking.id, tenant);
};

// from server
const serverFirstApprove = (id: string, email?: string, tenant?: string) => {
  serverUpdateDataByCalendarEventId(
    TableNames.BOOKING,
    id,
    {
      firstApprovedAt: Timestamp.now(),
      firstApprovedBy: email,
    },
    tenant
  );
};

// Export version for external use (for XState integration)
export const serverFirstApproveOnly = async (
  id: string,
  email?: string,
  tenant?: string
) => {
  console.log(
    `🎯 SERVER FIRST APPROVE ONLY [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
    {
      calendarEventId: id,
      email,
      tenant,
    }
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
    tenant
  );

  // Log the first approval action
  const doc = await serverGetDataByCalendarEventId<{
    id: string;
    requestNumber: number;
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
      tenant,
    });
  }

  // Send first approval email to final approver
  const contents = await serverBookingContents(id, tenant);
  const emailContents = {
    ...contents,
    headerMessage: "This is a request email for 2nd approval.",
  };
  const recipient = await serverGetFinalApproverEmail();
  const formData = {
    templateName: "booking_detail",
    contents: emailContents,
    targetEmail: recipient,
    status: BookingStatusLabel.PRE_APPROVED,
    eventTitle: contents.title || "",
    requestNumber: contents.requestNumber,
    bodyMessage: "",
    approverType: ApproverType.FINAL_APPROVER,
    replyTo: contents.email,
  };
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/sendEmail`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-tenant": tenant || DEFAULT_TENANT,
    },
    body: JSON.stringify(formData),
  });

  console.log(
    `✅ FIRST APPROVAL COMPLETED [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
    {
      calendarEventId: id,
      emailSent: res.ok,
      status: BookingStatusLabel.PRE_APPROVED,
    }
  );
};

const serverFinalApprove = async (
  id: string,
  email?: string,
  tenant?: string
) => {
  // Get the booking data to check for services
  const bookingData = await serverGetDataByCalendarEventId(
    TableNames.BOOKING,
    id,
    tenant
  );

  const updateData: any = {
    finalApprovedAt: Timestamp.now(),
    finalApprovedBy: email,
  };

  // For Media Commons, if services are requested, approve them all during final approval
  if (tenant === TENANTS.MC && bookingData) {
    const servicesRequested = getMediaCommonsServices(bookingData);

    if (servicesRequested.staff) {
      updateData.staffServiceApproved = true;
    }
    if (servicesRequested.equipment) {
      updateData.equipmentServiceApproved = true;
    }
    if (servicesRequested.catering) {
      updateData.cateringServiceApproved = true;
    }
    if (servicesRequested.cleaning) {
      updateData.cleaningServiceApproved = true;
    }
    if (servicesRequested.security) {
      updateData.securityServiceApproved = true;
    }
    if (servicesRequested.setup) {
      updateData.setupServiceApproved = true;
    }
  }

  serverUpdateDataByCalendarEventId(TableNames.BOOKING, id, updateData, tenant);
};

//server
export const serverApproveInstantBooking = async (
  id: string,
  email: string,
  tenant?: string
) => {
  // For Media Commons VIP bookings, check if services are requested
  // If so, only do first approval to allow service request flow
  const bookingData = await serverGetDataByCalendarEventId(
    TableNames.BOOKING,
    id,
    tenant
  );

  let shouldDoFinalApproval = true;

  if (isMediaCommons(tenant) && bookingData) {
    const { getMediaCommonsServices } = await import(
      "@/components/src/utils/tenantUtils"
    );
    const servicesRequested = getMediaCommonsServices(bookingData);
    const hasServices = Object.values(servicesRequested).some(Boolean);

    if (hasServices) {
      console.log(
        `🎯 VIP BOOKING WITH SERVICES - STOPPING AT PRE-APPROVED [${tenant?.toUpperCase()}]:`,
        {
          calendarEventId: id,
          servicesRequested,
        }
      );
      shouldDoFinalApproval = false;
    }
  }

  serverFirstApprove(id, "System", tenant);

  if (shouldDoFinalApproval) {
    serverFinalApprove(id, "System", tenant);
  }

  const doc = await serverGetDataByCalendarEventId<{
    id: string;
    requestNumber: number;
  }>(TableNames.BOOKING, id, tenant);
  if (doc && id) {
    await logServerBookingChange({
      bookingId: doc.id,
      status: shouldDoFinalApproval
        ? BookingStatusLabel.APPROVED
        : BookingStatusLabel.PRE_APPROVED,
      changedBy: "System",
      requestNumber: doc.requestNumber,
      calendarEventId: id,
      note: "",
      tenant,
    });
  }

  if (shouldDoFinalApproval) {
    serverApproveEvent(id, tenant);
  }
};

// both first approve and second approve flows hit here
export const serverApproveBooking = async (
  id: string,
  email: string,
  tenant?: string
) => {
  try {
    const bookingStatus = await serverGetDataByCalendarEventId<BookingStatus>(
      TableNames.BOOKING,
      id,
      tenant
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

const firstApprove = async (id: string, email: string, tenant?: string) => {
  await serverFirstApprove(id, email, tenant);

  // Log the first approval action
  const doc = await serverGetDataByCalendarEventId<{
    id: string;
    requestNumber: number;
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
      tenant,
    });
  }

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
        newValues: {
          statusPrefix: BookingStatusLabel.PRE_APPROVED,
        },
      }),
    }
  );
  const contents = await serverBookingContents(id, tenant);

  const emailContents = {
    ...contents,
    headerMessage: "This is a request email for 2nd approval.",
  };
  const recipient = await serverGetFinalApproverEmail();
  const formData = {
    templateName: "booking_detail",
    contents: emailContents,
    targetEmail: recipient,
    status: BookingStatusLabel.PRE_APPROVED,
    eventTitle: contents.title || "",
    requestNumber: contents.requestNumber,
    bodyMessage: "",
    approverType: ApproverType.FINAL_APPROVER,
    replyTo: contents.email,
  };
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/sendEmail`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(formData),
  });
};

const finalApprove = async (id: string, email: string, tenant?: string) => {
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
      note: "",
      tenant,
    });
  }

  await serverApproveEvent(id, tenant);
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
  const formData = {
    templateName: "booking_detail",
    contents: contents,
    targetEmail,
    status,
    eventTitle: contents.title,
    requestNumber: contents.requestNumber ?? "--",
    bodyMessage: "",
    approverType,
    replyTo,
    tenant,
  };
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/sendEmail`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
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
}: SendConfirmationEmailOptions) => {
  const email = await serverGetFinalApproverEmail();
  serverSendBookingDetailEmail({
    calendarEventId,
    targetEmail: email,
    headerMessage,
    status,
    replyTo: guestEmail,
    tenant,
  });
};

//server
export const serverApproveEvent = async (id: string, tenant?: string) => {
  const doc = await serverGetDataByCalendarEventId(
    TableNames.BOOKING,
    id,
    tenant
  );
  if (!doc) {
    console.error("Booking status not found for calendar event id: ", id);
    return;
  }

  // @ts-ignore
  const guestEmail = doc.email;

  const approvalNoticeHtml = `
<b>Reservation Check in</b><br />
Please plan to check in at the Media Commons Front Desk at the time of your reservation. If you are more than 30 minutes late for your reservation, it will be canceled and you will be marked as a “No-Show.” For reservations in room 1201, you can go straight to the 12th floor without checking in. You can reply to this email to adjust your reservation time if plans change and you will be arriving later. 
<br /><br />
<b>Equipment Check out</b><br />
If you requested equipment, you will receive a separate email which will confirm your equipment for your reservation. If you wish to request to reserve any additional equipment, please <a href="https://sites.google.com/nyu.edu/370jmediacommons/rental-inventory">take a look at our equipment inventory</a> and reply to this email with your request or any questions you may have ahead of your reservation. Otherwise our Production Assistants can help you during check in.
<br /><br />
<b>Front Desk Location</b><br />
The Media Commons Front Desk is located on the 2nd floor of 370 Jay Street, around the corner from Cafe 370.
<br /><br />
<b>Event Services Information</b><br />
If your reservation is for an event, take a look at the <a href="https://docs.google.com/document/d/1TIOl8f8-7o2BdjHxHYIYELSb4oc8QZMj1aSfaENWjR8/edit?usp=sharing">Event Service Rates and  Set Up Information document</a> to learn how to set up services for your reservation.
<br /><br />
<b>Cancellation Policy</b><br />
To cancel reservations please return to the Booking Tool, visit My Bookings, and click "cancel" on the booking at least 24 hours before the date of the event. Failure to cancel may result in restricted use of Media Commons spaces.
`;

  const userHeaderMessage = `Your request has been approved! Please see below for next steps.<br /><br />${approvalNoticeHtml}`;

  const otherHeaderMessage = `This is a confirmation email.<br /><br />${approvalNoticeHtml}`;

  // for client
  serverSendBookingDetailEmail({
    calendarEventId: id,
    targetEmail: guestEmail,
    headerMessage: userHeaderMessage,
    status: BookingStatusLabel.APPROVED,
    tenant,
  });

  // for second approver
  serverSendConfirmationEmail({
    calendarEventId: id,
    status: BookingStatusLabel.APPROVED,
    headerMessage: otherHeaderMessage,
    guestEmail: guestEmail,
    tenant,
  });

  // for Samantha
  serverSendBookingDetailEmail({
    calendarEventId: id,
    targetEmail: getApprovalCcEmail(process.env.NEXT_PUBLIC_BRANCH_NAME),
    headerMessage: otherHeaderMessage,
    status: BookingStatusLabel.APPROVED,
    replyTo: guestEmail,
    tenant,
  });

  // for sponsor, if we have one
  const contents = await serverBookingContents(id, tenant);
  if (contents.role === "Student" && contents.sponsorEmail?.length > 0) {
    serverSendBookingDetailEmail({
      calendarEventId: id,
      targetEmail: contents.sponsorEmail,
      headerMessage:
        "A reservation that you are the Sponsor of has been approved.<br /><br />" +
        approvalNoticeHtml,
      status: BookingStatusLabel.APPROVED,
      replyTo: guestEmail,
      tenant,
    });
  }

  const formDataForCalendarEvents = {
    calendarEventId: id,
    newValues: { statusPrefix: BookingStatusLabel.APPROVED },
  };
  await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/calendarEvents`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "x-tenant": tenant || DEFAULT_TENANT,
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
  console.log(`🔍 FIRST APPROVER EMAILS DEBUG:`, {
    department,
    function: "firstApproverEmails",
  });

  const approversData = await approvers();
  console.log(`📋 APPROVERS DATA:`, {
    department,
    totalApprovers: approversData.length,
    approvers: approversData.map((a) => ({
      email: a.email,
      department: a.department,
      level: a.level,
    })),
  });

  // Normalize department names for comparison (remove extra spaces, normalize slashes)
  const normalizeDepartment = (dept: string) => {
    if (!dept) return dept;

    // Simple normalization: trim whitespace and convert to lowercase
    // Complex slash processing is unnecessary for keyword-based matching
    return dept.trim().toLowerCase();
  };

  const normalizedUserDepartment = normalizeDepartment(department);
  console.log(`🔧 NORMALIZED USER DEPARTMENT:`, {
    original: department,
    normalized: normalizedUserDepartment,
  });

  const filteredApprovers = approversData.filter((approver) => {
    if (!approver.department) return false;

    const normalizedApproverDepartment = normalizeDepartment(
      approver.department
    );

    // Check if user department contains any of the key department identifiers
    const itpDeptKeywords = ["itp", "ima", "low res"];

    const userHasKeywords = itpDeptKeywords.some((keyword) =>
      normalizedUserDepartment.includes(keyword)
    );
    const approverHasKeywords = itpDeptKeywords.some((keyword) =>
      normalizedApproverDepartment.includes(keyword)
    );

    const matches = userHasKeywords && approverHasKeywords;

    console.log(`🔍 DEPARTMENT COMPARISON:`, {
      userDepartment: department,
      normalizedUserDepartment,
      approverDepartment: approver.department,
      normalizedApproverDepartment,
      userHasKeywords,
      approverHasKeywords,
      matches,
    });

    return matches;
  });

  console.log(`🎯 FILTERED APPROVERS:`, {
    department,
    normalizedDepartment: normalizedUserDepartment,
    filteredCount: filteredApprovers.length,
    filteredApprovers: filteredApprovers.map((a) => ({
      email: a.email,
      department: a.department,
      level: a.level,
    })),
  });

  const result = filteredApprovers.map((approver) => approver.email);

  console.log(`📧 FIRST APPROVER EMAILS RESULT:`, {
    department,
    normalizedDepartment: normalizedUserDepartment,
    result,
    resultCount: result.length,
  });

  return result;
};

export const serverGetRoomCalendarIds = async (
  roomId: number,
  tenant?: string
): Promise<string[]> => {
  try {
    // Get tenant schema
    const schema = await serverGetDocumentById(
      TableNames.TENANT_SCHEMA,
      tenant || DEFAULT_TENANT
    );
    if (!schema || !schema.resources) {
      console.log("No schema or resources found");
      return [];
    }

    const rooms = schema.resources.filter(
      (resource: any) => resource.roomId === roomId
    );

    console.log(`Rooms: ${JSON.stringify(rooms)}`);

    return rooms
      .map((room: any) => room.calendarId)
      .filter(
        (calendarId): calendarId is string =>
          calendarId !== undefined && calendarId !== null
      );
  } catch (error) {
    console.error("Error fetching room calendar IDs from schema:", error);
    return [];
  }
};

export const serverGetRoomCalendarId = async (
  roomId: number,
  tenant?: string
): Promise<string | null> => {
  try {
    // Get tenant schema
    const schema = await serverGetDocumentById(
      TableNames.TENANT_SCHEMA,
      tenant || DEFAULT_TENANT
    );
    if (!schema || !schema.resources) {
      console.log("No schema or resources found");
      return null;
    }

    const rooms = schema.resources.filter(
      (resource: any) => resource.roomId === roomId
    );

    if (rooms.length > 0) {
      const room = rooms[0];
      console.log(`Room: ${JSON.stringify(room)}`);
      return room.calendarId;
    } else {
      console.log("No matching room found.");
      return null;
    }
  } catch (error) {
    console.error("Error fetching room calendar ID from schema:", error);
    return null;
  }
};
