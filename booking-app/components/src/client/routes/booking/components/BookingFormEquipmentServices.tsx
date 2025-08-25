import { Checkbox, FormControlLabel, Switch } from "@mui/material";
import { Control, Controller, UseFormTrigger } from "react-hook-form";
import { FormContextLevel, Inputs, EquipmentServices } from "../../../../types";
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
  showEquipmentServices: boolean;
  setShowEquipmentServices: any;
  formContext: FormContextLevel;
}

export default function BookingFormEquipmentServices(props: Props) {
  const {
    id,
    control,
    trigger,
    showEquipmentServices,
    setShowEquipmentServices,
    formContext,
  } = props;
  const { selectedRooms } = useContext(BookingContext);
  const schema = useTenantSchema();
  const { showEquipment } = schema;

  const limitedContexts = [
    FormContextLevel.WALK_IN,
    FormContextLevel.MODIFICATION,
  ];

  const checkboxes = useMemo(() => {
    const options: EquipmentServices[] = [];

    // If equipment is enabled in schema, allow checkout equipment regardless of room
    if (showEquipment) {
      options.push(EquipmentServices.CHECKOUT_EQUIPMENT);
    }

    return options;
  }, [showEquipment]);

  const toggle = (
    <Controller
      name={id}
      control={control}
      render={({ field }) => (
        <FormControlLabel
          label={showEquipmentServices ? "Yes" : "No"}
          control={
            <Switch
              checked={showEquipmentServices}
              onChange={(e) => {
                setShowEquipmentServices(e.target.checked);
                if (!e.target.checked) {
                  // de-select boxes if switch says "no equipment services"
                  field.onChange("");
                } else if (limitedContexts.includes(formContext)) {
                  field.onChange(EquipmentServices.CHECKOUT_EQUIPMENT);
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

  // If equipment is disabled at the schema level, hide the entire control
  if (!showEquipment) {
    return null;
  }

  if (limitedContexts.includes(formContext)) {
    return (
      <div style={{ marginBottom: 8 }}>
        <Label htmlFor={id}>Equipment Services</Label>
        <p style={{ fontSize: "0.75rem" }}>Check out equipment</p>
        {toggle}
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 8 }}>
      <Label htmlFor={id}>Equipment Services</Label>
      <p style={{ fontSize: "0.75rem" }}>
        Check out equipment from Media Commons inventory.
      </p>
      {toggle}
      {showEquipmentServices && (
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

