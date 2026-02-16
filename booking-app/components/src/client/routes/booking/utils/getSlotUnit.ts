import { FormContextLevel, Role } from "@/components/src/types";
import { buildCalendarConfigKey } from "./buildCalendarConfigKey";

const DEFAULT_SLOT_UNIT = 15;

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

  const key = buildCalendarConfigKey(formContext, role);
  return calendarConfig.slotUnit[key] || DEFAULT_SLOT_UNIT;
}

export { DEFAULT_SLOT_UNIT };
