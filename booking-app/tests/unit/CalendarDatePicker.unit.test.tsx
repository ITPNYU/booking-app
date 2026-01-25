import { CalendarDatePicker } from "@/components/src/client/routes/booking/components/CalendarDatePicker";
import { BookingContext } from "@/components/src/client/routes/booking/bookingProvider";
import { DatabaseContext } from "@/components/src/client/routes/components/Provider";
import { FormContextLevel, PagePermission } from "@/components/src/types";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock MUI theme
const theme = createTheme();

describe("CalendarDatePicker", () => {
  const mockHandleChange = vi.fn();

  const createBookingContext = (overrides = {}) => ({
    role: "Student",
    department: "Engineering",
    selectedRooms: [],
    bookingCalendarInfo: null,
    formData: null,
    setFormData: vi.fn(),
    isBanned: false,
    needsSafetyTraining: false,
    isInBlackoutPeriod: false,
    ...overrides,
  });

  const createDatabaseContext = (pagePermission: PagePermission) => ({
    userEmail: "test@nyu.edu",
    pagePermission,
    settings: {
      bookingTypes: [],
    },
  });

  const renderCalendarDatePicker = (
    formContext: FormContextLevel,
    pagePermission: PagePermission = PagePermission.BOOKING,
    bookingContextOverrides = {}
  ) => {
    const bookingContext = createBookingContext(bookingContextOverrides);
    const databaseContext = createDatabaseContext(pagePermission);

    return render(
      <ThemeProvider theme={theme}>
        <DatabaseContext.Provider value={databaseContext as any}>
          <BookingContext.Provider value={bookingContext as any}>
            <CalendarDatePicker
              handleChange={mockHandleChange}
              formContext={formContext}
            />
          </BookingContext.Provider>
        </DatabaseContext.Provider>
      </ThemeProvider>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("MODIFICATION context", () => {
    it("disables calendar when user is NOT admin", () => {
      renderCalendarDatePicker(
        FormContextLevel.MODIFICATION,
        PagePermission.BOOKING
      );

      // Find the calendar component - it should be disabled
      const calendar = document.querySelector(".MuiDateCalendar-root");
      expect(calendar).toBeInTheDocument();

      // Check if disabled class is applied
      const disabledElement = document.querySelector(".Mui-disabled");
      expect(disabledElement).toBeInTheDocument();
    });

    it("enables calendar when user IS admin", () => {
      renderCalendarDatePicker(
        FormContextLevel.MODIFICATION,
        PagePermission.ADMIN
      );

      // Find the calendar component - it should be enabled
      const calendar = document.querySelector(".MuiDateCalendar-root");
      expect(calendar).toBeInTheDocument();

      // Check that disabled class is NOT applied to the calendar root
      const disabledCalendar = document.querySelector(
        ".MuiDateCalendar-root.Mui-disabled"
      );
      expect(disabledCalendar).not.toBeInTheDocument();
    });

    it("enables calendar when user is LIAISON (admin role)", () => {
      renderCalendarDatePicker(
        FormContextLevel.MODIFICATION,
        PagePermission.LIAISON
      );

      // Liaison should also have admin access
      const calendar = document.querySelector(".MuiDateCalendar-root");
      expect(calendar).toBeInTheDocument();

      // Check that disabled class is NOT applied to the calendar root
      const disabledCalendar = document.querySelector(
        ".MuiDateCalendar-root.Mui-disabled"
      );
      expect(disabledCalendar).not.toBeInTheDocument();
    });
  });

  describe("Non-MODIFICATION contexts", () => {
    it("enables calendar in FULL_FORM context for regular user", () => {
      renderCalendarDatePicker(
        FormContextLevel.FULL_FORM,
        PagePermission.BOOKING
      );

      // Find the calendar component - it should be enabled
      const calendar = document.querySelector(".MuiDateCalendar-root");
      expect(calendar).toBeInTheDocument();

      // Check that disabled class is NOT applied to the calendar root
      const disabledCalendar = document.querySelector(
        ".MuiDateCalendar-root.Mui-disabled"
      );
      expect(disabledCalendar).not.toBeInTheDocument();
    });

    it("enables calendar in FULL_FORM context for admin", () => {
      renderCalendarDatePicker(
        FormContextLevel.FULL_FORM,
        PagePermission.ADMIN
      );

      // Find the calendar component - it should be enabled
      const calendar = document.querySelector(".MuiDateCalendar-root");
      expect(calendar).toBeInTheDocument();

      // Check that disabled class is NOT applied to the calendar root
      const disabledCalendar = document.querySelector(
        ".MuiDateCalendar-root.Mui-disabled"
      );
      expect(disabledCalendar).not.toBeInTheDocument();
    });

    it("enables calendar in VIP context for regular user", () => {
      renderCalendarDatePicker(FormContextLevel.VIP, PagePermission.BOOKING);

      // Find the calendar component - it should be enabled
      const calendar = document.querySelector(".MuiDateCalendar-root");
      expect(calendar).toBeInTheDocument();

      // Check that disabled class is NOT applied to the calendar root
      const disabledCalendar = document.querySelector(
        ".MuiDateCalendar-root.Mui-disabled"
      );
      expect(disabledCalendar).not.toBeInTheDocument();
    });

    it("enables calendar in VIP context for admin", () => {
      renderCalendarDatePicker(FormContextLevel.VIP, PagePermission.ADMIN);

      // Find the calendar component - it should be enabled
      const calendar = document.querySelector(".MuiDateCalendar-root");
      expect(calendar).toBeInTheDocument();

      // Check that disabled class is NOT applied to the calendar root
      const disabledCalendar = document.querySelector(
        ".MuiDateCalendar-root.Mui-disabled"
      );
      expect(disabledCalendar).not.toBeInTheDocument();
    });
  });

  describe("WALK_IN context", () => {
    it("does not render calendar in WALK_IN context", () => {
      renderCalendarDatePicker(FormContextLevel.WALK_IN, PagePermission.BOOKING);

      // Walk-in should not show calendar at all
      const calendar = document.querySelector(".MuiDateCalendar-root");
      expect(calendar).not.toBeInTheDocument();
    });
  });

  describe("Calendar functionality", () => {
    it("renders calendar with past dates disabled", () => {
      renderCalendarDatePicker(
        FormContextLevel.FULL_FORM,
        PagePermission.BOOKING
      );

      const calendar = document.querySelector(".MuiDateCalendar-root");
      expect(calendar).toBeInTheDocument();

      // Calendar should have disablePast prop applied
      // Past dates will have .Mui-disabled class
      const disabledDates = document.querySelectorAll(
        ".MuiPickersDay-root.Mui-disabled"
      );
      // There should be some disabled dates (past dates)
      expect(disabledDates.length).toBeGreaterThan(0);
    });

    it("initializes with bookingCalendarInfo when provided", () => {
      const testDate = new Date("2024-06-15T10:00:00");
      renderCalendarDatePicker(
        FormContextLevel.FULL_FORM,
        PagePermission.BOOKING,
        {
          bookingCalendarInfo: {
            start: testDate,
            end: new Date("2024-06-15T11:00:00"),
            startStr: "2024-06-15T10:00:00",
            endStr: "2024-06-15T11:00:00",
          },
        }
      );

      const calendar = document.querySelector(".MuiDateCalendar-root");
      expect(calendar).toBeInTheDocument();

      // Verify handleChange was called with the initial date
      expect(mockHandleChange).toHaveBeenCalledWith(testDate);
    });
  });

  describe("Permission-based behavior summary", () => {
    const testCases = [
      {
        formContext: FormContextLevel.MODIFICATION,
        permission: PagePermission.BOOKING,
        description: "MODIFICATION + Regular User",
        shouldBeDisabled: true,
      },
      {
        formContext: FormContextLevel.MODIFICATION,
        permission: PagePermission.ADMIN,
        description: "MODIFICATION + Admin",
        shouldBeDisabled: false,
      },
      {
        formContext: FormContextLevel.MODIFICATION,
        permission: PagePermission.LIAISON,
        description: "MODIFICATION + Liaison",
        shouldBeDisabled: false,
      },
      {
        formContext: FormContextLevel.FULL_FORM,
        permission: PagePermission.BOOKING,
        description: "FULL_FORM + Regular User",
        shouldBeDisabled: false,
      },
      {
        formContext: FormContextLevel.FULL_FORM,
        permission: PagePermission.ADMIN,
        description: "FULL_FORM + Admin",
        shouldBeDisabled: false,
      },
      {
        formContext: FormContextLevel.VIP,
        permission: PagePermission.BOOKING,
        description: "VIP + Regular User",
        shouldBeDisabled: false,
      },
      {
        formContext: FormContextLevel.VIP,
        permission: PagePermission.ADMIN,
        description: "VIP + Admin",
        shouldBeDisabled: false,
      },
    ];

    testCases.forEach(
      ({ formContext, permission, description, shouldBeDisabled }) => {
        it(`${description}: calendar should be ${shouldBeDisabled ? "disabled" : "enabled"}`, () => {
          renderCalendarDatePicker(formContext, permission);

          const calendar = document.querySelector(".MuiDateCalendar-root");
          expect(calendar).toBeInTheDocument();

          const disabledElement = document.querySelector(".Mui-disabled");

          if (shouldBeDisabled) {
            expect(disabledElement).toBeInTheDocument();
          } else {
            // For non-disabled calendars, check that calendar root is not disabled
            const disabledCalendar = document.querySelector(
              ".MuiDateCalendar-root.Mui-disabled"
            );
            expect(disabledCalendar).not.toBeInTheDocument();
          }
        });
      }
    );
  });
});
