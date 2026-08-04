import { getBookingHourLimits } from "@/components/src/client/routes/booking/utils/bookingHourLimits";
import {
  TENANTS,
  isMediaCommonsTenant,
} from "@/components/src/constants/tenants";
import { Inputs, Role, RoomSetting } from "@/components/src/types";
import { checkAutoApprovalEligibility } from "@/lib/utils/autoApprovalUtils";

const ONE_HOUR_IN_MS = 60 * 60 * 1000;

export type McAutoApprovalContext = {
  tenant?: string;
  selectedRooms?: RoomSetting[];
  bookingCalendarInfo?: { startStr: string; endStr: string } | null;
  isWalkIn?: boolean;
  isVip?: boolean;
  role?: Role;
  servicesRequested?: {
    staff?: boolean;
    equipment?: boolean;
    catering?: boolean;
    cleaning?: boolean;
    security?: boolean;
    setup?: boolean;
  };
  _restoredFromStatus?: boolean;
};

export type ItpAutoApprovalContext = {
  tenant?: string;
  selectedRooms?: RoomSetting[];
  formData?: Inputs;
  bookingCalendarInfo?: { startStr: string; endStr: string } | null;
  isWalkIn?: boolean;
  role?: Role;
};

/** Mirrors mcBookingMachine `shouldAutoApprove` — safe for client bundles. */
export function evaluateMcShouldAutoApprove(
  context: McAutoApprovalContext,
): boolean {
  if (context._restoredFromStatus) {
    return false;
  }

  if (!isMediaCommonsTenant(context.tenant)) {
    return false;
  }

  let durationHours: number | undefined;
  if (context.bookingCalendarInfo) {
    const startDate = new Date(context.bookingCalendarInfo.startStr);
    const endDate = new Date(context.bookingCalendarInfo.endStr);
    durationHours =
      (endDate.getTime() - startDate.getTime()) / ONE_HOUR_IN_MS;

    if (context.selectedRooms) {
      const { maxHours, minHours } = getBookingHourLimits(
        context.selectedRooms,
        context.role,
        context.isWalkIn || false,
        context.isVip || false,
      );

      if (durationHours > maxHours || durationHours < minHours) {
        return false;
      }
    }
  }

  if (
    context.servicesRequested &&
    typeof context.servicesRequested === "object" &&
    !context.isWalkIn
  ) {
    const hasServices = Object.values(context.servicesRequested).some(Boolean);
    if (hasServices) {
      return false;
    }
  }

  if (context.isVip) {
    const hasServices =
      context.servicesRequested &&
      typeof context.servicesRequested === "object"
        ? Object.values(context.servicesRequested).some(Boolean)
        : false;
    if (hasServices) {
      return false;
    }
  }

  const servicesRequested = context.servicesRequested
    ? {
        setup: context.servicesRequested.setup || false,
        equipment: context.servicesRequested.equipment || false,
        staffing: context.servicesRequested.staff || false,
        catering: context.servicesRequested.catering || false,
        cleaning: context.servicesRequested.cleaning || false,
        security: context.servicesRequested.security || false,
      }
    : undefined;

  return checkAutoApprovalEligibility({
    selectedRooms: context.selectedRooms || [],
    role: context.role,
    isWalkIn: context.isWalkIn,
    isVip: context.isVip,
    durationHours,
    servicesRequested,
  }).canAutoApprove;
}

/** Mirrors itpBookingMachine `shouldAutoApprove` — safe for client bundles. */
export function evaluateItpShouldAutoApprove(
  context: ItpAutoApprovalContext,
): boolean {
  if (context.tenant !== TENANTS.ITP) {
    return false;
  }

  let durationHours: number | undefined;
  if (context.bookingCalendarInfo) {
    const startDate = new Date(context.bookingCalendarInfo.startStr);
    const endDate = new Date(context.bookingCalendarInfo.endStr);
    durationHours =
      (endDate.getTime() - startDate.getTime()) / ONE_HOUR_IN_MS;
  }

  const servicesRequested = context.formData
    ? {
        setup: context.formData.roomSetup === "yes",
        equipment: context.formData.equipmentServices?.length > 0 || false,
        staffing: false,
        catering: context.formData.catering === "yes",
        cleaning: false,
        security: context.formData.hireSecurity === "yes",
      }
    : undefined;

  return checkAutoApprovalEligibility({
    selectedRooms: context.selectedRooms || [],
    role: context.role,
    isWalkIn: context.isWalkIn,
    isVip: false,
    durationHours,
    servicesRequested,
  }).canAutoApprove;
}
