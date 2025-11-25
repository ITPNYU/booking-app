import BookingActions from "@/components/src/client/routes/admin/components/BookingActions";
import { Actions } from "@/components/src/client/routes/admin/hooks/useBookingActions";
import { BookingContext } from "@/components/src/client/routes/booking/bookingProvider";
import { DatabaseContext } from "@/components/src/client/routes/components/Provider";
import { BookingStatusLabel, PageContextLevel } from "@/components/src/types";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { fireEvent, render, screen } from "@testing-library/react";
import { Timestamp } from "firebase/firestore";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock next/navigation to avoid errors in hooks
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useParams: () => ({ tenant: "test-tenant" }),
}));

// Helper to render BookingActions with needed providers
const renderBookingActions = (
  {
    now,
    startDate,
    allBookings,
  }: {
    now: Date;
    startDate: Date;
    allBookings: any[];
  },
  pageContext: PageContextLevel = PageContextLevel.PA
) => {
  // Freeze time
  vi.useFakeTimers();
  vi.setSystemTime(now);

  const dbContextValue = {
    reloadFutureBookings: vi.fn(),
    allBookings,
    userEmail: "tester@nyu.edu",
    netId: "tester",
  } as any;

  const bookingContextValue = {
    reloadExistingCalendarEvents: vi.fn(),
  } as any;

  const theme = createTheme();

  render(
    <ThemeProvider theme={theme}>
      <DatabaseContext.Provider value={dbContextValue}>
        <BookingContext.Provider value={bookingContextValue}>
          <BookingActions
            status={BookingStatusLabel.APPROVED}
            calendarEventId="current"
            pageContext={pageContext}
            setOptimisticStatus={vi.fn()}
            onSelect={vi.fn()}
            startDate={Timestamp.fromDate(startDate)}
          />
        </BookingContext.Provider>
      </DatabaseContext.Provider>
    </ThemeProvider>
  );

  // Open the select menu to render MenuItems
  const combobox = screen.getByRole("combobox");
  fireEvent.mouseDown(combobox);
};

describe("BookingActions - Check In availability", () => {
  beforeEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("disables Check In when more than 1 hour before start time", () => {
    const now = new Date("2025-01-01T12:00:00Z");
    const startDate = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours later

    const currentBooking = {
      calendarEventId: "current",
      roomId: "101",
      startDate: Timestamp.fromDate(startDate),
      endDate: Timestamp.fromDate(
        new Date(startDate.getTime() + 60 * 60 * 1000)
      ),
    } as any;

    renderBookingActions({ now, startDate, allBookings: [currentBooking] });

    const checkInItem = screen.getByText(Actions.CHECK_IN);
    expect(checkInItem).toHaveAttribute("aria-disabled", "true");
  });

  it("allows Check In when within 1 hour before start time", () => {
    const now = new Date("2025-01-01T12:30:00Z");
    const startDate = new Date(now.getTime() + 30 * 60 * 1000); // 30 minutes later

    const currentBooking = {
      calendarEventId: "current",
      roomId: "101",
      startDate: Timestamp.fromDate(startDate),
      endDate: Timestamp.fromDate(
        new Date(startDate.getTime() + 60 * 60 * 1000)
      ),
    } as any;

    renderBookingActions({
      now,
      startDate,
      allBookings: [currentBooking],
    });

    const checkInItem = screen.getByText(Actions.CHECK_IN);
    expect(checkInItem).not.toHaveAttribute("aria-disabled");
  });

  it("allows Check In when start time has passed", () => {
    const now = new Date("2025-01-01T13:30:00Z");
    const startDate = new Date(now.getTime() - 30 * 60 * 1000); // 30 minutes ago

    const currentBooking = {
      calendarEventId: "current",
      roomId: "101",
      startDate: Timestamp.fromDate(startDate),
      endDate: Timestamp.fromDate(
        new Date(startDate.getTime() + 60 * 60 * 1000)
      ),
    } as any;

    renderBookingActions({
      now,
      startDate,
      allBookings: [currentBooking],
    });

    const checkInItem = screen.getByText(Actions.CHECK_IN);
    expect(checkInItem).not.toHaveAttribute("aria-disabled");
  });
});
