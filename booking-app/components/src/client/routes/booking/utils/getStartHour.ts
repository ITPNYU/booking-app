import { FormContextLevel } from "@/components/src/types";

const DEFAULT_START_HOUR = "9:00:00";

/**
 * Gets the startHour for a given form context from the tenant schema
 * @param startHourConfig - The startHour config from the schema
 * @param formContext - The current form context (VIP, WALK_IN, etc.)
 * @returns The start hour (e.g., "6:00:00" or "9:00:00")
 */
export function getStartHour(
  startHourConfig: {
    isVIP?: string;
    isStudent?: string;
  } | undefined,
  formContext: FormContextLevel
): string {
  if (!startHourConfig) {
    return DEFAULT_START_HOUR;
  }

  // Determine the key based on formContext
  let contextKey: keyof typeof startHourConfig;

  if (formContext === FormContextLevel.VIP) {
    contextKey = "isVIP";
  } else {
    contextKey = "isStudent";
  }

  return startHourConfig[contextKey] || DEFAULT_START_HOUR;
}
