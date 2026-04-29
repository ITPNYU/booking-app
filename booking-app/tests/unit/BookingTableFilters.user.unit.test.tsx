import BookingTableFilters from "@/components/src/client/routes/components/bookingTable/BookingTableFilters";
import { DatabaseContext } from "@/components/src/client/routes/components/Provider";
import { SchemaContext } from "@/components/src/client/routes/components/SchemaProvider";
import { BookingStatusLabel, PageContextLevel } from "@/components/src/types";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock(
  "@/components/src/client/routes/booking/components/Dropdown",
  () => ({
    default: () => <div data-testid="date-range-dropdown" />,
  }),
);

vi.mock(
  "@/components/src/client/routes/booking/components/MultiSelectDropdown",
  () => ({ default: () => null }),
);
vi.mock(
  "@/components/src/client/routes/booking/components/StatusMultiSelectDropdown",
  () => ({ default: () => null }),
);
vi.mock(
  "@/components/src/client/routes/booking/components/ServicesMultiSelectDropdown",
  () => ({ default: () => null }),
);

const theme = createTheme();

// Schema with all origin/service toggles on so USER-context hiding is meaningful.
const mockSchema = {
  name: "Test",
  resourceName: "Room",
  showSetup: true,
  showEquipment: true,
  showStaffing: true,
  showCatering: true,
  showHireSecurity: true,
  supportWalkIn: true,
  supportVIP: true,
} as any;

const mockDatabaseContext = {
  setLoadMoreEnabled: vi.fn(),
  setLastItem: vi.fn(),
  roomSettings: [{ roomId: "101" }, { roomId: "202" }],
} as any;

const baseProps = {
  allowedStatuses: Object.values(BookingStatusLabel),
  selectedStatuses: [],
  setSelectedStatuses: vi.fn(),
  selectedDateRange: "All Future" as any,
  setSelectedDateRange: vi.fn(),
  selectedOrigins: [],
  setSelectedOrigins: vi.fn(),
  selectedRooms: [],
  setSelectedRooms: vi.fn(),
  selectedServices: [],
  setSelectedServices: vi.fn(),
  searchQuery: "",
  setSearchQuery: vi.fn(),
  isSearching: false,
};

function renderFilters(pageContext: PageContextLevel) {
  return render(
    <ThemeProvider theme={theme}>
      <DatabaseContext.Provider value={mockDatabaseContext}>
        <SchemaContext.Provider value={mockSchema}>
          <BookingTableFilters {...baseProps} pageContext={pageContext} />
        </SchemaContext.Provider>
      </DatabaseContext.Provider>
    </ThemeProvider>,
  );
}

describe("BookingTableFilters – USER context", () => {
  it("shows status filter chips", () => {
    renderFilters(PageContextLevel.USER);
    expect(screen.getByText("Requested")).toBeInTheDocument();
    expect(screen.getByText("Approved")).toBeInTheDocument();
    expect(screen.getByText("Declined")).toBeInTheDocument();
  });

  it("shows room filter chips", () => {
    renderFilters(PageContextLevel.USER);
    expect(screen.getByText("101")).toBeInTheDocument();
    expect(screen.getByText("202")).toBeInTheDocument();
  });

  it("shows the date range dropdown", () => {
    renderFilters(PageContextLevel.USER);
    expect(screen.getByTestId("date-range-dropdown")).toBeInTheDocument();
  });

  it("hides origin filter chips", () => {
    renderFilters(PageContextLevel.USER);
    expect(screen.queryByText("Walk-In")).not.toBeInTheDocument();
    expect(screen.queryByText("VIP")).not.toBeInTheDocument();
    expect(screen.queryByText("Pregame")).not.toBeInTheDocument();
  });

  it("hides service filter chips", () => {
    renderFilters(PageContextLevel.USER);
    expect(screen.queryByText("Setup")).not.toBeInTheDocument();
    expect(screen.queryByText("Cleaning")).not.toBeInTheDocument();
    expect(screen.queryByText("Security")).not.toBeInTheDocument();
  });

  it("hides the search bar", () => {
    renderFilters(PageContextLevel.USER);
    expect(screen.queryByPlaceholderText("Search...")).not.toBeInTheDocument();
  });
});

describe("BookingTableFilters – ADMIN context (contrast)", () => {
  it("shows origin filter chips", () => {
    renderFilters(PageContextLevel.ADMIN);
    expect(screen.getByText("Walk-In")).toBeInTheDocument();
    expect(screen.getByText("VIP")).toBeInTheDocument();
    expect(screen.getByText("Pregame")).toBeInTheDocument();
  });

  it("shows service filter chips", () => {
    renderFilters(PageContextLevel.ADMIN);
    expect(screen.getByText("Setup")).toBeInTheDocument();
    expect(screen.getByText("Cleaning")).toBeInTheDocument();
    expect(screen.getByText("Security")).toBeInTheDocument();
  });

  it("shows the search bar", () => {
    renderFilters(PageContextLevel.ADMIN);
    expect(screen.getByPlaceholderText("Search...")).toBeInTheDocument();
  });

  it("shows status and room chips", () => {
    renderFilters(PageContextLevel.ADMIN);
    expect(screen.getByText("Requested")).toBeInTheDocument();
    expect(screen.getByText("101")).toBeInTheDocument();
  });
});
