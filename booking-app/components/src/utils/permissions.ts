import { PagePermission } from "../types";

/**
 * Permission hierarchy definition
 * Defines which lower-level permissions each permission includes
 */
const PERMISSION_HIERARCHY: Record<PagePermission, PagePermission[]> = {
  [PagePermission.SUPER_ADMIN]: [
    PagePermission.SUPER_ADMIN,
    PagePermission.ADMIN,
    PagePermission.SERVICES,
    PagePermission.LIAISON,
    PagePermission.PA,
    PagePermission.BOOKING,
  ],
  [PagePermission.ADMIN]: [
    PagePermission.ADMIN,
    PagePermission.SERVICES,
    PagePermission.LIAISON,
    PagePermission.PA,
    PagePermission.BOOKING,
  ],
  [PagePermission.PA]: [PagePermission.PA, PagePermission.BOOKING],
  [PagePermission.LIAISON]: [PagePermission.LIAISON, PagePermission.BOOKING],
  [PagePermission.SERVICES]: [PagePermission.SERVICES, PagePermission.BOOKING],
  [PagePermission.BOOKING]: [PagePermission.BOOKING],
};

/**
 * Check if user has the specified permission
 */
export function hasPermission(
  userPermission: PagePermission,
  requiredPermission: PagePermission
): boolean {
  const allowedPermissions = PERMISSION_HIERARCHY[userPermission] || [];
  return allowedPermissions.includes(requiredPermission);
}

/**
 * Check if user has any of the specified permissions
 */
export function hasAnyPermission(
  userPermission: PagePermission,
  requiredPermissions: PagePermission[]
): boolean {
  return requiredPermissions.some((permission) =>
    hasPermission(userPermission, permission)
  );
}

/**
 * Check if user has permission to access WebCheckout functionality
 */
export function canAccessWebCheckout(userPermission: PagePermission): boolean {
  return hasAnyPermission(userPermission, [
    PagePermission.PA,
    PagePermission.SERVICES,
    PagePermission.ADMIN,
    PagePermission.SUPER_ADMIN,
  ]);
}

/**
 * Check if user has permission to access Admin functionality
 */
export function canAccessAdmin(userPermission: PagePermission): boolean {
  return hasAnyPermission(userPermission, [
    PagePermission.ADMIN,
    PagePermission.SUPER_ADMIN,
  ]);
}

/**
 * Check if user has minimum permission level or higher
 */
export function hasMinimumPermission(
  userPermission: PagePermission,
  minimumPermission: PagePermission
): boolean {
  return hasPermission(userPermission, minimumPermission);
}
