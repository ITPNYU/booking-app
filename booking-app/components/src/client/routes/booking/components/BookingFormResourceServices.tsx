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
import { BookingFormSwitch, BookingFormTextField } from "./BookingFormInputs";

const Label = styled.label`
  font-weight: 500;
  font-size: 0.875rem;
  line-height: 1.25rem;
  margin-bottom: 0.5rem;
  display: block;
`;

const Subsection = styled.div`
  margin-bottom: 24px;
  padding-left: 8px;
  border-left: 3px solid #e0e0e0;
`;

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
  cateringValue: string;
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
  cateringValue,
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
  if (!hasConfig || isWalkIn) return null;

  const setupRooms = getRoomsWithVisibleService(
    selectedRooms,
    "setup",
    visibility,
  ).filter((r) => getServiceSectionConfig(r, "setup")?.mode === "select");
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

  const loungeByRoom =
    (watch("studentLoungeByRoom") as Record<string, string> | undefined) ?? {};
  const auxiliaryByRoom =
    (watch("auxiliarySpaceByRoom") as Record<string, string> | undefined) ?? {};

  const staticCateringRoom = getRoomsWithVisibleService(
    selectedRooms,
    "catering",
    visibility,
  ).find((r) => getServiceSectionConfig(r, "catering")?.mode === "static");

  const securitySelectRooms = getRoomsWithVisibleService(
    selectedRooms,
    "security",
    visibility,
  ).filter((r) => getServiceSectionConfig(r, "security")?.mode === "select");

  const auxiliaryRooms = getRoomsWithVisibleService(
    selectedRooms,
    "auxiliarySpace",
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
              const needsChart = !!selectedOption?.requiresChartField;

              return (
                <Subsection key={`setup-${resourceId}`}>
                  <Label>
                    {formatFieldLabel(
                      `${room.name} — ${cfg.label ?? "Room Setup"}`,
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
                        ChartField for Room Setup *
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
              if (!selectedOption?.requiresChartField) continue;
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
              if (!cfg?.chartFieldWhenYes) continue;
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
                `${room.name} — ${cfg.label ?? "Additional Event Furniture"}`,
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
            {cfg.chartFieldWhenYes && isYes && (
              <>
                <Label htmlFor={`chart-furn-${resourceId}`}>
                  ChartField for Additional Event Furniture *
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
              {formatFieldLabel(`${room.name} — ${cfg.label ?? "Equipment"}`)}
            </Label>
            <HtmlBlock html={cfg.descriptionHtml} />
          </Subsection>
        );
      })}

      {staticCateringRoom && (() => {
        const cfg = getResourceServicesConfig(staticCateringRoom).catering;
        if (!cfg) return null;
        const cateringRoomId = getServiceResourceId(staticCateringRoom);
        const loungeChecked = loungeByRoom[cateringRoomId] === "yes";
        return (
          <div style={{ marginBottom: 32 }} key="catering-202">
            <Label>{formatFieldLabel(cfg.label ?? "Catering")}</Label>
            <HtmlBlock html={cfg.descriptionHtml} />
            {cfg.studentLoungeCheckbox && (
              <FormControlLabel
                label="Yes, I would like to request the student lounge"
                control={
                  <Checkbox
                    checked={loungeChecked}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setValue("studentLoungeByRoom", {
                        ...loungeByRoom,
                        [cateringRoomId]: checked ? "yes" : "",
                      });
                      setValue(
                        "auxiliarySpaceRequested",
                        checked ||
                          Object.values(auxiliaryByRoom).some((v) => v === "yes"),
                      );
                      if (!checked) {
                        setValue("catering", "");
                        setValue("chartFieldForCatering", "");
                      }
                    }}
                  />
                }
              />
            )}
            {loungeChecked && (
              <>
                <BookingFormSwitch
                  id="catering"
                  label="Catering?"
                  description={
                    <p>Select if you need catering for your event.</p>
                  }
                  required={false}
                  {...{ control, errors, trigger }}
                />
                {cateringValue === "yes" && (
                  <BookingFormTextField
                    id="chartFieldForCatering"
                    label="ChartField for Catering Services"
                    required
                    pattern={{
                      value: CHARTFIELD_REGEX,
                      message: CHARTFIELD_PATTERN_MESSAGE,
                    }}
                    {...{ control, errors, trigger }}
                  />
                )}
              </>
            )}
          </div>
        );
      })()}

      {securitySelectRooms.map((room) => {
        const cfg = getServiceSectionConfig(room, "security")!;
        const resourceId = getServiceResourceId(room);
        return (
          <Subsection key={`sec-${resourceId}`}>
            <Label>
              {formatFieldLabel(`${room.name} — ${cfg.label ?? "Security"}`)}
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
            {hireSecurityValue === "willoughby" && (
              <BookingFormTextField
                id="chartFieldForSecurity"
                label="Chartfield for Campus Safety"
                required
                pattern={{
                  value: CHARTFIELD_REGEX,
                  message: CHARTFIELD_PATTERN_MESSAGE,
                }}
                {...{ control, errors, trigger }}
              />
            )}
          </Subsection>
        );
      })}

      {auxiliaryRooms.map((room) => {
        const aux = getResourceServicesConfig(room).auxiliarySpace!;
        const resourceId = getServiceResourceId(room);
        const checked = auxiliaryByRoom[resourceId] === "yes";
        return (
          <Subsection key={`aux-${resourceId}`}>
            <FormControlLabel
              label={formatFieldLabel(
                `${room.name} — ${aux.label ?? "Auxiliary space"}`,
              )}
              control={
                <Checkbox
                  checked={checked}
                  onChange={(e) => {
                    const nextMap = {
                      ...auxiliaryByRoom,
                      [resourceId]: e.target.checked ? "yes" : "",
                    };
                    setValue("auxiliarySpaceByRoom", nextMap);
                    setValue(
                      "auxiliarySpaceRequested",
                      Object.values(nextMap).some((v) => v === "yes") ||
                        Object.values(loungeByRoom).some((v) => v === "yes"),
                    );
                  }}
                />
              }
            />
            <HtmlBlock html={aux.descriptionHtml} />
          </Subsection>
        );
      })}
    </>
  );
}
