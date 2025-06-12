import { BookingContext } from "@/components/src/client/routes/booking/bookingProvider";
import BookingStatusBar from "@/components/src/client/routes/booking/components/BookingStatusBar";
import { FormContextLevel } from "@/components/src/types";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the hooks
vi.mock(
  "@/components/src/client/routes/booking/hooks/useCalculateOverlap",
  () => ({
    default: () => false,
  })
);

vi.mock(
  "@/components/src/client/routes/booking/hooks/useCheckAutoApproval",
  () => ({
    default: () => ({ isAutoApproval: true, errorMessage: null }),
  })
);

const theme = createTheme();

const mockBookingContext = {
  bookingCalendarInfo: {
    start: new Date("2024-07-15"),
    end: new Date("2024-07-15"),
    startStr: "2024-07-15",
    endStr: "2024-07-15",
    allDay: false,
    view: {} as any,
    jsEvent: {} as any,
    resource: undefined,
  },
  selectedRooms: [{ roomId: 101, name: "Room 101" }] as any[],
  isBanned: false,
  needsSafetyTraining: false,
  isInBlackoutPeriod: false,
  // Add other required context properties
  department: undefined,
  existingCalendarEvents: [],
  formData: undefined,
  hasShownMocapModal: false,
  isSafetyTrained: true,
  reloadExistingCalendarEvents: vi.fn(),
  role: undefined,
  setBookingCalendarInfo: vi.fn(),
  setDepartment: vi.fn(),
  setFormData: vi.fn(),
  setHasShownMocapModal: vi.fn(),
  setRole: vi.fn(),
  setSelectedRooms: vi.fn(),
  setSubmitting: vi.fn(),
  submitting: "none" as any,
  fetchingStatus: "loaded" as any,
  error: null,
  setError: vi.fn(),
};

const defaultProps = {
  formContext: FormContextLevel.FULL_FORM,
  goBack: vi.fn(),
  goNext: vi.fn(),
  hideBackButton: false,
  hideNextButton: false,
};

const renderComponent = (contextOverrides = {}, propsOverrides = {}) => {
  const context = { ...mockBookingContext, ...contextOverrides };
  const props = { ...defaultProps, ...propsOverrides };

  return render(
    <ThemeProvider theme={theme}>
      <BookingContext.Provider value={context}>
        <BookingStatusBar {...props} />
      </BookingContext.Provider>
    </ThemeProvider>
  );
};

describe("BookingStatusBar - Blackout Period Handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders next button as enabled when not in blackout period", () => {
    renderComponent();

    const nextButton = screen.getByRole("button", { name: /next/i });
    expect(nextButton).not.toBeDisabled();
  });

  it("renders next button as disabled when in blackout period", () => {
    renderComponent({ isInBlackoutPeriod: true });

    const nextButton = screen.getByRole("button", { name: /next/i });
    expect(nextButton).toBeDisabled();
  });

  it("shows blackout period error message when in blackout period", () => {
    renderComponent({ isInBlackoutPeriod: true });

    expect(
      screen.getByText(/The selected date falls within a blackout period/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Please select a different date/)
    ).toBeInTheDocument();
  });

  it("shows auto-approval success message when not in blackout period and conditions are met", () => {
    renderComponent();

    expect(
      screen.getByText(/Yay! This request is eligible for automatic approval/)
    ).toBeInTheDocument();
  });

  it("prioritizes banned status over blackout period", () => {
    renderComponent({
      isBanned: true,
      isInBlackoutPeriod: true,
    });

    expect(screen.getByText(/You are banned from booking/)).toBeInTheDocument();
    expect(screen.queryByText(/blackout period/)).not.toBeInTheDocument();
  });

  it("prioritizes safety training over blackout period", () => {
    renderComponent({
      needsSafetyTraining: true,
      isInBlackoutPeriod: true,
    });

    expect(
      screen.getByText(/You have not taken safety training/)
    ).toBeInTheDocument();
    expect(screen.queryByText(/blackout period/)).not.toBeInTheDocument();
  });

  it("shows blackout period error when only blackout condition is true", () => {
    renderComponent({
      isBanned: false,
      needsSafetyTraining: false,
      isInBlackoutPeriod: true,
    });

    expect(
      screen.getByText(/The selected date falls within a blackout period/)
    ).toBeInTheDocument();
  });

  // TODO: Fix multiple alert issue
  // it("does not show alert when no booking calendar info is selected", () => {
  //   renderComponent({
  //     bookingCalendarInfo: null,
  //     selectedRooms: [],
  //     isInBlackoutPeriod: false,
  //   });

  //   // Should not show any alert
  //   expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  // });

  it("shows alert when booking calendar info exists and in blackout period", () => {
    renderComponent({ isInBlackoutPeriod: true });

    const alerts = screen.getAllByRole("alert");
    const blackoutAlert = alerts.find((alert) =>
      alert.textContent?.includes("blackout period")
    );
    expect(blackoutAlert).toBeInTheDocument();
  });

  it("provides correct tooltip message for disabled next button when in blackout", () => {
    renderComponent({ isInBlackoutPeriod: true });

    const nextButton = screen.getByRole("button", { name: /next/i });
    const tooltipWrapper = nextButton.closest(
      '[aria-label="Selected date is within a blackout period"]'
    );
    expect(tooltipWrapper).toBeInTheDocument();
  });

  it("shows correct alert severity for blackout period error", () => {
    renderComponent({ isInBlackoutPeriod: true });

    const alerts = screen.getAllByRole("alert");
    const blackoutAlert = alerts.find((alert) =>
      alert.textContent?.includes("blackout period")
    );
    expect(blackoutAlert).toHaveClass("MuiAlert-filledError");
  });

  it("handles walk-in form context correctly with blackout period", () => {
    renderComponent(
      {
        isInBlackoutPeriod: true,
      },
      {
        formContext: FormContextLevel.WALK_IN,
      }
    );

    const nextButton = screen.getByRole("button", { name: /next/i });
    expect(nextButton).toBeDisabled();
    expect(screen.getByText(/blackout period/)).toBeInTheDocument();
  });

  it("handles modification form context correctly with blackout period", () => {
    renderComponent(
      {
        isInBlackoutPeriod: true,
      },
      {
        formContext: FormContextLevel.MODIFICATION,
      }
    );

    const nextButton = screen.getByRole("button", { name: /next/i });
    expect(nextButton).toBeDisabled();
    expect(screen.getByText(/blackout period/)).toBeInTheDocument();
  });

  it("renders back button when not hidden", () => {
    renderComponent();

    expect(screen.getByRole("button", { name: /back/i })).toBeInTheDocument();
  });

  it("does not render back button when hidden", () => {
    renderComponent({}, { hideBackButton: true });

    expect(
      screen.queryByRole("button", { name: /back/i })
    ).not.toBeInTheDocument();
  });

  it("does not render next button when hidden", () => {
    renderComponent({}, { hideNextButton: true });

    expect(
      screen.queryByRole("button", { name: /next/i })
    ).not.toBeInTheDocument();
  });

  it("calls goNext when next button is clicked and not disabled", () => {
    const goNext = vi.fn();
    renderComponent({}, { goNext });

    const nextButton = screen.getByRole("button", { name: /next/i });
    nextButton.click();

    expect(goNext).toHaveBeenCalled();
  });

  it("calls goBack when back button is clicked", () => {
    const goBack = vi.fn();
    renderComponent({}, { goBack });

    const backButton = screen.getByRole("button", { name: /back/i });
    backButton.click();

    expect(goBack).toHaveBeenCalled();
  });
});
