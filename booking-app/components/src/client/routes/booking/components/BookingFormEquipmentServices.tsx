import { FormControlLabel, Switch } from "@mui/material";
import { Control, Controller, UseFormTrigger } from "react-hook-form";
import { FormContextLevel, Inputs, EquipmentServices } from "../../../../types";
import React from "react";

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
  const schema = useTenantSchema();
  const { showEquipment } = schema;

  const limitedContexts = [
    FormContextLevel.WALK_IN,
    FormContextLevel.MODIFICATION,
  ];

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
                  // de-select equipment if switch says "no equipment services"
                  field.onChange("");
                } else {
                  // automatically select equipment when toggle is ON
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
        <Label htmlFor={id}>Equipment Services?</Label>
        <p style={{ fontSize: "0.75rem" }}>Check out equipment</p>
        {toggle}
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 8 }}>
      <Label htmlFor={id}>Equipment Services?</Label>
      <p style={{ fontSize: "0.75rem" }}>
        Check out equipment from Media Commons inventory.
      </p>
      {toggle}
    </div>
  );
}

