export const isProductionEnvironment = (): boolean =>
  process.env.NEXT_PUBLIC_BRANCH_NAME === "production";

type EnvironmentCalendarResource = {
  calendarId: string;
  calendarIdDev?: string;
  calendarIdProd?: string;
  resourceId?: string | number | null;
  roomId?: string | number | null;
  name?: string;
};

/**
 * Thrown for a single resource that has no production calendar id.
 * Batch resolution catches this and skips that resource; it must not abort
 * the rest of the tenant.
 */
export class MissingProductionCalendarError extends Error {
  constructor(resourceLabel: string) {
    super(
      resourceLabel
        ? `Production calendar ID not configured for resource ${resourceLabel}`
        : "Production calendar ID not configured for resource",
    );
    this.name = "MissingProductionCalendarError";
  }
}

const calendarResourceLabel = (
  resource: EnvironmentCalendarResource,
): string => {
  const id = String(resource.resourceId ?? resource.roomId ?? "").trim();
  if (id) return id;
  return String(resource.name ?? "").trim();
};

export const getEnvironmentCalendarId = (
  resource: EnvironmentCalendarResource,
): string => {
  if (isProductionEnvironment()) {
    const calendarIdProd = resource.calendarIdProd?.trim() ?? "";
    if (!calendarIdProd) {
      throw new MissingProductionCalendarError(calendarResourceLabel(resource));
    }
    return calendarIdProd;
  }

  return resource.calendarIdDev || resource.calendarId;
};

export const applyEnvironmentCalendarId = <
  T extends EnvironmentCalendarResource,
>(
  resource: T,
): T => {
  const selectedCalendarId = getEnvironmentCalendarId(resource);
  return {
    ...resource,
    calendarId: selectedCalendarId,
  };
};

/**
 * Resolve each resource on its own. A resource missing `calendarIdProd` is
 * skipped and logged in production so one annex, child, or unused room cannot
 * blank the calendar id of every other resource in the tenant.
 */
export const applyEnvironmentCalendarIds = <
  T extends EnvironmentCalendarResource,
>(
  resources: T[],
): T[] => {
  const resolved: T[] = [];
  for (const resource of resources) {
    try {
      resolved.push(applyEnvironmentCalendarId(resource));
    } catch (error) {
      if (!(error instanceof MissingProductionCalendarError)) throw error;
      console.error(
        `Skipping resource during calendar id resolution: ${error.message}`,
      );
    }
  }
  return resolved;
};
