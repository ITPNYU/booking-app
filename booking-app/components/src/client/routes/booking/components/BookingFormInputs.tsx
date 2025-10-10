import {
  Box,
  Checkbox,
  FormControl,
  FormControlLabel,
  FormHelperText,
  MenuItem,
  Select,
  Switch,
  TextField,
} from "@mui/material";
import {
  Control,
  Controller,
  FieldErrors,
  UseFormTrigger,
  ValidationRule,
} from "react-hook-form";
import React, { cloneElement } from "react";

import { Inputs } from "../../../../types";
import styled from "@emotion/styled";

const Label = styled.label`
  font-weight: 500;
  font-size: 0.875rem;
  line-height: 1.25rem;
  margin-bottom: 0.5rem;
`;

interface Props {
  id: keyof Inputs;
  label: string;
  required?: boolean;
  control: Control<Inputs, any>;
  errors: FieldErrors<Inputs>;
  trigger: UseFormTrigger<Inputs>;
}

interface DropdownInputs extends Props {
  options: string[];
  description?: React.ReactNode;
  dataTestId?: string;
}

export function BookingFormDropdown(props: DropdownInputs) {
  const {
    id,
    label,
    options,
    description = null,
    required = true,
    control,
    errors,
    trigger,
    dataTestId,
  } = props;

  return (
    <Controller
      name={id}
      control={control}
      defaultValue=""
      rules={{
        required: required && `${label} is required`,
        validate: (value) => value !== "",
      }}
      render={({ field }) => (
        <FormControl
          error={errors[id] != null}
          sx={{ marginBottom: 4 }}
          fullWidth
        >
          <Label htmlFor={id}>{`${label}${required ? "*" : ""}`}</Label>
          {description && (
            <div style={{ fontSize: "0.75rem" }}>{description}</div>
          )}
          <Select
            {...field}
            onBlur={() => trigger(id)}
            onChange={(e) => {
              field.onChange(e);
              trigger(id);
            }}
            data-testid={dataTestId}
            renderValue={(selected: React.ReactNode) => {
              if (selected === "" || selected == null) {
                return <p style={{ color: "gray" }}>Select an option</p>;
              }
              return selected;
            }}
            displayEmpty
            MenuProps={
              dataTestId
                ? {
                    PaperProps: {
                      'data-testid': `${dataTestId}-menu`,
                    },
                  }
                : undefined
            }
          >
            <MenuItem value="" disabled>
              Select an option
            </MenuItem>
            {options.map((option, index) => (
              <MenuItem
                key={index}
                value={option}
                data-testid={
                  dataTestId ? `${dataTestId}-option-${index}` : undefined
                }
              >
                {option}
              </MenuItem>
            ))}
          </Select>
          <FormHelperText>{errors[id]?.message}</FormHelperText>
        </FormControl>
      )}
    ></Controller>
  );
}

interface TextFieldProps extends Props {
  description?: React.ReactNode;
  pattern?: ValidationRule<RegExp>;
  validate?: any;
  containerSx?: any;
  fieldSx?: any;
  fieldProps?: any;
}

export function BookingFormTextField(props: TextFieldProps) {
  const {
    id,
    label,
    description = null,
    required = true,
    pattern,
    validate = () => true,
    control,
    errors,
    trigger,
    containerSx,
    fieldSx,
    fieldProps,
  } = props;

  return (
    <Controller
      name={id}
      control={control}
      rules={{
        required: required && `${label} is required`,
        validate: (value) => {
          if (!required) return true;
          const isNotEmpty = value?.trim().length > 0;
          const isValid = validate(value);
          return (isNotEmpty && isValid) || `${label} is required`;
        },
        pattern,
      }}
      render={({ field }) => (
        <Box sx={containerSx}>
          <Label htmlFor={id}>{`${label}${required ? "*" : ""}`}</Label>
          {description && <p style={{ fontSize: "0.75rem" }}>{description}</p>}
          <TextField
            {...field}
            variant="outlined"
            error={errors[id] != null}
            helperText={errors[id]?.message}
            onBlur={() => trigger(id)}
            sx={fieldSx ?? { marginBottom: 4 }}
            fullWidth
            {...fieldProps}
          />
        </Box>
      )}
    ></Controller>
  );
}

interface SwitchProps extends Props {
  description?: React.ReactElement;
}

export function BookingFormSwitch(props: SwitchProps) {
  const {
    id,
    label,
    description = null,
    required = true,
    control,
    trigger,
  } = props;

  const desc =
    description &&
    cloneElement(description, {
      style: { fontSize: "0.75rem" },
    });

  return (
    <Controller
      control={control}
      name={id}
      rules={{
        required: required && `${label} is required`,
      }}
      render={({ field }) => (
        <div>
          <Label htmlFor={id}>{`${label}${required ? "*" : ""}`}</Label>
          {desc}
          <FormControlLabel
            label={field.value === "yes" ? "Yes" : "No"}
            control={
              <Switch
                checked={field.value === "yes"}
                onChange={(e) =>
                  field.onChange(e.target.checked ? "yes" : "no")
                }
                onBlur={() => trigger(id)}
              />
            }
          />
        </div>
      )}
    ></Controller>
  );
}

interface CheckboxProps {
  checked: boolean;
  id: string;
  onChange: (x: boolean) => void;
  description: React.ReactNode;
}

export function BookingFormAgreementCheckbox(props: CheckboxProps) {
  const { id, onChange, checked, description } = props;
  return (
    <>
      <div style={{ fontSize: "0.75rem", fontWeight: 500 }}>{description}</div>
      <FormControlLabel
        control={
          <Checkbox
            onChange={(e) => onChange(e.target.checked)}
            {...{ id, checked }}
          />
        }
        label="I agree"
      />
    </>
  );
}
