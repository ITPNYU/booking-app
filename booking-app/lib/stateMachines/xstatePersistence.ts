import { TENANTS } from "@/components/src/constants/tenants";
import { TableNames } from "@/components/src/policy";
import { serverUpdateDataByCalendarEventId } from "@/components/src/server/admin";
import { BookingStatusLabel } from "@/components/src/types";
import {
  getMediaCommonsServices,
  isMediaCommons,
} from "@/components/src/utils/tenantUtils";
import {
  serverGetDataByCalendarEventId,
} from "@/lib/firebase/server/adminDb";
import { createActor } from "xstate";
import { itpBookingMachine } from "./itpBookingMachine";
import { mcBookingMachine } from "./mcBookingMachine";
import type { PersistedXStateData } from "./xstateTypes";

/**
 * Map booking status to XState state
 */
export function mapBookingStatusToXState(status: string): string {
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
        `Unknown booking status: ${status}, defaulting to Requested`,
      );
      return "Requested";
  }
}

/**
 * Get the appropriate machine for a tenant
 */
export function getMachineForTenant(tenant?: string) {
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

/**
 * Create and save XState data from booking status using v5 snapshot
 */
export async function createXStateDataFromBookingStatus(
  calendarEventId: string,
  bookingData: any,
  tenant?: string,
): Promise<PersistedXStateData> {
  console.log(
    `🏗️ CREATING XSTATE DATA FROM BOOKING STATUS [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
    {
      calendarEventId,
      tenant,
    },
  );

  const machine = getMachineForTenant(tenant);
  const bookingStatus = getBookingStatusFromData(bookingData);
  const xstateState = mapBookingStatusToXState(bookingStatus);

  // Build input context
  const servicesRequested = isMediaCommons(tenant)
    ? getMediaCommonsServices(bookingData)
    : {};

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
      },
    },
  );

  const inputContext = isMediaCommons(tenant)
    ? {
        tenant,
        selectedRooms: bookingData.selectedRooms || [], // Default to empty array
        bookingCalendarInfo: {
          startStr: bookingData.startDate?.toDate?.()?.toISOString(),
          endStr: bookingData.endDate?.toDate?.()?.toISOString(),
        },
        isWalkIn: bookingData.origin === "walk-in" || !!bookingData.walkedInAt,
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
        // Flag to indicate this XState was created from existing booking without prior xstateData
        _restoredFromStatus: true,
      }
    : {
        tenant,
        selectedRooms: bookingData.selectedRooms || [], // Default to empty array
        bookingCalendarInfo: {
          startStr: bookingData.startDate?.toDate?.()?.toISOString(),
          endStr: bookingData.endDate?.toDate?.()?.toISOString(),
        },
        isWalkIn: bookingData.origin === "walk-in" || !!bookingData.walkedInAt,
        calendarEventId,
        email: bookingData.email,
        // Flag to indicate this XState was created from existing booking without prior xstateData
        _restoredFromStatus: true,
      };

  // Create actor starting from the target state directly (without transitions)
  console.log(
    `🎯 CREATING XSTATE DIRECTLY IN TARGET STATE [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
    {
      calendarEventId,
      targetState: xstateState,
      bookingStatus,
    },
  );

  // Create actor directly in target state without executing transitions
  const actor = createActor(machine, {
    input: inputContext,
  });
  actor.start();

  // Manually set the state to target without triggering transitions
  // This prevents automatic history logging during XState creation
  if (xstateState !== "Requested") {
    console.log(
      `🔧 MANUALLY SETTING XSTATE TO TARGET STATE [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
      {
        calendarEventId,
        fromState: "Requested",
        toState: xstateState,
        reason: "Skip transition side effects during XState creation",
      },
    );

    // Use internal method to set state without triggering side effects
    // This is safe for XState creation from existing booking status
    const currentSnapshot = actor.getSnapshot();
    const newSnapshot = {
      ...currentSnapshot,
      value: xstateState,
    };

    // Update the actor's internal state directly
    (actor as any)._snapshot = newSnapshot;
  }

  // Get the persisted snapshot using XState v5 method
  const persistedSnapshot = actor.getPersistedSnapshot();

  console.log(
    `🔍 RAW PERSISTED SNAPSHOT [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
    {
      calendarEventId,
      hasSnapshot: !!persistedSnapshot,
      snapshotKeys: persistedSnapshot ? Object.keys(persistedSnapshot) : [],
      snapshotPreview: persistedSnapshot
        ? {
            status: persistedSnapshot.status,
            value: (persistedSnapshot as any).value,
            hasContext: !!(persistedSnapshot as any).context,
          }
        : null,
    },
  );

  // Clean snapshot by removing undefined values for Firestore compatibility
  const cleanSnapshot = cleanObjectForFirestore(persistedSnapshot);

  console.log(`🧹 CLEANED SNAPSHOT [${tenant?.toUpperCase() || "UNKNOWN"}]:`, {
    calendarEventId,
    hasCleanSnapshot: !!cleanSnapshot,
    cleanSnapshotKeys: cleanSnapshot ? Object.keys(cleanSnapshot) : [],
  });

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
    tenant,
  );

  console.log(
    `💾 XSTATE DATA CREATED AND SAVED [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
    {
      calendarEventId,
      createdState: xstateState,
      machineId: xstateData.machineId,
    },
  );

  return xstateData;
}

/**
 * Restore XState actor from persisted snapshot
 */
export async function restoreXStateFromFirestore(
  calendarEventId: string,
  tenant?: string,
): Promise<any> {
  try {
    console.log(
      `🔄 RESTORING XSTATE FROM FIRESTORE [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
      {
        calendarEventId,
        tenant,
      },
    );

    // Get booking data from Firestore
    // Try tenant-specific collection first, then fallback to legacy bookings collection
    let bookingData = await serverGetDataByCalendarEventId(
      TableNames.BOOKING,
      calendarEventId,
      tenant,
    );

    let actualTenant = tenant;

    // If not found in tenant collection, try legacy bookings collection (no tenant)
    if (!bookingData && tenant) {
      console.log(
        `🔍 BOOKING NOT FOUND IN TENANT COLLECTION, TRYING LEGACY [${tenant?.toUpperCase()}]:`,
        {
          calendarEventId,
          triedTenant: tenant,
        },
      );

      bookingData = await serverGetDataByCalendarEventId(
        TableNames.BOOKING,
        calendarEventId,
        undefined, // No tenant for legacy bookings
      );

      if (bookingData) {
        actualTenant = undefined; // Use undefined for legacy bookings
        console.log(`✅ FOUND LEGACY BOOKING [${tenant?.toUpperCase()}]:`, {
          calendarEventId,
          usingLegacyCollection: true,
        });
      }
    }

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
        },
      );

      // Try to create XState data from booking status
      if (bookingData) {
        try {
          const xstateData = await createXStateDataFromBookingStatus(
            calendarEventId,
            bookingData,
            actualTenant, // Use actualTenant instead of tenant
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
            },
          );

          return restoredActor;
        } catch (error) {
          console.error(
            `🚨 ERROR CREATING XSTATE FROM BOOKING STATUS [${tenant?.toUpperCase()}]:`,
            {
              calendarEventId,
              error: error.message,
            },
          );
          return null;
        }
      }

      return null;
    }

    const rawXStateData = (bookingData as any).xstateData;

    console.log(
      `📥 FOUND XSTATE DATA IN FIRESTORE [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
      {
        machineId: rawXStateData.machineId,
        lastTransition: rawXStateData.lastTransition,
        hasSnapshot: !!rawXStateData.snapshot,
        snapshotKeys: rawXStateData.snapshot
          ? Object.keys(rawXStateData.snapshot)
          : [],
        snapshotPreview: rawXStateData.snapshot
          ? {
              status: rawXStateData.snapshot.status,
              value: rawXStateData.snapshot.value,
              hasContext: !!rawXStateData.snapshot.context,
              contextKeys: rawXStateData.snapshot.context
                ? Object.keys(rawXStateData.snapshot.context)
                : [],
            }
          : null,
        isLegacyFormat: !rawXStateData.snapshot && !!rawXStateData.currentState,
      },
    );

    // Check if this is legacy XState v4 format and needs migration
    if (!rawXStateData.snapshot && rawXStateData.currentState) {
      console.log(
        `🔄 MIGRATING LEGACY XSTATE DATA [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
        {
          calendarEventId,
          oldCurrentState: rawXStateData.currentState,
          hasOldContext: !!rawXStateData.context,
        },
      );

      // Create new XState data from current booking status
      try {
        const newXStateData = await createXStateDataFromBookingStatus(
          calendarEventId,
          bookingData,
          tenant,
        );

        const machine = getMachineForTenant(tenant);

        // Create actor with new snapshot
        const restoredActor = createActor(machine, {
          snapshot: newXStateData.snapshot,
        });

        console.log(
          `✅ LEGACY XSTATE DATA MIGRATED [${tenant?.toUpperCase()}]:`,
          {
            calendarEventId,
            machineId: newXStateData.machineId,
          },
        );

        return restoredActor;
      } catch (error) {
        console.error(
          `🚨 ERROR MIGRATING LEGACY XSTATE [${tenant?.toUpperCase()}]:`,
          {
            calendarEventId,
            error: error.message,
          },
        );
        return null;
      }
    }

    const xstateData = rawXStateData as PersistedXStateData;

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
        },
      );
    }

    // Update snapshot context with current booking data
    const updatedSnapshot = { ...xstateData.snapshot };
    if (updatedSnapshot.context) {
      // Always update core context fields for all tenants
      updatedSnapshot.context = {
        ...updatedSnapshot.context,
        tenant,
        calendarEventId,
        email: (bookingData as any).email,
      };

      // Update MC-specific services data
      if (isMediaCommons(tenant)) {
        const currentServicesRequested = getMediaCommonsServices(bookingData);
        const currentServicesApproved = {
          staff: (bookingData as any).staffServiceApproved,
          equipment: (bookingData as any).equipmentServiceApproved,
          catering: (bookingData as any).cateringServiceApproved,
          cleaning: (bookingData as any).cleaningServiceApproved,
          security: (bookingData as any).securityServiceApproved,
          setup: (bookingData as any).setupServiceApproved,
        };

        updatedSnapshot.context = {
          ...updatedSnapshot.context,
          servicesRequested: currentServicesRequested,
          servicesApproved: currentServicesApproved,
        };
      }
    }

    // Create actor with updated snapshot with error handling
    let restoredActor;
    try {
      restoredActor = createActor(machine, {
        snapshot: updatedSnapshot,
      });
    } catch (error) {
      console.error(
        `🚨 ERROR CREATING XSTATE ACTOR [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
        {
          calendarEventId,
          error: error.message,
          snapshotValue: updatedSnapshot?.value,
          hasContext: !!updatedSnapshot?.context,
        },
      );

      // If snapshot restoration fails, create new XState data
      console.log(
        `🔄 FALLING BACK TO NEW XSTATE DATA CREATION [${tenant?.toUpperCase()}]:`,
        { calendarEventId },
      );

      const newXStateData = await createXStateDataFromBookingStatus(
        calendarEventId,
        bookingData,
        tenant,
      );

      restoredActor = createActor(machine, {
        snapshot: newXStateData.snapshot,
      });
    }

    console.log(
      `✅ XSTATE ACTOR RESTORED [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
      {
        calendarEventId,
        machineId: xstateData.machineId,
        restoredSuccessfully: true,
        contextUpdated: isMediaCommons(tenant),
      },
    );

    return restoredActor;
  } catch (error) {
    console.error(
      `🚨 ERROR RESTORING XSTATE [${tenant?.toUpperCase() || "UNKNOWN"}]:`,
      {
        calendarEventId,
        error: error.message,
      },
    );
    return null;
  }
}

/**
 * Clean object by removing undefined values for Firestore compatibility
 */
export function cleanObjectForFirestore(obj: any): any {
  if (obj === null || obj === undefined) {
    return null;
  }

  if (typeof obj !== "object") {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj
      .map((item) => cleanObjectForFirestore(item))
      .filter((item) => item !== undefined);
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
export function getBookingStatusFromData(bookingData: any): string {
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
