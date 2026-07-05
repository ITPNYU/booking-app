import type {
  Resource,
  ResourceServicesConfig,
  ResourceStaffingConfig,
} from "@/components/src/client/routes/components/schemaTypes";
import { StaffingServices } from "@/components/src/types";

const SERVICE_LABELS: Record<string, string> = {
  setup: "Room Setup",
  staffing: "Staffing",
  equipment: "Equipment",
  catering: "Catering",
  cleaning: "Cleaning",
  security: "Security",
};

function staffingEnumLabel(key: string): string {
  return (StaffingServices as Record<string, string>)[key] ?? key;
}

/** Convert legacy string[] + staffing arrays into ResourceServicesConfig */
export function migrateResourceServices(
  resource: Record<string, unknown>,
): ResourceServicesConfig {
  const rawServices = resource.services;
  const result: ResourceServicesConfig = {};

  if (Array.isArray(rawServices) && rawServices.every((s) => typeof s === "string")) {
    for (const key of rawServices) {
      if (key === "setup") {
        result.setup = {
          mode: "toggle",
          label: SERVICE_LABELS.setup,
        };
      } else if (key === "staffing") {
        result.staffing = { mode: "toggle", label: SERVICE_LABELS.staffing };
      } else if (key === "equipment") {
        result.equipment = { mode: "toggle", label: SERVICE_LABELS.equipment };
      } else if (key === "catering") {
        result.catering = {
          mode: "toggle",
          label: SERVICE_LABELS.catering,
          forceCleaning: true,
        };
      } else if (key === "cleaning") {
        result.cleaning = { mode: "toggle", label: SERVICE_LABELS.cleaning };
      } else if (key === "security") {
        result.security = { mode: "toggle", label: SERVICE_LABELS.security };
      }
    }
  } else if (rawServices && typeof rawServices === "object" && !Array.isArray(rawServices)) {
    Object.assign(result, rawServices as ResourceServicesConfig);
  }

  const staffingServices = resource.staffingServices as string[] | undefined;
  const staffingSections = resource.staffingSections as
    | Array<{ name: string; indexes: number[] }>
    | undefined;

  if (
    staffingServices?.length &&
    !result.staffing?.sections &&
    !result.staffing?.staffingOptions
  ) {
    const staffing: ResourceStaffingConfig = {
      mode: "toggle",
      label: SERVICE_LABELS.staffing,
      ...result.staffing,
    };

    if (staffingSections?.length) {
      staffing.sections = {};
      staffingSections.forEach((section, sectionIndex) => {
        const baseKey =
          section.name.toLowerCase().replace(/\s+/g, "_") || "section";
        const sectionKey = `${sectionIndex}_${baseKey}`;
        staffing.sections![sectionKey] = {
          name: section.name,
          services: section.indexes
            .map((index) => staffingServices[index])
            .filter(Boolean)
            .map((value) => ({
              value,
              label: staffingEnumLabel(value),
            })),
        };
      });
    } else {
      staffing.staffingOptions = staffingServices.map((value) => ({
        value,
        label: staffingEnumLabel(value),
      }));
    }

    result.staffing = staffing;
  }

  return result;
}

export function normalizeResourceServices(resource: Resource): Resource {
  const raw = resource as unknown as Record<string, unknown>;
  const hasLegacyServices = Array.isArray(raw.services);
  const hasStaffingLegacy =
    Array.isArray(raw.staffingServices) &&
    (raw.staffingServices as unknown[]).length > 0;
  const hasStaffingSections =
    Array.isArray(raw.staffingSections) &&
    (raw.staffingSections as unknown[]).length > 0;
  const hasObjectServices =
    raw.services &&
    typeof raw.services === "object" &&
    !Array.isArray(raw.services);

  if (
    !hasLegacyServices &&
    !hasStaffingLegacy &&
    !hasStaffingSections &&
    !hasObjectServices
  ) {
    return resource;
  }

  return {
    ...resource,
    services: migrateResourceServices(raw),
  };
}
