import {
  Checkbox,
  FormControl,
  FormControlLabel,
  FormHelperText,
  Radio,
  RadioGroup,
  Switch,
} from "@mui/material";
import {
  Control,
  Controller,
  FieldErrors,
  UseFormTrigger,
} from "react-hook-form";
import React, { useEffect, useMemo, useRef, useState } from "react";
import styled from "@emotion/styled";
import { FormContextLevel, Inputs } from "../../../../types";
import {
  CHARTFIELD_PATTERN_MESSAGE,
  CHARTFIELD_REGEX,
} from "../../../../utils/validationHelpers";
import {
  getResourceServicesConfig,
  getRoomsWithVisibleService,
  getServiceResourceId,
  getServiceSectionConfig,
  getServiceToggle,
  isChoiceMode,
  isSchemaDrivenEquipmentSection,
  isSecuritySwitchLike,
  lockedToggleValue,
  resolveSharedServiceToggle,
  ServiceResourceLike,
  ServiceVisibilityContext,
  shouldShowServiceSection,
} from "../../../../utils/resourceServicesUtils";
import BookingFormStaffingServices from "./BookingFormStaffingServices";

const Label = styled.label`
  font-weight: 500;
  font-size: 0.875rem;
  line-height: 1.25rem;
  margin-bottom: 0.5rem;
  display: block;
`;

const RoomHeading = styled.h3`
  font-weight: 600;
  font-size: 1rem;
  line-height: 1.5rem;
  margin: 0 0 16px;
`;

const RoomBlock = styled.div`
  margin-bottom: 40px;
`;

const Subsection = styled.div`
  margin-bottom: 24px;
`;

/** Service name and its yes/no switch on one line, description underneath. */
const SwitchRow = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
`;

function roomDisplayTitle(room: ServiceResourceLike): string {
  const id = getServiceResourceId(room);
  return [id, room.name].filter(Boolean).join(" ");
}

interface Props {
  selectedRooms: ServiceResourceLike[];
  control: Control<Inputs, any>;
  errors: FieldErrors<Inputs>;
  trigger: UseFormTrigger<Inputs>;
  watch: (name?: keyof Inputs) => any;
  setValue: (
    name: keyof Inputs,
    value: any,
    options?: { shouldValidate?: boolean },
  ) => void;
  isWalkIn: boolean;
  isVIP: boolean;
  formatFieldLabel: (label: string) => string;
  showStaffingServices: boolean;
  setShowStaffingServices: (value: boolean) => void;
  formContext: FormContextLevel;
  isLargeEvent: boolean;
}

function HtmlBlock({ html }: { html?: string }) {
  if (!html) return null;
  return (
    <div
      style={{ fontSize: "0.75rem", marginBottom: 8 }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function OptionLabel({
  label,
  descriptionHtml,
}: {
  label: string;
  descriptionHtml?: string;
}) {
  if (!descriptionHtml) return <>{label}</>;
  return (
    <span>
      {label}
      <span
        style={{ display: "block", fontSize: "0.75rem", marginTop: 4 }}
        dangerouslySetInnerHTML={{ __html: descriptionHtml }}
      />
    </span>
  );
}

/**
 * True when the room's default layout is a passive one (no chartfield), i.e.
 * turning the setup switch off has a layout to fall back to.
 */
function hasPassiveSetupDefault(
  cfg: ReturnType<typeof getServiceSectionConfig>,
): boolean {
  if (!cfg?.defaultValue) return false;
  const defaultOption = cfg.options?.find((o) => o.value === cfg.defaultValue);
  return !!defaultOption && !defaultOption.chartField;
}

function mapFieldErrorMessage(error: unknown): string | undefined {
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }
  return undefined;
}

function joinByRoomValues(
  map: Record<string, string> | undefined,
  rooms: ServiceResourceLike[],
): string {
  const parts: string[] = [];
  for (const room of rooms) {
    const resourceId = getServiceResourceId(room);
    const value = map?.[resourceId];
    if (!value || !String(value).trim()) continue;
    const title = roomDisplayTitle(room);
    parts.push(rooms.length > 1 ? `${title}: ${value}` : value);
  }
  return parts.join("; ");
}

/** A security value other than empty / "no" means security was requested. */
function isSecurityRequested(value: unknown): boolean {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.trim().toLowerCase() !== "no"
  );
}

/**
 * Value written when a room's security switch is forced on: the checkbox
 * option (Willoughby) when the room uses checkbox mode, otherwise "yes".
 */
function securityOnValue(
  cfg: ReturnType<typeof getServiceSectionConfig>,
): string {
  if (cfg?.mode === "checkbox") return cfg.options?.[0]?.value ?? "yes";
  return "yes";
}

type ChartFieldRequirement = { resourceId: string; required: boolean };

/** Validate a per-room chartfield map against the rooms that need one. */
function validateChartFieldMap(
  map: Record<string, string> | undefined,
  requirements: ChartFieldRequirement[],
): string | true {
  for (const { resourceId, required } of requirements) {
    const value = map?.[resourceId] ?? "";
    if (!required) {
      if (value && !CHARTFIELD_REGEX.test(value)) {
        return CHARTFIELD_PATTERN_MESSAGE;
      }
      continue;
    }
    if (!CHARTFIELD_REGEX.test(value)) return CHARTFIELD_PATTERN_MESSAGE;
  }
  return true;
}

/** Plain chartfield input bound to one room's entry in a by-room map. */
function ByRoomChartFieldInput({
  id,
  label,
  descriptionHtml,
  required,
  value,
  error,
  onChange,
  onBlur,
}: {
  id: string;
  label: string;
  descriptionHtml?: string;
  required: boolean;
  value: string;
  error?: string;
  onChange: (next: string) => void;
  onBlur: () => void;
}) {
  return (
    <>
      <Label htmlFor={id}>
        {label}
        {required ? " *" : ""}
      </Label>
      <HtmlBlock html={descriptionHtml} />
      <input
        id={id}
        style={{
          width: "100%",
          padding: "8px",
          marginBottom: 16,
          border: "1px solid #ccc",
          borderRadius: 4,
        }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        aria-required={required}
        aria-invalid={!!error}
      />
      {error && <FormHelperText error>{error}</FormHelperText>}
    </>
  );
}

/**
 * Mirror the per-room catering / cleaning / security maps into the legacy
 * booking-level scalars (any room "yes" → "yes"; chartfields joined per room)
 * so approvals, emails and exports keep reading the flat fields.
 * A service with no visible rooms leaves its scalar alone (legacy rooms own it).
 */
function syncServiceLegacyScalars(
  setValue: Props["setValue"],
  watch: Props["watch"],
  rooms: {
    catering: ServiceResourceLike[];
    cleaning: ServiceResourceLike[];
    security: ServiceResourceLike[];
  },
  maps: {
    catering: Record<string, string>;
    cateringChart: Record<string, string>;
    cleaning: Record<string, string>;
    cleaningChart: Record<string, string>;
    security: Record<string, string>;
    securityChart: Record<string, string>;
  },
) {
  const write = (name: keyof Inputs, value: string) => {
    if ((watch(name) ?? "") === value) return;
    setValue(name, value, { shouldValidate: false });
  };
  if (rooms.catering.length > 0) {
    const active = rooms.catering.filter(
      (room) => maps.catering[getServiceResourceId(room)] === "yes",
    );
    write("catering", active.length > 0 ? "yes" : "no");
    write(
      "chartFieldForCatering",
      joinByRoomValues(maps.cateringChart, active),
    );
  }
  if (rooms.cleaning.length > 0) {
    const active = rooms.cleaning.filter(
      (room) => maps.cleaning[getServiceResourceId(room)] === "yes",
    );
    write("cleaningService", active.length > 0 ? "yes" : "no");
    write(
      "chartFieldForCleaning",
      joinByRoomValues(maps.cleaningChart, active),
    );
  }
  if (rooms.security.length > 0) {
    const active = rooms.security.filter((room) =>
      isSecurityRequested(maps.security[getServiceResourceId(room)]),
    );
    const values = Array.from(
      new Set(
        active.map((room) => maps.security[getServiceResourceId(room)].trim()),
      ),
    );
    write("hireSecurity", values.join("; "));
    write(
      "chartFieldForSecurity",
      joinByRoomValues(maps.securityChart, active),
    );
  }
}

function syncSetupLegacyScalars(
  setValue: Props["setValue"],
  setupRooms: ServiceResourceLike[],
  setupMap: Record<string, string>,
  detailsMap: Record<string, string>,
  chartMap: Record<string, string>,
  existingSetupDetails?: string,
  existingSetupChart?: string,
) {
  const activeRooms = setupRooms.filter((room) => {
    const id = getServiceResourceId(room);
    const v = setupMap[id];
    return (
      typeof v === "string" && v.trim().length > 0 && v.toLowerCase() !== "no"
    );
  });
  setValue("roomSetup", activeRooms.length > 0 ? "yes" : "", {
    shouldValidate: false,
  });
  const nextDetails = joinByRoomValues(detailsMap, activeRooms);
  const nextChart = joinByRoomValues(chartMap, activeRooms);
  // Prefer by-room joins when present. If maps are sparse (e.g. multi-room
  // legacy edit where only one room was backfilled), keep prior legacy text
  // instead of overwriting with a single room's fragment.
  const hasPartialMaps =
    activeRooms.length > 1 &&
    activeRooms.some((room) => {
      const id = getServiceResourceId(room);
      const d = detailsMap[id];
      return !d || !String(d).trim();
    });
  setValue(
    "setupDetails",
    nextDetails ||
      (hasPartialMaps ? existingSetupDetails?.trim() || "" : "") ||
      "",
    { shouldValidate: false },
  );
  setValue(
    "chartFieldForRoomSetup",
    nextChart || (hasPartialMaps ? existingSetupChart?.trim() || "" : "") || "",
    { shouldValidate: false },
  );
}

/** Shared yes/no switch bound via watch/setValue so it can appear under multiple rooms. */
function SharedYesNoSwitch({
  label,
  description,
  value,
  disabled,
  locked,
  onChange,
  testId,
}: {
  label: string;
  description?: React.ReactNode;
  value: string;
  disabled?: boolean;
  /** Schema toggle lock ("on" / "off"): rendered disabled, value is fixed. */
  locked?: boolean;
  onChange: (next: "yes" | "no") => void;
  /** Stable hook for e2e tests, e.g. `service-switch-setup-103`. */
  testId?: string;
}) {
  return (
    <div>
      <SwitchRow>
        <Label style={{ marginBottom: 0 }}>{label}</Label>
        <FormControlLabel
          sx={{ mx: 0 }}
          label={value === "yes" ? "Yes" : "No"}
          control={
            <Switch
              checked={value === "yes"}
              disabled={disabled || locked}
              onChange={(e) => onChange(e.target.checked ? "yes" : "no")}
              inputProps={
                testId ? ({ "data-testid": testId } as object) : undefined
              }
            />
          }
        />
      </SwitchRow>
      {description}
    </div>
  );
}

export default function BookingFormResourceServices({
  selectedRooms,
  control,
  errors,
  trigger,
  watch,
  setValue,
  isWalkIn,
  isVIP,
  formatFieldLabel,
  showStaffingServices,
  setShowStaffingServices,
  formContext,
  isLargeEvent,
}: Props) {
  const visibility = useMemo<ServiceVisibilityContext>(
    () => ({
      isVIP,
      isWalkIn,
      isStandardUser: !isVIP && !isWalkIn,
    }),
    [isVIP, isWalkIn],
  );

  const hasConfig = selectedRooms.some(
    (r) => Object.keys(getResourceServicesConfig(r)).length > 0,
  );

  const setupRooms = useMemo(
    () =>
      getRoomsWithVisibleService(selectedRooms, "setup", {
        isVIP,
        isWalkIn,
        isStandardUser: !isVIP && !isWalkIn,
      }).filter((r) => isChoiceMode(getServiceSectionConfig(r, "setup")?.mode)),
    [selectedRooms, isVIP, isWalkIn],
  );
  const furnishingsRooms = useMemo(
    () =>
      getRoomsWithVisibleService(selectedRooms, "furnishings", {
        isVIP,
        isWalkIn,
        isStandardUser: !isVIP && !isWalkIn,
      }),
    [selectedRooms, isVIP, isWalkIn],
  );

  const firstStaffingRoomId = useMemo(() => {
    const room = getRoomsWithVisibleService(selectedRooms, "staffing", {
      isVIP,
      isWalkIn,
      isStandardUser: !isVIP && !isWalkIn,
    })[0];
    return room ? getServiceResourceId(room) : null;
  }, [selectedRooms, isVIP, isWalkIn]);
  const staffingToggle = useMemo(
    () => resolveSharedServiceToggle(selectedRooms, "staffing", visibility),
    [selectedRooms, visibility],
  );

  // Catering, cleaning and security are requested per room.
  const cateringRooms = useMemo(
    () => getRoomsWithVisibleService(selectedRooms, "catering", visibility),
    [selectedRooms, visibility],
  );
  const cleaningRooms = useMemo(
    () => getRoomsWithVisibleService(selectedRooms, "cleaning", visibility),
    [selectedRooms, visibility],
  );
  const securityRooms = useMemo(
    () => getRoomsWithVisibleService(selectedRooms, "security", visibility),
    [selectedRooms, visibility],
  );

  const cateringMapRaw = watch("cateringByRoom") as
    | Record<string, string>
    | undefined;
  const cateringChartRaw = watch("chartFieldForCateringByRoom") as
    | Record<string, string>
    | undefined;
  const cleaningMapRaw = watch("cleaningByRoom") as
    | Record<string, string>
    | undefined;
  const cleaningChartRaw = watch("chartFieldForCleaningByRoom") as
    | Record<string, string>
    | undefined;
  const securityMapRaw = watch("hireSecurityByRoom") as
    | Record<string, string>
    | undefined;
  const securityChartRaw = watch("chartFieldForSecurityByRoom") as
    | Record<string, string>
    | undefined;
  const cateringMap = cateringMapRaw ?? {};
  const cateringChart = cateringChartRaw ?? {};
  const cleaningMap = cleaningMapRaw ?? {};
  const cleaningChart = cleaningChartRaw ?? {};
  const securityMap = securityMapRaw ?? {};
  const securityChart = securityChartRaw ?? {};

  // Equipment switch state for rooms whose equipment toggle is "optional".
  const [equipmentOnByRoom, setEquipmentOnByRoom] = useState<
    Record<string, boolean>
  >({});

  // Room setup switch state for rooms whose setup toggle is "optional".
  const [setupOnByRoom, setSetupOnByRoom] = useState<Record<string, boolean>>(
    {},
  );

  // Rooms whose cleaning / security were switched on by a rule (catering
  // forces cleaning; 75+ attendees forces security) rather than by the user,
  // so the rule can switch them back off when it no longer applies.
  const cleaningAutoSetByRoom = useRef<Record<string, boolean>>({});
  const securityAutoSetByRoom = useRef<Record<string, boolean>>({});

  /** Per-room security toggle; an "off" lock yields to the large-event rule. */
  const securityToggleForRoom = (room: ServiceResourceLike) => {
    const toggle = getServiceToggle(getServiceSectionConfig(room, "security"));
    return toggle === "off" && isLargeEvent ? "optional" : toggle;
  };

  // Per-room catering / cleaning / security rules: schema toggle locks,
  // catering forcing cleaning, and mandatory security for large events. Runs
  // whenever a map changes and converges in one extra pass; the legacy
  // scalars are re-derived afterwards.
  useEffect(() => {
    if (isWalkIn || !hasConfig) return;
    const nextCatering = { ...cateringMap };
    const nextCleaning = { ...cleaningMap };
    const nextSecurity = { ...securityMap };
    const nextSecurityChart = { ...securityChart };
    let cateringChanged = false;
    let cleaningChanged = false;
    let securityChanged = false;
    let securityChartChanged = false;

    cateringRooms.forEach((room) => {
      const id = getServiceResourceId(room);
      const locked = lockedToggleValue(
        getServiceToggle(getServiceSectionConfig(room, "catering")),
      );
      if (locked && nextCatering[id] !== locked) {
        nextCatering[id] = locked;
        cateringChanged = true;
      }
    });

    cleaningRooms.forEach((room) => {
      const id = getServiceResourceId(room);
      const locked = lockedToggleValue(
        getServiceToggle(getServiceSectionConfig(room, "cleaning")),
      );
      if (locked) {
        if (nextCleaning[id] !== locked) {
          nextCleaning[id] = locked;
          cleaningChanged = true;
        }
        return;
      }
      const forced =
        nextCatering[id] === "yes" &&
        getServiceSectionConfig(room, "catering")?.forceCleaning === true;
      if (forced) {
        if (nextCleaning[id] !== "yes") {
          nextCleaning[id] = "yes";
          cleaningChanged = true;
          cleaningAutoSetByRoom.current[id] = true;
        }
      } else if (cleaningAutoSetByRoom.current[id]) {
        cleaningAutoSetByRoom.current[id] = false;
        if (nextCleaning[id] === "yes") {
          nextCleaning[id] = "no";
          cleaningChanged = true;
        }
      }
    });

    securityRooms.forEach((room) => {
      const id = getServiceResourceId(room);
      const cfg = getServiceSectionConfig(room, "security");
      if (!isSecuritySwitchLike(cfg)) return;
      const toggle = securityToggleForRoom(room);
      const current = nextSecurity[id] ?? "";
      const requested = isSecurityRequested(current);
      const onValue = securityOnValue(cfg);
      if (toggle === "on") {
        if (!requested) {
          nextSecurity[id] = onValue;
          securityChanged = true;
        }
        return;
      }
      if (toggle === "off") {
        if (current !== "") {
          nextSecurity[id] = "";
          securityChanged = true;
        }
        if (nextSecurityChart[id]) {
          delete nextSecurityChart[id];
          securityChartChanged = true;
        }
        return;
      }
      if (isLargeEvent) {
        if (!requested) {
          nextSecurity[id] = onValue;
          securityChanged = true;
          securityAutoSetByRoom.current[id] = true;
        }
      } else if (securityAutoSetByRoom.current[id]) {
        securityAutoSetByRoom.current[id] = false;
        if (current !== "") {
          nextSecurity[id] = "";
          securityChanged = true;
        }
      }
    });

    if (cateringChanged) {
      setValue("cateringByRoom", nextCatering, { shouldValidate: true });
    }
    if (cleaningChanged) {
      setValue("cleaningByRoom", nextCleaning, { shouldValidate: true });
    }
    if (securityChanged) {
      setValue("hireSecurityByRoom", nextSecurity, { shouldValidate: true });
    }
    if (securityChartChanged) {
      setValue("chartFieldForSecurityByRoom", nextSecurityChart, {
        shouldValidate: false,
      });
    }

    syncServiceLegacyScalars(
      setValue,
      watch,
      {
        catering: cateringRooms,
        cleaning: cleaningRooms,
        security: securityRooms,
      },
      {
        catering: nextCatering,
        cateringChart,
        cleaning: nextCleaning,
        cleaningChart,
        security: nextSecurity,
        securityChart: nextSecurityChart,
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    cateringMapRaw,
    cateringChartRaw,
    cleaningMapRaw,
    cleaningChartRaw,
    securityMapRaw,
    securityChartRaw,
    cateringRooms,
    cleaningRooms,
    securityRooms,
    isLargeEvent,
    isWalkIn,
    hasConfig,
    setValue,
    watch,
  ]);

  /** Chartfield requirements for the rooms currently requesting each service. */
  const cateringChartRequirements = (
    map: Record<string, string>,
  ): ChartFieldRequirement[] =>
    cateringRooms.flatMap((room) => {
      const cfg = getServiceSectionConfig(room, "catering");
      const id = getServiceResourceId(room);
      if (!cfg?.chartField || map[id] !== "yes") return [];
      if (cfg.mode === "static" && !cfg.studentLoungeCheckbox) return [];
      return [{ resourceId: id, required: cfg.chartField.required !== false }];
    });
  const cleaningChartRequirements = (
    map: Record<string, string>,
  ): ChartFieldRequirement[] =>
    cleaningRooms.flatMap((room) => {
      const cfg = getServiceSectionConfig(room, "cleaning");
      const id = getServiceResourceId(room);
      if (!cfg?.chartField || map[id] !== "yes") return [];
      return [{ resourceId: id, required: cfg.chartField.required === true }];
    });
  const securityChartRequirements = (
    map: Record<string, string>,
  ): ChartFieldRequirement[] =>
    securityRooms.flatMap((room) => {
      const cfg = getServiceSectionConfig(room, "security");
      const id = getServiceResourceId(room);
      const value = map[id] ?? "";
      if (!cfg || !isSecurityRequested(value)) return [];
      if (isChoiceMode(cfg.mode) || cfg.mode === "checkbox") {
        const option = cfg.options?.find((o) => o.value === value);
        if (!option?.chartField) return [];
        return [
          { resourceId: id, required: option.chartField.required !== false },
        ];
      }
      if (cfg.mode === "static" || !cfg.chartField) return [];
      return [{ resourceId: id, required: cfg.chartField.required === true }];
    });

  /**
   * Whether a room's Room Setup switch is on. Off means "no setup requested":
   * no layout value is stored and no chartfield is required.
   */
  const isSetupSwitchOn = (
    room: ServiceResourceLike,
    setupMap: Record<string, string>,
  ): boolean => {
    const cfg = getServiceSectionConfig(room, "setup");
    const toggle = getServiceToggle(cfg);
    if (toggle === "on") return true;
    if (toggle === "off") return false;
    const resourceId = getServiceResourceId(room);
    if (setupOnByRoom[resourceId] !== undefined) {
      return setupOnByRoom[resourceId];
    }
    const value = setupMap[resourceId];
    if (!value) return false;
    // A stored value that is not the passive default means setup was requested.
    return !(hasPassiveSetupDefault(cfg) && value === cfg?.defaultValue);
  };

  // Per-room locks: setup values, furnishings value map, equipment details.
  useEffect(() => {
    const currentSetup =
      (watch("roomSetupByRoom") as Record<string, string> | undefined) ?? {};
    const nextSetup = { ...currentSetup };
    let setupChanged = false;
    setupRooms.forEach((room) => {
      if (getServiceToggle(getServiceSectionConfig(room, "setup")) !== "off") {
        return;
      }
      const resourceId = getServiceResourceId(room);
      if (nextSetup[resourceId]) {
        delete nextSetup[resourceId];
        setupChanged = true;
      }
    });
    if (setupChanged) {
      setValue("roomSetupByRoom", nextSetup, { shouldValidate: false });
    }

    const currentFurn =
      (watch("furnishingsByRoom") as Record<string, string> | undefined) ?? {};
    const nextFurn = { ...currentFurn };
    let furnChanged = false;
    furnishingsRooms.forEach((room) => {
      const locked = lockedToggleValue(
        getServiceToggle(getResourceServicesConfig(room).furnishings),
      );
      if (!locked) return;
      const resourceId = getServiceResourceId(room);
      if (nextFurn[resourceId] !== locked) {
        nextFurn[resourceId] = locked;
        furnChanged = true;
      }
    });
    if (furnChanged) {
      setValue("furnishingsByRoom", nextFurn, { shouldValidate: false });
    }

    const currentDetails =
      (watch("equipmentServicesDetailsByRoom") as
        | Record<string, string>
        | undefined) ?? {};
    const nextDetails = { ...currentDetails };
    let detailsChanged = false;
    selectedRooms.forEach((room) => {
      const cfg = getServiceSectionConfig(room, "equipment");
      if (getServiceToggle(cfg) !== "off") return;
      const resourceId = getServiceResourceId(room);
      if (nextDetails[resourceId]) {
        delete nextDetails[resourceId];
        detailsChanged = true;
      }
    });
    if (detailsChanged) {
      setValue("equipmentServicesDetailsByRoom", nextDetails, {
        shouldValidate: false,
      });
      setValue(
        "equipmentServicesDetails",
        Object.values(nextDetails)
          .map((v) => (typeof v === "string" ? v.trim() : ""))
          .filter(Boolean)
          .join("\n"),
        { shouldValidate: false },
      );
    }
  }, [furnishingsRooms, selectedRooms, setupRooms, setValue, watch]);

  const setupChartError = mapFieldErrorMessage(
    errors.chartFieldForRoomSetupByRoom,
  );
  const furnishingsChartError = mapFieldErrorMessage(
    errors.chartFieldForFurnishingsByRoom,
  );
  const equipmentDetailsError = mapFieldErrorMessage(
    errors.equipmentServicesDetailsByRoom,
  );
  const furnishingsDetailsError = mapFieldErrorMessage(
    errors.furnishingsDetailsByRoom,
  );
  const cateringChartErrorMessage = mapFieldErrorMessage(
    errors.chartFieldForCateringByRoom,
  );
  const cleaningChartErrorMessage = mapFieldErrorMessage(
    errors.chartFieldForCleaningByRoom,
  );
  const securityChartErrorMessage = mapFieldErrorMessage(
    errors.chartFieldForSecurityByRoom,
  );
  const securityChoiceErrorMessage = mapFieldErrorMessage(
    errors.hireSecurityByRoom,
  );

  // Equipment sections with a toggle require details while the switch is on
  // (locked on or user-enabled); equipment only counts as requested when
  // details are filled in.
  const isEquipmentSwitchOn = (
    room: ServiceResourceLike,
    detailsMap: Record<string, string>,
  ): boolean => {
    const cfg = getServiceSectionConfig(room, "equipment");
    if (!cfg?.toggle || !shouldShowServiceSection(cfg, visibility)) {
      return false;
    }
    if (cfg.toggle === "on") return true;
    if (cfg.toggle === "off") return false;
    const resourceId = getServiceResourceId(room);
    return equipmentOnByRoom[resourceId] ?? !!detailsMap[resourceId]?.trim();
  };

  useEffect(() => {
    const currentMap =
      (watch("roomSetupByRoom") as Record<string, string> | undefined) ?? {};
    const currentDetails =
      (watch("setupDetailsByRoom") as Record<string, string> | undefined) ?? {};
    const chartMap =
      (watch("chartFieldForRoomSetupByRoom") as
        | Record<string, string>
        | undefined) ?? {};
    const legacySetup = watch("roomSetup");
    const legacyDetails = watch("setupDetails");
    const hasLegacySetupAnswer =
      legacySetup === "yes" ||
      (typeof legacyDetails === "string" && legacyDetails.trim().length > 0);
    if (Object.keys(currentMap).length === 0 && hasLegacySetupAnswer) {
      return;
    }

    const nextMap = { ...currentMap };
    const nextDetails = { ...currentDetails };
    let changed = false;

    setupRooms.forEach((room) => {
      const cfg = getServiceSectionConfig(room, "setup");
      const resourceId = getServiceResourceId(room);
      // Only pre-select a layout the requester is not charged for; a default
      // that needs a chartfield is chosen explicitly by turning setup on.
      const seedable =
        hasPassiveSetupDefault(cfg) || getServiceToggle(cfg) === "on";
      if (cfg?.defaultValue && seedable && !nextMap[resourceId]) {
        nextMap[resourceId] = cfg.defaultValue;
        const opt = cfg.options?.find((o) => o.value === cfg.defaultValue);
        nextDetails[resourceId] = opt?.label ?? cfg.defaultValue;
        changed = true;
      }
    });

    if (changed) {
      setValue("roomSetupByRoom", nextMap, { shouldValidate: false });
      setValue("setupDetailsByRoom", nextDetails, { shouldValidate: false });
    }

    syncSetupLegacyScalars(
      setValue,
      setupRooms,
      changed ? nextMap : currentMap,
      changed ? nextDetails : currentDetails,
      chartMap,
      typeof legacyDetails === "string" ? legacyDetails : undefined,
      watch("chartFieldForRoomSetup") as string | undefined,
    );
  }, [setupRooms, setValue, watch]);

  if (!hasConfig || isWalkIn) return null;

  const roomsWithAnyService = selectedRooms.filter((room) => {
    const config = getResourceServicesConfig(room);
    return Object.keys(config).some((key) => {
      if (key === "annex" || key === "auxiliarySpace") return false;
      const section = getServiceSectionConfig(room, key as keyof typeof config);
      if (!section) return false;
      return shouldShowServiceSection(section, visibility);
    });
  });

  return (
    <>
      <Controller
        name="roomSetupByRoom"
        control={control}
        rules={{
          validate: (val) => {
            const map = (val as Record<string, string>) ?? {};
            for (const room of setupRooms) {
              const cfg = getServiceSectionConfig(room, "setup")!;
              if (!cfg.required) continue;
              if (!isSetupSwitchOn(room, map)) continue;
              const resourceId = getServiceResourceId(room);
              const v = map[resourceId] ?? cfg.defaultValue;
              if (!v) {
                return `Please select room setup for ${room.name ?? resourceId}`;
              }
            }
            return true;
          },
        }}
        render={() => null}
      />
      <Controller
        name="chartFieldForRoomSetupByRoom"
        control={control}
        shouldUnregister
        rules={{
          validate: (val, formValues) => {
            const map = (val as Record<string, string>) ?? {};
            const setupMap =
              (formValues.roomSetupByRoom as Record<string, string>) ?? {};
            for (const room of setupRooms) {
              const cfg = getServiceSectionConfig(room, "setup")!;
              if (!isSetupSwitchOn(room, setupMap)) continue;
              const resourceId = getServiceResourceId(room);
              const selectedValue =
                setupMap[resourceId] ?? cfg.defaultValue ?? "";
              const selectedOption = cfg.options?.find(
                (o) => o.value === selectedValue,
              );
              if (!selectedOption?.chartField) continue;
              if (selectedOption.chartField.required === false) {
                const optional = map[resourceId] ?? "";
                if (optional && !CHARTFIELD_REGEX.test(optional)) {
                  return CHARTFIELD_PATTERN_MESSAGE;
                }
                continue;
              }
              const v = map[resourceId] ?? "";
              if (!CHARTFIELD_REGEX.test(v)) {
                return CHARTFIELD_PATTERN_MESSAGE;
              }
            }
            return true;
          },
        }}
        render={() => null}
      />
      <Controller
        name="chartFieldForFurnishingsByRoom"
        control={control}
        shouldUnregister
        rules={{
          validate: (val, formValues) => {
            const map = (val as Record<string, string>) ?? {};
            const furnMap =
              (formValues.furnishingsByRoom as Record<string, string>) ?? {};
            for (const room of furnishingsRooms) {
              const cfg = getResourceServicesConfig(room).furnishings;
              if (!cfg?.chartField) continue;
              const resourceId = getServiceResourceId(room);
              if (furnMap[resourceId] !== "yes") continue;
              if (cfg.chartField.required === false) {
                const optional = map[resourceId] ?? "";
                if (optional && !CHARTFIELD_REGEX.test(optional)) {
                  return CHARTFIELD_PATTERN_MESSAGE;
                }
                continue;
              }
              const v = map[resourceId] ?? "";
              if (!CHARTFIELD_REGEX.test(v)) {
                return CHARTFIELD_PATTERN_MESSAGE;
              }
            }
            return true;
          },
        }}
        render={() => null}
      />
      <Controller
        name="furnishingsDetailsByRoom"
        control={control}
        rules={{
          validate: (val, formValues) => {
            const map = (val as Record<string, string>) ?? {};
            const furnMap =
              (formValues.furnishingsByRoom as Record<string, string>) ?? {};
            const missing = furnishingsRooms.some((room) => {
              const cfg = getResourceServicesConfig(room).furnishings;
              if (!cfg?.showDetailsField) return false;
              const resourceId = getServiceResourceId(room);
              return furnMap[resourceId] === "yes" && !map[resourceId]?.trim();
            });
            return missing
              ? "Please describe the additional furniture you need."
              : true;
          },
        }}
        render={() => null}
      />
      <Controller
        name="equipmentServicesDetailsByRoom"
        control={control}
        rules={{
          validate: (val) => {
            const map = (val as Record<string, string>) ?? {};
            const missing = selectedRooms.some(
              (room) =>
                isEquipmentSwitchOn(room, map) &&
                !map[getServiceResourceId(room)]?.trim(),
            );
            return missing
              ? "Please describe your equipment needs in detail."
              : true;
          },
        }}
        render={() => null}
      />
      <Controller
        name="hireSecurityByRoom"
        control={control}
        rules={{
          validate: (val) => {
            const map = (val as Record<string, string>) ?? {};
            for (const room of securityRooms) {
              const cfg = getServiceSectionConfig(room, "security");
              if (!cfg?.required || !isChoiceMode(cfg.mode)) continue;
              if (!map[getServiceResourceId(room)]) {
                return "Please select a security option";
              }
            }
            return true;
          },
        }}
        render={() => null}
      />
      <Controller
        name="chartFieldForCateringByRoom"
        control={control}
        shouldUnregister
        rules={{
          validate: (val, formValues) =>
            validateChartFieldMap(
              val as Record<string, string> | undefined,
              cateringChartRequirements(
                (formValues.cateringByRoom as Record<string, string>) ?? {},
              ),
            ),
        }}
        render={() => null}
      />
      <Controller
        name="chartFieldForCleaningByRoom"
        control={control}
        shouldUnregister
        rules={{
          validate: (val, formValues) =>
            validateChartFieldMap(
              val as Record<string, string> | undefined,
              cleaningChartRequirements(
                (formValues.cleaningByRoom as Record<string, string>) ?? {},
              ),
            ),
        }}
        render={() => null}
      />
      <Controller
        name="chartFieldForSecurityByRoom"
        control={control}
        shouldUnregister
        rules={{
          validate: (val, formValues) =>
            validateChartFieldMap(
              val as Record<string, string> | undefined,
              securityChartRequirements(
                (formValues.hireSecurityByRoom as Record<string, string>) ?? {},
              ),
            ),
        }}
        render={() => null}
      />

      {roomsWithAnyService.map((room) => {
        const resourceId = getServiceResourceId(room);
        const setupCfg = getServiceSectionConfig(room, "setup");
        const showSetupChoice =
          !!setupCfg &&
          isChoiceMode(setupCfg.mode) &&
          shouldShowServiceSection(setupCfg, visibility);
        const showSetupStatic =
          !!setupCfg &&
          setupCfg.mode === "static" &&
          shouldShowServiceSection(setupCfg, visibility);
        const furnishingsCfg = getResourceServicesConfig(room).furnishings;
        const showFurnishings =
          !!furnishingsCfg &&
          shouldShowServiceSection(furnishingsCfg, visibility);
        const equipmentCfg = getServiceSectionConfig(room, "equipment");
        const showEquipment =
          isSchemaDrivenEquipmentSection(equipmentCfg) &&
          !!equipmentCfg &&
          shouldShowServiceSection(equipmentCfg, visibility);
        const staffingSection = getServiceSectionConfig(room, "staffing");
        const showStaffing =
          !!staffingSection &&
          shouldShowServiceSection(staffingSection, visibility) &&
          resourceId === firstStaffingRoomId;
        const cateringCfg = getServiceSectionConfig(room, "catering");
        const showCateringInteractive =
          !!cateringCfg &&
          cateringCfg.mode !== "static" &&
          shouldShowServiceSection(cateringCfg, visibility);
        const showCateringStatic =
          !!cateringCfg &&
          cateringCfg.mode === "static" &&
          shouldShowServiceSection(cateringCfg, visibility);
        const cleaningCfg = getServiceSectionConfig(room, "cleaning");
        const showCleaning =
          !!cleaningCfg && shouldShowServiceSection(cleaningCfg, visibility);
        const securityCfg = getServiceSectionConfig(room, "security");
        const showSecurityChoice =
          !!securityCfg &&
          isChoiceMode(securityCfg.mode) &&
          shouldShowServiceSection(securityCfg, visibility);
        const showSecurityCheckbox =
          !!securityCfg &&
          securityCfg.mode === "checkbox" &&
          shouldShowServiceSection(securityCfg, visibility);
        const showSecuritySwitch =
          !!securityCfg &&
          !isChoiceMode(securityCfg.mode) &&
          securityCfg.mode !== "checkbox" &&
          securityCfg.mode !== "static" &&
          shouldShowServiceSection(securityCfg, visibility);

        const setupMap =
          (watch("roomSetupByRoom") as Record<string, string> | undefined) ??
          {};
        const selectedSetupValue =
          setupMap[resourceId] ?? setupCfg?.defaultValue ?? "";
        const selectedSetupOption = setupCfg?.options?.find(
          (o) => o.value === selectedSetupValue,
        );
        // Setup: the toggle gates the layout options. Off means the room keeps
        // its passive default layout, which is not a requested service.
        const setupToggle = getServiceToggle(setupCfg);
        const setupDefaultValue = setupCfg?.defaultValue ?? "";
        const setupHasPassiveDefault = hasPassiveSetupDefault(setupCfg);
        const setupLocked = setupToggle !== "optional";
        const setupOn = isSetupSwitchOn(room, setupMap);
        const furnMap =
          (watch("furnishingsByRoom") as Record<string, string> | undefined) ??
          {};
        const chartFurn =
          (watch("chartFieldForFurnishingsByRoom") as
            | Record<string, string>
            | undefined) ?? {};
        const furnDetailsByRoom =
          (watch("furnishingsDetailsByRoom") as
            | Record<string, string>
            | undefined) ?? {};
        const detailsByRoom =
          (watch("equipmentServicesDetailsByRoom") as
            | Record<string, string>
            | undefined) ?? {};

        const furnToggle = getServiceToggle(furnishingsCfg);
        const furnLocked = furnToggle !== "optional";
        const furnValue =
          lockedToggleValue(furnToggle) ??
          (furnMap[resourceId] === "yes" ? "yes" : "no");
        // The details validation error is form-wide; only show it under the
        // rooms that are actually missing details.
        const furnishingsDetailsErrorForRoom =
          furnishingsDetailsError &&
          furnValue === "yes" &&
          !furnDetailsByRoom[resourceId]?.trim()
            ? furnishingsDetailsError
            : undefined;

        // Equipment: omitted toggle keeps the legacy layout (no switch). With a
        // toggle, the details field is always available when the switch is on —
        // equipment only counts as requested when details are filled in.
        const equipmentToggle = equipmentCfg?.toggle;
        const equipmentHasSwitch = !!equipmentToggle;
        const equipmentLocked =
          !!equipmentToggle && equipmentToggle !== "optional";
        const equipmentOn = !equipmentHasSwitch
          ? true
          : equipmentToggle === "on"
            ? true
            : equipmentToggle === "off"
              ? false
              : (equipmentOnByRoom[resourceId] ??
                !!detailsByRoom[resourceId]?.trim());
        const equipmentDetailsErrorForRoom =
          equipmentDetailsError &&
          equipmentHasSwitch &&
          equipmentOn &&
          !detailsByRoom[resourceId]?.trim()
            ? equipmentDetailsError
            : undefined;

        // Catering / cleaning / security values and locks for this room.
        const cateringLocked = getServiceToggle(cateringCfg) !== "optional";
        const cateringRoomValue: "yes" | "no" =
          cateringMap[resourceId] === "yes" ? "yes" : "no";
        const cateringChartRequired =
          cateringCfg?.chartField?.required !== false;
        const cateringChartErrorForRoom =
          cateringChartErrorMessage &&
          validateChartFieldMap(cateringChart, [
            { resourceId, required: cateringChartRequired },
          ]) !== true
            ? cateringChartErrorMessage
            : undefined;
        const cleaningLocked = getServiceToggle(cleaningCfg) !== "optional";
        const cleaningRoomValue: "yes" | "no" =
          cleaningMap[resourceId] === "yes" ? "yes" : "no";
        const cleaningForced =
          cateringRoomValue === "yes" && cateringCfg?.forceCleaning === true;
        const cleaningChartRequired =
          cleaningCfg?.chartField?.required === true;
        const cleaningChartErrorForRoom =
          cleaningChartErrorMessage &&
          validateChartFieldMap(cleaningChart, [
            { resourceId, required: cleaningChartRequired },
          ]) !== true
            ? cleaningChartErrorMessage
            : undefined;
        const securityRoomValue = securityMap[resourceId] ?? "";
        const securityRoomRequested = isSecurityRequested(securityRoomValue);
        const securityLocked = securityToggleForRoom(room) !== "optional";
        const securityChartErrorFor = (required: boolean) =>
          securityChartErrorMessage &&
          validateChartFieldMap(securityChart, [{ resourceId, required }]) !==
            true
            ? securityChartErrorMessage
            : undefined;
        const securityChoiceErrorForRoom =
          securityChoiceErrorMessage &&
          securityCfg?.required &&
          !securityRoomValue
            ? securityChoiceErrorMessage
            : undefined;
        const setSecurityForRoom = (value: string) => {
          setValue(
            "hireSecurityByRoom",
            { ...securityMap, [resourceId]: value },
            { shouldValidate: true },
          );
          if (!isSecurityRequested(value)) {
            const { [resourceId]: _dropped, ...rest } = securityChart;
            setValue("chartFieldForSecurityByRoom", rest, {
              shouldValidate: false,
            });
          }
          trigger("hireSecurityByRoom");
          trigger("chartFieldForSecurityByRoom");
        };
        const setCateringForRoom = (value: "yes" | "no") => {
          setValue(
            "cateringByRoom",
            { ...cateringMap, [resourceId]: value },
            { shouldValidate: true },
          );
          if (value === "no") {
            const { [resourceId]: _dropped, ...rest } = cateringChart;
            setValue("chartFieldForCateringByRoom", rest, {
              shouldValidate: false,
            });
          }
          trigger("chartFieldForCateringByRoom");
        };

        return (
          <RoomBlock
            key={resourceId}
            data-testid={`room-services-${resourceId}`}
          >
            <RoomHeading>{roomDisplayTitle(room)}</RoomHeading>

            {showSetupStatic && setupCfg && (
              <Subsection>
                <Label>
                  {formatFieldLabel(setupCfg.label ?? "Room Setup")}
                </Label>
                <HtmlBlock html={setupCfg.descriptionHtml} />
              </Subsection>
            )}

            {showSetupChoice && setupCfg && (
              <Subsection>
                <SharedYesNoSwitch
                  testId={`service-switch-setup-${resourceId}`}
                  label={formatFieldLabel(setupCfg.label ?? "Room Setup")}
                  description={<HtmlBlock html={setupCfg.descriptionHtml} />}
                  value={setupOn ? "yes" : "no"}
                  locked={setupLocked}
                  onChange={(next) => {
                    setSetupOnByRoom((prev) => ({
                      ...prev,
                      [resourceId]: next === "yes",
                    }));
                    if (next === "yes") {
                      // Pre-select the room's default layout so the radio
                      // group is not empty (the chartfield stays required).
                      if (setupDefaultValue && !setupMap[resourceId]) {
                        const defaultOption = setupCfg.options?.find(
                          (o) => o.value === setupDefaultValue,
                        );
                        const details =
                          (watch("setupDetailsByRoom") as
                            | Record<string, string>
                            | undefined) ?? {};
                        setValue(
                          "roomSetupByRoom",
                          { ...setupMap, [resourceId]: setupDefaultValue },
                          { shouldValidate: false },
                        );
                        setValue("setupDetailsByRoom", {
                          ...details,
                          [resourceId]:
                            defaultOption?.label ?? setupDefaultValue,
                        });
                      }
                      return;
                    }
                    // Off: back to the passive default layout when the room
                    // has one, otherwise no setup at all. Drop the chartfield.
                    const nextSetup = { ...setupMap };
                    const details =
                      (watch("setupDetailsByRoom") as
                        | Record<string, string>
                        | undefined) ?? {};
                    const nextDetails = { ...details };
                    const chartMap =
                      (watch("chartFieldForRoomSetupByRoom") as
                        | Record<string, string>
                        | undefined) ?? {};
                    const nextChart = { ...chartMap };
                    if (setupHasPassiveDefault) {
                      const defaultOption = setupCfg.options?.find(
                        (o) => o.value === setupDefaultValue,
                      );
                      nextSetup[resourceId] = setupDefaultValue;
                      nextDetails[resourceId] =
                        defaultOption?.label ?? setupDefaultValue;
                    } else {
                      delete nextSetup[resourceId];
                      delete nextDetails[resourceId];
                    }
                    delete nextChart[resourceId];
                    setValue("roomSetupByRoom", nextSetup, {
                      shouldValidate: true,
                    });
                    setValue("setupDetailsByRoom", nextDetails);
                    setValue("chartFieldForRoomSetupByRoom", nextChart, {
                      shouldValidate: true,
                    });
                    syncSetupLegacyScalars(
                      setValue,
                      setupRooms,
                      nextSetup,
                      nextDetails,
                      nextChart,
                      watch("setupDetails") as string | undefined,
                      watch("chartFieldForRoomSetup") as string | undefined,
                    );
                    trigger("roomSetupByRoom");
                    trigger("chartFieldForRoomSetupByRoom");
                  }}
                />
                {setupOn && (
                  <>
                    <FormControl component="fieldset" fullWidth>
                      <RadioGroup
                        value={selectedSetupValue}
                        onChange={(e) => {
                          const value = e.target.value;
                          const next = {
                            ...setupMap,
                            [resourceId]: value,
                          };
                          setValue("roomSetupByRoom", next, {
                            shouldValidate: true,
                          });
                          const opt = setupCfg.options?.find(
                            (o) => o.value === value,
                          );
                          const details =
                            (watch("setupDetailsByRoom") as
                              | Record<string, string>
                              | undefined) ?? {};
                          const nextDetails = {
                            ...details,
                            [resourceId]: opt?.label ?? value,
                          };
                          setValue("setupDetailsByRoom", nextDetails);
                          const chartMap =
                            (watch("chartFieldForRoomSetupByRoom") as
                              | Record<string, string>
                              | undefined) ?? {};
                          syncSetupLegacyScalars(
                            setValue,
                            setupRooms,
                            next,
                            nextDetails,
                            chartMap,
                            watch("setupDetails") as string | undefined,
                            watch("chartFieldForRoomSetup") as
                              | string
                              | undefined,
                          );
                          trigger("roomSetupByRoom");
                          trigger("chartFieldForRoomSetupByRoom");
                        }}
                      >
                        {setupCfg.options?.map((opt) => (
                          <FormControlLabel
                            key={opt.value}
                            value={opt.value}
                            control={<Radio />}
                            label={
                              <OptionLabel
                                label={opt.label}
                                descriptionHtml={opt.descriptionHtml}
                              />
                            }
                          />
                        ))}
                      </RadioGroup>
                    </FormControl>
                    {!!selectedSetupOption?.chartField && (
                      <>
                        <Label htmlFor={`chart-setup-${resourceId}`}>
                          {selectedSetupOption.chartField?.label ||
                            "ChartField for Room Setup"}
                          {selectedSetupOption.chartField?.required !== false
                            ? " *"
                            : ""}
                        </Label>
                        {selectedSetupOption.chartField?.descriptionHtml ? (
                          <HtmlBlock
                            html={
                              selectedSetupOption.chartField.descriptionHtml
                            }
                          />
                        ) : null}
                        <input
                          id={`chart-setup-${resourceId}`}
                          style={{
                            width: "100%",
                            padding: "8px",
                            marginBottom: 16,
                            border: "1px solid #ccc",
                            borderRadius: 4,
                          }}
                          value={
                            ((watch("chartFieldForRoomSetupByRoom") as
                              | Record<string, string>
                              | undefined) ?? {})[resourceId] ?? ""
                          }
                          onChange={(e) => {
                            const chartMap =
                              (watch("chartFieldForRoomSetupByRoom") as
                                | Record<string, string>
                                | undefined) ?? {};
                            const nextChart = {
                              ...chartMap,
                              [resourceId]: e.target.value,
                            };
                            setValue(
                              "chartFieldForRoomSetupByRoom",
                              nextChart,
                              {
                                shouldValidate: true,
                              },
                            );
                            const details =
                              (watch("setupDetailsByRoom") as
                                | Record<string, string>
                                | undefined) ?? {};
                            syncSetupLegacyScalars(
                              setValue,
                              setupRooms,
                              setupMap,
                              details,
                              nextChart,
                              watch("setupDetails") as string | undefined,
                              watch("chartFieldForRoomSetup") as
                                | string
                                | undefined,
                            );
                          }}
                          onBlur={() => trigger("chartFieldForRoomSetupByRoom")}
                          aria-required
                          aria-invalid={!!setupChartError}
                        />
                        {setupChartError && (
                          <FormHelperText error>
                            {setupChartError}
                          </FormHelperText>
                        )}
                      </>
                    )}
                  </>
                )}
              </Subsection>
            )}

            {showEquipment && equipmentCfg && (
              <Subsection>
                {equipmentHasSwitch ? (
                  <SharedYesNoSwitch
                    testId={`service-switch-equipment-${resourceId}`}
                    label={formatFieldLabel(equipmentCfg.label ?? "Equipment")}
                    description={
                      <HtmlBlock html={equipmentCfg.descriptionHtml} />
                    }
                    value={equipmentOn ? "yes" : "no"}
                    locked={equipmentLocked}
                    onChange={(next) => {
                      setEquipmentOnByRoom((prev) => ({
                        ...prev,
                        [resourceId]: next === "yes",
                      }));
                      if (next === "no") {
                        trigger("equipmentServicesDetailsByRoom");
                      }
                      if (next === "no" && detailsByRoom[resourceId]) {
                        const { [resourceId]: _removed, ...rest } =
                          detailsByRoom;
                        setValue("equipmentServicesDetailsByRoom", rest, {
                          shouldValidate: false,
                        });
                        setValue(
                          "equipmentServicesDetails",
                          Object.values(rest)
                            .map((v) => (typeof v === "string" ? v.trim() : ""))
                            .filter(Boolean)
                            .join("\n"),
                          { shouldValidate: false },
                        );
                      }
                    }}
                  />
                ) : (
                  <>
                    <Label>
                      {formatFieldLabel(equipmentCfg.label ?? "Equipment")}
                    </Label>
                    <HtmlBlock html={equipmentCfg.descriptionHtml} />
                  </>
                )}
                {equipmentOn &&
                  (equipmentCfg.showDetailsField || equipmentHasSwitch) && (
                    <>
                      <Label htmlFor={`equip-details-${resourceId}`}>
                        {equipmentCfg.detailsLabel ??
                          "Equipment request details"}
                        {equipmentHasSwitch ? " *" : ""}
                      </Label>
                      {equipmentCfg.detailsDescriptionHtml ? (
                        <HtmlBlock html={equipmentCfg.detailsDescriptionHtml} />
                      ) : null}
                      <input
                        id={`equip-details-${resourceId}`}
                        style={{
                          width: "100%",
                          padding: "8px",
                          marginBottom: 16,
                          border: "1px solid #ccc",
                          borderRadius: 4,
                        }}
                        value={detailsByRoom[resourceId] ?? ""}
                        aria-required={equipmentHasSwitch}
                        aria-invalid={!!equipmentDetailsErrorForRoom}
                        onChange={(e) => {
                          const next = {
                            ...detailsByRoom,
                            [resourceId]: e.target.value,
                          };
                          setValue("equipmentServicesDetailsByRoom", next, {
                            shouldValidate: equipmentHasSwitch,
                          });
                          const joined = Object.values(next)
                            .map((v) => (typeof v === "string" ? v.trim() : ""))
                            .filter(Boolean)
                            .join("\n");
                          setValue("equipmentServicesDetails", joined, {
                            shouldValidate: false,
                          });
                        }}
                        onBlur={() =>
                          equipmentHasSwitch &&
                          trigger("equipmentServicesDetailsByRoom")
                        }
                      />
                      {equipmentDetailsErrorForRoom && (
                        <FormHelperText error>
                          {equipmentDetailsErrorForRoom}
                        </FormHelperText>
                      )}
                    </>
                  )}
              </Subsection>
            )}

            {showFurnishings && furnishingsCfg && (
              <Subsection>
                <SharedYesNoSwitch
                  testId={`service-switch-furnishings-${resourceId}`}
                  label={formatFieldLabel(
                    furnishingsCfg.label ?? "Additional Event Furniture",
                  )}
                  description={
                    furnishingsCfg.descriptionHtml ? (
                      <HtmlBlock html={furnishingsCfg.descriptionHtml} />
                    ) : undefined
                  }
                  value={furnValue}
                  locked={furnLocked}
                  onChange={(next) => {
                    setValue("furnishingsByRoom", {
                      ...furnMap,
                      [resourceId]: next,
                    });
                    trigger("chartFieldForFurnishingsByRoom");
                    trigger("furnishingsDetailsByRoom");
                  }}
                />
                {furnValue === "yes" && (
                  <>
                    {furnishingsCfg.showDetailsField && (
                      <>
                        <Label htmlFor={`furn-details-${resourceId}`}>
                          {furnishingsCfg.detailsLabel ??
                            "Furniture request details"}
                          {" *"}
                        </Label>
                        {furnishingsCfg.detailsDescriptionHtml ? (
                          <HtmlBlock
                            html={furnishingsCfg.detailsDescriptionHtml}
                          />
                        ) : null}
                        <input
                          id={`furn-details-${resourceId}`}
                          style={{
                            width: "100%",
                            padding: "8px",
                            marginBottom: 16,
                            border: "1px solid #ccc",
                            borderRadius: 4,
                          }}
                          value={furnDetailsByRoom[resourceId] ?? ""}
                          aria-required
                          aria-invalid={!!furnishingsDetailsErrorForRoom}
                          onBlur={() => trigger("furnishingsDetailsByRoom")}
                          onChange={(e) => {
                            const next = {
                              ...furnDetailsByRoom,
                              [resourceId]: e.target.value,
                            };
                            setValue("furnishingsDetailsByRoom", next, {
                              shouldValidate: true,
                            });
                            const joined = Object.values(next)
                              .map((v) =>
                                typeof v === "string" ? v.trim() : "",
                              )
                              .filter(Boolean)
                              .join("\n");
                            setValue("furnishingsDetails", joined, {
                              shouldValidate: false,
                            });
                          }}
                        />
                        {furnishingsDetailsErrorForRoom && (
                          <FormHelperText error>
                            {furnishingsDetailsErrorForRoom}
                          </FormHelperText>
                        )}
                      </>
                    )}
                    {furnishingsCfg.chartField && (
                      <>
                        <Label htmlFor={`chart-furn-${resourceId}`}>
                          {furnishingsCfg.chartField?.label ||
                            "ChartField for Additional Event Furniture"}
                          {furnishingsCfg.chartField?.required !== false
                            ? " *"
                            : ""}
                        </Label>
                        {furnishingsCfg.chartField?.descriptionHtml ? (
                          <HtmlBlock
                            html={furnishingsCfg.chartField.descriptionHtml}
                          />
                        ) : null}
                        <input
                          id={`chart-furn-${resourceId}`}
                          style={{
                            width: "100%",
                            padding: "8px",
                            marginBottom: 16,
                            border: "1px solid #ccc",
                            borderRadius: 4,
                          }}
                          value={chartFurn[resourceId] ?? ""}
                          onChange={(e) => {
                            setValue(
                              "chartFieldForFurnishingsByRoom",
                              {
                                ...chartFurn,
                                [resourceId]: e.target.value,
                              },
                              { shouldValidate: true },
                            );
                          }}
                          onBlur={() =>
                            trigger("chartFieldForFurnishingsByRoom")
                          }
                          aria-required
                          aria-invalid={!!furnishingsChartError}
                        />
                        {furnishingsChartError && (
                          <FormHelperText error>
                            {furnishingsChartError}
                          </FormHelperText>
                        )}
                      </>
                    )}
                  </>
                )}
              </Subsection>
            )}

            {showStaffing && (
              <Subsection>
                <BookingFormStaffingServices
                  id="staffingServices"
                  control={control}
                  trigger={trigger}
                  showStaffingServices={showStaffingServices}
                  setShowStaffingServices={setShowStaffingServices}
                  formContext={formContext}
                  rooms={[room]}
                  toggle={staffingToggle}
                  setValue={setValue}
                />
              </Subsection>
            )}

            {showCateringStatic && cateringCfg && (
              <Subsection>
                <Label>
                  {formatFieldLabel(cateringCfg.label ?? "Catering?")}
                </Label>
                <HtmlBlock html={cateringCfg.descriptionHtml} />
                {cateringCfg.studentLoungeCheckbox && (
                  <>
                    <FormControlLabel
                      label="Request to use the student lounge"
                      control={
                        <Checkbox
                          checked={cateringRoomValue === "yes"}
                          onChange={(e) =>
                            setCateringForRoom(e.target.checked ? "yes" : "no")
                          }
                        />
                      }
                    />
                    {cateringRoomValue === "yes" && cateringCfg.chartField && (
                      <ByRoomChartFieldInput
                        id={`chart-catering-${resourceId}`}
                        label={
                          cateringCfg.chartField.label ||
                          "ChartField for Catering Services"
                        }
                        required={cateringChartRequired}
                        value={cateringChart[resourceId] ?? ""}
                        error={cateringChartErrorForRoom}
                        onChange={(next) =>
                          setValue(
                            "chartFieldForCateringByRoom",
                            { ...cateringChart, [resourceId]: next },
                            { shouldValidate: true },
                          )
                        }
                        onBlur={() => trigger("chartFieldForCateringByRoom")}
                      />
                    )}
                  </>
                )}
              </Subsection>
            )}

            {showCateringInteractive && cateringCfg && (
              <Subsection>
                <SharedYesNoSwitch
                  testId={`service-switch-catering-${resourceId}`}
                  label={formatFieldLabel(cateringCfg.label ?? "Catering?")}
                  description={
                    cateringCfg.descriptionHtml ? (
                      <HtmlBlock html={cateringCfg.descriptionHtml} />
                    ) : (
                      <p style={{ fontSize: "0.75rem" }}>
                        Select if you need catering for your event.
                      </p>
                    )
                  }
                  value={cateringRoomValue}
                  locked={cateringLocked}
                  onChange={setCateringForRoom}
                />
                {cateringRoomValue === "yes" && (
                  <ByRoomChartFieldInput
                    id={`chart-catering-${resourceId}`}
                    label={
                      cateringCfg.chartField?.label ||
                      "ChartField for Catering Services"
                    }
                    descriptionHtml={cateringCfg.chartField?.descriptionHtml}
                    required={cateringChartRequired}
                    value={cateringChart[resourceId] ?? ""}
                    error={cateringChartErrorForRoom}
                    onChange={(next) =>
                      setValue(
                        "chartFieldForCateringByRoom",
                        { ...cateringChart, [resourceId]: next },
                        { shouldValidate: true },
                      )
                    }
                    onBlur={() => trigger("chartFieldForCateringByRoom")}
                  />
                )}
              </Subsection>
            )}

            {showCleaning && cleaningCfg && (
              <Subsection>
                <SharedYesNoSwitch
                  testId={`service-switch-cleaning-${resourceId}`}
                  label={formatFieldLabel(cleaningCfg.label ?? "Cleaning?")}
                  description={
                    <p style={{ fontSize: "0.75rem" }}>
                      Select if you need cleaning services for your event.
                    </p>
                  }
                  value={cleaningRoomValue}
                  disabled={cleaningForced}
                  locked={cleaningLocked}
                  onChange={(next) => {
                    setValue(
                      "cleaningByRoom",
                      { ...cleaningMap, [resourceId]: next },
                      { shouldValidate: true },
                    );
                    if (next === "no") {
                      const { [resourceId]: _dropped, ...rest } = cleaningChart;
                      setValue("chartFieldForCleaningByRoom", rest, {
                        shouldValidate: false,
                      });
                    }
                    trigger("chartFieldForCleaningByRoom");
                  }}
                />
                {cleaningRoomValue === "yes" && (
                  <ByRoomChartFieldInput
                    id={`chart-cleaning-${resourceId}`}
                    label={
                      cleaningCfg.chartField?.label ||
                      "ChartField for CBS Cleaning Services"
                    }
                    descriptionHtml={cleaningCfg.chartField?.descriptionHtml}
                    required={cleaningChartRequired}
                    value={cleaningChart[resourceId] ?? ""}
                    error={cleaningChartErrorForRoom}
                    onChange={(next) =>
                      setValue(
                        "chartFieldForCleaningByRoom",
                        { ...cleaningChart, [resourceId]: next },
                        { shouldValidate: true },
                      )
                    }
                    onBlur={() => trigger("chartFieldForCleaningByRoom")}
                  />
                )}
              </Subsection>
            )}

            {showSecurityChoice && securityCfg && (
              <Subsection>
                <Label>
                  {formatFieldLabel(securityCfg.label ?? "Security")}
                </Label>
                <FormControl
                  component="fieldset"
                  fullWidth
                  error={!!securityChoiceErrorForRoom}
                >
                  <RadioGroup
                    value={securityRoomValue}
                    onChange={(e) => setSecurityForRoom(e.target.value)}
                  >
                    {securityCfg.options?.map((opt) => (
                      <FormControlLabel
                        key={opt.value}
                        value={opt.value}
                        control={<Radio />}
                        label={
                          <OptionLabel
                            label={opt.label}
                            descriptionHtml={opt.descriptionHtml}
                          />
                        }
                      />
                    ))}
                  </RadioGroup>
                  {securityChoiceErrorForRoom && (
                    <FormHelperText error>
                      {securityChoiceErrorForRoom}
                    </FormHelperText>
                  )}
                </FormControl>
                {(() => {
                  const selectedOpt = securityCfg.options?.find(
                    (o) => o.value === securityRoomValue,
                  );
                  if (!selectedOpt?.chartField) return null;
                  const required = selectedOpt.chartField.required !== false;
                  return (
                    <ByRoomChartFieldInput
                      id={`chart-security-${resourceId}`}
                      label={
                        selectedOpt.chartField.label ||
                        "Chartfield for Campus Safety"
                      }
                      descriptionHtml={selectedOpt.chartField.descriptionHtml}
                      required={required}
                      value={securityChart[resourceId] ?? ""}
                      error={securityChartErrorFor(required)}
                      onChange={(next) =>
                        setValue(
                          "chartFieldForSecurityByRoom",
                          { ...securityChart, [resourceId]: next },
                          { shouldValidate: true },
                        )
                      }
                      onBlur={() => trigger("chartFieldForSecurityByRoom")}
                    />
                  );
                })()}
              </Subsection>
            )}

            {showSecurityCheckbox && securityCfg && (
              <Subsection>
                {(() => {
                  const securityOpt = securityCfg.options?.[0];
                  if (!securityOpt) return null;
                  const isWilloughby = securityRoomValue === securityOpt.value;
                  const required = securityOpt.chartField?.required !== false;
                  return (
                    <>
                      <SharedYesNoSwitch
                        testId={`service-switch-security-${resourceId}`}
                        label={formatFieldLabel(
                          securityCfg.label ?? "Security?",
                        )}
                        description={
                          <>
                            {isLargeEvent && (
                              <p
                                style={{
                                  fontSize: "0.75rem",
                                  fontWeight: 500,
                                  marginBottom: 4,
                                }}
                              >
                                Security is required for events with more than
                                75 attendees.
                              </p>
                            )}
                            {securityCfg.descriptionHtml ? (
                              <HtmlBlock html={securityCfg.descriptionHtml} />
                            ) : null}
                          </>
                        }
                        value={securityRoomRequested ? "yes" : "no"}
                        disabled={isLargeEvent}
                        locked={securityLocked}
                        onChange={(next) =>
                          setSecurityForRoom(
                            next === "yes" ? securityOpt.value : "",
                          )
                        }
                      />
                      {securityRoomRequested && (
                        <>
                          {isWilloughby && (
                            <p
                              style={{
                                fontSize: "0.875rem",
                                marginBottom: 16,
                              }}
                            >
                              <OptionLabel
                                label={securityOpt.label}
                                descriptionHtml={securityOpt.descriptionHtml}
                              />
                            </p>
                          )}
                          {securityOpt.chartField && (
                            <ByRoomChartFieldInput
                              id={`chart-security-${resourceId}`}
                              label={
                                securityOpt.chartField.label ||
                                "Chartfield for Campus Safety"
                              }
                              descriptionHtml={
                                securityOpt.chartField.descriptionHtml
                              }
                              required={required}
                              value={securityChart[resourceId] ?? ""}
                              error={securityChartErrorFor(required)}
                              onChange={(next) =>
                                setValue(
                                  "chartFieldForSecurityByRoom",
                                  { ...securityChart, [resourceId]: next },
                                  { shouldValidate: true },
                                )
                              }
                              onBlur={() =>
                                trigger("chartFieldForSecurityByRoom")
                              }
                            />
                          )}
                        </>
                      )}
                    </>
                  );
                })()}
              </Subsection>
            )}

            {showSecuritySwitch && securityCfg && (
              <Subsection>
                <SharedYesNoSwitch
                  testId={`service-switch-security-${resourceId}`}
                  label={formatFieldLabel(securityCfg.label ?? "Security?")}
                  description={
                    <p style={{ fontSize: "0.75rem" }}>
                      {isLargeEvent && (
                        <span
                          style={{
                            display: "block",
                            marginBottom: "4px",
                            fontWeight: 500,
                          }}
                        >
                          Security is required for events with more than 75
                          attendees.
                        </span>
                      )}
                      Only for large events with 75+ attendees, and bookings in
                      The Garage where the Willoughby entrance will be in use.
                    </p>
                  }
                  value={securityRoomRequested ? "yes" : "no"}
                  disabled={isLargeEvent}
                  locked={securityLocked}
                  onChange={(next) =>
                    setSecurityForRoom(next === "yes" ? "yes" : "")
                  }
                />
                {securityRoomRequested && securityCfg.chartField && (
                  <ByRoomChartFieldInput
                    id={`chart-security-${resourceId}`}
                    label={
                      securityCfg.chartField.label || "ChartField for Security"
                    }
                    descriptionHtml={securityCfg.chartField.descriptionHtml}
                    required={securityCfg.chartField.required === true}
                    value={securityChart[resourceId] ?? ""}
                    error={securityChartErrorFor(
                      securityCfg.chartField.required === true,
                    )}
                    onChange={(next) =>
                      setValue(
                        "chartFieldForSecurityByRoom",
                        { ...securityChart, [resourceId]: next },
                        { shouldValidate: true },
                      )
                    }
                    onBlur={() => trigger("chartFieldForSecurityByRoom")}
                  />
                )}
              </Subsection>
            )}
          </RoomBlock>
        );
      })}
    </>
  );
}
