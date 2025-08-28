import { Checkbox, FormControlLabel, Switch } from "@mui/material";
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

  const checkboxes = useMemo(() => {
    const options: StaffingServices[] = [];

    // Check for specific room services
    selectedRooms.forEach((room) => {
      // Use room-specific staffing services if available
      if (room.staffingServices && room.staffingServices.length > 0) {
        room.staffingServices.forEach((serviceKey: any) => {
          if (serviceKey && !options.includes(serviceKey)) {
            options.push(serviceKey);
          }
        });
      }
    });

    return options;
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
              {checkboxes.map((checkbox) => (
                <FormControlLabel
                  key={checkbox}
                  label={checkbox}
                  sx={{ display: "block" }}
                  control={
                    <Checkbox
                      checked={field.value?.includes(checkbox) || false}
                      onChange={(e) => {
                        const values = field.value
                          ? field.value.split(", ")
                          : [];
                        let newValue: string[];
                        if (e.target.checked) {
                          newValue = [...values, checkbox];
                        } else {
                          newValue = values.filter(
                            (value) => value !== checkbox
                          );
                        }
                        field.onChange(newValue.join(", "));
                        trigger(id);
                      }}
                      onBlur={() => trigger(id)}
                    />
                  }
                />
              ))}
            </div>
          )}
        ></Controller>
      )}
    </div>
  );
}
