export const isProductionEnvironment = (): boolean => {
  return process.env.NEXT_PUBLIC_BRANCH_NAME === "production";
};

export const getEnvironmentCalendarId = (resource: {
  calendarId: string;
  calendarIdDev?: string;
  calendarIdProd?: string;
}): string => {
  if (isProductionEnvironment()) {
    if (!resource.calendarIdProd) {
      throw new Error(`Production calendar ID not configured for resource`);
    }
    return resource.calendarIdProd;
  }
  
  return resource.calendarIdDev || resource.calendarId;
};

export const applyEnvironmentCalendarId = <T extends { 
  calendarId: string; 
  calendarIdDev?: string;
  calendarIdProd?: string;
}>(
  resource: T
): T => {
  const selectedCalendarId = getEnvironmentCalendarId(resource);
  return {
    ...resource,
    calendarId: selectedCalendarId,
  };
};

export const applyEnvironmentCalendarIds = <T extends { 
  calendarId: string; 
  calendarIdDev?: string;
  calendarIdProd?: string;
}>(
  resources: T[]
): T[] => {
  return resources.map(applyEnvironmentCalendarId);
};

