import { FormContextLevel, Role } from "@/components/src/types";

const DEFAULT_SLOT_UNIT = 15;

/**
 * Builds a calendar config key from formContext and role
 * (same logic as getStartHour for consistency)
 */
function buildConfigKey(
  formContext: FormContextLevel,
  role: Role | undefined
): string {
  const rolePrefix = (() => {
    switch (role) {
      case Role.STUDENT:
        return "student";
      case Role.FACULTY:
      case Role.RESIDENT_FELLOW:
        return "faculty";
      case Role.ADMIN_STAFF:
      case Role.CHAIR_PROGRAM_DIRECTOR:
        return "admin";
      default:
        return "student";
    }
  })();

  switch (formContext) {
    case FormContextLevel.VIP:
      return `${rolePrefix}VIP`;
    case FormContextLevel.WALK_IN:
      return `${rolePrefix}WalkIn`;
    case FormContextLevel.FULL_FORM:
    case FormContextLevel.EDIT:
    case FormContextLevel.MODIFICATION:
    default:
      return rolePrefix;
  }
}

/**
 * Gets the slotUnit (in minutes) for a given form context and role from the tenant schema
 * @param calendarConfig - The calendarConfig from the schema with slotUnit map
 * @param formContext - The current form context (VIP, WALK_IN, etc.)
 * @param role - The user's role (Student, Faculty, Admin, etc.)
 * @returns The slot unit in minutes (e.g., 15)
 */
export function getSlotUnit(
  calendarConfig:
    | {
        startHour?: Record<string, string>;
        slotUnit?: Record<string, number>;
      }
    | undefined,
  formContext: FormContextLevel,
  role: Role | undefined
): number {
  if (!calendarConfig?.slotUnit) {
    return DEFAULT_SLOT_UNIT;
  }

  const key = buildConfigKey(formContext, role);
  return calendarConfig.slotUnit[key] || DEFAULT_SLOT_UNIT;
}

export { DEFAULT_SLOT_UNIT };
