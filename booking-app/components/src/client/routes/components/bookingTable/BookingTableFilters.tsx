import { BookingStatusLabel, PageContextLevel } from "../../../../types";

import FilterList from "@mui/icons-material/FilterList";
import SearchIcon from "@mui/icons-material/Search";
import {
  Box,
  CircularProgress,
  InputAdornment,
  TextField,
} from "@mui/material";
import React, { useCallback, useContext, useEffect, useState } from "react";
import { debounce } from "../../../utils/debounce";
import Dropdown from "../../booking/components/Dropdown";
import { DatabaseContext } from "../Provider";
import { DateRangeFilter } from "./hooks/getDateFilter";
import MultiSelectDropdown from "../../booking/components/MultiSelectDropdown";
import StatusMultiSelectDropdown from "../../booking/components/StatusMultiSelectDropdown";
import ServicesMultiSelectDropdown from "../../booking/components/ServicesMultiSelectDropdown";

interface Props {
  allowedStatuses: BookingStatusLabel[];
  pageContext: PageContextLevel;
  selectedStatuses: BookingStatusLabel[];
  setSelectedStatuses: any;
  selectedDateRange: DateRangeFilter;
  setSelectedDateRange: any;
  selectedOrigin?: string | null;
  setSelectedOrigin?: (origin: string | null) => void;
  selectedRooms?: string[] | null;
  setSelectedRooms?: (rooms: string[] | null) => void;
  selectedServices?: string[] | null;
  setSelectedServices?: (services: string[] | null) => void;
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
  setSearchQuery = () => { },
  isSearching = false,
  selectedOrigin,
  setSelectedOrigin,
  selectedRooms,
  setSelectedRooms,
  selectedServices,
  setSelectedServices,
}: Props) {
  const { setLoadMoreEnabled, setLastItem } = useContext(DatabaseContext);
  const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery);

  // Get room settings from the database context
  const { roomSettings } = useContext(DatabaseContext);

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
    setLocalSearchQuery("");
    setSearchQuery("");
    setLoadMoreEnabled(true);
    setLastItem(null);
  }, [setSearchQuery, setLoadMoreEnabled, setLastItem]);

  const handleDateRangeFilterClick = useCallback(
    (_: React.MouseEvent<HTMLElement>, newFilter: DateRangeFilter | null) => {
      if (newFilter != null) {
        setSelectedDateRange(newFilter);
        // Reset search when changing date range
        if (localSearchQuery) {
          handleClearSearch();
        }
        setLoadMoreEnabled(true);
        setLastItem(null);
      }
    },
    [
      localSearchQuery,
      handleClearSearch,
      setSelectedDateRange,
      setLoadMoreEnabled,
      setLastItem,
    ]
  );

  const dateFilters = (
    <Dropdown
      value={selectedDateRange}
      updateValue={(x) => handleDateRangeFilterClick(null, x)}
      options={[
        "Today",
        "This Week",
        "All Future",
        "Past 24 hours",
        "Past Week",
        "Past Month",
        "Past 6 Months",
        "Past 9 Months",
      ]}
      placeholder={"Today"}
      sx={{ width: "120px" }}
    />
  );

  // Added filters for origin
  const originFilters = (
    <Dropdown
      value={selectedOrigin}
      updateValue={(x) => setSelectedOrigin?.(x)}
      options={["All", "User", "Admin", "Walk-In", "VIP", "System", "Pregame"]}
      placeholder="Origin"
      sx={{ width: "120px" }}
    />
  );

  // Updated filters for status
  const statusFilters = (
    <StatusMultiSelectDropdown
      value={selectedStatuses}
      updateValue={(x) => setSelectedStatuses(x)}
      options={allowedStatuses.filter(s => s !== BookingStatusLabel.UNKNOWN)}
      placeholder="Status"
      sx={{ width: "180px" }}  // Wider to fit chips
    />
  );

  // Added filters for rooms
  const roomFilters = (
    <MultiSelectDropdown
      value={selectedRooms}
      updateValue={(x) => setSelectedRooms(x)}
      options={roomSettings.map((room) => room.roomId.toString())}
      placeholder="Rooms"
      sx={{ width: "120px" }}
    />
  );

  // Added filters for services
  const serviceFilters = (
    <ServicesMultiSelectDropdown
      value={selectedServices}
      updateValue={(x) => setSelectedServices(x)}
      options={["Setup", "Equipment", "Staffing", "Catering", "Cleaning", "Security"]}
      placeholder="Services"
      sx={{ width: "120px" }}
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
        endAdornment:
          isSearching && localSearchQuery.trim() !== "" ? (
            <InputAdornment position="end">
              <CircularProgress size={20} />
            </InputAdornment>
          ) : localSearchQuery ? (
            <InputAdornment position="end">
              <Box
                component="span"
                sx={{
                  cursor: "pointer",
                  fontSize: "0.75rem",
                  color: "text.secondary",
                  "&:hover": {
                    color: "text.primary",
                  },
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
      data-testid="filters-section"
      sx={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        flexWrap: "wrap",
        padding: "0px 12px",
        gap: 2,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 2 }}>
        <FilterList sx={{ marginLeft: "4px", color: "rgba(0,0,0,0.8)" }} />
        {pageContext >= PageContextLevel.PA && originFilters}
        {pageContext >= PageContextLevel.PA && statusFilters}
        {pageContext >= PageContextLevel.PA && dateFilters}
        {pageContext >= PageContextLevel.PA && roomFilters}
        {pageContext >= PageContextLevel.PA && serviceFilters}
      </Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
        {pageContext >= PageContextLevel.PA && searchBar}
      </Box>
    </Box>
  );
}
