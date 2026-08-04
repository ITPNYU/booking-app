/**
 * Tenant utility functions to avoid repetition of tenant checks
 */

import { TENANTS } from "../constants/tenants";
import { isMcPassiveSetupDefault } from "@/lib/tenant/mcResourceServices";

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
export const isMediaCommons = (tenant?: string): boolean =>
  tenant === TENANTS.MC || tenant === TENANTS.MEDIA_COMMONS;

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

/** True when a service field is a non-empty value other than case-insensitive "no". */
const isServiceRequested = (value: unknown): boolean => {
  if (value == null) return false;
  const normalized = String(value).trim().toLowerCase();
  return normalized !== "" && normalized !== "no";
};

const isActiveSetupSelection = (value: unknown): boolean => {
  if (!isServiceRequested(value)) return false;
  const raw = String(value).trim();
  // Layout ids that are schema defaults without chartfields do not require setup staff.
  if (isMcPassiveSetupDefault(raw)) return false;
  return true;
};

/**
 * Detect Media Commons service requests from booking data
 * This function provides consistent service detection logic across the application
 */
export const getMediaCommonsServices = (data: any) => {
  const byRoomValues = Object.values(data.roomSetupByRoom ?? {});
  const setupFromByRoom = byRoomValues.some((v) => isActiveSetupSelection(v));
  // Legacy scalars remain additive so mixed schema+generic multi-room bookings
  // still surface a genuine setup request from co-selected non-schema rooms.
  // Passive schema defaults mirrored into setupDetails are ignored via
  // isActiveSetupSelection / isMcPassiveSetupDefault (value + label).
  const setupFromLegacy =
    isActiveSetupSelection(data.setupDetails) ||
    (isServiceRequested(data.roomSetup) &&
      String(data.roomSetup).trim().toLowerCase() !== "yes");
  // Additional event furniture requires CBS/work-order review. Fold into setup
  // so auto-approval is blocked and existing setup approvers are notified —
  // there is no separate furnishings XState service yet.
  const furnishingsRequested = Object.values(
    data.furnishingsByRoom ?? {},
  ).some((v: unknown) => isServiceRequested(v));

  return {
    staff:
      isServiceRequested(data.staffingServices) ||
      isServiceRequested(data.staffingServicesDetails),
    setup: setupFromByRoom || setupFromLegacy || furnishingsRequested,
    equipment:
      isServiceRequested(data.mediaServices) ||
      isServiceRequested(data.equipmentServices) ||
      isServiceRequested(data.equipmentServicesDetails) ||
      Object.values(data.equipmentServicesDetailsByRoom ?? {}).some(
        (v: unknown) => isServiceRequested(v),
      ),
    catering: isServiceRequested(data.catering),
    cleaning: isServiceRequested(data.cleaningService),
    security: isServiceRequested(data.hireSecurity),
  };
};
