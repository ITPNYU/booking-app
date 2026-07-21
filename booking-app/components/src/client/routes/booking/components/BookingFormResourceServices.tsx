import {
  Checkbox,
  FormControl,
  FormControlLabel,
  FormHelperText,
  Radio,
  RadioGroup,
} from "@mui/material";
import {
  Control,
  Controller,
  FieldErrors,
  UseFormTrigger,
} from "react-hook-form";
import React, { useEffect } from "react";
import styled from "@emotion/styled";
import { Inputs } from "../../../../types";
import {
  CHARTFIELD_PATTERN_MESSAGE,
  CHARTFIELD_REGEX,
} from "../../../../utils/validationHelpers";
import {
  getResourceServicesConfig,
  getRoomsWithVisibleService,
  getServiceResourceId,
  getServiceSectionConfig,
  ServiceResourceLike,
  ServiceVisibilityContext,
} from "../../../../utils/resourceServicesUtils";
import { BookingFormTextField } from "./BookingFormInputs";

const Label = styled.label`
  font-weight: 500;
  font-size: 0.875rem;
  line-height: 1.25rem;
  margin-bottom: 0.5rem;
  display: block;
`;

const Subsection = styled.div`
  margin-bottom: 24px;
`;

/** Prefix with room name only when multiple rooms are in the booking. */
function roomSectionLabel(
  roomName: string | undefined,
  label: string,
  showRoomPrefix: boolean,
): string {
  return showRoomPrefix && roomName ? `${roomName} — ${label}` : label;
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
}: Props) {
  const visibility: ServiceVisibilityContext = {
    isVIP,
    isWalkIn,
    isStandardUser: !isVIP && !isWalkIn,
  };

  const hasConfig = selectedRooms.some(
    (r) => Object.keys(getResourceServicesConfig(r)).length > 0,
  );

  const setupRooms = getRoomsWithVisibleService(
    selectedRooms,
    "setup",
    visibility,
  ).filter((r) => getServiceSectionConfig(r, "setup")?.mode === "radio");
  const setupStaticRooms = getRoomsWithVisibleService(
    selectedRooms,
    "setup",
    visibility,
  ).filter((r) => getServiceSectionConfig(r, "setup")?.mode === "static");
  const furnishingsRooms = getRoomsWithVisibleService(
    selectedRooms,
    "furnishings",
    visibility,
  );
  const equipmentStaticRooms = getRoomsWithVisibleService(
    selectedRooms,
    "equipment",
    visibility,
  ).filter((r) => getServiceSectionConfig(r, "equipment")?.mode === "static");

  const auxiliaryByRoom =
    (watch("auxiliarySpaceByRoom") as Record<string, string> | undefined) ?? {};

  const securitySelectRooms = getRoomsWithVisibleService(
    selectedRooms,
    "security",
    visibility,
  ).filter((r) => getServiceSectionConfig(r, "security")?.mode === "radio");

  const auxiliaryRooms = getRoomsWithVisibleService(
    selectedRooms,
    "annex",
    visibility,
  );

  const setupChartError = mapFieldErrorMessage(
    errors.chartFieldForRoomSetupByRoom,
  );
  const furnishingsChartError = mapFieldErrorMessage(
    errors.chartFieldForFurnishingsByRoom,
  );

  useEffect(() => {
    const currentMap =
      (watch("roomSetupByRoom") as Record<string, string> | undefined) ?? {};
    const currentDetails =
      (watch("setupDetailsByRoom") as Record<string, string> | undefined) ?? {};
    // Editing a pre-migration booking: legacy flat fields are set but maps are empty.
    // Do not overwrite with schema defaults.
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
      if (selectedRooms.length === 1 && setupRooms.length === 1) {
        const resourceId = getServiceResourceId(setupRooms[0]);
        setValue("roomSetup", "yes", { shouldValidate: false });
        setValue("setupDetails", nextDetails[resourceId] ?? "", {
          shouldValidate: false,
        });
      }
    }
  }, [
    setupRooms,
    selectedRooms.length,
    setValue,
    watch,
  ]);

  useEffect(() => {
    const currentMap =
      (watch("auxiliarySpaceByRoom") as Record<string, string> | undefined) ?? {};
    // Preserve existing/legacy auxiliary answers; do not force annex defaults on edit.
    if (
      watch("auxiliarySpaceRequested") &&
      Object.keys(currentMap).length === 0
    ) {
      return;
    }
    const nextMap = { ...currentMap };
    let changed = false;
    auxiliaryRooms.forEach((room) => {
      const cfg = getServiceSectionConfig(room, "annex");
      const resourceId = getServiceResourceId(room);
      if (cfg?.mode === "radio" && cfg.defaultValue && !nextMap[resourceId]) {
        nextMap[resourceId] = cfg.defaultValue;
        changed = true;
      }
    });
    if (changed) {
      setValue("auxiliarySpaceByRoom", nextMap, { shouldValidate: false });
      setValue(
        "auxiliarySpaceRequested",
        Object.values(nextMap).some((v) => !!v && v !== "none"),
        { shouldValidate: false },
      );
    }
  }, [auxiliaryRooms, setValue, watch]);

  if (!hasConfig || isWalkIn) return null;

  return (
    <>
      {setupStaticRooms.map((room) => {
        const cfg = getServiceSectionConfig(room, "setup")!;
        const resourceId = getServiceResourceId(room);
        return (
          <Subsection key={`setup-static-${resourceId}`}>
            <Label>
              {formatFieldLabel(
                roomSectionLabel(
                  room.name,
                  cfg.label ?? "Room Setup",
                  selectedRooms.length > 1,
                ),
              )}
            </Label>
            <HtmlBlock html={cfg.descriptionHtml} />
          </Subsection>
        );
      })}

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
        render={({ field: setupField }) => (
          <>
            {setupRooms.map((room) => {
              const cfg = getServiceSectionConfig(room, "setup")!;
              const resourceId = getServiceResourceId(room);
              const mapValues =
                (setupField.value as Record<string, string> | undefined) ?? {};
              const selectedValue =
                mapValues[resourceId] ?? cfg.defaultValue ?? "";
              const selectedOption = cfg.options?.find(
                (o) => o.value === selectedValue,
              );
              const needsChart = !!selectedOption?.chartField;

              return (
                <Subsection key={`setup-${resourceId}`}>
                  <Label>
                    {formatFieldLabel(
                      roomSectionLabel(
                        room.name,
                        cfg.label ?? "Room Setup",
                        selectedRooms.length > 1,
                      ),
                    )}
                  </Label>
                  <HtmlBlock html={cfg.descriptionHtml} />
                  <FormControl component="fieldset" fullWidth>
                    <RadioGroup
                      value={selectedValue}
                      onChange={(e) => {
                        const value = e.target.value;
                        const next = {
                          ...((setupField.value as Record<string, string>) ??
                            {}),
                          [resourceId]: value,
                        };
                        setupField.onChange(next);
                        const opt = cfg.options?.find((o) => o.value === value);
                        const details =
                          (watch("setupDetailsByRoom") as
                            | Record<string, string>
                            | undefined) ?? {};
                        setValue("setupDetailsByRoom", {
                          ...details,
                          [resourceId]: opt?.label ?? value,
                        });
                        if (selectedRooms.length === 1) {
                          setValue("roomSetup", "yes");
                          setValue("setupDetails", opt?.label ?? "");
                        }
                        trigger("roomSetupByRoom");
                        trigger("chartFieldForRoomSetupByRoom");
                      }}
                    >
                      {cfg.options?.map((opt) => (
                        <FormControlLabel
                          key={opt.value}
                          value={opt.value}
                          control={<Radio />}
                          label={opt.label}
                        />
                      ))}
                    </RadioGroup>
                  </FormControl>
                  {needsChart && (
                    <>
                      <Label htmlFor={`chart-setup-${resourceId}`}>
                        {selectedOption?.chartField?.label ||
                          "ChartField for Room Setup"}
                        {selectedOption?.chartField?.required !== false ? " *" : ""}
                      </Label>
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
                          setValue(
                            "chartFieldForRoomSetupByRoom",
                            {
                              ...chartMap,
                              [resourceId]: e.target.value,
                            },
                            { shouldValidate: true },
                          );
                          if (selectedRooms.length === 1) {
                            setValue("chartFieldForRoomSetup", e.target.value);
                          }
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
                </Subsection>
              );
            })}
          </>
        )}
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

      {furnishingsRooms.map((room) => {
        const cfg = getResourceServicesConfig(room).furnishings;
        if (!cfg) return null;
        const resourceId = getServiceResourceId(room);
        const furnMap =
          (watch("furnishingsByRoom") as Record<string, string> | undefined) ?? {};
        const chartFurn =
          (watch("chartFieldForFurnishingsByRoom") as
            | Record<string, string>
            | undefined) ?? {};
        const isYes = furnMap[resourceId] === "yes";

        return (
          <Subsection key={`furn-${resourceId}`}>
            <Label>
              {formatFieldLabel(
                roomSectionLabel(
                  room.name,
                  cfg.label ?? "Additional Event Furniture",
                  selectedRooms.length > 1,
                ),
              )}
            </Label>
            <HtmlBlock html={cfg.descriptionHtml} />
            <FormControlLabel
              label="Yes"
              control={
                <Checkbox
                  checked={isYes}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setValue("furnishingsByRoom", {
                      ...furnMap,
                      [resourceId]: checked ? "yes" : "",
                    });
                    trigger("chartFieldForFurnishingsByRoom");
                  }}
                />
              }
            />
            {cfg.chartField && isYes && (
              <>
                <Label htmlFor={`chart-furn-${resourceId}`}>
                  {cfg.chartField?.label ||
                    "ChartField for Additional Event Furniture"}
                  {cfg.chartField?.required !== false ? " *" : ""}
                </Label>
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
                  onBlur={() => trigger("chartFieldForFurnishingsByRoom")}
                  aria-required
                  aria-invalid={!!furnishingsChartError}
                />
                {furnishingsChartError && (
                  <FormHelperText error>{furnishingsChartError}</FormHelperText>
                )}
              </>
            )}
          </Subsection>
        );
      })}

      {equipmentStaticRooms.map((room) => {
        const cfg = getServiceSectionConfig(room, "equipment")!;
        const resourceId = getServiceResourceId(room);
        return (
          <Subsection key={`equip-${resourceId}`}>
            <Label>
              {formatFieldLabel(
                roomSectionLabel(
                  room.name,
                  cfg.label ?? "Equipment",
                  selectedRooms.length > 1,
                ),
              )}
            </Label>
            <HtmlBlock html={cfg.descriptionHtml} />
            {cfg.showDetailsField && (
              <BookingFormTextField
                id="equipmentServicesDetails"
                label={cfg.detailsLabel ?? "Equipment request details"}
                description={
                  cfg.detailsDescriptionHtml ? (
                    <div
                      dangerouslySetInnerHTML={{
                        __html: cfg.detailsDescriptionHtml,
                      }}
                    />
                  ) : undefined
                }
                required={false}
                {...{ control, errors, trigger }}
              />
            )}
          </Subsection>
        );
      })}

      {securitySelectRooms.map((room) => {
        const cfg = getServiceSectionConfig(room, "security")!;
        const resourceId = getServiceResourceId(room);
        return (
          <Subsection key={`sec-${resourceId}`}>
            <Label>
              {formatFieldLabel(
                roomSectionLabel(
                  room.name,
                  cfg.label ?? "Security",
                  selectedRooms.length > 1,
                ),
              )}
            </Label>
            <Controller
              name="hireSecurity"
              control={control}
              rules={
                cfg.required
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
                    {cfg.options?.map((opt) => (
                      <FormControlLabel
                        key={opt.value}
                        value={opt.value}
                        control={<Radio />}
                        label={opt.label}
                      />
                    ))}
                  </RadioGroup>
                </FormControl>
              )}
            />
            {(() => {
              const selectedOpt = cfg.options?.find(
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
        );
      })}

      {auxiliaryRooms.map((room) => {
        const aux = getServiceSectionConfig(room, "annex")!;
        const resourceId = getServiceResourceId(room);
        const selected =
          auxiliaryByRoom[resourceId] ?? aux.defaultValue ?? "";
        const isRadio = aux.mode === "radio" && (aux.options?.length ?? 0) > 0;

        const markRequested = (nextMap: Record<string, string>) => {
          setValue("auxiliarySpaceByRoom", nextMap);
          setValue(
            "auxiliarySpaceRequested",
            Object.values(nextMap).some((v) => !!v && v !== "none"),
          );
        };

        return (
          <Subsection key={`aux-${resourceId}`}>
            <Label>
              {formatFieldLabel(
                roomSectionLabel(
                  room.name,
                  aux.label ?? "Auxiliary Spaces",
                  selectedRooms.length > 1,
                ),
              )}
            </Label>
            <HtmlBlock html={aux.descriptionHtml} />
            {isRadio ? (
              <FormControl component="fieldset" fullWidth>
                <RadioGroup
                  value={selected}
                  onChange={(e) => {
                    markRequested({
                      ...auxiliaryByRoom,
                      [resourceId]: e.target.value,
                    });
                  }}
                >
                  {aux.options?.map((opt) => (
                    <FormControlLabel
                      key={opt.value}
                      value={opt.value}
                      control={<Radio />}
                      label={opt.label}
                    />
                  ))}
                </RadioGroup>
              </FormControl>
            ) : (
              <FormControlLabel
                label="Yes"
                control={
                  <Checkbox
                    checked={selected === "yes"}
                    onChange={(e) => {
                      markRequested({
                        ...auxiliaryByRoom,
                        [resourceId]: e.target.checked ? "yes" : "",
                      });
                    }}
                  />
                }
              />
            )}
          </Subsection>
        );
      })}
    </>
  );
}
