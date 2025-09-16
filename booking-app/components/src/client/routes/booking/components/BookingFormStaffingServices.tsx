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
    formContext,
  } = props;
  const { selectedRooms } = useContext(BookingContext);
  const roomIds = selectedRooms.map((room) => room.roomId);
  const showStaffing = selectedRooms.some(
    (room) => room.staffingServices && room.staffingServices.length > 0
  );

  const limitedContexts = [
    FormContextLevel.WALK_IN,
    FormContextLevel.MODIFICATION,
  ];

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

  if (limitedContexts.includes(formContext)) {
    return (
      <div style={{ marginBottom: 8 }}>
        <Label htmlFor={id}>Staffing Services?</Label>
        <p style={{ fontSize: "0.75rem" }}>Request technicians and support</p>
        {toggle}
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 8 }}>
      <Label htmlFor={id}>Staffing Services?</Label>
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
                // Render sectioned staffing services with radio buttons and checkboxes
                <FormControl component="fieldset">
                  <FormLabel
                    component="legend"
                    sx={{
                      fontSize: "0.875rem",
                      fontWeight: 500,
                      marginBottom: 1,
                    }}
                  >
                    Select a staffing section:
                  </FormLabel>
                  <RadioGroup
                    value={field.value?.split('|')[0] || ""}
                    onChange={(e) => {
                      // When section changes, clear individual service selections
                      field.onChange(e.target.value);
                      trigger(id);
                    }}
                    onBlur={() => trigger(id)}
                  >
                    {staffingSections.map((section, sectionIndex) => {
                      const isSectionSelected = field.value?.split('|')[0] === section.name;
                      const selectedServices = field.value?.split('|')[1]?.split(',') || [];
                      
                      return (
                        <div key={sectionIndex} style={{ marginBottom: 16 }}>
                          <FormControlLabel
                            value={section.name}
                            control={<Radio />}
                            label={section.name}
                            sx={{ fontWeight: 500 }}
                          />
                          <div style={{ marginLeft: 24, marginTop: 8 }}>
                            {section.indexes.map((serviceIndex) => {
                              const service = staffingServices[serviceIndex];
                              return service ? (
                                <FormControlLabel
                                  key={serviceIndex}
                                  label={service}
                                  sx={{ 
                                    display: "block", 
                                    fontSize: "0.75rem",
                                    opacity: isSectionSelected ? 1 : 0.5,
                                    pointerEvents: isSectionSelected ? "auto" : "none"
                                  }}
                                  control={
                                    <Checkbox
                                      checked={isSectionSelected && selectedServices.includes(service)}
                                      disabled={!isSectionSelected}
                                      onChange={(e) => {
                                        if (isSectionSelected) {
                                          const currentServices = selectedServices.filter(s => s !== service);
                                          const newServices = e.target.checked 
                                            ? [...currentServices, service]
                                            : currentServices;
                                          field.onChange(`${section.name}|${newServices.join(',')}`);
                                          trigger(id);
                                        }
                                      }}
                                      onBlur={() => trigger(id)}
                                      size="small"
                                    />
                                  }
                                />
                              ) : null;
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </RadioGroup>
                </FormControl>
              ) : (
                // Render regular checkboxes for non-sectioned services
                staffingServices.map((service) => (
                  <FormControlLabel
                    key={service}
                    label={service}
                    sx={{ display: "block" }}
                    control={
                      <Checkbox
                        checked={field.value?.includes(service) || false}
                        onChange={(e) => {
                          const values = field.value
                            ? field.value.split(", ")
                            : [];
                          let newValue: string[];
                          if (e.target.checked) {
                            newValue = [...values, service];
                          } else {
                            newValue = values.filter(
                              (value) => value !== service
                            );
                          }
                          field.onChange(newValue.join(", "));
                          trigger(id);
                        }}
                        onBlur={() => trigger(id)}
                      />
                    }
                  />
                ))
              )}
            </div>
          )}
        ></Controller>
      )}
    </div>
  );
}
