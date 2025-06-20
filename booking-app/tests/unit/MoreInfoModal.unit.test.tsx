import MoreInfoModal from "@/components/src/client/routes/components/bookingTable/MoreInfoModal";
import { DatabaseContext } from "@/components/src/client/routes/components/Provider";
import {
  AttendeeAffiliation,
  BookingRow,
  BookingStatusLabel,
  PagePermission,
} from "@/components/src/types";
import { deepPurple } from "@mui/material/colors";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Timestamp } from "firebase/firestore";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Extend MUI theme type to include custom palette
declare module "@mui/material/styles" {
  interface Palette {
    custom: {
      border: string;
    };
  }

  interface PaletteOptions {
    custom?: {
      border?: string;
    };
  }
}

// Mock useSortBookingHistory
vi.mock("@/components/src/client/routes/hooks/useSortBookingHistory", () => {
  const { TableRow, TableCell } = require("@mui/material");
  const React = require("react");

  return {
    default: () => [
      React.createElement(TableRow, { key: "test-history-1" }, [
        React.createElement(TableCell, { key: "status" }, "REQUESTED"),
        React.createElement(TableCell, { key: "user" }, "test@nyu.edu"),
        React.createElement(
          TableCell,
          { key: "date" },
          "Jan 15, 2024 12:00 PM"
        ),
        React.createElement(TableCell, { key: "note" }, "Initial request"),
      ]),
    ],
  };
});

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock global alert
global.alert = vi.fn();

// Create mock theme for testing
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
});

const createMockBooking = (
  overrides: Partial<BookingRow> = {}
): BookingRow => ({
  id: "test-booking-1",
  calendarEventId: "cal-event-1",
  email: "test@nyu.edu",
  firstName: "John",
  lastName: "Doe",
  secondaryName: "",
  nNumber: "N12345678",
  netId: "jd1234",
  phoneNumber: "555-1234",
  department: "ITP",
  otherDepartment: "",
  role: "Student",
  sponsorFirstName: "Jane",
  sponsorLastName: "Smith",
  sponsorEmail: "jane@nyu.edu",
  title: "Test Event",
  description: "Test description",
  bookingType: "Workshop",
  attendeeAffiliation: AttendeeAffiliation.NYU,
  roomSetup: "Standard",
  setupDetails: "",
  mediaServices: "None",
  mediaServicesDetails: "",
  catering: "No",
  hireSecurity: "No",
  expectedAttendance: "20",
  cateringService: "",
  chartFieldForCatering: "",
  chartFieldForSecurity: "",
  chartFieldForRoomSetup: "",
  webcheckoutCartNumber: "",
  startDate: Timestamp.fromDate(new Date("2024-03-15T10:00:00")),
  endDate: Timestamp.fromDate(new Date("2024-03-15T12:00:00")),
  roomId: "202",
  requestNumber: 12345,
  equipmentCheckedOut: false,
  status: BookingStatusLabel.PENDING,
  requestedAt: Timestamp.fromDate(new Date("2024-03-10T09:00:00")),
  firstApprovedAt: Timestamp.fromDate(new Date()),
  firstApprovedBy: "",
  finalApprovedAt: Timestamp.fromDate(new Date()),
  finalApprovedBy: "",
  declinedAt: Timestamp.fromDate(new Date()),
  declinedBy: "",
  declineReason: "",
  canceledAt: Timestamp.fromDate(new Date()),
  canceledBy: "",
  checkedInAt: Timestamp.fromDate(new Date()),
  checkedInBy: "",
  checkedOutAt: Timestamp.fromDate(new Date()),
  checkedOutBy: "",
  noShowedAt: Timestamp.fromDate(new Date()),
  noShowedBy: "",
  walkedInAt: Timestamp.fromDate(new Date()),
  origin: "walk-in",
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

describe("MoreInfoModal", () => {
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
      expect(screen.getAllByText("3/15/2024")).toHaveLength(2); // Header and history
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

  describe("WebCheckout Functionality - With Cart Number", () => {
    it("displays existing cart number with link", () => {
      const booking = createMockBooking({ webcheckoutCartNumber: "CART123" });
      const context = createMockDatabaseContext(PagePermission.PA);

      renderModal(booking, context);

      const cartLink = screen.getByRole("link", { name: "CART123" });
      expect(cartLink).toBeInTheDocument();
      expect(cartLink).toHaveAttribute(
        "href",
        "https://engineering-nyu.webcheckout.net/sso/wco/#/operator/allocations/CART123"
      );
      expect(cartLink).toHaveAttribute("target", "_blank");
    });

    it("shows edit button for PA users when cart number exists", () => {
      const booking = createMockBooking({ webcheckoutCartNumber: "CART123" });
      const context = createMockDatabaseContext(PagePermission.PA);

      renderModal(booking, context);

      const editButton = screen.getByLabelText("Edit cart number");
      expect(editButton).toBeInTheDocument();
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
    it("enters edit mode when edit button is clicked", async () => {
      const user = userEvent.setup();
      const booking = createMockBooking({ webcheckoutCartNumber: "CART123" });
      const context = createMockDatabaseContext(PagePermission.PA);

      renderModal(booking, context);

      const editButton = screen.getByLabelText("Edit cart number");
      await user.click(editButton);

      expect(
        screen.getByPlaceholderText("Enter cart number")
      ).toBeInTheDocument();
      expect(screen.getByDisplayValue("CART123")).toBeInTheDocument();
    });

    it("shows save and cancel buttons in edit mode", async () => {
      const user = userEvent.setup();
      const booking = createMockBooking({ webcheckoutCartNumber: "CART123" });
      const context = createMockDatabaseContext(PagePermission.PA);

      renderModal(booking, context);

      const editButton = screen.getByLabelText("Edit cart number");
      await user.click(editButton);

      // Check for save button (Check icon)
      expect(screen.getByTestId("CheckIcon")).toBeInTheDocument();
      // Check for cancel button (Cancel icon)
      expect(screen.getByTestId("CancelIcon")).toBeInTheDocument();
    });

    it("cancels edit and restores original value", async () => {
      const user = userEvent.setup();
      const booking = createMockBooking({ webcheckoutCartNumber: "CART123" });
      const context = createMockDatabaseContext(PagePermission.PA);

      renderModal(booking, context);

      // Enter edit mode
      const editButton = screen.getByLabelText("Edit cart number");
      await user.click(editButton);

      // Change the value
      const textField = screen.getByPlaceholderText("Enter cart number");
      await user.clear(textField);
      await user.type(textField, "CART456");

      // Cancel edit
      const cancelButton = screen.getByTestId("CancelIcon").closest("button")!;
      await user.click(cancelButton);

      // Should show original value
      expect(screen.getByRole("link", { name: "CART123" })).toBeInTheDocument();
    });

    it("saves new cart number successfully", async () => {
      const user = userEvent.setup();
      const booking = createMockBooking({ webcheckoutCartNumber: "CART123" });
      const context = createMockDatabaseContext(
        PagePermission.PA,
        "admin@nyu.edu"
      );

      renderModal(booking, context);

      // Enter edit mode
      const editButton = screen.getByLabelText("Edit cart number");
      await user.click(editButton);

      // Change the value
      const textField = screen.getByPlaceholderText("Enter cart number");
      await user.clear(textField);
      await user.type(textField, "CART456");

      // Save
      const saveButton = screen.getByTestId("CheckIcon").closest("button")!;
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith("/api/updateWebcheckoutCart", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            calendarEventId: "cal-event-1",
            cartNumber: "CART456",
            userEmail: "admin@nyu.edu",
          }),
        });
      });
    });

    it("handles save error gracefully", async () => {
      const user = userEvent.setup();
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: "Cart number already exists" }),
      });

      const booking = createMockBooking({ webcheckoutCartNumber: "CART123" });
      const context = createMockDatabaseContext(PagePermission.PA);

      renderModal(booking, context);

      // Enter edit mode and change value
      const editButton = screen.getByLabelText("Edit cart number");
      await user.click(editButton);

      const textField = screen.getByPlaceholderText("Enter cart number");
      await user.clear(textField);
      await user.type(textField, "CART456");

      // Save
      const saveButton = screen.getByTestId("CheckIcon").closest("button")!;
      await user.click(saveButton);

      await waitFor(() => {
        expect(global.alert).toHaveBeenCalledWith(
          "Error: Cart number already exists"
        );
      });
    });

    it("handles network error gracefully", async () => {
      const user = userEvent.setup();
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const booking = createMockBooking({ webcheckoutCartNumber: "CART123" });
      const context = createMockDatabaseContext(PagePermission.PA);

      renderModal(booking, context);

      // Enter edit mode and change value
      const editButton = screen.getByLabelText("Edit cart number");
      await user.click(editButton);

      const textField = screen.getByPlaceholderText("Enter cart number");
      await user.clear(textField);
      await user.type(textField, "CART456");

      // Save
      const saveButton = screen.getByTestId("CheckIcon").closest("button")!;
      await user.click(saveButton);

      await waitFor(() => {
        expect(global.alert).toHaveBeenCalledWith(
          "Failed to update cart number"
        );
      });
    });

    it("disables buttons during update", async () => {
      const user = userEvent.setup();
      // Create a delayed response to test loading state
      const delayedResponse = new Promise((resolve) =>
        setTimeout(
          () =>
            resolve({
              ok: true,
              json: () => Promise.resolve({}),
            }),
          100
        )
      );
      mockFetch.mockReturnValueOnce(delayedResponse);

      const booking = createMockBooking({ webcheckoutCartNumber: "CART123" });
      const context = createMockDatabaseContext(PagePermission.PA);

      renderModal(booking, context);

      // Enter edit mode
      const editButton = screen.getByLabelText("Edit cart number");
      await user.click(editButton);

      // Save
      const saveButton = screen.getByTestId("CheckIcon").closest("button")!;
      await user.click(saveButton);

      // Check that buttons are disabled during update
      expect(saveButton).toBeDisabled();
      expect(screen.getByTestId("CancelIcon").closest("button")).toBeDisabled();
      expect(screen.getByPlaceholderText("Enter cart number")).toBeDisabled();

      // Wait for completion
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });
    });
  });

  describe("Data Display", () => {
    it("handles missing optional fields gracefully", () => {
      const booking = createMockBooking({
        requestNumber: 0,
        secondaryName: "",
        sponsorFirstName: "",
        sponsorLastName: "",
        sponsorEmail: "",
      });
      const context = createMockDatabaseContext(PagePermission.BOOKING);

      renderModal(booking, context);

      expect(screen.getAllByText("0")).toHaveLength(2); // Request number shows 0 in header and history
      // Check that component handles empty fields gracefully
      expect(screen.getByText("Request Number:")).toBeInTheDocument();
    });

    it("displays all booking details correctly", () => {
      const booking = createMockBooking({
        title: "Advanced Workshop",
        description: "Detailed description here",
        expectedAttendance: "50",
        bookingType: "Workshop",
        roomSetup: "Theater style",
        mediaServices: "Audio/Visual",
      });
      const context = createMockDatabaseContext(PagePermission.BOOKING);

      renderModal(booking, context);

      expect(screen.getByText("Advanced Workshop")).toBeInTheDocument();
      expect(screen.getByText("Detailed description here")).toBeInTheDocument();
      expect(screen.getByText("50")).toBeInTheDocument();
      expect(screen.getByText("Workshop")).toBeInTheDocument();
      expect(screen.getByText("Theater style")).toBeInTheDocument();
      expect(screen.getByText("Audio/Visual")).toBeInTheDocument();
    });

    it("formats dates and times correctly", () => {
      const booking = createMockBooking({
        startDate: Timestamp.fromDate(new Date("2024-06-15T14:30:00")),
        endDate: Timestamp.fromDate(new Date("2024-06-15T16:45:00")),
      });
      const context = createMockDatabaseContext(PagePermission.BOOKING);

      renderModal(booking, context);

      expect(screen.getAllByText("6/15/2024")).toHaveLength(2); // Header and history
      expect(screen.getAllByText("2:30 PM - 4:45 PM")).toHaveLength(2); // Header and history
    });
  });

  describe("Accessibility", () => {
    it("has proper modal accessibility attributes", () => {
      const booking = createMockBooking();
      const context = createMockDatabaseContext(PagePermission.BOOKING);

      renderModal(booking, context);

      const modal = screen.getByRole("presentation");
      expect(modal).toBeInTheDocument();
    });

    it("has proper tooltip for edit button", () => {
      const booking = createMockBooking({ webcheckoutCartNumber: "CART123" });
      const context = createMockDatabaseContext(PagePermission.PA);

      renderModal(booking, context);

      const editButton = screen.getByLabelText("Edit cart number");
      expect(editButton).toBeInTheDocument();
    });

    it("has proper link attributes for external cart link", () => {
      const booking = createMockBooking({ webcheckoutCartNumber: "CART123" });
      const context = createMockDatabaseContext(PagePermission.PA);

      renderModal(booking, context);

      const cartLink = screen.getByRole("link", { name: "CART123" });
      expect(cartLink).toHaveAttribute("rel", "noopener noreferrer");
      expect(cartLink).toHaveAttribute("target", "_blank");
    });
  });
});
