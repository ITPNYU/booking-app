import { Role } from "@/components/src/types";
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
  if (!role) {
    // Default to student if role is not set
    if (isVIP) return "studentVIP";
    if (isWalkIn) return "studentWalkIn";
    return "student";
  }

  let baseRole: "student" | "faculty" | "admin";

  switch (role) {
    case Role.STUDENT:
      baseRole = "student";
      break;
    case Role.FACULTY:
    case Role.RESIDENT_FELLOW:
    case Role.CHAIR_PROGRAM_DIRECTOR:
      baseRole = "faculty";
      break;
    case Role.ADMIN_STAFF:
      baseRole = "admin";
      break;
    default:
      baseRole = "student";
  }

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

  for (const room of selectedRooms) {
    // Skip limits if maxHour/minHour is not provided for the room
    if (!room.maxHour && !room.minHour) {
      continue;
    }

    // Get maxHour and minHour based on booking type
    let roomMaxHour: number;
    let roomMinHour: number;

    if (isVIP) {
      // For VIP: no fallback to regular role limits
      roomMaxHour = room.maxHour?.[vipRoleField] ?? DEFAULT_MAX_HOURS;
      roomMinHour = room.minHour?.[vipRoleField] ?? DEFAULT_MIN_HOURS;
    } else if (isWalkIn) {
      // For walk-in: no fallback to regular role limits
      roomMaxHour = room.maxHour?.[walkInRoleField] ?? DEFAULT_MAX_HOURS;
      roomMinHour = room.minHour?.[walkInRoleField] ?? DEFAULT_MIN_HOURS;
    } else {
      // For regular bookings: use role-specific limit or default
      roomMaxHour = room.maxHour?.[baseRoleField] ?? DEFAULT_MAX_HOURS;
      roomMinHour = room.minHour?.[baseRoleField] ?? DEFAULT_MIN_HOURS;
    }

    // Use the most restrictive (lowest) maxHour
    if (roomMaxHour < maxHours) {
      maxHours = roomMaxHour;
    }

    // Use the most restrictive (highest) minHour
    if (roomMinHour > minHours) {
      minHours = roomMinHour;
    }
  }

  return { maxHours, minHours };
}

export { DEFAULT_MAX_HOURS, DEFAULT_MIN_HOURS };
