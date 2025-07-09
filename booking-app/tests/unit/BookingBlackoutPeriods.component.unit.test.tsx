import BookingBlackoutPeriods from "@/components/src/client/routes/admin/components/policySettings/BookingBlackoutPeriods";
import { DatabaseContext } from "@/components/src/client/routes/components/Provider";
import {
  EVENT_ROOMS,
  MULTI_ROOMS,
  PRODUCTION_ROOMS,
} from "@/components/src/mediaCommonsPolicy";
import { LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";

// Mock Firebase functions
vi.mock("@/lib/firebase/firebase", () => ({
  clientFetchAllDataFromCollection: vi.fn(),
  clientSaveDataToFirestore: vi.fn(),
  clientUpdateDataInFirestore: vi.fn(),
  clientDeleteDataFromFirestore: vi.fn(),
}));

// Mock the policy constants import
vi.mock("@/components/src/policy", () => ({
  TableNames: {
    BLACKOUT_PERIODS: "blackout_periods",
  },
}));

const mockRoomSettings = [
  { roomId: 103, name: "Room 103", capacity: 20, calendarId: "cal-103" },
  { roomId: 202, name: "Room 202", capacity: 15, calendarId: "cal-202" },
  { roomId: 203, name: "Room 203", capacity: 25, calendarId: "cal-203" },
  { roomId: 220, name: "Room 220", capacity: 30, calendarId: "cal-220" },
  { roomId: 221, name: "Room 221", capacity: 40, calendarId: "cal-221" },
  { roomId: 222, name: "Room 222", capacity: 40, calendarId: "cal-222" },
  { roomId: 223, name: "Room 223", capacity: 50, calendarId: "cal-223" },
  { roomId: 224, name: "Room 224", capacity: 50, calendarId: "cal-224" },
  { roomId: 230, name: "Room 230", capacity: 35, calendarId: "cal-230" },
  { roomId: 233, name: "Room 233", capacity: 60, calendarId: "cal-233" },
  { roomId: 260, name: "Room 260", capacity: 45, calendarId: "cal-260" },
  { roomId: 1201, name: "Room 1201", capacity: 100, calendarId: "cal-1201" },
];

const mockDatabaseContext = {
  roomSettings: mockRoomSettings,
  blackoutPeriods: [],
  adminUsers: [],
  bannedUsers: [],
  allBookings: [],
  bookingsLoading: false,
  liaisonUsers: [],
  equipmentUsers: [],
  departmentNames: [],
  operationHours: [],
  pagePermission: { hasAnyRole: true },
  paUsers: [],
  superAdminUsers: [],
  policySettings: { finalApproverEmail: "" },
  safetyTrainedUsers: [],
  settings: { bookingTypes: [] },
  userEmail: "test@nyu.edu",
  netId: "test",
  userApiData: undefined,
  loadMoreEnabled: false,
  reloadAdminUsers: vi.fn(),
  reloadApproverUsers: vi.fn(),
  reloadBannedUsers: vi.fn(),
  reloadBlackoutPeriods: vi.fn(),
  reloadFutureBookings: vi.fn(),
  reloadDepartmentNames: vi.fn(),
  reloadOperationHours: vi.fn(),
  reloadPaUsers: vi.fn(),
  reloadBookingTypes: vi.fn(),
  reloadSafetyTrainedUsers: vi.fn(),
  reloadPolicySettings: vi.fn(),
  setUserEmail: vi.fn(),
  fetchAllBookings: vi.fn(),
  setFilters: vi.fn(),
  setLoadMoreEnabled: vi.fn(),
  setLastItem: vi.fn(),
  preBanLogs: [],
  reloadPreBanLogs: vi.fn(),
  reloadSuperAdminUsers: vi.fn(),
};

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <LocalizationProvider dateAdapter={AdapterDayjs}>
    <DatabaseContext.Provider value={mockDatabaseContext}>
      {children}
    </DatabaseContext.Provider>
  </LocalizationProvider>
);

describe("BookingBlackoutPeriods Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the component with correct title", () => {
    render(
      <TestWrapper>
        <BookingBlackoutPeriods />
      </TestWrapper>
    );

    expect(screen.getByText("Booking Blackout Periods")).toBeInTheDocument();
    expect(screen.getByText("Add Period")).toBeInTheDocument();
  });

  it("opens dialog when Add Period is clicked", async () => {
    render(
      <TestWrapper>
        <BookingBlackoutPeriods />
      </TestWrapper>
    );

    fireEvent.click(screen.getByText("Add Period"));

    await waitFor(() => {
      expect(screen.getByText("Add Blackout Period")).toBeInTheDocument();
    });
  });

  it("displays room category radio options in dialog", async () => {
    render(
      <TestWrapper>
        <BookingBlackoutPeriods />
      </TestWrapper>
    );

    fireEvent.click(screen.getByText("Add Period"));

    await waitFor(() => {
      // Check that radio button values exist
      expect(screen.getByDisplayValue("all")).toBeInTheDocument();
      expect(screen.getByDisplayValue("production")).toBeInTheDocument();
      expect(screen.getByDisplayValue("event")).toBeInTheDocument();
      expect(screen.getByDisplayValue("multi")).toBeInTheDocument();
      expect(screen.getByDisplayValue("specific")).toBeInTheDocument();
    });
  });

  it("shows room numbers in radio button labels", async () => {
    render(
      <TestWrapper>
        <BookingBlackoutPeriods />
      </TestWrapper>
    );

    fireEvent.click(screen.getByText("Add Period"));

    await waitFor(() => {
      // Verify that room numbers are displayed in the labels
      expect(
        screen.getByText(
          /Production Rooms \(.*220.*221.*222.*223.*224.*230.*260.*203.*233.*103.*\)/
        )
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Event Rooms \(.*1201.*202.*233.*103.*\)/)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Multi-Room \(.*233.*103.*\)/)
      ).toBeInTheDocument();
    });
  });

  it("shows specific room selection when 'specific' is selected", async () => {
    render(
      <TestWrapper>
        <BookingBlackoutPeriods />
      </TestWrapper>
    );

    fireEvent.click(screen.getByText("Add Period"));

    await waitFor(() => {
      expect(screen.getByText("Add Blackout Period")).toBeInTheDocument();
    });

    // Select the "Specific Rooms" option
    const specificRadio = screen.getByDisplayValue("specific");
    fireEvent.click(specificRadio);

    await waitFor(() => {
      expect(screen.getAllByText("Select Rooms")).toHaveLength(2); // Label + span
    });
  });

  it("hides specific room selection when other categories are selected", async () => {
    render(
      <TestWrapper>
        <BookingBlackoutPeriods />
      </TestWrapper>
    );

    fireEvent.click(screen.getByText("Add Period"));

    await waitFor(() => {
      expect(screen.getByText("Add Blackout Period")).toBeInTheDocument();
    });

    // Initially select specific rooms
    const specificRadio = screen.getByDisplayValue("specific");
    fireEvent.click(specificRadio);

    await waitFor(() => {
      expect(screen.getAllByText("Select Rooms")).toHaveLength(2); // Label + span
    });

    // Now select production rooms
    const productionRadio = screen.getByDisplayValue("production");
    fireEvent.click(productionRadio);

    await waitFor(() => {
      expect(screen.queryAllByText("Select Rooms")).toHaveLength(0);
    });
  });

  describe("Room Category Detection Logic", () => {
    it("correctly identifies production rooms configuration", () => {
      const productionRoomIds = PRODUCTION_ROOMS.filter((roomId) =>
        mockRoomSettings.some((room) => room.roomId === roomId)
      ).sort((a, b) => a - b);

      expect(productionRoomIds).toEqual([
        103, 203, 220, 221, 222, 223, 224, 230, 233, 260,
      ]);
    });

    it("correctly identifies event rooms configuration", () => {
      const eventRoomIds = EVENT_ROOMS.filter((roomId) =>
        mockRoomSettings.some((room) => room.roomId === roomId)
      ).sort((a, b) => a - b);

      expect(eventRoomIds).toEqual([103, 202, 233, 1201]);
    });

    it("correctly identifies multi rooms configuration", () => {
      const multiRoomIds = MULTI_ROOMS.filter((roomId) =>
        mockRoomSettings.some((room) => room.roomId === roomId)
      ).sort((a, b) => a - b);

      expect(multiRoomIds).toEqual([103, 233]);
    });

    it("validates room category overlap", () => {
      // Multi rooms should be present in both production and event
      MULTI_ROOMS.forEach((roomId) => {
        expect(PRODUCTION_ROOMS).toContain(roomId);
        expect(EVENT_ROOMS).toContain(roomId);
      });
    });
  });
});
