import {
  BookingContext,
  BookingProvider,
} from "@/components/src/client/routes/booking/bookingProvider";
import { DatabaseContext } from "@/components/src/client/routes/components/Provider";
import { DateSelectArg } from "@fullcalendar/core";
import { act, render, screen } from "@testing-library/react";
import dayjs from "dayjs";
import { Timestamp } from "firebase/firestore";
import { useContext } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: () => "/book",
}));

// Mock the fetchCalendarEvents hook
vi.mock(
  "@/components/src/client/routes/booking/hooks/fetchCalendarEvents",
  () => ({
    default: () => ({
      existingCalendarEvents: [],
      reloadExistingCalendarEvents: vi.fn(),
      fetchingStatus: "loaded",
    }),
  })
);

const mockBlackoutPeriods = [
  {
    id: "1",
    name: "Summer Break",
    startDate: Timestamp.fromDate(dayjs("2024-06-01").toDate()),
    endDate: Timestamp.fromDate(dayjs("2024-08-31").toDate()),
    isActive: true,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  },
  {
    id: "2",
    name: "Winter Holidays",
    startDate: Timestamp.fromDate(dayjs("2024-12-20").toDate()),
    endDate: Timestamp.fromDate(dayjs("2025-01-05").toDate()),
    isActive: true,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  },
  {
    id: "3",
    name: "Inactive Period",
    startDate: Timestamp.fromDate(dayjs("2024-03-15").toDate()),
    endDate: Timestamp.fromDate(dayjs("2024-03-20").toDate()),
    isActive: false,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  },
];

const mockDatabaseContext = {
  bannedUsers: [],
  roomSettings: [],
  safetyTrainedUsers: [],
  userEmail: "test@nyu.edu",
  blackoutPeriods: mockBlackoutPeriods,
  reloadSafetyTrainedUsers: vi.fn(),
};

// Test component to access the BookingContext
const TestComponent = () => {
  const { isInBlackoutPeriod, setBookingCalendarInfo } =
    useContext(BookingContext);

  return (
    <div>
      <span data-testid="blackout-status">
        {isInBlackoutPeriod ? "in-blackout" : "not-in-blackout"}
      </span>
      <button
        data-testid="set-booking"
        onClick={() => {
          const mockDateSelectArg: DateSelectArg = {
            start: dayjs("2024-07-15").toDate(),
            end: dayjs("2024-07-15").toDate(),
            startStr: "2024-07-15",
            endStr: "2024-07-15",
            allDay: false,
            view: {} as any,
            jsEvent: {} as any,
            resource: undefined,
          };
          setBookingCalendarInfo(mockDateSelectArg);
        }}
      >
        Set Summer Date
      </button>
      <button
        data-testid="set-normal-booking"
        onClick={() => {
          const mockDateSelectArg: DateSelectArg = {
            start: dayjs("2024-05-15").toDate(),
            end: dayjs("2024-05-15").toDate(),
            startStr: "2024-05-15",
            endStr: "2024-05-15",
            allDay: false,
            view: {} as any,
            jsEvent: {} as any,
            resource: undefined,
          };
          setBookingCalendarInfo(mockDateSelectArg);
        }}
      >
        Set Normal Date
      </button>
      <button
        data-testid="set-inactive-period"
        onClick={() => {
          const mockDateSelectArg: DateSelectArg = {
            start: dayjs("2024-03-17").toDate(),
            end: dayjs("2024-03-17").toDate(),
            startStr: "2024-03-17",
            endStr: "2024-03-17",
            allDay: false,
            view: {} as any,
            jsEvent: {} as any,
            resource: undefined,
          };
          setBookingCalendarInfo(mockDateSelectArg);
        }}
      >
        Set Inactive Period Date
      </button>
    </div>
  );
};

const renderWithProviders = (databaseContextValue = mockDatabaseContext) => {
  return render(
    <DatabaseContext.Provider value={databaseContextValue as any}>
      <BookingProvider>
        <TestComponent />
      </BookingProvider>
    </DatabaseContext.Provider>
  );
};

describe("BookingProvider - isInBlackoutPeriod Logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should initially return false when no booking date is selected", () => {
    renderWithProviders();

    expect(screen.getByTestId("blackout-status")).toHaveTextContent(
      "not-in-blackout"
    );
  });

  it("should return true when booking date falls within an active blackout period", async () => {
    renderWithProviders();

    // Set a date within Summer Break (active period)
    const setBookingButton = screen.getByTestId("set-booking");
    await act(async () => {
      setBookingButton.click();
    });

    expect(screen.getByTestId("blackout-status")).toHaveTextContent(
      "in-blackout"
    );
  });

  it("should return false when booking date falls outside all blackout periods", async () => {
    renderWithProviders();

    // Set a date outside all blackout periods
    const setNormalBookingButton = screen.getByTestId("set-normal-booking");
    await act(async () => {
      setNormalBookingButton.click();
    });

    expect(screen.getByTestId("blackout-status")).toHaveTextContent(
      "not-in-blackout"
    );
  });

  it("should return false when booking date falls within an inactive blackout period", async () => {
    renderWithProviders();

    // Set a date within Inactive Period
    const setInactivePeriodButton = screen.getByTestId("set-inactive-period");
    await act(async () => {
      setInactivePeriodButton.click();
    });

    expect(screen.getByTestId("blackout-status")).toHaveTextContent(
      "not-in-blackout"
    );
  });

  it("should handle empty blackout periods array", async () => {
    const contextWithEmptyPeriods = {
      ...mockDatabaseContext,
      blackoutPeriods: [],
    };

    renderWithProviders(contextWithEmptyPeriods);

    // Set any date - should not be in blackout
    const setBookingButton = screen.getByTestId("set-booking");
    await act(async () => {
      setBookingButton.click();
    });

    expect(screen.getByTestId("blackout-status")).toHaveTextContent(
      "not-in-blackout"
    );
  });

  it("should handle undefined blackout periods", async () => {
    const contextWithUndefinedPeriods = {
      ...mockDatabaseContext,
      blackoutPeriods: undefined,
    };

    renderWithProviders(contextWithUndefinedPeriods as any);

    // Set any date - should not be in blackout
    const setBookingButton = screen.getByTestId("set-booking");
    await act(async () => {
      setBookingButton.click();
    });

    expect(screen.getByTestId("blackout-status")).toHaveTextContent(
      "not-in-blackout"
    );
  });

  it("should correctly handle boundary dates of blackout periods", () => {
    // Create a test component with boundary date setting functions
    const BoundaryTestComponent = () => {
      const { isInBlackoutPeriod, setBookingCalendarInfo } =
        useContext(BookingContext);

      return (
        <div>
          <span data-testid="blackout-status">
            {isInBlackoutPeriod ? "in-blackout" : "not-in-blackout"}
          </span>
          <button
            data-testid="set-start-date"
            onClick={() => {
              const mockDateSelectArg: DateSelectArg = {
                start: dayjs("2024-06-01").toDate(), // Start of Summer Break
                end: dayjs("2024-06-01").toDate(),
                startStr: "2024-06-01",
                endStr: "2024-06-01",
                allDay: false,
                view: {} as any,
                jsEvent: {} as any,
                resource: undefined,
              };
              setBookingCalendarInfo(mockDateSelectArg);
            }}
          >
            Set Start Date
          </button>
          <button
            data-testid="set-end-date"
            onClick={() => {
              const mockDateSelectArg: DateSelectArg = {
                start: dayjs("2024-08-31").toDate(), // End of Summer Break
                end: dayjs("2024-08-31").toDate(),
                startStr: "2024-08-31",
                endStr: "2024-08-31",
                allDay: false,
                view: {} as any,
                jsEvent: {} as any,
                resource: undefined,
              };
              setBookingCalendarInfo(mockDateSelectArg);
            }}
          >
            Set End Date
          </button>
          <button
            data-testid="set-before-period"
            onClick={() => {
              const mockDateSelectArg: DateSelectArg = {
                start: dayjs("2024-05-31").toDate(), // Day before Summer Break
                end: dayjs("2024-05-31").toDate(),
                startStr: "2024-05-31",
                endStr: "2024-05-31",
                allDay: false,
                view: {} as any,
                jsEvent: {} as any,
                resource: undefined,
              };
              setBookingCalendarInfo(mockDateSelectArg);
            }}
          >
            Set Before Period
          </button>
          <button
            data-testid="set-after-period"
            onClick={() => {
              const mockDateSelectArg: DateSelectArg = {
                start: dayjs("2024-09-01").toDate(), // Day after Summer Break
                end: dayjs("2024-09-01").toDate(),
                startStr: "2024-09-01",
                endStr: "2024-09-01",
                allDay: false,
                view: {} as any,
                jsEvent: {} as any,
                resource: undefined,
              };
              setBookingCalendarInfo(mockDateSelectArg);
            }}
          >
            Set After Period
          </button>
        </div>
      );
    };

    render(
      <DatabaseContext.Provider value={mockDatabaseContext as any}>
        <BookingProvider>
          <BoundaryTestComponent />
        </BookingProvider>
      </DatabaseContext.Provider>
    );

    // Test start date (should be in blackout)
    screen.getByTestId("set-start-date").click();
    expect(screen.getByTestId("blackout-status")).toHaveTextContent(
      "in-blackout"
    );

    // Test end date (should be in blackout)
    screen.getByTestId("set-end-date").click();
    expect(screen.getByTestId("blackout-status")).toHaveTextContent(
      "in-blackout"
    );

    // Test day before period (should not be in blackout)
    screen.getByTestId("set-before-period").click();
    expect(screen.getByTestId("blackout-status")).toHaveTextContent(
      "not-in-blackout"
    );

    // Test day after period (should not be in blackout)
    screen.getByTestId("set-after-period").click();
    expect(screen.getByTestId("blackout-status")).toHaveTextContent(
      "not-in-blackout"
    );
  });

  it("should update isInBlackoutPeriod when blackout periods change", () => {
    const { rerender } = renderWithProviders();

    // Initially set a date that's not in any blackout period
    screen.getByTestId("set-normal-booking").click();
    expect(screen.getByTestId("blackout-status")).toHaveTextContent(
      "not-in-blackout"
    );

    // Now add a blackout period that includes the selected date
    const newBlackoutPeriods = [
      ...mockBlackoutPeriods,
      {
        id: "4",
        name: "New Period",
        startDate: Timestamp.fromDate(dayjs("2024-05-01").toDate()),
        endDate: Timestamp.fromDate(dayjs("2024-05-31").toDate()),
        isActive: true,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      },
    ];

    const updatedContext = {
      ...mockDatabaseContext,
      blackoutPeriods: newBlackoutPeriods,
    };

    rerender(
      <DatabaseContext.Provider value={updatedContext as any}>
        <BookingProvider>
          <TestComponent />
        </BookingProvider>
      </DatabaseContext.Provider>
    );

    // The previously set date (2024-05-15) should now be in blackout
    expect(screen.getByTestId("blackout-status")).toHaveTextContent(
      "in-blackout"
    );
  });
});
