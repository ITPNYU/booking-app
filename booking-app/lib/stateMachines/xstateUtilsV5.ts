import { TableNames } from "@/components/src/policy";
import { BookingStatusLabel } from "@/components/src/types";
import { isMediaCommons, shouldUseXState, getMediaCommonsServices } from "@/components/src/utils/tenantUtils";
import { serverGetDataByCalendarEventId } from "@/lib/firebase/server/adminDb";
import { serverUpdateDataByCalendarEventId } from "@/components/src/server/admin";
import { createActor } from "xstate";
import { itpBookingMachine } from "./itpBookingMachine";
import { mcBookingMachine } from "./mcBookingMachine";
import { TENANTS } from "@/components/src/constants/tenants";

// Type for persisted XState data using v5 snapshot
export interface PersistedXStateData {
  snapshot: any; // XState v5 snapshot object
  machineId: string;
  lastTransition: string;
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
    case BookingStatusLabel.PRE_APPROVED:
      return "Pre-approved";
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
      console.warn(
        `Unknown booking status: ${status}, defaulting to Requested`
      );
      return "Requested";
  }
}

/**
 * Get the appropriate machine for a tenant
 */
function getMachineForTenant(tenant?: string) {
  switch (tenant) {
    case TENANTS.MC:
      return mcBookingMachine;
    case TENANTS.ITP:
      return itpBookingMachine;
    default:
      return itpBookingMachine; // default to ITP
  }
}

/**
 * Navigate actor to target state from initial state
 */
function navigateActorToState(actor: any, targetState: string): void {
  const currentSnapshot = actor.getSnapshot();
  
  if (currentSnapshot.value === targetState) {
    return; // Already at target state
  }

  console.log(`🔄 NAVIGATING ACTOR: ${currentSnapshot.value} → ${targetState}`, {
    contextPreview: {
      tenant: currentSnapshot.context?.tenant,
      calendarEventId: currentSnapshot.context?.calendarEventId,
      email: currentSnapshot.context?.email,
    }
  });

  switch (targetState) {
    case 'Pre-approved':
      if (currentSnapshot.value === 'Requested' && currentSnapshot.can({ type: 'approve' })) {
        actor.send({ type: 'approve' });
        console.log(`🎯 NAVIGATED: Requested → Pre-approved`);
      }
      break;
    case 'Approved':
      if (currentSnapshot.value === 'Requested' && currentSnapshot.can({ type: 'approve' })) {
        actor.send({ type: 'approve' });
        const preApprovedSnapshot = actor.getSnapshot();
        if (preApprovedSnapshot.value === 'Pre-approved' && preApprovedSnapshot.can({ type: 'approve' })) {
          actor.send({ type: 'approve' });
          console.log(`🎯 NAVIGATED: Requested → Pre-approved → Approved`);
        }
      }
      break;
    case 'Declined':
      if (currentSnapshot.value === 'Requested' && currentSnapshot.can({ type: 'decline' })) {
        actor.send({ type: 'decline' });
        console.log(`🎯 NAVIGATED: Requested → Declined`);
      }
      break;
    case 'Canceled':
      if (currentSnapshot.can({ type: 'cancel' })) {
        actor.send({ type: 'cancel' });
        console.log(`🎯 NAVIGATED: → Canceled`);
      }
      break;
    case 'Checked In':
      if (currentSnapshot.can({ type: 'checkIn' })) {
        actor.send({ type: 'checkIn' });
        console.log(`🎯 NAVIGATED: → Checked In`);
      }
      break;
    case 'Checked Out':
      if (currentSnapshot.can({ type: 'checkOut' })) {
        actor.send({ type: 'checkOut' });
        console.log(`🎯 NAVIGATED: → Checked Out`);
      }
      break;
    case 'No Show':
      if (currentSnapshot.can({ type: 'noShow' })) {
        actor.send({ type: 'noShow' });
        console.log(`🎯 NAVIGATED: → No Show`);
      }
      break;
  }
}

/**
 * Create and save XState data from booking status using v5 snapshot
 */
export async function createXStateDataFromBookingStatus(
  calendarEventId: string,
  bookingData: any,
  tenant?: string
): Promise<PersistedXStateData> {
  console.log(
    `🏗️ CREATING XSTATE DATA FROM BOOKING STATUS [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
    {
      calendarEventId,
      tenant,
    }
  );

  const machine = getMachineForTenant(tenant);
  const bookingStatus = getBookingStatusFromData(bookingData);
  const xstateState = mapBookingStatusToXState(bookingStatus);

  // Build input context
  const servicesRequested = isMediaCommons(tenant) ? getMediaCommonsServices(bookingData) : {};
  
  console.log(
    `🔍 XSTATE CONTEXT DEBUG [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
    {
      calendarEventId,
      bookingDataKeys: Object.keys(bookingData || {}),
      servicesRequestedResult: servicesRequested,
      bookingDataServiceFields: {
        roomSetup: bookingData?.roomSetup,
        staffingServicesDetails: bookingData?.staffingServicesDetails,
        equipmentServices: bookingData?.equipmentServices,
        catering: bookingData?.catering,
        cleaningService: bookingData?.cleaningService,
        hireSecurity: bookingData?.hireSecurity,
      }
    }
  );

  const inputContext = isMediaCommons(tenant)
    ? {
        tenant,
        selectedRooms: bookingData.selectedRooms || [], // Default to empty array
        formData: bookingData,
        bookingCalendarInfo: {
          startStr: bookingData.startDate?.toDate?.()?.toISOString(),
          endStr: bookingData.endDate?.toDate?.()?.toISOString(),
        },
        isWalkIn: false,
        calendarEventId,
        email: bookingData.email,
        isVip: bookingData.isVip || false,
        servicesRequested,
        servicesApproved: {
          staff: bookingData.staffServiceApproved,
          equipment: bookingData.equipmentServiceApproved,
          catering: bookingData.cateringServiceApproved,
          cleaning: bookingData.cleaningServiceApproved,
          security: bookingData.securityServiceApproved,
          setup: bookingData.setupServiceApproved,
        },
      }
    : {
        tenant,
        selectedRooms: bookingData.selectedRooms || [], // Default to empty array
        formData: bookingData,
        bookingCalendarInfo: {
          startStr: bookingData.startDate?.toDate?.()?.toISOString(),
          endStr: bookingData.endDate?.toDate?.()?.toISOString(),
        },
        isWalkIn: false,
        calendarEventId,
        email: bookingData.email,
      };

  // Create actor and navigate to correct state
  const actor = createActor(machine, {
    input: inputContext,
  });
  actor.start();

  // Navigate to the correct state based on booking status
  navigateActorToState(actor, xstateState);

  // Get the persisted snapshot using XState v5 method
  const persistedSnapshot = actor.getPersistedSnapshot();

  console.log(
    `🔍 RAW PERSISTED SNAPSHOT [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
    {
      calendarEventId,
      hasSnapshot: !!persistedSnapshot,
      snapshotKeys: persistedSnapshot ? Object.keys(persistedSnapshot) : [],
      snapshotPreview: persistedSnapshot ? {
        status: persistedSnapshot.status,
        value: persistedSnapshot.value,
        hasContext: !!persistedSnapshot.context,
      } : null,
    }
  );

  // Clean snapshot by removing undefined values for Firestore compatibility
  const cleanSnapshot = cleanObjectForFirestore(persistedSnapshot);

  console.log(
    `🧹 CLEANED SNAPSHOT [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
    {
      calendarEventId,
      hasCleanSnapshot: !!cleanSnapshot,
      cleanSnapshotKeys: cleanSnapshot ? Object.keys(cleanSnapshot) : [],
    }
  );

  // Create XState data using proper v5 snapshot
  const xstateData: PersistedXStateData = {
    snapshot: cleanSnapshot,
    machineId: machine.id,
    lastTransition: new Date().toISOString(),
  };

  actor.stop();

  // Save the created XState data to Firestore
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
      createdState: xstateState,
      machineId: xstateData.machineId,
    }
  );

  return xstateData;
}

/**
 * Restore XState actor from persisted snapshot
 */
export async function restoreXStateFromFirestore(
  calendarEventId: string,
  tenant?: string
): Promise<any> {
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

      // Try to create XState data from booking status
      if (bookingData) {
        try {
          const xstateData = await createXStateDataFromBookingStatus(
            calendarEventId,
            bookingData,
            tenant
          );

          const machine = getMachineForTenant(tenant);
          
          // Create actor with persisted snapshot
          const restoredActor = createActor(machine, {
            snapshot: xstateData.snapshot,
          });

          console.log(
            `✅ XSTATE ACTOR CREATED FROM BOOKING STATUS [${tenant?.toUpperCase()}]:`,
            {
              calendarEventId,
              machineId: xstateData.machineId,
            }
          );

          return restoredActor;
        } catch (error) {
          console.error(
            `🚨 ERROR CREATING XSTATE FROM BOOKING STATUS [${tenant?.toUpperCase()}]:`,
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
        machineId: xstateData.machineId,
        lastTransition: xstateData.lastTransition,
        hasSnapshot: !!xstateData.snapshot,
        snapshotKeys: xstateData.snapshot ? Object.keys(xstateData.snapshot) : [],
        snapshotPreview: xstateData.snapshot ? {
          status: xstateData.snapshot.status,
          value: xstateData.snapshot.value,
          hasContext: !!xstateData.snapshot.context,
          contextKeys: xstateData.snapshot.context ? Object.keys(xstateData.snapshot.context) : [],
        } : null,
      }
    );

    // Get the appropriate machine for the tenant
    const machine = getMachineForTenant(tenant);

    // Validate machine ID
    if (machine.id !== xstateData.machineId) {
      console.warn(
        `⚠️ MACHINE ID MISMATCH [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
        {
          expectedMachineId: machine.id,
          foundMachineId: xstateData.machineId,
          calendarEventId,
        }
      );
    }

    // Update snapshot context with current booking data services
    const updatedSnapshot = { ...xstateData.snapshot };
    if (isMediaCommons(tenant) && updatedSnapshot.context) {
      const currentServicesRequested = getMediaCommonsServices(bookingData);
      const currentServicesApproved = {
        staff: bookingData.staffServiceApproved,
        equipment: bookingData.equipmentServiceApproved,
        catering: bookingData.cateringServiceApproved,
        cleaning: bookingData.cleaningServiceApproved,
        security: bookingData.securityServiceApproved,
        setup: bookingData.setupServiceApproved,
      };
      
      console.log(
        `🔄 UPDATING XSTATE CONTEXT WITH CURRENT SERVICES [${tenant?.toUpperCase()}]:`,
        {
          calendarEventId,
          oldServicesRequested: updatedSnapshot.context.servicesRequested,
          newServicesRequested: currentServicesRequested,
          oldServicesApproved: updatedSnapshot.context.servicesApproved,
          newServicesApproved: currentServicesApproved,
        }
      );
      
      updatedSnapshot.context = {
        ...updatedSnapshot.context,
        servicesRequested: currentServicesRequested,
        servicesApproved: currentServicesApproved,
        tenant,
        calendarEventId,
        email: bookingData.email,
      };
    }

    // Create actor with updated snapshot
    const restoredActor = createActor(machine, {
      snapshot: updatedSnapshot,
    });

    console.log(
      `✅ XSTATE ACTOR RESTORED [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
      {
        calendarEventId,
        machineId: xstateData.machineId,
        restoredSuccessfully: true,
        contextUpdated: isMediaCommons(tenant),
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
          contextKeys: currentSnapshot.context ? Object.keys(currentSnapshot.context) : [],
          contextPreview: currentSnapshot.context ? {
            tenant: currentSnapshot.context.tenant,
            calendarEventId: currentSnapshot.context.calendarEventId,
            selectedRooms: Array.isArray(currentSnapshot.context.selectedRooms) 
              ? `Array(${currentSnapshot.context.selectedRooms.length})` 
              : (currentSnapshot.context.selectedRooms || 'undefined'),
            servicesRequested: currentSnapshot.context.servicesRequested,
          } : null,
        }
      );
    } catch (error) {
      console.error(
        `🚨 ERROR GETTING CURRENT SNAPSHOT [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
        {
          calendarEventId,
          error: error.message,
        }
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
        contextAfterTransition: {
          servicesRequested: newSnapshot.context?.servicesRequested,
          servicesApproved: newSnapshot.context?.servicesApproved,
        },
      }
    );

    // Get updated persisted snapshot
    const updatedPersistedSnapshot = actor.getPersistedSnapshot();

    // Clean snapshot by removing undefined values for Firestore compatibility
    const cleanUpdatedSnapshot = cleanObjectForFirestore(updatedPersistedSnapshot);

    // Create updated XState data
    const updatedXStateData: PersistedXStateData = {
      snapshot: cleanUpdatedSnapshot,
      machineId: getMachineForTenant(tenant).id,
      lastTransition: new Date().toISOString(),
    };

    // Prepare updates for Firestore
    const firestoreUpdates: any = { xstateData: updatedXStateData };

    // If this is Media Commons and servicesApproved context changed, update individual service fields
    if (isMediaCommons(tenant) && newSnapshot.context?.servicesApproved) {
      const servicesApproved = newSnapshot.context.servicesApproved;
      
      // Map XState context to individual Firestore fields
      if (typeof servicesApproved.staff === 'boolean') {
        firestoreUpdates.staffServiceApproved = servicesApproved.staff;
      }
      if (typeof servicesApproved.equipment === 'boolean') {
        firestoreUpdates.equipmentServiceApproved = servicesApproved.equipment;
      }
      if (typeof servicesApproved.catering === 'boolean') {
        firestoreUpdates.cateringServiceApproved = servicesApproved.catering;
      }
      if (typeof servicesApproved.cleaning === 'boolean') {
        firestoreUpdates.cleaningServiceApproved = servicesApproved.cleaning;
      }
      if (typeof servicesApproved.security === 'boolean') {
        firestoreUpdates.securityServiceApproved = servicesApproved.security;
      }
      if (typeof servicesApproved.setup === 'boolean') {
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
        }
      );
    }

    // Save updated state to Firestore
    await serverUpdateDataByCalendarEventId(
      TableNames.BOOKING,
      calendarEventId,
      firestoreUpdates,
      tenant
    );

    console.log(
      `💾 XSTATE STATE UPDATED IN FIRESTORE [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
      {
        calendarEventId,
        newState: newSnapshot.value,
        machineId: updatedXStateData.machineId,
        savedSnapshot: {
          hasContext: !!cleanUpdatedSnapshot.context,
          contextServicesApproved: cleanUpdatedSnapshot.context?.servicesApproved,
        },
        individualServiceFieldsUpdated: isMediaCommons(tenant) && newSnapshot.context?.servicesApproved ? Object.keys(firestoreUpdates).filter(key => key.endsWith('ServiceApproved')) : [],
      }
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
      }
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
      if (bookingData && shouldUseXState(tenant)) {
        console.log(
          `🔧 CREATING XSTATE FOR TRANSITIONS [${tenant?.toUpperCase()}]:`,
          { calendarEventId }
        );
        
        await createXStateDataFromBookingStatus(
          calendarEventId,
          bookingData,
          tenant
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
      }
    );

    return availableTransitions;
  } catch (error) {
    console.error(
      `🚨 ERROR GETTING AVAILABLE TRANSITIONS [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
      {
        calendarEventId,
        error: error.message,
      }
    );
    return [];
  }
}

/**
 * Clean object by removing undefined values for Firestore compatibility
 */
function cleanObjectForFirestore(obj: any): any {
  if (obj === null || obj === undefined) {
    return null;
  }
  
  if (typeof obj !== 'object') {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => cleanObjectForFirestore(item)).filter(item => item !== undefined);
  }
  
  const cleaned: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      cleaned[key] = cleanObjectForFirestore(value);
    }
  }
  
  return cleaned;
}

/**
 * Helper function to get booking status from booking data
 */
function getBookingStatusFromData(bookingData: any): string {
  if (bookingData.noShowedAt) return BookingStatusLabel.NO_SHOW;
  if (bookingData.checkedOutAt) return BookingStatusLabel.CHECKED_OUT;
  if (bookingData.checkedInAt) return BookingStatusLabel.CHECKED_IN;
  if (bookingData.canceledAt) return BookingStatusLabel.CANCELED;
  if (bookingData.declinedAt) return BookingStatusLabel.DECLINED;
  if (bookingData.finalApprovedAt) return BookingStatusLabel.APPROVED;
  if (bookingData.firstApprovedAt) return BookingStatusLabel.PRE_APPROVED;
  if (bookingData.requestedAt) return BookingStatusLabel.REQUESTED;
  return BookingStatusLabel.UNKNOWN;
}