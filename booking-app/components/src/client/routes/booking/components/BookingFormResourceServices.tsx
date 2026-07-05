import {
  Checkbox,
  FormControl,
  FormControlLabel,
  Radio,
  RadioGroup,
} from "@mui/material";
import {
  Control,
  Controller,
  FieldErrors,
  UseFormTrigger,
} from "react-hook-form";
import React from "react";
import styled from "@emotion/styled";
import { FormContextLevel, Inputs } from "../../../../types";
import type { Resource } from "../../components/schemaTypes";
import {
  CHARTFIELD_PATTERN_MESSAGE,
  CHARTFIELD_REGEX,
} from "../../../../utils/validationHelpers";
import {
  getResourceServicesConfig,
  getRoomsWithVisibleService,
  getServiceSectionConfig,
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

type RoomLike = Pick<Resource, "services" | "resourceId" | "name">;

function HtmlBlock({ html }: { html?: string }) {
  if (!html) return null;
  return (
    <div
      style={{ fontSize: "0.75rem", marginBottom: 8 }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

interface Props {
  selectedRooms: RoomLike[];
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

  const setupRooms = getRoomsWithVisibleService(selectedRooms, "setup", visibility);
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

  const auxiliaryRooms = selectedRooms.filter(
    (r) => getResourceServicesConfig(r).auxiliarySpace?.enabled,
  );

  return (
    <>
      {setupRooms.map((room) => {
        const cfg = getServiceSectionConfig(room, "setup")!;
        const mapValues =
          (watch("roomSetupByRoom") as Record<string, string> | undefined) ?? {};
        const chartMap =
          (watch("chartFieldForRoomSetupByRoom") as
            | Record<string, string>
            | undefined) ?? {};
        const selectedValue = mapValues[room.resourceId] ?? cfg.defaultValue ?? "";
        const selectedOption = cfg.options?.find((o) => o.value === selectedValue);
        const needsChart = !!selectedOption?.requiresChartField;

        return (
          <Subsection key={`setup-${room.resourceId}`}>
            <Label>
              {formatFieldLabel(`${room.name} — ${cfg.label ?? "Room Setup"}`)}
            </Label>
            <HtmlBlock html={cfg.descriptionHtml} />
            <Controller
              name="roomSetupByRoom"
              control={control}
              rules={
                cfg.required ? { required: "Please select a room setup" } : undefined
              }
              render={({ field }) => (
                <FormControl component="fieldset" fullWidth>
                  <RadioGroup
                    value={selectedValue}
                    onChange={(e) => {
                      const value = e.target.value;
                      const next = {
                        ...((field.value as Record<string, string>) ?? {}),
                        [room.resourceId]: value,
                      };
                      field.onChange(next);
                      const opt = cfg.options?.find((o) => o.value === value);
                      const details =
                        (watch("setupDetailsByRoom") as
                          | Record<string, string>
                          | undefined) ?? {};
                      setValue("setupDetailsByRoom", {
                        ...details,
                        [room.resourceId]: opt?.label ?? value,
                      });
                      if (selectedRooms.length === 1) {
                        setValue("roomSetup", "yes");
                        setValue("setupDetails", opt?.label ?? "");
                      }
                      trigger("roomSetupByRoom");
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
            {needsChart && (
              <Controller
                name="chartFieldForRoomSetupByRoom"
                control={control}
                rules={{
                  validate: (val) => {
                    const map = (val as Record<string, string>) ?? {};
                    const v = map[room.resourceId] ?? "";
                    if (!CHARTFIELD_REGEX.test(v)) {
                      return CHARTFIELD_PATTERN_MESSAGE;
                    }
                    return true;
                  },
                }}
                render={({ field }) => (
                  <>
                    <Label htmlFor={`chart-setup-${room.resourceId}`}>
                      ChartField for Room Setup *
                    </Label>
                    <input
                      id={`chart-setup-${room.resourceId}`}
                      style={{
                        width: "100%",
                        padding: "8px",
                        marginBottom: 16,
                        border: "1px solid #ccc",
                        borderRadius: 4,
                      }}
                      value={chartMap[room.resourceId] ?? ""}
                      onChange={(e) => {
                        const next = {
                          ...((field.value as Record<string, string>) ?? {}),
                          [room.resourceId]: e.target.value,
                        };
                        field.onChange(next);
                        if (selectedRooms.length === 1) {
                          setValue("chartFieldForRoomSetup", e.target.value);
                        }
                      }}
                      onBlur={() => trigger("chartFieldForRoomSetupByRoom")}
                    />
                  </>
                )}
              />
            )}
          </Subsection>
        );
      })}

      {furnishingsRooms.map((room) => {
        const cfg = getServiceSectionConfig(room, "furnishings")!;
        const furnMap =
          (watch("furnishingsByRoom") as Record<string, string> | undefined) ?? {};
        const chartFurn =
          (watch("chartFieldForFurnishingsByRoom") as
            | Record<string, string>
            | undefined) ?? {};
        const isYes = furnMap[room.resourceId] === "yes";

        return (
          <Subsection key={`furn-${room.resourceId}`}>
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
                    setValue("furnishingsByRoom", {
                      ...furnMap,
                      [room.resourceId]: e.target.checked ? "yes" : "",
                    });
                  }}
                />
              }
            />
            {cfg.chartFieldWhenYes && isYes && (
              <Controller
                name="chartFieldForFurnishingsByRoom"
                control={control}
                rules={{
                  validate: (val) => {
                    const map = (val as Record<string, string>) ?? {};
                    const v = map[room.resourceId] ?? "";
                    if (!CHARTFIELD_REGEX.test(v)) {
                      return CHARTFIELD_PATTERN_MESSAGE;
                    }
                    return true;
                  },
                }}
                render={({ field }) => (
                  <>
                    <Label>ChartField for Additional Event Furniture *</Label>
                    <input
                      style={{
                        width: "100%",
                        padding: "8px",
                        marginBottom: 16,
                        border: "1px solid #ccc",
                        borderRadius: 4,
                      }}
                      value={chartFurn[room.resourceId] ?? ""}
                      onChange={(e) => {
                        field.onChange({
                          ...((field.value as Record<string, string>) ?? {}),
                          [room.resourceId]: e.target.value,
                        });
                      }}
                    />
                  </>
                )}
              />
            )}
          </Subsection>
        );
      })}

      {equipmentStaticRooms.map((room) => {
        const cfg = getServiceSectionConfig(room, "equipment")!;
        return (
          <Subsection key={`equip-${room.resourceId}`}>
            <Label>
              {formatFieldLabel(`${room.name} — ${cfg.label ?? "Equipment"}`)}
            </Label>
            <HtmlBlock html={cfg.descriptionHtml} />
          </Subsection>
        );
      })}

      {staticCateringRoom && (() => {
        const cfg = getServiceSectionConfig(staticCateringRoom, "catering")!;
        const loungeChecked =
          loungeByRoom[staticCateringRoom.resourceId] === "yes";
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
                        [staticCateringRoom.resourceId]: checked ? "yes" : "",
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
        return (
          <Subsection key={`sec-${room.resourceId}`}>
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
        const checked = auxiliaryByRoom[room.resourceId] === "yes";
        return (
          <Subsection key={`aux-${room.resourceId}`}>
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
                      [room.resourceId]: e.target.checked ? "yes" : "",
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
