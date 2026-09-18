import {
  FormControl,
  FormControlLabel,
  FormHelperText,
  FormLabel,
  Radio,
  RadioGroup,
  Switch,
} from "@mui/material";
import { Control, Controller, UseFormTrigger, useWatch } from "react-hook-form";
import React, { useContext, useEffect, useMemo } from "react";
import styled from "@emotion/styled";
import { FormContextLevel, Inputs, StaffingServices } from "../../../../types";
import type { ServiceToggle } from "../../components/schemaTypes";
import {
  combineServiceToggles,
  getResourceServicesConfig,
  getServiceToggle,
  resourceHasService,
  ServiceResourceLike,
} from "../../../../utils/resourceServicesUtils";
import { BookingContext } from "../bookingProvider";

const Label = styled.label`
  font-weight: 500;
  font-size: 0.875rem;
  line-height: 1.25rem;
  margin-bottom: 0.5rem;
`;

/** Service name and its yes/no switch on one line, description underneath. */
const SwitchRow = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
`;

type StaffingSectionView = {
  name: string;
  services: Array<{ value: string; label: string }>;
  defaultValue?: string;
};

function staffingSectionKey(section: StaffingSectionView): string {
  return `${section.name}::${section.services.map((s) => s.value).sort().join(",")}`;
}

function addStaffingSection(
  sections: StaffingSectionView[],
  section: StaffingSectionView,
) {
  const key = staffingSectionKey(section);
  if (!sections.some((existing) => staffingSectionKey(existing) === key)) {
    sections.push(section);
  }
}

function defaultStaffingValues(sections: StaffingSectionView[]): string[] {
  return sections
    .map((section) => section.defaultValue)
    .filter((value): value is string => !!value);
}

interface Props {
  id: "staffingServices";
  control: Control<Inputs, any>;
  trigger: UseFormTrigger<Inputs>;
  showStaffingServices: boolean;
  setShowStaffingServices: (value: boolean) => void;
  formContext: FormContextLevel;
  /** When set, only render staffing for these rooms (Room → Service layout). */
  rooms?: ServiceResourceLike[];
  /**
   * Toggle lock resolved across every selected room by the parent. Without
   * it, the lock is derived from `rooms` only.
   */
  toggle?: ServiceToggle;
  setValue?: (
    name: keyof Inputs,
    value: any,
    options?: { shouldValidate?: boolean },
  ) => void;
}

export default function BookingFormStaffingServices(props: Props) {
  const {
    id,
    control,
    trigger,
    showStaffingServices,
    setShowStaffingServices,
    formContext: _formContext,
    rooms: roomsProp,
    setValue,
    toggle: toggleProp,
  } = props;
  const { selectedRooms: contextRooms } = useContext(BookingContext);
  const selectedRooms = roomsProp ?? contextRooms;
  const roomIds = selectedRooms.map(
    (room) => room.resourceId ?? room.roomId ?? "",
  );
  const staffingFieldValue = useWatch({ control, name: id }) as
    | string
    | undefined;

  const showStaffing = selectedRooms.some(
    (room) =>
      resourceHasService(room, "staffing") ||
      (room.staffingServices && room.staffingServices.length > 0),
  );

  const { staffingSections, flatServices, staticStaffingRooms } = useMemo(() => {
    const sections: StaffingSectionView[] = [];
    const flat: Array<{ value: string; label: string }> = [];
    const staticRooms: Array<{
      label?: string;
      descriptionHtml?: string;
      name?: string;
    }> = [];

    selectedRooms.forEach((room) => {
      const staffingConfig = getResourceServicesConfig(room).staffing;
      if (!staffingConfig) {
        if (room.staffingSections && room.staffingSections.length > 0) {
          const legacyServices = (room.staffingServices ?? []) as string[];
          room.staffingSections.forEach((section) => {
            addStaffingSection(sections, {
              name: section.name,
              services: section.indexes
                .map((index) => legacyServices[index])
                .filter(Boolean)
                .map((value) => ({
                  value,
                  label:
                    (StaffingServices as Record<string, string>)[value] ?? value,
                })),
            });
          });
        } else if (room.staffingServices?.length) {
          room.staffingServices.forEach((serviceKey: string) => {
            if (!flat.some((f) => f.value === serviceKey)) {
              flat.push({
                value: serviceKey,
                label:
                  (StaffingServices as Record<string, string>)[serviceKey] ??
                  serviceKey,
              });
            }
          });
        }
        return;
      }

      const hasSections =
        !!staffingConfig.sections &&
        Object.keys(staffingConfig.sections).length > 0;
      const isStatic =
        staffingConfig.mode === "static" ||
        (!hasSections && !staffingConfig.staffingOptions?.length);

      if (isStatic) {
        staticRooms.push({
          label: staffingConfig.label,
          descriptionHtml: staffingConfig.descriptionHtml,
          name: room.name,
        });
        return;
      }

      if (staffingConfig.sections) {
        Object.values(staffingConfig.sections).forEach((section) => {
          const options =
            section.options?.length
              ? section.options
              : section.services?.map((s) => ({
                  value: s.value,
                  label: s.label,
                }));
          if (options?.length) {
            addStaffingSection(sections, {
              name: section.label ?? section.name ?? "Staffing",
              services: options.map((s) => ({
                value: s.value,
                label: s.label,
              })),
              defaultValue: section.defaultValue,
            });
          }
        });
      } else if (staffingConfig.staffingOptions?.length) {
        staffingConfig.staffingOptions.forEach((s) => {
          if (!flat.some((f) => f.value === s.value)) {
            flat.push({ value: s.value, label: s.label });
          }
        });
      }
    });

    return {
      staffingSections: sections,
      flatServices: flat,
      staticStaffingRooms: staticRooms,
    };
  }, [roomIds, selectedRooms]);

  const hasInteractiveStaffing =
    staffingSections.length > 0 || flatServices.length > 0;

  // Schema lock for the staffing switch (shared across the rendered rooms).
  const roomsToggle = useMemo(
    () =>
      combineServiceToggles(
        selectedRooms
          .map((room) => getResourceServicesConfig(room).staffing)
          .filter((cfg) => !!cfg)
          .map((cfg) => getServiceToggle(cfg)),
      ),
    [selectedRooms],
  );
  const staffingToggle = toggleProp ?? roomsToggle;
  const staffingLocked = staffingToggle !== "optional";

  // Locked switches force the visibility state and clear stale values.
  useEffect(() => {
    if (!showStaffing || !hasInteractiveStaffing) return;
    if (staffingToggle === "on" && !showStaffingServices) {
      setShowStaffingServices(true);
    } else if (staffingToggle === "off") {
      if (showStaffingServices) setShowStaffingServices(false);
      if (staffingFieldValue && setValue) {
        setValue(id, "", { shouldValidate: false });
      }
    }
  }, [
    staffingToggle,
    showStaffing,
    hasInteractiveStaffing,
    showStaffingServices,
    setShowStaffingServices,
    staffingFieldValue,
    setValue,
    id,
  ]);

  const staffingLabel =
    getResourceServicesConfig(selectedRooms[0] ?? {}).staffing?.label ??
    "Staffing?";

  // While the switch is on, every staffing section needs a selection. Sections
  // with a defaultValue are seeded automatically; sections without one (or a
  // locked-on switch with no defaults) must not submit empty.
  const validateStaffingSelection = (value: unknown): true | string => {
    if (!showStaffingServices || !hasInteractiveStaffing) return true;
    const selected =
      typeof value === "string" && value.length > 0 ? value.split(",") : [];
    if (staffingSections.length > 0) {
      const missing = staffingSections.some(
        (section) => !section.services.some((s) => selected.includes(s.value)),
      );
      return missing
        ? "Please select an option for each staffing section."
        : true;
    }
    return selected.length > 0 ? true : "Please select a staffing option.";
  };

  // Radios show section.defaultValue visually, but that does not write the form
  // field. Seed defaults when staffing is enabled so bookings persist selections.
  useEffect(() => {
    if (!showStaffingServices || !setValue) return;
    if (typeof staffingFieldValue === "string" && staffingFieldValue.length > 0) {
      return;
    }
    const defaults = defaultStaffingValues(staffingSections);
    if (defaults.length > 0) {
      setValue(id, defaults.join(","), { shouldValidate: true });
      return;
    }
    if (flatServices.length === 1) {
      setValue(id, flatServices[0].value, { shouldValidate: true });
    }
  }, [
    showStaffingServices,
    staffingSections,
    flatServices,
    staffingFieldValue,
    setValue,
    id,
  ]);

  if (!showStaffing) {
    return null;
  }

  if (!hasInteractiveStaffing) {
    return (
      <div style={{ marginBottom: 8 }}>
        {staticStaffingRooms.map((room, index) => (
          <div key={`staffing-static-${index}`} style={{ marginBottom: 16 }}>
            <Label>{room.label ?? staffingLabel}</Label>
            {room.descriptionHtml ? (
              <div
                style={{ fontSize: "0.75rem", marginBottom: 8 }}
                dangerouslySetInnerHTML={{ __html: room.descriptionHtml }}
              />
            ) : null}
          </div>
        ))}
      </div>
    );
  }

  const toggle = (
    <Controller
      name={id}
      control={control}
      rules={{ validate: validateStaffingSelection }}
      render={({ field }) => (
        <FormControlLabel
          sx={{ mx: 0 }}
          label={showStaffingServices ? "Yes" : "No"}
          control={
            <Switch
              checked={showStaffingServices}
              disabled={staffingLocked}
              onChange={(e) => {
                const checked = e.target.checked;
                setShowStaffingServices(checked);
                if (!checked) {
                  field.onChange("");
                } else if (!field.value) {
                  const defaults = defaultStaffingValues(staffingSections);
                  if (defaults.length > 0) {
                    field.onChange(defaults.join(","));
                  } else if (flatServices.length === 1) {
                    field.onChange(flatServices[0].value);
                  }
                }
                trigger(id);
              }}
              onBlur={() => trigger(id)}
            />
          }
        />
      )}
    />
  );

  return (
    <div style={{ marginBottom: 8 }}>
      {staticStaffingRooms.map((room, index) => (
        <div key={`staffing-static-${index}`} style={{ marginBottom: 16 }}>
          <Label>{room.label ?? staffingLabel}</Label>
          {room.descriptionHtml ? (
            <div
              style={{ fontSize: "0.75rem", marginBottom: 8 }}
              dangerouslySetInnerHTML={{ __html: room.descriptionHtml }}
            />
          ) : null}
        </div>
      ))}
      <SwitchRow>
        <Label htmlFor={id} style={{ marginBottom: 0 }}>
          {staffingLabel}
        </Label>
        {toggle}
      </SwitchRow>
      <p style={{ fontSize: "0.75rem" }}>
        Request audio technicians, lighting technicians, and technical support.
      </p>
      {showStaffingServices && (
        <Controller
          name={id}
          control={control}
          rules={{ validate: validateStaffingSelection }}
          render={({ field, fieldState }) => {
            const value = typeof field.value === "string" ? field.value : "";
            const selectedServices = value ? value.split(",") : [];

            return (
              <div>
                {fieldState.error?.message && (
                  <FormHelperText error sx={{ marginBottom: 1 }}>
                    {fieldState.error.message}
                  </FormHelperText>
                )}
                {staffingSections.length > 0 ? (
                  <div>
                    {staffingSections.map((section, sectionIndex) => {
                      const sectionValues = section.services.map((s) => s.value);
                      const current =
                        selectedServices.find((service) =>
                          sectionValues.includes(service),
                        ) ||
                        section.defaultValue ||
                        "";

                      return (
                        <div key={sectionIndex} style={{ marginBottom: 24 }}>
                          <FormLabel
                            component="legend"
                            sx={{
                              fontSize: "0.875rem",
                              fontWeight: 500,
                              marginBottom: 1,
                              display: "block",
                            }}
                          >
                            {section.name}:
                          </FormLabel>
                          <FormControl component="fieldset">
                            <RadioGroup
                              value={current}
                              onChange={(e) => {
                                const otherServices = selectedServices.filter(
                                  (service) =>
                                    !sectionValues.includes(service),
                                );
                                const newServices = e.target.value
                                  ? [...otherServices, e.target.value]
                                  : otherServices;
                                field.onChange(newServices.join(","));
                                trigger(id);
                              }}
                              onBlur={() => trigger(id)}
                            >
                              {section.services.map((service) => (
                                <FormControlLabel
                                  key={service.value}
                                  value={service.value}
                                  control={<Radio size="small" />}
                                  label={service.label}
                                  sx={{
                                    display: "block",
                                    fontSize: "0.75rem",
                                    marginBottom: 0.5,
                                  }}
                                />
                              ))}
                            </RadioGroup>
                          </FormControl>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <FormControl component="fieldset">
                    <RadioGroup
                      value={value}
                      onChange={(e) => {
                        field.onChange(e.target.value);
                        trigger(id);
                      }}
                      onBlur={() => trigger(id)}
                    >
                      {flatServices.map((service) => (
                        <FormControlLabel
                          key={service.value}
                          value={service.value}
                          control={<Radio size="small" />}
                          label={service.label}
                          sx={{
                            display: "block",
                            fontSize: "0.75rem",
                            marginBottom: 0.5,
                          }}
                        />
                      ))}
                    </RadioGroup>
                  </FormControl>
                )}
              </div>
            );
          }}
        />
      )}
    </div>
  );
}
