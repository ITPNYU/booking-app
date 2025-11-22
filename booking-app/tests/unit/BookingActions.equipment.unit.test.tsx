import { ThemeProvider, createTheme } from "@mui/material/styles";
import { render, screen } from "@testing-library/react";
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
    },
    default: vi.fn(),
  })
);

// Mock server functions
vi.mock("../../components/src/server/db", () => ({
  decline: vi.fn(),
}));

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
  userEmail: "equipment@nyu.edu",
  netId: "eq123",
  pagePermission: "EQUIPMENT",
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
  status: BookingStatusLabel.EQUIPMENT,
  calendarEventId: "test-event-123",
  startDate: Timestamp.fromDate(new Date("2024-02-15T10:00:00Z")),
  onSelect: vi.fn(),
  setOptimisticStatus: vi.fn(),
  pageContext: PageContextLevel.SERVICES,
};

const renderBookingActionsComponent = (props = {}, contextOverrides = {}) => {
  const finalProps = { ...defaultProps, ...props };
  const databaseContext = { ...mockDatabaseContext, ...contextOverrides };

  return render(
    <ThemeProvider theme={theme}>
      <DatabaseContext.Provider value={databaseContext as any}>
        <SchemaContext.Provider value={mockSchemaContext}>
          <BookingContext.Provider value={mockBookingContext as any}>
            <BookingActions {...finalProps} />
          </BookingContext.Provider>
        </SchemaContext.Provider>
      </DatabaseContext.Provider>
    </ThemeProvider>
  );
};

describe("BookingActions Component - Equipment Context", () => {
  const mockUseBookingActions = vi.mocked(useBookingActions);

  beforeEach(() => {
    vi.clearAllMocks();

    (useRouter as any).mockReturnValue(mockRouter);
    (useParams as any).mockReturnValue(mockParams);

    // Mock the useBookingActions hook to return equipment-specific options with all actions
    mockUseBookingActions.mockReturnValue({
      actions: {
        [Actions.CANCEL]: {
          action: vi.fn(),
          optimisticNextStatus: BookingStatusLabel.CANCELED,
          confirmation: true,
        },
        [Actions.NO_SHOW]: {
          action: vi.fn(),
          optimisticNextStatus: BookingStatusLabel.NO_SHOW,
        },
        [Actions.CHECK_IN]: {
          action: vi.fn(),
          optimisticNextStatus: BookingStatusLabel.CHECKED_IN,
        },
        [Actions.CHECK_OUT]: {
          action: vi.fn(),
          optimisticNextStatus: BookingStatusLabel.CHECKED_OUT,
        },
        [Actions.FIRST_APPROVE]: {
          action: vi.fn(),
          optimisticNextStatus: BookingStatusLabel.PENDING,
        },
        [Actions.FINAL_APPROVE]: {
          action: vi.fn(),
          optimisticNextStatus: BookingStatusLabel.APPROVED,
        },
        [Actions.EQUIPMENT_APPROVE]: {
          action: vi.fn(),
          optimisticNextStatus: BookingStatusLabel.APPROVED,
        },
        [Actions.SEND_TO_EQUIPMENT]: {
          action: vi.fn(),
          optimisticNextStatus: BookingStatusLabel.EQUIPMENT,
        },
        [Actions.DECLINE]: {
          action: vi.fn(),
          optimisticNextStatus: BookingStatusLabel.DECLINED,
          confirmation: true,
        },
        [Actions.EDIT]: {
          action: vi.fn(),
          optimisticNextStatus: BookingStatusLabel.UNKNOWN,
          confirmation: false,
        },
        [Actions.MODIFICATION]: {
          action: vi.fn(),
          optimisticNextStatus: BookingStatusLabel.MODIFIED,
          confirmation: false,
        },
        [Actions.PLACEHOLDER]: {
          action: vi.fn(),
          optimisticNextStatus: BookingStatusLabel.UNKNOWN,
        },
      },
      updateActions: vi.fn(),
      options: vi.fn().mockReturnValue([Actions.MODIFICATION, Actions.DECLINE]),
    });
  });

  describe("Equipment Context Actions", () => {
    it("should show correct actions for equipment context", async () => {
      const user = userEvent.setup();
      renderBookingActionsComponent();

      // Open the select to see the options
      const selectElement = screen.getByRole("combobox");
      await user.click(selectElement);

      // Equipment context should show Modification and Decline actions
      expect(screen.getByText("Modification")).toBeInTheDocument();
      expect(screen.getByText("Decline")).toBeInTheDocument();
    });

    it("should not show Equipment Approve action in current implementation", async () => {
      const user = userEvent.setup();
      renderBookingActionsComponent();

      // Open the select to see the options
      const selectElement = screen.getByRole("combobox");
      await user.click(selectElement);

      // Equipment actions are currently disabled (empty array)
      expect(screen.queryByText("Equipment Approve")).not.toBeInTheDocument();
    });

    it("should not show admin-only actions", async () => {
      const user = userEvent.setup();
      renderBookingActionsComponent();

      // Open the select to see the options
      const selectElement = screen.getByRole("combobox");
      await user.click(selectElement);

      const adminActions = ["1st Approve", "Final Approve", "Cancel"];

      adminActions.forEach((action) => {
        expect(screen.queryByText(action)).not.toBeInTheDocument();
      });
    });

    it("should not show PA-only actions", async () => {
      const user = userEvent.setup();
      renderBookingActionsComponent();

      // Open the select to see the options
      const selectElement = screen.getByRole("combobox");
      await user.click(selectElement);

      const paActions = ["Check In", "Check Out", "No Show"];

      paActions.forEach((action) => {
        expect(screen.queryByText(action)).not.toBeInTheDocument();
      });
    });
  });

  describe("Action Interactions", () => {
    it("should handle Modification action click", async () => {
      const user = userEvent.setup();
      const mockModificationAction = vi.fn();

      mockUseBookingActions.mockReturnValue({
        actions: {
          [Actions.CANCEL]: {
            action: vi.fn(),
            optimisticNextStatus: BookingStatusLabel.CANCELED,
            confirmation: true,
          },
          [Actions.NO_SHOW]: {
            action: vi.fn(),
            optimisticNextStatus: BookingStatusLabel.NO_SHOW,
          },
          [Actions.CHECK_IN]: {
            action: vi.fn(),
            optimisticNextStatus: BookingStatusLabel.CHECKED_IN,
          },
          [Actions.CHECK_OUT]: {
            action: vi.fn(),
            optimisticNextStatus: BookingStatusLabel.CHECKED_OUT,
          },
          [Actions.FIRST_APPROVE]: {
            action: vi.fn(),
            optimisticNextStatus: BookingStatusLabel.PENDING,
          },
          [Actions.FINAL_APPROVE]: {
            action: vi.fn(),
            optimisticNextStatus: BookingStatusLabel.APPROVED,
          },
          [Actions.EQUIPMENT_APPROVE]: {
            action: vi.fn(),
            optimisticNextStatus: BookingStatusLabel.APPROVED,
          },
          [Actions.SEND_TO_EQUIPMENT]: {
            action: vi.fn(),
            optimisticNextStatus: BookingStatusLabel.EQUIPMENT,
          },
          [Actions.DECLINE]: {
            action: vi.fn(),
            optimisticNextStatus: BookingStatusLabel.DECLINED,
            confirmation: true,
          },
          [Actions.EDIT]: {
            action: vi.fn(),
            optimisticNextStatus: BookingStatusLabel.UNKNOWN,
            confirmation: false,
          },
          [Actions.MODIFICATION]: {
            action: mockModificationAction,
            optimisticNextStatus: BookingStatusLabel.MODIFIED,
            confirmation: false,
          },
          [Actions.PLACEHOLDER]: {
            action: vi.fn(),
            optimisticNextStatus: BookingStatusLabel.UNKNOWN,
          },
        },
        updateActions: vi.fn(),
        options: vi
          .fn()
          .mockReturnValue([Actions.MODIFICATION, Actions.DECLINE]),
      });

      renderBookingActionsComponent();

      // Open the select to see the options
      const selectElement = screen.getByRole("combobox");
      await user.click(selectElement);

      const modificationButton = screen.getByText("Modification");
      await user.click(modificationButton);

      // After selecting an option, click the check button to trigger the action
      const checkButton = screen.getByTestId("CheckIcon").closest("button");
      await user.click(checkButton);

      expect(mockModificationAction).toHaveBeenCalledTimes(1);
    });

    it("should handle Decline action with confirmation", async () => {
      const user = userEvent.setup();
      const mockDeclineAction = vi.fn();

      mockUseBookingActions.mockReturnValue({
        actions: {
          [Actions.CANCEL]: {
            action: vi.fn(),
            optimisticNextStatus: BookingStatusLabel.CANCELED,
            confirmation: true,
          },
          [Actions.NO_SHOW]: {
            action: vi.fn(),
            optimisticNextStatus: BookingStatusLabel.NO_SHOW,
          },
          [Actions.CHECK_IN]: {
            action: vi.fn(),
            optimisticNextStatus: BookingStatusLabel.CHECKED_IN,
          },
          [Actions.CHECK_OUT]: {
            action: vi.fn(),
            optimisticNextStatus: BookingStatusLabel.CHECKED_OUT,
          },
          [Actions.FIRST_APPROVE]: {
            action: vi.fn(),
            optimisticNextStatus: BookingStatusLabel.PENDING,
          },
          [Actions.FINAL_APPROVE]: {
            action: vi.fn(),
            optimisticNextStatus: BookingStatusLabel.APPROVED,
          },
          [Actions.EQUIPMENT_APPROVE]: {
            action: vi.fn(),
            optimisticNextStatus: BookingStatusLabel.APPROVED,
          },
          [Actions.SEND_TO_EQUIPMENT]: {
            action: vi.fn(),
            optimisticNextStatus: BookingStatusLabel.EQUIPMENT,
          },
          [Actions.DECLINE]: {
            action: mockDeclineAction,
            optimisticNextStatus: BookingStatusLabel.DECLINED,
            confirmation: true,
          },
          [Actions.EDIT]: {
            action: vi.fn(),
            optimisticNextStatus: BookingStatusLabel.UNKNOWN,
            confirmation: false,
          },
          [Actions.MODIFICATION]: {
            action: vi.fn(),
            optimisticNextStatus: BookingStatusLabel.MODIFIED,
            confirmation: false,
          },
          [Actions.PLACEHOLDER]: {
            action: vi.fn(),
            optimisticNextStatus: BookingStatusLabel.UNKNOWN,
          },
        },
        updateActions: vi.fn(),
        options: vi
          .fn()
          .mockReturnValue([Actions.MODIFICATION, Actions.DECLINE]),
      });

      renderBookingActionsComponent();

      // Open the select to see the options
      const selectElement = screen.getByRole("combobox");
      await user.click(selectElement);

      const declineButton = screen.getByText("Decline");
      expect(declineButton).toBeInTheDocument();

      // Note: Full confirmation dialog testing would require mocking the confirmation component
    });
  });

  describe("Status-specific behavior", () => {
    it("should show appropriate actions for EQUIPMENT status", async () => {
      const user = userEvent.setup();
      renderBookingActionsComponent({
        status: BookingStatusLabel.EQUIPMENT,
      });

      // Open the select to see the options
      const selectElement = screen.getByRole("combobox");
      await user.click(selectElement);

      // Equipment status should show modification and decline
      expect(screen.getByText("Modification")).toBeInTheDocument();
      expect(screen.getByText("Decline")).toBeInTheDocument();
    });

    it("should handle different equipment booking statuses appropriately", async () => {
      const user = userEvent.setup();
      const statuses = [
        BookingStatusLabel.EQUIPMENT,
        BookingStatusLabel.APPROVED,
        BookingStatusLabel.DECLINED,
      ];

      for (const status of statuses) {
        const { unmount } = renderBookingActionsComponent({
          status,
        });

        // Open the select to see the options
        const selectElement = screen.getByRole("combobox");
        await user.click(selectElement);

        // Should render without crashing for any status
        expect(screen.getByText("Modification")).toBeInTheDocument();

        unmount();
      }
    });
  });

  describe("Equipment Context Props", () => {
    it("should pass correct pageContext to useBookingActions", () => {
      renderBookingActionsComponent();

      expect(mockUseBookingActions).toHaveBeenCalledWith(
        expect.objectContaining({
          pageContext: PageContextLevel.SERVICES,
        })
      );
    });

    it("should pass equipment-specific props correctly", () => {
      renderBookingActionsComponent({
        calendarEventId: "equipment-event-456",
        status: BookingStatusLabel.EQUIPMENT,
      });

      expect(mockUseBookingActions).toHaveBeenCalledWith(
        expect.objectContaining({
          calendarEventId: "equipment-event-456",
          status: BookingStatusLabel.EQUIPMENT,
          pageContext: PageContextLevel.SERVICES,
        })
      );
    });
  });

  describe("Loading and Error States", () => {
    it("should handle loading state gracefully", async () => {
      const user = userEvent.setup();
      renderBookingActionsComponent({}, { bookingsLoading: true });

      // Open the select to see the options
      const selectElement = screen.getByRole("combobox");
      await user.click(selectElement);

      // Component should render even during loading
      expect(screen.getByText("Modification")).toBeInTheDocument();
    });

    it("should render without actions if options are empty", () => {
      mockUseBookingActions.mockReturnValue({
        actions: {
          [Actions.CANCEL]: {
            action: vi.fn(),
            optimisticNextStatus: BookingStatusLabel.CANCELED,
            confirmation: true,
          },
          [Actions.NO_SHOW]: {
            action: vi.fn(),
            optimisticNextStatus: BookingStatusLabel.NO_SHOW,
          },
          [Actions.CHECK_IN]: {
            action: vi.fn(),
            optimisticNextStatus: BookingStatusLabel.CHECKED_IN,
          },
          [Actions.CHECK_OUT]: {
            action: vi.fn(),
            optimisticNextStatus: BookingStatusLabel.CHECKED_OUT,
          },
          [Actions.FIRST_APPROVE]: {
            action: vi.fn(),
            optimisticNextStatus: BookingStatusLabel.PENDING,
          },
          [Actions.FINAL_APPROVE]: {
            action: vi.fn(),
            optimisticNextStatus: BookingStatusLabel.APPROVED,
          },
          [Actions.EQUIPMENT_APPROVE]: {
            action: vi.fn(),
            optimisticNextStatus: BookingStatusLabel.APPROVED,
          },
          [Actions.SEND_TO_EQUIPMENT]: {
            action: vi.fn(),
            optimisticNextStatus: BookingStatusLabel.EQUIPMENT,
          },
          [Actions.DECLINE]: {
            action: vi.fn(),
            optimisticNextStatus: BookingStatusLabel.DECLINED,
            confirmation: true,
          },
          [Actions.EDIT]: {
            action: vi.fn(),
            optimisticNextStatus: BookingStatusLabel.UNKNOWN,
            confirmation: false,
          },
          [Actions.MODIFICATION]: {
            action: vi.fn(),
            optimisticNextStatus: BookingStatusLabel.MODIFIED,
            confirmation: false,
          },
          [Actions.PLACEHOLDER]: {
            action: vi.fn(),
            optimisticNextStatus: BookingStatusLabel.UNKNOWN,
          },
        },
        updateActions: vi.fn(),
        options: vi.fn().mockReturnValue([]), // Empty options array
      });

      renderBookingActionsComponent();

      // Should not show any action buttons - component returns empty fragment when no options
      expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    });
  });

  describe("Integration with Equipment Workflow", () => {
    it("should integrate properly with equipment-specific booking flow", async () => {
      const user = userEvent.setup();
      renderBookingActionsComponent({
        status: BookingStatusLabel.EQUIPMENT,
        pageContext: PageContextLevel.SERVICES,
      });

      // Open the select to see the options
      const selectElement = screen.getByRole("combobox");
      await user.click(selectElement);

      // Should show equipment-appropriate actions
      expect(screen.getByText("Modification")).toBeInTheDocument();
      expect(screen.getByText("Decline")).toBeInTheDocument();

      // Should not show workflow actions not relevant to equipment
      expect(screen.queryByText("1st Approve")).not.toBeInTheDocument();
      expect(screen.queryByText("Final Approve")).not.toBeInTheDocument();
      expect(screen.queryByText("Check In")).not.toBeInTheDocument();
    });

    it("should maintain equipment context consistency", () => {
      renderBookingActionsComponent({
        pageContext: PageContextLevel.SERVICES,
      });

      // Context should remain EQUIPMENT throughout the component lifecycle
      expect(mockUseBookingActions).toHaveBeenCalledWith(
        expect.objectContaining({
          pageContext: PageContextLevel.SERVICES,
        })
      );
    });
  });
});
