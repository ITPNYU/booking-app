import { Checkbox, MenuItem, Select, SxProps, Theme, Box } from '@mui/material';
import {
    TableBar,
    Headset,
    PeopleAlt,
    LocalDining,
    CleaningServices,
    LocalPolice
} from "@mui/icons-material";
import React from 'react';

// Map services to their icons
const serviceIcons: Record<string, React.ElementType> = {
    "Setup": TableBar,
    "Equipment": Headset,
    "Staffing": PeopleAlt,
    "Catering": LocalDining,
    "Cleaning": CleaningServices,
    "Security": LocalPolice,
};

const SERVICE_ORDER = ["Setup", "Equipment", "Staffing", "Catering", "Cleaning", "Security"];

interface ServicesMultiSelectDropdownProps {
    value: string[] | null;
    updateValue: (value: string[]) => void;
    options: string[];
    placeholder: string;
    sx?: SxProps<Theme>;
}

export default function ServicesMultiSelectDropdown(props: ServicesMultiSelectDropdownProps) {
    const { value, updateValue, options, placeholder, sx } = props;

    return (
        <Select
            multiple
            size="small"
            value={value || []}
            onChange={(e) => updateValue(e.target.value as string[])}
            renderValue={(selected) => {
                if (selected.length === 0) {
                    return <span style={{ color: 'gray' }}>{placeholder}</span>;
                }

                // Sort selected items by predefined order
                const sortedSelected = [...selected].sort(
                    (a, b) => SERVICE_ORDER.indexOf(a) - SERVICE_ORDER.indexOf(b)
                );

                return (
                    <Box sx={{ display: 'flex', alignItems: 'center', height: '24px', overflow: 'scroll', scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' }, gap: 0.5 }}>
                        {sortedSelected.map((service) => {
                            const Icon = serviceIcons[service];
                            return Icon ? (
                                <Icon key={service} sx={{ fontSize: 18, color: 'rgba(0,0,0,0.7)' }} />
                            ) : null;
                        })}
                    </Box>
                );
            }}
            sx={sx}
            displayEmpty
            MenuProps={{
                PaperProps: { style: { maxHeight: 300 } },
            }}
        >
            {options.map((service) => {
                const Icon = serviceIcons[service];
                return (
                    <MenuItem key={service} value={service}>
                        <Checkbox checked={value?.includes(service) || false} size="small" />
                        {Icon && <Icon sx={{ fontSize: 18, color: 'rgba(0,0,0,0.7)', ml: 1, mr: 1 }} />}
                        {service}
                    </MenuItem>
                );
            })}
        </Select>
    );
}