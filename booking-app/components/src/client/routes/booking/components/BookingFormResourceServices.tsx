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
import React, { useEffect, useMemo, useState } from "react";
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
  lockedToggleValue,
  resolveSecurityToggle,
  resolveSharedServiceToggle,
  ServiceResourceLike,
  ServiceVisibilityContext,
  shouldShowServiceSection,
} from "../../../../utils/resourceServicesUtils";
import { BookingFormTextField } from "./BookingFormInputs";
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
  hireSecurityValue: string;
  showStaffingServices: boolean;
  setShowStaffingServices: (value: boolean) => void;
  formContext: FormContextLevel;
  cateringRequiresCleaning: boolean;
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
    return typeof v === "string" && v.trim().length > 0 && v.toLowerCase() !== "no";
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
    nextChart ||
      (hasPartialMaps ? existingSetupChart?.trim() || "" : "") ||
      "",
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
}: {
  label: string;
  description?: React.ReactNode;
  value: string;
  disabled?: boolean;
  /** Schema toggle lock ("on" / "off"): rendered disabled, value is fixed. */
  locked?: boolean;
  onChange: (next: "yes" | "no") => void;
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
  hireSecurityValue,
  showStaffingServices,
  setShowStaffingServices,
  formContext,
  cateringRequiresCleaning,
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
      }).filter((r) =>
        isChoiceMode(getServiceSectionConfig(r, "setup")?.mode),
      ),
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

  const firstCateringRoomId = useMemo(() => {
    const room = getRoomsWithVisibleService(selectedRooms, "catering", {
      isVIP,
      isWalkIn,
      isStandardUser: !isVIP && !isWalkIn,
    })[0];
    return room ? getServiceResourceId(room) : null;
  }, [selectedRooms, isVIP, isWalkIn]);
  const firstStaffingRoomId = useMemo(() => {
    const room = getRoomsWithVisibleService(selectedRooms, "staffing", {
      isVIP,
      isWalkIn,
      isStandardUser: !isVIP && !isWalkIn,
    })[0];
    return room ? getServiceResourceId(room) : null;
  }, [selectedRooms, isVIP, isWalkIn]);
  const firstCleaningRoomId = useMemo(() => {
    const room = getRoomsWithVisibleService(selectedRooms, "cleaning", {
      isVIP,
      isWalkIn,
      isStandardUser: !isVIP && !isWalkIn,
    })[0];
    return room ? getServiceResourceId(room) : null;
  }, [selectedRooms, isVIP, isWalkIn]);
  const firstSecuritySwitchRoomId = useMemo(() => {
    const room = getRoomsWithVisibleService(selectedRooms, "security", {
      isVIP,
      isWalkIn,
      isStandardUser: !isVIP && !isWalkIn,
    }).find((r) => {
      const mode = getServiceSectionConfig(r, "security")?.mode;
      return !isChoiceMode(mode) && mode !== "checkbox" && mode !== "static";
    });
    return room ? getServiceResourceId(room) : null;
  }, [selectedRooms, isVIP, isWalkIn]);
  const securityChoiceRoomId = useMemo(() => {
    const rooms = getRoomsWithVisibleService(selectedRooms, "security", {
      isVIP,
      isWalkIn,
      isStandardUser: !isVIP && !isWalkIn,
    }).filter((r) => {
      const mode = getServiceSectionConfig(r, "security")?.mode;
      return isChoiceMode(mode) || mode === "checkbox";
    });
    const preferred =
      rooms.find(
        (r) => getServiceSectionConfig(r, "security")?.required,
      ) ?? rooms[0];
    return preferred ? getServiceResourceId(preferred) : null;
  }, [selectedRooms, isVIP, isWalkIn]);
  const cateringValue = watch("catering") as string;
  const cleaningValue = watch("cleaningService") as string;

  // Schema toggle locks for booking-level (shared) switches.
  const cateringToggle = useMemo(
    () => resolveSharedServiceToggle(selectedRooms, "catering", visibility),
    [selectedRooms, visibility],
  );
  const cleaningToggle = useMemo(
    () => resolveSharedServiceToggle(selectedRooms, "cleaning", visibility),
    [selectedRooms, visibility],
  );
  const staffingToggle = useMemo(
    () => resolveSharedServiceToggle(selectedRooms, "staffing", visibility),
    [selectedRooms, visibility],
  );
  // A schema "off" lock must not defeat the mandatory security for 75+
  // attendee events; the large-event rule keeps the switch forced on.
  const securityToggle = useMemo(() => {
    const resolved = resolveSecurityToggle(selectedRooms, visibility);
    return resolved === "off" && isLargeEvent ? "optional" : resolved;
  }, [selectedRooms, visibility, isLargeEvent]);
  // Value a locked-on security switch writes: the checkbox option (Willoughby)
  // when present, otherwise the generic "yes".
  const securityLockOnValue = useMemo(() => {
    const checkboxRoom = getRoomsWithVisibleService(
      selectedRooms,
      "security",
      visibility,
    ).find((r) => getServiceSectionConfig(r, "security")?.mode === "checkbox");
    return (
      getServiceSectionConfig(checkboxRoom ?? {}, "security")?.options?.[0]
        ?.value ?? "yes"
    );
  }, [selectedRooms, visibility]);

  // Equipment switch state for rooms whose equipment toggle is "optional".
  const [equipmentOnByRoom, setEquipmentOnByRoom] = useState<
    Record<string, boolean>
  >({});

  // Room setup switch state for rooms whose setup toggle is "optional".
  const [setupOnByRoom, setSetupOnByRoom] = useState<Record<string, boolean>>(
    {},
  );

  useEffect(() => {
    const cateringLocked = lockedToggleValue(cateringToggle);
    if (cateringLocked && cateringValue !== cateringLocked) {
      setValue("catering", cateringLocked, { shouldValidate: true });
    }
    const cleaningLocked = lockedToggleValue(cleaningToggle);
    if (cleaningLocked && cleaningValue !== cleaningLocked) {
      setValue("cleaningService", cleaningLocked, { shouldValidate: true });
    }
  }, [cateringToggle, cleaningToggle, cateringValue, cleaningValue, setValue]);

  useEffect(() => {
    const securityLocked = lockedToggleValue(securityToggle);
    if (!securityLocked) return;
    const requested =
      typeof hireSecurityValue === "string" &&
      hireSecurityValue.trim().length > 0 &&
      hireSecurityValue.trim().toLowerCase() !== "no";
    if (securityLocked === "yes" && !requested) {
      setValue("hireSecurity", securityLockOnValue, { shouldValidate: true });
    } else if (securityLocked === "no" && hireSecurityValue !== "") {
      setValue("hireSecurity", "", { shouldValidate: true });
      setValue("chartFieldForSecurity", "", { shouldValidate: false });
    }
  }, [securityToggle, securityLockOnValue, hireSecurityValue, setValue]);

  // Per-room locks: setup values, furnishings value map, equipment details.
  useEffect(() => {
    const currentSetup =
      (watch("roomSetupByRoom") as Record<string, string> | undefined) ?? {};
    const nextSetup = { ...currentSetup };
    let setupChanged = false;
    setupRooms.forEach((room) => {
      const cfg = getServiceSectionConfig(room, "setup");
      // Rooms without a passive default keep their (chartfield) layout on.
      if (getServiceToggle(cfg) !== "off" || !hasPassiveSetupDefault(cfg)) {
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
    return (
      equipmentOnByRoom[resourceId] ?? !!detailsMap[resourceId]?.trim()
    );
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
      if (cfg?.defaultValue && !nextMap[resourceId]) {
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
      const section = getServiceSectionConfig(
        room,
        key as keyof typeof config,
      );
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
        // A room whose default layout needs a chartfield (e.g. a single
        // "Custom Room Setup" option) has no passive layout to fall back to,
        // so its switch stays on; otherwise the required chartfield would be
        // hidden while still blocking submission.
        const setupHasPassiveDefault = hasPassiveSetupDefault(setupCfg);
        const setupLocked =
          setupToggle !== "optional" || !setupHasPassiveDefault;
        const setupOn = !setupHasPassiveDefault
          ? true
          : lockedToggleValue(setupToggle) === "yes"
            ? true
            : lockedToggleValue(setupToggle) === "no"
              ? false
              : (setupOnByRoom[resourceId] ??
                (!!setupMap[resourceId] &&
                  setupMap[resourceId] !== setupDefaultValue));
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

        return (
          <RoomBlock key={resourceId}>
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
                  label={formatFieldLabel(setupCfg.label ?? "Room Setup")}
                  description={<HtmlBlock html={setupCfg.descriptionHtml} />}
                  value={setupOn ? "yes" : "no"}
                  locked={setupLocked}
                  onChange={(next) => {
                    setSetupOnByRoom((prev) => ({
                      ...prev,
                      [resourceId]: next === "yes",
                    }));
                    if (next === "yes") return;
                    // Back to the passive default: keep the room's default
                    // layout (if any) and drop the chartfield with it.
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
                    if (setupDefaultValue) {
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
                            watch("chartFieldForRoomSetup") as string | undefined,
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
                            setValue("chartFieldForRoomSetupByRoom", nextChart, {
                              shouldValidate: true,
                            });
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
                              watch("chartFieldForRoomSetup") as string | undefined,
                            );
                          }}
                          onBlur={() => trigger("chartFieldForRoomSetupByRoom")}
                          aria-required
                          aria-invalid={!!setupChartError}
                        />
                        {setupChartError && (
                          <FormHelperText error>{setupChartError}</FormHelperText>
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
                      {equipmentCfg.detailsLabel ?? "Equipment request details"}
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
                          checked={cateringValue === "yes"}
                          onChange={(e) => {
                            setValue(
                              "catering",
                              e.target.checked ? "yes" : "no",
                              { shouldValidate: true },
                            );
                            if (!e.target.checked) {
                              setValue("chartFieldForCatering", "", {
                                shouldValidate: false,
                              });
                            }
                            trigger("catering");
                          }}
                        />
                      }
                    />
                    {cateringValue === "yes" &&
                      resourceId === firstCateringRoomId &&
                      cateringCfg.chartField && (
                        <BookingFormTextField
                          id="chartFieldForCatering"
                          label={
                            cateringCfg.chartField.label ||
                            "ChartField for Catering Services"
                          }
                          required={
                            cateringCfg.chartField.required !== false
                          }
                          pattern={{
                            value: CHARTFIELD_REGEX,
                            message: CHARTFIELD_PATTERN_MESSAGE,
                          }}
                          {...{ control, errors, trigger }}
                        />
                      )}
                  </>
                )}
              </Subsection>
            )}

            {showCateringInteractive && cateringCfg && (
              <Subsection>
                <SharedYesNoSwitch
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
                  value={cateringValue}
                  locked={cateringToggle !== "optional"}
                  onChange={(next) => {
                    setValue("catering", next, { shouldValidate: true });
                    trigger("catering");
                  }}
                />
                {cateringValue === "yes" &&
                  resourceId === firstCateringRoomId && (
                    <BookingFormTextField
                      id="chartFieldForCatering"
                      label={
                        cateringCfg.chartField?.label ||
                        "ChartField for Catering Services"
                      }
                      description={
                        cateringCfg.chartField?.descriptionHtml ? (
                          <HtmlBlock
                            html={cateringCfg.chartField.descriptionHtml}
                          />
                        ) : undefined
                      }
                      required={cateringCfg.chartField?.required !== false}
                      pattern={{
                        value: CHARTFIELD_REGEX,
                        message: CHARTFIELD_PATTERN_MESSAGE,
                      }}
                      {...{ control, errors, trigger }}
                    />
                  )}
              </Subsection>
            )}

            {showCleaning && cleaningCfg && (
              <Subsection>
                <SharedYesNoSwitch
                  label={formatFieldLabel(cleaningCfg.label ?? "Cleaning?")}
                  description={
                    <p style={{ fontSize: "0.75rem" }}>
                      Select if you need cleaning services for your event.
                    </p>
                  }
                  value={cleaningValue}
                  disabled={
                    cateringValue === "yes" && cateringRequiresCleaning
                  }
                  locked={cleaningToggle !== "optional"}
                  onChange={(next) => {
                    setValue("cleaningService", next, {
                      shouldValidate: true,
                    });
                    trigger("cleaningService");
                  }}
                />
                {cleaningValue === "yes" &&
                  resourceId === firstCleaningRoomId && (
                    <BookingFormTextField
                      id="chartFieldForCleaning"
                      label={
                        cleaningCfg.chartField?.label ||
                        "ChartField for CBS Cleaning Services"
                      }
                      description={
                        cleaningCfg.chartField?.descriptionHtml ? (
                          <HtmlBlock
                            html={cleaningCfg.chartField.descriptionHtml}
                          />
                        ) : undefined
                      }
                      required={cleaningCfg.chartField?.required === true}
                      pattern={{
                        value: CHARTFIELD_REGEX,
                        message: CHARTFIELD_PATTERN_MESSAGE,
                      }}
                      {...{ control, errors, trigger }}
                    />
                  )}
              </Subsection>
            )}

            {showSecurityChoice &&
              securityCfg &&
              resourceId === securityChoiceRoomId && (
              <Subsection>
                <Label>
                  {formatFieldLabel(securityCfg.label ?? "Security")}
                </Label>
                <Controller
                  name="hireSecurity"
                  control={control}
                  rules={
                    securityCfg.required
                      ? { required: "Please select a security option" }
                      : undefined
                  }
                  render={({ field }) => (
                    <FormControl component="fieldset" fullWidth>
                      <RadioGroup
                        value={field.value ?? ""}
                        onChange={(e) => {
                          field.onChange(e.target.value);
                          trigger("hireSecurity");
                        }}
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
                    </FormControl>
                  )}
                />
                {(() => {
                  const selectedOpt = securityCfg.options?.find(
                    (o) => o.value === hireSecurityValue,
                  );
                  if (!selectedOpt?.chartField) return null;
                  return (
                    <BookingFormTextField
                      id="chartFieldForSecurity"
                      label={
                        selectedOpt.chartField.label ||
                        "Chartfield for Campus Safety"
                      }
                      required={selectedOpt.chartField.required !== false}
                      pattern={{
                        value: CHARTFIELD_REGEX,
                        message: CHARTFIELD_PATTERN_MESSAGE,
                      }}
                      {...{ control, errors, trigger }}
                    />
                  );
                })()}
              </Subsection>
            )}

            {showSecurityCheckbox &&
              securityCfg &&
              resourceId === securityChoiceRoomId && (
              <Subsection>
                {(() => {
                  const securityOpt = securityCfg.options?.[0];
                  if (!securityOpt) return null;
                  const hireRequested =
                    typeof hireSecurityValue === "string" &&
                    hireSecurityValue.trim().length > 0 &&
                    hireSecurityValue.trim().toLowerCase() !== "no";
                  const isWilloughby =
                    hireSecurityValue === securityOpt.value;
                  return (
                    <>
                      <SharedYesNoSwitch
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
                        value={hireRequested ? "yes" : "no"}
                        disabled={isLargeEvent}
                        locked={securityToggle !== "optional"}
                        onChange={(next) => {
                          if (next === "yes") {
                            setValue("hireSecurity", securityOpt.value, {
                              shouldValidate: true,
                            });
                          } else {
                            setValue("hireSecurity", "", {
                              shouldValidate: true,
                            });
                            setValue("chartFieldForSecurity", "", {
                              shouldValidate: false,
                            });
                          }
                          trigger("hireSecurity");
                        }}
                      />
                      {hireRequested && (
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
                            <BookingFormTextField
                              id="chartFieldForSecurity"
                              label={
                                securityOpt.chartField.label ||
                                "Chartfield for Campus Safety"
                              }
                              required={
                                securityOpt.chartField.required !== false
                              }
                              pattern={{
                                value: CHARTFIELD_REGEX,
                                message: CHARTFIELD_PATTERN_MESSAGE,
                              }}
                              {...{ control, errors, trigger }}
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
                  value={hireSecurityValue}
                  disabled={isLargeEvent}
                  locked={securityToggle !== "optional"}
                  onChange={(next) => {
                    setValue("hireSecurity", next, { shouldValidate: true });
                    trigger("hireSecurity");
                  }}
                />
                {hireSecurityValue === "yes" &&
                  resourceId === firstSecuritySwitchRoomId && (
                    <BookingFormTextField
                      id="chartFieldForSecurity"
                      label={
                        securityCfg.chartField?.label || "ChartField for Security"
                      }
                      description={
                        securityCfg.chartField?.descriptionHtml ? (
                          <HtmlBlock
                            html={securityCfg.chartField.descriptionHtml}
                          />
                        ) : undefined
                      }
                      required={securityCfg.chartField?.required === true}
                      pattern={{
                        value: CHARTFIELD_REGEX,
                        message: CHARTFIELD_PATTERN_MESSAGE,
                      }}
                      {...{ control, errors, trigger }}
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
