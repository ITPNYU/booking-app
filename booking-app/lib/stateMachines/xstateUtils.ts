import { TableNames } from "@/components/src/policy";
import { serverGetDataByCalendarEventId } from "@/lib/firebase/server/adminDb";
import { ActorRefFrom, createActor } from "xstate";
import { itpBookingMachine } from "./itpBookingMachine";
import { BookingStatusLabel } from "@/components/src/types";

// Type for persisted XState data
export interface PersistedXStateData {
  currentState: string;
  context: any;
  machineId: string;
  lastTransition: string;
  canTransitionTo: Record<string, boolean>;
}

/**
 * Map booking status to XState state
 */
function mapBookingStatusToXState(status: string): string {
  switch (status) {
    case BookingStatusLabel.REQUESTED:
      return "Requested";
    case BookingStatusLabel.APPROVED:
      return "Approved";
    case BookingStatusLabel.DECLINED:
      return "Declined";
    case BookingStatusLabel.CANCELED:
      return "Canceled";
    case BookingStatusLabel.CHECKED_IN:
      return "Checked In";
    case BookingStatusLabel.CHECKED_OUT:
      return "Checked Out";
    case BookingStatusLabel.NO_SHOW:
      return "No Show";
    default:
      console.warn(`Unknown booking status: ${status}, defaulting to Requested`);
      return "Requested";
  }
}

/**
 * Create XState data from existing booking data when XState is not present
 */
async function createXStateFromBookingStatus(
  bookingData: any,
  calendarEventId: string,
  tenant?: string
): Promise<PersistedXStateData> {
  const status = (bookingData as any).status || BookingStatusLabel.REQUESTED;
  const xstateState = mapBookingStatusToXState(status);

  console.log(
    `🔄 CREATING XSTATE FROM BOOKING STATUS [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
    {
      calendarEventId,
      bookingStatus: status,
      mappedXStateState: xstateState,
    }
  );

  // Create a temporary actor to get the correct context and transitions
  const tempActor = createActor(itpBookingMachine, {
    input: {
      tenant,
      selectedRooms: [], // We don't have this info, but it's not critical for state management
      formData: bookingData,
      bookingCalendarInfo: {
        startStr: bookingData.startDate?.toDate?.()?.toISOString(),
        endStr: bookingData.endDate?.toDate?.()?.toISOString(),
      },
      isWalkIn: false,
      calendarEventId,
      email: bookingData.email,
    },
  });

  tempActor.start();
  const snapshot = tempActor.getSnapshot();

  // Simulate the available transitions based on the current state
  const getTransitionsForState = (state: string) => {
    switch (state) {
      case "Requested":
        return {
          approve: true,
          decline: true,
          cancel: true,
          edit: true,
          checkIn: false,
          checkOut: false,
          noShow: false,
          close: false,
          autoCloseScript: false,
        };
      case "Approved":
        return {
          approve: false,
          decline: false,
          cancel: true,
          edit: false,
          checkIn: true,
          checkOut: false,
          noShow: true,
          close: false,
          autoCloseScript: true,
        };
      case "Declined":
        return {
          approve: false,
          decline: false,
          cancel: false,
          edit: true,
          checkIn: false,
          checkOut: false,
          noShow: false,
          close: false,
          autoCloseScript: false,
        };
      case "Canceled":
        return {
          approve: false,
          decline: false,
          cancel: false,
          edit: false,
          checkIn: false,
          checkOut: false,
          noShow: false,
          close: true,
          autoCloseScript: false,
        };
      case "Checked In":
        return {
          approve: false,
          decline: false,
          cancel: false,
          edit: false,
          checkIn: false,
          checkOut: true,
          noShow: false,
          close: false,
          autoCloseScript: false,
        };
      case "Checked Out":
        return {
          approve: false,
          decline: false,
          cancel: false,
          edit: false,
          checkIn: false,
          checkOut: false,
          noShow: false,
          close: true,
          autoCloseScript: false,
        };
      case "No Show":
        return {
          approve: false,
          decline: false,
          cancel: false,
          edit: false,
          checkIn: false,
          checkOut: false,
          noShow: false,
          close: false,
          autoCloseScript: false,
        };
      default:
        return {
          approve: false,
          decline: false,
          cancel: false,
          edit: false,
          checkIn: false,
          checkOut: false,
          noShow: false,
          close: false,
          autoCloseScript: false,
        };
    }
  };

  // Create XState data based on the current booking status
  const xstateData: PersistedXStateData = {
    currentState: xstateState,
    context: snapshot.context,
    machineId: itpBookingMachine.id,
    lastTransition: new Date().toISOString(),
    canTransitionTo: getTransitionsForState(xstateState),
  };

  tempActor.stop();

  // Save the created XState data to Firestore
  const { serverUpdateDataByCalendarEventId } = await import(
    "@/components/src/server/admin"
  );
  await serverUpdateDataByCalendarEventId(
    TableNames.BOOKING,
    calendarEventId,
    { xstateData },
    tenant
  );

  console.log(
    `💾 XSTATE DATA CREATED AND SAVED [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
    {
      calendarEventId,
      createdState: xstateData.currentState,
      availableTransitions: Object.entries(xstateData.canTransitionTo)
        .filter(([_, canTransition]) => canTransition)
        .map(([event, _]) => event),
    }
  );

  return xstateData;
}

/**
 * Restore XState actor from persisted data in Firestore
 */
export async function restoreXStateFromFirestore(
  calendarEventId: string,
  tenant?: string
): Promise<ActorRefFrom<typeof itpBookingMachine> | null> {
  try {
    console.log(
      `🔄 RESTORING XSTATE FROM FIRESTORE [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
      {
        calendarEventId,
        tenant,
      }
    );

    // Get booking data from Firestore
    const bookingData = await serverGetDataByCalendarEventId(
      TableNames.BOOKING,
      calendarEventId,
      tenant
    );

    if (
      !bookingData ||
      !("xstateData" in bookingData) ||
      !bookingData.xstateData
    ) {
      console.log(
        `❌ NO XSTATE DATA FOUND IN FIRESTORE [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
        {
          calendarEventId,
          hasBookingData: !!bookingData,
          hasXStateData: !!(
            bookingData &&
            "xstateData" in bookingData &&
            bookingData.xstateData
          ),
        }
      );

      // If we have booking data but no XState data, create XState from booking status
      if (bookingData && tenant === "itp") {
        console.log(
          `🔧 CREATING XSTATE FROM BOOKING STATUS [ITP]:`,
          {
            calendarEventId,
            bookingStatus: (bookingData as any).status,
          }
        );

        try {
          const xstateData = await createXStateFromBookingStatus(
            bookingData,
            calendarEventId,
            tenant
          );

          // Create actor with the newly created XState data
          // Note: We can't directly set the state in XState v5, but we store the state info
          // for reference and let the machine determine transitions from the context
          const restoredActor = createActor(itpBookingMachine, {
            input: {
              ...xstateData.context,
              // Add a flag to indicate this is a restored state
              _restoredFromStatus: true,
              _restoredState: xstateData.currentState,
            },
          });

          console.log(
            `✅ XSTATE ACTOR CREATED FROM BOOKING STATUS [ITP]:`,
            {
              calendarEventId,
              createdState: xstateData.currentState,
              contextKeys: Object.keys(xstateData.context || {}),
            }
          );

          return restoredActor;
        } catch (error) {
          console.error(
            `🚨 ERROR CREATING XSTATE FROM BOOKING STATUS [ITP]:`,
            {
              calendarEventId,
              error: error.message,
            }
          );
          return null;
        }
      }

      return null;
    }

    const xstateData = (bookingData as any).xstateData as PersistedXStateData;

    console.log(
      `📥 FOUND XSTATE DATA IN FIRESTORE [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
      {
        currentState: xstateData.currentState,
        machineId: xstateData.machineId,
        lastTransition: xstateData.lastTransition,
        availableTransitions: Object.entries(xstateData.canTransitionTo)
          .filter(([_, canTransition]) => canTransition)
          .map(([event, _]) => event),
      }
    );

    // Validate machine ID
    if (xstateData.machineId !== itpBookingMachine.id) {
      console.warn(
        `⚠️ XSTATE MACHINE ID MISMATCH [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
        {
          expected: itpBookingMachine.id,
          found: xstateData.machineId,
        }
      );
      return null;
    }

    // Create actor with restored context
    const restoredActor = createActor(itpBookingMachine, {
      input: xstateData.context,
    });

    console.log(
      `✅ XSTATE ACTOR RESTORED [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
      {
        calendarEventId,
        restoredState: xstateData.currentState,
        contextKeys: Object.keys(xstateData.context || {}),
      }
    );

    return restoredActor;
  } catch (error) {
    console.error(
      `🚨 ERROR RESTORING XSTATE [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
      {
        calendarEventId,
        error: error.message,
      }
    );
    return null;
  }
}

/**
 * Execute XState transition and save updated state to Firestore
 */
export async function executeXStateTransition(
  calendarEventId: string,
  eventType: string,
  tenant?: string
): Promise<{ success: boolean; newState?: string; error?: string }> {
  try {
    console.log(
      `🎬 EXECUTING XSTATE TRANSITION [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
      {
        calendarEventId,
        eventType,
        tenant,
      }
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

    // Check if the transition is valid
    const currentSnapshot = actor.getSnapshot();
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
        }
      );

      actor.stop();
      return {
        success: false,
        error: `Invalid transition: Cannot execute '${eventType}' from state '${currentSnapshot.value}'`,
      };
    }

    // Execute the transition
    actor.send({ type: eventType as any });
    const newSnapshot = actor.getSnapshot();

    console.log(
      `🎯 XSTATE TRANSITION EXECUTED [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
      {
        previousState: currentSnapshot.value,
        newState: newSnapshot.value,
        eventType,
        transitionPath: `${currentSnapshot.value} → ${newSnapshot.value}`,
      }
    );

    // Prepare updated XState data for persistence
    const updatedXStateData: PersistedXStateData = {
      currentState: newSnapshot.value as string,
      context: newSnapshot.context,
      machineId: itpBookingMachine.id,
      lastTransition: new Date().toISOString(),
      canTransitionTo: {
        approve: newSnapshot.can({ type: "approve" }),
        decline: newSnapshot.can({ type: "decline" }),
        cancel: newSnapshot.can({ type: "cancel" }),
        edit: newSnapshot.can({ type: "edit" }),
        checkIn: newSnapshot.can({ type: "checkIn" }),
        checkOut: newSnapshot.can({ type: "checkOut" }),
        noShow: newSnapshot.can({ type: "noShow" }),
        close: newSnapshot.can({ type: "close" }),
        autoCloseScript: newSnapshot.can({ type: "autoCloseScript" }),
      },
    };

    // Save updated state to Firestore
    const { serverUpdateDataByCalendarEventId } = await import(
      "@/components/src/server/admin"
    );
    await serverUpdateDataByCalendarEventId(
      TableNames.BOOKING,
      calendarEventId,
      { xstateData: updatedXStateData },
      tenant
    );

    console.log(
      `💾 XSTATE STATE UPDATED IN FIRESTORE [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
      {
        calendarEventId,
        newState: newSnapshot.value,
        availableTransitions: Object.entries(updatedXStateData.canTransitionTo)
          .filter(([_, canTransition]) => canTransition)
          .map(([event, _]) => event),
      }
    );

    actor.stop();

    return {
      success: true,
      newState: newSnapshot.value as string,
    };
  } catch (error) {
    console.error(
      `🚨 ERROR EXECUTING XSTATE TRANSITION [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
      {
        calendarEventId,
        eventType,
        error: error.message,
      }
    );
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Get available transitions for a booking
 */
export async function getAvailableXStateTransitions(
  calendarEventId: string,
  tenant?: string
): Promise<string[]> {
  try {
    const bookingData = await serverGetDataByCalendarEventId(
      TableNames.BOOKING,
      calendarEventId,
      tenant
    );

    if (
      !bookingData ||
      !("xstateData" in bookingData) ||
      !bookingData.xstateData
    ) {
      // If we have booking data but no XState data, create XState from booking status
      if (bookingData && tenant === "itp") {
        console.log(
          `🔧 CREATING XSTATE FOR TRANSITIONS [ITP]:`,
          {
            calendarEventId,
            bookingStatus: (bookingData as any).status,
          }
        );

        try {
          const xstateData = await createXStateFromBookingStatus(
            bookingData,
            calendarEventId,
            tenant
          );

          return Object.entries(xstateData.canTransitionTo)
            .filter(([_, canTransition]) => canTransition)
            .map(([event, _]) => event);
        } catch (error) {
          console.error(
            `Error creating XState for transitions:`,
            error
          );
          return [];
        }
      }

      return [];
    }

    const xstateData = (bookingData as any).xstateData as PersistedXStateData;

    return Object.entries(xstateData.canTransitionTo)
      .filter(([_, canTransition]) => canTransition)
      .map(([event, _]) => event);
  } catch (error) {
    console.error(`Error getting available XState transitions:`, error);
    return [];
  }
}
