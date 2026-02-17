import { BookingStatusLabel, PageContextLevel } from "../../../../types";

import FilterList from "@mui/icons-material/FilterList";
import SearchIcon from "@mui/icons-material/Search";
import {
  Box,
  CircularProgress,
  InputAdornment,
  TextField,
} from "@mui/material";
import {
  TableBar,
  Headset,
  PeopleAlt,
  LocalDining,
  CleaningServices,
  LocalPolice
} from "@mui/icons-material";
import React, { useCallback, useContext, useEffect, useState } from "react";
import { debounce } from "../../../utils/debounce";
import Dropdown from "../../booking/components/Dropdown";
import { DatabaseContext } from "../Provider";
import { DateRangeFilter } from "./hooks/getDateFilter";
import MultiSelectDropdown from "../../booking/components/MultiSelectDropdown";
import StatusMultiSelectDropdown from "../../booking/components/StatusMultiSelectDropdown";
import ServicesMultiSelectDropdown from "../../booking/components/ServicesMultiSelectDropdown";
import StatusChip from "./StatusChip";
import FilterChip from "./FilterChip";
import { createEmitAndSemanticDiagnosticsBuilderProgram } from "typescript";

interface Props {
  allowedStatuses: BookingStatusLabel[];
  pageContext: PageContextLevel;
  selectedStatuses: BookingStatusLabel[];
  setSelectedStatuses: any;
  selectedDateRange: DateRangeFilter;
  setSelectedDateRange: any;
  selectedOrigins?: string[] | null;
  setSelectedOrigins?: (origins: string[] | null | ((prev: string[] | null) => string[] | null)) => void;
  selectedRooms?: string[] | null;
  setSelectedRooms?: (rooms: string[] | null | ((prev: string[] | null) => string[] | null)) => void;
  selectedServices?: string[] | null;
  setSelectedServices?: (services: string[] | null | ((prev: string[] | null) => string[] | null)) => void;
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
  selectedOrigins,
  setSelectedOrigins,
  selectedRooms,
  setSelectedRooms,
  selectedServices,
  setSelectedServices,
}: Props) {
  const { setLoadMoreEnabled, setLastItem, roomSettings } = useContext(DatabaseContext);
  const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery);
  // Update local search query when the prop changes
  useEffect(() => {
    setLocalSearchQuery(searchQuery);
  }, [searchQuery]);

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

  const serviceIcons: Record<string, React.ElementType> = {
    "Setup": TableBar,
    "Equipment": Headset,
    "Staffing": PeopleAlt,
    "Catering": LocalDining,
    "Cleaning": CleaningServices,
    "Security": LocalPolice,
  };

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
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2 }}>
        <FilterList sx={{ marginLeft: "4px", color: "rgba(0,0,0,0.8)", marginTop: "4px" }} />
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
          <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", rowGap: 1.5 }}>
            {["User", "Walk-In", "VIP", "Pregame"].map((origin) =>
            (
              <Box
                onClick={() => setSelectedOrigins?.((prev: string[] | null) => {
                  if (prev?.includes(origin)) {
                    return prev?.filter((o) => o !== origin);
                  }
                  return [...(prev || []), origin];
                })}
                key={origin}
                sx={{
                  cursor: "pointer",
                  display: "inline-block",
                  padding: "0px 8px 0px 4px",
                }}
              >
                <FilterChip
                  selected={selectedOrigins?.includes(origin)}
                  text={origin}
                />
              </Box>
            )
            )}
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", rowGap: 1.5 }}>
            {[BookingStatusLabel.REQUESTED, BookingStatusLabel.PRE_APPROVED, BookingStatusLabel.APPROVED, BookingStatusLabel.CHECKED_IN, BookingStatusLabel.CHECKED_OUT, BookingStatusLabel.DECLINED, BookingStatusLabel.CLOSED, BookingStatusLabel.UNKNOWN].map((status) =>
            (
              <Box
                onClick={() => setSelectedStatuses((prev: BookingStatusLabel[]) => {
                  if (prev.includes(status)) {
                    return prev.filter((x) => x !== status);
                  }
                  return [...prev, status];
                })}
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
          <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", rowGap: 1.5 }}>
            {roomSettings.map((room) => room.roomId.toString()).map((roomId) =>
            (
              <Box
                onClick={() => setSelectedRooms?.((prev: string[] | null) => {
                  if (prev?.includes(roomId)) {
                    return prev?.filter((x) => x !== roomId);
                  }
                  return [...(prev || []), roomId];
                })}
                key={roomId}
                sx={{
                  cursor: "pointer",
                  display: "inline-block",
                  padding: "0px 8px 0px 4px",
                }}
              >
                <FilterChip
                  selected={selectedRooms?.includes(roomId)}
                  text={roomId}
                />
              </Box>
            )
            )}
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", rowGap: 1.5 }}>
            {["Setup", "Equipment", "Staffing", "Catering", "Cleaning", "Security"].map((service) =>
            (
              <Box
                onClick={() => setSelectedServices?.((prev: string[] | null) => {
                  if (prev?.includes(service)) {
                    return prev?.filter((x) => x !== service);
                  }
                  return [...(prev || []), service];
                })}
                key={service}
                sx={{
                  cursor: "pointer",
                  display: "inline-block",
                  padding: "0px 8px 0px 4px",
                }}
              >
                <FilterChip
                  selected={selectedServices?.includes(service)}
                  text={service}
                  icon={serviceIcons[service] as React.ElementType}
                />
              </Box>
            )
            )}
          </Box>
        </Box>
      </Box>
      <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 2 }}>
        {pageContext >= PageContextLevel.PA && dateFilters}
        {pageContext >= PageContextLevel.PA && searchBar}
      </Box>
    </Box>
  );
}
