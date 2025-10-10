import { MenuItem, Select, SxProps, Theme } from '@mui/material';

import React from 'react';

interface DropdownProps<T extends React.ReactNode> {
  value: T;
  updateValue: (value: T) => void;
  options: T[];
  placeholder: string;
  sx?: SxProps<Theme>;
  dataTestId?: string;
}

export default function Dropdown<T extends string>(props: DropdownProps<T>) {
  const { value, updateValue, options, placeholder, sx, dataTestId } = props;

  return (
    <Select
      size="small"
      value={value != null ? value : ''}
      onChange={(e) => updateValue(e.target.value as T)}
      data-testid={dataTestId}
      renderValue={(selected) => {
        if (selected === '') {
          return <p style={{ color: 'gray' }}>{placeholder}</p>;
        }
        return selected;
      }}
      sx={sx}
      displayEmpty
      fullWidth
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
      {options.map((label, index) => (
        <MenuItem
          key={index}
          value={label as string}
          data-testid={
            dataTestId ? `${dataTestId}-option-${index}` : undefined
          }
        >
          {label}
        </MenuItem>
      ))}
    </Select>
  );
}
