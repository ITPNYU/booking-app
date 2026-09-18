import type { ResourceServiceKey } from "../client/routes/components/schemaTypes";
import { BookingOrigin, FormContextLevel, Inputs } from "../types";
import {
  anyRoomHasService,
  anyRoomHasVisibleService,
  getRoomsWithAnyVisibleService,
  getRoomsWithVisibleService,
  getServiceResourceId,
  getServiceSectionConfig,
  hasSchemaServicesConfig,
  isChoiceMode,
  isSchemaDrivenEquipmentSection,
  needsGenericSetupSwitch,
  pruneServiceMapsToRooms,
  ServiceResourceLike,
  ServiceVisibilityContext,
} from "./resourceServicesUtils";

/** Origin flags derived from the form context a request runs under. */
export type RequestOrigin = ServiceVisibilityContext & {
  isMod: boolean;
  isEdit: boolean;
  isFullForm: boolean;
  /** A regular (non-VIP, non-walk-in) request: the only origin with attestations. */
  isBooking: boolean;
};

/**
 * Editing a declined VIP booking runs under the EDIT context while the
 * booking's origin is still VIP; VIP rules apply to it.
 */
export function getRequestOrigin(
  formContext: FormContextLevel,
  origin?: BookingOrigin,
): RequestOrigin {
  const isWalkIn = formContext === FormContextLevel.WALK_IN;
  const isMod = formContext === FormContextLevel.MODIFICATION;
  const isEdit = formContext === FormContextLevel.EDIT;
  const isFullForm = formContext === FormContextLevel.FULL_FORM;
  const isVIP =
    formContext === FormContextLevel.VIP ||
    (isEdit && origin === BookingOrigin.VIP);
  return {
    isWalkIn,
    isVIP,
    isStandardUser: !isVIP && !isWalkIn,
    isMod,
    isEdit,
    isFullForm,
    isBooking: !isWalkIn && !isVIP,
  };
}

/**
 * Which service sections the Services step renders for a set of rooms. One
 * flag per section so the step list and the page agree on what would show.
 */
export type ServiceSectionFlags = {
  /** Some room carries an object services config; legacy switches are off. */
  schemaDrivenServices: boolean;
  /** Per-room sections rendered by BookingFormResourceServices. */
  showSchemaSections: boolean;
  /** Legacy tenant-level Room Setup switch for rooms without a schema config. */
  showGenericSetup: boolean;
  /** Legacy equipment switch, for sections the schema form does not render. */
  showEquipment: boolean;
  showLegacyStaffing: boolean;
  showLegacyCatering: boolean;
  showLegacyCleaning: boolean;
  showLegacySecurity: boolean;
  /** A security room rendered as a plain switch (the large-event rule forces it on). */
  needsGenericSecuritySwitch: boolean;
  /** A security room in checkbox mode (the large-event rule forces it on). */
  needsCheckboxSecurity: boolean;
  cateringDescriptionHtml?: string;
};

export function getServiceSectionFlags(
  serviceRooms: ServiceResourceLike[],
  visibility: ServiceVisibilityContext,
  tenantShowSetup: boolean,
): ServiceSectionFlags {
  const { isWalkIn } = visibility;
  const schemaDrivenServices = serviceRooms.some(hasSchemaServicesConfig);

  const securityRooms = getRoomsWithVisibleService(
    serviceRooms,
    "security",
    visibility,
  );
  // Match showSecuritySwitch in BookingFormResourceServices (multi-room safe).
  const needsGenericSecuritySwitch = securityRooms.some((room) => {
    const mode = getServiceSectionConfig(room, "security")?.mode;
    return !isChoiceMode(mode) && mode !== "checkbox" && mode !== "static";
  });
  const needsCheckboxSecurity = securityRooms.some(
    (room) => getServiceSectionConfig(room, "security")?.mode === "checkbox",
  );

  const equipmentRooms = getRoomsWithVisibleService(
    serviceRooms,
    "equipment",
    visibility,
  );
  const needsInteractiveEquipment = equipmentRooms.some((room) => {
    const cfg = getServiceSectionConfig(room, "equipment");
    // Legacy string[] services have no section config; use generic equipment UI.
    if (!cfg) return true;
    // Mirrors BookingFormResourceServices so a section never renders both UIs.
    return !isSchemaDrivenEquipmentSection(cfg);
  });

  let cateringDescriptionHtml: string | undefined;
  for (const room of serviceRooms) {
    const html = getServiceSectionConfig(room, "catering")?.descriptionHtml;
    if (html) {
      cateringDescriptionHtml = html;
      break;
    }
  }

  const legacy = !schemaDrivenServices && !isWalkIn;

  return {
    schemaDrivenServices,
    showSchemaSections:
      !isWalkIn &&
      getRoomsWithAnyVisibleService(serviceRooms, visibility).length > 0,
    showGenericSetup:
      !isWalkIn &&
      needsGenericSetupSwitch(serviceRooms, visibility, tenantShowSetup),
    showEquipment: equipmentRooms.length > 0 && needsInteractiveEquipment,
    showLegacyStaffing:
      !schemaDrivenServices &&
      anyRoomHasVisibleService(serviceRooms, "staffing", visibility),
    showLegacyCatering:
      legacy && anyRoomHasVisibleService(serviceRooms, "catering", visibility),
    showLegacyCleaning:
      legacy && anyRoomHasVisibleService(serviceRooms, "cleaning", visibility),
    showLegacySecurity:
      legacy && securityRooms.length > 0 && needsGenericSecuritySwitch,
    needsGenericSecuritySwitch,
    needsCheckboxSecurity,
    cateringDescriptionHtml,
  };
}

/** True when the Services step has something to show for the request. */
export function hasAnyServiceSection(flags: ServiceSectionFlags): boolean {
  return (
    flags.showSchemaSections ||
    flags.showGenericSetup ||
    flags.showEquipment ||
    flags.showLegacyStaffing ||
    flags.showLegacyCatering ||
    flags.showLegacyCleaning ||
    flags.showLegacySecurity
  );
}

/** "VIP Services", "Walk-In Phone Number": labels carry the origin's prefix. */
export function withOriginPrefix(
  origin: ServiceVisibilityContext,
  label: string,
): string {
  const prefix = origin.isVIP ? "VIP" : origin.isWalkIn ? "Walk-In" : "";
  return `${prefix} ${label}`.trim();
}

/**
 * Which service answers a rule switched on (75+ attendees forces security,
 * catering forces cleaning) rather than the requester, so the rule can switch
 * them back off when it stops applying. Kept in BookingContext because the
 * attendance answer lives on Details: the Services step unmounts in between.
 */
export type ServiceRuleMemory = {
  hireSecurityAutoSet: boolean;
  /** The last value the attendance rule wrote, to detect a manual override. */
  autoHireSecurityValue?: string;
  hireSecurityManuallySet: boolean;
  cleaningAutoSet: boolean;
  cleaningAutoSetByRoom: Record<string, boolean>;
  securityAutoSetByRoom: Record<string, boolean>;
};

export function createServiceRuleMemory(): ServiceRuleMemory {
  return {
    hireSecurityAutoSet: false,
    autoHireSecurityValue: undefined,
    hireSecurityManuallySet: false,
    cleaningAutoSet: false,
    cleaningAutoSetByRoom: {},
    securityAutoSetByRoom: {},
  };
}

/**
 * Forget the per-room rule memory of rooms no longer part of the request, so
 * a room that is removed and added back starts with no rule history. Mutates
 * the memory in place: it is shared by reference through BookingContext.
 */
export function pruneServiceRuleMemoryToRooms(
  memory: ServiceRuleMemory,
  rooms: ServiceResourceLike[],
): void {
  const keep = new Set(rooms.map(getServiceResourceId));
  [memory.cleaningAutoSetByRoom, memory.securityAutoSetByRoom].forEach(
    (byRoom) => {
      Object.keys(byRoom).forEach((id) => {
        if (!keep.has(id)) delete byRoom[id];
      });
    },
  );
}

/** Booking-level answers per service, dropped once no remaining room offers it. */
export const FLAT_SERVICE_FIELDS: Partial<
  Record<ResourceServiceKey, (keyof Inputs)[]>
> = {
  setup: ["roomSetup", "setupDetails", "chartFieldForRoomSetup"],
  equipment: [
    "equipmentServices",
    "equipmentServicesDetails",
    "mediaServices",
    "mediaServicesDetails",
  ],
  staffing: ["staffingServices"],
  furnishings: ["furnishingsDetails"],
  catering: ["catering", "cateringService", "chartFieldForCatering"],
  cleaning: ["cleaningService", "chartFieldForCleaning"],
  security: ["hireSecurity", "chartFieldForSecurity"],
};

/**
 * Drop the service requests that belonged to rooms no longer part of the
 * request: per-room maps lose their entries, and a booking-level answer is
 * cleared when none of the remaining rooms offers that service. Returns the
 * same object when nothing was dropped.
 */
export function pruneServiceRequestsToRooms(
  data: Inputs,
  rooms: ServiceResourceLike[],
  tenantShowSetup: boolean,
): Inputs {
  let next = pruneServiceMapsToRooms(data, rooms);
  const anyOrigin: ServiceVisibilityContext = {
    isVIP: false,
    isWalkIn: false,
    isStandardUser: true,
  };
  for (const [key, fields] of Object.entries(FLAT_SERVICE_FIELDS) as [
    ResourceServiceKey,
    (keyof Inputs)[],
  ][]) {
    const offered =
      rooms.length > 0 &&
      (anyRoomHasService(rooms, key) ||
        (key === "setup" &&
          needsGenericSetupSwitch(rooms, anyOrigin, tenantShowSetup)));
    if (offered) continue;
    for (const field of fields) {
      const value = next[field];
      if (typeof value !== "string" || value === "") continue;
      if (next === data) next = { ...data };
      (next as Record<string, unknown>)[field] = "";
    }
  }
  return next;
}
