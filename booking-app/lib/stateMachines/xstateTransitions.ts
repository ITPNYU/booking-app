import { DEFAULT_TENANT } from "@/components/src/constants/tenants";
import { TableNames } from "@/components/src/policy";
import { serverUpdateDataByCalendarEventId } from "@/components/src/server/admin";
import { BookingStatusLabel } from "@/components/src/types";
import {
  isMediaCommons,
  shouldUseXState,
} from "@/components/src/utils/tenantUtils";
import {
  serverGetDataByCalendarEventId,
} from "@/lib/firebase/server/adminDb";
import { BookingLogger } from "@/lib/logger/bookingLogger";
import * as admin from "firebase-admin";
import { getTenantEmailConfig } from "@/components/src/server/emails";
import { handleStateTransitions } from "./xstateEffects";
import {
  cleanObjectForFirestore,
  createXStateDataFromBookingStatus,
  getMachineForTenant,
  restoreXStateFromFirestore,
} from "./xstatePersistence";
import type { PersistedXStateData } from "./xstateTypes";

/**
 * Drain and execute a single side effect declared by a state entry action
 * (via `queueCancelProcessing` or similar assign). Keeps the machine pure
 * while still making state entry the trigger for real-world work.
 */
async function executeSideEffect(
  effect: string,
  ctx: { calendarEventId: string; tenant?: string; email?: string },
): Promise<void> {
  const { calendarEventId, tenant, email } = ctx;
  const netId = email && email.includes("@") ? email.split("@")[0] : "system";

  if (effect === "cancelProcessing") {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BASE_URL}/api/cancel-processing`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-tenant": tenant || DEFAULT_TENANT,
          },
          body: JSON.stringify({
            calendarEventId,
            email: email || "system",
            netId,
            tenant,
          }),
        },
      );
      if (!response.ok) {
        console.error(
          `🚨 SIDE EFFECT FAILED [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
          { effect, calendarEventId, status: response.status },
        );
      }
    } catch (error: any) {
      console.error(
        `🚨 SIDE EFFECT ERROR [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
        { effect, calendarEventId, error: error.message },
      );
    }
    return;
  }

  console.warn(
    `⚠️ UNKNOWN SIDE EFFECT [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
    { effect, calendarEventId },
  );
}

/**
 * Execute XState transition and save updated state to Firestore
 */
export async function executeXStateTransition(
  calendarEventId: string,
  eventType: string,
  tenant?: string,
  email?: string,
  reason?: string,
): Promise<{ success: boolean; newState?: string; error?: string }> {
  try {
    console.log(
      `🎬 EXECUTING XSTATE TRANSITION [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
      {
        calendarEventId,
        eventType,
        tenant,
      },
    );

    // Restore the actor from Firestore
    const actor = await restoreXStateFromFirestore(calendarEventId, tenant);
    if (!actor) {
      return {
        success: false,
        error: "Failed to restore XState actor from Firestore",
      };
    }

    // Start the actor
    actor.start();

    // Get current snapshot with error handling
    let currentSnapshot;
    try {
      currentSnapshot = actor.getSnapshot();
      console.log(
        `📸 CURRENT SNAPSHOT BEFORE TRANSITION [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
        {
          calendarEventId,
          currentState: currentSnapshot.value,
          hasContext: !!currentSnapshot.context,
          contextKeys: currentSnapshot.context
            ? Object.keys(currentSnapshot.context)
            : [],
          contextPreview: currentSnapshot.context
            ? {
                tenant: currentSnapshot.context.tenant,
                calendarEventId: currentSnapshot.context.calendarEventId,
                selectedRooms: Array.isArray(
                  currentSnapshot.context.selectedRooms,
                )
                  ? `Array(${currentSnapshot.context.selectedRooms.length})`
                  : currentSnapshot.context.selectedRooms || "undefined",
                servicesRequested: currentSnapshot.context.servicesRequested,
              }
            : null,
        },
      );
    } catch (error) {
      console.error(
        `🚨 ERROR GETTING CURRENT SNAPSHOT [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
        {
          calendarEventId,
          error: error.message,
        },
      );
      actor.stop();
      return {
        success: false,
        error: `Failed to get current snapshot: ${error.message}`,
      };
    }

    // Check if the transition is valid
    const canTransition = currentSnapshot.can({ type: eventType as any });

    if (!canTransition) {
      console.log(
        `🚫 INVALID XSTATE TRANSITION [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
        {
          currentState: currentSnapshot.value,
          attemptedEvent: eventType,
          availableEvents: [
            "approve",
            "decline",
            "cancel",
            "edit",
            "checkIn",
            "checkOut",
            "noShow",
            "close",
            "autoCloseScript",
          ].filter((event) => currentSnapshot.can({ type: event as any })),
        },
      );

      actor.stop();
      return {
        success: false,
        error: `Invalid transition: Cannot execute '${eventType}' from state '${currentSnapshot.value}'`,
      };
    }

    // Set up transition listener to capture all state changes
    const transitionStates: string[] = [];
    let unsubscribe: (() => void) | undefined;

    try {
      const subscription = actor.subscribe((snapshot) => {
        const state =
          typeof snapshot.value === "string"
            ? snapshot.value
            : JSON.stringify(snapshot.value);

        // Only track meaningful state changes (not initial state)
        if (transitionStates.length > 0 || state !== currentSnapshot.value) {
          transitionStates.push(state);
          console.log(
            `📝 XSTATE TRANSITION CAPTURED [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
            {
              calendarEventId,
              state,
              transitionIndex: transitionStates.length,
            },
          );
        }
      });

      // Handle different return types from subscribe
      if (typeof subscription === "function") {
        unsubscribe = subscription;
      } else if (
        subscription &&
        typeof subscription.unsubscribe === "function"
      ) {
        unsubscribe = () => subscription.unsubscribe();
      }

      // Execute the transition with reason and email if provided
      const event: any = { type: eventType as any };
      if (reason) {
        event.reason = reason;
      }
      if (email && eventType === "checkOut") {
        event.email = email;
      }
      actor.send(event);
    } catch (subscribeError) {
      console.error(
        `🚨 XSTATE SUBSCRIPTION ERROR [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
        {
          calendarEventId,
          error: subscribeError.message,
        },
      );
    } finally {
      // Unsubscribe if possible
      if (unsubscribe && typeof unsubscribe === "function") {
        try {
          unsubscribe();
        } catch (unsubError) {
          console.error(
            `🚨 XSTATE UNSUBSCRIBE ERROR [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
            {
              calendarEventId,
              error: unsubError.message,
            },
          );
        }
      }
    }
    const newSnapshot = actor.getSnapshot();

    BookingLogger.xstateTransition(
      String(currentSnapshot.value),
      String(newSnapshot.value),
      eventType,
      {
        calendarEventId,
        tenant,
        servicesRequested: newSnapshot.context?.servicesRequested,
        servicesApproved: newSnapshot.context?.servicesApproved,
      },
    );

    // Get updated persisted snapshot
    const updatedPersistedSnapshot = actor.getPersistedSnapshot();

    // Clean snapshot by removing undefined values for Firestore compatibility
    const cleanUpdatedSnapshot = cleanObjectForFirestore(
      updatedPersistedSnapshot,
    );

    // Create updated XState data
    const updatedXStateData: PersistedXStateData = {
      snapshot: cleanUpdatedSnapshot,
      machineId: getMachineForTenant(tenant).id,
      lastTransition: new Date().toISOString(),
    };

    // Prepare updates for Firestore
    const firestoreUpdates: any = { xstateData: updatedXStateData };

    // Special handling for noShow event - execute side effects immediately
    // This is needed because noShow triggers a chain of transitions (No Show -> Canceled -> Service Closeout)
    if (eventType === "noShow") {
      console.log(
        `🚫 NO SHOW EVENT DETECTED - EXECUTING NO SHOW SIDE EFFECTS [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
        {
          calendarEventId,
          eventType,
          previousState: currentSnapshot.value,
          finalState: newSnapshot.value,
        },
      );

      // Execute No Show side effects (emails, pre-ban logs, etc.)
      // Use server-side functions since this runs in XState server context
      try {
        // Import required modules first
        const { serverGetDataByCalendarEventId } =
          await import("@/lib/firebase/server/adminDb");
        const { TableNames } = await import("@/components/src/policy");

        // Get booking document first to extract netId
        const doc = await serverGetDataByCalendarEventId<any>(
          TableNames.BOOKING,
          calendarEventId,
          tenant,
        );

        if (!doc) {
          throw new Error("Booking not found");
        }

        // Get netId directly from booking document (not from XState context)
        const netId = doc.netId || "unknown";

        console.log(
          `🔄 EXECUTING NO SHOW SIDE EFFECTS [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
          {
            calendarEventId,
            email,
            netId,
          },
        );

        // Import server-side functions (doc already retrieved above)
        const { serverSaveDataToFirestore, serverFetchAllDataFromCollection } =
          await import("@/lib/firebase/server/adminDb");
        const { serverSendBookingDetailEmail } =
          await import("@/components/src/server/admin");
        const { getApprovalCcEmail } = await import("@/components/src/policy");
        const { BookingStatusLabel } = await import("@/components/src/types");

        // Check policy violation and add to pre-ban logs
        // Exclude VIP and walk-in bookings from policy violations
        const isPolicyViolation = (doc: any): boolean => {
          if (!doc || !doc.startDate || !doc.requestedAt) return false;

          // Exclude VIP bookings
          if (doc.isVip === true || doc.origin === "vip") return false;

          // Exclude walk-in bookings
          if (doc.walkedInAt || doc.origin === "walk-in") return false;

          return true;
        };

        console.log(
          `🔍 NO SHOW POLICY VIOLATION CHECK [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
          {
            calendarEventId,
            netId,
            isVip: doc.isVip,
            origin: doc.origin,
            walkedInAt: !!doc.walkedInAt,
            hasStartDate: !!doc.startDate,
            hasRequestedAt: !!doc.requestedAt,
            isPolicyViolation: isPolicyViolation(doc),
          },
        );

        if (isPolicyViolation(doc)) {
          const log = {
            netId,
            bookingId: calendarEventId,
            noShowDate: admin.firestore.Timestamp.now(),
          };
          await serverSaveDataToFirestore(TableNames.PRE_BAN_LOGS, log, tenant);

          console.log(
            `📋 NO SHOW PRE-BAN LOG CREATED [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
            {
              calendarEventId,
              netId,
              bookingId: calendarEventId,
            },
          );
        } else {
          console.log(
            `⏭️ NO SHOW PRE-BAN LOG SKIPPED [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
            {
              calendarEventId,
              netId,
              reason: "Not a policy violation (VIP or walk-in booking)",
            },
          );
        }

        // Get violation count
        const preBanLogs = await serverFetchAllDataFromCollection<any>(
          TableNames.PRE_BAN_LOGS,
          [{ field: "netId", operator: "==", value: netId }],
          tenant,
        );
        const violationCount = preBanLogs.filter(
          (log: any) => log?.excused !== true,
        ).length;

        const guestEmail = doc.email;
        const emailConfig = await getTenantEmailConfig(tenant);
        const headerMessage = emailConfig.emailMessages.noShow.replace(
          "${violationCount}",
          violationCount.toString(),
        );

        // Send emails using server-side function
        await serverSendBookingDetailEmail({
          calendarEventId,
          targetEmail: guestEmail,
          headerMessage,
          status: BookingStatusLabel.NO_SHOW,
          tenant,
        });

        // Send CC to admin
        const noShowCcEmail = await getApprovalCcEmail(process.env.NEXT_PUBLIC_BRANCH_NAME, tenant);
        if (noShowCcEmail) {
          await serverSendBookingDetailEmail({
            calendarEventId,
            targetEmail: noShowCcEmail,
            headerMessage,
            status: BookingStatusLabel.NO_SHOW,
            tenant,
          });
        }

        // Update calendar event status
        try {
          const calendarUpdateResponse = await fetch(
            `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/calendarEvents`,
            {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
                "x-tenant": tenant || DEFAULT_TENANT,
              },
              body: JSON.stringify({
                calendarEventId,
                newValues: {
                  statusPrefix: BookingStatusLabel.NO_SHOW,
                },
              }),
            },
          );

          if (calendarUpdateResponse.ok) {
            console.log(
              `📅 NO SHOW CALENDAR UPDATED [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
              {
                calendarEventId,
                statusPrefix: BookingStatusLabel.NO_SHOW,
              },
            );
          } else {
            console.error(
              `🚨 NO SHOW CALENDAR UPDATE FAILED [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
              {
                calendarEventId,
                status: calendarUpdateResponse.status,
                statusText: calendarUpdateResponse.statusText,
              },
            );
          }
        } catch (calendarError) {
          console.error(
            `🚨 NO SHOW CALENDAR UPDATE ERROR [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
            {
              calendarEventId,
              error:
                calendarError instanceof Error
                  ? calendarError.message
                  : String(calendarError),
            },
          );
        }

        console.log(
          `✅ NO SHOW SIDE EFFECTS COMPLETED [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
          {
            calendarEventId,
            guestEmail,
            violationCount,
          },
        );
      } catch (error) {
        console.error(
          `🚨 NO SHOW SIDE EFFECTS FAILED [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
          {
            calendarEventId,
            email,
            tenant,
            error: error.message,
          },
        );
      }

      // Set noShow timestamp for Firestore
      firestoreUpdates.noShowedAt = admin.firestore.Timestamp.now();
      if (email) {
        firestoreUpdates.noShowedBy = email;
      }

      // Note: History logging is now handled by traditional functions only
      // XState only manages state transitions, not history logging
    }

    // Handle state transitions with unified history logging
    // Skip Service Closeout calendar updates if this was triggered by noShow event
    // because No Show processing already handled calendar updates
    await handleStateTransitions(
      currentSnapshot,
      newSnapshot,
      calendarEventId,
      email,
      tenant,
      firestoreUpdates,
      actor, // Pass actor instance
      eventType === "noShow", // Pass noShow flag to skip calendar updates for Service Closeout
      false, // isXStateCreation - false for normal transitions
      reason, // Pass reason for decline actions
    );

    // For No Show events, do not send canceled email as NO SHOW email was already sent
    // Note: NO SHOW email contains the appropriate message for the user
    // Sending a CANCELED email would be redundant and confusing
    if (eventType === "noShow") {
      console.log(
        `🚫 CANCELED EMAIL SKIPPED FOR NO SHOW [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
        {
          calendarEventId,
          note: "NO SHOW email already sent with appropriate message",
        },
      );
    }

    // If this is Media Commons and servicesApproved context changed, update individual service fields
    if (isMediaCommons(tenant) && newSnapshot.context?.servicesApproved) {
      const { servicesApproved } = newSnapshot.context;

      // Map XState context to individual Firestore fields
      if (typeof servicesApproved.staff === "boolean") {
        firestoreUpdates.staffServiceApproved = servicesApproved.staff;
      }
      if (typeof servicesApproved.equipment === "boolean") {
        firestoreUpdates.equipmentServiceApproved = servicesApproved.equipment;
      }
      if (typeof servicesApproved.catering === "boolean") {
        firestoreUpdates.cateringServiceApproved = servicesApproved.catering;
      }
      if (typeof servicesApproved.cleaning === "boolean") {
        firestoreUpdates.cleaningServiceApproved = servicesApproved.cleaning;
      }
      if (typeof servicesApproved.security === "boolean") {
        firestoreUpdates.securityServiceApproved = servicesApproved.security;
      }
      if (typeof servicesApproved.setup === "boolean") {
        firestoreUpdates.setupServiceApproved = servicesApproved.setup;
      }

      console.log(
        `🔄 UPDATING INDIVIDUAL SERVICE FIELDS [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
        {
          calendarEventId,
          serviceUpdates: {
            staffServiceApproved: firestoreUpdates.staffServiceApproved,
            equipmentServiceApproved: firestoreUpdates.equipmentServiceApproved,
            cateringServiceApproved: firestoreUpdates.cateringServiceApproved,
            cleaningServiceApproved: firestoreUpdates.cleaningServiceApproved,
            securityServiceApproved: firestoreUpdates.securityServiceApproved,
            setupServiceApproved: firestoreUpdates.setupServiceApproved,
          },
        },
      );
    }

    // Drain side effects queued by state entry actions (see `queueCancelProcessing`
     // etc. in machine definitions). Runs after handleStateTransitions so any
    // firestoreUpdates they rely on are in the same save, and BEFORE persisting
    // the snapshot so we can clear the queue — otherwise a restore would re-fire.
    const pendingEffects = (newSnapshot.context as any)?.pendingSideEffects ?? [];
    for (const effect of pendingEffects) {
      await executeSideEffect(effect, { calendarEventId, tenant, email });
    }
    if (pendingEffects.length > 0 && firestoreUpdates.xstateData?.snapshot?.context) {
      (firestoreUpdates.xstateData.snapshot.context as any).pendingSideEffects = [];
    }

    // Save updated state to Firestore
    console.log(
      `🔍 FIRESTORE UPDATE DEBUG [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
      {
        calendarEventId,
        firestoreUpdatesKeys: Object.keys(firestoreUpdates),
        hasXStateData: !!firestoreUpdates.xstateData,
        xstateDataPreview: firestoreUpdates.xstateData
          ? {
              machineId: firestoreUpdates.xstateData.machineId,
              hasSnapshot: !!firestoreUpdates.xstateData.snapshot,
              lastTransition: firestoreUpdates.xstateData.lastTransition,
            }
          : null,
      },
    );

    await serverUpdateDataByCalendarEventId(
      TableNames.BOOKING,
      calendarEventId,
      firestoreUpdates,
      tenant,
    );

    console.log(
      `💾 XSTATE STATE UPDATED IN FIRESTORE [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
      {
        calendarEventId,
        newState: newSnapshot.value,
        machineId: updatedXStateData.machineId,
        savedSnapshot: {
          hasContext: !!cleanUpdatedSnapshot.context,
          contextServicesApproved:
            cleanUpdatedSnapshot.context?.servicesApproved,
        },
        individualServiceFieldsUpdated:
          isMediaCommons(tenant) && newSnapshot.context?.servicesApproved
            ? Object.keys(firestoreUpdates).filter((key) =>
                key.endsWith("ServiceApproved"),
              )
            : [],
      },
    );

    actor.stop();

    return {
      success: true,
      newState: newSnapshot.value as string,
    };
  } catch (error) {
    console.error(
      `🚨 XSTATE TRANSITION ERROR [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
      {
        calendarEventId,
        eventType,
        error: error.message,
      },
    );
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Get available XState transitions for a booking
 */
export async function getAvailableXStateTransitions(
  calendarEventId: string,
  tenant?: string,
): Promise<string[]> {
  try {
    const bookingData = await serverGetDataByCalendarEventId(
      TableNames.BOOKING,
      calendarEventId,
      tenant,
    );

    if (
      !bookingData ||
      !("xstateData" in bookingData) ||
      !bookingData.xstateData
    ) {
      // If we have booking data but no XState data, create XState from booking status
      if (bookingData && shouldUseXState(tenant)) {
        console.log(
          `🔧 CREATING XSTATE FOR TRANSITIONS [${tenant?.toUpperCase()}]:`,
          { calendarEventId },
        );

        await createXStateDataFromBookingStatus(
          calendarEventId,
          bookingData,
          tenant,
        );

        // Recursively call this function to get transitions from newly created XState
        return getAvailableXStateTransitions(calendarEventId, tenant);
      }

      return [];
    }

    const actor = await restoreXStateFromFirestore(calendarEventId, tenant);
    if (!actor) {
      return [];
    }

    actor.start();
    const snapshot = actor.getSnapshot();

    const availableTransitions = [
      "approve",
      "decline",
      "cancel",
      "edit",
      "checkIn",
      "checkOut",
      "noShow",
      "close",
      "autoCloseScript",
    ].filter((transition) => snapshot.can({ type: transition as any }));

    actor.stop();

    console.log(
      `📋 AVAILABLE XSTATE TRANSITIONS [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
      {
        calendarEventId,
        currentState: snapshot.value,
        availableTransitions,
      },
    );

    return availableTransitions;
  } catch (error) {
    console.error(
      `🚨 ERROR GETTING AVAILABLE TRANSITIONS [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
      {
        calendarEventId,
        error: error.message,
      },
    );
    return [];
  }
}
