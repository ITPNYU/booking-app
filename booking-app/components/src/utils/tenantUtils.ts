/**
 * Tenant utility functions to avoid repetition of tenant checks
 */

import { TENANTS } from "../constants/tenants";

/**
 * Keywords matched case-insensitively against department name fields to identify
 * ITP / IMA / Low Res affiliated users.
 */
export const ITP_DEPT_NAME_KEYWORDS = [
  "interactive telecommunications", // ITP
  "interactive media arts", // IMA (e.g. "Interactive Media Arts UG Program")
  "low res", // Low Residence program
  "low-res",
];

export type Tenant = (typeof TENANTS)[keyof typeof TENANTS];

/**
 * Check if a tenant is ITP
 */
export const isITP = (tenant?: string): boolean => tenant === TENANTS.ITP;

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
export const shouldUseXState = (tenant?: string): boolean => true;

/**
 * Get tenant-specific flags
 */
export const getTenantFlags = (tenant?: string) => ({
  isITP: isITP(tenant),
  isMediaCommons: isMediaCommons(tenant),
  usesXState: shouldUseXState(tenant),
});

/**
 * Detect Media Commons service requests from booking data
 * This function provides consistent service detection logic across the application
 */
export const getMediaCommonsServices = (data: any) => ({
  staff:
    !!data.staffingServicesDetails && data.staffingServicesDetails !== "no",
  setup: !!data.setupDetails && data.setupDetails !== "no",
  equipment:
    (!!data.mediaServices && data.mediaServices !== "no") ||
    (!!data.equipmentServices && data.equipmentServices !== "no") ||
    (!!data.equipmentServicesDetails && data.equipmentServicesDetails !== "no"),
  catering: !!data.catering && data.catering !== "no",
  cleaning: !!data.cleaningService && data.cleaningService !== "no",
  security: !!data.hireSecurity && data.hireSecurity !== "no",
});
