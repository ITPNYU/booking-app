import BookingBlackoutPeriods from "@/components/src/client/routes/admin/components/policySettings/BookingBlackoutPeriods";
import { DatabaseContext } from "@/components/src/client/routes/components/Provider";
import { LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";

// Mock Firebase functions
vi.mock("@/lib/firebase/firebase", () => ({
  clientFetchAllDataFromCollection: vi.fn().mockResolvedValue([]),
  clientSaveDataToFirestore: vi.fn().mockResolvedValue({}),
  clientUpdateDataInFirestore: vi.fn().mockResolvedValue({}),
  clientDeleteDataFromFirestore: vi.fn().mockResolvedValue({}),
}));

// Mock Firestore Timestamp
vi.mock("firebase/firestore", () => ({
  Timestamp: {
    fromDate: vi.fn((date) => ({ toDate: () => date })),
    now: vi.fn(() => ({ toDate: () => new Date() })),
  },
}));

// Mock the policy constants import
vi.mock("@/components/src/policy", () => ({
  TableNames: {
    BLACKOUT_PERIODS: "blackout_periods",
  },
}));

const mockRoomSettings = [
  { roomId: 103, name: "Room 103", capacity: "50", calendarId: "cal103" },
  { roomId: 202, name: "Room 202", capacity: "30", calendarId: "cal202" },
  { roomId: 220, name: "Room 220", capacity: "100", calendarId: "cal220" },
  { roomId: 233, name: "Room 233", capacity: "75", calendarId: "cal233" },
  { roomId: 1201, name: "Room 1201", capacity: "200", calendarId: "cal1201" },
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

  it("should render the component with correct title and description", () => {
    render(
      <TestWrapper>
        <BookingBlackoutPeriods />
      </TestWrapper>
    );

    expect(screen.getByText("Booking Blackout Periods")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Configure periods when bookings are not allowed (e.g., holidays, maintenance, summer break)"
      )
    ).toBeInTheDocument();
    expect(screen.getByText("Add Period")).toBeInTheDocument();
  });

  it("should open dialog when Add Period button is clicked", async () => {
    render(
      <TestWrapper>
        <BookingBlackoutPeriods />
      </TestWrapper>
    );

    const addButton = screen.getByText("Add Period");
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getByText("Add Blackout Period")).toBeInTheDocument();
      expect(screen.getByLabelText("Period Name")).toBeInTheDocument();
      expect(screen.getByLabelText("Start Date")).toBeInTheDocument();
      expect(screen.getByLabelText("End Date")).toBeInTheDocument();
      expect(screen.getByLabelText("Start Time")).toBeInTheDocument();
      expect(screen.getByLabelText("End Time")).toBeInTheDocument();
    });
  });

  it("should display room category radio options", async () => {
    render(
      <TestWrapper>
        <BookingBlackoutPeriods />
      </TestWrapper>
    );

    const addButton = screen.getByText("Add Period");
    fireEvent.click(addButton);

    await waitFor(() => {
      // Check for radio button options
      expect(
        screen.getByLabelText(/All Rooms \(5 rooms\)/)
      ).toBeInTheDocument();
      expect(screen.getByLabelText(/Production Rooms/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Event Rooms/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Multi-Room/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Specific Rooms/)).toBeInTheDocument();
    });
  });

  it("should show room numbers instead of counts in radio labels", async () => {
    render(
      <TestWrapper>
        <BookingBlackoutPeriods />
      </TestWrapper>
    );

    const addButton = screen.getByText("Add Period");
    fireEvent.click(addButton);

    await waitFor(() => {
      // Check that room numbers are displayed more specifically
      expect(
        screen.getByText(/Production Rooms \(220, 233, 103\)/)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Event Rooms \(1201, 202, 233, 103\)/)
      ).toBeInTheDocument();
      expect(screen.getByText(/Multi-Room \(233, 103\)/)).toBeInTheDocument();
    });
  });

  describe("Time Field Functionality", () => {
    it("should have time picker fields in the dialog", async () => {
      render(
        <TestWrapper>
          <BookingBlackoutPeriods />
        </TestWrapper>
      );

      const addButton = screen.getByText("Add Period");
      fireEvent.click(addButton);

      await waitFor(() => {
        expect(screen.getByLabelText("Start Time")).toBeInTheDocument();
        expect(screen.getByLabelText("End Time")).toBeInTheDocument();
      });
    });

    it("should validate that all fields including times are required", async () => {
      render(
        <TestWrapper>
          <BookingBlackoutPeriods />
        </TestWrapper>
      );

      const addButton = screen.getByText("Add Period");
      fireEvent.click(addButton);

      await waitFor(() => {
        const saveButton = screen.getByText("Save");
        fireEvent.click(saveButton);
      });

      await waitFor(() => {
        expect(
          screen.getAllByText(
            "Please fill in all fields: name, start date, end date, start time, and end time."
          ).length
        ).toBeGreaterThan(0);
      });
    });

    it("should show date and time in table headers", () => {
      render(
        <TestWrapper>
          <BookingBlackoutPeriods />
        </TestWrapper>
      );

      expect(screen.getByText("Start Date & Time")).toBeInTheDocument();
      expect(screen.getByText("End Date & Time")).toBeInTheDocument();
    });
  });

  describe("Room Category Display", () => {
    it("should correctly display room numbers for each category", async () => {
      render(
        <TestWrapper>
          <BookingBlackoutPeriods />
        </TestWrapper>
      );

      const addButton = screen.getByText("Add Period");
      fireEvent.click(addButton);

      await waitFor(() => {
        // Check for specific text patterns in the radio labels
        expect(
          screen.getByText(/Production Rooms \(220, 233, 103\)/)
        ).toBeInTheDocument();
        expect(
          screen.getByText(/Event Rooms \(1201, 202, 233, 103\)/)
        ).toBeInTheDocument();
        expect(screen.getByText(/Multi-Room \(233, 103\)/)).toBeInTheDocument();
      });
    });
  });
});
