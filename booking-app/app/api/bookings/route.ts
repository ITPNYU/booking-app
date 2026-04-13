import { toFirebaseTimestampFromString } from "@/components/src/client/utils/serverDate";
import {
  firstApproverEmails,
  serverApproveInstantBooking,
  serverSendBookingDetailEmail,
  serverUpdateDataByCalendarEventId,
} from "@/components/src/server/admin";
import {
  isServicesRequestState,
  notifyServiceApproversForRequestedServices,
} from "@/components/src/server/serviceApproverNotifications";
import {
  bookingContentsToDescription,
  insertEvent,
} from "@/components/src/server/calendars";
import { getTenantEmailConfig } from "@/components/src/server/emails";
import {
  ApproverType,
  BookingFormDetails,
  BookingOrigin,
  BookingStatusLabel,
  RoomSetting,
} from "@/components/src/types";
import { getSecondaryContactName } from "@/components/src/utils/formatters";
import {
  logServerBookingChange,
  serverGetNextSequentialId,
  serverSaveDataToFirestore,
  serverGetDocumentById,
  serverFetchAllDataFromCollection,
} from "@/lib/firebase/server/adminDb";
import { itpBookingMachine } from "@/lib/stateMachines/itpBookingMachine";
import { mcBookingMachine } from "@/lib/stateMachines/mcBookingMachine";
import { NextRequest, NextResponse } from "next/server";
import { createActor } from "xstate";
import { sendHTMLEmail } from "@/app/lib/sendHTMLEmail";

import { DEFAULT_TENANT } from "@/components/src/constants/tenants";
import { CALENDAR_HIDE_STATUS, TableNames } from "@/components/src/policy";
import { formatOrigin } from "@/components/src/utils/formatters";
import {
  getMediaCommonsServices,
  isMediaCommons,
} from "@/components/src/utils/tenantUtils";
import { getCalendarClient } from "@/lib/googleClient";
import { applyEnvironmentCalendarIds } from "@/lib/utils/calendarEnvironment";
import { Timestamp } from "firebase-admin/firestore";
import { DateSelectArg } from "fullcalendar";
import {
  extractTenantFromRequest,
  getAffiliationDisplayValues,
  getOtherDisplayFields,
} from "./shared";
import type {
  RequestLimitPeriod,
  SchemaContextType,
} from "@/components/src/client/routes/components/SchemaProvider";

// Common function to create XState data structure
export function createXStateData(
  machineId: string,
  snapshot: any,
  targetState?: string,
) {
  return {
    machineId,
    lastTransition: new Date().toISOString(),
    snapshot: {
      status: snapshot.status,
      value: targetState || snapshot.value,
      historyValue: snapshot.historyValue || {},
      context: cleanObjectForFirestore(snapshot.context),
      children: snapshot.children || {},
    },
  };
}

// Common function to create XState snapshot data
async function createXStateSnapshotData(
  tenant: string,
  calendarEventId: string,
  email: string,
  targetState: string,
  context?: any,
) {
  const { mcBookingMachine } =
    await import("@/lib/stateMachines/mcBookingMachine");
  const { createActor } = await import("xstate");

  // Create fresh XState actor
  const freshActor = createActor(mcBookingMachine, {
    input: {
      tenant,
      calendarEventId,
      email,
      ...context,
    },
  });

  freshActor.start();

  // Get the current snapshot
  const currentSnapshot = freshActor.getSnapshot();

  // Use the common function to create XState data
  const xstateData = createXStateData(
    "MC Booking Request",
    {
      ...currentSnapshot,
      context: context || currentSnapshot.context,
    },
    targetState,
  );

  freshActor.stop();

  return xstateData;
}

// Clean object by removing undefined values for Firestore compatibility
function cleanObjectForFirestore(obj: any): any {
  if (obj === null || obj === undefined) {
    return null;
  }

  if (typeof obj !== "object") {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj
      .map(item => cleanObjectForFirestore(item))
      .filter(item => item !== undefined);
  }

  const cleaned: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      cleaned[key] = cleanObjectForFirestore(value);
    }
  }

  return cleaned;
}

// Helper function to extract tenant from request

// Helper function to get tenant-specific room information
const getTenantRooms = async (tenant?: string) => {
  try {
    const schema = await serverGetDocumentById(
      TableNames.TENANT_SCHEMA,
      tenant || DEFAULT_TENANT,
    );

    if (!schema || !schema.resources) {
      console.log("No schema or resources found for tenant:", tenant);
      return [];
    }

    // Apply environment-based calendar ID selection
    const resourcesWithCorrectCalendarIds = applyEnvironmentCalendarIds(
      schema.resources,
    );

    return resourcesWithCorrectCalendarIds.map((resource: any) => ({
      roomId: resource.roomId,
      name: resource.name,
      capacity: resource.capacity?.toString(),
      calendarId: resource.calendarId,
    }));
  } catch (error) {
    console.error("Error fetching tenant rooms:", error);
    return [];
  }
};

// Helper functions for tenant-specific logic
const getTenantFlags = (tenant: string) => ({
  isITP: tenant === "itp",
  isMediaCommons: isMediaCommons(tenant),
  usesXState: true,
});

const getXStateMachine = (tenant?: string) => {
  if (isMediaCommons(tenant)) return mcBookingMachine;
  if (tenant === "itp") return itpBookingMachine;
  return null;
};

function getUtcWindowForPeriod(now: Date, period: RequestLimitPeriod): { start: Date; end: Date } {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth(); // 0-11
  const d = now.getUTCDate();

  if (period === "perDay") {
    const start = new Date(Date.UTC(y, m, d, 0, 0, 0, 0));
    const end = new Date(Date.UTC(y, m, d + 1, 0, 0, 0, 0));
    return { start, end };
  }

  if (period === "perWeek") {
    // Week starts Monday (UTC)
    const dayOfWeek = now.getUTCDay(); // 0=Sun..6=Sat
    const daysSinceMonday = (dayOfWeek + 6) % 7; // Mon->0, Sun->6
    const start = new Date(Date.UTC(y, m, d - daysSinceMonday, 0, 0, 0, 0));
    const end = new Date(Date.UTC(y, m, d - daysSinceMonday + 7, 0, 0, 0, 0));
    return { start, end };
  }

  if (period === "perMonth") {
    const start = new Date(Date.UTC(y, m, 1, 0, 0, 0, 0));
    const end = new Date(Date.UTC(y, m + 1, 1, 0, 0, 0, 0));
    return { start, end };
  }

  // perSemester: 4-month windows starting in Jan (UTC): Jan–Apr, May–Aug, Sep–Dec
  const semesterStartMonth = Math.floor(m / 4) * 4;
  const start = new Date(Date.UTC(y, semesterStartMonth, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(y, semesterStartMonth + 4, 1, 0, 0, 0, 0));
  return { start, end };
}

function parseRoomIdsFromBooking(doc: any): number[] {
  if (Array.isArray(doc?.roomIds)) {
    return doc.roomIds
      .map((x: any) => Number(x))
      .filter((n: number) => Number.isFinite(n));
  }

  const raw = doc?.roomId;
  if (typeof raw === "string") {
    return raw
      .split(",")
      .map((s) => Number(String(s).trim()))
      .filter((n) => Number.isFinite(n));
  }

  return [];
}

async function enforceRequestLimits({
  tenant,
  email,
  role,
  selectedRoomIds,
}: {
  tenant: string;
  email: string;
  role: string;
  selectedRoomIds: number[];
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const schema = await serverGetDocumentById<SchemaContextType>(
    TableNames.TENANT_SCHEMA,
    tenant,
    tenant,
  );

  if (!schema?.resources || schema.resources.length === 0)
    return { ok: true } as const;

  const resourcesByRoomId = new Map<number, any>();
  for (const r of schema.resources) {
    if (typeof (r as any)?.roomId === "number") {
      resourcesByRoomId.set((r as any).roomId, r);
    }
  }

  const now = new Date();
  const periods: RequestLimitPeriod[] = [
    "perDay",
    "perWeek",
    "perMonth",
    "perSemester",
  ];

  // Only consider rooms that exist in schema (and dedupe)
  const uniqueSelectedRoomIds = Array.from(new Set(selectedRoomIds)).filter(
    (roomId) => resourcesByRoomId.has(roomId),
  );
  if (uniqueSelectedRoomIds.length === 0) return { ok: true } as const;

  // Determine which periods actually have a limit configured for this role for any selected room.
  const periodsToQuery = periods.filter((period) =>
    uniqueSelectedRoomIds.some((roomId) => {
      const resource = resourcesByRoomId.get(roomId);
      const limit = resource?.requestLimits?.[period]?.[role];
      return (
        typeof limit === "number" && Number.isFinite(limit) && limit >= 0
      );
    }),
  );
  if (periodsToQuery.length === 0) return { ok: true } as const;

  // Query once per relevant period, then aggregate counts per room in memory.
  const countsByPeriod: Partial<
    Record<RequestLimitPeriod, Map<number, number>>
  > = {};

  await Promise.all(
    periodsToQuery.map(async (period) => {
      const { start, end } = getUtcWindowForPeriod(now, period);
      const startTs = Timestamp.fromDate(start);
      const endTs = Timestamp.fromDate(end);

      const candidates = await serverFetchAllDataFromCollection<any>(
        TableNames.BOOKING,
        [
          { field: "email", operator: "==", value: email },
          { field: "role", operator: "==", value: role },
          { field: "requestedAt", operator: ">=", value: startTs },
          { field: "requestedAt", operator: "<", value: endTs },
          // Active-only: count bookings that are not canceled and not declined
          { field: "canceledAt", operator: "==", value: null },
          { field: "declinedAt", operator: "==", value: null },
        ],
        tenant,
      );

      const roomCounts = new Map<number, number>();
      for (const doc of candidates) {
        const roomIds = parseRoomIdsFromBooking(doc);
        for (const roomId of roomIds) {
          if (!resourcesByRoomId.has(roomId)) continue;
          roomCounts.set(roomId, (roomCounts.get(roomId) ?? 0) + 1);
        }
      }

      countsByPeriod[period] = roomCounts;
    }),
  );

  for (const roomId of uniqueSelectedRoomIds) {
    const resource = resourcesByRoomId.get(roomId);
    if (!resource) continue;

    for (const period of periodsToQuery) {
      const limit = resource.requestLimits?.[period]?.[role];
      if (limit == null) continue; // missing means unlimited
      if (typeof limit !== "number" || !Number.isFinite(limit) || limit < 0)
        continue;

      const count = countsByPeriod[period]?.get(roomId) ?? 0;
      if (count >= limit) {
        const resourceName = resource.name
          ? `"${resource.name}"`
          : `Room ${roomId}`;
        return {
          ok: false,
          message: `Request limit reached for ${resourceName} (${period}). Limit: ${limit}.`,
        } as const;
      }
    }
  }

  return { ok: true } as const;
}

// Helper to build booking contents object for calendar descriptions
const buildBookingContents = (
  data: any,
  selectedRoomIds: string[],
  startDateObj: Date,
  endDateObj: Date,
  status: BookingStatusLabel,
  requestNumber: number,
  origin?: string,
) =>
  ({
    ...data,
    roomId: selectedRoomIds,
    startDate: startDateObj.toLocaleDateString("en-US"),
    startTime: startDateObj.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }),
    endDate: endDateObj.toLocaleDateString("en-US"),
    endTime: endDateObj.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }),
    status,
    requestNumber,
    origin,
  }) as unknown as BookingFormDetails;

async function createBookingCalendarEvent(
  selectedRooms: RoomSetting[],
  _department: string,
  title: string,
  bookingCalendarInfo: DateSelectArg,
  description: string,
) {
  const [room, ...otherRooms] = selectedRooms;
  const { calendarId } = room;

  if (calendarId == null) {
    throw Error(`calendarId not found for room ${room.roomId}`);
  }

  const selectedRoomIds = selectedRooms.map(
    (r: { roomId: number }) => r.roomId,
  );
  const otherRoomEmails = otherRooms.map(
    (r: { calendarId: string }) => r.calendarId,
  );

  // Limit title to 25 characters
  const truncatedTitle =
    title.length > 25 ? `${title.substring(0, 25)}...` : title;

  const event = await insertEvent({
    calendarId,
    title: `[${BookingStatusLabel.REQUESTED}] ${selectedRoomIds.join(", ")} ${truncatedTitle}`,
    description,
    startTime: bookingCalendarInfo.startStr,
    endTime: bookingCalendarInfo.endStr,
    roomEmails: otherRoomEmails,
  });
  return event.id;
}

async function handleBookingApprovalEmails(
  isAutoApproval: boolean,
  calendarEventId: string,
  sequentialId: number,
  data: any,
  selectedRoomIds: string,
  bookingCalendarInfo: DateSelectArg,
  email: string,
  tenant?: string,
) {
  const shouldAutoApprove = isAutoApproval === true;

  console.log(
    `🔍 FIRST APPROVER EMAIL DEBUG [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
    {
      department: data.department,
      calendarEventId,
      sequentialId,
    },
  );

  const firstApprovers = await firstApproverEmails(data.department);

  console.log(
    `📧 FIRST APPROVERS RESULT [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
    {
      department: data.department,
      firstApprovers,
      firstApproversCount: firstApprovers.length,
    },
  );

  // Get tenant email configuration
  const emailConfig = await getTenantEmailConfig(tenant);

  const sendApprovalEmail = async (
    recipients: string[],
    contents: BookingFormDetails,
  ) => {
    console.log(
      `📧 SEND APPROVAL EMAIL FUNCTION [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
      {
        recipients,
        recipientsCount: recipients.length,
        calendarEventId,
        contentsTitle: contents.title,
        contentsRequestNumber: contents.requestNumber,
      },
    );

    const { equipmentCheckedOut, ...otherContents } = contents;
    const otherContentsStrings = Object.fromEntries(
      Object.entries(otherContents).map(([key, value]) => [
        key,
        value instanceof Timestamp ? value.toDate().toISOString() : value,
      ]),
    );

    // Format dates and times properly
    const startDate = new Date(bookingCalendarInfo?.startStr);
    const endDate = new Date(bookingCalendarInfo?.endStr);

    const emailPromises = recipients.map(recipient => {
      console.log(
        `📧 SENDING APPROVAL EMAIL TO [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
        {
          recipient,
          calendarEventId,
          eventTitle: contents.title,
          requestNumber: contents.requestNumber,
        },
      );

      // Use buildBookingContents for consistent Eastern Time formatting
      const formattedContents = buildBookingContents(
        otherContentsStrings,
        [selectedRoomIds],
        startDate,
        endDate,
        BookingStatusLabel.REQUESTED,
        contents.requestNumber ?? sequentialId,
      );

      // Convert all values to strings for sendHTMLEmail
      const contentsAsStrings = Object.fromEntries(
        Object.entries(formattedContents).map(([key, value]) => [
          key,
          value instanceof Timestamp
            ? value.toDate().toISOString()
            : String(value ?? ""),
        ]),
      );

      return sendHTMLEmail({
        templateName: "booking_detail",
        contents: {
          ...contentsAsStrings,
          requestNumber: `${contents.requestNumber}`,
          secondaryContactName: getSecondaryContactName(contents),
        },
        targetEmail: recipient,
        status: BookingStatusLabel.REQUESTED,
        eventTitle: contents.title,
        requestNumber: contents.requestNumber ?? sequentialId,
        body: "",
        approverType: ApproverType.LIAISON,
        replyTo: email,
        schemaName: emailConfig.schemaName,
        tenant,
      });
    });

    console.log(
      `📧 EXECUTING EMAIL PROMISES [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
      {
        emailPromisesCount: emailPromises.length,
        calendarEventId,
      },
    );

    await Promise.all(emailPromises);

    console.log(
      `✅ ALL APPROVAL EMAILS COMPLETED [${tenant?.toUpperCase()}]:`,
      {
        recipients,
        calendarEventId,
      },
    );
  };

  console.log("approval email calendarEventId", calendarEventId);

  if (calendarEventId && shouldAutoApprove) {
    console.log(
      `🎉 INSTANT APPROVAL [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
      {
        calendarEventId,
        email,
        tenant,
        message: "Booking will be auto-approved instantly",
      },
    );
    serverApproveInstantBooking(calendarEventId, email, tenant);
  } else {
    console.log(
      `📧 MANUAL APPROVAL REQUIRED [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
      {
        calendarEventId,
        email,
        tenant,
        reason: !calendarEventId
          ? "No calendar event ID"
          : "Auto-approval conditions not met",
        message: "Sending approval request emails",
      },
    );
    const userEventInputs: BookingFormDetails = {
      ...data,
      calendarEventId,
      roomId: selectedRoomIds,
      email,
      startDate: bookingCalendarInfo?.startStr,
      endDate: bookingCalendarInfo?.endStr,
      headerMessage: emailConfig.emailMessages.firstApprovalRequest,
      requestNumber: sequentialId,
      origin: formatOrigin(data.origin) ?? BookingOrigin.USER,
    };
    console.log("userEventInputs", userEventInputs);
    console.log(
      `📧 SENDING APPROVAL EMAILS [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
      {
        firstApprovers,
        firstApproversCount: firstApprovers.length,
        calendarEventId,
      },
    );

    if (firstApprovers.length > 0) {
      await sendApprovalEmail(firstApprovers, userEventInputs);
      console.log(
        `✅ APPROVAL EMAILS SENT SUCCESSFULLY [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
        {
          firstApprovers,
          calendarEventId,
        },
      );
    } else {
      console.warn(
        `⚠️ NO FIRST APPROVERS FOUND - SKIPPING APPROVAL EMAILS [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
        {
          department: data.department,
          calendarEventId,
        },
      );
    }
    // Send confirmation to requester as well (use confirmation/booking detail email)
    await serverSendBookingDetailEmail({
      calendarEventId,
      targetEmail: email,
      headerMessage: emailConfig.emailMessages.requestConfirmation,
      status: BookingStatusLabel.REQUESTED,
      replyTo: email,
      tenant,
    });
  }
}

async function checkOverlap(
  selectedRooms: RoomSetting[],
  bookingCalendarInfo: DateSelectArg,
  calendarEventId?: string,
) {
  const calendar = await getCalendarClient();

  // Check each selected room for overlaps
  for (const room of selectedRooms) {
    const events = await calendar.events.list({
      calendarId: room.calendarId,
      timeMin: bookingCalendarInfo.startStr,
      timeMax: bookingCalendarInfo.endStr,
      singleEvents: true,
    });

    const hasOverlap = events.data.items?.some(event => {
      // Skip the event being edited in case of modification
      if (
        calendarEventId &&
        (calendarEventId === event.id ||
          calendarEventId === event.id.split(":")[0])
      ) {
        console.log("calendarEventId", calendarEventId);
        console.log("event.id", event.id);
        return false;
      }

      // Skip events with CALENDAR_HIDE_STATUS
      const eventTitle = event.summary || "";
      if (CALENDAR_HIDE_STATUS.some(status => eventTitle.includes(status))) {
        return false;
      }

      const eventStart = new Date(event.start.dateTime || event.start.date);
      const eventEnd = new Date(event.end.dateTime || event.end.date);
      const requestStart = new Date(bookingCalendarInfo.startStr);
      const requestEnd = new Date(bookingCalendarInfo.endStr);
      // log the event that overlaps and then return
      if (
        (eventStart >= requestStart && eventStart < requestEnd) ||
        (eventEnd > requestStart && eventEnd <= requestEnd) ||
        (eventStart <= requestStart && eventEnd >= requestEnd)
      ) {
        console.log("event that overlaps", event);
      }
      return (
        (eventStart >= requestStart && eventStart < requestEnd) ||
        (eventEnd > requestStart && eventEnd <= requestEnd) ||
        (eventStart <= requestStart && eventEnd >= requestEnd)
      );
    });

    if (hasOverlap) return true;
  }

  return false;
}

export async function POST(request: NextRequest) {
  const { email, selectedRooms, bookingCalendarInfo, data, isAutoApproval } =
    await request.json();

  // Extract tenant from URL
  const tenant = extractTenantFromRequest(request);
  // Get tenant-specific flags
  const { isITP, isMediaCommons, usesXState } = getTenantFlags(tenant);

  // Get the correct department and school display values
  const { departmentDisplay, schoolDisplay } =
    getAffiliationDisplayValues(data);

  console.log(`🏢 BOOKING API [${tenant?.toUpperCase() || "UNKNOWN"}]:`, {
    tenant,
    tenantFlags: { isITP, isMediaCommons, usesXState },
    email,
    selectedRooms: selectedRooms?.map((r: any) => ({
      roomId: r.roomId,
      name: r.name,
      autoApproval: r.autoApproval,
    })),
    isAutoApproval,
    bookingDuration: bookingCalendarInfo
      ? `${((new Date(bookingCalendarInfo.endStr).getTime() - new Date(bookingCalendarInfo.startStr).getTime()) / (1000 * 60 * 60)).toFixed(1)} hours`
      : "Not set",
    formData: {
      title: data?.title,
      department: data?.department,
      departmentDisplay,
      otherDepartment: data?.otherDepartment,
      school: data?.school,
      schoolDisplay,
      otherSchool: data?.otherSchool,
      roomSetup: data?.roomSetup,
      mediaServices: data?.mediaServices,
      catering: data?.catering,
      hireSecurity: data?.hireSecurity,
    },
  });

  const hasOverlap = await checkOverlap(selectedRooms, bookingCalendarInfo);
  if (hasOverlap) {
    return NextResponse.json(
      { error: "Time slot no longer available" },
      { status: 409 },
    );
  }

  // Enforce per-resource request limits (per user email + role)
  try {
    const role = String(data?.role ?? "").trim();
    const selectedRoomIdsNums: number[] = Array.isArray(selectedRooms)
      ? selectedRooms
          .map((r: any) => Number(r?.roomId))
          .filter((n: number) => Number.isFinite(n))
      : [];

    if (tenant && email && role && selectedRoomIdsNums.length > 0) {
      const enforcement = await enforceRequestLimits({
        tenant,
        email,
        role,
        selectedRoomIds: selectedRoomIdsNums,
      });

      if (enforcement.ok === false) {
        return NextResponse.json(
          { error: enforcement.message },
          { status: 429 },
        );
      }
    }
  } catch (e: any) {
    console.error("Error enforcing request limits:", e);
    // Fail open to avoid blocking bookings if enforcement throws unexpectedly
  }

  console.log("data", data);

  // Determine initial status and auto-approval using XState for ITP
  const initialStatus = BookingStatusLabel.REQUESTED;
  let shouldAutoApprove = isAutoApproval === true;

  // Declare xstateData in outer scope
  let xstateData: any;

  // Use XState machine for ITP and Media Commons tenant auto-approval logic
  if (usesXState) {
    console.log(
      `🎭 USING XSTATE FOR ${tenant?.toUpperCase()} AUTO-APPROVAL LOGIC`,
    );
    console.log("🎭 XSTATE INPUT DATA:", {
      tenant,
      selectedRooms: selectedRooms?.map(r => ({
        roomId: r.roomId,
        name: r.name,
        shouldAutoApprove: r.shouldAutoApprove,
      })),
      formData: data,
      bookingCalendarInfo: {
        start: bookingCalendarInfo?.startStr,
        end: bookingCalendarInfo?.endStr,
        duration: bookingCalendarInfo
          ? `${((new Date(bookingCalendarInfo.endStr).getTime() - new Date(bookingCalendarInfo.startStr).getTime()) / (1000 * 60 * 60)).toFixed(1)} hours`
          : "Not set",
      },
      isWalkIn: false,
    });

    // Get the appropriate machine for the tenant
    const machine = getXStateMachine(tenant);

    // For Media Commons, detect service requests from booking data
    let servicesRequested = {};
    let isVip = false;

    if (isMediaCommons) {
      servicesRequested = getMediaCommonsServices(data);

      // Check if user is VIP (you can customize this logic)
      isVip = data.isVip || false;

      console.log("🎭 XSTATE MEDIA COMMONS: Detected services", {
        servicesRequested,
        isVip,
        formData: {
          setup: data.roomSetup,
          staff: data.staffingServicesDetails,
          equipment: data.equipmentServices,
          catering: data.catering,
          cleaning: data.cleaningService,
          security: data.hireSecurity,
        },
      });
    }

    // Create XState actor with booking context
    console.log("🎭 XSTATE: Creating actor...");
    const bookingActor = createActor(machine, {
      input: {
        tenant,
        selectedRooms,
        formData: data,
        bookingCalendarInfo,
        isWalkIn: false, // TODO: detect walk-in context
        email,
        calendarEventId: null, // Will be set after calendar event creation
        servicesRequested: isMediaCommons ? servicesRequested : undefined,
        isVip: isMediaCommons ? isVip : false,
        role: data.role, // Pass role from form data
      },
    });

    // Start the actor to trigger initial state evaluation
    console.log("🎭 XSTATE: Starting actor...");
    bookingActor.start();
    console.log("🎭 XSTATE: Actor started successfully");

    // Get the current state after initial evaluation
    const currentState = bookingActor.getSnapshot();

    console.log("🎭 XSTATE FINAL STATE RESULT:", {
      value: currentState.value,
      context: {
        tenant: currentState.context.tenant,
        selectedRoomsCount: currentState.context.selectedRooms?.length,
        hasFormData: !!currentState.context.formData,
        isWalkIn: currentState.context.isWalkIn,
      },
      canAutoApprove: currentState.value === "Approved",
      transitionPath: `Requested → ${currentState.value}`,
    });

    // Override shouldAutoApprove based on XState decision
    const xstateDecision = currentState.value === "Approved";
    console.log(
      `🎭 XSTATE DECISION: ${xstateDecision ? "AUTO-APPROVE" : "MANUAL-APPROVAL"}`,
    );
    shouldAutoApprove = xstateDecision;

    // Clean context by removing undefined values for Firestore compatibility
    const cleanContext = Object.fromEntries(
      Object.entries(currentState.context).filter(
        ([_, value]) => value !== undefined,
      ),
    );
    // Prepare XState state for persistence - use any type to avoid TypeScript issues with different machine event types
    const canTransitionTo: Record<string, boolean> = {};

    // Common transitions for both machines
    const commonEvents = [
      "approve",
      "decline",
      "cancel",
      "edit",
      "checkIn",
      "checkOut",
      "noShow",
      "autoCloseScript",
    ];
    commonEvents.forEach(event => {
      try {
        canTransitionTo[event] = currentState.can({ type: event as any });
      } catch (e) {
        canTransitionTo[event] = false;
      }
    });

    // Add tenant-specific events
    if (isMediaCommons) {
      const mcEvents = [
        "approveSetup",
        "approveStaff",
        "declineSetup",
        "declineStaff",
        "closeoutSetup",
        "closeoutStaff",
        "approveCatering",
        "approveCleaning",
        "approveSecurity",
        "declineCatering",
        "declineCleaning",
        "declineSecurity",
        "approveEquipment",
        "closeoutCatering",
        "closeoutCleaning",
        "closeoutSecurity",
        "declineEquipment",
        "closeoutEquipment",
      ];
      mcEvents.forEach(event => {
        try {
          canTransitionTo[event] = currentState.can({ type: event as any });
        } catch (e) {
          canTransitionTo[event] = false;
        }
      });
    } else {
      // ITP specific events
      try {
        canTransitionTo.close = currentState.can({ type: "close" as any });
      } catch (e) {
        canTransitionTo.close = false;
      }
    }

    // Get XState v5 persisted snapshot
    const persistedSnapshot = bookingActor.getPersistedSnapshot();
    const cleanSnapshot = cleanObjectForFirestore(persistedSnapshot);

    // Use the common function to create XState data
    xstateData = createXStateData(machine.id, cleanSnapshot);

    console.log("🎭 XSTATE: Preparing state for persistence:", {
      currentState: cleanSnapshot?.value,
      hasSnapshot: !!cleanSnapshot,
      snapshotKeys: cleanSnapshot ? Object.keys(cleanSnapshot) : [],
      machineId: xstateData.machineId,
    });

    // Stop the actor
    console.log("🎭 XSTATE: Stopping actor...");
    bookingActor.stop();
    console.log("🎭 XSTATE: Actor stopped");
  }

  console.log(
    `🤖 AUTO-APPROVAL DECISION [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
    {
      tenant,
      clientDecision: isAutoApproval,
      serverDecision: shouldAutoApprove,
      usingXState: usesXState,
      willAutoApprove: shouldAutoApprove
        ? "YES - Will auto-approve"
        : "NO - Requires manual approval",
    },
  );

  // Generate Sequential ID early so it can be used in calendar description
  const sequentialId = await serverGetNextSequentialId("bookings", tenant);

  const selectedRoomIds = selectedRooms
    .map((r: { roomId: number }) => r.roomId)
    .join(", ");
  const selectedRoomIdsArray = selectedRooms
    .map((r: { roomId: number }) => r.roomId)
    .filter((n: number) => Number.isFinite(n));

  // Build booking contents for description
  const startDateObj = new Date(bookingCalendarInfo.startStr);
  const endDateObj = new Date(bookingCalendarInfo.endStr);

  // Use display values for calendar description
  const dataWithDisplayValues = {
    ...data,
    department: departmentDisplay,
    school: schoolDisplay,
  };

  const bookingContentsForDesc = buildBookingContents(
    dataWithDisplayValues,
    selectedRoomIds,
    startDateObj,
    endDateObj,
    BookingStatusLabel.REQUESTED,
    sequentialId,
    BookingOrigin.USER,
  );

  const description =
    `${await bookingContentsToDescription(
      bookingContentsForDesc,
      tenant,
    )}<p>Your reservation is not yet confirmed. The coordinator will review and finalize your reservation within a few days.</p>` +
    '<p>To cancel reservations please return to the Booking Tool, visit My Bookings, and click "cancel" on the booking at least 24 hours before the date of the event. Failure to cancel an unused booking is considered a no-show and may result in restricted use of the space.</p>';

  let calendarEventId: string;
  try {
    calendarEventId = await createBookingCalendarEvent(
      selectedRooms,
      data.department,
      data.title,
      bookingCalendarInfo,
      description,
    );
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { result: "error", message: "ROOM CALENDAR ID NOT FOUND" },
      { status: 500 },
    );
  }

  console.log(" Done serverGetNextSequentialId ");
  console.log("calendarEventId", calendarEventId);

  let doc;
  try {
    const bookingData = {
      calendarEventId,
      roomId: selectedRoomIds,
      roomIds: selectedRoomIdsArray,
      email,
      startDate: toFirebaseTimestampFromString(bookingCalendarInfo.startStr),
      endDate: toFirebaseTimestampFromString(bookingCalendarInfo.endStr),
      requestNumber: sequentialId,
      equipmentCheckedOut: false,
      requestedAt: Timestamp.now(),
      origin: BookingOrigin.USER,
      tenant,
      ...data,
      // Override with display values for "Other" selections
      ...getOtherDisplayFields(data),
    };

    console.log("💾 Saving booking data to Firestore:", {
      calendarEventId,
      department: bookingData.department,
      departmentDisplay: bookingData.departmentDisplay,
      otherDepartment: bookingData.otherDepartment,
      school: bookingData.school,
      schoolDisplay: bookingData.schoolDisplay,
      otherSchool: bookingData.otherSchool,
    });

    // XState data will be saved separately after calendarEventId is available

    doc = await serverSaveDataToFirestore(
      TableNames.BOOKING,
      bookingData,
      tenant,
    );

    if (!doc || !doc.id) {
      throw new Error("Failed to create booking document");
    }

    // Create initial booking log entry with appropriate status
    await logServerBookingChange({
      bookingId: doc.id,
      status: initialStatus,
      changedBy: email,
      requestNumber: sequentialId,
      calendarEventId,
      note: "",
      tenant,
    });

    // Save XState data for ITP and Media Commons tenant after calendarEventId is available
    if (usesXState && typeof xstateData !== "undefined") {
      try {
        // Update the XState snapshot context with the actual calendarEventId
        const updatedXStateData = {
          ...xstateData,
          snapshot: {
            ...xstateData.snapshot,
            context: {
              ...xstateData.snapshot?.context,
              calendarEventId,
            },
          },
        };

        // Save XState data to the booking document
        await serverUpdateDataByCalendarEventId(
          TableNames.BOOKING,
          calendarEventId,
          { xstateData: updatedXStateData },
          tenant,
        );

        console.log(
          `💾 XSTATE DATA SAVED TO FIRESTORE [${tenant?.toUpperCase()}]:`,
          {
            calendarEventId,
            currentState: updatedXStateData.currentState,
            machineId: updatedXStateData.machineId,
            lastTransition: updatedXStateData.lastTransition,
            availableTransitions: Object.entries(
              updatedXStateData.canTransitionTo,
            )
              .filter(([_, canTransition]) => canTransition)
              .map(([event, _]) => event),
          },
        );
      } catch (error) {
        console.error(
          `🚨 ERROR SAVING XSTATE DATA [${tenant?.toUpperCase()}]:`,
          {
            calendarEventId,
            error: error.message,
          },
        );
        // Don't fail the entire booking if XState save fails
      }
    }

    if (
      isMediaCommons &&
      isServicesRequestState(xstateData?.snapshot?.value) &&
      tenant
    ) {
      try {
        await notifyServiceApproversForRequestedServices(calendarEventId, tenant);
      } catch (notificationError) {
        console.error(
          `🚨 SERVICE APPROVER NOTIFICATION FAILED [${tenant?.toUpperCase()}]:`,
          {
            calendarEventId,
            error:
              notificationError instanceof Error
                ? notificationError.message
                : String(notificationError),
          },
        );
      }
    }

    // Handle approval emails based on final status
    await handleBookingApprovalEmails(
      shouldAutoApprove,
      calendarEventId,
      sequentialId,
      data,
      selectedRoomIds,
      bookingCalendarInfo,
      email,
      tenant,
    );

    console.log(" Done handleBookingApprovalEmails");

    return NextResponse.json(
      { result: "success", calendarEventId },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error creating booking:", error);
    return NextResponse.json(
      { result: "error", message: "Failed to create booking" },
      { status: 500 },
    );
  }
}
