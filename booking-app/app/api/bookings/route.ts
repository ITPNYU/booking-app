import { toFirebaseTimestampFromString } from "@/components/src/client/utils/serverDate";
import {
  firstApproverEmails,
  serverApproveInstantBooking,
  serverSendBookingDetailEmail,
  serverUpdateDataByCalendarEventId,
} from "@/components/src/server/admin";
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
import {
  logServerBookingChange,
  serverGetNextSequentialId,
  serverSaveDataToFirestore,
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
import { serverGetDocumentById } from "@/lib/firebase/server/adminDb";
import { getCalendarClient } from "@/lib/googleClient";
import { Timestamp } from "firebase-admin/firestore";
import { DateSelectArg } from "fullcalendar";
import { extractTenantFromRequest } from "./shared";

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
  const { mcBookingMachine } = await import(
    "@/lib/stateMachines/mcBookingMachine"
  );
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

    return schema.resources.map((resource: any) => ({
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
const getTenantFlags = (tenant: string) => {
  return {
    isITP: tenant === "itp",
    isMediaCommons: isMediaCommons(tenant),
    usesXState: true,
  };
};

const getXStateMachine = (tenant?: string) => {
  if (isMediaCommons(tenant)) return mcBookingMachine;
  if (tenant === "itp") return itpBookingMachine;
  return null;
};

// Helper to build booking contents object for calendar descriptions
const buildBookingContents = (
  data: any,
  selectedRoomIds: string[],
  startDateObj: Date,
  endDateObj: Date,
  status: BookingStatusLabel,
  requestNumber: number,
  origin?: string,
) => {
  return {
    ...data,
    roomId: selectedRoomIds,
    startDate: startDateObj.toLocaleDateString(),
    startTime: startDateObj.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }),
    endDate: endDateObj.toLocaleDateString(),
    endTime: endDateObj.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }),
    status,
    requestNumber,
    origin,
  } as unknown as BookingFormDetails;
};

async function createBookingCalendarEvent(
  selectedRooms: RoomSetting[],
  _department: string,
  title: string,
  bookingCalendarInfo: DateSelectArg,
  description: string,
) {
  const [room, ...otherRooms] = selectedRooms;
  const calendarId = room.calendarId;

  if (calendarId == null) {
    throw Error("calendarId not found for room " + room.roomId);
  }

  const selectedRoomIds = selectedRooms.map(
    (r: { roomId: number }) => r.roomId,
  );
  const otherRoomEmails = otherRooms.map(
    (r: { calendarId: string }) => r.calendarId,
  );

  // Limit title to 25 characters
  const truncatedTitle =
    title.length > 25 ? title.substring(0, 25) + "..." : title;

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

      return sendHTMLEmail({
        templateName: "booking_detail",
        contents: {
          ...otherContentsStrings,
          roomId: selectedRoomIds,
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
          requestNumber: contents.requestNumber + "",
        },
        targetEmail: recipient,
        status: BookingStatusLabel.REQUESTED,
        eventTitle: contents.title,
        requestNumber: contents.requestNumber ?? sequentialId,
        body: "",
        approverType: ApproverType.LIAISON,
        replyTo: email,
        schemaName: emailConfig.schemaName,
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
      calendarEventId: calendarEventId,
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
      //log the event that overlaps and then return
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

  console.log(`🏢 BOOKING API [${tenant?.toUpperCase() || "UNKNOWN"}]:`, {
    tenant,
    tenantFlags: { isITP, isMediaCommons, usesXState },
    email,
    selectedRooms: selectedRooms?.map((r: any) => ({
      roomId: r.roomId,
      name: r.name,
      shouldAutoApprove: r.shouldAutoApprove,
    })),
    isAutoApproval,
    bookingDuration: bookingCalendarInfo
      ? `${((new Date(bookingCalendarInfo.endStr).getTime() - new Date(bookingCalendarInfo.startStr).getTime()) / (1000 * 60 * 60)).toFixed(1)} hours`
      : "Not set",
    formData: {
      title: data?.title,
      department: data?.department,
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

  console.log("data", data);

  // Determine initial status and auto-approval using XState for ITP
  const initialStatus = BookingStatusLabel.REQUESTED;
  let shouldAutoApprove = isAutoApproval === true;

  // Declare xstateData in outer scope
  let xstateData: any = undefined;

  // Use XState machine for ITP and Media Commons tenant auto-approval logic
  if (usesXState) {
    console.log(
      `🎭 USING XSTATE FOR ${tenant?.toUpperCase()} AUTO-APPROVAL LOGIC`,
    );
    console.log(`🎭 XSTATE INPUT DATA:`, {
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

      console.log(`🎭 XSTATE MEDIA COMMONS: Detected services`, {
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
    console.log(`🎭 XSTATE: Creating actor...`);
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
        role: data.role as any, // Pass role from form data
      },
    });

    // Start the actor to trigger initial state evaluation
    console.log(`🎭 XSTATE: Starting actor...`);
    bookingActor.start();
    console.log(`🎭 XSTATE: Actor started successfully`);

    // Get the current state after initial evaluation
    const currentState = bookingActor.getSnapshot();

    console.log(`🎭 XSTATE FINAL STATE RESULT:`, {
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
        canTransitionTo["close"] = currentState.can({ type: "close" as any });
      } catch (e) {
        canTransitionTo["close"] = false;
      }
    }

    // Get XState v5 persisted snapshot
    const persistedSnapshot = bookingActor.getPersistedSnapshot();
    const cleanSnapshot = cleanObjectForFirestore(persistedSnapshot);

    // Use the common function to create XState data
    xstateData = createXStateData(machine.id, cleanSnapshot);

    console.log(`🎭 XSTATE: Preparing state for persistence:`, {
      currentState: cleanSnapshot?.value,
      hasSnapshot: !!cleanSnapshot,
      snapshotKeys: cleanSnapshot ? Object.keys(cleanSnapshot) : [],
      machineId: xstateData.machineId,
    });

    // Stop the actor
    console.log(`🎭 XSTATE: Stopping actor...`);
    bookingActor.stop();
    console.log(`🎭 XSTATE: Actor stopped`);
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

  // Build booking contents for description
  const startDateObj = new Date(bookingCalendarInfo.startStr);
  const endDateObj = new Date(bookingCalendarInfo.endStr);

  const bookingContentsForDesc = buildBookingContents(
    data,
    selectedRoomIds,
    startDateObj,
    endDateObj,
    BookingStatusLabel.REQUESTED,
    sequentialId,
    BookingOrigin.USER,
  );

  const description =
    (await bookingContentsToDescription(bookingContentsForDesc, tenant)) +
    "<p>Your reservation is not yet confirmed. The coordinator will review and finalize your reservation within a few days.</p>" +
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
      email,
      startDate: toFirebaseTimestampFromString(bookingCalendarInfo.startStr),
      endDate: toFirebaseTimestampFromString(bookingCalendarInfo.endStr),
      requestNumber: sequentialId,
      equipmentCheckedOut: false,
      requestedAt: Timestamp.now(),
      origin: BookingOrigin.USER,
      ...data,
    };

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
      calendarEventId: calendarEventId,
      note: "",
      tenant,
    });

    // Save XState data for ITP and Media Commons tenant after calendarEventId is available
    if (usesXState && typeof xstateData !== "undefined") {
      try {
        // Update the XState context with the actual calendarEventId
        const updatedXStateData = {
          ...xstateData,
          context: {
            ...xstateData.context,
            calendarEventId: calendarEventId,
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
