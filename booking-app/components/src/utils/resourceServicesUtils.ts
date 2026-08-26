import type {
  Resource,
  ResourceChartFieldConfig,
  ResourceFormOption,
  ResourceFormSectionConfig,
  ResourceServicesConfig,
  ResourceServiceKey,
  ServiceToggle,
  ShowInOrigin,
} from "@/components/src/client/routes/components/schemaTypes";

export type ServiceVisibilityContext = {
  isVIP: boolean;
  isWalkIn: boolean;
  isStandardUser: boolean;
};

/** Room or resource shape accepted by service helpers (booking uses roomId). */
export type ServiceResourceLike = {
  services?: Resource["services"];
  resourceId?: string;
  roomId?: string;
  name?: string;
  parentResourceId?: string;
  calendarId?: string;
  staffingServices?: string[];
  staffingSections?: { name: string; indexes: number[] }[];
};

export function getServiceResourceId(room: ServiceResourceLike): string {
  return room.resourceId ?? room.roomId ?? "";
}

/**
 * True when the resource carries an object `services` config — including an
 * intentionally empty `{}` (no services offered). Such rooms are rendered by
 * the schema-driven form only; the legacy tenant-level switches must not
 * appear for them.
 */
export function hasSchemaServicesConfig(room: ServiceResourceLike): boolean {
  const { services } = room;
  return !!services && typeof services === "object" && !Array.isArray(services);
}

/**
 * Equipment sections rendered by the schema-driven form (static text, a
 * details field, a toggle, or description-only). Anything else falls back to
 * the legacy equipment UI in FormInput.
 */
export function isSchemaDrivenEquipmentSection(
  cfg: ResourceFormSectionConfig | undefined,
): boolean {
  if (!cfg) return false;
  if (cfg.mode === "static") return true;
  if (cfg.showDetailsField) return true;
  if (cfg.toggle) return true;
  return !!cfg.descriptionHtml && cfg.mode !== "hidden";
}

/**
 * Whether the legacy generic "Room Setup" switch is needed for the selection:
 * only for rooms that are not schema-driven (legacy string[] / no services),
 * or for schema rooms whose setup section is a plain switch.
 */
export function needsGenericSetupSwitch(
  rooms: ServiceResourceLike[],
  context: ServiceVisibilityContext,
  tenantShowSetup: boolean,
): boolean {
  if (rooms.length === 0) return tenantShowSetup;
  const schemaSetupSwitchRooms = getRoomsWithVisibleService(
    rooms,
    "setup",
    context,
  ).filter((r) => {
    if (!hasSchemaServicesConfig(r)) return false;
    const mode = getServiceSectionConfig(r, "setup")?.mode;
    return !isChoiceMode(mode) && mode !== "static";
  });
  if (schemaSetupSwitchRooms.length > 0) return true;
  const hasLegacyRoom = rooms.some((r) => !hasSchemaServicesConfig(r));
  return hasLegacyRoom && tenantShowSetup;
}

/**
 * Resolve a stored staffing option value (e.g. `LIGHTING_TECH_DIY`) to its
 * label using the tenant resources' staffing configs. Falls back to the raw
 * value when no resource defines it.
 */
export function getStaffingServiceLabel(
  resources: ServiceResourceLike[],
  value: string,
): string {
  const target = value.trim();
  if (!target) return value;
  for (const resource of resources) {
    const staffing = getResourceServicesConfig(resource).staffing;
    if (!staffing) continue;
    for (const section of Object.values(staffing.sections ?? {})) {
      const found =
        section.options?.find((o) => o.value === target) ??
        section.services?.find((s) => s.value === target);
      if (found?.label) return found.label;
    }
    const flat = staffing.staffingOptions?.find((o) => o.value === target);
    if (flat?.label) return flat.label;
  }
  return value;
}

/**
 * A room setup value (or label) that is a room's schema default without a
 * chartfield is informational only and does not count as a setup request.
 */
export function isPassiveSetupSelection(
  resources: ServiceResourceLike[],
  value: string,
): boolean {
  const normalized = value.trim();
  if (!normalized) return false;
  return resources.some((resource) => {
    const setup = getResourceServicesConfig(resource).setup;
    if (!setup?.defaultValue) return false;
    const opt = setup.options?.find((o) => o.value === setup.defaultValue);
    if (!opt || opt.chartField) return false;
    return opt.value === normalized || opt.label === normalized;
  });
}

export function isLegacyServicesArray(
  services: Resource["services"] | undefined,
): services is string[] {
  return Array.isArray(services);
}

export function getResourceServicesConfig(
  resource: ServiceResourceLike,
): ResourceServicesConfig {
  const { services } = resource;
  if (!services || isLegacyServicesArray(services)) {
    return {};
  }
  return services;
}

function originAllows(
  showInOrigin: ShowInOrigin | undefined,
  context: ServiceVisibilityContext,
  legacy?: {
    hideForUser?: boolean;
    hideForVIP?: boolean;
    hideForWalkIn?: boolean;
  },
): boolean {
  if (showInOrigin) {
    if (context.isWalkIn) return showInOrigin.walkIn !== false;
    if (context.isVIP) return showInOrigin.VIP !== false;
    if (context.isStandardUser) return showInOrigin.user !== false;
    return true;
  }
  if (legacy) {
    if (context.isWalkIn && legacy.hideForWalkIn) return false;
    if (context.isVIP && legacy.hideForVIP) return false;
    if (context.isStandardUser && legacy.hideForUser) return false;
  }
  return true;
}

export function resourceHasService(
  resource: ServiceResourceLike,
  key: ResourceServiceKey,
): boolean {
  if (isLegacyServicesArray(resource.services)) {
    if (key === "annex") {
      return (
        resource.services.includes("annex") ||
        resource.services.includes("auxiliarySpace")
      );
    }
    return resource.services.includes(key);
  }
  const config = getResourceServicesConfig(resource);
  if (key === "annex") {
    return config.annex != null || config.auxiliarySpace != null;
  }
  if (key === "auxiliarySpace") {
    return config.auxiliarySpace != null || config.annex != null;
  }
  return config[key] != null;
}

export function anyRoomHasService(
  rooms: ServiceResourceLike[],
  key: ResourceServiceKey,
): boolean {
  return rooms.some((room) => resourceHasService(room, key));
}

export function getServiceSectionConfig(
  resource: ServiceResourceLike,
  key: ResourceServiceKey,
): ResourceFormSectionConfig | undefined {
  const config = getResourceServicesConfig(resource);
  if (key === "annex") {
    return config.annex ?? config.auxiliarySpace;
  }
  if (key === "auxiliarySpace") {
    return config.auxiliarySpace ?? config.annex;
  }
  if (key === "staffing") {
    const staffing = config.staffing;
    if (!staffing) return undefined;
    const hasSections =
      !!staffing.sections && Object.keys(staffing.sections).length > 0;
    // Adapt staffing (different shape) for shared visibility checks.
    return {
      showInOrigin: staffing.showInOrigin,
      label: staffing.label,
      descriptionHtml: staffing.descriptionHtml,
      toggle: staffing.toggle,
      mode:
        staffing.mode ??
        (hasSections ? undefined : "static"),
      hideForUser: staffing.hideForUser,
      hideForVIP: staffing.hideForVIP,
      hideForWalkIn: staffing.hideForWalkIn,
    };
  }
  const section = config[key];
  if (!section) return undefined;
  return section as ResourceFormSectionConfig;
}

export function shouldShowServiceSection(
  config: ResourceFormSectionConfig | undefined,
  context: ServiceVisibilityContext,
): boolean {
  if (!config || config.mode === "hidden") return false;
  return originAllows(config.showInOrigin, context, config);
}

/** Toggle lock for one section; omitted means the user controls the switch. */
export function getServiceToggle(
  config: { toggle?: ServiceToggle } | undefined,
): ServiceToggle {
  return config?.toggle ?? "optional";
}

export function isServiceToggleLocked(
  config: { toggle?: ServiceToggle } | undefined,
): boolean {
  return getServiceToggle(config) !== "optional";
}

/** Form value a locked switch must hold, or null when the user decides. */
export function lockedToggleValue(toggle: ServiceToggle): "yes" | "no" | null {
  if (toggle === "on") return "yes";
  if (toggle === "off") return "no";
  return null;
}

/**
 * Combine toggles for a service whose form value is shared across every
 * selected room (catering / cleaning / security / staffing). Rules:
 * - "on" if any room locks it on
 * - "off" only if every room locks it off
 * - "optional" otherwise (or when no room offers the service)
 */
export function combineServiceToggles(toggles: ServiceToggle[]): ServiceToggle {
  if (toggles.length === 0) return "optional";
  if (toggles.includes("on")) return "on";
  if (toggles.every((t) => t === "off")) return "off";
  return "optional";
}

export function resolveSharedServiceToggle(
  rooms: ServiceResourceLike[],
  key: ResourceServiceKey,
  context: ServiceVisibilityContext,
): ServiceToggle {
  return combineServiceToggles(
    getRoomsWithVisibleService(rooms, key, context).map((room) =>
      getServiceToggle(getServiceSectionConfig(room, key)),
    ),
  );
}

/** Security is only lockable in switch / checkbox mode (radio has no switch). */
export function isSecuritySwitchLike(
  config: ResourceFormSectionConfig | undefined,
): boolean {
  const mode = config?.mode;
  return !isChoiceMode(mode) && mode !== "static" && mode !== "hidden";
}

export function resolveSecurityToggle(
  rooms: ServiceResourceLike[],
  context: ServiceVisibilityContext,
): ServiceToggle {
  return combineServiceToggles(
    getRoomsWithVisibleService(rooms, "security", context)
      .map((room) => getServiceSectionConfig(room, "security"))
      .filter(isSecuritySwitchLike)
      .map(getServiceToggle),
  );
}

export function getRoomsWithVisibleService(
  rooms: ServiceResourceLike[],
  key: ResourceServiceKey,
  context: ServiceVisibilityContext,
): ServiceResourceLike[] {
  // Annex / auxiliary space is rendered on the room selection page, not the services form.
  if (key === "annex" || key === "auxiliarySpace") {
    return [];
  }

  return rooms.filter((room) => {
    if (!resourceHasService(room, key)) return false;
    const section = getServiceSectionConfig(room, key);
    if (!section) {
      // Legacy string[] resources have no section config — show when offered.
      return isLegacyServicesArray(room.services);
    }
    return shouldShowServiceSection(section, context);
  });
}

function annexResourceLabel(resource: ServiceResourceLike): string {
  const resourceId = getServiceResourceId(resource);
  return [resourceId, resource.name].filter(Boolean).join(" ");
}

/** Annex (auxiliary space) resources whose parentResourceId points at this room. */
export function getAnnexChildResources(
  parentRoom: ServiceResourceLike,
  allResources: ServiceResourceLike[],
): ServiceResourceLike[] {
  const parentId = getServiceResourceId(parentRoom);
  if (!parentId) return [];
  return allResources
    .filter((r) => r.parentResourceId === parentId)
    .sort((a, b) =>
      getServiceResourceId(a).localeCompare(getServiceResourceId(b), undefined, {
        numeric: true,
      }),
    );
}

/**
 * Annex options for a parent room (used on the room selection page).
 * Child resources (parentResourceId) are the source of truth; the
 * services.annex options list is a fallback for tenants whose annex spaces
 * are not registered as resources yet.
 */
export function getAnnexOptions(
  resource: ServiceResourceLike,
  allResources?: ServiceResourceLike[],
): ResourceFormOption[] {
  if (allResources) {
    const children = getAnnexChildResources(resource, allResources);
    if (children.length > 0) {
      return children.map((child) => ({
        value: getServiceResourceId(child),
        label: annexResourceLabel(child),
      }));
    }
  }
  const section = getServiceSectionConfig(resource, "annex");
  return section?.options ?? [];
}

/**
 * Resolve selected auxiliary spaces to the calendar IDs of their annex
 * resources so they can be invited to the parent booking's calendar event.
 * Values that don't match an annex resource (legacy options without a
 * registered resource) resolve to nothing.
 */
export function resolveAnnexCalendarIds(
  annexByRoom: Record<string, string[]> | undefined,
  allResources: ServiceResourceLike[],
): string[] {
  if (!annexByRoom || typeof annexByRoom !== "object") return [];

  const calendarIds = new Set<string>();
  for (const values of Object.values(annexByRoom)) {
    if (!Array.isArray(values)) continue;
    for (const value of values) {
      const resource = allResources.find(
        (r) => r.parentResourceId && getServiceResourceId(r) === String(value),
      );
      if (resource?.calendarId) {
        calendarIds.add(resource.calendarId);
      }
    }
  }
  return [...calendarIds];
}

/**
 * Merge a booking's comma-joined room list with its selected auxiliary
 * spaces into one display string, numerically sorted to match the calendar
 * column order. Example: `"202, 1201"` + `{202: ["202GR"]}` → `"202, 202GR, 1201"`.
 */
export function mergeRoomIdsWithAnnex(
  roomId: string | undefined,
  annexByRoom: Record<string, string[]> | undefined,
): string {
  const merged = String(roomId ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  if (annexByRoom && typeof annexByRoom === "object") {
    for (const values of Object.values(annexByRoom)) {
      if (!Array.isArray(values)) continue;
      for (const value of values) {
        const id = String(value).trim();
        if (id && !merged.includes(id)) merged.push(id);
      }
    }
  }
  return merged
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .join(", ");
}

/**
 * Format selected auxiliary spaces for calendar descriptions / detail UI.
 * Example: `1201: 1200L-6 Seminar Foyer, 1204 Seminar Lounge; 103: Garage Green Room`
 */
export function formatAnnexByRoomForDisplay(
  annexByRoom: Record<string, string[]> | undefined,
  rooms: ServiceResourceLike[],
): string {
  if (!annexByRoom || typeof annexByRoom !== "object") return "";

  const parts: string[] = [];
  for (const [roomId, values] of Object.entries(annexByRoom)) {
    if (!Array.isArray(values) || values.length === 0) continue;
    const room = rooms.find(
      (r) => getServiceResourceId(r) === String(roomId),
    );
    const options = room ? getAnnexOptions(room, rooms) : [];
    const labels = values.map((value) => {
      const annexResource = rooms.find(
        (r) => r.parentResourceId && getServiceResourceId(r) === String(value),
      );
      if (annexResource) return annexResourceLabel(annexResource);
      const opt = options.find((o) => o.value === value);
      return opt?.label ?? value;
    });
    parts.push(`${roomId}: ${labels.join(", ")}`);
  }
  return parts.join("; ");
}

export function anyRoomHasVisibleService(
  rooms: ServiceResourceLike[],
  key: ResourceServiceKey,
  context: ServiceVisibilityContext,
): boolean {
  return getRoomsWithVisibleService(rooms, key, context).length > 0;
}

export function optionRequiresChartField(
  option: ResourceFormOption | undefined,
): boolean {
  return !!option?.chartField;
}

export function sectionRequiresChartField(
  config: ResourceFormSectionConfig | undefined,
): boolean {
  return !!config?.chartField;
}

export function getOptionChartField(
  option: ResourceFormOption | undefined,
): ResourceChartFieldConfig | undefined {
  return option?.chartField;
}

/** Radio and select both render as a choice list. */
export function isChoiceMode(
  mode: ResourceFormSectionConfig["mode"] | undefined,
): boolean {
  return mode === "radio" || mode === "select";
}

/** Derive deprecated form.services flags from resource.services keys */
export function deriveFormServicesFlags(resources: ServiceResourceLike[]): {
  showCatering: boolean;
  showEquipment: boolean;
  showSecurity: boolean;
  showSetup: boolean;
  showStaffing: boolean;
} {
  return {
    showSetup: anyRoomHasService(resources, "setup"),
    showEquipment: anyRoomHasService(resources, "equipment"),
    showStaffing: anyRoomHasService(resources, "staffing"),
    showCatering: anyRoomHasService(resources, "catering"),
    showSecurity: anyRoomHasService(resources, "security"),
  };
}
