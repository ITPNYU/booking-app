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

/** A per-room map and the legacy booking-level fields it stands in for. */
type ByRoomField = {
  field: keyof Inputs;
  /**
   * The flat fields the existing-booking loader fans this map out from when
   * a saved booking predates per-room maps, and that the form derives back
   * from the map (any room "yes" → "yes", chartfields joined per room).
   */
  legacy: readonly (keyof Inputs)[];
};

type ServiceFieldSet = {
  byRoom: readonly ByRoomField[];
  /** Booking-level answers that have no per-room map. */
  flat: readonly (keyof Inputs)[];
};

/**
 * Every form field that belongs to a service section, per service key: the
 * toggle or choice, the detail text and the chartfield, both in the per-room
 * maps and in the legacy flat fields. A change to any of them is a change to
 * that service's request (ADR-0001).
 */
export const SERVICE_REQUEST_FIELD_SETS: Record<
  MediaCommonsServiceKey,
  ServiceFieldSet
> = {
  staff: { byRoom: [], flat: ["staffingServices"] },
  equipment: {
    byRoom: [
      {
        field: "equipmentServicesDetailsByRoom",
        legacy: ["equipmentServicesDetails"],
      },
    ],
    flat: ["equipmentServices", "mediaServices", "mediaServicesDetails"],
  },
  catering: {
    byRoom: [
      { field: "cateringByRoom", legacy: ["catering"] },
      { field: "chartFieldForCateringByRoom", legacy: ["chartFieldForCatering"] },
    ],
    flat: ["cateringService"],
  },
  cleaning: {
    byRoom: [
      { field: "cleaningByRoom", legacy: ["cleaningService"] },
      { field: "chartFieldForCleaningByRoom", legacy: ["chartFieldForCleaning"] },
    ],
    flat: [],
  },
  security: {
    byRoom: [
      { field: "hireSecurityByRoom", legacy: ["hireSecurity"] },
      { field: "chartFieldForSecurityByRoom", legacy: ["chartFieldForSecurity"] },
    ],
    flat: [],
  },
  setup: {
    byRoom: [
      { field: "roomSetupByRoom", legacy: ["setupDetails", "roomSetup"] },
      { field: "setupDetailsByRoom", legacy: ["setupDetails"] },
      {
        field: "chartFieldForRoomSetupByRoom",
        legacy: ["chartFieldForRoomSetup"],
      },
    ],
    flat: [],
  },
  furnishings: {
    byRoom: [
      { field: "furnishingsByRoom", legacy: [] },
      { field: "chartFieldForFurnishingsByRoom", legacy: [] },
      { field: "furnishingsDetailsByRoom", legacy: ["furnishingsDetails"] },
    ],
    flat: [],
  },
};

/** Every field of a service section, per service key (maps, legacy and flat). */
export const SERVICE_REQUEST_FIELDS = MEDIA_COMMONS_SERVICE_KEYS.reduce(
  (fields, key) => {
    const { byRoom, flat } = SERVICE_REQUEST_FIELD_SETS[key];
    fields[key] = [
      ...new Set([
        ...byRoom.flatMap((entry) => [entry.field, ...entry.legacy]),
        ...flat,
      ]),
    ];
    return fields;
  },
  {} as Record<MediaCommonsServiceKey, readonly (keyof Inputs)[]>,
);

type Answers = Partial<Record<string, unknown>>;

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

/**
 * A per-room map's answers in comparable form, without unrequested rooms.
 * `null` when the booking carries no map at all (it predates per-room maps),
 * which is different from a map whose rooms all answered "no".
 */
function normalizeMap(value: unknown): Map<string, string> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const rooms = new Map<string, string>();
  for (const [roomId, answer] of Object.entries(value as Record<string, unknown>)) {
    const normalized = normalizeAnswer(answer);
    if (normalized !== "") rooms.set(roomId, normalized);
  }
  return rooms;
}

const sameMap = (a: Map<string, string>, b: Map<string, string>): boolean =>
  a.size === b.size && [...a].every(([roomId, answer]) => b.get(roomId) === answer);

/**
 * Whether a per-room map on one side matches the booking-level answer on the
 * other side, which carries no map: the loader fans that answer onto every
 * room, so the map is unchanged when every room still carries it, and an
 * all-"no" map is unchanged only when there was no answer to fan out.
 */
const matchesLegacyAnswer = (
  map: Map<string, string>,
  legacy: readonly (keyof Inputs)[],
  answers: Answers,
): boolean => {
  const legacyAnswers = new Set(
    legacy.map((field) => normalizeAnswer(answers[field])).filter(Boolean),
  );
  if (map.size === 0) return legacyAnswers.size === 0;
  return (
    legacyAnswers.size > 0 &&
    [...map.values()].every((answer) => legacyAnswers.has(answer))
  );
};

/** Whether one per-room map differs between the saved booking and the resubmission. */
function byRoomFieldChanged(
  { field, legacy }: ByRoomField,
  saved: Answers,
  submitted: Answers,
): boolean {
  const before = normalizeMap(saved[field]);
  const after = normalizeMap(submitted[field]);
  if (before && after) return !sameMap(before, after);
  if (!before && !after) {
    return legacy.some(
      (flat) => normalizeAnswer(saved[flat]) !== normalizeAnswer(submitted[flat]),
    );
  }
  return after
    ? !matchesLegacyAnswer(after, legacy, saved)
    : !matchesLegacyAnswer(before!, legacy, submitted);
}

/**
 * Which services' requests differ between a saved booking and a resubmission.
 * Compares the service section fields only, so Details changes (title,
 * attendance, contacts) never count. The flat scalars behind a per-room map
 * are derived from it by the form and are only compared when neither side
 * carries the map (legacy rooms). Returned in canonical key order.
 */
export function getChangedServiceKeys(
  before: Answers | null | undefined,
  after: Answers | null | undefined,
): MediaCommonsServiceKey[] {
  const saved = before ?? {};
  const submitted = after ?? {};
  return MEDIA_COMMONS_SERVICE_KEYS.filter((key) => {
    const { byRoom, flat } = SERVICE_REQUEST_FIELD_SETS[key];
    return (
      byRoom.some((entry) => byRoomFieldChanged(entry, saved, submitted)) ||
      flat.some(
        (field) =>
          normalizeAnswer(saved[field]) !== normalizeAnswer(submitted[field]),
      )
    );
  });
}
