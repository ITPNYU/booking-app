import type {
  Resource,
  ResourceChartFieldConfig,
  ResourceFormOption,
  ResourceFormSectionConfig,
  ResourceServicesConfig,
  ResourceServiceKey,
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
  staffingServices?: string[];
  staffingSections?: { name: string; indexes: number[] }[];
};

export function getServiceResourceId(room: ServiceResourceLike): string {
  return room.resourceId ?? room.roomId ?? "";
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

/** Annex options for a parent room (used on the room selection page). */
export function getAnnexOptions(
  resource: ServiceResourceLike,
): ResourceFormOption[] {
  const section = getServiceSectionConfig(resource, "annex");
  return section?.options ?? [];
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
    const options = room ? getAnnexOptions(room) : [];
    const labels = values.map((value) => {
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
