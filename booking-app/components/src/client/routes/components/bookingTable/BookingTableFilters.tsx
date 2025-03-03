import { BookingStatusLabel, PageContextLevel } from "../../../../types";

import { Box, TextField, InputAdornment, CircularProgress } from "@mui/material";
import { DateRangeFilter } from "./hooks/getDateFilter";
import Dropdown from "../../booking/components/Dropdown";
import FilterList from "@mui/icons-material/FilterList";
import SearchIcon from "@mui/icons-material/Search";
import React, { useCallback, useContext, useEffect, useState } from "react";
import StatusChip from "./StatusChip";
import { DatabaseContext } from "../Provider";
import { debounce } from "../../../utils/debounce";

interface Props {
  allowedStatuses: BookingStatusLabel[];
  pageContext: PageContextLevel;
  selectedStatuses: BookingStatusLabel[];
  setSelectedStatuses: any;
  selectedDateRange: DateRangeFilter;
  setSelectedDateRange: any;
  searchQuery?: string;
  setSearchQuery?: (query: string) => void;
  isSearching?: boolean;
}

export default function BookingTableFilters({
  allowedStatuses,
  pageContext,
  selectedStatuses,
  setSelectedStatuses,
  selectedDateRange,
  setSelectedDateRange,
  searchQuery = "",
  setSearchQuery = () => {},
  isSearching = false,
}: Props) {
  const { setLoadMoreEnabled, setLastItem } = useContext(DatabaseContext);
  const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery);

  // Update local search query when the prop changes
  useEffect(() => {
    setLocalSearchQuery(searchQuery);
  }, [searchQuery]);

  const handleChipClick = (status: BookingStatusLabel) => {
    setSelectedStatuses((prev: BookingStatusLabel[]) => {
      if (prev.includes(status)) {
        return prev.filter((x) => x !== status);
      }
      return [...prev, status];
    });
  };

  // Debounced search handler
  const debouncedSearch = useCallback(
    debounce((value: string) => {
      // Only update if the value is different from the current searchQuery
      if (value !== searchQuery) {
        setSearchQuery(value);
        // Let the Provider handle the fetch through its filters effect
        setLoadMoreEnabled(true);
        setLastItem(null);
      }
    }, 1000), // Increase debounce time to 1 second to prevent rapid fetches
    [setSearchQuery, setLoadMoreEnabled, setLastItem, searchQuery]
  );

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setLocalSearchQuery(value);
    debouncedSearch(value);
  };

  const handleClearSearch = useCallback(() => {
    setLocalSearchQuery('');
    setSearchQuery('');
    setLoadMoreEnabled(true);
    setLastItem(null);
  }, [setSearchQuery, setLoadMoreEnabled, setLastItem]);

  const handleDateRangeFilterClick = useCallback((
    _: React.MouseEvent<HTMLElement>,
    newFilter: DateRangeFilter | null
  ) => {
    if (newFilter != null) {
      setSelectedDateRange(newFilter);
      // Reset search when changing date range
      if (localSearchQuery) {
        handleClearSearch();
      }
      setLoadMoreEnabled(true);
      setLastItem(null);
    }
  }, [localSearchQuery, handleClearSearch, setSelectedDateRange, setLoadMoreEnabled, setLastItem]);

  const dateFilters = (
    <Dropdown
      value={selectedDateRange}
      updateValue={(x) => handleDateRangeFilterClick(null, x)}
      options={["Today", "This Week", "All Future", "Past 24 hours", "Past Week", "Past Month", "Past 6 Months", "Past 9 Months"]}
      placeholder={"Today"}
      sx={{ width: "125px", mr: 1 }}
    />
  );

  const searchBar = (
    <TextField
      size="small"
      placeholder="Search..."
      value={localSearchQuery}
      onChange={handleSearchChange}
      InputProps={{
        startAdornment: (
          <InputAdornment position="start">
            <SearchIcon fontSize="small" />
          </InputAdornment>
        ),
        endAdornment: isSearching && localSearchQuery.trim() !== '' ? (
          <InputAdornment position="end">
            <CircularProgress size={20} />
          </InputAdornment>
        ) : localSearchQuery ? (
          <InputAdornment position="end">
            <Box 
              component="span" 
              sx={{ 
                cursor: 'pointer',
                fontSize: '0.75rem',
                color: 'text.secondary',
                '&:hover': {
                  color: 'text.primary',
                }
              }}
              onClick={handleClearSearch}
            >
              ✕
            </Box>
          </InputAdornment>
        ) : null,
      }}
      sx={{ width: "200px" }}
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
      <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
        {pageContext >= PageContextLevel.PA && searchBar}
        {pageContext >= PageContextLevel.PA && dateFilters}
      </Box>
    </Box>
  );
}
