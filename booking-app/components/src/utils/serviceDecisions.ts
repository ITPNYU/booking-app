import type { Inputs, MediaCommonsServiceFlags } from "../types";

/**
 * Service decisions: an approver's answer per requested service (approved,
 * declined, or pending). Media Commons only. Persisted on the booking as the
 * `*ServiceApproved` booleans and mirrored as `servicesApproved` in the MC
 * machine context. A key that is absent means the service is still pending.
 */
export type ServiceDecisions = MediaCommonsServiceFlags;

export type MediaCommonsServiceKey = keyof MediaCommonsServiceFlags;

/** Canonical key order: matches the machine context and the bookings table. */
export const MEDIA_COMMONS_SERVICE_KEYS = [
  "staff",
  "equipment",
  "catering",
  "cleaning",
  "security",
  "setup",
  "furnishings",
] as const satisfies readonly MediaCommonsServiceKey[];

export type ServiceApprovalField = `${MediaCommonsServiceKey}ServiceApproved`;

/** Booking field that stores each service's decision. */
export const SERVICE_APPROVAL_FIELDS: Record<
  MediaCommonsServiceKey,
  ServiceApprovalField
> = {
  staff: "staffServiceApproved",
  equipment: "equipmentServiceApproved",
  catering: "cateringServiceApproved",
  cleaning: "cleaningServiceApproved",
  security: "securityServiceApproved",
  setup: "setupServiceApproved",
  furnishings: "furnishingsServiceApproved",
};

/**
 * Read a booking's service decisions from its approval flags. Only explicit
 * booleans count: a cleared (deleted or null) flag is a pending service.
 */
export function getServiceDecisions(
  booking: Record<string, unknown> | null | undefined,
): ServiceDecisions {
  const decisions: ServiceDecisions = {};
  if (!booking) return decisions;
  for (const key of MEDIA_COMMONS_SERVICE_KEYS) {
    const value = booking[SERVICE_APPROVAL_FIELDS[key]];
    if (typeof value === "boolean") decisions[key] = value;
  }
  return decisions;
}

/**
 * Every form field that belongs to a service section, per service key: the
 * toggle or choice, the detail text and the chartfield, both in the per-room
 * maps and in the legacy flat fields. A change to any of them is a change to
 * that service's request (ADR-0001).
 */
export const SERVICE_REQUEST_FIELDS: Record<
  MediaCommonsServiceKey,
  readonly (keyof Inputs)[]
> = {
  staff: ["staffingServices"],
  equipment: [
    "equipmentServices",
    "equipmentServicesDetails",
    "equipmentServicesDetailsByRoom",
    "mediaServices",
    "mediaServicesDetails",
  ],
  catering: [
    "catering",
    "cateringService",
    "chartFieldForCatering",
    "cateringByRoom",
    "chartFieldForCateringByRoom",
  ],
  cleaning: [
    "cleaningService",
    "chartFieldForCleaning",
    "cleaningByRoom",
    "chartFieldForCleaningByRoom",
  ],
  security: [
    "hireSecurity",
    "chartFieldForSecurity",
    "hireSecurityByRoom",
    "chartFieldForSecurityByRoom",
  ],
  setup: [
    "roomSetup",
    "setupDetails",
    "chartFieldForRoomSetup",
    "roomSetupByRoom",
    "setupDetailsByRoom",
    "chartFieldForRoomSetupByRoom",
  ],
  furnishings: [
    "furnishingsDetails",
    "furnishingsByRoom",
    "chartFieldForFurnishingsByRoom",
    "furnishingsDetailsByRoom",
  ],
};

/**
 * One answer, in comparable form. "Not requested" is written three ways
 * across the form and saved bookings (absent, "", "no"); they are the same
 * answer. Surrounding whitespace is not a change either.
 */
function normalizeAnswer(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = String(value).trim();
  return text.toLowerCase() === "no" ? "" : text;
}

/** A field's value in comparable form: a scalar, or a per-room map without empty rooms. */
function normalizeField(value: unknown): string {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const rooms = Object.entries(value as Record<string, unknown>)
      .map(([roomId, answer]) => [roomId, normalizeAnswer(answer)] as const)
      .filter(([, answer]) => answer !== "")
      .sort(([a], [b]) => a.localeCompare(b));
    return rooms.length === 0 ? "" : JSON.stringify(rooms);
  }
  return normalizeAnswer(value);
}

/**
 * Which services' requests differ between a saved booking and a resubmission.
 * Compares the service section fields only, so Details changes (title,
 * attendance, contacts) never count. Returned in canonical key order.
 */
export function getChangedServiceKeys(
  before: Partial<Record<string, unknown>> | null | undefined,
  after: Partial<Record<string, unknown>> | null | undefined,
): MediaCommonsServiceKey[] {
  const saved = before ?? {};
  const submitted = after ?? {};
  return MEDIA_COMMONS_SERVICE_KEYS.filter((key) =>
    SERVICE_REQUEST_FIELDS[key].some(
      (field) =>
        normalizeField(saved[field]) !== normalizeField(submitted[field]),
    ),
  );
}
