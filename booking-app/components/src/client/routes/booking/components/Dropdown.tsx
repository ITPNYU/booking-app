import { MenuItem, Select, SxProps, Theme } from "@mui/material";

import React from "react";

interface DropdownProps<T extends React.ReactNode> {
  value: T;
  updateValue: (value: T) => void;
  options: T[];
  placeholder: string;
  sx?: SxProps<Theme>;
}

export default function Dropdown<T extends string>(props: DropdownProps<T>) {
  const { value, updateValue, options, placeholder, sx, ...otherProps } = props;

  return (
    <Select
      size="small"
      value={value != null ? value : ""}
      onChange={(e) => updateValue(e.target.value as T)}
      renderValue={(selected) => {
        if (selected === "") {
          return <p style={{ color: "gray" }}>{placeholder}</p>;
        }
        return selected;
      }}
      sx={sx}
      displayEmpty
      fullWidth
      {...otherProps}
    >
      {options.map((label, index) => (
        <MenuItem key={index} value={label as string}>
          {label}
        </MenuItem>
      ))}
    </Select>
  );
}
