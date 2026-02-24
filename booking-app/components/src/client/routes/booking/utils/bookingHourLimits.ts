import { Role } from "@/components/src/types";
import { getBaseRole } from "@/components/src/utils/roleUtils";
import { Resource } from "../../components/SchemaProvider";

// No default limits - allow any duration
const DEFAULT_MAX_HOURS = Number.POSITIVE_INFINITY;
const DEFAULT_MIN_HOURS = 0;

/**
 * Maps Role enum to the appropriate field name for maxHour/minHour
 * @param role - The user's role
 * @param isWalkIn - Whether this is a walk-in booking
 * @param isVIP - Whether this is a VIP booking
 * @returns The field name to use (e.g., "student", "studentWalkIn", "studentVIP", "faculty", etc.)
 */
function getRoleFieldName(
  role: Role | undefined,
  isWalkIn: boolean,
  isVIP: boolean
): keyof Resource["maxHour"] {
  const baseRole = getBaseRole(role);

  if (isVIP) {
    return `${baseRole}VIP` as keyof Resource["maxHour"];
  }

  return isWalkIn
    ? (`${baseRole}WalkIn` as keyof Resource["maxHour"])
    : baseRole;
}

/**
 * Gets the maximum and minimum hours allowed for a booking based on role and resources
 * @param selectedRooms - The rooms selected for booking
 * @param role - The user's role
 * @param isWalkIn - Whether this is a walk-in booking
 * @param isVIP - Whether this is a VIP booking
 * @returns Object with maxHours and minHours (defaults: 4 and 0.5)
 */
export function getBookingHourLimits(
  selectedRooms: any[],
  role: Role | undefined,
  isWalkIn: boolean,
  isVIP: boolean = false
): { maxHours: number; minHours: number } {
  if (!selectedRooms || selectedRooms.length === 0) {
    return { maxHours: DEFAULT_MAX_HOURS, minHours: DEFAULT_MIN_HOURS };
  }

  // Get the base role field (without walk-in or VIP)
  const baseRoleField = getRoleFieldName(role, false, false);
  // Get the walk-in specific field
  const walkInRoleField = getRoleFieldName(role, true, false);
  // Get the VIP specific field
  const vipRoleField = getRoleFieldName(role, false, true);

  // Find the most restrictive limits across all selected rooms
  let maxHours = DEFAULT_MAX_HOURS;
  let minHours = DEFAULT_MIN_HOURS;

  const baseRole = getBaseRole(role);

  for (const room of selectedRooms) {
    // Prefer top-level maxHour/minHour; fall back to autoApproval (admin/faculty/student only)
    const useAutoApproval =
      !room.maxHour && !room.minHour && room.autoApproval?.minHour != null && room.autoApproval?.maxHour != null;

    if (!room.maxHour && !room.minHour && !useAutoApproval) {
      continue;
    }

    let roomMaxHour: number;
    let roomMinHour: number;

    if (useAutoApproval) {
      const aMax = room.autoApproval?.maxHour?.[baseRole];
      const aMin = room.autoApproval?.minHour?.[baseRole];
      roomMaxHour = (aMax === undefined || aMax === -1) ? DEFAULT_MAX_HOURS : aMax;
      roomMinHour = (aMin === undefined || aMin === -1) ? DEFAULT_MIN_HOURS : aMin;
    } else if (isVIP) {
      const vipMax = room.maxHour?.[vipRoleField];
      const vipMin = room.minHour?.[vipRoleField];
      roomMaxHour = (vipMax === undefined || vipMax === -1) ? DEFAULT_MAX_HOURS : vipMax;
      roomMinHour = (vipMin === undefined || vipMin === -1) ? DEFAULT_MIN_HOURS : vipMin;
    } else if (isWalkIn) {
      const walkInMax = room.maxHour?.[walkInRoleField];
      const walkInMin = room.minHour?.[walkInRoleField];
      roomMaxHour = (walkInMax === undefined || walkInMax === -1) ? DEFAULT_MAX_HOURS : walkInMax;
      roomMinHour = (walkInMin === undefined || walkInMin === -1) ? DEFAULT_MIN_HOURS : walkInMin;
    } else {
      const regularMax = room.maxHour?.[baseRoleField];
      const regularMin = room.minHour?.[baseRoleField];
      roomMaxHour = (regularMax === undefined || regularMax === -1) ? DEFAULT_MAX_HOURS : regularMax;
      roomMinHour = (regularMin === undefined || regularMin === -1) ? DEFAULT_MIN_HOURS : regularMin;
    }

    if (roomMaxHour < maxHours) {
      maxHours = roomMaxHour;
    }
    if (roomMinHour > minHours) {
      minHours = roomMinHour;
    }
  }

  return { maxHours, minHours };
}

export { DEFAULT_MAX_HOURS, DEFAULT_MIN_HOURS };
