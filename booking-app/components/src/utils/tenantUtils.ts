/**
 * Tenant utility functions to avoid repetition of tenant checks
 */

import { TENANTS } from "../constants/tenants";
import type { MediaCommonsServiceFlags } from "../types";
import {
  getServiceRooms,
  getServiceSectionConfig,
  getServiceResourceId,
  isPassiveSetupSelection,
  type ServiceResourceLike,
} from "./resourceServicesUtils";
import type { ResourceServiceKey } from "../client/routes/components/schemaTypes";

/**
 * NYU Identity API dept_code values that identify ITP / IMA / Low Res affiliated users.
 */
export const ITP_DEPT_CODES = [
  "GTITPG", // Interactive Telecommunications
  "TIIMA", // Low Res anomaly
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

/**
 * True when a service field is a non-empty value other than case-insensitive "no".
 * Use this instead of `=== "yes"` for legacy service scalars: multi-room bookings
 * join distinct per-room values (e.g. hireSecurity "yes; willoughby").
 */
export const isServiceRequested = (value: unknown): boolean => {
  if (value == null) return false;
  const normalized = String(value).trim().toLowerCase();
  return normalized !== "" && normalized !== "no";
};

const isActiveSetupSelection = (
  value: unknown,
  resources: ServiceResourceLike[],
): boolean => {
  if (!isServiceRequested(value)) return false;
  const raw = String(value).trim();
  // Layout ids that are schema defaults without chartfields do not require setup staff.
  if (isPassiveSetupSelection(resources, raw)) return false;
  return true;
};

/**
 * Detect Media Commons service requests from booking data.
 * `resources` are the tenant schema resources (Firestore is the source of
 * truth for service configs); they decide which room setup values are passive
 * defaults rather than real setup requests.
 */
export const getMediaCommonsServices = (
  data: any,
  resources: ServiceResourceLike[],
) => {
  const byRoomValues = Object.values(data.roomSetupByRoom ?? {});
  const setupFromByRoom = byRoomValues.some((v) =>
    isActiveSetupSelection(v, resources),
  );
  // Legacy scalars remain additive so mixed schema+generic multi-room bookings
  // still surface a genuine setup request from co-selected non-schema rooms.
  // Passive schema defaults mirrored into setupDetails are ignored via
  // isActiveSetupSelection / isPassiveSetupSelection (value + label).
  const setupFromLegacy =
    isActiveSetupSelection(data.setupDetails, resources) ||
    (isServiceRequested(data.roomSetup) &&
      String(data.roomSetup).trim().toLowerCase() !== "yes");
  // Additional event furniture is its own service region in the MC machine
  // ("Furnishings Request" / "Furnishings Closeout").
  const furnishingsRequested = Object.values(data.furnishingsByRoom ?? {}).some(
    (v: unknown) => isServiceRequested(v),
  );

  return {
    staff: isServiceRequested(data.staffingServices),
    setup: setupFromByRoom || setupFromLegacy,
    furnishings: furnishingsRequested,
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

/** Machine context key → key of the room's `services` config. */
const SERVICE_SCHEMA_KEYS: Record<
  keyof MediaCommonsServiceFlags,
  ResourceServiceKey
> = {
  staff: "staffing",
  equipment: "equipment",
  catering: "catering",
  cleaning: "cleaning",
  security: "security",
  setup: "setup",
  furnishings: "furnishings",
};

/**
 * Rooms whose service config applies to a saved booking: every room in
 * `roomId` plus every annex space picked under them (annex spaces carry their
 * own `services`). Unknown ids resolve to nothing.
 */
export const getBookingServiceRooms = (
  data: Record<string, unknown> | null | undefined,
  resources: ServiceResourceLike[],
): ServiceResourceLike[] => {
  const roomIds = new Set(
    String(data?.roomId ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean),
  );
  const selectedRooms = resources.filter((r) =>
    roomIds.has(getServiceResourceId(r)),
  );
  const annexByRoom =
    data?.annexByRoom && typeof data.annexByRoom === "object"
      ? (data.annexByRoom as Record<string, string[]>)
      : undefined;
  return getServiceRooms(selectedRooms, annexByRoom, resources);
};

/**
 * Which MC services the system closes out on its own once the booking
 * reaches Service Closeout: a service is flagged when any booked room sets
 * `autoCloseout: true` for it in the tenant schema. Only flagged services are
 * returned; the machine reads an absent key as "manual closeout".
 */
export const getMediaCommonsAutoCloseout = (
  data: Record<string, unknown> | null | undefined,
  resources: ServiceResourceLike[],
): MediaCommonsServiceFlags => {
  const rooms = getBookingServiceRooms(data, resources);
  const flags: MediaCommonsServiceFlags = {};
  for (const [service, schemaKey] of Object.entries(SERVICE_SCHEMA_KEYS) as [
    keyof MediaCommonsServiceFlags,
    ResourceServiceKey,
  ][]) {
    if (
      rooms.some(
        (room) =>
          getServiceSectionConfig(room, schemaKey)?.autoCloseout === true,
      )
    ) {
      flags[service] = true;
    }
  }
  return flags;
};
