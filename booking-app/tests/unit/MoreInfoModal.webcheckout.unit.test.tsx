import { deepPurple } from "@mui/material/colors";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Timestamp } from "firebase/firestore";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MoreInfoModal from "../../components/src/client/routes/components/bookingTable/MoreInfoModal";
import { DatabaseContext } from "../../components/src/client/routes/components/Provider";
import { BookingRow, PagePermission } from "../../components/src/types";

// Mock clipboard API
Object.defineProperty(navigator, "clipboard", {
  value: {
    writeText: vi.fn(),
  },
  writable: true,
});

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

// Mock WebCheckout data
const mockWebCheckoutData = {
  cartNumber: "CK-2614",
  totalItems: 3,
  webCheckoutUrl:
    "https://engineering-nyu.webcheckout.net/sso/wco?method=show-entity&type=allocation&oid=11544499",
  equipmentGroups: [
    {
      groupName: "Checked out",
      color: "#4285f4",
      items: [
        {
          name: "5 Pin DMX Cable 10'",
          subItems: [
            { name: "5 Pin DMX Cable 10' - 370JMC" },
            { name: "5 Pin DMX Cable 10' - 370JMC" },
          ],
        },
        {
          name: "Camera Accessories",
          subItems: [{ name: "Magnus Video Tripod - 370JMC - 001" }],
        },
      ],
    },
  ],
};

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
  status: "PENDING" as any,
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

describe("MoreInfoModal - WebCheckout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockWebCheckoutData),
    });
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

    it("hides WebCheckout section for regular booking users", () => {
      const booking = createMockBooking();
      const context = createMockDatabaseContext(PagePermission.BOOKING);

      renderModal(booking, context);

      expect(screen.queryByText("WebCheckout")).not.toBeInTheDocument();
      expect(screen.queryByText("Cart Number")).not.toBeInTheDocument();
    });

    it("hides WebCheckout section for liaison users", () => {
      const booking = createMockBooking();
      const context = createMockDatabaseContext(PagePermission.LIAISON);

      renderModal(booking, context);

      expect(screen.queryByText("WebCheckout")).not.toBeInTheDocument();
      expect(screen.queryByText("Cart Number")).not.toBeInTheDocument();
    });

    it("hides WebCheckout section for equipment users", () => {
      const booking = createMockBooking();
      const context = createMockDatabaseContext(PagePermission.EQUIPMENT);

      renderModal(booking, context);

      expect(screen.queryByText("WebCheckout")).not.toBeInTheDocument();
      expect(screen.queryByText("Cart Number")).not.toBeInTheDocument();
    });
  });

  describe("WebCheckout Functionality - Without Cart Number", () => {
    it("displays 'No cart assigned' when no cart number exists", () => {
      const booking = createMockBooking({ webcheckoutCartNumber: "" });
      const context = createMockDatabaseContext(PagePermission.PA);

      renderModal(booking, context);

      expect(screen.getByText("No cart assigned")).toBeInTheDocument();
    });

    it("shows edit button when no cart number exists for PA users", () => {
      const booking = createMockBooking({ webcheckoutCartNumber: "" });
      const context = createMockDatabaseContext(PagePermission.PA);

      renderModal(booking, context);

      const editButton = screen.getByLabelText("Edit cart number");
      expect(editButton).toBeInTheDocument();
    });
  });

  describe("WebCheckout Edit Functionality", () => {
    beforeEach(() => {
      // Clear clipboard mocks for userEvent tests
      vi.clearAllMocks();
    });

    it("enters edit mode when edit button is clicked", async () => {
      const user = userEvent.setup();
      const booking = createMockBooking({ webcheckoutCartNumber: "CART123" });
      const context = createMockDatabaseContext(PagePermission.PA);

      renderModal(booking, context);

      const editButton = screen.getByLabelText("Edit cart number");
      await user.click(editButton);

      // Should show input field in edit mode
      expect(screen.getByDisplayValue("CART123")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /check/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /cancel/i })
      ).toBeInTheDocument();
    });

    it("shows save and cancel buttons in edit mode", async () => {
      const user = userEvent.setup();
      const booking = createMockBooking({ webcheckoutCartNumber: "CART123" });
      const context = createMockDatabaseContext(PagePermission.PA);

      renderModal(booking, context);

      const editButton = screen.getByLabelText("Edit cart number");
      await user.click(editButton);

      expect(
        screen.getByRole("button", { name: /check/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /cancel/i })
      ).toBeInTheDocument();
    });

    it("cancels edit and restores original value", async () => {
      const user = userEvent.setup();
      const booking = createMockBooking({ webcheckoutCartNumber: "CART123" });
      const context = createMockDatabaseContext(PagePermission.PA);

      renderModal(booking, context);

      const editButton = screen.getByLabelText("Edit cart number");
      await user.click(editButton);

      // Change the value
      const input = screen.getByDisplayValue("CART123");
      await user.clear(input);
      await user.type(input, "NEW_CART");

      // Cancel the edit
      const cancelButton = screen.getByRole("button", { name: /cancel/i });
      await user.click(cancelButton);

      // Should restore original value
      expect(screen.queryByDisplayValue("NEW_CART")).not.toBeInTheDocument();
    });

    it("saves new cart number successfully", async () => {
      const user = userEvent.setup();
      const booking = createMockBooking({ webcheckoutCartNumber: "CART123" });
      const context = createMockDatabaseContext(
        PagePermission.PA,
        "admin@nyu.edu"
      );

      // Mock successful update
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      renderModal(booking, context);

      const editButton = screen.getByLabelText("Edit cart number");
      await user.click(editButton);

      // Change the value
      const input = screen.getByDisplayValue("CART123");
      await user.clear(input);
      await user.type(input, "NEW_CART");

      // Save the edit
      const saveButton = screen.getByRole("button", { name: /check/i });
      await user.click(saveButton);

      // Should call the update API
      expect(mockFetch).toHaveBeenCalledWith("/api/updateWebcheckoutCart", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          calendarEventId: "event-123",
          cartNumber: "NEW_CART",
          userEmail: "admin@nyu.edu",
        }),
      });
    });

    it("handles save error gracefully", async () => {
      const user = userEvent.setup();
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: "Failed to update" }),
      });

      const booking = createMockBooking({ webcheckoutCartNumber: "CART123" });
      const context = createMockDatabaseContext(PagePermission.PA);

      renderModal(booking, context);

      const editButton = screen.getByLabelText("Edit cart number");
      await user.click(editButton);

      const input = screen.getByDisplayValue("CART123");
      await user.clear(input);
      await user.type(input, "NEW_CART");

      const saveButton = screen.getByRole("button", { name: /check/i });
      await user.click(saveButton);

      // Should show alert with error
      expect(global.alert).toHaveBeenCalledWith("Error: Failed to update");
    });

    it("handles network error gracefully", async () => {
      const user = userEvent.setup();
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const booking = createMockBooking({ webcheckoutCartNumber: "CART123" });
      const context = createMockDatabaseContext(PagePermission.PA);

      renderModal(booking, context);

      const editButton = screen.getByLabelText("Edit cart number");
      await user.click(editButton);

      const input = screen.getByDisplayValue("CART123");
      await user.clear(input);
      await user.type(input, "NEW_CART");

      const saveButton = screen.getByRole("button", { name: /check/i });
      await user.click(saveButton);

      // Should show alert with error
      expect(global.alert).toHaveBeenCalledWith("Failed to update cart number");
    });

    it("disables buttons during update", async () => {
      const user = userEvent.setup();
      // Create a delayed response to test loading state
      const delayedResponse = new Promise((resolve) =>
        setTimeout(
          () =>
            resolve({
              ok: true,
              json: () => Promise.resolve({ success: true }),
            }),
          100
        )
      );
      mockFetch.mockReturnValueOnce(delayedResponse);

      const booking = createMockBooking({ webcheckoutCartNumber: "CART123" });
      const context = createMockDatabaseContext(PagePermission.PA);

      renderModal(booking, context);

      const editButton = screen.getByLabelText("Edit cart number");
      await user.click(editButton);

      const input = screen.getByDisplayValue("CART123");
      await user.clear(input);
      await user.type(input, "NEW_CART");

      const saveButton = screen.getByRole("button", { name: /check/i });
      await user.click(saveButton);

      // Buttons should be disabled during update
      expect(saveButton).toBeDisabled();
      expect(screen.getByRole("button", { name: /cancel/i })).toBeDisabled();

      // Wait for update to complete
      await waitFor(() => {
        expect(saveButton).not.toBeDisabled();
      });
    });
  });

  describe("WebCheckout Equipment Display", () => {
    it("displays cart number and total items count", async () => {
      const booking = createMockBooking({ webcheckoutCartNumber: "CK-2614" });
      const context = createMockDatabaseContext(PagePermission.PA);

      renderModal(booking, context);

      await waitFor(() => {
        expect(
          screen.getByText(/Cart: CK-2614 \(3 items\)/)
        ).toBeInTheDocument();
      });
    });

    it("displays Copy Cart URL button next to cart info", async () => {
      const booking = createMockBooking({ webcheckoutCartNumber: "CK-2614" });
      const context = createMockDatabaseContext(PagePermission.PA);

      renderModal(booking, context);

      await waitFor(() => {
        const copyButton = screen.getByText("Copy Cart URL");
        expect(copyButton).toBeInTheDocument();
      });
    });

    it("displays equipment groups with proper styling", async () => {
      const booking = createMockBooking({ webcheckoutCartNumber: "CK-2614" });
      const context = createMockDatabaseContext(PagePermission.PA);

      renderModal(booking, context);

      await waitFor(() => {
        expect(screen.getByText("Checked out")).toBeInTheDocument();
      });
    });

    it("displays equipment items and subitems correctly", async () => {
      const booking = createMockBooking({ webcheckoutCartNumber: "CK-2614" });
      const context = createMockDatabaseContext(PagePermission.PA);

      renderModal(booking, context);

      await waitFor(() => {
        // Check main item categories - use getAllByText for multiple matches
        expect(screen.getAllByText(/5 Pin DMX Cable 10'/)).toHaveLength(3); // Main item + 2 subitems
        expect(screen.getByText(/Camera Accessories/)).toBeInTheDocument();

        // Check individual subitems
        expect(
          screen.getByText(/Magnus Video Tripod - 370JMC - 001/)
        ).toBeInTheDocument();
      });
    });

    it("shows loading state while fetching WebCheckout data", () => {
      const booking = createMockBooking({ webcheckoutCartNumber: "CK-2614" });
      const context = createMockDatabaseContext(PagePermission.PA);

      renderModal(booking, context);

      expect(
        screen.getByText("Loading equipment information...")
      ).toBeInTheDocument();
    });

    it("handles WebCheckout API errors gracefully", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({}),
      });

      const booking = createMockBooking({ webcheckoutCartNumber: "CK-2614" });
      const context = createMockDatabaseContext(PagePermission.PA);

      renderModal(booking, context);

      // Should not crash and should show the edit button
      expect(screen.getByLabelText("Edit cart number")).toBeInTheDocument();
    });

    it("handles empty equipment groups gracefully", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            cartNumber: "CK-2614",
            totalItems: 0,
            webCheckoutUrl: "https://example.com",
            equipmentGroups: [],
          }),
      });

      const booking = createMockBooking({ webcheckoutCartNumber: "CK-2614" });
      const context = createMockDatabaseContext(PagePermission.PA);

      renderModal(booking, context);

      await waitFor(() => {
        expect(
          screen.getByText(/Cart: CK-2614 \(0 items\)/)
        ).toBeInTheDocument();
      });
    });

    it("only shows equipment information for users with proper permissions", () => {
      const booking = createMockBooking({ webcheckoutCartNumber: "CK-2614" });
      const context = createMockDatabaseContext(PagePermission.BOOKING);

      renderModal(booking, context);

      // Should not show WebCheckout section at all
      expect(screen.queryByText("WebCheckout")).not.toBeInTheDocument();
      expect(
        screen.queryByText("Loading equipment information...")
      ).not.toBeInTheDocument();
    });

    it("makes API call with correct cart number", async () => {
      const booking = createMockBooking({ webcheckoutCartNumber: "TEST-CART" });
      const context = createMockDatabaseContext(PagePermission.PA);

      renderModal(booking, context);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          "/api/webcheckout/cart/TEST-CART"
        );
      });
    });

    it("handles network errors when fetching WebCheckout data", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const booking = createMockBooking({ webcheckoutCartNumber: "CK-2614" });
      const context = createMockDatabaseContext(PagePermission.PA);

      renderModal(booking, context);

      // Should not crash and should show the edit button
      expect(screen.getByLabelText("Edit cart number")).toBeInTheDocument();
    });
  });
});
