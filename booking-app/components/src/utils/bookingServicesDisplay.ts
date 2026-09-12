import { TENANTS } from "@/components/src/constants/tenants";
import { EquipmentServices, StaffingServices } from "@/components/src/types";
import { isServiceRequested } from "@/components/src/utils/tenantUtils";
import type {
  ResourceFormSectionConfig,
  ResourceServiceKey,
} from "@/components/src/client/routes/components/schemaTypes";
import {
  formatAnnexSelectionsForRoom,
  getServiceResourceId,
  getServiceSectionConfig,
  getStaffingServiceLabel,
  isPassiveSetupSelection,
  resourceHasService,
  type ServiceResourceLike,
} from "@/components/src/utils/resourceServicesUtils";

/** One requested service under a room or in the booking-level block. */
export type BookingServiceDisplayRow = {
  key: string;
  label: string;
  value: string;
  chartField?: string;
};

export type BookingRoomServicesDisplay = {
  roomId: string;
  title: string;
  rows: BookingServiceDisplayRow[];
};

export type BookingServicesDisplay = {
  rooms: BookingRoomServicesDisplay[];
  /**
   * Setup / equipment shown once under the Services title when they are
   * booking-level and cannot be attributed to a room.
   */
  bookingLevel: BookingServiceDisplayRow[];
};

/** Booking fields used to group services by room for the modal, email, and calendar. */
export type BookingServicesSource = {
  roomId?: string;
  roomSetup?: string;
  setupDetails?: string;
  chartFieldForRoomSetup?: string;
  roomSetupByRoom?: Record<string, string>;
  setupDetailsByRoom?: Record<string, string>;
  chartFieldForRoomSetupByRoom?: Record<string, string>;
  furnishingsByRoom?: Record<string, string>;
  furnishingsDetails?: string;
  furnishingsDetailsByRoom?: Record<string, string>;
  chartFieldForFurnishingsByRoom?: Record<string, string>;
  equipmentServices?: string;
  equipmentServicesDetails?: string;
  equipmentServicesDetailsByRoom?: Record<string, string>;
  staffingServices?: string;
  staffingServicesDetails?: string;
  mediaServices?: string;
  mediaServicesDetails?: string;
  catering?: string;
  cateringService?: string;
  chartFieldForCatering?: string;
  cateringByRoom?: Record<string, string>;
  chartFieldForCateringByRoom?: Record<string, string>;
  cleaningService?: string;
  chartFieldForCleaning?: string;
  cleaningByRoom?: Record<string, string>;
  chartFieldForCleaningByRoom?: Record<string, string>;
  hireSecurity?: string;
  chartFieldForSecurity?: string;
  hireSecurityByRoom?: Record<string, string>;
  chartFieldForSecurityByRoom?: Record<string, string>;
  annexByRoom?: Record<string, string[]>;
};

export function roomDisplayTitle(room: ServiceResourceLike): string {
  const id = getServiceResourceId(room);
  return [id, room.name].filter(Boolean).join(" ");
}

export function hasBookingServicesDisplay(
  display: BookingServicesDisplay,
): boolean {
  return (
    display.rooms.some((room) => room.rows.length > 0) ||
    display.bookingLevel.length > 0
  );
}

/**
 * ITP confirmation emails hide catering / equipment / setup, but annex is a
 * schema-driven room feature and must still render. Other tenants keep the
 * full display.
 */
export function bookingServicesDisplayForEmail(
  display: BookingServicesDisplay,
  tenant?: string,
): BookingServicesDisplay {
  if (tenant !== TENANTS.ITP) return display;
  return {
    bookingLevel: [],
    rooms: display.rooms
      .map((room) => ({
        ...room,
        rows: room.rows.filter((row) => row.key === "annex"),
      }))
      .filter((room) => room.rows.length > 0),
  };
}

function descriptionListItem(row: BookingServiceDisplayRow): string {
  const chart = row.chartField ? `<br>${row.chartField}` : "";
  return `<li><strong>${row.label}:</strong> ${row.value}${chart}</li>`;
}

/**
 * HTML for Google Calendar event descriptions: Services heading, optional
 * booking-level list, then a heading + list per room.
 */
export function formatServicesDescriptionHtml(
  display: BookingServicesDisplay,
): string {
  if (!hasBookingServicesDisplay(display)) return "";

  let html = "<h3>Services</h3>";
  if (display.bookingLevel.length > 0) {
    html += `<ul>${display.bookingLevel.map(descriptionListItem).join("")}</ul>`;
  }
  for (const room of display.rooms) {
    html += `<h4>${room.title}</h4><ul>${room.rows.map(descriptionListItem).join("")}</ul>`;
  }
  return html;
}

/**
 * Group a booking's requested services by booked room, matching the room-first
 * layout of BookingFormResourceServices.
 *
 * Legacy catering / cleaning / security (no *ByRoom map) are shown on each
 * booked room that offers that service. Staffing and media are shown on every
 * booked room. Setup and equipment that cannot be attributed to one room are
 * returned in `bookingLevel`.
 */
export function getBookingServicesByRoom(
  booking: BookingServicesSource,
  resources: ServiceResourceLike[] = [],
): BookingServicesDisplay {
  const bookedIds = parseRoomIds(booking.roomId);
  const roomIds = uniqueRoomIds([
    ...bookedIds,
    ...extraRoomIdsFromMaps(booking, bookedIds),
  ]);

  // First resource for an id wins so live tenant-schema rooms are not
  // overwritten by later hardcoded MC fallbacks for the same parent id.
  const resourceById = new Map<string, ServiceResourceLike>();
  for (const resource of resources) {
    const id = getServiceResourceId(resource);
    if (id && !resourceById.has(id)) resourceById.set(id, resource);
  }

  const rooms: ServiceResourceLike[] = roomIds.map(
    (id) => resourceById.get(id) ?? { resourceId: id },
  );

  const staffingValue = formatStaffingRow(
    booking.staffingServices,
    booking.staffingServicesDetails,
    resources,
  );

  const setupMap = stringMap(booking.roomSetupByRoom);
  const setupDetailsMap = stringMap(booking.setupDetailsByRoom);
  const setupChartMap = stringMap(booking.chartFieldForRoomSetupByRoom);
  const furnishingsMap = stringMap(booking.furnishingsByRoom);
  const furnishingsDetailsMap = stringMap(booking.furnishingsDetailsByRoom);
  const furnishingsChartMap = stringMap(booking.chartFieldForFurnishingsByRoom);
  const equipmentDetailsMap = stringMap(booking.equipmentServicesDetailsByRoom);
  const cateringMap = stringMap(booking.cateringByRoom);
  const cateringChartMap = stringMap(booking.chartFieldForCateringByRoom);
  const cleaningMap = stringMap(booking.cleaningByRoom);
  const cleaningChartMap = stringMap(booking.chartFieldForCleaningByRoom);
  const securityMap = stringMap(booking.hireSecurityByRoom);
  const securityChartMap = stringMap(booking.chartFieldForSecurityByRoom);

  const hasSetupMap = hasKeys(setupMap) || hasKeys(setupDetailsMap);
  const hasFurnishingsMap = hasKeys(furnishingsMap);
  const hasEquipmentMap = hasKeys(equipmentDetailsMap);
  const hasCateringMap = hasKeys(cateringMap);
  const hasCleaningMap = hasKeys(cleaningMap);
  const hasSecurityMap = hasKeys(securityMap);

  const equipmentShown =
    hasEquipmentMap ||
    isRequestedDisplayValue(booking.equipmentServices) ||
    isRequestedDisplayValue(booking.equipmentServicesDetails);
  const mediaValue = mediaDistinctFromEquipment(
    booking.mediaServices,
    booking.mediaServicesDetails,
    booking.equipmentServices,
    booking.equipmentServicesDetails,
    equipmentShown,
  );

  const furnYesRoomIds = roomIds.filter((id) =>
    isRequestedDisplayValue(furnishingsMap[id]),
  );

  const isMultiRoom = bookedIds.length !== 1;
  const cateringFanIds = fanTargetIds(
    rooms,
    "catering",
    !hasCateringMap &&
      isMultiRoom &&
      isRequestedDisplayValue(firstLegacyCatering(booking)),
  );
  const cleaningFanIds = fanTargetIds(
    rooms,
    "cleaning",
    !hasCleaningMap &&
      isMultiRoom &&
      isRequestedDisplayValue(booking.cleaningService),
  );
  const securityFanIds = fanTargetIds(
    rooms,
    "security",
    !hasSecurityMap &&
      isMultiRoom &&
      isRequestedDisplayValue(booking.hireSecurity),
  );

  const roomDisplays: BookingRoomServicesDisplay[] = rooms.map((room) => {
    const roomId = getServiceResourceId(room);
    const rows: BookingServiceDisplayRow[] = [];
    const setupCfg = getServiceSectionConfig(room, "setup");
    const equipmentCfg = getServiceSectionConfig(room, "equipment");
    const furnishingsCfg = getServiceSectionConfig(room, "furnishings");
    const staffingCfg = getServiceSectionConfig(room, "staffing");
    const cateringCfg = getServiceSectionConfig(room, "catering");
    const cleaningCfg = getServiceSectionConfig(room, "cleaning");
    const securityCfg = getServiceSectionConfig(room, "security");

    const annexValue = formatAnnexSelectionsForRoom(
      booking.annexByRoom,
      roomId,
      resources,
    );
    if (annexValue) {
      rows.push({
        key: "annex",
        label: sectionLabel(
          getServiceSectionConfig(room, "annex")?.label,
          "Auxiliary Spaces",
        ),
        value: annexValue,
      });
    }

    const setup = resolveSetupDisplay(
      valueForRoom(
        setupMap,
        roomId,
        booking.roomSetup,
        bookedIds,
        hasSetupMap,
      ),
      valueForRoom(
        setupDetailsMap,
        roomId,
        booking.setupDetails,
        bookedIds,
        hasSetupMap,
      ),
      valueForRoom(
        setupChartMap,
        roomId,
        booking.chartFieldForRoomSetup,
        bookedIds,
        hasKeys(setupChartMap),
      ),
      setupCfg,
      resources,
    );
    if (setup) {
      rows.push({
        key: "setup",
        label: sectionLabel(setupCfg?.label, "Room Setup"),
        ...setup,
      });
    }

    const equipment = formatListAndDetails(
      legacyForRoom(booking.equipmentServices, roomId, bookedIds),
      valueForRoom(
        equipmentDetailsMap,
        roomId,
        booking.equipmentServicesDetails,
        bookedIds,
        hasEquipmentMap,
      ),
      ", ",
    );
    if (equipment) {
      rows.push({
        key: "equipment",
        label: sectionLabel(equipmentCfg?.label, "Equipment"),
        value: equipment,
      });
    }

    const furnishings = resolveFurnishingsRow({
      roomId,
      requested: valueForRoom(
        furnishingsMap,
        roomId,
        undefined,
        bookedIds,
        hasFurnishingsMap,
      ),
      details: furnishingsDetailsMap[roomId],
      joinedDetails: booking.furnishingsDetails,
      furnYesRoomIds,
      chartField: valueForRoom(
        furnishingsChartMap,
        roomId,
        undefined,
        bookedIds,
        hasKeys(furnishingsChartMap),
      ),
    });
    if (furnishings) {
      rows.push({
        key: "furnishings",
        label: sectionLabel(furnishingsCfg?.label, "Additional Event Furniture"),
        ...furnishings,
      });
    }

    if (staffingValue && bookedIds.includes(roomId)) {
      rows.push({
        key: "staffing",
        label: sectionLabel(staffingCfg?.label, "Staffing"),
        value: staffingValue,
      });
    }
    if (mediaValue && bookedIds.includes(roomId)) {
      rows.push({
        key: "media",
        label: "Media Service",
        value: mediaValue,
      });
    }

    const cateringValue = valueForRoom(
      cateringMap,
      roomId,
      firstLegacyCatering(booking),
      bookedIds,
      hasCateringMap,
      cateringFanIds.has(roomId),
    );
    if (isRequestedDisplayValue(cateringValue)) {
      const chartField = meaningfulText(
        valueForRoom(
          cateringChartMap,
          roomId,
          booking.chartFieldForCatering,
          bookedIds,
          hasKeys(cateringChartMap),
          cateringFanIds.has(roomId),
        ),
      );
      rows.push({
        key: "catering",
        label: sectionLabel(cateringCfg?.label, "Catering"),
        value: formatYesOrChoice(cateringValue!),
        ...(chartField ? { chartField } : {}),
      });
    }

    const cleaningValue = valueForRoom(
      cleaningMap,
      roomId,
      booking.cleaningService,
      bookedIds,
      hasCleaningMap,
      cleaningFanIds.has(roomId),
    );
    if (isRequestedDisplayValue(cleaningValue)) {
      const chartField = meaningfulText(
        valueForRoom(
          cleaningChartMap,
          roomId,
          booking.chartFieldForCleaning,
          bookedIds,
          hasKeys(cleaningChartMap),
          cleaningFanIds.has(roomId),
        ),
      );
      rows.push({
        key: "cleaning",
        label: sectionLabel(cleaningCfg?.label, "Cleaning"),
        value: "Yes",
        ...(chartField ? { chartField } : {}),
      });
    }

    const securityValue = valueForRoom(
      securityMap,
      roomId,
      booking.hireSecurity,
      bookedIds,
      hasSecurityMap,
      securityFanIds.has(roomId),
    );
    if (isRequestedDisplayValue(securityValue)) {
      const chartField = meaningfulText(
        valueForRoom(
          securityChartMap,
          roomId,
          booking.chartFieldForSecurity,
          bookedIds,
          hasKeys(securityChartMap),
          securityFanIds.has(roomId),
        ),
      );
      rows.push({
        key: "security",
        label: sectionLabel(securityCfg?.label, "Security"),
        value: formatSecurityValue(securityValue!, securityCfg),
        ...(chartField ? { chartField } : {}),
      });
    }

    return {
      roomId,
      title: roomDisplayTitle(room),
      rows,
    };
  });

  const bookingLevel: BookingServiceDisplayRow[] = [];
  if (isMultiRoom) {
    if (!hasSetupMap) {
      const setup = resolveSetupDisplay(
        booking.roomSetup,
        booking.setupDetails,
        booking.chartFieldForRoomSetup,
        undefined,
        resources,
      );
      if (setup) {
        bookingLevel.push({
          key: "setup",
          label: "Room Setup",
          ...setup,
        });
      }
    }
    const equipment = formatListAndDetails(
      booking.equipmentServices,
      hasEquipmentMap ? undefined : booking.equipmentServicesDetails,
      ", ",
    );
    if (equipment) {
      bookingLevel.push({
        key: "equipment",
        label: "Equipment",
        value: equipment,
      });
    }
  }
  if (staffingValue && bookedIds.length === 0) {
    bookingLevel.push({
      key: "staffing",
      label: "Staffing",
      value: staffingValue,
    });
  }
  if (mediaValue && bookedIds.length === 0) {
    bookingLevel.push({
      key: "media",
      label: "Media Service",
      value: mediaValue,
    });
  }
  if (isMultiRoom) {
    if (
      !hasCateringMap &&
      cateringFanIds.size === 0 &&
      isRequestedDisplayValue(firstLegacyCatering(booking))
    ) {
      const chartField = meaningfulText(booking.chartFieldForCatering);
      bookingLevel.push({
        key: "catering",
        label: "Catering",
        value: formatYesOrChoice(firstLegacyCatering(booking)!),
        ...(chartField ? { chartField } : {}),
      });
    }
    if (
      !hasCleaningMap &&
      cleaningFanIds.size === 0 &&
      isRequestedDisplayValue(booking.cleaningService)
    ) {
      const chartField = meaningfulText(booking.chartFieldForCleaning);
      bookingLevel.push({
        key: "cleaning",
        label: "Cleaning",
        value: "Yes",
        ...(chartField ? { chartField } : {}),
      });
    }
    if (
      !hasSecurityMap &&
      securityFanIds.size === 0 &&
      isRequestedDisplayValue(booking.hireSecurity)
    ) {
      const chartField = meaningfulText(booking.chartFieldForSecurity);
      bookingLevel.push({
        key: "security",
        label: "Security",
        value: formatSecurityValue(booking.hireSecurity!, undefined),
        ...(chartField ? { chartField } : {}),
      });
    }
  }

  return {
    rooms: roomDisplays.filter((room) => room.rows.length > 0),
    bookingLevel,
  };
}

function parseRoomIds(roomId: string | undefined): string[] {
  return String(roomId ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

function uniqueRoomIds(ids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function extraRoomIdsFromMaps(
  booking: BookingServicesSource,
  bookedIds: string[],
): string[] {
  const extras = new Set<string>();
  const addFromStringMap = (map: Record<string, string> | undefined) => {
    if (!map) return;
    for (const [id, value] of Object.entries(map)) {
      if (bookedIds.includes(id)) continue;
      if (isRequestedDisplayValue(value)) extras.add(id);
    }
  };
  addFromStringMap(booking.roomSetupByRoom);
  addFromStringMap(booking.setupDetailsByRoom);
  addFromStringMap(booking.furnishingsByRoom);
  addFromStringMap(booking.equipmentServicesDetailsByRoom);
  addFromStringMap(booking.cateringByRoom);
  addFromStringMap(booking.cleaningByRoom);
  addFromStringMap(booking.hireSecurityByRoom);
  if (booking.annexByRoom && typeof booking.annexByRoom === "object") {
    for (const [id, values] of Object.entries(booking.annexByRoom)) {
      if (bookedIds.includes(id)) continue;
      if (Array.isArray(values) && values.length > 0) extras.add(id);
    }
  }
  return [...extras].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true }),
  );
}

function stringMap(map: unknown): Record<string, string> {
  if (!map || typeof map !== "object" || Array.isArray(map)) return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(map as Record<string, unknown>)) {
    if (typeof value === "string") out[key] = value;
  }
  return out;
}

function hasKeys(map: Record<string, string>): boolean {
  return Object.keys(map).length > 0;
}

function isBlankDisplayValue(value: unknown): boolean {
  if (value == null) return true;
  const normalized = String(value).trim().toLowerCase();
  return normalized === "" || normalized === "no" || normalized === "none";
}

function isRequestedDisplayValue(value: unknown): boolean {
  return isServiceRequested(value) && !isBlankDisplayValue(value);
}

function meaningfulText(value: string | undefined): string | undefined {
  if (!value || isBlankDisplayValue(value)) return undefined;
  return value.trim();
}

function firstMeaningful(
  ...values: Array<string | undefined>
): string | undefined {
  for (const value of values) {
    const text = meaningfulText(value);
    if (text) return text;
  }
  return undefined;
}

function fanTargetIds(
  rooms: ServiceResourceLike[],
  key: ResourceServiceKey,
  shouldFan: boolean,
): Set<string> {
  if (!shouldFan) return new Set();
  return new Set(
    rooms
      .filter((room) => resourceHasService(room, key))
      .map((room) => getServiceResourceId(room))
      .filter(Boolean),
  );
}

function valueForRoom(
  byRoom: Record<string, string>,
  roomId: string,
  legacy: string | undefined,
  bookedIds: string[],
  hasMap: boolean,
  fanToThisRoom = false,
): string | undefined {
  if (roomId in byRoom) return byRoom[roomId];
  if (hasMap) return undefined;
  if (fanToThisRoom) return legacy;
  return legacyForRoom(legacy, roomId, bookedIds);
}

function legacyForRoom(
  legacy: string | undefined,
  roomId: string,
  bookedIds: string[],
): string | undefined {
  if (!legacy) return undefined;
  if (bookedIds.length === 1 && bookedIds[0] === roomId) return legacy;
  return undefined;
}

function sectionLabel(schemaLabel: string | undefined, fallback: string): string {
  const raw = schemaLabel?.trim() || fallback;
  return raw.replace(/\?+$/, "");
}

function firstLegacyCatering(booking: BookingServicesSource): string | undefined {
  if (isRequestedDisplayValue(booking.cateringService)) {
    return booking.cateringService;
  }
  if (isRequestedDisplayValue(booking.catering)) return booking.catering;
  return undefined;
}

function formatYesOrChoice(value: string): string {
  return value.trim().toLowerCase() === "yes" ? "Yes" : value.trim();
}

function formatSecurityValue(
  raw: string,
  cfg: ResourceFormSectionConfig | undefined,
): string {
  const trimmed = raw.trim();
  const option = cfg?.options?.find((o) => o.value === trimmed);
  if (option?.label) return option.label;
  const normalized = trimmed.toLowerCase();
  if (normalized === "yes") return "Yes";
  if (
    normalized === "willoughby" ||
    trimmed === "Willoughby Street Entrance"
  ) {
    return "Willoughby entrance";
  }
  if (normalized === "main_entrance") return "Main entrance";
  return trimmed;
}

function formatStaffingServiceDisplay(
  value: string,
  resources: ServiceResourceLike[],
): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  if (trimmed in StaffingServices) {
    return StaffingServices[trimmed as keyof typeof StaffingServices];
  }
  return getStaffingServiceLabel(resources, trimmed);
}

function formatStaffingRow(
  services: string | undefined,
  details: string | undefined,
  resources: ServiceResourceLike[],
): string | undefined {
  const labels = String(services ?? "")
    .split(",")
    .map((service) => formatStaffingServiceDisplay(service, resources))
    .filter((service) => !isBlankDisplayValue(service));
  const detailText = meaningfulText(details);
  if (labels.length === 0 && !detailText) return undefined;
  return [...labels, detailText].filter(Boolean).join(" — ");
}

function formatListAndDetails(
  list: string | undefined,
  details: string | undefined,
  separator: string,
): string | undefined {
  const items = splitServiceList(list, separator);
  const detailText = meaningfulText(details);
  if (items.length === 0 && !detailText) return undefined;
  return [...items, detailText].filter(Boolean).join(" — ");
}

function splitServiceList(value: string | undefined, separator: string): string[] {
  return String(value ?? "")
    .split(separator)
    .map((item) => item.trim())
    .filter((item) => !isBlankDisplayValue(item));
}

/**
 * Drop media rows that only repeat equipment checkout. Older bookings store
 * "Checkout Equipment" on both mediaServices and equipmentServices.
 */
function mediaDistinctFromEquipment(
  mediaList: string | undefined,
  mediaDetails: string | undefined,
  equipmentList: string | undefined,
  equipmentDetails: string | undefined,
  equipmentShown: boolean,
): string | undefined {
  const equipmentItems = new Set(
    splitServiceList(equipmentList, ", ").map((item) => item.toLowerCase()),
  );
  const checkout = EquipmentServices.CHECKOUT_EQUIPMENT.toLowerCase();
  const remaining = splitServiceList(mediaList, ", ").filter((item) => {
    const normalized = item.toLowerCase();
    if (equipmentItems.has(normalized)) return false;
    if (equipmentShown && normalized === checkout) return false;
    return true;
  });
  const mediaDetail = meaningfulText(mediaDetails);
  const equipmentDetail = meaningfulText(equipmentDetails);
  const details =
    mediaDetail &&
    mediaDetail.toLowerCase() !== (equipmentDetail ?? "").toLowerCase()
      ? mediaDetail
      : undefined;
  if (remaining.length === 0 && !details) return undefined;
  return [...remaining, details].filter(Boolean).join(" — ");
}

function resolveSetupDisplay(
  storedValue: string | undefined,
  details: string | undefined,
  chartField: string | undefined,
  setupCfg: ResourceFormSectionConfig | undefined,
  resources: ServiceResourceLike[],
): { value: string; chartField?: string } | undefined {
  const option = setupCfg?.options?.find((o) => o.value === storedValue);
  const display = firstMeaningful(details, option?.label, storedValue);
  if (
    (display && isPassiveSetupSelection(resources, display)) ||
    (storedValue && isPassiveSetupSelection(resources, storedValue))
  ) {
    return undefined;
  }
  const chart = meaningfulText(chartField);
  if (!display && !chart) return undefined;
  if (!display) return { value: "Yes", chartField: chart };
  return chart ? { value: display, chartField: chart } : { value: display };
}

function resolveFurnishingsRow({
  requested,
  details,
  joinedDetails,
  furnYesRoomIds,
  chartField,
  roomId,
}: {
  roomId: string;
  requested: string | undefined;
  details: string | undefined;
  joinedDetails: string | undefined;
  furnYesRoomIds: string[];
  chartField: string | undefined;
}): { value: string; chartField?: string } | undefined {
  const isYes = isRequestedDisplayValue(requested);
  const perRoomDetails = meaningfulText(details);
  const sharedDetails =
    !perRoomDetails &&
    isYes &&
    furnYesRoomIds.length === 1 &&
    furnYesRoomIds[0] === roomId
      ? meaningfulText(joinedDetails)
      : undefined;
  const detailText = perRoomDetails ?? sharedDetails;
  const chart = meaningfulText(chartField);
  if (!isYes) return undefined;
  const value = detailText ?? "Yes";
  return chart ? { value, chartField: chart } : { value };
}
