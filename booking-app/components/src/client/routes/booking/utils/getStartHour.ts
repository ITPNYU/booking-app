import { FormContextLevel, Role } from "@/components/src/types";
import { buildCalendarConfigKey } from "./buildCalendarConfigKey";

export const DEFAULT_START_HOUR = "09:00:00";

/**
 * Gets the startHour for a given form context and role from the tenant schema
 * @param calendarConfig - The calendarConfig from the schema with startHour map
 * @param formContext - The current form context (VIP, WALK_IN, etc.)
 * @param role - The user's role (Student, Faculty, Admin, etc.)
 * @returns The start hour (e.g., "06:00:00" or "09:00:00")
 */
export function getStartHour(
  calendarConfig:
    | {
        startHour?: Record<string, string>;
        slotUnit?: Record<string, number>;
      }
    | undefined,
  formContext: FormContextLevel,
  role: Role | undefined
): string {
  if (!calendarConfig?.startHour) {
    return DEFAULT_START_HOUR;
  }

  const key = buildCalendarConfigKey(formContext, role);
  return calendarConfig.startHour[key] || DEFAULT_START_HOUR;
}
