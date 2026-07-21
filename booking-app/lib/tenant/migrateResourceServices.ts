import type {
  Resource,
  ResourceFormOption,
  ResourceFormSectionConfig,
  ResourceServicesConfig,
  ResourceStaffingConfig,
  ResourceStaffingSectionConfig,
  ShowInOrigin,
} from "@/components/src/client/routes/components/schemaTypes";
import { StaffingServices } from "@/components/src/types";

const SERVICE_LABELS: Record<string, string> = {
  setup: "Room Setup",
  staffing: "Staffing",
  equipment: "Equipment",
  catering: "Catering",
  cleaning: "Cleaning",
  security: "Security",
  annex: "Auxiliary Spaces",
};

function staffingEnumLabel(key: string): string {
  return (StaffingServices as Record<string, string>)[key] ?? key;
}

function hideFlagsToShowInOrigin(section: {
  hideForUser?: boolean;
  hideForVIP?: boolean;
  hideForWalkIn?: boolean;
}): ShowInOrigin | undefined {
  const { hideForUser, hideForVIP, hideForWalkIn } = section;
  if (!hideForUser && !hideForVIP && !hideForWalkIn) return undefined;
  return {
    user: hideForUser ? false : true,
    VIP: hideForVIP ? false : true,
    walkIn: hideForWalkIn ? false : true,
  };
}

function normalizeChartField(
  raw: unknown,
): ResourceFormOption["chartField"] | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const cf = raw as Record<string, unknown>;
  return {
    ...(typeof cf.label === "string" ? { label: cf.label } : {}),
    ...(typeof cf.descriptionHtml === "string"
      ? { descriptionHtml: cf.descriptionHtml }
      : {}),
    ...(typeof cf.required === "boolean" ? { required: cf.required } : {}),
    ...(typeof cf.validation === "string" ? { validation: cf.validation } : {}),
  };
}

function pickChartField(
  raw: Record<string, unknown>,
): ResourceFormOption["chartField"] | undefined {
  const fromCamel = normalizeChartField(raw.chartField);
  if (fromCamel) return fromCamel;
  const fromLower = normalizeChartField(raw.chartfield);
  if (fromLower) return fromLower;
  if (raw.requiresChartField || raw.chartFieldWhenYes) {
    return { required: true };
  }
  return undefined;
}

function normalizeOption(opt: Record<string, unknown>): ResourceFormOption {
  const chartField = pickChartField(opt);
  return {
    value: String(opt.value ?? ""),
    label: String(opt.label ?? opt.value ?? ""),
    ...(chartField ? { chartField } : {}),
  };
}

function normalizeSection(
  raw: Record<string, unknown>,
): ResourceFormSectionConfig {
  const modeRaw = raw.mode;
  let mode: ResourceFormSectionConfig["mode"];
  if (modeRaw === "select" || modeRaw === "radio") mode = "radio";
  else if (modeRaw === "static" || modeRaw === "hidden") mode = modeRaw;
  else if (modeRaw === "toggle") mode = undefined;
  else if (typeof modeRaw === "string") mode = undefined;
  else mode = undefined;

  const options = Array.isArray(raw.options)
    ? (raw.options as Record<string, unknown>[]).map(normalizeOption)
    : undefined;

  const chartField = pickChartField(raw);

  // Description-only sections (no choice UI / switch) become static.
  if (
    mode === undefined &&
    (!options || options.length === 0) &&
    !chartField
  ) {
    mode = "static";
  }

  const showInOrigin =
    (raw.showInOrigin as ShowInOrigin | undefined) ??
    hideFlagsToShowInOrigin(raw);

  const section: ResourceFormSectionConfig = {
    ...(typeof raw.label === "string" ? { label: raw.label } : {}),
    ...(typeof raw.descriptionHtml === "string"
      ? { descriptionHtml: raw.descriptionHtml }
      : {}),
    ...(mode ? { mode } : {}),
    ...(typeof raw.defaultValue === "string"
      ? { defaultValue: raw.defaultValue }
      : {}),
    ...(typeof raw.required === "boolean" ? { required: raw.required } : {}),
    ...(options ? { options } : {}),
    ...(chartField ? { chartField } : {}),
    ...(showInOrigin ? { showInOrigin } : {}),
    ...(raw.forceCleaning === true ? { forceCleaning: true } : {}),
    ...(raw.studentLoungeCheckbox === true
      ? { studentLoungeCheckbox: true }
      : {}),
    ...(raw.showDetailsField === true ? { showDetailsField: true } : {}),
    ...(typeof raw.detailsLabel === "string"
      ? { detailsLabel: raw.detailsLabel }
      : {}),
    ...(typeof raw.detailsDescriptionHtml === "string"
      ? { detailsDescriptionHtml: raw.detailsDescriptionHtml }
      : {}),
  };
  return section;
}

function normalizeStaffingSection(
  raw: Record<string, unknown>,
): ResourceStaffingSectionConfig {
  if (Array.isArray(raw.options)) {
    return {
      label: String(raw.label ?? raw.name ?? "Staffing"),
      ...(typeof raw.descriptionHtml === "string"
        ? { descriptionHtml: raw.descriptionHtml }
        : {}),
      mode: "radio",
      ...(typeof raw.defaultValue === "string"
        ? { defaultValue: raw.defaultValue }
        : {}),
      options: (raw.options as Record<string, unknown>[]).map(normalizeOption),
    };
  }
  const services = Array.isArray(raw.services)
    ? (raw.services as ResourceFormOption[])
    : [];
  return {
    label: String(raw.label ?? raw.name ?? "Staffing"),
    mode: "radio",
    options: services.map((s) => ({
      value: s.value,
      label: s.label,
    })),
  };
}

function normalizeObjectServices(
  raw: Record<string, unknown>,
): ResourceServicesConfig {
  const result: ResourceServicesConfig = {};

  for (const key of [
    "setup",
    "furnishings",
    "equipment",
    "catering",
    "cleaning",
    "security",
    "annex",
  ] as const) {
    if (raw[key] && typeof raw[key] === "object") {
      result[key] = normalizeSection(raw[key] as Record<string, unknown>);
    }
  }

  if (raw.auxiliarySpace && typeof raw.auxiliarySpace === "object") {
    const aux = raw.auxiliarySpace as Record<string, unknown>;
    if (!result.annex) {
      if (aux.enabled === false) {
        // skip
      } else if (aux.mode || aux.options) {
        result.annex = normalizeSection(aux);
      } else {
        result.annex = {
          label: typeof aux.label === "string" ? aux.label : "Auxiliary Spaces",
          ...(typeof aux.descriptionHtml === "string"
            ? { descriptionHtml: aux.descriptionHtml }
            : {}),
        };
      }
    }
  }

  if (raw.staffing && typeof raw.staffing === "object") {
    const staffingRaw = raw.staffing as Record<string, unknown>;
    const staffing: ResourceStaffingConfig = {
      ...(typeof staffingRaw.label === "string"
        ? { label: staffingRaw.label }
        : {}),
      ...(typeof staffingRaw.descriptionHtml === "string"
        ? { descriptionHtml: staffingRaw.descriptionHtml }
        : {}),
      ...(staffingRaw.showInOrigin
        ? { showInOrigin: staffingRaw.showInOrigin as ShowInOrigin }
        : hideFlagsToShowInOrigin(staffingRaw)
          ? { showInOrigin: hideFlagsToShowInOrigin(staffingRaw) }
          : {}),
    };
    if (
      staffingRaw.sections &&
      typeof staffingRaw.sections === "object" &&
      !Array.isArray(staffingRaw.sections)
    ) {
      staffing.sections = {};
      for (const [sectionKey, sectionVal] of Object.entries(
        staffingRaw.sections as Record<string, unknown>,
      )) {
        if (sectionVal && typeof sectionVal === "object") {
          staffing.sections[sectionKey] = normalizeStaffingSection(
            sectionVal as Record<string, unknown>,
          );
        }
      }
    }
    if (
      Array.isArray(staffingRaw.staffingOptions) &&
      !staffing.sections
    ) {
      staffing.sections = {
        default: {
          label: staffing.label ?? "Staffing",
          mode: "radio",
          options: (staffingRaw.staffingOptions as ResourceFormOption[]).map(
            (s) => ({ value: s.value, label: s.label }),
          ),
        },
      };
    }
    // Description-only staffing (no sections) → static info.
    if (
      !staffing.sections ||
      Object.keys(staffing.sections).length === 0
    ) {
      staffing.mode = "static";
      delete staffing.sections;
    }
    result.staffing = staffing;
  }

  return result;
}

/** Convert legacy string[] + staffing arrays into ResourceServicesConfig */
export function migrateResourceServices(
  resource: Record<string, unknown>,
): ResourceServicesConfig {
  const rawServices = resource.services;
  let result: ResourceServicesConfig = {};

  if (Array.isArray(rawServices) && rawServices.every((s) => typeof s === "string")) {
    for (const key of rawServices) {
      if (key === "setup") {
        result.setup = { label: SERVICE_LABELS.setup };
      } else if (key === "staffing") {
        result.staffing = { label: SERVICE_LABELS.staffing };
      } else if (key === "equipment") {
        result.equipment = { label: SERVICE_LABELS.equipment };
      } else if (key === "catering") {
        result.catering = {
          label: SERVICE_LABELS.catering,
        };
      } else if (key === "cleaning") {
        result.cleaning = { label: SERVICE_LABELS.cleaning };
      } else if (key === "security") {
        result.security = { label: SERVICE_LABELS.security };
      } else if (key === "annex" || key === "auxiliarySpace") {
        result.annex = { label: SERVICE_LABELS.annex };
      }
    }
  } else if (rawServices && typeof rawServices === "object" && !Array.isArray(rawServices)) {
    result = normalizeObjectServices(rawServices as Record<string, unknown>);
  }

  const staffingServices = resource.staffingServices as string[] | undefined;
  const staffingSections = resource.staffingSections as
    | Array<{ name: string; indexes: number[] }>
    | undefined;

  if (
    staffingServices?.length &&
    !result.staffing?.sections
  ) {
    const staffing: ResourceStaffingConfig = {
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
          label: section.name,
          mode: "radio",
          options: section.indexes
            .map((index) => staffingServices[index])
            .filter(Boolean)
            .map((value) => ({
              value,
              label: staffingEnumLabel(value),
            })),
        };
      });
    } else {
      staffing.sections = {
        default: {
          label: SERVICE_LABELS.staffing,
          mode: "radio",
          options: staffingServices.map((value) => ({
            value,
            label: staffingEnumLabel(value),
          })),
        },
      };
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
