/**
 * Calendar environment utilities
 * Handles selection of appropriate calendar IDs based on deployment environment
 */

/**
 * Check if we're running in the production environment
 */
export const isProductionEnvironment = (): boolean => {
  return process.env.NEXT_PUBLIC_BRANCH_NAME === "production";
};

/**
 * Get the appropriate calendar ID for the current environment
 * @param resource - Resource object with calendar ID fields
 * @returns The appropriate calendar ID for the current environment
 */
export const getEnvironmentCalendarId = (resource: {
  calendarId: string;
  calendarIdDev?: string;
  calendarIdProd?: string;
  calendarProdId?: string; // Alternative field name for backwards compatibility
}): string => {
  // If in production, use production calendar ID
  if (isProductionEnvironment()) {
    // Try calendarIdProd first (matches Firestore field name)
    if (resource.calendarIdProd) {
      return resource.calendarIdProd;
    }
    // Fallback to calendarProdId (alternative naming)
    if (resource.calendarProdId) {
      return resource.calendarProdId;
    }
  }
  
  // For development/staging, use development calendar ID
  // Priority: calendarIdDev > calendarId (legacy)
  if (resource.calendarIdDev) {
    return resource.calendarIdDev;
  }
  
  // Fallback to legacy calendarId field
  return resource.calendarId;
};

/**
 * Apply environment-based calendar ID selection to a resource object
 * Mutates the resource object to set calendarId to the appropriate value
 * @param resource - Resource object to process
 * @returns The same resource object with calendarId set appropriately
 */
export const applyEnvironmentCalendarId = <T extends { 
  calendarId: string; 
  calendarIdDev?: string;
  calendarIdProd?: string;
  calendarProdId?: string;
}>(
  resource: T
): T => {
  const selectedCalendarId = getEnvironmentCalendarId(resource);
  return {
    ...resource,
    calendarId: selectedCalendarId,
  };
};

/**
 * Apply environment-based calendar ID selection to an array of resources
 * @param resources - Array of resource objects
 * @returns New array with calendar IDs selected based on environment
 */
export const applyEnvironmentCalendarIds = <T extends { 
  calendarId: string; 
  calendarIdDev?: string;
  calendarIdProd?: string;
  calendarProdId?: string;
}>(
  resources: T[]
): T[] => {
  return resources.map(applyEnvironmentCalendarId);
};

