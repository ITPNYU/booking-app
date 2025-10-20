import { ThemeProvider, createTheme } from "@mui/material/styles";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Timestamp } from "firebase/firestore";
import { useParams, useRouter } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";
import BookingActions from "../../components/src/client/routes/admin/components/BookingActions";
import useBookingActions, {
  Actions,
} from "../../components/src/client/routes/admin/hooks/useBookingActions";
import { BookingContext } from "../../components/src/client/routes/booking/bookingProvider";
import { DatabaseContext } from "../../components/src/client/routes/components/Provider";
import { SchemaContext } from "../../components/src/client/routes/components/SchemaProvider";
import {
  BookingStatusLabel,
  PageContextLevel,
} from "../../components/src/types";

// Mock Next.js navigation
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
  useParams: vi.fn(),
}));

// Mock the booking actions hook
vi.mock(
  "../../components/src/client/routes/admin/hooks/useBookingActions",
  () => ({
    Actions: {
      MODIFICATION: "Modification",
      DECLINE: "Decline",
      EQUIPMENT_APPROVE: "Equipment Approve",
      PLACEHOLDER: "placeholder",
      CANCEL: "Cancel",
      NO_SHOW: "No Show",
      CHECK_IN: "Check In",
      CHECK_OUT: "Check Out",
      FIRST_APPROVE: "First Approve",
      FINAL_APPROVE: "Final Approve",
      SEND_TO_EQUIPMENT: "Send to Equipment",
      EDIT: "Edit",
    },
    default: vi.fn(),
  })
);

const theme = createTheme();

const mockRouter = {
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
};

const mockParams = {
  tenant: "media-commons",
};

const mockDatabaseContext = {
  userEmail: "admin@nyu.edu",
  netId: "admin123",
  pagePermission: "LIAISON",
  bookingsLoading: false,
  allBookings: [],
  reloadFutureBookings: vi.fn(),
};

const mockSchemaContext = {
  resourceName: "Room",
  schema: {} as any,
};

const mockBookingContext = {
  reloadExistingCalendarEvents: vi.fn(),
};

const defaultProps = {
  status: BookingStatusLabel.REQUESTED,
  calendarEventId: "test-event-123",
  startDate: Timestamp.fromDate(new Date("2024-02-15T10:00:00Z")),
  onSelect: vi.fn(),
  setOptimisticStatus: vi.fn(),
  pageContext: PageContextLevel.LIAISON,
};

const mockUseBookingActions = useBookingActions as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  (useRouter as ReturnType<typeof vi.fn>).mockReturnValue(mockRouter);
  (useParams as ReturnType<typeof vi.fn>).mockReturnValue(mockParams);
});

const renderBookingActionsComponent = (props = {}) => {
  return render(
    <ThemeProvider theme={theme}>
      <DatabaseContext.Provider value={mockDatabaseContext as any}>
        <SchemaContext.Provider value={mockSchemaContext}>
          <BookingContext.Provider value={mockBookingContext as any}>
            <BookingActions {...defaultProps} {...props} />
          </BookingContext.Provider>
        </SchemaContext.Provider>
      </DatabaseContext.Provider>
    </ThemeProvider>
  );
};

describe("DeclineReasonDialog - Decline Reason Entry", () => {
  it("should show decline reason dialog when Decline action is selected", async () => {
    const user = userEvent.setup();
    const mockDeclineAction = vi.fn();

    mockUseBookingActions.mockReturnValue({
      actions: {
        [Actions.DECLINE]: {
          action: mockDeclineAction,
          optimisticNextStatus: BookingStatusLabel.DECLINED,
        },
      },
      updateActions: vi.fn(),
      options: vi.fn().mockReturnValue([Actions.DECLINE]),
    });

    renderBookingActionsComponent();

    // Open the select dropdown
    const selectElement = screen.getByRole("combobox");
    await user.click(selectElement);

    // Select the Decline option
    const declineOption = screen.getByText("Decline");
    await user.click(declineOption);

    // Wait for the check button to appear and click it to open the dialog
    await waitFor(() => {
      const checkButton = screen.getByTestId("CheckIcon").parentElement;
      expect(checkButton).toBeInTheDocument();
    });

    const checkButton = screen.getByTestId("CheckIcon").parentElement;
    await user.click(checkButton);

    // Wait for the dialog to appear
    await waitFor(() => {
      expect(
        screen.getByText("Please give a reason for declining this request.")
      ).toBeInTheDocument();
    });

    // Verify the dialog has a text field for entering a reason
    const textField = screen.getByRole("textbox");
    expect(textField).toBeInTheDocument();
  });

  it("should allow entering a decline reason and confirm button is disabled without reason", async () => {
    const user = userEvent.setup();
    const mockDeclineAction = vi.fn();

    mockUseBookingActions.mockReturnValue({
      actions: {
        [Actions.DECLINE]: {
          action: mockDeclineAction,
          optimisticNextStatus: BookingStatusLabel.DECLINED,
        },
      },
      updateActions: vi.fn(),
      options: vi.fn().mockReturnValue([Actions.DECLINE]),
    });

    renderBookingActionsComponent();

    // Open the select dropdown
    const selectElement = screen.getByRole("combobox");
    await user.click(selectElement);

    // Select the Decline option
    const declineOption = screen.getByText("Decline");
    await user.click(declineOption);

    // Wait for the check button and click it
    await waitFor(() => {
      const checkButton = screen.getByTestId("CheckIcon").parentElement;
      expect(checkButton).toBeInTheDocument();
    });

    const checkButton = screen.getByTestId("CheckIcon").parentElement;
    await user.click(checkButton);

    // Wait for dialog
    await waitFor(() => {
      expect(screen.getByRole("textbox")).toBeInTheDocument();
    });

    // The Ok button should be disabled when no reason is entered
    const okButton = screen.getByRole("button", { name: /ok/i });
    expect(okButton).toBeDisabled();
  });

  it("should enable confirm button when decline reason is entered", async () => {
    const user = userEvent.setup();
    const mockDeclineAction = vi.fn();

    mockUseBookingActions.mockReturnValue({
      actions: {
        [Actions.DECLINE]: {
          action: mockDeclineAction,
          optimisticNextStatus: BookingStatusLabel.DECLINED,
        },
      },
      updateActions: vi.fn(),
      options: vi.fn().mockReturnValue([Actions.DECLINE]),
    });

    renderBookingActionsComponent();

    // Open the select dropdown
    const selectElement = screen.getByRole("combobox");
    await user.click(selectElement);

    // Select the Decline option
    const declineOption = screen.getByText("Decline");
    await user.click(declineOption);

    // Wait for the check button and click it
    await waitFor(() => {
      const checkButton = screen.getByTestId("CheckIcon").parentElement;
      expect(checkButton).toBeInTheDocument();
    });

    const checkButton = screen.getByTestId("CheckIcon").parentElement;
    await user.click(checkButton);

    // Wait for dialog
    await waitFor(() => {
      expect(screen.getByRole("textbox")).toBeInTheDocument();
    });

    // Enter a decline reason
    const textField = screen.getByRole("textbox");
    await user.type(textField, "Room is not available for requested time");

    // The Ok button should now be enabled
    const okButton = screen.getByRole("button", { name: /ok/i });
    expect(okButton).not.toBeDisabled();
  });

  it("should call decline action with reason when Ok is clicked", async () => {
    const user = userEvent.setup();
    const mockDeclineAction = vi.fn().mockResolvedValue(undefined);

    mockUseBookingActions.mockReturnValue({
      actions: {
        [Actions.DECLINE]: {
          action: mockDeclineAction,
          optimisticNextStatus: BookingStatusLabel.DECLINED,
        },
      },
      updateActions: vi.fn(),
      options: vi.fn().mockReturnValue([Actions.DECLINE]),
    });

    renderBookingActionsComponent();

    // Open the select dropdown
    const selectElement = screen.getByRole("combobox");
    await user.click(selectElement);

    // Select the Decline option
    const declineOption = screen.getByText("Decline");
    await user.click(declineOption);

    // Wait for the check button and click it
    await waitFor(() => {
      const checkButton = screen.getByTestId("CheckIcon").parentElement;
      expect(checkButton).toBeInTheDocument();
    });

    const checkButton = screen.getByTestId("CheckIcon").parentElement;
    await user.click(checkButton);

    // Wait for dialog
    await waitFor(() => {
      expect(screen.getByRole("textbox")).toBeInTheDocument();
    });

    // Enter a decline reason
    const textField = screen.getByRole("textbox");
    const declineReason = "Event does not meet booking requirements";
    await user.type(textField, declineReason);

    // Click Ok button
    const okButton = screen.getByRole("button", { name: /ok/i });
    await user.click(okButton);

    // Verify the decline action was called
    await waitFor(() => {
      expect(mockDeclineAction).toHaveBeenCalled();
    });
  });

  it("should cancel decline when Cancel button is clicked", async () => {
    const user = userEvent.setup();
    const mockDeclineAction = vi.fn();

    mockUseBookingActions.mockReturnValue({
      actions: {
        [Actions.DECLINE]: {
          action: mockDeclineAction,
          optimisticNextStatus: BookingStatusLabel.DECLINED,
        },
      },
      updateActions: vi.fn(),
      options: vi.fn().mockReturnValue([Actions.DECLINE]),
    });

    renderBookingActionsComponent();

    // Open the select dropdown
    const selectElement = screen.getByRole("combobox");
    await user.click(selectElement);

    // Select the Decline option
    const declineOption = screen.getByText("Decline");
    await user.click(declineOption);

    // Wait for the check button and click it
    await waitFor(() => {
      const checkButton = screen.getByTestId("CheckIcon").parentElement;
      expect(checkButton).toBeInTheDocument();
    });

    const checkButton = screen.getByTestId("CheckIcon").parentElement;
    await user.click(checkButton);

    // Wait for dialog
    await waitFor(() => {
      expect(screen.getByRole("textbox")).toBeInTheDocument();
    });

    // Enter a decline reason
    const textField = screen.getByRole("textbox");
    await user.type(textField, "Some reason");

    // Click Cancel button
    const cancelButton = screen.getByRole("button", { name: /cancel/i });
    await user.click(cancelButton);

    // Verify the decline action was NOT called
    expect(mockDeclineAction).not.toHaveBeenCalled();

    // Verify dialog is closed
    await waitFor(() => {
      expect(
        screen.queryByText("Please give a reason for declining this request.")
      ).not.toBeInTheDocument();
    });
  });

  it("should show decline reason dialog for service decline actions", async () => {
    const user = userEvent.setup();
    const mockDeclineStaffAction = vi.fn();

    // Simulate a service-specific decline action like "Decline Staff"
    mockUseBookingActions.mockReturnValue({
      actions: {
        "Decline Staff": {
          action: mockDeclineStaffAction,
          optimisticNextStatus: BookingStatusLabel.DECLINED,
        },
      },
      updateActions: vi.fn(),
      options: vi.fn().mockReturnValue(["Decline Staff"]),
    });

    renderBookingActionsComponent({
      pageContext: PageContextLevel.SERVICES,
    });

    // Open the select dropdown
    const selectElement = screen.getByRole("combobox");
    await user.click(selectElement);

    // Select the service decline option
    const declineStaffOption = screen.getByText("Decline Staff");
    await user.click(declineStaffOption);

    // Wait for the check button to appear and click it to open the dialog
    await waitFor(() => {
      const checkButton = screen.getByTestId("CheckIcon").parentElement;
      expect(checkButton).toBeInTheDocument();
    });

    const checkButton = screen.getByTestId("CheckIcon").parentElement;
    await user.click(checkButton);

    // Wait for the dialog to appear
    await waitFor(() => {
      expect(
        screen.getByText("Please give a reason for declining this request.")
      ).toBeInTheDocument();
    });

    // Verify the dialog has a text field for entering a reason
    const textField = screen.getByRole("textbox");
    expect(textField).toBeInTheDocument();

    // Enter a decline reason
    await user.type(textField, "Staff not available for this event");

    // The Ok button should be enabled
    const okButton = screen.getByRole("button", { name: /ok/i });
    expect(okButton).not.toBeDisabled();
  });
});
