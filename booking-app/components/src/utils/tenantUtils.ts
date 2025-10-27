/**
 * Tenant utility functions to avoid repetition of tenant checks
 */

import { TENANTS } from "../constants/tenants";
import { Department, Role } from "../types";

export type Tenant = (typeof TENANTS)[keyof typeof TENANTS];

/**
 * Maps an affiliation to a role using roleMapping
 * Used for auto-populating user roles from NYU Identity data
 */
export const mapAffiliationToRole = (
  roleMapping: Record<string, string[]>,
  affiliation?: string,
): Role | undefined => {
  if (!affiliation) return undefined;

  const normalizedAffiliation = affiliation.toUpperCase();

  for (const [role, affiliations] of Object.entries(roleMapping)) {
    if (affiliations.includes(normalizedAffiliation)) {
      return role as Role;
    }
  }

  return undefined;
};

/**
 * Maps a department code to a department using programMapping
 * Used for auto-populating user departments from NYU Identity data
 * Returns undefined if no match found (caller should handle default)
 */
export const mapDepartmentCode = (
  programMapping: Record<string, string[]>,
  deptCode?: string,
): string | undefined => {
  if (!deptCode) return undefined;

  const normalizedCode = deptCode.toUpperCase();

  for (const [dept, codes] of Object.entries(programMapping)) {
    if (codes.includes(normalizedCode)) {
      return dept;
    }
  }

  return undefined;
};

/**
 * Check if a tenant is ITP
 */
export const isITP = (tenant?: string): boolean => {
  return tenant === TENANTS.ITP;
};

/**
 * Check if a tenant is Media Commons (supports both "mediaCommons" and "mc")
 */
export const isMediaCommons = (tenant?: string): boolean => {
  console.log("tenant", tenant);
  return tenant === TENANTS.MC || tenant === TENANTS.MEDIA_COMMONS;
};

/**
 * Check if a tenant should use XState
 */
export const shouldUseXState = (tenant?: string): boolean => {
  return true;
};

/**
 * Get tenant-specific flags
 */
export const getTenantFlags = (tenant?: string) => {
  return {
    isITP: isITP(tenant),
    isMediaCommons: isMediaCommons(tenant),
    usesXState: shouldUseXState(tenant),
  };
};

/**
 * Detect Media Commons service requests from booking data
 * This function provides consistent service detection logic across the application
 */
export const getMediaCommonsServices = (data: any) => {
  return {
    setup: !!data.roomSetup && data.roomSetup !== "no",
    staff: !!data.staffingServicesDetails && data.staffingServicesDetails !== "no",
    equipment: !!data.equipmentServices && data.equipmentServices !== "no",
    catering: !!data.catering && data.catering !== "no",
    cleaning: !!data.cleaningService && data.cleaningService !== "no",
    security: !!data.hireSecurity && data.hireSecurity !== "no",
  };
};
