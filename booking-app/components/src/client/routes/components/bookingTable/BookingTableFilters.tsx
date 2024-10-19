import {
  Booking,
  BookingStatusLabel,
  PageContextLevel,
} from "../../../../types";
import { Box, ToggleButton, ToggleButtonGroup } from "@mui/material";
import { CalendarMonth, DateRange, Today } from "@mui/icons-material";

import Dropdown from "../../booking/components/Dropdown";
import FilterList from "@mui/icons-material/FilterList";
import React from "react";
import StatusChip from "./StatusChip";

export type DateRangeFilter = "Today" | "This Week" | "All";

export const DATE_FILTERS: Record<DateRangeFilter, (x: Booking) => boolean> = {
  Today: (row) => {
    const today = new Date();
    const date = row.startDate.toDate();
    return (
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate()
    );
  },
  "This Week": (row) => {
    const today = new Date();
    let dayOfWeek = today.getDay();
    if (dayOfWeek === 0) {
      // sunday as last day of week
      dayOfWeek = 7;
    }

    // Calculate the start of the week (Monday)
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - (dayOfWeek - 1));
    startOfWeek.setHours(0, 0, 0, 0);

    // Calculate the end of the week (Sunday)
    const endOfWeek = new Date(today);
    endOfWeek.setDate(today.getDate() + (7 - dayOfWeek));
    endOfWeek.setHours(23, 59, 59, 999);

    // Check if the given date is within the start and end of the week
    const date = row.startDate.toDate();
    return date >= startOfWeek && date <= endOfWeek;
  },
  All: (row) => true,
};

interface Props {
  allowedStatuses: BookingStatusLabel[];
  pageContext: PageContextLevel;
  selectedStatuses: BookingStatusLabel[];
  setSelectedStatuses: any;
  selectedDateRange: DateRangeFilter;
  setSelectedDateRange: any;
}

export default function BookingTableFilters({
  allowedStatuses,
  pageContext,
  selectedStatuses,
  setSelectedStatuses,
  selectedDateRange,
  setSelectedDateRange,
}: Props) {
  const handleChipClick = (status: BookingStatusLabel) => {
    setSelectedStatuses((prev: BookingStatusLabel[]) => {
      if (prev.includes(status)) {
        return prev.filter((x) => x !== status);
      }
      return [...prev, status];
    });
  };

  const handleDateRangeFilterClick = (
    _: React.MouseEvent<HTMLElement>,
    newFilter: DateRangeFilter | null
  ) => {
    if (newFilter != null) {
      setSelectedDateRange(newFilter);
    }
  };

  const dateFilters = (
    <Dropdown
      value={selectedDateRange}
      updateValue={(x) => handleDateRangeFilterClick(null, x)}
      options={["Today", "This Week", "All"]}
      placeholder={"Today"}
      sx={{ width: "125px", mr: 1 }}
    />
  );

  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        paddingLeft: "16px",
        paddingRight: 1,
      }}
    >
      <Box>
        <FilterList sx={{ marginRight: "14px", color: "rgba(0,0,0,0.8)" }} />
        {allowedStatuses.map((status) =>
          status === BookingStatusLabel.UNKNOWN ? null : (
            <Box
              onClick={() => handleChipClick(status)}
              key={status}
              sx={{
                cursor: "pointer",
                display: "inline-block",
                padding: "0px 8px 0px 4px",
              }}
            >
              <StatusChip
                status={status}
                disabled={!selectedStatuses.includes(status)}
              />
            </Box>
          )
        )}
      </Box>
      <Box>{pageContext >= PageContextLevel.PA && dateFilters}</Box>
    </Box>
  );
}
