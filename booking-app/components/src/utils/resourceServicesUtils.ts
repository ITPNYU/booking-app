import type {
  Resource,
  ResourceFormSectionConfig,
  ResourceServicesConfig,
  ResourceServiceKey,
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

export function resourceHasService(
  resource: ServiceResourceLike,
  key: ResourceServiceKey,
): boolean {
  if (isLegacyServicesArray(resource.services)) {
    return resource.services.includes(key);
  }
  const config = getResourceServicesConfig(resource);
  if (key === "auxiliarySpace") {
    return !!config.auxiliarySpace?.enabled;
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
  const section = config[key];
  if (!section || key === "auxiliarySpace") return undefined;
  return section as ResourceFormSectionConfig;
}

export function shouldShowServiceSection(
  config: ResourceFormSectionConfig | undefined,
  context: ServiceVisibilityContext,
): boolean {
  if (!config || config.mode === "hidden") return false;
  if (context.isWalkIn && config.hideForWalkIn) return false;
  if (context.isVIP && config.hideForVIP) return false;
  if (context.isStandardUser && config.hideForUser) return false;
  return true;
}

export function getRoomsWithVisibleService(
  rooms: ServiceResourceLike[],
  key: ResourceServiceKey,
  context: ServiceVisibilityContext,
): ServiceResourceLike[] {
  return rooms.filter((room) => {
    if (!resourceHasService(room, key)) return false;
    const section = getServiceSectionConfig(room, key);
    if (!section) {
      return key === "auxiliarySpace"
        ? !!getResourceServicesConfig(room).auxiliarySpace?.enabled
        : false;
    }
    return shouldShowServiceSection(section, context);
  });
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

export function getStaffingConfig(resource: ServiceResourceLike) {
  return getResourceServicesConfig(resource).staffing;
}

export function getFurnishingsConfig(resource: ServiceResourceLike) {
  return getResourceServicesConfig(resource).furnishings;
}

export function getCateringConfig(resource: ServiceResourceLike) {
  return getResourceServicesConfig(resource).catering;
}
