import { PagePermission } from "../types";

/**
 * Converts a PagePermission to its corresponding URL path segment.
 * Used for routing users to their role-specific pages.
 *
 * @param permission - The PagePermission to convert
 * @returns The URL path segment (e.g., "admin", "pa", "liaison") or "" for BOOKING
 */
export const getPathFromPermission = (permission: PagePermission): string => {
  switch (permission) {
    case PagePermission.PA:
      return "pa";
    case PagePermission.ADMIN:
      return "admin";
    case PagePermission.LIAISON:
      return "liaison";
    case PagePermission.SERVICES:
      return "services";
    case PagePermission.SUPER_ADMIN:
      return "super";
    case PagePermission.BOOKING:
    default:
      return "";
  }
};

/**
 * Builds a full path for a given tenant and permission.
 *
 * @param tenant - The tenant slug (e.g., "mc")
 * @param permission - The PagePermission to build the path for
 * @returns The full path (e.g., "/mc/admin")
 */
export const buildPathForPermission = (
  tenant: string | undefined,
  permission: PagePermission
): string => {
  const pathSegment = getPathFromPermission(permission);
  if (!pathSegment) {
    return tenant ? `/${tenant}` : "/";
  }
  return tenant ? `/${tenant}/${pathSegment}` : `/${pathSegment}`;
};
