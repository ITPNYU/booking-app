import { BookingStatusLabel, PageContextLevel } from "../../../../types";

import { Box } from "@mui/material";
import { DateRangeFilter } from "./hooks/getDateFilter";
import Dropdown from "../../booking/components/Dropdown";
import FilterList from "@mui/icons-material/FilterList";
import React, { useContext } from "react";
import StatusChip from "./StatusChip";
import { DatabaseContext } from "../Provider";

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
  const { setLoadMoreEnabled, setLastItem } = useContext(DatabaseContext);
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
      setLoadMoreEnabled(true);
      setLastItem(null);
    }
  };

  const dateFilters = (
    <Dropdown
      value={selectedDateRange}
      updateValue={(x) => handleDateRangeFilterClick(null, x)}
      options={["Today", "This Week", "All Future", "Past 24 hours", "Past Week", "Past Month", "Past 6 Months", "Past 9 Months"]}
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
      <Box>{pageContext >= PageContextLevel.LIAISON && dateFilters}</Box>
    </Box>
  );
}
