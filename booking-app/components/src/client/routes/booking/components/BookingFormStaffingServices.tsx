import {
  Checkbox,
  FormControlLabel,
  Switch,
  Radio,
  RadioGroup,
  FormControl,
  FormLabel,
} from "@mui/material";
import { Control, Controller, UseFormTrigger } from "react-hook-form";
import React, { useContext, useMemo } from "react";
import styled from "@emotion/styled";
import { FormContextLevel, Inputs, StaffingServices } from "../../../../types";
import { BookingContext } from "../bookingProvider";
import {
  getResourceServicesConfig,
  resourceHasService,
} from "../../../../utils/resourceServicesUtils";

const Label = styled.label`
  font-weight: 500;
  font-size: 0.875rem;
  line-height: 1.25rem;
  margin-bottom: 0.5rem;
`;

type StaffingSectionView = {
  name: string;
  services: Array<{ value: string; label: string }>;
};

interface Props {
  id: keyof Inputs;
  control: Control<Inputs, any>;
  trigger: UseFormTrigger<Inputs>;
  showStaffingServices: boolean;
  setShowStaffingServices: (value: boolean) => void;
  formContext: FormContextLevel;
}

export default function BookingFormStaffingServices(props: Props) {
  const {
    id,
    control,
    trigger,
    showStaffingServices,
    setShowStaffingServices,
    formContext: _formContext,
  } = props;
  const { selectedRooms } = useContext(BookingContext);
  const roomIds = selectedRooms.map((room) => room.roomId);

  const showStaffing = selectedRooms.some(
    (room) =>
      resourceHasService(room, "staffing") ||
      (room.staffingServices && room.staffingServices.length > 0),
  );

  const { staffingSections, flatServices } = useMemo(() => {
    const sections: StaffingSectionView[] = [];
    const flat: Array<{ value: string; label: string }> = [];

    selectedRooms.forEach((room) => {
      const staffingConfig = getResourceServicesConfig(room).staffing;
      if (staffingConfig?.sections) {
        Object.values(staffingConfig.sections).forEach((section) => {
          if (section.services?.length) {
            sections.push({
              name: section.name,
              services: section.services.map((s) => ({
                value: s.value,
                label: s.label,
              })),
            });
          }
        });
      } else if (staffingConfig?.staffingOptions?.length) {
        staffingConfig.staffingOptions.forEach((s) => {
          if (!flat.some((f) => f.value === s.value)) {
            flat.push({ value: s.value, label: s.label });
          }
        });
      } else if (room.staffingSections && room.staffingSections.length > 0) {
        const legacyServices = (room.staffingServices ?? []) as string[];
        room.staffingSections.forEach((section) => {
          sections.push({
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
    });

    return { staffingSections: sections, flatServices: flat };
  }, [roomIds, selectedRooms]);

  const staffingLabel =
    getResourceServicesConfig(selectedRooms[0] ?? { services: {} }).staffing
      ?.label ?? "Staffing";

  const toggle = (
    <Controller
      name={id}
      control={control}
      render={({ field }) => (
        <FormControlLabel
          label={showStaffingServices ? "Yes" : "No"}
          control={
            <Switch
              checked={showStaffingServices}
              onChange={(e) => {
                setShowStaffingServices(e.target.checked);
                if (!e.target.checked) {
                  field.onChange("");
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

  if (!showStaffing) {
    return null;
  }

  return (
    <div style={{ marginBottom: 8 }}>
      <Label htmlFor={id}>{staffingLabel}?</Label>
      <p style={{ fontSize: "0.75rem" }}>
        Request audio technicians, lighting technicians, and technical support.
      </p>
      {toggle}
      {showStaffingServices && (
        <Controller
          name={id}
          control={control}
          render={({ field }) => (
            <div>
              {staffingSections.length > 0 ? (
                <div>
                  {staffingSections.map((section, sectionIndex) => {
                    const selectedServices = field.value?.split(",") || [];
                    const sectionValues = section.services.map((s) => s.value);

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
                            value={
                              selectedServices.find((service) =>
                                sectionValues.includes(service),
                              ) || ""
                            }
                            onChange={(e) => {
                              const otherServices = selectedServices.filter(
                                (service) => !sectionValues.includes(service),
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
                    value={field.value || ""}
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
          )}
        />
      )}
    </div>
  );
}
