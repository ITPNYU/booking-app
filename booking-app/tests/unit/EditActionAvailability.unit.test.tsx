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

const renderBookingActions = ({
  now,
  startDate,
  status = BookingStatusLabel.REQUESTED,
  pageContext = PageContextLevel.USER,
}: {
  now: Date;
  startDate: Date;
  status?: BookingStatusLabel;
  pageContext?: PageContextLevel;
}) => {
  vi.useFakeTimers();
  vi.setSystemTime(now);

  const dbContextValue = {
    reloadFutureBookings: vi.fn(),
    updateBookingInList: vi.fn(),
    allBookings: [],
    netId: "tester",
  } as any;

  const bookingContextValue = {
    reloadExistingCalendarEvents: vi.fn(),
  } as any;

  render(
    <ThemeProvider theme={createTheme()}>
      <DatabaseContext.Provider value={dbContextValue}>
        <BookingContext.Provider value={bookingContextValue}>
          <BookingActions
            status={status}
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

  fireEvent.mouseDown(screen.getByRole("combobox"));
};

describe("BookingActions - Edit availability", () => {
  beforeEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("allows Edit before the booking start time", () => {
    const now = new Date("2025-01-01T12:00:00Z");
    const startDate = new Date(now.getTime() + 60 * 60 * 1000);

    renderBookingActions({ now, startDate });

    expect(screen.getByText(Actions.EDIT)).not.toHaveAttribute("aria-disabled");
  });

  it("disables Edit once the booking start time has passed", () => {
    const now = new Date("2025-01-01T12:00:00Z");
    const startDate = new Date(now.getTime() - 60 * 60 * 1000);

    renderBookingActions({ now, startDate });

    expect(screen.getByText(Actions.EDIT)).toHaveAttribute(
      "aria-disabled",
      "true"
    );
  });

  it("disables Edit exactly at the booking start time", () => {
    const now = new Date("2025-01-01T12:00:00Z");

    renderBookingActions({ now, startDate: now });

    expect(screen.getByText(Actions.EDIT)).toHaveAttribute(
      "aria-disabled",
      "true"
    );
  });

  it("disables Edit on a declined booking once the start time has passed", () => {
    const now = new Date("2025-01-01T12:00:00Z");
    const startDate = new Date(now.getTime() - 60 * 60 * 1000);

    renderBookingActions({
      now,
      startDate,
      status: BookingStatusLabel.DECLINED,
    });

    expect(screen.getByText(Actions.EDIT)).toHaveAttribute(
      "aria-disabled",
      "true"
    );
  });

  it("keeps Cancel available after the booking start time", () => {
    const now = new Date("2025-01-01T12:00:00Z");
    const startDate = new Date(now.getTime() - 60 * 60 * 1000);

    renderBookingActions({ now, startDate });

    expect(screen.getByText(Actions.CANCEL)).not.toHaveAttribute(
      "aria-disabled"
    );
  });

  it("keeps Modification available to a PA after the booking start time", () => {
    const now = new Date("2025-01-01T12:00:00Z");
    const startDate = new Date(now.getTime() - 60 * 60 * 1000);

    renderBookingActions({
      now,
      startDate,
      status: BookingStatusLabel.APPROVED,
      pageContext: PageContextLevel.PA,
    });

    expect(screen.getByText(Actions.MODIFICATION)).not.toHaveAttribute(
      "aria-disabled"
    );
  });
});
