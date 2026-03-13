import { deepPurple } from "@mui/material/colors";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { fireEvent, render, screen } from "@testing-library/react";
import { Timestamp } from "firebase/firestore";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MoreInfoModal from "../../components/src/client/routes/components/bookingTable/MoreInfoModal";
import { DatabaseContext } from "../../components/src/client/routes/components/Provider";
import { BookingRow, PagePermission } from "../../components/src/types";

// Mock global alert
global.alert = vi.fn();

// Extend theme to include custom palette
const mockTheme = createTheme({
  palette: {
    primary: {
      main: deepPurple.A700,
    },
    secondary: {
      main: deepPurple.A100,
      light: deepPurple[50],
    },
    custom: {
      border: "#e3e3e3",
    },
  },
} as any);

// Mock useSortBookingHistory to return JSX elements
vi.mock(
  "../../components/src/client/routes/hooks/useSortBookingHistory",
  () => ({
    default: () => (
      <tr key="test-row">
        <td>REQUESTED</td>
        <td>test@nyu.edu</td>
        <td>1/15/2024</td>
        <td>Initial request</td>
      </tr>
    ),
  })
);

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

const createMockBooking = (
  overrides: Partial<BookingRow> = {}
): BookingRow => ({
  requestNumber: 12345,
  calendarEventId: "event-123",
  startDate: Timestamp.fromDate(new Date("2024-03-15T10:00:00")),
  endDate: Timestamp.fromDate(new Date("2024-03-15T12:00:00")),
  roomId: "202",
  netId: "jd1234",
  firstName: "John",
  lastName: "Doe",
  email: "test@nyu.edu",
  phoneNumber: "555-1234",
  department: "ITP",
  role: "Student",
  sponsorFirstName: "Jane",
  sponsorLastName: "Smith",
  sponsorEmail: "jane@nyu.edu",
  title: "Test Event",
  description: "Test description",
  expectedAttendance: "20",
  attendeeAffiliation: "NYU Members with an active NYU ID",
  roomSetup: "Standard",
  setupDetails: "none",
  mediaServices: "None",
  mediaServicesDetails: "none",
  catering: "No",
  cateringService: "none",
  hireSecurity: "none",
  status: "PENDING" as any,
  bookingType: "Workshop",
  requestedAt: Timestamp.fromDate(new Date("2024-01-15T10:00:00")),
  checkedInAt: null,
  ...overrides,
});

const createMockDatabaseContext = (
  permission: PagePermission,
  userEmail = "test@nyu.edu"
) => ({
  pagePermission: permission,
  userEmail: userEmail,
  bannedUsers: [],
  roomSettings: [],
  safetyTrainedUsers: [],
  blackoutPeriods: [],
});

const renderModal = (
  booking: BookingRow,
  databaseContext: any,
  closeModal = vi.fn()
) => {
  return render(
    <ThemeProvider theme={mockTheme}>
      <DatabaseContext.Provider value={databaseContext}>
        <MoreInfoModal booking={booking} closeModal={closeModal} />
      </DatabaseContext.Provider>
    </ThemeProvider>
  );
};

describe("MoreInfoModal - Basic Rendering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Basic Modal Rendering", () => {
    it("renders modal with booking information", () => {
      const booking = createMockBooking();
      const context = createMockDatabaseContext(PagePermission.BOOKING);

      renderModal(booking, context);

      expect(screen.getByText("Request Number:")).toBeInTheDocument();
      expect(screen.getAllByText("12345")).toHaveLength(2); // Header and history
      expect(screen.getAllByText("202")).toHaveLength(2); // Header and history
      expect(screen.getAllByText("03/15/24")).toHaveLength(2); // Header and Request section
      expect(screen.getAllByText("PENDING")).toHaveLength(2); // Header and history
    });

    it("renders History section", () => {
      const booking = createMockBooking();
      const context = createMockDatabaseContext(PagePermission.BOOKING);

      renderModal(booking, context);

      expect(screen.getByText("History")).toBeInTheDocument();
    });

    it("renders Request section with booking details", () => {
      const booking = createMockBooking();
      const context = createMockDatabaseContext(PagePermission.BOOKING);

      renderModal(booking, context);

      expect(screen.getByText("Request")).toBeInTheDocument();
      expect(screen.getByText("Test Event")).toBeInTheDocument();
      expect(screen.getByText("Test description")).toBeInTheDocument();
    });

    it("renders Requester section with user information", () => {
      const booking = createMockBooking();
      const context = createMockDatabaseContext(PagePermission.BOOKING);

      renderModal(booking, context);

      expect(screen.getByText("Requester")).toBeInTheDocument();
      expect(screen.getByText("jd1234")).toBeInTheDocument();
      expect(screen.getByText("John Doe")).toBeInTheDocument();
      expect(screen.getByText("ITP")).toBeInTheDocument();
      expect(screen.getByText("Student")).toBeInTheDocument();
    });

    it("calls closeModal when modal is closed", () => {
      const booking = createMockBooking();
      const context = createMockDatabaseContext(PagePermission.BOOKING);
      const closeModal = vi.fn();

      renderModal(booking, context, closeModal);

      // Press Escape key to close modal
      fireEvent.keyDown(screen.getByRole("presentation"), {
        key: "Escape",
        code: "Escape",
        keyCode: 27,
        charCode: 27,
      });

      expect(closeModal).toHaveBeenCalled();
    });
  });

  describe("Data Display", () => {
    it("handles missing optional fields gracefully", () => {
      const booking = createMockBooking({
        secondaryName: "",
      });
      const context = createMockDatabaseContext(PagePermission.BOOKING);

      renderModal(booking, context);

      expect(screen.getAllByText("none")).toHaveLength(8); // Secondary contact fields and other none values
    });

    it("displays all booking details correctly", () => {
      const booking = createMockBooking();
      const context = createMockDatabaseContext(PagePermission.BOOKING);

      renderModal(booking, context);

      // Check all major fields are displayed
      expect(screen.getByText("Workshop")).toBeInTheDocument();
      expect(screen.getByText("20")).toBeInTheDocument();
      expect(
        screen.getByText("NYU Members with an active NYU ID")
      ).toBeInTheDocument();
      expect(screen.getByText("555-1234")).toBeInTheDocument();
    });

    it("formats dates and times correctly", () => {
      const booking = createMockBooking({
        startDate: Timestamp.fromDate(new Date("2024-03-15T14:30:00-04:00")),
        endDate: Timestamp.fromDate(new Date("2024-03-15T16:45:00-04:00")),
      });
      const context = createMockDatabaseContext(PagePermission.BOOKING);

      renderModal(booking, context);

      expect(screen.getByText("2:30 PM - 4:45 PM")).toBeInTheDocument(); // Header
      expect(screen.getByText("2:30 PM - 4:45 PM ET")).toBeInTheDocument(); // Details
    });
  });
});
