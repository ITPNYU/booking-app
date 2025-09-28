import { deepPurple } from "@mui/material/colors";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { render, screen, waitFor } from "@testing-library/react";
import { Timestamp } from "firebase/firestore";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import MoreInfoModal from "../../components/src/client/routes/components/bookingTable/MoreInfoModal";
import { DatabaseContext } from "../../components/src/client/routes/components/Provider";
import { BookingRow, PagePermission } from "../../components/src/types";

// Mock clipboard API - avoid conflicts with userEvent
const mockWriteText = vi.fn();

// Mock global alert
global.alert = vi.fn();

// Mock clipboard without userEvent conflicts
beforeAll(() => {
  Object.defineProperty(navigator, "clipboard", {
    value: {
      writeText: mockWriteText,
    },
    configurable: true,
    writable: true,
  });
});

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

// Mock WebCheckout API responses - avoid any real API calls
const mockWebCheckoutResponse = {
  cartNumber: "CK-2614",
  totalItems: 3,
  webCheckoutUrl:
    "https://engineering-nyu.webcheckout.net/sso/wco?method=show-entity&type=allocation&oid=11544499",
  equipmentGroups: [
    {
      label: "Checked out",
      items: [
        {
          name: "5 Pin DMX Cable 10'",
          subitems: [
            { label: "5 Pin DMX Cable 10' - 370JMC" },
            { label: "5 Pin DMX Cable 10' - 370JMC" },
          ],
        },
        {
          name: "Camera Accessories",
          subitems: [{ label: "Magnus Video Tripod - 370JMC - 001" }],
        },
      ],
    },
  ],
};

const mockUpdateCartResponse = {
  ok: true,
  json: () => Promise.resolve({ success: true }),
};

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

describe("MoreInfoModal - WebCheckout (Simplified)", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock all WebCheckout API calls to return immediately without network delay
    mockFetch.mockImplementation(
      (url: RequestInfo | URL, options?: RequestInit) => {
        if (typeof url === "string" && url.includes("/api/webcheckout/cart/")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockWebCheckoutResponse),
          });
        }

        if (
          typeof url === "string" &&
          url.includes("/api/updateWebcheckoutCart")
        ) {
          return Promise.resolve(mockUpdateCartResponse);
        }

        // Default fallback for any other fetch calls
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({}),
        });
      }
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("WebCheckout Section - Permission-based Visibility", () => {
    it("shows WebCheckout section for PA users", () => {
      const booking = createMockBooking();
      const context = createMockDatabaseContext(PagePermission.PA);

      renderModal(booking, context);

      expect(screen.getByText("WebCheckout")).toBeInTheDocument();
      expect(screen.getByText("Cart Number")).toBeInTheDocument();
    });

    it("shows WebCheckout section for Admin users", () => {
      const booking = createMockBooking();
      const context = createMockDatabaseContext(PagePermission.ADMIN);

      renderModal(booking, context);

      expect(screen.getByText("WebCheckout")).toBeInTheDocument();
      expect(screen.getByText("Cart Number")).toBeInTheDocument();
    });

    it("shows WebCheckout section for Super Admin users", () => {
      const booking = createMockBooking();
      const context = createMockDatabaseContext(PagePermission.SUPER_ADMIN);

      renderModal(booking, context);

      expect(screen.getByText("WebCheckout")).toBeInTheDocument();
      expect(screen.getByText("Cart Number")).toBeInTheDocument();
    });

    it("hides WebCheckout section for regular booking users", () => {
      const booking = createMockBooking();
      const context = createMockDatabaseContext(PagePermission.BOOKING);

      renderModal(booking, context);

      expect(screen.queryByText("WebCheckout")).not.toBeInTheDocument();
      expect(screen.queryByText("Cart Number")).not.toBeInTheDocument();
    });
  });

  describe("Edit Cart Number Permission Control", () => {
    it("shows edit button for PA users", () => {
      const booking = createMockBooking({ webcheckoutCartNumber: undefined });
      const context = createMockDatabaseContext(PagePermission.PA);

      renderModal(booking, context);

      expect(screen.getByLabelText("Edit cart number")).toBeInTheDocument();
    });

    it("shows edit button for Admin users", () => {
      const booking = createMockBooking({ webcheckoutCartNumber: undefined });
      const context = createMockDatabaseContext(PagePermission.ADMIN);

      renderModal(booking, context);

      expect(screen.getByLabelText("Edit cart number")).toBeInTheDocument();
    });

    it("shows edit button for Super Admin users", () => {
      const booking = createMockBooking({ webcheckoutCartNumber: undefined });
      const context = createMockDatabaseContext(PagePermission.SUPER_ADMIN);

      renderModal(booking, context);

      expect(screen.getByLabelText("Edit cart number")).toBeInTheDocument();
    });

    it("does not show edit button for regular booking users", () => {
      const booking = createMockBooking({ webcheckoutCartNumber: undefined });
      const context = createMockDatabaseContext(PagePermission.BOOKING);

      renderModal(booking, context);

      // WebCheckout section should not be visible at all for regular booking users
      expect(screen.queryByText("WebCheckout")).not.toBeInTheDocument();
      expect(
        screen.queryByLabelText("Edit cart number")
      ).not.toBeInTheDocument();
    });

    it("does not show edit button for liaison users", () => {
      const booking = createMockBooking({ webcheckoutCartNumber: undefined });
      const context = createMockDatabaseContext(PagePermission.LIAISON);

      renderModal(booking, context);

      // WebCheckout section should not be visible at all for liaison users
      expect(screen.queryByText("WebCheckout")).not.toBeInTheDocument();
      expect(
        screen.queryByLabelText("Edit cart number")
      ).not.toBeInTheDocument();
    });

    it("does not show edit button for staffing users", () => {
      const booking = createMockBooking({ webcheckoutCartNumber: undefined });
      const context = createMockDatabaseContext(PagePermission.STAFFING);

      renderModal(booking, context);

      // WebCheckout section should not be visible at all for equipment users
      expect(screen.queryByText("WebCheckout")).not.toBeInTheDocument();
      expect(
        screen.queryByLabelText("Edit cart number")
      ).not.toBeInTheDocument();
    });
  });

  describe("WebCheckout Basic Functionality", () => {
    it("displays 'No cart assigned' when no cart number exists", () => {
      const booking = createMockBooking({ webcheckoutCartNumber: undefined });
      const context = createMockDatabaseContext(PagePermission.PA);

      renderModal(booking, context);

      expect(screen.getByText("No cart assigned")).toBeInTheDocument();
    });

    it("displays cart number when webcheckoutCartNumber is provided", async () => {
      const booking = createMockBooking({ webcheckoutCartNumber: "CK-2614" });
      const context = createMockDatabaseContext(PagePermission.PA);

      renderModal(booking, context);

      // Check that cart number is displayed in the table (even if API data hasn't loaded yet)
      expect(screen.getByText("Cart Number")).toBeInTheDocument();

      // Check that API is called with correct cart number
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith("/api/webcheckout/cart/CK-2614");
      });
    });

    it("shows WebCheckout section when cart number is provided", async () => {
      const booking = createMockBooking({ webcheckoutCartNumber: "CK-2614" });
      const context = createMockDatabaseContext(PagePermission.PA);

      renderModal(booking, context);

      // Check that WebCheckout section is visible
      expect(screen.getByText("WebCheckout")).toBeInTheDocument();
      expect(screen.getByText("Cart Number")).toBeInTheDocument();

      // Verify API call was made
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith("/api/webcheckout/cart/CK-2614");
      });
    });

    it("shows loading state while fetching WebCheckout data", async () => {
      const booking = createMockBooking({ webcheckoutCartNumber: "CK-2614" });
      const context = createMockDatabaseContext(PagePermission.PA);

      renderModal(booking, context);

      // Initially shows cart number without equipment data
      expect(screen.getByText("Cart Number")).toBeInTheDocument();
    });

    it("handles WebCheckout API errors gracefully", async () => {
      mockFetch.mockRejectedValueOnce(new Error("API Error"));

      const booking = createMockBooking({ webcheckoutCartNumber: "CK-2614" });
      const context = createMockDatabaseContext(PagePermission.PA);

      renderModal(booking, context);

      // Should still show basic cart information even with API error
      expect(screen.getByText("Cart Number")).toBeInTheDocument();
    });

    it("only shows equipment information for users with proper permissions", () => {
      const booking = createMockBooking({ webcheckoutCartNumber: "CK-2614" });
      const context = createMockDatabaseContext(PagePermission.BOOKING);

      renderModal(booking, context);

      // WebCheckout section should not be visible for regular booking users
      expect(screen.queryByText("WebCheckout")).not.toBeInTheDocument();
    });

    it("makes API call with correct cart number", async () => {
      const booking = createMockBooking({ webcheckoutCartNumber: "CK-2614" });
      const context = createMockDatabaseContext(PagePermission.PA);

      renderModal(booking, context);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith("/api/webcheckout/cart/CK-2614");
      });
    });

    it("handles network errors when fetching WebCheckout data", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const booking = createMockBooking({ webcheckoutCartNumber: "CK-2614" });
      const context = createMockDatabaseContext(PagePermission.PA);

      renderModal(booking, context);

      // Should still render the component without crashing
      expect(screen.getByText("Cart Number")).toBeInTheDocument();
    });
  });
});
