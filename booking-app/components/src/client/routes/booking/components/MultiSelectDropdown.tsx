import { Checkbox, MenuItem, Select, SxProps, Theme } from '@mui/material';
import React from 'react';

interface MultiSelectDropdownProps {
    value: string[] | null;
    updateValue: (value: string[]) => void;
    options: string[];
    placeholder: string;
    sx?: SxProps<Theme>;
    dataTestId?: string;
}

export default function MultiSelectDropdown(props: MultiSelectDropdownProps) {
    const { value, updateValue, options, placeholder, sx, dataTestId } = props;

    const handleChange = (event: any) => {
        updateValue(event.target.value as string[]);
    };

    return (
        <Select
            multiple
            size="small"
            value={value || []}
            onChange={handleChange}
            data-testid={dataTestId}
            renderValue={(selected) => {
                if (selected.length === 0) {
                    return <span style={{ color: 'gray' }}>{placeholder}</span>;
                }
                return selected.join(', ');
            }}
            sx={sx}
            displayEmpty
            MenuProps={{
                PaperProps: {
                    style: { maxHeight: 300 },
                    ...(dataTestId && { 'data-testid': `${dataTestId}-menu` }),
                },
            }}
        >
            {options.map((label, index) => (
                <MenuItem key={index} value={label}>
                    <Checkbox checked={value?.includes(label) || false} size="small" />
                    {label}
                </MenuItem>
            ))}
        </Select>
    );
}