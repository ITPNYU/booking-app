import {
  CAMPUS_MEDIA_SERVICES_ROOMS,
  CHECKOUT_EQUIPMENT_ROOMS,
  LIGHTING_DMX_ROOMS,
} from "../../../../policy";
import { Checkbox, FormControlLabel, Switch } from "@mui/material";
import { Control, Controller, UseFormTrigger } from "react-hook-form";
import { Inputs, MediaServices } from "../../../../types";
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
  showMediaServices: boolean;
  setShowMediaServices: any;
  isWalkIn: boolean;
}

export default function BookingFormMediaServices(props: Props) {
  const {
    id,
    control,
    trigger,
    showMediaServices,
    setShowMediaServices,
    isWalkIn,
  } = props;
  const { selectedRooms } = useContext(BookingContext);
  const roomIds = selectedRooms.map((room) => room.roomId);

  const checkboxes = useMemo(() => {
    const options: MediaServices[] = [];
    const checkRoomMediaServices = (list: number[]) =>
      roomIds.some((roomId) => list.includes(roomId));
    if (checkRoomMediaServices(CHECKOUT_EQUIPMENT_ROOMS))
      options.push(MediaServices.CHECKOUT_EQUIPMENT);
    if (checkRoomMediaServices([103])) {
      options.push(MediaServices.AUDIO_TECH_103);
      options.push(MediaServices.LIGHTING_TECH_103);
    }
    if (checkRoomMediaServices([230]))
      options.push(MediaServices.AUDIO_TECH_230);
    if (checkRoomMediaServices(CAMPUS_MEDIA_SERVICES_ROOMS))
      options.push(MediaServices.CAMPUS_MEDIA_SERVICES);
    if (checkRoomMediaServices(LIGHTING_DMX_ROOMS))
      options.push(MediaServices.LIGHTING_DMX);

    return options;
  }, [roomIds]);

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
                } else if (isWalkIn) {
                  field.onChange(MediaServices.CHECKOUT_EQUIPMENT);
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

  if (isWalkIn) {
    return (
      <div style={{ marginBottom: 8 }}>
        <Label htmlFor={id}>Media Services</Label>
        <p style={{ fontSize: "0.75rem" }}>Check out equipment</p>
        {toggle}
      </div>
    );
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
