import { BookingContext } from "@/components/src/client/routes/booking/bookingProvider";
import BookingStatusBar from "@/components/src/client/routes/booking/components/BookingStatusBar";
import { FormContextLevel, Role } from "@/components/src/types";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePathname } from "next/navigation";

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

// Mock the duration limits hook
vi.mock(
  "@/components/src/client/routes/booking/hooks/useCheckDurationLimits",
  () => ({
    default: () => ({ durationError: null }),
  })
);

// Mock SchemaProvider
const mockUseTenantSchema = vi.fn();
vi.mock("@/components/src/client/routes/components/SchemaProvider", () => ({
  useTenantSchema: () => mockUseTenantSchema(),
}));

const theme = createTheme();

const mockBookingContext = {
  bookingCalendarInfo: {
    start: new Date("2024-07-15T09:00:00"),
    end: new Date("2024-07-15T10:00:00"),
    startStr: "2024-07-15T09:00:00",
    endStr: "2024-07-15T10:00:00",
    allDay: false,
    view: {} as any,
    jsEvent: {} as any,
    resource: undefined,
  },
  selectedRooms: [{
    roomId: 101,
    name: "Room 101",
    maxHour: {
      student: 4,
      studentWalkIn: 2,
      faculty: 6,
      facultyWalkIn: 3,
      admin: 8,
      adminWalkIn: 4
    },
    minHour: {
      student: 0.5,
      studentWalkIn: 1,
      faculty: 0.5,
      facultyWalkIn: 1,
      admin: 0.5,
      adminWalkIn: 1
    }
  }] as any[],
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
  role: Role.STUDENT,
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
    // Setup default schema mock for existing tests
    mockUseTenantSchema.mockReturnValue({
      tenant: "media-commons",
      name: "Media Commons",
      timeSensitiveRequestWarning: {
        hours: 48,
        isActive: false,
        message: "",
        policyLink: "",
      },
    });
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

describe("BookingStatusBar - Time Sensitive Request Warning", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset pathname mock to selectRoom page
    vi.mocked(usePathname).mockReturnValue("/test/book/selectRoom");
    // Default schema mock
    mockUseTenantSchema.mockReturnValue({
      tenant: "media-commons",
      name: "Media Commons",
      timeSensitiveRequestWarning: {
        hours: 48,
        isActive: false,
        message: "",
        policyLink: "",
      },
    });
  });

  it("displays warning when all conditions are met (active, within threshold, on selectRoom page)", () => {
    // Mock a booking start time 24 hours in the future
    const futureDate = new Date();
    futureDate.setHours(futureDate.getHours() + 24);

    // Mock schema with active warning
    mockUseTenantSchema.mockReturnValue({
      tenant: "media-commons",
      name: "Media Commons",
      timeSensitiveRequestWarning: {
        hours: 48,
        isActive: true,
        message: "Please note that requests made within 48 hours may not be approved in time.",
        policyLink: "https://example.com/policy",
      },
    });

    renderComponent({
      bookingCalendarInfo: {
        start: futureDate,
        end: new Date(futureDate.getTime() + 3600000),
        startStr: futureDate.toISOString(),
        endStr: new Date(futureDate.getTime() + 3600000).toISOString(),
        allDay: false,
        view: {} as any,
        jsEvent: {} as any,
        resource: undefined,
      },
    });

    expect(screen.getByText(/Please note that requests made within 48 hours/)).toBeInTheDocument();
    expect(screen.getByText("Learn more")).toBeInTheDocument();
  });

  it("does not display warning when isActive is false", () => {
    const futureDate = new Date();
    futureDate.setHours(futureDate.getHours() + 24);

    mockUseTenantSchema.mockReturnValue({
      tenant: "media-commons",
      name: "Media Commons",
      timeSensitiveRequestWarning: {
        hours: 48,
        isActive: false,
        message: "Please note that requests made within 48 hours may not be approved in time.",
        policyLink: "https://example.com/policy",
      },
    });

    renderComponent({
      bookingCalendarInfo: {
        start: futureDate,
        end: new Date(futureDate.getTime() + 3600000),
        startStr: futureDate.toISOString(),
        endStr: new Date(futureDate.getTime() + 3600000).toISOString(),
        allDay: false,
        view: {} as any,
        jsEvent: {} as any,
        resource: undefined,
      },
    });

    expect(screen.queryByText(/Please note that requests made within 48 hours/)).not.toBeInTheDocument();
  });

  it("does not display warning when hours until start exceeds threshold", () => {
    // Mock a booking start time 72 hours in the future (beyond 48 hour threshold)
    const futureDate = new Date();
    futureDate.setHours(futureDate.getHours() + 72);

    mockUseTenantSchema.mockReturnValue({
      tenant: "media-commons",
      name: "Media Commons",
      timeSensitiveRequestWarning: {
        hours: 48,
        isActive: true,
        message: "Please note that requests made within 48 hours may not be approved in time.",
        policyLink: "https://example.com/policy",
      },
    });

    renderComponent({
      bookingCalendarInfo: {
        start: futureDate,
        end: new Date(futureDate.getTime() + 3600000),
        startStr: futureDate.toISOString(),
        endStr: new Date(futureDate.getTime() + 3600000).toISOString(),
        allDay: false,
        view: {} as any,
        jsEvent: {} as any,
        resource: undefined,
      },
    });

    expect(screen.queryByText(/Please note that requests made within 48 hours/)).not.toBeInTheDocument();
  });

  it("does not display warning when not on selectRoom page", () => {
    const futureDate = new Date();
    futureDate.setHours(futureDate.getHours() + 24);

    // Mock pathname to a different page
    vi.mocked(usePathname).mockReturnValue("/test/book/details");

    mockUseTenantSchema.mockReturnValue({
      tenant: "media-commons",
      name: "Media Commons",
      timeSensitiveRequestWarning: {
        hours: 48,
        isActive: true,
        message: "Please note that requests made within 48 hours may not be approved in time.",
        policyLink: "https://example.com/policy",
      },
    });

    renderComponent({
      bookingCalendarInfo: {
        start: futureDate,
        end: new Date(futureDate.getTime() + 3600000),
        startStr: futureDate.toISOString(),
        endStr: new Date(futureDate.getTime() + 3600000).toISOString(),
        allDay: false,
        view: {} as any,
        jsEvent: {} as any,
        resource: undefined,
      },
    });

    expect(screen.queryByText(/Please note that requests made within 48 hours/)).not.toBeInTheDocument();
  });

  it("does not display warning when booking start is in the past", () => {
    // Mock a booking start time in the past
    const pastDate = new Date();
    pastDate.setHours(pastDate.getHours() - 1);

    mockUseTenantSchema.mockReturnValue({
      tenant: "media-commons",
      name: "Media Commons",
      timeSensitiveRequestWarning: {
        hours: 48,
        isActive: true,
        message: "Please note that requests made within 48 hours may not be approved in time.",
        policyLink: "https://example.com/policy",
      },
    });

    renderComponent({
      bookingCalendarInfo: {
        start: pastDate,
        end: new Date(pastDate.getTime() + 3600000),
        startStr: pastDate.toISOString(),
        endStr: new Date(pastDate.getTime() + 3600000).toISOString(),
        allDay: false,
        view: {} as any,
        jsEvent: {} as any,
        resource: undefined,
      },
    });

    expect(screen.queryByText(/Please note that requests made within 48 hours/)).not.toBeInTheDocument();
  });

  it("respects custom hours threshold", () => {
    // Mock a booking start time 10 hours in the future
    const futureDate = new Date();
    futureDate.setHours(futureDate.getHours() + 10);

    // Set custom threshold of 12 hours
    mockUseTenantSchema.mockReturnValue({
      tenant: "media-commons",
      name: "Media Commons",
      timeSensitiveRequestWarning: {
        hours: 12,
        isActive: true,
        message: "Please note that requests made within 12 hours may not be approved in time.",
        policyLink: "https://example.com/policy",
      },
    });

    renderComponent({
      bookingCalendarInfo: {
        start: futureDate,
        end: new Date(futureDate.getTime() + 3600000),
        startStr: futureDate.toISOString(),
        endStr: new Date(futureDate.getTime() + 3600000).toISOString(),
        allDay: false,
        view: {} as any,
        jsEvent: {} as any,
        resource: undefined,
      },
    });

    expect(screen.getByText(/Please note that requests made within 12 hours/)).toBeInTheDocument();
  });

  it("displays correct warning message content", () => {
    const futureDate = new Date();
    futureDate.setHours(futureDate.getHours() + 24);

    const customMessage = "Custom warning message for time-sensitive requests.";

    mockUseTenantSchema.mockReturnValue({
      tenant: "media-commons",
      name: "Media Commons",
      timeSensitiveRequestWarning: {
        hours: 48,
        isActive: true,
        message: customMessage,
        policyLink: "",
      },
    });

    renderComponent({
      bookingCalendarInfo: {
        start: futureDate,
        end: new Date(futureDate.getTime() + 3600000),
        startStr: futureDate.toISOString(),
        endStr: new Date(futureDate.getTime() + 3600000).toISOString(),
        allDay: false,
        view: {} as any,
        jsEvent: {} as any,
        resource: undefined,
      },
    });

    expect(screen.getByText(customMessage)).toBeInTheDocument();
  });

  it("renders policy link when provided", () => {
    const futureDate = new Date();
    futureDate.setHours(futureDate.getHours() + 24);

    const policyLink = "https://example.com/time-sensitive-policy";

    mockUseTenantSchema.mockReturnValue({
      tenant: "media-commons",
      name: "Media Commons",
      timeSensitiveRequestWarning: {
        hours: 48,
        isActive: true,
        message: "Warning message",
        policyLink: policyLink,
      },
    });

    renderComponent({
      bookingCalendarInfo: {
        start: futureDate,
        end: new Date(futureDate.getTime() + 3600000),
        startStr: futureDate.toISOString(),
        endStr: new Date(futureDate.getTime() + 3600000).toISOString(),
        allDay: false,
        view: {} as any,
        jsEvent: {} as any,
        resource: undefined,
      },
    });

    const link = screen.getByText("Learn more");
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", policyLink);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("does not render policy link when not provided", () => {
    const futureDate = new Date();
    futureDate.setHours(futureDate.getHours() + 24);

    mockUseTenantSchema.mockReturnValue({
      tenant: "media-commons",
      name: "Media Commons",
      timeSensitiveRequestWarning: {
        hours: 48,
        isActive: true,
        message: "Warning message",
        policyLink: "",
      },
    });

    renderComponent({
      bookingCalendarInfo: {
        start: futureDate,
        end: new Date(futureDate.getTime() + 3600000),
        startStr: futureDate.toISOString(),
        endStr: new Date(futureDate.getTime() + 3600000).toISOString(),
        allDay: false,
        view: {} as any,
        jsEvent: {} as any,
        resource: undefined,
      },
    });

    expect(screen.queryByText("Learn more")).not.toBeInTheDocument();
  });
});
