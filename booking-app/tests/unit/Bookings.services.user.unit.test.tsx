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

// Capture columns passed to DataGrid so we can assert on them.
const capturedColumns = vi.hoisted(() => ({ current: null as any }));

vi.mock("@mui/x-data-grid", () => ({
  DataGrid: vi.fn((props: any) => {
    capturedColumns.current = props.columns;
    return <div data-testid="mock-datagrid" />;
  }),
}));

vi.mock("@/components/src/client/routes/hooks/getBookingStatus", () => ({
  default: () => BookingStatusLabel.APPROVED,
}));

vi.mock(
  "@/components/src/client/routes/components/bookingTable/hooks/useAllowedStatuses",
  () => ({
    default: () => Object.values(BookingStatusLabel),
  }),
);

vi.mock(
  "@/components/src/client/routes/components/bookingTable/hooks/useBookingFilters",
  () => ({
    useBookingFilters: () => mockBookingRows,
  }),
);

const theme = createTheme();

const mockBookingRows: BookingRow[] = [
  {
    calendarEventId: "event-1",
    title: "Test Booking",
    startDate: Timestamp.fromDate(new Date("2099-01-15T10:00:00Z")),
    endDate: Timestamp.fromDate(new Date("2099-01-15T12:00:00Z")),
    roomId: "101",
    status: BookingStatusLabel.APPROVED,
    email: "user@nyu.edu",
    firstName: "Test",
    lastName: "User",
    department: "Engineering",
    role: "Student",
    netId: "tu1",
    phoneNumber: "123-456-7890",
    requestNumber: 1001,
    equipmentCheckedOut: false,
  },
] as BookingRow[];

const mockDatabaseContext = {
  bookingsLoading: false,
  setLastItem: vi.fn(),
  fetchAllBookings: vi.fn(),
  allBookings: mockBookingRows,
  liaisonUsers: [],
  adminUsers: [],
  PAUsers: [],
  userEmail: "user@nyu.edu",
  pagePermission: PagePermission.BOOKING,
  settings: { bookingTypes: [] },
  roomSettings: [],
  setFilters: vi.fn(),
  setLoadMoreEnabled: vi.fn(),
} as any;

function buildSchema(overrides: Record<string, boolean> = {}) {
  return {
    resourceName: "Room",
    showSetup: false,
    showEquipment: false,
    showStaffing: false,
    showCatering: false,
    showHireSecurity: false,
    ...overrides,
  } as any;
}

function renderBookings(pageContext: PageContextLevel, schema: any) {
  return render(
    <ThemeProvider theme={theme}>
      <DatabaseContext.Provider value={mockDatabaseContext}>
        <SchemaContext.Provider value={schema}>
          <Bookings pageContext={pageContext} />
        </SchemaContext.Provider>
      </DatabaseContext.Provider>
    </ThemeProvider>,
  );
}

function getColumnFields(): string[] {
  return (capturedColumns.current ?? []).map((c: any) => c.field);
}

describe("Bookings – services column visibility for USER", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedColumns.current = null;
  });

  it("shows services and equipment columns for USER when tenant has services", () => {
    renderBookings(
      PageContextLevel.USER,
      buildSchema({ showSetup: true }),
    );
    const fields = getColumnFields();
    expect(fields).toContain("services");
    expect(fields).toContain("equip");
  });

  it("hides services and equipment columns for USER when tenant has no services", () => {
    renderBookings(PageContextLevel.USER, buildSchema());
    const fields = getColumnFields();
    expect(fields).not.toContain("services");
    expect(fields).not.toContain("equip");
  });

  it("shows services and equipment columns for ADMIN when tenant has services", () => {
    renderBookings(
      PageContextLevel.ADMIN,
      buildSchema({ showSetup: true }),
    );
    const fields = getColumnFields();
    expect(fields).toContain("services");
    expect(fields).toContain("equip");
  });

  it("hides services and equipment columns for ADMIN when tenant has no services", () => {
    renderBookings(PageContextLevel.ADMIN, buildSchema());
    const fields = getColumnFields();
    expect(fields).not.toContain("services");
    expect(fields).not.toContain("equip");
  });
});
