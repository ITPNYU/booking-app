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
import { FormContextLevel, Inputs, StaffingServices } from "../../../../types";
import React, { useContext, useMemo } from "react";
import { BookingContext } from "../bookingProvider";
import styled from "@emotion/styled";

const Label = styled.label`
  font-weight: 500;
  font-size: 0.875rem;
  line-height: 1.25rem;
  margin-bottom: 0.5rem;
`;

interface Props {
  id: keyof Inputs;
  control: Control<Inputs, any>;
  trigger: UseFormTrigger<Inputs>;
  showStaffingServices: boolean;
  setShowStaffingServices: any;
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
    (room) => room.staffingServices && room.staffingServices.length > 0
  );

  // Previously limited for walk-in/modification; restriction removed so full options show in all contexts

  const { staffingSections, staffingServices } = useMemo(() => {
    let sections: { name: string; indexes: number[] }[] = [];
    let services: StaffingServices[] = [];

    // Check for specific room services
    selectedRooms.forEach((room) => {
      // Use room-specific staffing services if available
      if (room.staffingServices && room.staffingServices.length > 0) {
        room.staffingServices.forEach((serviceKey: any) => {
          if (serviceKey && !services.includes(serviceKey)) {
            services.push(serviceKey);
          }
        });
      }

      // Check for staffing sections
      if (room.staffingSections && room.staffingSections.length > 0) {
        sections = room.staffingSections;
      }
    });

    return { staffingSections: sections, staffingServices: services };
  }, [roomIds, selectedRooms, showStaffing]);

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
                  // de-select boxes if switch says "no staffing services"
                  field.onChange("");
                }

                trigger(id);
              }}
              onBlur={() => trigger(id)}
            />
          }
        />
      )}
    ></Controller>
  );

  // If staffing is disabled at the schema level, hide the entire control
  if (!showStaffing) {
    return null;
  }

  return (
    <div style={{ marginBottom: 8 }}>
      <Label htmlFor={id}>Staffing?</Label>
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
                // Render sectioned staffing services with radio buttons for each service
                <div>
                  {staffingSections.map((section, sectionIndex) => {
                    const selectedServices = field.value?.split(",") || [];

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
                                section.indexes.some(
                                  (index) => staffingServices[index] === service
                                )
                              ) || ""
                            }
                            onChange={(e) => {
                              // Remove any previously selected services from this section
                              const otherServices = selectedServices.filter(
                                (service) =>
                                  !section.indexes.some(
                                    (index) =>
                                      staffingServices[index] === service
                                  )
                              );
                              // Add the newly selected service
                              const newServices = e.target.value
                                ? [...otherServices, e.target.value]
                                : otherServices;
                              field.onChange(newServices.join(","));
                              trigger(id);
                            }}
                            onBlur={() => trigger(id)}
                          >
                            {section.indexes.map((serviceIndex) => {
                              const service = staffingServices[serviceIndex];
                              return service ? (
                                <FormControlLabel
                                  key={serviceIndex}
                                  value={service}
                                  control={<Radio size="small" />}
                                  label={service}
                                  sx={{
                                    display: "block",
                                    fontSize: "0.75rem",
                                    marginBottom: 0.5,
                                  }}
                                />
                              ) : null;
                            })}
                          </RadioGroup>
                        </FormControl>
                      </div>
                    );
                  })}
                </div>
              ) : (
                // Render radio buttons for non-sectioned services (single select for staffing)
                <FormControl component="fieldset">
                  <RadioGroup
                    value={field.value || ""}
                    onChange={(e) => {
                      field.onChange(e.target.value);
                      trigger(id);
                    }}
                    onBlur={() => trigger(id)}
                  >
                    {staffingServices.map((service) => (
                      <FormControlLabel
                        key={service}
                        value={service}
                        control={<Radio size="small" />}
                        label={service}
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
        ></Controller>
      )}
    </div>
  );
}
