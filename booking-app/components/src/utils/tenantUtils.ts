/**
 * Tenant utility functions to avoid repetition of tenant checks
 */

import { TENANTS } from "../constants/tenants";

export type Tenant = (typeof TENANTS)[keyof typeof TENANTS];

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
