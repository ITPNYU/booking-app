import { ThemeProvider, createTheme } from "@mui/material/styles";
import { render, screen, within } from "@testing-library/react";
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
      CANCEL: "Cancel",
      EDIT: "Edit",
      DECLINE: "Decline",
      CHECK_IN: "Check In",
      PLACEHOLDER: "Placeholder",
    },
    default: vi.fn(),
  })
);

// Mock server functions
vi.mock("../../components/src/server/db", () => ({
  cancel: vi.fn(),
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
  userEmail: "test@nyu.edu",
  netId: "test123",
  pagePermission: "ADMIN",
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
  pageContext: PageContextLevel.USER,
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

describe("BookingActions Component - Edit Logic", () => {
  const mockUseBookingActions = vi.mocked(useBookingActions);

  beforeEach(() => {
    vi.clearAllMocks();
    (useRouter as any).mockReturnValue(mockRouter);
    (useParams as any).mockReturnValue(mockParams);
  });

  const setupMockActions = (actionsList: string[]) => {
    mockUseBookingActions.mockReturnValue({
      actions: {
        [Actions.CANCEL]: {
          action: vi.fn(),
          optimisticNextStatus: BookingStatusLabel.CANCELED,
          confirmation: true,
        },
        [Actions.EDIT]: {
          action: vi.fn(),
          optimisticNextStatus: BookingStatusLabel.UNKNOWN,
          confirmation: false,
        },
        [Actions.DECLINE]: {
          action: vi.fn(),
          optimisticNextStatus: BookingStatusLabel.DECLINED,
          confirmation: true,
        },
        [Actions.CHECK_IN]: {
          action: vi.fn(),
          optimisticNextStatus: BookingStatusLabel.CHECKED_IN,
        },
        [Actions.PLACEHOLDER]: {
          action: vi.fn(),
          optimisticNextStatus: BookingStatusLabel.UNKNOWN,
        },
      },
      updateActions: vi.fn(),
      options: vi.fn().mockReturnValue(actionsList),
    });
  };

  it("should enable Edit action for REQUESTED bookings", async () => {
    setupMockActions([Actions.CANCEL, Actions.EDIT]);
    const user = userEvent.setup();

    renderBookingActionsComponent({
      status: BookingStatusLabel.REQUESTED,
      pageContext: PageContextLevel.USER,
    });

    // Open dropdown
    const selectElement = screen.getByRole("combobox");
    await user.click(selectElement);

    // Verify Edit is present and NOT disabled
    const editOption = screen.getByRole("option", { name: "Edit" });
    expect(editOption).toBeInTheDocument();
    expect(editOption).not.toHaveAttribute("aria-disabled", "true");
  });

  it("should enable Edit action for DECLINED bookings", async () => {
    setupMockActions([Actions.CANCEL, Actions.EDIT]);
    const user = userEvent.setup();

    renderBookingActionsComponent({
      status: BookingStatusLabel.DECLINED,
      pageContext: PageContextLevel.USER,
    });

    // Open dropdown
    const selectElement = screen.getByRole("combobox");
    await user.click(selectElement);

    // Verify Edit is present and NOT disabled
    const editOption = screen.getByRole("option", { name: "Edit" });
    expect(editOption).toBeInTheDocument();
    expect(editOption).not.toHaveAttribute("aria-disabled", "true");
  });

  it("should disable (grey out) Edit action for PRE_APPROVED bookings", async () => {
    setupMockActions([Actions.CANCEL, Actions.EDIT]);
    const user = userEvent.setup();

    renderBookingActionsComponent({
      status: BookingStatusLabel.PRE_APPROVED,
      pageContext: PageContextLevel.USER,
    });

    // Open dropdown
    const selectElement = screen.getByRole("combobox");
    await user.click(selectElement);

    // Verify Edit is present but disabled
    const editOption = screen.getByRole("option", { name: "Edit" });
    expect(editOption).toBeInTheDocument();
    expect(editOption).toHaveAttribute("aria-disabled", "true");
  });
});
