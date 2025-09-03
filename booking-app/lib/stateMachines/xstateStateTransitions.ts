import { BookingStatusLabel } from "@/components/src/types";
import {
  updateCalendarForApproved,
  updateCalendarForCanceled,
  updateCalendarForCheckedIn,
  updateCalendarForCheckedOut,
  updateCalendarForClosed,
  updateCalendarForDecline,
  updateCalendarForPreApproved,
} from "./xstateCalendarUpdates";
import { logBookingStatusChange } from "./xstateHistoryLogging";

/**
 * Unified state transition handler with history logging
 */
export async function handleStateTransitions(
  currentSnapshot: any,
  newSnapshot: any,
  calendarEventId: string,
  email: string,
  tenant: string,
  firestoreUpdates: any,
  skipCalendarForServiceCloseout = false,
  isXStateCreation = false // New parameter
) {
  const currentState = currentSnapshot.value;
  const newState = newSnapshot.value;

  console.log(
    `🔄 XSTATE STATE TRANSITION DETECTED [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
    {
      calendarEventId,
      previousState: currentState,
      newState,
      email,
    }
  );

  // Get booking data from Firestore (not from XState context)
  let bookingDoc: any = null;
  try {
    const { serverGetDataByCalendarEventId } = await import(
      "@/lib/firebase/server/adminDb"
    );
    const { TableNames } = await import("@/components/src/policy");
    bookingDoc = await serverGetDataByCalendarEventId<any>(
      TableNames.BOOKING,
      calendarEventId,
      tenant
    );
  } catch (error) {
    console.error(
      `❌ FAILED TO GET BOOKING DATA FOR STATE TRANSITION [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
      { calendarEventId, error }
    );
  }

  // Use bookingDoc.email for sending emails
  const guestEmail = bookingDoc?.email;

  let statusLabel: BookingStatusLabel | null = null;

  // Handle specific state transitions
  if (newState === "Declined") {
    statusLabel = BookingStatusLabel.DECLINED;
    console.log(
      `📥 XSTATE REACHED DECLINED [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
      {
        calendarEventId,
        previousState: currentState,
        newState,
        declinedAt: new Date().toISOString(),
        declinedBy: email,
      }
    );

    // Update Firestore with declined timestamp
    const { serverUpdateDataByCalendarEventId } = await import(
      "@/components/src/server/admin"
    );
    const { TableNames } = await import("@/components/src/policy");
    await serverUpdateDataByCalendarEventId(
      TableNames.BOOKING,
      calendarEventId,
      {
        declinedAt: new Date(),
        declinedBy: email,
      },
      tenant
    );

    // Update calendar event
    await updateCalendarForDecline(calendarEventId, tenant);

    // Send decline email
    if (guestEmail) {
      try {
        const { serverSendBookingDetailEmail } = await import(
          "@/lib/firebase/server/adminDb"
        );
        await serverSendBookingDetailEmail(guestEmail, calendarEventId, tenant);
        console.log(
          `📧 XSTATE DECLINE EMAIL SENT [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
          { calendarEventId, guestEmail }
        );
      } catch (error) {
        console.error(
          `❌ XSTATE DECLINE EMAIL ERROR [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
          { calendarEventId, guestEmail, error }
        );
      }
    }
  } else if (newState["Service Closeout"]) {
    statusLabel = BookingStatusLabel.CLOSED;
    console.log(
      `📥 XSTATE REACHED SERVICE CLOSEOUT [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
      {
        calendarEventId,
        previousState: currentState,
        newState,
        closedAt: new Date().toISOString(),
        closedBy: email,
      }
    );

    // Update Firestore with closed timestamp
    const { serverUpdateDataByCalendarEventId } = await import(
      "@/components/src/server/admin"
    );
    const { TableNames } = await import("@/components/src/policy");
    await serverUpdateDataByCalendarEventId(
      TableNames.BOOKING,
      calendarEventId,
      {
        closedAt: new Date(),
        closedBy: email,
      },
      tenant
    );

    // Update calendar event
    if (skipCalendarForServiceCloseout) {
      statusLabel = null; // Prevent generic history logging too
    } else {
      await updateCalendarForClosed(calendarEventId, tenant);
    }
  } else if (newState === "Canceled") {
    statusLabel = BookingStatusLabel.CANCELED;
    console.log(
      `📥 XSTATE REACHED CANCELED [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
      {
        calendarEventId,
        previousState: currentState,
        newState,
        canceledAt: new Date().toISOString(),
        canceledBy: email,
      }
    );

    // Update Firestore with canceled timestamp
    const { serverUpdateDataByCalendarEventId } = await import(
      "@/components/src/server/admin"
    );
    const { TableNames } = await import("@/components/src/policy");
    await serverUpdateDataByCalendarEventId(
      TableNames.BOOKING,
      calendarEventId,
      {
        canceledAt: new Date(),
        canceledBy: email,
      },
      tenant
    );

    // Update calendar event
    await updateCalendarForCanceled(calendarEventId, tenant);

    // Send cancel email
    if (guestEmail) {
      try {
        const { serverSendBookingDetailEmail } = await import(
          "@/lib/firebase/server/adminDb"
        );
        await serverSendBookingDetailEmail(guestEmail, calendarEventId, tenant);
        console.log(
          `📧 XSTATE CANCEL EMAIL SENT [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
          { calendarEventId, guestEmail }
        );
      } catch (error) {
        console.error(
          `❌ XSTATE CANCEL EMAIL ERROR [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
          { calendarEventId, guestEmail, error }
        );
      }
    }
  } else if (newState === "Checked In") {
    statusLabel = BookingStatusLabel.CHECKED_IN;
    console.log(
      `📥 XSTATE REACHED CHECKED IN [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
      {
        calendarEventId,
        previousState: currentState,
        newState,
        checkedInAt: new Date().toISOString(),
        checkedInBy: email,
      }
    );

    // Update Firestore with check-in timestamp
    firestoreUpdates.checkedInAt = new Date();
    firestoreUpdates.checkedInBy = email;

    // Update calendar event
    await updateCalendarForCheckedIn(calendarEventId, tenant);

    // Send check-in email
    if (guestEmail) {
      try {
        const { serverSendBookingDetailEmail } = await import(
          "@/lib/firebase/server/adminDb"
        );
        await serverSendBookingDetailEmail(guestEmail, calendarEventId, tenant);
        console.log(
          `📧 XSTATE CHECK-IN EMAIL SENT [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
          { calendarEventId, guestEmail }
        );
      } catch (error) {
        console.error(
          `❌ XSTATE CHECK-IN EMAIL ERROR [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
          { calendarEventId, guestEmail, error }
        );
      }
    }
  } else if (newState === "Checked Out") {
    statusLabel = BookingStatusLabel.CHECKED_OUT;
    console.log(
      `📥 XSTATE REACHED CHECKED OUT [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
      {
        calendarEventId,
        previousState: currentState,
        newState,
        checkedOutAt: new Date().toISOString(),
        checkedOutBy: email,
      }
    );

    // Update Firestore with check-out timestamp
    firestoreUpdates.checkedOutAt = new Date();
    firestoreUpdates.checkedOutBy = email;

    // Update calendar event with end time
    const endTime = new Date().toISOString();
    await updateCalendarForCheckedOut(calendarEventId, endTime, tenant);

    // Send check-out email
    if (guestEmail) {
      try {
        const { serverSendBookingDetailEmail } = await import(
          "@/lib/firebase/server/adminDb"
        );
        await serverSendBookingDetailEmail(guestEmail, calendarEventId, tenant);
        console.log(
          `📧 XSTATE CHECK-OUT EMAIL SENT [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
          { calendarEventId, guestEmail }
        );
      } catch (error) {
        console.error(
          `❌ XSTATE CHECK-OUT EMAIL ERROR [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
          { calendarEventId, guestEmail, error }
        );
      }
    }
  } else if (newState === "Approved") {
    statusLabel = BookingStatusLabel.APPROVED;
    console.log(
      `📥 XSTATE REACHED APPROVED [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
      {
        calendarEventId,
        previousState: currentState,
        newState,
        finalApprovedAt: new Date().toISOString(),
        finalApprovedBy: email,
      }
    );

    // Update Firestore with final approval timestamp
    firestoreUpdates.finalApprovedAt = new Date();
    firestoreUpdates.finalApprovedBy = email;

    // Update calendar event
    await updateCalendarForApproved(calendarEventId, tenant);

    // Send approval email
    if (guestEmail) {
      try {
        const { serverSendBookingDetailEmail } = await import(
          "@/lib/firebase/server/adminDb"
        );
        await serverSendBookingDetailEmail(guestEmail, calendarEventId, tenant);
        console.log(
          `📧 XSTATE APPROVAL EMAIL SENT [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
          { calendarEventId, guestEmail }
        );
      } catch (error) {
        console.error(
          `❌ XSTATE APPROVAL EMAIL ERROR [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
          { calendarEventId, guestEmail, error }
        );
      }
    }
  } else if (newState === "Pre-approved") {
    statusLabel = BookingStatusLabel.PRE_APPROVED;
    console.log(
      `📥 XSTATE REACHED PRE-APPROVED [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
      {
        calendarEventId,
        previousState: currentState,
        newState,
        firstApprovedAt: new Date().toISOString(),
        firstApprovedBy: email,
      }
    );

    // Update Firestore with first approval timestamp
    firestoreUpdates.firstApprovedAt = new Date();
    firestoreUpdates.firstApprovedBy = email;

    // Update calendar event
    await updateCalendarForPreApproved(calendarEventId, tenant);
  }

  // Only log generic state changes if this is not XState creation
  if (statusLabel && !isXStateCreation) {
    await logBookingStatusChange(
      calendarEventId,
      statusLabel,
      email,
      tenant,
      `XState transition to ${statusLabel}`
    );
  } else if (statusLabel && isXStateCreation) {
    console.log(`⏭️ SKIPPING HISTORY LOG FOR XSTATE CREATION`);
  }
}
