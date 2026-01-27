import { FormContextLevel, Role } from "@/components/src/types";

/**
 * Builds a calendar config key from formContext and role.
 * Examples:
 * - VIP + Student -> "studentVIP"
 * - WALK_IN + Admin -> "adminWalkIn"
 * - FULL_FORM + Student -> "student"
 */
export function buildCalendarConfigKey(
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
        return "student"; // fallback
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
