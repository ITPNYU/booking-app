import { Checkbox, FormControlLabel, Switch } from "@mui/material";
import { Control, Controller, UseFormTrigger } from "react-hook-form";
import { FormContextLevel, Inputs, MediaServices } from "../../../../types";
import React, { useContext, useMemo } from "react";

import { BookingContext } from "../bookingProvider";
import { useTenantSchema } from "../../components/SchemaProvider";
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
  showMediaServices: boolean;
  setShowMediaServices: any;
  formContext: FormContextLevel;
}

export default function BookingFormMediaServices(props: Props) {
  const {
    id,
    control,
    trigger,
    showMediaServices,
    setShowMediaServices,
    formContext: _formContext,
  } = props;
  const { selectedRooms } = useContext(BookingContext);
  const schema = useTenantSchema();
  const { showEquipment, showStaffing } = schema;
  const roomIds = selectedRooms.map((room) => room.roomId);

  // Previously, walk-in/modification contexts were limited to equipment-only.
  // This restriction has been removed, so technician options should be available in all contexts.

  const checkboxes = useMemo(() => {
    const options: MediaServices[] = [];

    // If equipment is enabled in schema, allow checkout equipment regardless of room
    if (showEquipment) {
      options.push(MediaServices.CHECKOUT_EQUIPMENT);
    }

    // Check for specific room services
    selectedRooms.forEach((room) => {
      if (showStaffing) {
        if (room.roomId === 103) {
          options.push(MediaServices.AUDIO_TECH_103);
          options.push(MediaServices.LIGHTING_TECH_103);
        }
        if (room.roomId === 230) {
          options.push(MediaServices.AUDIO_TECH_230);
        }
        if (room.services?.includes("campus-media")) {
          options.push(MediaServices.CAMPUS_MEDIA_SERVICES);
        }
      }
    });

    return options;
  }, [roomIds, selectedRooms, showEquipment, showStaffing]);

  const toggle = (
    <Controller
      name={id}
      control={control}
      render={({ field }) => (
        <FormControlLabel
          label={showMediaServices ? "Yes" : "No"}
          control={
            <Switch
              checked={showMediaServices}
              onChange={(e) => {
                setShowMediaServices(e.target.checked);
                if (!e.target.checked) {
                  // de-select boxes if switch says "no media services"
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

  // If both equipment and staffing are disabled at the schema level, hide the entire control
  const mediaServicesEnabled = showEquipment || showStaffing;

  if (!mediaServicesEnabled) {
    return null;
  }

  return (
    <div style={{ marginBottom: 8 }}>
      <Label htmlFor={id}>Media Services</Label>
      <p style={{ fontSize: "0.75rem" }}>
        Check out equipment, request a technician, etc.
      </p>
      {toggle}
      {showMediaServices && (
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
