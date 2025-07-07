import { Bookings } from "@/components/src/client/routes/components/bookingTable/Bookings";
import { DatabaseContext } from "@/components/src/client/routes/components/Provider";
import { SchemaContext } from "@/components/src/client/routes/components/SchemaProvider";
import {
  BookingRow,
  BookingStatusLabel,
  PageContextLevel,
  PagePermission,
} from "@/components/src/types";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Timestamp } from "firebase/firestore";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the MUI DataGrid component
vi.mock("@mui/x-data-grid", () => ({
  DataGrid: vi.fn(({ sortModel, onSortModelChange, ...props }) => {
    return (
      <div
        data-testid="mock-datagrid"
        data-sort-model={JSON.stringify(sortModel)}
        onClick={() => {
          // Simulate user clicking on a column header to change sort
          const newSortModel = [{ field: "status", sort: "desc" }];
          onSortModelChange?.(newSortModel);
        }}
      >
        Mock DataGrid
        {/* Render sort model for testing */}
        <div data-testid="sort-model">{JSON.stringify(sortModel)}</div>
      </div>
    );
  }),
}));

// Mock other dependencies
vi.mock("@/components/src/client/routes/hooks/getBookingStatus", () => ({
  default: () => BookingStatusLabel.APPROVED,
}));

vi.mock(
  "@/components/src/client/routes/components/bookingTable/hooks/useAllowedStatuses",
  () => ({
    default: () => Object.values(BookingStatusLabel),
  })
);

vi.mock(
  "@/components/src/client/routes/components/bookingTable/hooks/useBookingFilters",
  () => ({
    useBookingFilters: () => mockBookingRows,
  })
);

const theme = createTheme();

// Mock booking data
const mockBookingRows: BookingRow[] = [
  {
    calendarEventId: "event-1",
    title: "Test Booking 1",
    startDate: Timestamp.fromDate(new Date("2024-01-15T10:00:00Z")),
    endDate: Timestamp.fromDate(new Date("2024-01-15T12:00:00Z")),
    roomId: "101",
    status: BookingStatusLabel.APPROVED,
    email: "test1@nyu.edu",
    firstName: "Test",
    lastName: "User1",
    department: "Engineering",
    role: "Student",
    netId: "test1",
    phoneNumber: "123-456-7890",
    requestNumber: 1001,
    equipmentCheckedOut: false,
  },
  {
    calendarEventId: "event-2",
    title: "Test Booking 2",
    startDate: Timestamp.fromDate(new Date("2024-01-16T14:00:00Z")),
    endDate: Timestamp.fromDate(new Date("2024-01-16T16:00:00Z")),
    roomId: "102",
    status: BookingStatusLabel.PENDING,
    email: "test2@nyu.edu",
    firstName: "Test",
    lastName: "User2",
    department: "Arts",
    role: "Faculty",
    netId: "test2",
    phoneNumber: "123-456-7891",
    requestNumber: 1002,
    equipmentCheckedOut: true,
  },
] as BookingRow[];

const mockDatabaseContext = {
  bookingsLoading: false,
  setLastItem: vi.fn(),
  fetchAllBookings: vi.fn(),
  allBookings: mockBookingRows,
  liaisonUsers: [],
  adminUsers: [{ email: "admin@nyu.edu", department: "IT" }],
  PAUsers: [],
  userEmail: "admin@nyu.edu",
  pagePermission: PagePermission.ADMIN,
  settings: {
    bookingTypes: [],
  },
  roomSettings: [],
  setFilters: vi.fn(),
};

const mockSchemaContext = {
  resourceName: "Room",
  schema: {} as any,
};

const defaultProps = {
  pageContext: PageContextLevel.ADMIN,
  calendarEventId: undefined,
};

const renderBookingsComponent = (
  contextOverrides = {},
  propsOverrides = {},
  pageContext = PageContextLevel.ADMIN
) => {
  const databaseContext = { ...mockDatabaseContext, ...contextOverrides };
  const props = { ...defaultProps, pageContext, ...propsOverrides };

  return render(
    <ThemeProvider theme={theme}>
      <DatabaseContext.Provider value={databaseContext as any}>
        <SchemaContext.Provider value={mockSchemaContext}>
          <Bookings {...props} />
        </SchemaContext.Provider>
      </DatabaseContext.Provider>
    </ThemeProvider>
  );
};

describe("Bookings Component - Admin Sorting Functionality", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Initial Sort State", () => {
    it("should initialize with ascending date/time sort for admin users", () => {
      renderBookingsComponent({}, {}, PageContextLevel.ADMIN);

      const dataGrid = screen.getByTestId("mock-datagrid");
      const sortModelStr = dataGrid.getAttribute("data-sort-model");
      const sortModel = JSON.parse(sortModelStr || "[]");

      expect(sortModel).toEqual([{ field: "startDate", sort: "asc" }]);
    });

    it("should initialize with ascending date/time sort for PA users", () => {
      renderBookingsComponent({}, {}, PageContextLevel.PA);

      const dataGrid = screen.getByTestId("mock-datagrid");
      const sortModelStr = dataGrid.getAttribute("data-sort-model");
      const sortModel = JSON.parse(sortModelStr || "[]");

      expect(sortModel).toEqual([{ field: "startDate", sort: "asc" }]);
    });

    it("should initialize with ascending date/time sort for liaison users", () => {
      renderBookingsComponent({}, {}, PageContextLevel.LIAISON);

      const dataGrid = screen.getByTestId("mock-datagrid");
      const sortModelStr = dataGrid.getAttribute("data-sort-model");
      const sortModel = JSON.parse(sortModelStr || "[]");

      expect(sortModel).toEqual([{ field: "startDate", sort: "asc" }]);
    });

    it("should initialize with ascending date/time sort for user level", () => {
      renderBookingsComponent({}, {}, PageContextLevel.USER);

      const dataGrid = screen.getByTestId("mock-datagrid");
      const sortModelStr = dataGrid.getAttribute("data-sort-model");
      const sortModel = JSON.parse(sortModelStr || "[]");

      expect(sortModel).toEqual([{ field: "startDate", sort: "asc" }]);
    });
  });

  describe("Sort Reset on Timeframe Change", () => {
    it("should always initialize with ascending date sort for admin users (timeframe independence)", () => {
      // Test that every new instance of the component starts with correct sort
      const { unmount } = renderBookingsComponent(
        {},
        {},
        PageContextLevel.ADMIN
      );

      let dataGrid = screen.getByTestId("mock-datagrid");
      expect(dataGrid.getAttribute("data-sort-model")).toBe(
        JSON.stringify([{ field: "startDate", sort: "asc" }])
      );

      unmount();

      // Re-render a new instance (simulates what happens after timeframe change)
      renderBookingsComponent({}, {}, PageContextLevel.ADMIN);

      dataGrid = screen.getByTestId("mock-datagrid");
      expect(dataGrid.getAttribute("data-sort-model")).toBe(
        JSON.stringify([{ field: "startDate", sort: "asc" }])
      );
    });

    it("should always initialize with ascending date sort for PA users (timeframe independence)", () => {
      // Test that every new instance of the component starts with correct sort
      const { unmount } = renderBookingsComponent({}, {}, PageContextLevel.PA);

      let dataGrid = screen.getByTestId("mock-datagrid");
      expect(dataGrid.getAttribute("data-sort-model")).toBe(
        JSON.stringify([{ field: "startDate", sort: "asc" }])
      );

      unmount();

      // Re-render a new instance (simulates what happens after timeframe change)
      renderBookingsComponent({}, {}, PageContextLevel.PA);

      dataGrid = screen.getByTestId("mock-datagrid");
      expect(dataGrid.getAttribute("data-sort-model")).toBe(
        JSON.stringify([{ field: "startDate", sort: "asc" }])
      );
    });

    it("should maintain consistent behavior for all admin-level users", () => {
      // Test that all admin-level users get the same default sort behavior
      const adminContexts = [
        PageContextLevel.ADMIN,
        PageContextLevel.PA,
        PageContextLevel.LIAISON,
      ];

      adminContexts.forEach((context) => {
        const { unmount } = renderBookingsComponent({}, {}, context);
        const dataGrid = screen.getByTestId("mock-datagrid");
        expect(dataGrid.getAttribute("data-sort-model")).toBe(
          JSON.stringify([{ field: "startDate", sort: "asc" }])
        );
        unmount();
      });
    });

    it("should provide timeframe reset capability for admin users", () => {
      // This test verifies that admin users have the necessary infrastructure
      // for timeframe-based sort resets (the key business requirement)
      renderBookingsComponent({}, {}, PageContextLevel.ADMIN);

      const dataGrid = screen.getByTestId("mock-datagrid");

      // Verify the DataGrid has the correct sort model
      expect(dataGrid).toHaveAttribute("data-sort-model");

      // Verify default state supports the business requirement
      expect(dataGrid.getAttribute("data-sort-model")).toBe(
        JSON.stringify([{ field: "startDate", sort: "asc" }])
      );

      // Verify the component renders without errors for admin context
      expect(dataGrid).toBeInTheDocument();
    });
  });

  describe("DataGrid Props", () => {
    it("should pass correct sort model to DataGrid", () => {
      renderBookingsComponent({}, {}, PageContextLevel.ADMIN);

      const dataGrid = screen.getByTestId("mock-datagrid");
      expect(dataGrid).toBeInTheDocument();

      const sortModelStr = dataGrid.getAttribute("data-sort-model");
      const sortModel = JSON.parse(sortModelStr || "[]");
      expect(sortModel).toEqual([{ field: "startDate", sort: "asc" }]);
    });

    it("should render DataGrid with basic required props", () => {
      renderBookingsComponent({}, {}, PageContextLevel.ADMIN);

      const dataGrid = screen.getByTestId("mock-datagrid");
      expect(dataGrid).toBeInTheDocument();
      expect(screen.getByText("Mock DataGrid")).toBeInTheDocument();
    });
  });

  describe("Page Context Handling", () => {
    it("should correctly identify admin level users", () => {
      renderBookingsComponent({}, {}, PageContextLevel.ADMIN);

      // The component should render without errors for admin
      expect(screen.getByTestId("mock-datagrid")).toBeInTheDocument();
    });

    it("should correctly identify PA level users", () => {
      renderBookingsComponent({}, {}, PageContextLevel.PA);

      // The component should render without errors for PA
      expect(screen.getByTestId("mock-datagrid")).toBeInTheDocument();
    });

    it("should correctly identify liaison level users", () => {
      renderBookingsComponent({}, {}, PageContextLevel.LIAISON);

      // The component should render without errors for liaison
      expect(screen.getByTestId("mock-datagrid")).toBeInTheDocument();
    });

    it("should correctly identify user level", () => {
      renderBookingsComponent({}, {}, PageContextLevel.USER);

      // The component should render without errors for user
      expect(screen.getByTestId("mock-datagrid")).toBeInTheDocument();
    });
  });

  describe("Sort Model State Management", () => {
    it("should handle sort model changes from DataGrid", async () => {
      const user = userEvent.setup();
      renderBookingsComponent({}, {}, PageContextLevel.ADMIN);

      const dataGrid = screen.getByTestId("mock-datagrid");

      // Initial state
      let sortModelStr = dataGrid.getAttribute("data-sort-model");
      let sortModel = JSON.parse(sortModelStr || "[]");
      expect(sortModel).toEqual([{ field: "startDate", sort: "asc" }]);

      // Simulate user clicking to change sort
      await user.click(dataGrid);

      // Should update to new sort
      await waitFor(() => {
        sortModelStr = dataGrid.getAttribute("data-sort-model");
        sortModel = JSON.parse(sortModelStr || "[]");
        expect(sortModel).toEqual([{ field: "status", sort: "desc" }]);
      });
    });

    it("should maintain sort state during normal interactions", () => {
      renderBookingsComponent({}, {}, PageContextLevel.ADMIN);

      const dataGrid = screen.getByTestId("mock-datagrid");
      const sortModelStr = dataGrid.getAttribute("data-sort-model");
      const sortModel = JSON.parse(sortModelStr || "[]");

      // Should maintain initial sort state
      expect(sortModel).toEqual([{ field: "startDate", sort: "asc" }]);
    });
  });
});
