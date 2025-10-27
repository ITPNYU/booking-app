import { Role } from "@/components/src/types";
import { Resource } from "../../components/SchemaProvider";

// No default limits - allow any duration
const DEFAULT_MAX_HOURS = Number.POSITIVE_INFINITY;
const DEFAULT_MIN_HOURS = 0;

/**
 * Maps Role enum to the appropriate field name for maxHour/minHour
 * @param role - The user's role
 * @param isWalkIn - Whether this is a walk-in booking
 * @returns The field name to use (e.g., "student", "studentWalkIn", "faculty", etc.)
 */
function getRoleFieldName(
  role: Role | undefined,
  isWalkIn: boolean
): keyof Resource["maxHour"] {
  if (!role) {
    // Default to student if role is not set
    return isWalkIn ? "studentWalkIn" : "student";
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

  return isWalkIn
    ? (`${baseRole}WalkIn` as keyof Resource["maxHour"])
    : baseRole;
}

/**
 * Gets the maximum and minimum hours allowed for a booking based on role and resources
 * @param selectedRooms - The rooms selected for booking
 * @param role - The user's role
 * @param isWalkIn - Whether this is a walk-in booking
 * @returns Object with maxHours and minHours (defaults: 4 and 0.5)
 */
export function getBookingHourLimits(
  selectedRooms: any[],
  role: Role | undefined,
  isWalkIn: boolean
): { maxHours: number; minHours: number } {
  if (!selectedRooms || selectedRooms.length === 0) {
    return { maxHours: DEFAULT_MAX_HOURS, minHours: DEFAULT_MIN_HOURS };
  }

  // Get the base role field (without walk-in)
  const baseRoleField = getRoleFieldName(role, false);
  // Get the walk-in specific field
  const walkInRoleField = getRoleFieldName(role, true);

  // Find the most restrictive limits across all selected rooms
  let maxHours = DEFAULT_MAX_HOURS;
  let minHours = DEFAULT_MIN_HOURS;

  for (const room of selectedRooms) {
    // Skip limits if maxHour/minHour is not provided for the room
    if (!room.maxHour && !room.minHour) {
      continue;
    }

    // Get maxHour with fallback logic
    const roomMaxHour = isWalkIn
      ? (room.maxHour?.[walkInRoleField] ?? // Try walk-in specific limit
         room.maxHour?.[baseRoleField] ?? // Fall back to regular role limit
         DEFAULT_MAX_HOURS) // Finally use default
      : (room.maxHour?.[baseRoleField] ?? DEFAULT_MAX_HOURS);

    // Get minHour with fallback logic
    const roomMinHour = isWalkIn
      ? (room.minHour?.[walkInRoleField] ?? // Try walk-in specific limit
         room.minHour?.[baseRoleField] ?? // Fall back to regular role limit
         DEFAULT_MIN_HOURS) // Finally use default
      : (room.minHour?.[baseRoleField] ?? DEFAULT_MIN_HOURS);

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
