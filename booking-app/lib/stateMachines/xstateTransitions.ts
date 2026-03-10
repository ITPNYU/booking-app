import { TableNames, getApprovalCcEmail } from "@/components/src/policy";
import {
  serverSendBookingDetailEmail,
  serverUpdateDataByCalendarEventId,
} from "@/components/src/server/admin";
import { getTenantEmailConfig } from "@/components/src/server/emails";
import { BookingStatusLabel } from "@/components/src/types";
import {
  isMediaCommons,
  shouldUseXState,
} from "@/components/src/utils/tenantUtils";
import {
  serverFetchAllDataFromCollection,
  serverGetDataByCalendarEventId,
  serverSaveDataToFirestore,
} from "@/lib/firebase/server/adminDb";
import { BookingLogger } from "@/lib/logger/bookingLogger";
import * as admin from "firebase-admin";
import { handleStateTransitions } from "./xstateEffects";
import {
  PersistedXStateData,
  cleanObjectForFirestore,
  createXStateDataFromBookingStatus,
  getMachineForTenant,
  restoreXStateFromFirestore,
} from "./xstatePersistence";

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
      `[XState] executing transition [${tenant?.toUpperCase() || "UNKNOWN"}]`,
      { calendarEventId, eventType },
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
    } catch (error) {
      console.error(
        `[XState] failed to get snapshot [${tenant?.toUpperCase() || "UNKNOWN"}]`,
        { calendarEventId, error: error.message },
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
      console.warn(
        `[XState] invalid transition [${tenant?.toUpperCase() || "UNKNOWN"}]`,
        {
          currentState: currentSnapshot.value,
          attemptedEvent: eventType,
          availableEvents: [
            "approve", "decline", "cancel", "edit",
            "checkIn", "checkOut", "noShow", "close", "autoCloseScript",
          ].filter((event) => currentSnapshot.can({ type: event as any })),
        },
      );

      actor.stop();
      return {
        success: false,
        error: `Invalid transition: Cannot execute '${eventType}' from state '${currentSnapshot.value}'`,
      };
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
      // Execute No Show side effects (emails, pre-ban logs, etc.)
      try {
        const doc = await serverGetDataByCalendarEventId<any>(
          TableNames.BOOKING,
          calendarEventId,
          tenant,
        );

        if (!doc) {
          throw new Error("Booking not found");
        }

        const netId = doc.netId || "unknown";

        // Check policy violation and add to pre-ban logs
        const isPolicyViolation = (doc: any): boolean => {
          if (!doc || !doc.startDate || !doc.requestedAt) return false;
          if (doc.isVip === true || doc.origin === "vip") return false;
          if (doc.walkedInAt || doc.origin === "walk-in") return false;
          return true;
        };

        if (isPolicyViolation(doc)) {
          const log = {
            netId,
            bookingId: calendarEventId,
            noShowDate: admin.firestore.Timestamp.now(),
          };
          await serverSaveDataToFirestore(TableNames.PRE_BAN_LOGS, log, tenant);
        }

        // Get violation count
        const preBanLogs = await serverFetchAllDataFromCollection<any>(
          TableNames.PRE_BAN_LOGS,
          [{ field: "netId", operator: "==", value: netId }],
          tenant,
        );
        const violationCount = preBanLogs.length;

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
        await serverSendBookingDetailEmail({
          calendarEventId,
          targetEmail: getApprovalCcEmail(process.env.NEXT_PUBLIC_BRANCH_NAME),
          headerMessage,
          status: BookingStatusLabel.NO_SHOW,
          tenant,
        });

        // Update calendar event status
        try {
          const calendarUpdateResponse = await fetch(
            `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/calendarEvents`,
            {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
                "x-tenant": tenant || "mc",
              },
              body: JSON.stringify({
                calendarEventId,
                newValues: {
                  statusPrefix: BookingStatusLabel.NO_SHOW,
                },
              }),
            },
          );

          if (!calendarUpdateResponse.ok) {
            console.error(
              `[XState] no-show calendar update failed [${tenant?.toUpperCase() || "UNKNOWN"}]`,
              { calendarEventId, status: calendarUpdateResponse.status },
            );
          }
        } catch (calendarError) {
          console.error(
            `[XState] no-show calendar update error [${tenant?.toUpperCase() || "UNKNOWN"}]`,
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
          `[XState] no-show side effects completed [${tenant?.toUpperCase() || "UNKNOWN"}]`,
          { calendarEventId, violationCount },
        );
      } catch (error) {
        console.error(
          `[XState] no-show side effects failed [${tenant?.toUpperCase() || "UNKNOWN"}]`,
          { calendarEventId, error: error.message },
        );
      }

      // Set noShow timestamp for Firestore
      firestoreUpdates.noShowedAt = admin.firestore.Timestamp.now();
      if (email) {
        firestoreUpdates.noShowedBy = email;
      }
    }

    // Handle state transitions with unified history logging
    await handleStateTransitions(
      currentSnapshot,
      newSnapshot,
      calendarEventId,
      email,
      tenant,
      firestoreUpdates,
      actor,
      reason,
    );

    // If this is Media Commons and servicesApproved context changed, update individual service fields
    if (isMediaCommons(tenant) && newSnapshot.context?.servicesApproved) {
      const { servicesApproved } = newSnapshot.context;

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
    }

    // Save updated state to Firestore
    await serverUpdateDataByCalendarEventId(
      TableNames.BOOKING,
      calendarEventId,
      firestoreUpdates,
      tenant,
    );

    console.log(
      `[XState] saved to Firestore [${tenant?.toUpperCase() || "UNKNOWN"}]`,
      { calendarEventId, newState: newSnapshot.value },
    );

    actor.stop();

    return {
      success: true,
      newState: newSnapshot.value as string,
    };
  } catch (error) {
    console.error(
      `[XState] transition error [${tenant?.toUpperCase() || "UNKNOWN"}]`,
      { calendarEventId, eventType, error: error.message },
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
      if (bookingData && shouldUseXState(tenant)) {
        await createXStateDataFromBookingStatus(
          calendarEventId,
          bookingData,
          tenant,
        );

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

    return availableTransitions;
  } catch (error) {
    console.error(
      `[XState] error getting available transitions [${tenant?.toUpperCase() || "UNKNOWN"}]`,
      { calendarEventId, error: error.message },
    );
    return [];
  }
}
