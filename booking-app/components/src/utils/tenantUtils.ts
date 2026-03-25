/**
 * Tenant utility functions to avoid repetition of tenant checks
 */

import { TENANTS } from "../constants/tenants";

/**
 * NYU Identity API dept_code values that identify ITP / IMA / Low Res affiliated users.
 */
export const ITP_DEPT_CODES = [
  "GTITPG", // Interactive Telecommunications
  "TIIMA",  // Low Res anomaly
  "TS1001", // Interactive Telecommunications Program (Administrators)
  "TS1067", // Interactive Telecommunications Program (Staff)
  "TS1068", // Interactive Telecommunications Program (Student Workers)
  "TS1123", // Interactive Telecommunications Program (Adjunct Faculty)
  "TS1124", // Interactive Telecommunications Program Academic Administrative Appointments
  "TS1125", // Interactive Telecommunications Program (Full Time Faculty)
  "TS1126", // Interactive Telecommunications Program (Post Doctoral Fellows and Researchers)
  "TS1139", // Interactive Telecommunications Program (Tech Operations)
  "TS1184", // Interactive Telecommunications Program
  "TS1265", // Interactive Telecommunications Program (Administrators)
  "TS3350", // Interactive Telecommunications Program Additional Compensation
  "TS3382", // Interactive Media Arts UG Program
  "TS3383", // Interactive Media Arts UG Program (Administrators)
  "TS3384", // Interactive Media Arts UG Program (Faculty)
  "TS3385", // Interactive Media Arts UG Program (Adjuncts)
  "TS3386", // Interactive Media Arts UG Program (Clerical Positions)
  "TS3387", // Interactive Media Arts UG Program (Technical Staff)
  "TS3388", // Interactive Media Arts UG Program (Students)
  "TS3389", // Interactive Media Arts Low Residency Program
  "TS3390", // Interactive Media Arts Low Residency Program (Administrator)
  "TS3391", // Interactive Media Arts Low Residency Program (Faculty)
  "TS3392", // Interactive Media Arts Low Residency Program (Adjuncts)
  "TS3393", // Interactive Media Arts Low Residency Program (Clerical Positions)
  "TS3394", // Interactive Media Arts Low Residency Program (Technical Staff)
  "TS3395", // Interactive Media Arts Low Residency Program (Students)
  "UTIMNY", // Interactive Media Arts
  "UTITPG", // Interactive Telecommunications
];

/**
 * Keywords matched case-insensitively against department name fields.
 * Used internally for matching approver records stored in Firestore (which use
 * human-readable labels, not dept_codes). Not used for NYU API entitlement checks.
 */
export const ITP_DEPT_NAME_KEYWORDS = [
  "interactive telecommunications", // ITP
  "interactive media arts", // IMA (e.g. "Interactive Media Arts UG Program")
  "low res", // Low Residence program
  "low-res",
];

/**
 * Short-form department abbreviations used in approver records that belong to
 * the ITP / IMA / Low Res group. Matched with exact (case-insensitive) equality
 * to avoid substring false-positives (e.g. "ima" inside "imaging sciences").
 */
export const ITP_GROUP_SHORT_NAMES = ["itp", "ima"];

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
