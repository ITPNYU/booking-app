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
import { render } from "@testing-library/react";
import { Timestamp } from "firebase/firestore";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
] as BookingRow[];

const captureUseBookingFiltersArgs = vi.hoisted(() => ({ current: null as any }));

vi.mock("@mui/x-data-grid", () => ({
  DataGrid: vi.fn((props: any) => (
    <div data-testid="mock-datagrid">Mock DataGrid</div>
  )),
}));

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
    useBookingFilters: (args: any) => {
      captureUseBookingFiltersArgs.current = args;
      return mockBookingRows;
    },
  })
);

const theme = createTheme();

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

function renderBookings(pageContext: PageContextLevel) {
  return render(
    <ThemeProvider theme={theme}>
      <DatabaseContext.Provider value={mockDatabaseContext as any}>
        <SchemaContext.Provider value={mockSchemaContext}>
          <Bookings pageContext={pageContext} />
        </SchemaContext.Provider>
      </DatabaseContext.Provider>
    </ThemeProvider>
  );
}

describe("Bookings - Date range default by role", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    captureUseBookingFiltersArgs.current = null;
  });

  it("defaults date range to Today for PA role", () => {
    renderBookings(PageContextLevel.PA);

    expect(captureUseBookingFiltersArgs.current).not.toBeNull();
    expect(captureUseBookingFiltersArgs.current.selectedDateRange).toBe("Today");
  });

  it("defaults date range to All Future for Admin role", () => {
    renderBookings(PageContextLevel.ADMIN);

    expect(captureUseBookingFiltersArgs.current).not.toBeNull();
    expect(captureUseBookingFiltersArgs.current.selectedDateRange).toBe(
      "All Future"
    );
  });

  it("defaults date range to Today for USER role", () => {
    renderBookings(PageContextLevel.USER);

    expect(captureUseBookingFiltersArgs.current).not.toBeNull();
    expect(captureUseBookingFiltersArgs.current.selectedDateRange).toBe(
      "Today"
    );
  });

  it("defaults date range to Today for LIAISON role", () => {
    renderBookings(PageContextLevel.LIAISON);

    expect(captureUseBookingFiltersArgs.current).not.toBeNull();
    expect(captureUseBookingFiltersArgs.current.selectedDateRange).toBe(
      "Today"
    );
  });
});
