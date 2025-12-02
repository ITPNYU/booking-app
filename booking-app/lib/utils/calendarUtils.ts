import { DevBranch } from "@/components/src/types";

/**
 * Gets the appropriate calendar ID for a resource based on the current environment.
 * 
 * Priority order:
 * - Production environment: Use calendarProdId if available, fallback to calendarId
 * - Staging environment: Use calendarStagingId if available, fallback to calendarId
 * - Development/other: Use calendarId
 * 
 * @param resource - The resource object containing calendar IDs
 * @returns The appropriate calendar ID for the current environment
 */
export function getCalendarId(resource: {
  calendarId: string;
  calendarStagingId?: string;
  calendarProdId?: string;
}): string {
  const branchName = process.env.NEXT_PUBLIC_BRANCH_NAME as DevBranch;

  // Production environment: prefer calendarProdId
  if (branchName === "production" && resource.calendarProdId) {
    return resource.calendarProdId;
  }

  // Staging environment: prefer calendarStagingId
  if (branchName === "staging" && resource.calendarStagingId) {
    return resource.calendarStagingId;
  }

  // Default: use calendarId (for development and as fallback)
  return resource.calendarId;
}
