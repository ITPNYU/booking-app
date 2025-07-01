import { deepPurple } from "@mui/material/colors";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { render, screen } from "@testing-library/react";
import { Timestamp } from "firebase/firestore";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MoreInfoModal from "../../components/src/client/routes/components/bookingTable/MoreInfoModal";
import { DatabaseContext } from "../../components/src/client/routes/components/Provider";
import {
  BookingRow,
  BookingStatusLabel,
  PagePermission,
} from "../../components/src/types";

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
  requestNumber: "12345",
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
  securityDetails: "none",
  status: "PENDING" as BookingStatusLabel,
  bookingType: "Workshop",
  requestedDate: Timestamp.fromDate(new Date("2024-01-15T10:00:00")),
  checkedInDate: null,
  actualEndDate: null,
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

describe("MoreInfoModal - Accessibility", () => {
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

  describe("Accessibility", () => {
    it("has proper modal accessibility attributes", () => {
      const booking = createMockBooking();
      const context = createMockDatabaseContext(PagePermission.BOOKING);

      renderModal(booking, context);

      const modal = screen.getByRole("presentation");
      expect(modal).toBeInTheDocument();
      expect(modal).toHaveClass("MuiModal-root");
    });

    it("has proper tooltip for edit button", () => {
      const booking = createMockBooking({ webcheckoutCartNumber: "CART123" });
      const context = createMockDatabaseContext(PagePermission.PA);

      renderModal(booking, context);

      const editButton = screen.getByLabelText("Edit cart number");
      expect(editButton).toBeInTheDocument();
      expect(editButton).toHaveAttribute("aria-label", "Edit cart number");
    });

    it("has proper structure for table content", () => {
      const booking = createMockBooking();
      const context = createMockDatabaseContext(PagePermission.BOOKING);

      renderModal(booking, context);

      // Check for table headers in history section using more specific queries
      const statusHeader = screen.getByRole("columnheader", { name: "Status" });
      expect(statusHeader).toBeInTheDocument();
      expect(
        screen.getByRole("columnheader", { name: "User" })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("columnheader", { name: "Date" })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("columnheader", { name: "Note" })
      ).toBeInTheDocument();
    });

    it("provides semantic structure with proper headings", () => {
      const booking = createMockBooking();
      const context = createMockDatabaseContext(PagePermission.BOOKING);

      renderModal(booking, context);

      // Check for section headings
      expect(screen.getByText("History")).toBeInTheDocument();
      expect(screen.getByText("Request")).toBeInTheDocument();
      expect(screen.getByText("Requester")).toBeInTheDocument();
    });

    it("has proper form labels for edit functionality", () => {
      const booking = createMockBooking({ webcheckoutCartNumber: "CART123" });
      const context = createMockDatabaseContext(PagePermission.PA);

      renderModal(booking, context);

      // Check that cart number field has proper label
      expect(screen.getByText("Cart Number")).toBeInTheDocument();
    });
  });
});
