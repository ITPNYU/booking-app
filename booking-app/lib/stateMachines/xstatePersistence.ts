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

// Type for persisted XState data using v5 snapshot
export interface PersistedXStateData {
  snapshot: any; // XState v5 snapshot object
  machineId: string;
  lastTransition: string;
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
        `[XState] unknown booking status: ${status}, defaulting to Requested`,
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
 * Create and save XState data from booking status using v5 snapshot
 */
export async function createXStateDataFromBookingStatus(
  calendarEventId: string,
  bookingData: any,
  tenant?: string,
): Promise<PersistedXStateData> {
  const machine = getMachineForTenant(tenant);
  const bookingStatus = getBookingStatusFromData(bookingData);
  const xstateState = mapBookingStatusToXState(bookingStatus);

  // Build input context
  const servicesRequested = isMediaCommons(tenant)
    ? getMediaCommonsServices(bookingData)
    : {};

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

  // Create actor directly in target state without executing transitions
  const actor = createActor(machine, {
    input: inputContext,
  });
  actor.start();

  // Manually set the state to target without triggering transitions
  // This prevents automatic history logging during XState creation
  if (xstateState !== "Requested") {
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

  // Clean snapshot by removing undefined values for Firestore compatibility
  const cleanSnapshot = cleanObjectForFirestore(persistedSnapshot);

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
    `[XState] created from booking status [${tenant?.toUpperCase() || "UNKNOWN"}]`,
    { calendarEventId, state: xstateState, machineId: xstateData.machineId },
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
      bookingData = await serverGetDataByCalendarEventId(
        TableNames.BOOKING,
        calendarEventId,
        undefined, // No tenant for legacy bookings
      );

      if (bookingData) {
        actualTenant = undefined; // Use undefined for legacy bookings
      }
    }

    if (
      !bookingData ||
      !("xstateData" in bookingData) ||
      !bookingData.xstateData
    ) {
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

          return restoredActor;
        } catch (error) {
          console.error(
            `[XState] failed to create from booking status [${tenant?.toUpperCase()}]`,
            { calendarEventId, error: error.message },
          );
          return null;
        }
      }

      return null;
    }

    const rawXStateData = (bookingData as any).xstateData;

    // Check if this is legacy XState v4 format and needs migration
    if (!rawXStateData.snapshot && rawXStateData.currentState) {
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

        return restoredActor;
      } catch (error) {
        console.error(
          `[XState] legacy migration failed [${tenant?.toUpperCase()}]`,
          { calendarEventId, error: error.message },
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
        `[XState] machine ID mismatch [${tenant?.toUpperCase() || "UNKNOWN"}]`,
        { expected: machine.id, found: xstateData.machineId, calendarEventId },
      );
    }

    // Update snapshot context with current booking data services
    const updatedSnapshot = { ...xstateData.snapshot };
    if (isMediaCommons(tenant) && updatedSnapshot.context) {
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
        tenant,
        calendarEventId,
        email: (bookingData as any).email,
      };
    }

    // Create actor with updated snapshot with error handling
    let restoredActor;
    try {
      restoredActor = createActor(machine, {
        snapshot: updatedSnapshot,
      });
    } catch (error) {
      console.error(
        `[XState] actor creation failed, falling back to new data [${tenant?.toUpperCase() || "UNKNOWN"}]`,
        { calendarEventId, error: error.message },
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

    return restoredActor;
  } catch (error) {
    console.error(
      `[XState] restore failed [${tenant?.toUpperCase() || "UNKNOWN"}]`,
      { calendarEventId, error: error.message },
    );
    return null;
  }
}
