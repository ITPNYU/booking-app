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

export function isLegacyServicesArray(
  services: Resource["services"],
): services is string[] {
  return Array.isArray(services);
}

export function getResourceServicesConfig(
  resource: Pick<Resource, "services">,
): ResourceServicesConfig {
  const { services } = resource;
  if (!services || isLegacyServicesArray(services)) {
    return {};
  }
  return services;
}

export function isServiceOffered(
  resource: Pick<Resource, "services">,
  key: ResourceServiceKey,
): boolean {
  const config = getResourceServicesConfig(resource);
  const section = config[key];
  if (!section) return false;
  if (isLegacyServicesArray(resource.services)) {
    return resource.services.includes(key);
  }
  if (key === "auxiliarySpace") {
    return !!(section as { enabled?: boolean }).enabled;
  }
  if ((section as ResourceFormSectionConfig).mode === "hidden") {
    return true;
  }
  return true;
}

export function resourceHasService(
  resource: Pick<Resource, "services">,
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
  rooms: Array<Pick<Resource, "services" | "resourceId" | "name">>,
  key: ResourceServiceKey,
): boolean {
  return rooms.some((room) => resourceHasService(room, key));
}

export function getServiceSectionConfig(
  resource: Pick<Resource, "services">,
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
  rooms: Array<Pick<Resource, "services" | "resourceId" | "name">>,
  key: ResourceServiceKey,
  context: ServiceVisibilityContext,
): Array<Pick<Resource, "services" | "resourceId" | "name">> {
  return rooms.filter((room) => {
    if (!resourceHasService(room, key)) return false;
    const section = getServiceSectionConfig(room, key);
    if (!section) {
      return key === "auxiliarySpace"
        ? !!(getResourceServicesConfig(room).auxiliarySpace as { enabled?: boolean })
            ?.enabled
        : false;
    }
    return shouldShowServiceSection(section, context);
  });
}

/** Derive deprecated form.services flags from resource.services keys */
export function deriveFormServicesFlags(
  resources: Array<Pick<Resource, "services">>,
): {
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

export function getStaffingConfig(resource: Pick<Resource, "services" | "staffingServices" | "staffingSections">) {
  const servicesConfig = getResourceServicesConfig(resource);
  if (servicesConfig.staffing) {
    return servicesConfig.staffing;
  }
  return undefined;
}
