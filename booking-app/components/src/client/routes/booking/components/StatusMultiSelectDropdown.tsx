import { Checkbox, MenuItem, Select, SxProps, Theme, Box } from '@mui/material';
import React from 'react';
import { BookingStatusLabel } from '../../../../types';
import StatusChip from '../../components/bookingTable/StatusChip';

interface StatusMultiSelectDropdownProps {
    value: BookingStatusLabel[];
    updateValue: (value: BookingStatusLabel[]) => void;
    options: BookingStatusLabel[];
    placeholder: string;
    sx?: SxProps<Theme>;
}

export default function StatusMultiSelectDropdown(props: StatusMultiSelectDropdownProps) {
    const { value, updateValue, options, placeholder, sx } = props;

    return (
        <Select
            multiple
            size="small"
            value={value || []}
            onChange={(e) => updateValue(e.target.value as BookingStatusLabel[])}
            renderValue={(selected) => {
                if (selected.length === 0) {
                    return <span style={{ color: 'gray' }}>{placeholder}</span>;
                }
                return (
                    <Box sx={{ display: 'flex', overflow: 'scroll', scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' }, gap: 0.5 }}>
                        {selected.map((status) => (
                            <StatusChip key={status} status={status} />
                        ))}
                    </Box>
                );
            }}
            sx={sx}
            displayEmpty
            MenuProps={{
                PaperProps: { style: { maxHeight: 300 } },
            }}
        >
            {options.map((status) => (
                <MenuItem key={status} value={status}>
                    <Checkbox checked={value?.includes(status) || false} size="small" />
                    <Box sx={{ ml: 1 }}>
                        <StatusChip status={status} />
                    </Box>
                </MenuItem>
            ))}
        </Select>
    );
}